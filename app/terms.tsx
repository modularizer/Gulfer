import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import DetailPageHeader from '@/components/common/DetailPageHeader';

export default function TermsPage() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <DetailPageHeader onBack={() => router.back()}>
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
          Terms of Service
        </Text>
      </DetailPageHeader>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
          This application is provided free of charge and may be used in any manner you choose, subject to the following terms:
        </Text>

        <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
          <Text style={styles.bold}>No Warranty:</Text> This application is provided "as is" without any warranties, express or implied. We make no representations or warranties regarding the accuracy, reliability, or availability of the application.
        </Text>

        <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
          <Text style={styles.bold}>Limitation of Liability:</Text> To the fullest extent permitted by law, we assume no liability for any damages, losses, or injuries arising from your use of this application, including but not limited to direct, indirect, incidental, or consequential damages.
        </Text>

        <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
          <Text style={styles.bold}>Use at Your Own Risk:</Text> You acknowledge that you use this application at your own risk and discretion.
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


