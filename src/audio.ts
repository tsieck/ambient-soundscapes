import type { SoundIdentity, SoundPresetId } from './sound-presets'
export type { SoundIdentity, SoundPresetId } from './sound-presets'

export type AtmosphereId = 'city' | 'afternoon'

export interface SoundSettings {
  warmth: number
  darkness: number
  movement: number
  rain: number
  volume: number
  space: number
  density: number
  drift: number
  tension: number
}

export interface Soundscape {
  update(settings: SoundSettings): void
  setAtmosphere(id: AtmosphereId): void
  stop(): void
}

const TAU = Math.PI * 2
const CROSSFADE = 2.8
const DEFAULTS: SoundSettings = {
  warmth: 0.6,
  darkness: 0.5,
  movement: 0.35,
  rain: 0.4,
  volume: 0.6,
  space: 0.65,
  density: 0.5,
  drift: 0.35,
  tension: 0.35,
}

function sanitize(settings: SoundSettings): SoundSettings {
  return Object.fromEntries(
    Object.entries(DEFAULTS).map(([key, fallback]) => {
      const value = settings[key as keyof SoundSettings]
      return [key, Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback]
    }),
  ) as unknown as SoundSettings
}

/** Hold an in-progress fade when another interaction arrives. */
function ramp(param: AudioParam, target: number, now: number, duration = 1.2) {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(now)
  } else {
    const current = param.value
    param.cancelScheduledValues(now)
    param.setValueAtTime(current, now)
  }
  param.linearRampToValueAtTime(target, now + duration)
}

function seededRandom(seed: number) {
  const random = () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
  random.getState = () => seed
  return random
}

interface SceneBuffers {
  impulse: AudioBuffer
  rain: AudioBuffer
  patter: AudioBuffer
}

// Reuse the large immutable buffers when changing scenes. Weak keys allow a
// closed context and its buffers to be collected after dispose().
const buffers = new WeakMap<BaseAudioContext, SceneBuffers>()

function getBuffers(context: BaseAudioContext): SceneBuffers {
  const cached = buffers.get(context)
  if (cached) return cached
  const sampleRate = context.sampleRate
  const impulse = context.createBuffer(2, Math.ceil(sampleRate * 5.7), sampleRate)
  const rain = context.createBuffer(2, Math.ceil(sampleRate * 17.391), sampleRate)
  const patter = context.createBuffer(2, Math.ceil(sampleRate * 23.717), sampleRate)

  for (let channel = 0; channel < 2; channel++) {
    const random = seededRandom(48371 + channel * 9719)
    const response = impulse.getChannelData(channel)
    let diffuse = 0
    for (let i = 0; i < response.length; i++) {
      const time = i / sampleRate
      diffuse = diffuse * 0.68 + (random() * 2 - 1) * 0.32
      const onset = Math.min(1, Math.max(0, (time - 0.025) / 0.09))
      response[i] = diffuse * onset * Math.exp(-time / 1.05)
    }

    const wash = rain.getChannelData(channel)
    let brown = 0
    for (let i = 0; i < wash.length; i++) {
      const white = random() * 2 - 1
      brown = 0.975 * brown + 0.025 * white
      wash[i] = white * 0.36 + brown * 1.8
    }

    // Dense, very quiet resonant droplets sit behind the continuous rain bed.
    // There is no rhythmic event scheduler and no exposed loop boundary.
    const drops = patter.getChannelData(channel)
    const count = Math.round((drops.length / sampleRate) * 36)
    for (let drop = 0; drop < count; drop++) {
      const position = Math.floor(random() * drops.length)
      const frequency = 850 + random() * 1750
      const seconds = 0.014 + random() * 0.029
      const length = Math.ceil(seconds * 7 * sampleRate)
      const amplitude = 0.025 + random() * 0.075
      const angle = TAU * frequency / sampleRate
      const coefficient = 2 * Math.cos(angle)
      const decay = Math.exp(-1 / (seconds * sampleRate))
      let current = 0
      let previous = -Math.sin(angle)
      let envelope = amplitude
      for (let i = 0; i < length; i++) {
        const attack = Math.min(1, i / (sampleRate * 0.002))
        drops[(position + i) % drops.length] +=
          current * envelope * attack
        const next = coefficient * current - previous
        previous = current
        current = next
        envelope *= decay
      }
    }
  }
  const result = { impulse, rain, patter }
  buffers.set(context, result)
  return result
}

