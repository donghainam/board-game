import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, validate, start, apply, viewFor, forceSkip, distance, CHARS, defaultRoles } from '../loanda/engine.js';

let n = 1000;
const C = (t, s = 2, r = 5) => ({ t, s, r, id: n++ }); // mặc định 5♣
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

test('bộ bài, chia vai, chọn chức năng rồi mới chia bài', () => {
  assert.equal(buildDeck().length, 160);
  assert.ok(buildDeck().every((c) => c.r >= 1 && c.r <= 13), 'mọi lá có số A–K');
  assert.ok(Object.values(Object.groupBy(buildDeck(), (c) => c.t)).every((g) => g.length >= 2), "mọi loại ít nhất 2 lá");
  assert.equal(validate(['a', 'b', 'c']), 'Cần 4–8 người.');
  let s = start(['a', 'b', 'c', 'd', 'e'], {}, Math.random);
  assert.deepEqual(s.players.map((p) => p.role).sort(), ['cst', 'cuop', 'cuop', 'phanboi', 'pho']);
  assert.equal(s.phase, 'pick');
  assert.equal(new Set(s.players.flatMap((p) => p.offer)).size, 10, 'mỗi người 2 chức năng khác nhau');
  const v = viewFor(s, 'a');
  assert.equal(v.me.offer.length, 2);
  assert.equal(v.players[1].offer, undefined, 'không lộ lá được chia của người khác');
  NO(s, 'a', { type: 'pick', char: s.players[1].offer[0] });
  for (const p of s.players.slice(0, 4)) s = A(s, p.id, { type: 'pick', char: p.offer[1] });
  assert.equal(viewFor(s, 'a').players[0].char, null, 'chưa công khai khi còn người chưa chọn');
  s = forceSkip(s);
  const cst = s.players.find((p) => p.role === 'cst');
  // Cảnh sát trưởng là Kẻ móc túi thì lượt mở đầu bằng bước chọn người để móc
  assert.equal(s.phase, { moctui: 'steal', thamtu: 'scout' }[cst.char] || 'play');
  assert.equal(cst.max, CHARS[cst.char].hp + 1);
  assert.equal(s.players[s.turn].id, cst.id);
  assert.ok(cst.hand.length >= cst.max);
  assert.equal(viewFor(s, 'b').players[0].char, s.players[0].char, 'chọn xong thì công khai');
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
  // ♠ ngoài 2–9 (A, 10, J, Q, K) thì không nổ, chuyền tiếp
  for (const r of [1, 10, 13]) {
    let t = mk(R4);
    P(t, 'B').eq.push(C('no'));
    t.players.forEach((p) => { p.hp = 9; p.max = 9; });
    t.deck.push(C('ban', 3, r));
    t = A(t, 'A', { type: 'end' });
    assert.equal(P(t, 'B').hp, 9, `♠ số ${r} không nổ`);
    assert.equal(P(t, 'C').eq.some((c) => c.t === 'no'), true);
  }
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
  assert.equal(viewFor(t, 'C').players[1].role, 'cuop', 'ván kết thúc thì lật hết vai');
});

