/**
 * Base Table Service
 * 
 * Provides common functionality for entities that use baseColumns:
 * - Editing baseColumns (id, name, notes, lat, lng, metadata)
 * - Adding/removing photos
 * 
 * All services for entities with baseColumns should extend this.
 */

import { BaseService } from './base';
import { eq, and } from 'drizzle-orm';
import * as schema from '../tables';
import type { Photo, PhotoInsert } from '../tables';
import { upsertEntity } from '../query-builders';
import { generateUUID } from '../../../../xp-deeby/xp-schema';

/**
 * Base columns that most entities share
 */
export type BaseColumns = {
  id: string;
  name: string | null;
  notes: string | null;
  lat: number;
  lng: number;
  metadata: Record<string, any> | null;
};

/**
 * Updates for base columns
 */
export type BaseColumnsUpdate = Partial<Omit<BaseColumns, 'id'>>;

export abstract class BaseTableService<T extends BaseColumns> extends BaseService {
  /**
   * Get the table name for this entity type
   * Must be implemented by subclasses
   */
  protected abstract getTableName(): string;

  /**
   * Get the table generic-sports object
   * Must be implemented by subclasses
   */
  protected abstract getTable(): any;

  /**
   * Update base columns for an entity
   */
  async updateBaseColumns(
    entityId: string,
    updates: BaseColumnsUpdate
  ): Promise<T> {
    const table = this.getTable();
    const existing = await this.getById<T>(table, entityId);
    
    if (!existing) {
      throw new Error(`${this.getTableName()} not found: ${entityId}`);
    }

    const updated: Partial<T> = {
      ...existing,
      ...updates,
    };

    await upsertEntity(this.db, table, updated, { id: entityId });

    const saved = await this.getById<T>(table, entityId);
    if (!saved) {
      throw new Error(`Failed to update ${this.getTableName()}`);
    }

    return saved;
  }

  /**
   * Update entity name
   */
  async updateName(entityId: string, name: string | null): Promise<T> {
    return await this.updateBaseColumns(entityId, { name });
  }

  /**
   * Update entity notes
   */
  async updateNotes(entityId: string, notes: string | null): Promise<T> {
    return await this.updateBaseColumns(entityId, { notes });
  }

  /**
   * Update entity location
   */
  async updateLocation(entityId: string, lat: number, lng: number): Promise<T> {
    return await this.updateBaseColumns(entityId, { lat, lng });
  }

  /**
   * Update entity metadata
   */
  async updateMetadata(
    entityId: string,
    metadata: Record<string, any> | null
  ): Promise<T> {
    return await this.updateBaseColumns(entityId, { metadata });
  }

  /**
   * Merge metadata with existing metadata
   */
  async mergeMetadata(
    entityId: string,
    metadataToMerge: Record<string, any>
  ): Promise<T> {
    const existing = await this.getById<T>(this.getTable(), entityId);
    if (!existing) {
      throw new Error(`${this.getTableName()} not found: ${entityId}`);
    }

    const mergedMetadata = {
      ...(existing.metadata || {}),
      ...metadataToMerge,
    };

    return await this.updateMetadata(entityId, mergedMetadata);
  }

  /**
   * Get all photos for an entity
   */
  async getPhotos(entityId: string): Promise<Photo[]> {
    const tableName = this.getTableName();
    return await this.db
      .select()
      .from(schema.photos)
      .where(
        and(
          eq(schema.photos.refId, entityId),
          eq(schema.photos.refTable, tableName)
        )
      );
  }

  /**
   * Add a photo to an entity
   */
  async addPhoto(
    entityId: string,
    photoData: {
      hash: string;
      data?: string | null;
    }
  ): Promise<Photo> {
    const tableName = this.getTableName();
    const photo: Partial<PhotoInsert> = {
      id: generateUUID(),
      refId: entityId,
      refTable: tableName,
      hash: photoData.hash,
      data: photoData.data || null,
      createdAt: Date.now(),
    };

    await upsertEntity(this.db, schema.photos, photo, { id: photo.id });

    const saved = await this.db
      .select()
      .from(schema.photos)
      .where(eq(schema.photos.id, photo.id!))
      .limit(1);

    if (saved.length === 0) {
      throw new Error('Failed to create photo');
    }

    return saved[0] as Photo;
  }

  /**
   * Remove a photo from an entity
   */
  async removePhoto(photoId: string): Promise<void> {
    // Verify the photo exists and belongs to this entity type
    const photo = await this.db
      .select()
      .from(schema.photos)
      .where(eq(schema.photos.id, photoId))
      .limit(1);

    if (photo.length === 0) {
      throw new Error(`Photo not found: ${photoId}`);
    }

    const tableName = this.getTableName();
    if (photo[0].refTable !== tableName) {
      throw new Error(`Photo does not belong to ${tableName}`);
    }

    await this.db
      .delete(schema.photos)
      .where(eq(schema.photos.id, photoId));
  }

  /**
   * Remove all photos for an entity
   */
  async removeAllPhotos(entityId: string): Promise<void> {
    const tableName = this.getTableName();
    await this.db
      .delete(schema.photos)
      .where(
        and(
          eq(schema.photos.refId, entityId),
          eq(schema.photos.refTable, tableName)
        )
      );
  }

  /**
   * Update a photo's storage
   */
  async updatePhoto(
    photoId: string,
    updates: {
      data?: string | null;
      hash?: string;
    }
  ): Promise<Photo> {
    // Verify the photo exists and belongs to this entity type
    const photo = await this.db
      .select()
      .from(schema.photos)
      .where(eq(schema.photos.id, photoId))
      .limit(1);

    if (photo.length === 0) {
      throw new Error(`Photo not found: ${photoId}`);
    }

    const tableName = this.getTableName();
    if (photo[0].refTable !== tableName) {
      throw new Error(`Photo does not belong to ${tableName}`);
    }

    const updated: Partial<PhotoInsert> = {
      ...photo[0],
      ...updates,
    };

    await upsertEntity(this.db, schema.photos, updated, { id: updated.id });

    const saved = await this.db
      .select()
      .from(schema.photos)
      .where(eq(schema.photos.id, photoId))
      .limit(1);

    if (saved.length === 0) {
      throw new Error('Failed to update photo');
    }

    return saved[0] as Photo;
  }
}

