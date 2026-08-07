import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A slow monochrome field, rendered on the GPU.
 *
 * Used sparingly — behind empty states and the boardroom stage — to give the
 * flat white surfaces some depth without introducing colour. Domain-warped
 * value noise, animated at a crawl, with a vignette so it dissolves into the
 * page rather than sitting on top of it.
 */

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

const FRAGMENT = `
precision mediump float;
uniform vec2 resolution;
uniform float time;
uniform float dark;
uniform float intensity;

// Cheap value noise — smooth enough at this scale, and no texture upload.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float total = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    total += noise(p) * amplitude;
    p *= 2.02;
    amplitude *= 0.5;
  }
  return total;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 aspect = vec2(resolution.x / resolution.y, 1.0);
  vec2 p = uv * aspect * 2.4;

  float t = time * 0.035;

  // Domain warping: sample the field through a slowly drifting offset so the
  // structure folds over itself instead of merely scrolling.
  vec2 warp = vec2(fbm(p + vec2(t, 0.0)), fbm(p + vec2(0.0, t) + 4.7));
  float field = fbm(p + warp * 1.6 + t * 0.4);

  // Soften into broad bands, then fade toward the edges.
  float bands = smoothstep(0.32, 0.78, field);
  float vignette = smoothstep(1.15, 0.15, length(uv - 0.5) * 1.6);
  float value = bands * vignette * intensity;

  vec3 tone = mix(vec3(0.06), vec3(1.0), dark);
  gl_FragColor = vec4(tone, value);
}
`

const compile = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export const Shader = ({ intensity = 0.06 }: { intensity?: number }): ReactNode => {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const node = canvas.current
    if (!node) return

    const gl = node.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false })
    // A machine without WebGL just gets a clean white surface, which is fine.
    if (!gl) return

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vertex || !fragment || !program) return

    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const uniforms = {
      resolution: gl.getUniformLocation(program, 'resolution'),
      time: gl.getUniformLocation(program, 'time'),
      dark: gl.getUniformLocation(program, 'dark'),
      intensity: gl.getUniformLocation(program, 'intensity')
    }

    const resize = (): void => {
      // Half-resolution is plenty for a soft field and keeps the GPU quiet.
      const ratio = Math.min(window.devicePixelRatio, 1.5)
      node.width = node.clientWidth * ratio
      node.height = node.clientHeight * ratio
      gl.viewport(0, 0, node.width, node.height)
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(node)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let frame = 0

    const draw = (): void => {
      gl.uniform2f(uniforms.resolution, node.width, node.height)
      gl.uniform1f(uniforms.time, reduced ? 0 : (performance.now() - start) / 1000)
      gl.uniform1f(uniforms.dark, 0)
      gl.uniform1f(uniforms.intensity, intensity)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      // A still field needs one frame, not sixty.
      if (!reduced) frame = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      gl.deleteBuffer(buffer)
    }
  }, [intensity])

  return <canvas className="shader" ref={canvas} aria-hidden />
}
