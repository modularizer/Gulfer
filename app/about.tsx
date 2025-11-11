import React from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import DetailPageHeader from '@/components/common/DetailPageHeader';

export default function AboutPage() {
  const theme = useTheme();

  const handleGitHubPress = () => {
    const githubUrl = 'https://github.com/modularizer/Gulfer/';
    Linking.openURL(githubUrl).catch((err) => {
      console.error('Error opening GitHub:', err);
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <DetailPageHeader onBack={() => router.back()}>
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
          About
        </Text>
      </DetailPageHeader>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
          To learn more about this app, check out the GitHub repository:
        </Text>

        <Button
          mode="contained"
          onPress={handleGitHubPress}
          style={styles.githubButton}
          icon="github"
        >
          View on GitHub
        </Button>

        <Text variant="bodySmall" style={[styles.urlText, { color: theme.colors.onSurfaceVariant }]}>
          https://github.com/modularizer/Gulfer/
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
    alignItems: 'center',
  },
  paragraph: {
    marginBottom: 24,
    lineHeight: 24,
    textAlign: 'center',
  },
  githubButton: {
    marginBottom: 16,
  },
  urlText: {
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});

