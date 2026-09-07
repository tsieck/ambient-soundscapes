import { expect, test } from '@playwright/test'
import type { AtmosphereId, SoundSettings } from '../src/audio'

// Several checks synthesize multiple minutes of audio in each comparison.
// Shared CI runners need more render time than the UI's 30-second deadline.
test.setTimeout(60_000)

const defaults: SoundSettings = {
  warmth: 0.6, darkness: 0.5, movement: 0.35, rain: 0.4, volume: 0.6,
  space: 0.65, density: 0.5, drift: 0.35, tension: 0.35,
  bedLevel: .55, padLevel: .75, detailLevel: .5, textureLevel: .3,
  pulse: 0, tempo: .4, bounce: .35, binaural: 0, beatRate: .4,
}

test.beforeEach(async ({ page }) => {
  // Keep audio renders independent of the React UI and its development HMR.
  await page.route('**/__audio-check', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body style="min-height:100vh;margin:0">Audio test harness</body></html>',
  }))
  await page.goto('/__audio-check')
})

for (const id of ['city', 'afternoon'] as AtmosphereId[]) {
  test(`${id} renders stereo sound with headroom at default and maximum settings`, async ({ page }) => {
    const readings = await page.evaluate(async ({ id, defaults }) => {
      const moduleUrl = '/src/audio.ts'
      const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
      const readings = []
      for (const settings of [
        defaults,
        { ...defaults, warmth: 1, darkness: 0, movement: 1, rain: 1, volume: 1, space: 1, density: 1, drift: 1, tension: 1, bedLevel: 1, padLevel: 1, detailLevel: 1, textureLevel: 1, pulse: 1, tempo: 1, bounce: 1, binaural: 1, beatRate: 1 },
        { ...defaults, warmth: 1, darkness: 1, movement: 1, rain: 1, volume: 1, space: 1, density: 1, drift: 1, tension: 1, bedLevel: 1, padLevel: 1, detailLevel: 1, textureLevel: 1, pulse: 1, tempo: 1, bounce: 1, binaural: 1, beatRate: 1 },
      ]) {
        const sampleRate = 24000
        const context = new OfflineAudioContext(2, sampleRate * 14, sampleRate)
        const sound = createSoundscape(context, id, settings, context.destination)
        const rendered = await context.startRendering()
        const left = rendered.getChannelData(0)
        const right = rendered.getChannelData(1)
        let peak = 0
        let energy = 0
        let sideEnergy = 0
        let invalid = 0
        const start = sampleRate * 3
        for (let index = start; index < left.length; index++) {
          if (!Number.isFinite(left[index]) || !Number.isFinite(right[index])) invalid++
          peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]))
          energy += left[index] ** 2 + right[index] ** 2
          sideEnergy += (left[index] - right[index]) ** 2
        }
        sound.stop()
        sound.stop() // Cleanup is intentionally idempotent.
        readings.push({
          peak,
          rms: Math.sqrt(energy / ((left.length - start) * 2)),
          stereoDifference: Math.sqrt(sideEnergy / (left.length - start)),
          invalid,
        })
      }
      return readings
    }, { id, defaults })

    for (const reading of readings) {
      expect(reading.invalid).toBe(0)
      expect(reading.peak).toBeGreaterThan(0.02)
      expect(reading.peak).toBeLessThan(0.95)
      expect(reading.rms).toBeGreaterThan(0.015)
      expect(reading.rms).toBeLessThan(0.32)
      expect(reading.stereoDifference).toBeGreaterThan(0.005)
    }
  })
}

