import { useEffect, useRef, useState } from 'react'

/**
 * The mat behind the field: the volumetric cloudscape shader from Paul's
 * portfolio site (raymarched fbm clouds, palette follows the local clock —
 * noon / sunset / night with twinkling stars), tuned down for game duty:
 * low render scale, capped FPS, no mouse parallax, gradient fallback.
 * ?sky=noon|sunset|night pins a mode for testing.
 */

type Mode = 'noon' | 'sunset' | 'night'

const PALETTES: Record<Mode, Record<string, number[]>> = {
  noon: {
    skyTop: [0.16, 0.4, 0.78], skyHor: [0.7, 0.83, 0.94],
    cloud: [1.0, 1.0, 1.02], shadow: [0.52, 0.6, 0.76],
    sun: [1.0, 0.98, 0.92], glare: [1.0, 0.95, 0.82],
    sunDir: [0.25, 0.55, 0.65],
  },
  sunset: {
    skyTop: [0.33, 0.2, 0.44], skyHor: [1.0, 0.5, 0.22],
    cloud: [1.0, 0.8, 0.62], shadow: [0.46, 0.27, 0.4],
    sun: [1.0, 0.6, 0.28], glare: [0.92, 0.38, 0.16],
    sunDir: [-0.62, 0.09, 0.78],
  },
  night: {
    skyTop: [0.035, 0.045, 0.13], skyHor: [0.15, 0.12, 0.29],
    cloud: [0.34, 0.38, 0.56], shadow: [0.09, 0.09, 0.2],
    sun: [0.62, 0.68, 0.92], glare: [0.26, 0.29, 0.55],
    sunDir: [0.55, 0.4, 0.72],
  },
}

const RENDER_SCALE = 0.4
const MAX_FPS = 24
const SPEED = 0.7

function pinnedMode(): Mode {
  const q = new URLSearchParams(window.location.search).get('sky')
  if (q === 'noon' || q === 'sunset' || q === 'night') return q
  const h = new Date().getHours()
  if (h >= 6 && h < 17) return 'noon'
  if (h >= 17 && h < 20) return 'sunset'
  return 'night'
}

const FS = `
precision highp float;
uniform vec2 uRes; uniform float uTime;
uniform vec3 uSkyTop, uSkyHor, uCloud, uShadow, uSun, uGlare, uSunDir;
uniform float uNight;
float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 p = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(p), hash(p+vec3(1,0,0)), f.x),
                 mix(hash(p+vec3(0,1,0)), hash(p+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(p+vec3(0,0,1)), hash(p+vec3(1,0,1)), f.x),
                 mix(hash(p+vec3(0,1,1)), hash(p+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){
  float f = 0.5*noise(p); p *= 2.02;
  f += 0.25*noise(p); p *= 2.03;
  f += 0.125*noise(p); p *= 2.01;
  f += 0.0625*noise(p);
  return f / 0.9375;
}
float den(vec3 p){
  vec3 q = p*0.42 + vec3(uTime*0.10, 0.0, uTime*0.045);
  float f = fbm(q);
  float d = 1.5*f - 0.85 - max(p.y + 0.15, 0.0)*1.3 - max(-(p.y + 2.4), 0.0)*0.7;
  return clamp(d, 0.0, 1.0);
}
void main(){
  vec2 uv = (2.0*gl_FragCoord.xy - uRes) / uRes.y;
  vec3 rd = normalize(vec3(uv.x, uv.y*0.8 - 0.12, 1.35));
  vec3 ro = vec3(0.0, 1.15, 0.0);
  vec3 sun = normalize(uSunDir);
  float sd = clamp(dot(rd, sun), 0.0, 1.0);
  vec3 sky = mix(uSkyHor, uSkyTop, pow(clamp(rd.y*0.75 + 0.35, 0.0, 1.0), 0.7));
  sky += uGlare * pow(sd, 9.0) * 0.28 + uSun * pow(sd, 90.0) * 0.9;
  if (uNight > 0.01) {
    float sh = hash(floor(rd*260.0));
    float tw = 0.7 + 0.3*sin(uTime*2.2 + sh*61.0);
    sky += vec3(0.85, 0.9, 1.0) * step(0.9982, sh) * uNight * clamp(rd.y*1.6, 0.0, 1.0) * tw;
  }
  vec4 sum = vec4(0.0);
  float t = 0.1 + 0.06*hash(vec3(gl_FragCoord.xy, 1.0));
  for (int i = 0; i < 40; i++){
    if (sum.a > 0.98 || t > 30.0) break;
    vec3 p = ro + rd*t;
    float d = den(p);
    if (d > 0.01){
      float dif = clamp((d - den(p + sun*0.4))*2.2, 0.0, 1.0);
      vec3 c = mix(uShadow, uCloud, clamp(0.28 + dif, 0.0, 1.0));
      c += uSun * dif * 0.25;
      c = mix(c, sky, 1.0 - exp(-0.0032*t*t));
      float a = d * 0.30 * (1.0 - sum.a);
      sum.rgb += c * a; sum.a += a;
    }
    t += max(0.09, 0.06*t);
  }
  vec3 col = sky * (1.0 - sum.a) + sum.rgb;
  col = clamp(col, 0.0, 1.0);
  col = col*col*(3.0 - 2.0*col);
  gl_FragColor = vec4(col, 1.0);
}`

