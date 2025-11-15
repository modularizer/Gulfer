import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Card, Text, Searchbar, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/App';
import Footer from '../components/common/Footer';
import {getAllRoundsWithDetails, RoundWithDetails} from '@services/storage/roundStorage';
import { formatDate } from '@/utils';

type RoundHistoryScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'RoundHistory'
>;

interface Props {
  navigation: RoundHistoryScreenNavigationProp;
}

export default function RoundHistoryScreen({ navigation }: Props) {
  const [rounds, setRounds] = useState<RoundWithDetails[]>([]);
  const [filteredRounds, setFilteredRounds] = useState<RoundWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [gameTypeFilter, setGameTypeFilter] = useState<'all' | 'golf' | 'disc-golf'>('all');

  const loadRounds = useCallback(async () => {
    try {
      const loadedRounds = await getAllRoundsWithDetails();
      // Sort by date, most recent first
      const sorted = loadedRounds.sort((a, b) => b.date - a.date);
      setRounds(sorted);
      applyFilters(sorted, searchQuery);
    } catch (error) {
      console.error('Error loading rounds:', error);
    }
  }, [searchQuery]);

  const applyFilters = useCallback(
    (roundsToFilter: RoundWithDetails[], query: string) => {
      let filtered = roundsToFilter;

      // Apply search query
      if (query.trim()) {
        const lowerQuery = query.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.name.toLowerCase().includes(lowerQuery) ||
            r.courseName?.toLowerCase().includes(lowerQuery) ||
            r.players.some((p) => p.name.toLowerCase().includes(lowerQuery))
        );
      }

      setFilteredRounds(filtered);
    },
    []
  );

  useEffect(() => {
    loadRounds();
  }, []);

  useEffect(() => {
    applyFilters(rounds, searchQuery);
  }, [searchQuery, rounds, applyFilters]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRounds();
    setRefreshing(false);
  }, [loadRounds]);

  const handleRoundPress = useCallback(
    (roundId: string) => {
      navigation.navigate('RoundDetail', { roundId });
    },
    [navigation]
  );

  // Note: Delete functionality is available in RoundDetailScreen
  // This is kept here for potential future use

  const renderRoundItem = useCallback(
    ({ item }: { item: RoundWithDetails }) => {
      const totalHoles = Math.max(...item.scores.map((s) => s.holeNumber), 0);
      const playerNames = item.players.map((p) => p.name).join(', ');

      return (
        <TouchableOpacity onPress={() => handleRoundPress(item.id)}>
          <Card style={styles.roundCard}>
            <Card.Content>
              <View style={styles.roundHeader}>
                <Text variant="titleLarge" style={styles.roundTitle}>{item.name}</Text>
              </View>
              {item.courseName && (
                <Text variant="bodyLarge" style={styles.courseName}>{item.courseName}</Text>
              )}
              <Text variant="bodyMedium" style={styles.roundInfo}>
                {playerNames} • {totalHoles} holes • {formatDate(item.date)}
              </Text>
              {item.photos && item.photos.length > 0 && (
                <Text variant="bodyMedium" style={styles.photoCount}>
                  📷 {item.photos.length} photo{item.photos.length !== 1 ? 's' : ''}
                </Text>
              )}
            </Card.Content>
          </Card>
        </TouchableOpacity>
      );
    },
    [handleRoundPress]
  );

  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outlineVariant }]}>
        <Searchbar
          placeholder="Search rounds..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      </View>

      {filteredRounds.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {rounds.length === 0
              ? 'No rounds saved yet. Start a new round to begin tracking!'
              : 'No rounds match your search.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRounds}
          renderItem={renderRoundItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <SafeAreaView edges={['bottom']}>
        <Footer />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
  },
  searchbar: {
    marginBottom: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    marginRight: 8,
  },
  listContent: {
    padding: 16,
  },
  roundCard: {
    marginBottom: 12,
    elevation: 2,
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roundTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
  },
  courseName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  roundInfo: {
    fontSize: 12,
    color: '#999',
  },
  photoCount: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
  },
});
