import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { useFooterCenterButton } from '../src/components/common/Footer';

export default function HomeScreen() {
  const theme = useTheme();
  const { registerCenterButtonHandler } = useFooterCenterButton();

  // Ensure center button always goes to new-round on home page
  useEffect(() => {
    const handleNewRound = () => {
      router.push('/new-round');
    };
    
    registerCenterButtonHandler(handleNewRound);
    
    return () => {
      registerCenterButtonHandler(null);
    };
  }, [registerCenterButtonHandler]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.brandingContainer}>
          <Image
            source={require('../assets/favicon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  logo: {
    width: 120,
    height: 120,
  },
});

