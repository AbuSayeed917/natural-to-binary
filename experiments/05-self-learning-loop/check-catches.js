// Proves the judge catches wrong apps: small mistakes like the ones the student made.
const { compileSE3 } = require('../../compilers/structured-english-v3/se3.js');
const { FONT57 } = require('../../compilers/structured-english-v3/font57.js');
const { judgeAll } = require('./judge.js'); const { EXAM } = require('./tasks.js'); const REF = require('./exam-reference.js');
const bad = [
  [1, 'starting at 45', 'starting at 40', 'countdown starts at 40, not 45'],
  [1, 'left becomes left minus 1', 'left becomes left minus 1.5', 'counts down too fast'],
  [1, 'if left is more than 0, ', '', 'does not stop at zero'],
  [3, '220462 divided by 100000', '2.2', 'uses 2.2 instead of 2.20462'],
  [11, 'shows 20 percent', 'shows 2 percent', 'VAT at 2% instead of 20%'],
  [9, 'ml plus 250', 'ml plus 25', 'adds 25 ml, not 250'],
  [8, 'starting at 2.', 'starting at 1.', 'starts at 1 person'],
  [19, '  Running becomes 1.', '  Left becomes 10.', 'GO does nothing'],
  [12, 'left minus 1', 'left plus 1', 'DONE adds a day'],
  [0, 'Count becomes 0.', 'Count becomes 1.', 'RESET goes to 1'],
];
(async () => {
  let caught = 0;
  for (const [i, from, to, what] of bad) {
    const prog = REF[i].replace(from, to); if (prog === REF[i]) { console.log('?? could not make', what); continue; }
    const r = await judgeAll(compileSE3(prog, FONT57).bytes, EXAM[i].tests);
    caught += !r.passed; console.log(r.passed ? '✗ MISSED' : '✓ caught', what.padEnd(32), r.passed ? '' : '→ ' + r.results.find(x => !x.passed).failed.slice(0, 90));
  }
  console.log(`\njudge caught ${caught}/${bad.length} wrong apps`);
})();
