import { useMemo, useRef, useState } from 'react'
import {
  CHAMPIONS,
  CHAMPION_ORDER,
  DRAFT_SIZE,
  ROLE_META,
  ROSTER,
  SYNERGIES,
  TIER_META,
  TYPE_META,
  costEquiv,
} from '../game/data'
import type { BallTier, ChampionSpecies, DraftResult, Role, Species } from '../game/types'
import { CostDots, Sprite } from './Sprite'
import { PatternGrid, buildMoveAtk, buildSpecial } from './PatternGrid'

type SortKey = 'cost' | 'atk' | 'hp' | 'range' | 'type'
const tierRank = { poke: 0, great: 1, ultra: 2 } as const
const HOLD_MS = 420

/** Tap = quick action, press-and-hold = details. */
function HoldButton({
  onTap,
  onHold,
  ...rest
}: { onTap: () => void; onHold: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const timer = useRef<number | null>(null)
  const held = useRef(false)
  const start = () => {
    held.current = false
    timer.current = window.setTimeout(() => {
      held.current = true
      onHold()
    }, HOLD_MS)
  }
  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    if (!held.current) onTap()
  }
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    held.current = true
  }
  return (
    <button
      {...rest}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
    />
  )
}

/** All twelve type synergies, for the menu and draft screens. */
export function SynergyLegend() {
  return (
    <div className="syn-legend">
      <p className="syn-legend-note">
        The numbers are how many UNIQUE same-type Pokémon you need fielded at once
        (3 unlocks the effect, 5 upgrades it). Your champion counts — duplicates don't.
      </p>
      {(Object.keys(SYNERGIES) as (keyof typeof SYNERGIES)[]).map((t) => (
        <div key={t} className="syn-legend-row">
          <em className="type-chip" style={{ background: TYPE_META[t]!.color }}>{TYPE_META[t]!.label}</em>
          <b>{SYNERGIES[t]!.name}</b>
          <span><b>3:</b> {SYNERGIES[t]!.desc} · <b>5:</b> {SYNERGIES[t]!.desc2}</span>
        </div>
      ))}
    </div>
  )
}

