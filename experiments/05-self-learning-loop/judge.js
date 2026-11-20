// The judge. It tests an app the way a person would: it LOOKS at the screen, presses buttons it can SEE,
// waits, and checks what the screen shows. It never peeks inside the program, so it works on any binary
// that follows the host contract (start, draw, click, key, tick, 160×240 screen), however it was made.
//
// Safety: every app runs in a sealed worker thread. No imports allowed (no outside access), memory capped
// at 1 MB of app memory and 64 MB for the worker, and the whole test is stopped after 3 seconds.
//
// Use from Node:  const { judge } = require('./judge.js');  await judge(bytes, tests)
// A test is a list of steps:
//   { press: "+" }              find the text "+" on screen and click it
//   { press_any: ["+", "ADD"] } the first of these that is on screen
//   { type: "48.5" }            press each key on the screen's keypad (or the keyboard if there is none)
//   { key: "enter" | "left" | "a" }
//   { wait: 2.5 }               seconds (the host ticks 10 times a second)
//   { see: "9" }                a word or number on screen equals this (numbers compare by value: 2.50 = 2.5)
//   { see_any: ["25", "1500"] } any one of these
//   { not_see: "0" }
//   { number_between: [1, 6], count: 2 }  at least this many numbers on screen are in this range
//   { keys: "buy milk\n" }      type on the keyboard (\n = enter)
//   { press_any: [...], optional: true }   press it if it is there, carry on if not
//   { changes: [steps] }        do these steps; the screen must look different afterwards
//   { no_number_below: 0 }      no number on screen is below this
//   { two_add_to: 10 }          two numbers on screen add up to this (or one of them is it)
const { Worker } = require('worker_threads');
const path = require('path');
const { FONT57 } = require(path.join(__dirname, '../../compilers/structured-english-v3/font57.js'));

const GLYPHS = Object.entries(FONT57).map(([ch, rows]) => ({
  ch: { '\x1c': '°', '\x1d': '÷', '\x1e': '×', '\x1f': '£' }[ch] || ch, rows,
}));

