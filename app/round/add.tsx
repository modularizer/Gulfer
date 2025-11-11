import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity, Alert } from 'react-native';
import { useTheme, Button, Text, IconButton, Dialog, Portal, TextInput } from 'react-native-paper';
import { router } from 'expo-router';

// Conditional DateTimePicker import for native platforms
let DateTimePicker: any;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}
import { createNewRound } from '@/services/storage/roundStorage';
import { getCurrentUserName, getUserIdForPlayerName } from '@/services/storage/userStorage';
import { getLastUsedCourse, getLatestAddedCourse } from '@/services/storage/courseStorage';
import { importRound, parseExportText } from '@/services/roundExport';
import { getImportMappingInfo, createManualMappings } from '@/services/importMapping';
import { Player } from '@/types';
import ImportMappingDialog from '@/components/common/ImportMappingDialog';
import { normalizeExportText } from '@/utils';

type RoundType = 'play-now' | 'past' | 'future' | null;

export default function NewRoundScreen() {
  const theme = useTheme();
  const [roundType, setRoundType] = useState<RoundType>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [importDialogVisible, setImportDialogVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [importTextValid, setImportTextValid] = useState<boolean | null>(null);
  const [importTextError, setImportTextError] = useState<string | null>(null);
  const [mappingDialogVisible, setMappingDialogVisible] = useState(false);
  const [importMappingInfo, setImportMappingInfo] = useState<{
    foreignStorageId?: string;
    foreignCourse: { foreignId: string; foreignName: string; localId: string | null; suggestedLocalId: string | null } | null;
    foreignPlayers: Array<{ foreignId: string; foreignName: string; localId: string | null; suggestedLocalId: string | null }>;
    localCourses: Array<{ id: string; name: string }>;
    localPlayers: Array<{ id: string; name: string }>;
  } | null>(null);

  useEffect(() => {
    // Initialize with current date/time
    setSelectedDate(new Date());
  }, []);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      // Preserve the time when changing date
      const newDate = new Date(date);
      newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
      setSelectedDate(newDate);
    }
  };

  const handleTimeChange = (event: any, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      // Preserve the date when changing time
      const newDate = new Date(selectedDate);
      newDate.setHours(date.getHours(), date.getMinutes());
      setSelectedDate(newDate);
    }
  };

  const handleCreateRound = async (date: number) => {
    try {
      // Try to get the current user's name, default to "You" if not set
      const currentUserName = await getCurrentUserName();
      const playerName = currentUserName || 'You';
      const playerId = await getUserIdForPlayerName(playerName);
      const defaultPlayer: Player = { 
        id: playerId, 
        name: playerName,
      };
      
      // Get default course (last used or latest added)
      const defaultCourse = await getLastUsedCourse() || await getLatestAddedCourse();
      const courseName = defaultCourse ? defaultCourse.name : undefined;
      const courseId = defaultCourse ? defaultCourse.id : undefined;
      
      const newRound = await createNewRound({
        players: [defaultPlayer],
        courseName,
        courseId,
        date,
      });
      
      // Redirect to the overview page
      router.replace(`/round/${newRound.id}/overview`);
    } catch (error) {
      console.error('Error creating round:', error);
      router.push('/');
    }
  };

  const handlePlayNow = () => {
    handleCreateRound(Date.now());
  };

  const handleRecordPast = () => {
    setRoundType('past');
  };

  const handleSchedule = () => {
    setRoundType('future');
  };

  const handleConfirmDate = () => {
    const timestamp = selectedDate.getTime();
    handleCreateRound(timestamp);
  };

  const handleCancel = () => {
    setRoundType(null);
  };

  // Validate import text whenever it changes
  useEffect(() => {
    if (!importText.trim()) {
      setImportTextValid(null);
      setImportTextError(null);
      return;
    }

    try {
      parseExportText(importText);
      setImportTextValid(true);
      setImportTextError(null);
    } catch (error) {
      setImportTextValid(false);
      setImportTextError(error instanceof Error ? error.message : 'Invalid export format');
    }
  }, [importText]);

  const handleImportRound = useCallback(async () => {
    if (!importText.trim()) {
      Alert.alert('Error', 'Please paste the round export text');
      return;
    }

    try {
      // Parse the export to get mapping info
      const mappingInfo = await getImportMappingInfo(importText);
      
      // If mapping is needed, show mapping dialog
      if (mappingInfo.needsMapping) {
        setImportMappingInfo({
          foreignStorageId: mappingInfo.foreignStorageId,
          foreignCourse: mappingInfo.courseMapping,
          foreignPlayers: mappingInfo.playerMappings,
          localCourses: mappingInfo.localCourses,
          localPlayers: mappingInfo.localPlayers,
        });
        setImportDialogVisible(false);
        setMappingDialogVisible(true);
      } else {
        // No mapping needed (all already mapped or no local entities exist), import directly
        const newRoundId = await importRound(importText);
        setImportText('');
        setImportTextValid(null);
        setImportTextError(null);
        setImportDialogVisible(false);
        router.replace(`/round/${newRoundId}/overview`);
      }
    } catch (error) {
      console.error('Error parsing import:', error);
      Alert.alert('Import Error', error instanceof Error ? error.message : 'Failed to parse import');
    }
  }, [importText]);

  const handleMappingConfirm = useCallback(async (mappings: {
    courseMapping?: { foreignCourseId: string; localCourseId: string | null };
    playerMappings: Array<{ foreignPlayerId: string; localPlayerId: string | null }>;
  }) => {
    try {
      // Create manual mappings object - only include mappings where user selected an existing local entity
      // If localCourseId/localPlayerId is null, it means "create new", so we don't include it in mappings
      const manualMappings = createManualMappings({
        courseMapping: mappings.courseMapping && mappings.courseMapping.localCourseId ? {
          foreignCourseId: mappings.courseMapping.foreignCourseId,
          localCourseId: mappings.courseMapping.localCourseId,
        } : undefined,
        playerMappings: mappings.playerMappings
          .filter(m => m.localPlayerId !== null)
          .map(m => ({
            foreignPlayerId: m.foreignPlayerId,
            localPlayerId: m.localPlayerId!,
          })),
      });

      // Import with manual mappings (null means "create new", which importRound handles automatically)
      const newRoundId = await importRound(importText, manualMappings);
      setImportText('');
      setMappingDialogVisible(false);
      setImportMappingInfo(null);
      router.replace(`/round/${newRoundId}/overview`);
    } catch (error) {
      console.error('Error importing round:', error);
      Alert.alert('Import Error', error instanceof Error ? error.message : 'Failed to import round');
    }
  }, [importText]);

  if (roundType === null) {
    // Show three options
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor={theme.colors.onSurface}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            New Round
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            When did/will this round happen?
          </Text>

          <Button
            mode="contained"
            icon="play"
            onPress={handlePlayNow}
            style={styles.optionButton}
            contentStyle={styles.buttonContent}
          >
            Play Now
          </Button>

          <Button
            mode="outlined"
            icon="history"
            onPress={handleRecordPast}
            style={styles.optionButton}
            contentStyle={styles.buttonContent}
          >
            Record Past Game
          </Button>

          <Button
            mode="outlined"
            icon="calendar-clock"
            onPress={handleSchedule}
            style={styles.optionButton}
            contentStyle={styles.buttonContent}
          >
            Schedule Game
          </Button>

          <Button
            mode="outlined"
            icon="import"
            onPress={() => setImportDialogVisible(true)}
            style={styles.optionButton}
            contentStyle={styles.buttonContent}
          >
            Import Round
          </Button>
        </ScrollView>

        {/* Import Dialog */}
        <Portal>
          <Dialog
            visible={importDialogVisible}
            onDismiss={() => {
              setImportDialogVisible(false);
              setImportText('');
              setImportTextValid(null);
              setImportTextError(null);
            }}
            style={styles.importDialog}
          >
            <Dialog.Title>Import Round</Dialog.Title>
            <Dialog.Content>
              <View style={styles.importHelpTextContainer}>
                <Text style={[styles.importHelpText, { color: theme.colors.onSurfaceVariant }]}>
                  Paste the round export text below. You'll be able to map imported entities to your local entities.
                </Text>
              </View>
              <View style={styles.importTextInputContainer}>
                <TextInput
                  mode="outlined"
                  value={importText}
                  onChangeText={(text) => {
                    // Normalize text immediately when pasted/typed to replace non-breaking spaces
                    const normalized = normalizeExportText(text);
                    setImportText(normalized);
                  }}
                  multiline
                  numberOfLines={30}
                  style={styles.importTextInput}
                  contentStyle={styles.importTextContent}
                  placeholder="Paste round export text here..."
                  error={importTextValid === false}
                />
              </View>
              {importText.trim() && (
                <View style={styles.validationContainer}>
                  {importTextValid === true ? (
                    <View style={styles.validationRow}>
                      <IconButton icon="check-circle" size={20} iconColor={theme.colors.primary} style={styles.validationIcon} />
                      <Text style={[styles.validationText, { color: theme.colors.primary }]}>
                        Valid export format
                      </Text>
                    </View>
                  ) : importTextValid === false ? (
                    <View style={styles.validationRow}>
                      <IconButton icon="alert-circle" size={20} iconColor={theme.colors.error} style={styles.validationIcon} />
                      <Text style={[styles.validationText, { color: theme.colors.error }]}>
                        {importTextError || 'Invalid export format'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => {
                setImportDialogVisible(false);
                setImportText('');
                setImportTextValid(null);
                setImportTextError(null);
              }}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleImportRound}
                disabled={!importText.trim() || importTextValid === false}
              >
                Next
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Mapping Dialog */}
        {importMappingInfo && (
          <ImportMappingDialog
            visible={mappingDialogVisible}
            foreignCourse={importMappingInfo.foreignCourse}
            foreignPlayers={importMappingInfo.foreignPlayers}
            localCourses={importMappingInfo.localCourses}
            localPlayers={importMappingInfo.localPlayers}
            onDismiss={() => {
              setMappingDialogVisible(false);
              setImportMappingInfo(null);
              setImportText('');
            }}
            onConfirm={handleMappingConfirm}
          />
        )}
      </View>
    );
  }

  // Show date/time picker
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={handleCancel}
        />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          {roundType === 'past' ? 'Record Past Game' : 'Schedule Game'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.label, { color: theme.colors.onSurface }]}>
          Date
        </Text>
        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => {
              if (e.target.value) {
                const newDate = new Date(e.target.value);
                newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
                setSelectedDate(newDate);
              }
            }}
            style={{
              width: 'auto',
              maxWidth: '300px',
              padding: '12px',
              fontSize: '16px',
              border: `1px solid ${theme.colors.outline}`,
              borderRadius: '4px',
              backgroundColor: theme.colors.surface,
              color: theme.colors.onSurface,
              marginBottom: '16px',
            }}
          />
        ) : (
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={[styles.pickerButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}
          >
            <View style={styles.pickerButtonContent}>
              <IconButton icon="calendar" size={24} iconColor={theme.colors.primary} style={styles.pickerIcon} />
              <Text style={[styles.pickerText, { color: theme.colors.onSurface }]}>
                {formatDate(selectedDate)}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <Text style={[styles.label, { color: theme.colors.onSurface, marginTop: 16 }]}>
          Time
        </Text>
        {Platform.OS === 'web' ? (
          <input
            type="time"
            value={selectedDate.toTimeString().slice(0, 5)}
            onChange={(e) => {
              if (e.target.value) {
                const [hours, minutes] = e.target.value.split(':');
                const newDate = new Date(selectedDate);
                newDate.setHours(parseInt(hours), parseInt(minutes));
                setSelectedDate(newDate);
              }
            }}
            style={{
              width: 'auto',
              maxWidth: '200px',
              padding: '12px',
              fontSize: '16px',
              border: `1px solid ${theme.colors.outline}`,
              borderRadius: '4px',
              backgroundColor: theme.colors.surface,
              color: theme.colors.onSurface,
              marginBottom: '16px',
            }}
          />
        ) : (
          <TouchableOpacity
            onPress={() => setShowTimePicker(true)}
            style={[styles.pickerButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}
          >
            <View style={styles.pickerButtonContent}>
              <IconButton icon="clock-outline" size={24} iconColor={theme.colors.primary} style={styles.pickerIcon} />
              <Text style={[styles.pickerText, { color: theme.colors.onSurface }]}>
                {formatTime(selectedDate)}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {Platform.OS !== 'web' && showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={roundType === 'past' ? new Date() : undefined}
            minimumDate={roundType === 'future' ? new Date() : undefined}
          />
        )}

        {Platform.OS !== 'web' && showTimePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="time"
            display="default"
            onChange={handleTimeChange}
            is24Hour={false}
          />
        )}

        <Text style={[styles.preview, { color: theme.colors.onSurfaceVariant }]}>
          {selectedDate.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}
        </Text>

        <Button
          mode="contained"
          onPress={handleConfirmDate}
          style={styles.confirmButton}
        >
          Create Round
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingLeft: 4,
    paddingRight: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
    marginLeft: 8,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  optionButton: {
    marginBottom: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerButton: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
    minWidth: 200,
    maxWidth: 300,
  },
  pickerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerIcon: {
    margin: 0,
    marginRight: 8,
  },
  pickerText: {
    fontSize: 16,
  },
  preview: {
    fontSize: 14,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  confirmButton: {
    marginTop: 8,
  },
  importDialog: {
    maxHeight: '80%',
  },
  importHelpTextContainer: {
    marginBottom: 12,
    marginHorizontal: -10,
    paddingHorizontal: 10,
  },
  importHelpText: {
    fontSize: 14,
  },
  importTextInputContainer: {
    maxHeight: 350,
    overflow: 'hidden',
  },
  importTextInput: {
    maxHeight: 500,
  },
  importTextContent: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  validationContainer: {
    marginTop: 4,
    marginBottom: 0,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  validationIcon: {
    margin: 0,
    marginRight: 4,
  },
  validationText: {
    fontSize: 12,
    flex: 1,
  },
});

