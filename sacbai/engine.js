// Luật Sắc Bài — thuần logic. Lá = {c: màu 'r'|'y'|'g'|'b' hoặc 'k' (đen), v: '1'..'9'|'+2'|'chan'|'doi'|'+4', id}.

export const COLORS = ['r', 'y', 'g', 'b'];
const HAND = 6;

export function buildDeck() {
  const d = [];
  for (const c of COLORS) {
    for (let n = 1; n <= 9; n++) d.push({ c, v: String(n) }, { c, v: String(n) });
    d.push({ c, v: '+2' }, { c, v: '+2' }, { c, v: 'chan' }, { c, v: 'chan' });
  }
  for (let i = 0; i < 4; i++) d.push({ c: 'k', v: 'doi' }, { c: 'k', v: '+4' });
  return d.map((card, id) => ({ ...card, id }));
}

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const isNumber = (card) => /^[1-9]$/.test(card.v);

export function start(ids, { lastWinner } = {}, rng = Math.random) {
  // id gán sau khi trộn: id không suy ra được màu/số của lá.
  const deck = shuffle(buildDeck(), rng).map((c, id) => ({ ...c, id }));
  const players = ids.map((id) => ({ id, hand: deck.splice(0, HAND) }));
  let i = deck.findIndex(isNumber); // lá mở đầu luôn là lá số
  const [top] = deck.splice(i, 1);
  return {
    players, deck, discard: [top], color: top.c, turn: Math.max(0, ids.indexOf(lastWinner)),
    penalty: null, drew: false, drawnId: null, unannounced: null, winner: null,
  };
}

function canPlay(s, card) {
  if (s.penalty) return card.v === '+4' || (s.penalty.kind === '+2' && card.v === '+2');
  return card.c === 'k' || card.c === s.color || card.v === s.discard.at(-1).v;
}

// Bốc n lá cho người pi (mutate s). Chồng bài hết thì trộn lại bài đã đánh, chừa lá trên cùng.
function drawCards(s, pi, n, rng) {
  const got = [];
  for (let k = 0; k < n; k++) {
    if (!s.deck.length) {
      if (s.discard.length <= 1) break;
      s.deck = shuffle(s.discard.slice(0, -1), rng);
      s.discard = s.discard.slice(-1);
    }
    const card = s.deck.pop();
    s.players[pi].hand.push(card);
    got.push(card);
  }
  return got;
}

function advance(s, step = 1) {
  s.turn = (s.turn + step) % s.players.length;
  s.drew = false;
  s.drawnId = null;
}

const fail = (error) => ({ ok: false, error });

export function apply(state, id, action, rng = Math.random) {
  if (state.winner) return fail('Ván đã kết thúc.');
  const pi = state.players.findIndex((p) => p.id === id);
  if (pi < 0) return fail('Bạn không chơi ván này.');
  const s = structuredClone(state);
  const type = action?.type;

  if (type === 'bao') {
    if (s.unannounced !== id) return fail('Không cần báo lúc này.');
    s.unannounced = null;
    return { ok: true, state: s };
  }
  if (type === 'bat') {
    const t = s.unannounced;
    if (!t || action.target !== t || t === id) return fail('Không bắt được.');
    drawCards(s, s.players.findIndex((p) => p.id === t), 2, rng);
    s.unannounced = null;
    return { ok: true, state: s };
  }

  if (s.turn !== pi) return fail('Chưa tới lượt bạn.');
  if (!['play', 'draw', 'pass'].includes(type)) return fail('Thao tác không hợp lệ.');
  if (s.unannounced && s.unannounced !== id) s.unannounced = null; // người kế đã đi → hết quyền Bắt
  const me = s.players[pi];

  if (type === 'pass') {
    if (!s.drew) return fail('Phải bốc bài trước khi qua.');
    advance(s);
    return { ok: true, state: s };
  }
  if (type === 'draw') {
    if (s.drew) return fail('Bạn đã bốc rồi.');
    if (s.penalty) {
      drawCards(s, pi, s.penalty.n, rng);
      s.penalty = null;
      advance(s);
      return { ok: true, state: s };
    }
    const [card] = drawCards(s, pi, 1, rng);
    if (card && canPlay(s, card)) { s.drew = true; s.drawnId = card.id; } else advance(s);
    return { ok: true, state: s };
  }

  const idx = me.hand.findIndex((c) => c.id === action.card);
  if (idx < 0) return fail('Bạn không có lá này.');
  const card = me.hand[idx];
  if (s.drew && card.id !== s.drawnId) return fail('Chỉ được đánh lá vừa bốc.');
  if (!canPlay(s, card)) return fail(s.penalty ? `Phải chặn bằng ${s.penalty.kind === '+4' ? '+4' : '+2 hoặc +4'}, hoặc bốc phạt.` : 'Lá này không hợp màu/số.');
  if (card.c === 'k' && !COLORS.includes(action.color)) return fail('Hãy chọn màu.');
  me.hand.splice(idx, 1);
  s.discard.push(card);
  s.color = card.c === 'k' ? action.color : card.c;
  if (card.v === '+2' || card.v === '+4') s.penalty = { n: (s.penalty?.n || 0) + Number(card.v.slice(1)), kind: card.v };
  if (!me.hand.length) { s.winner = id; return { ok: true, state: s }; }
  if (me.hand.length === 1) s.unannounced = id;
  advance(s, card.v === 'chan' ? 2 : 1);
  return { ok: true, state: s };
}

export function viewFor(s, id) {
  const me = s.players.find((p) => p.id === id);
  if (!me) return null;
  return {
    me: { id, hand: me.hand },
    others: s.players.filter((p) => p.id !== id).map((p) => ({ id: p.id, count: p.hand.length })),
    order: s.players.map((p) => p.id),
    top: s.discard.at(-1), color: s.color, penalty: s.penalty, turn: s.players[s.turn].id,
    drew: s.drew, drawnId: s.players[s.turn].id === id ? s.drawnId : null, unannounced: s.unannounced, deckCount: s.deck.length, winner: s.winner,
  };
}

// Bỏ lượt hộ người offline: đang bị phạt thì bốc phạt, đã bốc thì qua, chưa thì bốc 1 lá rồi chuyển lượt.
export function forceSkip(state, rng = Math.random) {
  if (state.winner) return state;
  const s = structuredClone(state);
  if (s.unannounced && s.unannounced !== s.players[s.turn].id) s.unannounced = null;
  if (s.penalty) { drawCards(s, s.turn, s.penalty.n, rng); s.penalty = null; } else if (!s.drew) drawCards(s, s.turn, 1, rng);
  advance(s);
  return s;
}
