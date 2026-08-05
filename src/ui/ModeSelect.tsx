import { useState } from 'react'
import type { Difficulty } from '../game/ai'
import { BallSprite, CostDots, Sprite } from './Sprite'
import { SynergyLegend } from './Draft'
import {
  CHAMPIONS,
  DROPS,
  FIELD_CAP,
  ITEMS,
  ROSTER,
  SUMMONS,
  SUMMON_ORDER,
  TYPE_META,
  costEquiv,
} from '../game/data'

/** The rules list, shared between the menu and the in-match help corner. */
export function HowToPlay() {
  return (
    <ul>
      <li>Pick a Mythical champion and draft 8 Pokémon (or buy live from the shop in Blitz). Type matchups are real — super effective hits deal 1.5×, resisted hits half.</li>
      <li>Deploy zones scale with cost: Poké-tier lands up to 4 rows deep, Great-tier 3, Ultra-tier 2 (max {FIELD_CAP} fielded at once). Trade 3 Poké Balls for a Great Ball, 6 for an Ultra. No Pokémon attacks the turn it lands, but it may move.</li>
      <li>Each turn, up to 3 of your Pokémon may move. If the turn clock is on, it ends your turn at zero. Undo is free until you declare an attack.</li>
      <li>Attacks are declared during your turn and all land together when you end it. Every KO pays you a Poké Ball.</li>
      <li>If your champion moves, nothing else may move that turn. Guard it well.</li>
      <li>Field Poké Balls drop every 3 rounds — walk onto one for items.</li>
      <li>You also draft 2 legendary summons — battlefield effects cast for Poké Balls, re-castable as long as you can pay. Knock out the enemy champion to win.</li>
    </ul>
  )
}