interface Palette {
  partials: number[]
  modes: number[][]
  attack: number
  noteAttack: number
  noteLength: number
  air: number
  brightness: number
  wow: number
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const LYDIAN = [0, 2, 4, 6, 7, 9, 11]
const DORIAN = [0, 2, 3, 5, 7, 9, 10]
const MINOR = [0, 2, 3, 5, 7, 8, 10]
const PALETTES: Record<SoundPresetId, Palette> = {
  velvet: { partials: [1,.18,.08,.035,.014], modes: [MAJOR,DORIAN], attack: 5, noteAttack: 1.8, noteLength: 10, air: .006, brightness: .9, wow: .5 },
  tape: { partials: [1,.32,.12,.045,.024,.01], modes: [MAJOR,LYDIAN], attack: 3.4, noteAttack: .07, noteLength: 7, air: .019, brightness: 1, wow: 1.7 },
  glass: { partials: [1,.015,.11,0,.018,0,.008], modes: [LYDIAN,MAJOR], attack: 7, noteAttack: .035, noteLength: 11, air: .004, brightness: 1.4, wow: .22 },
  orbit: { partials: [1,.055,.22,.025,.045], modes: [MINOR,DORIAN], attack: 8, noteAttack: 2.5, noteLength: 16, air: .018, brightness: .7, wow: .7 },
  bloom: { partials: [1,.23,.17,.11,.055,.025,.013], modes: [MAJOR,LYDIAN], attack: 7.5, noteAttack: 3.5, noteLength: 13, air: .013, brightness: 1.1, wow: .6 },
  horizon: { partials: [1,.055,.06,.025,.008], modes: [LYDIAN,MAJOR], attack: 9, noteAttack: 2.2, noteLength: 14, air: .025, brightness: 1.25, wow: .5 },
  ember: { partials: [1,.46,.2,.095,.04,.018], modes: [DORIAN,MINOR], attack: 5.7, noteAttack: 1.7, noteLength: 11, air: .005, brightness: .65, wow: .35 },
  tide: { partials: [1,.14,.07,.027,.012], modes: [DORIAN,MAJOR], attack: 9.5, noteAttack: 4.4, noteLength: 17, air: .037, brightness: .85, wow: .85 },
  mist: { partials: [1,.035,.018,.005], modes: [MAJOR,DORIAN], attack: 10, noteAttack: 4.8, noteLength: 17, air: .075, brightness: .75, wow: .45 },
  aurora: { partials: [1,.09,.19,.038,.072,.012], modes: [LYDIAN,DORIAN], attack: 7.8, noteAttack: .9, noteLength: 13, air: .026, brightness: 1.25, wow: .9 },
}

function normalizeIdentity(id: AtmosphereId, identity?: SoundIdentity): SoundIdentity {
  if (!identity) return { preset: id === 'city' ? 'orbit' : 'tape', seed: id === 'city' ? 7319 : 4217 }
  return {
    preset: Object.hasOwn(PALETTES, identity.preset) ? identity.preset : 'velvet',
    seed: Number.isFinite(identity.seed) ? identity.seed >>> 0 : 0,
  }
}

interface EnvelopePoint { time: number; value: number }
interface NoteEvent { start: number; end: number; points: EnvelopePoint[] }
interface Voice {
  oscillators: OscillatorNode[]
  envelope: GainNode
  pan: StereoPannerNode
  events: NoteEvent[]
  available: number
}

const LOOKAHEAD_SECONDS = 30 * 60

/**
 * Fixed oscillator pools play seeded modal harmony and sparse articulated notes.
 * Thirty minutes of AudioParam events are scheduled ahead; a 20-second refill
 * tolerates minute-throttled background timers. Offline contexts schedule their
 * entire render, making both harmonic evolution and seed identity testable.
 */
export function createSoundscape(
  context: BaseAudioContext,
  id: AtmosphereId,
  settings: SoundSettings,
  destination: AudioNode,
  requestedIdentity?: SoundIdentity,
): Soundscape {
  const identity = normalizeIdentity(id, requestedIdentity)
  let environment = id
  const palette = PALETTES[identity.preset]
  const presetIndex = Object.keys(PALETTES).indexOf(identity.preset)
  const musicalSeed = identity.seed ^ Math.imul(presetIndex + 1, 0x45d9f3b)
  const characterRandom = seededRandom(musicalSeed)
  const scale = palette.modes[Math.floor(characterRandom() * palette.modes.length)]
  const root = 36 + Math.floor(characterRandom() * 12)
  const voicingRotation = Math.floor(characterRandom() * 3)
  let random = seededRandom(musicalSeed ^ 0x193f2ab7)
  const scene = getBuffers(context)
  const startedAt = context.currentTime
  const nodes: AudioNode[] = []
  const sources: AudioScheduledSourceNode[] = []
  let value = sanitize(settings)
  let stopped = false
  let refill: ReturnType<typeof setInterval> | undefined
  let scoreTime = startedAt
  let degree = 0
  let phrase = 0
  let chordHistory: { time: number; degree: number; beforeDegree: number; phrase: number; randomState: number }[] = []

  const keep = <T extends AudioNode>(node: T): T => { nodes.push(node); return node }
  const gain = (level: number) => {
    const node = keep(context.createGain())
    node.gain.value = level
    return node
  }
  const filter = (type: BiquadFilterType, frequency: number, q = .45) => {
    const node = keep(context.createBiquadFilter())
    node.type = type; node.frequency.value = frequency; node.Q.value = q
    return node
  }
  const start = <T extends AudioScheduledSourceNode>(source: T): T => {
    sources.push(source); source.start(startedAt); return source
  }
  const lfo = (frequency: number, phase: number) => {
    const node = keep(context.createOscillator())
    node.setPeriodicWave(context.createPeriodicWave(
      new Float32Array([0, Math.sin(phase)]), new Float32Array([0, Math.cos(phase)]),
    ))
    node.frequency.value = frequency
    start(node)
    return node
  }

  const music = gain(1)
  const lowpass = filter('lowpass', 2200)
  const body = filter('lowshelf', 280)
  const dry = gain(.8)
  const reverb = keep(context.createConvolver())
  reverb.buffer = scene.impulse
  const wet = gain(.4)
  const wetHighpass = filter('highpass', 190)
  const wetLowpass = filter('lowpass', 2800)
  const delay = keep(context.createDelay(2))
  delay.delayTime.value = .61 + characterRandom() * .46
  const echoFilter = filter('lowpass', 1700)
  const feedback = gain(.2)
  const echo = gain(.1)
  const mix = gain(1)
  const subsonic = filter('highpass', 32)
  const safety = keep(context.createDynamicsCompressor())
  safety.threshold.value = -14; safety.knee.value = 10; safety.ratio.value = 4
  safety.attack.value = .012; safety.release.value = .75
  const output = gain(0)
  music.connect(lowpass).connect(body)
  body.connect(dry).connect(mix)
  body.connect(reverb).connect(wetHighpass).connect(wetLowpass).connect(wet).connect(mix)
  body.connect(delay).connect(echoFilter).connect(echo).connect(mix)
  echoFilter.connect(feedback).connect(delay)
  mix.connect(subsonic).connect(safety).connect(output).connect(destination)

  const filterMovement = gain(150)
  lfo(.00713, characterRandom() * TAU).connect(filterMovement).connect(lowpass.detune)
  const slowDrift = gain(3)
  const tapeWow = gain(1)
  const panMovement = gain(.035)
  lfo(.01837, characterRandom() * TAU).connect(slowDrift)
  lfo(.3271, characterRandom() * TAU).connect(tapeWow)
  lfo(.01079, characterRandom() * TAU).connect(panMovement)

  const harmonics = new Float32Array([0, ...palette.partials.map((partial) => partial * (.85 + characterRandom() * .3))])
  const padWave = context.createPeriodicWave(new Float32Array(harmonics.length), harmonics)
  const noteHarmonics = new Float32Array(harmonics.map((partial, index) => partial * (index > 1 ? .7 : 1)))
  const noteWave = context.createPeriodicWave(new Float32Array(noteHarmonics.length), noteHarmonics)

  function makeVoice(isNote: boolean): Voice {
    const envelope = gain(0)
    const pan = keep(context.createStereoPanner())
    envelope.connect(pan).connect(music)
    panMovement.connect(pan.pan)
    const oscillators: OscillatorNode[] = []
    for (let layer = 0; layer < 2; layer++) {
      const oscillator = keep(context.createOscillator())
      oscillator.setPeriodicWave(isNote ? noteWave : padWave)
      oscillator.frequency.value = 220
      oscillator.detune.value = (layer === 0 ? -1 : 1) * (.7 + characterRandom() * 2)
      const layerGain = gain(layer === 0 ? .68 : .32)
      oscillator.connect(layerGain).connect(envelope)
      slowDrift.connect(oscillator.detune)
      tapeWow.connect(oscillator.detune)
      oscillators.push(start(oscillator))
    }
    return { oscillators, envelope, pan, events: [], available: startedAt }
  }
  // Twelve long-voice slots allow two complete six-note harmonies to overlap.
  // Five articulated voices are reused, so events never create more nodes.
  const pads = Array.from({ length: 12 }, () => makeVoice(false))
  const notes = Array.from({ length: 5 }, () => makeVoice(true))
  const voices = [...pads, ...notes]

  const air = gain(palette.air)
  const airSource = keep(context.createBufferSource())
  airSource.buffer = scene.rain; airSource.loop = true
  const airFilter = filter('bandpass', 1750, .6)
  airSource.connect(airFilter).connect(air).connect(reverb)
  start(airSource)

  const rainLevel = gain(0)
  const rainSwell = gain(.9)
  const rainHighpass = filter('highpass', 360)
  const rainLowpass = filter('lowpass', 5400)
  rainHighpass.connect(rainLowpass).connect(rainSwell).connect(rainLevel).connect(mix)
  const rainMovement = gain(.1)
  lfo(.04193, .3).connect(rainMovement).connect(rainSwell.gain)
  const rainSource = keep(context.createBufferSource())
  rainSource.buffer = scene.rain; rainSource.loop = true
  rainSource.connect(rainHighpass); start(rainSource)
  const patterSource = keep(context.createBufferSource())
  patterSource.buffer = scene.patter; patterSource.loop = true
  const patter = gain(.65)
  patterSource.connect(patter).connect(rainHighpass); start(patterSource)

  const scaleNote = (step: number) => root + scale[((step % 7) + 7) % 7] + Math.floor(step / 7) * 12
  const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

  function putNote(pool: Voice[], midi: number, time: number, length: number, amplitude: number, keyed: boolean) {
    const voice = pool.find((candidate) => candidate.available <= time + .001)
    if (!voice) return
    const attack = keyed
      ? Math.min(length * .3, palette.noteAttack * (.85 + random() * .3))
      : Math.min(length * .27, (phrase === 0 ? 2.4 : palette.attack) * (.85 + random() * .3))
    const end = time + length
    const points: EnvelopePoint[] = keyed ? [
      { time, value: 0 },
      { time: time + attack, value: amplitude },
      { time: time + Math.max(attack + .2, length * .35), value: amplitude * .34 },
      { time: end, value: 0 },
    ] : [
      { time, value: 0 },
      { time: time + attack, value: amplitude },
      { time: time + length * .65, value: amplitude * .82 },
      { time: end, value: 0 },
    ]
    for (const oscillator of voice.oscillators) oscillator.frequency.setValueAtTime(frequency(midi), time)
    voice.pan.pan.setValueAtTime((random() * 2 - 1) * (keyed ? .65 : .46), time)
    voice.envelope.gain.setValueAtTime(0, time)
    for (const point of points.slice(1)) voice.envelope.gain.linearRampToValueAtTime(point.value, point.time)
    voice.events.push({ start: time, end, points })
    voice.available = end + .03
  }

  const progressions = [[5,3,4,1], [4,3,0,5], [5,3,0], [0,4,1,5], [0,5,3], [3,0,4,1], [0,3,5]]
  function scheduleTo(target: number) {
    while (scoreTime < target) {
      const checkpoint = { time: scoreTime, beforeDegree: degree, phrase, randomState: random.getState() }
      const duration = (24 + (1 - value.movement) * 49) * (.84 + random() * .3)
      if (phrase > 0) {
        const options = progressions[degree]
        degree = options[Math.floor(random() * options.length)]
      }
      chordHistory.push({ ...checkpoint, degree })
      const count = 3 + Math.round(value.density * 3)
      // Extensions stay in the chosen mode; sparse textures retain their third.
      const steps = [degree, degree + 9, degree + 11, degree + 7,
        degree + (value.tension > .27 ? 13 : 14),
        degree + (value.tension > .6 ? 15 : 18)]
      const chord = steps.slice(0, count).map(scaleNote)
      if (voicingRotation === 1 && chord.length > 3) chord[3] += 12
      if (voicingRotation === 2 && chord.length > 4) chord[4] -= 12
      chord.forEach((midi, index) => {
        const time = scoreTime + (index === 0 ? 0 : random() * .75)
        const amplitude = (index === 0 ? .135 : .081 - index * .006) * (.85 + random() * .23)
        putNote(pads, midi, time, duration + Math.min(11, duration * .28), amplitude, false)
      })
      if (value.density > .045) {
        let noteTime = scoreTime + 2 + random() * 5
        const spacing = 4.8 + (1 - value.density) * 17 + (1 - value.movement) * 5
        let lastStep = degree + 14
        while (noteTime < scoreTime + duration - 1) {
          const chordSteps = [degree + 14, degree + 16, degree + 18, degree + 21]
          if (value.tension > .35) chordSteps.push(degree + 22)
          let step = chordSteps[Math.floor(random() * chordSteps.length)]
          if (step === lastStep) step = chordSteps[(chordSteps.indexOf(step) + 1) % chordSteps.length]
          lastStep = step
          putNote(notes, scaleNote(step), noteTime, palette.noteLength * (.75 + random() * .6),
            (.024 + value.density * .018) * (.65 + random() * .45), true)
          noteTime += spacing * (.7 + random() * .7)
        }
      }
      scoreTime += duration
      phrase++
    }
    const before = context.currentTime - 1
    for (const voice of voices) voice.events = voice.events.filter((event) => event.end > before)
    // Retain the current harmony as well as the future score.
    let lastPast = -1
    for (let index = 0; index < chordHistory.length; index++) {
      if (chordHistory[index].time <= before) lastPast = index
    }
    if (lastPast > 0) chordHistory = chordHistory.slice(lastPast)
  }

  const offline = typeof (context as OfflineAudioContext).startRendering === 'function'
  const horizon = () => offline
    ? (context as OfflineAudioContext).length / context.sampleRate + 2
    : context.currentTime + LOOKAHEAD_SECONDS

  function replan() {
    // Only replace a future phrase. Its saved generator state preserves the
    // current composition's position; active notes and their tails are kept.
    const checkpoint = chordHistory.find((chord) => chord.time > context.currentTime + 2) ?? {
      time: scoreTime, degree, beforeDegree: degree, phrase, randomState: random.getState(),
    }
    const boundary = checkpoint.time
    for (const voice of voices) {
      // Hold scheduled ramps at the boundary, then finish already-started notes.
      const active = voice.events.find((event) => event.start < boundary && event.end > boundary)
      if (typeof voice.envelope.gain.cancelAndHoldAtTime === 'function') {
        voice.envelope.gain.cancelAndHoldAtTime(boundary)
      } else {
        voice.envelope.gain.cancelScheduledValues(boundary)
        if (active) {
          for (let index = 1; index < active.points.length; index++) {
            const left = active.points[index - 1]
            const right = active.points[index]
            if (left.time <= boundary && right.time >= boundary) {
              const position = (boundary - left.time) / (right.time - left.time)
              const heldValue = left.value + (right.value - left.value) * position
              voice.envelope.gain.linearRampToValueAtTime(heldValue, boundary)
              break
            }
          }
        }
      }
      for (const oscillator of voice.oscillators) oscillator.frequency.cancelScheduledValues(boundary)
      voice.pan.pan.cancelScheduledValues(boundary)
      if (active) {
        for (const point of active.points) {
          if (point.time > boundary) voice.envelope.gain.linearRampToValueAtTime(point.value, point.time)
        }
      } else voice.envelope.gain.setValueAtTime(0, boundary)
      voice.events = voice.events.filter((event) => event.start < boundary)
      voice.available = active ? active.end + .03 : boundary
    }
    degree = checkpoint.beforeDegree
    phrase = checkpoint.phrase
    chordHistory = chordHistory.filter((chord) => chord.time < boundary)
    random = seededRandom(checkpoint.randomState)
    scoreTime = boundary
    scheduleTo(horizon())
  }

  function apply(next: SoundSettings, initial = false) {
    const previous = value
    value = sanitize(next)
    const time = context.currentTime
    const change = (param: AudioParam, target: number) => {
      if (initial) param.setValueAtTime(target, time)
      else ramp(param, target, time)
    }
    change(lowpass.frequency, (530 + (1 - value.darkness) ** 1.6 * 4300 - value.warmth * 200) * palette.brightness)
    change(body.gain, -.5 + value.warmth * 3.8)
    change(wetLowpass.frequency, 1500 + (1 - value.darkness) * 2600)
    change(wet.gain, .1 + value.space * .55)
    change(dry.gain, 1 - value.space * .3)
    change(echo.gain, value.space ** 2 * .2)
    change(feedback.gain, .1 + value.space * .3)
    change(filterMovement.gain, 20 + value.movement * 380)
    change(panMovement.gain, value.movement * .12)
    change(slowDrift.gain, .25 + value.drift * 7)
    change(tapeWow.gain, value.drift ** 1.5 * palette.wow * 4)
    change(air.gain, palette.air * (.55 + value.space * .7))
    change(rainLevel.gain, value.rain ** 1.2 * (environment === 'city' ? .56 : .48))
    const level = value.volume ** 1.5 * .9
    if (initial) output.gain.linearRampToValueAtTime(level, time + 1.4)
    else ramp(output.gain, level, time, .3)
    if (!initial && (Math.abs(previous.density - value.density) > .003 ||
      Math.abs(previous.movement - value.movement) > .003 || Math.abs(previous.tension - value.tension) > .003)) replan()
  }

  apply(value, true)
  scheduleTo(horizon())
  if (!offline) refill = setInterval(() => { if (!stopped) scheduleTo(horizon()) }, 20_000)
  return {
    update(next) { if (!stopped) apply(next) },
    setAtmosphere(next) { if (!stopped) { environment = next; apply(value) } },
    stop() {
      if (stopped) return
      stopped = true
      if (refill !== undefined) clearInterval(refill)
      output.gain.cancelScheduledValues(context.currentTime)
      output.gain.setValueAtTime(0, context.currentTime)
      for (const source of sources) { try { source.stop() } catch { /* Already stopped. */ } }
      for (const node of nodes) node.disconnect()
      sources.length = 0; nodes.length = 0
      for (const voice of voices) voice.events.length = 0
      chordHistory.length = 0
    },
  }
}

interface LiveScene {
  key: string
  sound: Soundscape
  level: GainNode
}

/** A single lazy context and at most two scene graphs, even during randomization. */
export class AmbientEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private scenes: LiveScene[] = []
  private transitionMarker: ConstantSourceNode | null = null
  private selected: AtmosphereId = 'city'
  private identity: SoundIdentity = normalizeIdentity('city')
  private settings: SoundSettings = DEFAULTS
  private playing = false
  private disposed = false
  private operation = 0
  private cancelPause: (() => void) | null = null

