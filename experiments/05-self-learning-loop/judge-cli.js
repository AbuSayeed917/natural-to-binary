// Judge a batch from Python: reads JSON lines {id, program, tests} on stdin, prints {id, compiled, passed, failed} lines.
// program = Structured English (compiled here first) or bytesHex = a raw binary.
const { compileSE3 } = require('../../compilers/structured-english-v3/se3.js');
const { FONT57 } = require('../../compilers/structured-english-v3/font57.js');
const { judgeAll } = require('./judge.js');
const lines = require('fs').readFileSync(0, 'utf8').split('\n').filter(Boolean);
(async () => {
  for (const line of lines) {
    const job = JSON.parse(line);
    let bytes;
    try { bytes = job.bytesHex ? new Uint8Array(job.bytesHex.match(/../g).map(h => parseInt(h, 16))) : compileSE3(job.program, FONT57).bytes; }
    catch (e) { console.log(JSON.stringify({ id: job.id, compiled: false, passed: false, failed: 'compiler: ' + e.message })); continue; }
    const r = await judgeAll(bytes, job.tests);
    const bad = r.results.filter(x => !x.passed);
    console.log(JSON.stringify({ id: job.id, compiled: true, passed: r.passed, testsPassed: r.results.length - bad.length, tests: r.results.length, failed: bad.length ? bad[0].name + ': ' + bad[0].failed : null }));
  }
})();