const KEYS = ['skyTop', 'skyHor', 'cloud', 'shadow', 'sun', 'glare', 'sunDir'] as const

export function SkyMat() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const host = canvas.parentElement
    if (!host) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const fallback = () => {
      const p = PALETTES[pinnedMode()]
      const css = (c: number[]) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`
      host.style.background = `linear-gradient(180deg, ${css(p.skyTop)}, ${css(p.skyHor)})`
    }

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) {
      fallback()
      return
    }

    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null
      return s
    }
    const vs = shader(gl.VERTEX_SHADER, 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }')
    const fsh = shader(gl.FRAGMENT_SHADER, FS)
    if (!vs || !fsh) {
      fallback()
      return
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fsh)
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const U: Record<string, WebGLUniformLocation | null> = {}
    ;['uRes', 'uTime', 'uSkyTop', 'uSkyHor', 'uCloud', 'uShadow', 'uSun', 'uGlare', 'uSunDir', 'uNight'].forEach(
      (n) => { U[n] = gl.getUniformLocation(prog, n) },
    )

    const cur: Record<string, number[]> = {}
    const tgt: Record<string, number[]> = {}
    let curNight = 0
    let tgtNight = 0
    function setTarget(name: Mode) {
      const p = PALETTES[name]
      KEYS.forEach((k) => {
        tgt[k] = p[k].slice()
        if (!cur[k]) cur[k] = p[k].slice()
      })
      tgtNight = name === 'night' ? 1 : 0
    }
    setTarget(pinnedMode())
    const modeTimer = window.setInterval(() => setTarget(pinnedMode()), 5 * 60 * 1000)

    function resize() {
      if (!canvas || !host || !gl) return
      canvas.width = Math.max(2, Math.round(host.clientWidth * RENDER_SCALE))
      canvas.height = Math.max(2, Math.round(host.clientHeight * RENDER_SCALE))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    let visible = true
    const io = new IntersectionObserver((entries) => { visible = entries[0].isIntersecting }, { threshold: 0.01 })
    io.observe(host)

    const start = performance.now()
    let last = 0
    let raf = 0
    function frame(now: number) {
      if (!reduced) raf = requestAnimationFrame(frame)
      if (!gl || !canvas) return
      if (!visible || document.hidden) return
      if (now - last < 1000 / MAX_FPS) return
      last = now
      KEYS.forEach((k) => { for (let i = 0; i < 3; i++) cur[k][i] += (tgt[k][i] - cur[k][i]) * 0.04 })
      curNight += (tgtNight - curNight) * 0.04
      gl.uniform2f(U.uRes, canvas.width, canvas.height)
      gl.uniform1f(U.uTime, ((now - start) / 1000) * SPEED)
      KEYS.forEach((k) => gl.uniform3fv(U['u' + k[0].toUpperCase() + k.slice(1)], cur[k]))
      gl.uniform1f(U.uNight, curNight)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    if (reduced) {
      KEYS.forEach((k) => { cur[k] = tgt[k].slice() })
      curNight = tgtNight
      frame(16.7)
    } else {
      raf = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(modeTimer)
      io.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas className="sky-mat" ref={canvasRef} aria-hidden="true" />
}

/**
 * Click-to-load Spotify player (same pattern as PokéMAPs): zero third-party
 * requests until the player opts in; compact; full tracks need a Spotify login,
 * otherwise 30-second previews.
 */
export function MusicCorner() {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button className="btn btn-tiny music-btn" onClick={() => setOpen(true)}>
        ♪ Play Pokémon music
      </button>
    )
  }
  return (
    <iframe
      title="Pokémon music playlist on Spotify"
      className="music-frame"
      style={{ borderRadius: 12 }}
      src="https://open.spotify.com/embed/playlist/5zzAS3TA6c3w3smlHSz7Hb?utm_source=generator&theme=0"
      width="100%"
      height="152"
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    />
  )
}
