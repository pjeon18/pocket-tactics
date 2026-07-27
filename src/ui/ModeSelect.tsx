import { useState } from 'react'
import { CostDots, Sprite } from './Sprite'
import { SynergyLegend } from './Draft'
import {
  CHAMPIONS,
  DROPS,
  FIELD_CAP,
  ITEMS,
  ROLE_META,
  ROSTER,
  TYPE_META,
  costEquiv,
} from '../game/data'

/** The rules list, shared between the menu and the in-match help corner. */
export function HowToPlay() {
  return (
    <ul>
      <li>Pick a Mythical champion and draft 8 Pokémon (or buy live from the shop in Blitz). Type matchups are real — super effective hits do +3, resisted hits −2.</li>
      <li>Deploy zones scale with cost: Poké-tier lands up to 4 rows deep, Great-tier 3, Ultra-tier 2 (max {FIELD_CAP} fielded at once). Trade 3 Poké Balls for a Great Ball, 6 for an Ultra. Basics fight the turn they land; stronger Pokémon need a turn to arrive.</li>
      <li>Each turn, up to 3 of your Pokémon may move, and the turn clock gives you 60 seconds — when it runs out, the turn ends itself. Undo is free until you declare an attack.</li>
      <li>Attacks are declared during your turn and all land together when you end it. Every KO pays you a Poké Ball.</li>
      <li>If your champion moves, nothing else may move that turn. Guard it well.</li>
      <li>Field Poké Balls drop every 4 rounds — walk onto one for items. Knock out the enemy champion to win.</li>
    </ul>
  )
}

/** The full readable game doc: every Pokémon's numbers, champions, and drop odds. */
export function Compendium() {
  const totalW = DROPS.reduce((n, d) => n + d.weight, 0)
  const roster = Object.values(ROSTER).sort(
    (a, b) => costEquiv(a.cost) - costEquiv(b.cost) || a.name.localeCompare(b.name),
  )
  return (
    <div className="compendium">
      <h4>Every Pokémon</h4>
      <div className="comp-scroll">
        <table>
          <thead>
            <tr>
              <th>Pokémon</th><th>Type</th><th>Role</th><th>Cost</th><th>HP</th><th>ATK</th>
              <th>RNG</th><th>MOV</th><th>Charge</th><th>Redeploy</th><th>Special</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((s) => (
              <tr key={s.key}>
                <td className="comp-name">
                  <Sprite dex={s.dex} name={s.name} tokenColor={TYPE_META[s.ptype].color} />
                  {s.name}
                </td>
                <td><em className="type-chip" style={{ background: TYPE_META[s.ptype].color }}>{TYPE_META[s.ptype].label}</em></td>
                <td>{ROLE_META[s.role].label}</td>
                <td><CostDots cost={s.cost} size={14} /></td>
                <td>{s.hp}</td><td>{s.atk}</td><td>{s.range}</td><td>{s.move}</td>
                <td>{s.chargeMax}</td><td>{s.cooldown}t</td>
                <td className="comp-special"><b>{s.special}</b> — {s.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <p className="comp-note">One field Poké Ball drops every 4 rounds (max 2 on the board).</p>
    </div>
  )
}

export function ModeSelect({
  onPick,
  onOnline,
}: {
  onPick: (mode: 'ai' | 'local', blitz: boolean) => void
  onOnline: () => void
}) {
  const [blitz, setBlitz] = useState(false)
  return (
    <div className="menu">
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
      </div>

      <div className="menu-btns">
        <button className="btn btn-primary" onClick={() => onPick('ai', blitz)}>
          Battle the Rival
        </button>
        <button className="btn btn-ghost" onClick={() => onPick('local', blitz)}>
          Two Players · One Screen
        </button>
        <button className="btn btn-ghost" onClick={onOnline}>
          Play Online · Private Room
        </button>
      </div>

      <div className="rules-row">
        <details className="rules">
          <summary>How to play</summary>
          <HowToPlay />
        </details>

        <details className="rules">
          <summary>Type synergies</summary>
          <SynergyLegend />
        </details>
      </div>

      <details className="rules rules-wide">
        <summary>Pokédex &amp; odds — every stat, ability, and drop rate</summary>
        <Compendium />
      </details>
    </div>
  )
}
