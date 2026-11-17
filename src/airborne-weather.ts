function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const random = seededRandom(1405);
const drops = Array.from({ length: 740 }, () => ({
  x: random(), y: random(), z: 1.1 + random() ** .7 * 7,
  speed: .89 + random() * .26, glint: .64 + random() * .36,
}));
const leaves = Array.from({ length: 13 }, () => ({
  x: random(), y: .37 + random() * .55, z: 1.7 + random() * 4.6,
  phase: random() * Math.PI * 2, spin: .48 + random() * .78,
  size: .016 + random() * .019, hue: 30 + random() * 18,
}));
const wrap = (n: number) => n - Math.floor(n);

// A long exposure of a falling drop. Project both its travel and its diameter
// through the same focal length, so the near rain moves faster across the lens.
export function drawRain(ctx: CanvasRenderingContext2D, width: number, height: number,
  t: number, rain: number, strength: number, afternoon: boolean) {
  const focal = height * .83;
  const count = Math.min(drops.length, Math.round((width * height / 3400) * strength));
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const d = drops[i];
    const projection = focal / d.z;
    const velocity = (1.7 + rain * .84) * d.speed * projection;
    const gust = .13 + .055 * Math.sin(t * .47 + d.z);
    const x = wrap(d.x - (t * .29 + .14 * Math.sin(t * .47 + d.z)) * projection / (width + 32)) * (width + 32) - 16;
    const y = wrap(d.y + t * velocity / (height + 64)) * (height + 64) - 32;
    const length = velocity * .026;
    // The fine, far rain carries haze. A handful of near drops catch the sky.
    ctx.strokeStyle = afternoon ? 'rgb(230,219,185)' : 'rgb(194,215,218)';
    ctx.globalAlpha = (.10 + .24 / d.z + rain * .085) * d.glint;
    ctx.lineWidth = Math.max(.55, projection * .0033);
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x - length * gust, y + length); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Two curved halves meet at the midrib. Pitch, roll and yaw project each blade
// into the camera; its silhouette can turn edge-on and catch the low sunlight.
export function drawLeaves(ctx: CanvasRenderingContext2D, width: number, height: number,
  t: number, motion: number) {
  const focal = height * .83;
  const count = Math.min(leaves.length, Math.max(4, Math.round(width / 138)));
  for (let i = 0; i < count; i++) {
    const leaf = leaves[i], p = leaf.phase;
    const z = leaf.z + .28 * Math.sin(t * .23 + p);
    const drift = .18 * t + .22 * Math.sin(t * .63 + p);
    const x = wrap(leaf.x + drift * focal / (z * (width + 48))) * (width + 48) - 24;
    const y = height * leaf.y + (Math.sin(t * .52 + p) * .115 + Math.sin(t * .24 + p) * .14) * focal / z;
    const turn = t * leaf.spin + p, yaw = .58 * Math.sin(t * .47 + p);
    const roll = -.52 + Math.sin(t * .64 + p) * .89;
    const scale = focal * leaf.size / z;
    const c = Math.cos(roll), s = Math.sin(roll), face = Math.cos(turn);
    // Orthographic projection in the leaf's tangent plane is adequate across
    // its tiny width. Depth changes continuously along the flight path.
    ctx.save(); ctx.translate(x, y);
    ctx.transform(c * scale, s * scale, -s * scale, c * scale, 0, 0);
    for (const side of [-1, 1]) {
      const edge = side * .48 * face + .13 * Math.sin(turn);
      const light = (.5 + .5 * Math.cos(turn + side * .45 + yaw)) ** 2;
      ctx.fillStyle = `hsl(${leaf.hue} 36% ${17 + light * 34}%)`;
      ctx.globalAlpha = .53 + motion * .28;
      ctx.beginPath(); ctx.moveTo(-1, .06);
      ctx.quadraticCurveTo(-.14, edge * 1.6, 1.15, -.18 + yaw * .28);
      ctx.quadraticCurveTo(.05, .11, -1, .06); ctx.fill();
    }
    ctx.restore();
  }
}
