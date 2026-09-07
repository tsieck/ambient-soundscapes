import type { SoundSettings } from './audio';
import { RHYTHM_DEFAULTS } from './rhythm';

export type SoundPresetId =
  | 'velvet' | 'tape' | 'glass' | 'orbit' | 'bloom'
  | 'horizon' | 'ember' | 'tide' | 'mist' | 'aurora'
  | 'neon' | 'midnight' | 'afterglow'
  | 'lantern' | 'daydream';

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
    description: 'Warm analog layers, softly opening and closing.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .78, darkness: .56, movement: .24, rain: .02, volume: .5, space: .46, density: .52, drift: .25, tension: .12,
      bedLevel: .64, padLevel: .82, detailLevel: .18, textureLevel: .14 },
  },
  {
    id: 'tape', name: 'Tape afternoon',
    description: 'Mellow electric keys with a worn, wandering warmth.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .86, darkness: .34, movement: .37, rain: .02, volume: .5, space: .37, density: .44, drift: .72, tension: .2,
      bedLevel: .4, padLevel: .44, detailLevel: .78, textureLevel: .26 },
  },
  {
    id: 'glass', name: 'Glass garden',
    description: 'Soft glass keys, clear tones dissolving into air.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .29, darkness: .2, movement: .32, rain: 0, volume: .5, space: .78, density: .28, drift: .16, tension: .26,
      bedLevel: .22, padLevel: .34, detailLevel: .8, textureLevel: .22 },
  },
  {
    id: 'orbit', name: 'Quiet orbit',
    description: 'Deep organ drones with sparse, distant pulses.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .38, darkness: .8, movement: .28, rain: .02, volume: .5, space: .9, density: .38, drift: .4, tension: .38,
      bedLevel: .86, padLevel: .55, detailLevel: .22, textureLevel: .2 },
  },
  {
    id: 'bloom', name: 'Slow bloom',
    description: 'Slowly bowed strings unfolding into warm harmony.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .69, darkness: .31, movement: .55, rain: 0, volume: .5, space: .64, density: .69, drift: .28, tension: .16,
      bedLevel: .4, padLevel: .88, detailLevel: .2, textureLevel: .3 },
  },
  {
    id: 'horizon', name: 'Open horizon',
    description: 'Open organ harmony and pure tones with room to breathe.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .52, darkness: .25, movement: .35, rain: .03, volume: .5, space: .88, density: .35, drift: .3, tension: .1,
      bedLevel: .46, padLevel: .72, detailLevel: .22, textureLevel: .18 },
  },
  {
    id: 'ember', name: 'Ember glow',
    description: 'Low, resonant analog tones glowing beneath the surface.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .93, darkness: .76, movement: .16, rain: 0, volume: .5, space: .42, density: .57, drift: .19, tension: .14,
      bedLevel: .84, padLevel: .62, detailLevel: .16, textureLevel: .2 },
  },
  {
    id: 'tide', name: 'Distant tide',
    description: 'Long harmonic swells through soft, shifting air.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .51, darkness: .58, movement: .68, rain: .39, volume: .5, space: .76, density: .47, drift: .48, tension: .25,
      bedLevel: .46, padLevel: .74, detailLevel: .18, textureLevel: .56 },
  },
  {
    id: 'mist', name: 'Morning mist',
    description: 'Drifting grains of sound with a few weightless tones.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .58, darkness: .47, movement: .23, rain: .26, volume: .5, space: .84, density: .26, drift: .32, tension: .12,
      bedLevel: .22, padLevel: .3, detailLevel: .26, textureLevel: .78 },
  },
  {
    id: 'aurora', name: 'Pale aurora',
    description: 'Luminous upper tones shimmering over cool harmony.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .26, darkness: .37, movement: .58, rain: .01, volume: .5, space: .91, density: .61, drift: .52, tension: .43,
      bedLevel: .34, padLevel: .64, detailLevel: .72, textureLevel: .44 },
  },
  {
    id: 'neon', name: 'Neon skyline',
    description: 'Swelling synth brass and distant glass notes above deep bass.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .76, darkness: .48, movement: .4, rain: .32, volume: .5, space: .88, density: .4, drift: .5, tension: .55,
      bedLevel: .64, padLevel: .84, detailLevel: .32, textureLevel: .3 },
  },
  {
    id: 'midnight', name: 'Midnight sea',
    description: 'Deep bowed swells and sparse, rounded notes over moving air.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .48, darkness: .69, movement: .5, rain: .34, volume: .5, space: .9, density: .3, drift: .36, tension: .28,
      bedLevel: .58, padLevel: .78, detailLevel: .16, textureLevel: .62 },
  },
  {
    id: 'afterglow', name: 'Last light',
    description: 'Warm brass chords and soft electric keys lingering in open space.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .84, darkness: .32, movement: .35, rain: .03, volume: .5, space: .72, density: .38, drift: .4, tension: .27,
      bedLevel: .42, padLevel: .74, detailLevel: .52, textureLevel: .2 },
  },
  {
    id: 'lantern', name: 'Paper lanterns',
    description: 'Soft piano-like keys tracing little melodies against a warm backdrop.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .8, darkness: .32, movement: .32, rain: .01, volume: .5, space: .4, density: .46, drift: .26, tension: .27,
      bedLevel: .28, padLevel: .38, detailLevel: .86, textureLevel: .16 },
  },
  {
    id: 'daydream', name: 'Daydream',
    description: 'Rounded bells and gently wavering pads with a lilting, playful touch.',
    settings: { ...RHYTHM_DEFAULTS, warmth: .62, darkness: .22, movement: .46, rain: 0, volume: .5, space: .57, density: .49, drift: .4, tension: .3,
      bedLevel: .26, padLevel: .42, detailLevel: .73, textureLevel: .25 },
  },
];

