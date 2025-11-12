import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, TextInput, Dialog, Portal, IconButton, Button, useTheme } from 'react-native-paper';
import { Player } from '@/types';
import { useDialogStyle } from '@/hooks/useDialogStyle';

interface HoleScoreModalProps {
  visible: boolean;
  holeNumber: number;
  players: Player[];
  scores: Map<string, number>; // Map of playerId -> score
  onScoreChange: (playerId: string | number, holeNumber: number, score: number) => void;
  onDismiss: () => void;
  initialActivePlayerId?: string | number;
  allHoles?: number[];
  onNextHole?: (nextHoleNumber: number) => void;
  min?: number;
  max?: number;
}

export default function HoleScoreModal({
  visible,
  holeNumber,
  players,
  scores,
  onScoreChange,
  onDismiss,
  initialActivePlayerId,
  allHoles,
  onNextHole,
  min = 0,
  max = 9,
}: HoleScoreModalProps) {
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Map<string, string>>(new Map());
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const inputRefs = useRef<Map<string, any>>(new Map());
  const pendingSavesRef = useRef<Map<string, { playerId: string; holeNumber: number; expectedScore: number }>>(new Map());
  const shouldAdvanceRef = useRef<{ playerId: string; action: 'advance' | 'close' } | null>(null);
  const theme = useTheme();

  const getScore = (playerId: string): number => {
    return scores.get(playerId) || 0;
  };

  // Generate funny message based on scores
  const generateSuccessMessage = (): string => {
    const playerScores = players.map(player => ({
      player,
      score: scores.get(String(player.id)) || 0
    })).filter(x => x.score > 0);
    if (!playerScores.length){
        return "";
    }

  const allScores = playerScores.map(p => p.score);
  const allSame = allScores.every(score => score === allScores[0]);
  const minScore = Math.min(...allScores);
  const winners = playerScores.filter(p => p.score === minScore);
  const winnerCount = winners.length;
  const winnerNames = winners.map(p => p.player.name);
  const w = winnerCount > 2 ? `${winnerNames.slice(0,winnerCount - 1).join(',')}, and ${winnerNames[winnerCount - 1]}`:winnerNames.join(' and ');
  const maxScore = Math.max(...allScores);
  const scoreDiff = maxScore - minScore;

    // Check for ace (score of 1)
    if (minScore === 1) {
      if (winnerCount === 1) {
        return `🎉🎉🎉 ACE!!! ${w} GOT AN ACE!!! 🎉🎉🎉`;
      } else if (winnerCount === 2) {
          return `🎉🎉🎉 MULTIPLE ACES!!! ${w} BOTH GOT ACES!!! 🎉🎉🎉`;
      } else {
        return `🎉🎉🎉 MULTIPLE ACES!!! ${w} ALL GOT ACES!!! 🎉🎉🎉`;
      }
    }
      if (minScore === 2) {
          if (winnerCount === 1) {
              return `🎉🎉 AMAZING!!! ${w} GOT A 2! 🎉🎉`;
          } else if (winnerCount === 2) {
              return `🎉🎉 INCREDIBLE! ${w} BOTH 2s! 🎉🎉`;
          } else {
              return `🎉🎉 INCREDIBLE! ${w} ALL GOT 2s! 🎉🎉`;
          }
      }

      if (minScore >= 6) {
          return "Tough one, huh? 😅";
      }


      // Check if all tied
    if (allSame && winnerCount > 1) {
        if (winnerCount == 2){
            return "Tie! 🤝";
        }
        if (winnerCount === numPlayers){
            return "Tie across the board! 🤝";
        }
    }else if (winnerCount > 1){
        return `Tie! Congrats to ${w} 🤝`;
    }

    // Check if all scores are 3-4
    const allThreeOrFour = (minScore >= 3) && (maxScore <= 4);
    if (allThreeOrFour) {
      return "Very nice! 👍";
    }


    // Check if within one
    if (scoreDiff === 1) {
      return `Close One! Nice job ${w} 🔥`;
    }

    // 2+ apart - congratulate winner(s)
    if (winnerCount === 1) {
      return `🎉 ${w} wins this hole! 🎉`;
    } else {
      return `🎉 ${w} tie for the win! 🎉`;
    }
  };

  const handleShowSuccess = () => {
    const message = generateSuccessMessage();
    setSuccessMessage(message);
    if (message) {
        setShowSuccess(true);

        // Close after 1 second
        setTimeout(() => {
            setShowSuccess(false);
            onDismiss();
        }, 1000);
    }
  };
  
  // Watch for score updates to confirm saves - this is the reactive confirmation
  useEffect(() => {
    // Check all pending saves to see if they've been confirmed
    const confirmedSaves: string[] = [];
    pendingSavesRef.current.forEach((pending, key) => {
      const actualScore = scores.get(pending.playerId);
      if (actualScore === pending.expectedScore) {
        console.log('[HoleScoreModal] Save confirmed via scores prop update:', {
          playerId: pending.playerId,
          holeNumber: pending.holeNumber,
          expectedScore: pending.expectedScore,
          actualScore
        });
        confirmedSaves.push(key);
        
        // Determine what action to take
        const currentIndex = players.findIndex(p => String(p.id) === pending.playerId);
        if (currentIndex >= 0) {
          if (currentIndex === players.length - 1) {
            // Last player - close modal
            shouldAdvanceRef.current = { playerId: pending.playerId, action: 'close' };
          } else {
            // Advance to next player
            const nextPlayer = players[currentIndex + 1];
            shouldAdvanceRef.current = { playerId: String(nextPlayer.id), action: 'advance' };
          }
        }
      }
    });
    
    // Remove confirmed saves
    confirmedSaves.forEach(key => pendingSavesRef.current.delete(key));
    
    // Execute advance/close actions
    if (shouldAdvanceRef.current) {
      const action = shouldAdvanceRef.current;
      shouldAdvanceRef.current = null;
      
      if (action.action === 'close') {
        // Save all values before closing
        editValues.forEach((value, playerId) => {
          const num = parseInt(value, 10);
          if (!isNaN(num) && num >= min && num <= max) {
            onScoreChange(playerId, holeNumber, num);
          }
        });
        // Show success message before closing
        handleShowSuccess();
      } else {
        setActivePlayerId(action.playerId);
      }
    }
  }, [scores, players, editValues, min, max, holeNumber, onScoreChange, onDismiss, handleShowSuccess]);
  
  // Focus input when active player changes - reactive, no timeouts
  useEffect(() => {
    if (activePlayerId && visible) {
      // Use requestAnimationFrame to ensure DOM is ready, but this is still reactive
      requestAnimationFrame(() => {
        const inputRef = inputRefs.current.get(activePlayerId);
        if (inputRef) {
          inputRef.focus();
        }
      });
    }
  }, [activePlayerId, visible]);

  // Track the last hole number we initialized for
  const lastHoleRef = useRef<number | null>(null);

  // Initialize edit values from scores when modal opens or hole changes
  useEffect(() => {
    if (visible) {
      // Only re-initialize if hole number changed or modal just opened
      if (lastHoleRef.current !== holeNumber) {
        const newEditValues = new Map<string, string>();
        players.forEach(player => {
          const score = scores.get(String(player.id)) || 0;
          newEditValues.set(String(player.id), score.toString());
        });
        setEditValues(newEditValues);
        lastHoleRef.current = holeNumber;
        
        // Set active player: use initialActivePlayerId if provided, otherwise first player
        if (players.length > 0) {
          if (initialActivePlayerId !== undefined) {
            setActivePlayerId(String(initialActivePlayerId));
          } else {
            setActivePlayerId(String(players[0].id));
          }
        }
      }
      // Reset success state when modal opens
      setShowSuccess(false);
    } else {
      // Reset when modal closes
      lastHoleRef.current = null;
      setShowSuccess(false);
    }
  }, [visible, holeNumber, players, initialActivePlayerId, scores]);


  const handleCellPress = (playerId: string) => {
    setActivePlayerId(playerId);
  };

  const handleValueChange = (playerId: string, text: string) => {
    // Only allow single digits (0-9)
    const digitOnly = text.replace(/[^0-9]/g, '').slice(0, 1); // Only keep first digit
    
    // Ensure playerId is a string
    const normalizedPlayerId = String(playerId);
    
    const newEditValues = new Map(editValues);
    newEditValues.set(normalizedPlayerId, digitOnly);
    setEditValues(newEditValues);

    const num = parseInt(digitOnly, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      console.log('[HoleScoreModal] Attempting to save score:', {
        playerId: normalizedPlayerId,
        holeNumber,
        score: num,
        currentScoreInMap: scores.get(normalizedPlayerId)
      });
      
      // Check if score already matches (no need to save)
      const currentScore = scores.get(normalizedPlayerId);
      if (currentScore === num) {
        console.log('[HoleScoreModal] Score already matches, no save needed');
        // Score already matches, proceed with advance/close immediately
        const currentIndex = players.findIndex(p => String(p.id) === normalizedPlayerId);
        if (currentIndex >= 0) {
          if (currentIndex === players.length - 1) {
            handleShowSuccess();
          } else {
            const nextPlayerId = String(players[currentIndex + 1].id);
            setActivePlayerId(nextPlayerId);
          }
        }
        return;
      }
      
      // Add to pending saves - we'll wait for scores prop to update
      const pendingKey = `${normalizedPlayerId}-${holeNumber}`;
      pendingSavesRef.current.set(pendingKey, {
        playerId: normalizedPlayerId,
        holeNumber,
        expectedScore: num
      });
      
      console.log('[HoleScoreModal] Added to pending saves, calling onScoreChange:', {
        playerId: normalizedPlayerId,
        holeNumber,
        score: num,
        pendingSaves: Array.from(pendingSavesRef.current.entries())
      });
      
      // Immediately save the change - ensure playerId is normalized and pass holeNumber
      onScoreChange(normalizedPlayerId, holeNumber, num);
      
      // The useEffect watching scores will detect when the save completes and proceed
    }
  };

  const handleBlur = (playerId: string) => {
    // Save on blur (but don't advance, since we advance immediately on input)
    const editValue = editValues.get(playerId) || '0';
    const num = parseInt(editValue, 10);
    
    if (!isNaN(num) && num >= min && num <= max) {
      onScoreChange(playerId, holeNumber, num);
    }
  };

  const handleSubmit = (playerId: string) => {
    const editValue = editValues.get(playerId) || '0';
    const num = parseInt(editValue, 10);
    
    // Save on submit
    if (!isNaN(num) && num >= min && num <= max) {
      onScoreChange(playerId, holeNumber, num);
    }
    
    // Check if we're on the rightmost player
    const currentIndex = players.findIndex(p => String(p.id) === playerId);
    if (currentIndex >= 0 && currentIndex === players.length - 1) {
      // We're on the rightmost player, show success then close
      handleShowSuccess();
    } else {
      // Advance to the next player
      if (currentIndex >= 0 && currentIndex < players.length - 1) {
        const nextPlayerId = String(players[currentIndex + 1].id);
        setActivePlayerId(nextPlayerId);
      }
    }
  };

  const handleClose = () => {
    // Save all values before closing
    editValues.forEach((value, playerId) => {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= min && num <= max) {
        onScoreChange(playerId, holeNumber, num);
      }
    });
    // Show success message before closing
    handleShowSuccess();
  };

  // Calculate responsive cell width
  const dialogStyle = useDialogStyle();
  const screenWidth = Dimensions.get('window').width;
  const dialogMargin = 32; // 16px on each side
  const contentPadding = 48; // Approximate padding from Dialog.Content
  const availableWidth = screenWidth - dialogMargin - contentPadding;
  
  const MIN_CELL_WIDTH = 60;
  const MAX_CELL_WIDTH = 120; // 2x the current width
  
  const numPlayers = players.length;
  const optimalWidth = Math.floor(availableWidth / numPlayers);
  const cellWidth = Math.max(MIN_CELL_WIDTH, Math.min(MAX_CELL_WIDTH, optimalWidth));
  
  // Calculate input width based on cell width (accounting for padding and border)
  const cellPadding = 2;
  const inputWidth = cellWidth - (cellPadding * 2) - 4; // 4px for outline border

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleClose} style={[styles.dialog, dialogStyle]}>
        <View style={styles.modalHeader}>
          <Dialog.Title style={styles.modalTitle}>Hole #{holeNumber}</Dialog.Title>
          <IconButton
            icon="close"
            size={24}
            onPress={handleClose}
            style={styles.closeButton}
          />
        </View>
        <Dialog.Content>
          {showSuccess ? (
            <View style={styles.successContainer}>
              <View style={styles.successHeader}>
                <IconButton
                  icon="check-circle"
                  iconColor={theme.colors.primary}
                  size={32}
                  style={styles.checkIcon}
                />
                <Text style={styles.successTitle}>
                  Recorded scores for hole #{holeNumber}
                </Text>
              </View>
              <Text style={styles.successMessage}>{successMessage}</Text>
            </View>
          ) : (
            <View style={styles.tableContainer}>
              <View style={styles.tableRow}>
                {/* Player column headers */}
                {players.map((player) => (
                  <View 
                    key={player.id} 
                    style={[
                      styles.cell, 
                      styles.headerCell,
                      { width: cellWidth, minWidth: cellWidth, maxWidth: cellWidth }
                    ]}
                  >
                    <Text style={styles.headerText}>{player.name}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.tableRow}>
                {/* Player score cells */}
                {players.map((player, index) => {
                  const playerId = String(player.id);
                  const isActive = activePlayerId === playerId;
                  const editValue = editValues.get(playerId) || getScore(playerId).toString();
                  const isLastPlayer = index === players.length - 1;
                  
                  return (
                    <TouchableOpacity
                      key={player.id}
                      style={[
                        styles.cell,
                        styles.scoreCell,
                        isActive && styles.activeCell,
                        { width: cellWidth, minWidth: cellWidth, maxWidth: cellWidth }
                      ]}
                      onPress={() => handleCellPress(playerId)}
                    >
                      <TextInput
                        ref={(ref: any) => {
                          if (ref) {
                            inputRefs.current.set(playerId, ref);
                          }
                        }}
                        mode="outlined"
                        value={editValue}
                        onChangeText={(text) => handleValueChange(playerId, text)}
                        keyboardType="numeric"
                        maxLength={1}
                        autoFocus={isActive && visible}
                        selectTextOnFocus
                        style={[styles.input, { width: inputWidth }]}
                        contentStyle={styles.inputContent}
                        textAlign="center"
                        dense
                        returnKeyType={isLastPlayer ? "done" : "next"}
                        onFocus={() => {
                          // ALWAYS set as active when focused - no exceptions
                          setActivePlayerId(playerId);
                          console.log('[HoleScoreModal] Cell focused, setting active:', playerId);
                        }}
                        onBlur={() => handleBlur(playerId)}
                        onSubmitEditing={() => handleSubmit(playerId)}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    marginHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  modalTitle: {
    flex: 1,
  },
  closeButton: {
    margin: 0,
  },
  tableContainer: {
    paddingVertical: 8,
    alignSelf: 'center',
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignSelf: 'center',
  },
  cell: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerCell: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  scoreCell: {
    backgroundColor: '#fff',
    padding: 2,
  },
  activeCell: {
    borderWidth: 4,
    borderColor: '#1976D2',
    borderRadius: 4,
    backgroundColor: '#E3F2FD',
  },
  input: {
    height: 36,
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 0,
    margin: 0,
  },
  inputContent: {
    textAlign: 'center',
    paddingHorizontal: 0,
  },
  successContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  checkIcon: {
    margin: 0,
    marginRight: 8,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 24,
  },
});

