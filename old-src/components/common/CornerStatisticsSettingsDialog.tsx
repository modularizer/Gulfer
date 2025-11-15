import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Dialog, Portal, Text, useTheme, Chip, Switch } from 'react-native-paper';
import { CornerStatisticsConfig, CornerConfig } from '@/services/cornerStatistics';
import { ColumnVisibilityConfig } from '@/services/storage/cornerConfigStorage';
import CornerStatisticConfigModal from './CornerStatisticConfigModal';
import { useDialogStyle } from '@/hooks/useDialogStyle';
import type { Player } from '@/services/storage/db/types';

interface CornerStatisticsSettingsDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onSave: (config: CornerStatisticsConfig) => void;
  onColumnVisibilitySave?: (config: ColumnVisibilityConfig) => void;
  initialConfig?: CornerStatisticsConfig | null;
  initialColumnVisibility?: ColumnVisibilityConfig | null;
  courseName?: string;
  currentRoundPlayers?: Player[];
  currentRoundDate?: number; // Timestamp of the current round being viewed (to exclude rounds that started at the same time or after)
}

type CornerPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const CORNER_LABELS: Record<CornerPosition, string> = {
  topLeft: 'Top Left',
  topRight: 'Top Right',
  bottomLeft: 'Bottom Left',
  bottomRight: 'Bottom Right',
};