test('moving volume to zero silences music, pulse, rain, and headphone beat after its fade', async ({ page }) => {
  const result = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
    const sampleRate = 24000
    const context = new OfflineAudioContext(2, sampleRate * 6, sampleRate)
    const sound = createSoundscape(context, 'city', settings, context.destination)
    const suspended = context.suspend(3)
    const rendering = context.startRendering()
    await suspended
    sound.update({ ...settings, volume: 0 })
    await context.resume()
    const rendered = await rendering
    let before = 0
    let after = 0
    for (let channel = 0; channel < 2; channel++) {
      const samples = rendered.getChannelData(channel)
      for (let index = sampleRate * 2; index < sampleRate * 3; index++) {
        before = Math.max(before, Math.abs(samples[index]))
      }
      for (let index = sampleRate * 4; index < samples.length; index++) {
        after = Math.max(after, Math.abs(samples[index]))
      }
    }
    sound.stop()
    return { before, after }
  }, { ...defaults, pulse: .8, binaural: .7 })
  expect(result.before).toBeGreaterThan(0.02)
  expect(result.after).toBe(0)
})

test('rapid switching and pause/play races release sources and preserve the latest action', async ({ page }) => {
  // Supply the same real user activation required by the app's play button.
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  const result = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { AmbientEngine } = await import(moduleUrl) as typeof import('../src/audio')
    const liveSources = new Set<AudioScheduledSourceNode>()
    const prototype = BaseAudioContext.prototype
    const methods = ['createOscillator', 'createBufferSource', 'createConstantSource'] as const
    const restore: (() => void)[] = []
    for (const method of methods) {
      const original = prototype[method] as () => AudioScheduledSourceNode
      Object.defineProperty(prototype, method, {
        configurable: true,
        writable: true,
        value(this: BaseAudioContext) {
          const source = original.call(this)
          const stop = source.stop.bind(source)
          liveSources.add(source)
          source.addEventListener('ended', () => liveSources.delete(source))
          source.stop = (when = 0) => {
            if (when <= this.currentTime) liveSources.delete(source)
            stop(when)
          }
          return source
        },
      })
      restore.push(() => Object.defineProperty(prototype, method, {
        configurable: true, writable: true, value: original,
      }))
    }
    const engine = new AmbientEngine()
    try {
      const initialState = engine.getContextState()
      const initialAnalyser = engine.getAnalyser()
      await engine.play('city', settings)
      const oneSceneSources = liveSources.size
      for (let index = 0; index < 30; index++) {
        engine.setSound({ preset: index % 2 === 0 ? 'glass' : 'tape', seed: index }, settings)
      }
      const duringSwitch = liveSources.size
      // Two queued crossfades follow the audio clock, and their ended callbacks
      // may arrive later on a busy runner. Observe cleanup instead of assuming
      // that 6.2 seconds of wall time always includes both callbacks.
      const switchStarted = performance.now()
      const switchAudioStarted = engine.getAnalyser()!.context.currentTime
      while (liveSources.size !== oneSceneSources && performance.now() - switchStarted < 20_000) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      const switchWaitMs = performance.now() - switchStarted
      const switchAudioSeconds = engine.getAnalyser()!.context.currentTime - switchAudioStarted
      const afterSwitch = liveSources.size
      const beforeSettings = liveSources.size
      engine.update({ ...settings, warmth: .8, darkness: .2, movement: .65, rain: .2, volume: .55, space: .8, density: .8, drift: .6, tension: .6, bedLevel: .8, padLevel: .7, detailLevel: .9, textureLevel: .7 })
      engine.setAtmosphere('afternoon', settings, { preset: 'tape', seed: 29 })
      const afterSettings = liveSources.size
      const pendingPause = engine.pause()
      await engine.play('afternoon', settings)
      await pendingPause
      const resumed = engine.getContextState()
      await engine.pause()
      const paused = engine.getContextState()
      const afterPause = liveSources.size
      await engine.play('city', settings)
      const pendingPlay = engine.play('afternoon', settings)
      await engine.dispose()
      await pendingPlay
      await engine.dispose()
      return {
        initialState, initialAnalyser,
        oneSceneSources, duringSwitch, afterSwitch, beforeSettings, afterSettings, switchWaitMs, switchAudioSeconds,
        resumed, paused, afterPause,
        disposed: engine.getContextState(),
        afterDispose: liveSources.size,
      }
    } finally {
      await engine.dispose()
      restore.forEach((reset) => reset())
    }
  }, defaults)

  expect(result.initialState).toBe('uninitialized')
  expect(result.initialAnalyser).toBeNull()
  expect(result.oneSceneSources).toBeGreaterThan(0)
  expect(result.duringSwitch).toBeLessThanOrEqual(result.oneSceneSources * 2 + 1)
  expect(result.afterSwitch, JSON.stringify(result)).toBe(result.oneSceneSources)
  expect(result.afterSettings).toBe(result.beforeSettings)
  expect(result.resumed).toBe('running')
  expect(result.paused).toBe('suspended')
  expect(result.afterPause).toBe(0)
  expect(result.disposed).toBe('closed')
  expect(result.afterDispose).toBe(0)
})

