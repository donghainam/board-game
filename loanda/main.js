import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { validate, start, apply, viewFor, forceSkip, CHARS } from './engine.js';
import { botAction } from './bot.js';

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
let healMode = false;  // Ông lang vườn đang chọn 2 lá để hồi máu
const charName = (c) => CHARS[c]?.name || '';
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
  if (v.phase !== 'discard' && !healMode) picks.clear();
  const out = [];
  const asType = (c) => (c.t === 'ne' && v.me.char === 'haisung' ? 'ban' : c.t); // Cô nàng hai súng: Né dùng như Bắn

  // Thẻ vai (che mặc định, trừ Cảnh sát trưởng vốn công khai)
  const r = v.me.role;
  out.push(el('div', { class: 'card-tile stack', style: 'gap:4px;text-align:center' },
    showRole || r === 'cst'
      ? [el('b', {}, `${ROLE[r][0]} ${ROLE[r][1]}`), el('small', { class: 'muted' }, GOAL[r])]
      : el('div', { class: 'muted' }, 'Vai của bạn đang được che.'),
    r === 'cst' ? null : el('button', { class: 'btn btn-small', onclick: () => { showRole = !showRole; rerender(); } }, showRole ? '🙈 Che vai' : '👁 Xem vai'),
    v.me.char ? el('small', {}, `🎭 Chức năng: ${charName(v.me.char)} – ${CHARS[v.me.char]?.text || ''}`) : null));

  if (v.phase === 'pick') {
    if (v.me.offer) {
      out.push(el('h3', {}, '🎭 Chọn 1 trong 2 chức năng (công khai khi cả bàn chọn xong):'),
        ...v.me.offer.map((c) => el('div', { class: 'card-tile stack', style: 'gap:6px' },
          el('b', {}, `${CHARS[c].name} · ${'❤️'.repeat(CHARS[c].hp)}`), el('div', {}, CHARS[c].text),
          el('button', { class: 'btn btn-primary', disabled: pending, onclick: () => send({ type: 'pick', char: c }) }, 'Chọn chức năng này'))));
    } else out.push(el('div', { class: 'status' }, `✓ Bạn đã chọn ${charName(v.me.char)}. Đang chờ: ${v.waitingOn.map(who).join(', ')}`));
    return out;
  }


  // Người chơi theo vòng ghế
  const needs = card && TARGETED.includes(asType(card)) && myTurn;
  const inRange = (p) => {
    if (!card || p.dist == null) return true;
    if (asType(card) === 'ban') return p.dist <= v.me.range;
    if (card.t === 'cuop') return p.dist <= (v.me.char === 'tromngua' ? 2 : 1);
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
    p.char ? el('div', {}, el('small', { title: CHARS[p.char].text }, `🎭 ${charName(p.char)}`)) : null,
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

  if (v.phase === 'steal' && myTurn) {
    out.push(el('div', { class: 'card-tile stack' }, el('b', {}, '🤏 Kẻ móc túi: rút lá đầu tiên từ tay ai?'),
      el('div', { class: 'actions' },
        v.players.filter((p) => p.alive && p.id !== me && p.handCount).map((p) => el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'steal', target: p.id }) }, `${who(p.id)} (${p.handCount} lá)`)),
        el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'steal', target: null }) }, 'Bốc bình thường'))));
  } else if (v.phase === 'steal') out.push(el('div', { class: 'status' }, `${nameOf(v.turnPlayer)} đang chọn người để móc túi…`));

  // Khung phản ứng
  if (v.phase === 'react' && v.pending) {
    const pd = v.pending;
    const need = pd.kind === 'duel' ? 'ban' : pd.need;
    const what = { ban: `${who(pd.from)} bắn ${actor ? 'bạn' : who(pd.responder)}!`, loat: `${who(pd.from)} bắn loạt cả làng!`, phuckich: `${who(pd.from)} phục kích cả làng!`, duel: `Đấu tay đôi: ${who(pd.a)} vs ${who(pd.b)}` }[pd.kind];
    const swap = v.me.char === 'haisung' ? { ne: 'ban', ban: 'ne' }[need] : null;
    const mine = hand.find((c) => c.t === need) || hand.find((c) => c.t === swap);
    out.push(el('div', { class: 'react stack' }, el('b', {}, `⚠️ ${what}`), pd.left > 1 ? el('div', {}, `Đòn của Tay súng thép: cần ${pd.left} lá Né nữa`) : null,
      actor
        ? el('div', { class: 'actions' },
          el('button', { class: 'btn btn-primary', disabled: !mine || pending, onclick: () => send({ type: 'respond', card: mine.id }) }, mine ? `Đánh ${name(mine.t)}` : `Không có lá ${name(need)}`),
          el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'respond' }) }, 'Chịu mất 1 máu'))
        : el('div', {}, `Đang chờ ${who(pd.responder)} phản ứng…`)));
  }

  // Trạng thái
  let status = '';
  if (!v.me.alive) status = '💀 Bạn đã gục. Ngồi xem tiếp nhé.';
  else if (v.phase === 'discard' && myTurn) status = `Bài nhiều hơn máu: chọn ${hand.length - v.players.find((p) => p.id === me).hp} lá để bỏ.`;
  else if (myTurn) status = card ? (needs ? `Chọn người để ${name(asType(card))}.` : `Đánh ${name(card.t)}?`) : `Lượt của bạn · tầm bắn ${v.me.range}${v.bangUsed >= v.me.bangLimit ? ' · đã bắn đủ' : ''}`;
  else if (v.phase !== 'react') status = `Lượt của ${nameOf(v.turnPlayer)}`;
  if (status) out.push(el('div', { class: 'status' + (myTurn ? ' me' : ''), role: 'status' }, status));
  if (v.lastFlip) out.push(el('small', { class: 'muted', style: 'text-align:center' }, `🃏 ${who(v.lastFlip.by)} lật bài (${v.lastFlip.why}): ${name(v.lastFlip.card.t)} ${SUIT[v.lastFlip.card.s]}`));

  // Bài trên tay
  if (v.me.alive) {
    const discarding = v.phase === 'discard' && myTurn;
    const meP = v.players.find((p) => p.id === me);
    const canHeal = v.me.char === 'langvuon' && meP.hp < meP.max && hand.length >= 2;
    if (!canHeal) healMode = false;
    const picking = discarding || healMode;
    out.push(el('div', { class: 'hand' }, hand.map((c) => cardBtn(c, {
      sel: picking ? picks.has(c.id) : sel === c.id,
      disabled: !(myTurn || picking) || pending,
      onclick: () => {
        if (picking) { picks.has(c.id) ? picks.delete(c.id) : picks.add(c.id); } else { sel = sel === c.id ? null : c.id; target = null; }
        rerender();
      },
    }))));
    if (canHeal) {
      out.push(el('div', { class: 'actions' }, healMode
        ? [el('button', { class: 'btn btn-primary', disabled: picks.size !== 2 || pending, onclick: () => { const cards = [...picks]; healMode = false; picks.clear(); send({ type: 'heal2', cards }); } }, `🩺 Bỏ ${picks.size}/2 lá để hồi 1 máu`),
          el('button', { class: 'btn', onclick: () => { healMode = false; picks.clear(); rerender(); } }, 'Huỷ')]
        : el('button', { class: 'btn', onclick: () => { healMode = true; picks.clear(); sel = null; rerender(); } }, '🩺 Bỏ 2 lá hồi máu')));
    }
    const acts = el('div', { class: 'actions' });
    if (discarding) acts.append(el('button', { class: 'btn btn-primary', disabled: pending, onclick: () => send({ type: 'discard', cards: [...picks] }) }, `Bỏ ${picks.size} lá`));
    else if (myTurn && v.phase === 'play') {
      if (card && !TARGETED.includes(asType(card))) acts.append(el('button', { class: 'btn btn-primary', disabled: pending, onclick: () => { const id = sel; sel = null; send({ type: 'play', card: id }); } }, `Đánh ${name(card.t)}`));
      acts.append(el('button', { class: 'btn', disabled: pending, onclick: () => { sel = null; send({ type: 'end' }); } }, 'Kết thúc lượt ➜'));
    }
    out.push(acts);
  }

  if (v.log.length) out.push(el('details', {}, el('summary', { class: 'muted' }, 'Nhật ký'),
    el('ul', {}, v.log.map((t) => el('li', {}, v.players.reduce((x, p) => x.split(p.id).join(who(p.id)), t))))));
  return out;
}

runTable({
  gameCode: 'W', minPlayers: 4, maxPlayers: 7,
  engine: { validate, start, apply: (s, id, a) => apply(s, id, a), viewFor, forceSkip: (s, stuck) => forceSkip(s, Math.random, stuck) },
  renderTable,
  bot: botAction,
  resultOf: (v, nameOf) => ({
    title: { luat: '⭐ Phe Luật thắng!', cuop: '🦹 Băng cướp thắng!', phanboi: '🐍 Kẻ phản bội thắng!' }[v.winTeam],
    reason: `Người thắng: ${[].concat(v.winner).map(nameOf).join(', ')}`,
    lines: v.players.map((p) => `${nameOf(p.id)}: ${p.role ? ROLE[p.role][1] : '?'}${p.char ? ` (${charName(p.char)})` : ''}`),
  }),
});
