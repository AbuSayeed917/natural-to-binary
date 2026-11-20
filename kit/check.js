// Reads JSON lines {"id":..., "program": "...Structured English..."} on stdin.
// Writes JSON lines {"id":..., "ok": true|false, "bytes": n, "error": "..."}: does each program compile?
const path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'compilers', 'structured-english-v3');
const { compileSE3 } = require(path.join(dir, 'se3.js'));
const { FONT57 } = require(path.join(dir, 'font57.js'));
let input = '';
process.stdin.on('data', d => input += d).on('end', () => {
  for (const line of input.split('\n').filter(Boolean)) {
    const { id, program } = JSON.parse(line);
    try { const r = compileSE3(program, FONT57); console.log(JSON.stringify({ id, ok: true, bytes: r.sizes.total })); }
    catch (e) { console.log(JSON.stringify({ id, ok: false, error: e.message })); }
  }
});
