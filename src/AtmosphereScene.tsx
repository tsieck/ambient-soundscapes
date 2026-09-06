import { memo, useEffect, useId, useRef } from 'react';
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

const distantBuildings = (() => {
  const next = random(276);
  return Array.from({ length: 54 }, (_, index) => {
    const x = 465 + index * 23;
    const width = 13 + next() * 28;
    const height = 25 + next() * 95 + Math.max(0, x - 690) * 0.06;
    return { x, width, height, top: 689 - height, roof: next() > 0.75 };
  });
})();

const middleBuildings = [
  { x: 699, y: 620, w: 39, h: 117 },
  { x: 751, y: 565, w: 39, h: 176 },
  { x: 793, y: 607, w: 66, h: 145 },
  { x: 867, y: 494, w: 47, h: 251 },
  { x: 925, y: 537, w: 50, h: 207 },
  { x: 985, y: 601, w: 91, h: 153 },
  { x: 1077, y: 512, w: 60, h: 247 },
  { x: 1180, y: 568, w: 98, h: 214 },
  { x: 1305, y: 477, w: 68, h: 293 },
  { x: 1380, y: 547, w: 66, h: 219 },
  { x: 1460, y: 524, w: 111, h: 268 },
  { x: 1582, y: 421, w: 87, h: 369 },
];

const windows = (() => {
  const next = random(967);
  return middleBuildings.flatMap((building) => {
    const points: { x: number; y: number; opacity: number; width: number }[] = [];
    for (let y = building.y + 14; y < building.y + building.h - 12; y += 15) {
      for (let x = building.x + 7; x < building.x + building.w - 5; x += 9) {
        if (next() < 0.19) {
          points.push({ x, y, opacity: 0.12 + next() * 0.43, width: next() > 0.9 ? 4 : 1.5 });
        }
      }
    }
    return points;
  });
})();

const reeds = (() => {
  const next = random(482);
  return Array.from({ length: 110 }, () => {
    const x = 800 + next() * 900;
    const y = 940 + next() * 85;
    const height = 9 + next() * 43;
    const lean = -12 + next() * 25;
    return `M${x.toFixed(1)} ${y.toFixed(1)}q${(lean * 0.3).toFixed(1)} ${(-height * 0.6).toFixed(1)} ${lean.toFixed(1)} ${(-height).toFixed(1)}`;
  }).join(' ');
})();

