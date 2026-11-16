import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialBoard, legalMoves, inCheck, start, apply, viewFor } from '../cotuong/engine.js';

const at = (r, c) => r * 9 + c;
// Dựng bàn từ danh sách [quân, hàng, cột].
const board = (...ps) => { const b = Array(90).fill(null); ps.forEach(([p, r, c]) => (b[at(r, c)] = p)); return b; };
const targets = (b, color, r, c) => legalMoves(b, color).filter((m) => m.from === at(r, c)).map((m) => m.to).sort((x, y) => x - y);
const mkState = (b, turn = 'r') => ({ board: b, red: 'R', black: 'B', turn, last: null, history: [], undoAsk: null, winner: null, endReason: null });

test('thế cờ ban đầu: Đỏ có 44 nước', () => {
  assert.equal(legalMoves(initialBoard(), 'r').length, 44);
  assert.equal(legalMoves(initialBoard(), 'b').length, 44);
});

test('mã bị cản chân', () => {
  const kings = [['rK', 9, 4], ['bK', 0, 3]];
  const free = board(...kings, ['rN', 5, 4]);
  assert.equal(targets(free, 'r', 5, 4).length, 8);
  const blocked = board(...kings, ['rN', 5, 4], ['rP', 4, 4]); // chặn hướng lên
  assert.deepEqual(targets(blocked, 'r', 5, 4).filter((t) => t === at(3, 3) || t === at(3, 5)), []);
});

test('tượng không qua sông và bị cản mắt', () => {
  const kings = [['rK', 9, 4], ['bK', 0, 3]];
  const b = board(...kings, ['rB', 5, 2]);
  assert.deepEqual(targets(b, 'r', 5, 2), [at(7, 0), at(7, 4)]);
  const eye = board(...kings, ['rB', 5, 2], ['bP', 6, 3]);
  assert.deepEqual(targets(eye, 'r', 5, 2), [at(7, 0)]);
});

test('pháo cần đúng một ngòi để ăn', () => {
  const kings = [['rK', 9, 3], ['bK', 0, 5]];
  const noScreen = board(...kings, ['rC', 7, 4], ['bR', 2, 4]);
  assert.ok(!targets(noScreen, 'r', 7, 4).includes(at(2, 4)));
  const screen = board(...kings, ['rC', 7, 4], ['rP', 5, 4], ['bR', 2, 4]);
  assert.ok(targets(screen, 'r', 7, 4).includes(at(2, 4)));
  const two = board(...kings, ['rC', 7, 4], ['rP', 5, 4], ['bP', 3, 4], ['bR', 2, 4]);
  assert.ok(!targets(two, 'r', 7, 4).includes(at(2, 4)));
});

test('tốt: chưa qua sông chỉ tiến, qua sông được đi ngang', () => {
  const kings = [['rK', 9, 3], ['bK', 0, 5]];
  assert.deepEqual(targets(board(...kings, ['rP', 6, 2]), 'r', 6, 2), [at(5, 2)]);
  assert.deepEqual(targets(board(...kings, ['rP', 4, 2]), 'r', 4, 2), [at(3, 2), at(4, 1), at(4, 3)]);
  assert.deepEqual(targets(board(...kings, ['bP', 5, 6]), 'b', 5, 6), [at(5, 5), at(5, 7), at(6, 6)]);
});

test('tướng và sĩ không ra khỏi cung', () => {
  const b = board(['rK', 9, 3], ['rA', 9, 5], ['bK', 0, 4]);
  assert.deepEqual(targets(b, 'r', 9, 3), [at(8, 3)]); // (9,4) bị lộ mặt tướng
  assert.deepEqual(targets(b, 'r', 9, 5), [at(8, 4)]);
});

test('không được để lộ mặt tướng', () => {
  const b = board(['rK', 9, 4], ['bK', 0, 4], ['rR', 5, 4]);
  assert.ok(targets(b, 'r', 5, 4).every((t) => t % 9 === 4)); // xe chỉ được đi dọc cột 4
});

