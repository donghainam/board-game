// Luật Loạn Đả Viễn Tây — thuần logic. Lá = {t: loại, s: chất 0♥ 1♦ 2♣ 3♠, id}. deck: phần tử cuối là lá trên cùng.

import { shuffle, fail } from '../shared/util.js';

export const GUN_RANGE = { sung2: 2, sung3: 3, sung4: 4, sung5: 5, lienthanh: 1 };
// Trang bị dùng 1 lần: đặt ra trước mặt, bỏ đi để kích hoạt (Mũ rộng vành chỉ dùng khi bị bắn).
export const ONESHOT = ['sunggiau', 'binhnuoc', 'mu', 'xetho', 'dao'];
const EQUIP = ['sung2', 'sung3', 'sung4', 'sung5', 'lienthanh', 'ngua', 'ongnhom', 'thung', 'tu', 'no', ...ONESHOT];
const COUNTS = { // mọi loại ít nhất 3 lá
  ban: 22, ne: 12, bangbo: 6, ruou: 3, cuop: 4, pha: 4, duel: 3, loat: 3, phuckich: 3, tiepte: 3, tieptelon: 3,
  chophien: 3, dam: 3, lach: 3, ruoumanh: 3, audai: 3,
  sung2: 3, sung3: 3, sung4: 3, sung5: 3, lienthanh: 3, ngua: 3, ongnhom: 3, thung: 3, tu: 3, no: 3,
  sunggiau: 3, binhnuoc: 3, mu: 3, xetho: 3, dao: 3,
};
const NAME = { ban: 'Bắn', ne: 'Né', lach: 'Lách người', mu: 'Mũ rộng vành' };
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
  laoluyen: { name: 'Tay súng lão luyện', hp: 3, text: 'Bắn không giới hạn những người ở khoảng cách 1 (người xa hơn vẫn 1 lần/lượt).' },
  lieumang: { name: 'Kẻ liều mạng', hp: 4, text: 'Trong lượt mình: chịu mất 1 máu để bốc 2 lá (dùng được tới khi còn 1 máu).' },
  thoren: { name: 'Thợ rèn súng', hp: 4, text: 'Tầm bắn +1 (cộng với súng).' },
  bacsi: { name: 'Bác sĩ làng', hp: 4, text: 'Khi người khác hồi máu: bỏ 1 lá để hồi 1 máu theo (trong 3 giây).' },
  traitim: { name: 'Người có Trái tim', hp: 4, text: 'Sắp mất máu vì Bắn / Bắn loạt: lật 1 lá, ra ♥ thì không mất máu.' },
  nhanhtay: { name: 'Cao bồi nhanh tay', hp: 4, text: 'Bị người khác Phá/Cướp thì được bắn trả ngay 1 phát miễn phí vào người đó.' },
  thamtu: { name: 'Thám tử', hp: 4, text: 'Đầu lượt xem lá trên cùng, được đẩy xuống đáy chồng rồi mới bốc.' },
  phuxe: { name: 'Phu xe ngựa', hp: 4, text: 'Tiếp tế và Tiếp tế lớn bốc thêm 1 lá.' },
  thayboi: { name: 'Thầy bói', hp: 4, text: 'Lật bài kiểm tra (Nhà tù, Thùng gỗ, Trái tim): ♦ cũng tính như ♥.' },
  khonglo: { name: 'Gã khổng lồ', hp: 9, text: '9 máu nhưng không dùng được lá Né (Thùng gỗ vẫn được); trên tay giữ tối đa 5 lá.' },
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
const bangLimit = (p) => (has(p, 'gun')?.t === 'lienthanh' ? Infinity : 1);
const handLimit = (p) => (is(p, 'khonglo') ? Math.min(p.hp, 5) : p.hp);
const OFFER_MS = 3000;
// Lật bài kiểm tra "ra ♥": Thầy bói tính cả ♦.
const isHeart = (p, c) => !!c && (c.s === 0 || (c.s === 1 && is(p, 'thayboi')));
// Hồi máu; người khác hồi thì Bác sĩ làng (nếu đang mất máu và có bài) được mời hồi theo trong 3 giây.
function heal(s, p, n) {
  const before = p.hp;
  p.hp = Math.min(p.max, p.hp + n);
  if (p.hp <= before) return;
  const doc = s.players.find((x) => x.alive && is(x, 'bacsi') && x !== p && x.hp < x.max && x.hand.length);
  if (doc) s.docOffer = { id: doc.id, until: (s.clock || 0) + OFFER_MS };
}

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
      if (c && c.s === 3) {
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
      if (!isHeart(p, c)) { log(s, `${p.id} bị giam, mất lượt`); advance(s); continue; }
      log(s, `${p.id} vượt ngục thành công`);
    }
    s.bangUsed = 0;
    if (is(p, 'moctui') && s.players.some((q, i) => i !== pi && q.alive && q.hand.length)) { s.phase = 'steal'; return; }
    if (is(p, 'thamtu') && (s.deck.length || s.discard.length > 1)) { refill(s, rng); s.phase = 'scout'; return; }
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
  if (pd.left <= 0) { pd.queue.shift(); delete pd.left; }
}

