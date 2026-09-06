# Stillroom

A generative ambient instrument for the browser. Choose a synth voice, find a
variation, and let the composition unfold.

## Explore

- **Ten synth presets:** Velvet room, Tape afternoon, Glass garden, Quiet orbit,
  Slow bloom, Open horizon, Ember glow, Distant tide, Morning mist, and Pale aurora.
- **New variation** changes the musical seed and explores settings within the
  selected preset. **Previous variation** brings back a discovery you passed by.
- **Warmth, darkness, movement, and rain** shape the feeling. Open the synth for
  **space, density, drift, and harmony** controls.
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

The `Publish Stillroom` workflow tests and builds pushes to `main`, then publishes
`dist/` to GitHub Pages. Select **GitHub Actions** in the repository's Pages settings.
Relative build paths allow the app to work under a repository subdirectory.
Pull requests run the same checks without publishing.

## Generative sound

A saved variation is a recipe, including its seed, rather than an audio recording.
The seed and preset define the musical palette. Chord voicings and articulated
notes develop within a shared scale; synthesis controls affect the timbre,
spatial depth, tuning, and musical activity.

Native Web Audio oscillators, envelopes, filters, stereo reverb, and procedural
rain produce the sound. The engine schedules musical events against the audio
clock and crossfades between sound recipes. Tests exercise reproducibility,
variation, signal headroom, silence at zero volume, and playback cleanup.

Device sleep, mobile screen locking, or browser audio policies can still suspend
a tab; uninterrupted lock-screen playback is not guaranteed. The presets are an
initial tuning pass and benefit from listening on your own headphones.

Built with React, TypeScript, Vite, Tailwind CSS, Phosphor icons, and DM Sans.

Technical references: [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
and [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
