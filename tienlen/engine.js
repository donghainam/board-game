// Luật Tiến Lên miền Nam — thuần logic, không DOM, không mạng.
// Lá bài = số 0..51: rank = c>>2 (0 là '3' … 11 là 'A', 12 là '2'), suit = c&3 (♠ ♣ ♦ ♥).

import { shuffle, fail } from '../shared/util.js';

export const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
export const SUITS = ['♠', '♣', '♦', '♥'];
const HEO = 12;

const rankOf = (c) => c >> 2;
export const card = (r, s) => RANKS.indexOf(r) * 4 + SUITS.indexOf(s);
export const label = (c) => RANKS[rankOf(c)] + SUITS[c & 3];

function isRun(ranks) {
  return ranks.every((r, i) => r !== HEO && (i === 0 || r === ranks[i - 1] + 1));
}

export function classify(cards) {
  const n = cards.length;
  if (!n || new Set(cards).size !== n) return null;
  const s = [...cards].sort((a, b) => a - b);
  const r = s.map(rankOf);
  const top = s[n - 1];
  const same = r.every((x) => x === r[0]);
  if (n === 1) return { type: 'single', len: 1, top };
  if (same && n <= 4) return { type: ['', '', 'pair', 'triple', 'quad'][n], len: n, top };
  if (n >= 3 && isRun(r)) return { type: 'straight', len: n, top };
  if (n >= 6 && n % 2 === 0) {
    const pairs = [];
    for (let i = 0; i < n; i += 2) {
      if (r[i] !== r[i + 1]) return null;
      pairs.push(r[i]);
    }
    if (isRun(pairs)) return { type: 'pairseq', len: n / 2, top };
  }
  return null;
}

export function canBeat(play, cur) {
  if (!play) return false;
  if (!cur) return true;
  if (play.type === cur.type && play.len === cur.len) return play.top > cur.top;
  const heo = rankOf(cur.top) === HEO;
  const ps3 = play.type === 'pairseq' && play.len === 3;
  const ps4 = play.type === 'pairseq' && play.len === 4;
  const quad = play.type === 'quad';
  if (cur.type === 'single' && heo) return ps3 || quad || ps4;
  if (cur.type === 'pair' && heo) return quad || ps4;
  if (cur.type === 'pairseq' && cur.len === 3) return quad || ps4;
  if (cur.type === 'quad') return ps4;
  return false;
}

// ---------- Diễn biến ván ----------

export function instantWin(hand) {
  const cnt = Array(13).fill(0);
  hand.forEach((c) => cnt[rankOf(c)]++);
  if (cnt.slice(0, 12).every((n) => n > 0)) return 'sanh-rong';
  if (cnt[HEO] === 4) return 'tu-quy-2';
  if (cnt.reduce((a, n) => a + (n >> 1), 0) >= 6) return '6-doi';
  for (let i = 0, run = 0; i < 12; i++) {
    run = cnt[i] >= 2 ? run + 1 : 0;
    if (run >= 5) return '5-doi-thong';
  }
  return null;
}

// opts.deck chỉ dùng cho test: bộ bài đã xếp sẵn.
export function newGame(ids, opts = {}) {
  const deck = opts.deck || shuffle(Array.from({ length: 52 }, (_, i) => i), opts.rng);
  const players = ids.map((id, i) => ({
    id, hand: deck.slice(i * 13, i * 13 + 13).sort((a, b) => a - b),
  }));
  const s = {
    players, turn: 0, trick: null, passed: [], played: [], mustInclude: null,
    winner: null, endReason: null, notes: [],
  };
  const lead = players.findIndex((p) => p.id === opts.leader);
  if (lead >= 0) s.turn = lead;
  else {
    const min = Math.min(...players.flatMap((p) => p.hand));
    s.turn = players.findIndex((p) => p.hand.includes(min));
    s.mustInclude = min;
  }
  // Nhiều người tới trắng: ghế gần chủ bàn nhất (index nhỏ nhất) thắng.
  for (const p of players) {
    const w = instantWin(p.hand);
    if (w) return { ...s, winner: p.id, endReason: w, mustInclude: null };
  }
  return s;
}

function advance(s) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const j = (s.turn + k) % n;
    if (s.trick && j === s.trick.by) return { ...s, turn: j, trick: null, passed: [] };
    if (!s.passed.includes(s.players[j].id)) return { ...s, turn: j };
  }
  return s;
}

function endNotes(s) {
  const notes = [];
  for (const p of s.players) {
    if (p.id === s.winner) continue;
    if (!s.played.includes(p.id)) notes.push({ id: p.id, text: 'bị cóng' });
    const heo = p.hand.filter((c) => rankOf(c) === HEO).length;
    if (heo) notes.push({ id: p.id, text: `thối heo (${heo} lá)` });
  }
  return notes;
}

export function applyAction(s, id, action) {
  if (s.winner) return fail('Ván đã kết thúc.');
  const me = s.players[s.turn];
  if (!me || me.id !== id) return fail('Chưa tới lượt bạn.');
  if (action?.type === 'pass') {
    if (!s.trick) return fail('Bạn đang được đi trước, không bỏ lượt được.');
    return { ok: true, state: advance({ ...s, passed: [...s.passed, id] }) };
  }
  if (action?.type !== 'play' || !Array.isArray(action.cards)) return fail('Thao tác không hợp lệ.');
  const cards = action.cards;
  if (!cards.every((c) => me.hand.includes(c)) || new Set(cards).size !== cards.length) {
    return fail('Bạn không có những lá này.');
  }
  const combo = classify(cards);
  if (!combo) return fail('Bộ bài không hợp lệ.');
  if (s.mustInclude !== null && !cards.includes(s.mustInclude)) {
    return fail(`Lượt đầu phải có lá ${label(s.mustInclude)}.`);
  }
  if (!canBeat(combo, s.trick?.combo)) return fail('Không chặn được bộ trên bàn.');
  const hand = me.hand.filter((c) => !cards.includes(c));
  const players = s.players.map((p, i) => (i === s.turn ? { ...p, hand } : p));
  let next = {
    ...s, players, mustInclude: null,
    trick: { combo, cards: [...cards].sort((a, b) => a - b), by: s.turn },
    played: s.played.includes(id) ? s.played : [...s.played, id],
  };
  if (!hand.length) {
    next = { ...next, winner: id, endReason: 'het-bai' };
    return { ok: true, state: { ...next, notes: endNotes(next) } };
  }
  return { ok: true, state: advance(next) };
}

export function forceSkip(s) {
  if (s.winner) return s;
  if (s.trick) return applyAction(s, s.players[s.turn].id, { type: 'pass' }).state;
  return { ...s, turn: (s.turn + 1) % s.players.length, mustInclude: null };
}

export function viewFor(s, id) {
  const me = s.players.find((p) => p.id === id);
  if (!me) return null;
  return {
    me: { id, hand: me.hand },
    others: s.players.filter((p) => p.id !== id).map((p) => ({ id: p.id, count: p.hand.length })),
    order: s.players.map((p) => p.id),
    turn: s.players[s.turn].id,
    trick: s.trick && { cards: s.trick.cards, type: s.trick.combo.type, by: s.players[s.trick.by].id },
    passed: s.passed, mustInclude: s.mustInclude,
    winner: s.winner, endReason: s.endReason, notes: s.notes,
  };
}