test('all thirteen presets render, and seeds and profiles change the actual audio', async ({ page }) => {
  const result = await page.evaluate(async (settings) => {
    const audioUrl = '/src/audio.ts'
    const presetUrl = '/src/sound-presets.ts'
    const { createSoundscape } = await import(audioUrl) as typeof import('../src/audio')
    const { SOUND_PRESETS, generateVariation } = await import(presetUrl) as typeof import('../src/sound-presets')
    const sampleRate = 16000
    async function render(identity: import('../src/audio').SoundIdentity, controls: import('../src/audio').SoundSettings) {
      const context = new OfflineAudioContext(2, sampleRate * 12, sampleRate)
      const sound = createSoundscape(context, 'city', controls, context.destination, identity)
      const buffer = await context.startRendering()
      sound.stop()
      return buffer.getChannelData(0).slice(sampleRate * 3)
    }
    const readings = []
    for (const preset of SOUND_PRESETS) {
      const variation = generateVariation(preset.id, 7319)
      const samples = await render(variation.identity, variation.settings)
      let peak = 0, energy = 0, invalid = 0
      for (const value of samples) {
        if (!Number.isFinite(value)) invalid++
        peak = Math.max(peak, Math.abs(value)); energy += value * value
      }
      readings.push({ id: preset.id, peak, rms: Math.sqrt(energy / samples.length), invalid,
        bounded: Object.values(variation.settings).every((value) => value >= 0 && value <= 1),
        deterministic: JSON.stringify(variation) === JSON.stringify(generateVariation(preset.id, 7319)),
      })
    }
    const neutral = { ...settings, rain: 0 }
    const first = await render({ preset: 'velvet', seed: 4217 }, neutral)
    const repeated = await render({ preset: 'velvet', seed: 4217 }, neutral)
    const differentSeed = await render({ preset: 'velvet', seed: 8451 }, neutral)
    const differentProfile = await render({ preset: 'glass', seed: 4217 }, neutral)
    const difference = (other: Float32Array) => {
      let energy = 0
      for (let index = 0; index < first.length; index++) energy += (first[index] - other[index]) ** 2
      return Math.sqrt(energy / first.length)
    }
    return { readings, repeatDifference: difference(repeated), seedDifference: difference(differentSeed), profileDifference: difference(differentProfile) }
  }, defaults)
  await test.info().attach('preset-audio-metrics', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  expect(result.readings).toHaveLength(13)
  for (const reading of result.readings) {
    expect(reading.invalid, reading.id).toBe(0)
    expect(reading.peak, reading.id).toBeLessThan(.95)
    expect(reading.rms, reading.id).toBeGreaterThan(.01)
    expect(reading.bounded, reading.id).toBe(true)
    expect(reading.deterministic, reading.id).toBe(true)
  }
  expect(result.repeatDifference).toBeLessThan(.00001)
  expect(result.seedDifference).toBeGreaterThan(.01)
  expect(result.profileDifference).toBeGreaterThan(.01)
})

test('a long render changes bass harmony and stays finite without musical gaps', async ({ page }) => {
  const result = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
    const rate = 16000
    const context = new OfflineAudioContext(2, rate * 150, rate)
    const sound = createSoundscape(context, 'city', { ...settings, movement: .95, density: .75, rain: 0, volume: 1, bedLevel: 1, padLevel: 1, detailLevel: 1, textureLevel: 1 }, context.destination, { preset: 'bloom', seed: 8127 })
    const buffer = await context.startRendering()
    sound.stop()
    const samples = buffer.getChannelData(0)
    let peak = 0, invalid = 0
    for (const value of samples) { if (!Number.isFinite(value)) invalid++; peak = Math.max(peak, Math.abs(value)) }
    const bassNotes = []
    const levels = []
    for (const second of [14, 42, 70, 98, 126]) {
      let strongest = 0, strongestMidi = 0, energy = 0
      for (let index = second * rate; index < (second + 2) * rate; index++) energy += samples[index] ** 2
      levels.push(Math.sqrt(energy / (rate * 2)))
      // Goertzel bins identify the bass pitch from rendered audio, rather than
      // checking the score generator's own implementation.
      for (let midi = 35; midi <= 60; midi++) {
        const frequency = 440 * 2 ** ((midi - 69) / 12)
        const coefficient = 2 * Math.cos(2 * Math.PI * frequency / rate)
        let previous = 0, previousPrevious = 0
        for (let index = second * rate; index < (second + 2) * rate; index++) {
          const current = samples[index] + coefficient * previous - previousPrevious
          previousPrevious = previous; previous = current
        }
        const power = previous ** 2 + previousPrevious ** 2 - coefficient * previous * previousPrevious
        if (power > strongest) { strongest = power; strongestMidi = midi }
      }
      bassNotes.push(strongestMidi)
    }
    return { peak, invalid, bassNotes, levels }
  }, defaults)
  await test.info().attach('long-render-audio-metrics', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  expect(result.invalid).toBe(0)
  expect(result.peak).toBeLessThan(.95)
  expect(new Set(result.bassNotes).size).toBeGreaterThan(1)
  for (const level of result.levels) expect(level).toBeGreaterThan(.01)
})