  constructor() {}

  private ensureContext() {
    if (this.disposed) throw new Error('This sound engine has been disposed.')
    if (this.context) return this.context
    const AudioContextClass = globalThis.AudioContext ??
      (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) throw new Error('This browser does not support Web Audio.')
    const context = new AudioContextClass({ latencyHint: 'playback' })
    const master = context.createGain()
    master.gain.value = 0
    const analyser = context.createAnalyser()
    analyser.fftSize = 256; analyser.smoothingTimeConstant = .86
    master.connect(analyser).connect(context.destination)
    this.context = context; this.master = master; this.analyser = analyser
    return context
  }

  async play(id: AtmosphereId, settings: SoundSettings, identity?: SoundIdentity): Promise<void> {
    const context = this.ensureContext()
    const operation = ++this.operation
    this.playing = true; this.selected = id
    this.identity = normalizeIdentity(id, identity)
    this.settings = sanitize(settings)
    this.cancelPause?.()
    try { await context.resume() } catch (error) {
      if (operation === this.operation) this.playing = false
      throw error
    }
    if (operation !== this.operation || !this.playing || this.disposed) return
    this.transition()
    ramp(this.master!.gain, 1, context.currentTime, .9)
  }

  setAtmosphere(id: AtmosphereId, settings: SoundSettings, identity?: SoundIdentity): void {
    this.selected = id
    this.identity = normalizeIdentity(id, identity ?? this.identity)
    this.settings = sanitize(settings)
    if (this.playing && this.context?.state === 'running') this.transition()
  }

