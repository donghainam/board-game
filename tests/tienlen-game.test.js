import { test } from 'node:test';
import assert from 'node:assert/strict';
import { card, newGame, applyAction, forceSkip, viewFor, instantWin } from '../tienlen/engine.js';

const c = (s) => s.split(' ').map((t) => card(t.slice(0, -1), t.slice(-1)));

// Dựng state bằng tay: hands là mảng chuỗi bài theo thứ tự ghế.
function mk(hands, extra = {}) {
  return {
    players: hands.map((h, i) => ({ id: 'ABCD'[i], hand: c(h) })),
    turn: 0, trick: null, passed: [], played: [], mustInclude: null,
    winner: null, endReason: null, notes: [], ...extra,
  };
}
const act = (s, id, a) => applyAction(s, id, a);
const play = (s, id, cards) => act(s, id, { type: 'play', cards: c(cards) });

test('ván đầu: người có 3♠ đi trước và phải đánh 3♠', () => {
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const s = newGame(['A', 'B', 'C', 'D'], { rng });
  const holder = s.players.findIndex((p) => p.hand.includes(0));
  assert.equal(s.turn, holder);
  assert.equal(s.mustInclude, 0);
  const other = s.players[holder].hand.find((x) => x !== 0);
  assert.equal(act(s, s.players[holder].id, { type: 'play', cards: [other] }).ok, false);
  assert.equal(act(s, s.players[holder].id, { type: 'play', cards: [0] }).ok, true);
});

test('2 người không ai có 3♠: lá nhỏ nhất đi trước', () => {
  let seed = 7, s;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  do s = newGame(['A', 'B'], { rng }); while (s.winner); // bỏ qua ván tới trắng
  const all = s.players.flatMap((p) => p.hand);
  assert.equal(all.length, 26);
  const min = Math.min(...all);
  assert.equal(s.mustInclude, min);
  assert.ok(s.players[s.turn].hand.includes(min));
});

test('có leader: leader đi trước, không bắt buộc lá', () => {
  const s = newGame(['A', 'B', 'C'], { leader: 'C' });
  assert.equal(s.players[s.turn].id, 'C');
  assert.equal(s.mustInclude, null);
});

test('bỏ lượt khi mở vòng tự do bị từ chối', () => {
  const s = mk(['3♠ 9♠', '4♠ 9♣']);
  assert.equal(act(s, 'A', { type: 'pass' }).ok, false);
});

test('đã bỏ lượt thì bị bỏ qua, mọi người bỏ thì người đánh cuối mở vòng mới', () => {
  let s = mk(['3♠ 9♠', '4♠ 9♣', '5♠ 9♦']);
  s = play(s, 'A', '3♠').state;
  s = act(s, 'B', { type: 'pass' }).state;
  s = play(s, 'C', '5♠').state;
  assert.equal(s.players[s.turn].id, 'A'); // B đã bỏ → A
  s = act(s, 'A', { type: 'pass' }).state;
  assert.equal(s.trick, null);
  assert.deepEqual(s.passed, []);
  assert.equal(s.players[s.turn].id, 'C');
});

test('sai lượt, lá không có, lá trùng đều bị từ chối và không đổi state', () => {
  const s = mk(['3♠ 5♠ 9♠', '4♠ 9♣']);
  const snap = JSON.stringify(s);
  assert.equal(play(s, 'B', '4♠').ok, false);
  assert.equal(play(s, 'A', '4♠').ok, false);
  assert.equal(act(s, 'A', { type: 'play', cards: [8, 8] }).ok, false);
  assert.equal(typeof play(s, 'B', '4♠').error, 'string');
  assert.equal(JSON.stringify(s), snap);
});

test('đánh 2 lần cùng nước: lần 2 bị từ chối', () => {
  const s = mk(['3♠ 9♠', '4♠ 9♣']);
  const r1 = play(s, 'A', '3♠');
  assert.equal(r1.ok, true);
  assert.equal(play(r1.state, 'A', '3♠').ok, false);
});

test('hết bài thì thắng, ghi cóng và thối heo, sau đó khoá', () => {
  let s = mk(['3♠', '4♠ 2♥', '5♠ 6♠']);
  s = play(s, 'A', '3♠').state;
  assert.equal(s.winner, 'A');
  assert.equal(s.endReason, 'het-bai');
  const txt = (id) => s.notes.filter((n) => n.id === id).map((n) => n.text).join(' ');
  assert.match(txt('B'), /cóng/);
  assert.match(txt('B'), /thối heo/);
  assert.match(txt('C'), /cóng/);
  assert.equal(play(s, 'B', '4♠').ok, false);
});

test('instantWin nhận đủ 4 loại', () => {
  assert.equal(instantWin(c('3♠ 4♥ 5♠ 6♠ 7♦ 8♠ 9♠ 10♠ J♣ Q♠ K♠ A♠ 2♠')), 'sanh-rong');
  assert.equal(instantWin(c('2♠ 2♣ 2♦ 2♥ 3♠ 5♠ 7♠ 9♠ J♠ K♠ 4♣ 6♣ 8♣')), 'tu-quy-2');
  assert.equal(instantWin(c('3♠ 3♣ 5♠ 5♣ 7♠ 7♣ 9♠ 9♣ J♠ J♣ K♠ K♣ A♥')), '6-doi');
  assert.equal(instantWin(c('4♠ 4♣ 4♦ 4♥ 7♠ 7♣ 9♠ 9♣ J♠ J♣ K♠ K♣ A♥')), '6-doi');
  assert.equal(instantWin(c('3♠ 3♣ 4♠ 4♣ 5♠ 5♣ 6♠ 6♣ 7♠ 7♣ 9♥ J♥ K♦')), '5-doi-thong');
  assert.equal(instantWin(c('3♠ 3♣ 4♠ 4♣ 5♠ 9♣ 6♠ 6♣ 7♠ 7♣ 9♥ J♥ K♦')), null);
});

test('nhiều người tới trắng: index nhỏ nhất thắng', () => {
  const s = newGame(['A', 'B'], { deck: [
    ...c('3♠ 3♣ 5♠ 5♣ 7♠ 7♣ 9♠ 9♣ J♠ J♣ K♠ K♣ A♥'),
    ...c('4♠ 4♣ 6♠ 6♣ 8♠ 8♣ 10♠ 10♣ Q♠ Q♣ A♠ A♣ 2♥'),
  ] });
  assert.equal(s.winner, 'A');
  assert.equal(s.endReason, '6-doi');
});

test('forceSkip: có trick = bỏ lượt, không trick = chuyển quyền mở vòng', () => {
  let s = mk(['3♠ 9♠', '4♠ 9♣', '5♠ 9♦']);
  s = forceSkip(s);
  assert.equal(s.players[s.turn].id, 'B');
  assert.equal(s.trick, null);
  s = play(s, 'B', '4♠').state;
  s = forceSkip(s);
  assert.deepEqual(s.passed, ['C']);
  assert.equal(s.players[s.turn].id, 'A');
});

test('viewFor không lộ bài người khác', () => {
  const s = mk(['3♠ 9♠', '4♠ 9♣']);
  const v = viewFor(s, 'B');
  assert.deepEqual(v.me.hand, c('4♠ 9♣'));
  assert.deepEqual(v.others, [{ id: 'A', count: 2 }]);
  assert.equal(v.turn, 'A');
  const json = JSON.stringify(v);
  assert.equal((json.match(/"hand"/g) || []).length, 1);
  assert.equal(viewFor(s, 'Z'), null);
});
