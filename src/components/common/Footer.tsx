import React, { createContext, useContext, useCallback } from 'react';
import { router, usePathname } from 'expo-router';
import { getAllUsers } from '../../services/storage/userStorage';
import { encodeNameForUrl } from '../../utils/urlEncoding';
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
  
  // Check if we're on a holes page (but not on /players page)
  const isHolesPage = (pathname?.includes('/holes') && !pathname?.includes('/players')) || false;

  const handleCenterPress = useCallback(() => {
    if (customCenterHandler) {
      customCenterHandler();
    } else {
      // Navigate to the new round screen
      router.push('/round/new');
    }
  }, [customCenterHandler]);

  const handleProfilePress = useCallback(async () => {
    try {
      const users = await getAllUsers();
      const currentUser = users.find(u => u.isCurrentUser);
      if (currentUser) {
        // Navigate to player page using encoded name
        router.push(`/player/${encodeNameForUrl(currentUser.name)}/overview`);
      } else {
        // No user set, navigate to /you page to set it
        router.push('/player/me');
      }
    } catch (error) {
      console.error('Error navigating to profile:', error);
      router.push('/you');
    }
  }, []);

  return (
    <HillFooter
      onHistoryPress={() => router.push('/round/list')}
      onNewRoundPress={handleCenterPress}
      onProfilePress={handleProfilePress}
      showCenterButton={!isHolesPage}
    />
  );
}
