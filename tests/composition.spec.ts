import { expect, test } from '@playwright/test'
import type { SoundSettings } from '../src/audio'

const defaults: SoundSettings = {
  warmth: .6, darkness: .5, movement: .35, rain: 0, volume: .7,
  space: .65, density: .65, drift: .35, tension: .35,
  bedLevel: .55, padLevel: .75, detailLevel: .5, textureLevel: .3,
  pulse: 0, tempo: .4, bounce: .35, binaural: 0, beatRate: .4,
}

test.beforeEach(async ({ page }) => {
  await page.route('**/__composition-check', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body>Composition render harness</body></html>',
  }))
  await page.goto('/__composition-check')
})

test('returning musical controls before the next phrase restores the ongoing seeded performance', async ({ page }) => {
  test.setTimeout(60_000)
  const result = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
    const rate = 12000
    const originalHold = AudioParam.prototype.cancelAndHoldAtTime
    async function render(edit: boolean, fallback: boolean) {
      if (fallback) Object.defineProperty(AudioParam.prototype, 'cancelAndHoldAtTime', {
        configurable: true, writable: true, value: undefined,
      })
      try {
        const context = new OfflineAudioContext(2, rate * 180, rate)
        const oscillatorSchedules: { frequency: number; time: number }[][] = []
        const boundaries: number[] = []
        const createOscillator = context.createOscillator.bind(context)
        context.createOscillator = () => {
          const oscillator = createOscillator()
          let scheduled: { frequency: number; time: number }[] = []
          oscillatorSchedules.push(scheduled)
          const scheduleIndex = oscillatorSchedules.length - 1
          const set = oscillator.frequency.setValueAtTime.bind(oscillator.frequency)
          oscillator.frequency.setValueAtTime = (frequency, time) => {
            scheduled.push({ frequency, time }); return set(frequency, time)
          }
          const cancel = oscillator.frequency.cancelScheduledValues.bind(oscillator.frequency)
          oscillator.frequency.cancelScheduledValues = (time) => {
            if (!boundaries.includes(time)) boundaries.push(time)
            scheduled = scheduled.filter((event) => event.time < time)
            oscillatorSchedules[scheduleIndex] = scheduled
            return cancel(time)
          }
          return oscillator
        }
        const sound = createSoundscape(context, 'city', settings, context.destination, { preset: 'tape', seed: 4217 })
        // Restore controls at the same render quantum before new music can
        // enter. Repeating this across the piece exercises live strand cursors,
        // chapter transitions and pad notes held across checkpoint boundaries.
        const checkpoints = [10, 63, 117].map((time) => context.suspend(time))
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
        return { samples: buffer.getChannelData(0), oscillatorSchedules, boundaries }
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
      let difference = 0, peak = 0, invalid = 0, firstDifference = -1
      for (let index = 0; index < reference.samples.length; index++) {
        if (!Number.isFinite(restored.samples[index])) invalid++
        difference += (reference.samples[index] - restored.samples[index]) ** 2
        if (firstDifference < 0 && Math.abs(reference.samples[index] - restored.samples[index]) > .00001) firstDifference = index / rate
        peak = Math.max(peak, Math.abs(restored.samples[index]))
      }
      const scoreDifference = reference.oscillatorSchedules.map((events, voice) => {
        const actual = restored.oscillatorSchedules[voice]
        const index = events.findIndex((event, index) => event.frequency !== actual[index]?.frequency || event.time !== actual[index]?.time)
        return index < 0 ? null : { voice, index, expected: events[index], actual: actual[index] }
      }).filter((event) => event !== null)
      results.push({ fallback, rmsDifference: Math.sqrt(difference / reference.samples.length), peak, invalid, firstDifference, scoreDifference, boundaries: restored.boundaries })
    }
    return results
  }, defaults)
  await test.info().attach('composition-checkpoint-metrics', {
    body: JSON.stringify(result, null, 2), contentType: 'application/json',
  })
  for (const reading of result) {
    expect(reading.invalid).toBe(0)
    expect(reading.peak).toBeLessThan(.95)
    expect(reading.rmsDifference, JSON.stringify(result)).toBeLessThan(.00001)
  }
})

test('fast four-note harmony remains audible with overlapping pads and a fixed voice pool', async ({ page }) => {
  const result = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
    const readings = []
    const rate = 12000
    for (const seed of [4217, 7319, 8127]) {
      const context = new OfflineAudioContext(2, rate * 70, rate)
      const factory = context.createOscillator.bind(context)
      let created = 0
      context.createOscillator = () => { created++; return factory() }
      const sound = createSoundscape(context, 'city', {
        ...settings, movement: 1, density: 1, tension: .9, space: 0,
        bedLevel: 0, padLevel: 1, detailLevel: 0, textureLevel: 0,
      }, context.destination, { preset: 'velvet', seed })
      const initialSources = created
      const buffer = await context.startRendering()
      const samples = buffer.getChannelData(0)
      const windows = []
      for (let second = 12; second <= 60; second += 4) {
        let energy = 0
        for (let index = second * rate; index < (second + 4) * rate; index++) energy += samples[index] ** 2
        windows.push(Math.sqrt(energy / (rate * 4)))
      }
      sound.stop()
      readings.push({ seed, initialSources, finalSources: created, quietest: Math.min(...windows) })
    }
    return readings
  }, defaults)
  await test.info().attach('overlapping-pad-metrics', {
    body: JSON.stringify(result, null, 2), contentType: 'application/json',
  })
  for (const reading of result) {
    expect(reading.finalSources).toBe(reading.initialSources)
    expect(reading.quietest, JSON.stringify(reading)).toBeGreaterThan(.002)
  }
})
