import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { IconButton, Surface, useTheme, Dialog, Portal, Button, Text } from 'react-native-paper';
import HashedImage from './HashedImage';
import { takePhoto, pickMultiplePhotos } from '../../services/photos/photoService';
import { getShadowStyle } from '../../utils';

const { width, height } = Dimensions.get('window');

export interface PhotoGalleryHandle {
  openAddPhotoMenu: () => void;
}

interface PhotoGalleryProps {
  images: string[]; // Array of image hashes
  isEditable?: boolean; // Whether to show camera and edit icons
  onImagesChange?: (images: string[]) => void; // Callback when images change
  storageKey?: string; // Optional storage key for saving state
}

const PhotoGallery = forwardRef<PhotoGalleryHandle, PhotoGalleryProps>(function PhotoGallery({
  images,
  isEditable = false,
  onImagesChange,
  storageKey,
}: PhotoGalleryProps, ref) {
  const theme = useTheme();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photoEditMode, setPhotoEditMode] = useState(false);
  const [photoMenuVisible, setPhotoMenuVisible] = useState(false);
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  
  const scrollViewRef = useRef<any>(null);
  const scrollPosition = useRef(0);
  const isScrolling = useRef(false);
  const isInitialized = useRef(false);

  // Initialize scroll position when images change
  useEffect(() => {
    if (images.length > 0 && scrollViewRef.current && !isInitialized.current) {
      const imageSize = width - 32;
      const timeoutId = setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            x: imageSize, // Start at first real image (after duplicate at start)
            animated: false,
          });
          isInitialized.current = true;
          setCurrentPhotoIndex(0);
        }
      }, 200);
      
      return () => clearTimeout(timeoutId);
    }
  }, [images.length]);

  const handleAddPhoto = useCallback(() => {
    if (!isEditable) return;
    setPhotoMenuVisible(true);
  }, [isEditable]);

  const handleTakePhoto = useCallback(async () => {
    setPhotoMenuVisible(false);
    try {
      const photo = await takePhoto();
      if (photo && onImagesChange) {
        onImagesChange([...images, photo.hash]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to take photo' });
    }
  }, [images, onImagesChange]);

  const handlePickPhotos = useCallback(async () => {
    setPhotoMenuVisible(false);
    try {
      const selectedPhotos = await pickMultiplePhotos();
      if (selectedPhotos.length > 0 && onImagesChange) {
        onImagesChange([...images, ...selectedPhotos.map(p => p.hash)]);
      }
    } catch (error) {
      console.error('Error picking photos:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to pick photos' });
    }
  }, [images, onImagesChange]);

  const handleRemovePhoto = useCallback((index: number) => {
    if (onImagesChange) {
      const newImages = images.filter((_, i) => i !== index);
      // Adjust currentPhotoIndex if needed
      if (newImages.length === 0) {
        setCurrentPhotoIndex(0);
        isInitialized.current = false;
      } else if (currentPhotoIndex >= newImages.length) {
        setCurrentPhotoIndex(Math.max(0, newImages.length - 1));
      } else if (currentPhotoIndex > index) {
        // If we removed a photo before the current one, adjust index
        setCurrentPhotoIndex(Math.max(0, currentPhotoIndex - 1));
      }
      // Reset initialization to reinitialize scroll position
      isInitialized.current = false;
      onImagesChange(newImages);
    }
  }, [images, currentPhotoIndex, onImagesChange]);

  // Reset initialization when images change externally
  useEffect(() => {
    isInitialized.current = false;
    scrollPosition.current = 0;
  }, [images]);

  useImperativeHandle(ref, () => ({
    openAddPhotoMenu: handleAddPhoto,
  }), [handleAddPhoto]);

  return (
    <View style={styles.container}>
      {images.length > 0 ? (
        <>
          <ScrollView 
            ref={scrollViewRef}
            horizontal 
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.photoGallery}
            contentContainerStyle={styles.photoGalleryContent}
            onScrollBeginDrag={() => {
              isScrolling.current = true;
            }}
            onScroll={(event) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const imageSize = width - 32; // Full width for paging
              const scrollIndex = Math.round(offsetX / imageSize);
              scrollPosition.current = offsetX;
              
              // Handle infinite scroll - map scroll position to actual image index
              if (images.length > 0 && isInitialized.current) {
                let actualIndex: number;
                
                // If we're at the duplicate image at the start (index 0)
                if (scrollIndex === 0) {
                  actualIndex = images.length - 1; // Last image
                }
                // If we're at the duplicate image at the end (index images.length + 1)
                else if (scrollIndex === images.length + 1) {
                  actualIndex = 0; // First image
                }
                // Normal images (1 to images.length)
                else {
                  actualIndex = scrollIndex - 1;
                }
                
                if (actualIndex >= 0 && actualIndex < images.length) {
                  setCurrentPhotoIndex(actualIndex);
                }
              }
            }}
            scrollEventThrottle={16}
            onScrollEndDrag={(event) => {
              // Handle infinite scroll on slow scrolls (no momentum)
              const offsetX = event.nativeEvent.contentOffset.x;
              const imageSize = width - 32;
              const scrollIndex = Math.round(offsetX / imageSize);
              
              if (images.length > 0 && scrollViewRef.current && isInitialized.current) {
                if (scrollIndex === 0) {
                  const jumpToIndex = images.length;
                  scrollViewRef.current.scrollTo({
                    x: jumpToIndex * imageSize,
                    animated: false,
                  });
                  setCurrentPhotoIndex(images.length - 1);
                } else if (scrollIndex === images.length + 1) {
                  const jumpToIndex = 1;
                  scrollViewRef.current.scrollTo({
                    x: jumpToIndex * imageSize,
                    animated: false,
                  });
                  setCurrentPhotoIndex(0);
                }
              }
            }}
            onMomentumScrollEnd={(event) => {
              isScrolling.current = false;
              const offsetX = event.nativeEvent.contentOffset.x;
              const imageSize = width - 32; // Full width for paging
              const scrollIndex = Math.round(offsetX / imageSize);
              
              // Handle infinite scroll - jump to real images if at duplicates
              if (images.length > 0 && scrollViewRef.current && isInitialized.current) {
                // If at the duplicate at the start (index 0), jump to the last real image
                if (scrollIndex === 0) {
                  const jumpToIndex = images.length; // Last real image (before duplicate at end)
                  scrollViewRef.current.scrollTo({
                    x: jumpToIndex * imageSize,
                    animated: false,
                  });
                  setCurrentPhotoIndex(images.length - 1);
                }
                // If at the duplicate at the end (index images.length + 1), jump to the first real image
                else if (scrollIndex === images.length + 1) {
                  const jumpToIndex = 1; // First real image (after duplicate at start)
                  scrollViewRef.current.scrollTo({
                    x: jumpToIndex * imageSize,
                    animated: false,
                  });
                  setCurrentPhotoIndex(0);
                }
                // Normal images (1 to images.length)
                else {
                  const actualIndex = scrollIndex - 1;
                  if (actualIndex >= 0 && actualIndex < images.length) {
                    setCurrentPhotoIndex(actualIndex);
                  }
                }
              }
            }}
            onLayout={() => {
              // Initialize scroll position to first real image (index 1, after duplicate)
              if (images.length > 0 && scrollViewRef.current && !isInitialized.current) {
                const imageSize = width - 32;
                setTimeout(() => {
                  if (scrollViewRef.current) {
                    scrollViewRef.current.scrollTo({
                      x: imageSize, // Start at first real image (after duplicate at start)
                      animated: false,
                    });
                    isInitialized.current = true;
                    setCurrentPhotoIndex(0);
                  }
                }, 50);
              }
            }}
          >
            {/* Duplicate last image at the start for infinite scroll */}
            {images.length > 0 && (
              <View key={`duplicate-start-${images.length - 1}`} style={styles.photoItem}>
                <HashedImage 
                  hash={images[images.length - 1]}
                  style={styles.heroImage} 
                  contentFit="cover"
                />
              </View>
            )}
            
            {/* Real images */}
            {images.map((hash, index) => (
              <View key={index} style={styles.photoItem}>
                <HashedImage 
                  hash={hash}
                  style={styles.heroImage} 
                  contentFit="cover"
                />
                {photoEditMode && isEditable && (
                  <TouchableOpacity
                    style={styles.removePhotoOverlay}
                    onPress={() => handleRemovePhoto(index)}
                  >
                    <IconButton
                      icon="close-circle"
                      size={28}
                      iconColor="#fff"
                      style={styles.removePhotoButton}
                    />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            
            {/* Duplicate first image at the end for infinite scroll */}
            {images.length > 0 && (
              <View key={`duplicate-end-0`} style={styles.photoItem}>
                <HashedImage 
                  hash={images[0]}
                  style={styles.heroImage} 
                  contentFit="cover"
                />
              </View>
            )}
          </ScrollView>
          
          {/* Edit button - only show if editable */}
          {isEditable && (
            <View style={styles.photoGalleryHeader}>
              <IconButton
                icon={photoEditMode ? "check" : "pencil"}
                size={20}
                iconColor={theme.colors.onSurface}
                onPress={() => setPhotoEditMode(!photoEditMode)}
                style={styles.editButton}
              />
            </View>
          )}
          
          {/* Pagination dots - only show if more than one image */}
          {images.length > 1 && (
            <View style={styles.paginationDots}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    currentPhotoIndex === index && [
                      styles.paginationDotActive,
                      { backgroundColor: theme.colors.primary },
                    ],
                  ]}
                />
              ))}
            </View>
          )}
        </>
      ) : null}
      
      {/* Camera Icon Overlay - only show if editable */}
      {isEditable && (
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={handleAddPhoto}
          activeOpacity={0.8}
        >
          <Surface style={[
            styles.cameraButtonSurface, 
            { backgroundColor: theme.colors.primary },
            getShadowStyle(4),
          ]}>
            <IconButton
              icon="camera"
              size={24}
              iconColor="#fff"
              style={styles.cameraIcon}
              onPress={(e) => {
                e.stopPropagation();
                handleAddPhoto();
              }}
            />
          </Surface>
        </TouchableOpacity>
      )}

      {/* Photo Selection Dialog */}
      <Portal>
        <Dialog
          visible={photoMenuVisible}
          onDismiss={() => setPhotoMenuVisible(false)}
        >
          <Dialog.Title>Add Photo</Dialog.Title>
          <Dialog.Content>
            <Text>Choose how you want to add a photo</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={handleTakePhoto}
              icon="camera"
              mode="contained"
              style={styles.photoDialogButton}
            >
              Take Photo
            </Button>
            <Button
              onPress={handlePickPhotos}
              icon="image-multiple"
              mode="contained"
              style={styles.photoDialogButton}
            >
              Select from Gallery
            </Button>
            <Button
              onPress={() => setPhotoMenuVisible(false)}
            >
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Error Dialog */}
      <Portal>
        <Dialog
          visible={errorDialog.visible}
          onDismiss={() => setErrorDialog({ visible: false, title: '', message: '' })}
        >
          <Dialog.Title>{errorDialog.title}</Dialog.Title>
          <Dialog.Content>
            <Text>{errorDialog.message}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setErrorDialog({ visible: false, title: '', message: '' })}>
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
});

export default PhotoGallery;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  photoGallery: {
    width: '100%',
  },
  photoGalleryContent: {
    alignItems: 'center',
  },
  photoItem: {
    width: width - 32, // Full width for paging - one image per page
    height: Math.min(width - 32, height * 0.25), // Square height limited by old height
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: Math.min(width - 32, height * 0.25), // Square width
    height: Math.min(width - 32, height * 0.25), // Square height
    borderRadius: 16,
  },
  photoGalleryHeader: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 20,
  },
  editButton: {
    margin: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  paginationDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 10,
  },
  cameraButtonSurface: {
    borderRadius: 28,
  },
  cameraIcon: {
    margin: 0,
  },
  removePhotoOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  removePhotoButton: {
    margin: 0,
  },
  photoDialogButton: {
    marginHorizontal: 4,
  },
});

