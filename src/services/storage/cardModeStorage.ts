/**
 * Card mode storage
 * Uses Drizzle ORM directly - stores in settings table
 */

import { CardMode } from '@/components/common/CardModeToggle';
import { getSettings, updateSettings } from './settingsHelper';

function isValidMode(mode: string | null): mode is CardMode {
  return mode === 'list' || mode === 'small' || mode === 'medium' || mode === 'large';
}

export async function loadCardMode(page: string, fallback: CardMode = 'medium'): Promise<CardMode> {
  const settings = await getSettings();
  
  if (settings.cardModes) {
    const stored = settings.cardModes[page];
    if (isValidMode(stored)) {
      return stored;
    }
  }

  return fallback;
}

export async function saveCardMode(page: string, mode: CardMode): Promise<void> {
  const settings = await getSettings();
  
  const cardModes = settings.cardModes
    ? { ...settings.cardModes }
    : {};
  
  cardModes[page] = mode;
  
  await updateSettings({ cardModes });
}
