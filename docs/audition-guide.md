# Offline listening comparisons

`scripts/render-auditions.mjs` renders the ambient engine before and after a change. Audio stays outside the repository, in `/tmp/stillroom-depth-auditions` by default.

The baseline snapshot must contain `audio.ts` and its runtime dependencies, including `rhythm.ts`. This iteration's starting engine was saved in `/tmp/stillroom-depth-before`. These temporary files are not permanent release artifacts.

```sh
node scripts/render-auditions.mjs --check
node scripts/render-auditions.mjs
```

Optional arguments are `--before DIRECTORY`, `--out DIRECTORY`, and `--seed INTEGER`. `--check` bundles both versions without launching a browser or rendering. The script uses installed Google Chrome on macOS or Playwright Chromium; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` overrides the executable. It does not install a browser or access remote content.

Open the generated `index.html` for native A/B players and buttons that switch versions at the same point. For a localhost browser preview, run the project's installed Vite from the project directory:

```sh
npm run dev -- /tmp/stillroom-depth-auditions --port 5175 --strictPort
```

Then open `http://127.0.0.1:5175/`. Vite supports the byte-range requests needed to seek between A/B tracks. A basic server without byte-range support can reset an unbuffered seek to the beginning.

The output contains:

- Tape afternoon, Floating: 90 seconds per version.
- Open horizon, Floating: 90 seconds per version.
- Tape afternoon, Bounce: 45 seconds per version.
- A JSON report with settings, seed, bundle hashes, and raw and normalized audio measurements.

Both versions receive the current `SOUND_PRESETS` settings, atmosphere `afternoon`, and the same seed (4217 by default). Floating sets pulse to zero. Bounce uses the interface's pulse `.65` and bounce `.7`, with preset pace. The headphone beat layer is off.

Each excerpt is rendered in an isolated `OfflineAudioContext` at 32 kHz stereo, with network access disabled. The script applies a two-second demonstration end fade, then matches the full-clip, ungated stereo RMS to -24 dBFS. If either version would exceed -1 dBFS peak, both use the same lower RMS target. No limiter is added. WAVs are 16-bit PCM; the report measures their encoded output as well as the original unfaded render. RMS matching reduces loudness bias but does not replace perceptual LUFS matching.

Listen at a comfortable, unchanged playback volume. Compare recurring material and its variations; whether voices leave space for each other; how the harmony moves; and whether rhythm supports the atmosphere over longer passages. These excerpts evaluate musical direction. They do not verify live scheduling, background playback, or device-specific audio behavior; the browser tests cover separate engine behavior.
