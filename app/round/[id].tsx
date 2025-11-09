import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Paragraph,
  Button,
  IconButton,
  Dialog,
  Portal,
} from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { Round } from '../../src/types';
import { getRoundById, deleteRound } from '../../src/services/storage/roundStorage';
import { formatDate, getShadowStyle } from '../../src/utils';
import { Scorecard } from '../../src/components/Scorecard';

export default function RoundDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  const [successDialog, setSuccessDialog] = useState({ visible: false, message: '', onDismiss: () => {} });

  useEffect(() => {
    if (id) {
      loadRound();
    }
  }, [id]);

  const loadRound = useCallback(async () => {
    if (!id) return;
    try {
      const loadedRound = await getRoundById(id);
      setRound(loadedRound);
    } catch (error) {
      console.error('Error loading round:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to load round' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleDelete = useCallback(async () => {
    if (!id) return;
    try {
      await deleteRound(id);
      setShowDeleteDialog(false);
      setSuccessDialog({
        visible: true,
        message: 'Round deleted successfully',
        onDismiss: () => router.back(),
      });
    } catch (error) {
      console.error('Error deleting round:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to delete round' });
    }
  }, [id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!round) {
    return (
      <View style={styles.container}>
        <Text>Round not found</Text>
        <Button onPress={() => router.back()}>Go Back</Button>
      </View>
    );
  }

  const holes = Array.from(
    new Set(round.scores.map((s) => s.holeNumber))
  ).sort((a, b) => a - b);

  const getTotalForPlayer = (playerId: string): number => {
    return round.scores
      .filter((s) => s.playerId === playerId)
      .reduce((sum, s) => sum + s.throws, 0);
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container}>
        <Card style={[styles.headerCard, getShadowStyle(2)]}>
          <Card.Content>
            <View style={styles.headerRow}>
              <View style={styles.headerContent}>
                <Title style={styles.title}>{round.title}</Title>
                {round.courseName && (
                  <Paragraph style={styles.courseName}>{round.courseName}</Paragraph>
                )}
                <View style={styles.metaRow}>
                  <Paragraph style={styles.date}>{formatDate(round.date)}</Paragraph>
                </View>
              </View>
              <IconButton
                icon="delete"
                iconColor="#f44336"
                size={24}
                onPress={() => setShowDeleteDialog(true)}
              />
            </View>
          </Card.Content>
        </Card>

        {round.photos && round.photos.length > 0 && (
          <Card style={[styles.card, getShadowStyle(2)]}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Photos</Title>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {round.photos.map((photoUri, index) => (
                  <Image
                    key={index}
                    source={{ uri: photoUri }}
                    style={styles.photo}
                  />
                ))}
              </ScrollView>
            </Card.Content>
          </Card>
        )}

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Scorecard</Title>
            <Scorecard
              players={round.players}
              holes={holes}
              scores={round.scores}
              onScoreChange={() => {}} // Read-only in detail view
              onAddPlayer={() => {}}
              onRemovePlayer={() => {}}
              onAddHole={() => {}}
              onRemoveHole={() => {}}
              readOnly={true}
            />
            <View style={styles.totalsContainer}>
              <Title style={styles.totalsTitle}>Totals</Title>
              {round.players.map((player) => (
                <View key={player.id} style={styles.totalRow}>
                  <Paragraph style={styles.playerName}>{player.name}</Paragraph>
                  <Paragraph style={styles.totalScore}>
                    {getTotalForPlayer(player.id)}
                  </Paragraph>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Delete Confirmation Dialog */}
        <Portal>
          <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
            <Dialog.Title>Delete Round</Dialog.Title>
            <Dialog.Content>
              <Paragraph>
                Are you sure you want to delete "{round.title}"? This action cannot be
                undone.
              </Paragraph>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
              <Button onPress={handleDelete} textColor="#f44336">
                Delete
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Error Dialog */}
        <Portal>
          <Dialog
            visible={errorDialog.visible}
            onDismiss={() => setErrorDialog({ visible: false, title: '', message: '' })}
          >
            <Dialog.Title>{errorDialog.title}</Dialog.Title>
            <Dialog.Content>
              <Paragraph>{errorDialog.message}</Paragraph>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setErrorDialog({ visible: false, title: '', message: '' })}>
                OK
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Success Dialog */}
        <Portal>
          <Dialog
            visible={successDialog.visible}
            onDismiss={() => {
              setSuccessDialog({ visible: false, message: '', onDismiss: () => {} });
              successDialog.onDismiss();
            }}
          >
            <Dialog.Title>Success</Dialog.Title>
            <Dialog.Content>
              <Paragraph>{successDialog.message}</Paragraph>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => {
                  setSuccessDialog({ visible: false, message: '', onDismiss: () => {} });
                  successDialog.onDismiss();
                }}
              >
                OK
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  courseName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  date: {
    fontSize: 14,
    color: '#999',
  },
  card: {
    margin: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginRight: 12,
  },
  totalsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
});

