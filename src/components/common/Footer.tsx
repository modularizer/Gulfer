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
  const { toggleTheme } = useTheme();
  const pathname = usePathname();
  
  // Check if we're on a play page
  const isPlayPage = pathname?.includes('/play') || false;

  const handleCenterPress = useCallback(() => {
    if (customCenterHandler) {
      customCenterHandler();
    } else {
      router.push('/new-round');
    }
  }, [customCenterHandler]);

  return (
    <HillFooter
      onHistoryPress={() => router.push('/round-history')}
      onNewRoundPress={handleCenterPress}
      onProfilePress={toggleTheme}
      showCenterButton={!isPlayPage}
    />
  );
}