test('musical sliders preserve the current phrase with and without cancelAndHoldAtTime', async ({ page }) => {
  const result = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
    const rate = 16000
    const controls = { ...settings, movement: .25, rain: 0 }
    const originalHold = AudioParam.prototype.cancelAndHoldAtTime
    async function render(edit: boolean, fallback: boolean) {
      if (fallback) Object.defineProperty(AudioParam.prototype, 'cancelAndHoldAtTime', { configurable: true, writable: true, value: undefined })
      const context = new OfflineAudioContext(2, rate * 110, rate)
      const factory = context.createOscillator.bind(context)
      const cancellationTimes: number[] = []
      let created = 0
      context.createOscillator = () => {
        created++
        const node = factory()
        const cancel = node.frequency.cancelScheduledValues.bind(node.frequency)
        node.frequency.cancelScheduledValues = (time) => { cancellationTimes.push(time); return cancel(time) }
        return node
      }
      const sound = createSoundscape(context, 'city', controls, context.destination, { preset: 'velvet', seed: 4217 })
      const before = created
      // Only observe replanning caused by the edit; headphone initialization
      // also initializes its frequency smoothing at time zero.
      cancellationTimes.length = 0
      const suspended = context.suspend(10)
      const rendering = context.startRendering()
      await suspended
      if (edit) sound.update({ ...controls, density: .95, tension: .9 })
      const after = created
      await context.resume()
      const buffer = await rendering
      sound.stop()
      Object.defineProperty(AudioParam.prototype, 'cancelAndHoldAtTime', { configurable: true, writable: true, value: originalHold })
      return { samples: buffer.getChannelData(0), before, after, boundary: Math.min(...cancellationTimes) }
    }
    const baseline = await render(false, false)
    const results = []
    for (const fallback of [false, true]) {
      const changed = await render(true, fallback)
      let beforeEnergy = 0, afterEnergy = 0
      const boundary = Math.floor(changed.boundary * rate)
      for (let index = rate * 10; index < boundary - rate; index++) beforeEnergy += (changed.samples[index] - baseline.samples[index]) ** 2
      for (let index = boundary + rate * 8; index < changed.samples.length; index++) afterEnergy += (changed.samples[index] - baseline.samples[index]) ** 2
      results.push({ fallback, before: changed.before, after: changed.after, boundary: changed.boundary,
        beforeDifference: Math.sqrt(beforeEnergy / (boundary - rate * 11)),
        afterDifference: Math.sqrt(afterEnergy / (changed.samples.length - boundary - rate * 8)),
      })
    }
    return results
  }, defaults)
  for (const reading of result) {
    expect(reading.after).toBe(reading.before)
    expect(reading.boundary).toBeGreaterThan(30)
    expect(reading.beforeDifference).toBeLessThan(.00001)
    expect(reading.afterDifference).toBeGreaterThan(.001)
  }
})

