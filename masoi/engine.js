// Luật Ma Sói — thuần logic, máy làm quản trò. Mọi thông tin bí mật chỉ đi ra qua viewFor.

export const SPECIAL = ['tientri', 'baove', 'phuthuy', 'thosan', 'cupid', 'soinguyen', 'soigayme'];
const WOLF_ROLES = ['soi', 'soinguyen', 'soigayme'];

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function validate(ids, c) {
  if (!c) return 'Chưa cài đặt vai.';
  const n = ids.length;
  if (n < 5) return 'Cần ít nhất 5 người.';
  const wolves = (c.wolves | 0) + (c.soinguyen ? 1 : 0) + (c.soigayme ? 1 : 0);
  if (wolves < 1) return 'Cần ít nhất 1 Sói.';
  if (wolves * 2 >= n) return `Tổng số Sói (${wolves}) phải ít hơn nửa số người (${n}).`;
  if ((c.wolves | 0) + SPECIAL.filter((r) => c[r]).length > n) return 'Số vai nhiều hơn số người.';
  return undefined;
}

export function start(ids, { config }, rng = Math.random) {
  const roles = [...Array(config.wolves | 0).fill('soi'), ...SPECIAL.filter((r) => config[r])];
  while (roles.length < ids.length) roles.push('dan');
  shuffle(roles, rng);
  return {
    players: ids.map((id, i) => ({ id, role: roles[i], alive: true, wolf: WOLF_ROLES.includes(roles[i]) })),
    talkMs: [2, 3, 5].includes(config.talkMin) ? config.talkMin * 60000 : 180000,
    hostId: ids[0], phase: 'night', night: 1, day: 0, acts: {}, votes: {},
    lovers: null, guardLast: null, potions: { save: true, poison: true }, curseUsed: false,
    drugged: null, elder: null, tieIds: null, queue: [], after: null, until: null,
    seerLog: {}, news: { deaths: [] }, winner: null, winTeam: null,
  };
}

const P = (s, id) => s.players.find((p) => p.id === id);
const isAlive = (s, id) => !!P(s, id)?.alive;
const aliveIds = (s) => s.players.filter((p) => p.alive).map((p) => p.id);
const wolves = (s) => s.players.filter((p) => p.alive && p.wolf);

function consensus(s) {
  const ws = wolves(s);
  const t = s.acts[ws[0]?.id]?.target;
  return ws.length && t && ws.every((w) => s.acts[w.id]?.target === t) ? t : null;
}

// Người này đã xong phần việc ban đêm chưa.
function nightDone(s, p) {
  const a = s.acts[p.id];
  if (!a) return false;
  if (p.wolf) {
    if (!a.target || consensus(s) !== a.target) return false; // cả bầy phải thống nhất
    if (p.role === 'soinguyen' && !s.curseUsed && a.curse === undefined) return false;
    if (p.role === 'soigayme' && a.drug === undefined) return false;
    return true;
  }
  return true;
}

// ---------- Chết & thắng thua ----------
function killAll(s, ids) {
  const queue = [...ids];
  while (queue.length) {
    const id = queue.shift();
    const p = P(s, id);
    if (!p || !p.alive) continue;
    p.alive = false;
    s.news.deaths.push(id);
    if (s.lovers?.includes(id)) queue.push(s.lovers.find((x) => x !== id));
    if (p.role === 'thosan') s.queue.push({ kind: 'hunter', id });
    if (s.elder === id) s.queue.push({ kind: 'successor', id });
  }
}

function checkWin(s) {
  const alive = s.players.filter((p) => p.alive);
  const cross = s.lovers && P(s, s.lovers[0]).wolf !== P(s, s.lovers[1]).wolf ? s.lovers : [];
  if (cross.length && alive.length === 2 && alive.every((p) => cross.includes(p.id))) return ['doi', cross];
  const w = alive.filter((p) => p.wolf).length;
  if (w === 0) return ['dan', s.players.filter((p) => !p.wolf && !cross.includes(p.id)).map((p) => p.id)];
  if (w >= alive.length - w) return ['soi', s.players.filter((p) => p.wolf && !cross.includes(p.id)).map((p) => p.id)];
  return null;
}

function proceed(s, now) {
  if (s.queue.length) { s.phase = s.queue[0].kind; return s; }
  const win = checkWin(s);
  if (win) { [s.winTeam, s.winner] = win; s.phase = 'end'; return s; }
  if (s.after === 'day') {
    s.day++;
    if (!s.elder) { s.phase = 'elect'; s.votes = {}; } else startTalk(s, now);
  } else {
    s.night++;
    s.phase = 'night';
    s.acts = {};
    s.drugged = null;
  }
  return s;
}

function startTalk(s, now) {
  s.phase = 'talk';
  s.votes = {};
  s.until = now + s.talkMs;
}

