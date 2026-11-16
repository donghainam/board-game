import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, apply, viewFor, buildDeck } from '../sacbai/engine.js';

let nextId = 1000;
const C = (c, v) => ({ c, v, id: nextId++ });
// Dựng state tay: hands là mảng các mảng lá; top là lá trên cùng.
function mk(hands, top, extra = {}) {
  return {
    players: hands.map((h, i) => ({ id: 'ABCD'[i], hand: h })),
    deck: Array.from({ length: 20 }, () => C('g', '5')), discard: [top], color: top.c === 'k' ? 'r' : top.c,
    turn: 0, penalty: null, drew: false, drawnId: null, unannounced: null, winner: null, ...extra,
  };
}
const play = (s, id, card, color) => apply(s, id, { type: 'play', card: card.id, color });
const act = (s, id, type, more = {}) => apply(s, id, { type, ...more });

test('bộ bài 96 lá, chia 6 lá, lá mở đầu là lá số', () => {
  assert.equal(buildDeck().length, 96);
  const s = start(['A', 'B', 'C'], {});
  s.players.forEach((p) => assert.equal(p.hand.length, 6));
  assert.match(s.discard.at(-1).v, /^[1-9]$/);
  assert.equal(s.deck.length + s.discard.length + 18, 96);
});

test('đánh theo màu hoặc số; lá đen phải chọn màu', () => {
  const r5 = C('r', '5'), g5 = C('g', '5'), g7 = C('g', '7'), doi = C('k', 'doi');
  const s = mk([[r5, g5, g7, doi], [C('y', '1')]], C('r', '2'));
  assert.equal(play(s, 'A', r5).ok, true);
  assert.equal(play(s, 'A', g7).ok, false);
  const s2 = mk([[g5, g7], [C('y', '1')]], C('r', '5'));
  assert.equal(play(s2, 'A', g5).ok, true);
  assert.equal(play(s, 'A', doi).ok, false);
  const r = play(s, 'A', doi, 'y');
  assert.equal(r.ok, true);
  assert.equal(r.state.color, 'y');
});

test('phạt cộng dồn +2/+4', () => {
  const p2a = C('r', '+2'), p2b = C('b', '+2'), p4 = C('k', '+4'), p4b = C('k', '+4'), doi = C('k', 'doi');
  let s = mk([[p2a, C('r', '1')], [p2b, p4, doi, C('y', '3')], [p4b, C('y', '9')]], C('r', '4'));
  s = play(s, 'A', p2a).state;
  assert.deepEqual(s.penalty, { n: 2, kind: '+2' });
  assert.equal(play(s, 'B', doi, 'r').ok, false, 'đang bị phạt không đánh lá đổi màu');
  assert.equal(play(s, 'B', C('r', '+2')).ok, false, 'lá không có trên tay');
  const viaP2 = play(s, 'B', p2b).state;
  assert.deepEqual(viaP2.penalty, { n: 4, kind: '+2' });
  s = play(s, 'B', p4, 'g').state;
  assert.deepEqual(s.penalty, { n: 6, kind: '+4' });
  const cHand = s.players[2].hand.length;
  // +2 không chặn được +4
  const withP2 = { ...s, players: s.players.map((p, i) => (i === 2 ? { ...p, hand: [...p.hand, C('g', '+2')] } : p)) };
  assert.equal(play(withP2, 'C', withP2.players[2].hand.at(-1)).ok, false);
  // bốc phạt: đúng 6 lá, mất lượt
  const d = act(s, 'C', 'draw').state;
  assert.equal(d.players[2].hand.length, cHand + 6);
  assert.equal(d.penalty, null);
  assert.equal(d.players[d.turn].id, 'A');
});

test('Chặn: 3 người thì người kế mất lượt; 2 người thì đi tiếp', () => {
  const ch = C('r', 'chan');
  const s3 = play(mk([[ch, C('r', '1')], [C('y', '1')], [C('y', '2')]], C('r', '4')), 'A', ch).state;
  assert.equal(s3.players[s3.turn].id, 'C');
  const ch2 = C('r', 'chan');
  const s2 = play(mk([[ch2, C('r', '1')], [C('y', '1')]], C('r', '4')), 'A', ch2).state;
  assert.equal(s2.players[s2.turn].id, 'A');
});

