import type { SoundSettings } from './audio'

export const RHYTHM_DEFAULTS = { pulse: 0, tempo: .4, bounce: .35, binaural: 0, beatRate: .4 }
export const tempoToBpm = (value: number) => 48 + value * 60
export const beatRateToHz = (value: number) => 2 + value * 10

interface Point { time: number; value: number }
interface Hit { start: number; end: number; points: Point[] }
interface PulseVoice {
  oscillator: OscillatorNode
  envelope: GainNode
  pan: StereoPannerNode
  available: number
  events: Hit[]
}

// Counter-based randomness: editing or muting the groove cannot consume any of
// the ambient score's random sequence. Each four-bar cell has its own memory.
function randomAt(seed: number, index: number) {
  let n = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0
  n = Math.imul(n ^ (n >>> 16), 0x21f0aaad)
  n = Math.imul(n ^ (n >>> 15), 0x735a2d97)
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296
}

/**
 * A quiet metrical anchor with swung replies, and a separate dichotic sine
 * pair. Neither changes the floating score. Both enter before master gain and
 * protection; the sine pair bypasses all spatial effects and pitch modulation.
 */
export function createRhythm(
  context: BaseAudioContext,
  initial: SoundSettings,
  pulseDestination: AudioNode,
  binauralDestination: AudioNode,
  seed: number,
  root: number,
) {
  const nodes: AudioNode[] = []
  const sources: OscillatorNode[] = []
  const keep = <T extends AudioNode>(node: T): T => { nodes.push(node); return node }
  const gain = (level: number) => {
    const node = keep(context.createGain()); node.gain.value = level; return node
  }
  const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
  const pulseMix = gain(0)
  const tone = keep(context.createBiquadFilter())
  tone.type = 'lowpass'; tone.frequency.value = 1700; tone.Q.value = .45
  pulseMix.connect(tone).connect(pulseDestination)
  const wave = context.createPeriodicWave(new Float32Array(4), new Float32Array([0, 1, .16, .035]))
  function voice(): PulseVoice {
    const oscillator = keep(context.createOscillator())
    oscillator.setPeriodicWave(wave)
    const envelope = gain(0)
    const pan = keep(context.createStereoPanner())
    oscillator.connect(envelope).connect(pan).connect(pulseMix)
    oscillator.start(); sources.push(oscillator)
    return { oscillator, envelope, pan, available: context.currentTime, events: [] }
  }
  // Six persistent voices accommodate releases and offbeats at maximum pace.
  const anchors = Array.from({ length: 3 }, voice)
  const replies = Array.from({ length: 3 }, voice)
  const voices = [...anchors, ...replies]

  const headphoneMix = gain(0)
  const merger = keep(context.createChannelMerger(2))
  merger.connect(headphoneMix).connect(binauralDestination)
  const carrier = frequency(root + 24)
  const ears = [0, 1].map((side) => {
    const oscillator = keep(context.createOscillator())
    oscillator.type = 'sine'
    oscillator.frequency.value = carrier + (side ? 1 : -1) * beatRateToHz(initial.beatRate) / 2
    oscillator.connect(merger, 0, side)
    oscillator.start(); sources.push(oscillator)
    return oscillator
  })

  let settings = initial
  let nextTime = context.currentTime + .08
  let nextBeat = 0
  let checkpoints: { time: number; beat: number }[] = []
  let stopped = false
  const offline = typeof (context as OfflineAudioContext).startRendering === 'function'
  const horizon = () => offline
    ? (context as OfflineAudioContext).length / context.sampleRate + 1
    : context.currentTime + 30 * 60

  function putHit(pool: PulseVoice[], time: number, length: number, midi: number, level: number, pan: number) {
    const slot = pool.find((v) => v.available <= time)
    if (!slot) return
    const points = [
      { time, value: 0 }, { time: time + .012, value: level },
      { time: time + length * .18, value: level * .5 },
      { time: time + length * .5, value: level * .13 },
      { time: time + length, value: 0 },
    ]
    slot.oscillator.frequency.setValueAtTime(frequency(midi), time)
    slot.pan.pan.setValueAtTime(pan, time)
    slot.envelope.gain.setValueAtTime(0, time)
    for (const point of points.slice(1)) slot.envelope.gain.linearRampToValueAtTime(point.value, point.time)
    slot.available = time + length + .008
    slot.events.push({ start: time, end: time + length, points })
  }

  function schedule() {
    if (stopped || settings.pulse === 0) return
    const beatLength = 60 / tempoToBpm(settings.tempo)
    const target = horizon()
    while (nextTime < target) {
      checkpoints.push({ time: nextTime, beat: nextBeat })
      const step = nextBeat % 8
      const cell = Math.floor(nextBeat / 16)
      const character = randomAt(seed, cell)
      const accent = step % 4 === 0 ? 1 : step % 2 === 0 ? .72 : .48
      // A dependable tonic/fifth anchor supplies meter. The softer notes lift
      // around it; timing jitter would only blur that relationship.
      putHit(anchors, nextTime, beatLength * .82,
        root + (step === 6 && character > .5 ? 7 : 12),
        .23 * accent * (.94 + randomAt(seed + 13, nextBeat) * .12), 0)
      const replyPattern = character > .5 ? [1, 4, 6] : [0, 3, 6]
      if (settings.bounce > 0 && replyPattern.includes(step)) {
        const swing = .5 + settings.bounce * .16
        const midi = root + (step === 3 || step === 4 ? 24 : 19)
        putHit(replies, nextTime + beatLength * swing, beatLength * .55,
          midi, .12 * settings.bounce * (step === 6 ? .7 : 1), step % 2 ? -.24 : .24)
      }
      nextTime += beatLength
      nextBeat++
    }
    const past = context.currentTime - 1
    checkpoints = checkpoints.filter((point) => point.time >= past)
    for (const v of voices) v.events = v.events.filter((event) => event.end >= past)
  }

  function replan() {
    // Keep the imminent beat and every active release. Edits enter at the next
    // beat, independent of the much slower ambient phrase boundary.
    const checkpoint = checkpoints.find((point) => point.time > context.currentTime + .06)
    const boundary = checkpoint?.time ?? context.currentTime + .08
    if (checkpoint) nextBeat = checkpoint.beat
    nextTime = boundary
    for (const v of voices) {
      const active = v.events.find((event) => event.start < boundary && event.end > boundary)
      v.envelope.gain.cancelScheduledValues(boundary)
      // Reinstall the original future endpoint of the active linear segment,
      // preserving its slope even without cancelAndHoldAtTime support.
      if (active) {
        for (const point of active.points) if (point.time >= boundary) v.envelope.gain.linearRampToValueAtTime(point.value, point.time)
      } else v.envelope.gain.setValueAtTime(0, boundary)
      v.oscillator.frequency.cancelScheduledValues(boundary)
      v.pan.pan.cancelScheduledValues(boundary)
      v.events = v.events.filter((event) => event.start < boundary)
      v.available = active ? active.end + .008 : boundary
    }
    checkpoints = checkpoints.filter((point) => point.time < boundary)
    schedule()
  }

  // Store analytic ramps as well as targets, so rapid drags remain continuous
  // on browsers without cancelAndHoldAtTime, including OfflineAudioContext.
  const ramps = new Map<AudioParam, { from: number; to: number; start: number; end: number }>()
  function smooth(param: AudioParam, target: number, seconds: number) {
    const prior = ramps.get(param)
    if (prior?.to === target) return
    const now = context.currentTime
    const fraction = prior ? Math.max(0, Math.min(1, (now - prior.start) / (prior.end - prior.start))) : 1
    const from = prior ? prior.from + (prior.to - prior.from) * fraction : param.value
    param.cancelScheduledValues(now)
    param.setValueAtTime(from, now)
    param.linearRampToValueAtTime(target, now + seconds)
    ramps.set(param, { from, to: target, start: now, end: now + seconds })
  }

  function update(next: SoundSettings) {
    if (stopped) return
    const old = settings
    settings = next
    smooth(pulseMix.gain, next.pulse ** 1.25 * .85, .6)
    smooth(headphoneMix.gain, next.binaural ** 1.4 * .055, 1.5)
    const difference = beatRateToHz(next.beatRate)
    ears.forEach((ear, side) => smooth(ear.frequency, carrier + (side ? 1 : -1) * difference / 2, .6))
    if (next.tempo !== old.tempo || next.bounce !== old.bounce || (next.pulse === 0) !== (old.pulse === 0)) replan()
  }

  update(initial)
  schedule()
  const interval = offline ? undefined : setInterval(schedule, 20_000)
  return {
    update,
    stop() {
      if (stopped) return
      stopped = true
      if (interval !== undefined) clearInterval(interval)
      for (const source of sources) source.stop()
      for (const node of nodes) node.disconnect()
      for (const v of voices) v.events.length = 0
      checkpoints.length = 0; sources.length = 0; nodes.length = 0; ramps.clear()
    },
  }
}
