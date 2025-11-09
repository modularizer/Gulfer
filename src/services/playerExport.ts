/**
 * Player Export/Import
 * Handles exporting and importing player data in a human-readable format
 * Includes both UUIDs and human-readable names for merging support
 */

import { User } from './storage/userStorage';
import { getStorageId } from './storage/storageId';
import { saveUser, getUserByName, generateUserId } from './storage/userStorage';
import { getLocalUuidForForeign, mapForeignToLocal } from './storage/uuidMerge';

/**
 * Export a player to a human-readable text format
 * Includes both UUID and name for merging support
 */
export async function exportPlayer(playerId: string): Promise<string> {
  const { getUserById } = await import('./storage/userStorage');
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
  
  if (player.isCurrentUser) {
    lines.push('Is Current User: true');
    lines.push('');
  }
  
  lines.push('=== END EXPORT ===');
  
  return lines.join('\n');
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
  const lines = exportText.split('\n').map(l => l.trim());
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
      await mapForeignToLocal(foreignStorageId, parsed.playerId, localPlayerId, 'player');
    } else {
      // Check if already mapped
      const existingMapping = await getLocalUuidForForeign(foreignStorageId, parsed.playerId, 'player');
      
      if (existingMapping) {
        localPlayerId = existingMapping;
      } else {
        // Check if player with same name exists
        const existingPlayer = await getUserByName(parsed.playerName);
        
        if (existingPlayer) {
          // Map to existing player
          localPlayerId = existingPlayer.id;
          await mapForeignToLocal(foreignStorageId, parsed.playerId, existingPlayer.id, 'player');
        } else {
          // Create new player
          localPlayerId = await generateUserId();
          const newPlayer: User = {
            id: localPlayerId,
            name: parsed.playerName,
            isCurrentUser: parsed.isCurrentUser || false,
          };
          await saveUser(newPlayer);
          
          // Map foreign player to new local player
          await mapForeignToLocal(foreignStorageId, parsed.playerId, localPlayerId, 'player');
        }
      }
    }
  } else {
    // Legacy import without UUID - just find by name or create new
    const existingPlayer = await getUserByName(parsed.playerName);
    
    if (existingPlayer) {
      localPlayerId = existingPlayer.id;
    } else {
      localPlayerId = await generateUserId();
      const newPlayer: User = {
        id: localPlayerId,
        name: parsed.playerName,
        isCurrentUser: parsed.isCurrentUser || false,
      };
      await saveUser(newPlayer);
    }
  }
  
  if (!localPlayerId) {
    throw new Error('Failed to import player');
  }
  
  return localPlayerId;
}

