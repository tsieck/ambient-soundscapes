#!/usr/bin/env node
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Offline renders only: no AudioContext, live playback, web server, or downloads.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = {
  before: '/tmp/stillroom-depth-before',
  out: '/tmp/stillroom-depth-auditions',
  seed: 4217,
};
let checkOnly = false;
for (let i = 2; i < process.argv.length; i++) {
  const argument = process.argv[i];
  if (argument === '--help') {
    console.log(`Render paired before/current ambient-engine auditions.

  node scripts/render-auditions.mjs [--before DIRECTORY] [--out DIRECTORY]
                                  [--seed INTEGER] [--check]

Defaults: before=${options.before}
          out=${options.out}, seed=${options.seed}

The baseline directory must contain audio.ts and its runtime imports, including
rhythm.ts. Both engines receive the current SOUND_PRESETS settings. --check only
verifies and bundles the sources; it does not launch a browser or render audio.
Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to select an installed Chromium executable.
Otherwise installed Google Chrome on macOS, or Playwright's Chromium, is used.
`);
    process.exit(0);
  }
  if (argument === '--check') { checkOnly = true; continue; }
  const key = argument.slice(2);
  if (!argument.startsWith('--') || !Object.hasOwn(options, key) || process.argv[i + 1] === undefined) {
    throw new Error(`Unknown or incomplete option: ${argument}. Use --help.`);
  }
  const value = process.argv[++i];
  if (key === 'seed') {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 0xffffffff) {
      throw new Error('--seed must be an integer between 0 and 4294967295.');
    }
    options.seed = Number(value);
  } else options[key] = resolve(value);
}

const sampleRate = 32_000;
const requestedRmsDb = -24;
const peakCeilingDb = -1;
const fadeSeconds = 2;
const cases = [
  { slug: 'tape-afternoon-floating', title: 'Tape afternoon · Floating', preset: 'tape', duration: 90, rhythm: { pulse: 0 },
    listen: 'Listen for recurring figures, the spaces between them, and how new harmony changes the feeling of a familiar line.' },
  { slug: 'open-horizon-floating', title: 'Open horizon · Floating', preset: 'horizon', duration: 90, rhythm: { pulse: 0 },
    listen: 'Listen for the path between chords, long overlapping tones, and whether the texture develops without demanding attention.' },
  { slug: 'tape-afternoon-bounce', title: 'Tape afternoon · Bounce', preset: 'tape', duration: 45, rhythm: { pulse: .65, bounce: .7 },
    listen: 'Listen for the relationship between the rounded pulse and the floating harmony, including small offbeat replies.' },
];

