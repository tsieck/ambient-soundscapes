import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/__whimsy-check', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body>Whimsical instrument audio harness</body></html>',
  }))
  await page.goto('/__whimsy-check')
})

test('the intimate presets retain stereo headroom across seeds and extreme mixes', async ({ page }) => {
  test.setTimeout(60_000)
  const readings = await page.evaluate(async () => {
    const audioUrl = '/src/audio.ts', presetsUrl = '/src/sound-presets.ts'
    const { createSoundscape } = await import(audioUrl) as typeof import('../src/audio')
    const { SOUND_PRESETS } = await import(presetsUrl) as typeof import('../src/sound-presets')
    const maximum = {
      warmth: 1, darkness: 0, movement: 1, rain: 1, volume: 1,
      space: 1, density: 1, drift: 1, tension: 1,
      bedLevel: 1, padLevel: 1, detailLevel: 1, textureLevel: 1,
      pulse: 1, tempo: 1, bounce: 1, binaural: 1, beatRate: 1,
    }
    const readings = [], rate = 24000
    for (const preset of ['lantern', 'daydream'] as const) {
      const defaults = SOUND_PRESETS.find((entry) => entry.id === preset)!.settings
      for (const seed of [4217, 8127]) {
        for (const [mix, settings] of [
          ['default', defaults], ['maximum-bright', maximum], ['maximum-dark', { ...maximum, darkness: 1 }],
        ] as const) {
          const context = new OfflineAudioContext(2, rate * 14, rate)
          const sound = createSoundscape(context, 'afternoon', settings, context.destination, { preset, seed })
          const buffer = await context.startRendering()
          sound.stop()
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
          readings.push({ preset, seed, mix, peak, invalid,
            rms: Math.sqrt(energy / ((left.length - start) * 2)),
            stereoDifference: Math.sqrt(sideEnergy / (left.length - start)),
          })
        }
      }
    }
    return readings
  })
  await test.info().attach('whimsy-mix-metrics', { body: JSON.stringify(readings, null, 2), contentType: 'application/json' })
  for (const reading of readings) {
    const evidence = JSON.stringify(reading)
    expect(reading.invalid, evidence).toBe(0)
    expect(reading.peak, evidence).toBeGreaterThan(.02)
    expect(reading.peak, evidence).toBeLessThan(.95)
    expect(reading.rms, evidence).toBeGreaterThan(.015)
    expect(reading.rms, evidence).toBeLessThan(.32)
    expect(reading.stereoDifference, evidence).toBeGreaterThan(.005)
  }
})

