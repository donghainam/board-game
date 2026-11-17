import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD, EVENTS, GO, JAIL_FINE, START_CASH as S, start, apply, viewFor, forceSkip, nextTimer, onTimer, rentOf, assets } from '../typhu/engine.js';

const T = 1_000_000;
// rng cho ra lần lượt các mặt xúc xắc trong mảng (mỗi phần tử là 1 mặt 1..6).
const dice = (...faces) => { let i = 0; return () => (faces[i++ % faces.length] - 1) / 6 + 0.01; };
// hot: [] để các phép tính tiền thuê không bị 3 ô tăng giá ngẫu nhiên làm lệch.
const mk = (n = 2, extra = {}) => ({ ...start(Array.from({ length: n }, (_, i) => 'ABCD'[i]), { config: { minutes: 0 } }, () => 0, T), hot: [], ...extra });
const A = (s, id, action, rng = () => 0) => {
  const r = apply(s, id, action, rng, T);
  assert.equal(r.ok, true, `${id} ${JSON.stringify(action)}: ${r.error}`);
  return r.state;
};
const NO = (s, id, action, rng = () => 0) => assert.equal(apply(s, id, action, rng, T).ok, false, `${JSON.stringify(action)} phải bị từ chối`);
const own = (s, pos, owner, level = 0, mort = false) => { s.own[pos] = { owner, level, mort }; return s; };
const cash = (s, id) => s.players.find((p) => p.id === id).cash;
const UPGRADE = EVENTS.findIndex((e) => e.upgrade);

test('bàn cờ 32 ô: 20 tỉnh (4 nhóm 3 + 4 nhóm 2), 4 biển, 3 cơ hội, 1 thuế, 4 góc', () => {
  assert.equal(BOARD.length, 32);
  const c = (t) => BOARD.filter((b) => b.t === t).length;
  assert.deepEqual([c('land'), c('beach'), c('event'), c('tax')], [20, 4, 3, 1]);
  assert.deepEqual([0, 8, 16, 24].map((i) => BOARD[i].t), ['start', 'jail', 'festival', 'travel']);
  assert.deepEqual(BOARD.map((b, i) => (b.t === 'beach' ? i : -1)).filter((i) => i >= 0), [4, 14, 18, 25]);
  assert.deepEqual(BOARD.map((b, i) => (b.t === 'event' ? i : -1)).filter((i) => i >= 0), [12, 20, 28]);
  const sizes = [1, 2, 3, 4, 5, 6, 7, 8].map((g) => BOARD.filter((b) => b.g === g).length);
  assert.deepEqual(sizes.sort(), [2, 2, 2, 2, 3, 3, 3, 3]);
  assert.ok(BOARD.some((b) => b.name === 'Ninh Bình'));
  const s = mk(3);
  assert.deepEqual(s.players.map((p) => p.cash), [S, S, S]);
  assert.equal(S, 2_000_000);
  assert.equal(GO, 300_000);
  assert.equal(BOARD[4].price, 200_000);
  assert.equal(s.phase, 'roll');
  assert.equal(BOARD[8].name, 'Đảo hoang');
  for (let k = 0; k < 20; k++) {
    const hot = start(['A', 'B'], {}, Math.random, T).hot;
    assert.equal(new Set(hot).size, 3);
    assert.ok(hot.every((i) => ['land', 'beach'].includes(BOARD[i].t)));
  }
});

test('gieo, đi, qua Xuất phát +2tr và tính 1 vòng, mua đất', () => {
  let s = mk();
  s.players[0].pos = 30;
  s = A(s, 'A', { type: 'roll' }, dice(1, 2)); // 30 → 1 (Hà Giang), qua Xuất phát
  assert.equal(s.players[0].pos, 1);
  assert.equal(s.players[0].laps, 1);
  assert.equal(s.rolls, 1);
  assert.equal(cash(s, 'A'), S + GO);
  assert.equal(s.offer.buy, 1);
  s = A(s, 'A', { type: 'buy' });
  assert.equal(s.own[1].owner, 'A');
  assert.equal(cash(s, 'A'), S + GO - BOARD[1].price);
  NO(s, 'B', { type: 'roll' });
  s = A(s, 'A', { type: 'end' });
  assert.equal(s.players[s.turn].id, 'B');
  assert.deepEqual(s.dice, [1, 2], 'sang lượt người khác vẫn thấy xúc xắc vừa gieo');
  assert.equal(s.diceBy, 'A');
  assert.ok(s.log.includes('A gieo 1-2 → Hà Giang'));
});

