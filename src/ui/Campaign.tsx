import { useState } from 'react'
import { LADDER, isUnlocked, loadCampaign, rewardsOf, resetCampaign, type CampaignSave, type Opponent } from '../game/campaign'
import { CHAMPIONS, ROSTER, TYPE_META, costEquiv, typeInk } from '../game/data'
import { CostDots, Sprite } from './Sprite'

const DIFF_LABEL = { easy: 'Relaxed', normal: 'Trainer', hard: 'Champion' } as const

/** The ladder: who you can fight, what they field, and what they hand over. */
export function CampaignLadder({
  save,
  onFight,
  onBook,
  onBack,
  onReset,
}: {
  save: CampaignSave
  onFight: (o: Opponent) => void
  onBook: () => void
  onBack: () => void
  onReset: () => void
}) {
  return (
    <div className="menu campaign-menu">
      <div className="ball-wallpaper" aria-hidden="true" />
      <div className="campaign-head">
        <button className="btn btn-tiny" onClick={onBack}>‹ Menu</button>
        <button className="btn btn-tiny" onClick={onBook}>Card book · {save.cards.length}/{Object.keys(ROSTER).length}</button>
      </div>
      <h1 className="menu-title">Campaign</h1>
      <p className="menu-sub">
        Every trainer fields cards you do not own. Beat them and those cards are yours —
        your deck grows in the direction you just fought.
      </p>

      <ol className="ladder">
        {LADDER.map((o, i) => {
          const beaten = save.beaten.includes(o.id)
          const open = isUnlocked(save, i)
          const rewards = rewardsOf(o)
          const owed = rewards.filter((k) => !save.cards.includes(k))
          return (
            <li key={o.id} className={`ladder-row ${beaten ? 'is-beaten' : ''} ${open ? '' : 'is-locked'}`}>
              <div className="ladder-rank">{String(i + 1).padStart(2, '0')}</div>
              <Sprite
                dex={CHAMPIONS[o.champion]?.dex ?? 0}
                name={o.champion}
                tokenColor={TYPE_META[CHAMPIONS[o.champion]?.ptype ?? 'normal'].color}
                className="ladder-sprite"
              />
              <div className="ladder-body">
                <div className="ladder-name">
                  {o.name} <em>{o.title}</em>
                  <span className={`diff-chip diff-${o.difficulty}`}>{DIFF_LABEL[o.difficulty]}</span>
                  {beaten && <span className="ladder-tick">✓</span>}
                </div>
                <div className="ladder-blurb">{open ? o.blurb : 'Beat the trainer above to challenge them.'}</div>
                {open && (
                  <div className="ladder-rewards">
                    <span className="ladder-rewards-label">
                      {owed.length ? `Wins you ${owed.length} new` : 'All collected'}
                    </span>
                    {rewards.map((k) => (
                      <span key={k} className={`reward-pill ${save.cards.includes(k) ? 'is-owned' : ''}`}>
                        <Sprite dex={ROSTER[k]?.dex ?? 0} name={k} tokenColor={TYPE_META[ROSTER[k]?.ptype ?? 'normal'].color} />
                        {ROSTER[k]?.name ?? k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn btn-primary ladder-go" disabled={!open} onClick={() => onFight(o)}>
                {beaten ? 'Rematch' : 'Challenge'}
              </button>
            </li>
          )
        })}
      </ol>

      <button className="btn btn-tiny campaign-reset" onClick={onReset}>Reset campaign</button>
    </div>
  )
}

/** The collection: everything in the game, owned or still to find. */
export function CardBook({ save, onBack }: { save: CampaignSave; onBack: () => void }) {
  const [tier, setTier] = useState<'all' | 'poke' | 'great' | 'ultra'>('all')
  const all = Object.values(ROSTER)
    .filter((s) => tier === 'all' || s.tier === tier)
    .sort((a, b) => costEquiv(a.cost) - costEquiv(b.cost) || a.name.localeCompare(b.name))
  const owned = all.filter((s) => save.cards.includes(s.key)).length
  const onLadder = new Set([...save.cards, ...LADDER.flatMap((o) => rewardsOf(o))])
  const offLadder = all.filter((s) => !onLadder.has(s.key)).length

  return (
    <div className="menu campaign-menu">
      <div className="ball-wallpaper" aria-hidden="true" />
      <div className="campaign-head">
        <button className="btn btn-tiny" onClick={onBack}>‹ Campaign</button>
      </div>
      <h1 className="menu-title">Card book</h1>
      <p className="menu-sub">
        {owned} of {all.length} collected{tier === 'all' ? '' : ' in this tier'}.
        {offLadder > 0 && ` ${offLadder} are not on the current ladder yet — more trainers will carry them.`}
      </p>

      <div className="draft-style book-filter">
        {(['all', 'poke', 'great', 'ultra'] as const).map((t) => (
          <button key={t} className={`chip ${tier === t ? 'chip-on' : ''}`} onClick={() => setTier(t)}>
            {t === 'all' ? 'Everything' : t === 'poke' ? 'Poké Ball' : t === 'great' ? 'Great Ball' : 'Ultra Ball'}
          </button>
        ))}
      </div>

      <div className="book-grid">
        {all.map((s) => {
          const have = save.cards.includes(s.key)
          return (
            <div key={s.key} className={`book-card ${have ? '' : 'is-locked'}`} title={have ? s.name : 'Not collected yet'}>
              <Sprite dex={s.dex} name={have ? s.name : '?'} tokenColor={TYPE_META[s.ptype].color} className="book-sprite" />
              <div className="book-name">{have ? s.name : '???'}</div>
              {have ? (
                <>
                  <div className="book-type" style={{ color: typeInk(s.ptype) }}>{TYPE_META[s.ptype].label}</div>
                  <CostDots cost={s.cost} size={12} />
                </>
              ) : (
                <div className="book-locked-note">Not collected</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { loadCampaign, resetCampaign }

/** Shown after a campaign win — the cards you just took off the trainer. */
export function RewardScreen({
  opp,
  gained,
  onDone,
}: {
  opp: Opponent
  gained: string[]
  onDone: () => void
}) {
  return (
    <div className="menu campaign-menu reward-screen">
      <div className="ball-wallpaper" aria-hidden="true" />
      <h1 className="menu-title">{opp.name} defeated</h1>
      <p className="menu-sub">
        {gained.length
          ? 'These are yours now — they are in the draft pool from the next match on.'
          : 'You already own everything this trainer had. The rematch was for the practice.'}
      </p>
      {gained.length > 0 && (
        <div className="reward-grid">
          {gained.map((k) => (
            <div key={k} className="card reward-card" style={{ ['--tc' as string]: TYPE_META[ROSTER[k].ptype].color }}>
              <Sprite dex={ROSTER[k].dex} name={ROSTER[k].name} tokenColor={TYPE_META[ROSTER[k].ptype].color} className="card-sprite" />
              <div className="card-name">{ROSTER[k].name}</div>
              <div className="card-type" style={{ color: typeInk(ROSTER[k].ptype) }}>{TYPE_META[ROSTER[k].ptype].label}</div>
              <CostDots cost={ROSTER[k].cost} size={13} />
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-primary" onClick={onDone}>Back to the ladder</button>
    </div>
  )
}
