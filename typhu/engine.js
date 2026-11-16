// Luật Cờ Tỷ Phú — thuần logic. Tiền tính bằng đồng (VNĐ ảo). Xúc xắc và thẻ sự kiện chỉ host gieo/rút.

import { shuffle, fail } from '../shared/util.js';

const K = 1000, M = 1_000_000;
const L = (name, g, price) => ({ t: 'land', name, g, price });
const AIR = (name) => ({ t: 'air', name, price: 2 * M });
const UTIL = (name) => ({ t: 'util', name, price: 1.5 * M });
const EV = { t: 'event', name: 'Sự kiện' };

export const BOARD = [
  { t: 'start', name: 'Xuất phát' }, L('Hà Giang', 1, 600 * K), EV, L('Cao Bằng', 1, 600 * K),
  { t: 'tax', name: 'Thuế thu nhập', amount: 2 * M }, AIR('Sân bay Nội Bài'),
  L('Lạng Sơn', 2, 1 * M), EV, L('Điện Biên', 2, 1 * M), L('Sơn La', 2, 1.2 * M),
  { t: 'jail', name: 'Nhà tù' }, L('Thanh Hoá', 3, 1.4 * M), UTIL('Điện lực'), L('Nghệ An', 3, 1.4 * M), L('Hà Tĩnh', 3, 1.6 * M),
  AIR('Sân bay Đà Nẵng'), L('Huế', 4, 1.8 * M), EV, L('Quảng Nam', 4, 1.8 * M), L('Quảng Ngãi', 4, 2 * M),
  { t: 'festival', name: 'Lễ hội' }, L('Bình Định', 5, 2.2 * M), EV, L('Khánh Hoà', 5, 2.2 * M), L('Lâm Đồng', 5, 2.4 * M),
  AIR('Sân bay Cam Ranh'), L('An Giang', 6, 2.6 * M), L('Kiên Giang', 6, 2.6 * M), UTIL('Cấp nước'), L('Cần Thơ', 6, 2.8 * M),
  { t: 'gojail', name: 'Vào tù' }, L('Quảng Ninh', 7, 3 * M), L('Hải Phòng', 7, 3 * M), EV, L('Bình Dương', 7, 3.2 * M),
  AIR('Sân bay Tân Sơn Nhất'), EV, L('Hà Nội', 8, 3.5 * M), { t: 'tax', name: 'Thuế xa xỉ', amount: 1 * M }, L('TP. Hồ Chí Minh', 8, 4 * M),
];

export const EVENTS = [
  { text: 'Trúng vé số! Nhận 2.000.000đ', cash: 2 * M },
  { text: 'Bão lũ: sửa nhà 250.000đ mỗi nhà, 1.000.000đ mỗi Công trình', repair: [250 * K, 1 * M] },
  { text: 'Đi du lịch: bay tới sân bay gần nhất phía trước', nextAir: true },
  { text: 'Bị bắt quả tang trốn thuế: vào tù!', jail: true },
  { text: 'Thẻ được tại ngoại: giữ lại để ra tù miễn phí', jailCard: true },
  { text: 'Đi lạc đường: lùi lại 3 ô', back: 3 },
  { text: 'Sinh nhật bạn: mỗi người tặng bạn 200.000đ', fromEach: 200 * K },
  { text: 'Mời cả bàn ăn phở: trả mỗi người 200.000đ', toEach: 200 * K },
  { text: 'Phạt vi phạm giao thông 300.000đ', cash: -300 * K },
  { text: 'Nhận thưởng Tết 1.000.000đ', cash: 1 * M },
  { text: 'Về ô Xuất phát', moveTo: 0 },
  { text: 'Bay ra Hà Nội', moveTo: 37 },
  { text: 'Đóng học phí 1.000.000đ', cash: -1 * M },
  { text: 'Bán hàng online có lãi: nhận 500.000đ', cash: 500 * K },
  { text: 'Đi khám bệnh: trả 500.000đ', cash: -500 * K },
  { text: 'Đi xem Lễ hội', moveTo: 20 },
];