test('tiền thuê: nhà, khách sạn, đủ bộ màu, lễ hội, bãi biển', () => {
  const s = mk();
  own(s, 1, 'A');
  assert.equal(rentOf(s, 1), 8_000);
  own(s, 2, 'A'); own(s, 3, 'A');
  assert.equal(rentOf(s, 1), 16_000, 'đủ nhóm → ×2 khi chưa có nhà');
  own(s, 1, 'A', 2);
  assert.equal(rentOf(s, 1), 80_000);
  own(s, 1, 'A', 5);
  assert.equal(rentOf(s, 1), 480_000);
  s.festival = 1;
  assert.equal(rentOf(s, 1), 960_000);
  own(s, 4, 'B'); own(s, 14, 'B');
  assert.equal(rentOf(s, 4), 100_000);
  own(s, 14, 'A');
  assert.equal(rentOf(s, 4), 50_000, '1 bãi biển: 50K$');
  own(s, 14, 'B');
  s.hot = [4, 1];
  assert.equal(rentOf(s, 4), 150_000, 'ô tăng giá: tiền thuê ×1.5 (cả bãi biển)');
  assert.equal(rentOf(s, 1), 1_440_000, 'ô tăng giá cộng dồn với lễ hội');
  s.hot = [];
  own(s, 1, 'A', 0, true);
  assert.equal(rentOf(s, 1), 0, 'thế chấp không thu');
});

test('dừng đất người khác: trả thuê rồi được mua lại gấp đôi; Khách sạn không mua lại được', () => {
  let s = own(mk(), 6, 'B', 1);
  s = A(s, 'A', { type: 'roll' }, dice(2, 4));
  assert.equal(s.players[0].pos, 6);
  const rent = 56_000;
  assert.equal(cash(s, 'A'), S - rent);
  assert.equal(cash(s, 'B'), S + rent);
  const value = 140_000 + 70_000;
  s = A(s, 'A', { type: 'rebuy' });
  assert.equal(s.own[6].owner, 'A');
  assert.equal(s.own[6].level, 1);
  assert.equal(cash(s, 'B'), S + rent + 2 * value);
  let t = own(mk(), 6, 'B', 5);
  t = A(t, 'A', { type: 'roll' }, dice(2, 4));
  NO(t, 'A', { type: 'rebuy' });
});

test('vòng đầu tối đa 3 nhà; qua Xuất phát được nhà 4; Khách sạn chỉ khi quay lại ô đã đủ 4 nhà', () => {
  // vòng đầu: mua xong xây ngay tối đa 3 nhà
  let s = A(mk(), 'A', { type: 'roll' }, dice(2, 4));
  s = A(s, 'A', { type: 'buy' });
  assert.equal(s.offer.max, 3);
  NO(s, 'A', { type: 'build', levels: 4 });
  s = A(s, 'A', { type: 'build', levels: 3 });
  assert.equal(s.own[6].level, 3);
  assert.deepEqual(s.offer, {});
  assert.equal(cash(s, 'A'), S - 140_000 - 3 * 70_000);

  // vòng đầu, quay lại ô 3 nhà: không có gì để xây
  const r = own(mk(), 6, 'A', 3);
  assert.equal(A(r, 'A', { type: 'roll' }, dice(2, 4)).offer.build, undefined);

  // đã qua Xuất phát: lên được 4 nhà, nhưng chưa lên Khách sạn trong cùng lượt
  const t0 = own(mk(), 6, 'A', 0);
  t0.players[0].laps = 1;
  let t = A(t0, 'A', { type: 'roll' }, dice(2, 4));
  assert.equal(t.offer.max, 4);
  NO(t, 'A', { type: 'build', levels: 5 });
  t = A(t, 'A', { type: 'build', levels: 4 });
  assert.equal(t.own[6].level, 4);
  assert.deepEqual(t.offer, {});

  // quay lại ô đã có 4 nhà → được lên Khách sạn (giá = giá đất)
  const h0 = own(mk(), 6, 'A', 4);
  h0.players[0].laps = 1;
  let h = A(h0, 'A', { type: 'roll' }, dice(2, 4));
  assert.equal(h.offer.max, 5);
  h = A(h, 'A', { type: 'build', levels: 1 });
  assert.equal(h.own[6].level, 5);
  assert.equal(cash(h, 'A'), S - 140_000);
});