/** The full readable game doc: every Pokémon's numbers, champions, and drop odds. */
export function Compendium() {
  const totalW = DROPS.reduce((n, d) => n + d.weight, 0)
  const roster = Object.values(ROSTER).sort(
    (a, b) => costEquiv(a.cost) - costEquiv(b.cost) || a.name.localeCompare(b.name),
  )
  const half = Math.ceil(roster.length / 2)
  const columns = [roster.slice(0, half), roster.slice(half)]
  return (
    <div className="compendium">
      <h4>Every Pokémon</h4>
      <div className="comp-two">
        {columns.map((col, ci) => (
          <div className="comp-scroll" key={ci}>
            <table className="comp-roster">
              <thead>
                <tr>
                  <th>Pokémon</th><th>Type</th><th>Cost</th><th>HP</th><th>ATK</th>
                  <th>RNG</th><th>MOV</th><th>Chg</th><th>CD</th>
                </tr>
              </thead>
              <tbody>
                {col.map((s) => (
                  <tr key={s.key}>
                    <td className="comp-name">
                      <Sprite dex={s.dex} name={s.name} tokenColor={TYPE_META[s.ptype].color} />
                      {s.name}
                    </td>
                    <td><em className="type-chip" style={{ background: TYPE_META[s.ptype].color }}>{TYPE_META[s.ptype].label}</em></td>
                    <td><CostDots cost={s.cost} size={13} /></td>
                    <td>{s.hp}</td><td>{s.atk}</td><td>{s.range}</td><td>{s.move}</td>
                    <td>{s.chargeMax}</td><td>{s.cooldown}t</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <h4>Champions</h4>
      <div className="comp-scroll">
        <table>
          <thead>
            <tr><th>Champion</th><th>Type</th><th>HP</th><th>ATK</th><th>RNG</th><th>MOV</th><th>Charge</th><th>Ability</th></tr>
          </thead>
          <tbody>
            {Object.values(CHAMPIONS).map((c) => (
              <tr key={c.key}>
                <td className="comp-name">
                  <Sprite dex={c.dex} name={c.name} tokenColor={TYPE_META[c.ptype].color} />
                  {c.name}
                </td>
                <td><em className="type-chip" style={{ background: TYPE_META[c.ptype].color }}>{TYPE_META[c.ptype].label}</em></td>
                <td>{c.hp}</td><td>{c.atk}</td><td>{c.range}</td><td>{c.move}</td>
                <td>{c.chargeMax}{c.once ? ' (once)' : ''}</td>
                <td className="comp-special"><b>{c.ability}</b> — {c.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4>Legendary summons — draft 2, cast for Poké Balls, re-castable</h4>
      <div className="comp-scroll">
        <table>
          <thead>
            <tr><th>Summon</th><th>Cost</th><th>Effect</th></tr>
          </thead>
          <tbody>
            {SUMMON_ORDER.map((k) => {
              const s = SUMMONS[k]
              return (
                <tr key={k}>
                  <td className="comp-name">
                    <Sprite dex={s.dex} name={s.name} tokenColor="#f5a524" />
                    {s.name}
                  </td>
                  <td><span className="summon-cost-line"><BallSprite tier="poke" size={14} />{s.cost}</span></td>
                  <td className="comp-special">{s.desc}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h4>Field Poké Ball drop rates</h4>
      <div className="comp-scroll comp-drops">
        <table>
          <thead><tr><th>Drop</th><th>Chance</th></tr></thead>
          <tbody>
            {DROPS.map((d, i) => {
              const name = d.drop.type === 'ball'
                ? `${d.drop.tier === 'great' ? 'Great' : 'Ultra'} Ball (currency)`
                : ITEMS[d.drop.key].name
              return (
                <tr key={i}>
                  <td>{name}</td>
                  <td>{((d.weight / totalW) * 100).toFixed(1)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="comp-note">One field Poké Ball drops every 3 rounds (max 2 on the board).</p>
    </div>
  )
}

export function ModeSelect({
  onPick,
  onOnline,
  onTutorial,
  onPuzzles,
  onCampaign,
}: {
  onPick: (mode: 'ai' | 'local', blitz: boolean, timer: boolean, difficulty: Difficulty) => void
  onOnline: (blitz: boolean, timer: boolean) => void
  onTutorial: () => void
  onPuzzles: () => void
  onCampaign: () => void
}) {
  const [blitz, setBlitz] = useState(false)
  const [timer, setTimer] = useState(true)
  const [colorblind, setColorblind] = useState(() => document.documentElement.classList.contains('cb'))
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  return (
    <div className="menu">
      <div className="ball-wallpaper" aria-hidden="true" />
      <div className="menu-marks">
        <Sprite dex={151} name="Mew" tokenColor="#F85888" />
        <Sprite dex={251} name="Celebi" tokenColor="#78C850" />
        <Sprite dex={385} name="Jirachi" tokenColor="#8A8AA8" />
        <Sprite dex={494} name="Victini" tokenColor="#F08030" />
        <Sprite dex={490} name="Manaphy" tokenColor="#6890F0" />
      </div>
      <h1 className="menu-title">Pocket Tactics</h1>
      <p className="menu-sub">
        Draft your Pokémon, protect your Mythical, and take the other one down.
      </p>

      <div className="draft-style">
        <button className={`chip ${!blitz ? 'chip-on' : ''}`} onClick={() => setBlitz(false)}>
          Classic draft — pick 8 before the battle
        </button>
        <button className={`chip ${blitz ? 'chip-on' : ''}`} onClick={() => setBlitz(true)}>
          Blitz draft — buy from a shop that restocks every turn
        </button>
        <button className={`chip ${timer ? 'chip-on' : ''}`} onClick={() => setTimer(!timer)}>
          {timer ? 'Turn clock: 60 seconds' : 'Turn clock: off'}
        </button>
        <button
          className={`chip ${colorblind ? 'chip-on' : ''}`}
          aria-pressed={colorblind}
          onClick={() => {
            const next = !colorblind
            setColorblind(next)
            document.documentElement.classList.toggle('cb', next)
            localStorage.setItem('pt-colorblind', next ? '1' : '0')
          }}
        >
          {colorblind ? 'Colourblind mode: on — shapes and hatching' : 'Colourblind mode: off'}
        </button>
      </div>

      <div className="difficulty-row" role="group" aria-label="Rival difficulty">
        <span className="difficulty-label">Rival</span>
        {(['easy', 'normal', 'hard'] as const).map((d) => (
          <button
            key={d}
            className={`chip ${difficulty === d ? 'chip-on' : ''}`}
            onClick={() => setDifficulty(d)}
            aria-pressed={difficulty === d}
          >
            {d === 'easy' ? 'Relaxed' : d === 'normal' ? 'Trainer' : 'Champion'}
          </button>
        ))}
      </div>

      <div className="menu-btns">
        <button className="btn btn-primary" onClick={() => onPick('ai', blitz, timer, difficulty)}>
          Battle the Rival
        </button>
        <button className="btn btn-ghost" onClick={() => onPick('local', blitz, timer, difficulty)}>
          Two Players · One Screen
        </button>
        <button className="btn btn-ghost" onClick={() => onOnline(blitz, timer)}>
          Play Online · Private Room
        </button>
        <button className="btn btn-ghost" onClick={onCampaign}>
          Campaign · Collect the roster
        </button>
        <button className="btn btn-ghost" onClick={onPuzzles}>
          Puzzles · Fixed boards, no dice
        </button>
        <button className="btn btn-tutorial" onClick={onTutorial}>
          New here? Play the tutorial
        </button>
      </div>

      <details className="rules rules-wide">
        <summary>How to play</summary>
        <div className="howto-cols">
          <div className="howto-col">
            <HowToPlay />
          </div>
          <div className="howto-col">
            <h4 className="howto-col-head">Type synergies</h4>
            <SynergyLegend />
          </div>
        </div>
      </details>

      <details className="rules rules-wide">
        <summary>Pokédex &amp; odds — every stat, ability, and drop rate</summary>
        <Compendium />
      </details>
    </div>
  )
}
