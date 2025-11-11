import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { getAllUsers } from '@/services/storage/userStorage';
import { encodeNameForUrl } from '@/utils/urlEncoding';
import DetailPageHeader from '@/components/common/DetailPageHeader';

export default function AboutPage() {
  const theme = useTheme();

  const handleGitHubPress = () => {
    const githubUrl = 'https://github.com/modularizer/Gulfer/';
    Linking.openURL(githubUrl).catch((err) => {
      console.error('Error opening GitHub:', err);
    });
  };

  const handleLiveSitePress = () => {
    const liveUrl = 'https://modularizer.github.io/Gulfer/';
    Linking.openURL(liveUrl).catch((err) => {
      console.error('Error opening live site:', err);
    });
  };

  const handleBackPress = useCallback(async () => {
    try {
      const users = await getAllUsers();
      const currentUser = users.find(u => u.isCurrentUser);
      if (currentUser) {
        // Navigate to player page using encoded name
        router.push(`/player/${encodeNameForUrl(currentUser.name)}/overview`);
      } else {
        // No user set, navigate to /you page to set it
        router.push('/player/me');
      }
    } catch (error) {
      console.error('Error navigating to profile:', error);
      router.push('/player/me');
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <DetailPageHeader onBack={handleBackPress}>
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
          About
        </Text>
      </DetailPageHeader>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="bodyLarge" style={[styles.description, { color: theme.colors.onBackground }]}>
          A simple offline scorecard app for golf and disc-golf meant to <Text style={styles.bold}>minimize time spent on your phone </Text> at the course
        </Text>

        <View style={styles.section}>


          <View style={styles.bulletList}>
            <Text variant="bodyMedium" style={[styles.bulletItem, { color: theme.colors.onBackground }]}>
              <Text style={styles.bold}>• Anonymous:</Text> no login, no account, no emails, no ads, no internet
            </Text>
            
            <Text variant="bodyMedium" style={[styles.bulletItem, { color: theme.colors.onBackground }]}>
              <Text style={styles.bold}>• Offline:</Text> play in the wilderness!
            </Text>
            
            <Text variant="bodyMedium" style={[styles.bulletItem, { color: theme.colors.onBackground }]}>
              <Text style={styles.bold}>• Fully Free:</Text> no account needed, no premium features, no limits
            </Text>
            
            <Text variant="bodyMedium" style={[styles.bulletItem, { color: theme.colors.onBackground }]}>
              <Text style={styles.bold}>• Fast:</Text> add scores for the hole in {'<'}5 seconds: with one tap and hit one digit per player (if you score over a 9, we'll be nice and cap at 9)
            </Text>
            
            <Text variant="bodyMedium" style={[styles.bulletItem, { color: theme.colors.onBackground }]}>
              <Text style={styles.bold}>• Simple:</Text> no social media, no infinite stats, no reviews
            </Text>
            
            <Text variant="bodyMedium" style={[styles.bulletItem, { color: theme.colors.onBackground }]}>
              <Text style={styles.bold}>• Concise:</Text> see the full scorecard for the round all on one screen, minimizing clicks and screen time
            </Text>
            
            <Text variant="bodyMedium" style={[styles.bulletItem, { color: theme.colors.onBackground }]}>
              <Text style={styles.bold}>• Multiplayer:</Text> not everyone needs to record the game. one person can take charge and record for everyone, then export the round for friends to import into their apps
            </Text>
            
            <Text variant="bodyMedium" style={[styles.bulletItem, { color: theme.colors.onBackground }]}>
              <Text style={styles.bold}>• Built for Memories:</Text> store photos and notes for each player, round, and course, if you wish
            </Text>
            
            <Text variant="bodyMedium" style={[styles.bulletItem, { color: theme.colors.onBackground }]}>
              <Text style={styles.bold}>• Personal Stats:</Text> See personal bests and averages on each hole, see the avg and best stats for everyone you have played with
            </Text>
            
            <Text variant="bodyMedium" style={[styles.bulletItem, { color: theme.colors.onBackground }]}>
              <Text style={styles.bold}>• Open-Source:</Text> Like coding? Take this project and run with it. It is free to use as you please.
            </Text>
            
            <Text variant="bodyMedium" style={[styles.bulletItem, { color: theme.colors.onBackground }]}>
              <Text style={styles.bold}>• App-Ready:</Text> While I haven't published on Google Play or App Store yet, it is cross-platform React Native, and pretty much ready to be built into an app
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="bodyMedium" style={[styles.paragraph, { color: theme.colors.onBackground }]}>
            To learn more about this app, check out the GitHub repository:
          </Text>

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
  description: {
    marginBottom: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  linkContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  link: {
    textDecorationLine: 'underline',
  },
  section: {
    marginBottom: 32,
    alignItems: 'center',
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  paragraph: {
    marginBottom: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  bold: {
    fontWeight: '600',
  },
  bulletList: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  bulletItem: {
    marginBottom: 12,
    lineHeight: 22,
  },
  githubButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  urlText: {
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});

