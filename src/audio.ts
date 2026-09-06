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
  bedLevel: number
  padLevel: number
  detailLevel: number
  textureLevel: number
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
  pad: 'subtractive' | 'bowed' | 'organ' | 'fm'
  detail: 'fm' | 'electric' | 'pluck' | 'bowed'
  ratio: number
  index: number
  motif: number[]
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
interface NoteEvent { start: number; end: number; curves: AutomationCurve[] }
type Layer = 'bed' | 'pad' | 'detail' | 'texture'
interface Voice {
  layer: Layer
  tuning: { param: AudioParam; ratio: number }[]
  envelope: GainNode
  pan: StereoPannerNode
  colors: { param: AudioParam; kind: 'filter' | 'fm'; amount: number }[]
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
interface Composition {
  degree: number
  phrase: number
  chapter: Chapter
  voicing: number[]
  motif: number[]
  lastBass: number
  lastDetail: number
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
    degree: 0, phrase: 0,
    chapter: { kind: 0, remaining: 3 + Math.floor(characterRandom() * 2), register: 0, spectral: .9, details: .95, texture: .75 },
    voicing: [], motif: [...originalMotif], lastBass: root, lastDetail: root + 24,
  }
  const copyComposition = (state: Composition): Composition => ({
    ...state, chapter: { ...state.chapter }, voicing: [...state.voicing], motif: [...state.motif],
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
  const lowpass = filter('lowpass', 2200)
  const body = filter('lowshelf', 280)
  const dry = gain(.94)
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
  body.connect(reverbSend).connect(reverb).connect(wetHighpass).connect(wetLowpass).connect(wet).connect(mix)
  // Echo comes primarily from articulated voices, preserving foundation clarity.
  layerBus.detail.connect(echoSend).connect(delay).connect(echoFilter).connect(echo).connect(mix)
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

  // A quiet, modulated stereo early-reflection path enriches bowed/subtractive
  // pads without adding more unison oscillators to each note.
  const chorusAmount = gain(palette.pad === 'bowed' ? .25 : palette.pad === 'subtractive' ? .15 : .06)
  for (const side of [-1, 1]) {
    const chorusDelay = keep(context.createDelay(.1)); chorusDelay.delayTime.value = .019 + side * .003
    const chorusMod = gain(.0018)
    lfo(side < 0 ? .1137 : .1571, characterRandom() * TAU).connect(chorusMod).connect(chorusDelay.delayTime)
    const chorusPan = keep(context.createStereoPanner()); chorusPan.pan.value = side * .72
    layerBus.pad.connect(chorusDelay).connect(chorusPan).connect(chorusAmount)
  }
  chorusAmount.connect(music)

  const harmonics = new Float32Array([0, ...palette.partials.map((partial) => partial * (.85 + characterRandom() * .3))])
  const padWave = context.createPeriodicWave(new Float32Array(harmonics.length), harmonics)
  const roundWave = context.createPeriodicWave(new Float32Array(6), new Float32Array([0,1,.09,.055,.014,.005]))
  const bassWave = context.createPeriodicWave(new Float32Array(5), new Float32Array([0,1,.12,.04,.009]))
  const noise = keep(context.createBufferSource()); noise.buffer = scene.rain; noise.loop = true; start(noise)
  const grainOne = lfo(.4731, characterRandom() * TAU)
  const grainTwo = lfo(.7193, characterRandom() * TAU)

  function makeVoice(layer: Layer): Voice {
    const envelope = gain(0)
    const pan = keep(context.createStereoPanner())
    envelope.connect(pan).connect(layerBus[layer])
    if (layer !== 'bed') panMovement.connect(pan.pan)
    const voice: Voice = { layer, envelope, pan, tuning: [], colors: [], events: [], available: startedAt }
    if (layer === 'texture') {
      // Windowed resonant-noise bands create a pitched spectral cloud. The
      // overlapping, unrelated grain rates avoid a fixed tremolo or noise loop.
      const grain = gain(.64)
      const grainDepthA = gain(.2), grainDepthB = gain(.15)
      grainOne.connect(grainDepthA).connect(grain.gain)
      grainTwo.connect(grainDepthB).connect(grain.gain)
      for (const [ratio, level] of [[1,1], [2.003,.38], [3.997,.15]]) {
        const band = filter('bandpass', 440 * ratio, 12 + characterRandom() * 12)
        const bandLevel = gain(level)
        noise.connect(band).connect(bandLevel).connect(grain)
        voice.tuning.push({ param: band.frequency, ratio })
        slowDrift.connect(band.detune)
      }
      grain.connect(envelope)
      return voice
    }

    const isDetail = layer === 'detail'
    const fm = isDetail ? palette.detail === 'fm' || palette.detail === 'electric' : layer === 'pad' && palette.pad === 'fm'
    const tone = filter('lowpass', 4000, layer === 'pad' && palette.pad === 'subtractive' ? .65 : .45)
    tone.connect(envelope)
    if (fm) {
      const carrier = keep(context.createOscillator()), modulator = keep(context.createOscillator())
      carrier.type = 'sine'; modulator.type = 'sine'
      const index = gain(0)
      modulator.connect(index).connect(carrier.frequency)
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
        const wave = layer === 'bed' ? bassWave : (isDetail && palette.detail !== 'bowed' ? roundWave : padWave)
        if (layer === 'bed' && layerIndex === 0) oscillator.type = 'sine'
        else oscillator.setPeriodicWave(wave)
        oscillator.detune.value = (layerIndex === 0 ? -1 : 1) * (.5 + characterRandom() * (palette.pad === 'bowed' ? 3 : 1.5))
        const level = gain(layer === 'bed' ? (layerIndex === 0 ? .8 : .2) : .5)
        oscillator.connect(level).connect(tone)
        voice.tuning.push({ param: oscillator.frequency, ratio: 1 })
        slowDrift.connect(oscillator.detune); tapeWow.connect(oscillator.detune); start(oscillator)
      }
      voice.colors.push({ param: tone.frequency, kind: 'filter', amount: layer === 'bed' ? 3 : palette.pad === 'organ' ? 7 : 4.8 })
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

  function putNote(pool: Voice[], midi: number, time: number, length: number, amplitude: number, spectral = 1) {
    const voice = pool.find((candidate) => candidate.available <= time + .001)
    if (!voice) return
    const keyed = voice.layer === 'detail'
    const texture = voice.layer === 'texture'
    const first = composition.phrase === 0
    const attack = keyed ? Math.min(length * .3, palette.noteAttack * (.85 + random() * .3))
      : Math.min(length * .27, (first ? (texture ? 3.5 : 2.4) : texture ? 8 : voice.layer === 'bed' ? 5 : palette.attack) * (.85 + random() * .3))
    const end = time + length
    const points: EnvelopePoint[] = keyed ? [
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
    voice.pan.pan.setValueAtTime((random() * 2 - 1) * spread, time)
    for (const color of voice.colors) {
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
    voice.events.push({ start: time, end, curves }); voice.available = end + .04
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
  function scheduleTo(target: number) {
    while (scoreTime < target) {
      const checkpoint: ScoreCheckpoint = { time: scoreTime, randomState: random.getState(), composition: copyComposition(composition) }
      if (composition.chapter.remaining <= 0) nextChapter()
      const chapter = composition.chapter
      const duration = (25 + (1 - value.movement) * 46) * (.84 + random() * .3) * (chapter.kind === 2 ? 1.13 : 1)
      if (composition.phrase > 0) {
        const options = progressions[composition.degree]
        composition.degree = chapter.remaining === 1 && chapter.kind !== 1 ? 0 : options[Math.floor(random() * options.length)]
      }
      checkpoints.push(checkpoint)
      const chordDegree = composition.degree
      const count = 2 + Math.round(value.density * 2)
      const chord = leadVoicing(chordDegree, count)
      const padRest = chapter.kind === 2 && composition.phrase % 2 === 1
      if (!padRest) {
        chord.forEach((midi, index) => putNote(pads, midi, scoreTime + random() * .7,
          duration + Math.min(11, duration * .28), .096 * Math.sqrt(3 / count) * (.85 + random() * .22),
          chapter.spectral * (1 - index * .045)))
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

      // A small motif returns with altered spacing, register and ending. The
      // space after each figure is intentional, instead of a constant note rain.
      if (value.density > .035 && (composition.phrase === 0 || random() < chapter.details * (.5 + value.density * .5))) {
        const noteCount = Math.min(composition.motif.length, 2 + Math.round(value.density * 2))
        const spacing = (1.9 + (1 - value.movement) * 2.1) * (.88 + random() * .25)
        const startTime = scoreTime + (composition.phrase === 0 ? 2.2 : 4 + random() * 7)
        for (let index = 0; index < noteCount; index++) {
          let midi = scaleNote(chordDegree + 14 + composition.motif[index])
          while (midi > 85) midi -= 12
          while (midi < 58) midi += 12
          if (Math.abs(midi - composition.lastDetail) > 8) {
            const alternative = midi + (midi > composition.lastDetail ? -12 : 12)
            if (alternative >= 57 && alternative <= 85) midi = alternative
          }
          const noteTime = startTime + index * spacing * (.94 + random() * .12)
          putNote(details, midi, noteTime, palette.noteLength * (.78 + random() * .4),
            (.062 + value.density * .03) * (index === 0 ? 1 : .72 + random() * .2), chapter.spectral)
          composition.lastDetail = midi
        }
        if (value.density > .35 && chapter.kind !== 2 && random() < .65) {
          const reply = scaleNote(chordDegree + (chapter.kind === 1 ? 18 : 16))
          putNote(details, Math.min(85, reply), scoreTime + duration * .68, palette.noteLength * 1.15, .039, chapter.spectral * .7)
        }
      }
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
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(boundary)
    else {
      param.cancelScheduledValues(boundary)
      if (curve) {
        for (let index = 1; index < curve.points.length; index++) {
          const left = curve.points[index - 1], right = curve.points[index]
          if (left.time <= boundary && right.time >= boundary) {
            const position = (boundary - left.time) / (right.time - left.time)
            param.linearRampToValueAtTime(left.value + (right.value - left.value) * position, boundary)
            break
          }
        }
      }
    }
    if (curve) for (const point of curve.points) if (point.time > boundary) param.linearRampToValueAtTime(point.value, point.time)
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

  const parameterTargets = new Map<AudioParam, number>()
  function apply(next: SoundSettings, initial = false) {
    const previous = value; value = sanitize(next)
    const time = context.currentTime
    const change = (param: AudioParam, target: number, duration = 1.2) => {
      // A different slider must not restart this parameter's existing ramp.
      if (parameterTargets.get(param) === target) return
      parameterTargets.set(param, target)
      if (initial) param.setValueAtTime(target, time); else ramp(param, target, time, duration)
    }
    change(lowpass.frequency, (560 + (1 - value.darkness) ** 1.6 * 4400 - value.warmth * 180) * palette.brightness)
    change(body.gain, -.5 + value.warmth * 3.4)
    change(wetLowpass.frequency, 1500 + (1 - value.darkness) * 2600)
    // Space changes how new sound enters the room. Fixed returns, feedback and
    // dry level leave already-ringing tails and the musical anchor untouched.
    change(reverbSend.gain, .045 + value.space ** 1.35 * .78)
    change(echoSend.gain, .02 + value.space ** 1.4 * .55)
    change(filterMovement.gain, 20 + value.movement * 330); change(panMovement.gain, value.movement * .12)
    change(slowDrift.gain, .25 + value.drift * 6); change(tapeWow.gain, value.drift ** 1.5 * palette.wow * 4)
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
