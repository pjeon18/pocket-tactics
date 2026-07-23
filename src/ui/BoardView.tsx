import { COLS, ROWS, TYPE_META, dexOf, nameOf, ptypeOf } from '../game/data'
import { effAtk } from '../game/rules'
import type { GameState, Owner, Unit } from '../game/types'
import { Sprite } from './Sprite'

const BALL_IMG = 'https://raw.githubusercontent.com/msikma/pokesprite/master/items/ball/poke.png'

/** Base-path-safe public asset URL (works under a GitHub Pages repo subpath). */
const asset = (p: string) => import.meta.env.BASE_URL + p

export interface FloatView {
  id: number
  col: number
  row: number
  text: string
  color: string
}

/** A just-fainted unit kept around briefly for the drop-and-fade animation. */
export interface DyingUnit {
  id: number
  unit: Unit
}

/** The unit currently striking + its attack direction (drives the lunge nudge). */
export interface Lunge {
  id: number
  dc: number
  dr: number
}

export interface BoardVisuals {
  selId: number | null
  moveTiles: [number, number][]
  attackIds: number[]
  specialIds: number[]
  specialTiles: [number, number][]
  threat: Set<string>
  /** Origin tile of the selected unit's move this turn (click to undo). */
  undoTile: [number, number] | null
}

const EMPTY_VISUALS: BoardVisuals = {
  selId: null,
  moveTiles: [],
  attackIds: [],
  specialIds: [],
  specialTiles: [],
  threat: new Set(),
  undoTile: null,
}

const EMPTY_SET = new Set<number>()

