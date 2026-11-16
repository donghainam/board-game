// Vòng lặp chủ bàn dùng chung cho mọi game: host giữ state + chạy engine, gửi góc nhìn riêng cho từng máy.
// Mỗi game chỉ cung cấp engine thuần và hàm vẽ bàn chơi.
import { mountLobby, roomInfo, el, toast, store } from './lobby.js';

export async function runTable({
  gameCode, minPlayers, maxPlayers, maxSeats = maxPlayers,
  engine, pickPlayers = (ids) => ids, renderTable, resultOf, setup = null,
}) {
  const root = document.getElementById('app');
  const net = document.getElementById('net');
  const session = await mountLobby(root, { gameCode, minPlayers, maxPlayers: maxSeats });
  const me = session.me.id;
  const isHost = session.role === 'host';
  const nameOf = (id) => session.seats.find((s) => s.id === id)?.name || 'Người chơi';
  const online = (id) => !!session.seats.find((s) => s.id === id)?.online;

  let screen = { t: 'lobby', scores: {} };
  let pending = false; // đã gửi nước đi, chờ host trả lời → chặn bấm 2 lần
  let offset = 0; // giờ host − giờ máy này, để đồng hồ đếm ngược không lệch giữa các điện thoại

  // ---------------- Host ----------------
  let state = null, scores = {}, lastWinner = null, round = 0, config = setup?.initial ?? null;
  const KEY = 'bg.host.' + session.code;

  function payload(id) {
    const now = Date.now();
    if (!state) return { t: 'lobby', scores, now };
    const v = engine.viewFor(state, id);
    if (v) return { t: 'view', view: v, scores, now };
    return state.winner ? { t: 'lobby', scores, now } : { t: 'wait', scores, now };
  }

  function setState(next) {
    if (next.winner && !state?.winner) {
      const ws = [].concat(next.winner); // một người, hoặc cả một phe
      ws.forEach((w) => { scores[w] = (scores[w] || 0) + 1; });
      lastWinner = ws[0];
    }
    state = next;
    sync();
    schedule();
  }

  // Hẹn giờ do engine yêu cầu (vd cửa sổ Chặn 3 giây); chỉ host chạy.
  let timer = null;
  function schedule() {
    clearTimeout(timer);
    const at = state && engine.nextTimer?.(state);
    if (at == null) return;
    timer = setTimeout(() => { if (state) setState(engine.onTimer(state, Date.now())); }, Math.max(0, at - Date.now()));
  }

  function sync() {
    store.set(KEY, JSON.stringify({ state, scores, lastWinner, round, config }));
    session.seats.forEach((s) => s.id !== me && session.host.send(s.id, payload(s.id)));
    receive(payload(me));
  }

  function handle(id, action) {
    if (!state) return;
    let r;
    try { r = engine.apply(state, id, action); } catch { r = { ok: false, error: 'Thao tác không hợp lệ.' }; }
    if (!r.ok) {
      if (id === me) { pending = false; toast(r.error); render(); } else session.host.send(id, { t: 'err', error: r.error });
      return;
    }
    setState(r.state);
  }

  const players = () => pickPlayers(session.seats.filter((s) => s.online).map((s) => s.id));
  const canStart = () => { const n = players().length; return n >= minPlayers && n <= maxPlayers; };

  function startRound() {
    if (!canStart()) return toast(`Cần ${minPlayers}–${maxPlayers} người đang online.`);
    const err = engine.validate?.(players(), config);
    if (err) return toast(err);
    state = null;
    const s = engine.start(players(), { lastWinner, round, config });
    round++;
    setState(s);
  }

  function send(action) {
    if (pending) return;
    pending = true;
    if (isHost) handle(me, action); else session.client.send({ t: 'act', action });
    render();
  }

  function receive(m) {
    const prevTurn = screen.view?.turn;
    screen = m;
    pending = false;
    if (m.now) offset = m.now - Date.now();
    if (m.t === 'view' && m.view.turn === me && prevTurn !== me && navigator.userActivation?.hasBeenActive && navigator.vibrate) navigator.vibrate(60);
    render();
  }

  // ---------------- Vẽ ----------------
  function scoreBoard(sc) {
    const rows = session.seats.map((s) => [s, sc[s.id] || 0]).sort((a, b) => b[1] - a[1]);
    return el('div', { class: 'card-tile' }, el('h3', {}, 'Số ván thắng'),
      el('ul', { class: 'scores', style: 'list-style:none;padding:0;margin:0' },
        rows.map(([s, n]) => el('li', {}, el('span', {}, s.name), el('b', {}, String(n))))));
  }

  function lobbyScreen(result) {
    const parts = [];
    if (result) {
      const { title, reason = '', lines = [] } = resultOf(result, nameOf) || {};
      parts.push(el('div', { class: 'card-tile stack result' },
        el('h2', {}, title || `🏆 ${result.winner === me ? 'Bạn' : nameOf(result.winner)} thắng!`),
        el('p', { class: 'muted' }, reason),
        lines.length ? el('ul', {}, lines.map((t) => el('li', {}, t))) : null));
    }
    parts.push(roomInfo(session, { canKick: true }), scoreBoard(screen.scores || {}));
    if (isHost) {
      const n = players().length;
      if (setup) parts.push(setup.render(config, (c) => { config = c; sync(); }));
      parts.push(el('button', { class: 'btn btn-primary', disabled: !canStart(), onclick: startRound }, result ? 'Ván mới' : 'Bắt đầu'),
        el('p', { class: 'muted' }, minPlayers === maxPlayers
          ? `Cần ${minPlayers} người online (đang có ${n}).`
          : `Cần ${minPlayers}–${maxPlayers} người online (đang có ${n}).`),
        el('button', { class: 'btn', onclick: () => confirm('Đóng phòng? Bảng điểm sẽ mất.') && session.closeRoom() }, 'Đóng phòng'));
    } else parts.push(el('p', { class: 'muted', style: 'text-align:center' }, 'Chờ chủ bàn bắt đầu ván…'));
    return parts;
  }

  const api = {
    me, isHost, nameOf, online, send,
    get pending() { return pending; },
    hostNow: () => Date.now() + offset,
    rerender: () => render(),
  };

  function render() {
    let parts;
    if (screen.t === 'wait') {
      parts = [el('div', { class: 'card-tile' }, el('p', {}, 'Ván đang diễn ra. Bạn sẽ được vào chơi từ ván sau 🙌')),
        roomInfo(session), scoreBoard(screen.scores || {})];
    } else if (screen.t === 'view' && !screen.view.winner) {
      const v = screen.view;
      const stuck = (v.turn ? [v.turn] : v.waitingOn || []).filter((id) => id !== me && !online(id));
      const skip = engine.forceSkip && isHost && stuck.length
        ? el('button', { class: 'btn', onclick: () => { state && setState(engine.forceSkip(state, stuck)); } },
          v.turn ? `Bỏ lượt hộ ${nameOf(v.turn)} (đang offline)` : `Bỏ qua người đang offline (${stuck.map(nameOf).join(', ')})`)
        : null;
      // Lối thoát khi người chơi bỏ đi hẳn (vd Cờ tướng không có bỏ lượt hộ): huỷ ván, không tính điểm.
      const cancel = isHost
        ? el('button', { class: 'btn btn-small', style: 'align-self:center', onclick: () => { if (confirm('Huỷ ván này? Không ai được tính thắng.')) { state = null; sync(); } } }, 'Huỷ ván')
        : null;
      parts = [...renderTable(v, api), skip, cancel];
    } else parts = lobbyScreen(screen.t === 'view' ? screen.view : null);
    root.replaceChildren(...parts.filter(Boolean));
  }

  if (isHost) {
    try { ({ state = null, scores = {}, lastWinner = null, round = 0, config = config } = JSON.parse(store.get(KEY)) || {}); } catch {}
    session.host.onMessage((id, m) => {
      if (m.t === 'act') handle(id, m.action);
      else if (m.t === 'sync') session.host.send(id, payload(id));
    });
    session.onSeats(sync);
    sync();
    schedule();
  } else {
    session.client.onStatus((s) => {
      net.textContent = { connecting: 'đang kết nối…', connected: '● đã kết nối', reconnecting: 'mất kết nối, đang nối lại…', closed: '' }[s];
    });
    session.client.onMessage((m) => {
      if (m.t === 'err') { pending = false; toast(m.error); render(); }
      else if (m.t === 'view' || m.t === 'wait' || m.t === 'lobby') receive(m);
    });
    session.onSeats(() => render());
  }
  render();
}
