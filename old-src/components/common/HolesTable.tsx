import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import NumberModal from './NumberModal';
import GStatsCell from './GStatsCell';
import { computeAllHoleStatistics, HoleStatistics } from '@/services/holeStatistics';
import { scorecardTableStyles } from '@/styles/scorecardTableStyles';
import type { Hole } from '@/services/storage/db/types';

interface HolesTableProps {
  holes: Hole[];
  onHoleUpdate: (hole: Hole) => void;
  onBack?: () => void;
  distanceUnit?: 'yd' | 'm';
  onDistanceUnitChange?: (unit: 'yd' | 'm') => void;
  courseId?: string;
  showGStats?: boolean;
}

export default function HolesTable({
  holes,
  onHoleUpdate,
  onBack,
  distanceUnit = 'yd',
  onDistanceUnitChange,
  courseId,
  showGStats = false,
}: HolesTableProps) {
  const theme = useTheme();
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    hole: Hole | null;
    field: 'par' | 'distance' | null;
  }>({ visible: false, hole: null, field: null });
  const [holeStatistics, setHoleStatistics] = useState<Map<number, HoleStatistics>>(new Map());

  // Compute hole statistics (G-Stats per hole) if courseId is provided and showGStats is true
  useEffect(() => {
    const computeStats = async () => {
      if (showGStats && courseId && holes.length > 0) {
        try {
          const holeNumbers = holes.map(h => h.number);
          const stats = await computeAllHoleStatistics(courseId, holeNumbers);
          setHoleStatistics(stats);
        } catch (error) {
          console.error('Error computing hole statistics:', error);
          setHoleStatistics(new Map());
        }
      } else {
        setHoleStatistics(new Map());
      }
    };
    computeStats();
  }, [showGStats, courseId, holes]);

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
    <View style={scorecardTableStyles.wrapper}>
      {/* Fixed Header Row */}
      <View style={scorecardTableStyles.fixedHeaderRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={scorecardTableStyles.headerRowContent}>
            <View style={[scorecardTableStyles.cell, scorecardTableStyles.headerCell, scorecardTableStyles.holeHeaderCell]}>
              {onBack ? (
                <IconButton
                  icon="arrow-left"
                  size={20}
                  iconColor="#fff"
                  onPress={onBack}
                  style={scorecardTableStyles.backIconButton}
                />
              ) : (
                <Text style={scorecardTableStyles.headerText}>#</Text>
              )}
            </View>
            {showGStats && (
              <View style={[scorecardTableStyles.cell, scorecardTableStyles.headerCell, scorecardTableStyles.gStatsHeaderCell]}>
                <Text style={scorecardTableStyles.gStatHeaderText}>G-Stats</Text>
              </View>
            )}
            {onDistanceUnitChange ? (
              <TouchableOpacity
                style={[scorecardTableStyles.cell, scorecardTableStyles.headerCell, scorecardTableStyles.distanceHeaderCell]}
                onPress={toggleDistanceUnit}
              >
                <Text style={scorecardTableStyles.headerText}>Dist ({distanceUnit})</Text>
              </TouchableOpacity>
            ) : (
              <View style={[scorecardTableStyles.cell, scorecardTableStyles.headerCell, scorecardTableStyles.distanceHeaderCell]}>
                <Text style={scorecardTableStyles.headerText}>Dist</Text>
              </View>
            )}
            <View style={[scorecardTableStyles.cell, scorecardTableStyles.headerCell, scorecardTableStyles.parHeaderCell]}>
              <Text style={scorecardTableStyles.headerText}>Par</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Scrollable Hole Rows */}
      <ScrollView style={scorecardTableStyles.scrollableContent}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={scorecardTableStyles.table}>
            {holes.map((hole) => (
              <View key={hole.number} style={scorecardTableStyles.row}>
                <View style={[scorecardTableStyles.cell, scorecardTableStyles.holeCell]}>
                  <Text style={scorecardTableStyles.holeText}>{hole.number}</Text>
                </View>
                {showGStats && (
                  <View style={[scorecardTableStyles.cell, scorecardTableStyles.gStatsCell]}>
                    <GStatsCell stats={holeStatistics.get(hole.number)} />
                  </View>
                )}
                <TouchableOpacity
                  style={[scorecardTableStyles.cell, scorecardTableStyles.distanceCell]}
                  onPress={() => openEditModal(hole, 'distance')}
                  activeOpacity={0.7}
                >
                  <Text style={scorecardTableStyles.distanceText}>{formatDistance(hole.distance)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[scorecardTableStyles.cell, scorecardTableStyles.parCell]}
                  onPress={() => openEditModal(hole, 'par')}
                  activeOpacity={0.7}
                >
                  <Text style={scorecardTableStyles.parText}>
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

