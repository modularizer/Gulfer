import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { createNewRound } from '@/services/storage/roundStorage';
import { getCurrentUserName, getUserIdForPlayerName } from '@/services/storage/userStorage';
import { getLastUsedCourse, getLatestAddedCourse } from '@/services/storage/courseStorage';
import { saveUserRoundByUserAndRound } from '@/services/storage/userRoundStorage';

/**
 * New Round Screen - "Play Now" functionality
 * Immediately creates a round and navigates to it
 * This is equivalent to clicking "Play Now"
 */
export default function NewRoundScreen() {
  const theme = useTheme();

  useEffect(() => {
    const createRound = async () => {
      try {
        // Try to get the current user's name, default to "You" if not set
        const currentUserName = await getCurrentUserName();
        const playerName = currentUserName || 'You';
        const playerId = await getUserIdForPlayerName(playerName);
        
        // Get default course (last used or latest added)
        const defaultCourse = await getLastUsedCourse() || await getLatestAddedCourse();
        const courseId = defaultCourse ? defaultCourse.id : undefined;
        
        const newRound = await createNewRound({
          courseId,
          date: Date.now(),
        });
        
        // Create UserRound for the player
        await saveUserRoundByUserAndRound(playerId, newRound.id);
        
        // Redirect to the overview page
        // Use replace to avoid navigation stack issues
        router.replace(`/round/${newRound.id}/overview`);
      } catch (error) {
        console.error('Error creating round:', error);
        router.push('/');
      }
    };

    createRound();
  }, []);

  // Show loading indicator while creating round
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