test('four solo layers are audible and detail figures leave intentional rests', async ({ page }) => {
  const result = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
    const rate = 16000
    const readings = []
    const silence = { ...settings, movement: .25, density: .65, rain: 0, space: 0, volume: .7,
      bedLevel: 0, padLevel: 0, detailLevel: 0, textureLevel: 0 }
    for (const layer of ['bedLevel', 'padLevel', 'detailLevel', 'textureLevel', 'none'] as const) {
      const controls = layer === 'none' ? silence : { ...silence, [layer]: 1 }
      const context = new OfflineAudioContext(2, rate * 60, rate)
      const sound = createSoundscape(context, 'city', controls, context.destination, { preset: 'tape', seed: 4217 })
      const buffer = await context.startRendering()
      sound.stop()
      const samples = buffer.getChannelData(0)
      let peak = 0, energy = 0
      const windows = []
      for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample }
      for (let second = 5; second < 55; second++) {
        let windowEnergy = 0
        for (let index = second * rate; index < (second + 1) * rate; index++) windowEnergy += samples[index] ** 2
        windows.push(Math.sqrt(windowEnergy / rate))
      }
      readings.push({ layer, peak, rms: Math.sqrt(energy / samples.length), quietest: Math.min(...windows), loudest: Math.max(...windows) })
    }
    return readings
  }, defaults)
  await test.info().attach('layer-audio-metrics', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  for (const reading of result) {
    expect(reading.peak, reading.layer).toBeLessThan(.95)
    if (reading.layer === 'none') expect(reading.peak).toBe(0)
    else expect(reading.rms, reading.layer).toBeGreaterThan(.002)
  }
  const details = result.find((reading) => reading.layer === 'detailLevel')!
  const foundation = result.find((reading) => reading.layer === 'bedLevel')!
  expect(details.quietest).toBeLessThan(details.loudest * .025)
  expect(foundation.quietest).toBeGreaterThan(.003)
})

