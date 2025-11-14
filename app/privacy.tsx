import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import DetailPageHeader from '@/components/common/DetailPageHeader';

export default function PrivacyPage() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <DetailPageHeader onBack={() => router.back()}>
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
          Privacy Policy
        </Text>
      </DetailPageHeader>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
          This application operates entirely offline and does not collect, transmit, or store any personal data on external servers.
        </Text>

        <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
          <Text style={styles.bold}>Local Storage Only:</Text> All data you enter, including scores, courses, players, and photos, is stored exclusively on your device using local storage mechanisms. No data leaves your device.
        </Text>

        <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
          <Text style={styles.bold}>No Data Collection:</Text> We do not collect, access, or transmit any information about your usage of this application. There is no analytics, telemetry, tracking, or monitoring of any kind.
        </Text>

        <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
          <Text style={styles.bold}>No Third-Party Services:</Text> This application does not integrate with any third-party services that would collect or transmit your data.
        </Text>

        <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
          <Text style={styles.bold}>Your Data, Your Control:</Text> You have complete control over your data. You may delete the application at any time, which will remove all locally stored data from your device.
        </Text>

        <Text variant="bodySmall" style={[styles.lastUpdated, { color: theme.colors.onSurfaceVariant }]}>
          Last updated: {new Date().toLocaleDateString()}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 32,
  },
  paragraph: {
    marginBottom: 16,
    lineHeight: 24,
  },
  bold: {
    fontWeight: '600',
  },
  lastUpdated: {
    marginTop: 8,
    fontStyle: 'italic',
  },
});



