import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import './scene.css';

export interface AtmosphereSceneProps {
  atmosphere: 'city' | 'afternoon';
  rain: number;
  movement: number;
  playing: boolean;
  darkness: number;
}

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Weather runs outside React's render cycle and rests when the sound is paused. */
function Weather({ atmosphere, rain, movement, playing }: Omit<AtmosphereSceneProps, 'darkness'>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = useRef({ atmosphere, rain, movement, playing });
  const refresh = useRef<(() => void) | null>(null);

  useEffect(() => {
    settings.current = { atmosphere, rain, movement, playing };
    refresh.current?.();
  }, [atmosphere, rain, movement, playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const next = random(1405);
    const particles = Array.from({ length: 125 }, () => ({
      x: next(), y: next(), speed: 0.5 + next(), size: 0.3 + next(), phase: next() * Math.PI * 2,
    }));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastFrame = 0;
    let elapsed = 0;

    const canAnimate = () => settings.current.playing && settings.current.movement > 0.005 && !document.hidden && !reducedMotion.matches;

    const draw = (time: number) => {
      frame = 0;
      const animate = canAnimate();
      if (animate && lastFrame && time - lastFrame < 1000 / 30) {
        frame = requestAnimationFrame(draw);
        return;
      }
      if (animate && lastFrame) elapsed += Math.min((time - lastFrame) / 1000, 0.08) * (0.18 + settings.current.movement * 0.82);
      lastFrame = time;
      context.clearRect(0, 0, width, height);
      const isCity = settings.current.atmosphere === 'city';
      const wetness = Math.max(0, Math.min(1, settings.current.rain));
      const count = isCity ? Math.round(wetness * particles.length) : Math.round(18 + wetness * 48);

      for (let index = 0; index < count; index++) {
        const particle = particles[index];
        if (isCity || index >= 25) {
          const y = ((particle.y + elapsed * 0.22 * particle.speed) % 1) * (height + 40) - 20;
          const x = ((particle.x - elapsed * 0.01 * particle.speed) % 1 + 1) % 1 * width;
          const length = 9 + particle.size * 16;
          context.strokeStyle = isCity ? `rgba(190, 212, 194, ${0.035 + particle.size * 0.035})` : `rgba(224, 216, 181, ${wetness * 0.055})`;
          context.lineWidth = particle.size > 1 ? 0.8 : 0.5;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x - length * 0.22, y + length);
          context.stroke();
        } else {
          const x = ((particle.x + elapsed * 0.003 * particle.speed) % 1) * width;
          const y = ((particle.y - elapsed * 0.002 * particle.speed) % 1 + 1) % 1 * height;
          const drift = Math.sin(elapsed * 0.12 + particle.phase) * 12;
          context.fillStyle = `rgba(233, 218, 177, ${0.035 + Math.max(0, Math.sin(elapsed * 0.18 + particle.phase)) * 0.16})`;
          context.beginPath();
          context.arc(x + drift, y, particle.size * 1.2, 0, Math.PI * 2);
          context.fill();
        }
      }
      if (animate) frame = requestAnimationFrame(draw);
    };

    const restart = () => {
      cancelAnimationFrame(frame);
      lastFrame = 0;
      if (!document.hidden) draw(performance.now());
    };
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      restart();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    document.addEventListener('visibilitychange', restart);
    reducedMotion.addEventListener('change', restart);
    refresh.current = restart;
    resize();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', restart);
      reducedMotion.removeEventListener('change', restart);
      refresh.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} className="scene-weather" />;
}

export default function AtmosphereScene(props: AtmosphereSceneProps) {
  const style = { '--scene-darkness': Math.max(0, Math.min(1, props.darkness)) * 0.14 } as CSSProperties;
  const base = import.meta.env.BASE_URL;
  return (
    <div className="atmosphere-scene" data-atmosphere={props.atmosphere} style={style} aria-hidden="true">
      <img className="scene-photo scene-photo--city" src={base + 'backgrounds/rainy-city.jpg'} alt="" decoding="async" fetchPriority={props.atmosphere === 'city' ? 'high' : 'low'} />
      <img className="scene-photo scene-photo--afternoon" src={base + 'backgrounds/faded-afternoon.jpg'} alt="" decoding="async" fetchPriority={props.atmosphere === 'afternoon' ? 'high' : 'low'} />
      <div className="scene-darkness" />
      <Weather {...props} />
    </div>
  );
}