export default function CornerStatisticsSettingsDialog({
  visible,
  onDismiss,
  onSave,
  onColumnVisibilitySave,
  initialConfig,
  initialColumnVisibility,
  courseName,
  currentRoundPlayers = [],
  currentRoundDate,
}: CornerStatisticsSettingsDialogProps) {
  const theme = useTheme();
  const dialogStyle = useDialogStyle();
  const [config, setConfig] = useState<CornerStatisticsConfig>(initialConfig || {});
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityConfig>(
    initialColumnVisibility || { distance: true, par: false, gStats: true }
  );
  const [isInitialMount, setIsInitialMount] = useState(true);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configModalPosition, setConfigModalPosition] = useState<CornerPosition | null>(null);

  useEffect(() => {
    if (visible) {
      setIsInitialMount(true);
      const timer = setTimeout(() => setIsInitialMount(false), 100);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Auto-save when config or column visibility changes
  useEffect(() => {
    if (visible && !isInitialMount) {
      const configChanged = JSON.stringify(config) !== JSON.stringify(initialConfig || {});
      const visibilityChanged = JSON.stringify(columnVisibility) !== JSON.stringify(initialColumnVisibility || { distance: true, par: false, gStats: true });
      
      if (configChanged || visibilityChanged) {
        onSave(config);
        if (onColumnVisibilitySave) {
          onColumnVisibilitySave(columnVisibility);
        }
      }
    }
  }, [config, columnVisibility, visible, isInitialMount, initialConfig, initialColumnVisibility, onSave, onColumnVisibilitySave]);

  const getCornerConfig = (position: CornerPosition): CornerConfig | null => {
    return config[position] || null;
  };

  // Count how many corners are currently set
  const getSetCornerCount = (): number => {
    return Object.values(config).filter(c => c !== null && c !== undefined).length;
  };

  // Get the first set corner (alphabetically) to clear if we need to make room
  const getFirstSetCorner = (): CornerPosition | null => {
    const positions: CornerPosition[] = ['bottomLeft', 'bottomRight', 'topLeft', 'topRight'];
    for (const pos of positions) {
      if (config[pos] !== null && config[pos] !== undefined) {
        return pos;
      }
    }
    return null;
  };

  const handleOpenConfigModal = (position: CornerPosition) => {
    const setCount = getSetCornerCount();
    const currentCornerIsSet = config[position] !== null && config[position] !== undefined;
    
    // If 2 corners are already set and this corner is not one of them, clear the first one
    if (setCount >= 2 && !currentCornerIsSet) {
      const firstSetCorner = getFirstSetCorner();
      if (firstSetCorner) {
        setConfig(prev => {
          const updated = { ...prev };
          delete updated[firstSetCorner];
          return updated;
        });
      }
    }
    
    setConfigModalPosition(position);
    setConfigModalVisible(true);
  };

  const handleSaveConfig = (newConfig: CornerConfig | null) => {
    if (configModalPosition) {
      if (newConfig === null) {
        // Clear the corner
        setConfig(prev => {
          const updated = { ...prev };
          delete updated[configModalPosition];
          return updated;
        });
      } else {
        // Set the corner config
        // If this would result in 3 corners, clear the first existing one (that's not this one)
        const setCount = getSetCornerCount();
        const currentCornerIsSet = config[configModalPosition] !== null && config[configModalPosition] !== undefined;
        
        setConfig(prev => {
          const updated = { ...prev };
          updated[configModalPosition] = newConfig;
          
          // If we're adding a new corner (not updating existing) and we'd have 3, clear the first one
          if (!currentCornerIsSet && setCount >= 2) {
            const firstSetCorner = getFirstSetCorner();
            if (firstSetCorner && firstSetCorner !== configModalPosition) {
              delete updated[firstSetCorner];
            }
          }
          
          return updated;
        });
      }
    }
  };

  const formatConfigLabel = (cornerConfig: CornerConfig | null): string => {
    if (!cornerConfig) return 'Empty';
    
    // If preset name is stored, show it
    if (cornerConfig.presetName) {
      return cornerConfig.presetName;
    }
    
    // Otherwise generate a short label based on the config
    let userText = 'Unknown';
    if (cornerConfig.scoreUserFilter === 'everyone') {
      userText = 'All';
    } else if (cornerConfig.scoreUserFilter === 'eachUser') {
      userText = 'Each User';
    } else if (Array.isArray(cornerConfig.scoreUserFilter)) {
      if (cornerConfig.scoreUserFilter.length === 0) {
        userText = 'All';
      } else if (cornerConfig.scoreUserFilter.length === 1) {
        userText = 'User';
      } else {
        userText = `${cornerConfig.scoreUserFilter.length} users`;
      }
    }
    
    // Format accumulation mode
    const accumText = cornerConfig.accumulationMode === 'percentile' && cornerConfig.percentile
      ? `${cornerConfig.percentile}th percentile`
      : cornerConfig.accumulationMode;
    
    return `${userText} • ${accumText}`;
  };

  const renderCornerConfig = (position: CornerPosition) => {
    const cornerConfig = getCornerConfig(position);
    const setCount = getSetCornerCount();
    const currentCornerIsSet = cornerConfig !== null;
    // Disable if 2 corners are already set and this one isn't one of them
    const disabled = setCount >= 2 && !currentCornerIsSet;

    return (
      <View key={position} style={styles.cornerSection}>
        <View style={styles.cornerHeader}>
          <Text style={[styles.cornerLabel, { color: disabled ? theme.colors.onSurfaceDisabled : theme.colors.onSurface }]}>
            {CORNER_LABELS[position]}
          </Text>
          <Chip
            onPress={() => !disabled && handleOpenConfigModal(position)}
            style={[styles.chip, disabled && styles.chipDisabled]}
            mode={cornerConfig ? 'flat' : 'outlined'}
            disabled={disabled}
          >
            {disabled ? 'Max 2 corners' : formatConfigLabel(cornerConfig)}
          </Chip>
        </View>
      </View>
    );
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={[styles.dialog, dialogStyle]}>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <Dialog.Content style={styles.content}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Column Visibility
              </Text>
              <View style={styles.columnVisibilitySection}>
                <View style={styles.columnVisibilityRow}>
                  <Text style={[styles.columnLabel, { color: theme.colors.onSurface }]}>
                    Distance
                  </Text>
                  <Switch
                    value={columnVisibility.distance !== false}
                    onValueChange={(value) => 
                      setColumnVisibility(prev => ({ ...prev, distance: value }))
                    }
                  />
                </View>
                <View style={styles.columnVisibilityRow}>
                  <Text style={[styles.columnLabel, { color: theme.colors.onSurface }]}>
                    Par
                  </Text>
                  <Switch
                    value={columnVisibility.par === true}
                    onValueChange={(value) => 
                      setColumnVisibility(prev => ({ ...prev, par: value }))
                    }
                  />
                </View>
                <View style={styles.columnVisibilityRow}>
                  <Text style={[styles.columnLabel, { color: theme.colors.onSurface }]}>
                    G-Stats
                  </Text>
                  <Switch
                    value={columnVisibility.gStats === true}
                    onValueChange={(value) => 
                      setColumnVisibility(prev => ({ ...prev, gStats: value }))
                    }
                  />
                </View>
                <View style={styles.columnVisibilityRow}>
                  <Text style={[styles.columnLabel, { color: theme.colors.onSurface }]}>
                    Show Underlines
                  </Text>
                  <Switch
                    value={columnVisibility.showUnderlines === true}
                    onValueChange={(value) => 
                      setColumnVisibility(prev => ({ ...prev, showUnderlines: value }))
                    }
                  />
                </View>
                <View style={styles.columnVisibilityRow}>
                  <Text style={[styles.columnLabel, { color: theme.colors.onSurface }]}>
                    Font Size Adjustments
                  </Text>
                  <Switch
                    value={columnVisibility.showFontSizeAdjustments === true}
                    onValueChange={(value) => 
                      setColumnVisibility(prev => ({ ...prev, showFontSizeAdjustments: value }))
                    }
                  />
                </View>
                <View style={styles.columnVisibilityRow}>
                  <Text style={[styles.columnLabel, { color: theme.colors.onSurface }]}>
                    Font Color Adjustments
                  </Text>
                  <Switch
                    value={columnVisibility.showFontColorAdjustments === true}
                    onValueChange={(value) => 
                      setColumnVisibility(prev => ({ ...prev, showFontColorAdjustments: value }))
                    }
                  />
                </View>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface, marginTop: 24 }]}>
                Corner Statistics
              </Text>
              <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
                Configure what each corner displays. Leave empty to hide a corner.
              </Text>
              
              {(['bottomLeft', 'bottomRight', 'topLeft', 'topRight'] as CornerPosition[]).map(position =>
                renderCornerConfig(position)
              )}
            </Dialog.Content>
          </ScrollView>
        </Dialog.ScrollArea>
      </Dialog>
      <CornerStatisticConfigModal
        visible={configModalVisible}
        onDismiss={() => {
          setConfigModalVisible(false);
          setConfigModalPosition(null);
        }}
        onSave={handleSaveConfig}
        initialConfig={configModalPosition ? getCornerConfig(configModalPosition) : null}
        courseName={courseName}
        cornerPosition={configModalPosition || undefined}
        currentRoundPlayers={currentRoundPlayers}
        currentRoundDate={currentRoundDate}
      />
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  scrollArea: {
    maxHeight: 500,
  },
  content: {
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    marginBottom: 16,
    fontSize: 14,
  },
  columnVisibilitySection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  columnVisibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  columnLabel: {
    fontSize: 16,
  },
  cornerSection: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cornerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cornerLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  chip: {
    minWidth: 100,
    justifyContent: 'center',
  },
  chipDisabled: {
    opacity: 0.5,
  },
});
