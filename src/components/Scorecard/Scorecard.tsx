import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Player, Score, Course, Hole } from '../../types';
import { getAllCourses } from '../../services/storage/courseStorage';
import NumberModal from '../common/NumberModal';

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
  courseName?: string;
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
  courseName,
}: ScorecardProps) {
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    playerId: string | null;
    holeNumber: number | null;
    currentValue: number;
  }>({ visible: false, playerId: null, holeNumber: null, currentValue: 0 });
  const [distanceUnit, setDistanceUnit] = useState<'yd' | 'm'>('yd');
  const [courseHoles, setCourseHoles] = useState<Hole[]>([]);

  // Load course data to get hole distances
  useEffect(() => {
    const loadCourseData = async () => {
      if (courseName) {
        try {
          const courses = await getAllCourses();
          const course = courses.find(c => c.name === courseName);
          if (course) {
            // Handle both old format (holes: number) and new format (holes: Hole[])
            if (Array.isArray(course.holes)) {
              setCourseHoles(course.holes);
            } else {
              // Old format - create empty holes array
              const holeNumbers = Array.from({ length: course.holes as unknown as number || 0 }, (_, i) => ({
                number: i + 1,
              }));
              setCourseHoles(holeNumbers);
            }
          }
        } catch (error) {
          console.error('Error loading course data:', error);
        }
      }
    };
    loadCourseData();
  }, [courseName]);

  const getScore = (playerId: string, holeNumber: number): number => {
    const score = scores.find(
      (s) => s.playerId === playerId && s.holeNumber === holeNumber
    );
    return score?.throws || 0;
  };

  const getTotal = (playerId: string): number => {
    return holes.reduce((sum, hole) => sum + getScore(playerId, hole), 0);
  };

  const openEditModal = (playerId: string, holeNumber: number) => {
    if (readOnly) return;
    const currentScore = getScore(playerId, holeNumber);
    setEditModal({ visible: true, playerId, holeNumber, currentValue: currentScore });
  };

  const closeEditModal = () => {
    setEditModal({ visible: false, playerId: null, holeNumber: null, currentValue: 0 });
  };

  const handleScoreSave = (value: number) => {
    if (editModal.playerId && editModal.holeNumber !== null) {
      onScoreChange(editModal.playerId, editModal.holeNumber, value);
      // Update the current value in modal state
      setEditModal(prev => ({ ...prev, currentValue: value }));
    }
  };

  const getHoleDistance = (holeNumber: number): number | undefined => {
    const hole = courseHoles.find(h => h.number === holeNumber);
    return hole?.distance;
  };

  const formatDistance = (holeNumber: number): string => {
    const distance = getHoleDistance(holeNumber);
    if (distance === undefined) return '?';
    
    if (distanceUnit === 'yd') {
      // Assume distance is stored in meters, convert to yards
      const yards = Math.round(distance * 1.09361);
      return `${yards}yd`;
    } else {
      // Show in meters
      return `${Math.round(distance)}m`;
    }
  };

  const toggleDistanceUnit = () => {
    setDistanceUnit(prev => prev === 'yd' ? 'm' : 'yd');
  };

  return (
    <View style={styles.wrapper}>
      {/* Fixed Header Row */}
      <View style={styles.fixedHeaderRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.headerRowContent}>
            <View style={[styles.cell, styles.headerCell, styles.holeHeaderCell]}>
              <Text style={styles.headerText}>#</Text>
            </View>
            <TouchableOpacity
              style={[styles.cell, styles.headerCell, styles.distanceHeaderCell]}
              onPress={toggleDistanceUnit}
            >
              <Text style={styles.headerText}>Dist ({distanceUnit})</Text>
            </TouchableOpacity>
            {players.map((player) => (
              <View key={player.id} style={[styles.cell, styles.headerCell]}>
                <Text style={styles.headerText}>{player.name}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Scrollable Hole Rows */}
      <ScrollView style={styles.scrollableContent}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            {/* Hole Rows */}
            {holes.map((hole) => (
              <View key={hole} style={styles.row}>
                <View style={[styles.cell, styles.holeCell]}>
                  <Text style={styles.holeText}>{hole}</Text>
                </View>
                <View style={[styles.cell, styles.distanceCell]}>
                  <Text style={styles.distanceText}>{formatDistance(hole)}</Text>
                </View>
                {players.map((player) => (
                  <TouchableOpacity
                    key={`${player.id}-${hole}`}
                    style={styles.cell}
                    onPress={() => openEditModal(player.id, hole)}
                    disabled={readOnly}
                    activeOpacity={readOnly ? 1 : 0.7}
                  >
                    <Text style={styles.scoreText}>
                      {getScore(player.id, hole) || 0}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

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
      </ScrollView>

      {/* Fixed Total Row */}
      <View style={styles.fixedTotalRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.totalRowContent}>
            <View style={[styles.cell, styles.totalRowCell, styles.holeHeaderCell]}>
              <Text style={styles.totalRowText}>Total</Text>
            </View>
            <View style={[styles.cell, styles.totalRowCell, styles.distanceHeaderCell]}>
            </View>
            {players.map((player) => (
              <View key={`total-${player.id}`} style={[styles.cell, styles.totalCell]}>
                <Text style={styles.totalText}>{getTotal(player.id)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Edit Score Modal */}
      <NumberModal
        visible={editModal.visible}
        title={
          editModal.playerId && editModal.holeNumber !== null
            ? `${players.find(p => p.id === editModal.playerId)?.name || 'Player'} - Hole #${editModal.holeNumber}`
            : 'Edit Score'
        }
        defaultValue={editModal.currentValue}
        onSave={handleScoreSave}
        onDismiss={closeEditModal}
        min={0}
        max={20}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  fixedHeaderRow: {
    backgroundColor: '#4CAF50',
    borderBottomWidth: 2,
    borderBottomColor: '#388e3c',
    zIndex: 10,
  },
  headerRowContent: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  scrollableContent: {
    flex: 1,
  },
  table: {
    padding: 8,
    paddingBottom: 0,
  },
  fixedTotalRow: {
    backgroundColor: '#e8f5e9',
    borderTopWidth: 2,
    borderTopColor: '#4CAF50',
    paddingTop: 4,
    paddingBottom: 0,
    zIndex: 10,
  },
  totalRowContent: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 36,
  },
  cell: {
    width: 100,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCell: {
    backgroundColor: '#4CAF50',
    minHeight: 36,
  },
  headerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  holeCell: {
    backgroundColor: '#f5f5f5',
    width: 40,
    minWidth: 40,
  },
  holeHeaderCell: {
    width: 40,
    minWidth: 40,
  },
  distanceHeaderCell: {
    width: 70,
    minWidth: 70,
  },
  distanceCell: {
    backgroundColor: '#f5f5f5',
    width: 70,
    minWidth: 70,
  },
  distanceText: {
    fontWeight: '500',
    fontSize: 12,
    color: '#666',
  },
  holeText: {
    fontWeight: '600',
    fontSize: 14,
  },
  totalRowCell: {
    backgroundColor: '#e8f5e9',
  },
  totalRowText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  totalCell: {
    backgroundColor: '#e8f5e9',
  },
  totalText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  addCell: {
    padding: 12,
  },
});