test('glass keys produce measured FM sidebands unlike the warm harmonic voice', async ({ page }) => {
  const result = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
    const rate = 16000
    const readings = []
    for (const preset of ['glass', 'velvet'] as const) {
      const context = new OfflineAudioContext(2, rate * 6, rate)
      const factory = context.createOscillator.bind(context)
      const firstNoteFrequencies: number[] = []
      context.createOscillator = () => {
        const oscillator = factory()
        const set = oscillator.frequency.setValueAtTime.bind(oscillator.frequency)
        oscillator.frequency.setValueAtTime = (frequency, time) => {
          if (time > 2 && time < 3) firstNoteFrequencies.push(frequency)
          return set(frequency, time)
        }
        return oscillator
      }
      const sound = createSoundscape(context, 'city', { ...settings, movement: .25, density: .5, darkness: 0, warmth: 0, drift: 0, rain: 0, space: 0,
        bedLevel: 0, padLevel: 0, detailLevel: 1, textureLevel: 0 }, context.destination, { preset, seed: 4217 })
      const buffer = await context.startRendering()
      sound.stop()
      const samples = buffer.getChannelData(0)
      const fundamental = Math.min(...firstNoteFrequencies)
      const powerAt = (frequency: number) => {
        const coefficient = 2 * Math.cos(2 * Math.PI * frequency / rate)
        let previous = 0, previousPrevious = 0
        for (let index = Math.floor(rate * 2.45); index < Math.floor(rate * 3.6); index++) {
          const current = samples[index] + coefficient * previous - previousPrevious
          previousPrevious = previous; previous = current
        }
        return previous ** 2 + previousPrevious ** 2 - coefficient * previous * previousPrevious
      }
      readings.push({ preset, fundamental,
        sidebandRatio: (powerAt(fundamental * 1.71) + powerAt(fundamental * 3.71)) / powerAt(fundamental),
      })
    }
    return readings
  }, defaults)
  await test.info().attach('fm-spectrum-metrics', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  const glass = result.find((reading) => reading.preset === 'glass')!
  const velvet = result.find((reading) => reading.preset === 'velvet')!
  expect(glass.fundamental).toBeGreaterThan(100)
  expect(glass.sidebandRatio).toBeGreaterThan(.01)
  expect(glass.sidebandRatio).toBeGreaterThan(velvet.sidebandRatio * 8)
})

test('space drags do not re-amplify sound already decaying in the effects', async ({ page }) => {
  const result = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
    const rate = 24000
    async function render(changeSpace: boolean) {
      const context = new OfflineAudioContext(2, rate * 14, rate)
      const initial = { ...settings, rain: 0, space: .2, bedLevel: 0, padLevel: 0, detailLevel: 1, textureLevel: 0 }
      const silentInput = { ...initial, detailLevel: 0 }
      const sound = createSoundscape(context, 'city', initial, context.destination, { preset: 'tape', seed: 4217 })
      const stopInput = context.suspend(5)
      const adjustments = Array.from({ length: 80 }, (_, index) => context.suspend(8 + index * .025))
      const rendering = context.startRendering()
      await stopInput
      sound.update(silentInput)
      await context.resume()
      for (let index = 0; index < adjustments.length; index++) {
        await adjustments[index]
        if (changeSpace) sound.update({ ...silentInput, space: .5 + Math.sin(index * .47) * .49 })
        await context.resume()
      }
      const buffer = await rendering
      sound.stop()
      return buffer.getChannelData(0)
    }
    const reference = await render(false)
    const changed = await render(true)
    let referenceEnergy = 0, changedEnergy = 0, differenceEnergy = 0
    for (let index = rate * 8; index < changed.length; index++) {
      referenceEnergy += reference[index] ** 2
      changedEnergy += changed[index] ** 2
      differenceEnergy += (reference[index] - changed[index]) ** 2
    }
    return {
      tailRms: Math.sqrt(referenceEnergy / (rate * 6)),
      differenceRms: Math.sqrt(differenceEnergy / (rate * 6)),
      gainRatio: Math.sqrt(changedEnergy / referenceEnergy),
      relativeDifference: Math.sqrt(differenceEnergy / referenceEnergy),
    }
  }, defaults)
  expect(result.tailRms).toBeGreaterThan(0.0000001)
  const diagnostic = JSON.stringify(result)
  // Platform-specific float32 rendering can differ in the final bits. Bound
  // both the absolute error (-140 dBFS RMS) and the relative change (0.01%).
  // The original return/feedback bug increased tail amplitude by 162.5%.
  expect(result.differenceRms, diagnostic).toBeLessThan(.0000001)
  expect(result.relativeDifference, diagnostic).toBeLessThan(.0001)
  expect(Math.abs(result.gainRatio - 1), diagnostic).toBeLessThan(.0001)
})

