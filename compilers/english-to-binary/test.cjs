const path = __dirname;
const { compileEnglish } = require(path + '/compiler.js');
const { EXAMPLES } = require(path + '/examples.js');
(async () => {
  let ok = 0, total = 0;
  for (const [name, ex] of Object.entries(EXAMPLES)) {
    const r = compileEnglish(ex.text);
    const { instance } = await WebAssembly.instantiate(r.bytes);
    const res = ex.tests.map(([a, w]) => { total++; const g = instance.exports.run(...a); if (g === w) ok++; return g === w ? '✓' : `✗ run(${a})=${g} want ${w}`; });
    console.log(name.padEnd(26), r.bytes.length + ' bytes', res.join(' '));
  }
  console.log(`\n${ok}/${total} tests pass`);
  for (const bad of ['Given n. Return n plus banana.', 'Given n. While n is above 0: Decrease n by 1.', 'Return 5.', 'Given n. Dance with n.'])
    try { compileEnglish(bad); console.log('NO ERROR for', bad); } catch (e) { console.log('error ok:', e.message); }
})();