  setSound(identity: SoundIdentity, settings: SoundSettings): void {
    this.identity = normalizeIdentity(this.selected, identity)
    this.settings = sanitize(settings)
    if (this.playing && this.context?.state === 'running') this.transition()
  }

  update(settings: SoundSettings): void {
    this.settings = sanitize(settings)
    for (const scene of this.scenes) scene.sound.update(this.settings)
  }

  private desiredKey() { return `${this.identity.preset}:${this.identity.seed}` }

  private transition() {
    const context = this.context!
    const key = this.desiredKey()
    const incoming = this.scenes.at(-1)
    if (incoming?.key === key) {
      incoming.sound.setAtmosphere(this.selected)
      incoming.sound.update(this.settings)
      return
    }
    // A rapid new seed is queued as the latest desired identity while the
    // current crossfade finishes. No third graph or abrupt cutoff is needed.
    if (this.transitionMarker) return
    const level = context.createGain()
    level.gain.value = 0; level.connect(this.master!)
    const next: LiveScene = {
      key, level,
      sound: createSoundscape(context, this.selected, this.settings, level, this.identity),
    }
    this.scenes.push(next)
    ramp(level.gain, 1, context.currentTime, CROSSFADE)
    if (!incoming) return
    ramp(incoming.level.gain, 0, context.currentTime, CROSSFADE)
    const marker = context.createConstantSource()
    marker.offset.value = 0; marker.connect(this.master!)
    this.transitionMarker = marker
    marker.onended = () => {
      marker.disconnect()
      if (this.transitionMarker !== marker) return
      this.transitionMarker = null
      incoming.sound.stop(); incoming.level.disconnect()
      this.scenes = this.scenes.filter((scene) => scene !== incoming)
      if (this.playing && !this.disposed && this.desiredKey() !== next.key) this.transition()
    }
    marker.start(); marker.stop(context.currentTime + CROSSFADE + .08)
  }

