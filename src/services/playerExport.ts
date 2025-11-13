/**
 * Player Export/Import
 * Handles exporting and importing player data in a human-readable format
 * Includes both UUIDs and human-readable names for merging support
 */

import { UserInsert } from './storage/userStorage';
import { EntityType } from '@/types';
import { getStorageId } from './storage/platform/platformStorage';
import { saveUser, getUserByName, generateUserId, getUserById } from './storage/userStorage';
import { getLocalUuidForForeign, mapForeignToLocal } from './storage/uuidMerge';
import { setCurrentUserId, getCurrentUserId } from './storage/platform/currentUserStorage';
import { normalizeExportText } from '@/utils';

/**
 * Export a player to a human-readable text format
 * Includes both UUID and name for merging support
 */
export async function exportPlayer(playerId: string): Promise<string> {
  const player = await getUserById(playerId);
  
  if (!player) {
    throw new Error('Player not found');
  }
  
  const storageId = await getStorageId();
  const lines: string[] = [];
  
  // Header
  lines.push('=== GULFER PLAYER EXPORT ===');
  lines.push(`Storage ID: ${storageId}`);
  lines.push(`Player ID: ${player.id}`);
  lines.push(`Player Name: ${player.name}`);
  lines.push('');
  
  // Check if this player is the current user
  const currentUserId = await getCurrentUserId();
  if (currentUserId === player.id) {
    lines.push('Is Current User: true');
    lines.push('');
  }
  
  lines.push('=== END EXPORT ===');
  
  const text = lines.join('\n');
  // Normalize the exported text to ensure it uses regular newlines
  return normalizeExportText(text);
}

/**
 * Parse exported player text
 */
export interface ParsedPlayerExport {
  storageId?: string;
  playerId?: string;
  playerName?: string;
  isCurrentUser?: boolean;
}

export function parsePlayerExport(exportText: string): ParsedPlayerExport {
  // Normalize the text to replace non-breaking spaces with newlines
  const normalizedText = normalizeExportText(exportText);
  const lines = normalizedText.split('\n').map(l => l.trim());
  const parsed: ParsedPlayerExport = {};
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    if (line.startsWith('Storage ID:')) {
      parsed.storageId = line.substring('Storage ID:'.length).trim();
    } else if (line.startsWith('Player ID:')) {
      parsed.playerId = line.substring('Player ID:'.length).trim();
    } else if (line.startsWith('Player Name:')) {
      parsed.playerName = line.substring('Player Name:'.length).trim();
    } else if (line.startsWith('Is Current User:')) {
      parsed.isCurrentUser = line.substring('Is Current User:'.length).trim().toLowerCase() === 'true';
    } else if (line === '=== END EXPORT ===') {
      break;
    }
    
    i++;
  }
  
  return parsed;
}

/**
 * Import a player from exported text
 * Supports merging with existing players via UUID mapping
 */
export async function importPlayer(
  exportText: string,
  manualMapping?: { foreignPlayerId: string; localPlayerId: string }
): Promise<string> {
  const parsed = parsePlayerExport(exportText);
  
  if (!parsed.playerName) {
    throw new Error('Player name is missing from export');
  }
  
  const localStorageId = await getStorageId();
  const foreignStorageId = parsed.storageId;
  
  // Check if importing from same storage
  if (foreignStorageId && foreignStorageId === localStorageId) {
    throw new Error('Cannot import player from the same storage instance');
  }
  
  let localPlayerId: string | undefined;
  
  if (parsed.playerId && foreignStorageId) {
    // Check for manual mapping first
    if (manualMapping && manualMapping.foreignPlayerId === parsed.playerId) {
      localPlayerId = manualMapping.localPlayerId;
      await mapForeignToLocal(foreignStorageId, parsed.playerId, localPlayerId, EntityType.Players);
    } else {
      // Check if already mapped
      const existingMapping = await getLocalUuidForForeign(foreignStorageId, parsed.playerId, EntityType.Players);
      
      if (existingMapping) {
        localPlayerId = existingMapping;
      } else {
        // Check if player with same name exists
        const existingPlayer = await getUserByName(parsed.playerName);
        
        if (existingPlayer) {
          // Map to existing player
          localPlayerId = existingPlayer.id;
          await mapForeignToLocal(foreignStorageId, parsed.playerId, existingPlayer.id, EntityType.Players);
        } else {
          // Create new player
          localPlayerId = generateUserId();
          const newPlayer: UserInsert = {
            id: localPlayerId,
            name: parsed.playerName,
            notes: null,
            latitude: null,
            longitude: null,
            isTeam: false,
          };
          await saveUser(newPlayer);
          
          // If this was the current user, set it
          if (parsed.isCurrentUser) {
            await setCurrentUserId(localPlayerId);
          }
          
          // Map foreign player to new local player
          await mapForeignToLocal(foreignStorageId, parsed.playerId, localPlayerId, EntityType.Players);
        }
      }
    }
  } else {
    // Import without UUID - find by name or create new
    const existingPlayer = await getUserByName(parsed.playerName);
    
    if (existingPlayer) {
      localPlayerId = existingPlayer.id;
    } else {
      localPlayerId = await generateUserId();
      const newPlayer: UserInsert = {
        id: localPlayerId,
        name: parsed.playerName,
        notes: null,
        latitude: null,
        longitude: null,
        isTeam: false,
      };
      await saveUser(newPlayer);
      
      // If this was the current user, set it
      if (parsed.isCurrentUser) {
        await setCurrentUserId(localPlayerId);
      }
    }
  }
  
  if (!localPlayerId) {
    throw new Error('Failed to import player');
  }
  
  return localPlayerId;
}

