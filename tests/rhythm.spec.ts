import { expect, test } from '@playwright/test'
import type { SoundSettings } from '../src/audio'

const defaults = {
  warmth: .6, darkness: .5, movement: .35, rain: .4, volume: .6,
  space: .65, density: .5, drift: .35, tension: .35,
  bedLevel: .55, padLevel: .75, detailLevel: .5, textureLevel: .3,
  pulse: 0, tempo: .4, bounce: .35, binaural: 0, beatRate: .4,
} satisfies SoundSettings

test.beforeEach(async ({ page }) => {
  await page.route('**/__rhythm-check', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body>Isolated rhythm rendering harness</body></html>',
  }))
  await page.goto('/__rhythm-check')
})

test('headphone beats have separate left/right carriers with the selected 2, 6 and 12 Hz difference', async ({ page }) => {
  const readings = await page.evaluate(async (defaults) => {
    const url = '/src/rhythm.ts'
    const { createRhythm } = await import(url) as typeof import('../src/rhythm')
    const sampleRate = 12000
    const readings = []
    for (const [beatRate, expectedDifference] of [[0, 2], [.4, 6], [1, 12]]) {
      const context = new OfflineAudioContext(2, sampleRate * 7, sampleRate)
      const sound = createRhythm(context, { ...defaults, binaural: 1, beatRate }, context.destination, context.destination, 4217, 45)
      const buffer = await context.startRendering()
      const channels = [buffer.getChannelData(0).slice(sampleRate * 3), buffer.getChannelData(1).slice(sampleRate * 3)]
      // Positive zero crossings estimate the actual PCM carrier frequency,
      // independently of the oscillator parameters and mapping helpers.
      const measured = channels.map((samples) => {
        const crossings = []
        for (let i = 1; i < samples.length; i++) {
          if (samples[i - 1] <= 0 && samples[i] > 0) crossings.push(i - 1 - samples[i - 1] / (samples[i] - samples[i - 1]))
        }
        return (crossings.length - 1) * sampleRate / (crossings.at(-1)! - crossings[0])
      })
      const amplitudeAt = (samples: Float32Array, frequency: number) => {
        let sine = 0, cosine = 0
        for (let i = 0; i < samples.length; i++) {
          const phase = i * Math.PI * 2 * frequency / sampleRate
          sine += samples[i] * Math.sin(phase); cosine += samples[i] * Math.cos(phase)
        }
        return 2 * Math.hypot(sine, cosine) / samples.length
      }
      const expected = [440 - expectedDifference / 2, 440 + expectedDifference / 2]
      const own = channels.map((samples, i) => amplitudeAt(samples, expected[i]))
      const opposite = channels.map((samples, i) => amplitudeAt(samples, expected[1 - i]))
      sound.stop(); sound.stop()
      readings.push({ expectedDifference, measured, own, opposite })
    }
    return readings
  }, defaults)

  for (const reading of readings) {
    expect(reading.measured[1] - reading.measured[0]).toBeCloseTo(reading.expectedDifference, 3)
    expect((reading.measured[0] + reading.measured[1]) / 2).toBeCloseTo(440, 3)
    for (let channel = 0; channel < 2; channel++) {
      expect(reading.own[channel]).toBeGreaterThan(.04)
      expect(reading.own[channel]).toBeLessThan(.07)
      expect(reading.opposite[channel] / reading.own[channel]).toBeLessThan(.001)
    }
  }
})

test('disabled layers are silent, and pulse output is finite, deterministic and varied by seed', async ({ page }) => {
  const result = await page.evaluate(async (defaults) => {
    const url = '/src/rhythm.ts'
    const { createRhythm } = await import(url) as typeof import('../src/rhythm')
    const sampleRate = 12000
    const render = async (settings: typeof defaults, seed: number) => {
      const context = new OfflineAudioContext(2, sampleRate * 8, sampleRate)
      const sound = createRhythm(context, settings, context.destination, context.destination, seed, 45)
      const buffer = await context.startRendering()
      sound.stop()
      return [buffer.getChannelData(0), buffer.getChannelData(1)]
    }
    const silence = await render(defaults, 4217)
    const settings = { ...defaults, pulse: 1, bounce: .8 }
    const first = await render(settings, 4217)
    const repeat = await render(settings, 4217)
    const other = await render(settings, 7319)
    let silentPeak = 0, peak = 0, power = 0, repeatPower = 0, otherPower = 0, invalid = 0
    for (let channel = 0; channel < 2; channel++) {
      for (let i = 0; i < first[channel].length; i++) {
        silentPeak = Math.max(silentPeak, Math.abs(silence[channel][i]))
        const sample = first[channel][i]
        if (!Number.isFinite(sample)) invalid++
        peak = Math.max(peak, Math.abs(sample)); power += sample ** 2
        repeatPower += (sample - repeat[channel][i]) ** 2
        otherPower += (sample - other[channel][i]) ** 2
      }
    }
    const count = first[0].length * 2
    return { silentPeak, peak, invalid, rms: Math.sqrt(power / count), repeatRms: Math.sqrt(repeatPower / count), otherRms: Math.sqrt(otherPower / count) }
  }, defaults)
  expect(result.silentPeak).toBe(0)
  expect(result.invalid).toBe(0)
  expect(result.peak).toBeLessThan(.4)
  expect(result.rms).toBeGreaterThan(.01)
  expect(result.repeatRms).toBeLessThan(.000001)
  expect(result.otherRms).toBeGreaterThan(.0005)
})

