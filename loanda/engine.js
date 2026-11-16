// Luật Loạn Đả Viễn Tây — thuần logic. Lá = {t: loại, s: chất 0♥ 1♦ 2♣ 3♠, id}. deck: phần tử cuối là lá trên cùng.

import { shuffle, fail } from '../shared/util.js';

export const GUN_RANGE = { sung2: 2, sung3: 3, sung4: 4, sung5: 5, lienthanh: 1 };
const EQUIP = ['sung2', 'sung3', 'sung4', 'sung5', 'lienthanh', 'ngua', 'ongnhom', 'thung', 'tu', 'no'];
const COUNTS = {
  ban: 22, ne: 12, bangbo: 6, ruou: 1, cuop: 4, pha: 4, duel: 3, loat: 1, phuckich: 2, tiepte: 3, tieptelon: 1,
  sung2: 3, sung3: 2, sung4: 1, sung5: 1, lienthanh: 2, ngua: 2, ongnhom: 1, thung: 2, tu: 3, no: 1,
};
const ROLES = {
  4: ['cst', 'phanboi', 'cuop', 'cuop'],
  5: ['cst', 'pho', 'phanboi', 'cuop', 'cuop'],
  6: ['cst', 'pho', 'phanboi', 'cuop', 'cuop', 'cuop'],
  7: ['cst', 'pho', 'pho', 'phanboi', 'cuop', 'cuop', 'cuop'],
};
const kindOf = (t) => (GUN_RANGE[t] ? 'gun' : t);

export function buildDeck() {
  const d = [];
  for (const [t, n] of Object.entries(COUNTS)) for (let i = 0; i < n; i++) d.push({ t });
  return d.map((c, id) => ({ ...c, id, s: id % 4 }));
}

export function validate(ids) {
  return ROLES[ids.length] ? undefined : 'Cần 4–7 người.';
}

export function start(ids, ctx = {}, rng = Math.random) {
  const roles = ROLES[ids.length];
  const order = shuffle(roles.slice(1), rng);
  const players = ids.map((id) => ({ id, role: null, hp: 4, max: 4, hand: [], eq: [], alive: true }));
  // Cảnh sát trưởng ngẫu nhiên (lộ mặt, đi trước); các vai khác chia ngẫu nhiên.
  const sheriff = Math.floor(rng() * ids.length);
  players.forEach((p, i) => { p.role = i === sheriff ? 'cst' : order.pop(); });
  const ps = players[sheriff]; ps.hp = ps.max = 5;
  const s = {
    players, deck: shuffle(buildDeck(), rng), discard: [], turn: sheriff, phase: 'play',
    bangUsed: false, pending: null, lastFlip: null, log: [], winner: null, winTeam: null,
  };
  players.forEach((p, i) => draw(s, i, p.hp, rng));
  startTurn(s, rng);
  return s;
}

// ---------- Tiện ích ----------
const log = (s, t) => { s.log = [...s.log.slice(-7), t]; };
const idx = (s, id) => s.players.findIndex((p) => p.id === id);
const has = (p, kind) => p.eq.find((c) => kindOf(c.t) === kind);
const aliveIdx = (s) => s.players.map((p, i) => (p.alive ? i : -1)).filter((i) => i >= 0);

function refill(s, rng) {
  if (s.deck.length) return;
  const top = s.discard.pop();
  s.deck = shuffle(s.discard, rng);
  s.discard = top ? [top] : [];
}
function draw(s, pi, n, rng) {
  for (let k = 0; k < n; k++) { refill(s, rng); const c = s.deck.pop(); if (c) s.players[pi].hand.push(c); }
}
function flip(s, pi, why, rng) {
  refill(s, rng);
  const c = s.deck.pop();
  if (!c) return null;
  s.discard.push(c);
  s.lastFlip = { by: s.players[pi].id, why, card: c };
  return c;
}

export function distance(s, a, b) {
  const seats = aliveIdx(s);
  const i = seats.indexOf(a), j = seats.indexOf(b);
  if (i < 0 || j < 0 || i === j) return 0;
  const n = seats.length;
  let d = Math.min(Math.abs(i - j), n - Math.abs(i - j));
  if (has(s.players[b], 'ngua')) d++;
  if (has(s.players[a], 'ongnhom')) d--;
  return Math.max(1, d);
}
const rangeOf = (p) => GUN_RANGE[has(p, 'gun')?.t] || 1;

