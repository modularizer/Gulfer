/**
 * UUID generation utilities
 * Uses 16 hex characters (64 bits) for local uniqueness
 * Global uniqueness is handled by the merge table mapping (foreignStorageId + foreignEntityUuid) -> localEntityUuid
 */

/**
 * Generate a new UUID (16 hex characters)
 * With 64 bits of randomness, collision probability is extremely low (1 in 18+ quintillion)
 * No uniqueness checking needed
 */
export async function generateUUID(): Promise<string> {
  // Generate 16 hex characters (64 bits = 18,446,744,073,709,551,616 possible values)
  // Use crypto.getRandomValues for better randomness
  const array = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < 8; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  
  // Convert to 16 hex characters
  const hex = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return hex;
}

/**
 * Generate a UUID (alias for generateUUID for backward compatibility)
 * No uniqueness checking - collision probability is negligible with 16 hex characters
 */
export async function generateUniqueUUID(_existingIds?: Set<string>): Promise<string> {
  return generateUUID();
}

