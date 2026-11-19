// Scores candidates against tasks.json.
// Usage: node run.mjs [wasmCandidates.json] [pythonCandidates.json]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const tasks = JSON.parse(fs.readFileSync('tasks.json', 'utf8'));
const wasmFile = process.argv[2] || 'candidates/claude-direct-wasm.json';
const pyFile = process.argv[3] || 'candidates/claude-python.json';
const wasmC = JSON.parse(fs.readFileSync(wasmFile, 'utf8'));
const pyC = JSON.parse(fs.readFileSync(pyFile, 'utf8'));

async function runWasm(hex, tests) {
  const clean = (hex || '').replace(/[^0-9a-fA-F]/g, '');
  const bytes = Buffer.from(clean, 'hex');
  let fn;
  try {
    const { instance } = await WebAssembly.instantiate(bytes);
    fn = instance.exports.run;
  } catch (e) {
    return { passed: 0, error: 'invalid module: ' + e.message.split('\n')[0], size: bytes.length };
  }
  let passed = 0, firstFail = null;
  for (const [args, want] of tests) {
    let got;
    try { got = fn(...args); } catch (e) { got = 'trap'; }
    if (got === want) passed++; else firstFail ??= `run(${args}) = ${got}, want ${want}`;
  }
  return { passed, error: firstFail, size: bytes.length };
}

function runPython(src, tests) {
  const harness = `import json,sys\n${src}\ntests=json.loads(sys.argv[1])\nout=[]\nfor a,w in tests:\n    try: out.append(run(*a))\n    except Exception: out.append('error')\nprint(json.dumps(out))`;
  try {
    const out = JSON.parse(execFileSync('python3', ['-I', '-c', harness, JSON.stringify(tests)]).toString());
    let passed = 0, firstFail = null;
    tests.forEach(([args, want], i) => { if (out[i] === want) passed++; else firstFail ??= `run(${args}) = ${out[i]}, want ${want}`; });
    return { passed, error: firstFail };
  } catch (e) { return { passed: 0, error: 'crash' }; }
}

const rows = [];
let wTasks = 0, pTasks = 0;
for (const t of tasks) {
  const w = await runWasm(wasmC[t.id], t.tests);
  const p = runPython(pyC[t.id] || '', t.tests);
  const n = t.tests.length;
  if (w.passed === n) wTasks++;
  if (p.passed === n) pTasks++;
  rows.push({ task: t.id, wasm: `${w.passed}/${n}`, wasmBytes: w.size, python: `${p.passed}/${n}`, wasmError: w.error || '' });
}
console.table(rows);
console.log(`\nDirect-to-WASM: ${wTasks}/${tasks.length} tasks fully correct`);
console.log(`Via Python:     ${pTasks}/${tasks.length} tasks fully correct`);
fs.writeFileSync('results.json', JSON.stringify({ wasmFile, pyFile, rows, wTasks, pTasks, total: tasks.length }, null, 2));
