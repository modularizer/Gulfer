/**
 * Shared styles for card components (RoundCard, CourseCard, PlayerCard)
 */

import { StyleSheet } from 'react-native';

export const sharedCardStyles = StyleSheet.create({
  card: {
    marginBottom: 8,
  },
  header: {
    marginBottom: 8,
  },
  playersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoNotesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
    flexShrink: 0,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  // Text styles
  date: {
    fontSize: 14,
    fontWeight: '600',
  },
  boldText: {
    fontWeight: 'bold',
  },
  normalText: {
    fontWeight: 'normal',
    fontSize: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
});

