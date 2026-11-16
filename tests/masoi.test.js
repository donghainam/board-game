import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, start, apply, viewFor, forceSkip, nextTimer, onTimer } from '../masoi/engine.js';

const CFG = { wolves: 1, tientri: false, baove: false, phuthuy: false, thosan: false, cupid: false, soinguyen: false, soigayme: false, talkMin: 2 };
const T = 1_000_000;
const rng0 = () => 0;
// Ván với vai gán tay: roles[i] là vai của người 'P<i>'.
function game(roles) {
  const ids = roles.map((_, i) => 'P' + i);
  const s = start(ids, { config: { ...CFG, wolves: roles.filter((r) => r === 'soi').length } }, rng0);
  s.players.forEach((p, i) => { p.role = roles[i]; p.wolf = ['soi', 'soinguyen', 'soigayme'].includes(roles[i]); });
  return s;
}
const A = (s, id, action, now = T) => {
  const r = apply(s, id, action, rng0, now);
  assert.equal(r.ok, true, `${id} ${JSON.stringify(action)}: ${r.error}`);
  return r.state;
};
const NO = (s, id, action, now = T) => assert.equal(apply(s, id, action, rng0, now).ok, false, `${id} ${JSON.stringify(action)} phải bị từ chối`);
const readyAll = (s, except = []) => s.players.filter((p) => p.alive && !except.includes(p.id)).reduce((st, p) => A(st, p.id, { type: 'night', ready: true }), s);
const alive = (s) => s.players.filter((p) => p.alive).map((p) => p.id);

test('validate', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  assert.equal(validate(ids, { ...CFG, wolves: 1 }), undefined);
  assert.match(validate(ids, { ...CFG, wolves: 3 }), /nửa/);
  assert.match(validate(ids, { ...CFG, wolves: 2, soinguyen: true }), /nửa/);
  assert.match(validate(ids.slice(0, 4), CFG), /5/);
  assert.match(validate(ids, { ...CFG, wolves: 2, tientri: true, baove: true, phuthuy: true, thosan: true }), /nhiều hơn/);
  const s = start(['a', 'b', 'c', 'd', 'e', 'f'], { config: { ...CFG, wolves: 2, tientri: true } });
  assert.deepEqual(s.players.map((p) => p.role).sort(), ['dan', 'dan', 'dan', 'soi', 'soi', 'tientri']);
});

test('sói phải thống nhất; dân phải sẵn sàng; sáng ra công bố người chết, không lật vai', () => {
  let s = game(['soi', 'soi', 'dan', 'dan', 'dan', 'dan', 'dan']);
  s = A(s, 'P0', { type: 'night', target: 'P2' });
  s = A(s, 'P1', { type: 'night', target: 'P3' });
  s = readyAll(s, ['P0', 'P1']);
  assert.equal(s.phase, 'night', 'sói chưa thống nhất');
  NO(s, 'P2', { type: 'night', target: 'P4' }); // dân không cắn được
  s = A(s, 'P1', { type: 'night', target: 'P2' });
  assert.equal(s.phase, 'elect');
  assert.deepEqual(s.news.deaths, ['P2']);
  const v = viewFor(s, 'P3');
  assert.equal(JSON.stringify(v).includes('"soi"'), false, 'không lộ vai');
});

test('dân chưa sẵn sàng thì đêm chưa xong; view của dân không lộ lựa chọn của sói', () => {
  let s = game(['soi', 'dan', 'dan', 'dan', 'dan']);
  s = A(s, 'P0', { type: 'night', target: 'P1' });
  s = readyAll(s, ['P0', 'P4']);
  assert.equal(s.phase, 'night');
  const json = JSON.stringify(viewFor(s, 'P4'));
  assert.equal(json.includes('P1"') && json.includes('target'), false);
  assert.equal(viewFor(s, 'P0').wolves.picks.P0, 'P1', 'sói thấy lựa chọn của đồng đội');
});

test('bảo vệ che đúng người thì không ai chết; không che 1 người 2 đêm liền', () => {
  let s = game(['soi', 'baove', 'dan', 'dan', 'dan', 'dan']);
  s = A(s, 'P0', { type: 'night', target: 'P2' });
  s = A(s, 'P1', { type: 'night', target: 'P2' });
  s = readyAll(s, ['P0', 'P1']);
  assert.deepEqual(s.news.deaths, []);
  s = { ...s, phase: 'night', night: 2, acts: {} };
  NO(s, 'P1', { type: 'night', target: 'P2' });
  A(s, 'P1', { type: 'night', target: 'P1' }); // tự che được
});

