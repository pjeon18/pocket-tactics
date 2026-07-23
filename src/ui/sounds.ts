/**
 * Tiny sound layer: real Pokémon cries from the PokeAPI cries repo, plus
 * synthesized WebAudio blips for hits/crits/misses/KOs (no external assets).
 * Everything is fire-and-forget and silently no-ops if audio is unavailable.
 */

let muted = false
let master = 0.7
let ctx: AudioContext | null = null

export const isMuted = () => muted
export const setMuted = (v: boolean) => {
  muted = v
}
/** Master volume 0–1, scales cries and sfx alike. 0 mutes. */
export const getVolume = () => master
export const setVolume = (v: number) => {
  master = Math.max(0, Math.min(1, v))
  muted = master === 0
}

const ac = (): AudioContext | null => {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export function playCry(dex: number, volume = 0.16) {
  if (muted) return
  try {
    const a = new Audio(
      `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${dex}.ogg`,
    )
    a.volume = Math.min(1, volume * master * 1.6)
    void a.play().catch(() => {})
  } catch {
    /* no audio — fine */
  }
}

function blip(opts: {
  freq: number
  type?: OscillatorType
  dur?: number
  vol?: number
  slideTo?: number
}) {
  if (muted) return
  const c = ac()
  if (!c) return
  try {
    const { freq, type = 'square', dur = 0.12, slideTo } = opts
    const vol = (opts.vol ?? 0.12) * master * 1.4
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, c.currentTime)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), c.currentTime + dur)
    g.gain.setValueAtTime(vol, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur)
    o.connect(g)
    g.connect(c.destination)
    o.start()
    o.stop(c.currentTime + dur)
  } catch {
    /* no audio — fine */
  }
}

export const sfxHit = () => blip({ freq: 170, type: 'square', dur: 0.09, vol: 0.1, slideTo: 70 })
export const sfxCrit = () => {
  blip({ freq: 520, type: 'sawtooth', dur: 0.16, vol: 0.12, slideTo: 1100 })
  blip({ freq: 130, type: 'square', dur: 0.12, vol: 0.1, slideTo: 60 })
}
export const sfxMiss = () => blip({ freq: 320, type: 'sine', dur: 0.16, vol: 0.07, slideTo: 120 })
export const sfxKO = () => blip({ freq: 150, type: 'triangle', dur: 0.42, vol: 0.14, slideTo: 40 })
export const sfxTurn = () => blip({ freq: 392, type: 'sine', dur: 0.18, vol: 0.06, slideTo: 588 })
export const sfxHeal = () => blip({ freq: 500, type: 'sine', dur: 0.14, vol: 0.06, slideTo: 750 })
