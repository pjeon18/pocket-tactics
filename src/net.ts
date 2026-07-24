import { joinRoom, selfId } from 'trystero'
import type { DraftResult, GameState } from './game/types'

/**
 * Private online rooms over WebRTC (Trystero): no server, no accounts — the
 * room code is the whole handshake, so it works straight off GitHub Pages.
 * The room creator is the HOST and runs the authoritative engine; the guest
 * sends action intents and renders the states the host broadcasts back.
 */

export interface NetAction {
  name: string
  args: unknown[]
}

export interface NetState {
  state: GameState
  resolving: boolean
}

export interface NetSession {
  code: string
  role: 'host' | 'guest'
  sendAction: (a: NetAction) => void
  onAction: (cb: (a: NetAction) => void) => void
  sendState: (s: NetState) => void
  onState: (cb: (s: NetState) => void) => void
  sendDraft: (d: DraftResult) => void
  onDraft: (cb: (d: DraftResult) => void) => void
  onPeerJoin: (cb: () => void) => void
  onPeerLeave: (cb: () => void) => void
  peerCount: () => number
  leave: () => void
}

const APP_ID = 'pocket-tactics-pjeon18'

export const makeRoomCode = () =>
  Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')

/* Trystero's payload types are strict JSON maps; we tunnel our shapes as `any`. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function connectRoom(code: string, role: 'host' | 'guest'): NetSession {
  const room = joinRoom({ appId: APP_ID }, code.toUpperCase()) as any
  // Trystero 0.25: makeAction returns { send, onMessage, onReceiveProgress }
  const act = room.makeAction('act')
  const st = room.makeAction('st')
  const draft = room.makeAction('draft')

  // NOTE: in this trystero version, onMessage / onPeerJoin / onPeerLeave are
  // ASSIGNABLE PROPERTIES (initially null), not registration methods — calling
  // them as functions throws and silently kills the whole handshake.
  return {
    code: code.toUpperCase(),
    role,
    sendAction: (a) => void act.send(a as any),
    onAction: (cb) => { act.onMessage = (a: any) => cb(a as NetAction) },
    sendState: (s) => void st.send(s as any),
    onState: (cb) => { st.onMessage = (s: any) => cb(s as NetState) },
    sendDraft: (d) => void draft.send(d as any),
    onDraft: (cb) => { draft.onMessage = (d: any) => cb(d as DraftResult) },
    onPeerJoin: (cb) => { room.onPeerJoin = () => cb() },
    onPeerLeave: (cb) => { room.onPeerLeave = () => cb() },
    peerCount: () => Object.keys(room.getPeers()).length,
    leave: () => void room.leave(),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export { selfId }
