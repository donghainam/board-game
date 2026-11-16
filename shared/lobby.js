// Phòng chờ dùng chung: biệt danh, tạo/vào phòng, danh sách ghế, QR. Không biết luật game.
import { qrcode } from 'https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.mjs';
import { makeCode, getPlayerId, getSecret, hostRoom, joinRoom } from './net.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
export { store };

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter((x) => x != null && x !== false));
  return e;
}

export function toast(text) {
  const t = el('div', { class: 'toast', role: 'status' }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

function keepAwake() {
  if (!navigator.wakeLock) return;
  const ask = () => navigator.wakeLock.request('screen').catch(() => {});
  ask();
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && ask());
}

const roomLink = (code) => location.origin + location.pathname + '?phong=' + code;

function askName(root) {
  return new Promise((resolve) => {
    const input = el('input', { class: 'input', maxlength: 20, placeholder: 'Ví dụ: Nam', autocomplete: 'nickname' });
    input.value = store.get('bg.name') || '';
    const go = () => {
      const n = input.value.trim().slice(0, 20);
      if (!n) return input.focus();
      store.set('bg.name', n);
      resolve(n);
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
    root.replaceChildren(el('div', { class: 'card-tile stack' },
      el('h2', {}, 'Bạn tên gì?'), input,
      el('button', { class: 'btn btn-primary', onclick: go }, 'Tiếp tục')));
    input.focus();
  });
}

function chooseRoom(root, gameCode, name) {
  return new Promise((resolve) => {
    const input = el('input', { class: 'input code-input', maxlength: 5, placeholder: 'Mã phòng', autocapitalize: 'characters' });
    const err = el('div', { class: 'muted', role: 'alert' });
    const join = () => {
      const c = input.value.trim().toUpperCase();
      if (!/^[A-Z0-9]{5}$/.test(c) || c[0] !== gameCode) { err.textContent = 'Mã không đúng.'; return; }
      resolve({ role: 'client', code: c });
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && join());
    root.replaceChildren(el('div', { class: 'stack' },
      el('div', { class: 'card-tile stack' },
        el('h2', {}, 'Tạo phòng mới'),
        el('p', { class: 'muted' }, 'Bạn làm chủ bàn, rủ cả hội quét mã vào chơi.'),
        el('button', { class: 'btn btn-primary', onclick: () => resolve({ role: 'host', code: makeCode(gameCode) }) }, 'Tạo phòng')),
      el('div', { class: 'card-tile stack' },
        el('h2', {}, 'Vào phòng bạn bè'), input, err,
        el('button', { class: 'btn', onclick: join }, 'Vào phòng')),
      el('p', { class: 'muted' }, 'Bạn là ', el('b', {}, name), ' · ',
        el('a', { href: '#', onclick: (e) => { e.preventDefault(); store.set('bg.name', null); location.reload(); } }, 'đổi tên'))));
  });
}

// Trả về Session ngay khi đã mở/vào phòng. Màn chờ và nút "Bắt đầu" do game tự vẽ (dùng roomInfo).
export async function mountLobby(root, { gameCode, maxPlayers }) {
  const name = store.get('bg.name') || await askName(root);
  const me = { id: getPlayerId(), name };
  const url = new URL(location.href);
  const fromUrl = (url.searchParams.get('phong') || '').toUpperCase();
  const hosting = store.get('bg.hosting.' + gameCode);
  let pick;
  if (/^[A-Z0-9]{5}$/.test(fromUrl) && fromUrl !== hosting) pick = { role: 'client', code: fromUrl };
  else if (hosting) pick = { role: 'host', code: hosting, resumed: true };
  else pick = await chooseRoom(root, gameCode, name);

  const listeners = [];
  const session = {
    role: pick.role, code: pick.code, me, seats: [], resumed: !!pick.resumed,
    onSeats(f) { listeners.push(f); return () => listeners.splice(listeners.indexOf(f) >>> 0, 1); },
  };
  const changed = () => [...listeners].forEach((f) => f(session.seats));

  if (pick.role === 'host') {
    root.replaceChildren(el('p', { class: 'muted' }, 'Đang mở phòng…'));
    let secrets = {};
    try { secrets = JSON.parse(store.get('bg.secrets.' + pick.code)) || {}; } catch {}
    const giveUp = () => { store.set('bg.hosting.' + gameCode, null); location.replace(location.pathname); };
    const onRetry = (n) => root.replaceChildren(el('div', { class: 'card-tile stack' },
      el('p', {}, `Đang mở lại phòng ${pick.code} (thử lần ${n})…`),
      el('p', { class: 'muted' }, 'Mã phòng này đang bị giữ: có thể phòng vẫn mở ở tab/máy khác, hoặc vừa tải lại trang (máy chủ cần ~1 phút để nhả mã).'),
      el('button', { class: 'btn', onclick: giveUp }, 'Bỏ phòng này, tạo phòng mới')));
    try { session.host = await hostRoom(pick.code, { hostId: me.id, secrets, onRetry }); } catch (e) {
      // Giữ bg.hosting: lỗi có thể chỉ tạm thời (broker chập chờn, tab host khác còn mở).
      root.replaceChildren(el('div', { class: 'card-tile stack' },
        el('p', {}, `Chưa mở lại được phòng ${pick.code} (${e.type || e.message}). Nếu phòng đang mở ở tab khác, hãy đóng tab đó.`),
        el('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'Thử lại'),
        el('button', { class: 'btn', onclick: giveUp }, 'Bỏ phòng này, tạo phòng mới')));
      throw e;
    }
    store.set('bg.hosting.' + gameCode, pick.code);
    history.replaceState(null, '', location.pathname);
    let saved = null;
    try { saved = JSON.parse(store.get('bg.seats.' + pick.code)); } catch {}
    session.seats = (saved || [{ id: me.id, name }]).map((s) => ({ ...s, online: s.id === me.id || !!s.bot }));
    const h = session.host;
    const publish = () => {
      store.set('bg.seats.' + pick.code, JSON.stringify(session.seats.map(({ id, name, bot }) => ({ id, name, bot }))));
      h.broadcast({ t: 'seats', seats: session.seats });
      changed();
    };
    h.onHello((pid, n) => {
      store.set('bg.secrets.' + pick.code, JSON.stringify(secrets));
      const seat = session.seats.find((s) => s.id === pid);
      if (seat) Object.assign(seat, { name: n, online: true });
      else if (session.seats.length >= maxPlayers) {
        h.send(pid, { t: 'full' });
        setTimeout(() => h.drop(pid), 500);
        return;
      } else session.seats.push({ id: pid, name: n, online: true });
      publish();
    });
    h.onLeave((pid) => {
      const seat = session.seats.find((s) => s.id === pid);
      if (seat) { seat.online = false; publish(); }
    });
    session.kick = (pid) => {
      session.seats = session.seats.filter((s) => s.id !== pid);
      h.send(pid, { t: 'kicked' });
      setTimeout(() => h.drop(pid), 500);
      publish();
    };
    // Ghế bot: máy chủ bàn tự đánh thay (game nào có bot mới dùng).
    session.addBot = () => {
      if (session.seats.length >= maxPlayers) return;
      const n = session.seats.filter((s) => s.bot).length + 1;
      session.seats.push({ id: 'bot-' + makeCode('x').slice(1) + n, name: `🤖 Bot ${n}`, online: true, bot: true });
      publish();
    };
    session.closeRoom = () => {
      store.set('bg.hosting.' + gameCode, null);
      store.set('bg.seats.' + pick.code, null);
      store.set('bg.secrets.' + pick.code, null);
      h.broadcast({ t: 'closed' });
      setTimeout(() => { h.close(); location.replace(location.pathname); }, 300);
    };
    publish();
  } else {
    const c = joinRoom(pick.code, { playerId: me.id, secret: getSecret(), name });
    session.client = c;
    const stop = (msg) => {
      c.close();
      root.replaceChildren(el('div', { class: 'card-tile stack' }, el('p', {}, msg),
        el('a', { class: 'btn btn-primary', href: location.pathname }, 'Về màn chọn phòng')));
    };
    c.onMessage((m) => {
      if (m.t === 'seats' && Array.isArray(m.seats)) { session.seats = m.seats; changed(); }
      else if (m.t === 'full') stop('Phòng đã đủ người.');
      else if (m.t === 'kicked') stop('Chủ bàn đã mời bạn ra khỏi phòng.');
      else if (m.t === 'closed') stop('Chủ bàn đã đóng phòng.');
      else if (m.t === 'denied') stop('Phòng không nhận máy này (ghế đã có người khác giữ). Nhờ chủ bàn "Mời ra" ghế cũ rồi vào lại.');
    });
  }
  keepAwake();
  return session;
}

// Khối thông tin phòng: mã, QR, link, danh sách ghế. Host có nút "Mời ra" khi canKick.
export function roomInfo(session, { canKick = false } = {}) {
  const link = roomLink(session.code);
  const qr = qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  const qrBox = el('div', { class: 'qr', 'aria-label': 'Mã QR vào phòng' });
  qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); // SVG do thư viện sinh từ link của mình
  const list = el('ul', { class: 'seats stack', style: 'list-style:none;padding:0;margin:0' });
  const draw = () => list.replaceChildren(...session.seats.map((s) => el('li', { class: 'row' },
    el('span', { class: 'dot' + (s.online ? ' on' : '') }), el('span', {}, s.name),
    s.id === session.me.id ? el('span', { class: 'badge' }, 'bạn') : null,
    canKick && session.role === 'host' && s.id !== session.me.id
      ? el('button', { class: 'btn btn-small', onclick: () => session.kick(s.id) }, 'Mời ra') : null)));
  draw();
  const off = session.onSeats(() => (list.isConnected ? draw() : off()));
  return el('div', { class: 'card-tile stack' },
    el('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' },
      el('div', { class: 'stack', style: 'gap:6px' },
        el('span', { class: 'muted' }, 'Mã phòng'), el('span', { class: 'code-big' }, session.code),
        el('button', { class: 'btn btn-small', onclick: () => (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Đã copy link'), () => toast(link)) }, 'Copy link')),
      qrBox),
    list);
}
