/**
 * Photo service for attaching photos to rounds
 * Uses Expo Image Picker and stores images by hash for deduplication
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { storeImage } from '../storage/photoStorage';

export interface PhotoResult {
  hash: string; // Image hash instead of URI
  width: number;
  height: number;
}

/**
 * Request camera permissions
 */
export async function requestCameraPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Request media library permissions
 */
export async function requestMediaLibraryPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Take a photo using the camera
 */
export async function takePhoto(): Promise<PhotoResult | null> {
  try {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) {
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      // Compress and resize image to reduce storage size
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1200 } }], // Max width 1200px
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      // Store image by hash (deduplication)
      const stored = await storeImage(manipulated.uri);
      if (!stored) {
        return null;
      }
      
      return {
        hash: stored.hash,
        width: manipulated.width,
        height: manipulated.height,
      };
    }

    return null;
  } catch (error) {
    console.error('Error taking photo:', error);
    return null;
  }
}

/**
 * Pick a photo from the media library
 */
export async function pickPhoto(): Promise<PhotoResult | null> {
  try {
    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) {
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      // Compress and resize image to reduce storage size
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1200 } }], // Max width 1200px
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      // Store image by hash (deduplication)
      const stored = await storeImage(manipulated.uri);
      if (!stored) {
        return null;
      }
      
      return {
        hash: stored.hash,
        width: manipulated.width,
        height: manipulated.height,
      };
    }

    return null;
  } catch (error) {
    console.error('Error picking photo:', error);
    return null;
  }
}

/**
 * Pick multiple photos from the media library
 */
export async function pickMultiplePhotos(): Promise<PhotoResult[]> {
  try {
    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) {
      return [];
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      // Compress and resize all selected images
      const compressedPhotos = await Promise.all(
        result.assets.map(async (asset) => {
          const manipulated = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 1200 } }], // Max width 1200px
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          
          // Store image by hash (deduplication)
          const stored = await storeImage(manipulated.uri);
          if (!stored) {
            return null;
          }
          
          return {
            hash: stored.hash,
            width: manipulated.width,
            height: manipulated.height,
          };
        })
      );
      // Filter out any null results (failed to store)
      return compressedPhotos.filter((photo): photo is PhotoResult => photo !== null);
    }

    return [];
  } catch (error) {
    console.error('Error picking photos:', error);
    return [];
  }
}

