/**
 * Shared Hero Section Component
 * Photo gallery section with fallback logo
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import PhotoGallery from './PhotoGallery';

interface HeroSectionProps {
  photos: string[];
  onPhotosChange?: (photos: string[]) => void;
  storageKey: string;
  isEditable?: boolean;
}

export default function HeroSection({
  photos,
  onPhotosChange,
  storageKey,
  isEditable = false,
}: HeroSectionProps) {
  return (
    <View style={styles.container}>
      {photos.length === 0 && (
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../../assets/favicon.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      )}
      <PhotoGallery
        images={photos}
        isEditable={isEditable}
        onImagesChange={onPhotosChange}
        storageKey={storageKey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 4,
    paddingHorizontal: 16,
    position: 'relative',
    backgroundColor: '#f5f5f5',
  },
  logoContainer: {
    width: '100%',
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  logoImage: {
    width: 80,
    height: 80,
  },
});

