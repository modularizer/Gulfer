import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Dialog, Portal, Text, useTheme, Chip, Switch } from 'react-native-paper';
import { CornerStatisticsConfig, CornerConfig } from '@/services/cornerStatistics';
import { ColumnVisibilityConfig } from '@/services/storage/cornerConfigStorage';
import CornerStatisticConfigModal from './CornerStatisticConfigModal';
import { Player } from '@/types';

interface CornerStatisticsSettingsDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onSave: (config: CornerStatisticsConfig) => void;
  onColumnVisibilitySave?: (config: ColumnVisibilityConfig) => void;
  initialConfig?: CornerStatisticsConfig | null;
  initialColumnVisibility?: ColumnVisibilityConfig | null;
  courseName?: string;
  currentRoundPlayers?: Player[];
}

type CornerPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const CORNER_LABELS: Record<CornerPosition, string> = {
  topLeft: 'Top Left',
  topRight: 'Top Right',
  bottomLeft: 'Bottom Left',
  bottomRight: 'Bottom Right',
};

export default function CornerStatisticsSettingsDialog({
  visible,
  onDismiss,
  onSave,
  onColumnVisibilitySave,
  initialConfig,
  initialColumnVisibility,
  courseName,
  currentRoundPlayers = [],
}: CornerStatisticsSettingsDialogProps) {
  const theme = useTheme();
  const [config, setConfig] = useState<CornerStatisticsConfig>(initialConfig || {});
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityConfig>(
    initialColumnVisibility || { distance: true, par: false }
  );
  const [isInitialMount, setIsInitialMount] = useState(true);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configModalPosition, setConfigModalPosition] = useState<CornerPosition | null>(null);

  useEffect(() => {
    if (visible) {
      setIsInitialMount(true);
      const timer = setTimeout(() => setIsInitialMount(false), 100);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Auto-save when config or column visibility changes
  useEffect(() => {
    if (visible && !isInitialMount) {
      const configChanged = JSON.stringify(config) !== JSON.stringify(initialConfig || {});
      const visibilityChanged = JSON.stringify(columnVisibility) !== JSON.stringify(initialColumnVisibility || { distance: true, par: false });
      
      if (configChanged || visibilityChanged) {
        onSave(config);
        if (onColumnVisibilitySave) {
          onColumnVisibilitySave(columnVisibility);
        }
      }
    }
  }, [config, columnVisibility, visible, isInitialMount, initialConfig, initialColumnVisibility, onSave, onColumnVisibilitySave]);

  const getCornerConfig = (position: CornerPosition): CornerConfig | null => {
    return config[position] || null;
  };

  const handleOpenConfigModal = (position: CornerPosition) => {
    setConfigModalPosition(position);
    setConfigModalVisible(true);
  };

  const handleSaveConfig = (newConfig: CornerConfig) => {
    if (configModalPosition) {
      setConfig(prev => ({
        ...prev,
        [configModalPosition]: newConfig,
      }));
    }
  };

  const formatConfigLabel = (cornerConfig: CornerConfig | null): string => {
    if (!cornerConfig) return 'Empty';
    // Generate a short label based on the config
    let userText = 'Unknown';
    if (cornerConfig.scoreUserFilter === 'everyone') {
      userText = 'All';
    } else if (cornerConfig.scoreUserFilter === 'eachUser') {
      userText = 'Each User';
    } else if (Array.isArray(cornerConfig.scoreUserFilter)) {
      if (cornerConfig.scoreUserFilter.length === 0) {
        userText = 'All';
      } else if (cornerConfig.scoreUserFilter.length === 1) {
        userText = 'User';
      } else {
        userText = `${cornerConfig.scoreUserFilter.length} users`;
      }
    }
    
    // Format accumulation mode
    const accumText = cornerConfig.accumulationMode === 'percentile' && cornerConfig.percentile
      ? `${cornerConfig.percentile}th percentile`
      : cornerConfig.accumulationMode;
    
    return `${userText} • ${accumText}`;
  };

  const renderCornerConfig = (position: CornerPosition) => {
    const cornerConfig = getCornerConfig(position);

    return (
      <View key={position} style={styles.cornerSection}>
        <View style={styles.cornerHeader}>
          <Text style={[styles.cornerLabel, { color: theme.colors.onSurface }]}>
            {CORNER_LABELS[position]}
          </Text>
          <Chip
            onPress={() => cornerConfig ? handleOpenConfigModal(position) : handleOpenConfigModal(position)}
            style={styles.chip}
            mode={cornerConfig ? 'flat' : 'outlined'}
          >
            {formatConfigLabel(cornerConfig)}
          </Chip>
        </View>
      </View>
    );
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <Dialog.Content style={styles.content}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Column Visibility
              </Text>
              <View style={styles.columnVisibilitySection}>
                <View style={styles.columnVisibilityRow}>
                  <Text style={[styles.columnLabel, { color: theme.colors.onSurface }]}>
                    Distance
                  </Text>
                  <Switch
                    value={columnVisibility.distance !== false}
                    onValueChange={(value) => 
                      setColumnVisibility(prev => ({ ...prev, distance: value }))
                    }
                  />
                </View>
                <View style={styles.columnVisibilityRow}>
                  <Text style={[styles.columnLabel, { color: theme.colors.onSurface }]}>
                    Par
                  </Text>
                  <Switch
                    value={columnVisibility.par === true}
                    onValueChange={(value) => 
                      setColumnVisibility(prev => ({ ...prev, par: value }))
                    }
                  />
                </View>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface, marginTop: 24 }]}>
                Corner Statistics
              </Text>
              <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
                Configure what each corner displays. Leave empty to hide a corner.
              </Text>
              
              {(['bottomLeft', 'bottomRight', 'topLeft', 'topRight'] as CornerPosition[]).map(position =>
                renderCornerConfig(position)
              )}
            </Dialog.Content>
          </ScrollView>
        </Dialog.ScrollArea>
      </Dialog>
      <CornerStatisticConfigModal
        visible={configModalVisible}
        onDismiss={() => {
          setConfigModalVisible(false);
          setConfigModalPosition(null);
        }}
        onSave={handleSaveConfig}
        initialConfig={configModalPosition ? getCornerConfig(configModalPosition) : null}
        courseName={courseName}
        cornerPosition={configModalPosition || undefined}
        currentRoundPlayers={currentRoundPlayers}
      />
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  scrollArea: {
    maxHeight: 500,
  },
  content: {
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    marginBottom: 16,
    fontSize: 14,
  },
  columnVisibilitySection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  columnVisibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  columnLabel: {
    fontSize: 16,
  },
  cornerSection: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cornerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cornerLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  chip: {
    minWidth: 100,
    justifyContent: 'center',
  },
});
