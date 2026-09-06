import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import {
  ArrowsInSimple, ArrowsOutSimple, ArrowCounterClockwise, ArrowUpRight,
  BookmarkSimple, CaretDown, Check, DiceFive, Pause, Play, Plus, SlidersHorizontal, SpeakerHigh, SpeakerSlash, Trash, X,
} from '@phosphor-icons/react';
import { AmbientEngine } from './audio';
import type { AtmosphereId, SoundIdentity, SoundSettings } from './audio';
import AtmosphereScene from './AtmosphereScene';
import { atmospheres, layerControls, soundControls, synthControls } from './presets';
import { generateVariation, SOUND_PRESETS } from './sound-presets';
import type { SoundPresetId } from './sound-presets';
import { loadCurrent, loadSaved, saveCurrent, savePlaces, SAVED_KEY } from './storage';
import type { CurrentPlace, Place } from './storage';

const dialogOpeners = new WeakMap<HTMLDialogElement, HTMLElement | null>();

function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [opener] = useState(() => {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement)) return null;
    const priorDialog = focused.closest('dialog');
    return priorDialog ? dialogOpeners.get(priorDialog) ?? null : focused;
  });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    dialogOpeners.set(element, opener);
    element.showModal();
    element.querySelector<HTMLInputElement>('input')?.focus();
    return () => {
      // Native close restores focus; removing a submitted dialog does not.
      // Keep StrictMode's connected cleanup from closing the live dialog.
      if (!element.isConnected && opener?.isConnected) opener.focus();
    };
  }, [opener]);
  return <dialog ref={ref} className={`place-dialog ${wide ? 'wide-dialog' : ''}`} onClose={onClose}
    onClick={e => { if (e.target === e.currentTarget) ref.current?.close(); }} aria-labelledby="dialog-title">
    <div className="dialog-content">
      <div className="mb-7 flex items-center justify-between gap-6">
        <h2 id="dialog-title" className="text-2xl tracking-tight">{title}</h2>
        <button className="icon-button" onClick={() => ref.current?.close()} aria-label="Close dialog"><X size={20} /></button>
      </div>
      {children}
    </div>
  </dialog>;
}

function SoundMeter({ engine, playing }: { engine: AmbientEngine | null; playing: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    const analyser = engine?.getAnalyser();
    if (!el || !analyser || !playing) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    let last = 0;
    const tick = (time: number) => {
      if (document.hidden) { frame = 0; return; }
      if (time - last > 85) {
        analyser.getByteFrequencyData(data);
        Array.from(el.children).forEach((bar, i) => {
          const level = data[2 + i * 3] / 255;
          (bar as HTMLElement).style.transform = `scaleY(${.18 + level * .82})`;
        });
        last = time;
      }
      frame = requestAnimationFrame(tick);
    };
    const onVisibility = () => { if (!document.hidden && !frame) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisibility); };
  }, [engine, playing]);
  return <span ref={ref} className={`sound-meter ${playing ? 'is-playing' : ''}`} aria-hidden="true">
    {[0, 1, 2, 3, 4].map(n => <i key={n} />)}
  </span>;
}

