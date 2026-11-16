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
// 16 chức năng: mỗi người được chia 2, chọn giữ 1, công khai khi cả bàn chọn xong.
export const CHARS = {
  gapthoi: { name: 'Gã gặp thời', hp: 4, text: 'Bốc đầu lượt: lật lá thứ 2 cho cả bàn xem, ra ♥/♦ thì bốc thêm 1 lá.' },
  haisung: { name: 'Cô nàng hai súng', hp: 4, text: 'Dùng Bắn thay Né và Né thay Bắn.' },
  moctui: { name: 'Kẻ móc túi', hp: 4, text: 'Lá bốc đầu tiên mỗi lượt được rút ngẫu nhiên từ tay một người tự chọn.' },
  langvuon: { name: 'Ông lang vườn', hp: 4, text: 'Bỏ 2 lá bất kỳ để hồi 1 máu, lúc nào cũng được.' },
  thep: { name: 'Tay súng thép', hp: 4, text: 'Muốn né Bắn của người này phải đánh 2 lá Né.' },
  langthang: { name: 'Kẻ lang thang', hp: 4, text: 'Hết bài trên tay thì bốc ngay 1 lá.' },
  laoluyen: { name: 'Tay súng lão luyện', hp: 3, text: 'Mỗi lượt được đánh 2 lá Bắn.' },
  lieumang: { name: 'Kẻ liều mạng', hp: 4, text: 'Khi chỉ còn 1 máu: bắn không giới hạn.' },
  thoren: { name: 'Thợ rèn súng', hp: 4, text: 'Tầm bắn +1 (cộng với súng).' },
  bacsi: { name: 'Bác sĩ làng', hp: 4, text: 'Băng bó hồi 2 máu.' },
  quanruou: { name: 'Chủ quán rượu', hp: 4, text: 'Đầu lượt: nếu đang mất máu thì hồi 1 máu thay cho lá bốc thứ 2.' },
  nhanhtay: { name: 'Cao bồi nhanh tay', hp: 4, text: 'Né thành công thì bốc 1 lá.' },
  tromngua: { name: 'Kẻ trộm ngựa', hp: 3, text: 'Cướp được người ở khoảng cách 2.' },
  phuxe: { name: 'Phu xe ngựa', hp: 4, text: 'Tiếp tế và Tiếp tế lớn bốc thêm 1 lá.' },
  thayboi: { name: 'Thầy bói', hp: 4, text: 'Miễn nhiễm Thuốc nổ: lật ra ♠ cũng không nổ, chỉ chuyền tiếp.' },
  nguoithep: { name: 'Người thép', hp: 4, text: 'Không mất máu vì Bắn loạt và Phục kích.' },
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
  const order = shuffle(ROLES[ids.length].slice(1), rng);
  const sheriff = Math.floor(rng() * ids.length); // Cảnh sát trưởng ngẫu nhiên, lộ mặt, đi trước
  const chars = shuffle(Object.keys(CHARS), rng);
  const players = ids.map((id, i) => ({
    id, role: i === sheriff ? 'cst' : order.pop(), char: null, offer: chars.splice(0, 2),
    hp: 0, max: 0, hand: [], eq: [], alive: true,
  }));
  return {
    players, deck: shuffle(buildDeck(), rng), discard: [], turn: sheriff, phase: 'pick',
    bangUsed: 0, pending: null, lastFlip: null, log: [], winner: null, winTeam: null,
  };
}

// Cả bàn chọn xong chức năng → đặt máu, chia bài, bắt đầu lượt Cảnh sát trưởng.
function begin(s, rng) {
  s.players.forEach((p, i) => {
    p.max = p.hp = CHARS[p.char].hp + (p.role === 'cst' ? 1 : 0);
    delete p.offer;
    draw(s, i, p.hp, rng);
  });
  log(s, 'Cả bàn đã chọn chức năng. Bắt đầu!');
  startTurn(s, rng);
}

