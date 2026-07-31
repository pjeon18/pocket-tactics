import { useState } from 'react'
import { aiDraft, type Difficulty } from './game/ai'
import { makeTutorialDrafts, makeTutorialState } from './game/tutorial'
import type { DraftResult } from './game/types'
import { Battle } from './ui/Battle'
import { BattleIntro } from './ui/BattleIntro'
import { Draft } from './ui/Draft'
import { ModeSelect } from './ui/ModeSelect'
import { OnlineGame } from './ui/OnlineSetup'
import { WaveWipe, useWave } from './ui/Wave'

type Mode = 'ai' | 'local'

type Phase =
  | { t: 'menu' }
  | { t: 'tutorial' }
  | { t: 'online'; blitz: boolean; timer: boolean }
  | { t: 'draftA'; mode: Mode; blitz: boolean; timer: boolean; difficulty: Difficulty }
  | { t: 'pass'; mode: 'local'; blitz: boolean; timer: boolean; difficulty: Difficulty; draftA: DraftResult }
  | { t: 'draftB'; mode: 'local'; blitz: boolean; timer: boolean; difficulty: Difficulty; draftA: DraftResult }
  | { t: 'intro'; mode: Mode; blitz: boolean; timer: boolean; difficulty: Difficulty; draftA: DraftResult; draftB: DraftResult }
  | { t: 'battle'; mode: Mode; blitz: boolean; timer: boolean; difficulty: Difficulty; draftA: DraftResult; draftB: DraftResult }

export default function App() {
  const [phase, setPhase] = useState<Phase>({ t: 'menu' })
  const { waveActive, go } = useWave()

  return (
    <div className="app">
      <WaveWipe active={waveActive} />
      {phase.t === 'menu' && (
        <ModeSelect
          onPick={(mode, blitz, timer, difficulty) => go(() => setPhase({ t: 'draftA', mode, blitz, timer, difficulty }))}
          onOnline={(blitz, timer) => go(() => setPhase({ t: 'online', blitz, timer }))}
          onTutorial={() => go(() => setPhase({ t: 'tutorial' }))}
        />
      )}

      {phase.t === 'tutorial' && (
        <Battle
          mode="ai"
          blitz={false}
          timerOn={false}
          tutorial
          initialState={makeTutorialState()}
          rebuild={makeTutorialState}
          draftA={makeTutorialDrafts().draftA}
          draftB={makeTutorialDrafts().draftB}
          onExit={() => setPhase({ t: 'menu' })}
          onRedraft={() => setPhase({ t: 'menu' })}
        />
      )}

      {phase.t === 'online' && <OnlineGame blitz={phase.blitz} timer={phase.timer} onExit={() => setPhase({ t: 'menu' })} />}

      {phase.t === 'draftA' && (
        <Draft
          label={phase.mode === 'ai' ? 'Your team' : 'Player 1'}
          championOnly={phase.blitz}
          onBack={() => setPhase({ t: 'menu' })}
          onDone={(draftA) =>
            phase.mode === 'ai'
              ? setPhase({ t: 'intro', mode: 'ai', blitz: phase.blitz, timer: phase.timer, difficulty: phase.difficulty, draftA, draftB: aiDraft(phase.difficulty) })
              : setPhase({ t: 'pass', mode: 'local', blitz: phase.blitz, timer: phase.timer, difficulty: phase.difficulty, draftA })
          }
        />
      )}

      {phase.t === 'pass' && (
        <div className="menu">
          <h1 className="menu-title">Pass the screen</h1>
          <p className="menu-sub">Player 1 is locked in. Hand it over — Player 2 is next.</p>
          <div className="menu-btns">
            <button
              className="btn btn-primary"
              onClick={() => setPhase({ t: 'draftB', mode: 'local', blitz: phase.blitz, timer: phase.timer, difficulty: phase.difficulty, draftA: phase.draftA })}
            >
              {phase.blitz ? 'Player 2, pick your champion' : 'Player 2, draft your team'}
            </button>
          </div>
        </div>
      )}

      {phase.t === 'draftB' && (
        <Draft
          label="Player 2"
          championOnly={phase.blitz}
          onBack={() => setPhase({ t: 'menu' })}
          onDone={(draftB) =>
            setPhase({ t: 'intro', mode: 'local', blitz: phase.blitz, timer: phase.timer, difficulty: phase.difficulty, draftA: phase.draftA, draftB })
          }
        />
      )}

      {phase.t === 'intro' && (
        <BattleIntro
          onDone={() =>
            setPhase({ t: 'battle', mode: phase.mode, blitz: phase.blitz, timer: phase.timer, difficulty: phase.difficulty, draftA: phase.draftA, draftB: phase.draftB })
          }
        />
      )}

      {phase.t === 'battle' && (
        <Battle
          mode={phase.mode}
          blitz={phase.blitz}
          timerOn={phase.timer}
          difficulty={phase.difficulty}
          draftA={phase.draftA}
          draftB={phase.draftB}
          onExit={() => setPhase({ t: 'menu' })}
          onRedraft={() => setPhase({ t: 'draftA', mode: phase.mode, blitz: phase.blitz, timer: phase.timer, difficulty: phase.difficulty })}
        />
      )}
    </div>
  )
}
