import type { SoundSettings } from './audio';

export type SoundPresetId =
  | 'velvet' | 'tape' | 'glass' | 'orbit' | 'bloom'
  | 'horizon' | 'ember' | 'tide' | 'mist' | 'aurora';

export interface SoundIdentity {
  preset: SoundPresetId;
  seed: number;
}

export interface SoundPreset {
  id: SoundPresetId;
  name: string;
  description: string;
  settings: SoundSettings;
}

export const SOUND_PRESETS: SoundPreset[] = [
  {
    id: 'velvet', name: 'Velvet room',
    description: 'Soft analog chords, close and unhurried.',
    settings: { warmth: .78, darkness: .56, movement: .24, rain: .02, volume: .5, space: .46, density: .52, drift: .25, tension: .12 },
  },
  {
    id: 'tape', name: 'Tape afternoon',
    description: 'Warm, worn keys with a little pitch wander.',
    settings: { warmth: .86, darkness: .34, movement: .37, rain: .02, volume: .5, space: .37, density: .44, drift: .72, tension: .2 },
  },
  {
    id: 'glass', name: 'Glass garden',
    description: 'Clear, delicate tones suspended in air.',
    settings: { warmth: .29, darkness: .2, movement: .32, rain: 0, volume: .5, space: .78, density: .28, drift: .16, tension: .26 },
  },
  {
    id: 'orbit', name: 'Quiet orbit',
    description: 'Deep, spacious drones with a distant shimmer.',
    settings: { warmth: .38, darkness: .8, movement: .28, rain: .02, volume: .5, space: .9, density: .38, drift: .4, tension: .38 },
  },
  {
    id: 'bloom', name: 'Slow bloom',
    description: 'Gentle strings opening into warm harmony.',
    settings: { warmth: .69, darkness: .31, movement: .55, rain: 0, volume: .5, space: .64, density: .69, drift: .28, tension: .16 },
  },
  {
    id: 'horizon', name: 'Open horizon',
    description: 'Wide, airy chords with room to breathe.',
    settings: { warmth: .52, darkness: .25, movement: .35, rain: .03, volume: .5, space: .88, density: .35, drift: .3, tension: .1 },
  },
  {
    id: 'ember', name: 'Ember glow',
    description: 'Low, rounded tones settling into stillness.',
    settings: { warmth: .93, darkness: .76, movement: .16, rain: 0, volume: .5, space: .42, density: .57, drift: .19, tension: .14 },
  },
  {
    id: 'tide', name: 'Distant tide',
    description: 'Long, slow swells beneath a wash of rain.',
    settings: { warmth: .51, darkness: .58, movement: .68, rain: .39, volume: .5, space: .76, density: .47, drift: .48, tension: .25 },
  },
  {
    id: 'mist', name: 'Morning mist',
    description: 'Muted, weightless harmony and soft rainfall.',
    settings: { warmth: .58, darkness: .47, movement: .23, rain: .26, volume: .5, space: .84, density: .26, drift: .32, tension: .12 },
  },
  {
    id: 'aurora', name: 'Pale aurora',
    description: 'Cool, luminous layers moving slowly overhead.',
    settings: { warmth: .26, darkness: .37, movement: .58, rain: .01, volume: .5, space: .91, density: .61, drift: .52, tension: .43 },
  },
];

interface VariationProfile {
  tone: number;
  motion: number;
  texture: number;
  rain: number;
}

// Keep the defining character of each voice while letting its surroundings vary.
const profiles: Record<SoundPresetId, VariationProfile> = {
  velvet: { tone: .1, motion: .09, texture: .12, rain: .025 },
  tape: { tone: .09, motion: .13, texture: .12, rain: .025 },
  glass: { tone: .08, motion: .1, texture: .1, rain: .02 },
  orbit: { tone: .1, motion: .12, texture: .14, rain: .03 },
  bloom: { tone: .1, motion: .16, texture: .15, rain: .02 },
  horizon: { tone: .09, motion: .11, texture: .13, rain: .03 },
  ember: { tone: .07, motion: .07, texture: .11, rain: .02 },
  tide: { tone: .12, motion: .15, texture: .15, rain: .13 },
  mist: { tone: .1, motion: .09, texture: .11, rain: .1 },
  aurora: { tone: .11, motion: .16, texture: .13, rain: .025 },
};

function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let n = Math.imul(seed ^ (seed >>> 15), seed | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateVariation(
  presetId: SoundPresetId,
  seed: number,
): { identity: SoundIdentity; settings: SoundSettings } {
  const preset = SOUND_PRESETS.find((candidate) => candidate.id === presetId) ?? SOUND_PRESETS[0];
  const normalizedSeed = Number.isFinite(seed) ? seed >>> 0 : 0;
  const presetIndex = SOUND_PRESETS.indexOf(preset);
  const random = seededRandom(normalizedSeed ^ Math.imul(presetIndex + 1, 0x9e3779b9));
  const profile = profiles[preset.id];
  const vary = (value: number, amount: number, maximum = 1) =>
    Math.round(Math.max(0, Math.min(maximum, value + (random() * 2 - 1) * amount)) * 1000) / 1000;
  const base = preset.settings;

  return {
    identity: { preset: preset.id, seed: normalizedSeed },
    settings: {
      warmth: vary(base.warmth, profile.tone),
      darkness: vary(base.darkness, profile.tone),
      movement: vary(base.movement, profile.motion),
      rain: vary(base.rain, profile.rain, preset.id === 'tide' || preset.id === 'mist' ? .65 : .12),
      volume: .5,
      space: vary(base.space, profile.texture),
      density: vary(base.density, profile.texture),
      drift: vary(base.drift, profile.motion),
      tension: vary(base.tension, profile.tone * .7),
    },
  };
}
