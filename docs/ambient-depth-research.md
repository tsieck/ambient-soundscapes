# Ambient depth: tone, attention, and an ensemble that leaves room

Research date: 7 September 2026. This continues [the first composition pass](ambient-research.md) and [the pulse/spatial research](rhythm-spatial-research.md). The first pass addressed harmonic dwelling, independent melodic cycles, and optional groove. This pass asks what happens *inside* a held sound and how the parts make room for one another over several minutes.

These are primary accounts of artistic practice. They support compositional directions, not scientific claims that one style improves concentration or that a particular algorithm produces compelling music. The numerical ranges and engine proposals below are our choices to audition. Davachi's practice is relevant to duration and timbre; calling her work simply ambient would erase distinctions she makes about it.

## What the artists actually say

### 1. Timbre is compositional material

In a September 1985 interview, Eno discusses the studio as a place to develop sound texture, including continuous gradations between timbral states. He also prefers constrained instruments to limitless options. The useful principle is that changing a sound's character can carry musical interest without requiring another melody or chord. This does not imply that every sound should constantly modulate. [Brian Eno, original interview republished by *SPIN* in 2019](https://www.spinmagazine.com/2019/07/brian-eno-hybrid-september-1985-interview/).

### 2. Sustaining a sound gives its detail time to become perceptible

