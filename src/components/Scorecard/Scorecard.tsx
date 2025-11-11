import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Button, IconButton, useTheme } from 'react-native-paper';
import { Player, Score, Course, Hole } from '../../types';
import { getAllCourses } from '../../services/storage/courseStorage';
import HoleScoreModal from '../common/HoleScoreModal';
import { CornerStatisticsConfig, computeCellCornerValues, computeTotalCornerValues } from '../../services/cornerStatistics';
import { getCurrentUserName } from '../../services/storage/userStorage';
import { computeAllHoleStatistics, computeTotalRoundStatistics, HoleStatistics } from '../../services/holeStatistics';
import GStatsCell from '../common/GStatsCell';
import { scorecardTableStyles } from '../../styles/scorecardTableStyles';

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
  onScoreChange: (playerId: string | number, holeNumber: number, throws: number) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (playerId: number) => void;
  onAddHole: () => void;
  onRemoveHole: (holeNumber: number) => void;
  readOnly?: boolean;
  allowAddPlayer?: boolean;
  courseName?: string;
  courseId?: string;
  onBack?: () => void;
  getCornerData?: (playerId: string | number, holeNumber: number) => CellCornerData;
  cornerStatisticsConfig?: CornerStatisticsConfig;
  currentUserId?: string;
  onSettingsPress?: () => void;
  columnVisibility?: {
    distance?: boolean;
    par?: boolean;
    gStats?: boolean;
    [key: string]: boolean | undefined;
  };
  currentRoundDate?: number; // Timestamp of the current round being viewed (to exclude rounds that started at the same time or after)
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
  courseId,
  onBack,
  getCornerData,
  cornerStatisticsConfig,
  currentUserId,
  onSettingsPress,
  columnVisibility,
  currentRoundDate,
}: ScorecardProps) {
  const theme = useTheme();
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    holeNumber: number | null;
    initialPlayerId?: string | number;
  }>({ visible: false, holeNumber: null });
  const [distanceUnit, setDistanceUnit] = useState<'yd' | 'm' | 'ft'>('ft');
  const [courseHoles, setCourseHoles] = useState<Hole[]>([]);
  const [resolvedCurrentUserId, setResolvedCurrentUserId] = useState<string | undefined>(currentUserId);
  const [totalCornerValues, setTotalCornerValues] = useState<Map<string, {
    topLeft: { value: string | number; visible: boolean };
    topRight: { value: string | number; visible: boolean };
    bottomLeft: { value: string | number; visible: boolean };
    bottomRight: { value: string | number; visible: boolean };
  }>>(new Map());
  const [cellCornerValues, setCellCornerValues] = useState<Map<string, {
    topLeft: { value: string | number; visible: boolean };
    topRight: { value: string | number; visible: boolean };
    bottomLeft: { value: string | number; visible: boolean };
    bottomRight: { value: string | number; visible: boolean };
  }>>(new Map());
  const [holeStatistics, setHoleStatistics] = useState<Map<number, HoleStatistics>>(new Map());
  const [totalRoundStatistics, setTotalRoundStatistics] = useState<HoleStatistics | null>(null);
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

  // Compute hole statistics (G-Stats per hole)
  useEffect(() => {
    const computeStats = async () => {
      if (courseId && holes.length > 0) {
        try {
          const stats = await computeAllHoleStatistics(courseId, holes, currentRoundDate);
          setHoleStatistics(stats);
        } catch (error) {
          console.error('Error computing hole statistics:', error);
          setHoleStatistics(new Map());
        }
      } else {
        setHoleStatistics(new Map());
      }
    };
    computeStats();
  }, [courseId, holes, currentRoundDate]);

  // Compute total round statistics (G-Stats for cumulative totals)
  useEffect(() => {
    const computeTotalStats = async () => {
      if (courseId && holes.length > 0) {
        try {
          const stats = await computeTotalRoundStatistics(courseId, holes, currentRoundDate);
          setTotalRoundStatistics(stats);
        } catch (error) {
          console.error('Error computing total round statistics:', error);
          setTotalRoundStatistics(null);
        }
      } else {
        setTotalRoundStatistics(null);
      }
    };
    computeTotalStats();
  }, [courseId, holes, currentRoundDate]);

  // Compute cell corner values
  useEffect(() => {
    const computeCellValues = async () => {
      if (!getCornerData && cornerStatisticsConfig && resolvedCurrentUserId && courseId) {
        const newValues = new Map<string, {
          topLeft: { value: string | number; visible: boolean };
          topRight: { value: string | number; visible: boolean };
          bottomLeft: { value: string | number; visible: boolean };
          bottomRight: { value: string | number; visible: boolean };
        }>();
        
        // Compute values for all player/hole combinations
        // Each player's column is computed independently using their own player ID
        for (const hole of holes) {
          for (const player of players) {
            const key = `${player.id}-${hole}`;
            try {
              const values = await computeCellCornerValues(
                cornerStatisticsConfig,
                courseId,
                hole,
                player.id,  // Use the player's ID, not the current user's ID
                undefined,  // todaysPlayerIds
                currentRoundDate  // Exclude rounds that started at the same time or after
              );
              newValues.set(key, values);
            } catch (error) {
              console.error(`Error computing corner values for ${key}:`, error);
              // Default values - hidden until correct values are computed
              newValues.set(key, {
                topLeft: { value: '', visible: false },
                topRight: { value: '', visible: false },
                bottomLeft: { value: '', visible: false },
                bottomRight: { value: '', visible: false },
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
              topLeft: cornerData.topLeft || { value: '', visible: false },
              topRight: cornerData.topRight || { value: '', visible: false },
              bottomLeft: cornerData.bottomLeft || { value: '', visible: false },
              bottomRight: cornerData.bottomRight || { value: '', visible: false },
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
              topLeft: { value: '', visible: false },
              topRight: { value: '', visible: false },
              bottomLeft: { value: '', visible: false },
              bottomRight: { value: '', visible: false },
            });
          }
        }
        setCellCornerValues(newValues);
      }
    };
    computeCellValues();
  }, [getCornerData, cornerStatisticsConfig, resolvedCurrentUserId, courseName, holes, players, currentRoundDate]);

  // Compute total corner values per player
  useEffect(() => {
    const computeTotals = async () => {
      if (cornerStatisticsConfig && courseId) {
        const newTotals = new Map<string, {
          topLeft: { value: string | number; visible: boolean };
          topRight: { value: string | number; visible: boolean };
          bottomLeft: { value: string | number; visible: boolean };
          bottomRight: { value: string | number; visible: boolean };
        }>();
        
        // Compute totals for each player independently
        for (const player of players) {
          try {
            const totals = await computeTotalCornerValues(
              cornerStatisticsConfig,
              courseId,
              holes,
              scores,
              player.id,  // Use the player's ID, not the current user's ID
              undefined,  // todaysPlayerIds
              currentRoundDate  // Exclude rounds that started at the same time or after
            );
            newTotals.set(player.id, totals);
          } catch (error) {
            console.error(`Error computing total corner values for player ${player.id}:`, error);
          }
        }
        setTotalCornerValues(newTotals);
      } else {
        setTotalCornerValues(new Map());
      }
    };
    computeTotals();
  }, [cornerStatisticsConfig, courseId, holes, scores, players, currentRoundDate]);

  const getScore = (playerId: string | number, holeNumber: number): number => {
    const score = scores.find(
      (s) => String(s.playerId) === String(playerId) && s.holeNumber === holeNumber
    );
    return score?.throws || 0;
  };

  const getTotal = (playerId: string | number): number => {
    return holes.reduce((sum, hole) => sum + getScore(playerId, hole), 0);
  };

  const openEditModal = (playerId: string | number, holeNumber: number) => {
    if (readOnly) return;
    setEditModal({ visible: true, holeNumber, initialPlayerId: playerId });
  };

  const closeEditModal = () => {
    setEditModal({ visible: false, holeNumber: null });
  };

  const handleNextHole = (nextHoleNumber: number) => {
    // Close current modal and open next hole's modal
    setEditModal({ visible: true, holeNumber: nextHoleNumber, initialPlayerId: players[0]?.id });
  };

  const handleScoreChange = (playerId: string | number, holeNumber: number, score: number) => {
    // Keep playerId as string (Score interface expects string UUID)
    const stringPlayerId = typeof playerId === 'string' ? playerId : String(playerId);
    
    console.log('[Scorecard] handleScoreChange called:', {
      playerId: stringPlayerId,
      holeNumber,
      score,
      editModalHoleNumber: editModal.holeNumber
    });
    
    // Use the holeNumber passed directly from the modal
    onScoreChange(stringPlayerId, holeNumber, score);
    
    console.log('[Scorecard] onScoreChange called, checking if score was saved...');
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
    <View style={scorecardTableStyles.wrapper}>
      {/* Fixed Header Row */}
      <View style={scorecardTableStyles.fixedHeaderRow}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={scorecardTableStyles.headerScrollView}
          contentContainerStyle={
            headerContentWidth > 0 && headerContentWidth < screenWidth && onSettingsPress
              ? { paddingRight: 40 } // Add padding for settings button
              : undefined
          }
        >
          <View 
            style={scorecardTableStyles.headerRowContent}
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              setHeaderContentWidth(width);
            }}
          >
            <View style={[scorecardTableStyles.cell, scorecardTableStyles.headerCell, scorecardTableStyles.holeHeaderCell]}>
              {onBack ? (
                <IconButton
                  icon="arrow-left"
                  size={20}
                  iconColor="#fff"
                  onPress={onBack}
                  style={scorecardTableStyles.backIconButton}
                />
              ) : (
                <Text style={scorecardTableStyles.headerText}>#</Text>
              )}
            </View>
            {columnVisibility?.gStats === true && (
              <View style={[scorecardTableStyles.cell, scorecardTableStyles.headerCell, scorecardTableStyles.gStatsHeaderCell]}>
                <Text style={scorecardTableStyles.gStatHeaderText}>G-Stats</Text>
              </View>
            )}
            {columnVisibility?.distance !== false && (
              <TouchableOpacity
                style={[scorecardTableStyles.cell, scorecardTableStyles.headerCell, scorecardTableStyles.distanceHeaderCell]}
                onPress={toggleDistanceUnit}
              >
                <Text style={scorecardTableStyles.headerText}>Dist ({distanceUnit})</Text>
              </TouchableOpacity>
            )}
            {columnVisibility?.par === true && (
              <View style={[scorecardTableStyles.cell, scorecardTableStyles.headerCell, scorecardTableStyles.parHeaderCell]}>
                <Text style={scorecardTableStyles.headerText}>Par</Text>
              </View>
            )}
            {players.map((player) => (
              <View key={player.id} style={[scorecardTableStyles.cell, scorecardTableStyles.headerCell]}>
                <Text style={scorecardTableStyles.headerText}>{player.name}</Text>
              </View>
            ))}
            {onSettingsPress && headerContentWidth > 0 && headerContentWidth >= screenWidth && (
              <View style={[scorecardTableStyles.cell, scorecardTableStyles.headerCell, scorecardTableStyles.settingsHeaderCell]}>
                <IconButton
                  icon="dots-vertical"
                  size={20}
                  iconColor="#fff"
                  onPress={onSettingsPress}
                  style={scorecardTableStyles.settingsIconButton}
                />
              </View>
            )}
          </View>
        </ScrollView>
        {onSettingsPress && headerContentWidth > 0 && headerContentWidth < screenWidth && (
          <View style={scorecardTableStyles.settingsButtonAbsolute}>
            <View style={[scorecardTableStyles.cell, scorecardTableStyles.headerCell, scorecardTableStyles.settingsHeaderCell]}>
              <IconButton
                icon="dots-vertical"
                size={20}
                iconColor="#fff"
                onPress={onSettingsPress}
                style={scorecardTableStyles.settingsIconButton}
              />
            </View>
          </View>
        )}
      </View>

      {/* Scrollable Hole Rows */}
      <ScrollView style={scorecardTableStyles.scrollableContent}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={scorecardTableStyles.table}>
            {/* Hole Rows */}
            {holes.map((hole) => (
              <View key={hole} style={scorecardTableStyles.row}>
                <TouchableOpacity
                  style={[scorecardTableStyles.cell, scorecardTableStyles.holeCell]}
                  onPress={() => {
                    if (!readOnly && players.length > 0) {
                      openEditModal(players[0].id, hole);
                    }
                  }}
                  disabled={readOnly}
                  activeOpacity={readOnly ? 1 : 0.7}
                >
                  <Text style={scorecardTableStyles.holeText}>{hole}</Text>
                </TouchableOpacity>
                {columnVisibility?.gStats === true && (
                  <TouchableOpacity
                    style={[scorecardTableStyles.cell, scorecardTableStyles.gStatsCell]}
                    onPress={() => {
                      if (!readOnly && players.length > 0) {
                        openEditModal(players[0].id, hole);
                      }
                    }}
                    disabled={readOnly}
                    activeOpacity={readOnly ? 1 : 0.7}
                  >
                    <GStatsCell stats={holeStatistics.get(hole)} />
                  </TouchableOpacity>
                )}
                {columnVisibility?.distance !== false && (
                  <View style={[scorecardTableStyles.cell, scorecardTableStyles.distanceCell]}>
                    <Text style={scorecardTableStyles.distanceText}>{formatDistance(hole)}</Text>
                  </View>
                )}
                {columnVisibility?.par === true && (
                  <View style={[scorecardTableStyles.cell, scorecardTableStyles.parCell]}>
                    <Text style={scorecardTableStyles.parText}>
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
                    style={scorecardTableStyles.cell}
                    onPress={() => openEditModal(player.id, hole)}
                    disabled={readOnly}
                    activeOpacity={readOnly ? 1 : 0.7}
                  >
                    <View style={scorecardTableStyles.scoreCellContainer}>
                      {(() => {
                        const key = `${player.id}-${hole}`;
                        const cornerValues = cellCornerValues.get(key) || {
                          topLeft: { value: '', visible: false },
                          topRight: { value: '', visible: false },
                          bottomLeft: { value: '', visible: false },
                          bottomRight: { value: '', visible: false },
                        };
                        const cellScore = getScore(player.id, hole);
                        const getCornerColor = (cornerValue: { value: string | number; visible: boolean }, cornerPosition: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'): string | undefined => {
                          if (!cornerValue.visible) return undefined;
                          const config = cornerStatisticsConfig?.[cornerPosition];
                          
                          // If no config, use default color (undefined = use style default)
                          if (!config) return undefined;
                          
                          // If custom color is set and auto-color is not enabled, use custom color
                          if (config.customColor && config.autoColor !== true) {
                            return config.customColor;
                          }
                          
                          // If auto-color is enabled, calculate color based on comparison
                          if (config.autoColor === true) {
                            if (cellScore === 0) return undefined; // Don't auto-color if cell is empty
                            const cornerNum = typeof cornerValue.value === 'number' ? cornerValue.value : parseFloat(String(cornerValue.value));
                            if (isNaN(cornerNum)) return undefined;
                            
                            if (cornerNum < cellScore) {
                              return '#d32f2f'; // Red shade
                            } else if (cornerNum === cellScore) {
                              return '#f57c00'; // Orange/yellow shade
                            } else {
                              return '#388e3c'; // Green shade
                            }
                          }
                          
                          return undefined; // Default color (use style default)
                        };
                        return (
                          <>
                            {/* Corner numbers - top left */}
                            {cornerValues.topLeft.visible && (() => {
                              const color = getCornerColor(cornerValues.topLeft, 'topLeft');
                              return (
                                <Text style={[scorecardTableStyles.cornerTextTopLeft, color ? { color } : undefined]}>
                                  {cornerValues.topLeft.value}
                                </Text>
                              );
                            })()}
                            {/* Corner numbers - top right */}
                            {cornerValues.topRight.visible && (() => {
                              const color = getCornerColor(cornerValues.topRight, 'topRight');
                              return (
                                <Text style={[scorecardTableStyles.cornerTextTopRight, color ? { color } : undefined]}>
                                  {cornerValues.topRight.value}
                                </Text>
                              );
                            })()}
                            {/* Corner numbers - bottom left */}
                            {cornerValues.bottomLeft.visible && (() => {
                              const color = getCornerColor(cornerValues.bottomLeft, 'bottomLeft');
                              return (
                                <Text style={[scorecardTableStyles.cornerTextBottomLeft, color ? { color } : undefined]}>
                                  {cornerValues.bottomLeft.value}
                                </Text>
                              );
                            })()}
                            {/* Corner numbers - bottom right */}
                            {cornerValues.bottomRight.visible && (() => {
                              const color = getCornerColor(cornerValues.bottomRight, 'bottomRight');
                              return (
                                <Text style={[scorecardTableStyles.cornerTextBottomRight, color ? { color } : undefined]}>
                                  {cornerValues.bottomRight.value}
                                </Text>
                              );
                            })()}
                          </>
                        );
                      })()}
                      {/* Main score - centered */}
                      {(() => {
                        const playerScore = getScore(player.id, hole);
                        // Find the winning score (lowest non-zero score) for this hole
                        const allScores = players
                          .map(p => getScore(p.id, hole))
                          .filter(score => score > 0);
                        const winningScore = allScores.length > 0 ? Math.min(...allScores) : null;
                        const losingScore = allScores.length > 0 ? Math.max(...allScores) : null;
                        const isWinner = winningScore !== null && playerScore === winningScore && playerScore > 0;
                        const isLoser = losingScore !== null && playerScore === losingScore && playerScore > 0 && losingScore !== winningScore;
                        
                        // Check if there's a tie (multiple players with the winning score)
                        const winnerCount = allScores.filter(score => score === winningScore).length;
                        const isTie = winnerCount > 1;
                        
                        let underlineColor = undefined;
                        const showUnderlines = columnVisibility?.showUnderlines === true;
                        const showFontSizeAdjustments = columnVisibility?.showFontSizeAdjustments === true;
                        
                        if (showUnderlines) {
                          if (isWinner) {
                            if (isTie) {
                              underlineColor = '#f9a825'; // Yellow for tie
                            } else {
                              underlineColor = '#2e7d32'; // Green for single winner
                            }
                          } else if (isLoser) {
                            underlineColor = '#d32f2f'; // Red for loss
                          }
                        }
                        
                        // Calculate font size adjustment
                        let fontSizeAdjustment = 0;
                        if (showFontSizeAdjustments) {
                          if (isWinner && !isTie) {
                            fontSizeAdjustment = 3; // +3 for single winner
                          } else if (isLoser) {
                            fontSizeAdjustment = -3; // -3 for loss
                          }
                          // No font size adjustment for ties
                        }
                        
                        // Calculate font color and weight adjustment based on point difference
                        let textColor = undefined;
                        let fontWeight: '400' | '500' | '600' | '700' | undefined = undefined;
                        const showFontColorAdjustments = columnVisibility?.showFontColorAdjustments === true;
                        if (showFontColorAdjustments && winningScore !== null && playerScore > 0) {
                          const pointDifference = playerScore - winningScore;
                          if (pointDifference === 0) {
                            // Tie (0 difference)
                            textColor = '#000';
                            fontWeight = '700';
                          } else if (pointDifference === 1) {
                            // Behind by 1
                            textColor = '#333';
                            fontWeight = '600';
                          } else if (pointDifference === 2) {
                            // Behind by 2
                            textColor = '#666';
                            fontWeight = '500';
                          } else if (pointDifference === 3) {
                            // Behind by 3
                            textColor = '#999';
                            fontWeight = '400';
                          } else {
                            // Behind by 4+
                            textColor = '#bbb';
                            fontWeight = '400';
                          }
                        }
                        
                        return (
                          <View style={scorecardTableStyles.scoreTextContainer}>
                            <Text style={[
                              scorecardTableStyles.scoreText, 
                              fontSizeAdjustment !== 0 ? { fontSize: 18 + fontSizeAdjustment } : undefined,
                              textColor ? { color: textColor } : undefined,
                              fontWeight ? { fontWeight } : undefined
                            ]}>
                              {playerScore || 0}
                            </Text>
                            {underlineColor && (
                              <View style={[scorecardTableStyles.winnerUnderline, { backgroundColor: underlineColor }]} />
                            )}
                          </View>
                        );
                      })()}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Add Player Column */}
            {!readOnly && allowAddPlayer && (
              <View style={scorecardTableStyles.row}>
                <View style={[scorecardTableStyles.cell, scorecardTableStyles.addCell]}>
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
      <View style={scorecardTableStyles.fixedTotalRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={scorecardTableStyles.totalRowContent}>
            <View style={[scorecardTableStyles.cell, scorecardTableStyles.totalRowCell, scorecardTableStyles.holeHeaderCell]}>
              <Text style={[scorecardTableStyles.totalRowText, { marginLeft: -5 }]}>Sum</Text>
            </View>
            {columnVisibility?.gStats === true && (
              <View style={[scorecardTableStyles.cell, scorecardTableStyles.totalRowCell, scorecardTableStyles.gStatsCell]}>
                <GStatsCell stats={totalRoundStatistics} variant="total" />
              </View>
            )}
            {columnVisibility?.distance !== false && (
              <View style={[scorecardTableStyles.cell, scorecardTableStyles.totalRowCell, scorecardTableStyles.distanceCell]}>
                {(() => {
                  const totalDistance = holes.reduce((sum, hole) => {
                    const distance = getHoleDistance(hole);
                    return sum + (distance || 0);
                  }, 0);
                  
                  if (totalDistance === 0) return <Text style={scorecardTableStyles.distanceText}>—</Text>;
                  
                  if (distanceUnit === 'ft') {
                    const feet = Math.round(totalDistance * 3.28084);
                    return <Text style={scorecardTableStyles.distanceText}>{feet}ft</Text>;
                  } else if (distanceUnit === 'yd') {
                    const yards = Math.round(totalDistance * 1.09361);
                    return <Text style={scorecardTableStyles.distanceText}>{yards}yd</Text>;
                  } else {
                    return <Text style={scorecardTableStyles.distanceText}>{Math.round(totalDistance)}m</Text>;
                  }
                })()}
              </View>
            )}
            {columnVisibility?.par === true && (
              <View style={[scorecardTableStyles.cell, scorecardTableStyles.totalRowCell, scorecardTableStyles.parCell]}>
                {(() => {
                  const parsWithValues = holes
                    .map(hole => {
                      const holeData = courseHoles.find(h => h.number === hole);
                      return holeData?.par;
                    })
                    .filter((par): par is number => par !== undefined);
                  
                  if (parsWithValues.length === 0) {
                    return <Text style={scorecardTableStyles.parText}>—</Text>;
                  }
                  
                  const averagePar = parsWithValues.reduce((sum, par) => sum + par, 0) / parsWithValues.length;
                  return <Text style={scorecardTableStyles.parText}>{averagePar.toFixed(1)}</Text>;
                })()}
              </View>
            )}
            {players.map((player) => {
              const playerTotals = totalCornerValues.get(player.id);
              const totalScore = getTotal(player.id);
              return (
                <View key={`total-${player.id}`} style={[scorecardTableStyles.cell, scorecardTableStyles.totalCell]}>
                  <View style={scorecardTableStyles.scoreCellContainer}>
                    {playerTotals && (() => {
                      const getCornerColor = (cornerValue: { value: string | number; visible: boolean }, cornerPosition: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'): string | undefined => {
                        if (!cornerValue.visible) return undefined;
                        const config = cornerStatisticsConfig?.[cornerPosition];
                        
                        // If no config, use default color (undefined = use style default)
                        if (!config) return undefined;
                        
                        // If custom color is set and auto-color is not enabled, use custom color
                        if (config.customColor && config.autoColor !== true) {
                          return config.customColor;
                        }
                        
                        // If auto-color is enabled, calculate color based on comparison
                        if (config.autoColor === true) {
                          if (totalScore === 0) return undefined; // Don't auto-color if cell is empty
                          const cornerNum = typeof cornerValue.value === 'number' ? cornerValue.value : parseFloat(String(cornerValue.value));
                          if (isNaN(cornerNum)) return undefined;
                          
                          if (cornerNum < totalScore) {
                            return '#d32f2f'; // Red shade
                          } else if (cornerNum === totalScore) {
                            return '#f57c00'; // Orange/yellow shade
                          } else {
                            return '#388e3c'; // Green shade
                          }
                        }
                        
                        return undefined; // Default color (use style default)
                      };
                      return (
                        <>
                          {/* Corner numbers - top left */}
                          {playerTotals.topLeft.visible && (() => {
                            const color = getCornerColor(playerTotals.topLeft, 'topLeft');
                            return (
                              <Text style={[scorecardTableStyles.cornerTextTopLeftTotal, color ? { color } : undefined]}>
                                {playerTotals.topLeft.value}
                              </Text>
                            );
                          })()}
                          {/* Corner numbers - top right */}
                          {playerTotals.topRight.visible && (() => {
                            const color = getCornerColor(playerTotals.topRight, 'topRight');
                            return (
                              <Text style={[scorecardTableStyles.cornerTextTopRightTotal, color ? { color } : undefined]}>
                                {playerTotals.topRight.value}
                              </Text>
                            );
                          })()}
                          {/* Corner numbers - bottom left */}
                          {playerTotals.bottomLeft.visible && (() => {
                            const color = getCornerColor(playerTotals.bottomLeft, 'bottomLeft');
                            return (
                              <Text style={[scorecardTableStyles.cornerTextBottomLeftTotal, color ? { color } : undefined]}>
                                {playerTotals.bottomLeft.value}
                              </Text>
                            );
                          })()}
                          {/* Corner numbers - bottom right */}
                          {playerTotals.bottomRight.visible && (() => {
                            const color = getCornerColor(playerTotals.bottomRight, 'bottomRight');
                            return (
                              <Text style={[scorecardTableStyles.cornerTextBottomRightTotal, color ? { color } : undefined]}>
                                {playerTotals.bottomRight.value}
                              </Text>
                            );
                          })()}
                        </>
                      );
                    })()}
                    {/* Main total - centered */}
                    <Text style={scorecardTableStyles.totalText}>{totalScore}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Edit Score Modal */}
      {editModal.holeNumber !== null && (
        <HoleScoreModal
          visible={editModal.visible}
          holeNumber={editModal.holeNumber}
          players={players}
          scores={(() => {
            const scoresMap = new Map<string, number>();
            players.forEach(player => {
              const score = getScore(player.id, editModal.holeNumber!);
              scoresMap.set(String(player.id), score);
            });
            return scoresMap;
          })()}
          onScoreChange={handleScoreChange}
          onDismiss={closeEditModal}
          initialActivePlayerId={editModal.initialPlayerId}
          allHoles={holes}
          onNextHole={handleNextHole}
          min={0}
          max={9}
        />
      )}
    </View>
  );
}

