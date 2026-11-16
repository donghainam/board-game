// Luật cờ cá ngựa — thuần logic. Vị trí ngựa: -1 trong chuồng (chưa xuất), 0..50 số bước từ ô
// xuất phát (50 = cửa chuồng), 51..56 = bậc chuồng 1..6. Ô tuyệt đối trên đường 52 ô: (13*màu + bước) % 52.

import { fail } from '../shared/util.js';

export const DOOR = 50;
const COLORS = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
export const absSquare = (color, step) => (13 * color + step) % 52;

export function start(ids, { lastWinner } = {}) {
  const colors = COLORS[ids.length];
  const turn = Math.max(0, ids.indexOf(lastWinner));
  return {
    players: ids.map((id, i) => ({ id, color: colors[i], horses: [-1, -1, -1, -1] })),
    turn, roll: null, lastRoll: null, winner: null,
  };
}

// Ngựa (của bất kỳ ai) đang đứng trên đường chạy tại ô tuyệt đối sq.
function occupant(s, sq) {
  for (let pi = 0; pi < s.players.length; pi++) {
    const p = s.players[pi];
    const h = p.horses.findIndex((x) => x >= 0 && x <= DOOR && absSquare(p.color, x) === sq);
    if (h >= 0) return { pi, h };
  }
  return null;
}

// Vị trí mới nếu ngựa h của người pi đi được với số r, kèm ngựa bị đá; null nếu không đi được.
function target(s, pi, h, r) {
  const p = s.players[pi];
  const pos = p.horses[h];
  const onTrack = (to) => {
    const o = occupant(s, absSquare(p.color, to));
    if (o && o.pi === pi) return null;
    return { to, kick: o };
  };
  if (pos === -1) return r === 6 ? onTrack(0) : null;
  if (pos < DOOR) {
    const to = pos + r;
    if (to > DOOR) return null;
    for (let st = pos + 1; st < to; st++) if (occupant(s, absSquare(p.color, st))) return null;
    return onTrack(to);
  }
  if (pos === DOOR) {
    for (let st = DOOR + 1; st <= DOOR + r; st++) if (p.horses.includes(st)) return null;
    return { to: DOOR + r, kick: null };
  }
  const b = pos - DOOR;
  if (b < 6 && (r === b + 1 || r === 1) && !p.horses.includes(pos + 1)) return { to: pos + 1, kick: null };
  return null;
}

export function movable(s) {
  if (s.roll === null || s.winner) return [];
  return [0, 1, 2, 3].filter((h) => target(s, s.turn, h, s.roll));
}

function endTurn(s, value) {
  return { ...s, roll: null, turn: value === 6 ? s.turn : (s.turn + 1) % s.players.length };
}

export function apply(s, id, action, rng = Math.random) {
  if (s.winner) return fail('Ván đã kết thúc.');
  if (s.players[s.turn].id !== id) return fail('Chưa tới lượt bạn.');
  if (action?.type === 'roll') {
    if (s.roll !== null) return fail('Bạn đã gieo rồi, hãy chọn ngựa.');
    const value = 1 + Math.floor(rng() * 6);
    const next = { ...s, roll: value, lastRoll: { by: id, value } };
    return { ok: true, state: movable(next).length ? next : endTurn(next, value) };
  }
  if (action?.type !== 'move') return fail('Thao tác không hợp lệ.');
  if (s.roll === null) return fail('Hãy gieo xúc xắc trước.');
  const h = action.horse;
  if (!Number.isInteger(h) || h < 0 || h > 3) return fail('Ngựa không hợp lệ.');
  const t = target(s, s.turn, h, s.roll);
  if (!t) return fail('Ngựa này không đi được.');
  const players = s.players.map((p, pi) => {
    let horses = p.horses;
    if (pi === s.turn) horses = horses.map((x, i) => (i === h ? t.to : x));
    if (t.kick && pi === t.kick.pi) horses = horses.map((x, i) => (i === t.kick.h ? -1 : x));
    return horses === p.horses ? p : { ...p, horses };
  });
  const next = { ...s, players };
  if (players[s.turn].horses.every((x) => x > DOOR)) return { ok: true, state: { ...next, roll: null, winner: id } };
  return { ok: true, state: endTurn(next, s.roll) };
}

export function forceSkip(s) {
  return s.winner ? s : { ...s, roll: null, turn: (s.turn + 1) % s.players.length };
}

export function viewFor(s, id) {
  if (!s.players.some((p) => p.id === id)) return null;
  return {
    players: s.players, turn: s.players[s.turn].id, roll: s.roll, lastRoll: s.lastRoll,
    movable: movable(s), winner: s.winner, me: id,
  };
}
