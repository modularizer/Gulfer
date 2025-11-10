/**
 * Shared Round Card Component
 * Reusable card for displaying round information
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Card, Text, Chip, useTheme } from 'react-native-paper';
import { Round, Player } from '../../types';
import { getShadowStyle } from '../../utils';
import PlayerChip from './PlayerChip';
import HashedImage from './HashedImage';
import { router } from 'expo-router';

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
        styles.card, 
        { backgroundColor: isSelected ? theme.colors.primaryContainer : theme.colors.surface }, 
        getShadowStyle(2)
      ]}>
        <Card.Content>
          <View style={styles.header}>
            <Text style={[styles.date, { color: theme.colors.onSurface }]}>
              <Text style={styles.boldText}>
                {dateStr} {timeStr}
              </Text>
              {showCourse && round.courseName && (
                <>
                  {' '}
                  <Text style={styles.normalText}>
                    @ {round.courseName} {courseHoleCount && courseHoleCount > 0 && `(${courseHoleCount} ⛳)`}
                  </Text>
                </>
              )}
            </Text>
          </View>

          {showPhotos && round.photos && round.photos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imagesContainer}
              contentContainerStyle={styles.imagesContent}
            >
              {round.photos.slice(0, 3).map((hash) => (
                <HashedImage
                  key={hash}
                  hash={hash}
                  style={styles.roundImage}
                  contentFit="cover"
                />
              ))}
              {round.photos.length > 3 && (
                <View style={[styles.roundImage, styles.moreImagesOverlay]}>
                  <Text style={styles.moreImagesText}>+{round.photos.length - 3}</Text>
                </View>
              )}
            </ScrollView>
          )}

          {playerScores.length > 0 && (
            <View style={styles.playersContainer}>
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

const styles = StyleSheet.create({
  card: {
    marginBottom: 8,
  },
  header: {
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    fontWeight: '600',
  },
  boldText: {
    fontWeight: 'bold',
  },
  normalText: {
    fontWeight: 'normal',
    fontSize: 12,
  },
  playersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imagesContainer: {
    marginBottom: 8,
  },
  imagesContent: {
    gap: 8,
  },
  roundImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  moreImagesOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

