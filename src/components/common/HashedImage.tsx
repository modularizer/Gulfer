/**
 * Component to display images by hash
 * Automatically retrieves the image from storage
 */

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { getImageByHash } from '@/services/storage/imageStorage';

interface HashedImageProps {
  hash: string;
  style?: any;
  contentFit?: 'contain' | 'cover' | 'fill' | 'scale-down' | 'none';
  [key: string]: any; // Allow other Image props
}

export default function HashedImage({ hash, style, contentFit = 'contain', ...otherProps }: HashedImageProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);
        const uri = await getImageByHash(hash);
        if (mounted) {
          if (uri) {
            setImageUri(uri);
          } else {
            setError(true);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading image by hash:', err);
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    if (hash) {
      loadImage();
    } else {
      setLoading(false);
      setError(true);
    }

    return () => {
      mounted = false;
    };
  }, [hash]);

  if (loading) {
    return (
      <View style={[style, styles.loadingContainer]}>
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  if (error || !imageUri) {
    return (
      <View style={[style, styles.errorContainer]}>
        {/* Could add an error icon here */}
      </View>
    );
  }

  // Extract borderRadius from style if present, default to 16
  const borderRadius = (style as ViewStyle)?.borderRadius || 16;
  const maxHeight = (style as ViewStyle)?.maxHeight;
  
  // With contentFit="cover", the image fills the container
  // Container with borderRadius and overflow hidden will clip the image properly
  return (
    <View style={[{ borderRadius, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }, style]}>
      <Image
        source={{ uri: imageUri }}
        style={{ 
          width: '100%', 
          height: '100%', 
          borderRadius,
          maxHeight: maxHeight || undefined,
        }}
        contentFit={contentFit}
        {...otherProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  errorContainer: {
    backgroundColor: '#f0f0f0',
  },
});

