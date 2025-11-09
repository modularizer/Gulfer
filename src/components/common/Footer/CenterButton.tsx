import React from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { FAB } from 'react-native-paper';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

interface CenterButtonProps {
  onPress: () => void;
  primaryColor: string;
  backgroundColor: string;
  lighterGreen: string;
  buttonSize: number;
  buttonOffset: number;
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
  arrowEmoji: {
    fontSize: 44,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 48,
    includeFontPadding: false,
  },
});

export default function CenterButton({
  onPress,
  primaryColor,
  backgroundColor,
  lighterGreen,
  buttonSize,
  buttonOffset,
}: CenterButtonProps) {
  const containerWidth = buttonSize * 1.4 + 20;
  const containerHeight = buttonSize * 0.7 + 20;
  const buttonWidth = buttonSize * 1.4;
  const buttonHeight = buttonSize * 0.7;

  return (
    <View
      style={[
        styles.container,
        {
          top: -((buttonSize * 0.7) / 2) + buttonOffset,
          left: '50%',
          marginLeft: -(containerWidth / 2),
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
      
      <FAB
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
        color={primaryColor}
        size="large"
        icon={() => (
          <Text style={[styles.arrowEmoji, { color: primaryColor }]}>↗</Text>
        )}
      />
    </View>
  );
}