test('the rendered pulse has the requested BPM and tempo changes arrive at the next beat', async ({ page }) => {
  const result = await page.evaluate(async (defaults) => {
    const url = '/src/rhythm.ts'
    const { createRhythm } = await import(url) as typeof import('../src/rhythm')
    const sampleRate = 12000
    const render = async (tempo: number, change?: { at: number; to: number }) => {
      const context = new OfflineAudioContext(2, sampleRate * 11, sampleRate)
      const sound = createRhythm(context, { ...defaults, pulse: 1, bounce: 0, tempo }, context.destination, context.destination, 4217, 45)
      const paused = change ? context.suspend(change.at) : undefined
      const rendering = context.startRendering()
      let editedAt = 0
      if (paused && change) {
        await paused; editedAt = context.currentTime
        sound.update({ ...defaults, pulse: 1, bounce: 0, tempo: change.to })
        await context.resume()
      }
      const buffer = await rendering
      const samples = buffer.getChannelData(0)
      const block = 120
      const envelope = []
      for (let i = 0; i + block <= samples.length; i += block) {
        let power = 0
        for (let j = i; j < i + block; j++) power += samples[j] ** 2
        envelope.push(Math.sqrt(power / block))
      }
      const peaks = []
      // Every anchor decays to silence; take the maximum within each audible
      // region rather than count waveform cycles as musical beats.
      for (let i = 0; i < envelope.length;) {
        if (envelope[i] < .004) { i++; continue }
        let top = i
        while (i < envelope.length && envelope[i] >= .004) {
          if (envelope[i] > envelope[top]) top = i
          i++
        }
        const time = (top + .5) * block / sampleRate
        if (time > 1.5 && (peaks.length === 0 || time - peaks.at(-1)! > .25)) peaks.push(time)
      }
      sound.stop()
      return { peaks, editedAt }
    }
    return { slow: await render(0), fast: await render(1), edited: await render(0, { at: 3.2, to: 1 }) }
  }, defaults)
  const intervals = (peaks: number[]) => peaks.slice(1).map((time, i) => time - peaks[i])
  for (const gap of intervals(result.slow.peaks)) expect(gap).toBeCloseTo(60 / 48, 1)
  for (const gap of intervals(result.fast.peaks)) expect(gap).toBeCloseTo(60 / 108, 1)
  expect(result.slow.peaks.length).toBeGreaterThan(5)
  expect(result.fast.peaks.length).toBeGreaterThan(12)
  const newTempoPeaks = result.edited.peaks.filter((time) => time > result.edited.editedAt + .2)
  expect(newTempoPeaks[0] - result.edited.editedAt).toBeLessThan(1.3)
  for (const gap of intervals(newTempoPeaks)) expect(gap).toBeCloseTo(60 / 108, 1)
})

