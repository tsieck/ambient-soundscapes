const ROOM_SECONDS = 5.7
const LN_1000 = Math.log(1000)

function randomFrom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * One immutable stereo room: local reflections give articulated notes a place,
 * then a dense field loses its upper frequencies before its low body fades.
 * All shaping happens once; playback still uses the existing single convolver.
 * Values are authored listening choices, documented in spatial-depth-research.
 */
export function createRoomImpulse(context: BaseAudioContext): AudioBuffer {
  const rate = context.sampleRate
  const impulse = context.createBuffer(2, Math.ceil(rate * ROOM_SECONDS), rate)
  const lowCoefficient = 1 - Math.exp(-2 * Math.PI * 700 / rate)
  const wideCoefficient = 1 - Math.exp(-2 * Math.PI * 3400 / rate)
  for (let channel = 0; channel < 2; channel++) {
    // Dedicated randomness keeps changes to the room independent of weather
    // buffers, the composition, and the other stereo channel.
    const random = randomFrom(48371 + channel * 9719)
    const response = impulse.getChannelData(channel)
    const low = [0, 0, 0, 0], wide = [0, 0, 0, 0]
    let tailEnergy = 0
    for (let sample = 0; sample < response.length; sample++) {
      const time = sample / rate
      const age = Math.max(0, time - .036)
      const build = Math.min(1, age / .15)
      // Sparse excitation becomes sample-dense; energy compensation prevents
      // density alone from creating a large late swell.
      const probability = Math.min(1, (1200 + build * build * rate) / rate)
      const white = (random() * 2 - 1) * (random() < probability ? 1 / Math.sqrt(probability) : 0)
      let lowInput = white, wideInput = white
      for (let stage = 0; stage < 4; stage++) {
        low[stage] += lowCoefficient * (lowInput - low[stage])
        wide[stage] += wideCoefficient * (wideInput - wide[stage])
        lowInput = low[stage]; wideInput = wide[stage]
      }
      const onset = Math.sin(Math.min(1, age / .095) * Math.PI / 2) ** 2
      const ending = Math.min(1, (response.length - 1 - sample) / (rate * .08))
      const body = lowInput * Math.exp(-LN_1000 * age / 5.2)
      const middle = (wideInput - lowInput) * .62 * Math.exp(-LN_1000 * age / 4.1)
      const air = (white - wideInput) * .13 * Math.exp(-LN_1000 * age / 2.15)
      response[sample] = (body + middle + air) * onset * ending * ending
      tailEnergy += response[sample] ** 2
    }

    // These short filtered packets share only 4.5% of the late field's energy.
    // Unequal arrival times avoid a regular flutter; no direct impulse is added.
    const reflectionTimes = channel === 0
      ? [.019, .033, .052, .073, .101, .127]
      : [.0213, .0307, .0551, .0777, .0983, .1319]
    const weights = [1, -.82, .67, .53, -.41, .3]
    const packet = new Float32Array(Math.ceil(rate * .0025))
    let packetEnergy = 0
    for (let sample = 0; sample < packet.length; sample++) {
      packet[sample] = Math.exp(-sample / (rate * .00023))
      packetEnergy += packet[sample] ** 2
    }
    const weightEnergy = weights.reduce((sum, weight) => sum + weight * weight, 0)
    const reflectionScale = Math.sqrt(tailEnergy * .045 / (packetEnergy * weightEnergy))
    reflectionTimes.forEach((time, index) => {
      const offset = Math.round(time * rate)
      for (let sample = 0; sample < packet.length; sample++) {
        response[offset + sample] += packet[sample] * weights[index] * reflectionScale
      }
    })
  }
  return impulse
}
