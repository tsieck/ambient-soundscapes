# Optional pulse and headphone beats

Research and engine review: 7 September 2026. This note separates published findings from proposed musical choices. It is an implementation brief, not evidence that these settings produce health or cognitive benefits.

## What the evidence supports

**A groove needs recognizable time, with a little tension against it.** Sioros and colleagues tested algorithmic changes to piano melodies. Selective anticipation or displacement of notes increased groove ratings; displacing almost everything was less effective. Simply adding more notes did not produce the same benefit. This is particularly relevant to a synthesized, pitched sound engine. [Sioros et al., 2014, original experiments](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.01036/full)

Witek and colleagues found the greatest movement desire and pleasure at intermediate syncopation levels in their drum-break stimuli. Their later correction fixes supporting stimulus indexing and notation and says the findings are unchanged. This suggests a useful starting point, rather than a universal optimum. [Witek et al., 2014](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0094446), [2015 correction](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0139409)

A newer experiment with 179 listeners and 40 idiomatic drum patterns found no significant effect of perceived overall complexity on the urge to move. Syncopation and complexity are different constructs, and listener response depends on musical context. We should evaluate whether our actual patterns feel good, rather than maximize a complexity metric. [Senn et al., 2024](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0311877)

**A binaural beat is a separate perceptual mechanism.** Presenting nearby pure-tone frequencies separately to the two ears can produce a perceived fluctuation corresponding to their frequency difference. Mixing the tones before they reach the ears instead creates physical acoustic beating. López-Caballero and Escera tested several beat frequencies and found no corresponding enhancement of EEG spectral power or their measured arousal responses. The study has sample-size and exposure-duration limits. [López-Caballero and Escera, 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5694826/)

