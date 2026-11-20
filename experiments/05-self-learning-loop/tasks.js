// The teacher's tasks. Claude wrote these: everyday requests, each with tests that check what the app DOES.
// Requests name their buttons, so the tests can find them on screen. Numbers vary a lot on purpose,
// because the student's biggest weakness was getting numbers wrong (a 25-minute timer set to 150 seconds).
//
// EXAM: 20 tasks the student never trains on. TRAIN: made by small recipes with many different numbers,
// so no train task is a copy of an exam task.
const P = (...l) => l.map(x => ({ press: x }));
const times = (n, x) => Array(n).fill({ press: x });

const EXAM = [
  { request: 'A counter for push-ups with a + button and a RESET button', tests: [
    { name: 'three presses show 3', steps: times(3, '+').concat({ see: 3 }) },
    { name: 'RESET goes back to 0', steps: times(2, '+').concat(P('RESET'), { see: 0 }, { not_see: 2 }) }] },
  { request: 'A countdown timer from 45 seconds with a START button', tests: [
    { name: 'starts at 45', steps: [{ see: 45 }] },
    { name: '5 seconds after START shows 40', steps: [...P('START'), { wait: 5 }, { see: 40 }] },
    { name: 'stops at 0', steps: [...P('START'), { wait: 60 }, { see: 0 }, { no_number_below: 0 }] }] },
  { request: 'A tip calculator with a keypad and buttons for 10%, 15% and 20%', tests: [
    { name: '15% of 36.40 is 5.46', steps: [{ type: '36.4' }, ...P('15%'), { see: 5.46 }] },
    { name: '20% of 36.40 is 7.28', steps: [{ type: '36.4' }, ...P('20%'), { see: 7.28 }] }] },
  { request: 'Convert kilograms to pounds using a keypad', tests: [
    { name: '10 kg is 22.05 lb', steps: [{ type: '10' }, { press_any: ['=', 'CONVERT', 'GO'], optional: true }, { see_any: [22.05, 22.04] }] }] },
  { request: 'Roll one dice with a ROLL button', tests: [
    { name: 'shows 1 to 6 after a roll', steps: [...P('ROLL'), { number_between: [1, 6] }, { no_number_below: 1 }] },
    { name: 'rolling changes the screen', steps: [{ changes: times(5, 'ROLL') }] }] },
  { request: 'A to-do list where I type a task and press enter to add it', tests: [
    { name: 'adds a task', steps: [{ keys: 'walk dog\n' }, { see: 'WALK DOG' }] },
    { name: 'adds two tasks', steps: [{ keys: 'milk\neggs\n' }, { see: 'MILK' }, { see: 'EGGS' }] }] },
  { request: 'A score keeper for two teams, RED and BLUE, each with its own button that adds a point', tests: [
    { name: 'RED 2, BLUE 1', steps: [...times(2, 'RED'), ...P('BLUE'), { see: 2 }, { see: 1 }] }] },
  { request: 'A stopwatch with START, STOP and RESET buttons', tests: [
    { name: 'counts 3 seconds', steps: [...P('START'), { wait: 3 }, { see: 3 }] },
    { name: 'STOP freezes it', steps: [...P('START'), { wait: 2 }, ...P('STOP'), { wait: 3 }, { see: 2 }] },
    { name: 'RESET goes to 0', steps: [...P('START'), { wait: 2 }, ...P('RESET'), { see: 0 }] }] },
  { request: 'Split a bill between people with a keypad, and MORE and FEWER buttons for the number of people, starting at 2 people', tests: [
    { name: '90 between 2 is 45', steps: [{ type: '90' }, { see: 45 }] },
    { name: '90 between 3 is 30', steps: [{ type: '90' }, ...P('MORE'), { see: 30 }] }] },
  { request: 'A water tracker: each press of the GLASS button adds 250 ml, and it shows the total in ml', tests: [
    { name: '3 glasses is 750 ml', steps: [...times(3, 'GLASS'), { see: 750 }] }] },
  { request: 'A coin flip with a FLIP button that counts heads and tails', tests: [
    { name: '10 flips: heads + tails = 10', steps: [...times(10, 'FLIP'), { two_add_to: 10 }] }] },
  { request: 'Work out 20% VAT on a price typed on a keypad', tests: [
    { name: 'VAT on 50 is 10', steps: [{ type: '50' }, { press_any: ['=', 'VAT', 'GO'], optional: true }, { see: 10 }] }] },
  { request: 'A 30 day challenge that starts at 30 days left, and a DONE button takes one day off', tests: [
    { name: 'starts at 30', steps: [{ see: 30 }] },
    { name: '3 DONEs leaves 27', steps: [...times(3, 'DONE'), { see: 27 }] }] },
  { request: 'A savings tracker towards a goal of 800 pounds: type an amount on a keypad and press SAVE to add it', tests: [
    { name: 'shows the 800 goal', steps: [{ see: 800 }] },
    { name: 'saving 150 shows 150', steps: [{ type: '150' }, ...P('SAVE'), { see: 150 }, { see: 800 }] }] },
  { request: 'Convert minutes to hours using a keypad', tests: [
    { name: '90 minutes is 1.5 hours', steps: [{ type: '90' }, { press_any: ['=', 'CONVERT', 'GO'], optional: true }, { see: 1.5 }] }] },
  { request: 'A percentage calculator: type a number on a keypad, and buttons 10%, 25% and 50% show that percent of it', tests: [
    { name: '25% of 80 is 20', steps: [{ type: '80' }, ...P('25%'), { see: 20 }] },
    { name: '50% of 80 is 40', steps: [{ type: '80' }, ...P('50%'), { see: 40 }] }] },
  { request: 'A game where a red ball falls down the screen and LEFT and RIGHT buttons move a paddle', tests: [
    { name: 'the ball moves by itself', steps: [{ changes: [{ wait: 1 }] }] },
    { name: 'LEFT moves the paddle', steps: [{ changes: P('LEFT') }] }] },
  { request: 'A quiz on adding two random numbers from 1 to 10, with a CHECK button and a results screen', tests: [
    { name: 'shows the question numbers', steps: [{ number_between: [1, 10], count: 2 }] },
    { name: 'CHECK goes to a results screen', steps: [{ changes: [{ type: '5' }, ...P('CHECK')] }, { not_see: 'CHECK' }] }] },
  { request: 'A pocket money saver: each press of WEEK adds 5 pounds', tests: [
    { name: '4 weeks is 20 pounds', steps: [...times(4, 'WEEK'), { see: 20 }] }] },
  { request: 'A countdown from 10 that starts when I press GO and stops at zero', tests: [
    { name: 'starts at 10', steps: [{ see: 10 }] },
    { name: 'waits for GO', steps: [{ wait: 3 }, { see: 10 }] },
    { name: '3 seconds after GO shows 7', steps: [...P('GO'), { wait: 3 }, { see: 7 }] },
    { name: 'stops at 0', steps: [...P('GO'), { wait: 20 }, { see: 0 }, { no_number_below: 0 }] }] },
];