function resolveNight(s, now) {
  const victim = consensus(s);
  const find = (role) => s.players.find((p) => p.role === role && p.alive);
  const act = (role) => s.acts[find(role)?.id] || {};
  const cupid = act('cupid');
  if (s.night === 1 && cupid.targets) s.lovers = cupid.targets;
  const guarded = act('baove').target || null;
  s.guardLast = guarded;
  const witch = act('phuthuy');
  const saved = !!(witch.save && victim);
  if (saved) s.potions.save = false;
  if (witch.poison) s.potions.poison = false;
  const curse = !!(victim && act('soinguyen').curse && !s.curseUsed);
  if (curse) s.curseUsed = true;
  s.news = { deaths: [] };
  s.drugged = act('soigayme').drug || null;
  const deaths = [];
  if (victim && guarded !== victim && !saved) {
    if (curse) Object.assign(P(s, victim), { role: 'soi', wolf: true, converted: true });
    else deaths.push(victim);
  }
  if (witch.poison) deaths.push(witch.poison);
  s.acts = {};
  s.after = 'day';
  killAll(s, deaths);
  return proceed(s, now);
}

const voters = (s) => s.players.filter((p) => p.alive && (s.phase === 'elect' || p.id !== s.drugged)).map((p) => p.id);

function tally(s) {
  const n = {};
  Object.values(s.votes).forEach((t) => { if (t) n[t] = (n[t] || 0) + 1; });
  const max = Math.max(0, ...Object.values(n));
  return { n, max, top: Object.keys(n).filter((k) => n[k] === max) };
}

function resolveVotes(s, now, rng) {
  const { max, top } = tally(s);
  if (s.phase === 'elect') {
    const pool = max ? top : aliveIds(s);
    s.elder = pool[Math.floor(rng() * pool.length)];
    startTalk(s, now);
    return s;
  }
  s.news = { deaths: [], lynch: true };
  s.after = 'night';
  if (!max) return proceed(s, now);
  if (top.length > 1) { s.phase = 'tie'; s.tieIds = top; return s; }
  killAll(s, top);
  return proceed(s, now);
}

// ---------- Hành động ----------
const fail = (error) => ({ ok: false, error });

export function apply(state, id, action, rng = Math.random, now = Date.now()) {
  if (state.winner) return fail('Ván đã kết thúc.');
  const me = P(state, id);
  if (!me) return fail('Bạn không chơi ván này.');
  const s = structuredClone(state);
  const type = action?.type;
  const valid = (t) => typeof t === 'string' && isAlive(s, t);

  if (type === 'skip-talk') {
    if (id !== s.hostId || s.phase !== 'talk') return fail('Chỉ chủ bàn mới bỏ qua thảo luận được.');
    s.phase = 'vote';
    s.until = null;
    return { ok: true, state: s };
  }

  if (type === 'pick') {
    const t = action.target ?? null;
    if (s.phase === 'tie') {
      if (id !== s.elder || !s.tieIds.includes(t)) return fail('Già làng chọn 1 người trong số người hoà phiếu.');
      s.tieIds = null;
      killAll(s, [t]);
      return { ok: true, state: proceed(s, now) };
    }
    const q = s.queue[0];
    if (!q || s.phase !== q.kind || q.id !== id) return fail('Chưa tới lượt bạn chọn.');
    if (q.kind === 'hunter') {
      if (t !== null && !valid(t)) return fail('Chọn người còn sống.');
      s.queue.shift();
      if (t) killAll(s, [t]);
    } else {
      if (!valid(t)) return fail('Chọn người kế nhiệm còn sống.');
      s.queue.shift();
      s.elder = t;
    }
    return { ok: true, state: proceed(s, now) };
  }

  if (!me.alive) return fail('Bạn đã chết.');

  if (type === 'vote') {
    if (s.phase !== 'elect' && s.phase !== 'vote') return fail('Chưa tới lúc bỏ phiếu.');
    if (!voters(s).includes(id)) return fail('Bạn bị gây mê, hôm nay không được bỏ phiếu.');
    const t = action.target ?? null;
    if (t !== null && !valid(t)) return fail('Chọn người còn sống.');
    s.votes[id] = t;
    if (voters(s).every((v) => v in s.votes)) return { ok: true, state: resolveVotes(s, now, rng) };
    return { ok: true, state: s };
  }

  if (type !== 'night' || s.phase !== 'night') return fail('Thao tác không hợp lệ.');
  const prev = s.acts[id];
  const a = { ...(prev || {}) };
  if (me.wolf) {
    if (!valid(action.target) || P(s, action.target).wolf) return fail('Chọn 1 người không phải Sói.');
    const agreed = consensus(s); // đã thống nhất thì khoá, để Phù thuỷ thấy đúng người bị cắn
    if (agreed && action.target !== agreed) return fail('Bầy Sói đã thống nhất, không đổi người được nữa.');
    a.target = action.target;
    if (me.role === 'soinguyen' && action.curse !== undefined) {
      if (action.curse && s.curseUsed) return fail('Bạn đã dùng quyền nguyền rồi.');
      a.curse = !!action.curse;
    }
    if (me.role === 'soigayme' && action.drug !== undefined) {
      if (action.drug !== null && !valid(action.drug)) return fail('Chọn người còn sống để gây mê.');
      a.drug = action.drug;
    }
  } else {
    if (prev) return fail('Bạn đã chọn rồi.');
    const r = me.role;
    if (r === 'tientri') {
      if (!valid(action.target) || action.target === id) return fail('Chọn 1 người để soi.');
      a.target = action.target;
      (s.seerLog[id] ||= []).push({ target: a.target, wolf: P(s, a.target).wolf, night: s.night });
    } else if (r === 'baove') {
      if (!valid(action.target) || action.target === s.guardLast) return fail('Không che cùng 1 người 2 đêm liền.');
      a.target = action.target;
    } else if (r === 'cupid' && s.night === 1) {
      const t = action.targets;
      if (!Array.isArray(t) || t.length !== 2 || t[0] === t[1] || !t.every(valid)) return fail('Chọn 2 người để ghép đôi.');
      a.targets = [...t];
    } else if (r === 'phuthuy') {
      const victim = consensus(s);
      if (!victim) return fail('Chờ bầy Sói chọn xong đã.');
      if (action.save && !s.potions.save) return fail('Bình cứu đã dùng.');
      if (action.poison && (!s.potions.poison || !valid(action.poison))) return fail('Không dùng được bình độc.');
      a.save = !!action.save;
      a.poison = action.poison || null;
    } else {
      if (action.ready !== true) return fail('Bấm "Tôi đã sẵn sàng".');
      a.ready = true;
    }
  }
  s.acts[id] = a;
  if (s.players.filter((p) => p.alive).every((p) => nightDone(s, p))) return { ok: true, state: resolveNight(s, now) };
  return { ok: true, state: s };
}