interface VariationProfile {
  tone: number;
  motion: number;
  texture: number;
  rain: number;
  layers: [bed: number, pad: number, detail: number, texture: number];
}

// Keep the defining character of each voice while letting its surroundings vary.
const profiles: Record<SoundPresetId, VariationProfile> = {
  velvet: { tone: .1, motion: .09, texture: .12, rain: .025, layers: [.12, .1, .1, .1] },
  tape: { tone: .09, motion: .13, texture: .12, rain: .025, layers: [.12, .14, .14, .12] },
  glass: { tone: .08, motion: .1, texture: .1, rain: .02, layers: [.1, .12, .12, .1] },
  orbit: { tone: .1, motion: .12, texture: .14, rain: .03, layers: [.1, .14, .1, .12] },
  bloom: { tone: .1, motion: .16, texture: .15, rain: .02, layers: [.12, .1, .1, .14] },
  horizon: { tone: .09, motion: .11, texture: .13, rain: .03, layers: [.1, .1, .1, .1] },
  ember: { tone: .07, motion: .07, texture: .11, rain: .02, layers: [.1, .1, .1, .1] },
  tide: { tone: .12, motion: .15, texture: .15, rain: .13, layers: [.14, .1, .1, .14] },
  mist: { tone: .1, motion: .09, texture: .11, rain: .1, layers: [.1, .1, .12, .12] },
  aurora: { tone: .11, motion: .16, texture: .13, rain: .025, layers: [.12, .12, .14, .14] },
  neon: { tone: .1, motion: .12, texture: .11, rain: .1, layers: [.12, .08, .1, .12] },
  midnight: { tone: .09, motion: .11, texture: .1, rain: .12, layers: [.12, .08, .08, .12] },
  afterglow: { tone: .08, motion: .1, texture: .11, rain: .025, layers: [.1, .1, .12, .1] },
  lantern: { tone: .07, motion: .08, texture: .09, rain: .015, layers: [.08, .08, .08, .07] },
  daydream: { tone: .08, motion: .1, texture: .09, rain: .015, layers: [.08, .09, .1, .08] },
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
      ...RHYTHM_DEFAULTS,
      warmth: vary(base.warmth, profile.tone),
      darkness: vary(base.darkness, profile.tone),
      movement: vary(base.movement, profile.motion),
      rain: vary(base.rain, profile.rain, ['tide', 'mist', 'neon', 'midnight'].includes(preset.id) ? .65 : .12),
      volume: .5,
      space: vary(base.space, profile.texture),
      density: vary(base.density, profile.texture),
      drift: vary(base.drift, profile.motion),
      tension: vary(base.tension, profile.tone * .7),
      bedLevel: vary(base.bedLevel, profile.layers[0]),
      padLevel: vary(base.padLevel, profile.layers[1]),
      detailLevel: vary(base.detailLevel, profile.layers[2]),
      textureLevel: vary(base.textureLevel, profile.layers[3]),
    },
  };
}
