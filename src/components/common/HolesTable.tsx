import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import { Hole } from '../../types';
import NumberModal from './NumberModal';

interface HolesTableProps {
  holes: Hole[];
  onHoleUpdate: (hole: Hole) => void;
  onBack?: () => void;
  distanceUnit?: 'yd' | 'm';
  onDistanceUnitChange?: (unit: 'yd' | 'm') => void;
}

export default function HolesTable({
  holes,
  onHoleUpdate,
  onBack,
  distanceUnit = 'yd',
  onDistanceUnitChange,
}: HolesTableProps) {
  const theme = useTheme();
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    hole: Hole | null;
    field: 'par' | 'distance' | null;
  }>({ visible: false, hole: null, field: null });

  const formatDistance = (distance: number | undefined): string => {
    if (distance === undefined) return '?';
    
    if (distanceUnit === 'yd') {
      // Assume distance is stored in meters, convert to yards
      const yards = Math.round(distance * 1.09361);
      return `${yards}yd`;
    } else {
      // Show in meters
      return `${Math.round(distance)}m`;
    }
  };

  const toggleDistanceUnit = () => {
    if (onDistanceUnitChange) {
      onDistanceUnitChange(distanceUnit === 'yd' ? 'm' : 'yd');
    }
  };

  const openEditModal = (hole: Hole, field: 'par' | 'distance') => {
    setEditModal({ visible: true, hole, field });
  };

  const closeEditModal = () => {
    setEditModal({ visible: false, hole: null, field: null });
  };

  const handleSave = (value: number) => {
    if (editModal.hole && editModal.field) {
      const updatedHole: Hole = {
        ...editModal.hole,
        [editModal.field]: value,
      };
      onHoleUpdate(updatedHole);
      closeEditModal();
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* Fixed Header Row */}
      <View style={styles.fixedHeaderRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.headerRowContent}>
            <View style={[styles.cell, styles.headerCell, styles.holeHeaderCell]}>
              {onBack ? (
                <IconButton
                  icon="arrow-left"
                  size={20}
                  iconColor="#fff"
                  onPress={onBack}
                  style={styles.backIconButton}
                />
              ) : (
                <Text style={styles.headerText}>#</Text>
              )}
            </View>
            {onDistanceUnitChange ? (
              <TouchableOpacity
                style={[styles.cell, styles.headerCell, styles.distanceHeaderCell]}
                onPress={toggleDistanceUnit}
              >
                <Text style={styles.headerText}>Dist ({distanceUnit})</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.cell, styles.headerCell, styles.distanceHeaderCell]}>
                <Text style={styles.headerText}>Dist</Text>
              </View>
            )}
            <View style={[styles.cell, styles.headerCell, styles.parHeaderCell]}>
              <Text style={styles.headerText}>Par</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Scrollable Hole Rows */}
      <ScrollView style={styles.scrollableContent}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            {holes.map((hole) => (
              <View key={hole.number} style={styles.row}>
                <View style={[styles.cell, styles.holeCell]}>
                  <Text style={styles.holeText}>{hole.number}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.cell, styles.distanceCell]}
                  onPress={() => openEditModal(hole, 'distance')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.distanceText}>{formatDistance(hole.distance)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cell, styles.parCell]}
                  onPress={() => openEditModal(hole, 'par')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.parText}>
                    {hole.par !== undefined ? hole.par : '?'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Edit Modal */}
      <NumberModal
        visible={editModal.visible}
        title={
          editModal.hole && editModal.field
            ? `Hole ${editModal.hole.number} - ${editModal.field === 'par' ? 'Par' : 'Distance'}`
            : 'Edit Hole'
        }
        defaultValue={
          editModal.hole && editModal.field
            ? (editModal.hole[editModal.field] || 0)
            : 0
        }
        onSave={handleSave}
        onDismiss={closeEditModal}
        min={editModal.field === 'par' ? 3 : 0}
        max={editModal.field === 'par' ? 6 : 1000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  fixedHeaderRow: {
    backgroundColor: '#4CAF50',
    borderBottomWidth: 2,
    borderBottomColor: '#388e3c',
    zIndex: 10,
  },
  headerRowContent: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  scrollableContent: {
    flex: 1,
  },
  table: {
    padding: 8,
    paddingBottom: 0,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 36,
  },
  cell: {
    width: 100,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCell: {
    backgroundColor: '#4CAF50',
    minHeight: 36,
  },
  headerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  holeCell: {
    backgroundColor: '#f5f5f5',
    width: 40,
    minWidth: 40,
  },
  holeHeaderCell: {
    width: 40,
    minWidth: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIconButton: {
    margin: 0,
    padding: 0,
    width: 40,
    height: 40,
  },
  distanceHeaderCell: {
    width: 70,
    minWidth: 70,
  },
  distanceCell: {
    backgroundColor: '#f5f5f5',
    width: 70,
    minWidth: 70,
  },
  distanceText: {
    fontWeight: '500',
    fontSize: 12,
    color: '#666',
  },
  parHeaderCell: {
    width: 100,
    minWidth: 100,
  },
  parCell: {
    backgroundColor: '#f5f5f5',
    width: 100,
    minWidth: 100,
  },
  parText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  holeText: {
    fontWeight: '600',
    fontSize: 14,
  },
});