const GO = 2 * M, JAIL_FINE = 500 * K, START_CASH = 15 * M;
const ownable = (pos) => ['land', 'air', 'util'].includes(BOARD[pos]?.t);
const groupOf = (g) => BOARD.map((b, i) => (b.g === g ? i : -1)).filter((i) => i >= 0);
const AIRS = [5, 15, 25, 35];
const SIDES = [0, 1, 2, 3].map((k) => BOARD.map((b, i) => i).filter((i) => i > 10 * k && i < 10 * k + 10 && ['land', 'air'].includes(BOARD[i].t)));

export function start(ids, { config, lastWinner } = {}, rng = Math.random, now = Date.now()) {
  const minutes = [30, 45, 60].includes(config?.minutes) ? config.minutes : 0;
  return {
    players: ids.map((id) => ({ id, cash: START_CASH, pos: 0, jail: 0, jailCard: false, out: false })),
    own: {}, turn: Math.max(0, ids.indexOf(lastWinner)), phase: 'roll', dice: null, doubles: 0,
    offer: {}, debt: null, festival: null, deck: shuffle([...EVENTS.keys()], rng), lastEvent: null,
    log: [], endsAt: minutes ? now + minutes * 60000 : null, winner: null, winReason: null,
  };
}

// ---------- Giá trị & tiền thuê ----------
const houseCost = (pos) => BOARD[pos].price / 2;
export const buildCost = (pos, level) => (level === 4 ? BOARD[pos].price : houseCost(pos)); // giá để lên cấp `level`
function buildingsValue(pos, level) {
  let v = 0;
  for (let l = 1; l <= level; l++) v += buildCost(pos, l);
  return v;
}
export const squareValue = (s, pos) => BOARD[pos].price + buildingsValue(pos, s.own[pos]?.level || 0);
const ownsAll = (s, id, list) => list.every((p) => s.own[p]?.owner === id);

export function rentOf(s, pos, diceSum) {
  const o = s.own[pos];
  if (!o || o.mort) return 0;
  const b = BOARD[pos];
  if (b.t === 'air') return [0, 250 * K, 500 * K, 1 * M, 2 * M][AIRS.filter((p) => s.own[p]?.owner === o.owner).length];
  if (b.t === 'util') return diceSum * (ownsAll(s, o.owner, [12, 28]) ? 100 * K : 40 * K);
  let r = b.price * [0.1, 0.5, 1.5, 3, 5][o.level];
  if (o.level === 0 && ownsAll(s, o.owner, groupOf(b.g))) r *= 2;
  if (s.festival === pos) r *= 2;
  return Math.round(r);
}

export function assets(s, id) {
  const p = s.players.find((x) => x.id === id);
  let v = p.cash;
  for (const [pos, o] of Object.entries(s.own)) {
    if (o.owner !== id) continue;
    v += o.mort ? BOARD[pos].price / 2 : BOARD[pos].price;
    v += buildingsValue(Number(pos), o.level);
  }
  return v;
}

// ---------- Tiện ích trạng thái (mutate s) ----------
const cur = (s) => s.players[s.turn];
const P = (s, id) => s.players.find((p) => p.id === id);
const log = (s, text) => { s.log = [...s.log.slice(-5), text]; };

function checkMonopoly(s, id) {
  if (s.winner) return;
  const groups = [1, 2, 3, 4, 5, 6, 7, 8].filter((g) => ownsAll(s, id, groupOf(g))).length;
  if (groups >= 3 || SIDES.some((side) => ownsAll(s, id, side)) || ownsAll(s, id, AIRS)) {
    s.winner = id; s.winReason = 'doc-quyen'; s.phase = 'end';
  }
}

// Thu tiền; thiếu thì chuyển sang trạng thái nợ. to: id người nhận, null = ngân hàng, 'each' = chia đều cho mọi người còn chơi.
function charge(s, payer, amount, to) {
  if (amount <= 0) return;
  if (payer.cash >= amount) { payer.cash -= amount; credit(s, payer, amount, to); return; }
  s.debt = { id: payer.id, amount, to, resume: s.phase === 'debt' ? s.debt?.resume : s.phase };
  s.phase = 'debt';
}
function credit(s, payer, amount, to) {
  if (to === 'each') {
    const others = s.players.filter((p) => !p.out && p.id !== payer.id);
    others.forEach((p) => { p.cash += amount / others.length; });
  } else if (to) P(s, to).cash += amount;
}

