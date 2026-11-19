// Human language -> Tiny Machine binary. Each word maps to a binary piece; grammar rules plug pieces together.
function compileTiny(text) {
  const COLOURS = { black:0, white:1, red:2, green:3, blue:4, orange:5, purple:6, teal:7, grey:8, gray:8, salmon:9, lime:10, sky:11, yellow:12, lilac:13, charcoal:14, pink:15 };
  const SIZES = { tiny:2, small:6, medium:10, big:16, large:16, huge:24 };
  const SHAPES = { square:[1,1], box:[1,1], block:[1,1], rectangle:[2,1], bar:[2,0.5], dot:[0,0], line:[0,0] };
  const PLACES = { 'top left':[6,6], 'top right':[26,6], 'bottom left':[6,26], 'bottom right':[26,26], middle:[16,16], centre:[16,16], center:[16,16], top:[16,6], bottom:[16,26], left:[6,16], right:[26,16] };
  const GLUE = new Set('a an the in at on of to and with it is i me my there that which when if whenever then again every each time please make draw show put have want'.split(' '));
  const ACTION = /\b(turns?|goes|go|becomes?|changes? to|switch(?:es)? to|switch(?:es)?)\b/;

  const uleb = n => { const o = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return o; };
  const sleb = n => { const o = []; while (true) { let b = n & 0x7f; n >>= 7; if ((n === 0 && !(b & 0x40)) || (n === -1 && (b & 0x40))) { o.push(b); return o; } o.push(b | 0x80); } };
  const c = n => [0x41, ...sleb(n)], g = i => [0x20, i], st = i => [0x21, i];
  const LOAD = [0x2d, 0, 0], STORE = [0x3a, 0, 0], ADD = 0x6a, SUB = 0x6b, MUL = 0x6c, REMU = 0x70, LT = 0x48, GE = 0x4e, AND = 0x71;

  const pieces = [], notes = [];
  const piece = (word, role, bytes, meaning) => { if (!pieces.some(p => p.word === word && p.role === role)) pieces.push({ word, role, bytes, meaning }); };
  const bg = { colour: 0, rule: null, addr: 2000, name: 'screen' };
  const objs = [];
  let last = null;

  const findColour = s => { for (const w of s.split(/\W+/)) if (w in COLOURS) { piece(w, 'colour', c(COLOURS[w]), `colour number ${COLOURS[w]}`); return COLOURS[w]; } return null; };
  const findShape = s => { for (const w of s.split(/\W+/)) { const k = w.replace(/s$/, ''); if (k in SHAPES) return k; } return null; };
  const findPlace = s => { for (const p of Object.keys(PLACES)) if (new RegExp('\\b' + p + '\\b').test(s)) return p; return null; };
  const findSize = s => { for (const w of s.split(/\W+/)) if (w in SIZES) return w; return null; };

  function makeObj(clause) {
    const shape = findShape(clause); if (!shape) return null;
    const col = findColour(clause.split(/\b(?:that|which|when)\b/)[0]);
    const sizeW = findSize(clause), size = sizeW ? SIZES[sizeW] : 10, place = findPlace(clause) || 'middle';
    let [w, h] = SHAPES[shape];
    if (shape === 'dot') { w = h = 2; } else if (shape === 'line') { w = 24; h = 2; } else { w = Math.max(1, Math.round(size * w)); h = Math.max(1, Math.round(size * h)); }
    const [cx, cy] = PLACES[place];
    const x0 = Math.min(Math.max(cx - (w >> 1), 0), 32 - w), y0 = Math.min(Math.max(cy - (h >> 1), 0), 32 - h);
    const o = { shape, colour: col ?? 1, x0, y0, w, h, rule: null, addr: 2001 + objs.length, name: `${col !== null ? Object.keys(COLOURS).find(k => COLOURS[k] === col) + ' ' : ''}${shape}` };
    piece(shape, 'thing', ['fill', 'rectangle'], `template: fill a rectangle (${w} wide × ${h} tall)`);
    if (sizeW) piece(sizeW, 'size', c(size), `${size} pixels`);
    piece(place, 'place', [...c(x0), ...c(y0)], `starts at x ${x0}, y ${y0}`);
    objs.push(o); last = o;
    return o;
  }
  const refObj = s => {
    const shape = findShape(s);
    if (shape) { const col = (s.match(new RegExp('(\\w+)\\s+' + shape)) || [])[1]; return objs.filter(o => o.shape === shape).find(o => !(col in COLOURS) || o.colour === COLOURS[col]) || objs.find(o => o.shape === shape) || null; }
    return null;
  };
  function addRule(target, cond, action, colour) {
    if (!target) throw new Error('nothing to change yet: describe a shape or the screen first');
    target.rule = { cond, action, alt: colour };
    piece('click', 'event', ['click(x, y)'], 'this part goes inside the click() job');
    if (cond) piece('inside', 'condition', ['x ≥ left', 'x < right', 'y ≥ top', 'y < bottom'], `compare the click with the ${cond.name}'s edges`);
  }
  function clickSentence(s) {
    if (/\bnothing\b/.test(s)) return;
    const am = s.match(ACTION);
    const condPart = am ? s.slice(0, am.index) : s, actPart = am ? s.slice(am.index) : '';
    // where was the click?
    let cond = null;
    if (/\banywhere\b|\bthe (screen|background)\b.*click|click(ing)? (on )?the (screen|background)/.test(condPart)) cond = null;
    else cond = refObj(condPart.replace(/,.*$/, '')) || (/\bit\b/.test(condPart) || /\bclicked\b/.test(s) ? last : null);
    // what changes?
    const near = condPart.split(',').pop();
    let target = /\b(screen|background)\b/.test(near) ? bg : (refObj(near) || cond || last || bg);
    if (/\b(screen|background)\b/.test(actPart + ' ' + near) && !refObj(near)) target = bg;
    if (/\bback\b/.test(s) && target.rule) { target.rule.action = 'toggle'; piece('back', 'action', ['1 − note'], 'flip the note between 0 and 1, so it goes back'); return; }
    if (/\b(next colou?r|changes? colou?r|different colou?r|cycles?)\b/.test(s)) { addRule(target, cond, 'cycle'); piece('changes colour', 'action', ['note + 1'], 'add 1 to the note, moving to the next colour'); return; }
    const col = findColour(actPart);
    if (am && col !== null) { addRule(target, cond, 'set', col); piece(am[1], 'action', ['note = 1'], 'write 1 in the note, which switches the colour'); return; }
    notes.push(`I couldn't tell what should happen in: “${s}”`);
  }

  const sentences = text.toLowerCase().replace(/colour|color/g, 'colour').split(/[.!?\n;]+/).map(s => s.trim()).filter(Boolean);
  for (const s of sentences) {
    if (/^(when|whenever|if|each time|every time|click(?:s|ing|ed)?)\b/.test(s) || /\bnothing\b/.test(s)) { clickSentence(s); continue; }
    let rest = s;
    const bgm = rest.match(/^(?:(?:make|paint|colou?r) )?(?:the |a |an )?(?:(\w+) )?(screen|background)(?: (?:is |be |to )?(\w+))?/);
    if (bgm && (COLOURS[bgm[1]] !== undefined || COLOURS[bgm[3]] !== undefined)) {
      bg.colour = COLOURS[bgm[1]] ?? COLOURS[bgm[3]];
      findColour(bgm[1] in COLOURS ? bgm[1] : bgm[3]); piece(bgm[2], 'thing', ['fill', 'all 1024 pixels'], 'template: fill every pixel');
      rest = rest.slice(bgm[0].length);
    }
    const clauses = rest.split(/\bwith\b|,\s*(?=an?\b|one\b|another\b)|\band\b(?=\s+(?:an?|one|another)\b)/).map(x => x.trim()).filter(Boolean);
    for (const cl of clauses) {
      const o = makeObj(cl);
      if (!o) { if (findShape(cl) === null && !/^(and|with)?$/.test(cl) && cl.split(/\W+/).some(w => w && !GLUE.has(w))) notes.push(`I didn't understand: “${cl}”`); continue; }
      const m = cl.match(/\b(?:that|which)\s+(turns?|goes|becomes?|changes? to)\s+(\w+)\s+when\b/);
      if (m && COLOURS[m[2]] !== undefined) { findColour(m[2]); addRule(o, o, 'set', COLOURS[m[2]]); piece(m[1], 'action', ['note = 1'], 'write 1 in the note, which switches the colour'); }
      else if (/\b(?:that|which)\s+changes? colou?r\b/.test(cl)) { addRule(o, o, 'cycle'); piece('changes colour', 'action', ['note + 1'], 'add 1 to the note, moving to the next colour'); }
    }
  }
  if (!objs.length && bg.colour === 0 && !bg.rule && !pieces.length) throw new Error('Describe something to draw, e.g. “a red square in the middle”.');

  // ---- plug the pieces together into bytes ----
  const colourCode = t => {
    if (!t.rule) return c(t.colour);
    if (t.rule.action === 'cycle') return [...c(t.colour), ...c(t.addr), ...LOAD, ADD, ...c(16), REMU];
    return [...c(t.rule.alt), ...c(t.colour), ...c(t.addr), ...LOAD, 0x1b];         // pick alt colour when note = 1
  };
  const loop = (L, end, inner) => [0x02, 0x40, 0x03, 0x40, ...g(L), ...c(end), GE, 0x0d, 1, ...inner, ...g(L), ...c(1), ADD, ...st(L), 0x0c, 0, 0x0b, 0x0b];
  const fill = col => [...c(0), ...st(0), ...loop(0, 1024, [...g(0), ...col, ...STORE])];
  const rect = o => [...c(o.y0), ...st(0), ...loop(0, o.y0 + o.h, [...c(o.x0), ...st(1), ...loop(1, o.x0 + o.w, [...g(0), ...c(32), MUL, ...g(1), ADD, ...colourCode(o), ...STORE])])];
  const inside = o => [...g(0), ...c(o.x0), GE, ...g(0), ...c(o.x0 + o.w), LT, AND, ...g(1), ...c(o.y0), GE, AND, ...g(1), ...c(o.y0 + o.h), LT, AND];
  const act = t => t.rule.action === 'toggle' ? [...c(t.addr), ...c(1), ...c(t.addr), ...LOAD, SUB, ...STORE]
                 : t.rule.action === 'cycle' ? [...c(t.addr), ...c(t.addr), ...LOAD, ...c(1), ADD, ...STORE]
                 : [...c(t.addr), ...c(1), ...STORE];

  const parts = [{ label: 'Draw job: paint the ' + (bg.rule ? 'screen (colour depends on its note)' : `screen colour ${bg.colour}`), bytes: fill(colourCode(bg)) }];
  for (const o of objs) parts.push({ label: `Draw the ${o.name}${o.rule ? ' (colour depends on its note)' : ''}`, bytes: rect(o) });
  const clickParts = [];
  for (const t of [bg, ...objs]) if (t.rule) {
    const a = act(t), cond = t.rule.cond;
    const word = t.rule.action === 'toggle' ? 'flip' : t.rule.action === 'cycle' ? 'next colour for' : 'switch';
    clickParts.push({ label: `Click job: ${cond ? 'if the click is inside the ' + cond.name + ', ' : 'on any click, '}${word} the ${t.name}`, bytes: cond ? [...inside(cond), 0x04, 0x40, ...a, 0x0b] : a });
  }
  const drawBody = [0x01, 0x02, 0x7f, ...parts.flatMap(p => p.bytes), 0x0b];
  const clickBody = [0x00, ...clickParts.flatMap(p => p.bytes), 0x0b];
  const sec = (id, b) => [id, ...uleb(b.length), ...b];
  const nm = s => [...uleb(s.length), ...[...s].map(ch => ch.charCodeAt(0))];
  const head = [0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, ...sec(1, [2, 0x60, 0, 0, 0x60, 2, 0x7f, 0x7f, 0]), ...sec(3, [2, 0, 1]), ...sec(5, [1, 0, 1]),
    ...sec(7, [3, ...nm('memory'), 2, 0, ...nm('draw'), 0, 0, ...nm('click'), 0, 1])];
  const codeContent = [2, ...uleb(drawBody.length), ...drawBody, ...uleb(clickBody.length), ...clickBody];
  const bytes = new Uint8Array([...head, 10, ...uleb(codeContent.length), ...codeContent]);
  return { bytes, pieces, parts: [{ label: 'Packaging: “this is a program with a screen, draw() and click()”', bytes: [...head, 10, ...uleb(codeContent.length), 2, ...uleb(drawBody.length), 1, 2, 0x7f], meta: true }, ...parts,
    { label: 'Click job begins', bytes: [...uleb(clickBody.length), 0], meta: true }, ...clickParts], notes, objects: objs.length, hasClick: clickParts.length > 0 };
}
if (typeof module !== 'undefined') module.exports = { compileTiny };
