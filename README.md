# Stillroom

**An unfolding ambient instrument for the browser.**

[Listen to Stillroom](https://tsieck.github.io/ambient-soundscapes/)

Stillroom composes gentle, evolving music as you listen: warm foundations, slow
harmonies, recurring figures, and shifting air. Choose a sound, find a variation,
and shape it into somewhere you want to stay. Keep it floating, introduce a soft
pulse, or give it a little bounce.

The project explores the qualities that make long ambient listening compelling:
recognizable material, patient change, space between gestures, and detail that
rewards attention without constantly asking for it. Its musical direction draws
on research into Brian Eno's generative systems and the work of Sarah Davachi,
Pauline Oliveros, and Steve Roach. The implementation is an original instrument,
with its own authored palettes and composition rules.

No installation or account is needed. Sound is synthesized on your device using
Web Audio. The interface pairs the instrument with two quiet, animated landscapes
and keeps the deeper controls within reach.

## Start listening

1. Open [Stillroom](https://tsieck.github.io/ambient-soundscapes/) and choose a
   preset from the **10 presets** selector above its name.
2. Select **Begin listening**. Playback starts only after your interaction.
3. Adjust **Warmth**, **Darkness**, **Movement**, and **Rain**. Give each sound
   time to develop: its phrases and color changes unfold over different timescales.
4. Try **New variation** to explore another composition within that preset.
   **Previous variation** returns to a recent discovery.
5. Open the synth for the layer mixer, harmony, space, rhythm, and headphone
   controls. Choose **Save this place** when you find a combination you like.

**Tape afternoon** is a useful starting point for warm, articulated listening;
**Open horizon** emphasizes spacious harmony. For a more buoyant combination,
try **Tape afternoon → Bounce**.

Choose **Rainy city** or **Faded afternoon** independently of the synth preset.
**Just listen** hides the controls; **Show controls** or **Escape** brings them
back. The spacebar toggles playback when you are outside a dialog or interactive
control. Sliders, preset choices, and dialogs are keyboard accessible.

## Ten sound palettes

Each preset selects an instrument architecture, harmonic vocabulary, motif, and
starting mix. Variations explore a bounded range around that identity. The table
describes the authored starting points; your settings can take them elsewhere.

| Preset | Instruments | Starting character |
| --- | --- | --- |
| **Velvet room** | Subtractive pads and rounded plucks | Warm, softly filtered chords; restrained detail and motion. |
| **Tape afternoon** | Subtractive pads and electric keys | Mellow, prominent keys with pronounced tuning drift and a relatively close room. |
| **Glass garden** | Organ-like pads and FM keys | Bright, sparse glass tones with little pitch drift and a long, open space. |
| **Quiet orbit** | Organ pads and low-ratio FM detail | Dark, bass-led harmony, sparse detail, and deep reverberation. |
| **Slow bloom** | Bowed pads and bowed detail | Dense, warm chord layers with gradual attacks and more internal motion. |
| **Open horizon** | Organ pads and soft plucks | Open intervals, restrained harmonic tension, and plenty of space around sustained tones. |
| **Ember glow** | Subtractive pads and rounded plucks | Low, resonant warmth with slow motion and a strong foundation. |
| **Distant tide** | Bowed pads and bowed detail | Long harmonic swells, an active texture layer, and wandering tone. |
| **Morning mist** | Organ pads and bowed detail | Sparse pitched material within a prominent, diffuse texture layer. |
| **Pale aurora** | FM pads and FM detail | Cool upper tones, richer harmonic color, and an active, spacious mix. |

The palettes are defined in [sound-presets.ts](src/sound-presets.ts) and
[audio.ts](src/audio.ts). All begin with the optional pulse and headphone layer
off. When you switch presets or generate variations, your current volume, rain,
rhythm, and headphone settings stay in place.

## Shape the sound

### Main controls

| Control | What it changes |
| --- | --- |
| **Warmth** | The weight and warmth of the lower sound. |
| **Darkness** | The overall brightness, from lighter upper detail to a deeper, filtered tone. |
| **Movement** | Slow musical and timbral motion, including the depth of individual voices' color changes. |
| **Rain** | The level of procedural rainfall and the landscape's rain treatment. |
| **Master volume** | The complete output: music, rain, pulse, and headphone tones. The speaker button mutes and restores the previous level. |

### Inside the synth

The four layers have independent levels, so you can pare the instrument down to
a foundation, foreground the keys, or listen to the shifting texture by itself.

| Layer | Musical role |
| --- | --- |
| **Foundation** | Low tones, pedal notes, and occasional fifths that anchor the composition. |
| **Chords** | Overlapping harmonies with slow entries, sustained common tones, and changing internal color. |
| **Details** | Short recurring figures, passing tones, and quiet replies with intentional rests. |
| **Texture** | Three overlapping clouds of resonant noise, shaped into moving bands of sound. |

| Control | What it changes |
| --- | --- |
| **Space** | How much new sound enters the room and echo. Different layers retain their own sense of distance. |
| **Density** | The activity of the arrangement, including the voices and passing notes that enter. |
| **Drift** | Gentle pitch variation, detuning, and tape-like instability. |
| **Harmony** | Chord color, from simpler open intervals toward richer extensions. |

**Reset** restores the selected preset's original synth settings while keeping
volume and rain. This also turns off its optional pulse and headphone layers.

### Floating, Pulse, and Bounce

These shortcuts offer three ways to inhabit the same ambient composition:

- **Floating** silences the rhythmic layer.
- **Pulse** adds an even, rounded repeating anchor.
- **Bounce** adds stronger offbeat replies, alternating accents, and gentle swing.

The detailed controls are **Pulse amount**, **Pace** from **48–108 BPM**, and
**Bounce**. The groove has its own clock, so a quicker pace leaves the long
ambient phrases free to move slowly. The rhythm uses pitched tones rather than
a drum kit, and shares the composition's tonal center.

### The headphone layer

**Headphone beat** adds a quiet pair of pure tones, one routed to each ear.
**Beat rate** controls their frequency difference from **2–12 Hz**. Use stereo
headphones for the binaural presentation.

This rate is independent of the groove's BPM. Floating can coexist with
headphone tones, and Pulse or Bounce can play with the headphone layer off.
The tones follow a clean stereo path around the room, chorus, and pitch drift.
They are offered as an optional listening texture, with no health or cognitive
benefit claims. The [rhythm research notes](docs/rhythm-spatial-research.md)
explain the distinction and the supporting sources.

## Variations, continuity, and saved places

A variation is a recipe: a preset, a 32-bit seed, and a set of controls. The seed
determines musical choices within the selected palette. The same recipe and
engine version reproduce the planned composition; new engine versions can
change its sound. The hexadecimal variation identifier appears inside the synth.

**New variation** changes the seed and explores settings near the preset's
character. The previous-variation button keeps up to eight earlier places during
the current visit. Restoring one brings back its preset, seed, landscape, and
other settings, while preserving the current master volume.

Ordinary adjustments keep the performance running. Tone, layer levels, effects,
and volume blend smoothly. Changes to the musical arrangement enter at the next
phrase boundary, with existing notes allowed to complete their envelopes. Pace
and bounce changes enter at the next usable beat. Switching the landscape keeps
the musical identity; a new preset or variation crossfades to a new composition.

Pause fades the sound down, releases the performance, and suspends the audio
context. Listening again starts the recipe from its opening. A saved place
likewise stores the recipe, rather than a recording or a position on a timeline.

**Saved places** retain the preset, seed, complete settings, and landscape in
this browser. You can name and delete them, with room for 50 places. The current
configuration is also remembered between visits. Saves from the earlier
two-atmosphere prototype are validated and migrated; missing newer controls
receive defaults, with pulse and headphone tones off.

## How the music develops

The score balances recurring material with change at several scales:

- **A shared harmonic world.** Foundation, chords, and details work within a
  seeded scale and palette. Voice leading favors connected chord movement;
  common tones can continue across harmonic boundaries.
- **Patient harmonic regions.** Harmony can dwell while the arrangement changes
  around it. Pedal tones and staggered entries provide continuity.
- **Independent melodic strands.** Figures recur on their own long cycles,
  retaining recognizable contours. Foreground reservations let an answering
  figure wait or leave a rest when another gesture needs space.
- **Chapters.** Groups of phrases adjust register, tone, and layer activity,
  making room for both fuller passages and periods of relative quiet.
- **Color inside held notes.** Each pad and texture voice has an independent,
  seeded slow cycle. Overtones, filter color, FM depth, or resonant bandwidth
  evolve while the note continues. These cycles carry on across note boundaries
  and live edits.
- **Recognizable placement.** Melodic strands keep a home position in stereo,
  with restrained variation around it, while layer-specific room sends create
  foreground and background depth.

The design aims for music that remains interesting over time without treating
every moment as a new event. Listening judgment remains part of development;
determinism and signal measurements alone cannot establish musical quality.

## Sound engine

The engine uses native Web Audio oscillators, envelopes, filters, panners, delay,
and convolution. Seventeen pitched ambient voice slots are reused: four for
foundation, eight for chords, and five for details. Three resonant-noise voices
form the texture pool. The pulse has six reusable voices; the headphone layer
uses two separately routed sine oscillators.

Subtractive, organ-like, bowed-envelope, electric-key, and two-operator FM
architectures give the presets different articulation and spectra. Eleven slow
oscillators provide independent color movement for the sustained pad and texture
voices. Their random sequence is separate from composition and weather, so
adding or adjusting this behavior does not consume musical random decisions.

Rain is generated from noise and many quiet resonant droplets. Its long buffers
are built locally and looped; the musical composition is scheduled independently.
No prerecorded song or streamed audio is required.

```text
Foundation / Chords / Details / Texture / Pulse
  ├─ direct tone shaping ──────────────────────────┐
  └─ layer-specific room feeds → Space → reverb ───┤
Details → Space-controlled send → filtered echo ───┤
Procedural rain ──────────────────────────────────┤
Separate left/right headphone tones ──────────────┤
                                                  ↓
                           subsonic filter → compressor → volume → output
```

The foundation and pulse feed less of the room, chords sit deeper, and texture
feeds more. The room's fixed, deterministic 5.7-second stereo response combines
asymmetric early reflections with a diffuse tail. Its upper-frequency component
decays faster than its lower body, so the room softens as it fades. Construction
happens once per audio context; live controls do not rebuild the impulse.

Space changes the sends into reverb and echo. The dry level, effect returns, and
delay feedback remain fixed, preserving already-decaying tails during an edit.
Unchanged control values leave existing smoothing ramps alone.

Musical events are scheduled against the audio clock. Live playback maintains a
30-minute lookahead and refreshes it every 20 seconds. Phrase checkpoints retain
the random state, strand reservations, and other composition state needed to
replan future material while preserving the current performance. Preset changes
reuse cached buffers and allow at most two scene graphs during a crossfade.

This approach accommodates ordinary background timer throttling. Device sleep,
mobile screen locking, and browser audio policies can still suspend the audio
context. Uninterrupted lock-screen playback is not guaranteed. The automated
browser tests run in Chromium; mobile viewport checks are separate from physical
phone audio testing.

## Research and artwork

The research notes distinguish source findings, authored implementation choices,
and listening criteria:

| Notes | Focus |
| --- | --- |
| [Ambient composition](docs/ambient-research.md) | Eno, generative systems, independent layers, harmonic patience, and musical continuity. |
| [Ambient depth](docs/ambient-depth-research.md) | Davachi, Oliveros, and Roach; sustained tone, attentive listening, ensemble interaction, and timbral motion. |
| [Rhythm and headphone beats](docs/rhythm-spatial-research.md) | Groove, selective syncopation, separate binaural routing, and audio-clock scheduling. |
| [Spatial depth](docs/spatial-depth-research.md) | Early reflections, frequency-dependent decay, and the room implementation. |
| [Background artwork](docs/background-art.md) | The generated photographic-style landscapes, their source prompts, and local asset paths. |

The landscapes are generated scenes, with interface animation layered over local
JPEG assets. They depict imagined places rather than documented locations.

## Data and privacy

The application has no account system, backend database, analytics, tracking, or
external API integrations. JavaScript, fonts, icons, and artwork are served as
part of the site; audio synthesis and save handling run locally in the browser.
Loading the hosted site still makes the normal requests needed to retrieve its
files from GitHub Pages.

Current settings and saved places use `localStorage`. They stay with the current
browser and site origin; there is no cloud synchronization or built-in export.
Clearing site data removes them. If storage is unavailable, the interface explains
the limitation and lets you continue listening for the current visit. Local
development and the public site have separate saved-place libraries.

## Develop locally

Requires Node.js **22.12 or newer** and a modern browser with Web Audio support.

```sh
npm ci
npm run dev
```

Open the localhost address printed by Vite, normally `http://127.0.0.1:5173/`.

```sh
npm test
npm run build
npm run preview
```

On macOS, the test configuration uses an installed Google Chrome when available.
Otherwise install Playwright Chromium before running the tests:

```sh
npx playwright install chromium
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select a different compatible executable.
The tests start the development server automatically when one is not already
running on port 5173. `npm run build` checks TypeScript and builds the static
site into `dist/`; `npm run preview` serves that production build locally.

### Project map

| Path | Responsibility |
| --- | --- |
| [src/App.tsx](src/App.tsx) | Listening interface, live settings, variations, and saved-place dialogs. |
| [src/audio.ts](src/audio.ts) | Synthesis, generative score, phrase checkpoints, mixing, and playback lifecycle. |
| [src/rhythm.ts](src/rhythm.ts) | Pulse patterns, beat scheduling, and the separate headphone-tone pair. |
| [src/room.ts](src/room.ts) | Deterministic stereo room response. |
| [src/sound-presets.ts](src/sound-presets.ts) | Ten starting palettes and bounded variation generation. |
| [src/presets.ts](src/presets.ts) | Landscape definitions and control labels. |
| [src/storage.ts](src/storage.ts) | Local save validation, migration, and persistence. |
| [src/AtmosphereScene.tsx](src/AtmosphereScene.tsx) | Landscape presentation and animation. |
| [src/index.css](src/index.css), [src/scene.css](src/scene.css) | Interface and landscape styling. |
| [tests](tests) | Browser interaction and rendered-audio regression coverage. |
| [docs](docs) | Research, implementation rationale, artwork, and listening notes. |
| [scripts/render-auditions.mjs](scripts/render-auditions.mjs) | Optional offline before-and-after listening tool. |
| [.github/workflows/pages.yml](.github/workflows/pages.yml) | Manual test, build, and GitHub Pages release workflow. |

Built with React, TypeScript, Vite, Tailwind CSS, Phosphor icons, and DM Sans.
The audio engine uses the browser's native Web Audio API.

### Verification

Playwright exercises real browser audio and the interface. The suite covers
seeded reproducibility, audible preset differences, long-form harmonic movement,
layer independence, finite output and headroom, zero-volume silence, voice cleanup,
and pause/switch races. Focused rendered-audio tests check uninterrupted held
notes, musical edits restored before a phrase boundary, foreground spacing and
stereo identity, rhythmic timing and swing, headphone separation, and room decay
across sample rates.

Interface tests cover storage migration and failures, save/restore/delete,
keyboard navigation, continuous updates, and narrow layouts. These checks support
listening sessions on actual speakers and headphones; they do not replace them.

### Optional before-and-after listening tool

The comparison renderer is a development utility, separate from the published
Stillroom instrument. It creates matched-volume WAV pairs and a small local A/B
page for Tape afternoon, Open horizon, and a Bounce example.

It requires a baseline directory containing the earlier `audio.ts` and all of
that version's runtime imports. Temporary snapshots from a development session
are not included in the repository and may no longer exist. Preserve a suitable
baseline before changing the engine, then supply its directory explicitly:

```sh
node scripts/render-auditions.mjs --before /path/to/baseline --check
node scripts/render-auditions.mjs --before /path/to/baseline --out /tmp/stillroom-auditions
```

The output includes 32 kHz stereo WAVs, an HTML comparison page, and a report with
settings, seeds, bundle hashes, and level measurements. Both versions receive the
current preset settings. Full-clip RMS matching reduces loudness bias, with a
shared lower target if needed to preserve peak headroom. It is not perceptual
LUFS matching. See the [audition guide](docs/audition-guide.md) for the complete
method and local serving instructions. Generated audio stays outside the repo.

## Publish to GitHub Pages

The **Publish Stillroom** workflow is manual-only. Ordinary pushes do not publish.
For an approved release:

1. Run the tests and production build, then commit and push the release to `main`.
2. In GitHub Actions, open **Publish Stillroom**, choose **Run workflow**, and
   select `main`.
3. Wait for the build and deployment jobs to complete. The workflow installs the
   browser, runs the tests, builds the app, and deploys the `dist/` artifact.
4. Verify the public [Stillroom site](https://tsieck.github.io/ambient-soundscapes/),
   including playback, controls, and artwork.

The equivalent workflow dispatch with GitHub CLI is:

```sh
gh workflow run pages.yml --ref main
```

The repository's Pages source must use GitHub Actions. Vite's relative asset paths
support the `/ambient-soundscapes/` repository subdirectory. The optional A/B page
and temporary rendered audio are outside `dist/` and are not part of this release.

## License

Stillroom is available under the [MIT License](LICENSE). You may use, modify,
redistribute, and use it commercially, provided you retain the copyright and
license notice. The software is provided without warranty. Third-party
dependencies retain their own licenses.

Technical references: [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
and [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
