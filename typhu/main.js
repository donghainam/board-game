import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { BOARD, start, apply, viewFor, forceSkip, nextTimer, onTimer, rentOf, buildCost, squareValue } from './engine.js';

const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const CORNER_ICON = { start: '🏁', jail: '🚔', festival: '🎉', gojail: '👮' };
const ICON = { air: '✈️', util: '💡', event: '❓', tax: '💸' };
const fmt = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(2)}tr` : `${Math.round(n / 1000)}k`);
const shortName = (b) => b.name.replace('Sân bay ', '').replace('TP. Hồ Chí Minh', 'TP.HCM').replace('Thuế thu nhập', 'Thuế').replace('Thuế xa xỉ', 'Thuế');

// Vị trí ô trên lưới 11×11: 0 ở góc dưới phải, đi ngược chiều kim đồng hồ.
function cellOf(i) {
  if (i <= 10) return [10, 10 - i];
  if (i <= 20) return [20 - i, 0];
  if (i <= 30) return [0, i - 20];
  return [i - 30, 10];
}

let selected = null;
let hostNow = () => Date.now();
setInterval(() => {
  const e = document.getElementById('clock');
  if (!e) return;
  const left = Math.max(0, Number(e.dataset.end) - hostNow());
  e.textContent = `⏱ ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
}, 500);

