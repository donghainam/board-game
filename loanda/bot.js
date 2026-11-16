// Bot đơn giản cho Loạn Đả Viễn Tây: chỉ nhìn đúng góc nhìn (view) của nó, trả về 1 hành động hợp lệ.
import { GUN_RANGE, DODGE_EQ } from './engine.js';

const KIND = { kinhvien: 'ongnhom', chonap: 'ngua' }; // cùng loại trang bị
const kindOf = (t) => KIND[t] || t;

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
  if (v.phase === 'scout') return { type: 'scout', bottom: false };
  if (v.phase === 'store') return { type: 'store', card: v.store.cards[0].id };
  if (v.phase === 'react') {
    const pd = v.pending;
    const need = pd.kind === 'duel' ? 'ban' : pd.need;
    const swap = me.char === 'haisung' ? { ne: 'ban', ban: 'ne' }[need] : null;
    const c = need === 'ne' && me.char === 'khonglo' ? null
      : me.hand.find((x) => x.t === need) || (need === 'ne' && me.hand.find((x) => x.t === 'lach')) || me.hand.find((x) => x.t === swap);
    const hat = need === 'ne' && v.players.find((p) => p.id === me.id).eq.find((x) => DODGE_EQ.includes(x.t));
    const use = c || hat;
    return use ? { type: 'respond', card: use.id } : { type: 'respond' };
  }
  const self = v.players.find((p) => p.id === me.id);
  if (v.phase === 'discard') return { type: 'discard', cards: me.hand.slice(0, me.hand.length - me.handLimit).map((c) => c.id) };

  const H = (t) => me.hand.find((c) => c.t === t);
  const play = (c, target) => ({ type: 'play', card: c.id, ...(target ? { target } : {}) });
  const equipped = (pred) => self.eq.some(pred);
  if (self.hp < self.max && H('bangbo')) return play(H('bangbo'));
  for (const t of ['tiepte', 'tieptelon', 'chophien']) if (H(t)) return play(H(t));
  const gun = me.hand.find((c) => GUN_RANGE[c.t]);
  if (gun && !equipped((c) => GUN_RANGE[c.t])) return play(gun);
  for (const t of ['ngua', 'ongnhom', 'kinhvien', 'chonap', 'thung', 'sunggiau', 'binhnuoc', 'xetho', 'dao', 'sungbo', 'oquay', 'daibac', 'vucong', 'ngutram', ...DODGE_EQ]) {
    if (H(t) && !equipped((c) => kindOf(c.t) === kindOf(t))) return play(H(t));
  }
  const E = (t) => self.eq.find((c) => c.t === t);
  const use = (c, target) => ({ type: 'use', card: c.id, ...(target ? { target } : {}) });
  if (self.hp < self.max && E('binhnuoc')) return use(E('binhnuoc'));
  if (E('ngutram')) return use(E('ngutram'));
  if (E('daibac') && enemies(v).length) return use(E('daibac'));
  if (E('sungbo') && enemies(v)[0]) return use(E('sungbo'), enemies(v)[0].id);
  const near = enemies(v).find((p) => p.dist === 1);
  if (near && H('dam')) return play(H('dam'), near.id);
  if (near && E('sunggiau')) return use(E('sunggiau'), near.id);
  const inRange = enemies(v).find((p) => p.dist && p.dist <= me.range);
  if (inRange && E('dao')) return use(E('dao'), inRange.id);
  if (inRange && E('oquay')) return use(E('oquay'), inRange.id);
  const free = (p) => me.char === 'laoluyen' && p.dist === 1;
  {
    const shot = me.hand.find((c) => c.t === 'ban' || (c.t === 'ne' && me.char === 'haisung'));
    const target = enemies(v).find((p) => p.dist && p.dist <= me.range && (free(p) || v.bangUsed < me.bangLimit));
    if (shot && target) return play(shot, target.id);
  }
  return { type: 'end' };
}
