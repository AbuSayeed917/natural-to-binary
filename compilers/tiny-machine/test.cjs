const { compileTiny } = require('./tinyc.js');
const checks = []; const ok = (n, v) => { checks.push(v); console.log(v ? '✓' : '✗', n); };
async function boot(text) {
  const r = compileTiny(text);
  const { instance } = await WebAssembly.instantiate(r.bytes);
  const e = instance.exports, mem = new Uint8Array(e.memory.buffer);
  return { r, click: (x, y) => e.click(x, y), px: (x, y) => (e.draw(), mem[y * 32 + x]) };
}
(async () => {
  let m = await boot('A red square in the middle.');
  ok('red square centre is red', m.px(16, 16) === 2); ok('background black', m.px(0, 0) === 0);
  m = await boot('A black screen with a red square in the middle. When I click the square, it turns green. Clicking it again turns it back. Clicks outside the square do nothing.');
  ok('starts red', m.px(16, 16) === 2); m.click(1, 1); ok('outside click ignored', m.px(16, 16) === 2);
  m.click(16, 16); ok('click inside → green', m.px(16, 16) === 3); m.click(15, 15); ok('click again → red', m.px(16, 16) === 2);
  m = await boot('Make the background blue. A small yellow square in the top left and a big pink square in the bottom right.');
  ok('blue background', m.px(16, 2) === 4); ok('yellow top left', m.px(5, 5) === 12); ok('pink bottom right', m.px(26, 26) === 15);
  m = await boot('A white screen. When I click anywhere the screen changes colour.');
  ok('white start', m.px(0, 0) === 1); m.click(3, 30); ok('cycles to next', m.px(0, 0) === 2);
  m = await boot('A green dot in the middle that turns red when I click it.');
  ok('green dot', m.px(16, 16) === 3); m.click(16, 16); ok('dot turns red', m.px(16, 16) === 2);
  m = await boot('a blue square on the left and a red square on the right. when i click the red square, the blue square turns yellow.');
  ok('blue left', m.px(6, 16) === 4); m.click(26, 16); ok('clicking red changes the blue one', m.px(6, 16) === 12 && m.px(26, 16) === 2);
  try { compileTiny('dance around'); ok('nonsense gives an error', false); } catch (e) { ok('nonsense gives an error: ' + e.message, true); }
  console.log(`\n${checks.filter(Boolean).length}/${checks.length} pass`);
})();
