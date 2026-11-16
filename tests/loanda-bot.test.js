import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, apply, viewFor } from '../loanda/engine.js';
import { botAction } from '../loanda/bot.js';

// rng có seed để chạy lại được.
const seeded = (n) => () => ((n = (n * 16807) % 2147483647) / 2147483647);

test('toàn bot: mọi hành động bot chọn đều hợp lệ và ván luôn kết thúc', () => {
  for (let g = 0; g < 40; g++) {
    const rng = seeded(g + 1);
    const ids = Array.from({ length: 4 + (g % 4) }, (_, i) => 'bot' + i);
    let s = start(ids, {}, rng);
    let steps = 0;
    while (!s.winner && steps++ < 20000) {
      const actor = s.phase === 'pick' ? s.players.find((p) => !p.char).id : viewFor(s, ids[0]).turn;
      const r = apply(s, actor, botAction(viewFor(s, actor)), rng);
      assert.equal(r.ok, true, `ván ${g}, bước ${steps}: ${r.error}`);
      s = r.state;
    }
    assert.ok(s.winner, `ván ${g} không kết thúc`);
  }
});
