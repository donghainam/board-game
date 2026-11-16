import { test } from 'node:test';
import assert from 'node:assert/strict';
import { card, classify, canBeat } from '../tienlen/engine.js';

const c = (s) => s.split(' ').map((t) => card(t.slice(0, -1), t.slice(-1)));
const k = (s) => classify(c(s));

test('card mã hoá rank*4+suit', () => {
  assert.equal(card('3', '♠'), 0);
  assert.equal(card('2', '♥'), 51);
  assert.equal(card('10', '♦'), 7 * 4 + 2);
});

test('classify các bộ hợp lệ', () => {
  assert.deepEqual(k('7♠'), { type: 'single', len: 1, top: card('7', '♠') });
  assert.deepEqual(k('8♠ 8♥'), { type: 'pair', len: 2, top: card('8', '♥') });
  assert.deepEqual(k('5♠ 5♦ 5♥'), { type: 'triple', len: 3, top: card('5', '♥') });
  assert.deepEqual(k('3♠ 4♣ 5♦'), { type: 'straight', len: 3, top: card('5', '♦') });
  assert.deepEqual(k('3♠ 3♣ 4♠ 4♣ 5♠ 5♦'), { type: 'pairseq', len: 3, top: card('5', '♦') });
  assert.deepEqual(k('9♠ 9♣ 9♦ 9♥'), { type: 'quad', len: 4, top: card('9', '♥') });
});

test('classify bộ không hợp lệ', () => {
  assert.equal(k('K♠ A♠ 2♠'), null);
  assert.equal(k('3♠ 5♠'), null);
  assert.equal(classify([]), null);
  assert.equal(k('Q♠ Q♣ K♠ K♣ A♠ A♣ 2♠ 2♣'), null);
  assert.equal(k('3♠ 3♣ 5♠ 5♣ 6♠ 6♣'), null);
});

test('canBeat cùng loại', () => {
  assert.equal(canBeat(k('8♠ 8♥'), k('8♣ 8♦')), true);
  assert.equal(canBeat(k('9♠'), k('8♣ 8♦')), false);
  assert.equal(canBeat(k('4♠ 5♠ 6♠ 7♠'), k('3♠ 4♣ 5♦')), false);
  assert.equal(canBeat(k('7♠'), null), true);
});

test('chặt heo', () => {
  const heo = k('2♠');
  const doiHeo = k('2♠ 2♥');
  const ba = k('3♠ 3♣ 4♠ 4♣ 5♠ 5♦');
  const baLon = k('6♠ 6♣ 7♠ 7♣ 8♠ 8♦');
  const quad = k('9♠ 9♣ 9♦ 9♥');
  const quadLon = k('J♠ J♣ J♦ J♥');
  const bon = k('3♠ 3♣ 4♠ 4♣ 5♠ 5♦ 6♠ 6♣');
  assert.equal(canBeat(ba, heo), true);
  assert.equal(canBeat(ba, doiHeo), false);
  assert.equal(canBeat(quad, heo), true);
  assert.equal(canBeat(quad, doiHeo), true);
  assert.equal(canBeat(quad, ba), true);
  assert.equal(canBeat(bon, heo), true);
  assert.equal(canBeat(bon, doiHeo), true);
  assert.equal(canBeat(bon, ba), true);
  assert.equal(canBeat(bon, quad), true);
  assert.equal(canBeat(quadLon, quad), true);
  assert.equal(canBeat(baLon, ba), true);
  assert.equal(canBeat(ba, k('K♠')), false);
});
