/**
 * Shared Course Card Component
 * Reusable card for displaying course information
 */

import React from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { Course, Player } from '../../types';
import { getShadowStyle } from '../../utils';
import PlayerChip from './PlayerChip';
import HashedImage from './HashedImage';
import { router } from 'expo-router';
import { encodeNameForUrl } from '../../utils/urlEncoding';
import { sharedCardStyles } from './sharedCardStyles';

interface CourseCardProps {
  course: Course;
  photos?: string[]; // Array of image hashes
  onPress?: () => void;
  onLongPress?: () => void;
  showPhotos?: boolean;
  isSelected?: boolean;
  bestScores?: Array<{ player: Player; score: number }>;
}

export default function CourseCard({
  course,
  photos = [],
  onPress,
  onLongPress,
  showPhotos = false,
  isSelected = false,
  bestScores = [],
}: CourseCardProps) {
  const theme = useTheme();

  const holeCount = Array.isArray(course.holes) 
    ? course.holes.length 
    : (course.holes as unknown as number || 0);

  const winner = bestScores.length > 0 
    ? bestScores.reduce((min, current) => current.score < min.score ? current : min)
    : null;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/course/${encodeNameForUrl(course.name)}/overview`);
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
            <Text style={[sharedCardStyles.name, { color: theme.colors.onSurface }]}>
              {course.name} ({holeCount} {holeCount === 1 ? 'hole' : 'holes'})
            </Text>
          </View>

          {(showPhotos && photos && photos.length > 0) || course.notes ? (
            <View style={sharedCardStyles.photoNotesRow}>
              {showPhotos && photos && photos.length > 0 && (
                <HashedImage
                  hash={photos[0]}
                  style={sharedCardStyles.image}
                  contentFit="cover"
                />
              )}
              {course.notes && (
                <Text 
                  style={[sharedCardStyles.notesText, { color: theme.colors.onSurfaceVariant }]}
                  numberOfLines={3}
                  ellipsizeMode="tail"
                >
                  {course.notes}
                </Text>
              )}
            </View>
          ) : null}

          {bestScores.length > 0 && (
            <View style={sharedCardStyles.playersContainer}>
              {bestScores
                .sort((a, b) => a.score - b.score)
                .map(({ player, score }) => {
                  const isWinner = winner ? player.id === winner.player.id : false;
                  return (
                    <PlayerChip
                      key={player.id}
                      player={player}
                      score={score}
                      isWinner={isWinner}
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

