import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import Footer from '../components/common/Footer';
import faviconImage from '../../assets/favicon.png';

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={styles.content} edges={['top']}>
        <View style={styles.brandingContainer}>
          <View style={styles.logoWrapper}>
            <Image
              source={faviconImage}
              style={styles.logo}
              contentFit="contain"
            />
          </View>
        </View>
      </SafeAreaView>
      <SafeAreaView edges={['bottom']}>
        <Footer />
      </SafeAreaView>
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
  logoWrapper: {
    padding: Platform.OS === 'web' ? 0 : 16, // Add padding on mobile to prevent cutoff
  },
  logo: {
    width: 120,
    height: 120,
  },
});

