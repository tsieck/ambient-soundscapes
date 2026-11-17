// Each reel has a fixed part, register and place in the room. Cycles continue
// through planning boundaries, so the harmony arises from their intersections.
type Part = 'pad' | 'detail' | 'bed'
interface Reel {
  role: 'figure' | 'answer' | 'alto' | 'tenor' | 'soprano' | 'pedal'
  part: Part
  degrees: number[]
  offsets: number[]
  first: number
  period: number
  duration: number
  level: number
  pan: number
}

const parts: Reel[] = [
  { role: 'figure', part: 'detail', degrees: [16, 14, 11], offsets: [0, 1.85, 5.3], first: .65, period: 29.7, duration: 6.8, level: .14, pan: -.21 },
  { role: 'answer', part: 'detail', degrees: [8, 11], offsets: [0, 4.2], first: 17.6, period: 43.1, duration: 8.2, level: .092, pan: .31 },
  { role: 'tenor', part: 'pad', degrees: [9], offsets: [0], first: 1.8, period: 31.3, duration: 13.8, level: .13, pan: -.38 },
  { role: 'alto', part: 'pad', degrees: [11], offsets: [0], first: 8.7, period: 40.9, duration: 18.1, level: .12, pan: .27 },
  { role: 'soprano', part: 'pad', degrees: [15], offsets: [0], first: 24.6, period: 53.7, duration: 16.4, level: .096, pan: .08 },
  { role: 'pedal', part: 'bed', degrees: [0], offsets: [0], first: 0, period: 57.3, duration: 38, level: .19, pan: 0 },
]

export function createTapeReels(random: () => number) {
  const shift = random() < .5 ? 0 : 4
  return parts.map(part => ({
    ...part,
    // Transpose the whole ensemble together. Small differences in tape speed
    // and phrase spacing give each seed its own slowly changing alignments.
    degrees: part.degrees.map(degree => degree + shift),
    period: part.period * (.94 + random() * .12),
    spacing: .87 + random() * .26,
    first: part.first * (part.role === 'figure' ? 1 : .9 + random() * .2),
  }))
}

export interface TapeCursor {
  origin: number
  note: number
  turn: number
}

export interface TapeNote {
  part: Part
  degree: number
  time: number
  length: number
  level: number
  pan: number
}

export function advanceTapeScore(reels: ReturnType<typeof createTapeReels>, cursors: TapeCursor[],
  until: number, density: number, movement: number, tension: number, emit: (event: TapeNote) => void) {
  const events: TapeNote[] = []
  for (const [index, reel] of reels.entries()) {
    const cursor = cursors[index]
    for (;;) {
      const time = cursor.origin + reel.offsets[cursor.note] * reel.spacing
      if (time >= until) break
      // One answer occasionally drops out. The upper singer rests more often
      // at low density. Their silent revolutions still advance the tape.
      const rest = (reel.role === 'answer' && cursor.turn % 4 === 2 && density < .72)
        || (reel.role === 'soprano' && cursor.turn % 3 !== 1 && density < .45)
      if (!rest) {
        let degree = reel.degrees[cursor.note]
        if (reel.part === 'bed' && cursor.turn % 4 === 2) degree -= 2
        if (reel.role === 'soprano' && cursor.turn % 3 === 1 && tension > .48) degree += 1
        events.push({ part: reel.part, degree, time, pan: reel.pan,
          length: reel.duration * (reel.part === 'pad' ? .68 + density * .86 : 1),
          level: reel.level * (cursor.note === 1 ? .68 : cursor.note === 2 ? .82 : 1) })
      }
      if (++cursor.note === reel.degrees.length) {
        cursor.origin += reel.period * (1.16 - movement * .36)
        cursor.note = 0
        cursor.turn++
      }
    }
  }
  // Distribute overlapping gestures chronologically through the shared pools.
  for (const event of events.sort((a, b) => a.time - b.time)) emit(event)
}
