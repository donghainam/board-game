import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { start, apply, viewFor, forceSkip, nextTimer, onTimer, WINDOW } from './engine.js';

const ICON = { soi: '👀', ne: '🏃', chan: '✋', keo: '✂️', bom: '💣' };
const NAME = { soi: 'Soi', ne: 'Né', chan: 'Chặn', keo: 'Kéo', bom: 'Bom' };
const T = new Set(Object.keys(ICON));

const gc = (t, attrs = {}) => el(attrs.onclick ? 'button' : 'span', {
  class: `gc t-${T.has(t) ? t : 'back'}`, 'aria-label': NAME[t] || 'Lá úp', ...attrs,
}, el('span', { style: 'display:flex;flex-direction:column;align-items:center;gap:4px' },
  el('span', {}, ICON[t] || ''), el('span', { style: 'font-size:12px' }, NAME[t] || '')));

function renderTable(v, { me, nameOf, online, send, pending }) {
  const who = (id) => (id === me ? 'Bạn' : nameOf(id));
  const myTurn = v.turn === me && v.me.alive;
  const players = el('div', { class: 'players' }, v.players.filter((p) => p.id !== me).map((p) => el('div', {
    class: 'pl' + (v.turn === p.id ? ' turn' : '') + (p.alive ? '' : ' out'),
  }, el('div', { class: 'n' }, el('span', { class: 'dot' + (online(p.id) ? ' on' : '') }), ' ', nameOf(p.id)),
  el('div', { class: 'muted' }, p.alive ? `${p.count} lá` : '💥 đã nổ'))));

  const log = v.log ? el('div', { class: 'alert-big', role: 'alert' },
    v.log.kind === 'go-bom' ? `✂️ ${who(v.log.id)} gỡ bom! Bom đã bị xáo lại vào chồng bài.` : `💥 ${who(v.log.id)} nổ bom!`) : null;

  const felt = el('div', { class: 'felt' },
    el('div', { class: 'row', style: 'justify-content:center' }, gc('back'), el('span', {}, `Chồng bài: ${v.deckCount} lá`)),
    v.pending ? el('div', { class: 'stack', style: 'align-items:center;gap:6px' },
      el('div', {}, `${who(v.pending.by)} đánh ${NAME[v.pending.card.t]}`, v.pending.chans ? ` · bị Chặn ×${v.pending.chans} (${v.pending.chans % 2 ? 'đang bị huỷ' : 'vẫn có tác dụng'})` : ''),
      el('div', { class: 'bar' }, el('i', { style: `animation-duration:${WINDOW}ms` }))) : null);

  const myChan = v.me.hand.find((c) => c.t === 'chan');
  const chanBtn = v.pending && v.me.alive
    ? el('button', { class: 'btn btn-primary', disabled: !myChan || pending, onclick: () => send({ type: 'chan', card: myChan.id }) }, myChan ? '✋ Chặn!' : 'Không có lá Chặn')
    : null;

  const peek = v.peek ? el('div', { class: 'card-tile stack' }, el('b', {}, '👀 3 lá trên cùng (trái là lá sẽ bốc trước):'),
    el('div', { class: 'hand' }, v.peek.map((c) => gc(c.t)))) : null;

  let statusText;
  if (!v.me.alive) statusText = 'Bạn đã nổ 💥 – ngồi xem tiếp nhé.';
  else if (myTurn) statusText = v.pending ? 'Chờ 3 giây…' : 'Tới lượt bạn! Đánh lá hoặc bốc để hết lượt.';
  else statusText = `Đang chờ ${nameOf(v.turn)}…`;

  const canPlay = myTurn && !v.pending && !pending;
  const hand = el('div', { class: 'hand' }, v.me.hand.map((c) => gc(c.t, (c.t === 'soi' || c.t === 'ne') && canPlay
    ? { onclick: () => send({ type: 'play', card: c.id }) } : {})));

  const actions = el('div', { class: 'actions' },
    el('button', { class: 'btn btn-primary', disabled: !canPlay, onclick: () => send({ type: 'draw' }) }, 'Bốc 1 lá'));

  return [players, log, felt, chanBtn, el('div', { class: 'status' + (myTurn ? ' me' : ''), role: 'status' }, statusText), peek, hand, actions];
}

runTable({
  gameCode: 'B', minPlayers: 2, maxPlayers: 5,
  engine: { start, apply: (s, id, a) => apply(s, id, a), viewFor, forceSkip: (s) => forceSkip(s), nextTimer, onTimer },
  renderTable,
  resultOf: () => ({ reason: 'người cuối cùng còn sống' }),
});