test('bounce changes move the actual stereo replies onto the new swung position without restarting the pulse', async ({ page }) => {
  const result = await page.evaluate(async (defaults) => {
    const url = '/src/rhythm.ts'
    const { createRhythm } = await import(url) as typeof import('../src/rhythm')
    const sampleRate = 12000, duration = 12, beatLength = 60 / 72
    const context = new OfflineAudioContext(2, sampleRate * duration, sampleRate)
    const settings = { ...defaults, pulse: 1, tempo: .4, bounce: .2 }
    const sound = createRhythm(context, settings, context.destination, context.destination, 4217, 45)
    const paused = context.suspend(5)
    const rendering = context.startRendering()
    await paused
    const editedAt = context.currentTime
    sound.update({ ...settings, bounce: 1 })
    await context.resume()
    const buffer = await rendering
    const left = buffer.getChannelData(0), right = buffer.getChannelData(1)
    const hits = []
    for (let beat = 1; .08 + beat * beatLength < duration - beatLength; beat++) {
      const start = .08 + beat * beatLength
      let peak = 0, peakAt = 0
      // Centered anchors cancel in L-R. Windowed side power locates only the
      // articulated replies, without inspecting scheduled AudioParam events.
      for (let t = start + beatLength * .35; t < start + beatLength * .88; t += .002) {
        const index = Math.round(t * sampleRate)
        let power = 0
        for (let j = index; j < index + 120; j++) power += (left[j] - right[j]) ** 2
        if (power > peak) { peak = power; peakAt = t + .005 }
      }
      if (peak > .00003) hits.push({ start, time: peakAt, phase: (peakAt - start) / beatLength })
    }
    sound.stop()
    return { editedAt, before: hits.filter((hit) => hit.time < editedAt), after: hits.filter((hit) => hit.start > editedAt + .06) }
  }, defaults)
  expect(result.before.length).toBeGreaterThanOrEqual(2)
  expect(result.after.length).toBeGreaterThanOrEqual(2)
  // A small constant attack/window delay accompanies both phases.
  for (const hit of result.before) expect(hit.phase).toBeGreaterThan(.532)
  for (const hit of result.before) expect(hit.phase).toBeLessThan(.57)
  for (const hit of result.after) expect(hit.phase).toBeGreaterThan(.66)
  for (const hit of result.after) expect(hit.phase).toBeLessThan(.7)
  expect(result.after[0].start - result.editedAt).toBeLessThan(2.6)
})

test('rapid control drags keep headphone PCM continuous with or without cancelAndHoldAtTime', async ({ page }) => {
  const result = await page.evaluate(async (defaults) => {
    const url = '/src/rhythm.ts'
    const { createRhythm } = await import(url) as typeof import('../src/rhythm')
    const sampleRate = 24000
    const descriptor = Object.getOwnPropertyDescriptor(AudioParam.prototype, 'cancelAndHoldAtTime')
    const render = async (withoutHold: boolean) => {
      if (withoutHold) Object.defineProperty(AudioParam.prototype, 'cancelAndHoldAtTime', { configurable: true, value: undefined })
      const context = new OfflineAudioContext(2, sampleRate * 6, sampleRate)
      let settings = { ...defaults, binaural: 1 }
      const sound = createRhythm(context, settings, context.destination, context.destination, 4217, 45)
      const changes = Array.from({ length: 18 }, (_, i) => ({ time: 1.7 + i * .08, amount: i % 2 ? .85 : .1, rate: i % 3 / 2 }))
      changes.push({ time: 3.3, amount: 0, rate: .4 })
      const suspensions = changes.map((change) => context.suspend(change.time))
      const rendering = context.startRendering()
      for (let i = 0; i < changes.length; i++) {
        await suspensions[i]
        settings = { ...settings, binaural: changes[i].amount, beatRate: changes[i].rate }
        sound.update(settings)
        await context.resume()
      }
      const buffer = await rendering
      let step = 0, peak = 0, silentPeak = 0, invalid = 0
      const output = [buffer.getChannelData(0), buffer.getChannelData(1)]
      for (const samples of output) {
        for (let i = 1; i < samples.length; i++) {
          if (!Number.isFinite(samples[i])) invalid++
          step = Math.max(step, Math.abs(samples[i] - samples[i - 1]))
          peak = Math.max(peak, Math.abs(samples[i]))
          if (i > sampleRate * 4.9) silentPeak = Math.max(silentPeak, Math.abs(samples[i]))
        }
      }
      sound.stop()
      return { step, peak, silentPeak, invalid, output }
    }
    try {
      const normal = await render(false), fallback = await render(true)
      let difference = 0
      for (let ch = 0; ch < 2; ch++) for (let i = 0; i < normal.output[ch].length; i++) {
        difference = Math.max(difference, Math.abs(normal.output[ch][i] - fallback.output[ch][i]))
      }
      return { normal: { ...normal, output: undefined }, fallback: { ...fallback, output: undefined }, difference }
    } finally {
      if (descriptor) Object.defineProperty(AudioParam.prototype, 'cancelAndHoldAtTime', descriptor)
      else delete (AudioParam.prototype as unknown as Record<string, unknown>).cancelAndHoldAtTime
    }
  }, defaults)
  for (const reading of [result.normal, result.fallback]) {
    expect(reading.invalid).toBe(0)
    expect(reading.peak).toBeGreaterThan(.04)
    // A 446 Hz sine at the maximum layer level normally changes by ~0.0064
    // per sample. This leaves little room for a discontinuity during a drag.
    expect(reading.step).toBeLessThan(.007)
    expect(reading.silentPeak).toBe(0)
  }
  expect(result.difference).toBeLessThan(.000001)
})

