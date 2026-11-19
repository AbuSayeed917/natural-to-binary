const fs = require('fs');
const { compileSE2 } = require('./se2.js');
const checks = []; const ok = (n, v) => { checks.push(!!v); console.log(v ? '✓' : '✗', n); };
async function boot(file) {
  const r = compileSE2(fs.readFileSync(__dirname + '/programs/' + file, 'utf8'));
  const { instance } = await WebAssembly.instantiate(r.bytes);
  const e = instance.exports, mem = new Uint8Array(e.memory.buffer), dv = new DataView(e.memory.buffer);
  e.start(); e.draw();
  const btn = lab => r.layout.buttons.find(b => b.lab === lab) || (() => { throw new Error('no button ' + lab); })();
  const press = lab => { const b = btn(lab); e.click(b.x + (b.w >> 1), b.y + (b.h >> 1)); e.draw(); };
  const type = s => { for (const ch of s) press({ '*': '×', '/': '÷', '-': '-' }[ch] || ch); };
  const key = s => { for (const ch of s) { e.key(ch === '\n' ? 13 : ch.charCodeAt(0)); e.draw(); } };
  const shown = (d = 0) => Number(dv.getBigInt64(r.memory.DISP_AT + 8 * d, true)) / 100;
  const v = name => Number(dv.getBigInt64(r.memory.VARS_AT + 8 * r.vars[name], true)) / 100;
  const px = (x, y) => mem[y * 160 + x];
  return { r, e, mem, press, type, key, shown, v, px };
}
(async () => {
  let m = await boot('calculator.txt');
  console.log(`calculator: ${m.r.sizes.total} bytes`);
  m.type('12.5+7.25='); ok('12.5 + 7.25 = 19.75', m.shown() === 19.75); m.press('C');
  m.type('10÷4='); ok('10 ÷ 4 = 2.5', m.shown() === 2.5); m.press('C');
  m.type('3×1.5='); ok('3 × 1.5 = 4.5', m.shown() === 4.5); m.press('C');
  m.type('5-9='); ok('5 − 9 = −4', m.shown() === -4); m.press('C');
  m.type('7÷0='); ok('7 ÷ 0 = 0, no crash', m.shown() === 0); m.press('C');
  m.key('42*2\n'); ok('keyboard: 42*2 Enter = 84', m.shown() === 84);
  m = await boot('tip-calculator.txt');
  m.type('40'); ok('bill 40', m.v('bill') === 40); ok('rate starts at 15', m.v('rate') === 15);
  m.press('20%'); ok('20% button sets rate 20', m.v('rate') === 20);
  m.press('C'); m.type('23.45'); ok('bill typed 23.45', m.v('bill') === 23.45);
  m = await boot('bill-splitter.txt');
  m.type('84'); m.press('MORE'); ok('people 3 after MORE', m.v('people') === 3);
  m.press('FEWER'); m.press('FEWER'); m.press('FEWER'); ok('FEWER stops at 1', m.v('people') === 1);
  m = await boot('todo-list.txt');
  m.key('buy milk'); m.press('ADD'); m.key('call mum\n');
  const L = m.r.memory.LIST_AT; ok('two tasks added', m.mem[L] === 2);
  const item = i => String.fromCharCode(...m.mem.slice(L + 4 + i * 20 + 2, L + 4 + i * 20 + 2 + m.mem[L + 4 + i * 20]));
  ok(`first task is "${item(0)}"`, item(0) === 'BUY MILK'); ok(`second task is "${item(1)}"`, item(1) === 'CALL MUM');
  m.e.click(50, m.r.list.y + 5); m.e.draw(); ok('clicking first task ticks it', m.mem[L + 4 + 1] === 1);
  m.key('x\b'); ok('backspace works', m.mem[m.r.memory.BOX_AT] === 0);
  m.press('CLEAR ALL'); ok('clear all empties list', m.mem[L] === 0);
  m = await boot('counter.txt');
  m.press('+'); m.press('+'); m.press('+'); ok('counter 3', m.v('count') === 3);
  m.press('-'); ok('minus → 2', m.v('count') === 2); m.press('RESET'); m.press('-'); ok('never below 0', m.v('count') === 0);
  const b = m.r.layout.buttons[0]; ok('buttons are round (corner is background)', m.px(b.x, b.y) === 6 && m.px(b.x + (b.w >> 1), b.y + 4) === 15);
  m = await boot('temperature.txt');
  m.type('100'); ok('celsius 100', m.v('celsius') === 100);
  m.press('C'); m.type('40'); m.press('-'); ok('−40 entered', m.v('celsius') === -40);
  // check the drawn Fahrenheit value by reading pixels is hard; check the formula via a tiny expression program
  const F = compileSE2('Remember a number called c starting at 37.\nA display shows numbers in white.\nWhen the app opens:\n  Show c times 9 divided by 5 plus 32.');
  const inst = (await WebAssembly.instantiate(F.bytes)).instance.exports; inst.start();
  ok('37 °C → 98.6 °F', Number(new DataView(inst.memory.buffer).getBigInt64(F.memory.DISP_AT, true)) / 100 === 98.6);
  for (const bad of ['Buttons: 1 2 banana@.', 'A display shows numbers in lime.\nWhen I press 5:\n  Show nothing.', 'The screen is rainbow.'])
    try { compileSE2(bad); ok('should error: ' + bad, false); } catch (err) { ok('plain error: ' + err.message, true); }
  console.log(`\n${checks.filter(Boolean).length}/${checks.length} pass`);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