async function bundle(audioPath, globalName) {
  await access(audioPath);
  const result = await build({
    stdin: {
      contents: `export { createSoundscape } from ${JSON.stringify(audioPath)};\nexport { SOUND_PRESETS } from ${JSON.stringify(join(root, 'src/sound-presets.ts'))};`,
      resolveDir: root,
      sourcefile: 'audition-entry.ts',
      loader: 'ts',
    },
    bundle: true, format: 'iife', globalName, platform: 'browser', target: 'es2022', write: false,
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  return { code, sha256: createHash('sha256').update(code).digest('hex') };
}

const [before, after] = await Promise.all([
  bundle(join(options.before, 'audio.ts'), 'Audition'),
  bundle(join(root, 'src/audio.ts'), 'Audition'),
]);
if (checkOnly) {
  console.log(`Both engines bundled successfully. No audio rendered.\nBefore: ${before.sha256}\nAfter:  ${after.sha256}`);
  process.exit(0);
}

const db = (value) => value > 0 ? 20 * Math.log10(value) : -Infinity;
const number = (value, places = 2) => Number(value.toFixed(places));
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  || (existsSync(localChrome) ? localChrome : undefined);
const browser = await chromium.launch({ executablePath, headless: true });
await mkdir(options.out, { recursive: true });
const report = {
  createdAt: new Date().toISOString(), sampleRate, channels: 2, encoding: '16-bit PCM WAV',
  seed: options.seed, atmosphere: 'afternoon', requestedRmsDb, peakCeilingDb, fadeSeconds,
  measurement: 'Ungated RMS across both channels and the entire clip. Raw metrics precede the demonstration end fade. Listening RMS follows it. Both members of a pair receive the same target RMS.',
  before: { directory: options.before, bundleSha256: before.sha256 },
  after: { directory: join(root, 'src'), bundleSha256: after.sha256 },
  pairs: [],
};

async function render(variant, auditionCase) {
  const context = await browser.newContext({ offline: true });
  await context.route('**/*', (route) => route.abort());
  const page = await context.newPage();
  await page.addScriptTag({ content: variant.code });
  const result = await page.evaluate(async ({ auditionCase, seed, sampleRate, fadeSeconds }) => {
    const preset = Audition.SOUND_PRESETS.find((candidate) => candidate.id === auditionCase.preset);
    if (!preset) throw new Error(`Missing preset: ${auditionCase.preset}`);
    const settings = { ...preset.settings, ...auditionCase.rhythm, binaural: 0 };
    const audio = new OfflineAudioContext(2, Math.round(sampleRate * auditionCase.duration), sampleRate);
    const sound = Audition.createSoundscape(audio, 'afternoon', settings, audio.destination, { preset: preset.id, seed });
    const buffer = await audio.startRendering();
    sound.stop();
    let rawPeak = 0, rawEnergy = 0, fadedPeak = 0, fadedEnergy = 0;
    const fadeFrames = Math.round(fadeSeconds * sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let index = 0; index < samples.length; index++) {
        const raw = samples[index];
        if (!Number.isFinite(raw)) throw new Error(`Invalid audio sample at channel ${channel}, frame ${index}`);
        rawPeak = Math.max(rawPeak, Math.abs(raw)); rawEnergy += raw * raw;
        const envelope = Math.min(1, (samples.length - 1 - index) / fadeFrames);
        samples[index] = raw * envelope;
        const faded = samples[index];
        fadedPeak = Math.max(fadedPeak, Math.abs(faded)); fadedEnergy += faded * faded;
      }
    }
    window.auditionBuffer = buffer;
    const count = buffer.length * buffer.numberOfChannels;
    return { settings, rawPeak, rawRms: Math.sqrt(rawEnergy / count), fadedPeak, fadedRms: Math.sqrt(fadedEnergy / count) };
  }, { auditionCase, seed: options.seed, sampleRate, fadeSeconds });
  if (!(result.fadedRms > 0)) throw new Error(`${auditionCase.title} rendered silence.`);
  return { context, page, ...result };
}

async function saveWav(rendered, filename, targetRms) {
  const gain = targetRms / rendered.fadedRms;
  const output = await rendered.page.evaluate(({ gain }) => {
    const buffer = window.auditionBuffer;
    const channels = buffer.numberOfChannels;
    const dataLength = buffer.length * channels * 2;
    const bytes = new Uint8Array(44 + dataLength);
    const view = new DataView(bytes.buffer);
    const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    text(0, 'RIFF'); view.setUint32(4, 36 + dataLength, true); text(8, 'WAVE');
    text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, dataLength, true);
    const samples = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
    let offset = 44, peak = 0, energy = 0;
    for (let i = 0; i < buffer.length; i++) for (let channel = 0; channel < channels; channel++) {
      const value = samples[channel][i] * gain;
      if (Math.abs(value) >= 1) throw new Error('Normalization would clip the audition.');
      const encoded = Math.round(value * 32767);
      view.setInt16(offset, encoded, true); offset += 2;
      const decoded = encoded / 32768;
      peak = Math.max(peak, Math.abs(decoded)); energy += decoded * decoded;
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
    return { base64: btoa(binary), peak, rms: Math.sqrt(energy / (buffer.length * channels)) };
  }, { gain });
  await writeFile(join(options.out, filename), Buffer.from(output.base64, 'base64'));
  return {
    file: filename, rawPeak: rendered.rawPeak, rawPeakDb: number(db(rendered.rawPeak)),
    rawRms: rendered.rawRms, rawRmsDb: number(db(rendered.rawRms)),
    fadedRms: rendered.fadedRms, normalizationGain: gain, normalizationDb: number(db(gain)),
    listeningPeakDb: number(db(output.peak)), listeningRmsDb: number(db(output.rms)),
  };
}

try {
  for (const auditionCase of cases) {
    console.log(`Rendering ${auditionCase.title} (${auditionCase.duration}s per version)...`);
    // Sequential renders limit memory use while preserving both buffers for matching.
    const a = await render(before, auditionCase);
    const b = await render(after, auditionCase);
    try {
      const peakCeiling = 10 ** (peakCeilingDb / 20);
      const targetRms = Math.min(10 ** (requestedRmsDb / 20),
        peakCeiling * a.fadedRms / a.fadedPeak, peakCeiling * b.fadedRms / b.fadedPeak);
      const tracks = [];
      for (const [label, rendered] of [['before', a], ['after', b]]) {
        const filename = `${auditionCase.slug}-${label}-${auditionCase.duration}s.wav`;
        tracks.push({ version: label, ...await saveWav(rendered, filename, targetRms) });
      }
      report.pairs.push({ ...auditionCase, targetRmsDb: number(db(targetRms)), settings: a.settings, tracks });
      console.table(tracks.map(({ version, rawPeakDb, rawRmsDb, normalizationDb, listeningRmsDb, listeningPeakDb }) =>
        ({ version, rawPeakDb, rawRmsDb, normalizationDb, listeningRmsDb, listeningPeakDb })));
    } finally { await a.context.close(); await b.context.close(); }
  }
} finally { await browser.close(); }

const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const signed = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
const sections = report.pairs.map((pair, index) => `<section aria-labelledby="pair-${index}">
  <div class="heading"><h2 id="pair-${index}">${escape(pair.title)}</h2><span>${pair.duration}s · ${pair.targetRmsDb.toFixed(1)} dBFS RMS</span></div>
  <p>${escape(pair.listen)}</p>
  <div class="tracks">${pair.tracks.map((track, i) => `<div class="track">
    <label for="${pair.slug}-${track.version}"><b>${i === 0 ? 'A' : 'B'}</b> ${i === 0 ? 'Before' : 'After'}</label>
    <audio id="${pair.slug}-${track.version}" controls preload="metadata" src="${escape(track.file)}"></audio>
    <button type="button" data-switch="${pair.slug}-${track.version}">Hear ${i === 0 ? 'A' : 'B'} at the same point</button>
    <a href="${escape(track.file)}" download>Download WAV</a>
  </div>`).join('')}</div>
  <details><summary>Levels and normalization</summary><div class="table-wrap"><table>
    <thead><tr><th>Version</th><th>Raw peak</th><th>Raw RMS</th><th>Gain applied</th><th>Listening RMS</th><th>Listening peak</th></tr></thead>
    <tbody>${pair.tracks.map((track) => `<tr><th>${escape(track.version)}</th><td>${track.rawPeakDb.toFixed(2)}</td><td>${track.rawRmsDb.toFixed(2)}</td><td>${signed(track.normalizationDb)} dB</td><td>${track.listeningRmsDb.toFixed(2)}</td><td>${track.listeningPeakDb.toFixed(2)}</td></tr>`).join('')}</tbody>
  </table></div><p>Peak and RMS values are dBFS. Raw values precede the demonstration fade; listening values are measured from the encoded WAV.</p></details>
</section>`).join('\n');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stillroom · Listening comparison</title><style>
:root{font-family:ui-sans-serif,system-ui,sans-serif;color:#e7e5de;background:#171e1d;color-scheme:dark;line-height:1.6}*{box-sizing:border-box}body{margin:0}main{max-width:1000px;margin:0 auto;padding:64px 24px}h1,h2{line-height:1.15;font-weight:500}h1{font-size:clamp(2.2rem,5vw,3.8rem);margin:8px 0 24px;letter-spacing:-.035em}h2{font-size:1.55rem;margin:0}p{color:#b7c0ba;max-width:78ch}a{color:#c6d8b9}header{padding-bottom:48px}.eyebrow{font-size:.78rem;letter-spacing:.18em;text-transform:uppercase}section{border-top:1px solid #45504b;padding:36px 0 44px}.heading{display:flex;justify-content:space-between;gap:20px;align-items:baseline}.heading span{white-space:nowrap;color:#b7c0ba;font-size:.85rem}.tracks{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin:25px 0}.track label{display:block;margin-bottom:12px}.track b{display:inline-flex;justify-content:center;align-items:center;width:28px;height:28px;border:1px solid #5d6d61;border-radius:50%;margin-right:10px}audio{display:block;width:100%;margin:12px 0}button{font:inherit;color:#e7e5de;background:#2d3a32;border:1px solid #5e7060;border-radius:5px;padding:8px 12px;cursor:pointer}.track a{display:inline-block;margin:8px 0 0 12px;font-size:.85rem}details{color:#b7c0ba;font-size:.85rem}summary{cursor:pointer}table{border-collapse:collapse;width:100%;text-align:left;margin-top:16px;white-space:nowrap}th,td{padding:8px 14px 8px 0;border-bottom:1px solid #354039}th{font-weight:500}.table-wrap{overflow:auto}footer{font-size:.85rem;border-top:1px solid #45504b;padding-top:20px}@media(max-width:640px){main{padding:36px 20px}.tracks{grid-template-columns:1fr}.heading{display:block}.heading span{display:block;margin-top:10px}}
</style></head><body><main><header><div class="eyebrow">Stillroom · Engine study</div>
<h1>Hear what changed.</h1>
<p>Compare the previous engine with this ambient research iteration. Each pair uses the same preset controls, atmosphere, and seed (${options.seed}). Listen for phrasing, musical memory, harmonic movement, texture, and room to breathe.</p>
<p>Switch between A and B at the same point. Each pair uses the same settings and seed, with the volume matched for comparison.</p>
<button type="button" id="pause-all">Pause all</button></header>${sections}
<footer><details><summary>About these comparisons</summary><p>These are offline renders, with no live audio capture: stereo, 32 kHz, 16-bit PCM WAV. The final two seconds fade out for this demonstration. Both versions are matched to ${requestedRmsDb} dBFS RMS; if either would exceed ${peakCeilingDb} dBFS peak, both receive the same lower RMS target. RMS matching reduces loudness bias; it is not perceptual LUFS matching.</p></details><p>Start at a comfortable listening volume. All sounds are synthesized by the app; no reference recordings are included. The headphone beat layer is off for these comparisons. All controls and measurements are recorded in <a href="report.json">report.json</a>.</p>
<p>Render created ${escape(report.createdAt)}. A is the supplied baseline; B is the engine at render time. This page and its audio work locally.</p></footer>
</main><script>
const players = [...document.querySelectorAll('audio')];
let mostRecent = null;
for (const player of players) player.addEventListener('play', () => {
  for (const other of players) if (other !== player) other.pause();
  mostRecent = player;
});
document.querySelector('#pause-all').addEventListener('click', () => players.forEach(player => player.pause()));
for (const button of document.querySelectorAll('[data-switch]')) button.addEventListener('click', async () => {
  const next = document.getElementById(button.dataset.switch);
  const paired = [...next.closest('section').querySelectorAll('audio')];
  const source = paired.includes(mostRecent) ? mostRecent : paired.find(player => player !== next);
  const point = source?.currentTime || 0;
  players.forEach(player => player.pause());
  if (next.readyState < 1) await new Promise(resolve => next.addEventListener('loadedmetadata', resolve, { once: true }));
  next.currentTime = Math.min(point, Math.max(0, next.duration - .1));
  try { await next.play(); } catch { next.focus(); }
});
</script></body></html>`;
await writeFile(join(options.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(options.out, 'index.html'), html);
console.log(`Auditions ready: ${join(options.out, 'index.html')}\nMeasurements: ${join(options.out, 'report.json')}`);
