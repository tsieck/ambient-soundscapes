// All masks use coordinates in the original photograph, independent of its
// responsive cover crop. The hill crests, sun and riverbanks stay registered.
const vertex = `
attribute vec2 position;
varying vec2 screenUV;
void main() {
  screenUV = vec2(position.x * .5 + .5, .5 - position.y * .5);
  gl_Position = vec4(position, 0., 1.);
}`

const fragment = `
precision highp float;
varying vec2 screenUV;
uniform sampler2D photo;
uniform vec4 crop;
uniform float t, motion, rain, afternoon, reveal;

float hash(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715))));
}

float impacts(vec2 p, float clock) {
  vec2 tile = floor(p);
  float seed = hash(tile);
  float age = fract(clock + seed);
  vec2 center = .28 + .44 * vec2(seed, hash(tile + 23.7));
  float d = length(fract(p) - center);
  float ring = 1. - smoothstep(.012, .058, abs(d - .23 * age));
  return ring * sin(age * 3.14159) * (1. - age);
}

void main() {
  vec2 uv = screenUV * crop.xy + crop.zw;
  if (afternoon > .5) {
    float field = smoothstep(.55 + .315 * uv.x, .64 + .315 * uv.x, uv.y);
    vec2 grove = (uv - vec2(.764, .626)) / vec2(.165, .043);
    float foliage = 1. - smoothstep(.59, 1., dot(grove, grove));
    float gust = sin(uv.x * 16. - t * .87 + 1.6 * sin(uv.y * 12. - t * .34));
    float stems = sin(uv.x * 235. + uv.y * 47. + gust * 1.7);
    float sway = field * (.28 + .72 * field) + foliage * .16;
    vec2 bend = vec2(.0037 * gust + .0011 * stems,
                     .0009 * sin(uv.x * 28. - t * .91)) * sway * motion;
    vec3 color = texture2D(photo, clamp(uv + bend, .001, .999)).rgb;
    // Shafts spread from the visible sun, softening as haze thickens.
    vec2 sun = (uv - vec2(.811, .254)) * vec2(1.777, 1.);
    float angle = atan(sun.x, max(.018, sun.y));
    float cloud = .48 + .24 * sin(angle * 9. - t * .12)
      + .16 * sin(angle * 22. + t * .08 + 1.4) + .12 * sin(angle * 34. - t * .09);
    float beams = smoothstep(.25, .93, cloud) * exp(-dot(sun,sun)*2.1)
      * smoothstep(.012, .13, sun.y) * (1. - smoothstep(.21, .57, sun.y));
    color += vec3(.071, .056, .031) * beams * (1. - .78 * rain) * motion;
    color *= 1. + field * gust * .043 * motion;
    gl_FragColor = vec4(color, reveal * max(max(field, foliage), smoothstep(.004, .07, beams)));
  } else {
    // Both banks converge beneath the bridge. Keep buildings and their
    // windows perfectly still; only the reflections in the water break up.
    float y = uv.y;
    float left = mix(.49, -.07, smoothstep(.585, .735, y));
    float right = mix(.60, .275, smoothstep(.585, .85, y));
    float water = smoothstep(left, left + .012, uv.x)
      * (1. - smoothstep(right - .018, right, uv.x)) * smoothstep(.595, .63, y);
    if (water < .001) { gl_FragColor = vec4(0.); return; }
    float depth = smoothstep(.59, .98, y);
    float wave = sin(y * 528. - t * 2. + 1.5 * sin(uv.x * 65. + t * .52));
    vec2 displaced = uv + vec2(wave * .00155, sin(uv.x * 112. + t) * .00043)
      * (.24 + depth) * motion;
    vec3 color = texture2D(photo, displaced).rgb;
    vec2 surface = uv * vec2(69., 285.) / (.72 + .48 * depth);
    float rings = impacts(surface, t * .92) + .6 * impacts(surface * 1.41 + 3.17, t * 1.17);
    color += vec3(.095, .131, .14) * rings * (.28 + .72 * rain) * (.3 + depth);
    gl_FragColor = vec4(color, water * reveal);
  }
}`

export function createLandscapeLight(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false,
    antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const program = gl.createProgram();
  if (!program) return null;
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
    const shader = gl.createShader(type);
    if (!shader) { gl.deleteProgram(program); return null; }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const crop = uniform('crop'), clock = uniform('t'), wind = uniform('motion');
  const wet = uniform('rain'), scene = uniform('afternoon'), fade = uniform('reveal');
  const textures = new Map<HTMLImageElement, WebGLTexture>();
  return {
    draw(image: HTMLImageElement, afternoon: boolean, alignment: number, t: number, motion: number, rain: number, reveal: number) {
      if (!image.complete || !image.naturalWidth || gl.isContextLost()) return;
      let texture = textures.get(image);
      if (!texture) {
        const created = gl.createTexture();
        if (!created) return;
        gl.bindTexture(gl.TEXTURE_2D, created);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image); }
        catch { gl.deleteTexture(created); return; }
        texture = created;
        textures.set(image, texture);
      } else gl.bindTexture(gl.TEXTURE_2D, texture);
      const ratio = (canvas.width / canvas.height) / (image.naturalWidth / image.naturalHeight);
      const x = Math.min(1, ratio), y = Math.min(1, 1 / ratio);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform4f(crop, x, y, (1 - x) * alignment, (1 - y) * .5);
      gl.uniform1f(clock, t); gl.uniform1f(wind, motion); gl.uniform1f(wet, rain);
      gl.uniform1f(scene, Number(afternoon)); gl.uniform1f(fade, reveal);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      textures.forEach(texture => gl.deleteTexture(texture));
      gl.deleteProgram(program); gl.deleteBuffer(buffer);
    },
  };
}
