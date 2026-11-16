import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD, start, apply, viewFor, forceSkip, nextTimer, onTimer, rentOf, assets } from '../typhu/engine.js';

const T = 1_000_000;
// rng cho ra lần lượt các mặt xúc xắc trong mảng (mỗi phần tử là 1 mặt 1..6).
const dice = (...faces) => { let i = 0; return () => (faces[i++ % faces.length] - 1) / 6 + 0.01; };
const mk = (n = 2, extra = {}) => ({ ...start(Array.from({ length: n }, (_, i) => 'ABCDEF'[i]), { config: { minutes: 0 } }, () => 0, T), ...extra });
const A = (s, id, action, rng = () => 0) => {
  const r = apply(s, id, action, rng, T);
  assert.equal(r.ok, true, `${id} ${JSON.stringify(action)}: ${r.error}`);
  return r.state;
};
const NO = (s, id, action, rng = () => 0) => assert.equal(apply(s, id, action, rng, T).ok, false, `${JSON.stringify(action)} phải bị từ chối`);
const own = (s, pos, owner, level = 0, mort = false) => { s.own[pos] = { owner, level, mort }; return s; };
const cash = (s, id) => s.players.find((p) => p.id === id).cash;

test('bàn cờ 40 ô: 22 đất, 4 sân bay, 2 tiện ích, 6 sự kiện', () => {
  assert.equal(BOARD.length, 40);
  const c = (t) => BOARD.filter((b) => b.t === t).length;
  assert.deepEqual([c('land'), c('air'), c('util'), c('event'), c('tax')], [22, 4, 2, 6, 2]);
  const s = mk(3);
  assert.deepEqual(s.players.map((p) => p.cash), [15_000_000, 15_000_000, 15_000_000]);
  assert.equal(s.phase, 'roll');
});

test('gieo, đi, qua Xuất phát +2tr, mua đất', () => {
  let s = mk();
  s.players[0].pos = 38;
  s = A(s, 'A', { type: 'roll' }, dice(1, 2)); // 38 → 1 (Hà Giang), qua Xuất phát
  assert.equal(s.players[0].pos, 1);
  assert.equal(cash(s, 'A'), 17_000_000);
  assert.equal(s.offer.buy, 1);
  s = A(s, 'A', { type: 'buy' });
  assert.equal(s.own[1].owner, 'A');
  assert.equal(cash(s, 'A'), 17_000_000 - BOARD[1].price);
  NO(s, 'B', { type: 'roll' });
  s = A(s, 'A', { type: 'end' });
  assert.equal(s.players[s.turn].id, 'B');
});

test('tiền thuê: nhà, đủ bộ màu, lễ hội, sân bay, tiện ích', () => {
  const s = mk();
  own(s, 1, 'A');
  assert.equal(rentOf(s, 1, 7), 60_000);
  own(s, 3, 'A');
  assert.equal(rentOf(s, 1, 7), 120_000, 'đủ nhóm → ×2 khi chưa có nhà');
  own(s, 1, 'A', 2);
  assert.equal(rentOf(s, 1, 7), 900_000);
  own(s, 1, 'A', 4);
  assert.equal(rentOf(s, 1, 7), 3_000_000);
  s.festival = 1;
  assert.equal(rentOf(s, 1, 7), 6_000_000);
  own(s, 5, 'B'); own(s, 15, 'B');
  assert.equal(rentOf(s, 5, 7), 500_000);
  own(s, 12, 'B');
  assert.equal(rentOf(s, 12, 7), 280_000);
  own(s, 28, 'B');
  assert.equal(rentOf(s, 12, 7), 700_000);
  own(s, 1, 'A', 0, true);
  assert.equal(rentOf(s, 1, 7), 0, 'thế chấp không thu');
});

test('dừng đất người khác: trả thuê rồi được mua lại gấp đôi; Công trình không mua lại được', () => {
  let s = own(mk(), 6, 'B', 1);
  s = A(s, 'A', { type: 'roll' }, dice(2, 4));
  assert.equal(s.players[0].pos, 6);
  const rent = 500_000;
  assert.equal(cash(s, 'A'), 15_000_000 - rent);
  assert.equal(cash(s, 'B'), 15_000_000 + rent);
  const value = 1_000_000 + 500_000;
  s = A(s, 'A', { type: 'rebuy' });
  assert.equal(s.own[6].owner, 'A');
  assert.equal(s.own[6].level, 1);
  assert.equal(cash(s, 'B'), 15_000_000 + rent + 2 * value);
  let t = own(mk(), 6, 'B', 4);
  t = A(t, 'A', { type: 'roll' }, dice(2, 4));
  NO(t, 'A', { type: 'rebuy' });
});

