import React, { createContext, useContext, useState, useCallback } from 'react';
import { router, usePathname } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { getAllUsers, getCurrentUserName, getUsernameForPlayerName } from '../../services/storage/userStorage';
import { createNewRound } from '../../services/storage/roundStorage';
import { getLastUsedCourse, getLatestAddedCourse } from '../../services/storage/courseStorage';
import { Player } from '../../types';
import HillFooter from './Footer/HillFooter';

// Context to allow pages to register custom center button handlers
interface FooterContextType {
  registerCenterButtonHandler: (handler: (() => void) | null) => void;
  customCenterHandler: (() => void) | null;
}

export const FooterContext = createContext<FooterContextType | null>(null);

export function useFooterCenterButton() {
  const context = useContext(FooterContext);
  if (!context) {
    throw new Error('useFooterCenterButton must be used within AppLayout');
  }
  return context;
}

interface FooterProps {
  customCenterHandler: (() => void) | null;
}

export default function Footer({ customCenterHandler }: FooterProps) {
  const pathname = usePathname();
  
  // Check if we're on a play page (but not on /players page)
  const isPlayPage = (pathname?.includes('/play') && !pathname?.includes('/players')) || false;

  const handleCenterPress = useCallback(async () => {
    if (customCenterHandler) {
      customCenterHandler();
    } else {
      // Create a round immediately (same as "Play Now")
      try {
        const currentUserName = await getCurrentUserName();
        const playerName = currentUserName || 'You';
        const username = await getUsernameForPlayerName(playerName);
        const defaultPlayer: Player = { 
          id: 'player_1', 
          name: playerName,
          username,
        };
        
        const defaultCourse = await getLastUsedCourse() || await getLatestAddedCourse();
        const courseName = defaultCourse ? defaultCourse.name : undefined;
        
        const newRound = await createNewRound({
          players: [defaultPlayer],
          gameType: 'disc-golf',
          courseName,
          date: Date.now(),
        });
        
        router.replace(`/${newRound.id}/overview`);
      } catch (error) {
        console.error('Error creating round:', error);
        router.push('/');
      }
    }
  }, [customCenterHandler]);

  const handleProfilePress = useCallback(async () => {
    try {
      const users = await getAllUsers();
      const currentUser = users.find(u => u.isCurrentUser);
      if (currentUser && currentUser.username) {
        // User has username, navigate to their player page
        router.push(`/player/${encodeURIComponent(currentUser.username)}`);
      } else {
        // No username set, navigate to /you page to set it
        router.push('/you');
      }
    } catch (error) {
      console.error('Error navigating to profile:', error);
      router.push('/you');
    }
  }, []);

  return (
    <HillFooter
      onHistoryPress={() => router.push('/rounds')}
      onNewRoundPress={handleCenterPress}
      onProfilePress={handleProfilePress}
      showCenterButton={!isPlayPage}
    />
  );
}
