import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { start, apply, viewFor, forceSkip, absSquare, DOOR } from './engine.js';

const COLOR_NAME = ['Đỏ', 'Xanh lá', 'Vàng', 'Xanh dương'];
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// Đường chạy 52 ô theo chiều kim đồng hồ, bắt đầu từ ô xuất phát của màu 0 (hàng, cột trên lưới 15×15).
const TRACK = (() => {
  const t = [];
  const seg = (r0, c0, dr, dc, n) => { for (let i = 0; i < n; i++) t.push([r0 + dr * i, c0 + dc * i]); };
  seg(6, 1, 0, 1, 5); seg(5, 6, -1, 0, 6); seg(0, 7, 0, 1, 2);
  seg(1, 8, 1, 0, 5); seg(6, 9, 0, 1, 6); seg(7, 14, 1, 0, 2);
  seg(8, 13, 0, -1, 5); seg(9, 8, 1, 0, 6); seg(14, 7, 0, -1, 2);
  seg(13, 6, -1, 0, 5); seg(8, 5, 0, -1, 6); seg(7, 0, -1, 0, 2);
  return t;
})();
console.assert(TRACK.length === 52 && new Set(TRACK.map(String)).size === 52, 'TRACK phải có 52 ô khác nhau');

// Bậc chuồng 1..6 của từng màu: từ cửa chuồng đi vào giữa bàn.
const LANE = [
  (b) => [7, b], (b) => [b, 7], (b) => [7, 14 - b], (b) => [14 - b, 7],
];
const YARD = [[0, 0], [0, 9], [9, 9], [9, 0]]; // góc trên-trái của khu chuồng 6×6
const yardSlot = (color, h) => { const [r, c] = YARD[color]; return [r + 1 + 3 * (h >> 1), c + 1 + 3 * (h & 1)]; };

function cellOf(color, pos, h) {
  if (pos < 0) return yardSlot(color, h);
  if (pos <= DOOR) return TRACK[absSquare(color, pos)];
  return LANE[color](pos - DOOR);
}

const at = ([r, c], span = 1) => `grid-row:${r + 1}/span ${span};grid-column:${c + 1}/span ${span}`;

function board(v, myTurn, send) {
  const nodes = [];
  YARD.forEach((p, color) => nodes.push(el('div', { class: `yard y${color}`, style: at(p, 6) })));
  nodes.push(el('div', { class: 'center', style: at([6, 6], 3) }));
  TRACK.forEach((p, i) => {
    const startOf = [0, 13, 26, 39].indexOf(i);
    nodes.push(el('div', { class: 'cell' + (startOf >= 0 ? ` k${startOf}` : ''), style: at(p) }));
  });
  LANE.forEach((f, color) => { for (let b = 1; b <= 6; b++) nodes.push(el('div', { class: `cell lane k${color}`, style: at(f(b)) }, String(b))); });
  const mine = v.players[v.players.findIndex((p) => p.id === v.turn)];
  v.players.forEach((p) => p.horses.forEach((pos, h) => {
    const go = myTurn && p === mine && v.movable.includes(h);
    nodes.push(el('button', {
      class: `horse h${p.color}${go ? ' go' : ''}`, style: at(cellOf(p.color, pos, h)),
      disabled: !go, 'aria-label': `Ngựa ${h + 1} màu ${COLOR_NAME[p.color]}`,
      onclick: go ? () => send({ type: 'move', horse: h }) : null,
    }, '🐴'));
  }));
  return el('div', { class: 'lboard' }, nodes);
}

function renderTable(v, { me, nameOf, send, pending }) {
  const myTurn = v.turn === me;
  const plist = el('div', { class: 'plist' }, v.players.map((p) => el('span', {
    class: v.turn === p.id ? 'turn' : '', style: `background:var(--c${p.color})`,
  }, `${p.id === me ? 'Bạn' : nameOf(p.id)} · ${p.horses.filter((x) => x > DOOR).length}/4`)));

  let statusText;
  if (!myTurn) statusText = `Đang chờ ${nameOf(v.turn)}…`;
  else if (v.roll === null) statusText = 'Tới lượt bạn! Gieo xúc xắc đi.';
  else statusText = `Bạn ra ${v.roll} – chọn ngựa đang nhấp nháy.`;

  const last = v.lastRoll
    ? el('span', {}, el('span', { class: 'die', 'aria-hidden': 'true' }, DIE[v.lastRoll.value] || ''), ` ${v.lastRoll.by === me ? 'Bạn' : nameOf(v.lastRoll.by)} ra ${v.lastRoll.value}`)
    : el('span', { class: 'muted' }, 'Chưa ai gieo');
  const info = el('div', { class: 'info' }, last,
    el('button', { class: 'btn btn-primary', disabled: !myTurn || v.roll !== null || pending, onclick: () => send({ type: 'roll' }) }, 'Gieo 🎲'));

  return [plist, board(v, myTurn && !pending, send), el('div', { class: 'status' + (myTurn ? ' me' : ''), role: 'status' }, statusText), info];
}

runTable({
  gameCode: 'N', minPlayers: 2, maxPlayers: 4,
  engine: { start, apply: (s, id, a) => apply(s, id, a), viewFor, forceSkip },
  renderTable,
  resultOf: () => ({ reason: 'đưa đủ 4 ngựa vào chuồng' }),
});
