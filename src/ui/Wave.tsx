import { useEffect, useRef, useState } from 'react'

/**
 * Full-screen sweeping wave wipe for page transitions: a colored sheet with a
 * wavy leading edge slides across, the content switches under it mid-sweep,
 * and it slides off. Drive it with useWave(): call go(fn) — fn fires when the
 * screen is fully covered.
 */

export function useWave() {
  const [active, setActive] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const go = (fn: () => void) => {
    setActive(true)
    timers.current.push(window.setTimeout(fn, 380))
    timers.current.push(window.setTimeout(() => setActive(false), 850))
  }
  return { waveActive: active, go }
}

export function WaveWipe({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="wave-wipe" aria-hidden="true">
      <svg className="wave-edge wave-edge-lead" viewBox="0 0 100 800" preserveAspectRatio="none">
        <path d="M100,0 L100,800 L40,800 C90,700 10,620 55,520 C95,430 15,340 50,250 C85,160 20,80 40,0 Z" />
      </svg>
      <div className="wave-body" />
      <svg className="wave-edge wave-edge-tail" viewBox="0 0 100 800" preserveAspectRatio="none">
        <path d="M0,0 L0,800 L45,800 C90,690 15,600 60,500 C95,410 20,330 55,240 C90,150 25,70 45,0 Z" />
      </svg>
    </div>
  )
}
