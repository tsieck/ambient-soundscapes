import type { SoundIdentity, SoundPresetId } from './sound-presets'
import { createRhythm, RHYTHM_DEFAULTS } from './rhythm'
import { createRoomImpulse } from './room'
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
  bedLevel: number
  padLevel: number
  detailLevel: number
  textureLevel: number
  pulse: number
  tempo: number
  bounce: number
  binaural: number
  beatRate: number
}

export interface Soundscape {
  update(settings: SoundSettings): void
  setAtmosphere(id: AtmosphereId): void
  stop(): void
}

const TAU = Math.PI * 2
const CROSSFADE = 2.8
const DEFAULTS: SoundSettings = {
  ...RHYTHM_DEFAULTS,
  warmth: 0.6,
  darkness: 0.5,
  movement: 0.35,
  rain: 0.4,
  volume: 0.6,
  space: 0.65,
  density: 0.5,
  drift: 0.35,
  tension: 0.35,
  bedLevel: 0.55,
  padLevel: 0.75,
  detailLevel: 0.5,
  textureLevel: 0.3,
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
  const impulse = createRoomImpulse(context)
  const rain = context.createBuffer(2, Math.ceil(sampleRate * 17.391), sampleRate)
  const patter = context.createBuffer(2, Math.ceil(sampleRate * 23.717), sampleRate)

  for (let channel = 0; channel < 2; channel++) {
    const random = seededRandom(48371 + channel * 9719)
    // Preserve the existing weather seed sequence when changing the room.
    for (let i = 0; i < impulse.length; i++) random()

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
  pad: 'subtractive' | 'bowed' | 'organ' | 'fm' | 'brass'
  detail: 'fm' | 'electric' | 'pluck' | 'bowed' | 'felt'
  ratio: number
  index: number
  motif: number[]
  phrasing?: { spacing: number; cycle: number; lilt: number }
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const LYDIAN = [0, 2, 4, 6, 7, 9, 11]
const DORIAN = [0, 2, 3, 5, 7, 9, 10]
const MINOR = [0, 2, 3, 5, 7, 8, 10]
const PALETTES: Record<SoundPresetId, Palette> = {
  velvet: { partials: [1,.5,.28,.17,.1,.065,.045,.025], modes: [MAJOR,DORIAN], attack: 5, noteAttack: 1.1, noteLength: 10, air: .4, brightness: .9, wow: .5, pad: 'subtractive', detail: 'pluck', ratio: 1, index: .5, motif: [0,2,4,2] },
  tape: { partials: [1,.32,.16,.075,.035,.014], modes: [MAJOR,LYDIAN], attack: 3.4, noteAttack: .055, noteLength: 8, air: .7, brightness: 1, wow: 1.7, pad: 'subtractive', detail: 'electric', ratio: 1, index: 1.6, motif: [0,2,1,4] },
  glass: { partials: [1,0,.08,0,.018], modes: [LYDIAN,MAJOR], attack: 7, noteAttack: .04, noteLength: 12, air: .55, brightness: 1.3, wow: .22, pad: 'organ', detail: 'fm', ratio: 2.71, index: .72, motif: [0,4,2] },
  orbit: { partials: [1,.18,0,.36,0,0,0,.06], modes: [MINOR,DORIAN], attack: 8, noteAttack: 1.5, noteLength: 16, air: .55, brightness: .75, wow: .7, pad: 'organ', detail: 'fm', ratio: .5, index: .42, motif: [0,4,0] },
  bloom: { partials: [1,.5,.33,.24,.17,.125,.09,.06,.04,.025], modes: [MAJOR,LYDIAN], attack: 8.5, noteAttack: 3.8, noteLength: 15, air: .65, brightness: 1, wow: .6, pad: 'bowed', detail: 'bowed', ratio: 1, index: .5, motif: [0,1,4,2] },
  horizon: { partials: [1,.3,0,.09,0,0,0,.018], modes: [LYDIAN,MAJOR], attack: 9, noteAttack: 2.2, noteLength: 14, air: .5, brightness: 1.2, wow: .5, pad: 'organ', detail: 'pluck', ratio: 1, index: .5, motif: [0,4,6,4] },
  ember: { partials: [1,.66,.4,.24,.16,.11,.07,.04], modes: [DORIAN,MINOR], attack: 5.7, noteAttack: .35, noteLength: 11, air: .4, brightness: .65, wow: .35, pad: 'subtractive', detail: 'pluck', ratio: 1, index: .5, motif: [0,2,0] },
  tide: { partials: [1,.3,.16,.08,.04,.018], modes: [DORIAN,MAJOR], attack: 10, noteAttack: 4.4, noteLength: 18, air: 1.2, brightness: .9, wow: .85, pad: 'bowed', detail: 'bowed', ratio: 1, index: .5, motif: [0,4,2,1] },
  mist: { partials: [1,.06,0,.025], modes: [MAJOR,DORIAN], attack: 10, noteAttack: 4.8, noteLength: 18, air: 2.6, brightness: .85, wow: .45, pad: 'organ', detail: 'bowed', ratio: 1, index: .5, motif: [0,2,4] },
  aurora: { partials: [1,.09,.19,.038,.072,.012], modes: [LYDIAN,DORIAN], attack: 8, noteAttack: .8, noteLength: 14, air: 1, brightness: 1.2, wow: .9, pad: 'fm', detail: 'fm', ratio: 1.998, index: 1.05, motif: [0,3,2,6] },
  // Append palettes: their stable index is part of each saved musical seed.
  neon: { partials: [1,.62,.42,.3,.23,.18,.14,.105,.08,.06,.045,.032], modes: [MINOR,DORIAN], attack: 7.2, noteAttack: .18, noteLength: 19, air: .8, brightness: 1.08, wow: .65, pad: 'brass', detail: 'fm', ratio: 2.414, index: 1.15, motif: [0,4,3,1] },
  midnight: { partials: [1,.24,.15,.07,.033,.015,.009], modes: [DORIAN,MINOR], attack: 12, noteAttack: .85, noteLength: 17, air: 1.5, brightness: .82, wow: .65, pad: 'bowed', detail: 'pluck', ratio: 1, index: .5, motif: [0,4,1] },
  afterglow: { partials: [1,.46,.31,.19,.13,.09,.063,.044,.03,.021], modes: [MAJOR,LYDIAN], attack: 9.5, noteAttack: .14, noteLength: 13, air: .65, brightness: 1.03, wow: 1.1, pad: 'brass', detail: 'electric', ratio: 1, index: 1.3, motif: [0,2,4,1] },
  lantern: { partials: [1,.2,.11,.045,.02,.008], modes: [MAJOR,DORIAN], attack: 7, noteAttack: .035, noteLength: 8.5, air: .45, brightness: .94, wow: .55, pad: 'subtractive', detail: 'felt', ratio: 1, index: .5, motif: [0,1,4,2], phrasing: { spacing: .64, cycle: .78, lilt: .12 } },
  daydream: { partials: [1,.14,.065,.025,.009], modes: [LYDIAN,MAJOR], attack: 6.5, noteAttack: .055, noteLength: 6.8, air: .65, brightness: 1.04, wow: .85, pad: 'subtractive', detail: 'fm', ratio: 3, index: .38, motif: [0,2,1,4], phrasing: { spacing: .54, cycle: .7, lilt: .22 } },
}

function normalizeIdentity(id: AtmosphereId, identity?: SoundIdentity): SoundIdentity {
  if (!identity) return { preset: id === 'city' ? 'orbit' : 'tape', seed: id === 'city' ? 7319 : 4217 }
  return {
    preset: Object.hasOwn(PALETTES, identity.preset) ? identity.preset : 'velvet',
    seed: Number.isFinite(identity.seed) ? identity.seed >>> 0 : 0,
  }
}

interface EnvelopePoint { time: number; value: number }
interface AutomationCurve { param: AudioParam; points: EnvelopePoint[] }
interface NoteEvent { midi: number; start: number; end: number; curves: AutomationCurve[] }
type Layer = 'bed' | 'pad' | 'detail' | 'texture'
interface Voice {
  layer: Layer
  tuning: { param: AudioParam; ratio: number }[]
  envelope: GainNode
  pan: StereoPannerNode
  colors: { param: AudioParam; kind: 'filter' | 'fm' | 'brass-lowpass' | 'brass-highpass' | 'strike'; amount: number }[]
  events: NoteEvent[]
  available: number
}
interface Chapter {
  kind: number
  remaining: number
  register: number
  spectral: number
  details: number
  texture: number
}
interface MelodicStrand {
  next: number
  origin: number
  homePan: number
  position: number
  cycle: number
  spacing: number
  figureCycle: number
  figureSpacing: number
  figureMotif: number[]
  figureLevel: number
  figureSpectral: number
  figurePan: number
  figureStart: number
  prepared: boolean
  active: boolean
  degree: number
  count: number
  lastMidi: number
  turns: number
}
interface Composition {
  degree: number
  dwell: number
  phrase: number
  chapter: Chapter
  voicing: number[]
  motif: number[]
  lastBass: number
  focusUntil: number
  focusStrand: number
  strands: MelodicStrand[]
}
interface ScoreCheckpoint { time: number; randomState: number; composition: Composition }

const LOOKAHEAD_SECONDS = 30 * 60

/**
 * Four independent layers share a seeded harmonic language. Subtractive/bowed
 * voices, two-operator FM keys, organ drawbars and resonant noise use fixed pools.
 * Phrase checkpoints retain all RNG/composition state for continuous live edits.
 * Thirty minutes of native automation cover minute-throttled background timers;
 * offline contexts schedule their entire render without a JavaScript scheduler.
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
  let random = seededRandom(musicalSeed ^ 0x193f2ab7)
  const scene = getBuffers(context)
  const startedAt = context.currentTime
  const nodes: AudioNode[] = []
  const sources: AudioScheduledSourceNode[] = []
  let value = sanitize(settings)
  let stopped = false
  let refill: ReturnType<typeof setInterval> | undefined
  let scoreTime = startedAt
  let checkpoints: ScoreCheckpoint[] = []
  const motifRotation = Math.floor(characterRandom() * palette.motif.length)
  const originalMotif = [...palette.motif.slice(motifRotation), ...palette.motif.slice(0, motifRotation)]
  let composition: Composition = {
    degree: 0, dwell: Math.round((1 - value.movement) * 1.5), phrase: 0,
    chapter: { kind: 0, remaining: 3 + Math.floor(characterRandom() * 2), register: 0, spectral: .9, details: .95, texture: .75 },
    voicing: [], motif: [...originalMotif], lastBass: root,
    focusUntil: startedAt, focusStrand: -1,
    strands: [0, 1].map((index) => ({
      next: startedAt + (index === 0 ? 2.2 : 22 + characterRandom() * 7),
      origin: startedAt, position: 0,
      homePan: (index === 0 ? -.3 : .3) + (((musicalSeed >>> (index * 8)) & 255) / 255 - .5) * .12,
      cycle: index === 0 ? 31.7 + characterRandom() * 9 : 47.3 + characterRandom() * 13,
      spacing: 3.1 + characterRandom() * 1.3,
      figureCycle: 0, figureSpacing: 0, figureMotif: [], figureLevel: 0, figureSpectral: 0,
      figurePan: 0, figureStart: startedAt, prepared: false,
      active: false, degree: 0,
      count: 0, lastMidi: root + (index === 0 ? 24 : 19), turns: 0,
    })),
  }
  const copyComposition = (state: Composition): Composition => ({
    ...state, chapter: { ...state.chapter }, voicing: [...state.voicing], motif: [...state.motif],
    strands: state.strands.map((strand) => ({ ...strand, figureMotif: [...strand.figureMotif] })),
  })

  const keep = <T extends AudioNode>(node: T): T => { nodes.push(node); return node }
  const gain = (level: number) => {
    const node = keep(context.createGain()); node.gain.value = level; return node
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
    return start(node)
  }

  const music = gain(1)
  const layerBus: Record<Layer, GainNode> = { bed: gain(1), pad: gain(1), detail: gain(1), texture: gain(1) }
  for (const bus of Object.values(layerBus)) bus.connect(music)
  const pulseBus = gain(1)
  pulseBus.connect(music)
  const lowpass = filter('lowpass', 2200)
  const body = filter('lowshelf', 280)
  const dry = gain(.94)
  // Direct sound remains anchored. Different amounts of room identify the
  // foreground, sustained ensemble and diffuse background without extra width
  // modulation or a master-level swell.
  const roomInput = gain(1)
  const roomTone = filter('lowpass', 2200)
  const roomBody = filter('lowshelf', 280)
  const roomDepth: Record<Layer, number> = { bed: .24, pad: .92, detail: .52, texture: 1.25 }
  for (const layer of Object.keys(layerBus) as Layer[]) {
    layerBus[layer].connect(gain(roomDepth[layer])).connect(roomInput)
  }
  pulseBus.connect(gain(.36)).connect(roomInput)
  const reverbSend = gain(0)
  const reverb = keep(context.createConvolver()); reverb.buffer = scene.impulse
  const wet = gain(.3)
  const wetHighpass = filter('highpass', 190)
  const wetLowpass = filter('lowpass', 2800)
  const delay = keep(context.createDelay(2)); delay.delayTime.value = .61 + characterRandom() * .46
  const echoFilter = filter('lowpass', 1700)
  const echoSend = gain(0)
  const feedback = gain(.23)
  const echo = gain(.095)
  const mix = gain(1)
  const subsonic = filter('highpass', 30)
  const safety = keep(context.createDynamicsCompressor())
  safety.threshold.value = -15; safety.knee.value = 10; safety.ratio.value = 4
  safety.attack.value = .012; safety.release.value = .75
  const output = gain(0)
  music.connect(lowpass).connect(body)
  body.connect(dry).connect(mix)
  roomInput.connect(roomTone).connect(roomBody).connect(reverbSend).connect(reverb).connect(wetHighpass).connect(wetLowpass).connect(wet).connect(mix)
  // Echo comes primarily from articulated voices, preserving foundation clarity.
  layerBus.detail.connect(echoSend).connect(delay).connect(echoFilter).connect(echo).connect(mix)
  echoFilter.connect(feedback).connect(delay)
  mix.connect(subsonic).connect(safety).connect(output).connect(destination)

  const filterMovement = gain(150)
  lfo(.00713, characterRandom() * TAU).connect(filterMovement).connect(lowpass.detune)
  filterMovement.connect(roomTone.detune)
  const slowDrift = gain(3)
  const tapeWow = gain(1)
  const panMovement = gain(.035)
  lfo(.01837, characterRandom() * TAU).connect(slowDrift)
  lfo(.3271, characterRandom() * TAU).connect(tapeWow)
  lfo(.01079, characterRandom() * TAU).connect(panMovement)

  // A quiet, modulated stereo early-reflection path enriches bowed/subtractive
  // pads without adding more unison oscillators to each note.
  const chorusAmount = gain(palette.pad === 'bowed' ? .25 : palette.pad === 'brass' ? .2 : palette.pad === 'subtractive' ? .15 : .06)
  for (const side of [-1, 1]) {
    const chorusDelay = keep(context.createDelay(.1)); chorusDelay.delayTime.value = .019 + side * .003
    const chorusMod = gain(.0018)
    lfo(side < 0 ? .1137 : .1571, characterRandom() * TAU).connect(chorusMod).connect(chorusDelay.delayTime)
    const chorusPan = keep(context.createStereoPanner()); chorusPan.pan.value = side * .72
    layerBus.pad.connect(chorusDelay).connect(chorusPan).connect(chorusAmount)
  }
  chorusAmount.connect(music)
  chorusAmount.connect(roomInput)

  const harmonics = new Float32Array([0, ...palette.partials.map((partial) => partial * (.85 + characterRandom() * .3))])
  const padWave = context.createPeriodicWave(new Float32Array(harmonics.length), harmonics)
  const shadowHarmonics = harmonics.map((partial, index) => partial * (index < 2 ? 1 : index % 2 ? .74 : .35))
  const shadowPadWave = context.createPeriodicWave(new Float32Array(harmonics.length), shadowHarmonics)
  const roundWave = context.createPeriodicWave(new Float32Array(6), new Float32Array([0,1,.09,.055,.014,.005]))
  // Odd body partials and an even-only strike avoid phase cancellation between
  // free-running oscillators. The mixed note consistently opens brighter, then
  // softens as the strike decays, without needing more sources or retriggers.
  const feltBodyWave = context.createPeriodicWave(new Float32Array(8), new Float32Array([0,1,0,.2,0,.028,0,.01]))
  const feltStrikeWave = context.createPeriodicWave(new Float32Array(9), new Float32Array([0,0,.55,0,.24,0,.08,0,.03]))
  const bassWave = context.createPeriodicWave(new Float32Array(5), new Float32Array([0,1,.12,.04,.009]))
  const noise = keep(context.createBufferSource()); noise.buffer = scene.rain; noise.loop = true; start(noise)
  const grainOne = lfo(.4731, characterRandom() * TAU)
  const grainTwo = lfo(.7193, characterRandom() * TAU)
  // Sound color has its own seeded sequence. Adding a motion source cannot
  // change the musical vocabulary, timing or the rain's random sequence.
  const timbreRandom = seededRandom(musicalSeed ^ 0x7ad513c9)
  const timbreDepths: { node: GainNode; maximum: number }[] = []
  function colorMotion(source: AudioNode, target: AudioParam, maximum: number) {
    const depth = gain(0)
    source.connect(depth).connect(target)
    timbreDepths.push({ node: depth, maximum })
  }

  function makeVoice(layer: Layer): Voice {
    const envelope = gain(0)
    const pan = keep(context.createStereoPanner())
    envelope.connect(pan).connect(layerBus[layer])
    if (layer !== 'bed') panMovement.connect(pan.pan)
    const voice: Voice = { layer, envelope, pan, tuning: [], colors: [], events: [], available: startedAt }
    // One slow clock per sustained voice. Stable fundamentals retain harmonic
    // clarity while overtone balance and bandwidth unfold at different rates.
    const breath = layer === 'pad' || layer === 'texture'
      ? lfo(.0047 + timbreRandom() * .011, timbreRandom() * TAU) : null
    if (layer === 'texture') {
      // Windowed resonant-noise bands create a pitched spectral cloud. The
      // overlapping, unrelated grain rates avoid a fixed tremolo or noise loop.
      const grain = gain(.64)
      const grainDepthA = gain(.12 + timbreRandom() * .1)
      const grainDepthB = gain((timbreRandom() < .5 ? -1 : 1) * (.09 + timbreRandom() * .06))
      grainOne.connect(grainDepthA).connect(grain.gain)
      grainTwo.connect(grainDepthB).connect(grain.gain)
      for (const [ratio, level] of [[1,1], [2.003,.38], [3.997,.15]]) {
        const band = filter('bandpass', 440 * ratio, 12 + characterRandom() * 12)
        const bandLevel = gain(level)
        noise.connect(band).connect(bandLevel).connect(grain)
        voice.tuning.push({ param: band.frequency, ratio })
        slowDrift.connect(band.detune)
        colorMotion(breath!, band.Q, ratio === 1 ? 3.2 : -2.4)
      }
      grain.connect(envelope)
      return voice
    }

    const isDetail = layer === 'detail'
    const felt = isDetail && palette.detail === 'felt'
    const brass = layer === 'pad' && palette.pad === 'brass'
    const fm = isDetail ? palette.detail === 'fm' || palette.detail === 'electric' : layer === 'pad' && palette.pad === 'fm'
    const tone = filter('lowpass', 4000, brass ? 1.05 : layer === 'pad' && palette.pad === 'subtractive' ? .65 : .45)
    // A serial high-pass/low-pass pair gives brass a rounded body and a nasal
    // opening. The bed bypasses it. The two existing oscillators and the same
    // independent breath clock supply the voice; no extra sources are needed.
    const toneInput = brass ? filter('highpass', 90, .55) : tone
    if (brass) {
      toneInput.connect(tone)
      voice.colors.push({ param: toneInput.frequency, kind: 'brass-highpass', amount: .85 })
    }
    if (breath) colorMotion(breath, tone.detune, brass ? 480 : 320)
    tone.connect(envelope)
    if (fm) {
      const carrier = keep(context.createOscillator()), modulator = keep(context.createOscillator())
      carrier.type = 'sine'; modulator.type = 'sine'
      const index = gain(0)
      const evolvingIndex = gain(1)
      modulator.connect(index).connect(evolvingIndex).connect(carrier.frequency)
      if (breath) colorMotion(breath, evolvingIndex.gain, .3)
      carrier.connect(tone)
      const ratio = isDetail ? palette.ratio : 1.998
      voice.tuning.push({ param: carrier.frequency, ratio: 1 }, { param: modulator.frequency, ratio })
      voice.colors.push({ param: index.gain, kind: 'fm', amount: isDetail ? palette.index : .65 })
      for (const oscillator of [carrier, modulator]) {
        oscillator.detune.value = (characterRandom() - .5) * .45
        slowDrift.connect(oscillator.detune); tapeWow.connect(oscillator.detune); start(oscillator)
      }
      tone.frequency.value = isDetail ? 5600 : 3800
    } else {
      for (let layerIndex = 0; layerIndex < 2; layerIndex++) {
        const oscillator = keep(context.createOscillator())
        const wave = felt ? (layerIndex === 0 ? feltBodyWave : feltStrikeWave) : layer === 'bed' ? bassWave : (isDetail && palette.detail !== 'bowed' ? roundWave
          : layer === 'pad' && layerIndex === 1 ? shadowPadWave : padWave)
        if (layer === 'bed' && layerIndex === 0) oscillator.type = 'sine'
        else oscillator.setPeriodicWave(wave)
        oscillator.detune.value = (layerIndex === 0 ? -1 : 1) * ((felt ? .2 : .5) + characterRandom() * (felt ? .5 : brass ? 4 : palette.pad === 'bowed' ? 3 : 1.5))
        const level = gain(felt ? (layerIndex === 0 ? .72 : 0) : layer === 'bed' ? (layerIndex === 0 ? .8 : .2) : .5)
        if (felt && layerIndex === 1) voice.colors.push({ param: level.gain, kind: 'strike', amount: .28 })
        // Complementary gains keep the pair's total weight constant. This
        // moves the spectral balance, rather than applying blanket tremolo.
        if (breath) colorMotion(breath, level.gain, layerIndex === 0 ? .24 : -.24)
        oscillator.connect(level).connect(toneInput)
        voice.tuning.push({ param: oscillator.frequency, ratio: felt && layerIndex === 1 ? 1.001 : 1 })
        slowDrift.connect(oscillator.detune); tapeWow.connect(oscillator.detune); start(oscillator)
      }
      voice.colors.push({ param: tone.frequency, kind: brass ? 'brass-lowpass' : 'filter', amount: brass ? 9 : felt ? 6 : layer === 'bed' ? 3 : palette.pad === 'organ' ? 7 : 4.8 })
    }
    return voice
  }

  // The count remains 17 pitched voices; architecture and articulation provide
  // the added character. Noise clouds use shared sources and filter banks.
  const beds = Array.from({ length: 4 }, () => makeVoice('bed'))
  const pads = Array.from({ length: 8 }, () => makeVoice('pad'))
  const details = Array.from({ length: 5 }, () => makeVoice('detail'))
  const textures = Array.from({ length: 3 }, () => makeVoice('texture'))
  const voices = [...beds, ...pads, ...details, ...textures]

  const rainLevel = gain(0), rainSwell = gain(.9)
  const rainHighpass = filter('highpass', 360), rainLowpass = filter('lowpass', 5400)
  rainHighpass.connect(rainLowpass).connect(rainSwell).connect(rainLevel).connect(mix)
  const rainMovement = gain(.1)
  lfo(.04193, .3).connect(rainMovement).connect(rainSwell.gain)
  const rainSource = keep(context.createBufferSource()); rainSource.buffer = scene.rain; rainSource.loop = true
  rainSource.connect(rainHighpass); start(rainSource)
  const patterSource = keep(context.createBufferSource()); patterSource.buffer = scene.patter; patterSource.loop = true
  const patter = gain(.65); patterSource.connect(patter).connect(rainHighpass); start(patterSource)

  const scaleNote = (step: number) => root + scale[((step % 7) + 7) % 7] + Math.floor(step / 7) * 12
  const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

  function putNote(pool: Voice[], midi: number, time: number, length: number, amplitude: number, spectral = 1, position?: number) {
    const voice = pool.find((candidate) => candidate.available <= time + .001)
    if (!voice) return
    const keyed = voice.layer === 'detail'
    const felt = keyed && palette.detail === 'felt'
    const texture = voice.layer === 'texture'
    const brass = voice.layer === 'pad' && palette.pad === 'brass'
    const first = composition.phrase === 0
    const attack = keyed ? Math.min(length * .3, palette.noteAttack * (.85 + random() * .3))
      : Math.min(length * .27, (first ? (texture ? 3.5 : brass ? 4.2 : 2.4) : texture ? 8 : voice.layer === 'bed' ? 5 : palette.attack) * (.85 + random() * .3))
    const end = time + length
    const points: EnvelopePoint[] = felt ? [
      { time, value: 0 }, { time: time + attack, value: amplitude },
      { time: time + Math.min(length * .18, .6), value: amplitude * .5 },
      { time: time + length * .55, value: amplitude * .13 }, { time: end, value: 0 },
    ] : keyed ? [
      { time, value: 0 }, { time: time + attack, value: amplitude },
      { time: time + Math.max(attack + .2, length * .33), value: amplitude * .35 }, { time: end, value: 0 },
    ] : [
      { time, value: 0 }, { time: time + attack, value: amplitude },
      { time: time + length * .65, value: amplitude * (texture ? .64 : .84) }, { time: end, value: 0 },
    ]
    const curves: AutomationCurve[] = [{ param: voice.envelope.gain, points }]
    const fundamental = frequency(midi)
    for (const tuning of voice.tuning) tuning.param.setValueAtTime(fundamental * tuning.ratio, time)
    const spread = voice.layer === 'bed' ? .12 : texture ? .8 : keyed ? .6 : .45
    const randomPan = (random() * 2 - 1) * spread
    voice.pan.pan.setValueAtTime(position ?? randomPan, time)
    for (const color of voice.colors) {
      if (color.kind === 'strike') {
        const peak = color.amount * Math.min(1.15, spectral)
        curves.push({ param: color.param, points: [
          { time, value: 0 }, { time: time + attack * .5, value: peak },
          { time: time + Math.min(.45, length * .12), value: peak * .12 },
          { time: time + length * .24, value: 0 }, { time: end, value: 0 },
        ] })
        continue
      }
      if (color.kind === 'brass-lowpass' || color.kind === 'brass-highpass') {
        const lowpass = color.kind === 'brass-lowpass'
        const peak = Math.min(7600, fundamental * color.amount * (.65 + spectral * .65))
        const base = lowpass ? Math.max(130, fundamental * .85) : fundamental * .35
        // Brightness blooms after the amplitude arrival, like leaning into a
        // held key. Both filters follow this one gesture, with a gentle second
        // breath before the release. Own every endpoint so live score edits
        // can restore a ringing note's complete articulation unchanged.
        curves.push({ param: color.param, points: [
          { time, value: base },
          { time: time + attack, value: base + (peak - base) * .36 },
          { time: time + Math.min(length * .38, attack + length * .14), value: peak },
          { time: time + length * .55, value: base + (peak - base) * .48 },
          { time: time + length * .72, value: base + (peak - base) * .68 },
          { time: end, value: base },
        ] })
        continue
      }
      const peak = color.kind === 'fm' ? fundamental * color.amount * spectral
        : Math.min(7600, fundamental * color.amount * (.65 + spectral * .65))
      const base = color.kind === 'fm' ? peak * (keyed ? .08 : .22) : Math.max(160, peak * .3)
      curves.push({ param: color.param, points: [
        { time, value: base },
        { time: time + (keyed ? attack : Math.min(length * .4, attack * 1.6)), value: peak },
        { time: time + Math.max(attack + .2, length * .6), value: keyed ? base + (peak - base) * .12 : peak * .72 },
        { time: end, value: base },
      ] })
    }
    for (const curve of curves) {
      curve.param.setValueAtTime(curve.points[0].value, time)
      for (const point of curve.points.slice(1)) curve.param.linearRampToValueAtTime(point.value, point.time)
    }
    voice.events.push({ midi, start: time, end, curves }); voice.available = end + .04
  }

  function nextChapter() {
    let kind = Math.floor(random() * 5)
    if (kind === composition.chapter.kind) kind = (kind + 1) % 5
    composition.chapter = {
      kind, remaining: 3 + Math.floor(random() * 3), register: kind === 1 || kind === 4 ? 12 : 0,
      spectral: [.9,1.25,.73,.85,1.08][kind] * (.9 + random() * .2),
      details: [.75,1,.24,.5,.84][kind], texture: [.7,.5,1,.8,.65][kind],
    }
    const rotation = Math.floor(random() * originalMotif.length)
    composition.motif = [...originalMotif.slice(rotation), ...originalMotif.slice(0, rotation)]
    if (kind === 2 || kind === 4) composition.motif.reverse()
    // Alter one interval per chapter while retaining the motif's contour.
    if (kind === 1) composition.motif[composition.motif.length - 1] = 6
  }

  function leadVoicing(chordDegree: number, count: number) {
    const steps = [chordDegree, chordDegree + 2, chordDegree + 4,
      chordDegree + (value.tension > .58 ? 8 : value.tension > .22 ? 6 : 7)]
    const pitchClasses = steps.slice(0, count).map((step) => scaleNote(step) % 12).sort((a,b) => a-b)
    let best: number[] = [], bestCost = Infinity
    for (let inversion = 0; inversion < count; inversion++) {
      for (const octave of [36,48,60]) {
        const candidate: number[] = []
        for (let index = 0; index < count; index++) {
          let note = octave + pitchClasses[(index + inversion) % count]
          while (index > 0 && note <= candidate[index - 1] + 1) note += 12
          candidate.push(note)
        }
        if (candidate[0] < 47 || candidate.at(-1)! > 86) continue
        let cost = 0
        candidate.forEach((note, index) => {
          const previous = composition.voicing[index] ?? root + 16 + index * 5
          const target = root + 16 + index * 5 + composition.chapter.register * .5
          cost += Math.abs(note - previous) * 1.4 + Math.abs(note - target) * .35
        })
        if (cost < bestCost) { bestCost = cost; best = candidate }
      }
    }
    return best.length ? best : steps.slice(0, count).map((step) => scaleNote(step + 7))
  }

  const progressions = [[5,3,4,1], [4,3,0,5], [5,3,0], [0,4,1,5], [0,5,3], [3,0,4,1], [0,3,5]]
  // Slightly late alternate notes give a figure its own lilt. This belongs to
  // the melody, independent of optional Pulse/Bounce. Use the same offset for
  // scheduling and the ensemble's reservation of room around the whole phrase.
  const figureOffset = (strand: MelodicStrand, position: number) =>
    (position + (position % 2 ? palette.phrasing?.lilt ?? 0 : 0)) * strand.figureSpacing
  function scheduleStrands(until: number, chordDegree: number) {
    const chapter = composition.chapter
    const pace = 1.2 - value.movement * .4
    while (true) {
      // Let each next gesture see what the ensemble has already begun. Sorting
      // only after planning both complete strands cannot make them respond.
      const strandIndex = composition.strands[0].next <= composition.strands[1].next ? 0 : 1
      const strand = composition.strands[strandIndex]
      if (strand.next >= until) break
      if (strand.position === 0 && !strand.prepared) {
        strand.origin = strand.next
        strand.figureStart = strand.next
        strand.degree = chordDegree
        // Snapshot the complete gesture, including a deferred entrance. A live
        // edit may affect the next figure, never rewrite a half-played contour.
        strand.figureCycle = strand.cycle * pace * (palette.phrasing?.cycle ?? 1)
        strand.figureSpacing = strand.spacing * pace * (palette.phrasing?.spacing ?? 1)
        strand.figureMotif = [...composition.motif]
        strand.figureLevel = (.06 + value.density * .029) * (strandIndex === 0 ? 1 : .58)
        strand.figureSpectral = chapter.spectral * (strandIndex === 0 ? 1 : .72)
        strand.figurePan = strand.homePan + (random() - .5) * .07
        strand.count = Math.min(composition.motif.length,
          strandIndex === 0 ? 2 + Math.round(value.density * 2) : 1 + Math.round(value.density))
        strand.active = value.density > .035 && ((strandIndex === 0 && strand.turns === 0) ||
          random() < chapter.details * (.45 + value.density * .55) * (strandIndex === 0 ? 1 : .68))
        strand.prepared = true
        if (strand.active) {
          const articulation = figureOffset(strand, strand.count - 1)
          const breathingRoom = 1.2 + (1 - value.density) * 2.4
          const wait = composition.focusStrand !== strandIndex ? Math.max(0, composition.focusUntil - strand.next) : 0
          // A reply can wait for the other player's contour while its original
          // long cycle keeps running. If it cannot fit, omit this whole figure;
          // never squeeze its notes together or accumulate timing drift.
          const allowedWait = Math.min(18, strand.figureCycle - articulation - breathingRoom - 1)
          if (wait > allowedWait) strand.active = false
          else {
            strand.figureStart += wait
            strand.next = strand.figureStart
            composition.focusStrand = strandIndex
            composition.focusUntil = strand.figureStart + articulation + breathingRoom
            if (wait > 0) continue
          }
        }
      }
      if (strand.active) {
        const motifIndex = (strand.position + strandIndex) % strand.figureMotif.length
        let midi = scaleNote(strand.degree + (strandIndex === 0 ? 14 : 7) + strand.figureMotif[motifIndex])
        while (midi > 85) midi -= 12
        while (midi < 57) midi += 12
        if (Math.abs(midi - strand.lastMidi) > 8) {
          const alternative = midi + (midi > strand.lastMidi ? -12 : 12)
          if (alternative >= 57 && alternative <= 85) midi = alternative
        }
        const amplitude = strand.figureLevel * (strand.position === 0 ? 1 : .72 + random() * .2)
        putNote(details, midi, strand.next, palette.noteLength * (.82 + random() * .32),
          amplitude, strand.figureSpectral, strand.figurePan)
        strand.lastMidi = midi
      }
      strand.position++
      if (strand.position >= strand.count) {
        strand.next = strand.origin + strand.figureCycle
        strand.position = 0; strand.turns++; strand.prepared = false
      } else {
        strand.next = strand.figureStart + figureOffset(strand, strand.position)
      }
    }
  }

  function scheduleTo(target: number) {
    while (scoreTime < target) {
      const checkpoint: ScoreCheckpoint = { time: scoreTime, randomState: random.getState(), composition: copyComposition(composition) }
      if (composition.chapter.remaining <= 0) nextChapter()
      const chapter = composition.chapter
      const duration = (25 + (1 - value.movement) * 46) * (.84 + random() * .3) * (chapter.kind === 2 ? 1.13 : 1)
      if (composition.phrase > 0) {
        if (composition.dwell > 0) composition.dwell--
        else {
          const options = progressions[composition.degree]
          composition.degree = options[Math.floor(random() * options.length)]
          composition.dwell = Math.floor(random() * (1 + (1 - value.movement) * 2.6))
        }
      }
      checkpoints.push(checkpoint)
      const chordDegree = composition.degree
      const count = 2 + Math.round(value.density * 2)
      const chord = leadVoicing(chordDegree, count)
      const padRest = chapter.kind === 2 && composition.phrase % 2 === 1
      if (!padRest) {
        chord.forEach((midi, index) => {
          // A shared pitch already living through most of the next phrase is
          // retained. New harmony arrives around it instead of rearticulating
          // every voice together at a chord boundary.
          const held = pads.some((voice) => voice.events.some((event) =>
            event.midi === midi && event.start <= scoreTime && event.end > scoreTime + duration * .68))
          if (held) return
          const entry = composition.phrase === 0 ? random() * .7 : 1.3 + index * 1.6 + random() * 2.4
          // Eight pad slots support two four-note generations. Retire this
          // generation before the earliest possible start of the third, even
          // at high movement, so long releases cannot starve the next chord.
          const earliestNextDuration = (25 + (1 - value.movement) * 46) * .84
          const length = Math.min(duration * (2.03 + random() * .27), duration + earliestNextDuration - entry - .1)
          putNote(pads, midi, scoreTime + entry, length,
            .088 * Math.sqrt(3 / count) * (.85 + random() * .22), chapter.spectral * (1 - index * .045))
        })
      }
      composition.voicing = chord

      // The foundation can hold a tonic pedal beneath moving chords. Its slow
      // notes and occasional fifth are independent of the pad phrase attacks.
      let bass = scaleNote(chapter.kind === 2 || (composition.phrase % 3 === 0 && chapter.kind !== 1) ? 0 : chordDegree)
      while (bass > 52) bass -= 12
      while (bass < 34) bass += 12
      if (Math.abs(bass - composition.lastBass) > 7 && bass - 12 >= 34) bass -= 12
      putNote(beds, bass, scoreTime, duration * 1.28, .17, .7)
      if (chapter.kind === 1 || (composition.phrase % 2 === 0 && value.density > .5)) {
        putNote(beds, Math.min(67, bass + 19), scoreTime + duration * .43, duration * .62, .035, .8)
      }
      composition.lastBass = bass

      scheduleStrands(scoreTime + duration, chordDegree)
      if (composition.phrase === 0 || random() < chapter.texture) {
        const tone = chord[Math.floor(random() * chord.length)] ?? root + 24
        putNote(textures, tone, scoreTime + (composition.phrase === 0 ? .3 : 2 + random() * 8),
          duration * (.8 + random() * .35), palette.air * (.75 + random() * .4), chapter.spectral)
      }
      scoreTime += duration
      composition.phrase++; composition.chapter.remaining--
    }
    const before = context.currentTime - 1
    for (const voice of voices) voice.events = voice.events.filter((event) => event.end > before)
    let lastPast = -1
    for (let index = 0; index < checkpoints.length; index++) if (checkpoints[index].time <= before) lastPast = index
    if (lastPast > 0) checkpoints = checkpoints.slice(lastPast)
  }

  const offline = typeof (context as OfflineAudioContext).startRendering === 'function'
  const horizon = () => offline ? (context as OfflineAudioContext).length / context.sampleRate + 2 : context.currentTime + LOOKAHEAD_SECONDS

  function holdCurve(param: AudioParam, curve: AutomationCurve | undefined, boundary: number) {
    // These curves are entirely ours and piecewise linear. Restoring their
    // original endpoints preserves the slope through a future boundary without
    // creating synthetic hold points. Repeated native cancelAndHoldAtTime calls
    // at that same future boundary can otherwise flatten a still-ringing note.
    param.cancelScheduledValues(boundary)
    if (curve) for (const point of curve.points) if (point.time >= boundary) param.linearRampToValueAtTime(point.value, point.time)
  }

  function replan() {
    // Restore the already planned next phrase's complete checkpoint, never the
    // beginning of the seed. Existing amplitude AND spectral contours continue.
    const checkpoint = checkpoints.find((item) => item.time > context.currentTime + 2) ?? {
      time: scoreTime, randomState: random.getState(), composition: copyComposition(composition),
    }
    const boundary = checkpoint.time
    for (const voice of voices) {
      const active = voice.events.find((event) => event.start < boundary && event.end > boundary)
      for (const param of [voice.envelope.gain, ...voice.colors.map((color) => color.param)]) {
        holdCurve(param, active?.curves.find((curve) => curve.param === param), boundary)
      }
      for (const tuning of voice.tuning) tuning.param.cancelScheduledValues(boundary)
      voice.pan.pan.cancelScheduledValues(boundary)
      if (!active) voice.envelope.gain.setValueAtTime(0, boundary)
      voice.events = voice.events.filter((event) => event.start < boundary)
      voice.available = active ? active.end + .04 : boundary
    }
    composition = copyComposition(checkpoint.composition)
    checkpoints = checkpoints.filter((item) => item.time < boundary)
    random = seededRandom(checkpoint.randomState)
    scoreTime = boundary
    scheduleTo(horizon())
  }

  const rhythm = createRhythm(context, value, pulseBus, mix, musicalSeed, root)
  const parameterTargets = new Map<AudioParam, number>()
  function apply(next: SoundSettings, initial = false) {
    const previous = value; value = sanitize(next)
    rhythm.update(value)
    const time = context.currentTime
    const change = (param: AudioParam, target: number, duration = 1.2) => {
      // A different slider must not restart this parameter's existing ramp.
      if (parameterTargets.get(param) === target) return
      parameterTargets.set(param, target)
      if (initial) param.setValueAtTime(target, time); else ramp(param, target, time, duration)
    }
    const cutoff = (560 + (1 - value.darkness) ** 1.6 * 4400 - value.warmth * 180) * palette.brightness
    change(lowpass.frequency, cutoff)
    change(roomTone.frequency, cutoff)
    change(body.gain, -.5 + value.warmth * 3.4)
    change(roomBody.gain, -.5 + value.warmth * 3.4)
    change(wetLowpass.frequency, 1500 + (1 - value.darkness) * 2600)
    // Space changes how new sound enters the room. Fixed returns, feedback and
    // dry level leave already-ringing tails and the musical anchor untouched.
    change(reverbSend.gain, .045 + value.space ** 1.35 * .78)
    change(echoSend.gain, .02 + value.space ** 1.4 * .55)
    change(filterMovement.gain, 20 + value.movement * 330); change(panMovement.gain, value.movement * .12)
    change(slowDrift.gain, .25 + value.drift * 6); change(tapeWow.gain, value.drift ** 1.5 * palette.wow * 4)
    for (const depth of timbreDepths) change(depth.node.gain, depth.maximum * (.3 + value.movement * .7))
    change(layerBus.bed.gain, value.bedLevel); change(layerBus.pad.gain, value.padLevel)
    change(layerBus.detail.gain, value.detailLevel); change(layerBus.texture.gain, value.textureLevel)
    change(rainLevel.gain, value.rain ** 1.2 * (environment === 'city' ? .56 : .48))
    const level = value.volume ** 1.5 * .9
    if (initial) {
      parameterTargets.set(output.gain, level)
      output.gain.linearRampToValueAtTime(level, time + 1.4)
    } else change(output.gain, level, .3)
    if (!initial && (Math.abs(previous.density - value.density) > .003 ||
      Math.abs(previous.movement - value.movement) > .003 || Math.abs(previous.tension - value.tension) > .003)) replan()
  }

  apply(value, true); scheduleTo(horizon())
  if (!offline) refill = setInterval(() => { if (!stopped) scheduleTo(horizon()) }, 20_000)
  return {
    update(next) { if (!stopped) apply(next) },
    setAtmosphere(next) { if (!stopped) { environment = next; apply(value) } },
    stop() {
      if (stopped) return
      stopped = true
      if (refill !== undefined) clearInterval(refill)
      rhythm.stop()
      output.gain.cancelScheduledValues(context.currentTime); output.gain.setValueAtTime(0, context.currentTime)
      for (const source of sources) { try { source.stop() } catch { /* Already stopped. */ } }
      for (const node of nodes) node.disconnect()
      sources.length = 0; nodes.length = 0
      for (const voice of voices) voice.events.length = 0
      checkpoints.length = 0
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
