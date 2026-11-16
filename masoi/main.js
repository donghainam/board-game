import { el } from '../shared/lobby.js';
import { runTable } from '../shared/table.js';
import { validate, start, apply, viewFor, forceSkip, nextTimer, onTimer, SPECIAL } from './engine.js';

const ROLE = {
  soi: ['🐺', 'Sói', 'Mỗi đêm cùng bầy chọn 1 người để cắn (phải thống nhất).'],
  soinguyen: ['🐺🩸', 'Sói nguyền', 'Là Sói. Một lần cả ván: biến người bị cắn thành Sói thay vì giết.'],
  soigayme: ['🐺💤', 'Sói gây mê', 'Là Sói. Mỗi đêm gây mê 1 người: ngày hôm sau họ không được bỏ phiếu.'],
  dan: ['🧑‍🌾', 'Dân làng', 'Không có khả năng đặc biệt. Tìm ra Sói và treo cổ chúng!'],
  tientri: ['🔮', 'Tiên tri', 'Mỗi đêm soi 1 người: biết người đó có phải Sói không.'],
  baove: ['🛡️', 'Bảo vệ', 'Mỗi đêm che 1 người khỏi bị Sói cắn (không che 1 người 2 đêm liền).'],
  phuthuy: ['🧪', 'Phù thuỷ', '1 bình cứu + 1 bình độc, mỗi bình dùng 1 lần cả ván.'],
  thosan: ['🏹', 'Thợ săn', 'Khi chết được bắn kéo theo 1 người.'],
  cupid: ['💘', 'Cupid', 'Đêm đầu ghép đôi 2 người: 1 người chết thì người kia chết theo.'],
};
const roleName = (r) => (ROLE[r] ? ROLE[r][1] : '?');

let showRole = false;
let draft = { curse: false, cupid: [], save: false, poison: null };
let lastPhaseKey = '';

// Đồng hồ thảo luận: chỉ cập nhật chữ, không vẽ lại cả trang.
let hostNow = () => Date.now();
setInterval(() => {
  const e = document.getElementById('cd');
  if (!e) return;
  const left = Math.max(0, Number(e.dataset.until) - hostNow());
  e.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
}, 500);

function setupPanel(config, set) {
  const c = config || {};
  const upd = (patch) => set({ ...c, ...patch });
  return el('div', { class: 'card-tile stack' }, el('h3', {}, 'Cài đặt vai (chủ bàn)'),
    el('label', { class: 'row' }, 'Số Sói thường: ',
      el('input', { type: 'number', min: 0, max: 5, value: c.wolves ?? 1, class: 'input', style: 'width:90px',
        onchange: (e) => upd({ wolves: Math.max(0, Math.min(5, parseInt(e.target.value, 10) || 0)) }) })),
    el('div', { class: 'stack', style: 'gap:6px' }, SPECIAL.map((r) => el('label', { class: 'row' },
      el('input', { type: 'checkbox', checked: !!c[r], onchange: (e) => upd({ [r]: e.target.checked }) }),
      `${ROLE[r][0]} ${ROLE[r][1]}`))),
    el('label', { class: 'row' }, 'Thời gian thảo luận: ',
      el('select', { class: 'input', style: 'width:auto', onchange: (e) => upd({ talkMin: Number(e.target.value) }) },
        [2, 3, 5].map((m) => el('option', { value: m, selected: (c.talkMin ?? 3) === m }, `${m} phút`)))));
}