// ---------- Tiện ích ----------
const log = (s, t) => { s.log = [...s.log.slice(-7), t]; };
const idx = (s, id) => s.players.findIndex((p) => p.id === id);
const has = (p, kind) => p.eq.find((c) => kindOf(c.t) === kind);
const is = (p, ch) => p?.char === ch;
const aliveIdx = (s) => s.players.map((p, i) => (p.alive ? i : -1)).filter((i) => i >= 0);

function refill(s, rng) {
  if (s.deck.length) return;
  const top = s.discard.pop();
  s.deck = shuffle(s.discard, rng);
  s.discard = top ? [top] : [];
}
function draw(s, pi, n, rng) {
  const got = [];
  for (let k = 0; k < n; k++) { refill(s, rng); const c = s.deck.pop(); if (c) { s.players[pi].hand.push(c); got.push(c); } }
  return got;
}
function flip(s, pi, why, rng) {
  refill(s, rng);
  const c = s.deck.pop();
  if (!c) return null;
  s.discard.push(c);
  s.lastFlip = { by: s.players[pi].id, why, card: c };
  return c;
}
// Kẻ lang thang: hết bài thì bốc ngay 1 lá.
function wanderers(s, rng) {
  s.players.forEach((p, i) => { if (p.alive && is(p, 'langthang') && !p.hand.length && s.phase !== 'pick') draw(s, i, 1, rng); });
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
const rangeOf = (p) => (GUN_RANGE[has(p, 'gun')?.t] || 1) + (is(p, 'thoren') ? 1 : 0);
function bangLimit(p) {
  if (has(p, 'gun')?.t === 'lienthanh' || (is(p, 'lieumang') && p.hp === 1)) return Infinity;
  return is(p, 'laoluyen') ? 2 : 1;
}
const heal = (p, n) => { p.hp = Math.min(p.max, p.hp + n); };

// ---------- Máu, chết, thắng thua ----------
function damage(s, pi, n, rng) {
  const p = s.players[pi];
  if (!p.alive) return;
  p.hp -= n;
  while (p.hp <= 0 && aliveIdx(s).length > 2) {
    const k = p.hand.findIndex((c) => c.t === 'bangbo');
    if (k < 0) break;
    s.discard.push(...p.hand.splice(k, 1));
    p.hp += is(p, 'bacsi') ? 2 : 1;
    log(s, `${p.id} dùng Băng bó để sống sót`);
  }
  while (p.hp <= 0 && is(p, 'langvuon') && p.hand.length >= 2) { // Ông lang vườn tự bỏ 2 lá để sống
    s.discard.push(...p.hand.splice(0, 2));
    p.hp++;
    log(s, `${p.id} bỏ 2 lá để hồi máu`);
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
  if (!alive.some((p) => p.role === 'cst')) {
    if (alive.length === 1 && alive[0].role === 'phanboi') { s.winner = [alive[0].id]; s.winTeam = 'phanboi'; } else { s.winner = ids(['cuop']); s.winTeam = 'cuop'; }
  } else if (!alive.some((p) => p.role === 'cuop' || p.role === 'phanboi')) { s.winner = ids(['cst', 'pho']); s.winTeam = 'luat'; }
  if (s.winner) { s.phase = 'end'; s.pending = null; }
}

// ---------- Lượt ----------
function startTurn(s, rng) {
  s.lastFlip = null; // dòng "vừa lật bài" chỉ giữ trong lượt của nó
  for (let guard = 0; guard < 20 && !s.winner; guard++) {
    const pi = s.turn;
    const p = s.players[pi];
    const no = has(p, 'no');
    if (no) {
      const c = flip(s, pi, 'Thuốc nổ', rng);
      p.eq.splice(p.eq.indexOf(no), 1);
      if (c && c.s === 3 && !is(p, 'thayboi')) {
        s.discard.push(no);
        log(s, `💥 Thuốc nổ phát nổ trước mặt ${p.id}`);
        damage(s, pi, 3, rng);
        if (s.winner) return;
        if (!p.alive) { advance(s); continue; }
      } else s.players[nextAlive(s, pi)].eq.push(no);
    }
    const tu = has(p, 'tu');
    if (tu) {
      const c = flip(s, pi, 'Nhà tù', rng);
      p.eq.splice(p.eq.indexOf(tu), 1);
      s.discard.push(tu);
      if (!c || c.s !== 0) { log(s, `${p.id} bị giam, mất lượt`); advance(s); continue; }
      log(s, `${p.id} vượt ngục thành công`);
    }
    s.bangUsed = 0;
    if (is(p, 'moctui') && s.players.some((q, i) => i !== pi && q.alive && q.hand.length)) { s.phase = 'steal'; return; }
    drawPhase(s, pi, rng, null);
    return;
  }
}

// Bốc đầu lượt (2 lá), áp dụng các chức năng liên quan. from: id người bị Kẻ móc túi rút lá đầu.
function drawPhase(s, pi, rng, from) {
  const p = s.players[pi];
  let n = 2;
  if (from) {
    const q = s.players[idx(s, from)];
    p.hand.push(q.hand.splice(Math.floor(rng() * q.hand.length), 1)[0]);
    log(s, `${p.id} móc túi ${q.id}`);
    n--;
  }
  if (is(p, 'quanruou') && p.hp < p.max) { heal(p, 1); n--; log(s, `${p.id} nghỉ quán, hồi 1 máu`); }
  const got = draw(s, pi, n, rng);
  if (is(p, 'gapthoi') && got.length === 2) {
    s.lastFlip = { by: p.id, why: 'Gã gặp thời', card: got[1] };
    if (got[1].s <= 1) draw(s, pi, 1, rng);
  }
  s.phase = 'play';
  wanderers(s, rng);
}
function nextAlive(s, from) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) { const j = (from + k) % n; if (s.players[j].alive) return j; }
  return from;
}
function advance(s) { s.turn = nextAlive(s, s.turn); }
function endTurn(s, rng) { advance(s); startTurn(s, rng); }