function App() {
  const [current, setCurrent] = useState(loadCurrent);
  const { atmosphere, identity } = current;
  const soundPreset = SOUND_PRESETS.find(p => p.id === identity.preset) ?? SOUND_PRESETS[0];
  const settings = useMemo(() => ({ ...soundPreset.settings, ...current.settings }), [soundPreset, current.settings]);
  const [saved, setSaved] = useState(loadSaved);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [dialog, setDialog] = useState<'save' | 'library' | 'sounds' | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [history, setHistory] = useState<CurrentPlace[]>([]);
  const [placeName, setPlaceName] = useState('');
  const [savedName, setSavedName] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const engineRef = useRef<AmbientEngine | null>(null);
  const restoreFocus = useRef<HTMLButtonElement>(null);
  const preMute = useRef(settings.volume || .5);

  useEffect(() => {
    const syncSaved = (event: StorageEvent) => { if (event.key === SAVED_KEY || event.key === null) setSaved(loadSaved()); };
    window.addEventListener('storage', syncSaved);
    return () => window.removeEventListener('storage', syncSaved);
  }, []);

  useEffect(() => () => { void engineRef.current?.dispose(); engineRef.current = null; }, []);
  useEffect(() => {
    engineRef.current?.update(settings);
    if (!saveCurrent({ ...current, settings })) setNotice('Browser storage is unavailable. Your changes will last for this visit.');
  }, [current, settings]);
  useEffect(() => {
    if (!playing) return;
    const start = Date.now();
    const prior = seconds;
    const timer = window.setInterval(() => setSeconds(prior + Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(timer);
    // Keep the session clock anchored to each play/pause transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const togglePlayback = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const engine = engineRef.current ?? (engineRef.current = new AmbientEngine());
      if (playing && engine.getContextState() === 'running') {
        await engine.pause();
        setPlaying(false);
      } else {
        await engine.play(atmosphere, settings, identity);
        setPlaying(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audio could not start. Please try listening again.');
      setPlaying(false);
    } finally { setBusy(false); }
  }, [atmosphere, settings, identity, playing, busy]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.code === 'Escape' && immersive && !dialog) { setImmersive(false); requestAnimationFrame(() => restoreFocus.current?.focus()); return; }
      if (dialog || /INPUT|TEXTAREA|SELECT|BUTTON/.test(target.tagName) || target.isContentEditable) return;
      if (event.code === 'Space') { event.preventDefault(); void togglePlayback(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, immersive, togglePlayback]);

  const changeSetting = (key: keyof SoundSettings, value: number) => {
    setCurrent(old => ({ ...old, settings: { ...old.settings, [key]: value } }));
    if (key !== 'volume') setSavedName(null);
  };
  const chooseAtmosphere = (id: AtmosphereId, custom?: SoundSettings, name?: string, sound: SoundIdentity = identity) => {
    const next = custom ? { ...custom } : { ...settings };
    setCurrent({ atmosphere: id, settings: next, identity: sound });
    if (playing) engineRef.current?.setAtmosphere(id, next, sound);
    setSavedName(name ?? null);
    setError('');
  };
  const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
  const applySound = (sound: SoundIdentity, next: SoundSettings, remember = true) => {
    if (remember) setHistory(old => [...old.slice(-7), current]);
    setCurrent({ atmosphere, settings: next, identity: sound });
    if (playing) engineRef.current?.setSound(sound, next);
    setSavedName(null);
    setError('');
  };
  const chooseSound = (id: SoundPresetId) => {
    const selected = SOUND_PRESETS.find(p => p.id === id)!;
    applySound({ preset: id, seed: newSeed() }, { ...selected.settings, volume: settings.volume, rain: settings.rain });
    setDialog(null);
  };
  const randomize = () => {
    const variation = generateVariation(identity.preset, newSeed());
    applySound(variation.identity, { ...variation.settings, volume: settings.volume, rain: settings.rain });
    setNotice(`A new variation of ${soundPreset.name.toLowerCase()}.`);
  };
  const previousVariation = () => {
    const prior = history[history.length - 1];
    if (!prior) return;
    setHistory(old => old.slice(0, -1));
    chooseAtmosphere(prior.atmosphere, { ...prior.settings, volume: settings.volume }, undefined, prior.identity);
    setNotice('Previous variation restored.');
  };
  const resetSound = () => {
    setCurrent(old => ({ ...old, settings: { ...soundPreset.settings, volume: old.settings.volume, rain: old.settings.rain } }));
    setSavedName(null);
    setError('');
  };
  const openSave = () => { setPlaceName(savedName || `${soundPreset.name}, my way`); setDialog('save'); };
  const savePlace = (e: FormEvent) => {
    e.preventDefault();
    const name = placeName.trim();
    if (!name) return;
    if (saved.length >= 50) { setError('Your shelf is full. Remove a saved place to make room for another.'); return; }
    const next = [...saved, { id: crypto.randomUUID(), name, atmosphere, settings: { ...settings }, identity: { ...identity } }];
    if (!savePlaces(next)) { setError('Your browser could not save this place. Check that browser storage is allowed.'); return; }
    setSaved(next);
    setSavedName(name);
    setDialog(null);
    setNotice(`“${name}” saved on this device.`);
  };
  const removePlace = (place: Place) => {
    const next = saved.filter(p => p.id !== place.id);
    if (!savePlaces(next)) { setError('Your browser could not update your saved places.'); return; }
    setSaved(next);
    setNotice(`“${place.name}” removed.`);
  };
  const muted = settings.volume === 0;
  const toggleMute = () => {
    if (muted) changeSetting('volume', preMute.current);
    else { preMute.current = settings.volume; changeSetting('volume', 0); }
  };

  return <div className={`stillroom theme-${atmosphere} ${immersive ? 'immersive' : ''}`}>
    <AtmosphereScene atmosphere={atmosphere} rain={settings.rain} darkness={settings.darkness} movement={settings.movement} playing={playing} />
    <div className="scene-shade" aria-hidden="true" />
    <div className="app-shell relative mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col px-6 md:px-12 lg:px-[72px]">
      <header className="app-header flex items-center justify-between gap-4 py-7 md:py-9">
        <a href="./" className="brand flex items-center gap-3" aria-label="Stillroom home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <span>stillroom<span className="brand-period">.</span></span>
        </a>
        {!immersive && <nav className="flex items-center gap-2 sm:gap-5" aria-label="Your soundscape">
          <button className="text-button" onClick={() => { setError(''); setDialog('library'); }}><BookmarkSimple size={17} /><span>Saved places</span><span className="count">{saved.length.toString().padStart(2, '0')}</span></button>
          <span className="nav-divider hidden sm:block" />
          <button ref={restoreFocus} className="text-button focus-toggle" onClick={() => setImmersive(true)} aria-label="Just listen"><ArrowsOutSimple size={17} /><span className="hidden sm:inline">Just listen</span></button>
        </nav>}
        {immersive && <button className="text-button immersive-return" onClick={() => setImmersive(false)} autoFocus><ArrowsInSimple size={17} />Show controls<span className="keycap hidden sm:inline">esc</span></button>}
      </header>

      {!immersive && <>
        <main className="main-stage flex flex-1 items-center">
          <div className="atmosphere-heading">
            <button className="preset-opener eyebrow mb-5 flex items-center gap-3" onClick={() => setDialog('sounds')} disabled={busy} aria-label="Choose sound preset"><span className="small-line" />GENERATIVE AMBIENT<span className="preset-count">10 PRESETS</span><CaretDown size={12} /></button>
            <h1>{soundPreset.name}</h1>
            <p className="atmosphere-description mt-5">{soundPreset.description}</p>
            <div className="listen-actions mt-8 flex flex-wrap items-center gap-3 md:mt-9">
              <button className="listen-button inline-flex items-center gap-3" disabled={busy} onClick={() => void togglePlayback()} aria-label={playing ? 'Pause soundscape' : 'Play soundscape'}>
                {playing ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
                {busy ? (playing ? 'Fading out…' : 'Settling in…') : playing ? 'Pause for a moment' : 'Begin listening'}
              </button>
              <button className="randomize-button flex items-center gap-2" onClick={randomize} disabled={busy} title={`Create new harmony, voicings, and texture within ${soundPreset.name}`}><DiceFive size={18} />New variation</button>
              <button className="history-button icon-button" onClick={previousVariation} disabled={!history.length || busy} aria-label="Previous variation" title="Return to your previous sound"><ArrowCounterClockwise size={17} /></button>
            </div>
            <p className="generative-note mt-5">{playing ? 'An unfolding composition. Let it find its way.' : 'Choose a sound. Find a variation. Let it unfold.'}</p>
            {error && !dialog && <p className="inline-error mt-5 max-w-md" role="alert">{error}</p>}
          </div>
          <div className="scene-caption hidden lg:block" aria-hidden="true"><span className="caption-line" />{atmosphere === 'city' ? 'THE CITY CAN WAIT.' : 'LET THE AFTERNOON GO.'}</div>
        </main>

        <section className="control-deck" aria-label="Shape your atmosphere">
          <div className="place-picker">
            <p className="eyebrow mb-4">SOMEWHERE TO GO</p>
            <div className="place-options grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-2">
              {(Object.keys(atmospheres) as AtmosphereId[]).map(id => <button key={id} className={`place-option ${id === atmosphere ? 'selected' : ''}`} disabled={busy}
                aria-pressed={id === atmosphere} onClick={() => chooseAtmosphere(id)}>
                <span className={`place-thumb thumb-${id}`} aria-hidden="true"><i /><b /></span>
                <span className="min-w-0 text-left"><span className="place-title">{atmospheres[id].name}</span><span className="place-detail">{atmospheres[id].short}</span></span>
                {id === atmosphere ? <span className="selected-dot" aria-hidden="true" /> : <ArrowUpRight className="place-arrow" size={17} />}
              </button>)}
            </div>
          </div>
          <div className="sound-shaping">
            <div className="mb-6 flex items-center justify-between gap-4">
              <p className="eyebrow">MAKE IT YOURS</p>
              <button className="reset-button flex items-center gap-1.5" disabled={busy} onClick={resetSound} title="Restore this synth preset’s original settings"><ArrowCounterClockwise size={13} />Reset</button>
            </div>
            <div className="knob-grid grid grid-cols-2 gap-x-8 gap-y-7 sm:gap-x-10 xl:grid-cols-4 xl:gap-x-8">
              {soundControls.map(control => <div className="sound-control" key={control.key}>
                <div className="mb-3 flex items-center justify-between"><label htmlFor={control.key}>{control.label}</label><output htmlFor={control.key}>{Math.round(settings[control.key] * 100).toString().padStart(2, '0')}</output></div>
                <input id={control.key} type="range" min="0" max="100" step="1" value={Math.round(settings[control.key] * 100)}
                  onChange={e => changeSetting(control.key, Number(e.target.value) / 100)}
                  aria-valuetext={`${Math.round(settings[control.key] * 100)} percent`}
                  style={{ '--fill': `${settings[control.key] * 100}%` } as CSSProperties} />
                <div className="range-endpoints mt-2 flex justify-between" aria-hidden="true"><span>{control.low}</span><span>{control.high}</span></div>
              </div>)}
            </div>
            <div className="save-row mt-7 flex items-center justify-between gap-4">
              <button className={`studio-toggle flex items-center gap-2 ${studioOpen ? 'active' : ''}`} onClick={() => setStudioOpen(old => !old)} aria-expanded={studioOpen} aria-controls="synth-panel"><SlidersHorizontal size={15} />{studioOpen ? 'Close the synth' : 'Open the synth'}<CaretDown size={11} className={studioOpen ? 'rotate-180' : ''} /></button>
              <button className="save-button flex shrink-0 items-center gap-2" onClick={openSave}><Plus size={15} />Save this place</button>
            </div>
            {studioOpen && <div id="synth-panel" className="synth-panel">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-2"><p className="eyebrow">INSIDE THE SOUND</p><span className="variation-id">VARIATION {identity.seed.toString(16).padStart(8, '0').toUpperCase()}</span></div>
              <div className="layer-mixer">
                <p className="synth-section-label mb-5">Four layers, moving at their own pace.</p>
                <div className="advanced-grid grid grid-cols-2 gap-x-8 gap-y-7 xl:grid-cols-4">
                  {layerControls.map(control => <div className="sound-control" key={control.key}>
                    <div className="mb-3 flex items-center justify-between"><label htmlFor={control.key}>{control.label}</label><output htmlFor={control.key}>{Math.round(settings[control.key] * 100).toString().padStart(2, '0')}</output></div>
                    <input id={control.key} type="range" min="0" max="100" step="1" value={Math.round(settings[control.key] * 100)} onChange={e => changeSetting(control.key, Number(e.target.value) / 100)} aria-describedby={`${control.key}-help`} style={{ '--fill': `${settings[control.key] * 100}%` } as CSSProperties} />
                    <div className="range-endpoints mt-2 flex justify-between" aria-hidden="true"><span>{control.low}</span><span>{control.high}</span></div>
                    <p className="synth-description mt-3" id={`${control.key}-help`}>{control.description}</p>
                  </div>)}
                </div>
              </div>
              <div className="advanced-grid grid grid-cols-2 gap-x-8 gap-y-7 xl:grid-cols-4">
                {synthControls.map(control => <div className="sound-control" key={control.key}>
                  <div className="mb-3 flex items-center justify-between"><label htmlFor={control.key}>{control.label}</label><output htmlFor={control.key}>{Math.round(settings[control.key] * 100).toString().padStart(2, '0')}</output></div>
                  <input id={control.key} type="range" min="0" max="100" step="1" value={Math.round(settings[control.key] * 100)} onChange={e => changeSetting(control.key, Number(e.target.value) / 100)} aria-describedby={`${control.key}-help`} style={{ '--fill': `${settings[control.key] * 100}%` } as CSSProperties} />
                  <div className="range-endpoints mt-2 flex justify-between" aria-hidden="true"><span>{control.low}</span><span>{control.high}</span></div>
                  <p className="synth-description mt-3" id={`${control.key}-help`}>{control.description}</p>
                </div>)}
              </div>
              <p className="synth-footnote mt-6">Tone changes blend in as you play. Harmony and note density settle in with the next phrase. A new variation explores a new key, voicings, timing, and tone.</p>
              {savedName && <span className="current-place-label mt-3"><Check size={13} />{savedName}</span>}
            </div>}
          </div>
        </section>
      </>}

      {immersive && <main className="flex flex-1 items-end justify-center pb-12"><button className="immersive-play text-button" onClick={() => void togglePlayback()} disabled={busy} aria-label={playing ? 'Pause soundscape' : 'Play soundscape'}>{playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}{playing ? 'Pause' : 'Listen'}<span className="mx-2 opacity-30">/</span>{soundPreset.name}</button></main>}

      {!immersive && <footer className="app-footer flex flex-wrap items-center justify-between gap-x-4 gap-y-4 py-6 md:py-7">
        <div className="playback-status flex items-center gap-3" role="status">
          <SoundMeter engine={engineRef.current} playing={playing} />
          <span>{playing ? (muted ? 'Playing · muted' : 'Gently evolving') : seconds ? 'Taking a breath' : 'Ready when you are'}</span>
          {seconds > 0 && <span className="session-time">{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</span>}
        </div>
        <span className="device-note hidden md:block">Composed as you listen. Saved only on your device.</span>
        <div className="volume-control flex items-center gap-3">
          <button className="volume-button" onClick={toggleMute} aria-label={muted ? 'Unmute sound' : 'Mute sound'}>{muted ? <SpeakerSlash size={18} /> : <SpeakerHigh size={18} />}</button>
          <label htmlFor="volume" className="sr-only">Master volume</label>
          <input id="volume" type="range" min="0" max="100" step="1" value={Math.round(settings.volume * 100)} onChange={e => changeSetting('volume', Number(e.target.value) / 100)} style={{ '--fill': `${settings.volume * 100}%` } as CSSProperties} />
          <output htmlFor="volume">{Math.round(settings.volume * 100)}</output>
        </div>
      </footer>}
    </div>

    <div className={`toast ${notice ? 'visible' : ''}`} role="status">{notice}</div>

    {dialog === 'sounds' && <Dialog wide title="Find your sound" onClose={() => setDialog(null)}>
      <p className="dialog-note mb-6">Ten starting points. Each has its own voice, harmony, and way of moving. Try a new variation to wander further.</p>
      <div className="sound-library grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SOUND_PRESETS.map((sound, index) => <button className={`sound-preset-option ${identity.preset === sound.id ? 'selected' : ''}`} key={sound.id} disabled={busy} aria-pressed={identity.preset === sound.id} onClick={() => chooseSound(sound.id)}>
          <div className="mb-3 flex items-center justify-between"><span className="sound-index">{(index + 1).toString().padStart(2, '0')}</span>{identity.preset === sound.id ? <Check size={14} /> : <span className={`timbre-mark timbre-${sound.id}`} aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>}</div>
          <span className="block text-sm">{sound.name}</span><span className="sound-preset-description mt-2 block">{sound.description}</span>
        </button>)}
      </div>
    </Dialog>}
    {dialog === 'save' && <Dialog title="Keep this feeling." onClose={() => { setDialog(null); setError(''); }}>
      <form onSubmit={savePlace}>
        <p className="dialog-note mb-7">Your synth preset, variation, settings, and landscape. Saved in this browser, ready to unfold again.</p>
        <label className="mb-2 block text-sm" htmlFor="place-name">Name your place</label>
        <input autoFocus id="place-name" className="name-input w-full" maxLength={48} required value={placeName} onChange={e => setPlaceName(e.target.value)} />
        {error && <p className="inline-error mt-4" role="alert">{error}</p>}
        <button className="listen-button mt-6 flex w-full items-center justify-center gap-2" disabled={!placeName.trim()}><BookmarkSimple size={17} />Save place</button>
      </form>
    </Dialog>}
    {dialog === 'library' && <Dialog title="Your saved places" onClose={() => { setDialog(null); setError(''); }}>
      <p className="dialog-note mb-6">A few feelings to come back to. Saved on this device.</p>
      {saved.length === 0 ? <div className="empty-shelf py-8 text-center"><BookmarkSimple size={32} className="mx-auto mb-4" weight="thin" /><p>No places saved yet.</p><button className="text-button mx-auto mt-4" onClick={openSave}><Plus size={15} />Save your first place</button></div>
        : <div className="saved-list">{saved.map(place => <div className="saved-place flex items-center gap-3" key={place.id}>
          <button disabled={busy} className="flex min-w-0 flex-1 items-center gap-4 text-left" onClick={() => { setHistory(old => [...old.slice(-7), current]); chooseAtmosphere(place.atmosphere, place.settings, place.name, place.identity); setDialog(null); setNotice(`“${place.name}” restored.`); }}>
            <span className={`place-thumb thumb-${place.atmosphere}`} aria-hidden="true"><i /><b /></span>
            <span className="min-w-0"><span className="block truncate text-sm">{place.name}</span><span className="place-detail">{SOUND_PRESETS.find(p => p.id === place.identity.preset)?.name} · {atmospheres[place.atmosphere].name}</span></span>
          </button>
          <button className="icon-button" onClick={() => removePlace(place)} aria-label={`Delete ${place.name}`}><Trash size={17} /></button>
        </div>)}</div>}
      {error && <p className="inline-error mt-4" role="alert">{error}</p>}
    </Dialog>}
  </div>;
}

export default App;
