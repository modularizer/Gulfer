import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { createSmoothHillPath, createLeftHillPath, createValleyPath, createRightHillPath, TOTAL_HEIGHT } from './hillPaths';

interface HillShapeProps {
  width: number;
  primaryColor: string;
  lighterGreen: string;
  darkerGreen: string;
}

export default function HillShape({ width, primaryColor, lighterGreen, darkerGreen }: HillShapeProps) {
  return (
    <>
      {/* Shadow layer - follows exact shape */}
      <Svg
        style={[StyleSheet.absoluteFill, { top: 3 }]}
        width={width}
        height={TOTAL_HEIGHT + 3}
        viewBox={`0 0 ${width} ${TOTAL_HEIGHT + 3}`}
      >
        <Path
          d={createSmoothHillPath(width)}
          fill="#000000"
          opacity={0.2}
        />
      </Svg>

      {/* Main hill shape with opacity following contours */}
      <Svg
        style={StyleSheet.absoluteFill}
        width={width}
        height={TOTAL_HEIGHT}
        viewBox={`0 0 ${width} ${TOTAL_HEIGHT}`}
      >
        <Defs>
          {/* Gradient for left hill - lighter at peak */}
          <LinearGradient id="leftHillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={lighterGreen} stopOpacity="1" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.9" />
          </LinearGradient>
          
          {/* Gradient for valley - darker in dip, following curve */}
          <LinearGradient id="valleyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={darkerGreen} stopOpacity="0.85" />
            <Stop offset="50%" stopColor={darkerGreen} stopOpacity="0.65" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.95" />
          </LinearGradient>
          
          {/* Gradient for right hill - lighter at peak */}
          <LinearGradient id="rightHillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={lighterGreen} stopOpacity="1" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.8" />
          </LinearGradient>
        </Defs>
        
        {/* Left hill - higher opacity at peak, following contour */}
        <Path
          d={createLeftHillPath(width)}
          fill="url(#leftHillGradient)"
        />
        
        {/* Valley - lower opacity in dip, following contour */}
        <Path
          d={createValleyPath(width)}
          fill="url(#valleyGradient)"
        />
        
        {/* Right hill - higher opacity at peak, following contour */}
        <Path
          d={createRightHillPath(width)}
          fill="url(#rightHillGradient)"
        />
      </Svg>
    </>
  );
}