export const nextTimer = (s) => (s.phase === 'talk' && !s.winner ? s.until : null);

export function onTimer(state, now) {
  if (state.phase !== 'talk' || now < state.until) return state;
  return { ...state, phase: 'vote', until: null };
}

// Bỏ qua người chậm/offline: phần còn thiếu tính là "không làm gì".
export function forceSkip(state, rng = Math.random, now = Date.now()) {
  if (state.winner) return state;
  const s = structuredClone(state);
  if (s.phase === 'night') return resolveNight(s, now);
  if (s.phase === 'elect' || s.phase === 'vote') return resolveVotes(s, now, rng);
  if (s.phase === 'talk') { s.phase = 'vote'; s.until = null; return s; }
  if (s.phase === 'tie') { const t = s.tieIds[Math.floor(rng() * s.tieIds.length)]; s.tieIds = null; killAll(s, [t]); return proceed(s, now); }
  const q = s.queue.shift();
  if (q?.kind === 'successor') { const pool = aliveIds(s); s.elder = pool[Math.floor(rng() * pool.length)] || null; }
  return proceed(s, now);
}

function waitingOn(s) {
  if (s.phase === 'night') return s.players.filter((p) => p.alive && !nightDone(s, p)).map((p) => p.id);
  if (s.phase === 'elect' || s.phase === 'vote') return voters(s).filter((v) => !(v in s.votes));
  if (s.phase === 'tie') return [s.elder];
  if (s.queue[0]) return [s.queue[0].id];
  return [];
}

export function viewFor(s, id) {
  const p = P(s, id);
  if (!p) return null;
  const v = {
    phase: s.phase, night: s.night, day: s.day, hostId: s.hostId,
    me: { id, role: p.role, alive: p.alive, wolf: p.wolf, converted: !!p.converted },
    players: s.players.map((x) => ({ id: x.id, alive: x.alive })),
    elder: s.elder, drugged: s.drugged, news: s.news, until: s.until,
    tieIds: s.tieIds, pick: s.queue[0] || null, winner: s.winner, winTeam: s.winTeam,
    myAct: s.phase === 'night' ? s.acts[id] || null : null,
  };
  if (s.phase === 'elect' || s.phase === 'vote') { v.votes = tally(s).n; v.myVote = s.votes[id]; }
  // Danh sách người đang được chờ ban đêm chỉ gửi cho chủ bàn (để bỏ qua người offline).
  if (s.phase !== 'night' || id === s.hostId) v.waitingOn = waitingOn(s);
  if (!p.alive || s.winner) v.roles = Object.fromEntries(s.players.map((x) => [x.id, x.role]));
  if (s.lovers?.includes(id)) v.lover = s.lovers.find((x) => x !== id);
  if (p.alive && p.wolf) {
    v.wolves = { ids: s.players.filter((x) => x.wolf).map((x) => x.id), picks: {}, curseUsed: s.curseUsed };
    wolves(s).forEach((w) => { v.wolves.picks[w.id] = s.acts[w.id]?.target || null; });
  }
  if (p.role === 'tientri') v.seer = s.seerLog[id] || [];
  if (p.role === 'baove') v.guardLast = s.guardLast;
  if (p.role === 'phuthuy' && p.alive) v.witch = { victim: s.phase === 'night' ? consensus(s) : null, potions: s.potions };
  return v;
}
