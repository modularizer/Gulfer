import React from 'react';
import { View, StyleSheet, ScrollView, Linking, Platform } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import DetailPageHeader from '@/components/common/DetailPageHeader';

export default function ContactUsPage() {
  const theme = useTheme();

  const handleEmailPress = () => {
    const email = 'modularizer@gmail.com';
    const subject = encodeURIComponent('Gulfer App Contact');
    const mailtoUrl = `mailto:${email}?subject=${subject}`;
    
    Linking.openURL(mailtoUrl).catch((err) => {
      console.error('Error opening email:', err);
    });
  };

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
          Contact Us
        </Text>
      </DetailPageHeader>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
          We'd love to hear from you! If you have questions, feedback, or need support, please reach out using one of the options below.
        </Text>

        <View style={styles.section}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            Email
          </Text>
          <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
            Send us an email at:
          </Text>
          <Button
            mode="text"
            onPress={handleEmailPress}
            textColor={theme.colors.primary}
            style={styles.linkButton}
            icon="email"
          >
            modularizer@gmail.com
          </Button>
        </View>

        <View style={styles.section}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            Bug Reports & Feature Requests
          </Text>
          <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
            Found a bug or have an idea for a new feature? Submit an issue on GitHub:
          </Text>
          <Button
            mode="text"
            onPress={handleGitHubPress}
            textColor={theme.colors.primary}
            style={styles.linkButton}
            icon="github"
          >
            GitHub Issues
          </Button>
          <Text variant="bodySmall" style={[styles.urlText, { color: theme.colors.onSurfaceVariant }]}>
            https://github.com/modularizer/Gulfer/
          </Text>
        </View>
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  linkButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 8,
  },
  urlText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'monospace',
    marginTop: 4,
  },
});



