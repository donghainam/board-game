import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, validate, start, apply, viewFor, forceSkip, distance } from '../loanda/engine.js';

let n = 1000;
const C = (t, s = 2) => ({ t, s, id: n++ }); // mặc định chất ♣
const rng0 = () => 0;
// roles: mảng vai theo ghế. deck: phần tử cuối là lá trên cùng.
function mk(roles, extra = {}) {
  return {
    players: roles.map((r, i) => ({ id: 'ABCDEFG'[i], role: r, hp: r === 'cst' ? 5 : 4, max: r === 'cst' ? 5 : 4, hand: [], eq: [], alive: true })),
    deck: Array.from({ length: 30 }, () => C('ban')), discard: [], turn: 0, phase: 'play', bangUsed: false,
    pending: null, lastFlip: null, log: [], winner: null, winTeam: null, ...extra,
  };
}
const R4 = ['cst', 'cuop', 'phanboi', 'cuop'];
const A = (s, id, action) => { const r = apply(s, id, action, rng0); assert.equal(r.ok, true, `${id} ${JSON.stringify(action)}: ${r.error}`); return r.state; };
const NO = (s, id, action) => assert.equal(apply(s, id, action, rng0).ok, false, `${id} ${JSON.stringify(action)} phải bị từ chối`);
const give = (s, id, ...cards) => { s.players.find((p) => p.id === id).hand.push(...cards); return cards; };
const P = (s, id) => s.players.find((p) => p.id === id);

test('bộ bài, chia vai, cảnh sát trưởng 5 máu và đi trước', () => {
  assert.equal(buildDeck().length, 77);
  assert.equal(validate(['a', 'b', 'c']), 'Cần 4–7 người.');
  const s = start(['a', 'b', 'c', 'd', 'e'], {}, Math.random);
  const roles = s.players.map((p) => p.role).sort();
  assert.deepEqual(roles, ['cst', 'cuop', 'cuop', 'phanboi', 'pho']);
  const cst = s.players.find((p) => p.role === 'cst');
  assert.equal(cst.max, 5);
  assert.equal(s.players[s.turn].id, cst.id);
  assert.equal(cst.hand.length, 7, '5 lá chia + 2 lá bốc đầu lượt');
});

test('khoảng cách vòng tròn, ngựa, ống nhòm, người chết không tính', () => {
  const s = mk(['cst', 'cuop', 'phanboi', 'cuop', 'pho']);
  assert.equal(distance(s, 0, 1), 1);
  assert.equal(distance(s, 0, 2), 2);
  assert.equal(distance(s, 0, 4), 1);
  s.players[2].eq.push(C('ngua'));
  assert.equal(distance(s, 0, 2), 3);
  s.players[0].eq.push(C('ongnhom'));
  assert.equal(distance(s, 0, 2), 2);
  s.players[1].alive = false;
  assert.equal(distance(s, 0, 2), 1, 'ghế trống không tính: cạnh nhau 1, ngựa +1, ống nhòm −1');
});

test('bắn: trong tầm, 1 lần/lượt, mục tiêu Né hoặc mất máu', () => {
  let s = mk(R4);
  const [b1, b2] = give(s, 'A', C('ban'), C('ban'));
  NO(s, 'A', { type: 'play', card: b1.id, target: 'C' }); // khoảng cách 2, tầm 1
  s = A(s, 'A', { type: 'play', card: b1.id, target: 'B' });
  assert.equal(s.phase, 'react');
  assert.equal(viewFor(s, 'A').turn, 'B');
  NO(s, 'A', { type: 'play', card: b2.id, target: 'D' });
  const [ne] = give(s, 'B', C('ne'));
  const dodged = A(s, 'B', { type: 'respond', card: ne.id });
  assert.equal(P(dodged, 'B').hp, 4);
  assert.equal(dodged.phase, 'play');
  NO(dodged, 'A', { type: 'play', card: b2.id, target: 'D' }); // đã bắn lượt này
  const hit = A(s, 'B', { type: 'respond' });
  assert.equal(P(hit, 'B').hp, 3);
});

test('súng tăng tầm; liên thanh bắn nhiều lần', () => {
  let s = mk(R4);
  const [g, b] = give(s, 'A', C('sung2'), C('ban'));
  s = A(s, 'A', { type: 'play', card: g.id });
  s = A(s, 'A', { type: 'play', card: b.id, target: 'C' });
  assert.equal(s.pending.queue[0], 'C');
  let t = mk(R4);
  const [lt, x, y] = give(t, 'A', C('lienthanh'), C('ban'), C('ban'));
  t = A(t, 'A', { type: 'play', card: lt.id });
  t = A(A(t, 'A', { type: 'play', card: x.id, target: 'B' }), 'B', { type: 'respond' });
  t = A(t, 'A', { type: 'play', card: y.id, target: 'D' });
  assert.equal(t.phase, 'react');
});

