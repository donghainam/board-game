import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { newGame, applyAction, forceSkip, viewFor, RANKS, SUITS } from './engine.js';

const REASON = {
  'het-bai': 'đánh hết bài', 'sanh-rong': 'tới trắng: sảnh rồng', 'tu-quy-2': 'tới trắng: tứ quý heo',
  '6-doi': 'tới trắng: 6 đôi', '5-doi-thong': 'tới trắng: 5 đôi thông',
};

let selected = new Set();

const pc = (c, attrs = {}) => el('button', { class: 'pc' + ((c & 3) >= 2 ? ' red' : ''), 'aria-label': RANKS[c >> 2] + ' ' + SUITS[c & 3], ...attrs },
  el('span', {}, RANKS[c >> 2]), el('span', { class: 's' }, SUITS[c & 3]));

function renderTable(v, { me, nameOf, online, send, pending, rerender }) {
  selected = new Set([...selected].filter((c) => v.me.hand.includes(c)));
  const myTurn = v.turn === me;
  const mine = v.order.indexOf(me);
  const others = [...v.order.slice(mine + 1), ...v.order.slice(0, mine)];
  const count = Object.fromEntries(v.others.map((o) => [o.id, o.count]));
  const players = el('div', { class: 'players' }, others.map((id) => el('div', { class: 'pl' + (v.turn === id ? ' turn' : '') },
    el('div', { class: 'n' }, el('span', { class: 'dot' + (online(id) ? ' on' : '') }), ' ', nameOf(id)),
    el('div', { class: 'muted' }, `${count[id]} lá`, v.passed.includes(id) ? ' · bỏ lượt' : ''))));

  const felt = el('div', { class: 'felt' }, v.trick
    ? [el('div', { class: 'cards' }, v.trick.cards.map((c) => pc(c, { tabindex: -1 }))),
      el('div', {}, `${v.trick.by === me ? 'Bạn' : nameOf(v.trick.by)} vừa đánh`)]
    : el('div', {}, `Vòng mới · ${myTurn ? 'bạn' : nameOf(v.turn)} được đi trước`));

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

  return [players, felt, status, hand, actions];
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
