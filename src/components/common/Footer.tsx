import React, { createContext, useContext, useState, useCallback } from 'react';
import { router, usePathname } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
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

  const handleCenterPress = useCallback(() => {
    if (customCenterHandler) {
      customCenterHandler();
    } else {
      router.push('/new-round');
    }
  }, [customCenterHandler]);

  return (
    <HillFooter
      onHistoryPress={() => router.push('/rounds')}
      onNewRoundPress={handleCenterPress}
      onProfilePress={() => router.push('/profile')}
      showCenterButton={!isPlayPage}
    />
  );
}