test('đổ đôi được đi tiếp; 3 lần đôi vào tù', () => {
  let s = mk();
  s = A(s, 'A', { type: 'roll' }, dice(1, 1));
  s = A(s, 'A', { type: 'end' });
  assert.equal(s.players[s.turn].id, 'A', 'đôi → gieo tiếp');
  let j = { ...mk(), doubles: 2 };
  j = A(j, 'A', { type: 'roll' }, dice(3, 3));
  assert.equal(j.players[0].pos, 8);
  assert.equal(j.players[0].jail, 1);
  assert.equal(j.players[j.turn].id, 'B');
});

test('bước vào ô Nhà tù là vào tù', () => {
  const s = mk();
  s.players[0].pos = 5;
  const j = A(s, 'A', { type: 'roll' }, dice(1, 2));
  assert.equal(j.players[0].pos, 8);
  assert.equal(j.players[0].jail, 1);
  assert.equal(j.players[j.turn].id, 'B');
});

test('nhà tù: trả 500k, đổ đôi để ra, lượt 3 bắt buộc trả', () => {
  const s = mk();
  s.deck = [0];
  Object.assign(s.players[0], { pos: 8, jail: 1 });
  const paid = A(s, 'A', { type: 'pay-jail' });
  assert.equal(paid.players[0].jail, 0);
  assert.equal(cash(paid, 'A'), S - JAIL_FINE);
  const fail = A(s, 'A', { type: 'roll' }, dice(1, 2));
  assert.equal(fail.players[0].jail, 2);
  assert.equal(fail.players[fail.turn].id, 'B');
  const out = A(s, 'A', { type: 'roll' }, dice(2, 2));
  assert.equal(out.players[0].jail, 0);
  assert.equal(out.players[0].pos, 12);
  Object.assign(s.players[0], { jail: 3 });
  const forced = A(s, 'A', { type: 'roll' }, dice(1, 2));
  assert.equal(forced.players[0].jail, 0);
  assert.equal(forced.players[0].pos, 11);
  assert.equal(cash(forced, 'A') <= S - JAIL_FINE, true);
});

test('Sân bay: lượt sau chọn bay tới ô bất kỳ, bay qua Xuất phát được lương', () => {
  let s = mk();
  s.players[0].pos = 21;
  s = A(s, 'A', { type: 'roll' }, dice(1, 2)); // 21 → 24
  assert.equal(s.players[0].fly, true);
  s = A(s, 'A', { type: 'end' });
  s = A(s, 'B', { type: 'roll' }, dice(1, 2));
  s = A(s, 'B', { type: 'end' });
  assert.equal(s.players[s.turn].id, 'A');
  assert.equal(s.phase, 'fly');
  NO(s, 'A', { type: 'roll' });
  NO(s, 'A', { type: 'fly', pos: 24 });
  NO(s, 'A', { type: 'fly', pos: 32 });
  const f = A(s, 'A', { type: 'fly', pos: 5 });
  assert.equal(f.players[0].pos, 5);
  assert.equal(f.players[0].fly, false);
  assert.equal(f.players[0].laps, 1);
  assert.equal(cash(f, 'A'), S + GO);
  assert.equal(f.offer.buy, 5);
  const g = A(s, 'A', { type: 'fly', pos: 29 });
  assert.equal(cash(g, 'A'), S, 'không qua Xuất phát');
});

