import { PUZZLES, type Puzzle } from '../game/puzzles'
import { Sprite } from './Sprite'
import { CHAMPIONS, ROSTER } from '../game/data'

const KEY = 'pt-puzzles-solved'

export function solvedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
export function markSolved(id: string) {
  const s = solvedSet()
  s.add(id)
  localStorage.setItem(KEY, JSON.stringify([...s]))
}

const dexOfKey = (k: string) => (CHAMPIONS[k]?.dex ?? ROSTER[k]?.dex ?? 0)

export function PuzzleSelect({
  onPick,
  onBack,
}: {
  onPick: (p: Puzzle) => void
  onBack: () => void
}) {
  const solved = solvedSet()
  return (
    <div className="menu puzzle-menu">
      <div className="ball-wallpaper" aria-hidden="true" />
      <button className="btn btn-tiny puzzle-back" onClick={onBack}>‹ Menu</button>
      <h1 className="menu-title">Puzzles</h1>
      <p className="menu-sub">
        Fixed boards, no dice, nothing hidden. Every one has a solution in the turns given —
        each is checked by machine before it ships.
      </p>

      <div className="puzzle-grid">
        {PUZZLES.map((p, i) => {
          const done = solved.has(p.id)
          const foe = p.units.find((u) => u.owner === 'B' && u.isChampion)
          return (
            <button key={p.id} className={`card puzzle-card ${done ? 'sel' : ''}`} onClick={() => onPick(p)}>
              <div className="puzzle-card-top">
                <span className="puzzle-index">{String(i + 1).padStart(2, '0')}</span>
                {done && <span className="puzzle-tick" aria-label="Solved">✓</span>}
              </div>
              {foe && <Sprite dex={dexOfKey(foe.key)} name={foe.key} tokenColor="#C9930A" className="card-sprite" />}
              <div className="card-name">{p.name}</div>
              <div className="puzzle-turns">{p.turns} turn{p.turns > 1 ? 's' : ''}</div>
              <div className="card-hint">{p.brief}</div>
            </button>
          )
        })}
      </div>

      <p className="puzzle-progress">
        {solved.size} of {PUZZLES.length} solved
      </p>
    </div>
  )
}
