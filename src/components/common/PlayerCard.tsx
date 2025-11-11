/**
 * Shared Player Card Component
 * Reusable card for displaying player information
 */

import React from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Card, Text, Chip, useTheme } from 'react-native-paper';
import { User } from '../../services/storage/userStorage';
import { getShadowStyle } from '../../utils';
import HashedImage from './HashedImage';
import { router } from 'expo-router';
import { encodeNameForUrl } from '../../utils/urlEncoding';
import { sharedCardStyles } from './sharedCardStyles';

interface PlayerCardProps {
  player: User;
  photos?: string[]; // Array of image hashes
  onPress?: () => void;
  onLongPress?: () => void;
  showPhotos?: boolean;
  isSelected?: boolean;
  roundsCount?: number;
  coursesCount?: number;
  winsCount?: number;
  totalThrows?: number;
  holesCount?: number;
}

export default function PlayerCard({
  player,
  photos = [],
  onPress,
  onLongPress,
  showPhotos = false,
  isSelected = false,
  roundsCount,
  coursesCount,
  winsCount,
  totalThrows,
  holesCount,
}: PlayerCardProps) {
  const theme = useTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/player/${encodeNameForUrl(player.name)}/overview`);
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
            <View style={styles.nameRow}>
              <Text style={[sharedCardStyles.name, { color: theme.colors.onSurface }]}>
                {player.name}
              </Text>
              {player.isCurrentUser && (
                <Chip 
                  style={styles.currentUserChip} 
                  textStyle={styles.currentUserChipText}
                  compact
                >
                  You
                </Chip>
              )}
            </View>
          </View>

          {(showPhotos && photos && photos.length > 0) || player.notes ? (
            <View style={sharedCardStyles.photoNotesRow}>
              {showPhotos && photos && photos.length > 0 && (
                <HashedImage
                  hash={photos[0]}
                  style={sharedCardStyles.image}
                  contentFit="cover"
                />
              )}
              {player.notes && (
                <Text 
                  style={[sharedCardStyles.notesText, { color: theme.colors.onSurfaceVariant }]}
                  numberOfLines={3}
                  ellipsizeMode="tail"
                >
                  {player.notes}
                </Text>
              )}
            </View>
          ) : null}

          {/* Stats Chips at Bottom */}
          {(winsCount !== undefined || coursesCount !== undefined || roundsCount !== undefined || holesCount !== undefined || totalThrows !== undefined) && (
            <View style={styles.statsChipsContainer}>
              {winsCount !== undefined && winsCount > 0 && (
                <Chip 
                  style={[styles.statChip, { backgroundColor: '#FFD700' }]}
                  textStyle={[styles.statChipText, { color: '#000', fontWeight: 'bold' }]}
                  icon="crown"
                  compact
                >
                  {winsCount} {winsCount === 1 ? 'win' : 'wins'}
                </Chip>
              )}
              {coursesCount !== undefined && coursesCount > 0 && (
                <Chip 
                  style={styles.statChip}
                  textStyle={styles.statChipText}
                  icon="map-marker"
                  compact
                >
                  {coursesCount} {coursesCount === 1 ? 'course' : 'courses'}
                </Chip>
              )}
              {roundsCount !== undefined && roundsCount > 0 && (
                <Chip 
                  style={[styles.statChip, { backgroundColor: '#2E7D32' }]}
                  textStyle={[styles.statChipText, { color: '#FFFFFF' }]}
                  icon="golf"
                  compact
                >
                  {roundsCount}
                </Chip>
              )}
              {holesCount !== undefined && holesCount > 0 && (
                <Chip 
                  style={[styles.statChip, { backgroundColor: '#388E3C' }]}
                  textStyle={[styles.statChipText, { color: '#FFFFFF' }]}
                  icon="golf-tee"
                  compact
                >
                  {holesCount}
                </Chip>
              )}
              {totalThrows !== undefined && totalThrows > 0 && (
                <Chip 
                  style={[styles.statChip, { backgroundColor: '#F5F5DC' }]}
                  textStyle={[styles.statChipText, { color: '#8B7355' }]}
                  icon="target"
                  compact
                >
                  {totalThrows}
                </Chip>
              )}
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = {
  nameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  currentUserChip: {
    height: 18,
    minHeight: 18,
    maxHeight: 18,
    paddingHorizontal: 6,
    paddingVertical: 0,
    marginLeft: 6,
    marginVertical: 0,
    alignSelf: 'center' as const,
  },
  currentUserChipText: {
    fontSize: 10,
    lineHeight: 14,
    paddingVertical: 0,
    marginVertical: 0,
    height: 14,
  },
  statsChipsContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 3,
    marginTop: 0,
  },
  statChip: {
    height: 28,
    paddingHorizontal: 0,
    paddingVertical: 0,
    paddingLeft: 0,
    paddingRight: 8,
    paddingBottom: 4,
    margin: 0,
    marginHorizontal: 0,
    marginVertical: 0,
    marginBottom: 4,
  },
  statChipText: {
    fontSize: 13,
    padding: 4,
    margin: 0,
  },
};