function renderTable(v, api) {
  const { me, nameOf, send, pending, rerender } = api;
  hostNow = api.hostNow;
  const who = (id) => (id === me ? 'Bạn' : nameOf(id));
  const color = (id) => `var(--p${v.players.findIndex((p) => p.id === id)})`;
  const myTurn = v.turn === me;
  const meP = v.players.find((p) => p.id === me);
  const can = myTurn && !pending;

  // ----- Bàn cờ -----
  const cells = BOARD.map((b, i) => {
    const [r, c] = cellOf(i);
    const o = v.own[i];
    const corner = i % 10 === 0;
    const toks = v.players.filter((p) => !p.out && p.pos === i);
    return el('button', {
      class: `sq${corner ? ' corner' : ''}${o?.mort ? ' mort' : ''}${selected === i ? ' sel' : ''}`,
      style: `grid-row:${r + 1};grid-column:${c + 1}`, 'aria-label': b.name,
      onclick: () => { selected = selected === i ? null : i; rerender(); },
    },
    b.t === 'land' ? el('span', { class: `bar g${b.g}` }) : null,
    el('span', { class: 'nm' }, corner ? CORNER_ICON[b.t] : (ICON[b.t] || ''), corner ? '' : ' ', shortName(b)),
    o?.level ? el('span', { class: 'lv' }, o.level === 4 ? '⭐' : '🏠'.repeat(o.level)) : null,
    v.festival === i ? el('span', { class: 'lv' }, '🎉') : null,
    o ? el('span', { class: 'own', style: `background:${color(o.owner)}` }) : null,
    toks.length ? el('span', { class: 'toks' }, toks.map((p) => el('span', { class: 'tok', style: `background:${color(p.id)}` }))) : null);
  });
  const mid = el('div', { class: 'mid' },
    v.dice ? el('div', { class: 'dice' }, DIE[v.dice[0]], ' ', DIE[v.dice[1]]) : el('div', {}, '🎲'),
    el('b', {}, myTurn ? 'Lượt của bạn' : `Lượt của ${nameOf(v.turn)}`),
    v.lastEvent ? el('div', {}, `❓ ${who(v.lastEvent.by)}: ${v.lastEvent.text}`) : null);
  const board = el('div', { class: 'tboard' }, cells, mid);

  // ----- Tiền -----
  const money = el('div', { class: 'money' }, v.players.map((p) => el('div', {
    class: (p.id === v.turn ? 'turn' : '') + (p.out ? ' out' : ''), style: `background:${color(p.id)}`,
  }, `${who(p.id)}: ${fmt(p.cash)}`, p.jail ? ' 🚔' : '', p.jailCard ? ' 🎫' : '')));

  // ----- Hành động -----
  const actions = el('div', { class: 'actions' });
  const btn = (label, action, primary = false) => el('button', { class: 'btn' + (primary ? ' btn-primary' : ''), disabled: !can, onclick: () => send(action) }, label);
  let status = myTurn ? '' : `Đang chờ ${nameOf(v.turn)}…`;
  if (myTurn) {
    if (v.phase === 'roll') {
      status = meP.jail ? `Bạn đang ở tù (lượt ${meP.jail}/3). Gieo ra đôi để ra tù.` : 'Gieo xúc xắc!';
      actions.append(btn('Gieo 🎲', { type: 'roll' }, true));
      if (meP.jail) actions.append(btn('Nộp phạt 500k', { type: 'pay-jail' }), meP.jailCard ? btn('Dùng thẻ tại ngoại', { type: 'use-card' }) : '');
    } else if (v.phase === 'festival') {
      status = '🎉 Chọn 1 ô đất của bạn để tổ chức Lễ hội (tiền thuê ×2). Chạm ô rồi bấm chọn.';
      const ok = selected !== null && v.own[selected]?.owner === me && !v.own[selected].mort;
      actions.append(el('button', { class: 'btn btn-primary', disabled: !can || !ok, onclick: () => send({ type: 'festival', pos: selected }) }, ok ? `Tổ chức ở ${BOARD[selected].name}` : 'Chạm 1 ô đất của bạn'),
        btn('Bỏ qua', { type: 'festival', pos: null }));
    } else if (v.phase === 'debt') {
      status = `⚠️ Bạn đang nợ ${fmt(v.debt.amount)} (đang có ${fmt(meP.cash)}). Bán nhà hoặc thế chấp để trả, hết cách mới phá sản.`;
      // Danh sách ô của mình ngay tại chỗ: bàn cờ trên điện thoại quá nhỏ để dò từng ô.
      Object.entries(v.own).filter(([, o]) => o.owner === me).forEach(([pos, o]) => {
        pos = Number(pos);
        const name = shortName(BOARD[pos]);
        if (o.level) actions.append(btn(`Bán 1 cấp ${name} (+${fmt(buildCost(pos, o.level) / 2)})`, { type: 'sell', pos }));
        else if (!o.mort) actions.append(btn(`Thế chấp ${name} (+${fmt(BOARD[pos].price / 2)})`, { type: 'mortgage', pos }));
      });
      actions.append(el('button', { class: 'btn', disabled: !can, onclick: () => confirm('Phá sản? Bạn sẽ bị loại khỏi ván.') && send({ type: 'bankrupt' }) }, '💀 Phá sản'));
    } else if (v.phase === 'act') {
      const here = BOARD[meP.pos];
      status = `Bạn đang ở ${here.name}.`;
      if (v.offer.buy !== undefined) actions.append(btn(`Mua ${shortName(BOARD[v.offer.buy])} (${fmt(BOARD[v.offer.buy].price)})`, { type: 'buy' }, true));
      if (v.offer.rebuy !== undefined) {
        const price = 2 * squareValue(v, v.offer.rebuy);
        actions.append(el('button', { class: 'btn', disabled: !can || meP.cash < price, onclick: () => send({ type: 'rebuy' }) }, `Mua lại (${fmt(price)})`));
      }
      if (v.offer.build !== undefined) {
        const pos = v.offer.build;
        const lv = v.own[pos].level;
        let cost = 0;
        for (let n = 1; lv + n <= 4; n++) {
          cost += buildCost(pos, lv + n);
          const label = lv + n === 4 ? `⭐ Công trình (${fmt(cost)})` : `🏠 Lên ${lv + n} nhà (${fmt(cost)})`;
          actions.append(el('button', { class: 'btn', disabled: !can || meP.cash < cost, onclick: () => send({ type: 'build', levels: n }) }, label));
        }
      }
      actions.append(btn(v.doubles ? 'Gieo tiếp (đổ đôi) ➜' : 'Kết thúc lượt ➜', { type: 'end' }));
    }
  }

  // ----- Chi tiết ô đang chọn -----
  let detail = null;
  if (selected !== null) {
    const b = BOARD[selected];
    const o = v.own[selected];
    const rows = [el('h3', {}, b.name)];
    if (b.price) rows.push(el('div', {}, `Giá: ${fmt(b.price)}`));
    if (b.t === 'land') rows.push(el('div', { class: 'muted' }, `Thuê: ${[0.1, 0.5, 1.5, 3, 5].map((k) => fmt(b.price * k)).join(' / ')} (đất / 1–3 nhà / Công trình)`));
    if (o) {
      rows.push(el('div', {}, `Chủ: ${who(o.owner)}${o.mort ? ' · đang thế chấp' : ''}${o.level ? ` · ${o.level === 4 ? 'Công trình' : o.level + ' nhà'}` : ''}`),
        o.mort ? null : el('div', {}, `Tiền thuê hiện tại: ${fmt(rentOf(v, selected, 7))}${b.t === 'util' ? ' (nếu gieo 7)' : ''}`));
      if (o.owner === me && myTurn && v.phase !== 'festival') {
        const row = el('div', { class: 'actions' });
        if (o.level) row.append(btn(`Bán 1 cấp (+${fmt(buildCost(selected, o.level) / 2)})`, { type: 'sell', pos: selected }));
        else if (!o.mort) row.append(btn(`Thế chấp (+${fmt(b.price / 2)})`, { type: 'mortgage', pos: selected }));
        else if (v.phase !== 'debt') row.append(btn(`Chuộc (−${fmt(Math.round(b.price * 0.55))})`, { type: 'unmortgage', pos: selected }));
        rows.push(row);
      }
    } else if (b.price) rows.push(el('div', { class: 'muted' }, 'Chưa có chủ'));
    detail = el('div', { class: 'card-tile stack detail', style: 'gap:4px' }, rows);
  }

  return [
    v.endsAt ? el('div', { class: 'clock', id: 'clock', 'data-end': v.endsAt }, '⏱') : null,
    money, board, el('div', { class: 'status' + (myTurn ? ' me' : ''), role: 'status' }, status), actions, detail,
    v.log.length ? el('details', {}, el('summary', { class: 'muted' }, 'Nhật ký'), el('ul', {}, v.log.map((t) => el('li', {}, t.replace(/^[^:\s]+/, (id) => (v.players.some((p) => p.id === id) ? who(id) : id)))))) : null,
  ];
}

function setupPanel(config, set) {
  const m = config?.minutes ?? 45;
  return el('div', { class: 'card-tile stack' }, el('h3', {}, 'Giới hạn thời gian (chủ bàn)'),
    el('select', { class: 'input', onchange: (e) => set({ minutes: Number(e.target.value) }) },
      [[30, '30 phút'], [45, '45 phút'], [60, '60 phút'], [0, 'Không giới hạn']].map(([v, t]) => el('option', { value: v, selected: m === v }, t))));
}

const REASON = { 'doc-quyen': 'độc quyền', 'pha-san': 'các người chơi khác đã phá sản', 'het-gio': 'hết giờ – tổng tài sản cao nhất' };

runTable({
  gameCode: 'P', minPlayers: 2, maxPlayers: 6,
  setup: { initial: { minutes: 45 }, render: setupPanel },
  engine: { start, apply: (s, id, a) => apply(s, id, a), viewFor, forceSkip: (s) => forceSkip(s), nextTimer, onTimer },
  renderTable,
  resultOf: (v) => ({ reason: REASON[v.winReason] || '' }),
});
