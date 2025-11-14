/**
 * Import/Export Service
 * 
 * Handles importing and exporting storage, and merging storage from foreign sources.
 * Tracks merge mappings between foreign entities and local entities.
 */

import { BaseService } from './base';
import { eq, and } from 'drizzle-orm';
import * as schema from '../tables';
import type { MergeEntry, MergeEntryInsert } from '../tables';
import { upsertEntity } from '../query-builders';
import { generateUUID } from '@utils/uuid';

/**
 * Foreign storage identifier
 */
export type ForeignStorageId = string;

/**
 * Export options
 */
export interface ExportOptions {
  includePhotos?: boolean;
  includeMetadata?: boolean;
  tables?: string[]; // Specific tables to export, or all if not specified
}

/**
 * Import options
 */
export interface ImportOptions {
  foreignStorageId: ForeignStorageId;
  mergeStrategy?: 'skip' | 'overwrite' | 'merge'; // How to handle existing entities
  createMergeEntries?: boolean; // Whether to track merges
}

/**
 * Merge resolution result
 */
export interface MergeResolution {
  localId: string;
  mergeEntry: MergeEntry | null;
  wasMerged: boolean;
}

/**
 * Export storage structure
 */
export interface ExportData {
  version: string;
  exportedAt: number;
  tables: Record<string, any[]>;
}

export class ImportExportService extends BaseService {
  /**
   * Export all storage from the database
   */
  async exportData(options: ExportOptions = {}): Promise<ExportData> {
    const {
      includePhotos = true,
      includeMetadata = true,
      tables = [],
    } = options;

    const exportData: ExportData = {
      version: '1.0',
      exportedAt: Date.now(),
      tables: {},
    };

    // Define all exportable tables
    const allTables = [
      { name: 'sports', table: schema.sports },
      { name: 'score_formats', table: schema.scoreFormats },
      { name: 'event_formats', table: schema.eventFormats },
      { name: 'event_format_stages', table: schema.eventFormatStages },
      { name: 'venues', table: schema.venues },
      { name: 'venue_event_formats', table: schema.venueEventFormats },
      { name: 'venue_event_format_stages', table: schema.venueEventFormatStages },
      { name: 'participants', table: schema.participants },
      { name: 'team_members', table: schema.teamMembers },
      { name: 'events', table: schema.events },
      { name: 'event_participants', table: schema.eventParticipants },
      { name: 'event_stages', table: schema.eventStages },
      { name: 'participant_event_stage_scores', table: schema.participantEventStageScores },
      { name: 'scores', table: schema.scores },
    ];

    // Filter tables if specified
    const tablesToExport = tables.length > 0
      ? allTables.filter(t => tables.includes(t.name))
      : allTables;

    // Export each table
    for (const { name, table } of tablesToExport) {
      const data = await this.db.select().from(table);
      
      // Filter out metadata if not included
      if (!includeMetadata) {
        exportData.tables[name] = data.map(row => {
          const { metadata, ...rest } = row as any;
          return rest;
        });
      } else {
        exportData.tables[name] = data;
      }
    }

    // Export photos if requested
    if (includePhotos) {
      const photos = await this.db.select().from(schema.photos);
      exportData.tables['photos'] = photos;
    }

    return exportData;
  }

  /**
   * Import storage from a foreign source
   */
  async importData(
    data: ExportData,
    options: ImportOptions
  ): Promise<{
    imported: Record<string, number>;
    merged: Record<string, number>;
    skipped: Record<string, number>;
    errors: string[];
  }> {
    const {
      foreignStorageId,
      mergeStrategy = 'merge',
      createMergeEntries = true,
    } = options;

    const result = {
      imported: {} as Record<string, number>,
      merged: {} as Record<string, number>,
      skipped: {} as Record<string, number>,
      errors: [] as string[],
    };

    // Import tables in dependency order
    const importOrder = [
      'sports',
      'score_formats',
      'event_formats',
      'event_format_stages',
      'venues',
      'venue_event_formats',
      'venue_event_format_stages',
      'participants',
      'team_members',
      'events',
      'event_participants',
      'event_stages',
      'participant_event_stage_scores',
      'scores',
      'photos',
    ];

    for (const tableName of importOrder) {
      if (!data.tables[tableName]) {
        continue;
      }

      const table = this.getTableByName(tableName);
      if (!table) {
        result.errors.push(`Unknown table: ${tableName}`);
        continue;
      }

      for (const row of data.tables[tableName]) {
        try {
          const foreignId = row.id;
          
          // Check if this entity already exists (via merge entry or by ID)
          const existingMerge = await this.findMergeEntry(
            foreignStorageId,
            foreignId,
            tableName
          );

          if (existingMerge) {
            if (mergeStrategy === 'skip') {
              result.skipped[tableName] = (result.skipped[tableName] || 0) + 1;
              continue;
            } else if (mergeStrategy === 'overwrite') {
              // Update existing entity
              await upsertEntity(this.db, table, {
                ...row,
                id: existingMerge.localId,
              });
              result.merged[tableName] = (result.merged[tableName] || 0) + 1;
            } else {
              // merge strategy: merge metadata and update
              const existing = await this.db
                .select()
                .from(table)
                .where(eq(table.id, existingMerge.localId))
                .limit(1);

              if (existing.length > 0) {
                const merged = {
                  ...existing[0],
                  ...row,
                  id: existingMerge.localId,
                  metadata: {
                    ...(existing[0] as any).metadata,
                    ...(row as any).metadata,
                  },
                };
                await upsertEntity(this.db, table, merged);
                result.merged[tableName] = (result.merged[tableName] || 0) + 1;
              }
            }
          } else {
            // New entity - create it
            const localId = generateUUID();
            await upsertEntity(this.db, table, {
              ...row,
              id: localId,
            });

            // Create merge entry
            if (createMergeEntries) {
              await this.createMergeEntry(
                foreignStorageId,
                foreignId,
                tableName,
                localId
              );
            }

            result.imported[tableName] = (result.imported[tableName] || 0) + 1;
          }
        } catch (error) {
          result.errors.push(`Error importing ${tableName} ${row.id}: ${error}`);
        }
      }
    }

    return result;
  }

