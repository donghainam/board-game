// Luật cờ tướng — thuần logic. Bàn = mảng 90 ô, chỉ số r*9+c; hàng 0 phía Đen, hàng 9 phía Đỏ.
// Quân = màu ('r'|'b') + loại (K tướng, A sĩ, B tượng, N mã, R xe, C pháo, P tốt).

import { fail } from '../shared/util.js';

const BACK = ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R'];
const inside = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 9;
const other = (color) => (color === 'r' ? 'b' : 'r');
const inPalace = (color, r, c) => c >= 3 && c <= 5 && (color === 'r' ? r >= 7 : r <= 2);
const ownSide = (color, r) => (color === 'r' ? r >= 5 : r <= 4);

export function initialBoard() {
  const b = Array(90).fill(null);
  BACK.forEach((t, c) => { b[c] = 'b' + t; b[81 + c] = 'r' + t; });
  for (const c of [1, 7]) { b[2 * 9 + c] = 'bC'; b[7 * 9 + c] = 'rC'; }
  for (const c of [0, 2, 4, 6, 8]) { b[3 * 9 + c] = 'bP'; b[6 * 9 + c] = 'rP'; }
  return b;
}

// Nước đi theo hình dạng quân, chưa xét bị chiếu.
function pseudo(b, from) {
  const p = b[from];
  const color = p[0], t = p[1];
  const r = Math.floor(from / 9), c = from % 9;
  const out = [];
  const add = (rr, cc) => {
    if (!inside(rr, cc)) return;
    const q = b[rr * 9 + cc];
    if (!q || q[0] !== color) out.push(rr * 9 + cc);
  };
  const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  if (t === 'K') ORTH.forEach(([dr, dc]) => inPalace(color, r + dr, c + dc) && add(r + dr, c + dc));
  else if (t === 'A') DIAG.forEach(([dr, dc]) => inPalace(color, r + dr, c + dc) && add(r + dr, c + dc));
  else if (t === 'B') {
    DIAG.forEach(([dr, dc]) => {
      const rr = r + 2 * dr, cc = c + 2 * dc;
      if (inside(rr, cc) && ownSide(color, rr) && !b[(r + dr) * 9 + c + dc]) add(rr, cc);
    });
  } else if (t === 'N') {
    ORTH.forEach(([dr, dc]) => {
      if (!inside(r + dr, c + dc) || b[(r + dr) * 9 + c + dc]) return; // cản chân mã
      if (dr) { add(r + 2 * dr, c + 1); add(r + 2 * dr, c - 1); } else { add(r + 1, c + 2 * dc); add(r - 1, c + 2 * dc); }
    });
  } else if (t === 'R' || t === 'C') {
    ORTH.forEach(([dr, dc]) => {
      let rr = r + dr, cc = c + dc, jumped = false;
      while (inside(rr, cc)) {
        const q = b[rr * 9 + cc];
        if (!jumped) {
          if (!q) out.push(rr * 9 + cc);
          else if (t === 'R') { if (q[0] !== color) out.push(rr * 9 + cc); break; } else jumped = true;
        } else if (q) { if (q[0] !== color) out.push(rr * 9 + cc); break; }
        rr += dr; cc += dc;
      }
    });
  } else if (t === 'P') {
    const f = color === 'r' ? -1 : 1;
    add(r + f, c);
    if (!ownSide(color, r)) { add(r, c - 1); add(r, c + 1); }
  }
  return out;
}

const kingAt = (b, color) => b.indexOf(color + 'K');

function kingsFacing(b) {
  const rk = kingAt(b, 'r'), bk = kingAt(b, 'b');
  if (rk < 0 || bk < 0 || rk % 9 !== bk % 9) return false;
  for (let i = bk + 9; i < rk; i += 9) if (b[i]) return false;
  return true;
}

export function inCheck(b, color) {
  const k = kingAt(b, color);
  return b.some((p, i) => p && p[0] !== color && pseudo(b, i).includes(k));
}

const moved = (b, from, to) => { const n = b.slice(); n[to] = n[from]; n[from] = null; return n; };

export function legalMoves(b, color) {
  const out = [];
  b.forEach((p, from) => {
    if (!p || p[0] !== color) return;
    for (const to of pseudo(b, from)) {
      const n = moved(b, from, to);
      if (!kingsFacing(n) && !inCheck(n, color)) out.push({ from, to });
    }
  });
  return out;
}

export function start(ids, { round = 0 } = {}) {
  const [a, b] = ids;
  const [red, black] = round % 2 ? [b, a] : [a, b];
  return { board: initialBoard(), red, black, turn: 'r', last: null, history: [], undoAsk: null, winner: null, endReason: null };
}

const colorOf = (s, id) => (id === s.red ? 'r' : id === s.black ? 'b' : null);
const isSquare = (x) => Number.isInteger(x) && x >= 0 && x < 90;

export function apply(s, id, action) {
  if (s.winner) return fail('Ván đã kết thúc.');
  const color = colorOf(s, id);
  if (!color) return fail('Bạn đang xem, không đi được.');
  const type = action?.type;
  if (type === 'undo-ask') {
    const lastMover = s.history.length ? other(s.turn) : null;
    if (lastMover !== color) return fail('Chỉ người vừa đi mới được xin đi lại.');
    if (s.undoAsk) return fail('Đang chờ đối thủ trả lời.');
    return { ok: true, state: { ...s, undoAsk: id } };
  }
  if (type === 'undo-yes' || type === 'undo-no') {
    if (!s.undoAsk || s.undoAsk === id) return fail('Không có lời xin đi lại nào cho bạn.');
    if (type === 'undo-no') return { ok: true, state: { ...s, undoAsk: null } };
    const prev = s.history[s.history.length - 1];
    return { ok: true, state: { ...s, ...prev, history: s.history.slice(0, -1), undoAsk: null } };
  }
  if (type !== 'move') return fail('Thao tác không hợp lệ.');
  if (s.undoAsk) return fail('Đang chờ trả lời xin đi lại.');
  if (s.turn !== color) return fail('Chưa tới lượt bạn.');
  const { from, to } = action;
  if (!isSquare(from) || !isSquare(to)) return fail('Nước đi không hợp lệ.');
  if (!legalMoves(s.board, color).some((m) => m.from === from && m.to === to)) return fail('Nước đi không hợp lệ.');
  const board = moved(s.board, from, to);
  const next = {
    ...s, board, turn: other(color), last: { from, to },
    history: [...s.history, { board: s.board, turn: s.turn, last: s.last }],
  };
  if (!legalMoves(board, next.turn).length) {
    next.winner = id;
    next.endReason = inCheck(board, next.turn) ? 'chieu-bi' : 'het-nuoc';
  }
  return { ok: true, state: next };
}

export function viewFor(s, id) {
  return {
    board: s.board, red: s.red, black: s.black,
    turn: s.turn === 'r' ? s.red : s.black,
    myColor: colorOf(s, id), last: s.last, check: inCheck(s.board, s.turn),
    undoAsk: s.undoAsk, canUndo: s.history.length > 0,
    winner: s.winner, endReason: s.endReason,
  };
}