test('không được đi nước khiến tướng mình bị chiếu', () => {
  const b = board(['rK', 9, 4], ['rA', 8, 4], ['bR', 2, 4], ['bK', 0, 3]);
  assert.deepEqual(targets(b, 'r', 8, 4), []); // sĩ bị ghim
  assert.equal(inCheck(board(['rK', 9, 4], ['bR', 2, 4], ['bK', 0, 3]), 'r'), true);
});

test('chiếu bí: bên vừa đi thắng', () => {
  const s = mkState(board(['bK', 0, 4], ['rK', 9, 3], ['rR', 1, 0], ['rR', 2, 8]));
  const r = apply(s, 'R', { type: 'move', from: at(2, 8), to: at(0, 8) });
  assert.equal(r.ok, true);
  assert.equal(r.state.winner, 'R');
  assert.equal(r.state.endReason, 'chieu-bi');
});

test('hết nước (không bị chiếu) cũng thua', () => {
  const s = mkState(board(['bK', 0, 3], ['rK', 9, 4], ['rR', 2, 8]));
  const r = apply(s, 'R', { type: 'move', from: at(2, 8), to: at(1, 8) });
  assert.equal(r.state.winner, 'R');
  assert.equal(r.state.endReason, 'het-nuoc');
});

test('xin đi lại', () => {
  let s = start(['R', 'B', 'X'], { round: 0 });
  assert.equal(s.red, 'R');
  s = apply(s, 'R', { type: 'move', from: at(7, 1), to: at(7, 4) }).state;
  assert.equal(apply(s, 'B', { type: 'undo-ask' }).ok, false);      // chỉ người vừa đi mới xin
  s = apply(s, 'R', { type: 'undo-ask' }).state;
  assert.equal(s.undoAsk, 'R');
  assert.equal(apply(s, 'B', { type: 'move', from: at(0, 0), to: at(1, 0) }).ok, false);
  assert.equal(apply(s, 'X', { type: 'undo-yes' }).ok, false);      // người xem không trả lời thay
  assert.equal(apply(s, 'R', { type: 'undo-yes' }).ok, false);      // tự đồng ý cho mình cũng không
  const no = apply(s, 'B', { type: 'undo-no' }).state;
  assert.equal(no.undoAsk, null);
  assert.equal(no.turn, 'b');
  const yes = apply(s, 'B', { type: 'undo-yes' }).state;
  assert.deepEqual(yes.board, initialBoard());
  assert.equal(yes.turn, 'r');
  assert.equal(yes.undoAsk, null);
  assert.equal(apply(yes, 'R', { type: 'undo-ask' }).ok, false);    // không còn nước nào để xin
});

test('round lẻ: đổi màu', () => {
  const s = start(['R', 'B'], { round: 1 });
  assert.equal(s.red, 'B');
  assert.equal(s.black, 'R');
});

test('người xem / sai lượt / đầu vào rác bị từ chối', () => {
  const s = start(['R', 'B', 'X'], { round: 0 });
  for (const [id, a] of [
    ['X', { type: 'move', from: at(6, 0), to: at(5, 0) }],
    ['B', { type: 'move', from: at(3, 0), to: at(4, 0) }],
    ['R', { type: 'move', from: -1, to: 3 }],
    ['R', { type: 'move', from: at(6, 0), to: 'a' }],
    ['R', { type: 'move', from: 95, to: at(5, 0) }],
    ['R', { type: 'move', from: at(3, 0), to: at(4, 0) }], // quân Đen
    ['R', null],
    ['R', { type: 'xyz' }],
  ]) assert.equal(apply(s, id, a).ok, false, JSON.stringify([id, a]));
  assert.equal(apply(s, 'R', { type: 'move', from: at(6, 0), to: at(5, 0) }).ok, true);
});

test('viewFor: người xem cũng thấy bàn, myColor null', () => {
  const s = start(['R', 'B', 'X'], { round: 0 });
  assert.equal(viewFor(s, 'X').myColor, null);
  assert.equal(viewFor(s, 'B').myColor, 'b');
  assert.equal(viewFor(s, 'R').turn, 'R');
  assert.equal(viewFor(s, 'R').check, false);
});