test('phù thuỷ: biết nạn nhân sau khi sói thống nhất; tự cứu + dùng độc cùng đêm; mỗi bình 1 lần', () => {
  let s = game(['soi', 'phuthuy', 'dan', 'dan', 'dan', 'dan', 'dan']);
  NO(s, 'P1', { type: 'night', save: false, poison: null });
  assert.equal(viewFor(s, 'P1').witch.victim, null);
  s = A(s, 'P0', { type: 'night', target: 'P1' });
  assert.equal(viewFor(s, 'P1').witch.victim, 'P1');
  assert.equal(JSON.stringify(viewFor(s, 'P2')).includes('victim'), false);
  s = readyAll(s, ['P0', 'P1']);
  s = A(s, 'P1', { type: 'night', save: true, poison: 'P0' });
  assert.deepEqual(s.news.deaths, ['P0']);
  assert.equal(s.winner?.length > 0, true, 'hết sói → dân thắng');
  assert.equal(s.winTeam, 'dan');
  let t = game(['soi', 'phuthuy', 'dan', 'dan', 'dan', 'dan', 'dan']);
  t.potions = { save: false, poison: false };
  t = A(t, 'P0', { type: 'night', target: 'P2' });
  NO(t, 'P1', { type: 'night', save: true, poison: null });
  NO(t, 'P1', { type: 'night', save: false, poison: 'P0' });
});

test('độc xuyên bảo vệ', () => {
  let s = game(['soi', 'phuthuy', 'baove', 'dan', 'dan', 'dan', 'dan']);
  s = A(s, 'P0', { type: 'night', target: 'P3' });
  s = A(s, 'P2', { type: 'night', target: 'P4' });
  s = readyAll(s, ['P0', 'P1', 'P2']);
  s = A(s, 'P1', { type: 'night', save: false, poison: 'P4' });
  assert.deepEqual(s.news.deaths.sort(), ['P3', 'P4']);
});

test('tiên tri: kết quả chỉ tiên tri thấy; người bị nguyền soi ra Sói', () => {
  let s = game(['soi', 'tientri', 'dan', 'dan', 'dan', 'dan', 'dan']);
  s = A(s, 'P1', { type: 'night', target: 'P0' });
  assert.deepEqual(viewFor(s, 'P1').seer, [{ target: 'P0', wolf: true, night: 1 }]);
  assert.equal(viewFor(s, 'P2').seer, undefined);
  NO(s, 'P1', { type: 'night', target: 'P2' }); // soi rồi không đổi
});

test('sói nguyền: biến thành sói, 1 lần; sói gây mê: người bị mê không bỏ phiếu', () => {
  let s = game(['soinguyen', 'soigayme', 'tientri', 'dan', 'dan', 'dan', 'dan']);
  s = A(s, 'P0', { type: 'night', target: 'P3', curse: true });
  s = A(s, 'P1', { type: 'night', target: 'P3', drug: 'P4' });
  s = A(s, 'P2', { type: 'night', target: 'P5' });
  s = readyAll(s, ['P0', 'P1', 'P2']);
  assert.deepEqual(s.news.deaths, []);
  assert.equal(s.players[3].wolf, true);
  assert.equal(viewFor(s, 'P3').me.converted, true);
  assert.equal(s.drugged, 'P4');
  assert.equal(s.curseUsed, true);
  // bầu già làng, thảo luận, bỏ phiếu
  for (const id of alive(s)) s = A(s, id, { type: 'vote', target: 'P5' });
  assert.equal(s.elder, 'P5');
  assert.equal(s.phase, 'talk');
  assert.equal(nextTimer(s), T + 2 * 60000);
  s = onTimer(s, T + 2 * 60000);
  assert.equal(s.phase, 'vote');
  NO(s, 'P4', { type: 'vote', target: 'P0' });
  assert.equal(viewFor(s, 'P0').waitingOn.includes('P4'), false);
  // đêm 2: không nguyền lần 2
  s = { ...s, phase: 'night', night: 2, acts: {} };
  NO(s, 'P0', { type: 'night', target: 'P5', curse: true });
});

test('hoà phiếu: già làng chọn; thợ săn bị treo thì bắn; già làng chết thì chọn người kế', () => {
  let s = game(['soi', 'thosan', 'dan', 'dan', 'dan', 'dan', 'dan']);
  s = { ...s, phase: 'vote', day: 1, elder: 'P2', news: { deaths: [] } };
  // P1 và P3 hoà 2–2, P2 bỏ trống
  s = A(s, 'P0', { type: 'vote', target: 'P1' });
  s = A(s, 'P4', { type: 'vote', target: 'P1' });
  s = A(s, 'P5', { type: 'vote', target: 'P3' });
  s = A(s, 'P6', { type: 'vote', target: 'P3' });
  s = A(s, 'P1', { type: 'vote', target: null });
  s = A(s, 'P3', { type: 'vote', target: null });
  s = A(s, 'P2', { type: 'vote', target: null });
  assert.equal(s.phase, 'tie');
  NO(s, 'P0', { type: 'pick', target: 'P1' });
  NO(s, 'P2', { type: 'pick', target: 'P4' }); // không thuộc nhóm hoà
  s = A(s, 'P2', { type: 'pick', target: 'P1' });
  assert.equal(s.phase, 'hunter');
  s = A(s, 'P1', { type: 'pick', target: 'P2' }); // bắn già làng
  assert.equal(s.phase, 'successor');
  NO(s, 'P2', { type: 'pick', target: 'P1' }); // người chết không được chọn
  s = A(s, 'P2', { type: 'pick', target: 'P4' });
  assert.equal(s.elder, 'P4');
  assert.equal(s.phase, 'night');
  assert.equal(s.night, 2);
});

