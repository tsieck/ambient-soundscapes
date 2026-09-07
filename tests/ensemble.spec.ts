import { expect, test } from '@playwright/test'
import type { SoundSettings } from '../src/audio'

const controls: SoundSettings = {
  warmth: .6, darkness: .4, movement: .6, rain: 0, volume: .7,
  space: 0, density: 1, drift: 0, tension: .35,
  bedLevel: 0, padLevel: 0, detailLevel: 1, textureLevel: 0,
  pulse: 0, tempo: .4, bounce: .35, binaural: 0, beatRate: .4,
}

test.beforeEach(async ({ page }) => {
  await page.route('**/__ensemble-check', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body>Ensemble render harness</body></html>',
  }))
  await page.goto('/__ensemble-check')
})

test('returning voices keep a spatial identity and leave room between opposing gestures', async ({ page }) => {
  const results = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
    const results = []
    for (const seed of [4217, 8127, 7319]) {
      const context = new OfflineAudioContext(2, 8000 * 600, 8000)
      const factory = context.createStereoPanner.bind(context)
      const panners: { destination?: AudioNode; events: { time: number; pan: number }[] }[] = []
      context.createStereoPanner = () => {
        const node = factory()
        const entry: typeof panners[number] = { events: [] }
        panners.push(entry)
        const connect = node.connect.bind(node)
        node.connect = ((destination: AudioNode, ...args: number[]) => {
          entry.destination = destination
          return Reflect.apply(connect, node, [destination, ...args])
        }) as typeof node.connect
        const set = node.pan.setValueAtTime.bind(node.pan)
        node.pan.setValueAtTime = (pan, time) => { entry.events.push({ time, pan }); return set(pan, time) }
        return node
      }
      const sound = createSoundscape(context, 'afternoon', settings, context.destination, { preset: 'tape', seed })
      // Identify the articulated layer by its audible first entrance, then
      // follow actual node connections rather than voice-pool array indices.
      const detailBus = panners.find((voice) => voice.events.some((event) => Math.abs(event.time - 2.2) < .001))?.destination
      if (!detailBus) throw new Error('The first musical gesture was not scheduled')
      const events = panners.filter((voice) => voice.destination === detailBus)
        .flatMap((voice) => voice.events).sort((left, right) => left.time - right.time)
      const first = events.filter((event) => event.time < 20)
      const switched = events.slice(1).flatMap((event, index) =>
        Math.sign(event.pan) === Math.sign(events[index].pan) ? [] : [event.time - events[index].time])
      sound.stop()
      results.push({ seed, count: events.length,
        left: events.filter((event) => event.pan < 0).length,
        right: events.filter((event) => event.pan > 0).length,
        firstFigurePanRange: Math.max(...first.map((event) => event.pan)) - Math.min(...first.map((event) => event.pan)),
        closestOpposingEntrance: Math.min(...switched),
        widestPan: Math.max(...events.map((event) => Math.abs(event.pan))),
      })
    }
    return results
  }, controls)
  await test.info().attach('ensemble-scheduling', { body: JSON.stringify(results, null, 2), contentType: 'application/json' })
  for (const result of results) {
    expect(result.count).toBeGreaterThan(20)
    expect(result.left).toBeGreaterThan(10)
    expect(result.right).toBeGreaterThan(3)
    expect(result.firstFigurePanRange).toBe(0)
    expect(result.closestOpposingEntrance).toBeGreaterThanOrEqual(1.19)
    expect(result.widestPan).toBeLessThan(.5)
  }
})

test('a rendered foreground phrase remains on the same side as its notes change', async ({ page }) => {
  const result = await page.evaluate(async (settings) => {
    const moduleUrl = '/src/audio.ts'
    const { createSoundscape } = await import(moduleUrl) as typeof import('../src/audio')
    const rate = 16000
    const context = new OfflineAudioContext(2, rate * 17, rate)
    const sound = createSoundscape(context, 'afternoon', settings, context.destination, { preset: 'tape', seed: 4217 })
    const rendered = await context.startRendering()
    sound.stop()
    const left = rendered.getChannelData(0), right = rendered.getChannelData(1)
    const windows = []
    for (const second of [3, 6, 9, 12]) {
      let leftEnergy = 0, rightEnergy = 0, monoEnergy = 0
      for (let index = second * rate; index < (second + 1) * rate; index++) {
        leftEnergy += left[index] ** 2; rightEnergy += right[index] ** 2
        monoEnergy += ((left[index] + right[index]) * .5) ** 2
      }
      windows.push({ leftToRight: Math.sqrt(leftEnergy / rightEnergy), monoRms: Math.sqrt(monoEnergy / rate) })
    }
    return windows
  }, controls)
  for (const window of result) {
    expect(window.leftToRight).toBeGreaterThan(1.15)
    expect(window.leftToRight).toBeLessThan(2.5)
    expect(window.monoRms).toBeGreaterThan(.001)
  }
})
