import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { validate, start, apply, viewFor, forceSkip, nextTimer, onTimer, CHARS, ONESHOT } from './engine.js';
import { botAction } from './bot.js';
import { art, CARD, EQUIP } from './art.js';
import { roundTable, sideLayout } from '../shared/roundtable.js';

const ROLE = { cst: ['⭐', 'Cảnh sát trưởng'], pho: ['🎖️', 'Phó cảnh sát'], cuop: ['🦹', 'Băng cướp'], phanboi: ['🐍', 'Kẻ phản bội'] };
const GOAL = {
  cst: 'Diệt hết Băng cướp và Kẻ phản bội.', pho: 'Bảo vệ Cảnh sát trưởng, diệt Băng cướp và Kẻ phản bội.',
  cuop: 'Hạ gục Cảnh sát trưởng.', phanboi: 'Là người cuối cùng còn sống.',
};
const SUIT = ['♥', '♦', '♣', '♠'];
const TARGETED = ['ban', 'cuop', 'pha', 'duel', 'tu', 'dam', 'ruoumanh', 'sunggiau', 'dao', 'xetho'];
const PICK_CARD = ['cuop', 'pha', 'xetho']; // chọn người rồi chọn lá của họ

let sel = null;       // id lá đang chọn (trên tay, hoặc trang bị dùng 1 lần)
let extra = null;     // lá bỏ kèm cho Rượu mạnh / Ẩu đả
let target = null;    // người đang chọn cho Cướp/Phá
let showRole = false;
let roleMin = false;   // ô vai trên bàn đang thu gọn
let logOpen = false;   // nhật ký đang xổ xuống
let picks = new Set(); // lá chọn để bỏ khi thừa bài
let healMode = false;  // Ông lang vườn đang chọn 2 lá để hồi máu
const charName = (c) => CHARS[c]?.name || '';
let lastRound = null; // đổi ván thì che thẻ vai lại

// Chạm giữ lá bài ~0,45 giây: hiện khung nghĩa lá ở đáy màn hình; nhả tay thì ẩn, và cú bấm đó không tính.
let tip = null;
const hideTip = () => { tip?.remove(); tip = null; };
function holdToExplain(t) {
  let timer = null, shown = false;
  const stop = () => { clearTimeout(timer); if (shown) setTimeout(hideTip, 900); };
  return {
    shown: () => shown,
    onpointerdown: () => {
      shown = false;
      timer = setTimeout(() => {
        shown = true; hideTip();
        tip = el('div', { class: 'ac-tip', role: 'status' }, art(t), el('div', {}, el('b', {}, CARD[t]?.[0] || '?'), el('small', {}, CARD[t]?.[1] || '')));
        document.body.append(tip);
      }, 450);
    },
    onpointerup: stop, onpointerleave: stop, onpointercancel: stop,
    oncontextmenu: (e) => e.preventDefault(),
  };
}

// Lá bài có minh hoạ: c = {t, s}; attrs: {sel, disabled, onclick, style, big}
const acard = (c, attrs = {}) => {
  const { shown, ...hold } = holdToExplain(c.t);
  const live = attrs.onclick && !attrs.disabled; // lá bị khoá dùng div (nút disabled không nhận chạm giữ)
  return el(live ? 'button' : 'div', {
    class: 'ac' + (EQUIP.has(c.t) ? ' eq' : '') + (attrs.big ? ' big' : '') + (attrs.sel ? ' sel' : ''), style: attrs.style,
    onclick: live ? (e) => { if (!shown()) attrs.onclick(e); } : undefined, ...hold,
    title: CARD[c.t]?.[1], 'aria-label': CARD[c.t]?.[0],
  }, el('span', { class: 'su' + (c.s <= 1 ? ' r' : '') }, SUIT[c.s] ?? ''), art(c.t), el('span', { class: 't' }, CARD[c.t]?.[0] || '?'));
};
let wasMine = false; // để rung máy đúng lúc vừa tới lượt mình

