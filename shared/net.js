// Lớp mạng dùng chung: phòng chơi P2P qua PeerJS (window.Peer nạp từ CDN ở từng trang).
// Không biết gì về luật game: chỉ chuyển object JSON giữa host và các máy.

const PREFIX = 'bgchoi-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeCode(gameCode) {
  const r = crypto.getRandomValues(new Uint32Array(4));
  return gameCode + Array.from(r, (x) => ALPHA[x % ALPHA.length]).join('');
}

// crypto.randomUUID chỉ có ở HTTPS/localhost; getRandomValues chạy cả khi mở qua http://IP-LAN.
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

export function getPlayerId() {
  try {
    let id = localStorage.getItem('bg.playerId');
    if (!id) localStorage.setItem('bg.playerId', (id = randomId()));
    return id;
  } catch {
    return (getPlayerId.mem ||= randomId());
  }
}

const isObj = (d) => d && typeof d === 'object' && !Array.isArray(d);
// Heartbeat: PeerJS không báo 'close' khi máy kia tắt đột ngột (khoá màn hình, mất Wi-Fi).
const HB_EVERY = 3000, HB_DEAD = 9000;

function openPeer(id) {
  return new Promise((resolve, reject) => {
    const peer = new window.Peer(id);
    // Chỉ huỷ peer khi lỗi xảy ra TRƯỚC lúc mở; sau đó lỗi mạng để 'disconnected' → reconnect lo.
    const fail = (e) => { peer.destroy(); reject(e); };
    peer.once('error', fail);
    peer.once('open', () => { peer.off('error', fail); resolve(peer); });
  });
}

// Bí mật riêng của máy này, chỉ gửi trong 'hello'. playerId thì công khai (cả phòng đều thấy).
export function getSecret() {
  try {
    let s = localStorage.getItem('bg.secret');
    if (!s) localStorage.setItem('bg.secret', (s = randomId()));
    return s;
  } catch {
    return (getSecret.mem ||= randomId());
  }
}

// secrets: object playerId → secret, lobby tự lưu lại; ghế đã có chủ thì phải đúng secret mới vào được.
export async function hostRoom(code, { hostId = null, secrets = {} } = {}) {
  let peer;
  const deadline = Date.now() + 60000;
  for (;;) {
    try { peer = await openPeer(PREFIX + code); break; } catch (e) {
      // Host vừa tải lại trang: broker còn giữ id cũ một lúc → thử lại.
      if (e.type !== 'unavailable-id' || Date.now() > deadline) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  const conns = new Map();
  const seen = new Map();
  const fns = { hello: [], message: [], leave: [] };
  const emit = (k, ...a) => fns[k].forEach((f) => f(...a));

  peer.on('error', (e) => console.warn('peer', e?.type || e));
  peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
  peer.on('connection', (conn) => {
    let pid = null;
    conn.on('data', (d) => {
      if (!isObj(d)) return;
      if (pid && conns.get(pid) !== conn) return; // kết nối cũ đã bị thay/bỏ
      if (pid) seen.set(pid, Date.now());
      if (!pid) {
        const ok = d.t === 'hello' && typeof d.playerId === 'string' && d.playerId.length <= 64
          && typeof d.secret === 'string' && d.secret.length >= 16 && d.secret.length <= 64
          && d.playerId !== hostId && (!secrets[d.playerId] || secrets[d.playerId] === d.secret);
        if (!ok) { conn.send({ t: 'denied' }); setTimeout(() => conn.close(), 300); return; }
        secrets[d.playerId] = d.secret;
        pid = d.playerId;
        const old = conns.get(pid);
        conns.set(pid, conn);
        seen.set(pid, Date.now());
        if (old && old !== conn) old.close();
        emit('hello', pid, String(d.name || 'Khách').trim().slice(0, 20) || 'Khách');
        return;
      }
      if (d.t !== 'hb') emit('message', pid, d);
    });
    conn.on('close', () => {
      if (pid && conns.get(pid) === conn) { conns.delete(pid); emit('leave', pid); }
    });
  });

  const beat = setInterval(() => {
    const now = Date.now();
    conns.forEach((c, id) => {
      if (now - (seen.get(id) || 0) > HB_DEAD) { conns.delete(id); c.close(); emit('leave', id); }
      else if (c.open) c.send({ t: 'hb' });
    });
  }, HB_EVERY);

  return {
    code,
    onHello: (f) => fns.hello.push(f),
    onMessage: (f) => fns.message.push(f),
    onLeave: (f) => fns.leave.push(f),
    send(pid, msg) { const c = conns.get(pid); if (c?.open) c.send(msg); },
    broadcast(msg) { conns.forEach((c) => c.open && c.send(msg)); },
    drop(pid) { const c = conns.get(pid); conns.delete(pid); c?.close(); },
    close() { clearInterval(beat); peer.destroy(); },
  };
}

export function joinRoom(code, hello) {
  const fns = { message: [], status: [] };
  let peer = null, conn = null, timer = null, closed = false, delay = 1000, status = '', lastSeen = 0;
  const setStatus = (s) => { if (s !== status) { status = s; fns.status.forEach((f) => f(s)); } };

  function retry() {
    if (closed || timer) return;
    setStatus('reconnecting');
    timer = setTimeout(() => { timer = null; connect(); }, delay);
    delay = Math.min(delay * 2, 10000);
  }

  function ensurePeer() {
    if (peer && !peer.destroyed) {
      if (peer.disconnected) peer.reconnect();
      return peer.open ? Promise.resolve(peer) : new Promise((r) => peer.once('open', () => r(peer)));
    }
    peer = new window.Peer();
    peer.on('error', () => { conn = null; retry(); });
    peer.on('disconnected', () => { if (!closed && !peer.destroyed) peer.reconnect(); });
    return new Promise((r) => peer.once('open', () => r(peer)));
  }

  async function connect() {
    if (closed || conn?.open) return;
    if (!status) setStatus('connecting');
    const p = await ensurePeer();
    if (closed) return;
    const c = p.connect(PREFIX + code, { reliable: true });
    const guard = setTimeout(() => { if (!c.open) { c.close(); retry(); } }, 8000);
    c.on('open', () => {
      clearTimeout(guard);
      conn = c; delay = 1000; lastSeen = Date.now();
      c.send({ t: 'hello', ...hello });
      setStatus('connected');
    });
    c.on('data', (d) => {
      if (!isObj(d) || conn !== c) return;
      lastSeen = Date.now();
      if (d.t !== 'hb') fns.message.forEach((f) => f(d));
    });
    c.on('close', () => { clearTimeout(guard); if (conn === c) conn = null; retry(); });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !closed && !conn?.open) {
      clearTimeout(timer); timer = null; delay = 1000; connect();
    }
  });
  const beat = setInterval(() => {
    if (!conn?.open) return;
    if (Date.now() - lastSeen > HB_DEAD) { const c = conn; conn = null; c.close(); retry(); }
    else conn.send({ t: 'hb' });
  }, HB_EVERY);
  connect();

  return {
    onMessage: (f) => fns.message.push(f),
    onStatus: (f) => { fns.status.push(f); if (status) f(status); },
    send(msg) { if (conn?.open) conn.send(msg); },
    close() { closed = true; clearTimeout(timer); clearInterval(beat); setStatus('closed'); peer?.destroy(); },
  };
}
