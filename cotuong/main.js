import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { start, apply, viewFor, legalMoves } from './engine.js';

const GLYPH = {
  rK: '帥', rA: '仕', rB: '相', rN: '傌', rR: '俥', rC: '炮', rP: '兵',
  bK: '將', bA: '士', bB: '象', bN: '馬', bR: '車', bC: '砲', bP: '卒',
};
const S = 44, M = 26; // khoảng cách ô, lề
const W = 8 * S + 2 * M, H = 9 * S + 2 * M;

let selected = null;

function boardSvg(v, flip, canMove, send, rerender) {
  const pos = (i) => {
    let r = Math.floor(i / 9), c = i % 9;
    if (flip) { r = 9 - r; c = 8 - c; }
    return [M + c * S, M + r * S];
  };
  const lines = [];
  for (let r = 0; r < 10; r++) lines.push(`<line x1="${M}" y1="${M + r * S}" x2="${M + 8 * S}" y2="${M + r * S}"/>`);
  for (let c = 0; c < 9; c++) {
    if (c === 0 || c === 8) lines.push(`<line x1="${M + c * S}" y1="${M}" x2="${M + c * S}" y2="${M + 9 * S}"/>`);
    else lines.push(`<line x1="${M + c * S}" y1="${M}" x2="${M + c * S}" y2="${M + 4 * S}"/>`,
      `<line x1="${M + c * S}" y1="${M + 5 * S}" x2="${M + c * S}" y2="${M + 9 * S}"/>`);
  }
  for (const r0 of [0, 7]) lines.push(
    `<line x1="${M + 3 * S}" y1="${M + r0 * S}" x2="${M + 5 * S}" y2="${M + (r0 + 2) * S}"/>`,
    `<line x1="${M + 5 * S}" y1="${M + r0 * S}" x2="${M + 3 * S}" y2="${M + (r0 + 2) * S}"/>`);
  const targets = selected === null ? [] : legalMoves(v.board, v.myColor).filter((m) => m.from === selected).map((m) => m.to);
  const marks = [];
  if (v.last) for (const i of [v.last.from, v.last.to]) { const [x, y] = pos(i); marks.push(`<rect class="last" x="${x - S / 2}" y="${y - S / 2}" width="${S}" height="${S}" rx="6"/>`); }
  const pieces = v.board.map((p, i) => {
    if (!GLYPH[p]) return ''; // chỉ vẽ mã quân hợp lệ (dữ liệu từ host)
    const [x, y] = pos(i);
    return `<g class="pc ${p[0]}${i === selected ? ' sel' : ''}"><circle cx="${x}" cy="${y}" r="${S * 0.44}"/><text x="${x}" y="${y}">${GLYPH[p]}</text></g>`;
  });
  const dots = targets.map((i) => { const [x, y] = pos(i); return `<circle class="dot" cx="${x}" cy="${y}" r="7"/>`; });
  const svg = el('div');
  svg.innerHTML = `<svg class="board" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bàn cờ tướng">
    <rect class="bg" x="0" y="0" width="${W}" height="${H}" rx="10"/>${marks.join('')}${lines.join('')}
    <text class="river" x="${M + 2 * S}" y="${M + 4.5 * S}" text-anchor="middle" dominant-baseline="central">楚 河</text>
    <text class="river" x="${M + 6 * S}" y="${M + 4.5 * S}" text-anchor="middle" dominant-baseline="central">漢 界</text>
    ${pieces.join('')}${dots.join('')}</svg>`;
  const node = svg.firstElementChild;
  if (canMove) node.addEventListener('click', (e) => {
    const box = node.getBoundingClientRect();
    let c = Math.round(((e.clientX - box.left) * W / box.width - M) / S);
    let r = Math.round(((e.clientY - box.top) * H / box.height - M) / S);
    if (r < 0 || r > 9 || c < 0 || c > 8) return;
    if (flip) { r = 9 - r; c = 8 - c; }
    const i = r * 9 + c;
    if (selected !== null && targets.includes(i)) { const from = selected; selected = null; send({ type: 'move', from, to: i }); return; }
    selected = v.board[i]?.[0] === v.myColor ? (selected === i ? null : i) : null;
    rerender();
  });
  return node;
}

function renderTable(v, { me, nameOf, send, pending, rerender }) {
  const myTurn = v.turn === me;
  const canMove = myTurn && !v.undoAsk && !pending;
  if (!canMove) selected = null;
  const side = (id, label) => el('span', { class: v.turn === id ? 'on' : '' }, `${label}: ${id === me ? 'Bạn' : nameOf(id)}`);
  const sides = el('div', { class: 'sides' }, side(v.red, '🔴 Đỏ'), side(v.black, '⚫ Đen'));

  let statusText;
  if (!v.myColor) statusText = `Bạn đang xem · Lượt của ${nameOf(v.turn)}`;
  else statusText = myTurn ? 'Tới lượt bạn!' : `Đang chờ ${nameOf(v.turn)}…`;
  const status = el('div', { class: 'status' + (myTurn ? ' me' : ''), role: 'status' }, statusText);

  const actions = el('div', { class: 'actions' });
  if (v.undoAsk) {
    if (v.undoAsk === me) actions.append(el('span', { class: 'muted' }, 'Đang chờ đối thủ đồng ý cho đi lại…'));
    else if (v.myColor) actions.append(el('span', {}, `${nameOf(v.undoAsk)} xin đi lại.`),
      el('button', { class: 'btn btn-primary', disabled: pending, onclick: () => send({ type: 'undo-yes' }) }, 'Đồng ý'),
      el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'undo-no' }) }, 'Từ chối'));
    else actions.append(el('span', { class: 'muted' }, `${nameOf(v.undoAsk)} đang xin đi lại.`));
  } else if (v.myColor && !myTurn && v.canUndo) {
    actions.append(el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'undo-ask' }) }, 'Xin đi lại'));
  }

  return [sides, v.check ? el('div', { class: 'check', role: 'alert' }, 'Chiếu!') : null,
    boardSvg(v, v.myColor === 'b', canMove, send, rerender), status, actions];
}

runTable({
  gameCode: 'X', minPlayers: 2, maxPlayers: 2, maxSeats: 10,
  pickPlayers: (ids) => ids.slice(0, 2),
  engine: { start, apply, viewFor },
  renderTable,
  resultOf: (v) => ({ reason: v.endReason === 'chieu-bi' ? 'chiếu bí' : 'đối thủ hết nước đi' }),
});
