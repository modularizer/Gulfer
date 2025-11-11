import React from 'react';
import { View, StyleSheet, Image, Platform, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Ellipse, Path, Text, TextPath } from 'react-native-svg';
import { useTheme } from 'react-native-paper';

interface CenterButtonProps {
  onPress: () => void;
  primaryColor: string;
  backgroundColor: string;
  lighterGreen: string;
  buttonSize: number;
  buttonOffset: number;
  containerWidth?: number;
  label?: string;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 20,
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  fabSvg: {
    position: 'absolute',
    overflow: 'visible',
  },
  fabBase: {
    elevation: 0,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
    marginTop: -3,
    padding: 0,
    backgroundColor: 'transparent',
  },
  faviconImage: {
    width: 119, // 1.5x the width (72 * 1.5) * 1.1 (10% larger)
    height: 57, // 1.25x the height (42 * 1.25) * 1.1 (10% larger)
    resizeMode: 'contain',
    transform: [
      { translateY: -1 }, // Move up (moved up by 2px more)
      { rotate: '8deg' }, // Tilt right (clockwise)
    ],
  },
});

export default function CenterButton({
  onPress,
  primaryColor,
  backgroundColor,
  lighterGreen,
  buttonSize,
  buttonOffset,
  containerWidth: footerContainerWidth,
  label = 'Start Round',
}: CenterButtonProps) {
  const theme = useTheme();
  const containerWidth = buttonSize * 1.4 + 20;
  const containerHeight = buttonSize * 0.7 + 20;
  const buttonWidth = buttonSize * 1.4;
  const buttonHeight = buttonSize * 0.7;
  
  // Calculate center position based on footer container width (or screen width as fallback)
  // This ensures proper centering on large desktop screens where the app container is constrained
  const widthForCentering = footerContainerWidth ?? Dimensions.get('window').width;
  const centerPosition = (widthForCentering / 2) - (containerWidth / 2);

  // Calculate ellipse parameters for curved text path
  // Use smaller radius for tighter text curve
  const textRx = (buttonSize / 2) * 0.75; // 25% smaller radius for tighter arc
  const textRy = (buttonHeight / 2) * 0.75; // 25% smaller radius for tighter arc
  const cx = buttonWidth / 2;
  const cy = buttonHeight / 2;
  
  // Create a path along the top arc of the ellipse
  // Path goes from left to right along the top arc (symmetric for centering)
  const startAngle = Math.PI; // 180 degrees (left side)
  const endAngle = 0; // 0 degrees (right side)
  
  // Calculate points along the top arc for smooth curve
  const numPoints = 100;
  const pathPoints: string[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / numPoints);
    const x = cx + textRx * Math.cos(angle);
    const y = cy + textRy * Math.sin(angle);
    if (i === 0) {
      pathPoints.push(`M ${x} ${y}`);
    } else {
      pathPoints.push(`L ${x} ${y}`);
    }
  }
  const textPath = pathPoints.join(' ');
  
  // Offset the text above the button - adjusted to compensate for smaller radius
  const textOffsetY = 1; // Distance above the button (moved down 4px)
  const textOffsetX = -1; // Move left by 1px

  return (
    <View
      style={[
        styles.container,
        {
          top: -((buttonSize * 0.7) / 2) + buttonOffset,
          left: centerPosition,
          width: containerWidth,
          height: containerHeight,
        },
      ]}
    >
      {/* Subtle gray shadow - fades to nothing */}
      <Svg
        width={containerWidth}
        height={containerHeight}
        style={[styles.fabSvg, { top: -10, left: -10 }]}
      >
        <Defs>
          <RadialGradient id="shadowGradient" cx="50%" cy="50%" r="60%">
            <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <Stop offset="60%" stopColor="#000000" stopOpacity="0.1" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={containerWidth / 2}
          cy={containerHeight / 2}
          rx={(buttonSize / 2) + 10}
          ry={((buttonSize * 0.7) / 2) + 10}
          fill="url(#shadowGradient)"
        />
      </Svg>
      
      {/* Main button - background color with green edges */}
      <Svg
        width={buttonWidth}
        height={buttonHeight}
        style={styles.fabSvg}
      >
        <Defs>
          <RadialGradient id="buttonGradient" cx="50%" cy="50%" r="100%">
            <Stop offset="0%" stopColor={backgroundColor} stopOpacity="1" />
            <Stop offset="40%" stopColor={backgroundColor} stopOpacity="1" />
            <Stop offset="60%" stopColor={lighterGreen} stopOpacity="0.5" />
            <Stop offset="80%" stopColor={primaryColor} stopOpacity="0.9" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={buttonWidth / 2}
          cy={buttonHeight / 2}
          rx={buttonSize / 2}
          ry={buttonHeight / 2}
          fill="url(#buttonGradient)"
        />
      </Svg>
      
      {/* Curved text along the top of the button */}
      {label && (
        <Svg
          width={buttonWidth}
          height={buttonHeight + 30}
          style={[styles.fabSvg, { top: textOffsetY, left: textOffsetX }]}
        >
          <Defs>
            <Path id="textPath" d={textPath} />
          </Defs>
          <Text
            fill={theme.colors.onSurface}
            fontSize="14"
            fontWeight="600"
            textAnchor="middle"
            letterSpacing="1"
          >
            <TextPath href="#textPath" startOffset="50%">
              {label}
            </TextPath>
          </Text>
        </Svg>
      )}
      
      <TouchableOpacity
        style={[
          styles.fabBase,
          Platform.OS === 'web' 
            ? ({ boxShadow: 'none' } as any)
            : {
                shadowColor: 'transparent',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0,
                shadowRadius: 0,
              },
          {
            width: buttonWidth,
            height: buttonHeight,
            borderRadius: buttonSize / 2,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Image 
          source={require('../../../../assets/favicon.png')}
          style={styles.faviconImage}
        />
      </TouchableOpacity>
    </View>
  );
}