test('thẻ Cơ hội nâng cấp: +1 cấp miễn phí, vòng đầu tối đa 3 nhà', () => {
  const base = (level, laps) => {
    const s = own(mk(), 6, 'A', level);
    s.deck = [UPGRADE];
    Object.assign(s.players[0], { pos: 9, laps });
    return A(s, 'A', { type: 'roll' }, dice(1, 2)); // 9 → 12 (Cơ hội)
  };
  assert.equal(base(3, 0).phase, 'act', 'vòng đầu, đã 3 nhà → thẻ không có tác dụng');
  const u = base(2, 0);
  assert.equal(u.phase, 'upgrade');
  NO(u, 'A', { type: 'upgrade', pos: 5 });
  NO(u, 'A', { type: 'end' });
  assert.equal(A(u, 'A', { type: 'upgrade', pos: 6 }).own[6].level, 3);
  const h = A(base(4, 1), 'A', { type: 'upgrade', pos: 6 });
  assert.equal(h.own[6].level, 5, '4 nhà → Khách sạn');
  assert.equal(cash(h, 'A'), S);
});

test('nợ: thế chấp để trả; không đủ thì phá sản, tài sản về chủ nợ', () => {
  let s = own(own(mk(3), 31, 'B', 5), 1, 'A');
  s.players[0].cash = 100_000;
  s.players[0].pos = 29;
  s = A(s, 'A', { type: 'roll' }, dice(1, 1)); // tới 31, thuê 3.24M
  assert.equal(s.phase, 'debt');
  NO(s, 'A', { type: 'end' });
  s = A(s, 'A', { type: 'mortgage', pos: 1 });
  assert.equal(s.phase, 'debt');
  s = A(s, 'A', { type: 'bankrupt' });
  assert.equal(s.players[0].out, true);
  assert.equal(s.own[1].owner, 'B');
  assert.equal(s.own[1].mort, true);
  assert.equal(cash(s, 'B'), S + 100_000 + 40_000);
  assert.equal(s.players[s.turn].id, 'B');
  let t = own(own(mk(), 31, 'B', 1), 6, 'A', 2);
  t.players[0].cash = 10_000;
  t.players[0].pos = 29;
  t = A(t, 'A', { type: 'roll' }, dice(1, 1)); // thuê 216K
  t = A(t, 'A', { type: 'sell', pos: 6 });
  t = A(t, 'A', { type: 'sell', pos: 6 });
  t = A(t, 'A', { type: 'mortgage', pos: 6 });
  assert.equal(t.phase, 'debt');
});

test('độc quyền: 4 nhóm màu / trọn 1 cạnh / 4 bãi biển', () => {
  const s = mk();
  [1, 2, 3, 13, 15, 17, 19, 26].forEach((p) => own(s, p, 'A'));
  s.players[0].pos = 25;
  let w = A(s, 'A', { type: 'roll' }, dice(1, 1)); // 27 Hải Phòng
  assert.equal(w.winner, null);
  w = A(w, 'A', { type: 'buy' });
  assert.equal(w.winner, 'A');
  assert.equal(w.winReason, 'doc-quyen');
  const sea = mk();
  [4, 14, 18].forEach((p) => own(sea, p, 'B'));
  sea.turn = 1; sea.players[1].pos = 23;
  let a = A(sea, 'B', { type: 'roll' }, dice(1, 1));
  a = A(a, 'B', { type: 'buy' });
  assert.equal(a.winner, 'B');
  const side = mk();
  [25, 26, 27, 29].forEach((p) => own(side, p, 'A'));
  side.players[0].pos = 28;
  let c = A(side, 'A', { type: 'roll' }, dice(1, 2));
  c = A(c, 'A', { type: 'buy' });
  assert.equal(c.winner, 'A');
});

test('hết giờ: tổng tài sản cao nhất thắng', () => {
  let s = start(['A', 'B'], { config: { minutes: 30 } }, () => 0, T);
  assert.equal(nextTimer(s), T + 30 * 60000);
  own(s, 31, 'B', 1);
  s.hot = [];
  assert.equal(assets(s, 'B'), S + 540_000 + 270_000);
  s = onTimer(s, T + 30 * 60000);
  assert.equal(s.winner, 'B');
  assert.equal(s.winReason, 'het-gio');
});