// ---------- Máu, chết, thắng thua ----------
function damage(s, pi, n, rng) {
  const p = s.players[pi];
  if (!p.alive) return;
  p.hp -= n;
  while (p.hp <= 0 && aliveIdx(s).length > 2) {
    const k = p.hand.findIndex((c) => c.t === 'bangbo');
    if (k < 0) break;
    s.discard.push(...p.hand.splice(k, 1));
    p.hp++;
    log(s, `${p.id} dùng Băng bó để sống sót`);
  }
  if (p.hp > 0) return;
  p.alive = false; p.hp = 0;
  s.discard.push(...p.hand.splice(0), ...p.eq.splice(0));
  log(s, `${p.id} gục ngã`);
  checkWin(s);
}

function checkWin(s) {
  const alive = s.players.filter((p) => p.alive);
  const ids = (roles) => s.players.filter((p) => roles.includes(p.role)).map((p) => p.id);
  const cstAlive = alive.some((p) => p.role === 'cst');
  if (!cstAlive) {
    if (alive.length === 1 && alive[0].role === 'phanboi') { s.winner = [alive[0].id]; s.winTeam = 'phanboi'; } else { s.winner = ids(['cuop']); s.winTeam = 'cuop'; }
  } else if (!alive.some((p) => p.role === 'cuop' || p.role === 'phanboi')) { s.winner = ids(['cst', 'pho']); s.winTeam = 'luat'; }
  if (s.winner) { s.phase = 'end'; s.pending = null; }
}

// ---------- Lượt ----------
function startTurn(s, rng) {
  for (let guard = 0; guard < 20 && !s.winner; guard++) {
    const pi = s.turn;
    const p = s.players[pi];
    const no = has(p, 'no');
    if (no) {
      const c = flip(s, pi, 'Thuốc nổ', rng);
      p.eq.splice(p.eq.indexOf(no), 1);
      if (c && c.s === 3) {
        s.discard.push(no);
        log(s, `💥 Thuốc nổ phát nổ trước mặt ${p.id}`);
        damage(s, pi, 3, rng);
        if (s.winner) return;
        if (!p.alive) { advance(s); continue; }
      } else {
        const next = s.players[nextAlive(s, pi)];
        next.eq.push(no);
      }
    }
    const tu = has(p, 'tu');
    if (tu) {
      const c = flip(s, pi, 'Nhà tù', rng);
      p.eq.splice(p.eq.indexOf(tu), 1);
      s.discard.push(tu);
      if (!c || c.s !== 0) { log(s, `${p.id} bị giam, mất lượt`); advance(s); continue; }
      log(s, `${p.id} vượt ngục thành công`);
    }
    draw(s, pi, 2, rng);
    s.phase = 'play';
    s.bangUsed = false;
    return;
  }
}
function nextAlive(s, from) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) { const j = (from + k) % n; if (s.players[j].alive) return j; }
  return from;
}
function advance(s) { s.turn = nextAlive(s, s.turn); }
function endTurn(s, rng) { advance(s); startTurn(s, rng); }

// ---------- Phản ứng (Bắn, Bắn loạt, Phục kích, Đấu tay đôi) ----------
function responder(s) {
  const pd = s.pending;
  if (!pd) return null;
  return pd.kind === 'duel' ? pd.turnOf : pd.queue[0];
}

// Bỏ qua người đã chết; Thùng gỗ tự lật khi bị nhắm bằng Né.
function settle(s, rng) {
  const pd = s.pending;
  if (pd && pd.kind !== 'duel') {
    while (pd.queue.length) {
      const pi = idx(s, pd.queue[0]);
      const p = s.players[pi];
      if (!p.alive) { pd.queue.shift(); continue; }
      if (pd.need === 'ne' && has(p, 'thung') && !pd.barrel.includes(p.id)) {
        pd.barrel.push(p.id);
        const c = flip(s, pi, 'Thùng gỗ', rng);
        if (c && c.s === 0) { log(s, `${p.id} núp sau Thùng gỗ, tránh được`); pd.queue.shift(); continue; }
      }
      break;
    }
    if (!pd.queue.length) s.pending = null;
  }
  if (!s.pending && !s.winner) {
    s.phase = 'play';
    if (!s.players[s.turn].alive) endTurn(s, rng); // người đang tới lượt gục (vd thua đấu tay đôi) → chuyển lượt
  }
}

