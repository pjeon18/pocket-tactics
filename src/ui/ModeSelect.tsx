import { useState } from 'react'
import { Sprite } from './Sprite'
import { SynergyLegend } from './Draft'

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
          Classic draft — pick 10 before the battle
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

      <details className="rules">
        <summary>How to play</summary>
        <ul>
          <li>Pick a Mythical champion and draft 10 Pokémon (or buy live from the shop in Blitz). Type matchups are real — super effective hits do +3, resisted hits −2.</li>
          <li>Deploy onto your back two rows with Poké Balls. Trade 3 for a Great Ball, 6 for an Ultra Ball. Basics fight the turn they land; stronger Pokémon need a turn to arrive.</li>
          <li>Each turn, up to 3 of your Pokémon may move. Undo is free until you declare an attack.</li>
          <li>Attacks are declared during your turn and all land together when you end it.</li>
          <li>If your champion moves, nothing else may move that turn. Guard it well.</li>
          <li>Field Poké Balls drop every 4 rounds — walk onto one for items. Knock out the enemy champion to win.</li>
        </ul>
      </details>

      <details className="rules">
        <summary>Type synergies</summary>
        <SynergyLegend />
      </details>
    </div>
  )
}
