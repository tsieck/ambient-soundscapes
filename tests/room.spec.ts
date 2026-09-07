import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/__room-check', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body>Room render</body></html>',
  }))
  await page.goto('/__room-check')
})

test('the room renders stereo reflections and a progressively darker, finite tail across sample rates', async ({ page }) => {
  const readings = await page.evaluate(async () => {
    const moduleUrl = '/src/room.ts'
    const { createRoomImpulse } = await import(moduleUrl) as typeof import('../src/room')
    const readings = []
    for (const rate of [24000, 44100, 48000]) {
      const context = new OfflineAudioContext(4, rate * 6, rate)
      const room = context.createConvolver()
      room.buffer = createRoomImpulse(context)
      const duplicate = createRoomImpulse(context)
      let deterministic = true
      for (let channel = 0; channel < 2; channel++) {
        const first = room.buffer.getChannelData(channel), second = duplicate.getChannelData(channel)
        for (let sample = 0; sample < first.length; sample++) {
          if (first[sample] !== second[sample]) deterministic = false
        }
      }
      const input = context.createBufferSource()
      input.buffer = context.createBuffer(1, 1, rate)
      input.buffer.getChannelData(0)[0] = 1
      input.connect(room); input.start()
      const split = context.createChannelSplitter(2), merge = context.createChannelMerger(4)
      room.connect(split)
      split.connect(merge, 0, 0); split.connect(merge, 1, 1)
      for (const [type, frequency, channel] of [['lowpass', 650, 2], ['highpass', 3800, 3]] as const) {
        const first = context.createBiquadFilter(), second = context.createBiquadFilter()
        first.type = second.type = type
        first.frequency.value = second.frequency.value = frequency
        first.Q.value = second.Q.value = .707
        split.connect(first, 0); first.connect(second).connect(merge, 0, channel)
      }
      merge.connect(context.destination)
      const rendered = await context.startRendering()
      const left = rendered.getChannelData(0), right = rendered.getChannelData(1)
      const energy = (channel: number, from: number, until: number) => {
        const data = rendered.getChannelData(channel)
        let result = 0
        for (let sample = Math.floor(from * rate); sample < Math.floor(until * rate); sample++) result += data[sample] ** 2
        return result
      }
      let invalid = 0, peak = 0, difference = 0, mono = 0
      for (let sample = 0; sample < left.length; sample++) {
        if (!Number.isFinite(left[sample]) || !Number.isFinite(right[sample])) invalid++
        peak = Math.max(peak, Math.abs(left[sample]), Math.abs(right[sample]))
        difference += (left[sample] - right[sample]) ** 2
        mono += ((left[sample] + right[sample]) * .5) ** 2
      }
      const total = energy(0, 0, 6)
      readings.push({ rate, deterministic, invalid, peak,
        earlyFraction: energy(0, .016, .14) / total,
        preArrivalFraction: energy(0, 0, .016) / total,
        lateFraction: energy(0, 3.4, 5.7) / total,
        middleDecay: energy(0, 1.3, 1.9) / energy(0, .3, .9),
        farDecay: energy(0, 2.5, 3.1) / energy(0, 1.3, 1.9),
        lowDecay: energy(2, 1.4, 2) / energy(2, .2, .8),
        highDecay: energy(3, 1.4, 2) / energy(3, .2, .8),
        afterEnd: energy(0, 5.72, 6) / total,
        stereoFraction: difference / total, monoFraction: mono / total,
      })
    }
    return readings
  })
  for (const reading of readings) {
    expect(reading.deterministic).toBe(true)
    expect(reading.invalid).toBe(0)
    expect(reading.peak).toBeGreaterThan(.005)
    expect(reading.peak).toBeLessThan(.5)
    expect(reading.preArrivalFraction).toBeLessThan(1e-10)
    expect(reading.earlyFraction).toBeGreaterThan(.03)
    expect(reading.earlyFraction).toBeLessThan(.4)
    expect(reading.middleDecay).toBeGreaterThan(.001)
    expect(reading.middleDecay).toBeLessThan(.3)
    expect(reading.farDecay).toBeLessThan(.3)
    expect(reading.lateFraction).toBeGreaterThan(1e-6)
    expect(reading.lateFraction).toBeLessThan(.01)
    expect(reading.highDecay).toBeLessThan(reading.lowDecay * .3)
    expect(reading.afterEnd).toBeLessThan(1e-10)
    expect(reading.stereoFraction).toBeGreaterThan(.5)
    expect(reading.monoFraction).toBeGreaterThan(.15)
  }
  const decayRatios = readings.map((reading) => reading.highDecay / reading.lowDecay)
  expect(Math.max(...decayRatios) / Math.min(...decayRatios)).toBeLessThan(2)
})
