// Luật Bom Xịt — thuần logic. Lá = {t: 'soi'|'ne'|'chan'|'keo'|'bom', id}. deck: phần tử cuối là lá trên cùng.

import { shuffle, fail } from '../shared/util.js';

export const WINDOW = 3000; // cửa sổ để người khác đánh Chặn (ms)

export function start(ids, { lastWinner } = {}, rng = Math.random) {
  let id = 0;
  const mk = (t) => ({ t, id: id++ });
  const actions = shuffle(['soi', 'ne', 'chan'].flatMap((t) => Array.from({ length: 8 }, () => mk(t))), rng);
  const players = ids.map((pid) => ({ id: pid, hand: [mk('keo'), ...actions.splice(0, 4)], alive: true }));
  const deck = shuffle([...actions, mk('keo'), ...Array.from({ length: ids.length - 1 }, () => mk('bom'))], rng);
  return { players, deck, discard: [], turn: Math.max(0, ids.indexOf(lastWinner)), pending: null, peek: null, log: null, winner: null };
}

function advance(s) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const j = (s.turn + k) % n;
    if (s.players[j].alive) { s.turn = j; return; }
  }
}

const take = (hand, cardId, t) => {
  const i = hand.findIndex((c) => c.id === cardId && c.t === t);
  return i < 0 ? null : hand.splice(i, 1)[0];
};

function draw(state, rng) {
  const s = structuredClone(state);
  const me = s.players[s.turn];
  s.peek = null;
  const card = s.deck.pop();
  if (!card) { advance(s); return s; } // shortcut: chồng hết bài (không xảy ra vì luôn còn Bom), chỉ chuyển lượt
  if (card.t !== 'bom') { me.hand.push(card); s.log = null; advance(s); return s; }
  const keo = me.hand.findIndex((c) => c.t === 'keo');
  if (keo >= 0) {
    s.discard.push(...me.hand.splice(keo, 1));
    s.deck.splice(Math.floor(rng() * (s.deck.length + 1)), 0, card);
    s.log = { kind: 'go-bom', id: me.id };
  } else {
    me.alive = false;
    s.discard.push(card, ...me.hand.splice(0));
    s.log = { kind: 'no', id: me.id };
    const alive = s.players.filter((p) => p.alive);
    if (alive.length === 1) { s.winner = alive[0].id; return s; }
  }
  advance(s);
  return s;
}

export function apply(state, id, action, rng = Math.random, now = Date.now()) {
  // Cửa sổ Chặn đã hết thì xử lý ngay, không phụ thuộc timer của host (máy host có thể đang bị trình duyệt hoãn timer).
  if (state.pending && now >= state.pending.until) state = onTimer(state, now);
  if (state.winner) return fail('Ván đã kết thúc.');
  const pi = state.players.findIndex((p) => p.id === id);
  if (pi < 0 || !state.players[pi].alive) return fail('Bạn không còn trong ván.');
  const type = action?.type;
  if (type === 'chan') {
    if (!state.pending) return fail('Không có lá nào để chặn.');
    const s = structuredClone(state);
    const card = take(s.players[pi].hand, action.card, 'chan');
    if (!card) return fail('Bạn không có lá Chặn này.');
    s.discard.push(card);
    s.pending.chans++;
    s.pending.until = now + WINDOW;
    return { ok: true, state: s };
  }
  if (state.turn !== pi) return fail('Chưa tới lượt bạn.');
  if (state.pending) return fail('Chờ hết 3 giây xem có ai Chặn không.');
  if (type === 'draw') return { ok: true, state: draw(state, rng) };
  if (type !== 'play') return fail('Thao tác không hợp lệ.');
  const s = structuredClone(state);
  const hand = s.players[pi].hand;
  const card = take(hand, action.card, 'soi') || take(hand, action.card, 'ne');
  if (!card) return fail('Bạn không có lá này.');
  s.discard.push(card);
  s.pending = { card, by: id, chans: 0, until: now + WINDOW };
  return { ok: true, state: s };
}

export const nextTimer = (s) => s.pending?.until ?? null;

export function onTimer(state, now) {
  if (!state.pending || now < state.pending.until) return state;
  const s = structuredClone(state);
  const { card, by, chans } = s.pending;
  s.pending = null;
  if (chans % 2) return s; // bị Chặn
  if (card.t === 'soi') s.peek = { id: by, cards: s.deck.slice(-3).reverse() };
  if (card.t === 'ne') { s.peek = null; advance(s); }
  return s;
}

export function forceSkip(state, rng = Math.random) {
  if (state.winner || state.pending) return state; // đang chờ 3 giây: để timer xử lý, tránh bắt người kế bốc oan
  return draw(state, rng);
}

export function viewFor(s, id) {
  const me = s.players.find((p) => p.id === id);
  if (!me) return null;
  return {
    me: { id, hand: me.hand, alive: me.alive },
    players: s.players.map((p) => ({ id: p.id, count: p.hand.length, alive: p.alive })),
    turn: s.players[s.turn].id, deckCount: s.deck.length,
    pending: s.pending && { card: { t: s.pending.card.t }, by: s.pending.by, chans: s.pending.chans },
    peek: s.peek?.id === id ? s.peek.cards.map((c) => ({ t: c.t })) : null,
    log: s.log, winner: s.winner,
  };
}