  async pause(): Promise<void> {
    ++this.operation; this.playing = false
    this.cancelPause?.()
    const context = this.context
    if (!context || context.state === 'closed') return
    if (context.state !== 'running') {
      this.clearScenes()
      this.master!.gain.cancelScheduledValues(context.currentTime)
      this.master!.gain.setValueAtTime(0, context.currentTime)
      return
    }
    ramp(this.master!.gain, 0, context.currentTime, .55)
    await new Promise<void>((resolve) => {
      const marker = context.createConstantSource()
      marker.offset.value = 0; marker.connect(this.master!)
      let complete = false
      const finish = (cancelled: boolean) => {
        if (complete) return
        complete = true; clearTimeout(fallback)
        marker.onended = null
        try { marker.stop() } catch { /* Already ended. */ }
        marker.disconnect(); this.cancelPause = null
        if (cancelled || this.playing || this.disposed) { resolve(); return }
        this.clearScenes()
        void context.suspend().catch(() => undefined).then(() => resolve())
      }
      const fallback = setTimeout(() => finish(false), 1500)
      this.cancelPause = () => finish(true)
      marker.onended = () => finish(false)
      marker.start(); marker.stop(context.currentTime + .6)
    })
  }

  private clearScenes() {
    if (this.transitionMarker) {
      this.transitionMarker.onended = null
      try { this.transitionMarker.stop() } catch { /* Already ended. */ }
      this.transitionMarker.disconnect(); this.transitionMarker = null
    }
    for (const scene of this.scenes) { scene.sound.stop(); scene.level.disconnect() }
    this.scenes = []
  }

  getAnalyser(): AnalyserNode | null { return this.analyser }
  getContextState(): string { return this.disposed ? 'closed' : this.context?.state ?? 'uninitialized' }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true; this.playing = false; ++this.operation
    this.cancelPause?.(); this.clearScenes()
    this.master?.disconnect(); this.analyser?.disconnect()
    const context = this.context
    this.context = null; this.master = null; this.analyser = null
    if (context && context.state !== 'closed') await context.close()
  }
}