test('cơ hội: vé số, vào tù, sinh nhật; viewFor không lộ chồng thẻ', () => {
  const s = mk(3);
  s.deck = [0, 3, 6];
  s.players[0].pos = 9;
  const a = A(s, 'A', { type: 'roll' }, dice(1, 2)); // ô 12: Cơ hội → thẻ 0 vé số
  assert.equal(a.lastEvent.id, 0);
  assert.equal(cash(a, 'A'), S + 250_000);
  assert.equal(a.lastEvent.n, 1);
  assert.equal(JSON.stringify(viewFor(a, 'B')).includes('"deck"'), false);
  const b = { ...structuredClone(s), deck: [3] };
  const j = A(b, 'A', { type: 'roll' }, dice(1, 2));
  assert.equal(j.players[0].pos, 8);
  assert.equal(j.players[0].jail, 1);
  const c = { ...structuredClone(s), deck: [6] };
  const g = A(c, 'A', { type: 'roll' }, dice(1, 2));
  assert.equal(cash(g, 'A'), S + 60_000);
  assert.equal(cash(g, 'B'), S - 30_000);
});

test('lễ hội: chọn đất của mình', () => {
  let s = own(mk(), 21, 'A');
  s.players[0].pos = 13;
  s = A(s, 'A', { type: 'roll' }, dice(1, 2));
  assert.equal(s.phase, 'festival');
  NO(s, 'A', { type: 'festival', pos: 23 });
  s = A(s, 'A', { type: 'festival', pos: 21 });
  assert.equal(s.festival, 21);
  assert.equal(s.phase, 'act');
});

test('forceSkip chuyển lượt (kể cả khi đang chờ bay); đầu vào rác bị từ chối', () => {
  const s = mk();
  const f = forceSkip(s, dice(1, 2));
  assert.equal(f.players[f.turn].id, 'B');
  const fl = { ...mk(), phase: 'fly' };
  Object.assign(fl.players[0], { fly: true, pos: 24 });
  const ff = forceSkip(fl, dice(1, 2));
  assert.equal(ff.players[ff.turn].id, 'B');
  for (const a of [null, {}, { type: 'buy' }, { type: 'build', levels: 'x' }, { type: 'mortgage', pos: 99 }, { type: 'festival', pos: -1 }, { type: 'fly', pos: 3 }, { type: 'upgrade', pos: 1 }]) NO(s, 'A', a);
  NO(s, 'Z', { type: 'roll' });
});

test('sinh nhật: người không đủ tiền chỉ tặng phần đang có, không làm kẹt ván', () => {
  const s = mk(3);
  s.deck = [6];
  s.players[0].pos = 9;
  s.players[1].cash = 5_000;
  const g = A(s, 'A', { type: 'roll' }, dice(1, 2));
  assert.equal(g.phase, 'act');
  assert.equal(cash(g, 'B'), 0);
  assert.equal(cash(g, 'A'), S + 5_000 + 30_000);
});

test('review: không xây trên ô thế chấp; chuộc ra số nguyên; thẻ bão lũ đúng giá; lễ hội chỉ trên ô đất', () => {
  let s = A(mk(), 'A', { type: 'roll' }, dice(3, 3)); // Sơn La
  s = A(s, 'A', { type: 'buy' });
  s = A(s, 'A', { type: 'mortgage', pos: 6 });
  NO(s, 'A', { type: 'build', levels: 1 });
  const u = own(mk(), 11, 'A', 0, true);
  const r = A(u, 'A', { type: 'unmortgage', pos: 11 });
  assert.equal(Number.isInteger(cash(r, 'A')), true);
  assert.equal(cash(r, 'A'), S - 121_000);
  const b = own(own(mk(), 6, 'A', 5), 7, 'A', 2);
  b.deck = [1];
  b.players[0].pos = 9;
  const g = A(b, 'A', { type: 'roll' }, dice(1, 2));
  assert.equal(cash(g, 'A'), S - 150_000 - 2 * 40_000);
  const f = own(mk(), 4, 'A');
  f.players[0].pos = 13;
  const ff = A(f, 'A', { type: 'roll' }, dice(1, 2));
  assert.equal(ff.phase, 'act', 'chỉ có bãi biển → không vào chọn lễ hội');
  const f2 = own(own(mk(), 4, 'A'), 21, 'A');
  f2.players[0].pos = 13;
  const fe = A(f2, 'A', { type: 'roll' }, dice(1, 2));
  NO(fe, 'A', { type: 'festival', pos: 4 });
});
