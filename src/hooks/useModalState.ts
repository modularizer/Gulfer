/**
 * Hook to save and restore modal state for a specific route
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { saveModalState, getModalState, clearModalState } from '@/services/navigationState';

export interface UseModalStateOptions {
  /**
   * Keys to track in the modal state
   * If not provided, all keys in the state object will be tracked
   */
  keys?: string[];
  
  /**
   * Whether to clear state when modal is closed
   * Default: true
   */
  clearOnClose?: boolean;
  
  /**
   * Custom route path to use instead of current pathname
   */
  routePath?: string;
}

/**
 * Hook to automatically save and restore modal state
 * 
 * @example
 * const [modalVisible, setModalVisible] = useState(false);
 * const [editValue, setEditValue] = useState('');
 * 
 * useModalState({
 *   modalVisible,
 *   editValue,
 * });
 * 
 * // On mount, modal state will be restored
 * // On unmount or when modals close, state will be saved
 */
export function useModalState(
  state: Record<string, any>,
  options: UseModalStateOptions = {}
) {
  const pathname = usePathname();
  const routePath = options.routePath || pathname || '/';
  const keys = options.keys;
  const clearOnClose = options.clearOnClose !== false;
  const hasRestoredRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const previousStateRef = useRef<Record<string, any>>({});

  // Restore modal state on mount
  useEffect(() => {
    if (hasRestoredRef.current) {
      return;
    }

    const restoreState = async () => {
      try {
        // Check if saved state is recent (within last 1 hour)
        const maxAge = 60 * 60 * 1000; // 1 hour
        const savedState = await getModalState(routePath, maxAge);
        if (!savedState) {
          hasRestoredRef.current = true;
          return;
        }

        // Restore only the keys we're tracking (exclude timestamp)
        const keysToRestore = keys || Object.keys(state);
        keysToRestore.forEach((key) => {
          if (key !== 'timestamp' && key in savedState && key in state) {
            // Only restore if the state setter follows the pattern setXxx
            const setterKey = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            if (setterKey in state) {
              const setter = (state as any)[setterKey];
              if (typeof setter === 'function') {
                setter(savedState[key]);
              }
            }
          }
        });

        hasRestoredRef.current = true;
      } catch (error) {
        console.error('Error restoring modal state:', error);
        hasRestoredRef.current = true;
      }
    };

    restoreState();
  }, []);

  // Save modal state whenever it changes
  useEffect(() => {
    // Skip saving on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      previousStateRef.current = { ...state };
      return;
    }

    // Check if any tracked state has changed
    const keysToTrack = keys || Object.keys(state);
    const hasChanged = keysToTrack.some((key) => {
      const currentValue = state[key];
      const previousValue = previousStateRef.current[key];
      return JSON.stringify(currentValue) !== JSON.stringify(previousValue);
    });

    if (!hasChanged) {
      return;
    }

    const saveState = async () => {
      try {
        // Extract only the keys we're tracking
        const stateToSave: Record<string, any> = {};
        keysToTrack.forEach((key) => {
          if (key in state) {
            stateToSave[key] = state[key];
          }
        });

        // Check if all modals are closed (if clearOnClose is true)
        if (clearOnClose) {
          const allModalsClosed = keysToTrack.every((key) => {
            const value = state[key];
            // Check if it's a boolean (modal visible) or an object with visible property
            if (typeof value === 'boolean') {
              return !value;
            }
            if (value && typeof value === 'object' && 'visible' in value) {
              return !value.visible;
            }
            return true;
          });

          if (allModalsClosed) {
            // All modals are closed, clear the saved state
            await clearModalState(routePath);
            previousStateRef.current = { ...state };
            return;
          }
        }

        // Save the state
        await saveModalState(routePath, stateToSave);
        previousStateRef.current = { ...state };
      } catch (error) {
        console.error('Error saving modal state:', error);
      }
    };

    saveState();
  }, [state, routePath, keys, clearOnClose]);
}

/**
 * Simplified hook that takes a state object directly
 * This version expects state to be an object with getters and setters
 * 
 * @example
 * const modalState = {
 *   visible: false,
 *   setVisible: setVisible,
 *   editValue: '',
 *   setEditValue: setEditValue,
 * };
 * 
 * useModalStateSimple(modalState);
 */
export function useModalStateSimple(
  state: Record<string, any>,
  options: UseModalStateOptions = {}
) {
  const pathname = usePathname();
  const routePath = options.routePath || pathname || '/';
  const hasRestoredRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const previousStateRef = useRef<Record<string, any>>({});

  // Extract getter values (non-function properties)
  const getStateValues = () => {
    const values: Record<string, any> = {};
    Object.keys(state).forEach((key) => {
      if (typeof state[key] !== 'function' && !key.startsWith('set')) {
        values[key] = state[key];
      }
    });
    return values;
  };

  // Restore modal state on mount
  useEffect(() => {
    if (hasRestoredRef.current) {
      return;
    }

    const restoreState = async () => {
      try {
        // Check if saved state is recent (within last 1 hour)
        const maxAge = 60 * 60 * 1000; // 1 hour
        const savedState = await getModalState(routePath, maxAge);
        if (!savedState) {
          hasRestoredRef.current = true;
          return;
        }

        // Restore values using setters (exclude timestamp)
        Object.keys(savedState).forEach((key) => {
          if (key !== 'timestamp') {
            const setterKey = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            if (setterKey in state) {
              const setter = state[setterKey];
              if (typeof setter === 'function') {
                setter(savedState[key]);
              }
            }
          }
        });

        hasRestoredRef.current = true;
      } catch (error) {
        console.error('Error restoring modal state:', error);
        hasRestoredRef.current = true;
      }
    };

    restoreState();
  }, []);

  // Save modal state whenever it changes
  useEffect(() => {
    // Skip saving on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      previousStateRef.current = getStateValues();
      return;
    }

    const currentValues = getStateValues();
    
    // Check if state has changed
    const hasChanged = JSON.stringify(currentValues) !== JSON.stringify(previousStateRef.current);
    if (!hasChanged) {
      return;
    }

    const saveState = async () => {
      try {
        const clearOnClose = options.clearOnClose !== false;
        
        // Check if all modals are closed
        if (clearOnClose) {
          const allModalsClosed = Object.keys(currentValues).every((key) => {
            const value = currentValues[key];
            if (typeof value === 'boolean') {
              return !value;
            }
            if (value && typeof value === 'object' && 'visible' in value) {
              return !value.visible;
            }
            return true;
          });

          if (allModalsClosed) {
            await clearModalState(routePath);
            previousStateRef.current = currentValues;
            return;
          }
        }

        await saveModalState(routePath, currentValues);
        previousStateRef.current = currentValues;
      } catch (error) {
        console.error('Error saving modal state:', error);
      }
    };

    saveState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Track individual state values instead of the whole state object
    // This prevents unnecessary re-renders while still detecting changes
    ...Object.keys(state).filter(key => typeof state[key] !== 'function' && !key.startsWith('set')).map(key => state[key]),
    routePath,
    options.clearOnClose,
  ]);
}

