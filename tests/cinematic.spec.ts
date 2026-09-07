import { expect, test } from '@playwright/test'
import type { SoundPresetId } from '../src/sound-presets'

test.beforeEach(async ({ page }) => {
  await page.route('**/__cinematic-check', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body>Cinematic audio render harness</body></html>',
  }))
  await page.goto('/__cinematic-check')
})

for (const preset of ['neon', 'midnight', 'afterglow'] as SoundPresetId[]) {
  test(`${preset} stays audible, finite, and below clipping across seeds and extreme mixes`, async ({ page }) => {
    test.setTimeout(60_000)
    const readings = await page.evaluate(async (preset) => {
      const audioUrl = '/src/audio.ts', presetsUrl = '/src/sound-presets.ts'
      const { createSoundscape } = await import(audioUrl) as typeof import('../src/audio')
      const { SOUND_PRESETS } = await import(presetsUrl) as typeof import('../src/sound-presets')
      const defaults = SOUND_PRESETS.find((entry) => entry.id === preset)!.settings
      const maximum = {
        warmth: 1, darkness: 0, movement: 1, rain: 1, volume: 1,
        space: 1, density: 1, drift: 1, tension: 1,
        bedLevel: 1, padLevel: 1, detailLevel: 1, textureLevel: 1,
        pulse: 1, tempo: 1, bounce: 1, binaural: 1, beatRate: 1,
      }
      const readings = []
      const rate = 24000
      for (const seed of [4217, 7319, 8127]) {
        for (const [mix, settings] of [
          ['default', defaults], ['maximum-bright', maximum], ['maximum-dark', { ...maximum, darkness: 1 }],
        ] as const) {
          const context = new OfflineAudioContext(2, rate * 18, rate)
          const factory = context.createOscillator.bind(context)
          let sources = 0
          context.createOscillator = () => { sources++; return factory() }
          const sound = createSoundscape(context, 'city', settings, context.destination, { preset, seed })
          const initialSources = sources
          const buffer = await context.startRendering()
          const left = buffer.getChannelData(0), right = buffer.getChannelData(1)
          let peak = 0, energy = 0, sideEnergy = 0, invalid = 0
          const start = rate * 3
          for (let index = 0; index < left.length; index++) {
            if (!Number.isFinite(left[index]) || !Number.isFinite(right[index])) invalid++
            peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]))
            if (index >= start) {
              energy += left[index] ** 2 + right[index] ** 2
              sideEnergy += (left[index] - right[index]) ** 2
            }
          }
          sound.stop()
          readings.push({
            preset, seed, mix, peak, invalid, initialSources, finalSources: sources,
            rms: Math.sqrt(energy / ((left.length - start) * 2)),
            stereoDifference: Math.sqrt(sideEnergy / (left.length - start)),
          })
        }
      }
      return readings
    }, preset)
    await test.info().attach('cinematic-mix-metrics', {
      body: JSON.stringify(readings, null, 2), contentType: 'application/json',
    })
    for (const reading of readings) {
      const evidence = JSON.stringify(reading)
      expect(reading.invalid, evidence).toBe(0)
      expect(reading.peak, evidence).toBeGreaterThan(.02)
      expect(reading.peak, evidence).toBeLessThan(.95)
      expect(reading.rms, evidence).toBeGreaterThan(.015)
      expect(reading.rms, evidence).toBeLessThan(.32)
      expect(reading.stereoDifference, evidence).toBeGreaterThan(.005)
      expect(reading.finalSources, evidence).toBe(reading.initialSources)
    }
  })
}

