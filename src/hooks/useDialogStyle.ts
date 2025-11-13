import { useEffect, useState } from 'react';
import { Platform, Dimensions, StyleSheet } from 'react-native';

/**
 * Hook that returns dialog styles constrained to phone container width on big screens
 * This ensures modals and dialogs fit within the phone-sized container on desktop
 */
export function useDialogStyle() {
  const [isBigScreen, setIsBigScreen] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const checkScreenSize = () => {
        const { width, height } = Dimensions.get('window');
        // Big screen if width > maxWidth (500) or height > maxHeight (900)
        setIsBigScreen(width > 500 || height > 900);
      };
      
      checkScreenSize();
      const subscription = Dimensions.addEventListener('change', checkScreenSize);
      
      return () => {
        subscription?.remove();
      };
    }
  }, []);

  if (Platform.OS === 'web' && isBigScreen) {
    return {
      maxWidth: 500, // Match the container maxWidth
      alignSelf: 'center' as const,
    };
  }

  return {};
}


