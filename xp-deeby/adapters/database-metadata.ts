/**
 * Database Metadata
 *
 * Functions to get metadata about databases (table count, row count, etc.)
 */
import { getAdapterByType } from './index';
import { getRegistryEntries } from './registry-storage';
import { sql } from 'drizzle-orm';

export interface DatabaseMetadata {
    tableCount: number;
    totalRowCount: number;
}

/**
 * Get metadata for a database
 *
 * @param name - Database name
 * @returns Metadata including table count and total row count
 */
export async function getDatabaseMetadata(name: string): Promise<DatabaseMetadata> {
    try {
        // Get adapter type from registry
        const entries = await getRegistryEntries();
        const entry = entries.find(e => e.name === name);

        if (!entry) {
            console.warn(`[getDatabaseMetadata] Database ${name} not found in registry`);
            return { tableCount: 0, totalRowCount: 0 };
        }

        // Use the exact adapter type from registry
        const adapter = await getAdapterByType(entry.adapterType);

        // Connect to database using the specific adapter
        if (!adapter.getDatabaseByName) {
            throw new Error(`Adapter ${entry.adapterType} does not support getDatabaseByName`);
        }
        const db = await adapter.getDatabaseByName(name);

        // Get table names
        if (!adapter.getTableNames) {
            throw new Error(`Adapter ${entry.adapterType} does not support getTableNames`);
        }
        const tableNames = await adapter.getTableNames(db);

        if (tableNames.length === 0) {
            return { tableCount: 0, totalRowCount: 0 };
        }

        // Count rows in each table
        let totalRowCount = 0;
        for (const tableName of tableNames) {
            try {
                const result = await db.execute(
                    sql`SELECT COUNT(*) as count FROM ${sql.identifier(tableName)}`
                ) as any[];
                const count = result[0]?.count;
                if (typeof count === 'number') {
                    totalRowCount += count;
                } else if (count !== null && count !== undefined) {
                    totalRowCount += parseInt(String(count), 10) || 0;
                }
            } catch (err) {
                // Table might not exist or be accessible, skip it
                console.warn(`Could not count rows in table ${tableName}:`, err);
            }
        }

        return {
            tableCount: tableNames.length,
            totalRowCount,
        };
    } catch (err) {
        // Database might not exist or be accessible
        console.warn(`[getDatabaseMetadata] Could not get metadata for database ${name}:`, err);
        return { tableCount: 0, totalRowCount: 0 };
    }
}