test('cupid: chết theo; cặp khác phe còn 2 người cuối thì thắng', () => {
  let s = game(['soi', 'cupid', 'dan', 'dan', 'dan']);
  s = A(s, 'P0', { type: 'night', target: 'P3' });
  s = A(s, 'P1', { type: 'night', targets: ['P0', 'P2'] });
  s = readyAll(s, ['P0', 'P1']);
  assert.deepEqual(viewFor(s, 'P2').lover, 'P0');
  assert.equal(viewFor(s, 'P4').lover, undefined);
  // treo P2 → P0 chết theo → hết sói
  let d = { ...s, phase: 'vote' };
  for (const id of alive(d)) d = A(d, id, { type: 'vote', target: 'P2' });
  assert.deepEqual(d.news.deaths.sort(), ['P0', 'P2']);
  // cặp đôi còn lại 2 người cuối
  const two = { ...s, phase: 'vote', players: s.players.map((p) => ({ ...p, alive: ['P0', 'P2', 'P4'].includes(p.id) })) };
  let w = A(two, 'P0', { type: 'vote', target: 'P4' });
  w = A(w, 'P2', { type: 'vote', target: 'P4' });
  w = A(w, 'P4', { type: 'vote', target: null });
  assert.equal(w.winTeam, 'doi');
  assert.deepEqual([...w.winner].sort(), ['P0', 'P2']);
});

test('sói thắng khi số sói ≥ số người còn lại; winner là mảng cả phe (kể cả người đã chết)', () => {
  let s = game(['soi', 'soi', 'dan', 'dan', 'dan', 'dan', 'dan']);
  s = { ...s, players: s.players.map((p) => ({ ...p, alive: ['P0', 'P1', 'P2', 'P3'].includes(p.id) })), phase: 'vote', elder: 'P2' };
  for (const id of ['P0', 'P1', 'P3']) s = A(s, id, { type: 'vote', target: 'P2' });
  s = A(s, 'P2', { type: 'vote', target: null }); // P2 bị treo → 2 sói vs 1 dân... chờ già làng kế nhiệm
  s = A(s, 'P2', { type: 'pick', target: 'P3' });
  assert.equal(s.winTeam, 'soi');
  assert.deepEqual([...s.winner].sort(), ['P0', 'P1']);
});

test('forceSkip: đêm không thống nhất thì không ai chết; phiếu thiếu = bỏ trống', () => {
  let s = game(['soi', 'soi', 'dan', 'dan', 'dan', 'dan', 'dan']);
  s = A(s, 'P0', { type: 'night', target: 'P2' });
  s = A(s, 'P1', { type: 'night', target: 'P3' });
  s = forceSkip(s, rng0, T);
  assert.deepEqual(s.news.deaths, []);
  assert.equal(s.phase, 'elect');
  s = forceSkip(s, rng0, T); // không ai bầu → máy chọn
  assert.ok(s.elder);
  s = forceSkip(s, rng0, T); // talk → vote
  assert.equal(s.phase, 'vote');
  s = forceSkip(s, rng0, T);
  assert.equal(s.phase, 'night');
});

test('host bỏ qua thảo luận; người chết, người ngoài, đầu vào rác bị từ chối', () => {
  let s = { ...game(['soi', 'dan', 'dan', 'dan', 'dan']), phase: 'talk', until: T + 99999, elder: 'P1' };
  NO(s, 'P2', { type: 'skip-talk' });
  s = A(s, 'P0', { type: 'skip-talk' }); // P0 là chủ bàn (id đầu tiên)
  assert.equal(s.phase, 'vote');
  s.players[3].alive = false;
  NO(s, 'P3', { type: 'vote', target: 'P0' });
  NO(s, 'ZZ', { type: 'vote', target: 'P0' });
  for (const a of [null, {}, { type: 'vote', target: 'nobody' }, { type: 'pick' }, { type: 'night', target: 5 }]) NO(s, 'P1', a);
  assert.equal(viewFor(s, 'ZZ'), null);
});

test('review #1: bầy sói đã thống nhất thì không đổi người cắn được nữa', () => {
  let s = game(['soi', 'soi', 'phuthuy', 'dan', 'dan', 'dan', 'dan']);
  s = A(s, 'P0', { type: 'night', target: 'P3' });
  s = A(s, 'P1', { type: 'night', target: 'P3' });
  NO(s, 'P1', { type: 'night', target: 'P4' });
});

test('review #3: sói chưa thống nhất vẫn nằm trong danh sách chờ của chủ bàn', () => {
  let s = game(['dan', 'soi', 'soi', 'dan', 'dan', 'dan', 'dan']);
  s = A(s, 'P1', { type: 'night', target: 'P3' });
  s = A(s, 'P2', { type: 'night', target: 'P4' });
  const w = viewFor(s, 'P0').waitingOn;
  assert.ok(w.includes('P1') && w.includes('P2'));
});
