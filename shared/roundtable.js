// Bố cục bàn tròn dùng chung cho các game bài: người chơi ngồi quanh bàn (mình ở dưới cùng),
// giữa bàn là chồng bài / lá vừa đánh; 2 bảng thông tin hai bên (điện thoại: thu gọn thành nút).
import { el } from './lobby.js';

let openSide = null; // bảng bên nào đang mở trên điện thoại (giữ qua các lần vẽ lại)

// Vị trí ghế theo % khung bàn: người thứ i tính từ mình theo chiều ngồi.
export function seatPos(i, n) {
  const a = Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [50 + 41 * Math.cos(a), 50 + 41 * Math.sin(a)];
}

// order: id theo thứ tự ghế; seat(id) → nội dung ghế; seatAttrs(id) → {cls, onclick, disabled, label}
// arrow: {from, to} vẽ mũi tên giữa 2 ghế (vd ai bắn ai).
export function roundTable({ order, me, seat, seatAttrs = () => ({}), center = [], arrow = null }) {
  const k = Math.max(0, order.indexOf(me));
  const ring = [...order.slice(k), ...order.slice(0, k)];
  const pos = Object.fromEntries(ring.map((id, i) => [id, seatPos(i, ring.length)]));
  const stage = el('div', { class: 'rt-stage' }, el('div', { class: 'rt-felt' }));
  if (arrow && pos[arrow.from] && pos[arrow.to] && arrow.from !== arrow.to) {
    const [a, b] = [pos[arrow.from], pos[arrow.to]];
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'rt-arrow');
    // Dừng mũi tên trước tâm ghế đích một đoạn để không đè lên avatar
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const ex = b[0] - (dx / len) * 9, ey = b[1] - (dy / len) * 9;
    const sx = a[0] + (dx / len) * 8, sy = a[1] + (dy / len) * 8;
    const ang = Math.atan2(ey - sy, ex - sx);
    const head = [[ex, ey], [ex - 4 * Math.cos(ang - 0.45), ey - 4 * Math.sin(ang - 0.45)], [ex - 4 * Math.cos(ang + 0.45), ey - 4 * Math.sin(ang + 0.45)]];
    const line = document.createElementNS(ns, 'line');
    Object.entries({ x1: sx, y1: sy, x2: ex, y2: ey, class: 'rt-arrow-line' }).forEach(([key, val]) => line.setAttribute(key, val));
    const tip = document.createElementNS(ns, 'polygon');
    tip.setAttribute('points', head.map((p) => p.join(',')).join(' '));
    tip.setAttribute('class', 'rt-arrow-tip');
    svg.append(line, tip);
    stage.append(svg);
  }
  stage.append(el('div', { class: 'rt-center' }, center));
  ring.forEach((id) => {
    const [x, y] = pos[id];
    const at = seatAttrs(id);
    stage.append(el(at.onclick ? 'button' : 'div', {
      class: 'rt-seat' + (at.cls ? ' ' + at.cls : ''), style: `left:${x}%;top:${y}%`,
      onclick: at.onclick, disabled: at.disabled, 'aria-label': at.label,
    }, seat(id)));
  });
  return stage;
}

// Khung trang: [bảng trái] [nội dung] [bảng phải]. left/right: {icon, title, body: Node[]} hoặc null.
export function sideLayout({ left = null, right = null, main }) {
  const close = () => { openSide = null; wrap.querySelectorAll('.rt-side').forEach((x) => x.classList.remove('open')); scrim.classList.remove('on'); };
  const open = (which) => { openSide = which; wrap.querySelector('.rt-side.' + which)?.classList.add('open'); scrim.classList.add('on'); };
  const panel = (which, p) => p && el('aside', { class: `rt-side ${which}${openSide === which ? ' open' : ''}` },
    el('div', { class: 'rt-side-head' }, el('h3', {}, `${p.icon} ${p.title}`), el('button', { class: 'btn btn-small rt-close', onclick: close, 'aria-label': 'Đóng' }, '✕')),
    p.body);
  const scrim = el('div', { class: 'rt-scrim' + (openSide ? ' on' : ''), onclick: close });
  const toggles = el('div', { class: 'rt-toggles' },
    left ? el('button', { class: 'btn btn-small', onclick: () => open('left') }, `${left.icon} ${left.title}`) : el('span'),
    right ? el('button', { class: 'btn btn-small', onclick: () => open('right') }, `${right.icon} ${right.title}`) : el('span'));
  const wrap = el('div', { class: 'rt-layout' + (left ? ' has-left' : '') + (right ? ' has-right' : '') },
    panel('left', left), el('div', { class: 'rt-main stack' }, toggles, ...main), panel('right', right), scrim);
  return wrap;
}
