/**
 * Player Service
 * 
 * Object-oriented service for managing players (participants with isTeam: false).
 * Provides high-level methods for player operations.
 */

import { BaseService } from './base';
import type { Database } from '@services/storage/db';
import { queryParticipants, upsertParticipantWithDetails, findTeamsForPlayer, type ParticipantWithDetails } from '../query-builders';
import { eq, and, inArray, like } from 'drizzle-orm';
import * as schema from '../tables';
import type { Participant, Account } from '../tables';
import { generateUUID } from '@/utils/uuid';

export class PlayerService extends BaseService {
  /**
   * Get a player by ID with all related data
   */
  async getPlayer(playerId: string): Promise<ParticipantWithDetails | null> {
    const players = await queryParticipants(this.db)
      .withEvents()
      .withAccount()
      .where(eq(schema.participants.id, playerId))
      .execute();
    
    return players.length > 0 ? players[0] : null;
  }

  /**
   * Get multiple players by IDs
   */
  async getPlayers(playerIds: string[]): Promise<ParticipantWithDetails[]> {
    if (playerIds.length === 0) return [];
    
    return await queryParticipants(this.db)
      .withEvents()
      .withAccount()
      .where(inArray(schema.participants.id, playerIds))
      .execute();
  }

  /**
   * Get all players
   */
  async getAllPlayers(): Promise<ParticipantWithDetails[]> {
    return await queryParticipants(this.db)
      .withEvents()
      .withAccount()
      .execute();
  }

  /**
   * Get players by name (case-insensitive search)
   */
  async getPlayersByName(name: string): Promise<ParticipantWithDetails[]> {
    return await queryParticipants(this.db)
      .withEvents()
      .withAccount()
      .where(
        and(
          eq(schema.participants.isTeam, false),
          like(schema.participants.name, `%${name}%`)
        )
      )
      .execute();
  }

  /**
   * Create or update a player
   */
  async savePlayer(player: ParticipantWithDetails): Promise<void> {
    // Ensure isTeam is false
    const playerData = {
      ...player,
      participant: {
        ...player.participant,
        isTeam: false,
      },
    };
    
    await upsertParticipantWithDetails(this.db, playerData);
  }

  /**
   * Create a new player
   */
  async createPlayer(
    participant: Partial<Participant>,
    account?: Partial<Account> | null
  ): Promise<ParticipantWithDetails> {
    const playerData: ParticipantWithDetails = {
      participant: {
        id: participant.id || generateUUID(),
        name: participant.name || null,
        notes: participant.notes || null,
        lat: participant.lat ?? 0,
        lng: participant.lng ?? 0,
        metadata: participant.metadata || null,
        isTeam: false,
      } as Participant,
      teams: [],
      teamMembers: [],
      events: [],
      account: account ? {
        id: account.id || generateUUID(),
        participantId: participant.id || '',
        ...account,
      } as Account : null,
    };
    
    await this.savePlayer(playerData);
    
    const saved = await this.getPlayer(playerData.participant.id);
    if (!saved) {
      throw new Error('Failed to create player');
    }
    
    return saved;
  }

  /**
   * Update a player
   */
  async updatePlayer(
    playerId: string,
    updates: Partial<Participant>,
    accountUpdates?: Partial<Account> | null
  ): Promise<ParticipantWithDetails> {
    const existing = await this.getPlayer(playerId);
    if (!existing) {
      throw new Error(`Player not found: ${playerId}`);
    }
    
    const updated: ParticipantWithDetails = {
      ...existing,
      participant: {
        ...existing.participant,
        ...updates,
        isTeam: false, // Ensure it stays false
      },
      account: accountUpdates ? {
        ...existing.account,
        ...accountUpdates,
      } as Account : existing.account,
    };
    
    await this.savePlayer(updated);
    
    const saved = await this.getPlayer(playerId);
    if (!saved) {
      throw new Error('Failed to update player');
    }
    
    return saved;
  }

  /**
   * Delete a player
   */
  async deletePlayer(playerId: string): Promise<void> {
    await this.deleteById(schema.participants, playerId);
  }

  /**
   * Get all teams a player belongs to
   */
  async getPlayerTeams(playerId: string) {
    return await findTeamsForPlayer(this.db, playerId);
  }

  /**
   * Get all events a player has participated in
   */
  async getPlayerEvents(playerId: string) {
    const player = await this.getPlayer(playerId);
    return player?.events || [];
  }
}

