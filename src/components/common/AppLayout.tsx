import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Footer, { FooterContext } from './Footer';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [customCenterHandler, setCustomCenterHandler] = useState<(() => void) | null>(null);

  const registerCenterButtonHandler = useCallback((handler: (() => void) | null) => {
    setCustomCenterHandler(() => handler);
  }, []);

  return (
    <FooterContext.Provider value={{ registerCenterButtonHandler, customCenterHandler }}>
      <View style={styles.container}>
        <View style={styles.content}>
          {children}
        </View>
        <SafeAreaView edges={['bottom']}>
          <Footer customCenterHandler={customCenterHandler} />
        </SafeAreaView>
      </View>
    </FooterContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