  /**
   * Find merge entry for a foreign entity
   */
  async findMergeEntry(
    foreignStorageId: ForeignStorageId,
    foreignId: string,
    refTable: string
  ): Promise<MergeEntry | null> {
    const results = await this.db
      .select()
      .from(schema.mergeEntries)
      .where(
        and(
          eq(schema.mergeEntries.foreignStorageId, foreignStorageId),
          eq(schema.mergeEntries.foreignId, foreignId),
          eq(schema.mergeEntries.refTable, refTable)
        )
      )
      .limit(1);

    return results.length > 0 ? (results[0] as MergeEntry) : null;
  }

  /**
   * Create a merge entry
   */
  async createMergeEntry(
    foreignStorageId: ForeignStorageId,
    foreignId: string,
    refTable: string,
    localId: string
  ): Promise<MergeEntry> {
    const mergeEntry: Partial<MergeEntryInsert> = {
      id: generateUUID(),
      foreignStorageId,
      foreignId,
      refTable,
      localId,
      mergedAt: Date.now(),
    };

    await upsertEntity(this.db, schema.mergeEntries, mergeEntry);

    const saved = await this.db
      .select()
      .from(schema.mergeEntries)
      .where(eq(schema.mergeEntries.id, mergeEntry.id!))
      .limit(1);

    if (saved.length === 0) {
      throw new Error('Failed to create merge entry');
    }

    return saved[0] as MergeEntry;
  }

  /**
   * Resolve a foreign ID to a local ID
   */
  async resolveMerge(
    foreignStorageId: ForeignStorageId,
    foreignId: string,
    refTable: string
  ): Promise<MergeResolution | null> {
    const mergeEntry = await this.findMergeEntry(foreignStorageId, foreignId, refTable);
    
    if (!mergeEntry) {
      return null;
    }

    return {
      localId: mergeEntry.localId,
      mergeEntry,
      wasMerged: true,
    };
  }

  /**
   * Get all merge entries for a foreign storage
   */
  async getMergeEntries(foreignStorageId: ForeignStorageId): Promise<MergeEntry[]> {
    return await this.db
      .select()
      .from(schema.mergeEntries)
      .where(eq(schema.mergeEntries.foreignStorageId, foreignStorageId));
  }

  /**
   * Get merge entries for a specific table
   */
  async getMergeEntriesByTable(
    foreignStorageId: ForeignStorageId,
    refTable: string
  ): Promise<MergeEntry[]> {
    return await this.db
      .select()
      .from(schema.mergeEntries)
      .where(
        and(
          eq(schema.mergeEntries.foreignStorageId, foreignStorageId),
          eq(schema.mergeEntries.refTable, refTable)
        )
      );
  }

  /**
   * Delete merge entries for a foreign storage
   */
  async deleteMergeEntries(foreignStorageId: ForeignStorageId): Promise<void> {
    await this.db
      .delete(schema.mergeEntries)
      .where(eq(schema.mergeEntries.foreignStorageId, foreignStorageId));
  }

  /**
   * Get table generic-sports object by name
   */
  private getTableByName(tableName: string): any {
    const tableMap: Record<string, any> = {
      'sports': schema.sports,
      'score_formats': schema.scoreFormats,
      'event_formats': schema.eventFormats,
      'event_format_stages': schema.eventFormatStages,
      'venues': schema.venues,
      'venue_event_formats': schema.venueEventFormats,
      'venue_event_format_stages': schema.venueEventFormatStages,
      'participants': schema.participants,
      'team_members': schema.teamMembers,
      'events': schema.events,
      'event_participants': schema.eventParticipants,
      'event_stages': schema.eventStages,
      'participant_event_stage_scores': schema.participantEventStageScores,
      'scores': schema.scores,
      'photos': schema.photos,
    };

    return tableMap[tableName] || null;
  }

  /**
   * Export storage to JSON string
   */
  async exportToJSON(options: ExportOptions = {}): Promise<string> {
    const data = await this.exportData(options);
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import storage from JSON string
   */
  async importFromJSON(
    json: string,
    options: ImportOptions
  ): Promise<{
    imported: Record<string, number>;
    merged: Record<string, number>;
    skipped: Record<string, number>;
    errors: string[];
  }> {
    const data = JSON.parse(json) as ExportData;
    return await this.importData(data, options);
  }
}

