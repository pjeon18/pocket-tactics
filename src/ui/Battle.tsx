import { useEffect, useMemo, useRef, useState } from 'react'
import {
  cancelPlan,
  deploy,
  fieldedCount,
  finishTurn,
  moveUnit,
  newBattle,
  planArea,
  planAttack,
  resolveStep,
  tradeBalls,
  undoMove,
  useAbility,
  useItem,
} from '../game/actions'
import {
  CHAMPIONS,
  COLS,
  FIELD_CAP,
  GREAT_CAP,
  ITEMS,
  MOVE_CAP,
  ROLE_META,
  ROSTER,
  ROWS,
  SYNERGIES,
  SYNERGY_THRESHOLD,
  SYNERGY_TIER2,
  TRADE_GREAT_COST,
  TRADE_ULTRA_COST,
  TYPE_META,
  ULTRA_CAP,
  costEquiv,
  metaOf,
  nameOf,
  ptypeOf,
  roleOf,
  specialHintOf,
  specialNameOf,
} from '../game/data'
import { aiStep } from '../game/ai'
import {
  blockedAt,
  canActNow,
  canAfford,
  canDeployCard,
  effAtk,
  effMove,
  effRange,
  inDeployZone,
  openDeployTiles,
  otherOwner,
  reachable,
  synergyCounts,
  targetsFrom,
  threatTiles,
} from '../game/rules'
import type { DraftResult, GameState, ItemKey, Owner, PType, Unit } from '../game/types'
import { BoardView, type BoardVisuals, type DyingUnit, type FloatView, type Lunge } from './BoardView'
import { BallSprite, CostDots, ItemSprite, Sprite } from './Sprite'
import { PatternGrid, buildMoveAtk, buildSpecial } from './PatternGrid'
import { dexOf } from '../game/data'
import { getVolume, playCry, setVolume, sfxCrit, sfxHeal, sfxHit, sfxKO, sfxMiss, sfxTurn } from './sounds'
import { MusicCorner, SkyMat } from './SkyMat'
import { HowToPlay } from './ModeSelect'
import { SynergyLegend } from './Draft'
import { WaveWipe, useWave } from './Wave'
import type { NetSession } from '../net'

type Sel =
  | null
  | { type: 'unit'; id: number }
  | { type: 'enemy'; id: number }
  | { type: 'bench'; key: string }
  | { type: 'card'; key: string } // inspect a species (enemy deck / shop) without arming anything
  | { type: 'special'; id: number }
  | { type: 'revive'; id: number; reviveKey: string | null }
  | { type: 'item'; item: ItemKey }
  | { type: 'itemRevive'; reviveKey: string | null }

let FLOAT_ID = 1
const AI_STEP_MS = 620
const RESOLVE_MS = 540
/** Per-turn clock: generous but restraining; hit zero and the turn ends itself.
    Tune live with ?tt=<seconds>. */
const TURN_SECONDS = (() => {
  const q = Number(new URLSearchParams(window.location.search).get('tt'))
  return Number.isFinite(q) && q >= 10 ? q : 60
})()
const tierRank = { poke: 0, great: 1, ultra: 2 } as const

const ACTIONS = {
  deploy, moveUnit, undoMove, planAttack, planArea, cancelPlan, useAbility, useItem, tradeBalls,
} as const
type ActionName = keyof typeof ACTIONS

