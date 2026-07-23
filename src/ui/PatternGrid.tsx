import type { PatternShape } from '../game/types'

/**
 * Chess-manual-style tactical diagrams: a 7×7 glyph with the unit at center.
 * Green = where it can move, red dots = attack rays, amber = special shape,
 * soft green = healing/support shapes.
 */

const G = 7
const C = 3
const key = (x: number, y: number) => `${x},${y}`
const inGrid = (x: number, y: number) => x >= 0 && x < G && y >= 0 && y < G

export function buildMoveAtk(move: number, range: number) {
  const moves = new Set<string>()
  const atks = new Set<string>()
  for (let x = 0; x < G; x++)
    for (let y = 0; y < G; y++) {
      const d = Math.abs(x - C) + Math.abs(y - C)
      if (d > 0 && d <= move) moves.add(key(x, y))
    }
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
  ]
  for (const [dx, dy] of dirs)
    for (let d = 1; d <= range; d++) {
      const x = C + dx * d
      const y = C + dy * d
      if (inGrid(x, y)) atks.add(key(x, y))
    }
  return { moves, atks }
}

export function buildSpecial(shape: PatternShape, range: number) {
  const spc = new Set<string>()
  const add = (x: number, y: number) => inGrid(x, y) && spc.add(key(x, y))
  const t = Math.max(1, Math.min(range, 2)) // representative target distance
  switch (shape) {
    case 'target':
      add(C, C - t)
      break
    case 'splash':
      add(C, C - 2)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]])
        add(C + dx, C - 2 + dy)
      break
    case 'pierce':
      add(C, C - t)
      add(C, C - t - 1)
      add(C, C - t - 2)
      break
    case 'column':
      for (let y = 0; y < G; y++) if (y !== C) add(C, y)
      break
    case 'cross':
      add(C, C - 2)
      add(C + 1, C - 2)
      add(C - 1, C - 2)
      add(C, C - 1)
      add(C, C - 3)
      break
    case 'ring1':
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]])
        add(C + dx, C + dy)
      break
    case 'ring2':
      for (let x = 0; x < G; x++)
        for (let y = 0; y < G; y++) {
          const d = Math.max(Math.abs(x - C), Math.abs(y - C))
          if (d > 0 && d <= 2) add(x, y)
        }
      break
    case 'line':
      for (let y = C - 1; y >= 0; y--) add(C, y)
      break
    case 'anywhere':
      for (let x = 0; x < G; x++)
        for (let y = 0; y < G; y++) {
          const d = Math.max(Math.abs(x - C), Math.abs(y - C))
          if (d > 0 && d <= 3) add(x, y)
        }
      break
    case 'self':
      add(C, C)
      break
    case 'ally':
      add(C + 1, C - 1)
      add(C - 1, C)
      break
    case 'team':
      add(C - 2, C + 1)
      add(C + 2, C + 1)
      add(C, C + 2)
      add(C - 1, C - 1)
      add(C + 1, C - 1)
      break
  }
  return spc
}

const HEAL_SHAPES: PatternShape[] = ['self', 'ally', 'team']

export function PatternGrid({
  label,
  moves,
  atks,
  spc,
  shape,
  size = 92,
}: {
  label: string
  moves?: Set<string>
  atks?: Set<string>
  spc?: Set<string>
  shape?: PatternShape
  size?: number
}) {
  const heal = shape && HEAL_SHAPES.includes(shape)
  const cells = []
  for (let x = 0; x < G; x++)
    for (let y = 0; y < G; y++) {
      const k = key(x, y)
      if (moves?.has(k)) cells.push(<rect key={`m${k}`} x={x} y={y} width={1} height={1} fill="rgba(62,155,99,0.28)" />)
      if (spc?.has(k))
        cells.push(
          <rect
            key={`s${k}`}
            x={x + 0.08}
            y={y + 0.08}
            width={0.84}
            height={0.84}
            rx={0.14}
            fill={heal ? 'rgba(62,155,99,0.45)' : 'rgba(201,147,10,0.5)'}
          />,
        )
      if (atks?.has(k)) cells.push(<circle key={`a${k}`} cx={x + 0.5} cy={y + 0.5} r={0.13} fill="#D64545" />)
    }
  return (
    <figure className="pattern">
      <svg viewBox={`0 0 ${G} ${G}`} width={size} height={size} role="img" aria-label={label}>
        <rect x={0} y={0} width={G} height={G} fill="#FFFFFF" stroke="none" />
        {cells}
        {Array.from({ length: G + 1 }).map((_, i) => (
          <g key={i} stroke="#E3E3DC" strokeWidth={0.045}>
            <line x1={i} y1={0} x2={i} y2={G} />
            <line x1={0} y1={i} x2={G} y2={i} />
          </g>
        ))}
        <circle cx={C + 0.5} cy={C + 0.5} r={0.32} fill="#16191D" />
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  )
}
