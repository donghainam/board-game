import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { roundTable, sideLayout } from '../shared/roundtable.js';
import { start, apply, viewFor, forceSkip, nextTimer, onTimer, WINDOW } from './engine.js';

// Minh hoạ SVG tự vẽ (viewBox 64×64) + ý nghĩa từng lá
const K = 'stroke="#3b2a17" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
const ART = {
  bom: `<circle cx="28" cy="38" r="18" fill="#2b2b2b" ${K}/><rect x="34" y="14" width="10" height="8" rx="2" fill="#555" ${K} transform="rotate(35 39 18)"/><path d="M44 12c4-4 8-2 10-6" fill="none" ${K}/><path d="M54 6l3-3M54 6l4 1M54 6l-1-4" stroke="#f08c00" stroke-width="2.5" stroke-linecap="round"/><circle cx="21" cy="31" r="4" fill="#fff" opacity=".35"/>`,
  keo: `<circle cx="18" cy="46" r="7" fill="#e03131" ${K}/><circle cx="34" cy="50" r="7" fill="#e03131" ${K}/><path d="M23 41L50 12M29 44L54 22" fill="none" ${K}/><path d="M46 8l8 8" stroke="#2f9e44" stroke-width="4" stroke-linecap="round"/>`,
  soi: `<path d="M6 32c8-12 18-18 26-18s18 6 26 18c-8 12-18 18-26 18S14 44 6 32z" fill="#fff" ${K}/><circle cx="32" cy="32" r="9" fill="#7048e8" ${K}/><circle cx="32" cy="32" r="3" fill="#3b2a17"/><text x="44" y="58" font-size="14" font-weight="800" fill="#3b2a17" font-family="system-ui">×3</text>`,
  ne: `<circle cx="38" cy="12" r="6" fill="#f2d6b3" ${K}/><path d="M36 20l-6 14 10 6 2 16M30 34l-12 4M36 24l12 6M30 34l-6 20" fill="none" ${K}/><path d="M6 20h12M4 28h10M8 36h8" stroke="#1c7ed6" stroke-width="2.5" stroke-linecap="round"/>`,
  chan: `<path d="M20 56V28a4 4 0 0 1 8 0V14a4 4 0 0 1 8 0v14-10a4 4 0 0 1 8 0v12-6a4 4 0 0 1 8 0v20c0 8-6 12-14 12h-6c-6 0-12-4-12-6z" fill="#ffd8a8" ${K}/><circle cx="32" cy="32" r="28" fill="none" stroke="#e8590c" stroke-width="3" opacity=".7"/>`,
};
const NAME = { soi: 'Soi', ne: 'Né', chan: 'Chặn', keo: 'Kéo', bom: 'Bom' };
const MEAN = {
  bom: 'Bốc trúng: có Kéo thì gỡ (bom được xáo lại vào chồng), không có thì nổ – bị loại.',
  keo: 'Tự động dùng khi bốc trúng Bom. Mỗi người có sẵn 1 lá, trong chồng còn 1 lá.',
  soi: 'Xem riêng 3 lá trên cùng của chồng bài.',
  ne: 'Kết thúc lượt mà không phải bốc.',
  chan: 'Huỷ lá Soi/Né vừa được đánh (ai cũng đánh được, trong 3 giây). Chặn chồng Chặn thì phục hồi.',
};
const art = (t) => { const s = document.createElement('span'); s.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${ART[t] || ''}</svg>`; return s.firstChild; };
const ac = (t, attrs = {}) => el(attrs.onclick ? 'button' : 'div', {
  class: 'ac' + (t ? '' : ' back') + (attrs.big ? ' big' : ''), onclick: attrs.onclick, title: MEAN[t] || '', 'aria-label': NAME[t] || 'Lá úp',
}, t ? [art(t), el('span', { class: 't' }, NAME[t])] : []);

function renderTable(v, { me, nameOf, online, send, pending }) {
  const who = (id) => (id === me ? 'Bạn' : nameOf(id));
  const myTurn = v.turn === me && v.me.alive;
  const P = Object.fromEntries(v.players.map((p) => [p.id, p]));

  const seat = (id) => {
    const p = P[id];
    return [
      el('div', { class: 'rt-av' }, p.alive ? '😬' : '💥', el('span', { class: 'rt-cnt' }, `🂠${p.count}`)),
      el('div', { class: 'rt-nm' }, el('span', { class: 'dot' + (online(id) ? ' on' : '') }), ' ', who(id)),
      el('div', { class: 'rt-sub' }, p.alive ? `${p.count} lá` : 'đã nổ'),
    ];
  };
  const seatAttrs = (id) => ({ cls: [v.turn === id ? 'turn' : '', P[id].alive ? '' : 'dead'].join(' ') });

  const pd = v.pending;
  const center = [
    el('div', { class: 'row', style: 'gap:10px;justify-content:center;align-items:flex-end' },
      ac(null), pd ? ac(pd.card.t, { big: true }) : null),
    el('div', { class: 'msg' }, pd
      ? `${who(pd.by)} đánh ${NAME[pd.card.t]}${pd.chans ? ` · bị Chặn ×${pd.chans} (${pd.chans % 2 ? 'đang bị huỷ' : 'vẫn có tác dụng'})` : ''}`
      : `Chồng bài: ${v.deckCount} lá`),
    pd ? el('div', { class: 'bar' }, el('i', { style: `animation-duration:${WINDOW}ms` })) : null,
    v.log ? el('div', { class: 'msg' }, v.log.kind === 'go-bom' ? `✂️ ${who(v.log.id)} gỡ bom!` : `💥 ${who(v.log.id)} nổ bom!`) : null,
  ];

  const myChan = v.me.hand.find((c) => c.t === 'chan');
  const chanBtn = pd && v.me.alive
    ? el('button', { class: 'btn btn-primary', disabled: !myChan || pending, onclick: () => send({ type: 'chan', card: myChan.id }) }, myChan ? '✋ Chặn!' : 'Không có lá Chặn')
    : null;
  const peek = v.peek ? el('div', { class: 'card-tile stack' }, el('b', {}, '👀 3 lá trên cùng (trái là lá sẽ bốc trước):'),
    el('div', { class: 'row', style: 'justify-content:center;gap:8px' }, v.peek.map((c) => ac(c.t)))) : null;

  let statusText;
  if (!v.me.alive) statusText = 'Bạn đã nổ 💥 – ngồi xem tiếp nhé.';
  else if (myTurn) statusText = pd ? 'Chờ 3 giây…' : 'Tới lượt bạn! Đánh lá hoặc bốc để hết lượt.';
  else statusText = `Đang chờ ${nameOf(v.turn)}…`;

  const canPlay = myTurn && !pd && !pending;
  const hand = el('div', { class: 'fan' }, v.me.hand.map((c) => ac(c.t, (c.t === 'soi' || c.t === 'ne') && canPlay
    ? { onclick: () => send({ type: 'play', card: c.id }) } : {})));
  const actions = el('div', { class: 'actions' },
    el('button', { class: 'btn btn-primary', disabled: !canPlay, onclick: () => send({ type: 'draw' }) }, 'Bốc 1 lá'));

  const left = { icon: '📖', title: 'Lá bài', body: Object.keys(NAME).map((t) => el('div', { class: 'gl' }, art(t), el('div', {}, el('b', {}, NAME[t]), el('small', {}, MEAN[t])))) };
  const main = [roundTable({ order: v.players.map((p) => p.id), me, seat, seatAttrs, center }), chanBtn,
    el('div', { class: 'status' + (myTurn ? ' me' : ''), role: 'status' }, statusText), peek, hand, actions].filter(Boolean);
  return [sideLayout({ left, main })];
}

runTable({
  gameCode: 'B', minPlayers: 2, maxPlayers: 5,
  engine: { start, apply: (s, id, a) => apply(s, id, a), viewFor, forceSkip: (s) => forceSkip(s), nextTimer, onTimer },
  renderTable,
  resultOf: () => ({ reason: 'người cuối cùng còn sống' }),
});