const WORKER = `
const { parentPort, workerData: d } = require('worker_threads');
const W = 160, H = 240, GW = 6, GH = 7;
const KEYS = { left: 17, up: 18, right: 19, down: 20, space: 32, enter: 13, backspace: 8 };
let mem, x;

// --- reading the screen: find every letter of the 5×7 font, at sizes 1 to 4 ---
function readScreen() {
  const px = (a, b) => (a < 0 || b < 0 || a >= W || b >= H) ? -1 : mem[b * W + a];
  const found = [];
  // skip any spot where the screen is one flat colour (no letter can be there): a running total of "edges"
  const S = new Int32Array((W + 1) * (H + 1));
  for (let b = 0; b < H; b++) for (let a = 0; a < W; a++) {
    const e = (a > 0 && mem[b * W + a] !== mem[b * W + a - 1]) || (b > 0 && mem[b * W + a] !== mem[(b - 1) * W + a]) ? 1 : 0;
    S[(b + 1) * (W + 1) + a + 1] = e + S[b * (W + 1) + a + 1] + S[(b + 1) * (W + 1) + a] - S[b * (W + 1) + a];
  }
  const edges = (a, b, w, h) => S[(b + h) * (W + 1) + a + w] - S[b * (W + 1) + a + w] - S[(b + h) * (W + 1) + a] + S[b * (W + 1) + a];
  for (let s = 1; s <= 4; s++) for (let y = 0; y + GH * s <= H; y++) for (let x0 = 0; x0 + 5 * s <= W; x0++) {
    if (!edges(x0 + 1, y + 1, 5 * s - 1, GH * s - 1)) continue;
    for (const g of d.glyphs) {
      const fr = g.rows.findIndex(r => r); if (fr < 0) continue;            // skip blank glyphs
      const fc = [16, 8, 4, 2, 1].findIndex(b => g.rows[fr] & b);
      const ink = px(x0 + fc * s, y + fr * s);
      let ok = true;
      for (let r = -1; r <= GH && ok; r++) for (let c = -1; c <= 5 && ok; c++) {
        const on = r >= 0 && r < GH && c >= 0 && c < 5 && (g.rows[r] & (16 >> c));
        for (let i = 0; i < s && ok; i++) for (let j = 0; j < s && ok; j++) {
          const p = px(x0 + c * s + j, y + r * s + i);
          if (on ? p !== ink : p === ink) ok = false;
        }
      }
      if (ok) { found.push({ ch: g.ch, x: x0, y, s }); break; }
    }
  }
  // join letters on the same line into words
  found.sort((a, b) => a.s - b.s || a.y - b.y || a.x - b.x);
  const words = []; let cur = null;
  for (const f of found) {
    if (cur && cur.s === f.s && cur.y === f.y && f.x === cur.nx) { cur.text += f.ch; cur.nx += GW * f.s; continue; }
    if (cur && cur.s === f.s && cur.y === f.y && f.x === cur.nx + GW * f.s) { cur.text += ' ' + f.ch; cur.nx = f.x + GW * f.s; continue; }
    cur = { text: f.ch, x: f.x, y: f.y, s: f.s, nx: f.x + GW * f.s }; words.push(cur);
  }
  return words.map(w => ({ text: w.text, x: w.x, y: w.y, w: w.nx - w.x - w.s, h: GH * w.s }));
}

const num = t => { const m = String(t).replace(/[£,]/g, '').match(/^-?\\d+(\\.\\d+)?%?$/); return m ? parseFloat(String(t).replace(/[£,%]/g, '')) : null; };
const same = (a, b) => { const na = num(a), nb = num(b); return na !== null && nb !== null ? Math.abs(na - nb) < 1e-9 : String(a).toUpperCase() === String(b).toUpperCase(); };
const tokens = words => words.flatMap(w => [w.text, ...w.text.split(' ')]);

try {
  const m = new WebAssembly.Module(d.bytes);
  if (WebAssembly.Module.imports(m).length) throw new Error('the app asked for outside access');
  for (const e of ['memory', 'start', 'draw', 'click', 'key', 'tick']) if (!WebAssembly.Module.exports(m).some(x => x.name === e)) throw new Error('the app has no ' + e);
  x = new WebAssembly.Instance(m, {}).exports;
  if (x.memory.buffer.byteLength > 1048576) throw new Error('the app wants too much memory');
  mem = new Uint8Array(x.memory.buffer);
  if (x.memory.buffer.byteLength >= 38904) new DataView(x.memory.buffer).setUint32(38900, d.seed, true);
  x.start(); x.draw();
  const nums = toks => toks.map(num).filter(n => n !== null);
  const runSteps = (steps, pre) => {
  for (const [i0, step] of steps.entries()) {
    const i = pre + i0;
    const words = readScreen(), toks = tokens(words);
    const say = () => 'screen shows: ' + words.map(w => w.text).join(' | ');
    const findBtn = label => {
      const want = String(label).toUpperCase().replace(/^−$/, '-');
      const hits = words.filter(w => same(w.text, want)).concat(words.filter(w => !same(w.text, want) && w.text.split(' ').some(t => same(t, want))));
      return hits.sort((a, b) => b.y - a.y)[0];          // several matches? buttons sit at the bottom, so take the lowest
    };
    const click = w => { x.click(w.x + (w.w >> 1), w.y + (w.h >> 1)); x.draw(); };
    if (step.press !== undefined || step.press_any !== undefined) {
      const opts = step.press_any || [step.press];
      const w = opts.map(findBtn).find(Boolean);
      if (!w && !step.optional) return 'step ' + (i + 1) + ': there is no ' + opts.map(o => '"' + o + '"').join(' or ') + ' to press. ' + say();
      if (w) click(w);
    } else if (step.keys !== undefined) {
      for (const ch of String(step.keys)) { x.key(ch === '\\n' ? 13 : ch.toUpperCase().charCodeAt(0)); x.draw(); }
    } else if (step.changes !== undefined) {
      const before = mem.slice(0, W * H); const f = runSteps(step.changes, i); if (f) return f;
      if (mem.slice(0, W * H).every((v, k) => v === before[k])) return 'step ' + (i + 1) + ': expected the screen to change, but nothing moved. ' + say();
    } else if (step.type !== undefined) {
      for (const ch of String(step.type)) { const w = findBtn(ch); if (w) click(w); else { x.key(ch.charCodeAt(0)); x.draw(); } }
    } else if (step.key !== undefined) {
      const k = KEYS[step.key] ?? String(step.key).toUpperCase().charCodeAt(0); x.key(k); x.draw();
    } else if (step.wait !== undefined) {
      for (let t = 0; t < Math.round(step.wait * 10); t++) x.tick(); x.draw();
    } else if (step.see !== undefined) {
      if (!toks.some(t => same(t, step.see))) return  'step ' + (i + 1) + ': expected to see "' + step.see + '". ' + say();
    } else if (step.see_any !== undefined) {
      if (!step.see_any.some(v => toks.some(t => same(t, v)))) return  'step ' + (i + 1) + ': expected to see one of ' + JSON.stringify(step.see_any) + '. ' + say();
    } else if (step.not_see !== undefined) {
      if (toks.some(t => same(t, step.not_see))) return  'step ' + (i + 1) + ': did not expect to see "' + step.not_see + '". ' + say();
    } else if (step.number_between !== undefined) {
      const [lo, hi] = step.number_between, need = step.count || 1;
      if (nums(words.map(w => w.text)).filter(n => n >= lo && n <= hi).length < need) return 'step ' + (i + 1) + ': expected ' + (need > 1 ? need + ' numbers' : 'a number') + ' from ' + lo + ' to ' + hi + '. ' + say();
    } else if (step.no_number_below !== undefined) {
      if (nums(toks).some(n => n < step.no_number_below)) return 'step ' + (i + 1) + ': a number went below ' + step.no_number_below + '. ' + say();
    } else if (step.two_add_to !== undefined) {
      const ns = nums(words.map(w => w.text)), T = step.two_add_to;
      if (!(ns.includes(T) || ns.some((a, p) => ns.some((b, q) => p !== q && Math.abs(a + b - T) < 1e-9)))) return 'step ' + (i + 1) + ': expected two numbers adding up to ' + T + '. ' + say();
    }
  }
  return null;
  };
  const failed = runSteps(d.steps, 0);
  parentPort.postMessage({ ok: true, passed: !failed, failed, screen: readScreen().map(w => w.text) });
} catch (e) { parentPort.postMessage({ ok: false, passed: false, failed: 'crashed: ' + e.message }); }
`;

function judge(bytes, steps, { seed = 12345, timeoutMs = 6000 } = {}) {
  return new Promise(resolve => {
    const w = new Worker(WORKER, { eval: true, workerData: { bytes, steps, seed, glyphs: GLYPHS }, resourceLimits: { maxOldGenerationSizeMb: 64 } });
    const t = setTimeout(() => { w.terminate(); resolve({ passed: false, failed: 'stopped: took longer than ' + timeoutMs / 1000 + ' s' }); }, timeoutMs);
    w.on('message', m => { clearTimeout(t); w.terminate(); resolve(m); });
    w.on('error', e => { clearTimeout(t); resolve({ passed: false, failed: 'crashed: ' + e.message }); });
  });
}

// Run every test for one app. An app passes only if ALL its tests pass.
async function judgeAll(bytes, tests, opts) {
  const results = [];
  for (const t of tests) results.push({ name: t.name, ...(await judge(bytes, t.steps, opts)) });
  return { passed: results.every(r => r.passed), results };
}

module.exports = { judge, judgeAll };
