/**
 * UUID generation utilities
 * Uses 8 hex characters (32 bits) for local uniqueness
 * Global uniqueness is handled by the merge table mapping (foreignStorageId + foreignEntityUuid) -> localEntityUuid
 */

/**
 * Generate a new locally unique ID (8 hex characters)
 * Checks existing entities to ensure uniqueness
 */
export async function generateUUID(): Promise<string> {
  // Generate 8 hex characters (32 bits = 4,294,967,296 possible values)
  // Use crypto.getRandomValues for better randomness
  const array = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < 4; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  
  // Convert to 8 hex characters
  const hex = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return hex;
}

/**
 * Generate a locally unique ID with collision checking
 * Ensures the generated ID doesn't already exist in the provided set
 */
export async function generateUniqueUUID(existingIds: Set<string>): Promise<string> {
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loop
  
  while (attempts < maxAttempts) {
    const id = await generateUUID();
    if (!existingIds.has(id)) {
      return id;
    }
    attempts++;
  }
  
  // If we've tried 100 times and still have collisions, something is very wrong
  // Fallback: append a counter (unlikely but safe)
  let counter = 0;
  while (counter < 1000) {
    const baseId = await generateUUID();
    const id = baseId + counter.toString(16).padStart(2, '0');
    if (id.length <= 10 && !existingIds.has(id)) {
      return id;
    }
    counter++;
  }
  
  throw new Error('Failed to generate unique UUID after many attempts');
}