test('thùng gỗ: lật ra ♥ thì tự né', () => {
  let s = mk(R4);
  s.players[1].eq.push(C('thung'));
  s.deck.push(C('ban', 0)); // lá trên cùng ♥
  const [b] = give(s, 'A', C('ban'));
  s = A(s, 'A', { type: 'play', card: b.id, target: 'B' });
  assert.equal(s.phase, 'play');
  assert.equal(P(s, 'B').hp, 4);
});

test('bắn loạt và phục kích hỏi lần lượt mọi người', () => {
  let s = mk(R4);
  const [l] = give(s, 'A', C('loat'));
  const [ne] = give(s, 'C', C('ne'));
  s = A(s, 'A', { type: 'play', card: l.id });
  assert.equal(viewFor(s, 'A').turn, 'B');
  s = A(s, 'B', { type: 'respond' });
  NO(s, 'D', { type: 'respond' });
  s = A(s, 'C', { type: 'respond', card: ne.id });
  s = A(s, 'D', { type: 'respond' });
  assert.deepEqual(s.players.map((p) => p.hp), [5, 3, 4, 3]);
  assert.equal(s.phase, 'play');
  let t = mk(R4);
  const [pk] = give(t, 'A', C('phuckich'));
  const [nb] = give(t, 'B', C('ne'));
  t = A(t, 'A', { type: 'play', card: pk.id });
  NO(t, 'B', { type: 'respond', card: nb.id }); // phục kích cần Bắn
});

test('đấu tay đôi: luân phiên đánh Bắn, ai hết thì mất máu', () => {
  let s = mk(R4);
  const [d, a1] = give(s, 'A', C('duel'), C('ban'));
  const [b1] = give(s, 'C', C('ban'));
  s = A(s, 'A', { type: 'play', card: d.id, target: 'C' });
  s = A(s, 'C', { type: 'respond', card: b1.id });
  s = A(s, 'A', { type: 'respond', card: a1.id });
  s = A(s, 'C', { type: 'respond' });
  assert.equal(P(s, 'C').hp, 3);
  assert.equal(P(s, 'A').hp, 5);
  assert.equal(s.phase, 'play');
});

test('cướp (khoảng cách 1) và phá (bất kỳ ai)', () => {
  let s = mk(R4);
  const [c1, c2, ph] = give(s, 'A', C('cuop'), C('cuop'), C('pha'));
  const [gun] = [C('sung3')];
  s.players[2].eq.push(gun);
  give(s, 'B', C('ne'));
  NO(s, 'A', { type: 'play', card: c1.id, target: 'C', which: gun.id }); // xa 2
  s = A(s, 'A', { type: 'play', card: c1.id, target: 'B', which: 'hand' });
  assert.equal(P(s, 'B').hand.length, 0);
  assert.equal(P(s, 'A').hand.some((c) => c.t === 'ne'), true);
  s = A(s, 'A', { type: 'play', card: ph.id, target: 'C', which: gun.id });
  assert.equal(P(s, 'C').eq.length, 0);
  NO(s, 'A', { type: 'play', card: c2.id, target: 'B', which: 'hand' }); // B hết bài
});

test('nhà tù: không giam cảnh sát trưởng; lật ♥ thoát, khác thì mất lượt', () => {
  let s = mk(R4);
  const [j1, j2] = give(s, 'A', C('tu'), C('tu'));
  s.players[1].role = 'cuop';
  s = A(s, 'A', { type: 'play', card: j1.id, target: 'B' });
  NO(s, 'A', { type: 'play', card: j2.id, target: 'B' });
  s.deck.push(C('ban', 2)); // B lật ♣ → mất lượt
  s = A(s, 'A', { type: 'end' });
  assert.equal(s.players[s.turn].id, 'C');
  assert.equal(P(s, 'B').eq.length, 0);
  const t = mk(['pho', 'cst', 'cuop', 'phanboi']);
  const [j] = give(t, 'A', C('tu'));
  NO(t, 'A', { type: 'play', card: j.id, target: 'B' });
});

test('thuốc nổ: lật ♠ nổ mất 3 máu, không thì chuyền sang người kế', () => {
  let s = mk(R4);
  const [d] = give(s, 'A', C('no'));
  s = A(s, 'A', { type: 'play', card: d.id });
  // vòng tới A: các người khác qua lượt
  const pass = (st, id) => A(st, id, { type: 'end' });
  s.deck.push(C('ban', 2)); // A ♣? chưa tới. B/C/D đều phải bỏ bài thừa → cho hp đủ cao
  s.players.forEach((p) => { p.hp = 9; p.max = 9; });
  s = pass(s, 'A');
  s = pass(s, 'B');
  s = pass(s, 'C');
  s.deck.push(C('ban', 2)); // lá A lật khi tới lượt: ♣ → chuyền
  s = pass(s, 'D');
  assert.equal(P(s, 'B').eq.some((c) => c.t === 'no'), true);
  s.deck.push(C('ban', 3)); // B lật ♠ → nổ
  s = pass(s, 'A');
  assert.equal(P(s, 'B').hp, 6);
  assert.equal(P(s, 'B').eq.length, 0);
});

