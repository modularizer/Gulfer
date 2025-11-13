/**
 * Local storage driver factory
 * Automatically selects the appropriate driver based on platform
 * Uses WebStorageDriver on web and MobileStorageDriver on React Native
 */

import { Platform } from 'react-native';
import { IStorageDriver, Table, SelectOptions } from './IStorageDriver';
import { WebStorageDriver } from './WebStorageDriver';
import { MobileStorageDriver } from './MobileStorageDriver';
import { Filter } from '../filters';

/**
 * Local storage driver
 * Factory class that wraps the appropriate platform-specific driver
 * Implements IStorageDriver by delegating to WebStorageDriver or MobileStorageDriver
 */
export class LocalStorageDriver implements IStorageDriver {
    private driver: IStorageDriver;

    constructor() {
        // Select the appropriate driver based on platform
        if (Platform.OS === 'web') {
            this.driver = new WebStorageDriver();
        } else {
            this.driver = new MobileStorageDriver();
        }
    }

    getCapabilities() {
        return this.driver.getCapabilities();
    }

    async select<T extends { id: string }>(
        table: Table,
        options?: SelectOptions
    ): Promise<T[]> {
        return this.driver.select<T>(table, options);
    }

    async insert<T extends { id?: string }>(
        table: Table,
        entity: T
    ): Promise<T & { id: string }> {
        return this.driver.insert<T>(table, entity);
    }

    async upsert<T extends { id: string }>(
        table: Table,
        entity: T
    ): Promise<void> {
        return this.driver.upsert<T>(table, entity);
    }

    async delete(
        table: Table,
        filter: Filter
    ): Promise<number> {
        return this.driver.delete(table, filter);
    }

    async deleteById(
        table: Table,
        id: string
    ): Promise<boolean> {
        return this.driver.deleteById(table, id);
    }

    async exists(
        table: Table,
        filter: Filter
    ): Promise<boolean> {
        return this.driver.exists(table, filter);
    }

    async count(
        table: Table,
        filter?: Filter
    ): Promise<number> {
        return this.driver.count(table, filter);
    }
}

/**
 * Default storage driver instance
 * This is the driver used throughout the application
 * Automatically selects the appropriate platform-specific driver
 * Can be swapped out for other drivers (e.g., SQLite, Postgres, etc.)
 */
export const defaultStorageDriver = new LocalStorageDriver();
