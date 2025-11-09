/**
 * Service for handling gesture detection from Kotlin native module
 * Phase 3 feature
 */

import { NativeModules, NativeEventEmitter } from 'react-native';

const { GestureDetector } = NativeModules;

export type GestureType = 'throw_landing' | 'hole_start' | 'hole_end';

export interface GestureEvent {
  gestureType: GestureType;
  timestamp: number;
}

class GestureService {
  private eventEmitter: NativeEventEmitter | null = null;
  private listeners: Array<(event: GestureEvent) => void> = [];

  constructor() {
    if (GestureDetector) {
      this.eventEmitter = new NativeEventEmitter(GestureDetector);
      this.setupEventListener();
    }
  }

  private setupEventListener() {
    if (!this.eventEmitter) return;

    this.eventEmitter.addListener('onGestureDetected', (event: GestureEvent) => {
      this.listeners.forEach((listener) => listener(event));
    });
  }

  /**
   * Start gesture detection
   */
  async startDetection(): Promise<void> {
    if (!GestureDetector) {
      throw new Error('Gesture detection not available on this platform');
    }
    await GestureDetector.startGestureDetection();
  }

  /**
   * Stop gesture detection
   */
  async stopDetection(): Promise<void> {
    if (!GestureDetector) {
      throw new Error('Gesture detection not available on this platform');
    }
    await GestureDetector.stopGestureDetection();
  }

  /**
   * Subscribe to gesture events
   */
  onGesture(callback: (event: GestureEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Check if gesture detection is available
   */
  isAvailable(): boolean {
    return GestureDetector != null;
  }
}

export default new GestureService();

