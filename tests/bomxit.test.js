import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, apply, nextTimer, onTimer, viewFor, forceSkip, WINDOW } from '../bomxit/engine.js';

let n = 500;
const K = (t) => ({ t, id: n++ });
// deck: phần tử cuối là lá trên cùng.
function mk(hands, deck, extra = {}) {
  return {
    players: hands.map((h, i) => ({ id: 'ABCD'[i], hand: h, alive: true })),
    deck, discard: [], turn: 0, pending: null, peek: null, log: null, winner: null, ...extra,
  };
}
const T0 = 1_000_000;
const act = (s, id, a, now = T0) => apply(s, id, a, Math.random, now);

test('chia bài: mỗi người 1 Kéo + 4 lá; chồng có n-1 Bom và 1 Kéo', () => {
  const s = start(['A', 'B', 'C'], {});
  s.players.forEach((p) => {
    assert.equal(p.hand.length, 5);
    assert.equal(p.hand.filter((c) => c.t === 'keo').length, 1);
  });
  assert.equal(s.deck.filter((c) => c.t === 'bom').length, 2);
  assert.equal(s.deck.filter((c) => c.t === 'keo').length, 1);
});

test('Soi: hết 3 giây thì chỉ người soi thấy 3 lá trên cùng', () => {
  const soi = K('soi');
  const deck = [K('ne'), K('bom'), K('chan'), K('soi')];
  let s = act(mk([[soi], [K('chan')]], deck), 'A', { type: 'play', card: soi.id }).state;
  assert.equal(nextTimer(s), T0 + WINDOW);
  assert.equal(act(s, 'A', { type: 'draw' }).ok, false, 'đang chờ 3 giây thì không bốc được');
  assert.equal(onTimer(s, T0 + 100).pending !== null, true, 'chưa tới giờ');
  s = onTimer(s, T0 + WINDOW);
  assert.deepEqual(viewFor(s, 'A').peek.map((c) => c.t), ['soi', 'chan', 'bom']);
  assert.equal(viewFor(s, 'B').peek, null);
  assert.equal(JSON.stringify(viewFor(s, 'B')).includes('"deck"'), false);
});

test('Né: hết giờ thì chuyển lượt, không bốc', () => {
  const ne = K('ne');
  let s = act(mk([[ne], [K('chan')]], [K('bom')]), 'A', { type: 'play', card: ne.id }).state;
  s = onTimer(s, T0 + WINDOW);
  assert.equal(s.turn, 1);
  assert.equal(s.deck.length, 1);
  assert.equal(s.players[0].hand.length, 0);
});

test('Chặn chồng Chặn: số lẻ thì huỷ, số chẵn thì vẫn tác dụng; cửa sổ tính lại', () => {
  const ne = K('ne'), c1 = K('chan'), c2 = K('chan');
  let s = act(mk([[ne, c2], [c1]], [K('soi')]), 'A', { type: 'play', card: ne.id }).state;
  s = act(s, 'B', { type: 'chan', card: c1.id }, T0 + 2000).state;
  assert.equal(nextTimer(s), T0 + 2000 + WINDOW);
  const blocked = onTimer(s, T0 + 2000 + WINDOW);
  assert.equal(blocked.turn, 0, 'Né bị huỷ → vẫn lượt A');
  s = act(s, 'A', { type: 'chan', card: c2.id }, T0 + 2500).state;
  const back = onTimer(s, T0 + 2500 + WINDOW);
  assert.equal(back.turn, 1, 'Chặn lại Chặn → Né có tác dụng');
  assert.equal(act(mk([[K('soi')], [c1]], []), 'B', { type: 'chan', card: c1.id }).ok, false, 'không có gì để chặn');
});

test('bốc Bom có Kéo: mất Kéo, Bom quay lại chồng; không Kéo: nổ', () => {
  const keo = K('keo');
  const s = act(mk([[keo], [K('soi')]], [K('soi'), K('ne'), K('bom')]), 'A', { type: 'draw' }).state;
  assert.equal(s.players[0].alive, true);
  assert.equal(s.players[0].hand.length, 0);
  assert.equal(s.deck.length, 3);
  assert.equal(s.deck.filter((c) => c.t === 'bom').length, 1);
  assert.equal(s.turn, 1);
  assert.deepEqual(s.log, { kind: 'go-bom', id: 'A' });
  const boom = act(mk([[K('soi')], [K('soi')], [K('ne')]], [K('bom')]), 'A', { type: 'draw' }).state;
  assert.equal(boom.players[0].alive, false);
  assert.equal(boom.players[0].hand.length, 0);
  assert.equal(boom.winner, null);
  assert.equal(boom.turn, 1);
});

test('bỏ qua người đã bị loại; còn 1 người thì thắng', () => {
  const s = mk([[], [], []], [K('soi'), K('soi')], {});
  s.players[1].alive = false;
  const d = act(s, 'A', { type: 'draw' }).state;
  assert.equal(d.players[d.turn].id, 'C');
  const last = act(mk([[], [K('soi')]], [K('bom')]), 'A', { type: 'draw' }).state;
  assert.equal(last.winner, 'B');
});

test('forceSkip = bốc 1 lá; đầu vào rác bị từ chối', () => {
  const s = mk([[K('soi')], [K('chan')]], [K('ne')]);
  const f = forceSkip(s);
  assert.equal(f.players[0].hand.length, 2);
  assert.equal(f.turn, 1);
  for (const a of [null, { type: 'play' }, { type: 'play', card: 'x' }, { type: 'zz' }, { type: 'chan', card: 1 }]) {
    assert.equal(act(s, 'A', a).ok, false, JSON.stringify(a));
  }
  assert.equal(act(s, 'B', { type: 'draw' }).ok, false, 'chưa tới lượt');
  assert.equal(viewFor(s, 'Z'), null);
});

test('C2: forceSkip khi đang có lá chờ thì không làm gì', () => {
  const ne = K('ne');
  const s = act(mk([[ne], [K('soi')]], [K('bom')]), 'A', { type: 'play', card: ne.id }).state;
  assert.equal(forceSkip(s), s);
});

test('I2: hết cửa sổ thì engine tự xử lý, không cần đợi timer', () => {
  const ne = K('ne'), c1 = K('chan');
  const s = act(mk([[ne, K('soi')], [c1]], [K('soi'), K('soi')]), 'A', { type: 'play', card: ne.id }).state;
  const late = act(s, 'B', { type: 'chan', card: c1.id }, T0 + WINDOW + 50_000);
  assert.equal(late.ok, false, 'Chặn trễ bị từ chối');
  const soi = K('soi');
  const p = act(mk([[soi], [K('chan')]], [K('ne'), K('ne')]), 'A', { type: 'play', card: soi.id }).state;
  const d = act(p, 'A', { type: 'draw' }, T0 + WINDOW + 1);
  assert.equal(d.ok, true, 'bốc được ngay khi hết 3 giây dù timer chưa chạy');
});
