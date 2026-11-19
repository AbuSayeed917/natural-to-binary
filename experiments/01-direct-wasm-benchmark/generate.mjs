// Ask a model to emit raw WASM hex (and, for comparison, Python) for every task.
// Usage: ANTHROPIC_API_KEY=... node generate.mjs [model] [runLabel]
// Then:  node run.mjs candidates/<label>-wasm.json candidates/<label>-python.json
import fs from 'node:fs';

const model = process.argv[2] || 'claude-sonnet-5-5';
const label = process.argv[3] || model;
const key = process.env.ANTHROPIC_API_KEY;
if (!key) { console.error('Set ANTHROPIC_API_KEY'); process.exit(1); }
const tasks = JSON.parse(fs.readFileSync('tasks.json', 'utf8'));

async function ask(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(j));
  return j.content.map(c => c.text || '').join('');
}

const sig = t => t.params === 2 ? '(a: i32, b: i32) -> i32' : '(x: i32) -> i32';
const wasmPrompt = t => `Output a complete WebAssembly binary module as hex bytes ONLY (no WAT, no explanation, no code fences).
It must export a single function named "run" with signature ${sig(t)}.
Behaviour: ${t.spec}`;
const pyPrompt = t => `Write a Python function run(${t.params === 2 ? 'a, b' : 'x'}) that does this: ${t.spec}
Output only the code, no code fences.`;

const wasm = { _model: model }, py = { _model: model };
for (const t of tasks) {
  process.stdout.write(`${t.id}... `);
  wasm[t.id] = (await ask(wasmPrompt(t))).trim();
  py[t.id] = (await ask(pyPrompt(t))).replace(/```(python)?/g, '').trim() + '\n';
  console.log('done');
}
fs.writeFileSync(`candidates/${label}-wasm.json`, JSON.stringify(wasm, null, 2));
fs.writeFileSync(`candidates/${label}-python.json`, JSON.stringify(py, null, 2));
console.log(`\nNow run: node run.mjs candidates/${label}-wasm.json candidates/${label}-python.json`);
