/**
 * Hook for handling export functionality
 * Provides consistent export behavior across platforms
 */

import { useState, useCallback } from 'react';
import { Platform, Share, Alert } from 'react-native';

export function useExport() {
  const [exporting, setExporting] = useState(false);

  const exportToClipboard = useCallback(async (text: string, entityName: string) => {
    setExporting(true);
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
        Alert.alert('Success', `${entityName} exported to clipboard`);
      } else {
        await Share.share({
          message: text,
          title: `Export: ${entityName}`,
        });
      }
    } catch (error) {
      console.error('Error exporting:', error);
      Alert.alert('Error', `Failed to export ${entityName}`);
    } finally {
      setExporting(false);
    }
  }, []);

  return {
    exporting,
    exportToClipboard,
  };
}

