/**
 * Storage driver exports
 * Central export point for all storage drivers
 */

// New driver interface (recommended)
export { IStorageDriver, SelectOptions } from './IStorageDriver';

// Platform-specific drivers
export { WebStorageDriver } from './WebStorageDriver';
export { MobileStorageDriver } from './MobileStorageDriver';

// Factory driver (automatically selects platform-specific driver)
export { LocalStorageDriver, defaultStorageDriver } from './LocalStorageDriver';

// Legacy exports (for backward compatibility)
export { StorageDriver, EntityStorageConfig } from './StorageDriver';

