import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { roundTable, sideLayout } from '../shared/roundtable.js';
import { start, apply, viewFor, forceSkip, COLORS } from './engine.js';

const COLOR_NAME = { r: 'Đỏ', y: 'Vàng', g: 'Lục', b: 'Lam' };
const LABEL = { '+2': '+2', '+4': '+4', chan: '⛔', doi: '🎨' };
const NAME = { '+2': 'Phạt +2', '+4': 'Phạt +4', chan: 'Chặn', doi: 'Đổi màu' };

let picking = null; // lá đen đang chờ chọn màu

const card = (c, attrs = {}, big = false) => el(attrs.onclick ? 'button' : 'span', {
  class: `gc c-${COLORS.includes(c.c) || c.c === 'k' ? c.c : 'k'}${big ? ' big' : ''}`,
  'aria-label': `${NAME[c.v] || c.v} ${COLOR_NAME[c.c] || 'đen'}`, ...attrs,
}, LABEL[c.v] || c.v);

const RULES = [
  ['Đánh bài', 'Lá cùng màu hoặc cùng số / cùng loại với lá trên cùng. Lá đen đánh lúc nào cũng được (trừ khi đang bị phạt).'],
  ['Phạt +2', 'Người kế bốc 2, hoặc chặn bằng +2 / +4 để dồn phạt cho người sau.'],
  ['Phạt +4 (đen)', 'Đổi màu + phạt 4; chỉ chặn được bằng một lá +4 khác.'],
  ['Chặn ⛔', 'Người kế mất lượt (2 người thì bạn đi tiếp).'],
  ['Đổi màu 🎨', 'Chọn màu mới.'],
  ['Bốc', 'Không đánh được thì bốc 1 lá; lá vừa bốc đánh được thì đánh luôn, không thì Qua.'],
  ['BÁO!', 'Còn 1 lá phải bấm BÁO trước khi người kế đi; bị người khác Bắt trước thì bốc 2 lá.'],
];

function renderTable(v, { me, nameOf, online, send, pending, rerender }) {
  const myTurn = v.turn === me;
  if (!myTurn) picking = null;
  const who = (id) => (id === me ? 'Bạn' : nameOf(id));
  const count = Object.fromEntries(v.others.map((o) => [o.id, o.count]));
  count[me] = v.me.hand.length;
  const seat = (id) => [
    el('div', { class: 'rt-av' }, v.unannounced === id ? '📣' : '🌈', el('span', { class: 'rt-cnt' }, `🂠${count[id]}`)),
    el('div', { class: 'rt-nm' }, el('span', { class: 'dot' + (online(id) ? ' on' : '') }), ' ', who(id)),
    el('div', { class: 'rt-sub' }, `${count[id]} lá`),
    v.unannounced === id && id !== me ? el('span', { class: 'rt-chip', style: 'background:var(--accent);color:#fff' }, 'Chạm để BẮT!') : null,
  ];
  const seatAttrs = (id) => ({
    cls: v.turn === id ? 'turn' : '',
    onclick: v.unannounced === id && id !== me && !pending ? () => send({ type: 'bat', target: id }) : undefined,
    label: who(id),
  });
  const center = [
    card(v.top, {}, true),
    el('div', { class: 'msg' }, `Màu: ${COLOR_NAME[v.color]} · Chồng bài: ${v.deckCount}`),
    v.penalty ? el('div', { class: 'alert-big' }, `Phạt dồn +${v.penalty.n}`) : null,
  ];

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

  const left = { icon: '📖', title: 'Lá bài', body: RULES.map(([n, d]) => el('div', { class: 'chr' }, el('b', {}, n), el('small', {}, d))) };
  const main = [roundTable({ order: v.order, me, seat, seatAttrs, center }), bao, status, swatches, hand, actions].filter(Boolean);
  return [sideLayout({ left, main })];
}

document.documentElement.style.cssText += ';--sw-r:#e03131;--sw-y:#f2b200;--sw-g:#2f9e44;--sw-b:#1c7ed6';

runTable({
  gameCode: 'S', minPlayers: 2, maxPlayers: 10,
  engine: { start, apply: (s, id, a) => apply(s, id, a), viewFor, forceSkip: (s) => forceSkip(s) },
  renderTable,
  resultOf: () => ({ reason: 'đánh hết bài trước' }),
});
