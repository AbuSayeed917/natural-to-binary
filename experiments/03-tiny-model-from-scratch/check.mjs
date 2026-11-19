// Runs binaries against their tests. Input: JSONL lines {hex, tests}. Output: JSON array of pass booleans.
import fs from 'node:fs';
const lines = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map(l => JSON.parse(l));
const out = [];
for (const it of lines) {
  let ok = false;
  try {
    const { instance } = await WebAssembly.instantiate(Buffer.from(it.hex, 'hex'));
    const fn = instance.exports.run;
    ok = typeof fn === 'function' && it.tests.every(([a, w]) => { try { return fn(...a) === w; } catch { return false; } });
  } catch { ok = false; }
  out.push(ok);
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
