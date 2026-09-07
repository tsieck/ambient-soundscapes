# Cinematic presets: expressive brass and distant water

Research date: 7 September 2026. The listening brief is a cinematic companion to Distant tide: the warmth, melancholy, and scale associated with Vangelis's *Blade Runner* score, expressed through original generated music. These sources inform tone design; they do not prescribe our notes or claim that a particular patch recreates the soundtrack.

## Five useful observations

### Expression belongs inside the sustained note

In a 2020 interview, Vangelis emphasizes the CS-80's playability and the need to learn it seriously as an instrument. His explanation connects its value to expression, rather than a single preset. This is first-person testimony about his practice. [Vangelis, interviewed by Marc Hairapetian and Rob Waters, *Sound On Sound*, June 2020](https://www.soundonsound.com/people/vangelis).

**Our adaptation:** Let a brass chord develop after its entrance. Preserve Stillroom's independent slow color motion for each pad voice, giving held notes a pressure-like change of brightness. This is generated expression, not a simulation of his playing technique. Keep pitch motion restrained enough that the harmony remains clear.

### The attack, peak, and held color can differ

Yamaha describes its IL–AL envelope design as independently shaping the initial and attack-peak tone relative to the held filter setting. Its history also identifies pressure sensing on individual sustained keys as a CS-80 feature. These are useful mechanisms for shaping a note through time. [Yamaha, *Origins of the Yamaha Synthesizer*](https://usa.yamaha.com/products/contents/music_production/synth_50th/history/chapter001.html).

**Our adaptation:** A mellow entrance opens into a brighter brass bloom, then settles into a softer sustained color. Amplitude and brightness should follow related but distinct contours, so a sound can grow more vivid without simply becoming much louder. All added filter curves must survive changes to Movement, Density, and Harmony while a note is sounding.

### Body and brilliance can be sculpted separately

Yamaha's engineering account explicitly describes the original CS-80's high-pass filter followed by a low-pass filter, and a shared envelope controlling the filter pair. It also describes the ability to mix a sine component with filtered sound. [Yamaha, *Deep Dive into the Soul of the AN-X*, “A Synth Engine that Captures the CS-80 Spirit”](https://au.yamaha.com/en/musical-instruments/keyboards/explore/montage-portal/essentials/an-x.html).

**Our adaptation:** Add a high-pass stage to the new brass pads before their existing low-pass stage. Moderate, coordinated sweeps can change the body of the tone while the upper harmonics open. Leave the separate low foundation intact. This uses native Web Audio filters; it is an original voice architecture, not a circuit model or an emulation of AN-X.

### Richness can come from contrasting tone layers

Yamaha's museum description identifies two mixable tone generators in the CS-80. That establishes layering as part of the instrument's design, without implying that any arbitrary pair of oscillators reproduces it. [Yamaha Innovation Road, *CS-80*](https://www.yamaha.com/en/about/experience/innovation-road/collection/detail/2039/).

**Our adaptation:** Use Stillroom's existing pair of oscillators per pitched voice, with a rich harmonic spectrum and a contrasting darker spectrum. Gentle detuning and slow changes in their balance provide breadth within the existing finite voice pool. The sound should retain its character in mono; width alone should not carry the preset.

### Small metallic gestures can complement a broad pad

Sound designer Allert Aalders describes using the CS-80 V ring modulator for subtle tremolo or stronger metallic color. This is a first-person account of a modern software instrument, not documentation of a historical soundtrack patch. [Arturia, *The art of sound design*, “Ascend To Five”](https://www.arturia.com/products/software-instruments/cs-80v/sound-design).

**Our adaptation:** Keep metallic detail in a separate, sparse role. Neon skyline uses the engine's existing FM bell architecture against a broad brass field. FM is our chosen mechanism; the source does not establish FM bells as the soundtrack's recipe. Existing melodic rests and stable strand positions help each gesture remain audible through the room.

## Three listening directions

- **Neon skyline:** Dark modal harmony, slow brass blooms, deep foundation, and isolated glassy bells. The principal cinematic preset.
- **Midnight sea:** A close relative of Distant tide, using deep bowed swells and sparse round plucks, with more empty space between gestures.
- **Last light:** Warmer brass harmony and soft electric keys, giving the same expressive architecture a gentler, dusk-like character.

The harmonic choices, voicings, timings, and balances are authored for Stillroom. The presets use no soundtrack recordings or transcribed melodies. Existing Space routing remains unchanged: new sound enters the room more or less strongly, while effect returns stay fixed. Pulse and headphone beats remain optional.

Audition at matched volume, including dry and mono listening. Reject a patch that depends on excessive reverb, obscures its low anchor, becomes harsh at high Density, or interrupts an existing note when controls change. Distant tide and saved seeds should retain their established behavior.
