import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { BOARD, RENT, BEACH_RENT, JAIL_FINE, start, apply, viewFor, forceSkip, nextTimer, onTimer, rentOf, buildCost, squareValue } from './engine.js';

const ICON = { tax: '💸' };
// Hình đứng trên ô (Xuất phát có biển hiệu riêng).
const STAND_ART = { jail: '🌴', festival: '🎪', travel: '✈️', beach: '⛱️' };
const TIER = ['', '🏠', '🏡', '🏘️', '🏢', '🏨']; // mỗi cấp một kiểu nhà, to dần
const fmt = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(2)}M$` : `${+(n / 1000).toFixed(1)}K$`);
const money = (n) => `${n.toLocaleString('vi-VN')}$`;
const shortName = (b) => b.name.replace('Biển ', '').replace('TP. Hồ Chí Minh', 'TP.HCM');
const LEVEL_NAME = ['', '1 nhà', '2 nhà', '3 nhà', '4 nhà', 'Khách sạn'];
const PIPS = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const ROLL_MS = 800, SPIN_MS = 1200;

// Vị trí ô trên lưới 9×9: 0 ở góc dưới phải; bàn xoay 45° nên ô 0 nằm dưới cùng, Đảo hoang bên trái, Sân bay bên phải.
function cellOf(i) {
  if (i <= 8) return [8, 8 - i];
  if (i <= 16) return [16 - i, 0];
  if (i <= 24) return [0, i - 16];
  return [i - 24, 8];
}

const die = (n, rolling, delay) => el('div', { class: 'die' + (rolling ? ' rolling' : ''), style: rolling ? `animation-delay:${delay}ms` : null, 'aria-label': `Xúc xắc ${n}` },
  [...Array(9).keys()].map((k) => el('i', { class: PIPS[n].includes(k) ? 'pip' : '' })));

let selected = null, logOpen = false;
let hostNow = () => Date.now();
// Hiệu ứng: xúc xắc lăn khi có lần gieo mới, sau đó vòng quay Cơ hội nếu có lá mới. Vẽ lại giữa chừng thì chạy tiếp (delay âm).
let seenRolls = null, rollAt = 0, seenEvent = null, spinAt = 0;
setInterval(() => {
  const e = document.getElementById('clock');
  if (e) {
    const left = Math.max(0, Number(e.dataset.end) - hostNow());
    e.textContent = `⏱ ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
  }
  // Đang lăn: đổi mặt ngẫu nhiên cho có cảm giác xúc xắc quay.
  document.querySelectorAll('.die.rolling').forEach((d) => d.replaceChildren(...die(1 + Math.floor(Math.random() * 6)).children));
}, 90);