// --- training recipes: each makes many tasks with different numbers and names ---
function makeTrain(seed = 7, n = 60) {
  let s = seed; const rnd = k => { s = (s * 1103515245 + 12345) % 2147483648; return s % k; }; const pick = a => a[rnd(a.length)];
  const R = [
    () => { const thing = pick(['laps', 'pages read', 'cups of tea', 'goals', 'reps', 'birds seen', 'steps climbed']), b = pick(['+', 'ADD', 'ONE MORE', 'COUNT']), k = 2 + rnd(4);
      return { request: `A counter for ${thing} with a ${b} button`, tests: [{ name: `${k} presses show ${k}`, steps: [...times(k, b), { see: k }] }] }; },
    () => { const thing = pick(['press-ups', 'visitors', 'tickets', 'sit-ups']), b = pick(['+', 'ADD']), k = 2 + rnd(5);
      return { request: `A counter for ${thing} with a ${b} button and a RESET button`, tests: [{ name: `${k} presses`, steps: [...times(k, b), { see: k }] }, { name: 'reset', steps: [...times(k, b), ...P('RESET'), { see: 0 }] }] }; },
    () => { const N = pick([20, 30, 40, 50, 75, 90, 100, 120, 180, 300]), b = pick(['START', 'GO', 'BEGIN']), w = 2 + rnd(6);
      return { request: `A countdown timer from ${N} seconds with a ${b} button`, tests: [{ name: `starts at ${N}`, steps: [{ see: N }] }, { name: `${w} s later`, steps: [...P(b), { wait: w }, { see: N - w }] }, { name: 'stops at 0', steps: [...P(b), { wait: N + 5 }, { see: 0 }, { no_number_below: 0 }] }] }; },
    () => { const M = pick([2, 3, 5, 10, 15, 20]), b = pick(['START', 'GO']);
      return { request: `A ${M} minute timer with a ${b} button that counts down the seconds`, tests: [{ name: `starts at ${M * 60}`, steps: [{ see: M * 60 }] }, { name: '4 s later', steps: [...P(b), { wait: 4 }, { see: M * 60 - 4 }] }] }; },
    () => { const [from, to, f] = pick([['miles', 'kilometres', 1.609344], ['inches', 'centimetres', 2.54], ['feet', 'metres', 0.3048], ['hours', 'minutes', 60], ['litres', 'pints', 1.759754], ['kilometres', 'miles', 0.621371], ['pounds', 'kilograms', 0.453592], ['days', 'hours', 24], ['metres', 'centimetres', 100]]);
      const v = pick([3, 4, 5, 7, 8, 12, 20, 25]), a = Math.round(v * f * 100) / 100, t = Math.floor(v * f * 100) / 100;
      return { request: `Convert ${from} to ${to} using a keypad`, tests: [{ name: `${v} ${from}`, steps: [{ type: String(v) }, { press_any: ['=', 'CONVERT', 'GO'], optional: true }, { see_any: [...new Set([a, t])] }] }] }; },
    () => { const ps = pick([[5, 10, 15], [10, 12.5, 15], [15, 18, 20], [10, 20, 30]]), bill = pick([24.8, 36.4, 52.6, 18.2, 64]), p = pick(ps), a = Math.round(bill * p) / 100, t = Math.floor(bill * p) / 100;
      return { request: `A tip calculator with a keypad and buttons for ${ps[0]}%, ${ps[1]}% and ${ps[2]}%`, tests: [{ name: `${p}% of ${bill}`, steps: [{ type: String(bill) }, ...P(p + '%'), { see_any: [...new Set([a, t])] }] }] }; },
    () => { const sides = pick([4, 6, 8, 10, 12, 20]), b = pick(['ROLL', 'THROW', 'GO']);
      return { request: `Roll a ${sides}-sided dice with a ${b} button`, tests: [{ name: `1 to ${sides}`, steps: [...P(b), { number_between: [1, sides] }, { no_number_below: 1 }] }, { name: 'changes', steps: [{ changes: times(4, b) }] }] }; },
    () => { const [b, amt, unit] = pick([['GLASS', 250, 'ml'], ['WALK', 1000, 'steps'], ['WEEK', 5, 'pounds'], ['DAY', 3, 'pounds'], ['CUP', 200, 'ml'], ['LAP', 400, 'metres']]), k = 2 + rnd(4);
      return { request: `Each press of the ${b} button adds ${amt} ${unit}, and it shows the total`, tests: [{ name: `${k} presses = ${k * amt}`, steps: [...times(k, b), { see: k * amt }] }] }; },
    () => { const N = pick([7, 10, 14, 21, 30, 60, 100]), b = pick(['DONE', 'TICK', 'NEXT']), k = 2 + rnd(3);
      return { request: `A ${N} day challenge that starts at ${N} days left, and a ${b} button takes one day off`, tests: [{ name: `starts at ${N}`, steps: [{ see: N }] }, { name: `${k} days`, steps: [...times(k, b), { see: N - k }] }] }; },
    () => { const [a, b2] = pick([['HOME', 'AWAY'], ['RED', 'BLUE'], ['US', 'THEM'], ['CATS', 'DOGS']]), x = 1 + rnd(3), y = x + 1 + rnd(2);
      return { request: `A score keeper for two teams, ${a} and ${b2}, each with a button that adds a point`, tests: [{ name: `${a} ${x}, ${b2} ${y}`, steps: [...times(x, a), ...times(y, b2), { see: x }, { see: y }] }] }; },
    () => { const pp = pick([2, 3, 4]), bill = pick([60, 84, 120, 96, 150]);
      return { request: `Split a bill between people with a keypad, and MORE and FEWER buttons, starting at ${pp} people`, tests: [{ name: `${bill} / ${pp}`, steps: [{ type: String(bill) }, { see: Math.round(bill / pp * 100) / 100 }] }, { name: `${bill} / ${pp + 1}`, steps: [{ type: String(bill) }, ...P('MORE'), { see_any: [Math.round(bill / (pp + 1) * 100) / 100, Math.floor(bill / (pp + 1) * 100) / 100] }] }] }; },
    () => { const p = pick([5, 12.5, 17.5, 20, 25]), v = pick([40, 80, 120, 64]), what = pick(['VAT', 'a discount', 'a pay rise']);
      return { request: `Work out ${p}% ${what === 'VAT' ? 'VAT' : 'for ' + what} on an amount typed on a keypad`, tests: [{ name: `${p}% of ${v}`, steps: [{ type: String(v) }, { press_any: ['=', 'GO'], optional: true }, { see: Math.round(v * p) / 100 }] }] }; },
    () => { const b = pick(['FLIP', 'TOSS']), k = 6 + rnd(6);
      return { request: `A coin flip with a ${b} button that counts heads and tails`, tests: [{ name: `${k} flips`, steps: [...times(k, b), { two_add_to: k }] }] }; },
    () => { const what = pick(['shopping list', 'packing list', 'to-do list', 'list of films to watch']), [i1, i2] = pick([['BREAD', 'JAM'], ['SOCKS', 'HAT'], ['GYM', 'BANK'], ['TEA', 'RICE']]);
      return { request: `A ${what} where I type an item and press enter to add it`, tests: [{ name: 'two items', steps: [{ keys: `${i1.toLowerCase()}\n${i2.toLowerCase()}\n` }, { see: i1 }, { see: i2 }] }] }; },
    () => { const [a, b, c] = pick([['START', 'STOP', 'RESET'], ['GO', 'PAUSE', 'CLEAR'], ['BEGIN', 'HALT', 'ZERO']]), w = 2 + rnd(4);
      return { request: `A stopwatch with ${a}, ${b} and ${c} buttons`, tests: [{ name: `counts ${w}`, steps: [...P(a), { wait: w }, { see: w }] }, { name: 'stop', steps: [...P(a), { wait: w }, ...P(b), { wait: 2 }, { see: w }] }, { name: 'reset', steps: [...P(a), { wait: w }, ...P(c), { see: 0 }] }] }; },
  ];
  const out = [], seen = new Set(EXAM.map(e => e.request));
  for (let tries = 0; out.length < n && tries < 5000; tries++) { const t = R[tries % R.length](); if (!seen.has(t.request)) { seen.add(t.request); out.push(t); } }
  return out;
}

module.exports = { EXAM, makeTrain };
