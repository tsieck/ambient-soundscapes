import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { drawLeaves, drawRain } from './airborne-weather';
import { createLandscapeLight } from './landscape-light';
import './scene.css';

export interface AtmosphereSceneProps {
  atmosphere: 'city' | 'afternoon';
  rain: number;
  movement: number;
  darkness: number;
}

export default function AtmosphereScene({ atmosphere, rain, movement, darkness }: AtmosphereSceneProps) {
  const cityPhoto = useRef<HTMLImageElement>(null);
  const fieldPhoto = useRef<HTMLImageElement>(null);
  const lightCanvas = useRef<HTMLCanvasElement>(null);
  const weatherCanvas = useRef<HTMLCanvasElement>(null);
  const settings = useRef({ atmosphere, rain, movement });
  const refresh = useRef<() => void>(() => {});

  useEffect(() => {
    settings.current = { atmosphere, rain, movement };
    refresh.current();
  }, [atmosphere, rain, movement]);

  useEffect(() => {
    const light = lightCanvas.current!, weather = weatherCanvas.current!;
    const city = cityPhoto.current!, field = fieldPhoto.current!;
    const ctx = weather.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let renderer: ReturnType<typeof createLandscapeLight> | undefined;
    let frame = 0, last = 0, elapsed = 0, reveal = 0;
    let width = 0, height = 0, cityAlign = .5, fieldAlign = .5;
    let active = settings.current.atmosphere;

    const paint = (now: number) => {
      frame = 0;
      const state = settings.current;
      if (document.hidden || reduced.matches || state.movement === 0 || !width || !height) return;
      if (!last || now - last >= 1000 / 30 - .6) {
        const dt = last ? Math.min((now - last) / 1000, .1) : 0;
        last = now;
        elapsed += dt * (.74 + state.movement * .65);
        if (active !== state.atmosphere) { active = state.atmosphere; reveal = 0; }
        reveal = Math.min(1, reveal + dt / 1.8);
        const blend = reveal * reveal * (3 - 2 * reveal);
        const afternoon = active === 'afternoon';
        if (renderer === undefined) renderer = createLandscapeLight(light);
        renderer?.draw(afternoon ? field : city, afternoon, afternoon ? fieldAlign : cityAlign,
          elapsed, .55 + state.movement * .68, state.rain, blend);
        ctx.clearRect(0, 0, width, height);
        weather.style.opacity = String(blend);
        if (afternoon) drawLeaves(ctx, width, height, elapsed, state.movement);
        // This place has its own visual drizzle even with the rain audio muted.
        const amount = afternoon ? state.rain * 1.3 : .85 + state.rain * 1.55;
        if (amount > 0) drawRain(ctx, width, height, elapsed, state.rain, amount, afternoon);
      }
      frame = requestAnimationFrame(paint);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      const show = !reduced.matches && settings.current.movement > 0;
      light.hidden = weather.hidden = !show;
      if (show && !document.hidden) frame = requestAnimationFrame(paint);
    };
    const resize = () => {
      const bounds = weather.parentElement!.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      if (!width || !height) { restart(); return; }
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      // Photograph detail remains native behind the effects. Bound the number
      // of shaded pixels on ultrawide, high-DPI and full-screen displays.
      const photoRatio = Math.min(dpr, Math.sqrt(1_600_000 / (width * height)));
      const airRatio = Math.min(dpr, Math.sqrt(2_400_000 / (width * height)));
      light.width = Math.max(1, Math.round(width * photoRatio));
      light.height = Math.max(1, Math.round(height * photoRatio));
      weather.width = Math.max(1, Math.round(width * airRatio));
      weather.height = Math.max(1, Math.round(height * airRatio));
      ctx.setTransform(weather.width / width, 0, 0, weather.height / height, 0, 0);
      cityAlign = parseFloat(getComputedStyle(city).objectPosition) / 100;
      fieldAlign = parseFloat(getComputedStyle(field).objectPosition) / 100;
      restart();
    };
    const onLost = (event: Event) => { event.preventDefault(); renderer = null; };
    const onRestored = () => { renderer = undefined; restart(); };
    const observer = new ResizeObserver(resize);
    observer.observe(weather.parentElement!);
    light.addEventListener('webglcontextlost', onLost);
    light.addEventListener('webglcontextrestored', onRestored);
    reduced.addEventListener('change', restart);
    document.addEventListener('visibilitychange', restart);
    refresh.current = restart;
    resize();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); renderer?.dispose();
      reduced.removeEventListener('change', restart);
      document.removeEventListener('visibilitychange', restart);
      light.removeEventListener('webglcontextlost', onLost);
      light.removeEventListener('webglcontextrestored', onRestored);
      refresh.current = () => {};
    };
  }, []);

  const style = { '--scene-darkness': Math.max(0, Math.min(1, darkness)) * .14 } as CSSProperties;
  const base = import.meta.env.BASE_URL;
  return (
    <div className="atmosphere-scene" data-atmosphere={atmosphere} style={style} aria-hidden="true">
      <img ref={cityPhoto} className="scene-photo scene-photo--city" src={base + 'backgrounds/rainy-city.jpg'} alt="" decoding="async" fetchPriority={atmosphere === 'city' ? 'high' : 'low'} />
      <img ref={fieldPhoto} className="scene-photo scene-photo--afternoon" src={base + 'backgrounds/faded-afternoon.jpg'} alt="" decoding="async" fetchPriority={atmosphere === 'afternoon' ? 'high' : 'low'} />
      <canvas ref={lightCanvas} className="scene-light" />
      <canvas ref={weatherCanvas} className="scene-weather" />
      <div className="scene-darkness" />
    </div>
  );
}