test('bỏ bài thừa cuối lượt', () => {
  let s = mk(R4);
  s.players[0].hp = 2;
  const cards = give(s, 'A', C('ne'), C('ne'), C('ne'));
  s = A(s, 'A', { type: 'end' });
  assert.equal(s.phase, 'discard');
  NO(s, 'A', { type: 'discard', cards: [cards[0].id, cards[1].id] });
  s = A(s, 'A', { type: 'discard', cards: [cards[0].id] });
  assert.equal(s.players[s.turn].id, 'B');
});

test('hết máu: tự dùng Băng bó (trừ khi còn 2 người); chết thì lật vai; phe luật thắng', () => {
  let s = mk(R4);
  s.players[1].hp = 1;
  give(s, 'B', C('bangbo'));
  const [b] = give(s, 'A', C('ban'));
  s = A(A(s, 'A', { type: 'play', card: b.id, target: 'B' }), 'B', { type: 'respond' });
  assert.equal(P(s, 'B').hp, 1);
  assert.equal(P(s, 'B').alive, true);
  // chỉ còn A (cst) và B (cướp): bắn chết B → phe luật thắng
  let t = mk(R4);
  t.players[2].alive = false; t.players[3].alive = false;
  t.players[1].hp = 1;
  give(t, 'B', C('bangbo'));
  const [b2] = give(t, 'A', C('ban'));
  t = A(A(t, 'A', { type: 'play', card: b2.id, target: 'B' }), 'B', { type: 'respond' });
  assert.equal(P(t, 'B').alive, false);
  assert.equal(t.winTeam, 'luat');
  assert.deepEqual(t.winner, ['A']);
  assert.equal(viewFor(t, 'C').players[1].role, 'cuop');
});

test('cảnh sát trưởng chết: băng cướp thắng; còn mình kẻ phản bội thì kẻ phản bội thắng', () => {
  let s = mk(['cst', 'cuop', 'phanboi', 'cuop']);
  s.turn = 1; s.players[0].hp = 1;
  const [b] = give(s, 'B', C('ban'));
  s = A(A(s, 'B', { type: 'play', card: b.id, target: 'A' }), 'A', { type: 'respond' });
  assert.equal(s.winTeam, 'cuop');
  assert.deepEqual(s.winner, ['B', 'D']);
  let t = mk(['cst', 'cuop', 'phanboi', 'cuop']);
  t.players[1].alive = false; t.players[3].alive = false;
  t.turn = 2; t.players[0].hp = 1;
  const [b2] = give(t, 'C', C('ban'));
  t = A(A(t, 'C', { type: 'play', card: b2.id, target: 'A' }), 'A', { type: 'respond' });
  assert.equal(t.winTeam, 'phanboi');
});

test('vai bí mật không lộ; người chết, người ngoài, đầu vào rác bị từ chối; forceSkip', () => {
  const s = mk(R4);
  const v = viewFor(s, 'B');
  assert.equal(v.players[0].role, 'cst');
  assert.equal(v.players[2].role, null);
  assert.equal(JSON.stringify(v.players).includes('"hand"'), false);
  assert.equal(JSON.stringify(v).includes('"deck"'), false);
  for (const a of [null, {}, { type: 'play' }, { type: 'play', card: 'x' }, { type: 'respond' }, { type: 'discard' }]) NO(s, 'A', a);
  NO(s, 'B', { type: 'end' });
  NO(s, 'Z', { type: 'end' });
  const [b] = give(s, 'A', C('ban'));
  const r = A(s, 'A', { type: 'play', card: b.id, target: 'B' });
  const f = forceSkip(r);
  assert.equal(P(f, 'B').hp, 3);
  assert.equal(f.phase, 'play');
  const g = forceSkip(f);
  assert.equal(g.players[g.turn].id, 'B');
});

test('review: forceSkip khi đòn chí mạng kết thúc ván không lỗi', () => {
  let s = mk(['cst', 'cuop', 'phanboi', 'cuop']);
  s.turn = 1; s.players[0].hp = 1;
  const [b] = give(s, 'B', C('ban'));
  s = A(s, 'B', { type: 'play', card: b.id, target: 'A' });
  const f = forceSkip(s);
  assert.equal(f.winTeam, 'cuop');
});