function renderTable(v, { me, nameOf, online, send, pending, rerender }) {
  const who = (id) => (id === me ? 'Bạn' : nameOf(id));
  // shortcut: nhận biết ván mới qua vai của mình + ghế Cảnh sát trưởng (ngẫu nhiên mỗi ván); trùng cả hai thì thẻ vai giữ nguyên trạng thái
  const round = v.me.role + v.players.findIndex((p) => p.role === 'cst');
  if (round !== lastRound) { lastRound = round; showRole = false; }
  const actor = v.turn === me;
  const myTurn = v.turnPlayer === me && v.phase !== 'react' && v.phase !== 'store';
  const hand = v.me.hand;
  const myEq = v.players.find((p) => p.id === me)?.eq || [];
  const card = hand.find((c) => c.id === sel) || myEq.find((c) => c.id === sel && ONESHOT.includes(c.t));
  const kind = card && !hand.includes(card) ? 'use' : 'play'; // trang bị 1 lần thì gửi 'use'
  if (!card) { sel = null; target = null; }
  const needsExtra = !!card && (card.t === 'ruoumanh' || card.t === 'audai');
  if (!needsExtra || !hand.some((c) => c.id === extra)) extra = null;
  if (v.phase !== 'discard' && !healMode) picks.clear();
  const asType = (c) => (c.t === 'ne' && v.me.char === 'haisung' ? 'ban' : c.t); // Cô nàng hai súng: Né dùng như Bắn
  const P = Object.fromEntries(v.players.map((p) => [p.id, p]));
  const r = v.me.role;

  // Thẻ vai (che mặc định, trừ Cảnh sát trưởng vốn công khai)
  const roleCard = el('div', { class: 'card-tile rolebar' },
    showRole || r === 'cst'
      ? [el('b', {}, `${ROLE[r][0]} ${ROLE[r][1]}`), el('small', { class: 'muted' }, GOAL[r])]
      : el('div', { class: 'muted' }, 'Vai của bạn đang được che.'),
    r === 'cst' ? null : el('button', { class: 'btn btn-small', onclick: () => { showRole = !showRole; rerender(); } }, showRole ? '🙈 Che vai' : '👁 Xem vai'),
    v.me.char ? el('small', {}, `🎭 ${charName(v.me.char)} – ${CHARS[v.me.char]?.text || ''}`) : null);

  // Hai bảng bên: ý nghĩa lá bài / nhân vật trong ván
  const left = { icon: '📖', title: 'Lá bài', body: Object.entries(CARD).map(([t, [n, d]]) => el('div', { class: 'gl' }, art(t), el('div', {}, el('b', {}, n), el('small', {}, d)))) };
  const right = {
    icon: '🎭', title: 'Nhân vật',
    body: v.phase === 'pick'
      ? [el('p', { class: 'muted' }, 'Chức năng của mọi người sẽ hiện khi cả bàn chọn xong.')]
      : v.players.map((p) => el('div', { class: 'chr' }, el('b', {}, `${who(p.id)}: ${charName(p.char)}`), el('small', {}, CHARS[p.char]?.text || ''))),
  };

  if (v.phase === 'pick') {
    const main = [roleCard];
    if (v.me.offer) {
      main.push(el('h3', {}, '🎭 Chọn 1 trong 2 chức năng (công khai khi cả bàn chọn xong):'),
        ...v.me.offer.map((c) => el('div', { class: 'card-tile stack', style: 'gap:6px' },
          el('b', {}, `${CHARS[c].name} · ${'❤️'.repeat(CHARS[c].hp)}`), el('div', {}, CHARS[c].text),
          el('button', { class: 'btn btn-primary', disabled: pending, onclick: () => send({ type: 'pick', char: c }) }, 'Chọn chức năng này'))));
    } else main.push(el('div', { class: 'status' }, `✓ Bạn đã chọn ${charName(v.me.char)}. Đang chờ: ${v.waitingOn.map(who).join(', ')}`));
    return [sideLayout({ left, right, main })];
  }

  // ----- Ghế quanh bàn -----
  const needs = card && TARGETED.includes(asType(card)) && myTurn && (!needsExtra || extra != null);
  const inRange = (p) => {
    if (!card || p.dist == null) return true;
    if (card.t === 'ruoumanh') return p.hp < p.max;
    if (asType(card) === 'ban' || card.t === 'dao') return p.dist <= v.me.range;
    if (card.t === 'dam' || card.t === 'sunggiau') return p.dist <= 1;
    if (card.t === 'cuop') return p.dist <= 1;
    if (card.t === 'tu') return p.role !== 'cst';
    return true;
  };
  const canPick = (p) => needs && p.alive && (p.id !== me || card.t === 'ruoumanh') && inRange(p);
  const roleIcon = (p) => (p.role && (p.id !== me || showRole || p.role === 'cst' || !p.alive) ? ROLE[p.role][0] : (p.alive ? '🤠' : '💀'));
  const seat = (id) => {
    const p = P[id];
    return [
      el('div', { class: 'rt-av' }, roleIcon(p), el('span', { class: 'rt-cnt' }, `🂠${p.handCount}`)),
      el('div', { class: 'rt-nm' }, el('span', { class: 'dot' + (online(id) ? ' on' : '') }), ' ', who(id)),
      el('div', { style: 'font-size:11px;letter-spacing:-1px' }, p.alive ? '❤️'.repeat(p.hp) + '🤍'.repeat(Math.max(0, p.max - p.hp)) : (p.role ? ROLE[p.role][1] : '')),
      p.char ? el('div', { class: 'rt-sub' }, `🎭 ${charName(p.char)}`, p.dist ? ` · cách ${p.dist}` : '') : null,
      // trang bị hiện bằng hình nhỏ (xem nghĩa ở bảng Lá bài) để ghế không cao quá đè lên phần dưới
      p.eq.length ? el('div', {}, p.eq.map((c) => el('span', { class: 'rt-eq', title: `${CARD[c.t]?.[0]}: ${CARD[c.t]?.[1]}`, 'aria-label': CARD[c.t]?.[0] }, art(c.t)))) : null,
    ];
  };
  const seatAttrs = (id) => {
    const p = P[id];
    const pickable = canPick(p);
    return {
      cls: [id === v.turnPlayer ? 'turn' : '', !p.alive ? 'dead' : '', pickable ? 'pick' : '', needs && !pickable && id !== me ? 'far' : ''].join(' '),
      onclick: pickable && !pending ? () => {
        if (PICK_CARD.includes(card.t)) { target = id; rerender(); return; }
        const cid = sel, ex = extra; sel = extra = null;
        send({ type: kind, card: cid, target: id, ...(ex != null ? { extra: ex } : {}) });
      } : undefined,
      label: who(id),
    };
  };

  // ----- Giữa bàn: chồng bài + lá vừa đánh + mô tả -----
  const pd = v.pending;
  const lp = v.lastPlay;
  let msg;
  if (v.phase === 'react' && pd) msg = { ban: `${who(pd.from)} ${pd.how || 'bắn'} ${who(pd.responder)}!`, loat: `${who(pd.from)} bắn loạt cả làng!`, phuckich: `${who(pd.from)} phục kích cả làng!`, duel: `Đấu tay đôi: ${who(pd.a)} vs ${who(pd.b)}` }[pd.kind];
  else if (lp) msg = `${who(lp.by)} đánh ${CARD[lp.card.t]?.[0]}${lp.target ? ' → ' + who(lp.target) : ''}`;
  const center = [
    el('div', { class: 'row', style: 'gap:10px;justify-content:center;align-items:flex-end' },
      el('div', { class: 'ac back', title: `Chồng bài: ${v.deckCount} lá` }),
      lp ? acard(lp.card, { big: true }) : null),
    msg ? el('div', { class: 'msg' }, msg) : null,
    // Đang phản ứng mà lá giữa bàn là lá đáp trả: nói rõ ai vừa đánh và tới lượt ai.
    v.phase === 'react' && pd && lp && lp.by !== pd.from
      ? el('div', { class: 'msg', style: 'background:#e8590ccc' }, `↩ ${who(lp.by)} vừa đánh ${CARD[lp.card.t]?.[0]} · tới lượt ${who(pd.responder)}${pd.kind === 'duel' ? ' đánh Bắn' : ''}`)
      : null,
    v.lastFlip ? el('div', { class: 'msg' }, `🃏 ${who(v.lastFlip.by)} lật (${v.lastFlip.why}): ${CARD[v.lastFlip.card.t]?.[0]} ${SUIT[v.lastFlip.card.s]}`) : null,
  ];
  const arrow = lp?.target ? { from: lp.by, to: lp.target } : null; // luôn theo lá vừa đánh (kể cả lá đáp trả)
  const table = roundTable({ order: v.players.map((p) => p.id), me, seat, seatAttrs, center, arrow });
  const main = [];
  // Ô vai nổi mờ ở góc phải bàn (thu gọn được) + nhật ký xổ xuống ở góc trái: vẫn nhìn thấy bàn bên dưới
  const roleBox = roleMin
    ? el('button', { class: 'ov ov-r ov-btn', onclick: () => { roleMin = false; rerender(); } }, '🎭 Vai ▾')
    : el('div', { class: 'ov ov-r' },
      el('button', { class: 'ov-x', 'aria-label': 'Thu gọn', onclick: () => { roleMin = true; rerender(); } }, '–'),
      [...roleCard.childNodes]);
  const lines = v.log.map((t) => v.players.reduce((x, p) => x.split(p.id).join(who(p.id)), t));
  const logBox = el('div', { class: 'ov ov-l' + (logOpen ? ' open' : '') },
    el('button', { class: 'ov-btn', onclick: () => { logOpen = !logOpen; rerender(); } }, `📜 Nhật ký ${logOpen ? '▴' : '▾'}`),
    logOpen ? el('ul', {}, lines.length ? lines.map((t) => el('li', {}, t)) : el('li', { class: 'muted' }, 'Chưa có gì.')) : null);

  // Chọn lá của mục tiêu cho Cướp/Phá
  if (card && target && PICK_CARD.includes(card.t)) {
    const tp = P[target];
    main.push(el('div', { class: 'card-tile stack' }, el('b', {}, `${CARD[card.t][0]} lá nào của ${who(target)}?`),
      el('div', { class: 'actions' },
        tp.handCount ? el('button', { class: 'btn', disabled: pending, onclick: () => { const id = sel; sel = target = null; send({ type: kind, card: id, target: tp.id, which: 'hand' }); } }, 'Lá ngẫu nhiên trên tay') : null,
        tp.eq.map((c) => el('button', { class: 'btn', disabled: pending, onclick: () => { const id = sel; sel = target = null; send({ type: kind, card: id, target: tp.id, which: c.id }); } }, CARD[c.t][0])),
        el('button', { class: 'btn', onclick: () => { target = null; rerender(); } }, 'Huỷ'))));
  }

  // Chợ phiên: lá lật giữa bàn, ai tới lượt thì chạm 1 lá để lấy
  if (v.store) {
    const mine = v.store.turn === me;
    main.push(el('div', { class: 'card-tile stack', style: 'align-items:center' },
      el('b', {}, mine ? '🏪 Chợ phiên: chạm 1 lá để lấy' : `🏪 Chợ phiên: đang chờ ${who(v.store.turn)} chọn`),
      el('div', { class: 'row', style: 'gap:6px;justify-content:center;flex-wrap:wrap' },
        v.store.cards.map((c) => acard(c, mine ? { disabled: pending, onclick: () => send({ type: 'store', card: c.id }) } : {})))));
  }

  if (v.scout) {
    main.push(el('div', { class: 'card-tile stack', style: 'align-items:center' }, el('b', {}, '🕵️ Thám tử: lá trên cùng chồng bài là'),
      acard(v.scout, { big: true }),
      el('div', { class: 'actions' },
        el('button', { class: 'btn btn-primary', disabled: pending, onclick: () => send({ type: 'scout', bottom: false }) }, 'Giữ, bốc luôn'),
        el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'scout', bottom: true }) }, 'Đẩy xuống đáy rồi bốc'))));
  }

  // Bác sĩ làng: người khác vừa hồi máu → chạm 1 lá để bỏ và hồi theo
  if (v.docOffer) {
    main.push(el('div', { class: 'card-tile stack', style: 'border-color:var(--ok)' },
      el('b', {}, '🩺 Bác sĩ làng: có người vừa hồi máu. Chạm 1 lá trên tay để bỏ và hồi 1 máu theo (3 giây).'),
      el('button', { class: 'btn btn-small', disabled: pending, onclick: () => send({ type: 'doc', card: null }) }, 'Bỏ qua')));
  }

  if (v.phase === 'steal' && myTurn) {
    main.push(el('div', { class: 'card-tile stack' }, el('b', {}, '🤏 Kẻ móc túi: rút lá đầu tiên từ tay ai?'),
      el('div', { class: 'actions' },
        v.players.filter((p) => p.alive && p.id !== me && p.handCount).map((p) => el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'steal', target: p.id }) }, `${who(p.id)} (${p.handCount} lá)`)),
        el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'steal', target: null }) }, 'Bốc bình thường'))));
  }

  // Khung phản ứng
  if (v.phase === 'react' && pd && actor) {
    const need = pd.kind === 'duel' ? 'ban' : pd.need;
    const swap = v.me.char === 'haisung' ? { ne: 'ban', ban: 'ne' }[need] : null;
    const noNe = need === 'ne' && v.me.char === 'khonglo'; // Gã khổng lồ không dùng được lá Né
    const mine = noNe ? null : hand.find((c) => c.t === need) || (need === 'ne' ? hand.find((c) => c.t === 'lach') : null) || hand.find((c) => c.t === swap);
    const hat = need === 'ne' ? myEq.find((c) => c.t === 'mu') : null; // Mũ rộng vành: trang bị né 1 phát
    main.push(el('div', { class: 'card-tile stack', style: 'border-color:var(--danger)' }, el('b', {}, `⚠️ ${msg}`),
      noNe ? el('div', { class: 'muted' }, 'Gã khổng lồ không dùng được lá Né.') : null,
      pd.left > 1 ? el('div', {}, `Đòn của Tay súng thép: cần ${pd.left} lá Né nữa`) : null,
      el('div', { class: 'actions' },
        el('button', { class: 'btn btn-primary', disabled: !mine || pending, onclick: () => send({ type: 'respond', card: mine.id }) }, mine ? `Đánh ${CARD[mine.t][0]}` : `Không có lá ${CARD[need][0]}`),
        hat ? el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'respond', card: hat.id }) }, '🎩 Dùng Mũ rộng vành') : null,
        el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'respond' }) }, 'Chịu mất 1 máu'))));
  }

  // Trạng thái
  let status = '';
  if (!v.me.alive) status = '💀 Bạn đã gục. Ngồi xem tiếp nhé.';
  else if (v.phase === 'discard' && myTurn) status = `Bài nhiều hơn mức được giữ (${v.me.handLimit} lá): chọn ${hand.length - v.me.handLimit} lá để bỏ.`;
  else if (v.phase === 'scout' && !myTurn) status = `${nameOf(v.turnPlayer)} (Thám tử) đang xem lá trên cùng…`;
  else if (v.phase === 'steal' && !myTurn) status = `${nameOf(v.turnPlayer)} đang chọn người để móc túi…`;
  else if (v.phase === 'store') status = v.store.turn === me ? 'Chợ phiên: chọn 1 lá.' : `Chợ phiên: chờ ${who(v.store.turn)} chọn…`;
  else if (myTurn && v.phase === 'play') status = card ? (needsExtra && extra == null ? 'Chạm thêm 1 lá trên tay để bỏ kèm.' : needs ? `Chạm vào người để ${CARD[asType(card)][0]}.` : `Đánh ${CARD[card.t][0]}?`) : `Lượt của bạn · tầm bắn ${v.me.range}${v.bangUsed >= v.me.bangLimit ? ' · đã bắn đủ' : ''}`;
  else if (myTurn) status = 'Lượt của bạn';
  else if (v.phase === 'react' && !actor) status = `Đang chờ ${who(v.turn)} phản ứng…`;
  else status = `Lượt của ${nameOf(v.turnPlayer)}`;
  main.push(el('div', { class: 'status' + (myTurn || actor ? ' me' : ''), role: 'status' }, status));

  // Bài trên tay (xếp quạt)
  if (v.me.alive) {
    const discarding = v.phase === 'discard' && myTurn;
    const canHeal = v.me.char === 'langvuon' && P[me].hp < P[me].max && hand.length >= 2;
    if (!canHeal) healMode = false;
    const picking = discarding || healMode;
    const mid = (hand.length - 1) / 2;
    main.push(el('div', { class: 'fan', style: `--n:${hand.length}` }, hand.map((c, i) => acard(c, {
      sel: picking ? picks.has(c.id) : sel === c.id || extra === c.id,
      disabled: !(myTurn || picking || v.docOffer) || pending,
      style: `transform: rotate(${(i - mid) * Math.min(6, 30 / hand.length)}deg) translateY(${Math.abs(i - mid) * 3}px)`,
      onclick: () => {
        if (v.docOffer) { send({ type: 'doc', card: c.id }); return; }
        if (picking) { picks.has(c.id) ? picks.delete(c.id) : picks.add(c.id); } else if (needsExtra && c.id !== sel) extra = extra === c.id ? null : c.id;
        else { sel = sel === c.id ? null : c.id; target = null; extra = null; }
        rerender();
      },
    }))));
    const acts = el('div', { class: 'actions' });
    if (canHeal) {
      if (healMode) acts.append(el('button', { class: 'btn btn-primary', disabled: picks.size !== 2 || pending, onclick: () => { const cards = [...picks]; healMode = false; picks.clear(); send({ type: 'heal2', cards }); } }, `🩺 Bỏ ${picks.size}/2 lá để hồi 1 máu`),
        el('button', { class: 'btn', onclick: () => { healMode = false; picks.clear(); rerender(); } }, 'Huỷ'));
      else acts.append(el('button', { class: 'btn', onclick: () => { healMode = true; picks.clear(); sel = null; rerender(); } }, '🩺 Bỏ 2 lá hồi máu'));
    }
    // Băng bó dùng được cả ngoài lượt mình
    const bb = hand.find((c) => c.t === 'bangbo');
    if (bb && P[me].hp < P[me].max && !(myTurn && v.phase === 'play')) acts.append(el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'play', card: bb.id }) }, '❤️ Dùng Băng bó'));
    if (discarding) acts.append(el('button', { class: 'btn btn-primary', disabled: pending, onclick: () => send({ type: 'discard', cards: [...picks] }) }, `Bỏ ${picks.size} lá`));
    else if (myTurn && v.phase === 'play') {
      const fire = (more = {}) => { const id = sel, ex = extra; sel = extra = null; send({ type: kind, card: id, ...(ex != null ? { extra: ex } : {}), ...more }); };
      if (card?.t === 'ruou') acts.append(el('button', { class: 'btn btn-primary', disabled: pending, onclick: () => fire() }, '🍺 Cả bàn hồi 1 máu'),
        el('button', { class: 'btn btn-primary', disabled: pending || P[me].hp >= P[me].max, onclick: () => fire({ self: true }) }, '🍺 Mình hồi 1 máu'));
      else if (card && !TARGETED.includes(asType(card))) acts.append(el('button', { class: 'btn btn-primary', disabled: pending || (needsExtra && extra == null), onclick: () => fire() }, `${kind === 'use' ? 'Dùng' : 'Đánh'} ${CARD[card.t][0]}`));
      myEq.filter((c) => ONESHOT.includes(c.t) && c.t !== 'mu').forEach((c) => acts.append(el('button', { class: 'btn' + (sel === c.id ? ' btn-primary' : ''), disabled: pending, onclick: () => { sel = sel === c.id ? null : c.id; target = extra = null; rerender(); } }, `🎒 ${CARD[c.t][0]}`)));
      if (v.me.char === 'lieumang' && P[me].hp > 1) acts.append(el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'gamble' }) }, '🎲 Mất 1 máu, bốc 2 lá'));
      acts.append(el('button', { class: 'btn', disabled: pending, onclick: () => { sel = null; send({ type: 'end' }); } }, 'Kết thúc lượt ➜'));
    }
    main.push(acts);
    if (card) main.push(el('small', { class: 'muted', style: 'text-align:center' }, `${CARD[card.t][0]}: ${CARD[card.t][1]}`));
  }

  const mineNow = !!(v.me.alive && !v.winner && (actor || v.docOffer || v.store?.turn === me));
  if (mineNow && !wasMine) navigator.vibrate?.(200); // iPhone (Safari) không hỗ trợ rung: bỏ qua
  wasMine = mineNow;

  // Khít màn hình: bàn tròn co giãn theo chỗ trống; dọc: bàn trên, điều khiển dưới; ngang: trái / phải
  return [sideLayout({ left, right, main: [el('div', { class: 'lz' }, el('div', { class: 'lz-in' },
    el('div', { class: 'lz-table' }, table, logBox, roleBox), el('div', { class: 'lz-ctrl stack' }, main)))] })];
}

runTable({
  gameCode: 'W', minPlayers: 4, maxPlayers: 7,
  engine: { validate, start, apply: (s, id, a) => apply(s, id, a), viewFor, forceSkip: (s, stuck) => forceSkip(s, Math.random, stuck), nextTimer, onTimer },
  renderTable,
  bot: botAction,
  resultOf: (v, nameOf) => ({
    title: { luat: '⭐ Phe Luật thắng!', cuop: '🦹 Băng cướp thắng!', phanboi: '🐍 Kẻ phản bội thắng!' }[v.winTeam],
    reason: `Người thắng: ${[].concat(v.winner).map(nameOf).join(', ')}`,
    lines: v.players.map((p) => `${nameOf(p.id)}: ${p.role ? ROLE[p.role][1] : '?'}${p.char ? ` (${charName(p.char)})` : ''}`),
  }),
});
