# Spatial depth and spectral decay

Research and engine audit: 7 September 2026. This extends the earlier [ambient composition](./ambient-research.md) and [rhythm/headphone](./rhythm-spatial-research.md) notes. The purpose is an audible sense of place with a clear musical foreground. The values below are our authored choices to audition; they are not a reconstruction of an Eno recording or a physically measured room.

## What the primary technical sources establish

Julius O. Smith distinguishes sparse early reflections from the dense late field. Early arrivals contribute to the perceived shape of a space; their timing, filtering and direction matter. The early and late sections can overlap while the late section gains density. [Smith, *Physical Audio Signal Processing*: Early Reflections, CCRMA](https://ccrma.stanford.edu/~jos/pasp/Early_Reflections.html).

Smith describes useful late reverberation as dense enough to avoid obvious flutter, with irregularity that does not become a repeating pattern. Decaying colored noise is a useful construction, especially when upper frequencies disappear faster than lower frequencies. A static lowpass on the return does not itself provide that evolution through the tail. [Smith: Desired Qualities in Late Reverberation, full book text hosted by DSPRelated](https://www.dsprelated.com/freebooks/pasp/Desired_Qualities_Late_Reverberation.html).

The Web Audio specification defines convolution as a linear effect with a finite response tail. It also specifies RMS-based normalization, enabled by default. Changing an active convolver's buffer may glitch; two convolvers with a crossfade are the recommended alternative when an actual buffer change is necessary. [W3C Web Audio: ConvolverNode](https://www.w3.org/TR/webaudio-1.0/#ConvolverNode).

Modulated delay is also pitch modulation: Smith derives the output frequency's dependence on how fast the delay changes. More stereo motion therefore has a timbral cost, especially on clean pitched tones. [Smith: Doppler Simulation](https://www.dsprelated.com/freebooks/pasp/Doppler_Simulation.html).

## Audit of the starting room

The engine already used a single cached stereo convolution buffer, 5.7 seconds long. Its noise was lowpass-colored, then multiplied by one exponential envelope. The diffuse onset grew between 25 and 115 ms. A highpass protected the low foundation, a further lowpass darkened the return, and an independent filtered echo primarily served Details.

Space already changed only reverb and echo inputs. Dry gain, effect return gains and delay feedback were fixed. The existing parameter-target map prevented no-op settings updates from scheduling fresh ramps. Those are important continuity properties to preserve.

The most useful missing distinctions were identifiable early arrivals and a change in the tail's spectral balance over its lifetime. Extending the tail or turning it up would not create either distinction.

## Implemented room response

`src/room.ts` exports `createRoomImpulse(context)`. The caller retains the cache and existing convolver; the new construction adds no audio nodes or live JavaScript scheduling.

### 1. Let the room become darker as it fades

The late field uses deterministic noise, separated into overlapping low, middle and high components using four cascaded one-pole filters at 700 and 3400 Hz. These are inexpensive construction-time filters. The components receive separate amplitude envelopes:

```text
amplitude(age, T60) = exp(-ln(1000) * age / T60)

low component:     T60 = 5.20 seconds
middle component:  T60 = 4.10 seconds
high component:    T60 = 2.15 seconds
```

These are component decay targets, not claims that every frequency measures exactly that reverberation time; the bands overlap. Middle and high components are quieter than the low component. A 36 ms delay precedes the diffuse onset, followed by a smooth 95 ms rise. Sparse excitation becomes dense over 150 ms, with energy compensation so density does not itself cause a large swell. The final 80 ms fades to zero within the existing 5.7-second buffer.

The intended effect is an initially legible response that settles into a softer body. The fixed return filters remain useful for overall tone and bass clarity. They serve a different purpose from frequency-dependent decay.

### 2. Give articulated sounds a small, asymmetric early space

Each channel contains six short filtered reflection packets. Left arrivals span 19–127 ms, right arrivals 21.3–131.9 ms; their timings and relative strengths differ. Their nominal energy budget is 4.5% of the diffuse field's energy, before small overlap interactions. There is no zero-time direct impulse because the existing dry path already supplies that sound.

This should be especially audible around keys, plucks and rhythmic replies, while long pad attacks blend the reflections into the field. The packets are contained in the same buffer, so Space continues to act on new input and cannot turn up an already-decaying reflection.

```text
musical room feed -> Space send -> existing ConvolverNode
                                     | immutable stereo response
                                     | early packets + darkening late field
                                     v
                              existing HP / LP -> fixed return -> mix

dry music ------------------------------------------------------> mix
headphone tone pair: separate L/R routing ----------------------> mix
```

## Boundaries and calibration

- Keep the response immutable during playback. Space, Darkness, Movement and atmosphere edits do not regenerate it. Preserve the target-map/no-op behavior.
- Keep the headphone pair outside convolution, chorus, panners and crossfeed. The room's stereo asymmetry belongs to the musical effects path.
- Retain the existing bounded chorus. Its unequal rates already provide motion; adding strong modulation to the whole room would also bend pitch.
- Retain default convolver normalization. Uniformly scaling the whole buffer is mostly canceled by that normalization; tune spectral and early/late proportions. Compare musical examples at matched playback level. A different response can change perceived loudness even when integrated impulse energy is normalized.
- The module has its own random streams. Room construction does not consume the musical or weather generators. The caller advances the weather generator by the original impulse's draw count, preserving the prior rain and patter sequence.
- A feedback-delay-network reverb could be a future sound-design direction, but would introduce a new stability, modulation and CPU budget. The current convolution path can deliver this iteration's missing cues with unchanged playback cost.

## Verification and listening

`tests/room.spec.ts` renders a real impulse through the default-normalized convolver at 24, 44.1 and 48 kHz. It checks repeatability, finite samples, bounded peaks, silence before arrival, useful early and late energy, decreasing late-window energy, faster loss in the high-frequency analysis band, stereo differences, a usable mono fold, and a silent end. This test passed locally on 7 September 2026.

Full-engine verification covers headroom, Space-tail continuity, no-op updates, cleanup and headphone separation after integration. Musical listening should compare Details alone, a sustained pad, and a pulse at the same level. Listen for a clearer sense of distance, a tail that softens instead of hissing, and enough dry articulation to preserve bounce. Avoid interpreting a brighter or louder first impression as proof of a better room.
