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
import { CardMode } from './CardModeToggle';

interface CourseCardProps {
  course: Course;
  photos?: string[]; // Array of image hashes
  onPress?: () => void;
  onLongPress?: () => void;
  showPhotos?: boolean;
  isSelected?: boolean;
  bestScores?: Array<{ player: Player; score: number }>;
  mode?: CardMode;
}

export default function CourseCard({
  course,
  photos = [],
  onPress,
  onLongPress,
  showPhotos = false,
  isSelected = false,
  bestScores = [],
  mode = 'medium',
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

  // List mode: just name in single row
  if (mode === 'list') {
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
        <View style={[
          { 
            padding: 12, 
            backgroundColor: isSelected ? theme.colors.primaryContainer : theme.colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.outlineVariant,
          }
        ]}>
          <Text style={[{ color: theme.colors.onSurface, fontSize: 16 }]}>
            {course.name} ({holeCount} {holeCount === 1 ? 'hole' : 'holes'})
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Large mode: up to 4 photos in row, description below
  if (mode === 'large') {
    const displayPhotos = showPhotos && photos ? photos.slice(0, 4) : [];
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

            {displayPhotos.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {displayPhotos.map((photo, idx) => (
                  <HashedImage
                    key={idx}
                    hash={photo}
                    style={{ width: '23%', aspectRatio: 1, borderRadius: 8 }}
                    contentFit="cover"
                  />
                ))}
              </View>
            )}

            {course.notes && (
              <Text 
                style={[sharedCardStyles.notesText, { color: theme.colors.onSurfaceVariant, marginBottom: 8 }]}
                numberOfLines={3}
                ellipsizeMode="tail"
              >
                {course.notes}
              </Text>
            )}

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

  // Small mode: name and chips, no photos/notes
  if (mode === 'small') {
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

  // Medium mode: current default behavior
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

