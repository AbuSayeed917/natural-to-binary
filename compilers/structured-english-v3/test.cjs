const fs = require('fs');
const { compileSE3 } = require('./se3.js');
const { FONT57 } = require('./font57.js');
const checks = []; const ok = (n, v) => { checks.push(!!v); console.log(v ? '✓' : '✗', n); };
const sizes = [];
// A tiny pretend host: the same jobs the web page does (seed, start, draw, clicks, keys, timer, saving).
async function boot(file, saved) {
  const src = fs.readFileSync(__dirname + '/programs/' + file, 'utf8');
  const r = compileSE3(src, FONT57);
  sizes.push([file, r.sizes.total]);
  const { instance } = await WebAssembly.instantiate(r.bytes);
  const e = instance.exports, mem = new Uint8Array(e.memory.buffer), dv = new DataView(e.memory.buffer);
  dv.setUint32(r.memory.SEED_AT, 12345, true);
  e.start();
  if (saved) for (const k of r.keep) mem.set(saved[k.name], k.at);
  e.draw();
  const screen = () => dv.getInt32(r.memory.SCREEN_AT, true);
  const btn = lab => { const sc = r.screens[screen()]; const b = sc.buttons.find(b => b.lab === lab); if (!b) throw new Error(`no ${lab} button on screen ${sc.name}`); return b; };
  const press = lab => { const b = btn(lab); e.click(b.x + (b.w >> 1), b.y + (b.h >> 1)); e.draw(); };
  const type = s => { for (const ch of s) press({ '*': '×', '/': '÷' }[ch] || ch); };
  const key = s => { for (const ch of s) { e.key(ch === '\n' ? 13 : ch.charCodeAt(0)); e.draw(); } };
  const arrow = name => { e.key(r.KEY[name]); e.draw(); };
  const ticks = n => { for (let i = 0; i < n; i++) e.tick(); e.draw(); };
  const shown = (d = 0) => Number(dv.getBigInt64(r.memory.DISP_AT + 8 * d, true)) / 100;
  const v = name => Number(dv.getBigInt64(r.memory.VARS_AT + 8 * r.vars[name], true)) / 100;
  const save = () => Object.fromEntries(r.keep.map(k => [k.name, mem.slice(k.at, k.at + k.len)]));
  return { r, e, mem, press, type, key, arrow, ticks, shown, v, save, screen, px: (x, y) => mem[y * 160 + x] };
}
(async () => {
  // --- the six v0.2 apps still work ---
  let m = await boot('calculator.txt');
  m.type('12.5+7.25='); ok('calculator: 12.5 + 7.25 = 19.75', m.shown() === 19.75); m.press('C');
  m.type('10÷4='); ok('calculator: 10 ÷ 4 = 2.5', m.shown() === 2.5); m.press('C');
  m.key('42*2\n'); ok('calculator: keyboard 42*2 Enter = 84', m.shown() === 84);
  m = await boot('tip-calculator.txt'); m.type('48.50'); m.press('20%'); ok('tip: bill 48.50 at rate 20', m.v('bill') === 48.5 && m.v('rate') === 20);
  m = await boot('bill-splitter.txt'); m.type('84'); m.press('MORE'); ok('bill splitter: 3 people', m.v('people') === 3);
  m = await boot('counter.txt'); m.press('+'); m.press('+'); m.press('-'); ok('counter: 1', m.v('count') === 1);
  m = await boot('temperature.txt'); m.type('37'); ok('°C to °F: 37 entered', m.v('celsius') === 37);
  // --- to-do list keeps tasks between visits ---
  m = await boot('todo-list.txt'); m.key('buy milk\n'); m.key('call mum\n'); m.e.click(50, m.r.list.y + 6); m.e.draw();
  const saved = m.save(); ok('to-do: the app asks to keep “tasks”', m.r.keep.length === 1 && m.r.keep[0].name === 'tasks');
  const m2 = await boot('todo-list.txt', saved); const L = m2.r.memory.LIST_AT;
  ok('to-do: after reopening, 2 tasks are still there', m2.mem[L] === 2);
  ok('to-do: and the first is still ticked', m2.mem[L + 5] === 1);
  // --- stopwatch: timers ---
  m = await boot('stopwatch.txt'); m.ticks(30); ok('stopwatch: stays at 0 before START', m.v('time') === 0);
  m.press('START'); m.ticks(25); ok(`stopwatch: 25 ticks after START = 2.5 s (got ${m.v('time')})`, m.v('time') === 2.5);
  m.press('STOP'); m.ticks(10); ok('stopwatch: STOP freezes it', m.v('time') === 2.5);
  m.press('RESET'); ok('stopwatch: RESET → 0', m.v('time') === 0);
  // --- dice: random numbers ---
  m = await boot('dice.txt'); const seen = new Set(); let inRange = true;
  for (let i = 0; i < 300; i++) { m.press('ROLL'); const d = m.v('die'); seen.add(d); if (d < 1 || d > 6 || d !== Math.floor(d)) inRange = false; }
  ok('dice: 300 rolls, always a whole number 1–6', inRange); ok(`dice: every face appeared (${[...seen].sort().join(',')})`, seen.size === 6);
  ok('dice: total and rolls add up', m.v('rolls') === 300 && m.v('total') >= 300 && m.v('total') <= 1800);
  m.key(' '); ok('dice: space bar rolls too', m.v('rolls') === 301);
  // --- quiz: two screens ---
  m = await boot('times-table-quiz.txt'); const a = m.v('a'), b = m.v('b');
  ok(`quiz: starts on QUESTION screen with ${a} × ${b}`, m.screen() === 0 && a >= 2 && a <= 9 && b >= 2 && b <= 9);
  m.type(String(a * b)); m.press('CHECK'); ok('quiz: right answer → RESULT screen, score 1', m.screen() === 1 && m.v('score') === 1 && m.v('asked') === 1);
  let threw = false; try { m.press('CHECK'); } catch { threw = true; } ok('quiz: CHECK button is not on the RESULT screen', threw);
  m.press('NEXT QUESTION'); ok('quiz: NEXT → back to QUESTION, answer cleared', m.screen() === 0 && m.v('answer') === 0);
  m.type('1'); m.press('CHECK'); ok('quiz: wrong answer keeps score 1, asked 2', m.v('score') === 1 && m.v('asked') === 2);
  const q2 = await boot('times-table-quiz.txt', m.save()); ok('quiz: score is kept after reopening', q2.v('score') === 1 && q2.v('asked') === 2);
  // --- catch the star: movement, timers, arrows ---
  m = await boot('catch-the-star.txt');
  m.arrow('left'); ok('game: left arrow moves the basket', m.v('basket') === 68); m.press('RIGHT'); ok('game: RIGHT button moves it back', m.v('basket') === 80);
  const y0 = m.v('star_y'); m.ticks(4); ok('game: the star falls with time', m.v('star_y') === y0 + 20);
  // steer under the star and let it land
  for (let i = 0; i < 40 && m.v('score') === 0; i++) { const sx = m.v('star_x'), bx = m.v('basket'); if (sx < bx - 6) m.arrow('left'); else if (sx > bx + 6) m.arrow('right'); m.ticks(1); }
  ok('game: steering under the star catches it', m.v('score') === 1);
  ok('game: the star is drawn as yellow pixels', [...m.mem.slice(0, 38400)].includes(12));
  // --- plain-English errors ---
  for (const bad of ['Buttons: "GO".\nWhen I press "GO":\n  Go to the "NOWHERE" screen.', 'Remember a number called d.\nA display shows d in white.\nButtons: "ROLL".\nWhen I press "ROLL":\n  D becomes a random number 1 to 6.', 'Every fortnight:\n  Clear x.'])
    try { compileSE3(bad, FONT57); ok('should error: ' + bad.split('\n').pop(), false); } catch (err) { ok('plain error: ' + err.message, true); }
  console.log('\n' + sizes.filter((s, i, a) => a.findIndex(x => x[0] === s[0]) === i).map(([f, n]) => `${f.padEnd(24)} ${n} bytes`).join('\n'));
  console.log(`\n${checks.filter(Boolean).length}/${checks.length} pass`);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
