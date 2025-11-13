import React from 'react';
import { Chip } from 'react-native-paper';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { encodeNameForUrl } from '@/utils/urlEncoding';

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
      router.push(`/player/${encodeNameForUrl(player.name)}/overview`);
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
    height: 28,
    minHeight: 28,
    paddingLeft: 0,
    paddingRight: 6,
    paddingVertical: 0,
    paddingBottom: 0,
    marginBottom: 0,
  },
  chipText: {
    fontSize: 14,
    lineHeight: 14,
    padding: 0,
    paddingBottom: 0,
    margin: 0,
    marginLeft: 4,
    marginBottom: -2,
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

