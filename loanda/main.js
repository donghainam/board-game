import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { validate, start, apply, viewFor, forceSkip } from './engine.js';

const CARD = {
  ban: ['🔫', 'Bắn'], ne: ['🌀', 'Né'], bangbo: ['🩹', 'Băng bó'], ruou: ['🍻', 'Rượu mừng'], cuop: ['🤏', 'Cướp'], pha: ['💥', 'Phá'],
  duel: ['🤺', 'Đấu tay đôi'], loat: ['🔫🔫', 'Bắn loạt'], phuckich: ['🏹', 'Phục kích'], tiepte: ['📦', 'Tiếp tế'], tieptelon: ['🚂', 'Tiếp tế lớn'],
  sung2: ['🔫2', 'Súng ngắn'], sung3: ['🔫3', 'Súng trường'], sung4: ['🔫4', 'Súng săn'], sung5: ['🔫5', 'Súng xa'], lienthanh: ['🔫∞', 'Liên thanh'],
  ngua: ['🐎', 'Ngựa'], ongnhom: ['🔭', 'Ống nhòm'], thung: ['🛢️', 'Thùng gỗ'], tu: ['⛓️', 'Nhà tù'], no: ['🧨', 'Thuốc nổ'],
};
const ROLE = { cst: ['⭐', 'Cảnh sát trưởng'], pho: ['🎖️', 'Phó cảnh sát'], cuop: ['🦹', 'Băng cướp'], phanboi: ['🐍', 'Kẻ phản bội'] };
const GOAL = {
  cst: 'Diệt hết Băng cướp và Kẻ phản bội.', pho: 'Bảo vệ Cảnh sát trưởng, diệt Băng cướp và Kẻ phản bội.',
  cuop: 'Hạ gục Cảnh sát trưởng.', phanboi: 'Là người cuối cùng còn sống.',
};
const SUIT = ['♥', '♦', '♣', '♠'];
const TARGETED = ['ban', 'cuop', 'pha', 'duel', 'tu'];
const name = (t) => CARD[t]?.[1] || '?';

let sel = null;       // id lá đang chọn trên tay
let target = null;    // người đang chọn cho Cướp/Phá
let showRole = false;
let picks = new Set(); // lá chọn để bỏ khi thừa bài
let lastRound = null; // đổi ván thì che thẻ vai lại

const cardBtn = (c, attrs = {}) => el('button', { class: 'wc' + (attrs.sel ? ' sel' : ''), disabled: attrs.disabled, onclick: attrs.onclick, 'aria-label': name(c.t) },
  el('b', {}, CARD[c.t]?.[0] || '?'), el('span', {}, name(c.t)), el('span', { class: 'suit' }, SUIT[c.s] ?? ''));

