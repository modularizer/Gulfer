import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { HoleStatistics } from '../../services/holeStatistics';

interface GStatsCellProps {
  stats: HoleStatistics | null | undefined;
  variant?: 'default' | 'total';
}

/**
 * Shared component for displaying G-Stats (Golf Statistics) in a cell
 * Shows: worst · p25 · p50 · p75 · best
 * 
 * For golf: lower scores are better, so percentiles are inverted:
 * - 25th percentile = 25% of scores are HIGHER/worse than this
 * - 75th percentile = 75% of scores are HIGHER/worse than this
 */
export default function GStatsCell({ stats, variant = 'default' }: GStatsCellProps) {
  if (!stats || stats.worst === null || stats.p25 === null || stats.p50 === null || stats.p75 === null || stats.best === null) {
    return <Text style={variant === 'total' ? styles.gStatTextTotal : styles.gStatText}>—</Text>;
  }

  const worst = Math.round(stats.worst);
  const p25 = Math.round(stats.p25);
  const p50 = Math.round(stats.p50);
  const p75 = Math.round(stats.p75);
  const best = Math.round(stats.best);

  if (variant === 'total') {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline' }}>
        <Text style={styles.gStatTextTotal}>{worst}·</Text>
        <Text style={styles.gStatTextInnerTotal}>{p25}·</Text>
        <Text style={styles.gStatTextMiddleTotal}>{p50}</Text>
        <Text style={styles.gStatTextInnerTotal}>·{p75}·</Text>
        <Text style={styles.gStatTextTotal}>{best}</Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline' }}>
      <Text style={styles.gStatText}>{worst}·</Text>
      <Text style={styles.gStatTextInner}>{p25}·</Text>
      <Text style={styles.gStatTextMiddle}>{p50}</Text>
      <Text style={styles.gStatTextInner}>·{p75}·</Text>
      <Text style={styles.gStatText}>{best}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gStatText: {
    fontWeight: '500',
    fontSize: 9,
    color: '#666',
  },
  gStatTextMiddle: {
    fontWeight: '600',
    fontSize: 18,
    color: '#333',
  },
  gStatTextInner: {
    fontWeight: '500',
    fontSize: 13,
    color: '#666',
  },
  gStatTextTotal: {
    fontWeight: '500',
    fontSize: 7,
    color: '#666',
  },
  gStatTextMiddleTotal: {
    fontWeight: '600',
    fontSize: 14,
    color: '#333',
  },
  gStatTextInnerTotal: {
    fontWeight: '500',
    fontSize: 10,
    color: '#666',
  },
});

