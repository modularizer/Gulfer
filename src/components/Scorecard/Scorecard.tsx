import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { Player, Score } from '../../types';

interface ScorecardProps {
  players: Player[];
  holes: number[];
  scores: Score[];
  onScoreChange: (playerId: string, holeNumber: number, throws: number) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (playerId: string) => void;
  onAddHole: () => void;
  onRemoveHole: (holeNumber: number) => void;
  readOnly?: boolean;
  allowAddPlayer?: boolean;
}

export default function Scorecard({
  players,
  holes,
  scores,
  onScoreChange,
  onAddPlayer,
  onRemovePlayer,
  onAddHole,
  onRemoveHole,
  readOnly = false,
  allowAddPlayer = true,
}: ScorecardProps) {
  const getScore = (playerId: string, holeNumber: number): number => {
    const score = scores.find(
      (s) => s.playerId === playerId && s.holeNumber === holeNumber
    );
    return score?.throws || 0;
  };

  const getTotal = (playerId: string): number => {
    return holes.reduce((sum, hole) => sum + getScore(playerId, hole), 0);
  };

  const getHoleTotal = (holeNumber: number): number => {
    return players.reduce((sum, player) => sum + getScore(player.id, holeNumber), 0);
  };

  const incrementScore = (playerId: string, holeNumber: number) => {
    const current = getScore(playerId, holeNumber);
    onScoreChange(playerId, holeNumber, current + 1);
  };

  return (
    <ScrollView horizontal style={styles.container}>
      <View style={styles.table}>
        {/* Header Row */}
        <View style={styles.row}>
          <View style={[styles.cell, styles.headerCell]}>
            <Text style={styles.headerText}>Hole</Text>
          </View>
          {players.map((player) => (
            <View key={player.id} style={[styles.cell, styles.headerCell]}>
              <Text style={styles.headerText}>{player.name}</Text>
            </View>
          ))}
          <View style={[styles.cell, styles.headerCell]}>
            <Text style={styles.headerText}>Total</Text>
          </View>
        </View>

        {/* Hole Rows */}
        {holes.map((hole) => (
          <View key={hole} style={styles.row}>
            <View style={[styles.cell, styles.holeCell]}>
              <Text style={styles.holeText}>{hole}</Text>
            </View>
            {players.map((player) => (
              <View key={`${player.id}-${hole}`} style={styles.cell}>
                {!readOnly ? (
                  <>
                    <Button
                      mode="contained"
                      onPress={() => incrementScore(player.id, hole)}
                      style={styles.scoreButton}
                    >
                      {getScore(player.id, hole) || 0}
                    </Button>
                    <TextInput
                      mode="outlined"
                      value={getScore(player.id, hole).toString()}
                      onChangeText={(text: string) => {
                        const num = parseInt(text, 10);
                        if (!isNaN(num) && num >= 0) {
                          onScoreChange(player.id, hole, num);
                        }
                      }}
                      keyboardType="numeric"
                      style={styles.scoreInput}
                    />
                  </>
                ) : (
                  <Text style={styles.readOnlyScore}>
                    {getScore(player.id, hole) || 0}
                  </Text>
                )}
              </View>
            ))}
            <View style={[styles.cell, styles.totalCell]}>
              <Text style={styles.totalText}>{getHoleTotal(hole)}</Text>
            </View>
          </View>
        ))}

        {/* Total Row */}
        <View style={styles.row}>
          <View style={[styles.cell, styles.totalRowCell]}>
            <Text style={styles.totalRowText}>Total</Text>
          </View>
          {players.map((player) => (
            <View key={`total-${player.id}`} style={[styles.cell, styles.totalCell]}>
              <Text style={styles.totalText}>{getTotal(player.id)}</Text>
            </View>
          ))}
          <View style={[styles.cell, styles.totalRowCell]}>
            <Text style={styles.totalRowText}>
              {players.reduce((sum, player) => sum + getTotal(player.id), 0)}
            </Text>
          </View>
        </View>

        {/* Add Player Column */}
        {!readOnly && allowAddPlayer && (
          <View style={styles.row}>
            <View style={[styles.cell, styles.addCell]}>
              <Button mode="outlined" onPress={onAddPlayer}>
                Add Player
              </Button>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  table: {
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cell: {
    width: 100,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCell: {
    backgroundColor: '#4CAF50',
    minHeight: 40,
  },
  headerText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  holeCell: {
    backgroundColor: '#f5f5f5',
    minWidth: 60,
  },
  holeText: {
    fontWeight: '600',
    fontSize: 16,
  },
  totalRowCell: {
    backgroundColor: '#e8f5e9',
  },
  totalRowText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  removeButton: {
    marginTop: 4,
  },
  scoreButton: {
    marginBottom: 4,
    minWidth: 60,
  },
  scoreInput: {
    width: 80,
    height: 40,
  },
  totalCell: {
    backgroundColor: '#e8f5e9',
  },
  totalText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  addCell: {
    padding: 16,
  },
  readOnlyScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
});

