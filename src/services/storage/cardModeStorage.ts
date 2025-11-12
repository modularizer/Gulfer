import { CardMode } from '@/components/common/CardModeToggle';
import { getItem, setItem } from './drivers';

const STORAGE_PREFIX = '@gulfer_card_mode_';
const cache = new Map<string, CardMode>();

function makeKey(page: string) {
  return `${STORAGE_PREFIX}${page}`;
}

function isValidMode(mode: string | null): mode is CardMode {
  return mode === 'list' || mode === 'small' || mode === 'medium' || mode === 'large';
}

export function getCachedCardMode(page: string, fallback: CardMode = 'medium'): CardMode {
  return cache.get(page) ?? fallback;
}

export async function loadCardMode(page: string, fallback: CardMode = 'medium'): Promise<CardMode> {
  if (cache.has(page)) {
    return cache.get(page)!;
  }

  try {
    const stored = await getItem(makeKey(page));
    if (isValidMode(stored)) {
      cache.set(page, stored);
      return stored;
    }
  } catch (error) {
    console.error('Error loading card mode', page, error);
  }

  cache.set(page, fallback);
  return fallback;
}

export async function saveCardMode(page: string, mode: CardMode): Promise<void> {
  cache.set(page, mode);
  try {
    await setItem(makeKey(page), mode);
  } catch (error) {
    console.error('Error saving card mode', page, error);
    throw error;
  }
}
