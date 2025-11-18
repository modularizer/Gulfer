/**
 * Player Service
 *
 * Object-oriented service for managing players (participants with isTeam: false).
 * Provides high-level methods for player operations.
 * 
 * @version 1.1.0 - Added upsertPlayer method
 */

import { BaseService } from './base';
import { queryParticipants, upsertParticipantWithDetails, findTeamsForPlayer, type ParticipantWithDetails } from '../query-builders';
import { eq, and, inArray, like } from 'drizzle-orm';
import * as schema from '../tables';
import type { Participant } from '../tables';
import { generateUUID } from '../../../../xp-deeby/utils/uuid';

// Version constant to force Metro to detect class method changes
// Increment this when adding/modifying class methods to ensure hot reload works
export const PLAYER_SERVICE_VERSION = '1.1.0';

export class PlayerService extends BaseService {
    /**
     * Get a player by ID with all related storage
     */
    async getPlayer(playerId: string): Promise<ParticipantWithDetails | null> {
        console.log(`[PlayerService.getPlayer] Looking for player with ID: ${playerId}`);
        
        // First, try a simple direct query to verify the record exists
        let directCheck: any[] = [];
        try {
            directCheck = await this.db
                .select()
                .from(schema.participants)
                .where(eq(schema.participants.id, playerId))
                .limit(1);
            
            console.log(`[PlayerService.getPlayer] Direct query result:`, directCheck);
            
            if (directCheck.length === 0) {
                console.log(`[PlayerService.getPlayer] ❌ Player not found in database`);
                return null;
            }
            
            console.log(`[PlayerService.getPlayer] ✅ Player exists in database:`, directCheck[0]);
        } catch (error) {
            console.error(`[PlayerService.getPlayer] Error in direct query:`, error);
        }
        
        // Now try the full query with joins
        try {
            const players = await queryParticipants(this.db)
                .withEvents()
                .where(eq(schema.participants.id, playerId))
                .execute();

            console.log(`[PlayerService.getPlayer] Query builder result:`, players);
            console.log(`[PlayerService.getPlayer] Result count: ${players.length}`);
            
            if (players.length === 0) {
                const debugInfo = directCheck.length > 0 
                    ? `Query builder returned empty array even though player exists. Direct query found player: ${JSON.stringify(directCheck[0])}. This suggests the query builder is not correctly parsing the result structure.`
                    : `Query builder returned empty array.`;
                console.log(`[PlayerService.getPlayer] ⚠️ ${debugInfo}`);
                
                // Try without joins to see if that works
                try {
                    const simpleQuery = await queryParticipants(this.db)
                        .where(eq(schema.participants.id, playerId))
                        .execute();
                    console.log(`[PlayerService.getPlayer] Simple query (no joins) result:`, simpleQuery);
                    
                    if (simpleQuery.length > 0) {
                        // Found it without joins - return it
                        return simpleQuery[0];
                    }
                } catch (simpleError) {
                    console.error(`[PlayerService.getPlayer] Error in simple query:`, simpleError);
                }
                
                // If we still don't have a result, construct a minimal one from the direct query
                if (directCheck.length > 0) {
                    console.log(`[PlayerService.getPlayer] Constructing ParticipantWithDetails from direct query result`);
                    return {
                        participant: directCheck[0] as Participant,
                        teams: [],
                        teamMembers: [],
                        events: [],
                    };
                }
            }

            return players.length > 0 ? players[0] : null;
        } catch (error) {
            console.error(`[PlayerService.getPlayer] Error in query builder:`, error);
            // If query builder fails but we have direct check data, return that
            if (directCheck.length > 0) {
                console.log(`[PlayerService.getPlayer] Falling back to direct query result due to query builder error`);
                return {
                    participant: directCheck[0] as Participant,
                    teams: [],
                    teamMembers: [],
                    events: [],
                };
            }
            throw error;
        }
    }

    /**
     * Get multiple players by IDs
     */
    async getPlayers(playerIds: string[]): Promise<ParticipantWithDetails[]> {
        if (playerIds.length === 0) return [];

        return await queryParticipants(this.db)
            .withEvents()
            .where(inArray(schema.participants.id, playerIds))
            .execute();
    }

