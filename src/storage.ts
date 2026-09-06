import { atmospheres } from './presets';
import { SOUND_PRESETS } from './sound-presets';
import type { AtmosphereId, SoundIdentity, SoundSettings } from './audio';

const CURRENT_KEY = 'stillroom.current.v1';
export const SAVED_KEY = 'stillroom.saved.v1';
export interface CurrentPlace { atmosphere: AtmosphereId; settings: SoundSettings; identity: SoundIdentity }
export interface Place extends CurrentPlace { id: string; name: string }
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const basicKeys = ['warmth', 'darkness', 'movement', 'rain', 'volume'] as const;
const advancedKeys = ['space', 'density', 'drift', 'tension'] as const;
const isLevel = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** Older saved atmospheres gain a synth identity without losing their settings. */
function readCurrent(v: unknown): CurrentPlace | null {
  if (!isRecord(v) || (v.atmosphere !== 'city' && v.atmosphere !== 'afternoon') || !isRecord(v.settings)) return null;
  const values = v.settings;
  if (!basicKeys.every(k => isLevel(values[k]))) return null;
  if (!advancedKeys.every(k => values[k] === undefined || isLevel(values[k]))) return null;
  const defaults = atmospheres[v.atmosphere].defaults;
  const settings = Object.fromEntries([...basicKeys, ...advancedKeys].map(key => [key, values[key] ?? defaults[key]])) as unknown as SoundSettings;
  let identity: SoundIdentity = { preset: v.atmosphere === 'city' ? 'velvet' : 'tape', seed: 7103 };
  if (v.identity !== undefined) {
    const sound = v.identity;
    if (!isRecord(sound) || !SOUND_PRESETS.some(p => p.id === sound.preset)
      || typeof sound.seed !== 'number' || !Number.isInteger(sound.seed)
      || sound.seed < 0 || sound.seed > 0xffffffff) return null;
    identity = { preset: sound.preset, seed: sound.seed } as SoundIdentity;
  }
  return { atmosphere: v.atmosphere, settings, identity };
}

export function loadCurrent(): CurrentPlace {
  try {
    const value = readCurrent(JSON.parse(localStorage.getItem(CURRENT_KEY) || 'null'));
    if (value) return value;
  } catch { /* Unavailable storage falls back to the first atmosphere. */ }
  return { atmosphere: 'city', settings: { ...SOUND_PRESETS[0].settings }, identity: { preset: 'velvet', seed: 7103 } };
}

export function loadSaved(): Place[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    const result: Place[] = [];
    const ids = new Set<string>();
    for (const p of value) {
      const current = readCurrent(p);
      if (!current || !isRecord(p) || typeof p.id !== 'string' || typeof p.name !== 'string'
        || !p.name.trim() || p.name.length > 48 || ids.has(p.id)) continue;
      ids.add(p.id);
      result.push({ ...current, id: p.id, name: p.name });
      if (result.length === 50) break;
    }
    return result;
  } catch { return []; }
}

export function saveCurrent(value: CurrentPlace): boolean {
  try { localStorage.setItem(CURRENT_KEY, JSON.stringify(value)); return true; } catch { return false; }
}
export function savePlaces(value: Place[]): boolean {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(value)); return true; } catch { return false; }
}