function renderTable(v, { me, nameOf, online, send, pending, rerender }) {
  const who = (id) => (id === me ? 'Bạn' : nameOf(id));
  // shortcut: nhận biết ván mới qua vai của mình + ghế Cảnh sát trưởng (ngẫu nhiên mỗi ván); trùng cả hai thì thẻ vai giữ nguyên trạng thái
  const round = v.me.role + v.players.findIndex((p) => p.role === 'cst');
  if (round !== lastRound) { lastRound = round; showRole = false; }
  const actor = v.turn === me;
  const myTurn = v.turnPlayer === me && v.phase !== 'react';
  const hand = v.me.hand;
  const card = hand.find((c) => c.id === sel);
  if (!card) { sel = null; target = null; }
  if (v.phase !== 'discard') picks.clear();
  const out = [];

  // Thẻ vai (che mặc định, trừ Cảnh sát trưởng vốn công khai)
  const r = v.me.role;
  out.push(el('div', { class: 'card-tile stack', style: 'gap:4px;text-align:center' },
    showRole || r === 'cst'
      ? [el('b', {}, `${ROLE[r][0]} ${ROLE[r][1]}`), el('small', { class: 'muted' }, GOAL[r])]
      : el('div', { class: 'muted' }, 'Vai của bạn đang được che.'),
    r === 'cst' ? null : el('button', { class: 'btn btn-small', onclick: () => { showRole = !showRole; rerender(); } }, showRole ? '🙈 Che vai' : '👁 Xem vai')));

  // Người chơi theo vòng ghế
  const needs = card && TARGETED.includes(card.t) && myTurn;
  const inRange = (p) => {
    if (!card || p.dist == null) return true;
    if (card.t === 'ban') return p.dist <= v.me.range;
    if (card.t === 'cuop') return p.dist <= 1;
    if (card.t === 'tu') return p.role !== 'cst';
    return true;
  };
  out.push(el('div', { class: 'seats2' }, v.players.map((p) => {
    const canPick = needs && p.alive && p.id !== me && inRange(p);
    return el('button', {
      class: 'seat' + (p.id === v.turnPlayer ? ' turn' : '') + (!p.alive ? ' dead' : '') + (needs && !canPick && p.id !== me ? ' far' : '') + (canPick ? ' pick' : ''),
      disabled: !canPick || pending,
      onclick: () => {
        if (card.t === 'cuop' || card.t === 'pha') { target = p.id; rerender(); return; }
        const id = sel; sel = null;
        send({ type: 'play', card: id, target: p.id });
      },
    },
    el('div', {}, el('span', { class: 'dot' + (online(p.id) ? ' on' : '') }), ' ', el('b', {}, who(p.id)),
      // Vai của chính mình chỉ hiện khi đang mở thẻ vai (người ngồi cạnh có thể nhìn màn hình).
      p.role && (p.id !== me || showRole || p.role === 'cst' || !p.alive) ? ` ${ROLE[p.role][0]}` : ''),
    el('div', { class: 'hp' }, p.alive ? '❤️'.repeat(p.hp) + '🤍'.repeat(Math.max(0, p.max - p.hp)) : '💀 ' + (p.role ? ROLE[p.role][1] : '')),
    el('small', {}, p.alive ? `${p.handCount} lá` : '', p.dist ? ` · cách ${p.dist}` : ''),
    p.eq.length ? el('div', { class: 'eqs' }, p.eq.map((c) => el('span', {}, `${CARD[c.t]?.[0]} ${name(c.t)}`))) : null);
  })));

  // Chọn lá của mục tiêu cho Cướp/Phá
  if (card && target && (card.t === 'cuop' || card.t === 'pha')) {
    const tp = v.players.find((p) => p.id === target);
    out.push(el('div', { class: 'card-tile stack' }, el('b', {}, `${name(card.t)} lá nào của ${who(target)}?`),
      el('div', { class: 'actions' },
        tp.handCount ? el('button', { class: 'btn', disabled: pending, onclick: () => { const id = sel; sel = target = null; send({ type: 'play', card: id, target: tp.id, which: 'hand' }); } }, 'Lá ngẫu nhiên trên tay') : null,
        tp.eq.map((c) => el('button', { class: 'btn', disabled: pending, onclick: () => { const id = sel; sel = target = null; send({ type: 'play', card: id, target: tp.id, which: c.id }); } }, `${CARD[c.t][0]} ${name(c.t)}`)))));
  }

  // Khung phản ứng
  if (v.phase === 'react' && v.pending) {
    const pd = v.pending;
    const need = pd.kind === 'duel' ? 'ban' : pd.need;
    const what = { ban: `${who(pd.from)} bắn ${actor ? 'bạn' : who(pd.responder)}!`, loat: `${who(pd.from)} bắn loạt cả làng!`, phuckich: `${who(pd.from)} phục kích cả làng!`, duel: `Đấu tay đôi: ${who(pd.a)} vs ${who(pd.b)}` }[pd.kind];
    const mine = hand.find((c) => c.t === need);
    out.push(el('div', { class: 'react stack' }, el('b', {}, `⚠️ ${what}`),
      actor
        ? el('div', { class: 'actions' },
          el('button', { class: 'btn btn-primary', disabled: !mine || pending, onclick: () => send({ type: 'respond', card: mine.id }) }, mine ? `Đánh ${name(need)}` : `Không có lá ${name(need)}`),
          el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'respond' }) }, 'Chịu mất 1 máu'))
        : el('div', {}, `Đang chờ ${who(pd.responder)} phản ứng…`)));
  }

  // Trạng thái
  let status = '';
  if (!v.me.alive) status = '💀 Bạn đã gục. Ngồi xem tiếp nhé.';
  else if (v.phase === 'discard' && myTurn) status = `Bài nhiều hơn máu: chọn ${hand.length - v.players.find((p) => p.id === me).hp} lá để bỏ.`;
  else if (myTurn) status = card ? (needs ? `Chọn người để ${name(card.t)}.` : `Đánh ${name(card.t)}?`) : `Lượt của bạn · tầm bắn ${v.me.range}${v.bangUsed ? ' · đã bắn' : ''}`;
  else if (v.phase !== 'react') status = `Lượt của ${nameOf(v.turnPlayer)}`;
  if (status) out.push(el('div', { class: 'status' + (myTurn ? ' me' : ''), role: 'status' }, status));
  if (v.lastFlip) out.push(el('small', { class: 'muted', style: 'text-align:center' }, `🃏 ${who(v.lastFlip.by)} lật bài (${v.lastFlip.why}): ${name(v.lastFlip.card.t)} ${SUIT[v.lastFlip.card.s]}`));

  // Bài trên tay
  if (v.me.alive) {
    const discarding = v.phase === 'discard' && myTurn;
    out.push(el('div', { class: 'hand' }, hand.map((c) => cardBtn(c, {
      sel: discarding ? picks.has(c.id) : sel === c.id,
      disabled: !(myTurn || discarding) || pending,
      onclick: () => {
        if (discarding) { picks.has(c.id) ? picks.delete(c.id) : picks.add(c.id); } else { sel = sel === c.id ? null : c.id; target = null; }
        rerender();
      },
    }))));
    const acts = el('div', { class: 'actions' });
    if (discarding) acts.append(el('button', { class: 'btn btn-primary', disabled: pending, onclick: () => send({ type: 'discard', cards: [...picks] }) }, `Bỏ ${picks.size} lá`));
    else if (myTurn) {
      if (card && !TARGETED.includes(card.t)) acts.append(el('button', { class: 'btn btn-primary', disabled: pending, onclick: () => { const id = sel; sel = null; send({ type: 'play', card: id }); } }, `Đánh ${name(card.t)}`));
      acts.append(el('button', { class: 'btn', disabled: pending, onclick: () => { sel = null; send({ type: 'end' }); } }, 'Kết thúc lượt ➜'));
    }
    out.push(acts);
  }

  if (v.log.length) out.push(el('details', {}, el('summary', { class: 'muted' }, 'Nhật ký'),
    el('ul', {}, v.log.map((t) => el('li', {}, t.replace(/\b[0-9a-f]{32}\b/g, (id) => who(id)))))));
  return out;
}

runTable({
  gameCode: 'W', minPlayers: 4, maxPlayers: 7,
  engine: { validate, start, apply: (s, id, a) => apply(s, id, a), viewFor, forceSkip: (s) => forceSkip(s) },
  renderTable,
  resultOf: (v, nameOf) => ({
    title: { luat: '⭐ Phe Luật thắng!', cuop: '🦹 Băng cướp thắng!', phanboi: '🐍 Kẻ phản bội thắng!' }[v.winTeam],
    reason: `Người thắng: ${[].concat(v.winner).map(nameOf).join(', ')}`,
    lines: v.players.map((p) => `${nameOf(p.id)}: ${p.role ? ROLE[p.role][1] : '?'}`),
  }),
});
