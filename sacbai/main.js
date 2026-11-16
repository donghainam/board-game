import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { start, apply, viewFor, forceSkip, COLORS } from './engine.js';

const COLOR_NAME = { r: 'Đỏ', y: 'Vàng', g: 'Lục', b: 'Lam' };
const LABEL = { '+2': '+2', '+4': '+4', chan: '⛔', doi: '🎨' };
const NAME = { '+2': 'Phạt +2', '+4': 'Phạt +4', chan: 'Chặn', doi: 'Đổi màu' };

let picking = null; // lá đen đang chờ chọn màu

const card = (c, attrs = {}, big = false) => el(attrs.onclick ? 'button' : 'span', {
  class: `gc c-${COLORS.includes(c.c) || c.c === 'k' ? c.c : 'k'}${big ? ' big' : ''}`,
  'aria-label': `${NAME[c.v] || c.v} ${COLOR_NAME[c.c] || 'đen'}`, ...attrs,
}, LABEL[c.v] || c.v);

function renderTable(v, { me, nameOf, online, send, pending, rerender }) {
  const myTurn = v.turn === me;
  if (!myTurn) picking = null;
  const mine = v.order.indexOf(me);
  const others = [...v.order.slice(mine + 1), ...v.order.slice(0, mine)];
  const count = Object.fromEntries(v.others.map((o) => [o.id, o.count]));
  const players = el('div', { class: 'players' }, others.map((id) => el('div', { class: 'pl' + (v.turn === id ? ' turn' : '') },
    el('div', { class: 'n' }, el('span', { class: 'dot' + (online(id) ? ' on' : '') }), ' ', nameOf(id)),
    el('div', { class: 'muted' }, `${count[id]} lá`),
    v.unannounced === id ? el('button', { class: 'btn btn-small btn-primary', onclick: () => send({ type: 'bat', target: id }) }, 'Bắt!') : null)));

  const felt = el('div', { class: 'felt' },
    card(v.top, {}, true),
    el('div', {}, `Màu: ${COLOR_NAME[v.color]}`, ' · ', `Chồng bài: ${v.deckCount}`),
    v.penalty ? el('div', { class: 'alert-big' }, `Phạt dồn +${v.penalty.n}`) : null);

  const status = el('div', { class: 'status' + (myTurn ? ' me' : ''), role: 'status' },
    myTurn ? (v.drew ? 'Đánh lá vừa bốc hoặc bấm Qua.' : 'Tới lượt bạn!') : `Đang chờ ${nameOf(v.turn)}…`);

  const bao = v.unannounced === me
    ? el('button', { class: 'btn btn-primary', style: 'font-size:20px', onclick: () => send({ type: 'bao' }) }, '📣 BÁO!')
    : null;

  const play = (c) => {
    if (c.c === 'k') { picking = c.id; rerender(); return; }
    send({ type: 'play', card: c.id });
  };
  const hand = el('div', { class: 'hand' }, v.me.hand.map((c) => card(c, {
    class: `gc c-${c.c}${picking === c.id ? ' sel' : ''}${v.drew && c.id !== v.drawnId ? ' dim' : ''}`,
    disabled: !myTurn || pending, onclick: () => play(c),
  })));
  const swatches = picking !== null
    ? el('div', { class: 'stack' }, el('div', { class: 'status' }, 'Chọn màu:'), el('div', { class: 'swatches' }, COLORS.map((col) => el('button', {
      class: 'swatch', style: `background:var(--sw-${col})`, 'aria-label': COLOR_NAME[col],
      onclick: () => { const id = picking; picking = null; send({ type: 'play', card: id, color: col }); },
    }))))
    : null;

  const actions = el('div', { class: 'actions' },
    el('button', { class: 'btn', disabled: !myTurn || v.drew || pending, onclick: () => send({ type: 'draw' }) },
      v.penalty ? `Bốc phạt ${v.penalty.n}` : 'Bốc'),
    el('button', { class: 'btn', disabled: !myTurn || !v.drew || pending, onclick: () => send({ type: 'pass' }) }, 'Qua'));

  return [players, felt, bao, status, swatches, hand, actions];
}

document.documentElement.style.cssText += ';--sw-r:#e03131;--sw-y:#f2b200;--sw-g:#2f9e44;--sw-b:#1c7ed6';

runTable({
  gameCode: 'S', minPlayers: 2, maxPlayers: 10,
  engine: { start, apply: (s, id, a) => apply(s, id, a), viewFor, forceSkip: (s) => forceSkip(s) },
  renderTable,
  resultOf: () => ({ reason: 'đánh hết bài trước' }),
});
