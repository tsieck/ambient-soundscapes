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
- **Floating, Pulse, and Bounce** move from unmetered ambience to a rounded,
  gently swinging groove. Inside the synth, adjust **pulse amount, pace
  (48–108 BPM), and bounce** without speeding up the ambient composition.
- An optional **Headphone beat** adds a quiet pair of pure tones, one in each
  ear. **Beat rate (2–12 Hz)** controls their frequency difference independently
  of the musical tempo. Use stereo headphones for the binaural effect.
- Choose **Rainy city** or **Faded afternoon** independently of the sound.
- Save the complete synth preset, variation seed, settings, and landscape in your
  browser. Older saves from the original two-atmosphere prototype are migrated.
- Use **Just listen** to hide the controls, and **Escape** to bring them back.

Volume, rain, rhythm, and headphone settings stay put when exploring presets and
variations. Saved places restore all their stored settings; older saves open
with pulse and headphone tones off. Playback always starts with a user gesture.

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
Each sustained voice also has its own slow color cycle: pad overtone balances,
FM depth, filter color, and texture bandwidth evolve independently. Movement
controls their depth. These clocks run continuously through notes and live edits.

Foundation, chords, details, and texture have separate mix buses. The score uses
voice leading, sustained common tones, pedal tones, independently recurring
melodic strands, rests, and multi-phrase chapters that change register, tone,
and layer activity. Harmonic regions linger while individual voices come and
go. Seventeen pitched ambient voice slots are reused instead of creating a new
oscillator graph for each note.
Melodic figures keep a recognizable stereo position and take turns occupying the
foreground. A conflicting figure can wait or leave a rest while preserving its
own long cycle, so the parts respond without settling into a rigid exchange.

The engine schedules musical events against the audio clock and crossfades
between sound recipes. A 30-minute lookahead, refreshed every 20 seconds, covers
ordinary background timer throttling. Slider updates retain the current phrase
and its envelopes, including the generator state at the next phrase boundary.
Space smoothly changes the sends into reverb and echo. Their returns, delay
feedback, and the dry level stay fixed, so adjusting Space cannot turn up an
already-decaying tail. Unchanged controls leave existing smoothing ramps alone.
The foundation and pulse stay relatively close, pads sit deeper, and texture
feeds more of the room. Asymmetric early reflections lead into a diffuse tail
whose upper frequencies fade sooner than its low body. The room is constructed
once per context and stays unchanged during playback.
Tests exercise reproducibility, variation, signal headroom, layer mixing,
effect-tail continuity, silence at zero volume, and playback cleanup.

The pulse has six reusable voices, a separate seeded pattern, and its own
audio-clock schedule. It combines a tonic/fifth anchor, repeating accents, and
selected swung offbeats. Pace and bounce edits enter at the next usable beat;
amount changes fade smoothly. It shares the musical space while the binaural
sine pair bypasses reverb, chorus, panning, and detuning. Both layers pass
through the same master volume and output protection. Headphone tones are an
optional musical effect, with no health or cognitive claims.

The composition changes are informed by Eno's writing and interviews about
authored generative systems, changing attention, and independent layers.
See [ambient composition research](docs/ambient-research.md) and
[rhythm and spatial research](docs/rhythm-spatial-research.md) for the primary
sources, implementation choices, and listening criteria. **Tape afternoon**
and **Open horizon** are useful starting points for floating listening;
try **Tape afternoon → Bounce** for a more buoyant variation.

The next research pass draws on Davachi, Oliveros, and Roach for sustained tone,
attention, and ensemble interaction, and Smith's acoustic research for spatial
depth. See [ambient depth research](docs/ambient-depth-research.md) and
[room design notes](docs/spatial-depth-research.md). The
[listening comparison guide](docs/audition-guide.md) explains how to render
matched-volume before-and-after examples outside the repository.

Device sleep, mobile screen locking, or browser audio policies can still suspend
a tab; uninterrupted lock-screen playback is not guaranteed. The presets are an
initial tuning pass and benefit from listening on your own headphones.

Built with React, TypeScript, Vite, Tailwind CSS, Phosphor icons, and DM Sans.

Technical references: [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
and [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