test('bốc 1 lá: đánh được thì đánh luôn, không thì tự qua lượt', () => {
  const good = mk([[C('y', '1')], [C('y', '2')]], C('g', '4'), { deck: [C('g', '9')] });
  const d = act(good, 'A', 'draw').state;
  assert.equal(d.drew, true);
  assert.equal(d.players[d.turn].id, 'A');
  assert.equal(play(d, 'A', d.players[0].hand[0]).ok, false, 'chỉ được đánh lá vừa bốc');
  assert.equal(play(d, 'A', d.players[0].hand.at(-1)).ok, true);
  assert.equal(act(d, 'A', 'pass').ok, true);
  const bad = mk([[C('y', '1')], [C('y', '2')]], C('g', '4'), { deck: [C('r', '9')] });
  const d2 = act(bad, 'A', 'draw').state;
  assert.equal(d2.players[d2.turn].id, 'B');
  assert.equal(act(mk([[C('y', '1')], [C('y', '2')]], C('g', '4')), 'A', 'pass').ok, false, 'chưa bốc thì không qua');
});

test('BÁO và Bắt', () => {
  const a1 = C('r', '1'), a2 = C('r', '2');
  let s = play(mk([[a1, a2], [C('r', '7'), C('y', '8'), C('y', '9')], [C('y', '3')]], C('r', '4')), 'A', a1).state;
  assert.equal(s.unannounced, 'A');
  assert.equal(act(s, 'A', 'bat', { target: 'A' }).ok, false, 'không tự bắt mình');
  const baoed = act(s, 'A', 'bao').state;
  assert.equal(baoed.unannounced, null);
  assert.equal(act(baoed, 'C', 'bat', { target: 'A' }).ok, false, 'đã báo rồi thì không bắt được');
  const caught = act(s, 'C', 'bat', { target: 'A' }).state;
  assert.equal(caught.players[0].hand.length, 3);
  assert.equal(caught.unannounced, null);
  const moved = play(s, 'B', s.players[1].hand[0]).state; // người kế đã đi
  assert.equal(moved.unannounced, null);
  assert.equal(act(moved, 'C', 'bat', { target: 'A' }).ok, false);
});

test('hết bài thì thắng, chồng bài hết thì trộn lại', () => {
  const last = C('r', '1');
  const w = play(mk([[last], [C('y', '2')]], C('r', '4')), 'A', last).state;
  assert.equal(w.winner, 'A');
  assert.equal(act(w, 'B', 'draw').ok, false);
  const discard = [C('y', '1'), C('y', '2'), C('y', '3'), C('g', '4')];
  const s = { ...mk([[C('r', '1')], [C('y', '2')]], C('g', '4'), { deck: [] }), discard };
  const d = act(s, 'A', 'draw').state;
  assert.equal(d.players[0].hand.length, 2);
  assert.equal(d.discard.length, 1);
  assert.equal(d.discard[0].v, '4');
});

test('đầu vào rác bị từ chối, viewFor không lộ bài', () => {
  const s = mk([[C('r', '1')], [C('y', '2')]], C('r', '4'));
  for (const a of [null, { type: 'play' }, { type: 'play', card: 'x' }, { type: 'play', card: 99999 }, { type: 'zz' }, { type: 'bat' }]) {
    assert.equal(apply(s, 'A', a).ok, false, JSON.stringify(a));
  }
  const black = C('k', 'doi');
  assert.equal(play(mk([[black, C('r', '1')], [C('y', '2')]], C('r', '4')), 'A', black, 'purple').ok, false);
  const v = viewFor(s, 'B');
  assert.equal(v.me.hand.length, 1);
  assert.deepEqual(v.others, [{ id: 'A', count: 1 }]);
  assert.equal(JSON.stringify(v).includes('"deck"'), false);
  assert.equal(viewFor(s, 'Z'), null);
});

test('C1: lá vừa bốc chỉ chủ nhân biết', async () => {
  const { viewFor: vf } = await import('../sacbai/engine.js');
  const s = act(mk([[C('y', '1')], [C('y', '2')]], C('g', '4'), { deck: [C('g', '9')] }), 'A', 'draw').state;
  assert.equal(vf(s, 'B').drawnId, null);
  assert.equal(vf(s, 'A').drawnId, s.drawnId);
});

test('I1: forceSkip – bốc phạt / qua / bốc 1 rồi chuyển lượt', async () => {
  const { forceSkip } = await import('../sacbai/engine.js');
  const pen = forceSkip(mk([[C('y', '1')], [C('y', '2')]], C('g', '4'), { penalty: { n: 4, kind: '+2' } }));
  assert.equal(pen.players[0].hand.length, 5);
  assert.equal(pen.penalty, null);
  assert.equal(pen.turn, 1);
  const drew = forceSkip(act(mk([[C('y', '1')], [C('y', '2')]], C('g', '4'), { deck: [C('g', '9')] }), 'A', 'draw').state);
  assert.equal(drew.turn, 1);
  assert.equal(drew.players[0].hand.length, 2);
  const plain = forceSkip(mk([[C('g', '1')], [C('y', '2')]], C('g', '4'), { deck: [C('g', '9')] }));
  assert.equal(plain.turn, 1, 'kể cả bốc được lá đánh được vẫn chuyển lượt');
  assert.equal(plain.players[0].hand.length, 2);
});
