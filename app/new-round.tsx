import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { createNewRound } from '../src/services/storage/roundStorage';
import { getCurrentUserName } from '../src/services/storage/userStorage';
import { getLastUsedCourse, getLatestAddedCourse } from '../src/services/storage/courseStorage';
import { Player } from '../src/types';

export default function NewRoundScreen() {
  const theme = useTheme();
  const [creating, setCreating] = useState(true);

  useEffect(() => {
    const createRound = async () => {
      try {
        // Try to get the current user's name, default to "You" if not set
        const currentUserName = await getCurrentUserName();
        const defaultPlayer: Player = { 
          id: 'player_1', 
          name: currentUserName || 'You' 
        };
        
        // Get default course (last used or latest added)
        const defaultCourse = await getLastUsedCourse() || await getLatestAddedCourse();
        const courseName = defaultCourse ? defaultCourse.name : undefined;
        
        const newRound = await createNewRound({
          players: [defaultPlayer],
          gameType: 'disc-golf',
          courseName,
        });
        
        // Redirect to the overview page
        router.replace(`/${newRound.id}/overview`);
      } catch (error) {
        console.error('Error creating round:', error);
        router.push('/');
      }
    };

    createRound();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

