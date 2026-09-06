import type { AtmosphereId, SoundSettings } from './audio';

export const atmospheres: Record<AtmosphereId, {
  name: string; eyebrow: string; description: string; short: string;
  defaults: SoundSettings;
}> = {
  city: {
    name: 'Rainy city', eyebrow: '01 / AFTER DARK',
    description: 'Distant lights. Soft rain. Nowhere to be.',
    short: 'Distant lights after dark',
    defaults: { warmth: .48, darkness: .66, movement: .32, rain: .56, volume: .5, space: .72, density: .35, drift: .22, tension: .28 },
  },
  afternoon: {
    name: 'Faded afternoon', eyebrow: '02 / SLOW DAYS',
    description: 'Warm light. A hazy memory. Time to drift.',
    short: 'Warm light over quiet hills',
    defaults: { warmth: .76, darkness: .28, movement: .4, rain: .12, volume: .5, space: .62, density: .42, drift: .38, tension: .22 },
  },
};

export const soundControls = [
  { key: 'warmth', label: 'Warmth', low: 'Cool', high: 'Warm' },
  { key: 'darkness', label: 'Darkness', low: 'Light', high: 'Deep' },
  { key: 'movement', label: 'Movement', low: 'Still', high: 'Drifting' },
  { key: 'rain', label: 'Rain', low: 'Clear', high: 'Downpour' },
] as const;

export const synthControls = [
  { key: 'space', label: 'Space', low: 'Close', high: 'Endless', description: 'The depth and reach of the reverb.' },
  { key: 'density', label: 'Density', low: 'Sparse', high: 'Layered', description: 'How many voices and passing notes find their way in.' },
  { key: 'drift', label: 'Drift', low: 'Steady', high: 'Wandering', description: 'Gentle pitch variation and the softness of the tuning.' },
  { key: 'tension', label: 'Harmony', low: 'Simple', high: 'Searching', description: 'The color of the chords, from open intervals to richer extensions.' },
] as const;