// ---------- Phản ứng ----------
function responder(s) {
  const pd = s.pending;
  if (!pd) return null;
  return pd.kind === 'duel' ? pd.turnOf : pd.queue[0];
}
// Né được 1 lần (bằng lá hoặc Thùng gỗ): đòn của Tay súng thép cần 2 lần.
function dodged(s, pi, rng) {
  const pd = s.pending;
  pd.left = (pd.left ?? pd.need2 ?? 1) - 1;
  if (is(s.players[pi], 'nhanhtay')) draw(s, pi, 1, rng);
  if (pd.left <= 0) { pd.queue.shift(); delete pd.left; }
}

function settle(s, rng) {
  const pd = s.pending;
  if (pd && pd.kind !== 'duel') {
    while (pd.queue.length) {
      const pi = idx(s, pd.queue[0]);
      const p = s.players[pi];
      if (!p.alive || (is(p, 'nguoithep') && (pd.kind === 'loat' || pd.kind === 'phuckich'))) { pd.queue.shift(); delete pd.left; continue; }
      if (pd.need === 'ne' && has(p, 'thung') && !pd.barrel.includes(p.id)) {
        pd.barrel.push(p.id);
        const c = flip(s, pi, 'Thùng gỗ', rng);
        if (c && c.s === 0) { log(s, `${p.id} núp sau Thùng gỗ`); dodged(s, pi, rng); continue; }
      }
      break;
    }
    if (!pd.queue.length) s.pending = null;
  }
  if (!s.pending && !s.winner) {
    s.phase = 'play';
    if (!s.players[s.turn].alive) endTurn(s, rng); // người đang tới lượt gục (vd thua đấu tay đôi)
  }
}

