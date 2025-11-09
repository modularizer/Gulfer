import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedButtons, useTheme } from 'react-native-paper';
import { router } from 'expo-router';

interface SegmentedButtonsHeaderProps {
  currentValue: 'rounds' | 'courses' | 'players';
}

export default function SegmentedButtonsHeader({
  currentValue,
}: SegmentedButtonsHeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.outlineVariant,
        },
      ]}
    >
      <SegmentedButtons
        value={currentValue}
        onValueChange={(value) => {
          if (value === 'rounds') {
            router.push('/round/list');
          } else if (value === 'courses') {
            router.push('/course/list');
          } else if (value === 'players') {
            router.push('/player/list');
          }
        }}
        buttons={[
          {
            value: 'rounds',
            label: 'Rounds',
            icon: 'golf',
            style: styles.segmentedButton,
          },
          {
            value: 'courses',
            label: 'Courses',
            icon: 'map-marker',
            style: styles.segmentedButton,
          },
          {
            value: 'players',
            label: 'Players',
            icon: 'account-group',
            style: styles.segmentedButton,
          },
        ]}
        style={styles.segmentedButtons}
        density="regular"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  segmentedButtons: {
    margin: 0,
    borderRadius: 0,
    overflow: 'hidden',
  },
  segmentedButton: {
    borderRadius: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
});