function settle(s, rng) {
  const pd = s.pending;
  if (pd && pd.kind !== 'duel') {
    while (pd.queue.length) {
      const pi = idx(s, pd.queue[0]);
      const p = s.players[pi];
      if (!p.alive) { pd.queue.shift(); delete pd.left; continue; }
      if (pd.need === 'ne' && has(p, 'thung') && !pd.barrel.includes(p.id)) {
        pd.barrel.push(p.id);
        const c = flip(s, pi, 'Thùng gỗ', rng);
        if (isHeart(p, c)) { log(s, `${p.id} núp sau Thùng gỗ`); dodged(s, pi, rng); continue; }
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
  const p = s.players[pi];
  if (is(p, 'traitim') && (pd.kind === 'ban' || pd.kind === 'loat') && isHeart(p, flip(s, pi, 'Trái tim', rng))) {
    log(s, `❤️ ${p.id} thoát nhờ Trái tim`);
    pd.queue.shift(); delete pd.left;
    return;
  }
  log(s, `${p.id} mất 1 máu`);
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
const counts = (p, c, need) => {
  if (is(p, 'khonglo')) return need === 'ban' && c.t === 'ban'; // Gã khổng lồ: không dùng Né / Lách người
  if (c.t === need || (need === 'ne' && c.t === 'lach')) return true;
  return is(p, 'haisung') && ((need === 'ne' && c.t === 'ban') || (need === 'ban' && c.t === 'ne'));
};

// ---------- Hành động ----------
const take = (arr, id) => { const k = arr.findIndex((c) => c.id === id); return k < 0 ? null : arr.splice(k, 1)[0]; };
// Lấy 1 lá của người khác: 'hand' = ngẫu nhiên trên tay, hoặc id 1 trang bị.
const grab = (tp, which, rng) => (which === 'hand'
  ? (tp.hand.length ? tp.hand.splice(Math.floor(rng() * tp.hand.length), 1)[0] : null)
  : take(tp.eq, which));
// Đang bỏ bài thừa mà hồi máu / bớt bài đủ mức thì xong lượt luôn.
function discardDone(s, pi, rng) {
  const p = s.players[pi];
  if (s.phase === 'discard' && s.turn === pi && p.hand.length <= handLimit(p)) endTurn(s, rng);
}
const done = (s, rng) => { wanderers(s, rng); return { ok: true, state: s }; };

export function apply(state, id, action, rng = Math.random, now = Date.now()) {
  if (state.winner) return fail('Ván đã kết thúc.');
  const s = structuredClone(state);
  s.clock = now;
  if (s.docOffer && now >= s.docOffer.until) s.docOffer = null;
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

  // Bác sĩ làng: hồi theo người khác (bỏ 1 lá) hoặc bỏ qua.
  if (type === 'doc') {
    if (!s.docOffer || s.docOffer.id !== id) return fail('Không có lời mời hồi máu.');
    s.docOffer = null;
    if (action.card == null) return done(s, rng);
    if (!p.hand.some((c) => c.id === action.card)) return fail('Bạn không có lá này.');
    s.discard.push(take(p.hand, action.card));
    p.hp = Math.min(p.max, p.hp + 1);
    log(s, `${id} hồi máu theo (Bác sĩ làng)`);
    discardDone(s, pi, rng);
    return done(s, rng);
  }

  // Ông lang vườn: bỏ 2 lá hồi 1 máu, lúc nào cũng được.
  if (type === 'heal2') {
    const ids = [...new Set(action.cards || [])];
    if (!is(p, 'langvuon') || ids.length !== 2 || !ids.every((x) => p.hand.some((c) => c.id === x))) return fail('Chọn đúng 2 lá trên tay.');
    if (p.hp >= p.max) return fail('Máu đang đầy.');
    ids.forEach((x) => s.discard.push(take(p.hand, x)));
    heal(s, p, 1);
    discardDone(s, pi, rng);
    return done(s, rng);
  }

  // Băng bó: hồi 1 máu bất kỳ lúc nào, kể cả trong lượt người khác.
  if (type === 'play' && p.hand.find((c) => c.id === action.card)?.t === 'bangbo') {
    if (p.hp >= p.max) return fail('Máu đang đầy.');
    const c = take(p.hand, action.card);
    s.discard.push(c);
    heal(s, p, 1);
    s.lastPlay = { by: id, card: { t: c.t, s: c.s }, target: null };
    log(s, `${id} dùng Băng bó`);
    discardDone(s, pi, rng);
    return done(s, rng);
  }

  // Chợ phiên: lần lượt mỗi người lấy 1 lá trên quầy; người cuối nhận lá còn lại.
  if (s.phase === 'store') {
    if (type !== 'store' || s.store.queue[0] !== id) return fail('Đang chờ người khác chọn ở Chợ phiên.');
    const c = take(s.store.cards, action.card);
    if (!c) return fail('Chọn 1 lá trên quầy.');
    p.hand.push(c);
    s.store.queue.shift();
    if (s.store.queue.length === 1) s.players[idx(s, s.store.queue.shift())].hand.push(s.store.cards.pop());
    if (!s.store.queue.length) { s.store = null; s.phase = 'play'; }
    return done(s, rng);
  }

  if (s.phase === 'react') {
    if (type !== 'respond' || responder(s) !== id) return fail('Đang chờ người bị nhắm phản ứng.');
    const pd = s.pending;
    const need = pd.kind === 'duel' ? 'ban' : pd.need;
    if (action.card != null) {
      const hat = need === 'ne' && p.eq.find((x) => x.id === action.card && x.t === 'mu');
      const c = hat || p.hand.find((x) => x.id === action.card);
      if (!c || !(hat || counts(p, c, need))) return fail(need === 'ne' ? 'Cần lá Né.' : 'Cần lá Bắn.');
      s.discard.push(take(hat ? p.eq : p.hand, c.id));
      if (c.t === 'lach') draw(s, pi, 1, rng);
      // Cho cả bàn thấy lá vừa đánh để phản ứng (đấu tay đôi: chỉ về đối thủ; còn lại: chỉ về người ra đòn).
      const foe = pd.kind === 'duel' ? (id === pd.a ? pd.b : pd.a) : pd.from;
      s.lastPlay = { by: id, card: { t: c.t, s: c.s }, target: foe };
      log(s, `${id} đánh ${NAME[c.t]}${pd.kind === 'duel' ? ' (đấu tay đôi)' : ''}`);
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

  if (s.phase === 'scout') {
    if (type !== 'scout') return fail('Xem lá trên cùng rồi chọn giữ hoặc đẩy xuống đáy.');
    if (action.bottom && s.deck.length > 1) s.deck.unshift(s.deck.pop());
    drawPhase(s, pi, rng, null);
    return done(s, rng);
  }

  if (s.phase === 'discard') {
    if (type !== 'discard' || !Array.isArray(action.cards)) return fail('Hãy chọn lá để bỏ.');
    const need = p.hand.length - handLimit(p);
    const ids = [...new Set(action.cards)];
    if (ids.length !== need || !ids.every((x) => p.hand.some((c) => c.id === x))) return fail(`Bỏ đúng ${need} lá.`);
    ids.forEach((x) => s.discard.push(take(p.hand, x)));
    endTurn(s, rng);
    return done(s, rng);
  }

  if (s.phase !== 'play') return fail('Thao tác không hợp lệ.');
  if (type === 'end') {
    if (p.hand.length > handLimit(p)) s.phase = 'discard'; else endTurn(s, rng);
    return done(s, rng);
  }
  if (type === 'gamble') {
    if (!is(p, 'lieumang') || p.hp <= 1) return fail('Không dùng được (cần còn hơn 1 máu).');
    p.hp--;
    draw(s, pi, 2, rng);
    log(s, `${id} liều mạng: mất 1 máu, bốc 2 lá`);
    return done(s, rng);
  }
  if (type === 'use') {
    const c = p.eq.find((x) => x.id === action.card && ONESHOT.includes(x.t));
    if (!c) return fail('Bạn không có trang bị này.');
    if (c.t === 'mu') return fail('Mũ rộng vành chỉ dùng khi bị bắn.');
    const ti = typeof action.target === 'string' ? idx(s, action.target) : -1;
    const tp = s.players[ti];
    const ok = tp && tp.alive && ti !== pi;
    if (c.t === 'binhnuoc' && p.hp >= p.max) return fail('Máu đang đầy.');
    if (c.t === 'sunggiau' && (!ok || distance(s, pi, ti) > 1)) return fail('Súng giấu chỉ bắn người ở khoảng cách 1.');
    if (c.t === 'dao' && (!ok || distance(s, pi, ti) > rangeOf(p))) return fail('Ngoài tầm.');
    if (c.t === 'xetho' && !ok) return fail('Chọn người.');
    s.discard.push(take(p.eq, c.id));
    s.lastPlay = { by: id, card: { t: c.t, s: c.s }, target: ok ? tp.id : null };
    if (c.t === 'binhnuoc') { heal(s, p, 1); log(s, `${id} uống Bình nước`); }
    if (c.t === 'xetho') {
      const got = grab(tp, action.which, rng);
      if (!got) return fail('Chọn 1 lá trên tay hoặc 1 trang bị.');
      p.hand.push(got);
      log(s, `${id} dùng Xe thồ lấy 1 lá của ${tp.id}`);
    }
    if (c.t === 'sunggiau' || c.t === 'dao') {
      if (c.t === 'sunggiau') draw(s, pi, 1, rng);
      log(s, `${id} ${c.t === 'dao' ? 'phóng dao vào' : 'bắn lén'} ${tp.id}`);
      startPending(s, { kind: 'ban', how: c.t === 'dao' ? 'phóng dao vào' : 'bắn lén', from: id, queue: [tp.id], need: 'ne' }, rng);
    }
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
      const free = is(p, 'laoluyen') && distance(s, pi, ti) === 1; // lão luyện: bắn người kề bên không giới hạn
      if (!free && s.bangUsed >= bangLimit(p)) return fail('Lượt này bạn đã bắn đủ số lần.');
      if (distance(s, pi, ti) > rangeOf(p)) return fail('Ngoài tầm bắn.');
      use(); if (!free) s.bangUsed++;
      log(s, `${id} bắn ${tp.id}`);
      startPending(s, { kind: 'ban', from: id, queue: [tp.id], need: 'ne', need2: is(p, 'thep') ? 2 : 1 }, rng);
      break;
    case 'ne': case 'lach': return fail('Chỉ đánh lá này khi bị bắn.');
    case 'ruou': // chọn: cả bàn hồi 1 máu, hoặc riêng mình hồi 1 máu
      if (action.self) {
        if (p.hp >= p.max) return fail('Máu đang đầy.');
        use(); heal(s, p, 1);
        log(s, `${id} uống Rượu mừng một mình`);
      } else {
        use(); s.players.forEach((x) => { if (x.alive) heal(s, x, 1); });
        log(s, `${id} mời cả làng Rượu mừng`);
      }
      break;
    case 'dam':
      if (!needTarget() || distance(s, pi, ti) > 1) return fail('Chỉ đấm được người ở khoảng cách 1.');
      use();
      log(s, `${id} đấm ${tp.id}`);
      startPending(s, { kind: 'ban', how: 'đấm', from: id, queue: [tp.id], need: 'ne' }, rng);
      break;
    case 'ruoumanh': case 'audai': {
      const ex = action.extra !== card.id && p.hand.find((c) => c.id === action.extra);
      if (!ex) return fail('Chọn thêm 1 lá trên tay để bỏ kèm.');
      if (t === 'ruoumanh' && (!tp || !tp.alive || tp.hp >= tp.max)) return fail('Chọn người đang mất máu.');
      use(); s.discard.push(take(p.hand, ex.id));
      if (t === 'ruoumanh') { heal(s, tp, 1); log(s, `${id} mời ${tp.id} Rượu mạnh`); } else {
        s.players.forEach((q, i) => { if (i !== pi && q.alive && q.hand.length) s.discard.push(grab(q, 'hand', rng)); });
        log(s, `${id} gây Ẩu đả: mỗi người mất 1 lá trên tay`);
      }
      break;
    }
    case 'chophien': {
      use();
      const seats = aliveIdx(s);
      const k = seats.indexOf(pi);
      const queue = [...seats.slice(k), ...seats.slice(0, k)].map((i) => s.players[i].id);
      const cards = [];
      for (let n = 0; n < queue.length; n++) { refill(s, rng); const c = s.deck.pop(); if (c) cards.push(c); }
      log(s, `${id} mở Chợ phiên`);
      if (cards.length) { s.store = { cards, queue: queue.slice(0, cards.length) }; s.phase = 'store'; }
      break;
    }
    case 'cuop': case 'pha': {
      if (!needTarget()) return fail('Chọn người.');
      if (t === 'cuop' && distance(s, pi, ti) > 1) return fail('Ngoài tầm cướp.');
      if (action.which === 'hand' && !tp.hand.length) return fail('Người đó không còn bài trên tay.');
      const got = grab(tp, action.which, rng);
      if (!got) return fail('Chọn 1 lá trên tay hoặc 1 trang bị.');
      use();
      if (t === 'cuop') p.hand.push(got); else s.discard.push(got);
      log(s, `${id} ${t === 'cuop' ? 'cướp' : 'phá'} 1 lá của ${tp.id}`);
      if (is(tp, 'nhanhtay')) { // Cao bồi nhanh tay bắn trả miễn phí
        log(s, `${tp.id} rút súng bắn trả ${id}`);
        s.lastPlay = { by: id, card: { t: card.t, s: card.s }, target: tp.id };
        startPending(s, { kind: 'ban', from: tp.id, queue: [id], need: 'ne', need2: is(tp, 'thep') ? 2 : 1 }, rng);
        return done(s, rng);
      }
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
  if (s.phase === 'steal' || s.phase === 'scout') { drawPhase(s, s.turn, rng, null); return s; }
  if (s.phase === 'store') return apply(s, s.store.queue[0], { type: 'store', card: s.store.cards[0].id }, rng).state;
  const p = s.players[s.turn];
  while (p.hand.length > handLimit(p)) s.discard.push(p.hand.pop());
  endTurn(s, rng);
  wanderers(s, rng);
  return s;
}

export const nextTimer = (s) => (s.docOffer && !s.winner ? s.docOffer.until : null);
export function onTimer(state, now) {
  if (!state.docOffer || now < state.docOffer.until) return state;
  return { ...state, docOffer: null };
}

export function viewFor(s, id) {
  const mi = idx(s, id);
  if (mi < 0) return null;
  const me = s.players[mi];
  const reveal = (p) => p.role === 'cst' || !p.alive || p.id === id || s.winner;
  const picking = s.phase === 'pick';
  return {
    me: { id, role: me.role, hand: me.hand, alive: me.alive, range: rangeOf(me), char: me.char, offer: picking && !me.char ? me.offer : null, bangLimit: Math.min(99, bangLimit(me)), handLimit: handLimit(me) },
    players: s.players.map((p, i) => ({
      id: p.id, hp: p.hp, max: p.max, alive: p.alive, handCount: p.hand.length, eq: p.eq,
      role: reveal(p) ? p.role : null, dist: me.alive && p.alive && !picking ? distance(s, mi, i) : null,
      char: picking ? null : p.char, picked: !!p.char, // chức năng chỉ công khai khi cả bàn chọn xong
    })),
    turn: picking ? null : s.phase === 'react' ? responder(s) : s.phase === 'store' ? s.store.queue[0] : s.players[s.turn].id,
    turnPlayer: s.players[s.turn].id,
    waitingOn: picking ? s.players.filter((p) => !p.char).map((p) => p.id) : undefined,
    phase: s.phase, bangUsed: s.bangUsed, deckCount: s.deck.length,
    store: s.store ? { cards: s.store.cards, turn: s.store.queue[0] } : null,
    pending: s.pending && { kind: s.pending.kind, how: s.pending.how, from: s.pending.from, need: s.pending.need, a: s.pending.a, b: s.pending.b, responder: responder(s), left: s.pending.left ?? s.pending.need2 ?? 1 },
    lastFlip: s.lastFlip, lastPlay: s.lastPlay || null, log: s.log,
    scout: s.phase === 'scout' && s.turn === mi ? (({ t, s: su }) => ({ t, s: su }))(s.deck.at(-1)) : null,
    docOffer: s.docOffer?.id === id ? true : null, winner: s.winner, winTeam: s.winTeam,
  };
}
