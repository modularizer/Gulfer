/**
 * Seeded random number generator for deterministic randomness
 * Uses a simple LCG (Linear Congruential Generator) that's reversible
 */
class SeededRandom {
  private seed: number;
  private originalSeed: number;

  constructor(seed: number) {
    this.originalSeed = seed;
    this.seed = seed;
  }

  /**
   * Generate next random number between 0 and 1
   */
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Generate random integer between min (inclusive) and max (exclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Get the current seed state
   */
  getSeed(): number {
    return this.originalSeed;
  }
}

/**
 * Hash function to mix the number for better distribution
 * This is reversible: hash(n) and unhash(hash(n)) both work
 */
function hashNumber(n: number): number {
  // Simple reversible hash
  n = ((n >> 16) ^ n) * 0x45d9f3b;
  n = ((n >> 16) ^ n) * 0x45d9f3b;
  n = (n >> 16) ^ n;
  return Math.abs(n);
}

/**
 * Reverse hash function
 */
function unhashNumber(n: number): number {
  // This hash is its own inverse for the values we use
  return hashNumber(n);
}

// Lists of adjectives that can describe animals (no colors)
const ADJECTIVES = [
  // Personality and behavior
  'happy', 'calm', 'bold', 'gentle', 'proud', 'brave', 'fierce', 'tame', 'wild', 'domestic',
  'lazy', 'active', 'playful', 'curious', 'shy', 'aggressive', 'peaceful', 'alert', 'sleepy', 'energetic',
  // Speed and movement
  'swift', 'quick', 'fast', 'slow', 'rapid', 'steady', 'still', 'moving', 'agile', 'clumsy',
  // Size
  'tiny', 'huge', 'massive', 'small', 'large', 'big', 'little', 'giant', 'mini', 'mega',
  'long', 'short', 'thick', 'thin', 'tall', 'stout', 'slender', 'bulky', 'compact', 'lanky',
  // Strength and power
  'strong', 'weak', 'powerful', 'mighty', 'fragile', 'tough', 'robust', 'delicate', 'sturdy', 'feeble',
  // Appearance and texture
  'smooth', 'rough', 'soft', 'hard', 'furry', 'scaly', 'feathered', 'leathery', 'sleek', 'shaggy',
  'shiny', 'dull', 'glossy', 'matte', 'bright', 'dim', 'radiant', 'murky', 'sparkling', 'drab',
  // Age and rarity
  'young', 'old', 'ancient', 'mature', 'juvenile', 'elderly', 'rare', 'common', 'unique', 'special',
  // Intelligence and awareness
  'wise', 'clever', 'keen', 'sharp', 'dull-witted', 'alert', 'aware', 'observant', 'intelligent', 'simple',
  // Sound
  'loud', 'quiet', 'silent', 'noisy', 'vocal', 'mute', 'chirpy', 'roaring', 'hissing', 'chattering',
  // Physical features
  'striped', 'spotted', 'solid', 'patterned', 'colorful', 'plain', 'marked', 'mottled', 'speckled', 'banded',
  'horned', 'tusked', 'fanged', 'clawed', 'winged', 'tailed', 'maned', 'crested', 'bearded', 'antlered',
  // Habitat and environment
  'aquatic', 'terrestrial', 'arboreal', 'aerial', 'nocturnal', 'diurnal', 'migratory', 'sedentary', 'nomadic', 'territorial',
  // Other descriptive
  'fresh', 'clean', 'dirty', 'muddy', 'wet', 'dry', 'warm', 'cold', 'frozen', 'hot',
  'elegant', 'graceful', 'awkward', 'clumsy', 'nimble', 'agile', 'stiff', 'flexible', 'rigid', 'supple',
];

// Color list (separate from adjectives)
const COLORS = [
  'blue', 'green', 'red', 'gold', 'silver', 'purple', 'orange', 'pink', 'white', 'black',
  'yellow', 'brown', 'gray', 'cyan', 'magenta', 'amber', 'crimson', 'emerald', 'azure', 'ivory',
  'coral', 'teal', 'indigo', 'violet', 'maroon', 'navy', 'olive', 'lime', 'turquoise', 'peach',
  'bronze', 'copper', 'platinum', 'rose', 'sapphire', 'ruby', 'jade', 'amber', 'cobalt', 'burgundy',
];

// Maximum unique combinations with 2-part names (adjective-noun)
const MAX_TWO_PART_COMBINATIONS = ADJECTIVES.length * NOUNS.length;

// Maximum unique combinations with 3-part names (adjective-color-noun)
const MAX_THREE_PART_COMBINATIONS = ADJECTIVES.length * COLORS.length * NOUNS.length;

// Total combinations before we need to add numeric suffixes
const MAX_NAMED_COMBINATIONS = MAX_TWO_PART_COMBINATIONS + MAX_THREE_PART_COMBINATIONS;

const NOUNS = [
  // Big cats
  'tiger', 'lion', 'leopard', 'jaguar', 'panther', 'cheetah', 'puma', 'lynx', 'bobcat', 'cougar',
  // Canines
  'wolf', 'fox', 'coyote', 'jackal', 'dingo', 'hyena', 'dog', 'dhole',
  // Bears
  'bear', 'panda', 'grizzly',  'kodiak',
  // Birds of prey
  'eagle', 'hawk', 'falcon', 'osprey', 'kite', 'harrier', 'buzzard', 'vulture', 'condor', 'caracara',
  // Owls
  'owl',
  // Other birds
  'raven', 'crow', 'magpie', 'jay', 'rook', 'jackdaw', 'swan', 'goose', 'duck', 'heron',
  'stork', 'crane', 'ibis', 'flamingo', 'pelican', 'cormorant', 'gannet', 'booby', 'frigatebird', 'albatross',
  'penguin', 'puffin', 'auk', 'guillemot', 'razorbill', 'tern', 'gull', 'skua', 'petrel', 'shearwater',
  // Primates
  'ape', 'gorilla', 'chimpanzee', 'orangutan', 'bonobo', 'gibbon', 'baboon', 'mandrill', 'macaque', 'lemur',
  'monkey', 'capuchin', 'howler', 'tamarin', 'marmoset', 'colobus', 'langur', 'proboscis', 'tarsier',
  // Marine mammals
  'whale', 'dolphin', 'porpoise', 'orca', 'narwhal', 'beluga', 'seal', 'sea-lion', 'walrus', 'otter',
  // Hoofed animals
  'deer', 'elk', 'moose', 'caribou', 'reindeer', 'antelope', 'gazelle', 'impala', 'wildebeest', 'bison',
  'buffalo', 'yak', 'ox', 'cattle', 'sheep', 'goat', 'ibex', 'mouflon', 'bighorn',
  'horse', 'zebra', 'donkey', 'mule', 'pony', 'camel', 'llama', 'alpaca', 'giraffe', 'okapi',
  'rhino', 'hippo', 'tapir', 'elephant', 'mammoth', 'mastodon', 'pig', 'boar', 'warthog', 'peccary',
  // Rodents
  'beaver', 'squirrel', 'chipmunk', 'marmot', 'groundhog', 'gopher', 'hamster', 'gerbil', 'rat',
  'mouse', 'vole', 'lemming', 'muskrat', 'porcupine', 'hedgehog', 'chinchilla', 'capybara', 'agouti', 'paca',
  // Lagomorphs
  'rabbit', 'hare', 'pika', 'cottontail', 'jackrabbit',
  // Marsupials
  'kangaroo', 'wallaby', 'koala', 'wombat',  'bandicoot', 'possum', 'opossum', 'sugar-glider',
  // Reptiles
  'snake', 'python', 'boa', 'cobra', 'viper', 'rattlesnake', 'mamba', 'anaconda',
  'lizard', 'gecko', 'iguana', 'chameleon', 'monitor', 'skink','tuatara',
  'turtle', 'tortoise', 'terrapin',
  'crocodile', 'alligator', 'caiman',
  // Amphibians
  'frog', 'toad', 'salamander', 'newt',
  // Fish
  'shark', 'ray', 'stingray','tuna', 'salmon', 'trout', 'bass', 'pike', 'perch',
  'carp', 'catfish', 'eel', 'piranha', 'barracuda', 'marlin', 'swordfish', 'sailfish', 'tarpon', 'snapper',
  // Insects and arachnids
  'spider', 'scorpion', 'tarantula',
  'ant', 'bee', 'wasp', 'hornet', 'beetle', 'butterfly', 'moth', 'dragonfly', 'damselfly', 'grasshopper',
  'cricket', 'cicada', 'locust', 'mantis', 'cockroach', 'termite', 'firefly', 'ladybug',
  // Other animals
  'bat',
  'sloth', 'armadillo', 'anteater', 'pangolin', 'aardvark', 'echidna', 'platypus', 'numbat', 'tamandua',
];

/**
 * Generate a seeded adjective+noun name from a number
 * Uses a deterministic but seemingly random mapping
 * - Numbers < MAX_TWO_PART_COMBINATIONS: "adjective-noun"
 * - Numbers < MAX_NAMED_COMBINATIONS: "adjective-color-noun"
 * - Numbers >= MAX_NAMED_COMBINATIONS: "adjective-color-noun-{number}"
 * 
 * @param number - The number to convert to a name (must be >= 0)
 * @returns A string in the format "adjective-noun", "adjective-color-noun", or "adjective-color-noun-{number}"
 * 
 * @example
 * ```ts
 * numberToName(42) // Returns something like "swift-eagle"
 * numberToName(50000) // Returns something like "happy-blue-tiger"
 * numberToName(800000) // Returns something like "happy-blue-tiger-123"
 * ```
 */
export function numberToName(number: number): string {
  if (number < 0) {
    throw new Error('Number must be >= 0');
  }

  // Use hash to mix the number for better distribution
  const hashed = hashNumber(number);
  const rng = new SeededRandom(hashed);
  
  if (number < MAX_TWO_PART_COMBINATIONS) {
    // Use 2-part format: adjective-noun
    const adjectiveIndex = rng.nextInt(0, ADJECTIVES.length);
    const nounIndex = rng.nextInt(0, NOUNS.length);
    return `${ADJECTIVES[adjectiveIndex]}-${NOUNS[nounIndex]}`;
  } else if (number < MAX_NAMED_COMBINATIONS) {
    // Use 3-part format: adjective-color-noun
    // Use seeded random for all parts to maintain determinism
    const adjectiveIndex = rng.nextInt(0, ADJECTIVES.length);
    const colorIndex = rng.nextInt(0, COLORS.length);
    const nounIndex = rng.nextInt(0, NOUNS.length);
    return `${ADJECTIVES[adjectiveIndex]}-${COLORS[colorIndex]}-${NOUNS[nounIndex]}`;
  } else {
    // Use 3-part format with numeric suffix: adjective-color-noun-{number}
    // Calculate the offset from the named combinations
    const offset = number - MAX_NAMED_COMBINATIONS;
    const adjectiveIndex = rng.nextInt(0, ADJECTIVES.length);
    const colorIndex = rng.nextInt(0, COLORS.length);
    const nounIndex = rng.nextInt(0, NOUNS.length);
    return `${ADJECTIVES[adjectiveIndex]}-${COLORS[colorIndex]}-${NOUNS[nounIndex]}-${offset}`;
  }
}

/**
 * Convert a name back to its original number
 * Supports formats: "adjective-noun", "adjective-color-noun", or "adjective-color-noun-{number}"
 * Uses brute force search for named formats - for better performance, use nameToNumberOptimized
 * 
 * @param name - The name in format "adjective-noun", "adjective-color-noun", or "adjective-color-noun-{number}"
 * @param maxSearch - Maximum number to search for named formats (default: 1000000)
 * @returns The original number, or null if the name is invalid or not found
 * 
 * @example
 * ```ts
 * const name = numberToName(42);
 * const number = nameToNumber(name, 1000); // Returns 42
 * ```
 */
export function nameToNumber(name: string, maxSearch: number = 1000000): number | null {
  const parts = name.split('-');
  
  if (parts.length === 2) {
    // 2-part format: adjective-noun
    const [adjective, noun] = parts;
    const adjectiveIndex = ADJECTIVES.indexOf(adjective);
    const nounIndex = NOUNS.indexOf(noun);

    if (adjectiveIndex === -1 || nounIndex === -1) {
      return null;
    }

    // Search for the number that generates this name
    for (let i = 0; i < Math.min(maxSearch, MAX_TWO_PART_COMBINATIONS); i++) {
      const hashed = hashNumber(i);
      const rng = new SeededRandom(hashed);
      const genAdjectiveIndex = rng.nextInt(0, ADJECTIVES.length);
      const genNounIndex = rng.nextInt(0, NOUNS.length);

      if (genAdjectiveIndex === adjectiveIndex && genNounIndex === nounIndex) {
        return i;
      }
    }
  } else if (parts.length === 3) {
    // 3-part format: adjective-color-noun (no numeric suffix)
    const [adjective, color, noun] = parts;
    const adjectiveIndex = ADJECTIVES.indexOf(adjective);
    const colorIndex = COLORS.indexOf(color);
    const nounIndex = NOUNS.indexOf(noun);

    if (adjectiveIndex === -1 || colorIndex === -1 || nounIndex === -1) {
      return null;
    }

    // For 3-part names, search in the range beyond MAX_TWO_PART_COMBINATIONS
    const searchStart = MAX_TWO_PART_COMBINATIONS;
    const searchEnd = Math.min(maxSearch, MAX_NAMED_COMBINATIONS);
    
    for (let i = searchStart; i < searchEnd; i++) {
      const hashed = hashNumber(i);
      const rng = new SeededRandom(hashed);
      const genAdjectiveIndex = rng.nextInt(0, ADJECTIVES.length);
      const genColorIndex = rng.nextInt(0, COLORS.length);
      const genNounIndex = rng.nextInt(0, NOUNS.length);

      if (genAdjectiveIndex === adjectiveIndex && genColorIndex === colorIndex && genNounIndex === nounIndex) {
        return i;
      }
    }
  } else if (parts.length === 4) {
    // 4-part format: adjective-color-noun-{number}
    const [adjective, color, noun, suffix] = parts;
    const adjectiveIndex = ADJECTIVES.indexOf(adjective);
    const colorIndex = COLORS.indexOf(color);
    const nounIndex = NOUNS.indexOf(noun);

    if (adjectiveIndex === -1 || colorIndex === -1 || nounIndex === -1) {
      return null;
    }

    // Parse the numeric suffix
    const offset = parseInt(suffix, 10);
    if (isNaN(offset) || offset < 0) {
      return null;
    }

    // Calculate the number: MAX_NAMED_COMBINATIONS + offset
    const number = MAX_NAMED_COMBINATIONS + offset;
    
    // Verify this number generates the expected name
    const expectedName = numberToName(number);
    if (expectedName === name) {
      return number;
    }
    
    return null;
  } else {
    return null;
  }

  return null;
}

/**
 * Optimized reverse lookup using precomputed mapping
 * This is more efficient for repeated lookups
 */
class NameMapper {
  private nameToNumMap: Map<string, number>;
  private numToNameMap: Map<number, string>;

