/**
 * Shared Hero Section Component
 * Photo gallery section with fallback logo
 */

import React, { useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import PhotoGallery, { PhotoGalleryHandle } from './PhotoGallery';

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
  const galleryRef = useRef<PhotoGalleryHandle>(null);

  const handlePlaceholderPress = useCallback(() => {
    if (!isEditable) return;
    galleryRef.current?.openAddPhotoMenu();
  }, [isEditable]);

  return (
    <View style={styles.container}>
      {photos.length === 0 && (
        <TouchableOpacity
          style={styles.logoContainer}
          activeOpacity={isEditable ? 0.7 : 1}
          onPress={handlePlaceholderPress}
          disabled={!isEditable}
        >
          <Image 
            source={require('../../../assets/favicon.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
      <PhotoGallery
        ref={galleryRef}
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

