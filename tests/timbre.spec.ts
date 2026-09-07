import { expect, test } from '@playwright/test'
import type { SoundSettings } from '../src/audio'

const sustained: SoundSettings = {
  warmth: .3, darkness: .15, movement: 0, rain: 0, volume: .55,
  space: 0, density: .5, drift: 0, tension: .35,
  bedLevel: 0, padLevel: 1, detailLevel: 0, textureLevel: 0,
  pulse: 0, tempo: .4, bounce: .35, binaural: 0, beatRate: .4,
}

test.beforeEach(async ({ page }) => {
  await page.route('**/__timbre-check', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body>Sustained color render</body></html>',
  }))
  await page.goto('/__timbre-check')
})

test('Movement changes the color of an already-held pad without a new attack or a blanket gain jump', async ({ page }) => {
  const readings = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
    const rate = 24000
    async function render(preset: 'bloom' | 'aurora', edit: boolean) {
      const context = new OfflineAudioContext(4, rate * 40, rate)
      const input = context.createGain()
      const split = context.createChannelSplitter(2), merge = context.createChannelMerger(4)
      input.connect(split); split.connect(merge, 0, 0); split.connect(merge, 1, 1)
      for (const [type, frequency, channel] of [['lowpass', 600, 2], ['highpass', 900, 3]] as const) {
        const filter = context.createBiquadFilter()
        filter.type = type; filter.frequency.value = frequency; filter.Q.value = .707
        input.connect(filter).connect(merge, 0, channel)
      }
      merge.connect(context.destination)
      const sound = createSoundscape(context, 'afternoon', settings, input, { preset, seed: 4217 })
      // This opening holds well beyond the render. Edits must affect sustained
      // sound, rather than waiting for a later phrase or creating a new attack.
      const pause = context.suspend(12)
      const rendering = context.startRendering()
      await pause
      sound.update(edit ? { ...settings, movement: 1 } : settings)
      await context.resume()
      const result = await rendering
      sound.stop()
      return result
    }
    const readings = []
    for (const preset of ['bloom', 'aurora'] as const) {
      const reference = await render(preset, false), changed = await render(preset, true)
      const original = reference.getChannelData(0), actual = changed.getChannelData(0)
      let beforeDifference = 0, beforeDifferenceEnergy = 0, beforeReferenceEnergy = 0, peak = 0, invalid = 0
      for (let sample = 0; sample < actual.length; sample++) {
        if (!Number.isFinite(actual[sample])) invalid++
        peak = Math.max(peak, Math.abs(actual[sample]))
        if (sample < rate * 12) {
          const difference = actual[sample] - original[sample]
          beforeDifference = Math.max(beforeDifference, Math.abs(difference))
          beforeDifferenceEnergy += difference ** 2
          beforeReferenceEnergy += original[sample] ** 2
        }
      }
      const energy = (buffer: AudioBuffer, channel: number, from: number, until: number) => {
        const samples = buffer.getChannelData(channel)
        let total = 0
        for (let sample = Math.round(from * rate); sample < Math.round(until * rate); sample++) total += samples[sample] ** 2
        return total
      }
      const spectrum = (buffer: AudioBuffer, time: number) => energy(buffer, 3, time, time + 2) / energy(buffer, 2, time, time + 2)
      const times = [20, 24, 28, 32, 36]
      const spectralChanges = times.map((time) => Math.abs(Math.log(spectrum(changed, time) / spectrum(reference, time))))
      const levels = times.map((time) => Math.sqrt(energy(changed, 0, time, time + 2) / (rate * 2)))
      let referenceEnergy = 0, changedEnergy = 0, covariance = 0
      for (let sample = rate * 20; sample < rate * 38; sample++) {
        referenceEnergy += original[sample] ** 2
        changedEnergy += actual[sample] ** 2
        covariance += original[sample] * actual[sample]
      }
      const matchingGain = covariance / referenceEnergy
      const residual = Math.max(0, changedEnergy - covariance * covariance / referenceEnergy)
      readings.push({ preset, beforeDifference, invalid, peak, levels,
        beforeRelativeDifference: Math.sqrt(beforeDifferenceEnergy / Math.max(beforeReferenceEnergy, 1e-20)),
        spectralChange: Math.max(...spectralChanges),
        matchingGain, normalizedResidual: Math.sqrt(residual / changedEnergy),
      })
    }
    return readings
  }, sustained)
  await test.info().attach('sustained-color-metrics', {
    body: JSON.stringify(readings, null, 2), contentType: 'application/json',
  })
  for (const reading of readings) {
    expect(reading.invalid).toBe(0)
    expect(reading.peak).toBeLessThan(.95)
    // Independent native renders can have tiny PCM differences on Linux
    // Chromium. Require both a tiny peak error and a relative RMS error
    // below -80 dB, matching the engine's other continuity comparisons.
    expect(reading.beforeDifference).toBeLessThan(.00001)
    expect(reading.beforeRelativeDifference).toBeLessThan(.0001)
    expect(Math.min(...reading.levels)).toBeGreaterThan(.01)
    expect(Math.max(...reading.levels) / Math.min(...reading.levels)).toBeLessThan(2)
    // Both a band-balance change and a residual after best-fit level matching
    // are required: a plain increase in gain must not satisfy this check.
    expect(reading.spectralChange).toBeGreaterThan(.012)
    expect(reading.normalizedResidual).toBeGreaterThan(.01)
    expect(reading.matchingGain).toBeGreaterThan(.6)
    expect(reading.matchingGain).toBeLessThan(1.4)
  }
})
