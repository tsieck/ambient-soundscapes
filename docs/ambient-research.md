# Ambient composition research

Research date: 7 September 2026. Scope: a browser instrument for listeners who enjoy Brian Eno, with an optional rhythmic mode. The recommendations below are our compositional choices informed by the sources, not a recipe attributed to Eno or a claim to reproduce his recordings.

## What the primary sources establish

### Attention can change without breaking the experience

Eno's 1978 *Music for Airports* notes describe music that accommodates different degrees of attention and retains uncertainty. Calm does not require eliminating musical interest. The practical target is something that remains rewarding when attended to, yet does not repeatedly demand that the listener follow a climax. [Eno's original liner-note text, reproduced in a source compilation, page 1](https://static1.squarespace.com/static/5d4dcd89a70bc90001638861/t/5d9ca5a21e81bb3340e041d3/1570547107101/eno-ambient.pdf).

### The space is part of the composition

In the 1986 *On Land* notes, Eno describes inventing acoustic spaces, allowing sounds to exist separately, and softening the distinction between foreground and background. He also describes using found sound and manipulating it freely. These are creative intentions, not a requirement that an ambient engine contain recordings or a particular synthesizer. [Eno's original liner-note text, reproduced in the same compilation, pages 2–3](https://static1.squarespace.com/static/5d4dcd89a70bc90001638861/t/5d9ca5a21e81bb3340e041d3/1570547107101/eno-ambient.pdf).

### Generative music needs authored ingredients

In a direct *Tape Op* interview, Eno describes layering recordings played at different speeds, building systems that produce music, and installations whose shuffled material had been chosen to work together. Changing combinations are therefore not the same as indiscriminate random note selection. The musical identity resides partly in the selected material and its relationships. He also welcomes the later combination of ambient ideas with techno, even though the result differs from his initial floating conception. [Brian Eno interview, *Tape Op* 85](https://tapeop.com/interviews/85/brian-eno).

### Individual parts can respond to one another

The official *Scape* page describes Eno and Peter Chilvers recombining authored sounds, processes, and rules. Its elements react to one another and change their mood together. This supports a useful distinction: a palette supplies the musical vocabulary, while an arrangement system controls interaction and restraint. [Eno and Chilvers, *Scape*](https://www.generativemusic.com/scape.html).

### Less activity can make the system more expressive

In their direct 2012 interview, Eno and Chilvers describe compatible elements with ambiguous tonal relationships. Chilvers gives the example of one element becoming quiet after other elements sound. They discuss deliberately limiting options and helping people use fewer notes. [Eno and Chilvers interview, *WIRED*](https://www.wired.com/story/brian-eno-peter-chilvers-scape/).

### Endlessness should preserve a recognizable identity

Eno's statement on the official *Reflection* page distinguishes an indefinitely changing process from a recording of one part of that process. His recurring-river analogy describes recognizable continuity within change. [Eno, *Reflection*](https://www.generativemusic.com/reflection.html).

## Reading the existing engine

The starting `src/audio.ts` already contained a substantial musical foundation: ten timbral palettes, seed-specific modes and roots, voice leading, small recurring motifs, slow chapters, independent layer levels, and intentionally quiet sections. It also used finite voice pools and preserved scheduled phrases through control edits. Those are assets to preserve.

The main musical constraint was synchronization. Bass, the chord decision, pad attacks, a short foreground figure, and texture were all initiated by the same phrase loop. Chords changed on almost every phrase and usually returned to the tonic at a chapter boundary. That can make a long ambient passage feel like a very slow sequence of chord blocks, even with smooth envelopes. Merely adding more reverb, notes, or random modulation would leave that structural issue intact.

## Composition decisions for this iteration

The values below are engineering and musical judgments to audition, not values specified by the sources.

| Decision | Intended listening effect | Implementation direction |
| --- | --- | --- |
| Harmonic dwelling | Let a place become familiar before it changes | Hold a degree for several planning phrases at low movement; allow more movement when requested. Remove mandatory chapter-end tonic returns. |
| Common tones across boundaries | Harmony emerges instead of being announced | Give pad voices overlapping, unequal lifetimes; keep an already-ringing shared pitch instead of reattacking it. Stagger later arrivals. |
| Independent melodic strands | Recurrence remains recognizable while combinations change | Keep two seed-specific cycle lengths, phrase shapes, and next-event cursors. A planning boundary must not reset a strand's phase. |
| Deliberate omissions | Audible space becomes part of the phrasing | Omit whole figures or individual replies, especially during quiet chapters and at low density. Avoid a constant rain of unrelated notes. |
| Stable vocabulary, limited mutations | Balance memory and surprise | Preserve each palette's compact motif and mode. Alter register, ending, order, or participation at slower timescales. |
| Depth with an anchor | Keep detail legible inside a diffuse field | Retain the dry foundation and filtered effect returns; avoid treating maximum wetness as maximum quality. |
| Optional pulse | Offer buoyancy without forcing all listening into a beat | Keep rhythmic activity under a dedicated amount control with zero genuinely off. Tempo should not accelerate the harmonic timeline. See the separate rhythm/spatial research for its design. |

Harmonic detail should favor voiced continuity and enough open intervals to leave room for texture. Added seconds, sevenths, suspended tones, or modal colors are available choices, not mandatory decorations on every chord. The existing tension control can determine their frequency; it should not merely turn up dissonance or brightness everywhere.

The environmental layer should feel like part of the same world while leaving the music intelligible. Additional sampled textures would be a later artistic choice, not a prerequisite for this browser-only iteration. A small set of clearly different, useful sonic personalities is preferable to many nearly identical presets.

## How to judge the result

Automated tests can verify continuity, headroom, repeatability, and scheduling behavior. They cannot establish that a listener finds the music moving. The listening pass should use matched playback level and include several minutes of each contrasting palette, not only an attractive opening.

1. **Foreground listening:** Is there a phrase or timbral gesture worth noticing? Does it return in a recognizable form? Are there quiet gaps between gestures?
2. **Background listening:** Does the piece avoid repeated attention-grabbing attacks, obvious resets, harsh upper partials, and swells that feel like unintended pumping?
3. **Long duration:** After five to ten minutes, do density, register, and harmony develop without losing the piece's identity? Can a chord remain interesting through timbre and overlapping lines alone?
4. **Control edits:** Do active notes and effects continue naturally when density, tension, or movement changes? Does a new seed feel like a new performance rather than a master reset?
5. **Rhythm:** At low settings, does pulse feel like gentle propulsion? At higher settings, is there a clear bounce and space around each event? Does turning pulse off restore a floating piece?
6. **Playback:** Audition headphones, ordinary speakers, and a quiet mono downmix. Richness should not depend on extreme stereo separation or overpowering bass.

The success criterion is a coherent, spacious, evolving instrument that invites both passive and attentive listening. Similarity to any particular recording is not a measurable acceptance condition.
