import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Card, Title, Paragraph, Searchbar, Chip, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import Footer from '../components/common/Footer';
import { Round } from '../types';
import { getAllRounds } from '../services/storage/roundStorage';
import { formatDate } from '../utils';

type RoundHistoryScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'RoundHistory'
>;

interface Props {
  navigation: RoundHistoryScreenNavigationProp;
}

export default function RoundHistoryScreen({ navigation }: Props) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [filteredRounds, setFilteredRounds] = useState<Round[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [gameTypeFilter, setGameTypeFilter] = useState<'all' | 'golf' | 'disc-golf'>('all');

  const loadRounds = useCallback(async () => {
    try {
      const loadedRounds = await getAllRounds();
      // Sort by date, most recent first
      const sorted = loadedRounds.sort((a, b) => b.date - a.date);
      setRounds(sorted);
      applyFilters(sorted, searchQuery, gameTypeFilter);
    } catch (error) {
      console.error('Error loading rounds:', error);
    }
  }, [searchQuery, gameTypeFilter]);

  const applyFilters = useCallback(
    (roundsToFilter: Round[], query: string, typeFilter: 'all' | 'golf' | 'disc-golf') => {
      let filtered = roundsToFilter;

      // Apply game type filter
      if (typeFilter !== 'all') {
        filtered = filtered.filter((r) => r.gameType === typeFilter);
      }

      // Apply search query
      if (query.trim()) {
        const lowerQuery = query.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.title.toLowerCase().includes(lowerQuery) ||
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
    applyFilters(rounds, searchQuery, gameTypeFilter);
  }, [searchQuery, gameTypeFilter, rounds, applyFilters]);

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
    ({ item }: { item: Round }) => {
      const totalHoles = Math.max(...item.scores.map((s) => s.holeNumber), 0);
      const playerNames = item.players.map((p) => p.name).join(', ');

      return (
        <TouchableOpacity onPress={() => handleRoundPress(item.id)}>
          <Card style={styles.roundCard}>
            <Card.Content>
              <View style={styles.roundHeader}>
                <Title style={styles.roundTitle}>{item.title}</Title>
                <Chip
                  mode="outlined"
                  style={styles.gameTypeChip}
                  textStyle={styles.gameTypeText}
                >
                  {item.gameType === 'disc-golf' ? 'Disc Golf' : 'Golf'}
                </Chip>
              </View>
              {item.courseName && (
                <Paragraph style={styles.courseName}>{item.courseName}</Paragraph>
              )}
              <Paragraph style={styles.roundInfo}>
                {playerNames} • {totalHoles} holes • {formatDate(item.date)}
              </Paragraph>
              {item.photos && item.photos.length > 0 && (
                <Paragraph style={styles.photoCount}>
                  📷 {item.photos.length} photo{item.photos.length !== 1 ? 's' : ''}
                </Paragraph>
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
        <View style={styles.filterContainer}>
          <Chip
            selected={gameTypeFilter === 'all'}
            onPress={() => setGameTypeFilter('all')}
            style={styles.filterChip}
          >
            All
          </Chip>
          <Chip
            selected={gameTypeFilter === 'disc-golf'}
            onPress={() => setGameTypeFilter('disc-golf')}
            style={styles.filterChip}
          >
            Disc Golf
          </Chip>
          <Chip
            selected={gameTypeFilter === 'golf'}
            onPress={() => setGameTypeFilter('golf')}
            style={styles.filterChip}
          >
            Golf
          </Chip>
        </View>
      </View>

      {filteredRounds.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Paragraph style={styles.emptyText}>
            {rounds.length === 0
              ? 'No rounds saved yet. Start a new round to begin tracking!'
              : 'No rounds match your search.'}
          </Paragraph>
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
  gameTypeChip: {
    height: 28,
  },
  gameTypeText: {
    fontSize: 12,
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