const CityLandscape = memo(function CityLandscape({ prefix }: { prefix: string }) {
  return (
    <svg className="scene-landscape scene-landscape--city" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <linearGradient id={`${prefix}-city-sky`} x2="0.15" y2="1">
          <stop stopColor="#122623" />
          <stop offset="0.46" stopColor="#26413b" />
          <stop offset="0.72" stopColor="#597568" />
          <stop offset="1" stopColor="#172d27" />
        </linearGradient>
        <radialGradient id={`${prefix}-city-light`} cx="77%" cy="52%" r="57%">
          <stop stopColor="#a9b59a" stopOpacity="0.3" />
          <stop offset="0.58" stopColor="#8ba38e" stopOpacity="0.035" />
          <stop offset="1" stopColor="#8ba38e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${prefix}-city-fog`} x2="0" y2="1">
          <stop stopColor="#7f9b83" stopOpacity="0" />
          <stop offset="0.52" stopColor="#91a88e" stopOpacity="0.22" />
          <stop offset="1" stopColor="#80927d" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${prefix}-tower`} x2="1" y2="0.2">
          <stop stopColor="#192f2b" />
          <stop offset="0.72" stopColor="#203a33" />
          <stop offset="1" stopColor="#354e42" />
        </linearGradient>
        <linearGradient id={`${prefix}-water`} x2="0" y2="1">
          <stop stopColor="#456153" />
          <stop offset="0.65" stopColor="#243f34" />
          <stop offset="1" stopColor="#172c25" />
        </linearGradient>
        <linearGradient id={`${prefix}-beam`} x2="0" y2="1">
          <stop stopColor="#b8bea2" stopOpacity="0.07" />
          <stop offset="1" stopColor="#b8bea2" stopOpacity="0" />
        </linearGradient>
        <filter id={`${prefix}-haze`} x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur stdDeviation="15" />
        </filter>
      </defs>
      <path fill={`url(#${prefix}-city-sky)`} d="M0 0h1600v1000H0z" />
      <path fill={`url(#${prefix}-city-light)`} d="M0 0h1600v1000H0z" />
      <path d="M715 0 1105 671 1320 671 1080 0Z" fill={`url(#${prefix}-beam)`} />
      <path d="M0 682c194-28 288-46 489-20s218 24 380-2 352-27 731-5v203H0Z" fill="#4a6658" opacity="0.2" />
      <g fill="#3e594d" opacity="0.66">
        {distantBuildings.map((building, index) => (
          <path key={index} d={`M${building.x} 717v-${building.height}${building.roof ? `h${building.width * 0.2}v-6h${building.width * 0.6}v6h${building.width * 0.2}` : `h${building.width}`}V717Z`} />
        ))}
      </g>
      <path d="M0 660h1600v100H0z" fill={`url(#${prefix}-city-fog)`} />
      <g fill="#2c483d">
        {middleBuildings.map((building, index) => <rect key={index} x={building.x} y={building.y} width={building.w} height={building.h} />)}
      </g>
      <g fill="#456253" opacity="0.5">
        <path d="M751 565h39v4h-39zM870 487h40v7h-40zM883 469h12v18h-12zM927 531h46v6h-46zM1077 512h60v3h-60zM1311 469h58v8h-58z" />
        <path d="M906 494h8v251h-8zM1131 512h6v247h-6zM1364 477h9v293h-9zM1439 547h7v219h-7z" />
      </g>
      <g fill="#c8b28a">
        {windows.map((window, index) => <rect key={index} x={window.x} y={window.y} width={window.width} height="2.6" opacity={window.opacity} />)}
      </g>
      <g>
        <path d="M1147 796V384l17-13 61 9 17 20v396Z" fill={`url(#${prefix}-tower)`} />
        <path d="M1164 371v425h-17V384Z" fill="#172e29" />
        <path d="M1225 380v416h17V400Z" fill="#3b5243" opacity="0.55" />
        <path d="M1184 372v-41h2v41M1193 375v-20h1v20" stroke="#536b57" strokeWidth="1" />
        <path d="M1167 394h53M1167 402h53M1167 455h53M1167 560h53M1167 668h53" stroke="#6c8169" strokeWidth="1" opacity="0.19" />
        <path d="M1180 412v117m11-114v57m12 67v69m-24 18v47m25 33v79" stroke="#c5b894" strokeWidth="1.1" opacity="0.26" strokeDasharray="2 8 1 11 5 13" />
        <path d="M1167 383h16" stroke="#cab897" strokeWidth="1.6" opacity="0.65" />
      </g>
      <path d="M582 716c179 5 373 37 534 11s267-11 484-8v138H460Z" fill={`url(#${prefix}-water)`} />
      <g fill="none" stroke="#a1b396" strokeWidth="0.8" opacity="0.11">
        <path d="m699 750 166 0m97 10h82m119-10h129m-564 20h266m-204 14h158m161-6h334m-194 21h89m-323 10h242m-358-1h71m-41 17h281" />
      </g>
      <g opacity="0.11" stroke="#c8b394">
        <path d="m1187 742 17 0m-9 9h18m-30 9h17m-3 10h28m-38 12h37m-34 10h21m-13 13h32" />
        <path d="m894 740h13m-7 8h11m-17 9h29m-25 10h19m-15 12h23" opacity="0.6" />
      </g>
      <g className="scene-haze" filter={`url(#${prefix}-haze)`}>
        <path d="M457 678c278-14 387 12 603 9s349-19 611-2v46c-294-34-453 1-664-5s-349-5-550-5Z" fill="#b2bda0" opacity="0.14" />
        <path d="M359 765c286-22 475 16 709 8s341-12 552-4v26c-323 4-386 10-562 6s-367-21-699-9Z" fill="#b2bda0" opacity="0.08" />
      </g>
      <path d="M0 701c114 2 239 27 346 49s171 20 267 47 264 54 398 49 377-28 589-4v158H0Z" fill="#142b23" />
      <path d="M0 758c224 29 364 27 535 79 176 54 303 41 453 64 218 33 404-29 612-6v105H0Z" fill="#10261f" />
      <path d="M1461 829v-33h36v-15h65v-41h38v129Z" fill="#102720" />
      <path d="M0 929c268-68 410-6 612-18 207-13 326 35 490 28 242-11 335-26 498 0v61H0Z" fill="#10251e" />
    </svg>
  );
});

const AfternoonLandscape = memo(function AfternoonLandscape({ prefix }: { prefix: string }) {
  return (
    <svg className="scene-landscape scene-landscape--afternoon" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <linearGradient id={`${prefix}-afternoon-sky`} x2="0.2" y2="1">
          <stop stopColor="#3e4b40" />
          <stop offset="0.46" stopColor="#7d8168" />
          <stop offset="0.71" stopColor="#b5a17b" />
          <stop offset="1" stopColor="#66765b" />
        </linearGradient>
        <radialGradient id={`${prefix}-sunlight`} cx="76%" cy="44%" r="48%">
          <stop stopColor="#d9bd8e" stopOpacity="0.48" />
          <stop offset="0.45" stopColor="#c5b085" stopOpacity="0.13" />
          <stop offset="1" stopColor="#c5b085" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${prefix}-sun`} x2="0" y2="1">
          <stop stopColor="#dfc895" stopOpacity="0.8" />
          <stop offset="1" stopColor="#d7bb87" stopOpacity="0.24" />
        </linearGradient>
        <linearGradient id={`${prefix}-near-hill`} x2="0.3" y2="1">
          <stop stopColor="#344f3c" />
          <stop offset="1" stopColor="#203b2c" />
        </linearGradient>
        <filter id={`${prefix}-afternoon-haze`} x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>
      <path fill={`url(#${prefix}-afternoon-sky)`} d="M0 0h1600v1000H0z" />
      <path fill={`url(#${prefix}-sunlight)`} d="M0 0h1600v1000H0z" />
      <circle cx="1190" cy="371" r="61" fill={`url(#${prefix}-sun)`} />
      <path d="M769 416c86-6 138 8 229 3 107-6 220-25 386-7" stroke="#d2bc93" strokeWidth="9" opacity="0.045" fill="none" />
      <path d="M0 666c132-42 271-34 357-45 136-18 221-69 355-66 131 3 196 30 307 35 114 6 211-51 328-51 91 0 168 16 253 19v442H0Z" fill="#898d6d" />
      <path d="M0 718c160-34 233-42 366-28s216-26 294-51 153-19 244-8c144 18 272 54 422 33 93-13 178-54 274-54v390H0Z" fill="#728165" />
      <path d="M0 759c99-17 188-17 291-29 128-15 219-18 340 9 128 29 244-8 351-19s188 10 291 16 217-20 327-54v318H0Z" fill="#586f53" />
      <g className="scene-haze" filter={`url(#${prefix}-afternoon-haze)`} fill="#c9bf97">
        <path d="M325 686c227 1 330 46 543 33s454-41 794-27v30c-307-8-525 31-778 25s-364-23-559-33Z" opacity="0.22" />
        <path d="M816 603c327-3 442-34 815-2v26c-358-20-514 1-815 2Z" opacity="0.12" />
      </g>
      <path d="M0 775c126 23 213 74 375 62 150-11 239-4 370 2 149 7 286-25 397-64 173-61 290-70 458-32v257H0Z" fill={`url(#${prefix}-near-hill)`} />
      <path d="M942 823c94-17 164-52 271-64 86-9 130-5 183 4-124-2-212 17-281 36-74 20-112 21-173 24Z" fill="#94a075" opacity="0.12" />
      <g fill="#334e39">
        <path d="m1379 756 8-82 5 81Zm-8-35 20-50 17 45-16-9-11 22Zm-8 22 29-48 25 44-21-9-16 15Z" />
        <path d="m1436 751 7-106 5 106Zm-16-61 26-59 25 58-17-7-8 9-11-8Zm-11 31 36-60 36 59-24-10-10 12-14-13Zm-6 26 43-53 42 48-26-4-15 11-18-10Z" />
        <path d="m1526 751 10-145 5 146Zm-16-84 30-72 27 67-18-9-10 10-11-9Zm-13 35 42-72 40 67-24-12-14 13-12-10Zm-12 34 54-76 52 71-32-14-21 18-18-10Z" />
        <path d="m1588 759 12-153v158l-26-4Zm-13-96 25-80v93l-15-14Zm-18 48 43-83v94l-19-13Zm-11 27 54-57v89l-31-12Z" />
      </g>
      <path d="M0 891c238-73 351-24 516-30 150-6 277 7 403 42 166 46 315 14 421 7 93-7 177 9 260 35v55H0Z" fill="#1d392b" />
      <path d="M0 948c161-22 288-8 469 7 154 13 302-16 410-10 262 17 468-16 721 19v36H0Z" fill="#183326" />
      <path d={reeds} stroke="#1a3527" strokeWidth="1.2" fill="none" opacity="0.8" />
    </svg>
  );
});

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
  const prefix = useId().replace(/:/g, '');
  const style = {
    '--scene-darkness': Math.max(0, Math.min(1, props.darkness)) * 0.33,
    '--scene-duration': `${145 - Math.max(0, Math.min(1, props.movement)) * 65}s`,
  } as CSSProperties;

  return (
    <div className="atmosphere-scene" data-atmosphere={props.atmosphere} data-playing={props.playing && props.movement > 0.005} style={style} aria-hidden="true">
      <CityLandscape prefix={prefix} />
      <AfternoonLandscape prefix={prefix} />
      <div className="scene-reading-shade" />
      <div className="scene-darkness" />
      <Weather {...props} />
      <div className="scene-grain" />
      <div className="scene-vignette" />
    </div>
  );
}