function takeHit(s, pi, rng) {
  const pd = s.pending; // damage() có thể kết thúc ván và xoá s.pending
  log(s, `${s.players[pi].id} mất 1 máu`);
  damage(s, pi, 1, rng);
  if (s.pending !== pd) return;
  if (pd.kind === 'duel') s.pending = null; else { pd.queue.shift(); delete pd.left; }
}

function startPending(s, pd, rng) {
  s.pending = { barrel: [], ...pd };
  s.phase = 'react';
  settle(s, rng);
}

// Lá này dùng được như loại `need` không (Cô nàng hai súng: Bắn ↔ Né).
const counts = (p, c, need) => c.t === need || (is(p, 'haisung') && ((need === 'ne' && c.t === 'ban') || (need === 'ban' && c.t === 'ne')));

// ---------- Hành động ----------
const take = (arr, id) => { const k = arr.findIndex((c) => c.id === id); return k < 0 ? null : arr.splice(k, 1)[0]; };
const done = (s, rng) => { wanderers(s, rng); return { ok: true, state: s }; };

export function apply(state, id, action, rng = Math.random) {
  if (state.winner) return fail('Ván đã kết thúc.');
  const s = structuredClone(state);
  const pi = idx(s, id);
  const p = s.players[pi];
  if (!p || !p.alive) return fail('Bạn không còn trong ván.');
  const type = action?.type;

  if (s.phase === 'pick') {
    if (type !== 'pick' || p.char || !p.offer.includes(action.char)) return fail('Hãy chọn 1 trong 2 chức năng được chia.');
    p.char = action.char;
    if (s.players.every((x) => x.char)) begin(s, rng);
    return { ok: true, state: s };
  }

  // Ông lang vườn: bỏ 2 lá hồi 1 máu, lúc nào cũng được.
  if (type === 'heal2') {
    const ids = [...new Set(action.cards || [])];
    if (!is(p, 'langvuon') || ids.length !== 2 || !ids.every((x) => p.hand.some((c) => c.id === x))) return fail('Chọn đúng 2 lá trên tay.');
    if (p.hp >= p.max) return fail('Máu đang đầy.');
    ids.forEach((x) => s.discard.push(take(p.hand, x)));
    heal(p, 1);
    if (s.phase === 'discard' && s.turn === pi && p.hand.length <= p.hp) endTurn(s, rng); // hết thừa bài → xong lượt
    return done(s, rng);
  }

  if (s.phase === 'react') {
    if (type !== 'respond' || responder(s) !== id) return fail('Đang chờ người bị nhắm phản ứng.');
    const pd = s.pending;
    const need = pd.kind === 'duel' ? 'ban' : pd.need;
    if (action.card != null) {
      const c = p.hand.find((x) => x.id === action.card);
      if (!c || !counts(p, c, need)) return fail(need === 'ne' ? 'Cần lá Né.' : 'Cần lá Bắn.');
      s.discard.push(take(p.hand, c.id));
      // Cho cả bàn thấy lá vừa đánh để phản ứng (đấu tay đôi: chỉ về đối thủ; còn lại: chỉ về người ra đòn).
      const foe = pd.kind === 'duel' ? (id === pd.a ? pd.b : pd.a) : pd.from;
      s.lastPlay = { by: id, card: { t: c.t, s: c.s }, target: foe };
      log(s, `${id} đánh ${c.t === 'ban' ? 'Bắn' : 'Né'}${pd.kind === 'duel' ? ' (đấu tay đôi)' : ''}`);
      if (pd.kind === 'duel') pd.turnOf = pd.turnOf === pd.a ? pd.b : pd.a;
      else if (need === 'ne') dodged(s, pi, rng);
      else pd.queue.shift();
    } else takeHit(s, pi, rng);
    settle(s, rng);
    return done(s, rng);
  }

  if (s.turn !== pi) return fail('Chưa tới lượt bạn.');

  if (s.phase === 'steal') {
    if (type !== 'steal') return fail('Chọn người để móc túi (hoặc bốc bình thường).');
    const t = action.target ?? null;
    if (t !== null) {
      const q = s.players[idx(s, t)];
      if (!q || !q.alive || q.id === id || !q.hand.length) return fail('Người này không có bài để móc.');
    }
    drawPhase(s, pi, rng, t);
    return done(s, rng);
  }

  if (s.phase === 'discard') {
    if (type !== 'discard' || !Array.isArray(action.cards)) return fail('Hãy chọn lá để bỏ.');
    const need = p.hand.length - p.hp;
    const ids = [...new Set(action.cards)];
    if (ids.length !== need || !ids.every((x) => p.hand.some((c) => c.id === x))) return fail(`Bỏ đúng ${need} lá.`);
    ids.forEach((x) => s.discard.push(take(p.hand, x)));
    endTurn(s, rng);
    return done(s, rng);
  }

  if (s.phase !== 'play') return fail('Thao tác không hợp lệ.');
  if (type === 'end') {
    if (p.hand.length > p.hp) s.phase = 'discard'; else endTurn(s, rng);
    return done(s, rng);
  }
  if (type !== 'play') return fail('Thao tác không hợp lệ.');
  const card = p.hand.find((c) => c.id === action.card);
  if (!card) return fail('Bạn không có lá này.');
  const ti = typeof action.target === 'string' ? idx(s, action.target) : -1;
  const tp = s.players[ti];
  const needTarget = () => tp && tp.alive && ti !== pi;
  const use = () => { s.discard.push(take(p.hand, card.id)); };
  const t = card.t === 'ne' && is(p, 'haisung') ? 'ban' : card.t; // Cô nàng hai súng: Né dùng như Bắn

  switch (t) {
    case 'ban':
      if (!needTarget()) return fail('Chọn người để bắn.');
      if (s.bangUsed >= bangLimit(p)) return fail('Lượt này bạn đã bắn đủ số lần.');
      if (distance(s, pi, ti) > rangeOf(p)) return fail('Ngoài tầm bắn.');
      use(); s.bangUsed++;
      log(s, `${id} bắn ${tp.id}`);
      startPending(s, { kind: 'ban', from: id, queue: [tp.id], need: 'ne', need2: is(p, 'thep') ? 2 : 1 }, rng);
      break;
    case 'ne': return fail('Chỉ đánh Né khi bị bắn.');
    case 'bangbo':
      if (p.hp >= p.max) return fail('Máu đang đầy.');
      use(); heal(p, is(p, 'bacsi') ? 2 : 1);
      break;
    case 'ruou':
      use(); s.players.forEach((x) => { if (x.alive) heal(x, 1); });
      log(s, `${id} mời cả làng Rượu mừng`);
      break;
    case 'cuop': case 'pha': {
      if (!needTarget()) return fail('Chọn người.');
      if (t === 'cuop' && distance(s, pi, ti) > (is(p, 'tromngua') ? 2 : 1)) return fail('Ngoài tầm cướp.');
      let got;
      if (action.which === 'hand') {
        if (!tp.hand.length) return fail('Người đó không còn bài trên tay.');
        got = tp.hand.splice(Math.floor(rng() * tp.hand.length), 1)[0];
      } else {
        got = take(tp.eq, action.which);
        if (!got) return fail('Chọn 1 lá trên tay hoặc 1 trang bị.');
      }
      use();
      if (t === 'cuop') p.hand.push(got); else s.discard.push(got);
      log(s, `${id} ${t === 'cuop' ? 'cướp' : 'phá'} 1 lá của ${tp.id}`);
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
      log(s, `${id} ${t === 'loat' ? 'bắn loạt' : 'phục kích'} cả làng`);
      startPending(s, { kind: t, from: id, queue, need: t === 'loat' ? 'ne' : 'ban' }, rng);
      break;
    }
    case 'tiepte': case 'tieptelon':
      use(); draw(s, pi, (t === 'tiepte' ? 2 : 3) + (is(p, 'phuxe') ? 1 : 0), rng);
      break;
    case 'tu':
      if (!needTarget() || tp.role === 'cst' || has(tp, 'tu')) return fail('Không bỏ tù người này được.');
      take(p.hand, card.id); tp.eq.push(card);
      log(s, `${id} tống ${tp.id} vào tù`);
      break;
    default: {
      if (!EQUIP.includes(t)) return fail('Lá không hợp lệ.');
      const kind = kindOf(t);
      const old = has(p, kind);
      if (old && kind !== 'gun') return fail('Bạn đã có trang bị này.');
      if (old) { p.eq.splice(p.eq.indexOf(old), 1); s.discard.push(old); }
      take(p.hand, card.id); p.eq.push(card);
    }
  }
  s.lastPlay = { by: id, card: { t: card.t, s: card.s }, target: tp && ti !== pi ? tp.id : null };
  return done(s, rng);
}

