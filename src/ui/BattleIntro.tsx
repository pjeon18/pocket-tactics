import { useEffect, useState } from 'react'
import { BallSprite } from './Sprite'

/**
 * The draft → battle transition: three Poké Balls pop in one by one, then GO.
 */
export function BattleIntro({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStep(1), 100),
      window.setTimeout(() => setStep(2), 550),
      window.setTimeout(() => setStep(3), 1000),
      window.setTimeout(() => setStep(4), 1500),
      window.setTimeout(onDone, 2300),
    ]
    return () => timers.forEach(clearTimeout)
  }, [onDone])

  return (
    <div className="intro">
      <div className="intro-balls">
        <span className={`intro-ball ${step >= 1 ? 'pop' : ''}`}><BallSprite tier="poke" size={72} /></span>
        <span className={`intro-ball ${step >= 2 ? 'pop' : ''}`}><BallSprite tier="great" size={72} /></span>
        <span className={`intro-ball ${step >= 3 ? 'pop' : ''}`}><BallSprite tier="ultra" size={72} /></span>
      </div>
      <div className={`intro-go ${step >= 4 ? 'pop' : ''}`}>GO!</div>
    </div>
  )
}
