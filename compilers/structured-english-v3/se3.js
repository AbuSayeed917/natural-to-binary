// Structured English v0.3 -> WebAssembly binary for a 160x240 "Tiny Phone".
// The host machine provides memory (screen = 1 byte per pixel, 16 colours) and calls:
//   start()  once,  draw()  to repaint,  click(x, y),  key(code),  tick()  ten times a second.
// Before start(), the host writes a random seed at SEED_AT. To keep data between visits, the host saves the `keep` memory regions.
// Numbers are stored with 2 decimal places (x100) as 64-bit integers, so money and decimals work.
function compileSE3(text, font) {
  const FONTDATA = font || (typeof FONT57 !== 'undefined' ? FONT57 : null);
  if (!FONTDATA) throw new Error('compileSE3 needs the 5x7 font (font57.js)');
  const W = 160, H = 240, GW = 6, GH = 7;
  const COLOURS = { black:0, white:1, red:2, green:3, blue:4, orange:5, purple:6, teal:7, grey:8, gray:8, salmon:9, lime:10, sky:11, yellow:12, lilac:13, charcoal:14, pink:15 };
  const SEED_AT = 38900, TICK_AT = 38904, SCREEN_AT = 38908, OP_AT = 39000, DISP_AT = 39100, PLACES_AT = 39500, VARS_AT = 40000, BOX_AT = 41000, LIST_AT = 42000, STR_AT = 50000, FONT_AT = 60000;
  const BOX_MAX = 18, LIST_MAX = 6, ROW = 18;
  const KEY = { left: 17, up: 18, right: 19, down: 20, space: 32, enter: 13 };

  const FONT = new Array(128 * GH).fill(0);
  for (const [ch, rows] of Object.entries(FONTDATA)) {
    const codes = [ch.charCodeAt(0)]; if (/[A-Z]/.test(ch)) codes.push(ch.toLowerCase().charCodeAt(0));
    for (const code of codes) rows.forEach((r, i) => FONT[code * GH + i] = r);
  }
  const toCodes = s => [...s.toUpperCase()].map(ch => ch === '°' ? 0x1c : ch === '÷' ? 0x1d : ch === '×' ? 0x1e : ch === '£' ? 0x1f : ch === '−' ? 45 : ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : 63);
  const textW = (s, sc) => toCodes(s).length * GW * sc - sc;

  // ---- byte helpers ----
  const uleb = n => { const o = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return o; };
  const sleb = n => { const o = []; while (true) { let b = n & 0x7f; n >>= 7; if ((n === 0 && !(b & 0x40)) || (n === -1 && (b & 0x40))) { o.push(b); return o; } o.push(b | 0x80); } };
  const c = n => [0x41, ...sleb(n)], C = n => [0x42, ...sleb(n)], g = i => [0x20, i], st = i => [0x21, i], call = f => [0x10, f];
  const I = { add:0x6a, sub:0x6b, mul:0x6c, divs:0x6d, divu:0x6e, remu:0x70, and:0x71, or:0x72, xor:0x73, shl:0x74, shru:0x76, eqz:0x45, eq:0x46, ne:0x47, lt:0x48, ltu:0x49, gt:0x4a, le:0x4c, ge:0x4e };
  const L = { add:0x7c, sub:0x7d, mul:0x7e, divs:0x7f, rems:0x81, eqz:0x50, eq:0x51, ne:0x52, lt:0x53, gt:0x55, le:0x57, ge:0x59, wrap:0xa7, ext:0xac, extu:0xad };
  const LD8 = [0x2d, 0, 0], ST8 = [0x3a, 0, 0], LD32 = [0x28, 2, 0], ST32 = [0x36, 2, 0], LD64 = [0x29, 3, 0], ST64 = [0x37, 3, 0];
  const COPY = [0xfc, 0x0a, 0, 0];
  const IF = [0x04, 0x40], IF64 = [0x04, 0x7e], ELSE = 0x05, END = 0x0b, RET = 0x0f;
  const until = (cond, body) => [0x02, 0x40, 0x03, 0x40, ...cond, 0x0d, 1, ...body, 0x0c, 0, END, END];
  const F = { start:0, draw:1, click:2, key:3, tick:4, rect:5, glyph:6, text:7, num:8, circle:9, mul:10, div:11, tdigit:12, tpoint:13, boxkey:14, listadd:15, listdraw:16, listclick:17, rand:18 };

  // ---- built-in library (the same bytes in every app) ----
  const lib = {};
  lib.rect = [[2,0x7f]], lib.rect.code = [...g(1), ...st(5),                          // rect(x, y, w, h, colour)
    ...until([...g(5), ...g(1), ...g(3), I.add, I.ge], [...g(0), ...st(6),
      ...until([...g(6), ...g(0), ...g(2), I.add, I.ge], [...g(6), ...c(W), I.ltu, ...g(5), ...c(H), I.ltu, I.and, ...IF,
        ...g(5), ...c(W), I.mul, ...g(6), I.add, ...g(4), ...ST8, END, ...g(6), ...c(1), I.add, ...st(6)]),
      ...g(5), ...c(1), I.add, ...st(5)])];
  lib.glyph = [[3,0x7f]], lib.glyph.code = [...c(0), ...st(5),                       // glyph(code, x, y, colour, scale)
    ...until([...g(5), ...c(GH), I.ge], [...c(FONT_AT), ...g(0), ...c(GH), I.mul, I.add, ...g(5), I.add, ...LD8, ...st(7), ...c(0), ...st(6),
      ...until([...g(6), ...c(5), I.ge], [...g(7), ...c(16), ...g(6), I.shru, I.and, ...IF,
          ...g(1), ...g(6), ...g(4), I.mul, I.add, ...g(2), ...g(5), ...g(4), I.mul, I.add, ...g(4), ...g(4), ...g(3), ...call(F.rect), END,
        ...g(6), ...c(1), I.add, ...st(6)]),
      ...g(5), ...c(1), I.add, ...st(5)])];
  lib.text = [[1,0x7f]], lib.text.code = [...c(0), ...st(6),                         // text(addr, len, x, y, colour, scale)
    ...until([...g(6), ...g(1), I.ge], [...g(0), ...g(6), I.add, ...LD8, ...g(2), ...g(6), ...c(GW), ...g(5), I.mul, I.mul, I.add,
      ...g(3), ...g(4), ...g(5), ...call(F.glyph), ...g(6), ...c(1), I.add, ...st(6)])];
  const drawCh = codeBytes => [...g(7), ...g(10), I.sub, ...st(7), ...codeBytes, ...g(7), ...g(2), ...g(3), ...g(4), ...call(F.glyph)];
  lib.num = [[2,0x7f],[1,0x7e],[2,0x7f]], lib.num.code = [                           // num(value, right x, y, colour, scale, money)
    ...g(4), ...c(GW), I.mul, ...st(10),
    ...g(0), ...C(0), L.lt, ...st(6), ...g(6), ...IF, ...C(0), ...g(0), L.sub, ...st(0), END,
    ...g(1), ...st(7), ...g(0), ...C(100), L.rems, L.wrap, ...st(9), ...g(0), ...C(100), L.divs, ...st(8),
    ...g(5), ...IF, ...drawCh([...g(9), ...c(10), I.remu, ...c(48), I.add]), ...drawCh([...g(9), ...c(10), I.divu, ...c(48), I.add]), ...drawCh(c(46)),
    ELSE, ...g(9), ...IF, ...g(9), ...c(10), I.remu, I.eqz, ...IF, ...drawCh([...g(9), ...c(10), I.divu, ...c(48), I.add]),
      ELSE, ...drawCh([...g(9), ...c(10), I.remu, ...c(48), I.add]), ...drawCh([...g(9), ...c(10), I.divu, ...c(48), I.add]), END,
      ...drawCh(c(46)), END, END,
    0x03, 0x40, ...drawCh([...g(8), ...C(10), L.rems, L.wrap, ...c(48), I.add]), ...g(8), ...C(10), L.divs, ...st(8), ...g(8), L.eqz, I.eqz, 0x0d, 0, END,
    ...g(5), ...IF, ...drawCh(c(0x1f)), END, ...g(6), ...IF, ...drawCh(c(45)), END];
  lib.circle = [[2,0x7f]], lib.circle.code = [...c(0), ...g(2), I.sub, ...st(4),    // circle(cx, cy, r, colour)
    ...until([...g(4), ...g(2), I.gt], [...c(0), ...g(2), I.sub, ...st(5),
      ...until([...g(5), ...g(2), I.gt], [...g(5), ...g(5), I.mul, ...g(4), ...g(4), I.mul, I.add, ...g(2), ...g(2), I.mul, I.le, ...IF,
        ...g(0), ...g(5), I.add, ...g(1), ...g(4), I.add, ...c(1), ...c(1), ...g(3), ...call(F.rect), END, ...g(5), ...c(1), I.add, ...st(5)]),
      ...g(4), ...c(1), I.add, ...st(4)])];
  const round = (q, half) => [...g(q), ...C(0), L.ge, ...IF64, ...g(q), ...C(half), L.add, ELSE, ...g(q), ...C(half), L.sub, END];
  lib.mul = [[1,0x7e]], lib.mul.code = [...g(0), ...g(1), L.mul, ...st(2), ...round(2, 50), ...C(100), L.divs];
  lib.div = [[1,0x7e]], lib.div.code = [...g(1), L.eqz, ...IF, ...C(0), RET, END, ...g(0), ...C(1000), L.mul, ...g(1), L.divs, ...st(2), ...round(2, 5), ...C(10), L.divs];
  const vAddr = [...c(VARS_AT), ...g(0), ...c(8), I.mul, I.add], pAddr = [...c(PLACES_AT), ...g(0), ...c(4), I.mul, I.add];
  lib.tdigit = [[1,0x7f]], lib.tdigit.code = [...pAddr, ...LD32, ...st(2),
    ...g(2), I.eqz, ...IF, ...vAddr, ...vAddr, ...LD64, ...C(10), L.mul, ...g(1), L.ext, ...C(100), L.mul, L.add, ...ST64,
    ELSE, ...g(2), ...c(1), I.eq, ...IF, ...vAddr, ...vAddr, ...LD64, ...g(1), L.ext, ...C(10), L.mul, L.add, ...ST64, ...pAddr, ...c(2), ...ST32,
    ELSE, ...g(2), ...c(2), I.eq, ...IF, ...vAddr, ...vAddr, ...LD64, ...g(1), L.ext, L.add, ...ST64, ...pAddr, ...c(3), ...ST32, END, END, END];
  lib.tpoint = [], lib.tpoint.code = [...pAddr, ...LD32, I.eqz, ...IF, ...pAddr, ...c(1), ...ST32, END];
  lib.boxkey = [[1,0x7f]], lib.boxkey.code = [...g(0), ...LD8, ...st(2),
    ...g(1), ...c(8), I.eq, ...IF, ...g(2), ...IF, ...g(0), ...g(2), ...c(1), I.sub, ...ST8, END, RET, END,
    ...g(1), ...c(97), I.ge, ...g(1), ...c(122), I.le, I.and, ...IF, ...g(1), ...c(32), I.sub, ...st(1), END,
    ...g(1), ...c(32), I.ge, ...g(1), ...c(127), I.lt, I.and, ...g(2), ...c(BOX_MAX), I.lt, I.and, ...IF,
      ...g(0), ...c(1), I.add, ...g(2), I.add, ...g(1), ...ST8, ...g(0), ...g(2), ...c(1), I.add, ...ST8, END];
  lib.listadd = [[2,0x7f]], lib.listadd.code = [...g(0), ...LD8, ...st(2),
    ...g(2), ...c(LIST_MAX), I.lt, ...g(1), ...LD8, ...c(0), I.gt, I.and, ...IF,
      ...g(0), ...c(4), I.add, ...g(2), ...c(20), I.mul, I.add, ...st(3),
      ...g(3), ...g(1), ...LD8, ...ST8, ...g(3), ...c(1), I.add, ...c(0), ...ST8,
      ...g(3), ...c(2), I.add, ...g(1), ...c(1), I.add, ...c(BOX_MAX), ...COPY,
      ...g(0), ...g(2), ...c(1), I.add, ...ST8, ...g(1), ...c(0), ...ST8, END];
  lib.listdraw = [[4,0x7f]], lib.listdraw.code = [...g(0), ...LD8, ...st(5), ...c(0), ...st(3),
    ...until([...g(3), ...g(5), I.ge], [
      ...g(0), ...c(4), I.add, ...g(3), ...c(20), I.mul, I.add, ...st(4), ...g(1), ...g(3), ...c(ROW), I.mul, I.add, ...st(6),
      ...c(6), ...g(6), ...c(2), I.add, ...c(12), ...c(12), ...c(1), ...call(F.rect),
      ...g(4), ...c(1), I.add, ...LD8, ...IF,
        ...c(6), ...g(6), ...c(2), I.add, ...c(12), ...c(12), ...c(3), ...call(F.rect),
        ...g(4), ...c(2), I.add, ...g(4), ...LD8, ...c(24), ...g(6), ...c(3), I.add, ...c(8), ...c(1), ...call(F.text),
        ...c(24), ...g(6), ...c(6), I.add, ...g(4), ...LD8, ...c(GW), I.mul, ...c(1), ...c(8), ...call(F.rect),
      ELSE, ...c(7), ...g(6), ...c(3), I.add, ...c(10), ...c(10), ...c(0), ...call(F.rect),
        ...g(4), ...c(2), I.add, ...g(4), ...LD8, ...c(24), ...g(6), ...c(3), I.add, ...g(2), ...c(1), ...call(F.text), END,
      ...g(3), ...c(1), I.add, ...st(3)])];
  lib.listclick = [[2,0x7f]], lib.listclick.code = [...g(0), ...LD8, ...st(3),
    ...g(1), ...c(0), I.lt, ...g(1), ...g(3), I.ge, I.or, ...IF, RET, END,
    ...g(0), ...c(4), I.add, ...g(1), ...c(20), I.mul, I.add, ...st(4),
    ...g(2), ...c(1), I.eq, ...IF, ...g(4), ...c(1), I.add, ...c(1), ...g(4), ...c(1), I.add, ...LD8, I.sub, ...ST8,
    ELSE, ...g(4), ...g(4), ...c(20), I.add, ...g(3), ...c(1), I.sub, ...g(1), I.sub, ...c(20), I.mul, ...COPY, ...g(0), ...g(3), ...c(1), I.sub, ...ST8, END];
  lib.rand = [[3,0x7f]], lib.rand.code = [                                            // rand(lo, hi) -> whole number between, as x100
    ...c(SEED_AT), ...LD32, ...st(2), ...g(2), I.eqz, ...IF, ...c(0x2545F49), ...st(2), END,
    ...g(2), ...g(2), ...c(13), I.shl, I.xor, ...st(2), ...g(2), ...g(2), ...c(17), I.shru, I.xor, ...st(2), ...g(2), ...g(2), ...c(5), I.shl, I.xor, ...st(2),
    ...c(SEED_AT), ...g(2), ...ST32,
    ...g(0), ...C(100), L.divs, L.wrap, ...st(3), ...g(1), ...C(100), L.divs, L.wrap, ...g(3), I.sub, ...c(1), I.add, ...st(4),
    ...g(4), ...c(1), I.lt, ...IF, ...c(1), ...st(4), END,
    ...g(2), ...c(1), I.shru, ...g(4), I.remu, ...g(3), I.add, L.ext, ...C(100), L.mul];

  // ---- read the sentences ----
  const newScreen = name => ({ name, titles: [], displays: [], groups: [], draws: [], box: null, list: null });
  const P = { bg: 14, screens: [newScreen('MAIN')], round: false, ink: 1, vars: {}, init: {}, hasOp: false, events: [], keep: [], allDisplays: [],
    colours: { digit: 8, op: 5, '=': 3, C: 9, '.': 8, word: 4 }, named: {}, box: null, list: null };
  let S = P.screens[0], usedMain = false;
  const colourOf = w => { if (!(w in COLOURS)) throw new Error(`“${w}” isn't a colour I know (try: ${Object.keys(COLOURS).slice(0, 8).join(', ')}…)`); return COLOURS[w]; };
  const LABEL = { plus:'+', add:'+', '+':'+', minus:'-', '-':'-', '−':'-', times:'×', '×':'×', x:'×', '*':'×', divide:'÷', '÷':'÷', '/':'÷', equals:'=', '=':'=', c:'C', clear:'C', '.':'.', point:'.', dot:'.' };
  const OPCODE = { '+':1, '-':2, '×':3, '÷':4 };
  const quoted = s => [...s.matchAll(/"([^"]*)"/g)].map(m => m[1].toUpperCase());
  const labelOf = w => { if (/^\d$/.test(w)) return w; if (LABEL[w]) return LABEL[w]; return null; };
  let ev = null;
  const raw = text.replace(/[“”]/g, '"');
  const lines = raw.split('\n').flatMap((ln, n) => ln.split(/(?<=\.)\s+(?=[A-Z])/)
      .flatMap(p => /^\s*(when|every|on the)\b/i.test(p) ? p.split(/(?<=:)\s+/) : [p])
      .map(p => { const t = p.trim().toLowerCase(); return { n: n + 1, raw: p.trim(), s: (t.endsWith(':') ? t.slice(0, -1) : t.replace(/[.;!]$/, '')).trim() }; }))
    .filter(l => l.s && !l.s.startsWith('#'));
  const varIndex = name => { if (!(name in P.vars)) throw new Error(`I don't know a number called “${name}”. Add “Remember a number called ${name}.”`); return P.vars[name]; };
  const SHAPE = { circle: 'circle', dot: 'circle', ball: 'circle', square: 'square', box: 'square', block: 'square', bar: 'bar', paddle: 'bar' };

  for (const l of lines) {
    const s = l.s, q = quoted(l.raw); let m;
    try {
      if ((m = s.match(/^on the "[^"]*" screen$/))) {
        const name = q[0]; let sc = P.screens.find(x => x.name === name);
        if (!sc) { if (P.screens.length === 1 && !usedMain && P.screens[0].name === 'MAIN') { P.screens[0].name = name; sc = P.screens[0]; } else { sc = newScreen(name); P.screens.push(sc); } }
        S = sc; ev = null; continue;
      }
      if ((m = s.match(/^the (?:screen|background) is (\w+)$/))) { P.bg = colourOf(m[1]); ev = null; continue; }
      if ((m = s.match(/^write "[^"]*" at the top(?: in (\w+))?$/))) { S.titles.push({ text: q[0], colour: m[1] ? colourOf(m[1]) : 1 }); usedMain = true; ev = null; continue; }
      if ((m = s.match(/^(?:there is )?a display(?: called (\w+))?(?: at the top)?(?:,? labelled "[^"]*",?)? shows (.+?)(?: as (money))? in (\w+)(?: on (\w+))?$/))) {
        const what = m[2]; const stored = /^(numbers|money)$/.test(what);
        const d = { name: m[1] || null, label: /labelled/.test(s) ? q[0] : null, stored, expr: stored ? null : what, money: m[3] === 'money' || what === 'money', ink: colourOf(m[4]), back: m[5] ? colourOf(m[5]) : 0, idx: P.allDisplays.length };
        S.displays.push(d); P.allDisplays.push(d); usedMain = true; ev = null; continue;
      }
      if ((m = s.match(/^a text box called (\w+)(?:,? labelled "[^"]*")?$/))) { if (P.box) throw new Error('Only one text box for now'); P.box = S.box = { name: m[1], label: /labelled/.test(s) ? q[0] : null, screen: S }; P.named[m[1]] = 'box'; usedMain = true; ev = null; continue; }
      if ((m = s.match(/^a list called (\w+)$/))) { if (P.list) throw new Error('Only one list for now'); P.list = S.list = { name: m[1], screen: S }; P.named[m[1]] = 'list'; usedMain = true; ev = null; continue; }
      if ((m = s.match(/^buttons(?:,? (\w+) per row)?: (.+)$/))) {
        const words = { one:1, two:2, three:3, four:4, five:5, six:6 };
        const per = m[1] ? (words[m[1]] || parseInt(m[1], 10) || 4) : 4;
        const labels = [];
        for (const tok of m[2].match(/"[^"]*"|\S+/g)) {
          if (tok.startsWith('"')) { labels.push(tok.slice(1, -1).toUpperCase()); continue; }
          const t = tok.replace(/,$/, ''); const lab = labelOf(t);
          if (lab) labels.push(lab); else if (/^[a-z][a-z%]*$/.test(t)) labels.push(t.toUpperCase()); else if (t) throw new Error(`I can't make a button from “${t}”. Put words in quotes, like "ADD".`);
        }
        S.groups.push({ per: Math.min(per, labels.length) || 1, labels }); usedMain = true; ev = null; continue;
      }
      if ((m = s.match(/^draw an? (?:(\w+) )?(\w+)(?: of size (\d+))? at (.+?) and (.+)$/)) && (SHAPE[m[2]])) {
        S.draws.push({ colour: m[1] ? colourOf(m[1]) : 1, shape: SHAPE[m[2]], size: m[3] ? +m[3] : 8, x: m[4], y: m[5], line: l }); usedMain = true; ev = null; continue;
      }
      if (/^the buttons are round$/.test(s)) { P.round = true; continue; }
      if ((m = s.match(/^the (?:(digit|operation|equals|clear|c|word|point|=|\.) )?buttons? (?:are|is) (\w+)$/))) {
        const k = { digit: 'digit', operation: 'op', equals: '=', '=': '=', clear: 'C', c: 'C', word: 'word', point: '.', '.': '.' }[m[1]] || 'all';
        const col = colourOf(m[2]); if (k === 'all') for (const key in P.colours) if (!key.startsWith('w:')) P.colours[key] = col; else; else P.colours[k] = col; continue;
      }
      if ((m = s.match(/^the "([^"]*)" button is (\w+)$/))) { P.colours['w:' + m[1].toUpperCase()] = colourOf(m[2]); continue; }
      if ((m = s.match(/^the labels are (\w+)$/))) { P.ink = colourOf(m[1]); continue; }
      if ((m = s.match(/^(?:keep|save) (.+?) between visits$/))) { P.keep.push(...m[1].split(/\s*,\s*(?:and\s+)?|\s+and\s+/).filter(Boolean)); continue; }
      if ((m = s.match(/^remember (.+)$/)) && !ev) {
        for (const part of m[1].split(/\s*,\s*(?:and\s+)?|\s+and\s+/).filter(Boolean)) {
          let k;
          if ((k = part.match(/^an? number called (\w+)(?: starting at (-?[\d.]+))?$/))) { P.vars[k[1]] = Object.keys(P.vars).length; if (k[2]) P.init[k[1]] = Math.round(parseFloat(k[2]) * 100); }
          else if (/^an? operation$/.test(part)) P.hasOp = true;
          else throw new Error(`I can remember “a number called …” or “an operation”, not “${part}”`);
        }
        continue;
      }
      if ((m = s.match(/^every (second|tenth of a second|half (?:a )?second|(\d+) seconds)$/))) {
        const every = m[2] ? +m[2] * 10 : m[1] === 'second' ? 10 : m[1].startsWith('half') ? 5 : 1;
        ev = { kind: 'tick', every, labels: [], actions: [], line: l }; P.events.push(ev); continue;
      }
      if ((m = s.match(/^when i (?:click|tap|press) an item in (\w+)$/))) {
        if (!P.list || P.list.name !== m[1]) throw new Error(`There's no list called “${m[1]}”`);
        ev = { kind: 'item', labels: [], actions: [], line: l }; P.events.push(ev); continue;
      }
      if ((m = s.match(/^when the app (?:opens|starts)$/))) { ev = { kind: 'start', labels: [], actions: [], line: l }; P.events.push(ev); continue; }
      if ((m = s.match(/^when (?:i press|i type|i click on|i tap) (.+)$/))) {
        const what = m[1].replace(/^the /, '').replace(/ (?:arrow|key)$/, ''); let labels;
        if (/^an? (digit|number)$/.test(what)) labels = '0123456789'.split('');
        else if (/^an? operation$/.test(what)) labels = ['+', '-', '×', '÷'];
        else if (KEY[what] && !q.length) labels = ['KEY:' + what];
        else if (q.length) labels = [q[0]];
        else if (labelOf(what)) labels = [labelOf(what)];
        else labels = [what.toUpperCase()];
        ev = { kind: 'press', labels, actions: [], line: l }; P.events.push(ev); continue;
      }
      if (ev) { ev.actions.push({ s, l }); continue; }
      throw new Error('I don\'t know this kind of sentence');
    } catch (e) { throw new Error(`Line ${l.n}, “${l.raw}”: ${e.message}`); }
  }
  if (!P.screens.some(x => x.groups.length || x.displays.length || x.box || x.draws.length || x.titles.length)) throw new Error('Describe a display, a text box, a drawing or some buttons to start.');

  // ---- expressions: numbers with 2 decimals (i64, x100) ----
  function expr(src, ctx) {
    const t = src.replace(/\bmultiplied by\b/g, ' times ').replace(/\bdivided by\b/g, ' over ').replace(/([()])/g, ' $1 ').trim().split(/\s+/);
    let i = 0;
    const atom = () => {
      let w = t[i++];
      if (w === 'a' && t[i] === 'random') {
        i++; if (t[i] === 'number') i++; if (t[i] === 'from' || t[i] === 'between') i++; else throw new Error('write it as “a random number from 1 to 6”');
        const lo = post(); if (t[i] !== 'to' && t[i] !== 'and') throw new Error('write it as “a random number from 1 to 6”'); i++;
        const hi = post(); return [...lo, ...hi, ...call(F.rand)];
      }
      if (w === 'the') w = t[i++];
      if (w === undefined) throw new Error('the sentence ends too early');
      if (w === '(') { const e = add(); if (t[i++] !== ')') throw new Error('missing a closing bracket'); return e; }
      if (/^-?\d+(\.\d+)?$/.test(w)) return C(Math.round(parseFloat(w) * 100));
      if (w === 'digit') { if (ctx.digit === undefined) throw new Error('“the digit” only makes sense in “When I press a digit”'); return C(ctx.digit * 100); }
      return [...c(VARS_AT + 8 * varIndex(w)), ...LD64];
    };
    const post = () => { let e = atom(); while (t[i] === 'percent' || t[i] === '%') { i++; e = [...e, ...C(100), L.divs]; } return e; };
    const mul = () => { let e = post(); while (['times', 'over', 'of'].includes(t[i])) { const op = t[i++]; e = [...e, ...post(), ...call(op === 'over' ? F.div : F.mul)]; } return e; };
    const add = () => { let e = mul(); while (t[i] === 'plus' || t[i] === 'minus') { const op = t[i++]; e = [...e, ...mul(), op === 'plus' ? L.add : L.sub]; } return e; };
    const out = add();
    if (i < t.length) throw new Error(`I don't understand “${t.slice(i).join(' ')}”`);
    return out;
  }
  const pixel = (src) => [...expr(src, {}), ...C(100), L.divs, L.wrap];
  const COND = [['is more than', L.gt], ['is greater than', L.gt], ['is bigger than', L.gt], ['is less than', L.lt], ['is smaller than', L.lt], ['is at least', L.ge], ['is at most', L.le], ['is not', L.ne], ['is', L.eq]];
  function cond(src, ctx) { for (const [w, op] of COND) { const k = src.indexOf(' ' + w + ' '); if (k > 0) return [...expr(src.slice(0, k), ctx), ...expr(src.slice(k + w.length + 2), ctx), op]; } throw new Error(`I can't read the condition “${src}” (try “x is more than 1”)`); }
  const setVar = (name, val) => { const v = varIndex(name); return [...c(VARS_AT + 8 * v), ...val, ...ST64, ...c(PLACES_AT + 4 * v), ...c(0), ...ST32]; };
  const screenIndex = name => { const k = P.screens.findIndex(x => x.name === name); if (k < 0) throw new Error(`There's no screen called “${name}”. Add “On the "${name}" screen:”`); return k; };

  function action(s, ctx, raw) {
    let m;
    if ((m = s.match(/^if (.+?), (.+)$/))) return [...cond(m[1], ctx), ...IF, ...action(m[2], ctx, raw), END];
    if ((m = s.match(/^go to the "?([^"]+?)"? screen$/))) { const name = (quoted(raw)[0] || m[1]).toUpperCase(); return [...c(SCREEN_AT), ...c(screenIndex(name)), ...ST32]; }
    if ((m = s.match(/^(\w+) becomes (.+)$/)) || (m = s.match(/^set (\w+) to (.+)$/))) return setVar(m[1], expr(m[2], ctx));
    if ((m = s.match(/^type the digit into (\w+)$/))) { if (ctx.digit === undefined) throw new Error('“Type the digit” only works in “When I press a digit”'); return [...c(varIndex(m[1])), ...c(ctx.digit), ...call(F.tdigit)]; }
    if ((m = s.match(/^type a (?:point|dot|decimal point) into (\w+)$/))) return [...c(varIndex(m[1])), ...call(F.tpoint)];
    if ((m = s.match(/^show (.+?)(?: on (\w+))?$/))) {
      const ds = P.allDisplays.filter(d => d.stored); let d;
      if (m[2]) { d = ds.find(x => x.name === m[2]); if (!d) throw new Error(`There's no display called “${m[2]}” that shows numbers or money`); }
      else { if (ds.length !== 1) throw new Error(ds.length ? 'Say which display: “Show x on name.”' : 'Add a display that “shows numbers” first'); d = ds[0]; }
      return [...c(DISP_AT + 8 * d.idx), ...expr(m[1], ctx), ...ST64];
    }
    if ((m = s.match(/^clear (\w+)$/))) {
      const n = m[1];
      if (P.named[n] === 'box') return [...c(BOX_AT), ...c(0), ...ST8];
      if (P.named[n] === 'list') return [...c(LIST_AT), ...c(0), ...ST8];
      return setVar(n, C(0));
    }
    if (/^remember the operation$/.test(s)) { if (!(ctx.label in OPCODE)) throw new Error('“Remember the operation” only works for + − × ÷ buttons'); return [...c(OP_AT), ...c(OPCODE[ctx.label]), ...ST32]; }
    if ((m = s.match(/^apply the operation to (\w+) and (\w+),? and put the answer in (\w+)$/))) {
      if (!P.hasOp) throw new Error('Add “Remember … an operation.” first');
      const a = [...c(VARS_AT + 8 * varIndex(m[1])), ...LD64], b = [...c(VARS_AT + 8 * varIndex(m[2])), ...LD64];
      const when = (code, val) => [...c(OP_AT), ...LD32, ...c(code), I.eq, ...IF, ...setVar(m[3], val), END];
      return [...when(1, [...a, ...b, L.add]), ...when(2, [...a, ...b, L.sub]), ...when(3, [...a, ...b, ...call(F.mul)]), ...when(4, [...a, ...b, ...call(F.div)])];
    }
    if ((m = s.match(/^add (\w+) to (\w+)$/))) { if (P.named[m[1]] !== 'box' || P.named[m[2]] !== 'list') throw new Error('“Add” needs a text box and a list, like “Add task to tasks.”'); return [...c(LIST_AT), ...c(BOX_AT), ...call(F.listadd)]; }
    if (/^(tick|untick|check) it$/.test(s)) { if (!ctx.item) throw new Error('“Tick it” only works in “When I click an item in …”'); return [...c(LIST_AT), ...g(2), ...c(1), ...call(F.listclick)]; }
    if (/^(remove|delete) it$/.test(s)) { if (!ctx.item) throw new Error('“Remove it” only works in “When I click an item in …”'); return [...c(LIST_AT), ...g(2), ...c(2), ...call(F.listclick)]; }
    throw new Error('I don\'t know this action');
  }
  const runActions = (e, ctx) => e.actions.flatMap(a => { try { return action(a.s, ctx, a.l.raw); } catch (err) { throw new Error(`Line ${a.l.n}, “${a.l.raw}”: ${err.message}`); } });

  // ---- layout per screen: things from the top, buttons from the bottom ----
  const big = sc => sc.displays.length === 1 && !sc.box && !sc.list;
  for (const sc of P.screens) {
    let y = 6; sc.lay = { titles: [], displays: [], buttons: [] };
    for (const t of sc.titles) { const s2 = textW(t.text, 2) <= 152 ? 2 : 1; sc.lay.titles.push({ ...t, sc: s2, x: Math.max(4, (W - textW(t.text, s2)) >> 1), y }); y += s2 * GH + 6; }
    for (const d of sc.displays) {
      const s2 = big(sc) ? 3 : 2, h = big(sc) ? 32 : 22; let ly = null;
      if (d.label) { ly = y; y += 9; }
      sc.lay.displays.push({ ...d, ly, y, h, sc: s2 }); y += h + 6;
    }
    if (sc.box) { if (sc.box.label) { sc.box.ly = y; y += 9; } sc.box.y = y; y += 24; }
    if (sc.list) { sc.list.y = y; y += LIST_MAX * ROW + 4; }
    sc.topEnd = y;
    const rows = sc.groups.reduce((n, gp) => n + Math.ceil(gp.labels.length / gp.per), 0);
    if (rows) {
      const room = H - 4 - y, bh = Math.min(40, Math.floor((room - (rows - 1) * 4) / rows));
      if (bh < 16) throw new Error(`There are too many things to fit on the${P.screens.length > 1 ? ' "' + sc.name + '"' : ''} screen. Try fewer buttons or displays, or another screen.`);
      let by = H - 4 - rows * bh - (rows - 1) * 4;
      for (const gp of sc.groups) {
        const bw = Math.floor((152 - (gp.per - 1) * 4) / gp.per);
        gp.labels.forEach((lab, i) => { if (i && i % gp.per === 0) by += bh + 4; sc.lay.buttons.push({ lab, x: 4 + (i % gp.per) * (bw + 4), y: by, w: bw, h: bh }); });
        by += bh + 4;
      }
    }
  }
  const allButtons = P.screens.flatMap(sc => sc.lay.buttons);
  const kindOf = lab => /^\d$/.test(lab) ? 'digit' : lab in OPCODE ? 'op' : lab === '=' ? '=' : lab === 'C' ? 'C' : lab === '.' ? '.' : 'word';
  for (const e of P.events) if (e.kind === 'press') for (const lab of e.labels) if (e.labels.length === 1 && lab !== 'ENTER' && !lab.startsWith('KEY:') && !allButtons.some(b => b.lab === lab)) throw new Error(`Line ${e.line.n}: there's no ${lab} button to press. Add it to a “Buttons:” list.`);

  // ---- strings go into memory once ----
  const strs = []; let strPtr = STR_AT; const strAt = s => { const codes = toCodes(s); const at = strPtr; strs.push({ at, codes }); strPtr += codes.length; return { at, len: codes.length }; };
  const textCall = (s, x, yy, col, sc) => { const r = strAt(s); return [...c(r.at), ...c(r.len), ...c(x), ...c(yy), ...c(col), ...c(sc), ...call(F.text)]; };

  // ---- the program's own parts ----
  const parts = []; const multi = P.screens.length > 1;
  const onScreen = (k, code) => multi ? [...c(SCREEN_AT), ...LD32, ...c(k), I.eq, ...IF, ...code, END] : code;
  const startBody = [...Object.entries(P.init).flatMap(([n, v]) => [...c(VARS_AT + 8 * P.vars[n]), ...C(v), ...ST64]), ...P.events.filter(e => e.kind === 'start').flatMap(e => runActions(e, {}))];
  parts.push({ label: 'Start: starting values and “When the app opens”', bytes: startBody });
  const draw = [...c(0), ...c(0), ...c(W), ...c(H), ...c(P.bg), ...call(F.rect)];
  parts.push({ label: 'Paint the screen', bytes: draw.slice() });
  const pressActs = lab => P.events.filter(e => e.kind === 'press' && e.labels.includes(lab)).flatMap(e => runActions(e, { label: lab, digit: /^\d$/.test(lab) ? +lab : undefined }));
  const click = [];
  P.screens.forEach((sc, k) => {
    const d = [], tag = multi ? ` (“${sc.name}” screen)` : '';
    for (const t of sc.lay.titles) { const b = textCall(t.text, t.x, t.y, t.colour, t.sc); d.push(...b); parts.push({ label: `Write “${t.text}”${tag}`, bytes: b }); }
    for (const dp of sc.lay.displays) {
      const b = [];
      if (dp.label) b.push(...textCall(dp.label, 6, dp.ly, 1, 1));
      b.push(...c(4), ...c(dp.y), ...c(152), ...c(dp.h), ...c(dp.back), ...call(F.rect));
      b.push(...(dp.stored ? [...c(DISP_AT + 8 * dp.idx), ...LD64] : expr(dp.expr, {})), ...c(152), ...c(dp.y + ((dp.h - GH * dp.sc) >> 1)), ...c(dp.ink), ...c(dp.sc), ...c(dp.money ? 1 : 0), ...call(F.num));
      d.push(...b); parts.push({ label: `Display${dp.label ? ' “' + dp.label + '”' : ''}${dp.stored ? '' : ': ' + dp.expr}${tag}`, bytes: b });
    }
    if (sc.box) {
      const b = [];
      if (sc.box.label) b.push(...textCall(sc.box.label, 6, sc.box.ly, 1, 1));
      b.push(...c(4), ...c(sc.box.y), ...c(152), ...c(20), ...c(0), ...call(F.rect), ...c(BOX_AT + 1), ...c(BOX_AT), ...LD8, ...c(8), ...c(sc.box.y + 3), ...c(1), ...c(2), ...call(F.text),
        ...c(BOX_AT), ...LD8, ...c(GW * 2), I.mul, ...c(8), I.add, ...c(sc.box.y + 3), ...c(2), ...c(14), ...c(10), ...call(F.rect));
      d.push(...b); parts.push({ label: `Text box “${sc.box.name}”${tag}`, bytes: b });
    }
    if (sc.list) { const b = [...c(LIST_AT), ...c(sc.list.y), ...c(1), ...call(F.listdraw)]; d.push(...b); parts.push({ label: `List “${sc.list.name}”${tag}`, bytes: b }); }
    for (const bt of sc.lay.buttons) {
      const kd = kindOf(bt.lab), col = P.colours['w:' + bt.lab] ?? P.colours[kd] ?? 8, b = [];
      if (P.round) { const r = (Math.min(bt.w, bt.h) >> 1) - 1; b.push(...c(bt.x + (bt.w >> 1)), ...c(bt.y + (bt.h >> 1)), ...c(r), ...c(col), ...call(F.circle)); }
      else b.push(...c(bt.x), ...c(bt.y), ...c(bt.w), ...c(bt.h), ...c(col), ...call(F.rect));
      const room = P.round ? Math.min(bt.w, bt.h) - 8 : bt.w - 6, s2 = textW(bt.lab, 2) <= room ? 2 : 1;
      b.push(...textCall(bt.lab, bt.x + ((bt.w - textW(bt.lab, s2)) >> 1), bt.y + ((bt.h - GH * s2) >> 1), P.ink, s2));
      d.push(...b); parts.push({ label: `Button ${bt.lab}${tag}`, bytes: b });
    }
    for (const dr of sc.draws) {
      const b = []; let xy;
      try { xy = [pixel(dr.x), pixel(dr.y)]; } catch (err) { throw new Error(`Line ${dr.line.n}, “${dr.line.raw}”: ${err.message}`); }
      const half = dr.size >> 1;
      if (dr.shape === 'circle') b.push(...xy[0], ...xy[1], ...c(half), ...c(dr.colour), ...call(F.circle));
      else if (dr.shape === 'square') b.push(...xy[0], ...c(half), I.sub, ...xy[1], ...c(half), I.sub, ...c(dr.size), ...c(dr.size), ...c(dr.colour), ...call(F.rect));
      else b.push(...xy[0], ...c(dr.size * 3 >> 1), I.sub, ...xy[1], ...c(half), I.sub, ...c(dr.size * 3), ...c(dr.size), ...c(dr.colour), ...call(F.rect));
      d.push(...b); parts.push({ label: `Draw a ${dr.shape} at ${dr.x}, ${dr.y}${tag}`, bytes: b });
    }
    draw.push(...onScreen(k, d));
    const cl = [];
    for (const bt of sc.lay.buttons) {
      const acts = pressActs(bt.lab); if (!acts.length) continue;
      const b = [...g(0), ...c(bt.x), I.ge, ...g(0), ...c(bt.x + bt.w), I.lt, I.and, ...g(1), ...c(bt.y), I.ge, I.and, ...g(1), ...c(bt.y + bt.h), I.lt, I.and, ...IF, ...acts, RET, END];
      cl.push(...b); parts.push({ label: `When ${bt.lab} is pressed${tag}`, bytes: b });
    }
    const itemEv = P.events.filter(e => e.kind === 'item');
    if (itemEv.length && sc.list) {
      const b = [...g(1), ...c(sc.list.y), I.ge, ...g(1), ...c(sc.list.y + LIST_MAX * ROW), I.lt, I.and, ...IF,
        ...g(1), ...c(sc.list.y), I.sub, ...c(ROW), I.divs, ...st(2), ...itemEv.flatMap(e => runActions(e, { item: true })), RET, END];
      cl.push(...b); parts.push({ label: `When an item in “${sc.list.name}” is clicked`, bytes: b });
    }
    click.push(...onScreen(k, cl));
  });
  // keyboard: arrows/space/enter events, typing into the text box, keys that match buttons
  const KEYS = { '+':[43], '-':[45], '×':[42,120], '÷':[47], '=':[61], '.':[46,44], 'C':[27,99] };
  const key = [];
  for (const [name, code] of Object.entries(KEY)) { const a = pressActs('KEY:' + name); if (a.length) key.push(...g(0), ...c(code), I.eq, ...IF, ...a, RET, END); }
  const enterActs = pressActs('ENTER');
  if (enterActs.length) key.push(...g(0), ...c(13), I.eq, ...IF, ...enterActs, RET, END);
  P.screens.forEach((sc, k) => {
    const kk = [];
    if (!enterActs.length && !pressActs('KEY:enter').length && sc.lay.buttons.some(b => b.lab === '=')) { const a = pressActs('='); if (a.length) kk.push(...g(0), ...c(13), I.eq, ...IF, ...a, RET, END); }
    if (sc.box) kk.push(...c(BOX_AT), ...g(0), ...call(F.boxkey), RET);
    else for (const bt of sc.lay.buttons) {
      const codes = /^\d$/.test(bt.lab) ? [48 + +bt.lab] : KEYS[bt.lab]; if (!codes) continue;
      const a = pressActs(bt.lab); if (!a.length) continue;
      for (const kc of codes) kk.push(...g(0), ...c(kc), I.eq, ...IF, ...a, RET, END);
    }
    key.push(...onScreen(k, kk));
  });
  if (key.length) parts.push({ label: 'Keyboard: arrows, Enter, typing and button shortcuts', bytes: key });
  const tickEv = P.events.filter(e => e.kind === 'tick');
  const tick = [...c(TICK_AT), ...c(TICK_AT), ...LD32, ...c(1), I.add, ...ST32];
  for (const e of tickEv) { const a = runActions(e, {}); tick.push(...(e.every === 1 ? a : [...c(TICK_AT), ...LD32, ...c(e.every), I.remu, I.eqz, ...IF, ...a, END])); }
  if (tickEv.length) parts.push({ label: 'Timers: “Every …”', bytes: tick.slice(10) });

  // ---- what the host should keep between visits ----
  const keep = P.keep.map(n => {
    if (P.named[n] === 'list') return { name: n, at: LIST_AT, len: 4 + LIST_MAX * 20 };
    if (P.named[n] === 'box') return { name: n, at: BOX_AT, len: 1 + BOX_MAX };
    const v = varIndex(n); return { name: n, at: VARS_AT + 8 * v, len: 8 };
  });

  // ---- assemble the module ----
  const sec = (id, b) => [id, ...uleb(b.length), ...b];
  const nm = s => [...uleb(s.length), ...[...s].map(ch => ch.charCodeAt(0))];
  const T = (params, results = []) => [0x60, params.length, ...params, results.length, ...results];
  const i32 = 0x7f, i64 = 0x7e;
  const types = [T([]), T([i32, i32]), T([i32]), T([i32, i32, i32, i32, i32]), T([i32, i32, i32, i32, i32, i32]), T([i64, i32, i32, i32, i32, i32]), T([i32, i32, i32, i32]), T([i64, i64], [i64]), T([i32, i32, i32])];
  const fnTypes = [0, 0, 1, 2, 0, 3, 3, 4, 5, 6, 7, 7, 1, 2, 1, 1, 8, 8, 7];
  const body = (locals, code) => { const decl = [locals.length, ...locals.flatMap(([n, t]) => [n, t])]; const b = [...decl, ...code, END]; return [...uleb(b.length), ...b]; };
  const bodies = [body([], startBody), body([], draw), body([[1, i32]], click), body([], key), body([], tick),
    body(lib.rect, lib.rect.code), body(lib.glyph, lib.glyph.code), body(lib.text, lib.text.code), body(lib.num, lib.num.code), body(lib.circle, lib.circle.code),
    body(lib.mul, lib.mul.code), body(lib.div, lib.div.code), body(lib.tdigit, lib.tdigit.code), body(lib.tpoint, lib.tpoint.code), body(lib.boxkey, lib.boxkey.code),
    body(lib.listadd, lib.listadd.code), body(lib.listdraw, lib.listdraw.code), body(lib.listclick, lib.listclick.code), body(lib.rand, lib.rand.code)];
  const segs = [{ at: FONT_AT, codes: FONT }, ...strs];
  const bytes = new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0,
    ...sec(1, [types.length, ...types.flat()]), ...sec(3, [fnTypes.length, ...fnTypes]), ...sec(5, [1, 0, 1]),
    ...sec(7, [6, ...nm('memory'), 2, 0, ...nm('start'), 0, 0, ...nm('draw'), 0, 1, ...nm('click'), 0, 2, ...nm('key'), 0, 3, ...nm('tick'), 0, 4]),
    ...sec(10, [bodies.length, ...bodies.flat()]),
    ...sec(11, [segs.length, ...segs.flatMap(s => [0, ...c(s.at), END, ...uleb(s.codes.length), ...s.codes])])]);
  const libBytes = bodies.slice(5).reduce((n, b) => n + b.length, 0) + FONT.length;
  return { bytes, parts, screens: P.screens.map(sc => ({ name: sc.name, buttons: sc.lay.buttons, list: sc.list, box: sc.box })), layout: { buttons: allButtons }, list: P.list, box: P.box,
    keep, usesTimer: tickEv.length > 0, width: W, height: H, sizes: { total: bytes.length, yours: bodies.slice(0, 5).reduce((n, b) => n + b.length, 0), library: libBytes },
    memory: { SEED_AT, TICK_AT, SCREEN_AT, VARS_AT, DISP_AT, BOX_AT, LIST_AT }, vars: P.vars, KEY };
}
if (typeof module !== 'undefined') module.exports = { compileSE3 };