export function Draft({
  label,
  championOnly = false,
  onBack,
  onDone,
}: {
  label: string
  championOnly?: boolean
  onBack?: () => void
  onDone: (r: DraftResult) => void
}) {
  const [champion, setChampion] = useState<string | null>(null)
  const [picks, setPicks] = useState<string[]>([])
  const [detail, setDetail] = useState<string | null>(null) // species or champion key
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [tierFilter, setTierFilter] = useState<BallTier | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('cost')
  const [search, setSearch] = useState('')

  const toggle = (key: string) =>
    setPicks((p) =>
      p.includes(key) ? p.filter((k) => k !== key) : p.length < DRAFT_SIZE ? [...p, key] : p,
    )

  const roster = useMemo(() => {
    let list = Object.values(ROSTER)
    if (search.trim()) list = list.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    if (roleFilter !== 'all') list = list.filter((s) => s.role === roleFilter)
    if (tierFilter !== 'all') list = list.filter((s) => s.tier === tierFilter)
    list = [...list].sort((a, b) =>
      sort === 'cost'
        ? costEquiv(a.cost) - costEquiv(b.cost) || tierRank[a.tier] - tierRank[b.tier]
        : sort === 'atk'
          ? b.atk - a.atk
          : sort === 'range'
            ? b.range - a.range
            : sort === 'type'
              ? a.ptype.localeCompare(b.ptype) || costEquiv(a.cost) - costEquiv(b.cost)
              : b.hp - a.hp,
    )
    return list
  }, [roleFilter, tierFilter, sort, search])

  const ready = champion && (championOnly || picks.length === DRAFT_SIZE)
  const detailSpecies: Species | ChampionSpecies | null = detail
    ? (ROSTER[detail] ?? CHAMPIONS[detail] ?? null)
    : null

  return (
    <div className="draft">
      <div className="ball-wallpaper" aria-hidden="true" />
      <header className="draft-head">
        {onBack && (
          <button className="btn btn-tiny draft-back" onClick={onBack}>‹ Back</button>
        )}
        <div className="draft-player">{label}</div>
        <h2>Draft your team</h2>
        <p className="draft-sub">One Mythical champion, {DRAFT_SIZE} Pokémon. Tap to pick — hold a card for the full breakdown.</p>
      </header>

      <div className="section-label">Champion</div>
      <div className="champ-grid">
        {CHAMPION_ORDER.map((key) => {
          const c = CHAMPIONS[key]
          const sel = champion === key
          return (
            <HoldButton
              key={key}
              className={`card champ-card ${sel ? 'sel' : ''}`}
              style={{ ['--tc' as string]: TYPE_META[c.ptype].color }}
              onTap={() => setChampion(key)}
              onHold={() => setDetail(key)}
            >
              {sel && <span className="picked-mark">✓</span>}
              <Sprite dex={c.dex} name={c.name} tokenColor={TYPE_META[c.ptype].color} className="card-sprite" />
              <div className="card-name">{c.name}</div>
              <div className="card-type" style={{ color: TYPE_META[c.ptype].color }}>{TYPE_META[c.ptype].label}</div>
              <div className="card-hint"><b>{c.ability}</b></div>
            </HoldButton>
          )
        })}
      </div>

      {championOnly && (
        <>
          <div className="section-label">Type synergies</div>
          <SynergyLegend />
        </>
      )}

      {!championOnly && (<>
      <div className="section-label">
        Roster <span className="pick-count">{picks.length}/{DRAFT_SIZE}</span>
      </div>
      <details className="syn-details">
        <summary>Type synergies — plan your draft around them</summary>
        <SynergyLegend />
      </details>
      <div className="filterbar">
        <input
          className="draft-search"
          placeholder="Search Pokémon"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="filter-group">
          {(['all', 'tank', 'dealer', 'specialist', 'generalist'] as const).map((r) => (
            <button
              key={r}
              className={`chip ${roleFilter === r ? 'chip-on' : ''}`}
              onClick={() => setRoleFilter(r)}
            >
              {r === 'all' ? 'All roles' : ROLE_META[r].label}
            </button>
          ))}
        </span>
        <span className="filter-group">
          {(['all', 'poke', 'great', 'ultra'] as const).map((t) => (
            <button
              key={t}
              className={`chip ${tierFilter === t ? 'chip-on' : ''}`}
              onClick={() => setTierFilter(t)}
            >
              {t === 'all' ? 'All balls' : TIER_META[t].short}
            </button>
          ))}
        </span>
        <span className="filter-group">
          {(['cost', 'atk', 'hp', 'range', 'type'] as const).map((s) => (
            <button
              key={s}
              className={`chip ${sort === s ? 'chip-on' : ''}`}
              onClick={() => setSort(s)}
            >
              {s === 'cost' ? 'By cost' : s === 'atk' ? 'By attack' : s === 'hp' ? 'By HP' : s === 'range' ? 'By range' : 'By type'}
            </button>
          ))}
        </span>
      </div>

      <div className="roster-grid">
        {roster.map((s) => {
          const sel = picks.includes(s.key)
          return (
            <HoldButton
              key={s.key}
              className={`card ${sel ? 'sel' : ''}`}
              style={{ ['--tc' as string]: TYPE_META[s.ptype].color }}
              onTap={() => toggle(s.key)}
              onHold={() => setDetail(s.key)}
            >
              {sel && <span className="picked-mark">✓</span>}
              <div className="card-top">
                <CostDots cost={s.cost} size={15} />
                <span className="card-type" style={{ color: TYPE_META[s.ptype].color }}>{TYPE_META[s.ptype].label}</span>
              </div>
              <Sprite dex={s.dex} name={s.name} tokenColor={TYPE_META[s.ptype].color} className="card-sprite" />
              <div className="card-name">{s.name}</div>
              <div className="card-stats">
                {s.hp} HP · {s.atk} ATK · RNG {s.range} · MOV {s.move}
              </div>
            </HoldButton>
          )
        })}
      </div>
      </>)}

      <footer className="draft-foot">
        <button
          className="btn btn-primary"
          disabled={!ready}
          onClick={() => ready && onDone({ champion: champion!, picks })}
        >
          {ready
            ? championOnly ? 'Lock in champion' : 'Lock in team'
            : champion ? `Pick ${DRAFT_SIZE - picks.length} more` : 'Choose a champion'}
        </button>
      </footer>

      {detailSpecies && (
        <DetailModal
          entry={detailSpecies}
          isChampion={!!CHAMPIONS[detail!]}
          picked={detail ? picks.includes(detail) : false}
          isCurrentChampion={champion === detail}
          canPick={picks.length < DRAFT_SIZE}
          onClose={() => setDetail(null)}
          onPick={() => {
            if (!detail) return
            if (CHAMPIONS[detail]) setChampion(detail)
            else toggle(detail)
            setDetail(null)
          }}
        />
      )}
    </div>
  )
}