// Bỏ qua người offline: chưa chọn chức năng → chọn lá đầu; đang bị nhắm → chịu mất máu;
// Kẻ móc túi → bốc bình thường; đến lượt → kết thúc lượt, bỏ bài thừa.
// stuck: id những người đang offline (do chủ bàn bỏ qua); không truyền thì áp dụng cho mọi người còn thiếu.
export function forceSkip(state, rng = Math.random, stuck = null) {
  if (state.winner) return state;
  const s = structuredClone(state);
  if (s.phase === 'pick') {
    s.players.forEach((p) => { if (!p.char && (!stuck || stuck.includes(p.id))) p.char = p.offer[0]; });
    if (s.players.every((p) => p.char)) begin(s, rng);
    return s;
  }
  if (s.phase === 'react') {
    takeHit(s, idx(s, responder(s)), rng);
    settle(s, rng);
    wanderers(s, rng);
    return s;
  }
  if (s.phase === 'steal') { drawPhase(s, s.turn, rng, null); return s; }
  const p = s.players[s.turn];
  while (p.hand.length > p.hp) s.discard.push(p.hand.pop());
  endTurn(s, rng);
  wanderers(s, rng);
  return s;
}

export function viewFor(s, id) {
  const mi = idx(s, id);
  if (mi < 0) return null;
  const me = s.players[mi];
  const reveal = (p) => p.role === 'cst' || !p.alive || p.id === id || s.winner;
  const picking = s.phase === 'pick';
  return {
    me: { id, role: me.role, hand: me.hand, alive: me.alive, range: rangeOf(me), char: me.char, offer: picking && !me.char ? me.offer : null, bangLimit: Math.min(99, bangLimit(me)) },
    players: s.players.map((p, i) => ({
      id: p.id, hp: p.hp, max: p.max, alive: p.alive, handCount: p.hand.length, eq: p.eq,
      role: reveal(p) ? p.role : null, dist: me.alive && p.alive && !picking ? distance(s, mi, i) : null,
      char: picking ? null : p.char, picked: !!p.char, // chức năng chỉ công khai khi cả bàn chọn xong
    })),
    turn: picking ? null : s.phase === 'react' ? responder(s) : s.players[s.turn].id,
    turnPlayer: s.players[s.turn].id,
    waitingOn: picking ? s.players.filter((p) => !p.char).map((p) => p.id) : undefined,
    phase: s.phase, bangUsed: s.bangUsed, deckCount: s.deck.length,
    pending: s.pending && { kind: s.pending.kind, from: s.pending.from, need: s.pending.need, a: s.pending.a, b: s.pending.b, responder: responder(s), left: s.pending.left ?? s.pending.need2 ?? 1 },
    lastFlip: s.lastFlip, lastPlay: s.lastPlay || null, log: s.log, winner: s.winner, winTeam: s.winTeam,
  };
}
