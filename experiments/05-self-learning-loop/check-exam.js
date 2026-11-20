// Proves the exam is fair: every hand-written reference answer must pass all its tests.
const { compileSE3 } = require('../../compilers/structured-english-v3/se3.js');
const { FONT57 } = require('../../compilers/structured-english-v3/font57.js');
const { judgeAll } = require('./judge.js'); const { EXAM, makeTrain } = require('./tasks.js'); const REF = require('./exam-reference.js');
(async () => {
  let pass = 0;
  for (const [i, t] of EXAM.entries()) {
    let r; try { r = await judgeAll(compileSE3(REF[i], FONT57).bytes, t.tests); } catch (e) { r = { passed: false, results: [{ failed: 'compile: ' + e.message }] }; }
    pass += r.passed; console.log(r.passed ? '✓' : '✗', t.request, r.passed ? '' : '\n   ' + r.results.filter(x => !x.passed).map(x => x.name + ': ' + x.failed).join('\n   '));
  }
  console.log(`\nreference answers pass ${pass}/${EXAM.length}`);
  const tr = makeTrain(); console.log(`training tasks: ${tr.length}`); tr.slice(0, 60).forEach(t => console.log('  ' + t.request));
})();
