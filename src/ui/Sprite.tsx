import { useEffect, useMemo, useState } from 'react'
import type { BallTier, Cost, ItemKey } from '../game/types'

const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
const ITEM_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items'
const animated = (dex: number, back: boolean) =>
  `${BASE}/versions/generation-v/black-white/animated/${back ? 'back/' : ''}${dex}.gif`
const staticSprite = (dex: number) => `${BASE}/${dex}.png`

/**
 * Gen 5 animated sprite with graceful degradation:
 * animated back → animated front → static front → colored token.
 */
export function Sprite({
  dex,
  name,
  back = false,
  tokenColor = '#6890F0',
  mirror = false,
  className,
}: {
  dex: number
  name: string
  back?: boolean
  tokenColor?: string
  mirror?: boolean
  className?: string
}) {
  const sources = useMemo(() => {
    const list = back
      ? [animated(dex, true), animated(dex, false), staticSprite(dex)]
      : [animated(dex, false), staticSprite(dex)]
    return list
  }, [dex, back])
  const [i, setI] = useState(0)
  useEffect(() => setI(0), [dex, back])

  if (i >= sources.length) {
    return (
      <span className={`sprite-token ${className ?? ''}`} style={{ background: tokenColor }}>
        {name[0]}
      </span>
    )
  }
  return (
    <img
      src={sources[i]}
      alt={name}
      draggable={false}
      loading="lazy"
      className={`sprite ${className ?? ''}`}
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
      onError={() => setI((v) => v + 1)}
    />
  )
}

/* PokeSprite inventory pixel art (msikma/pokesprite) — crisp game-style icons. */
const POKESPRITE = 'https://raw.githubusercontent.com/msikma/pokesprite/master/items'

const BALL_SPRITE: Record<BallTier, string> = {
  poke: 'ball/poke',
  great: 'ball/great',
  ultra: 'ball/ultra',
}
const BALL_COLOR: Record<BallTier, string> = {
  poke: '#D64545',
  great: '#3B6FB5',
  ultra: '#C9930A',
}

const ITEM_SPRITE: Record<ItemKey, string> = {
  potion: 'medicine/potion',
  'super-potion': 'medicine/super-potion',
  'max-potion': 'medicine/max-potion',
  revive: 'medicine/revive',
  'assault-vest': 'hold-item/assault-vest',
  'life-orb': 'hold-item/life-orb',
  'choice-scarf': 'hold-item/choice-scarf',
  'choice-specs': 'hold-item/choice-specs',
  'power-herb': 'hold-item/power-herb',
  'lum-berry': 'berry/lum',
}

/** The real Poké Ball pixel sprite, with a colored-dot fallback. */
export function BallSprite({ tier, size = 26 }: { tier: BallTier; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed)
    return (
      <span
        className="ball-dot"
        style={{ background: BALL_COLOR[tier], width: size * 0.6, height: size * 0.6 }}
      />
    )
  return (
    <img
      src={`${POKESPRITE}/${BALL_SPRITE[tier]}.png`}
      alt={`${tier} ball`}
      width={size}
      height={size}
      draggable={false}
      className="ball-sprite"
      onError={() => setFailed(true)}
    />
  )
}

/** Item pixel sprites with text fallback. */
export function ItemSprite({ item, size = 30 }: { item: ItemKey; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span className="item-fallback">{item[0].toUpperCase()}</span>
  return (
    <img
      src={`${POKESPRITE}/${ITEM_SPRITE[item]}.png`}
      alt={item}
      width={size}
      height={size}
      draggable={false}
      className="item-sprite"
      onError={() => setFailed(true)}
    />
  )
}

/** Multi-ball cost display using real ball sprites: ultra, then great, then poké. */
export function CostDots({ cost, size = 18 }: { cost: Cost; size?: number }) {
  const parts: BallTier[] = [
    ...Array.from({ length: cost.ultra }, () => 'ultra' as const),
    ...Array.from({ length: cost.great }, () => 'great' as const),
    ...Array.from({ length: cost.poke }, () => 'poke' as const),
  ]
  const title = [
    cost.ultra ? `${cost.ultra} Ultra` : '',
    cost.great ? `${cost.great} Great` : '',
    cost.poke ? `${cost.poke} Poké` : '',
  ].filter(Boolean).join(' + ')
  return (
    <span className="cost-dots" title={title}>
      {parts.map((tier, i) => (
        <BallSprite key={i} tier={tier} size={size} />
      ))}
    </span>
  )
}