test('người gục không bị lật vai khi ván chưa kết thúc', () => {
  let s = mk(['cst', 'cuop', 'phanboi', 'cuop', 'pho']);
  P(s, 'C').hp = 1;
  const [b] = give(s, 'A', C('ban'));
  s.players[0].eq.push(C('sung3'));
  s = A(A(s, 'A', { type: 'play', card: b.id, target: 'C' }), 'C', { type: 'respond' });
  assert.equal(P(s, 'C').alive, false);
  assert.equal(s.winner, null);
  assert.equal(viewFor(s, 'B').players[2].role, null, 'người khác không thấy vai người đã gục');
  assert.equal(viewFor(s, 'C').me.role, 'phanboi', 'người gục vẫn thấy vai của mình');
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

// ---------- Chức năng ----------
const ch = (s, id, c) => { P(s, id).char = c; return s; };
const endFrom = (s, prev) => { s.turn = s.players.findIndex((p) => p.id === prev); return A(s, prev, { type: 'end' }); };

test('Gã gặp thời: lá thứ 2 ♥/♦ thì bốc thêm', () => {
  const s = ch(mk(R4), 'B', 'gapthoi');
  s.deck.push(C('ne', 0), C('ban', 2)); // lá trên cùng ♣ bốc trước, lá thứ 2 ♥
  assert.equal(P(endFrom(s, 'A'), 'B').hand.length, 3);
  const t = ch(mk(R4), 'B', 'gapthoi');
  t.deck.push(C('ne', 3), C('ban', 2));
  assert.equal(P(endFrom(t, 'A'), 'B').hand.length, 2);
});

test('Cô nàng hai súng: Bắn thay Né, Né thay Bắn', () => {
  let s = ch(mk(R4), 'B', 'haisung');
  const [b] = give(s, 'A', C('ban'));
  const [bb] = give(s, 'B', C('ban'));
  s = A(A(s, 'A', { type: 'play', card: b.id, target: 'B' }), 'B', { type: 'respond', card: bb.id });
  assert.equal(P(s, 'B').hp, 4);
  let t = ch(mk(R4), 'A', 'haisung');
  const [ne] = give(t, 'A', C('ne'));
  t = A(t, 'A', { type: 'play', card: ne.id, target: 'B' });
  assert.equal(t.phase, 'react');
});

test('Kẻ móc túi: lá đầu rút từ tay người khác', () => {
  let s = ch(mk(R4), 'B', 'moctui');
  give(s, 'D', C('bangbo'));
  s = endFrom(s, 'A');
  assert.equal(s.phase, 'steal');
  NO(s, 'B', { type: 'steal', target: 'C' }); // C không có bài
  s = A(s, 'B', { type: 'steal', target: 'D' });
  assert.equal(P(s, 'D').hand.length, 0);
  assert.equal(P(s, 'B').hand.length, 2);
  assert.ok(P(s, 'B').hand.some((c) => c.t === 'bangbo'));
});

test('Ông lang vườn: bỏ 2 lá hồi 1 máu lúc nào cũng được, kể cả tự cứu', () => {
  let s = ch(mk(R4), 'C', 'langvuon');
  P(s, 'C').hp = 2;
  const [x, y] = give(s, 'C', C('ne'), C('ne'));
  s = A(s, 'C', { type: 'heal2', cards: [x.id, y.id] }); // không phải lượt mình
  assert.equal(P(s, 'C').hp, 3);
  let t = ch(mk(R4), 'B', 'langvuon');
  P(t, 'B').hp = 1;
  give(t, 'B', C('ne'), C('tiepte'));
  const [b] = give(t, 'A', C('ban'));
  t = A(A(t, 'A', { type: 'play', card: b.id, target: 'B' }), 'B', { type: 'respond' });
  assert.equal(P(t, 'B').alive, true);
  assert.equal(P(t, 'B').hp, 1);
});

test('Tay súng thép: cần 2 lá Né', () => {
  let s = ch(mk(R4), 'A', 'thep');
  const [b] = give(s, 'A', C('ban'));
  const [n1, n2] = give(s, 'B', C('ne'), C('ne'));
  s = A(s, 'A', { type: 'play', card: b.id, target: 'B' });
  s = A(s, 'B', { type: 'respond', card: n1.id });
  assert.equal(s.phase, 'react', 'mới né 1 lần');
  s = A(s, 'B', { type: 'respond', card: n2.id });
  assert.equal(s.phase, 'play');
  assert.equal(P(s, 'B').hp, 4);
});

test('Kẻ lang thang: hết bài thì bốc 1', () => {
  let s = ch(mk(R4), 'A', 'langthang');
  const [g] = give(s, 'A', C('sung2'));
  s = A(s, 'A', { type: 'play', card: g.id });
  assert.equal(P(s, 'A').hand.length, 1);
});

test('Tay súng lão luyện: bắn người kề bên không giới hạn, người xa 1 lần; Kẻ liều mạng: mất 1 máu bốc 2; Thợ rèn tầm +1', () => {
  let s = ch(mk(R4), 'A', 'laoluyen');
  P(s, 'A').eq.push(C('sung3'));
  const [b1, b2, b3, b4] = give(s, 'A', C('ban'), C('ban'), C('ban'), C('ban'));
  s = A(A(s, 'A', { type: 'play', card: b1.id, target: 'B' }), 'B', { type: 'respond' }); // kề bên
  s = A(A(s, 'A', { type: 'play', card: b2.id, target: 'B' }), 'B', { type: 'respond' }); // kề bên lần 2
  s = A(A(s, 'A', { type: 'play', card: b3.id, target: 'C' }), 'C', { type: 'respond' }); // xa: lần 1
  NO(s, 'A', { type: 'play', card: b4.id, target: 'C' }); // xa: lần 2 bị chặn
  let l = ch(mk(R4), 'A', 'lieumang');
  P(l, 'A').hp = 2;
  l = A(l, 'A', { type: 'gamble' });
  assert.equal(P(l, 'A').hp, 1);
  assert.equal(P(l, 'A').hand.length, 2);
  NO(l, 'A', { type: 'gamble' }); // còn 1 máu thì thôi
  NO(ch(mk(R4), 'B', 'lieumang'), 'B', { type: 'gamble' }); // không phải lượt mình
  const r = ch(mk(R4), 'A', 'thoren');
  const [d] = give(r, 'A', C('ban'));
  assert.equal(A(r, 'A', { type: 'play', card: d.id, target: 'C' }).phase, 'react', 'khoảng cách 2, tầm 1+1');
});

test('Bác sĩ làng hồi theo khi người khác hồi máu (trong 3 giây); Phu xe +1 lá', () => {
  let s = ch(mk(R4), 'C', 'bacsi');
  P(s, 'A').hp = 3; P(s, 'C').hp = 2;
  const [bb] = give(s, 'A', C('bangbo'));
  const [x] = give(s, 'C', C('ne'));
  s = A(s, 'A', { type: 'play', card: bb.id });
  assert.equal(viewFor(s, 'C').docOffer, true);
  assert.equal(viewFor(s, 'B').docOffer, null);
  const late = apply(s, 'C', { type: 'doc', card: x.id }, () => 0, Date.now() + 10_000);
  assert.equal(late.ok, false, 'quá 3 giây thì hết lời mời');
  s = A(s, 'C', { type: 'doc', card: x.id });
  assert.equal(P(s, 'C').hp, 3);
  assert.equal(P(s, 'C').hand.length, 0);
  let f = ch(mk(R4), 'A', 'phuxe');
  const [tt] = give(f, 'A', C('tiepte'));
  f = A(f, 'A', { type: 'play', card: tt.id });
  assert.equal(P(f, 'A').hand.length, 3);
});

test('Người có Trái tim: lật ♥ khi bị Bắn thì không mất máu; Phục kích thì không cứu', () => {
  let s = ch(mk(R4), 'B', 'traitim');
  s.deck.push(C('ne', 0)); // lật ra ♥
  const [b] = give(s, 'A', C('ban'));
  s = A(A(s, 'A', { type: 'play', card: b.id, target: 'B' }), 'B', { type: 'respond' });
  assert.equal(P(s, 'B').hp, 4);
  let t = ch(mk(R4), 'B', 'traitim');
  t.deck.push(C('ne', 0));
  const [pk] = give(t, 'A', C('phuckich'));
  t = A(A(t, 'A', { type: 'play', card: pk.id }), 'B', { type: 'respond' });
  assert.equal(P(t, 'B').hp, 3);
});

test('Cao bồi nhanh tay: bị Phá/Cướp thì bắn trả miễn phí', () => {
  let s = ch(mk(R4), 'B', 'nhanhtay');
  const [ph] = give(s, 'A', C('pha'));
  give(s, 'B', C('ne'));
  s = A(s, 'A', { type: 'play', card: ph.id, target: 'B', which: 'hand' });
  assert.equal(s.phase, 'react');
  assert.equal(viewFor(s, 'A').turn, 'A', 'A phải né phát bắn trả');
  s = A(s, 'A', { type: 'respond' });
  assert.equal(P(s, 'A').hp, 4, 'cảnh sát trưởng 5 máu − 1');
  assert.equal(s.phase, 'play');
  assert.equal(s.players[s.turn].id, 'A', 'vẫn là lượt A');
});

test('Thám tử: xem lá trên cùng, đẩy xuống đáy rồi bốc', () => {
  let s = ch(mk(R4), 'B', 'thamtu');
  const bom = C('no');
  s.deck.push(bom);
  s = endFrom(s, 'A');
  assert.equal(s.phase, 'scout');
  assert.equal(viewFor(s, 'B').scout.t, 'no');
  assert.equal(viewFor(s, 'C').scout, null, 'người khác không thấy');
  s = A(s, 'B', { type: 'scout', bottom: true });
  assert.equal(P(s, 'B').hand.some((c) => c.id === bom.id), false);
  assert.equal(s.deck[0].id, bom.id);
});

test('Thầy bói: ♦ tính như ♥ (Nhà tù); Gã khổng lồ: không dùng Né, Thùng gỗ vẫn được, giữ tối đa 5 lá', () => {
  const s = ch(mk(R4), 'B', 'thayboi');
  P(s, 'B').eq.push(C('tu'));
  s.deck.push(C('ban', 1)); // ♦
  const r = endFrom(s, 'A');
  assert.equal(r.players[r.turn].id, 'B', 'vượt ngục nhờ ♦');
  let k = ch(mk(R4), 'B', 'khonglo');
  Object.assign(P(k, 'B'), { hp: 9, max: 9 });
  const [b] = give(k, 'A', C('ban'));
  const [ne] = give(k, 'B', C('ne'));
  k = A(k, 'A', { type: 'play', card: b.id, target: 'B' });
  NO(k, 'B', { type: 'respond', card: ne.id });
  let g = ch(mk(R4), 'B', 'khonglo');
  P(g, 'B').eq.push(C('thung'));
  g.deck.push(C('ne', 0));
  const [b2] = give(g, 'A', C('ban'));
  g = A(g, 'A', { type: 'play', card: b2.id, target: 'B' });
  assert.equal(g.phase, 'play', 'Thùng gỗ vẫn né được');
  let h = ch(mk(R4), 'A', 'khonglo');
  Object.assign(P(h, 'A'), { hp: 9, max: 9 });
  give(h, 'A', ...Array.from({ length: 7 }, () => C('ne')));
  h = A(h, 'A', { type: 'end' });
  assert.equal(h.phase, 'discard');
  assert.equal(viewFor(h, 'A').me.handLimit, 5);
});

test('review: Ông lang vườn hồi máu lúc đang bỏ bài không làm kẹt ván', () => {
  let s = ch(mk(R4), 'A', 'langvuon');
  P(s, 'A').hp = 2;
  give(s, 'A', C('ne'), C('ne'), C('ne'));
  s = A(s, 'A', { type: 'end' });
  assert.equal(s.phase, 'discard');
  const [x, y] = P(s, 'A').hand;
  s = A(s, 'A', { type: 'heal2', cards: [x.id, y.id] });
  assert.equal(s.players[s.turn].id, 'B', 'không còn thừa bài → tự kết thúc lượt');
});

test('review: chọn xong thì không còn hiện lá được chia; bỏ qua chỉ chọn hộ người offline', () => {
  let s = start(['a', 'b', 'c', 'd'], {}, Math.random);
  s = A(s, 'a', { type: 'pick', char: s.players[0].offer[0] });
  assert.equal(viewFor(s, 'a').me.offer, null);
  const f = forceSkip(s, Math.random, ['b']);
  assert.equal(f.phase, 'pick', 'c, d đang online vẫn được tự chọn');
  assert.equal(P(f, 'b').char, P(s, 'b').offer[0]);
  assert.equal(P(f, 'c').char, null);
});

test('phản ứng (đấu tay đôi, né, chịu đòn) hiện lên giữa bàn và nhật ký', () => {
  let s = mk(R4);
  const [d] = give(s, 'A', C('duel'));
  const [b] = give(s, 'B', C('ban'));
  s = A(s, 'A', { type: 'play', card: d.id, target: 'B' });
  s = A(s, 'B', { type: 'respond', card: b.id });
  assert.deepEqual(viewFor(s, 'A').lastPlay, { by: 'B', card: { t: 'ban', s: b.s, r: b.r }, target: 'A' });
  assert.match(s.log.at(-1), /B đánh Bắn/);
  s = A(s, 'A', { type: 'respond' });
  assert.match(s.log.at(-1), /A mất 1 máu/);
});

test('Băng bó dùng cả ngoài lượt; Rượu mừng chọn cả bàn hoặc riêng mình', () => {
  let s = mk(R4);
  P(s, 'B').hp = 2;
  const [bb] = give(s, 'B', C('bangbo'));
  s = A(s, 'B', { type: 'play', card: bb.id }); // đang là lượt A
  assert.equal(P(s, 'B').hp, 3);
  let r = mk(R4);
  P(r, 'A').hp = 3; P(r, 'B').hp = 2;
  const [w1, w2] = give(r, 'A', C('ruou'), C('ruou'));
  r = A(r, 'A', { type: 'play', card: w1.id, self: true });
  assert.deepEqual([P(r, 'A').hp, P(r, 'B').hp], [4, 2]);
  r = A(r, 'A', { type: 'play', card: w2.id });
  assert.deepEqual([P(r, 'A').hp, P(r, 'B').hp], [5, 3]);
  NO(r, 'B', { type: 'play', card: give(r, 'B', C('ruou'))[0].id }); // không dùng ngoài lượt
});

test('Đấm, Lách người, Rượu mạnh, Ẩu đả', () => {
  let s = mk(R4);
  const [d1, d2] = give(s, 'A', C('dam'), C('dam'));
  NO(s, 'A', { type: 'play', card: d1.id, target: 'C' }); // khoảng cách 2
  const [l] = give(s, 'B', C('lach'));
  s = A(s, 'A', { type: 'play', card: d1.id, target: 'B' });
  s = A(s, 'B', { type: 'respond', card: l.id });
  assert.equal(P(s, 'B').hand.length, 1, 'Lách người: né rồi bốc 1');
  s = A(A(s, 'A', { type: 'play', card: d2.id, target: 'B' }), 'B', { type: 'respond' });
  assert.equal(P(s, 'B').hp, 3, 'Đấm không tính giới hạn Bắn, bị trúng mất 1 máu');
  let r = mk(R4);
  P(r, 'C').hp = 2;
  const [rm, x] = give(r, 'A', C('ruoumanh'), C('ne'));
  NO(r, 'A', { type: 'play', card: rm.id, target: 'C' }); // thiếu lá bỏ kèm
  r = A(r, 'A', { type: 'play', card: rm.id, target: 'C', extra: x.id });
  assert.equal(P(r, 'C').hp, 3);
  assert.equal(P(r, 'A').hand.length, 0);
  let a = mk(R4);
  const [ad, y] = give(a, 'A', C('audai'), C('ne'));
  give(a, 'B', C('ne')); give(a, 'C', C('ne'), C('ne'));
  a = A(a, 'A', { type: 'play', card: ad.id, extra: y.id });
  assert.deepEqual(['A', 'B', 'C', 'D'].map((id) => P(a, id).hand.length), [0, 0, 1, 0]);
});

test('Chợ phiên: mỗi người lần lượt lấy 1 lá, người cuối nhận lá còn lại', () => {
  let s = mk(R4);
  const [cp] = give(s, 'A', C('chophien'));
  s = A(s, 'A', { type: 'play', card: cp.id });
  assert.equal(s.phase, 'store');
  assert.equal(viewFor(s, 'A').store.cards.length, 4, 'người đang chọn thấy quầy');
  assert.equal(viewFor(s, 'C').store.cards, null, 'người chưa tới lượt không thấy');
  assert.equal(viewFor(s, 'C').store.count, 4);
  assert.equal(viewFor(s, 'C').turn, 'A');
  NO(s, 'B', { type: 'store', card: s.store.cards[0].id });
  for (const id of ['A', 'B', 'C']) s = A(s, id, { type: 'store', card: s.store.cards[0].id });
  assert.equal(s.phase, 'play');
  assert.deepEqual(['A', 'B', 'C', 'D'].map((id) => P(s, id).hand.length), [1, 1, 1, 1]);
  let f = mk(R4);
  f = A(f, 'A', { type: 'play', card: give(f, 'A', C('chophien'))[0].id });
  f = forceSkip(f, rng0, ['A']);
  assert.equal(f.store.queue[0], 'B', 'bỏ qua người offline: tự lấy lá đầu');
});

test('Trang bị dùng 1 lần: Súng giấu, Bình nước, Dao găm, Xe thồ, Mũ rộng vành', () => {
  let s = mk(R4);
  P(s, 'A').hp = 4;
  const eq = give(s, 'A', C('sunggiau'), C('binhnuoc'), C('dao'), C('xetho'));
  for (const c of eq) s = A(s, 'A', { type: 'play', card: c.id });
  assert.equal(P(s, 'A').eq.length, 4);
  s = A(s, 'A', { type: 'use', card: eq[1].id });
  assert.equal(P(s, 'A').hp, 5);
  NO(s, 'A', { type: 'use', card: eq[0].id, target: 'C' }); // khoảng cách 2
  const [mu] = give(s, 'B', C('mu'));
  s.players[1].eq.push(take1(s, 'B', mu.id));
  s = A(s, 'A', { type: 'use', card: eq[0].id, target: 'B' });
  assert.equal(P(s, 'A').hand.length, 1, 'Súng giấu: bốc 1 lá');
  s = A(s, 'B', { type: 'respond', card: mu.id });
  assert.equal(P(s, 'B').hp, 4, 'Mũ rộng vành né được');
  assert.equal(P(s, 'B').eq.length, 0);
  s = A(A(s, 'A', { type: 'use', card: eq[2].id, target: 'B' }), 'B', { type: 'respond' });
  assert.equal(P(s, 'B').hp, 3, 'Dao găm trúng');
  give(s, 'D', C('ne'));
  s = A(s, 'A', { type: 'use', card: eq[3].id, target: 'D', which: 'hand' });
  assert.equal(P(s, 'D').hand.length, 0);
  assert.equal(P(s, 'A').eq.length, 0);
});
const take1 = (s, id, cid) => { const h = P(s, id).hand; return h.splice(h.findIndex((c) => c.id === cid), 1)[0]; };

test('Vai: mặc định theo số người, chủ phòng chỉnh tay (tổng phải bằng số người), tối đa 8 người', () => {
  assert.deepEqual(defaultRoles(4), { pho: 1, cuop: 2, phanboi: 0 });
  assert.deepEqual(defaultRoles(5), { pho: 1, cuop: 2, phanboi: 1 });
  assert.deepEqual(defaultRoles(8), { pho: 2, cuop: 3, phanboi: 2 });
  const ids8 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  assert.equal(validate(ids8), undefined);
  assert.equal(validate([...ids8, 'i']), 'Cần 4–8 người.');
  const s8 = start(ids8, {}, Math.random);
  assert.equal(new Set(s8.players.flatMap((p) => p.offer)).size, 16, '8 người chia đủ 16 chức năng khác nhau');
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const config = { roles: { pho: 0, cuop: 3, phanboi: 1 } };
  assert.equal(validate(ids, config), undefined);
  assert.equal(validate(ids, { roles: { pho: 0, cuop: 2, phanboi: 1 } }), 'Tổng số vai (4) phải bằng số người (5).');
  assert.equal(validate(ids, { roles: { pho: -1, cuop: 4, phanboi: 1 } }), 'Số vai không hợp lệ.');
  const s = start(ids, { config }, Math.random);
  assert.deepEqual(s.players.map((p) => p.role).sort(), ['cst', 'cuop', 'cuop', 'cuop', 'phanboi']);
});

test('Lá mới: Bắn tỉa, Tay dài, Rượu nồng (bỏ kèm 1 lá)', () => {
  let s = mk(R4);
  const [bt, x1] = give(s, 'A', C('bantia'), C('ne'));
  NO(s, 'A', { type: 'play', card: bt.id, target: 'C' }); // thiếu lá bỏ kèm
  s = A(s, 'A', { type: 'play', card: bt.id, target: 'C', extra: x1.id }); // khoảng cách 2, vẫn bắn được
  s = A(s, 'C', { type: 'respond' });
  assert.equal(P(s, 'C').hp, 3);
  assert.ok(!s.bangUsed, 'không tính giới hạn Bắn');
  let t = mk(R4);
  const [td, x2] = give(t, 'A', C('taydai'), C('ne'));
  give(t, 'C', C('ban'));
  t = A(t, 'A', { type: 'play', card: td.id, target: 'C', which: 'hand', extra: x2.id });
  assert.deepEqual([P(t, 'A').hand.length, P(t, 'C').hand.length], [1, 0]);
  let r = mk(R4);
  P(r, 'A').hp = 2;
  const [rn, x3] = give(r, 'A', C('ruounong'), C('ne'));
  r = A(r, 'A', { type: 'play', card: rn.id, extra: x3.id });
  assert.equal(P(r, 'A').hp, 4);
});

test('Trang bị mới: Kính viễn vọng / Chỗ nấp cùng loại Ống nhòm / Ngựa; né bằng Mũ cao, Tấm thép, Bùa hộ mệnh', () => {
  const s = mk(R4);
  P(s, 'C').eq.push(C('chonap'));
  assert.equal(distance(s, 0, 2), 3, 'Chỗ nấp như Ngựa');
  P(s, 'A').eq.push(C('kinhvien'));
  assert.equal(distance(s, 0, 2), 2, 'Kính viễn vọng như Ống nhòm');
  const [on] = give(s, 'A', C('ongnhom'));
  NO(s, 'A', { type: 'play', card: on.id }); // đã có trang bị cùng loại
  for (const t of ['mucao', 'tamthep', 'bua']) {
    let k = mk(R4);
    const hat = C(t);
    P(k, 'B').eq.push(hat);
    const [b] = give(k, 'A', C('ban'));
    k = A(k, 'A', { type: 'play', card: b.id, target: 'B' });
    k = A(k, 'B', { type: 'respond', card: hat.id });
    assert.equal(P(k, 'B').hp, 4, `${t} né được`);
    assert.equal(P(k, 'B').hand.length, t === 'bua' ? 1 : 0, 'Bùa hộ mệnh né rồi bốc 1');
  }
});

test('Trang bị mới: Súng săn bò, Súng ổ quay, Đại bác, Vũ công, Ngựa trạm', () => {
  let s = mk(R4);
  const eq = [C('sungbo'), C('oquay'), C('daibac'), C('vucong'), C('ngutram')];
  P(s, 'A').eq.push(...eq);
  s = A(A(s, 'A', { type: 'use', card: eq[0].id, target: 'C' }), 'C', { type: 'respond' }); // khoảng cách 2
  assert.equal(P(s, 'C').hp, 3, 'Súng săn bò bắn mọi khoảng cách');
  NO(s, 'A', { type: 'use', card: eq[1].id, target: 'C' }); // ổ quay: ngoài tầm 1
  s = A(A(s, 'A', { type: 'use', card: eq[1].id, target: 'B' }), 'B', { type: 'respond' });
  assert.equal(P(s, 'B').hp, 3);
  s = A(s, 'A', { type: 'use', card: eq[2].id });
  assert.equal(s.phase, 'react');
  for (const id of ['B', 'C', 'D']) s = A(s, id, { type: 'respond' });
  assert.deepEqual(['B', 'C', 'D'].map((id) => P(s, id).hp), [2, 2, 3], 'Đại bác: mọi người khác mất 1');
  give(s, 'D', C('ne'));
  s = A(s, 'A', { type: 'use', card: eq[3].id, target: 'D', which: 'hand' });
  assert.equal(P(s, 'D').hand.length, 0, 'Vũ công phá 1 lá');
  s = A(s, 'A', { type: 'use', card: eq[4].id });
  assert.equal(P(s, 'A').hand.length, 3, 'Ngựa trạm bốc 3');
  assert.equal(P(s, 'A').eq.length, 0);
});
