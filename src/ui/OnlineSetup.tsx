import { useEffect, useRef, useState } from 'react'
import { connectRoom, makeRoomCode, type NetMode, type NetProgress, type NetSession } from '../net'
import type { DraftResult } from '../game/types'
import { Draft } from './Draft'
import { BattleIntro } from './BattleIntro'
import { Battle } from './Battle'

/**
 * Create or join a private room. The creator hosts (plays first); the joiner
 * is the guest. Once both peers see each other, the flow moves on to drafting.
 */
export function OnlineSetup({
  onReady,
  onBack,
}: {
  onReady: (net: NetSession) => void
  onBack: () => void
}) {
  const [stage, setStage] = useState<'pick' | 'hosting' | 'joining' | 'connecting'>('pick')
  const [code, setCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const netRef = useRef<NetSession | null>(null)
  const handedOff = useRef(false)

  // tear the room down only if we leave this screen WITHOUT connecting
  useEffect(
    () => () => {
      if (netRef.current && !handedOff.current) netRef.current.leave()
    },
    [],
  )

  const host = () => {
    const c = makeRoomCode()
    setCode(c)
    const net = connectRoom(c, 'host')
    netRef.current = net
    setStage('hosting')
    net.onPeerJoin(() => {
      handedOff.current = true
      setStage('connecting')
      onReady(net)
    })
  }

  const join = () => {
    const c = joinCode.trim().toUpperCase()
    if (c.length < 4) {
      setError('That code looks too short.')
      return
    }
    setError('')
    const net = connectRoom(c, 'guest')
    netRef.current = net
    setStage('joining')
    net.onPeerJoin(() => {
      handedOff.current = true
      setStage('connecting')
      onReady(net)
    })
  }

  return (
    <div className="menu">
      <h1 className="menu-title">Online room</h1>

      {stage === 'pick' && (
        <>
          <p className="menu-sub">Private, peer-to-peer — share a code, no accounts.</p>
          <div className="menu-btns">
            <button className="btn btn-primary" onClick={host}>Create a room</button>
            <div className="join-row">
              <input
                className="code-input"
                placeholder="ROOM CODE"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && join()}
              />
              <button className="btn btn-ghost" onClick={join}>Join</button>
            </div>
            {error && <p className="menu-error">{error}</p>}
            <button className="btn btn-tiny" onClick={onBack}>‹ Back</button>
          </div>
        </>
      )}

      {stage === 'hosting' && (
        <>
          <p className="menu-sub">Share this code with your opponent:</p>
          <div className="room-code">{code}</div>
          <p className="menu-sub menu-waiting">Waiting for them to join</p>
          <button className="btn btn-tiny" onClick={() => { netRef.current?.leave(); setStage('pick') }}>Cancel</button>
        </>
      )}

      {stage === 'joining' && (
        <>
          <p className="menu-sub menu-waiting">Looking for room {joinCode}</p>
          <button className="btn btn-tiny" onClick={() => { netRef.current?.leave(); setStage('pick') }}>Cancel</button>
        </>
      )}

      {stage === 'connecting' && <p className="menu-sub menu-waiting">Connected — setting up</p>}
    </div>
  )
}

/** Post-draft: waiting for the opponent's draft to arrive. */
export function OnlineWaiting({ note }: { note: string }) {
  return (
    <div className="menu">
      <h1 className="menu-title">Almost there</h1>
      <p className="menu-sub menu-waiting">{note}</p>
    </div>
  )
}

/**
 * The whole online lifecycle: room setup → the HOST's match settings (blitz /
 * timer) are sent to the guest → each side drafts → drafts are exchanged →
 * battle. Host is A and runs the authoritative engine inside Battle.
 */
export function OnlineGame({
  blitz,
  timer,
  onExit,
}: {
  blitz: boolean
  timer: boolean
  onExit: () => void
}) {
  const [net, setNet] = useState<NetSession | null>(null)
  const [mode, setMode] = useState<NetMode | null>(null)
  const [myDraft, setMyDraft] = useState<DraftResult | null>(null)
  const [peerDraft, setPeerDraft] = useState<DraftResult | null>(null)
  const [peerProgress, setPeerProgress] = useState<NetProgress | null>(null)
  const [intro, setIntro] = useState(true)

  // stash the peer's draft whenever it arrives (may beat our own lock-in)
  useEffect(() => {
    if (!net) return
    net.onDraft((d) => setPeerDraft(d))
    net.onProgress((p) => setPeerProgress(p))
    if (net.role === 'host') {
      // the room creator's menu choices govern the match
      const m = { blitz, timer }
      setMode(m)
      // fire twice: once now, once shortly after, in case the guest's handler
      // attaches a beat later than the connection
      net.sendMode(m)
      const t = window.setTimeout(() => net.sendMode(m), 1200)
      return () => clearTimeout(t)
    }
    net.onMode((m) => setMode(m))
  }, [net, blitz, timer])

  if (!net) return <OnlineSetup onReady={setNet} onBack={onExit} />

  if (!mode) return <OnlineWaiting note="Syncing match settings" />

  const opponentNote = peerDraft
    ? 'Opponent has locked in their team ✓'
    : !peerProgress
      ? 'Opponent is getting ready…'
      : peerProgress.done
        ? 'Opponent has locked in their team ✓'
        : mode.blitz
          ? `Opponent: ${peerProgress.champion ? 'champion ✓' : 'choosing champion'} · ${peerProgress.summons}/${peerProgress.summonTotal} summons`
          : `Opponent has drafted ${peerProgress.picks}/${peerProgress.total} Pokémon · ${peerProgress.summons}/${peerProgress.summonTotal} summons`

  if (!myDraft) {
    return (
      <Draft
        label={net.role === 'host' ? 'You (host)' : 'You (guest)'}
        championOnly={mode.blitz}
        onProgress={(p) => net.sendProgress(p)}
        opponentNote={opponentNote}
        onBack={() => {
          net.leave()
          onExit()
        }}
        onDone={(d) => {
          net.sendDraft(d)
          setMyDraft(d)
        }}
      />
    )
  }

  if (!peerDraft) return <OnlineWaiting note="Waiting for your opponent to lock in their team" />

  const draftA = net.role === 'host' ? myDraft : peerDraft
  const draftB = net.role === 'host' ? peerDraft : myDraft

  if (intro) return <BattleIntro onDone={() => setIntro(false)} />

  return (
    <Battle
      mode="local"
      blitz={mode.blitz}
      timerOn={mode.timer}
      net={net}
      draftA={draftA}
      draftB={draftB}
      onExit={() => {
        net.leave()
        onExit()
      }}
      onRedraft={() => {
        net.leave()
        onExit()
      }}
    />
  )
}
