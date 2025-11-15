/**
 * Hook for handling export functionality
 * Provides consistent export behavior across platforms
 * Uses native share modal on all platforms when available
 */

import { useState, useCallback } from 'react';
import { Platform, Share, Alert } from 'react-native';

export function useExport() {
  const [exporting, setExporting] = useState(false);

  const exportToClipboard = useCallback(async (text: string, entityName: string) => {
    setExporting(true);
    try {
      if (Platform.OS === 'web') {
        // Use Web Share API if available (provides native share modal)
        // Check for secure context (HTTPS or localhost) and navigator.share support
        const isSecureContext = typeof window !== 'undefined' && 
          (window.isSecureContext || window.location.protocol === 'https:' || 
           window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        
        // Check for Web Share API - try both navigator and window.navigator
        const shareAPI = (typeof navigator !== 'undefined' && navigator.share) 
          ? navigator.share 
          : (typeof window !== 'undefined' && window.navigator && window.navigator.share)
          ? window.navigator.share
          : null;
        
        if (shareAPI && isSecureContext) {
          try {
            console.log('Attempting to use Web Share API...');
            await shareAPI({
              title: `Export: ${entityName}`,
              text: text,
            });
            console.log('Web Share API succeeded');
            // Share was successful, no need to show alert
            return;
          } catch (shareError: any) {
            // User cancelled or share failed, fall back to clipboard
            // Only fall back if it wasn't a user cancellation
            if (shareError.name === 'AbortError') {
              console.log('User cancelled share');
              // User cancelled, just return
              return;
            } else {
              console.log('Web Share API failed, falling back to clipboard:', shareError);
              // Continue to clipboard fallback below
            }
          }
        } else {
          if (!shareAPI) {
            console.log('Web Share API not available in this browser');
          } else if (!isSecureContext) {
            console.log('Web Share API requires HTTPS (or localhost). Current protocol:', 
              typeof window !== 'undefined' ? window.location.protocol : 'unknown');
          }
        }
        
        // Fallback to clipboard if Web Share API is not available
        console.log('Falling back to clipboard');
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(text);
          Alert.alert('Success', `${entityName} exported to clipboard`);
        } else {
          // Last resort: use document.execCommand
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          Alert.alert('Success', `${entityName} exported to clipboard`);
        }
      } else {
        // Native platforms: use React Native Share API
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