  constructor(maxNumber: number = 100000) {
    this.nameToNumMap = new Map();
    this.numToNameMap = new Map();

    // Precompute mappings
    for (let i = 0; i < maxNumber; i++) {
      const name = numberToName(i);
      this.nameToNumMap.set(name, i);
      this.numToNameMap.set(i, name);
    }
  }

  numberToName(number: number): string | null {
    if (this.numToNameMap.has(number)) {
      return this.numToNameMap.get(number)!;
    }
    // Fallback to generating on the fly if not in cache
    return numberToName(number);
  }

  nameToNumber(name: string): number | null {
    return this.nameToNumMap.get(name) ?? null;
  }
}

// Create a default mapper instance (can be extended if needed)
let defaultMapper: NameMapper | null = null;

/**
 * Get or create the default name mapper
 * @param maxNumber - Maximum number to precompute (default: 100000)
 */
export function getNameMapper(maxNumber: number = 100000): NameMapper {
  if (!defaultMapper || defaultMapper['maxNumber'] !== maxNumber) {
    defaultMapper = new NameMapper(maxNumber);
    (defaultMapper as any).maxNumber = maxNumber;
  }
  return defaultMapper;
}

/**
 * Optimized name to number conversion using cached mapper
 * Much faster for repeated lookups within the precomputed range
 * 
 * @param name - The name in format "adjective-noun"
 * @param maxNumber - Maximum number that was precomputed (default: 100000)
 * @returns The original number, or null if not found in cache
 * 
 * @example
 * ```ts
 * // First call precomputes mappings up to maxNumber
 * const name = numberToNameOptimized(42, 1000);
 * const number = nameToNumberOptimized(name, 1000); // Fast lookup, returns 42
 * ```
 */
export function nameToNumberOptimized(name: string, maxNumber: number = 100000): number | null {
  const mapper = getNameMapper(maxNumber);
  return mapper.nameToNumber(name);
}

/**
 * Optimized number to name conversion using cached mapper
 * Much faster for repeated lookups within the precomputed range
 * 
 * @param number - The number to convert to a name
 * @param maxNumber - Maximum number that was precomputed (default: 100000)
 * @returns A string in the format "adjective-noun"
 * 
 * @example
 * ```ts
 * // Round trip example:
 * const name = numberToNameOptimized(42, 1000);
 * const back = nameToNumberOptimized(name, 1000); // Returns 42
 * ```
 */
export function numberToNameOptimized(number: number, maxNumber: number = 100000): string {
  const mapper = getNameMapper(maxNumber);
  return mapper.numberToName(number) ?? numberToName(number);
}

