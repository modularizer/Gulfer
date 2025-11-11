import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Button, IconButton, useTheme } from 'react-native-paper';
import { Player, Score, Course, Hole } from '../../types';
import { getAllCourses } from '../../services/storage/courseStorage';
import NumberModal from '../common/NumberModal';
import { CornerStatisticsConfig, computeCellCornerValues, computeTotalCornerValues } from '../../services/cornerStatistics';
import { getCurrentUserName } from '../../services/storage/userStorage';

export interface CornerData {
  value: string | number;
  visible: boolean;
  meaning?: string; // Optional label/meaning for the corner
}

export interface CellCornerData {
  topLeft?: CornerData;
  topRight?: CornerData;
  bottomLeft?: CornerData;
  bottomRight?: CornerData;
}

interface ScorecardProps {
  players: Player[];
  holes: number[];
  scores: Score[];
  onScoreChange: (playerId: number, holeNumber: number, throws: number) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (playerId: number) => void;
  onAddHole: () => void;
  onRemoveHole: (holeNumber: number) => void;
  readOnly?: boolean;
  allowAddPlayer?: boolean;
  courseName?: string;
  onBack?: () => void;
  getCornerData?: (playerId: string | number, holeNumber: number) => CellCornerData;
  cornerStatisticsConfig?: CornerStatisticsConfig;
  currentUserId?: string;
  onSettingsPress?: () => void;
  columnVisibility?: {
    distance?: boolean;
    par?: boolean;
    [key: string]: boolean | undefined;
  };
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
  onBack,
  getCornerData,
  cornerStatisticsConfig,
  currentUserId,
  onSettingsPress,
  columnVisibility,
}: ScorecardProps) {
  const theme = useTheme();
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    playerId: number | null;
    holeNumber: number | null;
    currentValue: number;
  }>({ visible: false, playerId: null, holeNumber: null, currentValue: 0 });
  const [distanceUnit, setDistanceUnit] = useState<'yd' | 'm' | 'ft'>('ft');
  const [courseHoles, setCourseHoles] = useState<Hole[]>([]);
  const [resolvedCurrentUserId, setResolvedCurrentUserId] = useState<string | undefined>(currentUserId);
  const [totalCornerValues, setTotalCornerValues] = useState<{
    topLeft: { value: string | number; visible: boolean };
    topRight: { value: string | number; visible: boolean };
    bottomLeft: { value: string | number; visible: boolean };
    bottomRight: { value: string | number; visible: boolean };
  } | null>(null);
  const [cellCornerValues, setCellCornerValues] = useState<Map<string, {
    topLeft: { value: string | number; visible: boolean };
    topRight: { value: string | number; visible: boolean };
    bottomLeft: { value: string | number; visible: boolean };
    bottomRight: { value: string | number; visible: boolean };
  }>>(new Map());
  const [headerContentWidth, setHeaderContentWidth] = useState<number>(0);
  const screenWidth = Dimensions.get('window').width;

  // Resolve current user ID if not provided
  useEffect(() => {
    const resolveUserId = async () => {
      if (currentUserId) {
        setResolvedCurrentUserId(currentUserId);
      } else {
        // Try to get current user from storage
        try {
          const userName = await getCurrentUserName();
          if (userName && players.length > 0) {
            // Find player with matching name
            const userPlayer = players.find(p => p.name === userName);
            if (userPlayer) {
              setResolvedCurrentUserId(userPlayer.id);
            } else {
              // Default to first player if no match
              setResolvedCurrentUserId(players[0]?.id);
            }
          } else if (players.length > 0) {
            setResolvedCurrentUserId(players[0]?.id);
          }
        } catch (error) {
          console.error('Error resolving current user ID:', error);
          if (players.length > 0) {
            setResolvedCurrentUserId(players[0]?.id);
          }
        }
      }
    };
    resolveUserId();
  }, [currentUserId, players]);

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

  // Compute cell corner values
  useEffect(() => {
    const computeCellValues = async () => {
      if (!getCornerData && cornerStatisticsConfig && resolvedCurrentUserId && courseName) {
        const newValues = new Map<string, {
          topLeft: { value: string | number; visible: boolean };
          topRight: { value: string | number; visible: boolean };
          bottomLeft: { value: string | number; visible: boolean };
          bottomRight: { value: string | number; visible: boolean };
        }>();
        
        // Compute values for all player/hole combinations
        for (const hole of holes) {
          for (const player of players) {
            const key = `${player.id}-${hole}`;
            try {
              const values = await computeCellCornerValues(
                cornerStatisticsConfig,
                courseName,
                hole,
                resolvedCurrentUserId
              );
              newValues.set(key, values);
            } catch (error) {
              console.error(`Error computing corner values for ${key}:`, error);
              // Default values
              newValues.set(key, {
                topLeft: { value: hole, visible: true },
                topRight: { value: hole, visible: true },
                bottomLeft: { value: hole, visible: true },
                bottomRight: { value: hole, visible: true },
              });
            }
          }
        }
        setCellCornerValues(newValues);
      } else if (getCornerData) {
        // If getCornerData is provided, compute synchronously
        const newValues = new Map<string, {
          topLeft: { value: string | number; visible: boolean };
          topRight: { value: string | number; visible: boolean };
          bottomLeft: { value: string | number; visible: boolean };
          bottomRight: { value: string | number; visible: boolean };
        }>();
        
        for (const hole of holes) {
          for (const player of players) {
            const key = `${player.id}-${hole}`;
            const cornerData = getCornerData(player.id, hole);
            newValues.set(key, {
              topLeft: cornerData.topLeft || { value: hole, visible: true },
              topRight: cornerData.topRight || { value: hole, visible: true },
              bottomLeft: cornerData.bottomLeft || { value: hole, visible: true },
              bottomRight: cornerData.bottomRight || { value: hole, visible: true },
            });
          }
        }
        setCellCornerValues(newValues);
      } else {
        // Default: show hole number
        const newValues = new Map<string, {
          topLeft: { value: string | number; visible: boolean };
          topRight: { value: string | number; visible: boolean };
          bottomLeft: { value: string | number; visible: boolean };
          bottomRight: { value: string | number; visible: boolean };
        }>();
        
        for (const hole of holes) {
          for (const player of players) {
            const key = `${player.id}-${hole}`;
            newValues.set(key, {
              topLeft: { value: hole, visible: true },
              topRight: { value: hole, visible: true },
              bottomLeft: { value: hole, visible: true },
              bottomRight: { value: hole, visible: true },
            });
          }
        }
        setCellCornerValues(newValues);
      }
    };
    computeCellValues();
  }, [getCornerData, cornerStatisticsConfig, resolvedCurrentUserId, courseName, holes, players]);

  // Compute total corner values
  useEffect(() => {
    const computeTotals = async () => {
      if (cornerStatisticsConfig && resolvedCurrentUserId && courseName) {
        try {
          const totals = await computeTotalCornerValues(
            cornerStatisticsConfig,
            courseName,
            holes,
            scores,
            resolvedCurrentUserId
          );
          setTotalCornerValues(totals);
        } catch (error) {
          console.error('Error computing total corner values:', error);
          setTotalCornerValues(null);
        }
      } else {
        setTotalCornerValues(null);
      }
    };
    computeTotals();
  }, [cornerStatisticsConfig, resolvedCurrentUserId, courseName, holes, scores]);

  const getScore = (playerId: number, holeNumber: number): number => {
    const score = scores.find(
      (s) => s.playerId === playerId && s.holeNumber === holeNumber
    );
    return score?.throws || 0;
  };

  const getTotal = (playerId: number): number => {
    return holes.reduce((sum, hole) => sum + getScore(playerId, hole), 0);
  };

  const openEditModal = (playerId: number, holeNumber: number) => {
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
    
    if (distanceUnit === 'ft') {
      // Assume distance is stored in meters, convert to feet
      const feet = Math.round(distance * 3.28084);
      return `${feet}ft`;
    } else if (distanceUnit === 'yd') {
      // Assume distance is stored in meters, convert to yards
      const yards = Math.round(distance * 1.09361);
      return `${yards}yd`;
    } else {
      // Show in meters
      return `${Math.round(distance)}m`;
    }
  };

  const toggleDistanceUnit = () => {
    setDistanceUnit(prev => {
      if (prev === 'ft') return 'yd';
      if (prev === 'yd') return 'm';
      return 'ft';
    });
  };


  return (
    <View style={styles.wrapper}>
      {/* Fixed Header Row */}
      <View style={styles.fixedHeaderRow}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.headerScrollView}
          contentContainerStyle={
            headerContentWidth > 0 && headerContentWidth < screenWidth && onSettingsPress
              ? { paddingRight: 40 } // Add padding for settings button
              : undefined
          }
        >
          <View 
            style={styles.headerRowContent}
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              setHeaderContentWidth(width);
            }}
          >
            <View style={[styles.cell, styles.headerCell, styles.holeHeaderCell]}>
              {onBack ? (
                <IconButton
                  icon="arrow-left"
                  size={20}
                  iconColor="#fff"
                  onPress={onBack}
                  style={styles.backIconButton}
                />
              ) : (
                <Text style={styles.headerText}>#</Text>
              )}
            </View>
            {columnVisibility?.distance !== false && (
              <TouchableOpacity
                style={[styles.cell, styles.headerCell, styles.distanceHeaderCell]}
                onPress={toggleDistanceUnit}
              >
                <Text style={styles.headerText}>Dist ({distanceUnit})</Text>
              </TouchableOpacity>
            )}
            {columnVisibility?.par === true && (
              <View style={[styles.cell, styles.headerCell, styles.parHeaderCell]}>
                <Text style={styles.headerText}>Par</Text>
              </View>
            )}
            {players.map((player) => (
              <View key={player.id} style={[styles.cell, styles.headerCell]}>
                <Text style={styles.headerText}>{player.name}</Text>
              </View>
            ))}
            {onSettingsPress && headerContentWidth > 0 && headerContentWidth >= screenWidth && (
              <View style={[styles.cell, styles.headerCell, styles.settingsHeaderCell]}>
                <IconButton
                  icon="dots-vertical"
                  size={20}
                  iconColor="#fff"
                  onPress={onSettingsPress}
                  style={styles.settingsIconButton}
                />
              </View>
            )}
          </View>
        </ScrollView>
        {onSettingsPress && headerContentWidth > 0 && headerContentWidth < screenWidth && (
          <View style={styles.settingsButtonAbsolute}>
            <View style={[styles.cell, styles.headerCell, styles.settingsHeaderCell]}>
              <IconButton
                icon="dots-vertical"
                size={20}
                iconColor="#fff"
                onPress={onSettingsPress}
                style={styles.settingsIconButton}
              />
            </View>
          </View>
        )}
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
                {columnVisibility?.distance !== false && (
                  <View style={[styles.cell, styles.distanceCell]}>
                    <Text style={styles.distanceText}>{formatDistance(hole)}</Text>
                  </View>
                )}
                {columnVisibility?.par === true && (
                  <View style={[styles.cell, styles.parCell]}>
                    <Text style={styles.parText}>
                      {(() => {
                        const holeData = courseHoles.find(h => h.number === hole);
                        return holeData?.par !== undefined ? holeData.par : '?';
                      })()}
                    </Text>
                  </View>
                )}
                {players.map((player) => (
                  <TouchableOpacity
                    key={`${player.id}-${hole}`}
                    style={styles.cell}
                    onPress={() => openEditModal(player.id, hole)}
                    disabled={readOnly}
                    activeOpacity={readOnly ? 1 : 0.7}
                  >
                    <View style={styles.scoreCellContainer}>
                      {(() => {
                        const key = `${player.id}-${hole}`;
                        const cornerValues = cellCornerValues.get(key) || {
                          topLeft: { value: hole, visible: true },
                          topRight: { value: hole, visible: true },
                          bottomLeft: { value: hole, visible: true },
                          bottomRight: { value: hole, visible: true },
                        };
                        return (
                          <>
                            {/* Corner numbers - top left */}
                            {cornerValues.topLeft.visible && (
                              <Text style={styles.cornerTextTopLeft}>
                                {cornerValues.topLeft.value}
                              </Text>
                            )}
                            {/* Corner numbers - top right */}
                            {cornerValues.topRight.visible && (
                              <Text style={styles.cornerTextTopRight}>
                                {cornerValues.topRight.value}
                              </Text>
                            )}
                            {/* Corner numbers - bottom left */}
                            {cornerValues.bottomLeft.visible && (
                              <Text style={styles.cornerTextBottomLeft}>
                                {cornerValues.bottomLeft.value}
                              </Text>
                            )}
                            {/* Corner numbers - bottom right */}
                            {cornerValues.bottomRight.visible && (
                              <Text style={styles.cornerTextBottomRight}>
                                {cornerValues.bottomRight.value}
                              </Text>
                            )}
                          </>
                        );
                      })()}
                      {/* Main score - centered */}
                      <Text style={styles.scoreText}>
                        {getScore(player.id, hole) || 0}
                      </Text>
                    </View>
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
            {columnVisibility?.distance !== false && (
              <View style={[styles.cell, styles.totalRowCell, styles.distanceHeaderCell]}>
              </View>
            )}
            {columnVisibility?.par === true && (
              <View style={[styles.cell, styles.totalRowCell, styles.parHeaderCell]}>
              </View>
            )}
            {players.map((player) => (
              <View key={`total-${player.id}`} style={[styles.cell, styles.totalCell]}>
                <View style={styles.scoreCellContainer}>
                  {totalCornerValues && (() => {
                    return (
                      <>
                        {/* Corner numbers - top left */}
                        {totalCornerValues.topLeft.visible && (
                          <Text style={styles.cornerTextTopLeft}>
                            {totalCornerValues.topLeft.value}
                          </Text>
                        )}
                        {/* Corner numbers - top right */}
                        {totalCornerValues.topRight.visible && (
                          <Text style={styles.cornerTextTopRight}>
                            {totalCornerValues.topRight.value}
                          </Text>
                        )}
                        {/* Corner numbers - bottom left */}
                        {totalCornerValues.bottomLeft.visible && (
                          <Text style={styles.cornerTextBottomLeft}>
                            {totalCornerValues.bottomLeft.value}
                          </Text>
                        )}
                        {/* Corner numbers - bottom right */}
                        {totalCornerValues.bottomRight.visible && (
                          <Text style={styles.cornerTextBottomRight}>
                            {totalCornerValues.bottomRight.value}
                          </Text>
                        )}
                      </>
                    );
                  })()}
                  {/* Main total - centered */}
                  <Text style={styles.totalText}>{getTotal(player.id)}</Text>
                </View>
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
    position: 'relative',
  },
  headerScrollView: {
    flex: 1,
  },
  headerRowContent: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  settingsButtonAbsolute: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: '100%',
    zIndex: 11,
    justifyContent: 'center',
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
    minHeight: 31,
  },
  cell: {
    width: 77,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  headerCell: {
    backgroundColor: '#4CAF50',
    minHeight: 31,
  },
  headerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  holeCell: {
    backgroundColor: '#f5f5f5',
    width: 35,
    minWidth: 35,
  },
  holeHeaderCell: {
    width: 35,
    minWidth: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIconButton: {
    margin: 0,
    padding: 0,
    width: 40,
    height: 40,
  },
  settingsHeaderCell: {
    width: 40,
    minWidth: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIconButton: {
    margin: 0,
    padding: 0,
    width: 40,
    height: 40,
  },
  distanceHeaderCell: {
    width: 60,
    minWidth: 60,
  },
  parHeaderCell: {
    width: 60,
    minWidth: 60,
  },
  distanceCell: {
    backgroundColor: '#f5f5f5',
    width: 60,
    minWidth: 60,
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
  scoreCellContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cornerTextTopLeft: {
    position: 'absolute',
    top: -1,
    left: 3,
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  cornerTextTopRight: {
    position: 'absolute',
    top: -1,
    right: 3,
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  cornerTextBottomLeft: {
    position: 'absolute',
    bottom: -1,
    left: 3,
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  cornerTextBottomRight: {
    position: 'absolute',
    bottom: -1,
    right: 3,
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
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

