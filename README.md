# Stillroom

A generative ambient instrument for the browser. Choose a synth voice, find a
variation, and let the composition unfold.

[Open Stillroom](https://tsieck.github.io/ambient-soundscapes/)

## Explore

- **Ten synth presets:** Velvet room, Tape afternoon, Glass garden, Quiet orbit,
  Slow bloom, Open horizon, Ember glow, Distant tide, Morning mist, and Pale aurora.
- **New variation** changes the musical seed and explores settings within the
  selected preset. **Previous variation** brings back a discovery you passed by.
- **Warmth, darkness, movement, and rain** shape the feeling. Open the synth for
  **space, density, drift, and harmony** controls, plus a four-layer mixer for
  **foundation, chords, details, and texture**.
- Choose **Rainy city** or **Faded afternoon** independently of the sound.
- Save the complete synth preset, variation seed, settings, and landscape in your
  browser. Older saves from the original two-atmosphere prototype are migrated.
- Use **Just listen** to hide the controls, and **Escape** to bring them back.

Volume and rain levels stay put when exploring presets and variations, so a new
sound preserves your listening level and environmental mix. Saved places restore
all their stored settings. Playback always starts with a user gesture.

Changing settings keeps the current performance running. Tone, effects, and
volume blend smoothly; musical changes enter at the next phrase boundary while
existing notes finish naturally. A preset change or new variation crossfades to
a new composition.

All music, rain, landscape artwork, and fonts run locally in the browser. No
accounts, external APIs, tracking, or runtime third-party asset requests. Saved
places stay in the current browser; clearing site data removes them.

The landscapes use generated photographic-style artwork. Their source prompts
and local asset paths are recorded in [the background art notes](docs/background-art.md).

## Development

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

```sh
npx playwright install chromium
npm test
npm run build
npm run preview
```

On macOS, the test configuration can use an installed Google Chrome. Set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to override the browser executable.

## GitHub Pages

The `Publish Stillroom` workflow is manual-only. After pushing an approved
version to `main`, run the workflow to test, build, and deploy `dist/` to
GitHub Pages. Ordinary pushes do not publish automatically. Relative build
paths support the `/ambient-soundscapes/` repository subdirectory.

## Generative sound

A saved variation is a recipe, including its seed, rather than an audio recording.
The seed and preset define the musical palette. Chord voicings and articulated
notes develop within a shared scale; synthesis controls affect the timbre,
spatial depth, tuning, and musical activity.

Native Web Audio oscillators, envelopes, filters, stereo reverb, and procedural
rain produce the sound. Presets use different instrument architectures: softly
filtered analog waves, envelope-shaped bowed tones, organ harmonics, and
two-operator FM/electric keys. Three overlapping resonant-noise clouds provide
the texture layer, with gated envelopes and different modulation rates.

Foundation, chords, details, and texture have separate mix buses. The score uses
voice leading, pedal tones, short motif/reply figures, rests, and multi-phrase
chapters that change register, tone, and layer activity. Seventeen pitched voice
slots are reused instead of creating a new oscillator graph for each note.

The engine schedules musical events against the audio clock and crossfades
between sound recipes. A 30-minute lookahead, refreshed every 20 seconds, covers
ordinary background timer throttling. Slider updates retain the current phrase
and its envelopes, including the generator state at the next phrase boundary.
Space smoothly changes the sends into reverb and echo. Their returns, delay
feedback, and the dry level stay fixed, so adjusting Space cannot turn up an
already-decaying tail. Unchanged controls leave existing smoothing ramps alone.
Tests exercise reproducibility, variation, signal headroom, layer mixing,
effect-tail continuity, silence at zero volume, and playback cleanup.

Device sleep, mobile screen locking, or browser audio policies can still suspend
a tab; uninterrupted lock-screen playback is not guaranteed. The presets are an
initial tuning pass and benefit from listening on your own headphones.

Built with React, TypeScript, Vite, Tailwind CSS, Phosphor icons, and DM Sans.

Technical references: [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
and [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
