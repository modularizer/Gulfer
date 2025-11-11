/**
 * Shared Round Card Component
 * Reusable card for displaying round information
 */

import React from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Card, Text, Chip, useTheme } from 'react-native-paper';
import { Round, Player } from '../../types';
import { getShadowStyle } from '../../utils';
import PlayerChip from './PlayerChip';
import HashedImage from './HashedImage';
import { router } from 'expo-router';
import { sharedCardStyles } from './sharedCardStyles';

interface RoundCardProps {
  round: Round;
  onPress?: () => void;
  onLongPress?: () => void;
  showCourse?: boolean;
  courseHoleCount?: number;
  showPhotos?: boolean;
  isSelected?: boolean;
}

export default function RoundCard({
  round,
  onPress,
  onLongPress,
  showCourse = true,
  courseHoleCount,
  showPhotos = false,
  isSelected = false,
}: RoundCardProps) {
  const theme = useTheme();

  const date = new Date(round.date);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const playerScores = round.players.map((player) => {
    const total = round.scores
      ? round.scores
          .filter((s) => s.playerId === player.id)
          .reduce((sum, s) => sum + s.throws, 0)
      : 0;
    return { player, total };
  });

  const winnerScore = Math.min(...playerScores.map((ps) => ps.total));
  const winner = playerScores.find((ps) => ps.total === winnerScore);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/round/${round.id}/overview`);
    }
  };

  return (
    <TouchableOpacity 
      onPress={handlePress} 
      onLongPress={onLongPress} 
      delayLongPress={300}
      activeOpacity={0.7}
      {...(Platform.OS === 'web' && onLongPress ? {
        onContextMenu: (e: any) => {
          e.preventDefault();
          e.stopPropagation();
          onLongPress();
        }
      } : {})}
    >
      <Card style={[
        sharedCardStyles.card, 
        { backgroundColor: isSelected ? theme.colors.primaryContainer : theme.colors.surface }, 
        getShadowStyle(2)
      ]}>
        <Card.Content>
          <View style={sharedCardStyles.header}>
            <Text style={[sharedCardStyles.date, { color: theme.colors.onSurface }]}>
              <Text style={sharedCardStyles.boldText}>
                {dateStr} {timeStr}
              </Text>
              {showCourse && round.courseName && (
                <>
                  {' '}
                  <Text style={sharedCardStyles.normalText}>
                    @ {round.courseName} {courseHoleCount && courseHoleCount > 0 && `(${courseHoleCount} ⛳)`}
                  </Text>
                </>
              )}
            </Text>
          </View>

          {(showPhotos && round.photos && round.photos.length > 0) || round.notes ? (
            <View style={sharedCardStyles.photoNotesRow}>
              {showPhotos && round.photos && round.photos.length > 0 && (
                <HashedImage
                  hash={round.photos[0]}
                  style={sharedCardStyles.image}
                  contentFit="cover"
                />
              )}
              {round.notes && (
                <Text 
                  style={[sharedCardStyles.notesText, { color: theme.colors.onSurfaceVariant }]}
                  numberOfLines={3}
                  ellipsizeMode="tail"
                >
                  {round.notes}
                </Text>
              )}
            </View>
          ) : null}

          {playerScores.length > 0 && (
            <View style={sharedCardStyles.playersContainer}>
              {playerScores.map(({ player, total }) => {
                const isWinner = winner && player.id === winner.player.id;
                return (
                  <PlayerChip
                    key={player.id}
                    player={player}
                    score={total}
                    isWinner={isWinner}
                    onPress={() => router.push(`/round/${round.id}/holes`)}
                  />
                );
              })}
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