test('pulse muting fades to silence, restores sound, and releases a bounded source pool', async ({ page }) => {
  const result = await page.evaluate(async (defaults) => {
    const url = '/src/rhythm.ts'
    const { createRhythm } = await import(url) as typeof import('../src/rhythm')
    const sampleRate = 12000
    const context = new OfflineAudioContext(2, sampleRate * 8, sampleRate)
    const create = context.createOscillator.bind(context)
    let created = 0, stopped = 0
    context.createOscillator = () => {
      const oscillator = create()
      created++
      const stop = oscillator.stop.bind(oscillator)
      oscillator.stop = (when?: number) => { stopped++; stop(when) }
      return oscillator
    }
    let settings = { ...defaults, pulse: 1, bounce: .8 }
    const sound = createRhythm(context, settings, context.destination, context.destination, 4217, 45)
    const initialSources = created
    const pause = context.suspend(2), restart = context.suspend(4)
    const rendering = context.startRendering()
    await pause
    settings = { ...settings, pulse: 0 }
    sound.update(settings)
    await context.resume()
    await restart
    settings = { ...settings, pulse: 1, tempo: 1 }
    for (let i = 0; i < 30; i++) sound.update({ ...settings, bounce: i / 29 })
    await context.resume()
    const buffer = await rendering
    let quiet = 0, restarted = 0
    for (let ch = 0; ch < 2; ch++) {
      const samples = buffer.getChannelData(ch)
      for (let i = sampleRate * 3; i < sampleRate * 4; i++) quiet = Math.max(quiet, Math.abs(samples[i]))
      for (let i = sampleRate * 5; i < samples.length; i++) restarted = Math.max(restarted, Math.abs(samples[i]))
    }
    sound.stop(); sound.stop(); sound.update(settings)
    return { quiet, restarted, initialSources, created, stopped }
  }, defaults)
  expect(result.quiet).toBe(0)
  expect(result.restarted).toBeGreaterThan(.03)
  expect(result.initialSources).toBeGreaterThan(0)
  expect(result.created).toBeLessThanOrEqual(12)
  expect(result.created).toBe(result.initialSources)
  expect(result.stopped).toBe(result.created)
})

test('a live context can initialize and edit the full thirty-minute pulse schedule responsively', async ({ page }) => {
  const result = await page.evaluate(async (defaults) => {
    const url = '/src/rhythm.ts'
    const { createRhythm } = await import(url) as typeof import('../src/rhythm')
    // A real context takes the live 30-minute scheduling path. Keeping its
    // clock suspended makes repeated edits comparable without playing audio.
    const context = new AudioContext()
    await context.suspend()
    const settings = { ...defaults, pulse: 1, tempo: 1, bounce: 1 }
    const before = performance.now()
    const sound = createRhythm(context, settings, context.destination, context.destination, 4217, 45)
    const initializeMs = performance.now() - before
    const updateMs = []
    try {
      for (const [tempo, bounce] of [[.1, .2], [1, .8], [.4, 1], [.9, .35], [.2, .6], [1, 1]]) {
        const started = performance.now()
        sound.update({ ...settings, tempo, bounce })
        updateMs.push(performance.now() - started)
        // Let native work queued by this drag run before the next one.
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      const sorted = [...updateMs].sort((a, b) => a - b)
      return { initializeMs, updateMs, medianUpdateMs: sorted[Math.floor(sorted.length / 2)], maximumUpdateMs: Math.max(...updateMs), contextTime: context.currentTime }
    } finally {
      sound.stop()
      await context.close()
    }
  }, defaults)
  await test.info().attach('live-rhythm-scheduling-times', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  console.log('Live rhythm scheduling milliseconds:', JSON.stringify(result))
  expect(result.contextTime).toBe(0)
  expect(result.initializeMs).toBeLessThan(250)
  expect(result.medianUpdateMs).toBeLessThan(50)
  expect(result.maximumUpdateMs).toBeLessThan(150)
})