test('no-op updates do not restart the initial fade or an in-progress control ramp', async ({ page }) => {
  const result = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
    const rate = 16000
    async function render(extraUpdates: boolean) {
      const context = new OfflineAudioContext(2, rate * 9, rate)
      let current = { ...settings, rain: 0 }
      const sound = createSoundscape(context, 'city', current, context.destination, { preset: 'velvet', seed: 4217 })
      const times = [.25, .6, 5, 5.2, 5.8, 6.5]
      const suspensions = times.map((time) => context.suspend(time))
      const rendering = context.startRendering()
      let noOpSchedules = 0
      for (let index = 0; index < times.length; index++) {
        await suspensions[index]
        if (times[index] === 5) {
          current = { ...current, warmth: .95 }
          sound.update(current)
        } else if (extraUpdates) {
          const methods = ['setValueAtTime', 'linearRampToValueAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime'] as const
          const restore = methods.map((method) => {
            const original = AudioParam.prototype[method]
            Object.defineProperty(AudioParam.prototype, method, {
              configurable: true, writable: true,
              value(this: AudioParam, ...args: number[]) { noOpSchedules++; return Reflect.apply(original, this, args) },
            })
            return () => Object.defineProperty(AudioParam.prototype, method, { configurable: true, writable: true, value: original })
          })
          try { sound.update({ ...current }) } finally { restore.forEach((reset) => reset()) }
        }
        await context.resume()
      }
      const buffer = await rendering
      sound.stop()
      return { samples: buffer.getChannelData(0), noOpSchedules }
    }
    const reference = await render(false)
    const updated = await render(true)
    let maximumDifference = 0
    for (let index = 0; index < reference.samples.length; index++) maximumDifference = Math.max(maximumDifference, Math.abs(reference.samples[index] - updated.samples[index]))
    return { maximumDifference, noOpSchedules: updated.noOpSchedules }
  }, defaults)
  expect(result.noOpSchedules).toBe(0)
  // Zero scheduling calls is exact. PCM permits platform render rounding up
  // to -100 dBFS peak; restarting the initial fade creates a much larger error.
  expect(result.maximumDifference, JSON.stringify(result)).toBeLessThan(.00001)
})

test('using pulse and headphone controls leaves the underlying ambient performance intact', async ({ page }) => {
  const result = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
    const rate = 16000
    const initial = { ...settings, rain: 0, movement: .6 }
    async function render(edit: boolean) {
      const context = new OfflineAudioContext(2, rate * 130, rate)
      const sound = createSoundscape(context, 'city', initial, context.destination, { preset: 'tape', seed: 4217 })
      const times = [5, 15, 25]
      const suspensions = times.map((time) => context.suspend(time))
      const rendering = context.startRendering()
      for (let index = 0; index < times.length; index++) {
        await suspensions[index]
        if (edit) sound.update(index === 2 ? initial : { ...initial,
          pulse: .8, tempo: index === 0 ? .4 : 1, bounce: index === 0 ? .8 : .3,
          binaural: .6, beatRate: .8,
        })
        await context.resume()
      }
      const buffer = await rendering
      sound.stop()
      return buffer.getChannelData(0)
    }
    const baseline = await render(false), changed = await render(true)
    const difference = (start: number, end: number) => {
      let sum = 0
      for (let i = start * rate; i < end * rate; i++) sum += (baseline[i] - changed[i]) ** 2
      return Math.sqrt(sum / ((end - start) * rate))
    }
    return { active: difference(10, 22), settled: difference(55, 130) }
  }, defaults)
  expect(result.active).toBeGreaterThan(.005)
  // After the extra layers and their room tails have faded, the same seeded
  // ambient performance must remain, including later harmonic decisions.
  expect(result.settled).toBeLessThan(.000001)
})