function settleDebt(s) {
  const d = s.debt;
  const payer = P(s, d.id);
  if (payer.cash < d.amount) return;
  payer.cash -= d.amount;
  credit(s, payer, d.amount, d.to);
  s.debt = null;
  s.phase = d.resume || 'act';
}

function goJail(s, p) {
  p.pos = 10; p.jail = 1; s.doubles = 0;
  log(s, `${p.id} vào tù`);
  nextTurn(s);
}

function nextTurn(s) {
  s.offer = {}; s.dice = null; s.doubles = 0;
  if (s.winner) return;
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const j = (s.turn + k) % n;
    if (!s.players[j].out) { s.turn = j; break; }
  }
  s.phase = 'roll';
}

function moveTo(s, p, pos, rng, diceSum) {
  if (pos < p.pos || pos === 0) { if (pos !== p.pos) p.cash += GO; }
  p.pos = pos;
  land(s, p, rng, diceSum);
}

function land(s, p, rng, diceSum) {
  s.offer = {};
  s.phase = 'act';
  const b = BOARD[p.pos];
  if (ownable(p.pos)) {
    const o = s.own[p.pos];
    if (!o) { if (p.cash >= b.price) s.offer.buy = p.pos; return; }
    if (o.owner === p.id) { if (b.t === 'land' && o.level < 4 && !o.mort) s.offer.build = p.pos; return; }
    const rent = rentOf(s, p.pos, diceSum);
    if (b.t === 'land' && o.level < 4 && !o.mort) s.offer.rebuy = p.pos;
    charge(s, p, rent, o.owner);
    return;
  }
  if (b.t === 'tax') return charge(s, p, b.amount, null);
  if (b.t === 'gojail') return goJail(s, p);
  if (b.t === 'festival') { if (Object.entries(s.own).some(([pos, o]) => o.owner === p.id && !o.mort && BOARD[pos].t === 'land')) s.phase = 'festival'; return; }
  if (b.t === 'event') return drawEvent(s, p, rng, diceSum);
}

function drawEvent(s, p, rng, diceSum) {
  if (!s.deck.length) s.deck = shuffle([...EVENTS.keys()], rng);
  const id = s.deck.shift();
  const e = EVENTS[id];
  s.lastEvent = { id, by: p.id, text: e.text };
  log(s, `${p.id}: ${e.text}`);
  if (e.cash > 0) p.cash += e.cash;
  else if (e.cash < 0) charge(s, p, -e.cash, null);
  else if (e.repair) {
    let cost = 0;
    Object.values(s.own).forEach((o) => { if (o.owner === p.id) cost += o.level === 4 ? e.repair[1] : o.level * e.repair[0]; });
    charge(s, p, cost, null);
  } else if (e.nextAir) moveTo(s, p, AIRS.find((a) => a > p.pos) ?? AIRS[0], rng, diceSum);
  else if (e.jail) goJail(s, p);
  else if (e.jailCard) p.jailCard = true;
  else if (e.back) { p.pos = (p.pos + 40 - e.back) % 40; land(s, p, rng, diceSum); }
  // Người khác không đủ tiền thì chỉ tặng phần đang có: không đẩy người ngoài lượt vào trạng thái nợ.
  else if (e.fromEach) s.players.filter((o) => !o.out && o !== p).forEach((o) => { const x = Math.min(o.cash, e.fromEach); o.cash -= x; p.cash += x; });
  else if (e.toEach) charge(s, p, e.toEach * s.players.filter((o) => !o.out && o !== p).length, 'each');
  else if (e.moveTo !== undefined) moveTo(s, p, e.moveTo, rng, diceSum);
}

function bankrupt(s, p) {
  const to = s.debt?.to;
  const heir = to && to !== 'each' ? P(s, to) : null;
  if (heir) heir.cash += p.cash;
  for (const [pos, o] of Object.entries(s.own)) {
    if (o.owner !== p.id) continue;
    if (heir) o.owner = heir.id; else delete s.own[pos];
    if (s.festival === Number(pos) && !heir) s.festival = null;
  }
  p.cash = 0; p.out = true; p.jail = 0;
  s.debt = null;
  log(s, `${p.id} phá sản`);
  const left = s.players.filter((x) => !x.out);
  if (left.length === 1) { s.winner = left[0].id; s.winReason = 'pha-san'; s.phase = 'end'; return; }
  if (heir) checkMonopoly(s, heir.id);
  if (!s.winner) { s.turn = s.players.indexOf(p); nextTurn(s); }
}

