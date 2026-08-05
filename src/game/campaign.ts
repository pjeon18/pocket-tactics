import type { Difficulty } from './ai'
import { ROSTER } from './data'

/**
 * Campaign — a ladder of fixed opponents, and a collection you fill by beating
 * them.
 *
 * The rule that makes it a campaign rather than a series of skirmishes: every
 * opponent fields at least one card you do not own yet, and beating them hands
 * you exactly those cards. So each match is a preview of the reward, and your
 * deck grows in the direction you just fought against.
 *
 * Difficulty climbs with the ladder, so the AI work is what carries the back
 * half — a fixed deck at Champion level plays very differently from the same
 * deck at Relaxed.
 */

export interface Opponent {
  id: string
  name: string
  title: string
  blurb: string
  champion: string
  deck: string[]
  summons: string[]
  difficulty: Difficulty
}

/** You win every card a trainer fielded. Beating them hands over the deck you
 *  just played against, which is the whole promise of the mode. */
export const rewardsOf = (o: Opponent): string[] => o.deck

/** What you own before the first match: enough to field a legal draft of 8. */
export const STARTER_CARDS = [
  'squirtle', 'vulpix', 'sunkern', 'pikachu', 'onix', 'grotle',
  'starly', 'lillipup', 'poochyena', 'abra', 'croagunk', 'kirlia',
]

export const STARTER_SUMMONS = ['hooh', 'lugia']

export const LADDER: Opponent[] = [
  {
    id: 'c1',
    name: 'Rill',
    title: 'the Wader',
    blurb: 'Keeps everything in front of the champion and dares you to walk into it.',
    champion: 'manaphy',
    difficulty: 'easy',
    deck: ['squirtle', 'quagsire', 'metapod', 'lillipup', 'starly', 'sunkern', 'poochyena', 'onix'],
    summons: ['hooh', 'lugia'],
  },
  {
    id: 'c2',
    name: 'Cinder',
    title: 'of the Low Flame',
    blurb: 'Fast, fragile, and happy to trade. Bring something that survives the first hit.',
    champion: 'victini',
    difficulty: 'easy',
    deck: ['ponyta', 'vulpix', 'magneton', 'hitmonlee', 'haunter', 'jynx', 'porygon2', 'audino'],
    summons: ['hooh', 'dialga'],
  },
  {
    id: 'c3',
    name: 'Bramble',
    title: 'the Patient',
    blurb: 'Heals more than you can chip. You will need a real finisher.',
    champion: 'celebi',
    difficulty: 'normal',
    deck: ['chansey', 'grotle', 'rotommow', 'ferroseed', 'sunkern', 'audino', 'quagsire', 'metapod'],
    summons: ['hooh', 'palkia'],
  },
  {
    id: 'c4',
    name: 'Vault',
    title: 'the Immovable',
    blurb: 'A steel wall with a hard shell. Phasing and piercing earn their keep here.',
    champion: 'jirachi',
    difficulty: 'normal',
    deck: ['steelix', 'bronzong', 'ferrothorn', 'golem', 'onix', 'gigalith', 'carracosta', 'ferroseed'],
    summons: ['lugia', 'groudon'],
  },
  {
    id: 'c5',
    name: 'Hex',
    title: 'of the Long Night',
    blurb: 'Hits through your screens and punishes anything at full health.',
    champion: 'mew',
    difficulty: 'hard',
    deck: ['gengar', 'drifblim', 'zoroark', 'umbreon', 'houndoom', 'weavile', 'haunter', 'espeon'],
    summons: ['dialga', 'kyogre'],
  },
  {
    id: 'c6',
    name: 'Sovereign',
    title: 'the Last Seat',
    blurb: 'Everything expensive, played properly. There is no gimmick to find — only better turns.',
    champion: 'victini',
    difficulty: 'hard',
    deck: ['garchomp', 'dragonite', 'machamp', 'snorlax', 'alakazam', 'gyarados', 'lucario', 'arcanine'],
    summons: ['dialga', 'palkia'],
  },
]

/* ---------- progress ---------- */

const KEY = 'pt-campaign'

export interface CampaignSave {
  beaten: string[]
  cards: string[]
  summons: string[]
}

const fresh = (): CampaignSave => ({
  beaten: [],
  cards: [...STARTER_CARDS],
  summons: [...STARTER_SUMMONS],
})

export function loadCampaign(): CampaignSave {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as CampaignSave | null
    if (!raw || !Array.isArray(raw.cards)) return fresh()
    // drop anything that no longer exists in the roster
    return {
      beaten: raw.beaten ?? [],
      cards: (raw.cards ?? []).filter((k) => ROSTER[k]),
      summons: raw.summons ?? [...STARTER_SUMMONS],
    }
  } catch {
    return fresh()
  }
}

export function saveCampaign(s: CampaignSave) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function resetCampaign(): CampaignSave {
  const s = fresh()
  saveCampaign(s)
  return s
}

/** Record a win and hand over its rewards. Returns the cards that were new. */
export function claimWin(id: string): { save: CampaignSave; gained: string[] } {
  const save = loadCampaign()
  const opp = LADDER.find((o) => o.id === id)
  if (!opp) return { save, gained: [] }
  const gained = rewardsOf(opp).filter((k) => !save.cards.includes(k))
  save.cards = [...save.cards, ...gained]
  if (!save.beaten.includes(id)) save.beaten.push(id)
  saveCampaign(save)
  return { save, gained }
}

/** An opponent is available once the one before it has been beaten. */
export function isUnlocked(save: CampaignSave, index: number): boolean {
  if (index === 0) return true
  return save.beaten.includes(LADDER[index - 1].id)
}