Davachi explains that reducing melodic and rhythmic activity brings attention to texture and harmonics; duration lets those features unfold. She also describes a piece whose recurring melody gradually breaks apart, inspired by sound-on-sound delay. This is a useful distinction between recurrence with a history and endless replacement by new material. [Sarah Davachi, interview with Ryan Alexander Diduck, 11 June 2024](https://nichemtl.com/2024/06/11/wait-for-it-in-conversation-with-sarah-davachi/).

In her SMEM conversation, Davachi describes beginning with an instrument's particular character, then dwelling on a note or timbre as it evolves. She also treats silence as part of the musical experience. For this implementation, that suggests developing a palette's existing tone and leaving space around it. [Davachi, SMEM interview, published 2 May 2022](https://www.smemmusic.ch/en/interview-sarah-davachi-slow-sounds-and-wide-spaces).

### 3. Flexible music can still respond specifically

Discussing *Slow Poem for Stiebler*, Davachi and Voutchkova describe notated sections with variable pacing, selected and reordered into different structures. The performers listen for one another's changes of notes and intervals. Davachi's broader practice gives players bounded choices of pitch, onset, and duration. Variability is therefore situated within a shared musical activity; it is not an instruction for every part to choose independently without regard to the result. [Davachi and Biliana Voutchkova, interview hosted by the releasing label Another Timbre](https://www.anothertimbre.com/products/biliana-voutchkova-sarah-davachi-slow-poem-for-stiebler).

### 4. Attention can encompass the field and find a focus within it

Oliveros describes listening that expands to the whole sound field while also finding focus, including intended, unintended, environmental, and imagined sound. Her practice involves active exercises, sounding, and collaboration. It should not be reduced to a synonym for passive background music. For this instrument, it suggests leaving both a coherent surrounding field and individual relationships available to a listener's attention. [Pauline Oliveros, excerpt from *Quantum Listening* (1999), hosted by the Center for Deep Listening at RPI](https://www.deeplistening.rpi.edu/deep-listening/).

### 5. Long duration still needs editing

Roach describes motifs that are identifiable episodes of sound, extending beyond melody and chord structure. He emphasizes deciding when a sound has overstayed its welcome and when it has not had enough time to settle. His account treats subtle tone shaping and relationships among instruments as performance. Endless playback is a medium; it does not eliminate choices about duration and development. [Steve Roach, interview with Ned Raggett, Red Bull Music Academy, 10 March 2017](https://daily.redbullmusicacademy.com/2017/03/steve-roach-interview/).

### 6. Judge a piece by living with its sound

Roach describes leaving works running in his studio for days or weeks, returning to them at different times and levels, and making small changes while they play. His method is artist testimony, not a validation protocol for software, but it supports evaluating more than the first attractive minute. The same interview describes sound as the starting point from which his music emerges. [Steve Roach, interview with Kate McCallum, hosted on his own website](https://steveroach.com/an-interview-with-steve-roach/).

## What the reviewed engine already does

The code reviewed at the start of this pass already has authored palettes, modal harmony, overlapping common tones, two asynchronous melodic strands, chapter-level changes, restrained noise texture, and a separate groove clock. Voice pools are finite. The long native audio schedule and checkpoint restoration are essential to continuity and background operation.

Three remaining limitations are visible in `src/audio.ts`:

- **Long tones share much of their motion.** Voices receive common slow pitch drift and tape wow. Most color envelopes open once, then close. A sustained common tone can become a static layer after its initial gesture, while a global filter sweep makes many voices change together.
- **The melodic strands do not respond to each other.** A figure's activity is chosen from density/chapter probabilities. Candidate events are sorted before voice allocation, but this prevents allocation errors rather than musical competition. Both figures can become foreground at once by coincidence.
- **Position changes at each note.** Random panning creates width, yet provides little continuity of place for a returning strand. Shared room routing can further blur the distinction between an intimate gesture and a distant field.

These are implementation observations, not conclusions about how the current music sounds in every preset.

## Implementation brief

### Develop the existing voices before adding new layers

Give sustained pads a seed-specific slow color trajectory with a stable tonal center. Useful gestures include a gradual redistribution between darker and brighter spectra, a small local filter drift, or restrained FM-index motion. Preserve the fundamental and keep changes quieter than the articulated foreground. Different voices should reach their color peaks at different times; a global brightness sweep alone cannot provide that independence.

Start with roughly 25–90 second local color cycles or two to four broad segments through a long note. The best implementation need not use all of these mechanisms. Timbre should express palette identity: organ partials can emerge gently, bowed sounds can change pressure-like color, and FM sounds can expose a faint metallic overtone. Avoid making every palette a detuned chorus. Keep the current source/voice count bounded and preserve all added automation through live replanning.

### Make space an ensemble decision

Process strand candidates in chronological order. When a foreground figure has begun, reserve a short window for its contour. A second strand can omit its figure, soften it, or enter after a bounded pause. Preserve the figure's saved pitches and timing once it starts. Preserve the strand's long cycle so yielding does not silently synchronize both strands into call-and-response forever.

A starting rule could reserve about 2–5 seconds around salient arrivals, reducing the restriction at higher density. Decide at figure boundaries wherever possible; removing arbitrary middle notes can erase the motif's identity. Let decaying notes overlap—reserving attention does not require silencing all sustained sound. Record any ownership/window state in score checkpoints so a setting edit cannot double-book a gesture.

### Give recurring voices a recognizable place

Use a stable, seed-specific home position for each strand, with narrow variation around it rather than a new full-width placement per note. Keep the lower anchor close to center. A quieter or slightly darker reply can suggest distance without raising reverb everywhere. If layer-specific sends are introduced, maintain the existing fixed effect-return and feedback levels; a control change must not amplify tails already in flight.

No cited composer specifies a panning law, filter cutoff, or reverb ratio here. These are mix decisions intended to make the relationships easier to hear, and require stereo and mono audition.

### Develop focus over minutes without forcing a climax

Allow a passage to emphasize one existing role—harmonic tone, a clear melodic gesture, or texture—while the others yield gently. Avoid multiplying all layer gains by the same chapter envelope, which would produce a recurring full-mix swell. Let quiet passages expose tone and decay rather than filling them with extra decoration. A passage can return to a familiar focus with altered voicing or color; it need not continually add material.

Keep pulse optional and its timing reliable. Bouncy listening can have longer melodic rests and a steady low anchor while the pad evolves freely. Do not make tempo advance the harmonic chapters or make the headphone-beat rate follow pad modulation. The earlier rhythm research still governs those separate features.

## Evaluation that can reject an attractive but weaker change

1. **Held-tone test:** Mute detail, pulse, rain, and texture. At a matched level, a held pad should reveal a clear color change without pronounced pitch seasickness or periodic pumping.
2. **Ensemble test:** Listen to two or more complete strand cycles. A recurring figure should remain recognizable, and overlapping gestures should sound intentional. Check a busy and a sparse setting.
3. **Return test:** Revisit the same palette after five to ten minutes. Its identity should survive, while focus and internal texture have moved. A repeated fade to near-silence every few phrases is not enough.
4. **Depth test:** Compare headphones, ordinary speakers, and mono. The focal gesture should remain legible when width is removed. No part should require extreme bass or top-end level to be noticed.
5. **Interaction test:** Change movement/density repeatedly during a long note and mid-figure. Existing amplitude, color, and spatial trajectories must continue; only future decisions should change.
6. **Engineering test:** Verify deterministic seed behavior, finite/clipped samples, headroom, bounded node/event counts, and continuity through checkpoint/refill boundaries. Pulse edits must not rewrite the ambient score. Passing these tests does not establish musical quality.

The intended improvement is a stronger relationship between fewer well-shaped events: interesting sustained tone, identifiable returning gestures, and enough room to notice their interaction.

## Delivered ensemble behavior

The follow-up implementation processes both strands in time order and reserves attention through an active figure's last articulation plus 1.2–3.6 seconds of breathing room, depending on density. A conflicting figure waits at most 18 seconds, further bounded by the room remaining in its own cycle. If it cannot fit, that figure is omitted. The next recurrence keeps its original cycle origin, so responsive timing does not gradually lock the strands together. Both roles can yield when another gesture is already underway.

Each strand has a seed-specific home position around 30% left or right, with a small variation chosen once per figure. Every note in that figure shares the position. Figure preparation, deferred entrance, and attention reservation are saved in composition checkpoints. This is attention-oriented scheduling: existing note releases continue overlapping naturally.

The new `tests/ensemble.spec.ts` verifies spatial continuity in rendered stereo audio and checks opposing entrances and returning strands over ten minutes of native audio scheduling for three seeds. The existing composition restoration test also passes, including restored control edits during the piece and the automation fallback. These checks establish the scheduling and continuity properties; the listening evaluation above remains the musical judgment.

## Delivered tone and distance

Each of the eight pad voices and three texture voices has an independent, seed-specific color oscillator. Its 64–213 second cycle continues across note boundaries and replanning. This is slower than the initial brief: a long note reveals part of a broad trajectory, and reusing the voice does not restart the color gesture. Movement scales depth from 30% to 100%; no new controls are required. A separate random sequence leaves the existing composition and weather generators independent of these additions.

Subtractive, bowed, and organ pads redistribute weight between two related spectra with complementary gains. The darker spectrum attenuates upper partials while preserving the fundamental. The existing two detuned oscillators remain in use. Each voice also moves its filter cutoff gently, up to 320 cents above and below the note's envelope. FM pads vary their modulation depth by up to 30% around that envelope. The fundamental pitch schedule is unchanged by these color clocks; Drift remains the tuning control. Texture voices vary the width of their resonant bands and use different weights for the existing grain motion. All gains and resonance ranges stay bounded.

The room now receives different proportions of each layer: foundation 0.24, pad 0.92, detail 0.52, texture 1.25, and pulse 0.36. These are fixed input multipliers before the common Space send, not changes to direct layer volume. The pad chorus also feeds the room. Separate matching tone filters keep Warmth and Darkness consistent across direct and reflected sound. The binaural tones retain their independent clean path. [The spatial notes](spatial-depth-research.md) describe the immutable early-reflection and frequency-dependent decay response.

This adds eleven fixed slow oscillators, while keeping seventeen pitched ambient slots, the existing texture pool, and the rhythm pool. Room construction adds no playback sources. The new audio examples compare the previous and current engines with identical preset controls and seeds, matched by full-clip RMS; [the audition guide](audition-guide.md) records the method and its limits.
