import type { AtmosphereId, SoundSettings } from './audio';
import { RHYTHM_DEFAULTS } from './rhythm';

export const atmospheres: Record<AtmosphereId, {
  name: string; eyebrow: string; description: string; short: string;
  defaults: SoundSettings;
}> = {
  city: {
    name: 'Rainy city', eyebrow: '01 / AFTER DARK',
    description: 'Distant lights. Soft rain. Nowhere to be.',
    short: 'Distant lights after dark',
    defaults: { ...RHYTHM_DEFAULTS, warmth: .48, darkness: .66, movement: .32, rain: .56, volume: .5, space: .72, density: .35, drift: .22, tension: .28, bedLevel: .7, padLevel: .8, detailLevel: .45, textureLevel: .3 },
  },
  afternoon: {
    name: 'Faded afternoon', eyebrow: '02 / SLOW DAYS',
    description: 'Warm light. A hazy memory. Time to drift.',
    short: 'Warm light over quiet hills',
    defaults: { ...RHYTHM_DEFAULTS, warmth: .76, darkness: .28, movement: .4, rain: .12, volume: .5, space: .62, density: .42, drift: .38, tension: .22, bedLevel: .65, padLevel: .75, detailLevel: .5, textureLevel: .3 },
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

export const layerControls = [
  { key: 'bedLevel', label: 'Foundation', low: 'Off', high: 'Full', description: 'Low tones that anchor the composition.' },
  { key: 'padLevel', label: 'Chords', low: 'Off', high: 'Full', description: 'Slow harmonies with a life of their own.' },
  { key: 'detailLevel', label: 'Details', low: 'Off', high: 'Full', description: 'Passing notes, motifs, and quiet replies.' },
  { key: 'textureLevel', label: 'Texture', low: 'Off', high: 'Full', description: 'Air, grain, and shifting spectral color.' },
] as const;

export const pulseControls = [
  { key: 'pulse', label: 'Pulse amount', low: 'Off', high: 'Present', description: 'A soft, repeating rhythm beneath the harmony.' },
  { key: 'tempo', label: 'Pace', low: 'Slow', high: 'Lively', description: 'The speed of the pulse, in beats per minute.' },
  { key: 'bounce', label: 'Bounce', low: 'Even', high: 'Playful', description: 'Uneven spacing and little offbeat replies.' },
] as const;

export const headphoneControls = [
  { key: 'binaural', label: 'Headphone beat', low: 'Off', high: 'Present', description: 'The level of the two tones, one in each ear.' },
  { key: 'beatRate', label: 'Beat rate', low: 'Slow', high: 'Quick', description: 'The difference between the tones, in hertz.' },
] as const;