for (const preset of ['neon', 'afterglow'] as SoundPresetId[]) {
  test(`${preset} preserves held brass articulation when musical controls are edited and restored`, async ({ page }) => {
    test.setTimeout(60_000)
    const result = await page.evaluate(async (preset) => {
      const audioUrl = '/src/audio.ts', presetsUrl = '/src/sound-presets.ts'
      const { createSoundscape } = await import(audioUrl) as typeof import('../src/audio')
      const { SOUND_PRESETS } = await import(presetsUrl) as typeof import('../src/sound-presets')
      // Isolate the sustained instrument so weather, bass, or detail notes
      // cannot mask a broken filter contour on a held chord.
      const settings = {
        ...SOUND_PRESETS.find((entry) => entry.id === preset)!.settings,
        rain: 0, volume: .7, space: 0,
        bedLevel: 0, padLevel: 1, detailLevel: 0, textureLevel: 0,
      }
      const rate = 12000
      const originalHold = AudioParam.prototype.cancelAndHoldAtTime
      type Point = { kind: 'set' | 'ramp'; value: number; time: number }
      async function render(edit: boolean, fallback: boolean) {
        if (fallback) Object.defineProperty(AudioParam.prototype, 'cancelAndHoldAtTime', {
          configurable: true, writable: true, value: undefined,
        })
        try {
          const context = new OfflineAudioContext(2, rate * 120, rate)
          const filters: { node: BiquadFilterNode; points: Point[]; heldBoundaries: number[] }[] = []
          const createFilter = context.createBiquadFilter.bind(context)
          context.createBiquadFilter = () => {
            const node = createFilter()
            const record = { node, points: [] as Point[], heldBoundaries: [] as number[] }
            filters.push(record)
            const set = node.frequency.setValueAtTime.bind(node.frequency)
            node.frequency.setValueAtTime = (value, time) => {
              record.points.push({ kind: 'set', value, time }); return set(value, time)
            }
            const ramp = node.frequency.linearRampToValueAtTime.bind(node.frequency)
            node.frequency.linearRampToValueAtTime = (value, time) => {
              record.points.push({ kind: 'ramp', value, time }); return ramp(value, time)
            }
            const cancel = node.frequency.cancelScheduledValues.bind(node.frequency)
            node.frequency.cancelScheduledValues = (time) => {
              // A ramp following an earlier note start crosses this boundary;
              // restoration must retain its remaining original endpoints.
              const next = record.points.findIndex((point) => point.time >= time)
              if (next > 0 && record.points[next].kind === 'ramp') record.heldBoundaries.push(time)
              record.points = record.points.filter((point) => point.time < time)
              return cancel(time)
            }
            return node
          }
          const sound = createSoundscape(context, 'city', settings, context.destination, { preset, seed: 4217 })
          const checkpoints = [10, 63].map((time) => context.suspend(time))
          const rendering = context.startRendering()
          for (const checkpoint of checkpoints) {
            await checkpoint
            if (edit) {
              sound.update({ ...settings, density: .99, tension: .99 })
              sound.update(settings)
            }
            await context.resume()
          }
          const buffer = await rendering
          sound.stop()
          return {
            samples: [buffer.getChannelData(0), buffer.getChannelData(1)],
            filters: filters.map(({ node, points, heldBoundaries }) => ({ type: node.type, points, heldBoundaries })),
          }
        } finally {
          Object.defineProperty(AudioParam.prototype, 'cancelAndHoldAtTime', {
            configurable: true, writable: true, value: originalHold,
          })
        }
      }
      const reference = await render(false, false)
      const results = []
      for (const fallback of [false, true]) {
        const restored = await render(true, fallback)
        let residual = 0, energy = 0, peak = 0, invalid = 0
        for (let channel = 0; channel < 2; channel++) {
          for (let index = 0; index < reference.samples[channel].length; index++) {
            const actual = restored.samples[channel][index], expected = reference.samples[channel][index]
            if (!Number.isFinite(actual)) invalid++
            residual += (actual - expected) ** 2
            energy += expected ** 2
            peak = Math.max(peak, Math.abs(actual))
          }
        }
        const scheduledDifferences = reference.filters.flatMap((filter, index) =>
          JSON.stringify(filter.points) === JSON.stringify(restored.filters[index].points) ? [] : [index])
        results.push({
          fallback, invalid, peak, scheduledDifferences,
          rms: Math.sqrt(energy / (reference.samples[0].length * 2)),
          rmsDifference: Math.sqrt(residual / (reference.samples[0].length * 2)),
          normalizedResidual: Math.sqrt(residual / Math.max(energy, 1e-20)),
          heldHighpass: restored.filters.filter((filter) => filter.type === 'highpass' && filter.heldBoundaries.length > 0).length,
          heldLowpass: restored.filters.filter((filter) => filter.type === 'lowpass' && filter.heldBoundaries.length > 0).length,
        })
      }
      return results
    }, preset)
    await test.info().attach('brass-restoration-metrics', {
      body: JSON.stringify(result, null, 2), contentType: 'application/json',
    })
    for (const reading of result) {
      const evidence = JSON.stringify(reading)
      expect(reading.invalid, evidence).toBe(0)
      expect(reading.peak, evidence).toBeLessThan(.95)
      expect(reading.rms, evidence).toBeGreaterThan(.002)
      expect(reading.heldHighpass, evidence).toBeGreaterThan(0)
      expect(reading.heldLowpass, evidence).toBeGreaterThan(0)
      expect(reading.scheduledDifferences, evidence).toEqual([])
      expect(reading.rmsDifference, evidence).toBeLessThan(.00001)
      expect(reading.normalizedResidual, evidence).toBeLessThan(.0001)
    }
  })
}