function renderTable(v, api) {
  const { me, nameOf, send, pending, rerender } = api;
  hostNow = api.hostNow;
  const key = v.phase + v.night + v.day;
  if (key !== lastPhaseKey) { lastPhaseKey = key; showRole = false; draft = { curse: undefined, drug: undefined, cupid: [], save: false, poison: null }; }
  const who = (id) => (id === me ? 'Bạn' : nameOf(id));
  const alive = v.players.filter((p) => p.alive);
  const r = v.me.role;
  const out = [];

  // Thẻ vai: mặc định che để người ngồi cạnh không nhìn thấy.
  out.push(el('div', { class: 'card-tile rolecard stack', style: 'gap:6px' },
    showRole
      ? [el('div', { class: 'big' }, ROLE[r]?.[0] || ''), el('b', {}, roleName(r) + (v.me.converted ? ' – bạn đã bị nguyền, giờ bạn là Sói!' : '')),
        el('small', { class: 'muted' }, ROLE[r]?.[2] || ''),
        v.wolves ? el('small', {}, '🐺 Bầy Sói: ', v.wolves.ids.map(who).join(', ')) : null,
        v.lover ? el('small', {}, `💘 Người yêu của bạn: ${who(v.lover)}`) : null]
      : el('div', { class: 'muted' }, 'Vai của bạn đang được che.'),
    el('button', { class: 'btn btn-small', onclick: () => { showRole = !showRole; rerender(); } }, showRole ? '🙈 Che vai' : '👁 Xem vai')));
  // Lời nhắc giống hệt nhau trên mọi máy: không lộ ai có việc ban đêm hay ai vừa bị nguyền.
  if (!showRole && v.me.alive) out.push(el('div', { class: 'muted', style: 'text-align:center' },
    v.phase === 'night' ? '🌙 Bấm 👁 Xem vai để thấy việc của bạn đêm nay.' : '☀️ Đầu mỗi ngày hãy bấm 👁 Xem vai để kiểm tra vai của mình.'));

  const night = v.phase === 'night';
  out.push(el('div', { class: 'phase' }, el('h2', {}, night ? `🌙 Đêm ${v.night}` : `☀️ Ngày ${v.day}`),
    v.elder ? el('small', { class: 'muted' }, `Già làng: ${who(v.elder)}`) : null));

  if (!night && v.news) {
    const d = v.news.deaths;
    out.push(el('div', { class: 'day-bg stack', style: 'gap:4px' },
      el('div', {}, d.length ? `💀 ${v.news.lynch ? 'Bị treo / chết' : 'Đêm qua đã chết'}: ${d.map(who).join(', ')}` : (v.news.lynch ? 'Không ai bị treo.' : '🌤 Đêm qua bình yên, không ai chết.')),
      v.drugged ? el('div', {}, `💤 ${who(v.drugged)} bị gây mê, hôm nay không được bỏ phiếu.`) : null));
  }

  const list = (opts) => el('div', { class: 'plist' }, v.players.map((p) => {
    const extra = opts.extra?.(p.id);
    return el('button', {
      class: 'pbtn' + (p.alive ? '' : ' dead') + (opts.sel?.(p.id) ? ' sel' : ''),
      disabled: !p.alive || !opts.onPick || pending || opts.disabled?.(p.id),
      onclick: () => opts.onPick(p.id),
    }, el('span', {}, who(p.id)), extra ? el('small', {}, extra) : null);
  }));

  if (!v.me.alive && v.phase !== 'hunter' && v.phase !== 'successor') {
    out.push(el('div', { class: 'card-tile' }, '💀 Bạn đã chết. Ngồi xem và đừng nhắc bài nhé!'));
  }

  if (night && v.me.alive && showRole) {
    const box = el('div', { class: 'night-bg stack' });
    if (v.me.wolf) {
      const picks = v.wolves.picks;
      box.append(el('b', {}, '🐺 Chọn người để cắn (cả bầy phải chọn giống nhau):'),
        list({
          onPick: (t) => send({ type: 'night', target: t, ...(draft.curse !== undefined ? { curse: draft.curse } : {}), ...(draft.drug !== undefined ? { drug: draft.drug } : {}) }),
          sel: (id) => v.myAct?.target === id,
          disabled: (id) => v.wolves.ids.includes(id),
          extra: (id) => Object.entries(picks).filter(([, t]) => t === id).map(([w]) => '🐺' + who(w)).join(' '),
        }));
      if (r === 'soinguyen' && !v.wolves.curseUsed) {
        const cur = v.myAct?.curse ?? draft.curse;
        const setCurse = (val) => { draft.curse = val; if (v.myAct?.target) send({ type: 'night', target: v.myAct.target, curse: val }); else rerender(); };
        box.append(el('div', { class: 'row' }, '🩸 Đêm nay: ',
          el('button', { class: 'btn btn-small' + (cur === false ? ' btn-primary' : ''), onclick: () => setCurse(false) }, 'Cắn chết'),
          el('button', { class: 'btn btn-small' + (cur === true ? ' btn-primary' : ''), onclick: () => setCurse(true) }, 'Nguyền thành Sói (1 lần)')));
      }
      if (r === 'soigayme') {
        const curDrug = v.myAct?.drug !== undefined ? v.myAct.drug : draft.drug;
        box.append(el('label', { class: 'row' }, '💤 Gây mê: ', el('select', { class: 'input', style: 'width:auto',
          onchange: (e) => {
            if (!e.target.value) return;
            draft.drug = e.target.value === 'none' ? null : e.target.value;
            if (v.myAct?.target) send({ type: 'night', target: v.myAct.target, drug: draft.drug });
          } },
        el('option', { value: '', selected: curDrug === undefined }, '— hãy chọn —'),
        el('option', { value: 'none', selected: curDrug === null }, 'Không gây mê ai'),
        alive.map((p) => el('option', { value: p.id, selected: curDrug === p.id }, who(p.id))))));
      }
    } else if (r === 'tientri') {
      box.append(el('b', {}, '🔮 Soi 1 người:'), list({ onPick: v.myAct ? null : (t) => send({ type: 'night', target: t }), sel: (id) => v.myAct?.target === id, disabled: (id) => id === me }));
    } else if (r === 'baove') {
      box.append(el('b', {}, '🛡️ Che 1 người:'), list({ onPick: v.myAct ? null : (t) => send({ type: 'night', target: t }), sel: (id) => v.myAct?.target === id, disabled: (id) => id === v.guardLast }));
    } else if (r === 'cupid' && v.night === 1) {
      box.append(el('b', {}, '💘 Chọn 2 người để ghép đôi:'),
        list({ onPick: v.myAct ? null : (t) => { draft.cupid = draft.cupid.includes(t) ? draft.cupid.filter((x) => x !== t) : [...draft.cupid, t].slice(-2); rerender(); },
          sel: (id) => (v.myAct?.targets || draft.cupid).includes(id) }),
        v.myAct ? null : el('button', { class: 'btn btn-primary', disabled: draft.cupid.length !== 2 || pending, onclick: () => send({ type: 'night', targets: draft.cupid }) }, 'Ghép đôi'));
    } else if (r === 'phuthuy') {
      const w = v.witch;
      if (!w.victim) box.append(el('div', {}, '🧪 Chờ bầy Sói chọn xong…'));
      else if (!v.myAct) {
        box.append(el('div', {}, `🧪 Đêm nay Sói cắn: `, el('b', {}, who(w.victim))),
          w.potions.save ? el('label', { class: 'row' }, el('input', { type: 'checkbox', checked: draft.save, onchange: (e) => { draft.save = e.target.checked; } }), 'Dùng bình cứu') : el('small', {}, 'Bình cứu đã dùng'),
          w.potions.poison ? el('label', { class: 'row' }, 'Bình độc: ', el('select', { class: 'input', style: 'width:auto', onchange: (e) => { draft.poison = e.target.value || null; } },
            el('option', { value: '' }, '— không dùng —'), alive.map((p) => el('option', { value: p.id, selected: draft.poison === p.id }, who(p.id))))) : el('small', {}, 'Bình độc đã dùng'),
          el('button', { class: 'btn btn-primary', disabled: pending, onclick: () => send({ type: 'night', save: draft.save, poison: draft.poison }) }, 'Xong'));
      }
    }
    if (!v.me.wolf && !['tientri', 'baove', 'phuthuy'].includes(r) && !(r === 'cupid' && v.night === 1)) {
      box.append(el('b', {}, '😴 Nhắm mắt chờ trời sáng…'), list({}),
        v.myAct ? null : el('button', { class: 'btn btn-primary', disabled: pending, onclick: () => send({ type: 'night', ready: true }) }, 'Tôi đã sẵn sàng'));
    }
    if (v.myAct && !v.me.wolf) box.append(el('div', {}, '✓ Đã xong. Chờ mọi người…'));
    out.push(box);
  }

  if (showRole && v.seer?.length) out.push(el('div', { class: 'card-tile' }, el('b', {}, '🔮 Kết quả soi:'),
    el('ul', {}, v.seer.map((x) => el('li', {}, `Đêm ${x.night}: ${who(x.target)} ${x.wolf ? 'LÀ SÓI 🐺' : 'không phải Sói'}`)))));

  if (v.phase === 'elect' || v.phase === 'vote') {
    const canVote = v.waitingOn?.includes(me) || v.myVote !== undefined;
    out.push(el('b', {}, v.phase === 'elect' ? '🗳 Bầu Già làng:' : '🗳 Bỏ phiếu treo cổ:'),
      list({ onPick: v.me.alive && canVote ? (t) => send({ type: 'vote', target: t }) : null, sel: (id) => v.myVote === id,
        extra: (id) => (v.votes?.[id] ? `${v.votes[id]} phiếu` : '') }),
      v.phase === 'vote' && v.me.alive && canVote ? el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'vote', target: null }) }, v.myVote === null ? '✓ Không treo ai' : 'Không treo ai') : null,
      v.me.alive && !canVote && v.phase === 'vote' ? el('div', { class: 'muted' }, 'Bạn không được bỏ phiếu hôm nay.') : null,
      el('small', { class: 'muted' }, `Còn chờ: ${(v.waitingOn || []).map(who).join(', ') || '—'}`));
  }

  if (v.phase === 'talk') {
    out.push(el('div', { class: 'day-bg stack' }, el('b', { style: 'text-align:center' }, '🗣 Thảo luận'),
      el('div', { class: 'countdown', id: 'cd', 'data-until': v.until }, '…'),
      me === v.hostId ? el('button', { class: 'btn btn-primary', disabled: pending, onclick: () => send({ type: 'skip-talk' }) }, 'Bỏ phiếu luôn') : null));
  }

  if (v.phase === 'tie') {
    out.push(el('b', {}, `⚖️ Hoà phiếu – Già làng ${who(v.elder)} chọn người bị treo:`),
      list({ onPick: v.elder === me ? (t) => send({ type: 'pick', target: t }) : null, disabled: (id) => !v.tieIds.includes(id) }));
  }
  if (v.phase === 'hunter' || v.phase === 'successor') {
    const mine = v.pick?.id === me;
    const hunter = v.phase === 'hunter';
    out.push(el('b', {}, hunter ? `🏹 Thợ săn ${who(v.pick.id)} đang ngắm bắn…` : `👴 Già làng ${who(v.pick.id)} chọn người kế nhiệm…`),
      mine ? list({ onPick: (t) => send({ type: 'pick', target: t }) }) : null,
      mine && hunter ? el('button', { class: 'btn', disabled: pending, onclick: () => send({ type: 'pick', target: null }) }, 'Không bắn') : null);
  }

  if (showRole && v.roles) out.push(el('div', { class: 'card-tile' }, el('b', {}, 'Vai của mọi người:'),
    el('ul', {}, Object.entries(v.roles).map(([id, rr]) => el('li', {}, `${who(id)}: ${ROLE[rr]?.[0] || ''} ${roleName(rr)}`)))));
  return out;
}

runTable({
  gameCode: 'M', minPlayers: 5, maxPlayers: 16,
  setup: { initial: { wolves: 1, talkMin: 3 }, render: setupPanel },
  engine: { validate, start, apply: (s, id, a) => apply(s, id, a), viewFor, forceSkip: (s) => forceSkip(s), nextTimer, onTimer },
  renderTable,
  resultOf: (v, nameOf) => ({
    title: { soi: '🐺 Phe Sói thắng!', dan: '🧑‍🌾 Phe Dân thắng!', doi: '💘 Cặp đôi thắng!' }[v.winTeam],
    reason: `Người thắng: ${[].concat(v.winner).map(nameOf).join(', ')}`,
    lines: Object.entries(v.roles || {}).map(([id, r]) => `${nameOf(id)}: ${roleName(r)}`),
  }),
});