    /**
     * Get all players
     */
    async getAllPlayers(): Promise<ParticipantWithDetails[]> {
        return await queryParticipants(this.db)
            .withEvents()
            .execute();
    }

    /**
     * Get players by name (case-insensitive search)
     */
    async getPlayersByName(name: string): Promise<ParticipantWithDetails[]> {
        return await queryParticipants(this.db)
            .withEvents()
            .where(
                //@ts-ignore
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
     * Throws an error if a player with the same name already exists (name is unique)
     */
    async createPlayer(
        participant: Partial<Participant>
    ): Promise<ParticipantWithDetails> {
        if (!participant.name) {
            throw new Error('Player name is required');
        }

        // Check if a player with this name already exists
        const existing = await this.db
            .select()
            .from(schema.participants)
            .where(
                and(
                    eq(schema.participants.name, participant.name),
                    eq(schema.participants.isTeam, false)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            throw new Error(`Player with name "${participant.name}" already exists`);
        }

        const playerData: ParticipantWithDetails = {
            participant: {
                id: participant.id || generateUUID(),
                name: participant.name || null,
                notes: participant.notes || null,
                lat: participant.lat ?? null,
                lng: participant.lng ?? null,
                metadata: participant.metadata || null,
                sex: participant.sex || 'UNKNOWN',
                isTeam: false,
            } as Participant,
            teams: [],
            teamMembers: [],
            events: [],
        };

        try {
            await this.savePlayer(playerData);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to save player: ${errorMessage}`);
        }

        const saved = await this.getPlayer(playerData.participant.id);
        if (!saved) {
            throw new Error(`Failed to create player: Player was saved but could not be retrieved. ID: ${playerData.participant.id}`);
        }

        return saved;
    }

    /**
     * Upsert a player by name
     * If a player with the same name exists, updates it; otherwise creates a new one
     * Returns the result type (insert, update, or unchanged) and the player
     */
    async upsertPlayer(
        participant: Partial<Participant>
    ): Promise<{ result: 'insert' | 'update' | 'unchanged'; player: ParticipantWithDetails }> {
        if (!participant.name) {
            throw new Error('Player name is required for upsert');
        }

        // Check if a player with this name already exists
        const existing = await this.db
            .select()
            .from(schema.participants)
            .where(
                and(
                    eq(schema.participants.name, participant.name),
                    eq(schema.participants.isTeam, false)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            // Update existing player
            const existingPlayer = existing[0];
            const updatedPlayer: Partial<Participant> = {
                ...participant,
                id: existingPlayer.id, // Keep the existing ID
                isTeam: false, // Ensure it stays false
            };

            // Check if anything actually changed
            const hasChanges = Object.keys(updatedPlayer).some(key => {
                return (existingPlayer as any)[key] !== (updatedPlayer as any)[key];
            });

            if (hasChanges) {
                console.log(`[PlayerService.upsertPlayer] Changes detected, updating player: ${existingPlayer.id}`);
                await this.updatePlayer(existingPlayer.id, updatedPlayer);
                const saved = await this.getPlayer(existingPlayer.id);
                if (!saved) {
                    console.error(`[PlayerService.upsertPlayer] Failed to retrieve player after update`);
                    throw new Error('Failed to update player: Player was updated but could not be retrieved. Check console for detailed debugging.');
                }
                return { result: 'update', player: saved };
            } else {
                console.log(`[PlayerService.upsertPlayer] No changes detected, retrieving existing player: ${existingPlayer.id}`);
                console.log(`[PlayerService.upsertPlayer] Existing player data:`, existingPlayer);
                
                const saved = await this.getPlayer(existingPlayer.id);
                return { result: 'unchanged', player: saved };
            }
        } else {
            // Create new player
            const newPlayer = await this.createPlayer(participant);
            return { result: 'insert', player: newPlayer };
        }
    }

    /**
     * Update a player
     */
    async updatePlayer(
        playerId: string,
        updates: Partial<Participant>
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