test('xây nhà trên đất mình: nhiều cấp một lúc, đủ tiền mới xây', () => {
  let s = own(mk(), 6, 'A');
  s = A(s, 'A', { type: 'roll' }, dice(2, 4));
  assert.equal(s.offer.build, 6);
  NO(s, 'A', { type: 'build', levels: 5 });
  s = A(s, 'A', { type: 'build', levels: 4 }); // 3 nhà + Công trình = 1.5tr + 1tr
  assert.equal(s.own[6].level, 4);
  assert.equal(cash(s, 'A'), 15_000_000 - 2_500_000);
});

test('đổ đôi được đi tiếp; 3 lần đôi vào tù', () => {
  let s = mk();
  s.deck = [0]; // vé số: không di chuyển
  s = A(s, 'A', { type: 'roll' }, dice(1, 1)); // ô 2: sự kiện
  s = A(s, 'A', { type: 'end' });
  assert.equal(s.players[s.turn].id, 'A', 'đôi → gieo tiếp');
  let j = { ...mk(), doubles: 2 };
  j = A(j, 'A', { type: 'roll' }, dice(3, 3));
  assert.equal(j.players[0].pos, 10);
  assert.equal(j.players[0].jail, 1);
  assert.equal(j.players[j.turn].id, 'B');
});

test('nhà tù: trả 500k, đổ đôi để ra, lượt 3 bắt buộc trả', () => {
  let s = mk();
  Object.assign(s.players[0], { pos: 10, jail: 1 });
  const paid = A(s, 'A', { type: 'pay-jail' });
  assert.equal(paid.players[0].jail, 0);
  assert.equal(cash(paid, 'A'), 14_500_000);
  const fail = A(s, 'A', { type: 'roll' }, dice(1, 2));
  assert.equal(fail.players[0].jail, 2);
  assert.equal(fail.players[fail.turn].id, 'B');
  const out = A(s, 'A', { type: 'roll' }, dice(2, 2));
  assert.equal(out.players[0].jail, 0);
  assert.equal(out.players[0].pos, 14);
  Object.assign(s.players[0], { jail: 3 });
  const forced = A(s, 'A', { type: 'roll' }, dice(1, 2));
  assert.equal(forced.players[0].jail, 0);
  assert.equal(forced.players[0].pos, 13);
  assert.equal(cash(forced, 'A') <= 14_500_000, true);
});

test('nợ: thế chấp để trả; không đủ thì phá sản, tài sản về chủ nợ', () => {
  let s = own(own(mk(3), 39, 'B', 4), 1, 'A');
  s.players[0].cash = 1_000_000;
  s.players[0].pos = 37;
  s = A(s, 'A', { type: 'roll' }, dice(1, 1)); // tới 39, thuê 20tr
  assert.equal(s.phase, 'debt');
  NO(s, 'A', { type: 'end' });
  s = A(s, 'A', { type: 'mortgage', pos: 1 });
  assert.equal(s.phase, 'debt');
  s = A(s, 'A', { type: 'bankrupt' });
  assert.equal(s.players[0].out, true);
  assert.equal(s.own[1].owner, 'B');
  assert.equal(s.own[1].mort, true);
  assert.equal(cash(s, 'B'), 15_000_000 + 1_300_000);
  assert.equal(s.players[s.turn].id, 'B');
  // đủ tiền sau khi bán nhà → tự trả, quay lại lượt
  let t = own(own(mk(), 39, 'B', 1), 6, 'A', 2);
  t.players[0].cash = 100_000;
  t.players[0].pos = 37;
  t = A(t, 'A', { type: 'roll' }, dice(1, 1)); // thuê 2tr
  t = A(t, 'A', { type: 'sell', pos: 6 });
  t = A(t, 'A', { type: 'sell', pos: 6 });
  t = A(t, 'A', { type: 'mortgage', pos: 6 });
  assert.equal(t.phase, 'debt');
});

test('độc quyền: 3 nhóm màu / trọn 1 cạnh / 4 sân bay', () => {
  const s = mk();
  for (const p of [1, 3, 6, 8, 9]) own(s, p, 'A');
  [11, 13].forEach((p) => own(s, p, 'A'));
  s.players[0].pos = 12; // mua Hà Tĩnh (14) sau khi gieo 1+1
  let w = A(s, 'A', { type: 'roll' }, dice(1, 1));
  w = A(w, 'A', { type: 'buy' });
  assert.equal(w.winner, 'A');
  assert.equal(w.winReason, 'doc-quyen');
  const air = mk();
  [5, 15, 25].forEach((p) => own(air, p, 'B'));
  air.turn = 1; air.players[1].pos = 32;
  let a = A(air, 'B', { type: 'roll' }, dice(1, 2));
  a = A(a, 'B', { type: 'buy' });
  assert.equal(a.winner, 'B');
});