// Người đang bị nhắm chịu mất 1 máu rồi rời hàng chờ. Dùng chung cho "Chịu" và cho chủ bàn bỏ qua người offline.
function takeHit(s, pi, rng) {
  const pd = s.pending; // giữ tham chiếu: damage() có thể kết thúc ván và xoá s.pending
  damage(s, pi, 1, rng);
  if (s.pending !== pd) return;
  if (pd.kind === 'duel') s.pending = null; else pd.queue.shift();
}

function startPending(s, pd, rng) {
  s.pending = { barrel: [], ...pd };
  s.phase = 'react';
  settle(s, rng);
}

// ---------- Hành động ----------
const take = (arr, id) => { const k = arr.findIndex((c) => c.id === id); return k < 0 ? null : arr.splice(k, 1)[0]; };

export function apply(state, id, action, rng = Math.random) {
  if (state.winner) return fail('Ván đã kết thúc.');
  const s = structuredClone(state);
  const pi = idx(s, id);
  const p = s.players[pi];
  if (!p || !p.alive) return fail('Bạn không còn trong ván.');
  const type = action?.type;

  if (s.phase === 'react') {
    if (type !== 'respond' || responder(s) !== id) return fail('Đang chờ người bị nhắm phản ứng.');
    const pd = s.pending;
    const need = pd.kind === 'duel' ? 'ban' : pd.need;
    if (action.card != null) {
      const c = p.hand.find((x) => x.id === action.card);
      if (!c || c.t !== need) return fail(need === 'ne' ? 'Cần lá Né.' : 'Cần lá Bắn.');
      s.discard.push(take(p.hand, c.id));
      if (pd.kind === 'duel') pd.turnOf = pd.turnOf === pd.a ? pd.b : pd.a;
      else pd.queue.shift();
    } else takeHit(s, pi, rng);
    settle(s, rng);
    return { ok: true, state: s };
  }

  if (s.turn !== pi) return fail('Chưa tới lượt bạn.');

  if (s.phase === 'discard') {
    if (type !== 'discard' || !Array.isArray(action.cards)) return fail('Hãy chọn lá để bỏ.');
    const need = p.hand.length - p.hp;
    const ids = [...new Set(action.cards)];
    if (ids.length !== need || !ids.every((x) => p.hand.some((c) => c.id === x))) return fail(`Bỏ đúng ${need} lá.`);
    ids.forEach((x) => s.discard.push(take(p.hand, x)));
    endTurn(s, rng);
    return { ok: true, state: s };
  }

  if (s.phase !== 'play') return fail('Thao tác không hợp lệ.');
  if (type === 'end') {
    if (p.hand.length > p.hp) s.phase = 'discard'; else endTurn(s, rng);
    return { ok: true, state: s };
  }
  if (type !== 'play') return fail('Thao tác không hợp lệ.');
  const card = p.hand.find((c) => c.id === action.card);
  if (!card) return fail('Bạn không có lá này.');
  const ti = typeof action.target === 'string' ? idx(s, action.target) : -1;
  const tp = s.players[ti];
  const needTarget = () => tp && tp.alive && ti !== pi;
  const use = () => { s.discard.push(take(p.hand, card.id)); };

  switch (card.t) {
    case 'ban':
      if (!needTarget()) return fail('Chọn người để bắn.');
      if (s.bangUsed && has(p, 'gun')?.t !== 'lienthanh') return fail('Mỗi lượt chỉ được bắn 1 lần.');
      if (distance(s, pi, ti) > rangeOf(p)) return fail('Ngoài tầm bắn.');
      use(); s.bangUsed = true;
      log(s, `${id} bắn ${tp.id}`);
      startPending(s, { kind: 'ban', from: id, queue: [tp.id], need: 'ne' }, rng);
      break;
    case 'ne': return fail('Chỉ đánh Né khi bị bắn.');
    case 'bangbo':
      if (p.hp >= p.max) return fail('Máu đang đầy.');
      use(); p.hp++;
      break;
    case 'ruou':
      use(); s.players.forEach((x) => { if (x.alive && x.hp < x.max) x.hp++; });
      log(s, `${id} mời cả làng Rượu mừng`);
      break;
    case 'cuop': case 'pha': {
      if (!needTarget()) return fail('Chọn người.');
      if (card.t === 'cuop' && distance(s, pi, ti) > 1) return fail('Chỉ cướp được người ở khoảng cách 1.');
      let got;
      if (action.which === 'hand') {
        if (!tp.hand.length) return fail('Người đó không còn bài trên tay.');
        got = tp.hand.splice(Math.floor(rng() * tp.hand.length), 1)[0];
      } else {
        got = take(tp.eq, action.which);
        if (!got) return fail('Chọn 1 lá trên tay hoặc 1 trang bị.');
      }
      use();
      if (card.t === 'cuop') p.hand.push(got); else s.discard.push(got);
      log(s, `${id} ${card.t === 'cuop' ? 'cướp' : 'phá'} 1 lá của ${tp.id}`);
      break;
    }
    case 'duel':
      if (!needTarget()) return fail('Chọn người để thách đấu.');
      use();
      log(s, `${id} thách ${tp.id} đấu tay đôi`);
      startPending(s, { kind: 'duel', from: id, a: id, b: tp.id, turnOf: tp.id }, rng);
      break;
    case 'loat': case 'phuckich': {
      use();
      const seats = aliveIdx(s);
      const k = seats.indexOf(pi);
      const queue = [...seats.slice(k + 1), ...seats.slice(0, k)].map((i) => s.players[i].id);
      log(s, `${id} ${card.t === 'loat' ? 'bắn loạt' : 'phục kích'} cả làng`);
      startPending(s, { kind: card.t, from: id, queue, need: card.t === 'loat' ? 'ne' : 'ban' }, rng);
      break;
    }
    case 'tiepte': case 'tieptelon':
      use(); draw(s, pi, card.t === 'tiepte' ? 2 : 3, rng);
      break;
    case 'tu':
      if (!needTarget() || tp.role === 'cst' || has(tp, 'tu')) return fail('Không bỏ tù người này được.');
      take(p.hand, card.id); tp.eq.push(card);
      log(s, `${id} tống ${tp.id} vào tù`);
      break;
    default: {
      if (!EQUIP.includes(card.t)) return fail('Lá không hợp lệ.');
      const kind = kindOf(card.t);
      const old = has(p, kind);
      if (old && kind !== 'gun') return fail('Bạn đã có trang bị này.');
      if (old) { p.eq.splice(p.eq.indexOf(old), 1); s.discard.push(old); }
      take(p.hand, card.id); p.eq.push(card);
    }
  }
  return { ok: true, state: s };
}

