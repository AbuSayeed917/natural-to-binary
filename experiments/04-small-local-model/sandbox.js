// Compile Structured English, then run the binary in a sealed worker: no imports, 1 MB memory, 3 s limit.
const { Worker } = require('worker_threads');
const path = require('path');
const dir = '/home/claude/v3';
const { compileSE3 } = require(path.join(dir, 'se3.js')); const { FONT57 } = require(path.join(dir, 'font57.js'));
const job = JSON.parse(require('fs').readFileSync(0, 'utf8'));
let r; try { r = compileSE3(job.program, FONT57); } catch (e) { console.log(JSON.stringify({ compiled: false, error: e.message })); process.exit(0); }
const clicks = r.screens.flatMap(s => s.buttons.map(b => [b.x + (b.w >> 1), b.y + (b.h >> 1)]));
const code = `const { parentPort, workerData: d } = require('worker_threads');
try { const m = new WebAssembly.Module(d.bytes); if (WebAssembly.Module.imports(m).length) throw new Error('asked for outside access');
  const x = new WebAssembly.Instance(m, {}).exports; if (x.memory.buffer.byteLength > 1048576) throw new Error('too much memory');
  x.start(); x.draw(); for (const [a, b] of d.clicks) { x.click(a, b); x.draw(); } for (const k of [13, 32, 17, 19, 65, 8]) x.key(k); for (let t = 0; t < 30; t++) x.tick(); x.draw();
  parentPort.postMessage({ ok: true }); } catch (e) { parentPort.postMessage({ ok: false, error: e.message }); }`;
const w = new Worker(code, { eval: true, workerData: { bytes: r.bytes, clicks }, resourceLimits: { maxOldGenerationSizeMb: 64 } });
const t = setTimeout(() => { w.terminate(); console.log(JSON.stringify({ compiled: true, runs: false, error: 'took longer than 3 s', bytes: r.sizes.total })); }, 3000);
w.on('message', m => { clearTimeout(t); w.terminate(); console.log(JSON.stringify({ compiled: true, runs: m.ok, error: m.error, bytes: r.sizes.total })); });
