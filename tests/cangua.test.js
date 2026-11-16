import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, apply, movable, viewFor, forceSkip } from '../cangua/engine.js';

const dice = (n) => () => (n - 1) / 6 + 0.01; // rng cho ra đúng mặt n
// A màu 0, B màu 2 (2 người chơi); horses theo thứ tự ngựa 0..3.
const mk = (a, b, extra = {}) => ({
  players: [{ id: 'A', color: 0, horses: a }, { id: 'B', color: 2, horses: b }],
  turn: 0, roll: null, lastRoll: null, winner: null, ...extra,
});
const H = [-1, -1, -1, -1];
const roll = (s, id, n) => apply(s, id, { type: 'roll' }, dice(n));
const move = (s, id, horse) => apply(s, id, { type: 'move', horse });

test('start: 2 người dùng màu đối diện, người thắng trước đi trước', () => {
  const s = start(['A', 'B'], {});
  assert.deepEqual(s.players.map((p) => p.color), [0, 2]);
  assert.equal(s.turn, 0);
  assert.deepEqual(start(['A', 'B', 'C'], { lastWinner: 'C' }).players.map((p) => p.color), [0, 1, 2]);
  assert.equal(start(['A', 'B', 'C'], { lastWinner: 'C' }).turn, 2);
});

test('phải gieo trước khi đi, không gieo 2 lần', () => {
  const s = mk([0, -1, -1, -1], H);
  assert.equal(move(s, 'A', 0).ok, false);
  const r = roll(s, 'A', 3).state;
  assert.equal(r.roll, 3);
  assert.equal(roll(r, 'A', 3).ok, false);
  assert.equal(roll(s, 'B', 3).ok, false); // chưa tới lượt
});

test('ra 5 khi cả 4 ngựa trong chuồng: tự mất lượt', () => {
  const s = roll(mk(H, H), 'A', 5).state;
  assert.equal(s.turn, 1);
  assert.equal(s.roll, null);
  assert.deepEqual(s.lastRoll, { by: 'A', value: 5 });
});

test('ra 6 xuất chuồng rồi được gieo thêm; ra 6 không đi được vẫn gieo thêm', () => {
  let s = roll(mk(H, H), 'A', 6).state;
  assert.deepEqual(movable(s), [0, 1, 2, 3]);
  s = move(s, 'A', 0).state;
  assert.equal(s.players[0].horses[0], 0);
  assert.equal(s.turn, 0);
  assert.equal(s.roll, null);
  const stuck = mk([50, 51, 52, 53], H); // không ngựa nào đi được 6
  const r = roll(stuck, 'A', 6).state;
  assert.equal(r.turn, 0);
  assert.equal(r.roll, null);
});

test('xuất chuồng vào ô có ngựa địch: đá về chuồng; có ngựa mình: không ra được', () => {
  // ô xuất phát của A (màu 0) là ô tuyệt đối 0; B (màu 2) đứng ở bước 26 = ô 0
  let s = roll(mk(H, [26, -1, -1, -1]), 'A', 6).state;
  s = move(s, 'A', 1).state;
  assert.equal(s.players[1].horses[0], -1);
  const own = roll(mk([0, -1, -1, -1], H), 'A', 6).state;
  assert.deepEqual(movable(own), [0]); // chỉ ngựa đã ra mới đi được, không xuất thêm
});

test('bị cản bởi ngựa bất kỳ ở giữa đường', () => {
  assert.deepEqual(movable(roll(mk([5, 7, -1, -1], H), 'A', 4).state), [1]); // ngựa 0 bị ngựa 1 cản
  // ngựa B ở bước 33 = ô tuyệt đối 7
  assert.deepEqual(movable(roll(mk([5, -1, -1, -1], [33, -1, -1, -1]), 'A', 4).state), []);
});

test('ô đích có ngựa mình thì không đi, có ngựa địch thì đá', () => {
  assert.deepEqual(movable(roll(mk([5, 8, -1, -1], H), 'A', 3).state), [1]);
  let s = roll(mk([5, -1, -1, -1], [34, -1, -1, -1]), 'A', 3).state; // B bước 34 = ô 8
  s = move(s, 'A', 0).state;
  assert.equal(s.players[0].horses[0], 8);
  assert.equal(s.players[1].horses[0], -1);
});

test('không đi vượt cửa chuồng', () => {
  assert.deepEqual(movable(roll(mk([48, -1, -1, -1], H), 'A', 3).state), []);
  const s = move(roll(mk([48, -1, -1, -1], H), 'A', 2).state, 'A', 0).state;
  assert.equal(s.players[0].horses[0], 50);
});

test('leo chuồng', () => {
  const up = (h, n) => movable(roll(mk(h, H), 'A', n).state);
  let s = move(roll(mk([50, -1, -1, -1], H), 'A', 4).state, 'A', 0).state;
  assert.equal(s.players[0].horses[0], 54); // bậc 4
  assert.deepEqual(up([50, 52, -1, -1], 4), [], 'bậc 2 có ngựa mình chắn');
  assert.deepEqual(up([52, -1, -1, -1], 3), [0]);
  assert.deepEqual(up([52, -1, -1, -1], 1), [0]);
  assert.deepEqual(up([52, -1, -1, -1], 5), []);
  assert.deepEqual(up([52, 53, -1, -1], 3), [], 'bậc 3 đã có ngựa');
  s = move(roll(mk([52, -1, -1, -1], H), 'A', 1).state, 'A', 0).state;
  assert.equal(s.players[0].horses[0], 53);
});

test('đủ 4 ngựa vào chuồng thì thắng', () => {
  let s = roll(mk([56, 55, 54, 50], H), 'A', 3).state;
  s = move(s, 'A', 3).state;
  assert.equal(s.winner, 'A');
  assert.equal(roll(s, 'B', 3).ok, false);
});

test('đầu vào rác bị từ chối', () => {
  const s = roll(mk([0, -1, -1, -1], H), 'A', 3).state;
  for (const a of [{ type: 'move', horse: 9 }, { type: 'move', horse: '0' }, { type: 'move' }, null, { type: 'x' }]) {
    assert.equal(apply(s, 'A', a).ok, false, JSON.stringify(a));
  }
  assert.equal(move(s, 'A', 1).ok, false); // ngựa trong chuồng, ra 3
});

test('forceSkip và viewFor', () => {
  const s = roll(mk([0, -1, -1, -1], H), 'A', 3).state;
  const k = forceSkip(s);
  assert.equal(k.turn, 1);
  assert.equal(k.roll, null);
  assert.equal(viewFor(s, 'X'), null); // người vào giữa ván → màn "Chờ ván sau"
  const v = viewFor(s, 'B');
  assert.equal(v.turn, 'A');
  assert.deepEqual(v.movable, [0]);
});
