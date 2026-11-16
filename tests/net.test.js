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