test('the felt key loses its brighter strike while the rounded body remains audible', async ({ page }) => {
  const readings = await page.evaluate(async () => {
    const audioUrl = '/src/audio.ts', presetsUrl = '/src/sound-presets.ts'
    const { createSoundscape } = await import(audioUrl) as typeof import('../src/audio')
    const { SOUND_PRESETS } = await import(presetsUrl) as typeof import('../src/sound-presets')
    const settings = {
      ...SOUND_PRESETS.find((entry) => entry.id === 'lantern')!.settings,
      volume: .7, warmth: 0, darkness: 0, movement: 0, drift: 0, rain: 0, space: 0,
      bedLevel: 0, padLevel: 0, detailLevel: 1, textureLevel: 0,
    }
    const readings = [], rate = 24000
    for (const seed of [4217, 7319, 8127]) {
      const context = new OfflineAudioContext(2, rate * 4, rate)
      const factory = context.createOscillator.bind(context)
      const entrances: { frequency: number; time: number }[] = []
      context.createOscillator = () => {
        const node = factory()
        const set = node.frequency.setValueAtTime.bind(node.frequency)
        node.frequency.setValueAtTime = (frequency, time) => {
          if (time > 2 && time < 3) entrances.push({ frequency, time })
          return set(frequency, time)
        }
        return node
      }
      const sound = createSoundscape(context, 'afternoon', settings, context.destination, { preset: 'lantern', seed })
      const buffer = await context.startRendering()
      sound.stop()
      const samples = buffer.getChannelData(0)
      const onset = Math.min(...entrances.map((entry) => entry.time))
      const fundamental = Math.min(...entrances.map((entry) => entry.frequency))
      const spectrum = (age: number) => {
        // Resolve the brief attack separately from its decay, using many
        // fundamental periods even for the lowest note in this seed set.
        const start = Math.round((onset + age) * rate), length = Math.round(.15 * rate)
        const powerAt = (frequency: number) => {
          const coefficient = 2 * Math.cos(2 * Math.PI * frequency / rate)
          let previous = 0, previousPrevious = 0
          for (let index = 0; index < length; index++) {
            const window = .5 - .5 * Math.cos(2 * Math.PI * index / (length - 1))
            const current = samples[start + index] * window + coefficient * previous - previousPrevious
            previousPrevious = previous; previous = current
          }
          return previous ** 2 + previousPrevious ** 2 - coefficient * previous * previousPrevious
        }
        let energy = 0
        for (let index = start; index < start + length; index++) energy += samples[index] ** 2
        // Dividing overtone energy by the fundamental removes the note's
        // overall amplitude decay: a fading static tone cannot pass this.
        return { harmonicRatio: [2, 3, 4, 5].reduce((sum, partial) => sum + powerAt(fundamental * partial), 0) / powerAt(fundamental),
          rms: Math.sqrt(energy / length) }
      }
      readings.push({ seed, onset, fundamental, early: spectrum(.04), late: spectrum(1.15) })
    }
    return readings
  })
  await test.info().attach('felt-strike-spectrum', { body: JSON.stringify(readings, null, 2), contentType: 'application/json' })
  for (const reading of readings) {
    const evidence = JSON.stringify(readings)
    expect(reading.fundamental, evidence).toBeGreaterThan(100)
    expect(reading.early.rms, evidence).toBeGreaterThan(.005)
    expect(reading.late.rms, evidence).toBeGreaterThan(.001)
    expect(reading.early.harmonicRatio / reading.late.harmonicRatio, evidence).toBeGreaterThan(1.5)
  }
})

test('lilting figures remain bounded and leave room for replies over ten minutes', async ({ page }) => {
  const readings = await page.evaluate(async () => {
    const audioUrl = '/src/audio.ts', presetsUrl = '/src/sound-presets.ts'
    const { createSoundscape } = await import(audioUrl) as typeof import('../src/audio')
    const { SOUND_PRESETS } = await import(presetsUrl) as typeof import('../src/sound-presets')
    const readings = []
    for (const preset of ['lantern', 'daydream'] as const) {
      for (const seed of [4217, 8127]) {
        const context = new OfflineAudioContext(2, 8000 * 600, 8000)
        const panners: { destination?: AudioNode; events: { time: number; pan: number }[] }[] = []
        const pannerFactory = context.createStereoPanner.bind(context)
        context.createStereoPanner = () => {
          const node = pannerFactory(), entry: typeof panners[number] = { events: [] }
          panners.push(entry)
          const connect = node.connect.bind(node)
          node.connect = ((destination: AudioNode, ...args: number[]) => {
            entry.destination = destination
            return Reflect.apply(connect, node, [destination, ...args])
          }) as typeof node.connect
          const set = node.pan.setValueAtTime.bind(node.pan)
          node.pan.setValueAtTime = (pan, time) => { entry.events.push({ pan, time }); return set(pan, time) }
          return node
        }
        const settings = { ...SOUND_PRESETS.find((entry) => entry.id === preset)!.settings, movement: 1, density: 1 }
        const sound = createSoundscape(context, 'afternoon', settings, context.destination, { preset, seed })
        const detailBus = panners.find((voice) => voice.events.some((event) => Math.abs(event.time - 2.2) < .001))?.destination
        if (!detailBus) throw new Error('The first articulated phrase was not scheduled')
        const events = panners.filter((voice) => voice.destination === detailBus)
          .flatMap((voice) => voice.events).sort((left, right) => left.time - right.time)
        const figures: typeof events[] = []
        for (const event of events) {
          const current = figures.at(-1)
          if (!current || current[0].pan !== event.pan) figures.push([event])
          else current.push(event)
        }
        const complete = figures.filter((figure) => figure.length >= 4)
        const liltRatios = complete.map((figure) => (figure[1].time - figure[0].time) / (figure[2].time - figure[1].time))
        const opposingGaps = events.slice(1).flatMap((event, index) =>
          Math.sign(event.pan) === Math.sign(events[index].pan) ? [] : [event.time - events[index].time])
        const allGaps = events.slice(1).map((event, index) => event.time - events[index].time)
        sound.stop()
        readings.push({ preset, seed, count: events.length, completeFigures: complete.length,
          minimumLilt: Math.min(...liltRatios), maximumLilt: Math.max(...liltRatios),
          closestOpposingEntrance: Math.min(...opposingGaps),
          breathingGaps: allGaps.filter((gap) => gap > 6).length,
          widestPan: Math.max(...events.map((event) => Math.abs(event.pan))),
        })
      }
    }
    return readings
  })
  await test.info().attach('whimsy-phrase-metrics', { body: JSON.stringify(readings, null, 2), contentType: 'application/json' })
  for (const reading of readings) {
    const evidence = JSON.stringify(reading)
    expect(reading.count, evidence).toBeGreaterThan(30)
    expect(reading.count, evidence).toBeLessThan(250)
    expect(reading.completeFigures, evidence).toBeGreaterThan(3)
    expect(reading.minimumLilt, evidence).toBeGreaterThan(1.15)
    expect(reading.maximumLilt, evidence).toBeLessThan(2)
    expect(reading.closestOpposingEntrance, evidence).toBeGreaterThanOrEqual(1.19)
    expect(reading.breathingGaps, evidence).toBeGreaterThan(3)
    expect(reading.widestPan, evidence).toBeLessThan(.5)
  }
})

