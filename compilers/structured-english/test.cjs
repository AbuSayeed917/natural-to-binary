const fs = require('fs');
const { compileSE } = require('./se.js');
const checks = []; const ok = (n, v) => { checks.push(v); console.log(v ? '✓' : '✗', n); };
(async () => {
  const r = compileSE(fs.readFileSync(__dirname + '/calculator.txt', 'utf8'));
  console.log(`binary: ${r.sizes.total} bytes (yours: ${r.sizes.yours}, built-in library + font: ${r.libBytes})`);
  const { instance } = await WebAssembly.instantiate(r.bytes);
  const e = instance.exports, mem = new Uint8Array(e.memory.buffer), dv = new DataView(e.memory.buffer);
  const press = lab => { const b = r.layout.find(b => b.lab === lab); e.click(b.x + (b.w >> 1), b.y + (b.h >> 1)); e.draw(); };
  const shown = () => dv.getInt32(19996, true);
  const type = s => { for (const ch of s) press({ '*': 'x' }[ch] || ch); return shown(); };
  e.draw();
  ok('screen is charcoal', mem[127 * 128 + 0] === 14);
  ok('display starts at 0', shown() === 0);
  ok('12 + 30 = 42', type('12+30=') === 42); press('C');
  ok('7 × 6 = 42', type('7x6=') === 42); press('C');
  ok('100 − 58 = 42', type('100-58=') === 42); press('C');
  ok('84 ÷ 2 = 42', type('84/2=') === 42); press('C');
  ok('5 − 9 = −4 (negative)', type('5-9=') === -4); press('C');
  ok('9 ÷ 0 = 0 (no crash)', type('9/0=') === 0); press('C');
  ok('C clears', type('123') === 123 && (press('C'), shown() === 0));
  // the digits are really drawn as pixels: display area should contain lime pixels after typing 8
  type('8'); let lime = 0; for (let y = 4; y < 32; y++) for (let x = 4; x < 124; x++) if (mem[y * 128 + x] === 10) lime++;
  ok(`digit 8 drawn on the display (${lime} lime pixels)`, lime === 13 * 9);
  // errors in plain English
  for (const bad of ['Buttons: 1 2 banana.', 'When I press 5:\n Show nothing.', 'A display at the top.\nWhen I press 7:\n  Show total.'])
    try { compileSE(bad); ok('should error: ' + bad, false); } catch (err) { ok('error explained: ' + err.message, true); }
  console.log(`\n${checks.filter(Boolean).length}/${checks.length} pass`);
})();