export function Battle({
  mode,
  blitz,
  draftA,
  draftB,
  net,
  onExit,
  onRedraft,
}: {
  mode: 'ai' | 'local'
  blitz: boolean
  draftA: DraftResult
  draftB: DraftResult
  net?: NetSession
  onExit: () => void
  onRedraft: () => void
}) {
  const seasonOverride = (() => {
    const q = new URLSearchParams(window.location.search).get('season')
    return q === 'spring' || q === 'summer' || q === 'autumn' || q === 'winter' ? q : undefined
  })()
  const [state, setState] = useState<GameState>(() => newBattle(draftA, draftB, blitz, seasonOverride))
  const [sel, setSel] = useState<Sel>(null)
  const [floats, setFloats] = useState<FloatView[]>([])
  const [tabletop, setTabletop] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [spawnIds, setSpawnIds] = useState<Set<number>>(() => new Set())
  const [hitIds, setHitIds] = useState<Set<number>>(() => new Set())
  const [dying, setDying] = useState<DyingUnit[]>([])
  const [lunge, setLunge] = useState<Lunge | null>(null)
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null)
  const [volume, setVolumeState] = useState(getVolume())
  const startRef = useRef(Date.now())
  const prevUnits = useRef<Unit[]>([])
  const floatTimers = useRef<number[]>([])

  /* online: host is A, guest is B; host runs the authoritative engine */
  const isGuest = net?.role === 'guest'
  const myOwner: Owner | null = net ? (net.role === 'host' ? 'A' : 'B') : null
  const stateRef = useRef(state)
  stateRef.current = state
  const resolvingRef = useRef(resolving)
  resolvingRef.current = resolving
  const [gotHostState, setGotHostState] = useState(!isGuest)
  const [winnerShown, setWinnerShown] = useState(false)
  const { waveActive, go: waveGo } = useWave()

  /* per-turn clock — each client times only the seat it controls */
  const doEndTurnRef = useRef<() => void>(() => {})
  const [turnLeft, setTurnLeft] = useState(TURN_SECONDS)
  const controlsCurrent =
    !state.winner && !resolving &&
    (net ? state.current === myOwner : mode === 'ai' ? state.current === 'A' : true)

  useEffect(() => () => floatTimers.current.forEach(clearTimeout), [])
  useEffect(() => {
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  const apply = (next: GameState | null): boolean => {
    if (!next) return false
    if (next.events.length) {
      const views = next.events.map((e) => ({ ...e, id: FLOAT_ID++ }))
      setFloats((f) => [...f, ...views])
      floatTimers.current.push(
        window.setTimeout(
          () => setFloats((f) => f.filter((x) => !views.some((v) => v.id === x.id))),
          1050,
        ),
      )
      // impact shake + sound: any unit standing where damage landed
      const dmgSpots = next.events.filter((e) => e.text.startsWith('-'))
      if (dmgSpots.length) {
        const ids = new Set(
          next.units
            .filter((u) => dmgSpots.some((e) => e.col === u.col && e.row === u.row))
            .map((u) => u.id),
        )
        setHitIds(ids)
        floatTimers.current.push(window.setTimeout(() => setHitIds(new Set()), 450))
        if (dmgSpots.some((e) => e.text.includes('CRIT'))) sfxCrit()
        else sfxHit()
      }
      if (next.events.some((e) => e.text === 'MISS')) sfxMiss()
      if (next.events.some((e) => e.text.startsWith('+'))) sfxHeal()
    }
    // attack lunge for the acting unit
    if (next.acting) {
      setLunge(next.acting)
      floatTimers.current.push(window.setTimeout(() => setLunge(null), 240))
    }
    // faints: keep a ghost for the drop-and-fade animation + KO sound and cry
    const nextIds = new Set(next.units.map((u) => u.id))
    const removed = prevUnits.current.filter((u) => !nextIds.has(u.id))
    if (removed.length) {
      sfxKO()
      removed.forEach((u) => playCry(dexOf(u), 0.12))
      const ghosts = removed.map((u) => ({ unit: u, id: FLOAT_ID++ }))
      setDying((d) => [...d, ...ghosts])
      floatTimers.current.push(
        window.setTimeout(
          () => setDying((d) => d.filter((g) => !ghosts.some((x) => x.id === g.id))),
          700,
        ),
      )
    }
    // Poké Ball open animation + cry for freshly deployed units
    const fresh = next.units.filter((u) => !prevUnits.current.some((p) => p.id === u.id))
    prevUnits.current = next.units
    if (fresh.length) {
      fresh.forEach((u) => playCry(dexOf(u)))
      const freshIds = fresh.map((u) => u.id)
      setSpawnIds((s) => new Set([...s, ...freshIds]))
      floatTimers.current.push(
        window.setTimeout(
          () => setSpawnIds((s) => new Set([...s].filter((id) => !freshIds.includes(id)))),
          900,
        ),
      )
    }
    setState(next)
    // host streams every applied state (actions + resolution frames) to the guest
    if (net?.role === 'host') net.sendState({ state: next, resolving: resolvingRef.current })
    return true
  }

  /**
   * Every player action funnels through here. Local/AI and the online HOST run
   * the pure action and apply it; the online GUEST just ships the intent to the
   * host and waits for the authoritative state to come back.
   */
  const run = (name: ActionName, ...args: unknown[]): boolean => {
    if (state.winner) return false
    if (net) {
      if (state.current !== myOwner || resolving) return false
      if (isGuest) {
        net.sendAction({ name, args })
        return true // optimistic: lets the UI clear its selection
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next = (ACTIONS[name] as any)(state, ...args) as GameState | null
    return apply(next)
  }

  /* online wiring: guest renders host states; host applies guest intents */
  useEffect(() => {
    if (!net) return
    if (net.role === 'guest') {
      net.onState((msg) => {
        setGotHostState(true)
        setResolving(msg.resolving)
        apply(msg.state)
      })
      // both sides mount at slightly different times — ask the host for the
      // current state so the opening broadcast can never be missed
      net.sendAction({ name: 'sync', args: [] })
    } else {
      // host: broadcast the opening state, then apply any intent the guest sends
      net.sendState({ state: stateRef.current, resolving: false })
      net.onAction((a) => {
        if (a.name === 'sync') {
          net.sendState({ state: stateRef.current, resolving: resolvingRef.current })
          return
        }
        if (stateRef.current.current !== 'B' || stateRef.current.winner || resolvingRef.current) return
        if (a.name === 'endTurn') {
          setResolving(true)
          return
        }
        const fn = ACTIONS[a.name as ActionName]
        if (fn) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          apply((fn as any)(stateRef.current, ...a.args))
        }
      })
    }
    net.onPeerLeave(() => onExit())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net])

  /* the win screen arrives behind a wave sweep */
  useEffect(() => {
    if (state.winner && !winnerShown) waveGo(() => setWinnerShown(true))
    if (!state.winner && winnerShown) setWinnerShown(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.winner])

  /* keep selection valid as units faint */
  useEffect(() => {
    if (sel && 'id' in sel && !state.units.some((u) => u.id === sel.id)) setSel(null)
  }, [state, sel])

  /* turn clock: reset on handover, tick while this client is on the move */
  useEffect(() => setTurnLeft(TURN_SECONDS), [state.current])
  useEffect(() => {
    if (!controlsCurrent) return
    const iv = window.setInterval(() => setTurnLeft((v) => v - 1), 1000)
    return () => clearInterval(iv)
  }, [controlsCurrent, state.current])
  useEffect(() => {
    if (turnLeft <= 0 && controlsCurrent) {
      setTurnLeft(TURN_SECONDS)
      doEndTurnRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnLeft, controlsCurrent])

  /* turn banner sweep on handover */
  const bannerKey = useRef(0)
  useEffect(() => {
    if (state.winner) return
    const label =
      mode === 'ai'
        ? state.current === 'A' ? 'Your move' : "Rival's move"
        : state.current === 'A' ? "Player 1's move" : "Player 2's move"
    setBanner({ text: label, key: ++bannerKey.current })
    sfxTurn()
    const t = window.setTimeout(() => setBanner(null), 1300)
    return () => clearTimeout(t)
  }, [state.current, state.winner, mode])

  /* resolution playback (host / offline only — the guest just shows host frames) */
  useEffect(() => {
    if (!resolving || isGuest) return
    const t = window.setTimeout(() => {
      if (state.winner) {
        setResolving(false)
        return
      }
      const next = resolveStep(state)
      if (next) apply(next)
      else {
        // flip the ref BEFORE applying, so the host's hand-over broadcast
        // carries resolving:false — otherwise the guest stays locked out
        resolvingRef.current = false
        apply(finishTurn(state))
        setResolving(false)
      }
    }, RESOLVE_MS)
    return () => clearTimeout(t)
  }, [resolving, state])

  /* AI planning loop */
  useEffect(() => {
    if (mode !== 'ai' || state.current !== 'B' || state.winner || resolving) return
    const t = window.setTimeout(() => {
      const next = aiStep(state)
      if (next) apply(next)
      else setResolving(true)
    }, AI_STEP_MS)
    return () => clearTimeout(t)
  }, [state, mode, resolving])

  const findUnit = (id: number) => state.units.find((u) => u.id === id)
  const selUnit = sel && 'id' in sel ? findUnit(sel.id) : undefined

  /* ---------- derived visuals ---------- */
  const visuals: BoardVisuals = useMemo(() => {
    const v: BoardVisuals = {
      selId: selUnit?.id ?? null,
      moveTiles: [],
      attackIds: [],
      specialIds: [],
      specialTiles: [],
      threat: new Set<string>(),
      undoTile: null,
    }
    if (resolving) return v
    if (sel?.type === 'bench') {
      v.specialTiles = openDeployTiles(state, state.current)
      return v
    }
    if (sel?.type === 'item') {
      const valid = (u: Unit): boolean => {
        if (u.owner !== state.current) return false
        if (['potion', 'super-potion', 'max-potion'].includes(sel.item)) return u.hp < u.maxHp
        if (sel.item === 'power-herb') return u.charge < u.chargeMax
        if (sel.item === 'lum-berry') return u.stunned
        return !u.heldItem // attachments
      }
      v.specialIds = state.units.filter(valid).map((u) => u.id)
      return v
    }
    if (sel?.type === 'itemRevive') {
      if (sel.reviveKey) v.specialTiles = openDeployTiles(state, state.current)
      return v
    }
    if (!selUnit) return v
    if (sel?.type === 'unit') {
      v.moveTiles = reachable(state, selUnit)
      if (selUnit.owner === state.current && selUnit.moved && selUnit.movedFrom)
        v.undoTile = selUnit.movedFrom
      if (canActNow(state, selUnit))
        v.attackIds = targetsFrom(state, selUnit).map((t) => t.id)
    } else if (sel?.type === 'enemy') {
      v.threat = threatTiles(state, selUnit)
    } else if (sel?.type === 'special') {
      const meta = metaOf(selUnit)
      const range = meta.rangeOverride ?? effRange(state.units, selUnit)
      if (meta.kind === 'enemy') {
        v.specialIds = targetsFrom(state, selUnit, selUnit.col, selUnit.row, range, meta.ignoreBlock).map((t) => t.id)
      } else if (meta.kind === 'ally') {
        v.specialIds = state.units
          .filter(
            (t) =>
              t.owner === selUnit.owner &&
              t.id !== selUnit.id &&
              Math.max(Math.abs(t.col - selUnit.col), Math.abs(t.row - selUnit.row)) <= range,
          )
          .map((t) => t.id)
      } else if (meta.kind === 'tile' || meta.kind === 'blink') {
        const tiles: [number, number][] = []
        for (let c = 0; c < COLS; c++)
          for (let r = 0; r < ROWS; r++) {
            if (Math.max(Math.abs(c - selUnit.col), Math.abs(r - selUnit.row)) > range) continue
            if (meta.kind === 'blink' && blockedAt(state, c, r)) continue
            tiles.push([c, r])
          }
        v.specialTiles = tiles
      }
    } else if (sel?.type === 'revive' && sel.reviveKey) {
      v.specialTiles = openDeployTiles(state, selUnit.owner)
    }
    return v
  }, [state, sel, selUnit, resolving])

  /* ---------- interactions ---------- */

  const onUnit = (u: Unit) => {
    if (state.winner || resolving) return
    if (sel?.type === 'item') {
      if (visuals.specialIds.includes(u.id)) {
        if (run('useItem', state.current, sel.item, { targetId: u.id })) setSel(null)
      } else setSel(null)
      return
    }
    if (sel?.type === 'special' && selUnit) {
      const meta = metaOf(selUnit)
      if (meta.kind === 'enemy' && visuals.specialIds.includes(u.id)) {
        if (run('planAttack', selUnit.id, u.id, true)) setSel(null)
        return
      }
      if (meta.kind === 'ally' && visuals.specialIds.includes(u.id)) {
        if (run('useAbility', selUnit.id, { targetId: u.id })) setSel(null)
        return
      }
      setSel(null)
      return
    }
    if (sel?.type === 'unit' && selUnit) {
      if (u.id === selUnit.id) return setSel(null)
      if (visuals.attackIds.includes(u.id)) {
        if (run('planAttack', selUnit.id, u.id, false)) setSel(null)
        return
      }
    }
    if (u.owner === state.current) setSel({ type: 'unit', id: u.id })
    else setSel({ type: 'enemy', id: u.id })
  }

  const onTile = (c: number, r: number) => {
    if (state.winner || resolving) return
    if (sel?.type === 'bench') {
      if (run('deploy', state.current, sel.key, c, r)) setSel(null)
      else if (!inDeployZone(state.current, r)) setSel(null)
      return
    }
    if (sel?.type === 'itemRevive' && sel.reviveKey) {
      if (visuals.specialTiles.some(([tc, tr]) => tc === c && tr === r)) {
        if (run('useItem', state.current, 'revive', { reviveKey: sel.reviveKey, col: c, row: r }))
          setSel(null)
        return
      }
      setSel(null)
      return
    }
    if (sel?.type === 'unit' && selUnit) {
      if (visuals.undoTile && visuals.undoTile[0] === c && visuals.undoTile[1] === r) {
        run('undoMove', selUnit.id)
        return
      }
      if (visuals.moveTiles.some(([mc, mr]) => mc === c && mr === r)) {
        run('moveUnit', selUnit.id, c, r)
        return
      }
      setSel(null)
      return
    }
    if (sel?.type === 'special' && selUnit) {
      const meta = metaOf(selUnit)
      if (meta.kind === 'tile' && visuals.specialTiles.some(([tc, tr]) => tc === c && tr === r)) {
        if (run('planArea', selUnit.id, { col: c, row: r })) setSel(null)
        return
      }
      if (meta.kind === 'blink' && visuals.specialTiles.some(([tc, tr]) => tc === c && tr === r)) {
        if (run('useAbility', selUnit.id, { col: c, row: r })) setSel(null)
        return
      }
      setSel(null)
      return
    }
    if (sel?.type === 'revive' && selUnit && sel.reviveKey) {
      if (visuals.specialTiles.some(([tc, tr]) => tc === c && tr === r)) {
        if (run('useAbility', selUnit.id, { reviveKey: sel.reviveKey, col: c, row: r }))
          setSel(null)
        return
      }
      setSel(null)
      return
    }
    setSel(null)
  }

  const onSpecialPress = () => {
    if (!selUnit) return
    const meta = metaOf(selUnit)
    if (meta.kind === 'self' || meta.kind === 'team') {
      if (run('useAbility', selUnit.id, {})) setSel(null)
    } else if (meta.kind === 'blink') {
      setSel({ type: 'special', id: selUnit.id })
    } else if (meta.kind === 'aoe') {
      if (run('planArea', selUnit.id)) setSel(null)
    } else if (meta.kind === 'revive') {
      setSel({ type: 'revive', id: selUnit.id, reviveKey: null })
    } else {
      setSel({ type: 'special', id: selUnit.id })
    }
  }

  const onItemPress = (item: ItemKey) => {
    if (state.winner || resolving) return
    if (item === 'revive') setSel({ type: 'itemRevive', reviveKey: null })
    else setSel(sel?.type === 'item' && sel.item === item ? null : { type: 'item', item })
  }

  const doEndTurn = () => {
    if (state.winner || resolving) return
    if (net) {
      if (state.current !== myOwner) return
      if (isGuest) {
        net.sendAction({ name: 'endTurn', args: [] })
        setSel(null)
        return
      }
    }
    setSel(null)
    setResolving(true)
  }

  doEndTurnRef.current = doEndTurn

  const restart = () => {
    // online rematches would need a fresh handshake; offline only
    const fresh = newBattle(draftA, draftB, blitz)
    setState(fresh)
    setSel(null)
    setFloats([])
    setResolving(false)
    startRef.current = Date.now()
    setElapsed(0)
    if (net?.role === 'host') net.sendState({ state: fresh, resolving: false })
  }

  /* ---------- rendering ---------- */

  const online = !!net
  // online: only your own board; local 2P: both; vs-AI: just A
  const owners: Owner[] = online ? [myOwner!] : mode === 'local' ? ['A', 'B'] : ['A']
  const solo = online || mode === 'ai'
  const interactiveFor = (o: Owner) =>
    !state.winner && !resolving && state.current === o &&
    !(mode === 'ai' && o === 'B') && (!online || o === myOwner)

  const playerLabel = (o: Owner) =>
    online
      ? o === myOwner ? 'You' : 'Opponent'
      : mode === 'ai' ? (o === 'A' ? 'You' : 'Rival') : o === 'A' ? 'Player 1' : 'Player 2'

  const shared = {
    state, mode, resolving, sel, selUnit, floats, elapsed, turnLeft, spawnIds, hitIds,
    dying, lunge, banner,
    onUnit, onTile,
    onInspectUnit: (u: Unit) => {
      if (state.winner) return
      setSel({ type: 'enemy', id: u.id }) // read-only inspect: info card + threat tiles
    },
    onInspect: (key: string) => setSel(sel?.type === 'card' && sel.key === key ? null : { type: 'card', key }),
    onTrade: (target: 'great' | 'ultra') => run('tradeBalls', state.current, target),
    onBench: (key: string) => setSel(sel?.type === 'bench' && sel.key === key ? null : { type: 'bench', key }),
    onSpecial: onSpecialPress,
    onCancelPlan: () => selUnit && run('cancelPlan', selUnit.id),
    onUndoMove: () => selUnit && run('undoMove', selUnit.id),
    onPickRevive: (key: string) => {
      if (sel?.type === 'itemRevive') setSel({ type: 'itemRevive', reviveKey: key })
      else if (selUnit) setSel({ type: 'revive', id: selUnit.id, reviveKey: key })
    },
    onItem: onItemPress,
    onEndTurn: doEndTurn,
  }

  return (
    <div className="battle">
      <div className="toolbar">
        <button className="btn btn-tiny" onClick={onExit}>‹ Menu</button>
        <span className="round-label">Round {state.round}</span>
        <div className="help-corner">
          <button className="btn btn-tiny help-btn" aria-label="Help">?</button>
          <div className="help-pop">
            <details>
              <summary>How to play</summary>
              <HowToPlay />
            </details>
            <details>
              <summary>Type synergies &amp; coverage</summary>
              <p className="help-note">Super effective +3 · resisted −2 (real Pokémon matchups).</p>
              <SynergyLegend />
            </details>
          </div>
        </div>
        <label className="volume-ctl" title="Volume — cries and battle sounds">
          <span className="volume-icon">♪</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100
              setVolume(v)
              setVolumeState(v)
            }}
            aria-label="Sound volume"
          />
        </label>
        {mode === 'local' && (
          <button className="btn btn-tiny" onClick={() => setTabletop((v) => !v)}>
            {tabletop ? 'Side-by-side' : 'Tabletop mode'}
          </button>
        )}
      </div>

      <div className={`panels ${solo ? 'panels-solo' : 'panels-two'}`}>
        {owners.map((o) => (
          <PlayerPanel
            key={o}
            owner={o}
            solo={solo}
            label={playerLabel(o)}
            interactive={interactiveFor(o)}
            rotated={tabletop && o === 'B'}
            visuals={interactiveFor(o) || sel?.type === 'enemy' ? visuals : undefined}
            {...shared}
          />
        ))}
      </div>

      {isGuest && !gotHostState && (
        <div className="overlay">
          <div className="overlay-card">
            <div className="overlay-title">Connecting…</div>
            <div className="overlay-sub">Waiting for the host to start the battle.</div>
          </div>
        </div>
      )}

      <WaveWipe active={waveActive} />

      {state.winner && winnerShown && (
        <div className="overlay">
          <div className="overlay-card">
            <div className="overlay-title">
              {mode === 'ai'
                ? state.winner === 'A' ? 'Victory' : 'Defeat'
                : `${playerLabel(state.winner)} wins`}
            </div>
            <div className="overlay-sub">
              {CHAMPIONS[state.players[otherOwner(state.winner)].championKey].name} fainted ·
              {' '}{state.round} rounds · {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
            </div>
            <GameSummary state={state} winner={state.winner} labelOf={playerLabel} />
            <div className="overlay-btns">
              <button className="btn btn-primary" onClick={restart}>Rematch</button>
              <button className="btn btn-ghost" onClick={onRedraft}>New draft</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- end-of-game summary ---------- */

function GameSummary({
  state, winner, labelOf,
}: { state: GameState; winner: Owner; labelOf: (o: Owner) => string }) {
  const spriteOf = (key: string) => ROSTER[key] ?? CHAMPIONS[key]
  return (
    <div className="summary">
      {(['A', 'B'] as Owner[]).map((o) => {
        const top = Object.entries(state.stats[o]).sort((a, b) => b[1] - a[1]).slice(0, 3)
        const captures = state.players[otherOwner(o)].fainted
        return (
          <div key={o} className={`summary-side ${o === winner ? 'summary-winner' : ''}`}>
            <div className="summary-name">{labelOf(o)}{o === winner ? ' — winner' : ''}</div>
            <div className="summary-row">
              <span className="hud-label">Top damage</span>
              {top.length === 0 && <em>none</em>}
              {top.map(([k, dmg]) => (
                <span key={k} className="dmg-entry" title={spriteOf(k).name}>
                  <Sprite dex={spriteOf(k).dex} name={spriteOf(k).name} tokenColor={TYPE_META[spriteOf(k).ptype].color} />
                  <b>{dmg}</b>
                </span>
              ))}
            </div>
            <div className="summary-row">
              <span className="hud-label">Captured</span>
              {captures.length === 0 && <em>none</em>}
              {captures.map((k, i) => (
                <Sprite key={`${k}-${i}`} dex={spriteOf(k).dex} name={spriteOf(k).name} tokenColor={TYPE_META[spriteOf(k).ptype].color} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ================= player panel ================= */

interface PanelProps {
  owner: Owner
  solo: boolean
  label: string
  state: GameState
  mode: 'ai' | 'local'
  resolving: boolean
  interactive: boolean
  rotated: boolean
  visuals?: BoardVisuals
  floats: FloatView[]
  sel: Sel
  selUnit?: Unit
  elapsed: number
  turnLeft: number
  spawnIds: Set<number>
  hitIds: Set<number>
  dying: DyingUnit[]
  lunge: Lunge | null
  banner: { text: string; key: number } | null
  onUnit: (u: Unit) => void
  onInspectUnit: (u: Unit) => void
  onTile: (c: number, r: number) => void
  onTrade: (target: 'great' | 'ultra') => void
  onBench: (key: string) => void
  onSpecial: () => void
  onCancelPlan: () => void
  onUndoMove: () => void
  onPickRevive: (key: string) => void
  onItem: (item: ItemKey) => void
  onInspect: (key: string) => void
  onEndTurn: () => void
}

function PlayerPanel(props: PanelProps) {
  const {
    owner, solo, label, state, mode, resolving, interactive, rotated, visuals, floats,
    onUnit, onTile, onTrade, onEndTurn, elapsed, turnLeft, spawnIds, hitIds,
    dying, lunge, banner,
  } = props
  const p = state.players[owner]
  const myTurn = state.current === owner && !state.winner
  const aiThinking = mode === 'ai' && state.current === 'B' && !state.winner


  const status = resolving
    ? 'Attacks landing…'
    : aiThinking && owner === 'A'
      ? 'Rival is planning…'
      : myTurn
        ? 'Your move'
        : 'Waiting…'

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <section className={`panel ${solo ? 'panel-solo' : ''} ${interactive ? 'panel-active' : 'panel-idle'} ${rotated ? 'panel-rotated' : ''}`}>
      {solo && <EnemySide {...props} />}

      <div className="board-col">
        <div className="board-area">
          <SkyMat />
          <BoardView
            state={state}
            perspective={owner}
            interactive={interactive}
            visuals={visuals}
            floats={floats}
            spawnIds={spawnIds}
            hitIds={hitIds}
            dying={dying}
            lunge={lunge}
            onTile={onTile}
            onUnit={onUnit}
            onInspectUnit={props.onInspectUnit}
          />
          {banner && (
            <div key={banner.key} className="turn-banner">{banner.text}</div>
          )}
        </div>
        <SynergyTracker state={state} owner={owner} />
      </div>

      <div className="side-stack">
        {!solo && (
          <div className="panel-head">
            <span className="panel-label">{label}</span>
          </div>
        )}

        {solo && <ChampionCard state={state} owner={owner} label={label} />}
        <div className="status-line">{status}</div>

        <div className="hud">
          <div className="hud-block">
            <span className="hud-label">Round</span>
            <span className="hud-value">{state.round}</span>
          </div>
          <div className="hud-block">
            <span className="hud-label">Time</span>
            <span className="hud-value">{mm}:{ss}</span>
          </div>
          <div className="hud-block">
            <span className="hud-label">Turn clock</span>
            <span className={`hud-value turn-clock ${myTurn && turnLeft <= 10 ? 'turn-clock-low' : ''}`}>
              {myTurn && !resolving ? `${Math.max(0, turnLeft)}s` : '—'}
            </span>
          </div>
          <div className="hud-block hud-moves">
            <span className="hud-label">Moves</span>
            <span className="moves-left">
              {Array.from({ length: MOVE_CAP }).map((_, i) => (
                <span key={i} className={`move-pip ${myTurn && i < state.movesLeft ? 'move-pip-on' : ''}`} />
              ))}
            </span>
          </div>
          <button className="btn btn-primary endturn endturn-hud" disabled={!interactive} onClick={onEndTurn}>
            End turn
          </button>
        </div>

        <ActionBar {...props} />

        <Inventory {...props} />

        {state.shopMode && <Shop {...props} />}

        {solo && !state.shopMode && (
          <div className="bench bench-grid">
            <BenchCards {...props} />
          </div>
        )}
        {!solo && !state.shopMode && <BenchStrip {...props} />}

        {/* the ball purse lives where End turn used to be — with a +N pop on gains */}
        <EconomyRow
          p={p}
          interactive={interactive}
          onTrade={onTrade}
        />

        <BattleStats state={state} owner={owner} />

        <div className="log">
          {state.log.slice(-6).map((l, i, arr) => (
            <div key={i} className={i === arr.length - 1 ? 'log-latest' : ''}>{l}</div>
          ))}
        </div>

        <MusicCorner />
      </div>
    </section>
  )
}

/* ---------- bench (left rail in solo, strip in 2P) ---------- */

function benchSorted(bench: string[]) {
  return [...bench].sort((a, b) => costEquiv(ROSTER[a].cost) - costEquiv(ROSTER[b].cost))
}

function BenchCards({ owner, state, sel, interactive, onBench }: PanelProps) {
  const p = state.players[owner]
  return (
    <>
      {benchSorted(p.bench).map((key) => {
        const s = ROSTER[key]
        const cd = p.cooldowns[key] ?? 0
        const ready = canDeployCard(p, key, state.shopMode) && fieldedCount(state, owner) < FIELD_CAP
        const selBench = sel?.type === 'bench' && sel.key === key && interactive
        return (
          <button
            key={key}
            className={`bench-card ${selBench ? 'sel' : ''} ${ready && interactive ? '' : 'dim'}`}
            disabled={!interactive || !ready}
            onClick={() => onBench(key)}
            style={{ ['--tc' as string]: TYPE_META[s.ptype].color }}
            title={`${s.name} — ${s.special}: ${s.hint}${cd > 0 ? ` (ready in ${cd})` : ''}`}
          >
            <Sprite dex={s.dex} name={s.name} tokenColor={TYPE_META[s.ptype].color} />
            <span className="bench-cost">
              <CostDots cost={s.cost} size={14} />
            </span>
            {cd > 0 && <span className="cooldown-badge">{cd}</span>}
          </button>
        )
      })}
    </>
  )
}

/* ---------- champion corner card: big portrait, HP, KOs, deaths, balls ---------- */

function ChampionCard({ state, owner, label }: { state: GameState; owner: Owner; label: string }) {
  const p = state.players[owner]
  const champ = state.units.find((u) => u.isChampion && u.owner === owner)
  const spec = CHAMPIONS[p.championKey]
  const kos = state.players[otherOwner(owner)].fainted.length
  const deaths = p.fainted.length
  const hp = champ?.hp ?? 0
  return (
    <div className={`champ-card-hud ${champ ? '' : 'champ-down'}`} style={{ ['--tc' as string]: TYPE_META[spec.ptype].color }}>
      <Sprite dex={spec.dex} name={spec.name} tokenColor={TYPE_META[spec.ptype].color} className="champ-hud-sprite" />
      <div className="champ-hud-info">
        <div className="champ-hud-name">{spec.name} <em>{label}</em></div>
        <div className="champ-hud-hpbar">
          <div className="champ-hud-hpfill" style={{ width: `${Math.max(0, (hp / spec.hp) * 100)}%` }} />
        </div>
        <div className="champ-hud-stats">
          <b>{hp}/{spec.hp}</b> HP · KOs <b>{kos}</b> · Lost <b>{deaths}</b> · Fielded <b>{fieldedCount(state, owner)}/{FIELD_CAP}</b>
        </div>
        <div className="champ-hud-balls">
          <BallSprite tier="poke" size={18} /><b>{p.poke}</b>
          <BallSprite tier="great" size={18} /><b>{p.great}</b>
          <BallSprite tier="ultra" size={18} /><b>{p.ultra}</b>
        </div>
      </div>
    </div>
  )
}

/* ---------- enemy intel rail: champion card + synergies + deck (hidden until deployed) ---------- */

function EnemySide(props: PanelProps) {
  const { state, owner, onInspect, sel } = props
  const foe = otherOwner(owner)
  const fp = state.players[foe]
  const foeLabel = props.mode === 'ai' ? 'Rival' : foe === 'A' ? 'Player 1' : 'Player 2'
  return (
    <div className="enemy-side">
      <ChampionCard state={state} owner={foe} label={foeLabel} />
      <SynergyTracker state={state} owner={foe} />
      <div className="enemy-deck" title="The rival's deck — cards reveal forever once deployed">
        {benchSorted(fp.bench).map((key) => {
          const s = ROSTER[key]
          const revealed = fp.revealed.includes(key)
          if (!revealed)
            return (
              <span key={key} className="enemy-card enemy-card-hidden" title="Not yet revealed">
                <i>?</i> Unknown
              </span>
            )
          const cd = fp.cooldowns[key] ?? 0
          return (
            <button
              key={key}
              className={`enemy-card ${sel?.type === 'card' && sel.key === key ? 'sel' : ''}`}
              style={{ ['--tc' as string]: TYPE_META[s.ptype].color }}
              onClick={() => onInspect(key)}
              title={`${s.name} — click for details`}
            >
              <Sprite dex={s.dex} name={s.name} tokenColor={TYPE_META[s.ptype].color} />
              <em>{s.name}</em>
              {cd > 0 && <span className="cd-inline">{cd}</span>}
            </button>
          )
        })}
        {state.shopMode && fp.bench.length === 0 && <span className="enemy-empty">No purchases yet</span>}
      </div>
    </div>
  )
}

/* ---------- blitz shop: 5 rotating Pokémon, restocked every turn — deploy straight from here ---------- */

function Shop({ state, owner, interactive, onBench, onInspect, sel }: PanelProps) {
  const p = state.players[owner]
  if (!interactive && state.current !== owner) return null
  return (
    <div className="shop">
      <span className="hud-label">Shop — restocks every turn, nothing is kept</span>
      <div className="shop-row">
        {p.shop.map((key) => {
          const s = ROSTER[key]
          const affordable = canAfford(p, s) && fieldedCount(state, owner) < FIELD_CAP
          const armed = sel?.type === 'bench' && sel.key === key
          return (
            <button
              key={key}
              className={`bench-card shop-card ${armed || (sel?.type === 'card' && sel.key === key) ? 'sel' : ''} ${affordable && interactive ? '' : 'dim'}`}
              onClick={() => (affordable && interactive ? onBench(key) : onInspect(key))}
              style={{ ['--tc' as string]: TYPE_META[s.ptype].color }}
              title={`${s.name} — ${s.special}: ${s.hint}`}
            >
              <Sprite dex={s.dex} name={s.name} tokenColor={TYPE_META[s.ptype].color} />
              <span className="bench-cost"><CostDots cost={s.cost} size={14} /></span>
            </button>
          )
        })}
        {p.shop.length === 0 && <span className="bench-empty">Sold out — restocks next turn</span>}
      </div>
    </div>
  )
}

function BenchStrip(props: PanelProps) {
  return (
    <div className="bench-row">
      <div className="bench">
        <BenchCards {...props} />
      </div>
    </div>
  )
}

/* ---------- synergy tracker ---------- */

function SynergyTracker({ state, owner }: { state: GameState; owner: Owner }) {
  const counts = synergyCounts(state.units, owner)
  const entries = (Object.keys(counts) as PType[])
    .filter((t) => SYNERGIES[t])
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
  if (!entries.length) return null
  return (
    <div className="synergies">
      {entries.map((t) => {
        const raw = counts[t] ?? 0
        const tier = raw >= SYNERGY_TIER2 ? 2 : raw >= SYNERGY_THRESHOLD ? 1 : 0
        // progress reads toward the NEXT tier: n/3, then n/5, then a maxed badge
        const label =
          tier === 2
            ? `${SYNERGIES[t]!.name} MAX`
            : tier === 1
              ? `${SYNERGIES[t]!.name} ${raw}/${SYNERGY_TIER2}`
              : `${TYPE_META[t].label} ${raw}/${SYNERGY_THRESHOLD}`
        return (
          <span
            key={t}
            className={`syn-chip ${tier >= 1 ? 'syn-on' : ''} ${tier === 2 ? 'syn-t2' : ''}`}
            style={{ ['--tc' as string]: TYPE_META[t].color }}
            title={`${SYNERGIES[t]!.name} — 3: ${SYNERGIES[t]!.desc} · 5: ${SYNERGIES[t]!.desc2} (unique Pokémon only)`}
          >
            <span className="syn-dot" />
            {label}
          </span>
        )
      })}
    </div>
  )
}

/* ---------- inventory ---------- */

function Inventory({ state, owner, sel, interactive, onItem, onPickRevive }: PanelProps) {
  const p = state.players[owner]
  if (!p.items.length && sel?.type !== 'itemRevive') return null
  return (
    <div className="inventory">
      <span className="hud-label">Items</span>
      <span className="inventory-row">
        {p.items.map((item, i) => (
          <button
            key={`${item}-${i}`}
            className={`item-btn ${sel?.type === 'item' && sel.item === item ? 'sel' : ''} ${sel?.type === 'itemRevive' && item === 'revive' ? 'sel' : ''}`}
            disabled={!interactive}
            onClick={() => onItem(item)}
            title={`${ITEMS[item].name} — ${ITEMS[item].desc}`}
          >
            <ItemSprite item={item} size={30} />
          </button>
        ))}
      </span>
      {sel?.type === 'item' && (
        <span className="inventory-hint">{ITEMS[sel.item].desc} — tap a highlighted Pokémon.</span>
      )}
      {sel?.type === 'itemRevive' && !sel.reviveKey && (
        <span className="revive-row">
          {state.players[owner].fainted.map((k) => (
            <button key={k} className="btn btn-tiny" onClick={() => onPickRevive(k)}>
              {ROSTER[k].name}
            </button>
          ))}
          {state.players[owner].fainted.length === 0 && <em>No one has fainted.</em>}
        </span>
      )}
      {sel?.type === 'itemRevive' && sel.reviveKey && (
        <span className="inventory-hint">Choose an empty tile in your deploy rows.</span>
      )}
    </div>
  )
}

/* ---------- the ball purse: counters that POP and float a +N when they grow ---------- */

function useGain(value: number) {
  const prev = useRef(value)
  const [fx, setFx] = useState<{ delta: number; key: number } | null>(null)
  useEffect(() => {
    const d = value - prev.current
    prev.current = value
    if (d > 0) {
      setFx({ delta: d, key: Date.now() })
      const t = window.setTimeout(() => setFx(null), 1100)
      return () => clearTimeout(t)
    }
  }, [value])
  return fx
}

function EconomyRow({
  p, interactive, onTrade,
}: {
  p: GameState['players']['A']
  interactive: boolean
  onTrade: (target: 'great' | 'ultra') => void
}) {
  const pokeFx = useGain(p.poke)
  const greatFx = useGain(p.great)
  const ultraFx = useGain(p.ultra)
  const item = (tier: 'poke' | 'great' | 'ultra', n: number, fx: ReturnType<typeof useGain>) => (
    <span className="econ-item econ-item-big">
      <BallSprite tier={tier} size={30} />
      <b key={fx?.key ?? 0} className={fx ? 'econ-pop' : ''}>{n}</b>
      {fx && <span key={`g${fx.key}`} className="econ-gain">+{fx.delta}</span>}
    </span>
  )
  return (
    <div className="econ-row">
      {item('poke', p.poke, pokeFx)}
      {item('great', p.great, greatFx)}
      {item('ultra', p.ultra, ultraFx)}
      <button
        className="trade-btn trade-btn-great"
        disabled={!interactive || p.poke < TRADE_GREAT_COST || p.great >= GREAT_CAP}
        onClick={() => onTrade('great')}
        title={`Trade ${TRADE_GREAT_COST} Poké Balls for a Great Ball`}
      >
        {TRADE_GREAT_COST}× <BallSprite tier="poke" size={20} /> → <BallSprite tier="great" size={20} />
      </button>
      <button
        className="trade-btn trade-btn-ultra"
        disabled={!interactive || p.poke < TRADE_ULTRA_COST || p.ultra >= ULTRA_CAP}
        onClick={() => onTrade('ultra')}
        title={`Trade ${TRADE_ULTRA_COST} Poké Balls for an Ultra Ball`}
      >
        {TRADE_ULTRA_COST}× <BallSprite tier="poke" size={20} /> → <BallSprite tier="ultra" size={20} />
      </button>
    </div>
  )
}

/* ---------- battle stats: captures + top damage ---------- */

function BattleStats({ state, owner }: { state: GameState; owner: Owner }) {
  const captures = state.players[otherOwner(owner)].fainted
  const losses = state.players[owner].fainted
  const top = Object.entries(state.stats[owner])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  if (!captures.length && !losses.length && !top.length) return null
  const spriteOf = (key: string) => ROSTER[key] ?? CHAMPIONS[key]
  return (
    <div className="battle-stats">
      {captures.length > 0 && (
        <div className="stat-row">
          <span className="hud-label">Captured</span>
          <span className="stat-sprites">
            {captures.map((k, i) => (
              <Sprite key={`${k}-${i}`} dex={spriteOf(k).dex} name={spriteOf(k).name} tokenColor={TYPE_META[spriteOf(k).ptype].color} />
            ))}
          </span>
        </div>
      )}
      {losses.length > 0 && (
        <div className="stat-row">
          <span className="hud-label">Lost</span>
          <span className="stat-sprites stat-lost">
            {losses.map((k, i) => (
              <Sprite key={`${k}-${i}`} dex={spriteOf(k).dex} name={spriteOf(k).name} tokenColor={TYPE_META[spriteOf(k).ptype].color} />
            ))}
          </span>
        </div>
      )}
      {top.length > 0 && (
        <div className="stat-row">
          <span className="hud-label">Top damage</span>
          <span className="stat-sprites">
            {top.map(([k, dmg]) => (
              <span key={k} className="dmg-entry" title={spriteOf(k).name}>
                <Sprite dex={spriteOf(k).dex} name={spriteOf(k).name} tokenColor={TYPE_META[spriteOf(k).ptype].color} />
                <b>{dmg}</b>
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}

/* ---------- action bar ---------- */

/** Species datasheet shown when a card (bench, shop, or revealed enemy) is inspected. */
function SpeciesInfo({ speciesKey }: { speciesKey: string }) {
  const s = ROSTER[speciesKey]
  if (!s) return null
  const { moves, atks } = buildMoveAtk(s.move, s.range)
  const spcCells = buildSpecial(s.pattern, s.targeting.rangeOverride ?? s.range)
  const isSupport = ['self', 'ally', 'team'].includes(s.pattern)
  return (
    <div className="actionbar">
      <div className="ab-main">
        <span className="ab-name">
          <Sprite dex={s.dex} name={s.name} tokenColor={TYPE_META[s.ptype].color} className="ab-sprite" />
          {s.name}
          <em className="type-chip" style={{ background: TYPE_META[s.ptype].color }}>{TYPE_META[s.ptype].label}</em>
          <em className="role-chip">{ROLE_META[s.role].label}</em>
          <em className="role-chip"><CostDots cost={s.cost} size={14} /></em>
        </span>
        <span className="ab-stats">
          {s.hp} HP · ATK {s.atk} · RNG {s.range} · MOV {s.move} · CD {s.cooldown}
        </span>
      </div>
      <div className="ab-body">
        <div className="ab-patterns">
          <PatternGrid label="Move · attack" moves={moves} atks={atks} size={64} />
          <PatternGrid label={isSupport ? 'Support' : 'Special'} spc={spcCells} shape={s.pattern} size={64} />
        </div>
        <div className="ab-special">
          <span className="ab-special-name">{s.special}</span>
          <span className="ab-hint">{s.hint}</span>
          {s.tier !== 'poke' && <span className="ab-hint">Needs a turn to land after deploying.</span>}
        </div>
      </div>
    </div>
  )
}

function ActionBar({
  state, owner, sel, selUnit, interactive, onSpecial, onCancelPlan, onUndoMove, onPickRevive,
}: PanelProps) {
  if (sel?.type === 'bench' || sel?.type === 'card') return <SpeciesInfo speciesKey={sel.key} />
  if (!selUnit || (!interactive && sel?.type !== 'enemy'))
    return (
      <div className="actionbar actionbar-empty">
        {interactive
          ? 'Select a Pokémon to command it. Attacks land when the turn ends.'
          : ' '}
      </div>
    )

  const u = selUnit
  const mine = u.owner === owner
  const meta = metaOf(u)
  const charged = u.charge >= u.chargeMax
  const usedUp = u.isChampion && CHAMPIONS[u.key].once && u.abilityUsed
  const role = roleOf(u)
  const ptype = ptypeOf(u)
  const spc = u.isChampion ? CHAMPIONS[u.key] : ROSTER[u.key]
  const { moves, atks } = buildMoveAtk(effMove(state.units, u), effRange(state.units, u))
  const spcCells = buildSpecial(spc.pattern, meta.rangeOverride ?? u.range)

  let hint = ''
  if (sel?.type === 'special') {
    hint =
      meta.kind === 'tile' ? 'Choose a target tile.' :
      meta.kind === 'blink' ? 'Choose an empty tile to teleport to.' :
      meta.kind === 'ally' ? 'Choose an ally to heal.' : 'Choose a target.'
  } else if (sel?.type === 'revive') {
    hint = sel.reviveKey ? 'Choose an empty tile in your deploy rows.' : 'Choose who returns.'
  } else if (sel?.type === 'enemy') {
    hint = 'Red tiles show everywhere it can strike next turn.'
  } else if (mine) {
    if (u.planned) hint = 'Attack declared — it lands when the turn ends.'
    else if (u.summoned) hint = 'Just deployed — ready next turn.'
    else if (u.stunned) hint = 'Stunned — it can attack, but not move this turn.'
  }

  return (
    <div className="actionbar">
      <div className="ab-main">
        <span className="ab-name">
          <Sprite dex={dexOf(u)} name={nameOf(u)} tokenColor={TYPE_META[ptype].color} className="ab-sprite" />
          {nameOf(u)}
          <em className="type-chip" style={{ background: TYPE_META[ptype].color }}>{TYPE_META[ptype].label}</em>
          {role && <em className="role-chip">{ROLE_META[role].label}</em>}
          {u.isChampion && <em className="role-chip role-chip-champ">Champion</em>}
          {u.heldItem && <em className="role-chip">{ITEMS[u.heldItem].name}</em>}
        </span>
        <span className="ab-stats">
          {u.hp}/{u.maxHp} HP · ATK {effAtk(state.units, u)} · RNG {effRange(state.units, u)} · MOV {effMove(state.units, u)}
        </span>
      </div>
      <div className="ab-body">
        <div className="ab-patterns">
          <PatternGrid label="Move · attack" moves={moves} atks={atks} size={64} />
          <PatternGrid label={spc.pattern === 'self' || spc.pattern === 'ally' || spc.pattern === 'team' ? 'Support' : 'Special'} spc={spcCells} shape={spc.pattern} size={64} />
        </div>
        <div className="ab-special">
          <span className="ab-special-name">
            {specialNameOf(u)}
            <span className="pips">
              {Array.from({ length: u.chargeMax }).map((_, i) => (
                <span key={i} className={`pip ${i < u.charge ? 'pip-full' : ''}`} />
              ))}
            </span>
          </span>
          <span className="ab-hint">{hint || specialHintOf(u)}</span>
          {sel?.type === 'revive' && !sel.reviveKey && (
            <span className="revive-row">
              {state.players[u.owner].fainted.map((k) => (
                <button key={k} className="btn btn-tiny" onClick={() => onPickRevive(k)}>
                  {ROSTER[k].name}
                </button>
              ))}
              {state.players[u.owner].fainted.length === 0 && <em>No one has fainted yet.</em>}
            </span>
          )}
          {mine && interactive && sel?.type === 'unit' && (
            <span className="ab-btns">
              {u.planned && (
                <button className="btn btn-tiny" onClick={onCancelPlan}>Cancel attack</button>
              )}
              {u.moved && u.movedFrom && (
                <button className="btn btn-tiny" onClick={onUndoMove}>Undo move</button>
              )}
              {!u.planned && (
                <button
                  className="btn btn-gold"
                  disabled={!charged || !!usedUp || !canActNow(state, u)}
                  onClick={onSpecial}
                >
                  {usedUp ? 'Used' : charged ? `Use ${specialNameOf(u)}` : 'Charging…'}
                </button>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
