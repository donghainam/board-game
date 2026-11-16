// Bot đơn giản cho Loạn Đả Viễn Tây: chỉ nhìn đúng góc nhìn (view) của nó, trả về 1 hành động hợp lệ.
import { GUN_RANGE } from './engine.js';

// Ai là "địch" theo vai của bot (bot chỉ biết vai công khai: Cảnh sát trưởng và người đã chết).
function enemies(v) {
  const role = v.me.role;
  const others = v.players.filter((p) => p.alive && p.id !== v.me.id);
  const cst = others.find((p) => p.role === 'cst');
  if (role === 'cuop') return cst ? [cst, ...others.filter((p) => p !== cst)] : others;
  if (role === 'phanboi') return others.length > 1 ? others.filter((p) => p !== cst) : others;
  return others.filter((p) => p !== cst); // Cảnh sát trưởng / Phó: không bắn Cảnh sát trưởng
}

export function botAction(v) {
  const me = v.me;
  if (v.phase === 'pick') return { type: 'pick', char: me.offer[0] };
  if (v.phase === 'steal') return { type: 'steal', target: null };
  if (v.phase === 'react') {
    const pd = v.pending;
    const need = pd.kind === 'duel' ? 'ban' : pd.need;
    const swap = me.char === 'haisung' ? { ne: 'ban', ban: 'ne' }[need] : null;
    const c = me.hand.find((x) => x.t === need) || me.hand.find((x) => x.t === swap);
    return c ? { type: 'respond', card: c.id } : { type: 'respond' };
  }
  const self = v.players.find((p) => p.id === me.id);
  if (v.phase === 'discard') return { type: 'discard', cards: me.hand.slice(0, me.hand.length - self.hp).map((c) => c.id) };

  const H = (t) => me.hand.find((c) => c.t === t);
  const play = (c, target) => ({ type: 'play', card: c.id, ...(target ? { target } : {}) });
  const equipped = (pred) => self.eq.some(pred);
  if (self.hp < self.max && H('bangbo')) return play(H('bangbo'));
  for (const t of ['tiepte', 'tieptelon']) if (H(t)) return play(H(t));
  const gun = me.hand.find((c) => GUN_RANGE[c.t]);
  if (gun && !equipped((c) => GUN_RANGE[c.t])) return play(gun);
  for (const t of ['ngua', 'ongnhom', 'thung']) if (H(t) && !equipped((c) => c.t === t)) return play(H(t));
  if (v.bangUsed < me.bangLimit) {
    const shot = me.hand.find((c) => c.t === 'ban' || (c.t === 'ne' && me.char === 'haisung'));
    const target = enemies(v).find((p) => p.dist && p.dist <= me.range);
    if (shot && target) return play(shot, target.id);
  }
  return { type: 'end' };
}