function renderTable(v, api) {
  const { me, nameOf, send, pending, rerender } = api;
  hostNow = api.hostNow;
  const who = (id) => (id === me ? 'Bạn' : nameOf(id));
  const color = (id) => `var(--p${v.players.findIndex((p) => p.id === id)})`;
  const myTurn = v.turn === me;
  const meP = v.players.find((p) => p.id === me);
  const can = myTurn && !pending;

  const now = Date.now();
  if (seenRolls !== null && v.rolls !== seenRolls && v.dice) { rollAt = now; setTimeout(rerender, ROLL_MS); }
  seenRolls = v.rolls;
  const evN = v.lastEvent?.n ?? 0;
  if (seenEvent !== null && evN !== seenEvent) { spinAt = Math.max(now, rollAt + ROLL_MS); setTimeout(rerender, spinAt + SPIN_MS - now); }
  seenEvent = evN;
  const rolling = now < rollAt + ROLL_MS;
  const spinning = !rolling && now < spinAt + SPIN_MS;

  // ----- Bàn cờ nghiêng: lớp ô phẳng (bấm được) + lớp nhà/quân/cờ đứng (chỉ để nhìn) -----
  const tiles = [], standing = [];
  BOARD.forEach((b, i) => {
    const [r, c] = cellOf(i);
    const at = `grid-row:${r + 1};grid-column:${c + 1}`;
    const o = v.own[i];
    const corner = i % 8 === 0;
    const side = 1 + Math.floor(i / 8); // 1..4; cạnh 2 và 4 xoay chữ dọc theo cạnh bàn
    const hot = v.hot?.includes(i);
    tiles.push(el('button', {
      class: `sq ${corner ? `corner k-${b.t}` : `s${side}`}${b.t === 'beach' ? ' beach' : ''}${o?.mort ? ' mort' : ''}${hot ? ' hot' : ''}${selected === i ? ' sel' : ''}`,
      style: at + (o ? `;--own:${color(o.owner)}` : ''), 'aria-label': b.name + (hot ? ', tiền thuê ×1.5' : '') + (o ? `, chủ ${who(o.owner)}` : ''),
      onclick: () => { selected = selected === i ? null : i; rerender(); },
    },
    b.t === 'land' ? el('span', { class: `bar g${b.g}` }) : null,
    el('span', { class: 'in' },
      b.t === 'event' ? el('span', { class: 'wheel' }) : ICON[b.t] ? el('span', { class: 'ic' }, ICON[b.t]) : null,
      b.t === 'start' ? null : el('span', { class: 'nm' }, shortName(b)),
      o && !o.mort ? el('span', { class: 'rent' }, fmt(rentOf(v, i))) : null)));
    const toks = v.players.filter((p) => !p.out && p.pos === i);
    const bld = o?.level ? TIER[o.level] : '';
    const art = STAND_ART[b.t];
    if (bld || toks.length || v.festival === i || hot || art || b.t === 'start') {
      standing.push(el('div', { class: 'stand', style: at, 'aria-hidden': 'true' }, el('div', { class: 'up' },
        b.t === 'start' ? el('span', { class: 'sign' }, '🏁 XUẤT PHÁT 🏁') : null,
        art ? el('span', { class: 'art' + (b.t === 'beach' ? ' small' : '') }, art) : null,
        hot ? el('span', { class: 'banners' }, el('i'), el('i')) : null,
        v.festival === i ? el('span', { class: 'flag' }, '🎉') : null,
        bld ? el('span', { class: `bld lv${o.level}` }, bld) : null,
        toks.length ? el('span', { class: 'toks' }, toks.map((p) => el('span', { class: 'pawn' + (p.id === v.turn ? ' now' : ''), style: `--c:${color(p.id)}` }))) : null)));
    }
  });
  const board = el('div', { class: 'board3d' }, tiles, el('div', { class: 'field' }), standing);

  // ----- Thẻ người chơi ở 4 góc -----
  const cards = v.players.map((p, k) => el('div', { class: `pcard c${k}${p.id === v.turn ? ' turn' : ''}${p.out ? ' out' : ''}`, style: `--c:${color(p.id)}` },
    el('span', { class: 'ava' }, (nameOf(p.id) || '?').trim().charAt(0).toUpperCase()),
    el('span', { class: 'pinfo' }, el('b', {}, who(p.id), p.jail ? ' 🏝️' : '', p.fly ? ' ✈️' : '', p.jailCard ? ' 🛟' : ''), el('span', {}, money(p.cash)))));

  // ----- Nhật ký: nút giữa cạnh trên, bấm xổ xuống (giống Loạn Đả) -----
  const lines = v.log.map((t) => v.players.reduce((x, p) => x.split(p.id).join(who(p.id)), t));
  const logBox = el('div', { class: 'logbox' + (logOpen ? ' open' : '') },
    el('button', { class: 'log-btn', 'aria-expanded': String(logOpen), onclick: () => { logOpen = !logOpen; rerender(); } }, `📜 Nhật ký ${logOpen ? '▴' : '▾'}`),
    logOpen ? el('ul', {}, lines.length ? lines.map((t) => el('li', {}, t)) : el('li', { class: 'muted' }, 'Chưa có gì.')) : null);

  const center = el('div', { class: 'center' },
    spinning
      ? el('div', { class: 'spinner', 'aria-label': 'Đang quay Cơ hội' }, el('span', { class: 'wheel big', style: `animation-delay:${spinAt - now}ms` }), el('span', { class: 'pointer' }))
      : el('div', { class: 'dice' }, v.dice ? v.dice.map((d) => die(d, rolling, rollAt - now)) : [die(6), die(6)]),
    v.dice && !rolling && !spinning ? el('span', { class: 'who-rolled' }, `${who(v.diceBy)} gieo ${v.dice[0]}-${v.dice[1]}`) : null,
    el('b', { class: 'whose' }, myTurn ? 'Lượt của bạn' : `Lượt của ${nameOf(v.turn)}`),
    v.lastEvent && !rolling && !spinning ? el('div', { class: 'bubble' }, `🎡 ${who(v.lastEvent.by)}: ${v.lastEvent.text}`) : null);
  const stage = el('div', { class: 'stage' }, board, cards, logBox, center);

  // ----- Hành động -----
  const actions = el('div', { class: 'actions' });
  const btn = (label, action, primary = false) => el('button', { class: 'btn' + (primary ? ' btn-primary' : ''), disabled: !can, onclick: () => send(action) }, label);
  let status = myTurn ? '' : `Đang chờ ${nameOf(v.turn)}…`;
  if (myTurn) {
    if (v.phase === 'roll') {
      status = meP.jail ? `Bạn đang ở Đảo hoang (lượt ${meP.jail}/3). Gieo ra đôi để rời đảo.` : 'Gieo xúc xắc!';
      actions.append(btn('Gieo 🎲', { type: 'roll' }, true));
      if (meP.jail) actions.append(btn(`Thuê thuyền ${fmt(JAIL_FINE)}`, { type: 'pay-jail' }), meP.jailCard ? btn('Dùng thẻ cứu hộ', { type: 'use-card' }) : '');
    } else if (v.phase === 'festival') {
      status = '🎉 Chọn 1 ô đất của bạn để tổ chức Lễ hội (tiền thuê ×2). Chạm ô rồi bấm chọn.';
      const ok = selected !== null && v.own[selected]?.owner === me && !v.own[selected].mort;
      actions.append(el('button', { class: 'btn btn-primary', disabled: !can || !ok, onclick: () => send({ type: 'festival', pos: selected }) }, ok ? `Tổ chức ở ${BOARD[selected].name}` : 'Chạm 1 ô đất của bạn'),
        btn('Bỏ qua', { type: 'festival', pos: null }));
    } else if (v.phase === 'fly') {
      status = '✈️ Chạm 1 ô bất kỳ trên bàn cờ rồi bấm Bay.';
      const ok = selected !== null && selected !== meP.pos;
      actions.append(el('button', { class: 'btn btn-primary', disabled: !can || !ok, onclick: () => send({ type: 'fly', pos: selected }) }, ok ? `✈️ Bay tới ${BOARD[selected].name}` : 'Chạm 1 ô để chọn'));
    } else if (v.phase === 'upgrade') {
      status = '⬆️ Thẻ nâng cấp: chạm 1 ô đất của bạn rồi bấm Nâng cấp.';
      const o = selected !== null ? v.own[selected] : null;
      const ok = o?.owner === me && BOARD[selected].t === 'land' && !o.mort && o.level < (meP.laps ? 5 : 3);
      actions.append(el('button', { class: 'btn btn-primary', disabled: !can || !ok, onclick: () => send({ type: 'upgrade', pos: selected }) }, ok ? `⬆️ Nâng ${BOARD[selected].name} lên ${LEVEL_NAME[o.level + 1]}` : 'Chạm 1 ô đất của bạn'));
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
        for (let n = 1; lv + n <= v.offer.max; n++) {
          cost += buildCost(pos, lv + n);
          const label = lv + n === 5 ? `🏨 Khách sạn (${fmt(cost)})` : `🏠 Lên ${lv + n} nhà (${fmt(cost)})`;
          actions.append(el('button', { class: 'btn', disabled: !can || meP.cash < cost, onclick: () => send({ type: 'build', levels: n }) }, label));
        }
        if (v.offer.max === 3) actions.append(el('p', { class: 'muted', style: 'width:100%;text-align:center;margin:0' }, 'Vòng đầu chỉ được xây tối đa 3 nhà.'));
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
    if (b.t === 'land') rows.push(el('div', { class: 'muted' }, `Thuê: ${RENT.map((k) => fmt(b.price * k)).join(' / ')} (đất / 1–4 nhà / Khách sạn)`));
    if (b.t === 'beach') rows.push(el('div', { class: 'muted' }, `Thuê theo số bãi biển cùng chủ: ${BEACH_RENT.slice(1).map(fmt).join(' / ')}`));
    if (v.hot?.includes(selected)) rows.push(el('div', {}, '🎏 Ô tăng giá ván này: tiền thuê ×1.5'));
    if (o) {
      rows.push(el('div', {}, `Chủ: ${who(o.owner)}${o.mort ? ' · đang thế chấp' : ''}${o.level ? ` · ${LEVEL_NAME[o.level]}` : ''}`),
        o.mort ? null : el('div', {}, `Tiền thuê hiện tại: ${fmt(rentOf(v, selected))}`));
      if (o.owner === me && myTurn && !['festival', 'fly', 'upgrade'].includes(v.phase)) {
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
    stage, el('div', { class: 'status' + (myTurn ? ' me' : ''), role: 'status' }, status), actions, detail,
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
  gameCode: 'P', minPlayers: 2, maxPlayers: 4,
  setup: { initial: { minutes: 45 }, render: setupPanel },
  engine: { start, apply: (s, id, a) => apply(s, id, a), viewFor, forceSkip: (s) => forceSkip(s), nextTimer, onTimer },
  renderTable,
  resultOf: (v) => ({ reason: REASON[v.winReason] || '' }),
});
