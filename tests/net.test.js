import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

// Peer giả: chỉ đủ API mà net.js dùng.
class FakePeer extends EventEmitter {
  constructor(id) {
    super();
    this.id = id; this.destroyed = false; this.disconnected = false;
    FakePeer.last = this;
    setTimeout(() => this.emit('open', id), 0);
  }
  destroy() { this.destroyed = true; }
  reconnect() { this.disconnected = false; }
}
class FakeConn extends EventEmitter {
  constructor() { super(); this.open = true; this.sent = []; }
  send(m) { this.sent.push(m); }
  close() { this.open = false; this.emit('close'); }
}
globalThis.window = { Peer: FakePeer };

const { hostRoom } = await import('../shared/net.js');

test('lỗi mạng sau khi đã mở phòng không huỷ peer của host', async () => {
  const h = await hostRoom('TABCD');
  try {
    const peer = FakePeer.last;
    peer.emit('error', { type: 'network' });
    assert.equal(peer.destroyed, false);
  } finally { h.close(); }
});

test('không ai giả được playerId của người khác hoặc của host', async () => {
  const secrets = {};
  const h = await hostRoom('TABCE', { hostId: 'HOST', secrets });
  try {
  const hellos = [];
  h.onHello((pid) => hellos.push(pid));
  const peer = FakePeer.last;
  const open = (hello) => { const c = new FakeConn(); peer.emit('connection', c); c.emit('data', { t: 'hello', ...hello }); return c; };

  const a = open({ playerId: 'A', secret: 's-a-0123456789abcdef', name: 'A' });
  assert.deepEqual(hellos, ['A']);
  assert.equal(secrets.A, 's-a-0123456789abcdef');

  const fake = open({ playerId: 'A', secret: 'sai-0123456789abcdef', name: 'X' });
  assert.deepEqual(hellos, ['A']);          // không nhận
  assert.deepEqual(fake.sent, [{ t: 'denied' }]);
  assert.equal(a.open, true);               // kết nối thật vẫn giữ

  const fakeHost = open({ playerId: 'HOST', secret: 'x-0123456789abcdefgh', name: 'X' });
  assert.deepEqual(hellos, ['A']);

  const noSecret = open({ playerId: 'B', name: 'B' });
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(fake.open, false);
  assert.equal(fakeHost.open, false);
  assert.equal(noSecret.open, false);

  open({ playerId: 'A', secret: 's-a-0123456789abcdef', name: 'A' }); // A thật vào lại
  assert.deepEqual(hellos, ['A', 'A']);
  } finally { h.close(); }
});

test('mở phòng: báo tiến độ khi mã đang bị giữ, và không treo khi broker im lặng', async () => {
  // Lần đầu báo mã bị giữ, lần sau mở được
  let calls = 0;
  class Busy extends EventEmitter {
    constructor(id) { super(); this.id = id; this.destroyed = false; FakePeer.last = this;
      const n = calls++; setTimeout(() => (n === 0 ? this.emit('error', { type: 'unavailable-id' }) : this.emit('open', id)), 0); }
    destroy() { this.destroyed = true; }
  }
  globalThis.window.Peer = Busy;
  const tries = [];
  const h = await hostRoom('TBUSY', { onRetry: (n) => tries.push(n), retryDelay: 10 });
  h.close();
  assert.deepEqual(tries, [1]);
  // Broker không trả lời gì → bị từ chối sau thời gian chờ, không treo
  class Silent extends EventEmitter { constructor() { super(); } destroy() {} }
  globalThis.window.Peer = Silent;
  await assert.rejects(hostRoom('TSILN', { openTimeout: 30 }), (e) => e.type === 'timeout');
  globalThis.window.Peer = FakePeer;
});