// Bỏ qua người offline: đang bị nhắm thì chịu mất máu; đến lượt thì kết thúc lượt, bỏ bài thừa.
export function forceSkip(state, rng = Math.random) {
  if (state.winner) return state;
  const s = structuredClone(state);
  if (s.phase === 'react') {
    takeHit(s, idx(s, responder(s)), rng);
    settle(s, rng);
    return s;
  }
  const p = s.players[s.turn];
  while (p.hand.length > p.hp) s.discard.push(p.hand.pop());
  endTurn(s, rng);
  return s;
}

export function viewFor(s, id) {
  const mi = idx(s, id);
  if (mi < 0) return null;
  const me = s.players[mi];
  const reveal = (p) => p.role === 'cst' || !p.alive || p.id === id || s.winner;
  return {
    me: { id, role: me.role, hand: me.hand, alive: me.alive, range: rangeOf(me) },
    players: s.players.map((p, i) => ({
      id: p.id, hp: p.hp, max: p.max, alive: p.alive, handCount: p.hand.length, eq: p.eq,
      role: reveal(p) ? p.role : null, dist: me.alive && p.alive ? distance(s, mi, i) : null,
    })),
    turn: s.phase === 'react' ? responder(s) : s.players[s.turn].id,
    turnPlayer: s.players[s.turn].id,
    phase: s.phase, bangUsed: s.bangUsed, deckCount: s.deck.length,
    pending: s.pending && { kind: s.pending.kind, from: s.pending.from, need: s.pending.need, a: s.pending.a, b: s.pending.b, responder: responder(s) },
    lastFlip: s.lastFlip, log: s.log, winner: s.winner, winTeam: s.winTeam,
  };
}