export function BoardView({
  state,
  perspective,
  interactive,
  visuals = EMPTY_VISUALS,
  floats,
  spawnIds = EMPTY_SET,
  hitIds = EMPTY_SET,
  dying = [],
  lunge = null,
  onTile,
  onUnit,
}: {
  state: GameState
  perspective: Owner
  interactive: boolean
  visuals?: BoardVisuals
  floats: FloatView[]
  spawnIds?: Set<number>
  hitIds?: Set<number>
  dying?: DyingUnit[]
  lunge?: Lunge | null
  onTile: (c: number, r: number) => void
  onUnit: (u: Unit) => void
}) {
  const flip = perspective === 'B'
  const vc = (c: number) => (flip ? COLS - 1 - c : c)
  const vr = (r: number) => (flip ? ROWS - 1 - r : r)
  const w = 100 / COLS
  const h = 100 / ROWS

  const moveSet = new Set(visuals.moveTiles.map(([c, r]) => `${c},${r}`))
  const sTileSet = new Set(visuals.specialTiles.map(([c, r]) => `${c},${r}`))
  const undoKey = visuals.undoTile ? `${visuals.undoTile[0]},${visuals.undoTile[1]}` : null

  const cells = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = `${c},${r}`
      const zone = r >= ROWS - 2 ? 'A' : r < 2 ? 'B' : null
      // deterministic per-cell texture variant so the field reads organic, not tiled
      const variant = (c * 31 + r * 17) % 4
      // pick the actual tile file (seasonal grass/edges; road is season-agnostic)
      const tile = zone
        ? r === 1 ? `${state.season}-edge-foe`
          : r === ROWS - 2 ? `${state.season}-edge-own`
            : `road${variant}`
        : `${state.season}-g${variant}`
      const cls = [
        'cell',
        moveSet.has(k) ? 'cell-move' : '',
        sTileSet.has(k) ? 'cell-special' : '',
        visuals.threat.has(k) ? 'cell-threat' : '',
        undoKey === k ? 'cell-undo' : '',
      ].join(' ')
      cells.push(
        <div
          key={k}
          className={cls}
          style={{
            left: `${vc(c) * w}%`, top: `${vr(r) * h}%`, width: `${w}%`, height: `${h}%`,
            backgroundImage: `url(${asset(`tiles/${tile}.png`)})`,
          }}
          onClick={interactive ? () => onTile(c, r) : undefined}
        />,
      )
    }
  }

  /* telegraph: the current player's declared actions */
  const plans = state.units.filter((u) => u.owner === state.current && u.planned)

  const selecting = visuals.selId != null || visuals.moveTiles.length > 0 || visuals.specialTiles.length > 0
  return (
    <div className={`board s-${state.season} ${interactive ? '' : 'board-locked'} ${selecting ? 'board-selecting' : ''}`}>
      {cells}
      {/* one board-wide grid so every line is identical width and perfectly aligned */}
      <div className="grid-overlay" />
      <div className="board-midline" />

      {/* terrain: trees on grass — impassable, blocks lines of fire */}
      {state.rocks.map(([c, r]) => (
        <div
          key={`rock-${c}-${r}`}
          className="rock"
          style={{
            left: `${vc(c) * w}%`, top: `${vr(r) * h}%`, width: `${w}%`, height: `${h}%`,
            backgroundImage: `url(${asset(`tiles/${state.season}-g${(c * 31 + r * 17) % 4}.png`)})`,
          }}
        >
          <img src={asset('tiles/tree.png')} alt="" draggable={false} className="tree-img" />
        </div>
      ))}

      {/* field Poké Balls (item drops) */}
      {state.chests.map((ch) => (
        <div
          key={`chest-${ch.col}-${ch.row}`}
          className="chest"
          style={{ left: `${vc(ch.col) * w}%`, top: `${vr(ch.row) * h}%`, width: `${w}%`, height: `${h}%` }}
          onClick={interactive ? () => onTile(ch.col, ch.row) : undefined}
          title="A wild Poké Ball — move a Pokémon onto it"
        >
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
            alt="Field Poké Ball"
            draggable={false}
          />
        </div>
      ))}

      {/* telegraph overlay */}
      {plans.length > 0 && (
        <svg
          className="telegraph"
          viewBox={`0 0 ${COLS} ${ROWS}`}
          preserveAspectRatio="none"
        >
          {plans.map((u) => {
            const p = u.planned!
            const x1 = vc(u.col) + 0.5
            const y1 = vr(u.row) + 0.5
            if (p.kind === 'attack' || p.kind === 'special') {
              const t = state.units.find((x) => x.id === p.targetId)
              if (!t) return null
              const x2 = vc(t.col) + 0.5
              const y2 = vr(t.row) + 0.5
              const sp = p.kind === 'special'
              const color = sp ? '#C9930A' : '#D64545'
              return (
                <g key={u.id}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={sp ? 0.07 : 0.05} strokeDasharray="0.16 0.12" />
                  <circle cx={x2} cy={y2} r={0.33} fill="none" stroke={color} strokeWidth={0.07} />
                </g>
              )
            }
            if (p.kind === 'aoe') {
              const radius = u.key === 'chandelure' ? 2.5 : 1.5
              return <rect key={u.id} x={x1 - radius} y={y1 - radius} width={radius * 2} height={radius * 2} fill="none" stroke="#C9930A" strokeWidth={0.07} strokeDasharray="0.16 0.12" />
            }
            if (p.kind === 'tile') {
              const x2 = vc(p.col) + 0.5
              const y2 = vr(p.row) + 0.5
              return (
                <g key={u.id} stroke="#C9930A" strokeWidth={0.07}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray="0.16 0.12" />
                  <line x1={x2 - 0.5} y1={y2} x2={x2 + 0.5} y2={y2} />
                  <line x1={x2} y1={y2 - 0.5} x2={x2} y2={y2 + 0.5} />
                </g>
              )
            }
            return null
          })}
        </svg>
      )}

      {/* units */}
      {state.units.map((u) => {
        const isSel = visuals.selId === u.id
        const isAtk = visuals.attackIds.includes(u.id)
        const isSpc = visuals.specialIds.includes(u.id)
        const charged = u.charge >= u.chargeMax && !(u.isChampion && u.abilityUsed)
        const spent =
          u.owner === state.current && !state.winner && (u.acted || u.summoned || u.stunned)
        const tc = TYPE_META[ptypeOf(u)].color
        const spawning = spawnIds.has(u.id)
        const lunging = lunge && lunge.id === u.id
        const flipSign = flip ? -1 : 1
        return (
          <div
            key={u.id}
            className={[
              'unit',
              u.owner === perspective ? 'unit-mine' : 'unit-foe',
              isSel ? 'unit-sel' : '',
              isAtk ? 'unit-atk' : '',
              isSpc ? 'unit-spc' : '',
              u.isChampion ? 'unit-champ' : '',
              spent ? 'unit-spent' : '',
              spawning ? 'unit-hatch' : '',
              hitIds.has(u.id) ? 'unit-hit' : '',
              u.stunned ? 'unit-stunned' : '',
            ].join(' ')}
            style={{
              left: `${vc(u.col) * w}%`,
              top: `${vr(u.row) * h}%`,
              width: `${w}%`,
              height: `${h}%`,
              transform: lunging
                ? `translate(${lunge!.dc * flipSign * 26}%, ${lunge!.dr * flipSign * 26}%)`
                : undefined,
              zIndex: lunging ? 5 : undefined,
            }}
            onClick={interactive ? (e) => { e.stopPropagation(); onUnit(u) } : undefined}
          >
            <div className="unit-body">
              <Sprite
                dex={dexOf(u)}
                name={nameOf(u)}
                back={u.owner === perspective}
                mirror={u.owner !== perspective && !flip}
                tokenColor={tc}
              />
              {spawning && <img className="spawn-ball" src={BALL_IMG} alt="" draggable={false} />}
              <span className="type-dot" style={{ background: tc }} />
              {u.heldItem && <span className="held-dot" title={u.heldItem} />}
              {u.stunned && <span className="stun-tag">STUN</span>}
              {u.atkBuff > 0 && <span className="buff-badge">▲</span>}
              {u.planned && <span className="plan-badge" />}
            </div>
            <div className="unit-meta">
              <span className="stat-chip">
                <b className="stat-hp">{u.hp}</b>
                <i />
                <b className="stat-atk">{effAtk(state.units, u)}</b>
              </span>
              <span className="pips">
                {Array.from({ length: u.chargeMax }).map((_, i) => (
                  <span key={i} className={`pip ${i < u.charge ? 'pip-full' : ''} ${charged ? 'pip-ready' : ''}`} />
                ))}
              </span>
            </div>
          </div>
        )
      })}

      {/* fainting ghosts: drop and fade */}
      {dying.map(({ id, unit: d }) => (
        <div
          key={`dying-${id}`}
          className="unit unit-dying"
          style={{
            left: `${vc(d.col) * w}%`,
            top: `${vr(d.row) * h}%`,
            width: `${w}%`,
            height: `${h}%`,
          }}
        >
          <div className="unit-body">
            <Sprite
              dex={dexOf(d)}
              name={nameOf(d)}
              back={d.owner === perspective}
              mirror={d.owner !== perspective && !flip}
              tokenColor={TYPE_META[ptypeOf(d)].color}
            />
          </div>
        </div>
      ))}

      {/* floating numbers */}
      {floats.map((f) => (
        <div
          key={f.id}
          className={`float ${f.text.includes('CRIT') ? 'float-crit' : ''}`}
          style={{
            left: `${vc(f.col) * w + w / 2}%`,
            top: `${vr(f.row) * h}%`,
            // all damage reads RED in pixel type; heals/pickups keep their color
            color: f.text.startsWith('-') ? '#E01A1A' : f.color,
          }}
        >
          {f.text}
        </div>
      ))}
    </div>
  )
}
