// Structured English v0.1 -> WebAssembly binary for a 128x128 Tiny Machine.
// Memory map: screen 0..16383 (1 byte per pixel) | operation 19992 | shown number 19996 | numbers 20000+ | font 60000.
function compileSE(text) {
  const COLOURS = { black:0, white:1, red:2, green:3, blue:4, orange:5, purple:6, teal:7, grey:8, gray:8, salmon:9, lime:10, sky:11, yellow:12, lilac:13, charcoal:14, pink:15 };
  const LABEL = { '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
    '+':'+', plus:'+', add:'+', '-':'-', '−':'-', minus:'-', subtract:'-', 'x':'x', '×':'x', '*':'x', times:'x', multiply:'x',
    '/':'/', '÷':'/', divide:'/', '=':'=', equals:'=', equal:'=', c:'C', clear:'C' };
  const GLYPH = { '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'+':10,'-':11,'x':12,'/':13,'=':14,'C':15 };
  const OPCODE = { '+':1, '-':2, 'x':3, '/':4 };
  const FONT = [7,5,5,5,7, 2,6,2,2,7, 7,1,7,4,7, 7,1,7,1,7, 5,5,7,1,1, 7,4,7,1,7, 7,4,7,5,7, 7,1,1,1,1, 7,5,7,5,7, 7,5,7,1,7,
                0,2,7,2,0, 0,0,7,0,0, 0,5,2,5,0, 1,1,2,4,4, 0,7,0,7,0, 7,4,4,4,7];
  const FONT_AT = 60000, OP_AT = 19992, SHOWN_AT = 19996, VARS_AT = 20000;

  const uleb = n => { const o = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return o; };
  const sleb = n => { const o = []; while (true) { let b = n & 0x7f; n >>= 7; if ((n === 0 && !(b & 0x40)) || (n === -1 && (b & 0x40))) { o.push(b); return o; } o.push(b | 0x80); } };
  const c = n => [0x41, ...sleb(n)], g = i => [0x20, i], st = i => [0x21, i], call = f => [0x10, f];
  const ADD = 0x6a, SUB = 0x6b, MUL = 0x6c, DIVS = 0x6d, DIVU = 0x6e, REMU = 0x70, AND = 0x71, SHR = 0x76, EQ = 0x46, LT = 0x48, GE = 0x4e, EQZ = 0x45;
  const LOAD8 = [0x2d, 0, 0], STORE8 = [0x3a, 0, 0], LOAD = [0x28, 2, 0], STORE = [0x36, 2, 0];
  const IF = [0x04, 0x40], END = 0x0b;
  const loopUntil = (cond, body) => [0x02, 0x40, 0x03, 0x40, ...cond, 0x0d, 1, ...body, 0x0c, 0, END, END];
  const RECT = 2, GLY = 3, NUM = 4;

  // ---- the built-in library: three helpers every program gets (fixed bytes, written once) ----
  const libRect = [0x01, 2, 0x7f, ...g(1), ...st(5),                      // rect(x, y, w, h, colour)
    ...loopUntil([...g(5), ...g(1), ...g(3), ADD, GE], [...g(0), ...st(6),
      ...loopUntil([...g(6), ...g(0), ...g(2), ADD, GE], [...g(5), ...c(128), MUL, ...g(6), ADD, ...g(4), ...STORE8, ...g(6), ...c(1), ADD, ...st(6)]),
      ...g(5), ...c(1), ADD, ...st(5)]), END];
  const libGlyph = [0x01, 3, 0x7f, ...c(0), ...st(5),                     // glyph(character, x, y, colour, scale)
    ...loopUntil([...g(5), ...c(5), GE], [...c(FONT_AT), ...g(0), ...c(5), MUL, ADD, ...g(5), ADD, ...LOAD8, ...st(7), ...c(0), ...st(6),
      ...loopUntil([...g(6), ...c(3), GE], [...g(7), ...c(4), ...g(6), SHR, AND, ...IF,
          ...g(1), ...g(6), ...g(4), MUL, ADD, ...g(2), ...g(5), ...g(4), MUL, ADD, ...g(4), ...g(4), ...g(3), ...call(RECT), END,
        ...g(6), ...c(1), ADD, ...st(6)]),
      ...g(5), ...c(1), ADD, ...st(5)]), END];
  const libNumber = [0x01, 3, 0x7f,                                       // number(value, right edge, y, colour, scale)
    ...g(0), ...c(0), LT, ...st(5), ...g(5), ...IF, ...c(0), ...g(0), SUB, ...st(0), END, ...g(1), ...st(6),
    0x03, 0x40, ...g(0), ...c(10), REMU, ...st(7), ...g(6), ...c(4), ...g(4), MUL, SUB, ...st(6),
      ...g(7), ...g(6), ...g(2), ...g(3), ...g(4), ...call(GLY), ...g(0), ...c(10), DIVU, ...st(0), ...g(0), 0x0d, 0, END,
    ...g(5), ...IF, ...g(6), ...c(4), ...g(4), MUL, SUB, ...st(6), ...c(11), ...g(6), ...g(2), ...g(3), ...g(4), ...call(GLY), END, END];

  // ---- read the sentences ----
  const prog = { bg: 14, display: null, buttons: [], perRow: 4, vars: {}, hasOp: false, events: [], colours: { digit: 8, op: 5, '=': 3, C: 9 }, ink: 1 };
  const trace = [];
  let ev = null;
  const colourOf = (w, line) => { if (!(w in COLOURS)) throw new Error(`“${w}” isn't a colour I know`); return COLOURS[w]; };
  const varAddr = name => { if (!(name in prog.vars)) throw new Error(`I don't know a number called “${name}”. Add “Remember a number called ${name}.”`); return VARS_AT + 4 * prog.vars[name]; };

  function expr(src, digit) {
    const t = src.replace(/\bmultiplied by\b/g, ' times ').replace(/\bdivided by\b/g, ' over ').trim().split(/\s+/);
    let i = 0;
    const atom = () => {
      let w = t[i++];
      if (w === 'the') w = t[i++];
      if (w === undefined) throw new Error('the sentence ends too early');
      if (/^-?\d+$/.test(w)) return c(parseInt(w, 10));
      if (w === 'digit' || w === 'number' && digit !== undefined) { if (digit === undefined) throw new Error('“the digit” only makes sense in “When I press a digit”'); return c(digit); }
      return [...c(varAddr(w)), ...LOAD];
    };
    const level = (ops, next) => () => { let out = next(); while (t[i] in ops) { const op = ops[t[i++]]; out = [...out, ...next(), op]; } return out; };
    const mul = level({ times: MUL, over: DIVS }, atom), add = level({ plus: ADD, minus: SUB }, mul);
    const out = add();
    if (i < t.length) throw new Error(`I don't understand “${t.slice(i).join(' ')}”`);
    return out;
  }
  const setVar = (name, valueBytes) => [...c(varAddr(name)), ...valueBytes, ...STORE];

  function action(s, label) {
    const digit = /^\d$/.test(label) ? +label : undefined;
    let m;
    if ((m = s.match(/^(\w+) becomes (.+)$/)) || (m = s.match(/^set (\w+) to (.+)$/))) return setVar(m[1], expr(m[2], digit));
    if ((m = s.match(/^show (.+?)(?: on the display)?$/))) return [...c(SHOWN_AT), ...expr(m[1], digit), ...STORE];
    if (/^remember the operation$/.test(s)) { if (!(label in OPCODE)) throw new Error('“Remember the operation” only works for + − × ÷ buttons'); return [...c(OP_AT), ...c(OPCODE[label]), ...STORE]; }
    if ((m = s.match(/^apply the operation to (\w+) and (\w+),? and put the answer in (\w+)$/))) {
      if (!prog.hasOp) throw new Error('Add “Remember an operation.” first');
      const [a, b] = [[...c(varAddr(m[1])), ...LOAD], [...c(varAddr(m[2])), ...LOAD]];
      const when = (code, val) => [...c(OP_AT), ...LOAD, ...c(code), EQ, ...IF, ...setVar(m[3], val), END];
      return [...when(1, [...a, ...b, ADD]), ...when(2, [...a, ...b, SUB]), ...when(3, [...a, ...b, MUL]),
              ...c(OP_AT), ...LOAD, ...c(4), EQ, ...IF, ...b, EQZ, ...IF, ...setVar(m[3], c(0)), 0x05, ...setVar(m[3], [...a, ...b, DIVS]), END, END];
    }
    throw new Error('I don\'t know this action');
  }

  const lines = text.split('\n').flatMap((raw, n) => raw.split(/(?<=\.)\s+/)
      .flatMap(p => /^\s*when\b/i.test(p) ? p.split(/(?<=:)\s+/) : [p])
      .map(p => ({ n: n + 1, raw: p.trim(), s: p.trim().toLowerCase().replace(/[.:;!]+$/, '').trim() }))).filter(l => l.s && !l.s.startsWith('#'));
  for (const l of lines) {
    const s = l.s; let m;
    try {
      if ((m = s.match(/^the (?:screen|background) is (\w+)$/))) { prog.bg = colourOf(m[1]); ev = null; trace.push([l.raw, 'screen colour']); continue; }
      if ((m = s.match(/^(?:there is )?a display at the top(?: shows numbers in (\w+))?(?: on (\w+))?$/))) { prog.display = { ink: m[1] ? colourOf(m[1]) : 1, bg: m[2] ? colourOf(m[2]) : 0 }; ev = null; trace.push([l.raw, 'display']); continue; }
      if ((m = s.match(/^buttons(?:,? (\w+) per row)?: (.+)$/))) {
        const words = { one:1, two:2, three:3, four:4, five:5, six:6 };
        if (m[1]) prog.perRow = words[m[1]] || parseInt(m[1], 10) || 4;
        for (const w of m[2].split(/[\s,]+/).filter(Boolean)) { const lab = LABEL[w]; if (!lab) throw new Error(`“${w}” isn't a button label I can draw (digits, + − × ÷ =, C)`); prog.buttons.push(lab); }
        ev = null; trace.push([l.raw, `${prog.buttons.length} buttons`]); continue;
      }
      if ((m = s.match(/^the (?:(digit|operation|equals|clear|=|c) )?buttons? (?:are|is) (\w+)$/))) {
        const k = { digit: 'digit', operation: 'op', equals: '=', '=': '=', clear: 'C', c: 'C' }[m[1]] || 'all';
        const col = colourOf(m[2]); if (k === 'all') prog.colours = { digit: col, op: col, '=': col, C: col }; else prog.colours[k] = col;
        ev = null; trace.push([l.raw, 'button colour']); continue;
      }
      if ((m = s.match(/^the labels are (\w+)$/))) { prog.ink = colourOf(m[1]); trace.push([l.raw, 'label colour']); continue; }
      if ((m = s.match(/^remember (.+)$/)) && !ev) {
        for (const part of m[1].split(/\s*(?:,|\band\b)\s*/).filter(Boolean)) {
          let k;
          if ((k = part.match(/^an? number called (\w+)$/))) prog.vars[k[1]] = Object.keys(prog.vars).length;
          else if (/^an? operation$/.test(part)) prog.hasOp = true;
          else throw new Error(`I can remember “a number called …” or “an operation”, not “${part}”`);
        }
        trace.push([l.raw, 'memory']); continue;
      }
      if ((m = s.match(/^when i press (.+)$/))) {
        const what = m[1];
        let labels;
        if (/^an? (digit|number)$/.test(what)) labels = '0123456789'.split('');
        else if (/^an? operation$/.test(what)) labels = ['+', '-', 'x', '/'];
        else if (LABEL[what]) labels = [LABEL[what]];
        else throw new Error(`I don't know a button called “${what}”`);
        ev = { labels, actions: [] }; prog.events.push(ev); trace.push([l.raw, 'event']); continue;
      }
      if (ev) { action(s, ev.labels[0]); ev.actions.push(s); trace.push([l.raw, 'action']); continue; }
      throw new Error('I don\'t know this kind of sentence');
    } catch (e) { throw new Error(`Line ${l.n}, “${l.raw}”: ${e.message}`); }
  }
  if (!prog.buttons.length && !prog.display) throw new Error('Describe a display or some buttons to start.');

  // ---- layout ----
  const top = prog.display ? 38 : 4, cols = Math.min(prog.perRow, Math.max(1, prog.buttons.length)), rows = Math.ceil(prog.buttons.length / cols) || 1;
  const bw = Math.floor((120 - (cols - 1) * 4) / cols), bh = Math.min(40, Math.floor((124 - top - (rows - 1) * 4) / rows));
  const layout = prog.buttons.map((lab, i) => ({ lab, x: 4 + (i % cols) * (bw + 4), y: top + Math.floor(i / cols) * (bh + 4), w: bw, h: bh }));
  const kind = lab => /\d/.test(lab) ? 'digit' : lab in OPCODE ? 'op' : lab;
  for (const e of prog.events) for (const lab of e.labels) if (!prog.buttons.includes(lab) && e.labels.length === 1) throw new Error(`There's no ${lab} button to press. Add it to the buttons list.`);

  // ---- assemble the program's own parts ----
  const drawParts = [{ label: 'Paint the screen', bytes: [...c(0), ...c(0), ...c(128), ...c(128), ...c(prog.bg), ...call(RECT)] }];
  if (prog.display) drawParts.push({ label: 'Draw the display and the number it shows', bytes: [...c(4), ...c(4), ...c(120), ...c(28), ...c(prog.display.bg), ...call(RECT), ...c(SHOWN_AT), ...LOAD, ...c(120), ...c(10), ...c(prog.display.ink), ...c(3), ...call(NUM)] });
  for (const b of layout) drawParts.push({ label: `Draw button ${b.lab === 'x' ? '×' : b.lab === '/' ? '÷' : b.lab}`, bytes: [...c(b.x), ...c(b.y), ...c(b.w), ...c(b.h), ...c(prog.colours[kind(b.lab)] ?? 8), ...call(RECT),
    ...c(GLYPH[b.lab]), ...c(b.x + ((b.w - 6) >> 1)), ...c(b.y + ((b.h - 10) >> 1)), ...c(prog.ink), ...c(2), ...call(GLY)] });
  const clickParts = [];
  for (const b of layout) {
    const acts = prog.events.filter(e => e.labels.includes(b.lab)).flatMap(e => e.actions.flatMap(a => action(a, b.lab)));
    if (!acts.length) continue;
    clickParts.push({ label: `If the click is on ${b.lab === 'x' ? '×' : b.lab === '/' ? '÷' : b.lab}, do its actions`, bytes: [...g(0), ...c(b.x), GE, ...g(0), ...c(b.x + b.w), LT, AND, ...g(1), ...c(b.y), GE, AND, ...g(1), ...c(b.y + b.h), LT, AND, ...IF, ...acts, 0x0f, END] });
  }
  const drawBody = [0x00, ...drawParts.flatMap(p => p.bytes), END], clickBody = [0x00, ...clickParts.flatMap(p => p.bytes), END];
  const sec = (id, b) => [id, ...uleb(b.length), ...b], nm = s => [...uleb(s.length), ...[...s].map(ch => ch.charCodeAt(0))];
  const bodies = [drawBody, clickBody, libRect, libGlyph, libNumber];
  const head = [0, 0x61, 0x73, 0x6d, 1, 0, 0, 0,
    ...sec(1, [3, 0x60, 0, 0, 0x60, 2, 0x7f, 0x7f, 0, 0x60, 5, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0]),
    ...sec(3, [5, 0, 1, 2, 2, 2]), ...sec(5, [1, 0, 1]),
    ...sec(7, [3, ...nm('memory'), 2, 0, ...nm('draw'), 0, 0, ...nm('click'), 0, 1])];
  const code = sec(10, [5, ...bodies.flatMap(b => [...uleb(b.length), ...b])]);
  const data = sec(11, [1, 0, ...c(FONT_AT), END, ...uleb(FONT.length), ...FONT]);
  const bytes = new Uint8Array([...head, ...code, ...data]);
  const libBytes = [libRect, libGlyph, libNumber].reduce((n, b) => n + b.length, 0) + FONT.length;
  return { bytes, trace, layout, drawParts, clickParts, libBytes, sizes: { total: bytes.length, yours: drawParts.concat(clickParts).reduce((n, p) => n + p.bytes.length, 0) } };
}
if (typeof module !== 'undefined') module.exports = { compileSE };
