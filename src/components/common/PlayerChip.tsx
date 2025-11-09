import React from 'react';
import { Chip } from 'react-native-paper';
import { Player } from '../../types';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

interface PlayerChipProps {
  player: Player;
  score?: number;
  isWinner?: boolean;
  isCurrentPlayer?: boolean;
  onPress?: () => void;
}

export default function PlayerChip({
  player,
  score,
  isWinner = false,
  isCurrentPlayer = false,
  onPress,
}: PlayerChipProps) {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      if (!player.username) {
        console.error('Player missing username:', player);
        return;
      }
      router.push(`/player/${encodeURIComponent(player.username)}`);
    }
  };

  const displayText = score !== undefined ? `${player.name}: ${score}` : player.name;

  return (
    <Chip
      style={[
        styles.chip,
        isWinner && styles.winnerChip,
        isCurrentPlayer && !isWinner && styles.currentPlayerChip,
      ]}
      textStyle={[
        styles.chipText,
        isWinner && styles.winnerChipText,
        isCurrentPlayer && !isWinner && styles.currentPlayerChipText,
      ]}
      icon={isWinner ? 'crown' : undefined}
      onPress={handlePress}
    >
      {displayText}
    </Chip>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 32,
  },
  chipText: {
    fontSize: 14,
  },
  winnerChip: {
    backgroundColor: '#FFD700',
  },
  winnerChipText: {
    color: '#000',
    fontWeight: 'bold',
  },
  currentPlayerChip: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  currentPlayerChipText: {
    fontWeight: '600',
  },
});

