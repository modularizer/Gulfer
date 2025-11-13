import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { IconButton, useTheme as usePaperTheme } from 'react-native-paper';
import { useTheme } from '@/theme';
import HillShape from './HillShape';
import CenterButton from './CenterButton';
import { TOTAL_HEIGHT } from './hillPaths';

// Visualization constants
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = 110; // Same size on all platforms
const BUTTON_OFFSET = 12;

interface HillFooterProps {
  onHistoryPress: () => void;
  onNewRoundPress: () => void;
  onProfilePress: () => void;
  showCenterButton?: boolean;
  centerButtonLabel?: string;
}

export default function HillFooter({
  onHistoryPress,
  onNewRoundPress,
  onProfilePress,
  showCenterButton = true,
  centerButtonLabel = 'Start Round',
}: HillFooterProps) {
  const paperTheme = usePaperTheme();
  const { isDark } = useTheme();
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH);

  const primaryColor = paperTheme.colors.primary;
  const lighterGreen = isDark ? '#006d35' : '#006d35';
  const darkerGreen = isDark ? '#002d12' : '#002d12';
  const backgroundColor = paperTheme.colors.background;
  
  // Use container width on web, screen width on native
  const hillWidth = Platform.OS === 'web' ? containerWidth : SCREEN_WIDTH;
  
  return (
    <View 
      style={[styles.container, { backgroundColor: 'transparent' }]}
      onLayout={(event) => {
        const { width } = event.nativeEvent.layout;
        if (width > 0) {
          setContainerWidth(width);
        }
      }}
    >
      <HillShape
        width={hillWidth}
        primaryColor={primaryColor}
        lighterGreen={lighterGreen}
        darkerGreen={darkerGreen}
      />

      <View style={styles.content}>
        <View style={styles.leftButtonContainer}>
          <IconButton
            icon="format-list-bulleted"
            iconColor="#ffffff"
            size={28}
            onPress={onHistoryPress}
            style={styles.iconButton}
          />
        </View>
        
        {showCenterButton && (
          <CenterButton
            onPress={onNewRoundPress}
            primaryColor={primaryColor}
            backgroundColor={backgroundColor}
            lighterGreen={lighterGreen}
            buttonSize={BUTTON_SIZE}
            buttonOffset={BUTTON_OFFSET}
            containerWidth={containerWidth}
            label={centerButtonLabel}
          />
        )}

        <View style={styles.rightButtonContainer}>
          <IconButton
            icon="account"
            iconColor="#ffffff"
            size={28}
            onPress={onProfilePress}
            style={styles.iconButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: TOTAL_HEIGHT,
      marginTop: -32,
    width: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 4,
    paddingHorizontal: 24,
    height: TOTAL_HEIGHT,
    zIndex: 10,
    backgroundColor: 'transparent',
    position: 'relative', // Ensure absolute positioning works correctly
  },
  leftButtonContainer: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 16,
    marginTop: 24,
  },
  rightButtonContainer: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 16,
    marginTop: 24,
  },
  iconButton: {
    margin: 0,
    backgroundColor: 'transparent',
  },
});