test('hết giờ: tổng tài sản cao nhất thắng', () => {
  let s = start(['A', 'B'], { config: { minutes: 30 } }, () => 0, T);
  assert.equal(nextTimer(s), T + 30 * 60000);
  own(s, 39, 'B', 1);
  assert.equal(assets(s, 'B'), 15_000_000 + 4_000_000 + 2_000_000);
  s = onTimer(s, T + 30 * 60000);
  assert.equal(s.winner, 'B');
  assert.equal(s.winReason, 'het-gio');
});

test('sự kiện: vé số, vào tù, sinh nhật; viewFor không lộ chồng thẻ', () => {
  const s = mk(3);
  s.deck = [0, 3, 6];
  s.players[0].pos = 0;
  const a = A(s, 'A', { type: 'roll' }, dice(1, 1)); // ô 2: sự kiện → thẻ 0 vé số
  assert.equal(a.lastEvent.id, 0);
  assert.equal(cash(a, 'A'), 15_000_000 + 2_000_000);
  assert.equal(JSON.stringify(viewFor(a, 'B')).includes('"deck"'), false);
  const b = { ...structuredClone(s), deck: [3] };
  const j = A(b, 'A', { type: 'roll' }, dice(1, 1));
  assert.equal(j.players[0].pos, 10);
  assert.equal(j.players[0].jail, 1);
  const c = { ...structuredClone(s), deck: [6] };
  const g = A(c, 'A', { type: 'roll' }, dice(1, 1));
  assert.equal(cash(g, 'A'), 15_400_000);
  assert.equal(cash(g, 'B'), 14_800_000);
});

test('lễ hội: chọn đất của mình', () => {
  let s = own(mk(), 21, 'A');
  s.players[0].pos = 17;
  s = A(s, 'A', { type: 'roll' }, dice(1, 2));
  assert.equal(s.phase, 'festival');
  NO(s, 'A', { type: 'festival', pos: 23 });
  s = A(s, 'A', { type: 'festival', pos: 21 });
  assert.equal(s.festival, 21);
  assert.equal(s.phase, 'act');
});

test('forceSkip chuyển lượt; đầu vào rác bị từ chối', () => {
  const s = mk();
  const f = forceSkip(s, dice(1, 2));
  assert.equal(f.players[f.turn].id, 'B');
  for (const a of [null, {}, { type: 'buy' }, { type: 'build', levels: 'x' }, { type: 'mortgage', pos: 99 }, { type: 'festival', pos: -1 }]) NO(s, 'A', a);
  NO(s, 'Z', { type: 'roll' });
});

test('sinh nhật: người không đủ tiền chỉ tặng phần đang có, không làm kẹt ván', () => {
  const s = mk(3);
  s.deck = [6];
  s.players[1].cash = 50_000;
  const g = A(s, 'A', { type: 'roll' }, dice(1, 1));
  assert.equal(g.phase, 'act');
  assert.equal(cash(g, 'B'), 0);
  assert.equal(cash(g, 'A'), 15_000_000 + 50_000 + 200_000);
});

test('review: không xây trên ô thế chấp; chuộc ra số nguyên; thẻ bão lũ đúng giá; lễ hội chỉ trên ô đất', () => {
  let s = A(mk(), 'A', { type: 'roll' }, dice(3, 3)); // Lạng Sơn
  s = A(s, 'A', { type: 'buy' });
  s = A(s, 'A', { type: 'mortgage', pos: 6 });
  NO(s, 'A', { type: 'build', levels: 1 });
  const u = own(mk(), 11, 'A', 0, true);
  const r = A(u, 'A', { type: 'unmortgage', pos: 11 });
  assert.equal(Number.isInteger(cash(r, 'A')), true);
  assert.equal(cash(r, 'A'), 15_000_000 - 770_000);
  const b = own(own(mk(), 6, 'A', 4), 8, 'A', 2);
  b.deck = [1];
  const g = A(b, 'A', { type: 'roll' }, dice(1, 1));
  assert.equal(cash(g, 'A'), 15_000_000 - 1_000_000 - 2 * 250_000);
  const f = own(mk(), 5, 'A');
  f.players[0].pos = 17;
  const ff = A(f, 'A', { type: 'roll' }, dice(1, 2));
  assert.equal(ff.phase, 'act', 'chỉ có sân bay → không vào chọn lễ hội');
  const f2 = own(own(mk(), 5, 'A'), 21, 'A');
  f2.players[0].pos = 17;
  const fe = A(f2, 'A', { type: 'roll' }, dice(1, 2));
  NO(fe, 'A', { type: 'festival', pos: 5 });
});