test('restoring controls preserves ongoing felt strikes and the seeded lilting performance', async ({ page }) => {
  test.setTimeout(60_000)
  const readings = await page.evaluate(async () => {
    const audioUrl = '/src/audio.ts', presetsUrl = '/src/sound-presets.ts'
    const { createSoundscape } = await import(audioUrl) as typeof import('../src/audio')
    const { SOUND_PRESETS } = await import(presetsUrl) as typeof import('../src/sound-presets')
    const settings = { ...SOUND_PRESETS.find((entry) => entry.id === 'lantern')!.settings,
      volume: .7, movement: 1, density: 1, space: 0, rain: 0,
      bedLevel: 0, padLevel: 0, detailLevel: 1, textureLevel: 0 }
    const rate = 12000, originalHold = AudioParam.prototype.cancelAndHoldAtTime
    type Point = { kind: 'set' | 'ramp'; value: number; time: number }
    async function render(edit: boolean, fallback: boolean) {
      if (fallback) Object.defineProperty(AudioParam.prototype, 'cancelAndHoldAtTime', {
        configurable: true, writable: true, value: undefined,
      })
      try {
        const context = new OfflineAudioContext(2, rate * 110, rate)
        const gains: { node: GainNode; points: Point[]; heldPositive: number[] }[] = []
        const oscillators: { destination?: AudioNode; notes: { time: number; frequency: number }[] }[] = []
        const gainFactory = context.createGain.bind(context), oscillatorFactory = context.createOscillator.bind(context)
        context.createGain = () => {
          const node = gainFactory(), entry: typeof gains[number] = { node, points: [], heldPositive: [] }
          gains.push(entry)
          const set = node.gain.setValueAtTime.bind(node.gain), ramp = node.gain.linearRampToValueAtTime.bind(node.gain)
          node.gain.setValueAtTime = (value, time) => { entry.points.push({ kind: 'set', value, time }); return set(value, time) }
          node.gain.linearRampToValueAtTime = (value, time) => { entry.points.push({ kind: 'ramp', value, time }); return ramp(value, time) }
          const cancel = node.gain.cancelScheduledValues.bind(node.gain)
          node.gain.cancelScheduledValues = (time) => {
            const next = entry.points.findIndex((point) => point.time >= time)
            if (next > 0 && entry.points[next].kind === 'ramp' && entry.points[next].value > 0) entry.heldPositive.push(time)
            entry.points = entry.points.filter((point) => point.time < time)
            return cancel(time)
          }
          return node
        }
        context.createOscillator = () => {
          const node = oscillatorFactory(), entry: typeof oscillators[number] = { notes: [] }
          oscillators.push(entry)
          const connect = node.connect.bind(node)
          node.connect = ((destination: AudioNode, ...args: number[]) => {
            entry.destination = destination
            return Reflect.apply(connect, node, [destination, ...args])
          }) as typeof node.connect
          const set = node.frequency.setValueAtTime.bind(node.frequency)
          node.frequency.setValueAtTime = (frequency, time) => { entry.notes.push({ time, frequency }); return set(frequency, time) }
          const cancel = node.frequency.cancelScheduledValues.bind(node.frequency)
          node.frequency.cancelScheduledValues = (time) => {
            entry.notes = entry.notes.filter((point) => point.time < time)
            return cancel(time)
          }
          return node
        }
        const sound = createSoundscape(context, 'afternoon', settings, context.destination, { preset: 'lantern', seed: 4217 })
        // Follow the oscillator-to-gain connections. These are the separately
        // articulated source gains, rather than the note's outer envelope.
        const strikeGains = gains.filter((gain) => gain.points.length > 0 && oscillators.some((voice) => voice.destination === gain.node))
        const pauses = [10, 40, 70].map((time) => context.suspend(time))
        const rendering = context.startRendering()
        for (const pause of pauses) {
          await pause
          if (edit) {
            sound.update({ ...settings, density: .2, tension: .99 })
            sound.update(settings)
          }
          await context.resume()
        }
        const buffer = await rendering
        const result = { samples: [buffer.getChannelData(0), buffer.getChannelData(1)],
          notes: oscillators.map((voice) => voice.notes),
          strikeCurves: strikeGains.map((gain) => gain.points),
          heldStrikes: strikeGains.reduce((sum, gain) => sum + gain.heldPositive.length, 0) }
        sound.stop()
        return result
      } finally {
        Object.defineProperty(AudioParam.prototype, 'cancelAndHoldAtTime', {
          configurable: true, writable: true, value: originalHold,
        })
      }
    }
    const reference = await render(false, false), readings = []
    for (const fallback of [false, true]) {
      const restored = await render(true, fallback)
      let residual = 0, energy = 0, invalid = 0
      for (let channel = 0; channel < 2; channel++) {
        for (let index = 0; index < reference.samples[channel].length; index++) {
          const expected = reference.samples[channel][index], actual = restored.samples[channel][index]
          if (!Number.isFinite(actual)) invalid++
          energy += expected ** 2; residual += (actual - expected) ** 2
        }
      }
      readings.push({ fallback, invalid, heldStrikes: restored.heldStrikes,
        unchangedNotes: JSON.stringify(reference.notes) === JSON.stringify(restored.notes),
        unchangedStrikes: JSON.stringify(reference.strikeCurves) === JSON.stringify(restored.strikeCurves),
        rms: Math.sqrt(energy / (reference.samples[0].length * 2)),
        rmsDifference: Math.sqrt(residual / (reference.samples[0].length * 2)),
        normalizedResidual: Math.sqrt(residual / Math.max(energy, 1e-20)),
      })
    }
    return readings
  })
  await test.info().attach('felt-restoration-metrics', { body: JSON.stringify(readings, null, 2), contentType: 'application/json' })
  for (const reading of readings) {
    const evidence = JSON.stringify(reading)
    expect(reading.invalid, evidence).toBe(0)
    expect(reading.heldStrikes, evidence).toBeGreaterThan(0)
    expect(reading.unchangedNotes, evidence).toBe(true)
    expect(reading.unchangedStrikes, evidence).toBe(true)
    expect(reading.rms, evidence).toBeGreaterThan(.002)
    expect(reading.rmsDifference, evidence).toBeLessThan(.00001)
    expect(reading.normalizedResidual, evidence).toBeLessThan(.0001)
  }
})