function DetailModal({
  entry,
  isChampion,
  picked,
  isCurrentChampion,
  canPick,
  onClose,
  onPick,
}: {
  entry: Species | ChampionSpecies
  isChampion: boolean
  picked: boolean
  isCurrentChampion: boolean
  canPick: boolean
  onClose: () => void
  onPick: () => void
}) {
  const tc = TYPE_META[entry.ptype].color
  const { moves, atks } = buildMoveAtk(entry.move, entry.range)
  const spcCells = buildSpecial(entry.pattern, entry.targeting.rangeOverride ?? entry.range)
  const specialName = 'special' in entry ? entry.special : entry.ability
  const isSupport = ['self', 'ally', 'team'].includes(entry.pattern)
  const role = 'role' in entry ? entry.role : null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ ['--tc' as string]: tc }} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="modal-hero">
          <Sprite dex={entry.dex} name={entry.name} tokenColor={tc} className="modal-sprite" />
          <div>
            <h3 className="modal-name">{entry.name}</h3>
            <div className="modal-tags">
              <em className="type-chip" style={{ background: tc }}>{TYPE_META[entry.ptype].label}</em>
              {role && <em className="role-chip">{ROLE_META[role].label}</em>}
              {isChampion && <em className="role-chip role-chip-champ">Champion</em>}
              {'cost' in entry && (
                <em className="role-chip modal-cost">
                  <CostDots cost={entry.cost} size={16} />
                </em>
              )}
              {'cooldown' in entry && (
                <em className="role-chip">Redeploy: {entry.cooldown} turn{entry.cooldown > 1 ? 's' : ''}</em>
              )}
            </div>
          </div>
        </div>
        <div className="modal-stats">
          <span><b>{entry.hp}</b> HP</span>
          <span><b>{entry.atk}</b> ATK</span>
          <span><b>{entry.range}</b> Range</span>
          <span><b>{entry.move}</b> Move</span>
          <span><b>{entry.chargeMax}</b> Charge</span>
        </div>
        <div className="modal-patterns">
          <PatternGrid label="Move · attack" moves={moves} atks={atks} size={104} />
          <PatternGrid label={isSupport ? 'Support' : 'Special'} spc={spcCells} shape={entry.pattern} size={104} />
        </div>
        <div className="modal-special">
          <b>{specialName}</b> — {entry.hint}
        </div>
        <button className="btn btn-primary modal-pick" disabled={!isChampion && !picked && !canPick} onClick={onPick}>
          {isChampion
            ? isCurrentChampion ? 'Champion chosen ✓' : 'Choose as champion'
            : picked ? 'Remove from team' : 'Add to team'}
        </button>
      </div>
    </div>
  )
}