// ---------- Hành động ----------
const isPos = (x) => Number.isInteger(x) && x >= 0 && x < 40;

function roll(s, p, rng) {
  const d = [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
  const dbl = d[0] === d[1];
  s.dice = d;
  const sum = d[0] + d[1];
  if (p.jail) {
    if (dbl) { p.jail = 0; s.doubles = 0; return moveTo(s, p, (p.pos + sum) % 40, rng, sum); }
    if (p.jail < 3) { p.jail++; log(s, `${p.id} ở tù thêm lượt`); return nextTurn(s); }
    p.jail = 0;
    charge(s, p, JAIL_FINE, null);
    if (s.phase === 'debt') { s.debt.resume = 'act'; return; } // shortcut: nợ tiền ra tù thì trả xong là hết lượt, lượt sau đi bình thường
    return moveTo(s, p, (p.pos + sum) % 40, rng, sum);
  }
  s.doubles = dbl ? s.doubles + 1 : 0;
  if (s.doubles === 3) return goJail(s, p);
  moveTo(s, p, (p.pos + sum) % 40, rng, sum);
}

export function apply(state, id, action, rng = Math.random, now = Date.now()) {
  if (state.winner) return fail('Ván đã kết thúc.');
  if (state.endsAt && now >= state.endsAt) return { ok: true, state: onTimer(state, now) };
  const s = structuredClone(state);
  const p = cur(s);
  const type = action?.type;
  if (!p || p.id !== id) return fail('Chưa tới lượt bạn.');
  const mine = (pos) => isPos(pos) && s.own[pos]?.owner === id;

  // Thế chấp / chuộc / bán nhà: được làm trong lượt của mình (kể cả khi đang nợ).
  if (type === 'mortgage' || type === 'unmortgage' || type === 'sell') {
    const pos = action.pos;
    if (!mine(pos)) return fail('Đây không phải đất của bạn.');
    const o = s.own[pos];
    if (type === 'sell') {
      if (!o.level) return fail('Ô này chưa có nhà.');
      p.cash += buildCost(pos, o.level) / 2;
      o.level--;
    } else if (type === 'mortgage') {
      if (o.mort || o.level) return fail(o.level ? 'Bán hết nhà trước khi thế chấp.' : 'Đã thế chấp rồi.');
      o.mort = true; p.cash += BOARD[pos].price / 2;
      if (s.festival === pos) s.festival = null;
      if (s.offer.build === pos) delete s.offer.build;
    } else {
      if (!o.mort || s.phase === 'debt') return fail('Không chuộc được lúc này.');
      const cost = Math.round(BOARD[pos].price * 0.55);
      if (p.cash < cost) return fail('Không đủ tiền chuộc.');
      o.mort = false; p.cash -= cost;
    }
    if (s.phase === 'debt') settleDebt(s);
    return { ok: true, state: s };
  }

  if (s.phase === 'debt') {
    if (type !== 'bankrupt') return fail('Bạn đang nợ: bán nhà, thế chấp hoặc phá sản.');
    bankrupt(s, p);
    return { ok: true, state: s };
  }

  if (s.phase === 'roll') {
    if (type === 'roll') { roll(s, p, rng); return { ok: true, state: s }; }
    if (type === 'pay-jail' || type === 'use-card') {
      if (!p.jail) return fail('Bạn không ở tù.');
      if (type === 'use-card') { if (!p.jailCard) return fail('Bạn không có thẻ tại ngoại.'); p.jailCard = false; } else {
        if (p.cash < JAIL_FINE) return fail('Không đủ tiền nộp phạt.');
        p.cash -= JAIL_FINE;
      }
      p.jail = 0;
      return { ok: true, state: s };
    }
    return fail('Hãy gieo xúc xắc.');
  }

  if (s.phase === 'festival') {
    if (type !== 'festival') return fail('Hãy chọn đất để tổ chức Lễ hội.');
    if (action.pos !== null && (!mine(action.pos) || s.own[action.pos].mort || BOARD[action.pos].t !== 'land')) return fail('Chọn 1 ô đất (không phải sân bay/tiện ích) của bạn.');
    s.festival = action.pos ?? s.festival;
    s.phase = 'act';
    return { ok: true, state: s };
  }

  if (s.phase !== 'act') return fail('Thao tác không hợp lệ.');
  if (type === 'buy') {
    const pos = s.offer.buy;
    if (pos === undefined) return fail('Không có gì để mua.');
    if (p.cash < BOARD[pos].price) return fail('Không đủ tiền.');
    p.cash -= BOARD[pos].price;
    s.own[pos] = { owner: id, level: 0, mort: false };
    s.offer = BOARD[pos].t === 'land' ? { build: pos } : {};
    log(s, `${id} mua ${BOARD[pos].name}`);
    checkMonopoly(s, id);
    return { ok: true, state: s };
  }
  if (type === 'rebuy') {
    const pos = s.offer.rebuy;
    if (pos === undefined) return fail('Không mua lại được.');
    const price = 2 * squareValue(s, pos);
    if (p.cash < price) return fail('Không đủ tiền mua lại.');
    const owner = s.own[pos].owner;
    p.cash -= price; P(s, owner).cash += price;
    s.own[pos].owner = id;
    s.offer = {};
    log(s, `${id} mua lại ${BOARD[pos].name}`);
    checkMonopoly(s, id);
    return { ok: true, state: s };
  }
  if (type === 'build') {
    const pos = s.offer.build;
    const n = action.levels;
    if (pos === undefined) return fail('Không xây được ở đây.');
    const o = s.own[pos];
    if (o.mort) return fail('Ô đang thế chấp, chuộc lại trước khi xây.');
    if (!Number.isInteger(n) || n < 1 || o.level + n > 4) return fail('Số cấp xây không hợp lệ.');
    let cost = 0;
    for (let l = o.level + 1; l <= o.level + n; l++) cost += buildCost(pos, l);
    if (p.cash < cost) return fail('Không đủ tiền xây.');
    p.cash -= cost; o.level += n;
    s.offer = o.level < 4 ? { build: pos } : {};
    return { ok: true, state: s };
  }
  if (type === 'end') {
    if (s.doubles && !p.jail) { s.phase = 'roll'; s.offer = {}; return { ok: true, state: s }; }
    nextTurn(s);
    return { ok: true, state: s };
  }
  return fail('Thao tác không hợp lệ.');
}

export const nextTimer = (s) => (s.winner ? null : s.endsAt);

export function onTimer(state, now) {
  if (state.winner || !state.endsAt || now < state.endsAt) return state;
  const s = structuredClone(state);
  const alive = s.players.filter((p) => !p.out);
  const best = alive.reduce((a, b) => (assets(s, b.id) > assets(s, a.id) ? b : a));
  s.winner = best.id; s.winReason = 'het-gio'; s.phase = 'end';
  return s;
}

// Bỏ lượt hộ người offline: tự gieo/đi, không mua/xây; nợ thì bán nhà, thế chấp, vẫn thiếu thì phá sản.
export function forceSkip(state, rng = Math.random, now = Date.now()) {
  let s = state;
  const who = cur(s)?.id;
  for (let i = 0; i < 30 && !s.winner && cur(s).id === who; i++) {
    const p = cur(s);
    let a;
    if (s.phase === 'debt') {
      const props = Object.entries(s.own).filter(([, o]) => o.owner === p.id);
      const built = props.find(([, o]) => o.level > 0);
      const plain = props.find(([, o]) => !o.mort && !o.level);
      a = built ? { type: 'sell', pos: Number(built[0]) } : plain ? { type: 'mortgage', pos: Number(plain[0]) } : { type: 'bankrupt' };
    } else if (s.phase === 'roll') a = { type: 'roll' };
    else if (s.phase === 'festival') a = { type: 'festival', pos: null };
    else a = { type: 'end' };
    const r = apply(s, p.id, a, rng, now);
    if (!r.ok) break;
    s = r.state;
  }
  return s;
}

export function viewFor(s, id) {
  if (!s.players.some((p) => p.id === id)) return null;
  const { deck, ...pub } = s;
  void deck;
  return { ...pub, turn: cur(s).id, me: id };
}