Orozco Perez and colleagues compared binaural and monaural stimulation and found auditory responses to both, with stronger cortical responses to monaural control beats and no observed mood modulation. A measurable response to a rhythmic sound does not itself establish an improvement in concentration, sleep, or well-being. [Orozco Perez et al., 2020](https://www.eneuro.org/content/7/2/ENEURO.0232-19.2020)

## Design direction

The following values are authored choices to audition, not quantities established by the papers. The table reflects the delivered implementation.

| Control | Behavior | Starting range |
| --- | --- | --- |
| Pulse | Adds a rounded low pulse and short pitched replies | Off by default; smoothly variable amount |
| Pace | Changes the musical grid, leaving the long ambient phrases free | 48–108 BPM |
| Bounce | Adds a little swing, syncopated answers, and alternating accents | Straight to restrained swing; avoid large random timing offsets |
| Headphone beat | Adds separately routed left/right pure tones beneath the music | Off by default; quiet level |
| Beat rate | Changes the difference between the headphone tones | Approximately 2–12 Hz; separate from BPM |

Use a repeating two- or four-bar pattern with a clear bass anchor. Let a higher pluck arrive on selected offbeats or anticipate a phrase ending. Preserve most of the pattern for several repetitions, then vary one accent, pitch, or rest. At low amounts, expose only the low pulse and an occasional reply. At higher amounts, bring in more of the existing pattern rather than generating an unrelated stream of notes.

Keep attacks rounded and decays short enough that pulse is audible. The pad bed should still breathe independently. Let the groove share the scene's tonic and chord language, but keep its rhythm stable across slow harmonic transitions. Draw its random decisions from an independent seed so changing Pulse does not rewrite the ambient composition.

For the headphone layer, place its center pitch on a tonic octave. Set left and right to `center − difference / 2` and `center + difference / 2`. This keeps the pair centered while Beat rate changes. Leave that center stable during moving pad chords; detuning it with tape wow or independently wandering both sides makes the indicated beat rate inaccurate. Fade the pair in slowly and keep its maximum level deliberately low so the pure tone remains an optional color.

## Implemented choices

`src/rhythm.ts` uses six persistent, rounded pitched voices: three for metrical anchors and three for replies. It adds no percussion. Reply patterns last eight beats, with their character chosen again every sixteen beats from counter-based seeded randomness. Pace spans 48–108 BPM. Bounce both raises the replies and shifts their offbeat position from a half beat toward 0.66 of a beat; its zero setting leaves only the metrical anchor.

The headphone carrier is `root + 24` MIDI notes, approximately 262–494 Hz for the engine's roots 36–47. The ear difference spans 2–12 Hz. Those musical choices supersede the initial exploratory 150–400 Hz carrier and 54–108 BPM suggestions. Both optional layers start silent. Pulse joins the shared music and reverb path, while the headphone pair bypasses spatial effects. Dedicated next-beat replanning keeps tempo and bounce changes independent of ambient phrase length. These are implementation decisions, not experimental claims about an ideal groove or binaural setting.

## Fit with the current engine

The reviewed `src/audio.ts` already provides a seeded harmonic composition, fixed voice pools, layer gains, smooth parameter ramps, per-phrase checkpoints, and native automation scheduled 30 minutes ahead. Offline rendering schedules its full duration. Those are useful foundations; no timer-driven note firing is needed.

Google's Web Audio scheduling guidance distinguishes the precise audio clock from JavaScript timers. Timers can wake a scheduler, but note onsets belong on the audio timeline. Its short-lookahead example illustrates interactive timing, not a guarantee against minutes of background throttling. Retain this project's longer native schedule and make groove edits cancel/rebuild only future groove events. [Chris Wilson, A tale of two clocks](https://web.dev/articles/audio-scheduling)

Implemented routing:

```text
fixed groove voices -> individual envelopes -> pulse bus -> soft tone shaping
                                                        -> shared music path
                                                           (dry and room send)

left sine  -> ChannelMerger input 0 --+
right sine -> ChannelMerger input 1 --+-> headphone gain -> mix

mix -> existing subsonic filter -> compressor -> output gain -> destination
```

Create the merger with exactly two inputs. Each input becomes one output channel, in input order; the default is six inputs. Route the headphone pair around chorus, moving panners, and reverb/crossfeed. Preserve stereo through the downstream graph. The Web Audio specification defines these channel rules and parameter automation; `cancelAndHoldAtTime` preserves an interrupted ramp's current value, whereas cancellation alone can introduce a discontinuity. [W3C Web Audio: ChannelMergerNode](https://www.w3.org/TR/webaudio-1.0/#ChannelMergerNode), [AudioParam cancellation](https://www.w3.org/TR/webaudio-1.0/#dom-audioparam-cancelandholdattime)

Use a dedicated groove clock with bar/step checkpoints. When pace or bounce changes, preserve the current event tails and replan at the next usable grid boundary. Do not tie this latency to the ambient phrase checkpoint, which can be tens of seconds away. A pulse amount change can update its bus gain immediately without changing any scheduled notes. Keep the groove node count fixed and prune old event metadata during refills. Include its sources in existing disposal.

An alternative for only smooth tremolo is an audio-rate low-frequency oscillator, which continues without JavaScript scheduling. It is less suitable as the sole bounce mechanism because it does not produce a memorable pattern of notes, accents, and rests. Tremolo or a physical amplitude beat should not be labeled a binaural beat.

## Verification before judging musical quality

1. Render pulse alone at several tempos and confirm onset spacing, intended swing, accented rests, and a finite/clipped-sample check. Inspect the audible result at a low listening level; loudness alone must not make the variant appear better.
2. Render the headphone pair alone in stereo. Measure the dominant frequency in each channel and their requested difference; check that each channel does not contain both full-strength carriers. Confirm zero output when the headphone level is zero.
3. Exercise live tempo, pulse, and headphone controls during sustained notes. Check for clicks, lost tails, stale future events, and a delayed response caused by ambient checkpoints.
4. Verify changes to pulse settings do not change the seeded ambient notes. Test stereo and mono playback: pulse should remain musically useful in both, while mono is not expected to preserve the binaural presentation.
5. Recheck stop/resume, scene changes, repeated randomization, offline export, and background playback. Native automation cannot prevent a browser or operating system from suspending the audio context itself.

Suggested concise user copy: **“Pulse adds a gentle groove. Headphone beat adds two slightly different tones, one in each ear.”** Label BPM and Hz explicitly. The purpose is an enjoyable musical and spatial effect.
