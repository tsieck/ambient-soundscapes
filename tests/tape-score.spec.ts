import { expect, test } from '@playwright/test'
import { advanceTapeScore, createTapeReels, type TapeNote } from '../src/tape-score'

test('independent reels keep their phase and half-played figures across score checkpoints', () => {
  const reels = createTapeReels(() => .5)
  const initial = reels.map(reel => ({ origin: reel.first, note: 0, turn: 0 }))
  function schedule(boundaries: number[]) {
    const events: TapeNote[] = []
    let cursors = structuredClone(initial)
    for (const end of boundaries) {
      advanceTapeScore(reels, cursors, end, .56, .33, .35, note => events.push(note))
      cursors = structuredClone(cursors)
    }
    return events
  }
  const uninterrupted = schedule([1800])
  expect(schedule([2, 5, 54, 75, 172, 381, 864, 1800])).toEqual(uninterrupted)
  const figure = uninterrupted.filter(n => n.pan === reels[0].pan)
  expect(figure.slice(3, 6).map(n => n.degree)).toEqual(figure.slice(0, 3).map(n => n.degree))
  const choir = uninterrupted.filter(n => n.part === 'pad')
  const soundingAt = (time: number) => choir.filter(n => n.time <= time && n.time + n.length > time).length
  const overlaps = figure.filter((_, i) => i % 3 === 0).map(n => soundingAt(n.time))
  expect(new Set(overlaps).size).toBeGreaterThanOrEqual(3)
  expect(overlaps).toContain(0)
})
