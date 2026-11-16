import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { roundTable, sideLayout } from '../shared/roundtable.js';
import { newGame, applyAction, forceSkip, viewFor, RANKS, SUITS } from './engine.js';

const REASON = {
  'het-bai': 'đánh hết bài', 'sanh-rong': 'tới trắng: sảnh rồng', 'tu-quy-2': 'tới trắng: tứ quý heo',
  '6-doi': 'tới trắng: 6 đôi', '5-doi-thong': 'tới trắng: 5 đôi thông',
};

let selected = new Set();

const pc = (c, attrs = {}) => el('button', { class: 'pc' + ((c & 3) >= 2 ? ' red' : ''), 'aria-label': RANKS[c >> 2] + ' ' + SUITS[c & 3], ...attrs },
  el('span', {}, RANKS[c >> 2]), el('span', { class: 's' }, SUITS[c & 3]));

const RULES = [
  ['Rác', '1 lá bất kỳ.'], ['Đôi / Sám', '2 / 3 lá cùng số.'], ['Sảnh', 'Từ 3 lá liên tiếp, không có 2 (heo).'],
  ['Đôi thông', 'Từ 3 đôi liên tiếp, không có heo.'], ['Tứ quý', '4 lá cùng số.'],
  ['Chặn', 'Cùng loại, cùng số lá và lớn hơn (số trước, chất sau: ♠ < ♣ < ♦ < ♥).'],
  ['Chặt heo', '3 đôi thông chặt 1 heo · Tứ quý chặt heo, đôi heo, 3 đôi thông · 4 đôi thông chặt tất cả.'],
  ['Tới trắng', 'Sảnh rồng (3→A), tứ quý heo, 6 đôi, 5 đôi thông: thắng ngay.'],
  ['Bỏ lượt', 'Đã bỏ thì hết quyền trong vòng đó; ai cũng bỏ thì người đánh cuối mở vòng mới.'],
];

function renderTable(v, { me, nameOf, online, send, pending, rerender }) {
  selected = new Set([...selected].filter((c) => v.me.hand.includes(c)));
  const myTurn = v.turn === me;
  const who = (id) => (id === me ? 'Bạn' : nameOf(id));
  const count = Object.fromEntries(v.others.map((o) => [o.id, o.count]));
  count[me] = v.me.hand.length;

  const seat = (id) => [
    el('div', { class: 'rt-av' }, v.passed.includes(id) ? '🙅' : '🃏', el('span', { class: 'rt-cnt' }, `🂠${count[id]}`)),
    el('div', { class: 'rt-nm' }, el('span', { class: 'dot' + (online(id) ? ' on' : '') }), ' ', who(id)),
    el('div', { class: 'rt-sub' }, `${count[id]} lá`, v.passed.includes(id) ? ' · bỏ lượt' : ''),
  ];
  const seatAttrs = (id) => ({ cls: v.turn === id ? 'turn' : '' });
  const center = v.trick
    ? [el('div', { class: 'cards' }, v.trick.cards.map((c) => pc(c, { tabindex: -1 }))), el('div', { class: 'msg' }, `${who(v.trick.by)} vừa đánh`)]
    : [el('div', { class: 'msg' }, `Vòng mới · ${myTurn ? 'bạn' : nameOf(v.turn)} được đi trước`)];

  let statusText = myTurn ? 'Tới lượt bạn!' : `Đang chờ ${nameOf(v.turn)}…`;
  if (myTurn && v.mustInclude !== null) statusText += ` (phải có lá ${RANKS[v.mustInclude >> 2]}${SUITS[v.mustInclude & 3]})`;
  if (v.passed.includes(me)) statusText = 'Bạn đã bỏ lượt vòng này';
  const status = el('div', { class: 'status' + (myTurn ? ' me' : ''), role: 'status' }, statusText);

  const hand = el('div', { class: 'hand' }, v.me.hand.map((c) => pc(c, {
    class: 'pc' + ((c & 3) >= 2 ? ' red' : '') + (selected.has(c) ? ' sel' : ''),
    'aria-pressed': selected.has(c) ? 'true' : 'false',
    onclick: () => { selected.has(c) ? selected.delete(c) : selected.add(c); rerender(); },
  })));

  const actions = el('div', { class: 'actions' },
    el('button', { class: 'btn', disabled: !myTurn || !v.trick || pending, onclick: () => send({ type: 'pass' }) }, 'Bỏ lượt'),
    el('button', { class: 'btn', disabled: !selected.size, onclick: () => { selected.clear(); rerender(); } }, 'Bỏ chọn'),
    el('button', { class: 'btn btn-primary', disabled: !myTurn || !selected.size || pending,
      onclick: () => send({ type: 'play', cards: [...selected] }) }, 'Đánh'));

  const left = { icon: '📖', title: 'Luật', body: RULES.map(([n, d]) => el('div', { class: 'chr' }, el('b', {}, n), el('small', {}, d))) };
  return [sideLayout({ left, main: [roundTable({ order: v.order, me, seat, seatAttrs, center }), status, hand, actions] })];
}

runTable({
  gameCode: 'T', minPlayers: 2, maxPlayers: 4,
  engine: {
    start: (ids, { lastWinner }) => newGame(ids, { leader: lastWinner }),
    apply: applyAction, viewFor, forceSkip,
  },
  renderTable,
  resultOf: (v, nameOf) => ({ reason: REASON[v.endReason] || '', lines: v.notes.map((n) => `${nameOf(n.id)} ${n.text}`) }),
});
