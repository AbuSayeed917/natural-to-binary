// English -> WebAssembly bytes. No AI, no source layer: sentences are turned straight into opcodes.
function compileEnglish(text) {
  const NUMWORDS = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, hundred:100 };
  const OPS = { '+':0x6a, '-':0x6b, '*':0x6c, '/':0x6d, '%':0x6f, '==':0x46, '!=':0x47, '<':0x48, '>':0x4a, '<=':0x4c, '>=':0x4e, '&&':0x71, '||':0x72 };
  const uleb = n => { const o = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return o; };
  const sleb = n => { const o = []; while (true) { let b = n & 0x7f; n >>= 7; if ((n === 0 && !(b & 0x40)) || (n === -1 && (b & 0x40))) { o.push(b); return o; } o.push(b | 0x80); } };

  const params = [], locals = [], vars = {};
  const slot = name => vars[name];
  const declare = name => { if (!(name in vars)) { vars[name] = params.length + locals.length; locals.push(name); } return vars[name]; };
  const fail = (msg) => { throw new Error(msg); };

  // ---- expressions ----
  function tokens(src) {
    let s = ' ' + src.toLowerCase().replace(/\bthe\b|\bvalue of\b/g, ' ') + ' ';
    s = s.replace(/(\w+) squared/g, '( $1 * $1 )');
    const phrases = [
      [/is divisible by|is a multiple of/g, ' DIVBY '],
      [/is greater than or equal to|is at least|is not less than/g, ' >= '],
      [/is less than or equal to|is at most|is not more than/g, ' <= '],
      [/is greater than|is more than|is bigger than|is above/g, ' > '],
      [/is less than|is smaller than|is below/g, ' < '],
      [/is not equal to|does not equal|is not/g, ' != '],
      [/is equal to|equals|\bis\b/g, ' == '],
      [/divided by/g, ' / '], [/multiplied by|\btimes\b/g, ' * '],
      [/\bplus\b/g, ' + '], [/\bminus\b/g, ' - '], [/\bmodulo\b|\bmod\b/g, ' % '],
      [/\band\b/g, ' && '], [/\bor\b/g, ' || '],
    ];
    for (const [re, rep] of phrases) s = s.replace(re, rep);
    s = s.replace(/(>=|<=|==|!=|&&|\|\||[()+\-*/%<>])/g, ' $1 ');
    return s.trim().split(/\s+/).filter(Boolean);
  }
  function expr(src) {
    const t = tokens(src); let i = 0; const out = [];
    const peek = () => t[i];
    const level = (ops, next) => () => {
      next();
      while (ops.includes(peek())) { const op = t[i++]; next(); if (op === 'DIVBY') out.push(0x6f, 0x45); else out.push(OPS[op]); }
    };
    const atom = () => {
      const tok = t[i++];
      if (tok === undefined) fail('the sentence ends too early');
      if (tok === '(') { or(); if (t[i++] !== ')') fail('missing a closing bracket'); return; }
      if (tok === '-') { out.push(0x41, 0); atom(); out.push(0x6b); return; }
      if (/^-?\d+$/.test(tok)) { out.push(0x41, ...sleb(parseInt(tok, 10) | 0)); return; }
      if (tok in NUMWORDS) { out.push(0x41, ...sleb(NUMWORDS[tok])); return; }
      if (slot(tok) === undefined) fail(`I don't know what "${tok}" is`);
      out.push(0x20, ...uleb(slot(tok)));
    };
    const mul = level(['*', '/', '%'], atom), add = level(['+', '-'], mul);
    const rel = level(['==', '!=', '<', '>', '<=', '>=', 'DIVBY'], add);
    const and = level(['&&'], rel), or = level(['||'], and);
    or();
    if (i < t.length) fail(`I don't understand "${t.slice(i).join(' ')}"`);
    return out;
  }
  const setVar = (name, bytes) => [...bytes, 0x21, ...uleb(declare(name))];
  const update = (name, opBytes, valSrc) => {
    if (slot(name) === undefined) fail(`I don't know what "${name}" is`);
    return [0x20, ...uleb(slot(name)), ...expr(valSrc), opBytes, 0x21, ...uleb(slot(name))];
  };

  // ---- statements ----
  const stack = [];
  function statement(s) {
    let m;
    if ((m = s.match(/^(?:given|take|inputs?:?)\s+(.+)$/))) {
      if (params.length || locals.length) fail('inputs must come first');
      for (const p of m[1].split(/\s*(?:,|\band\b)\s*/).filter(Boolean)) { vars[p] = params.length; params.push(p); }
      return [];
    }
    if ((m = s.match(/^(?:while|repeat while|as long as|loop while)\s+(.+?)(?:,?\s*(?:do|repeat))?$/))) {
      stack.push('while'); return [0x02, 0x40, 0x03, 0x40, ...expr(m[1]), 0x45, 0x0d, 0x01];
    }
    if ((m = s.match(/^if\s+(.+?)\s*(?:,\s*then|,|\bthen\b)\s*(.+)$/))) return [...expr(m[1]), 0x04, 0x40, ...statement(m[2]), 0x0b];
    if ((m = s.match(/^if\s+(.+)$/))) { stack.push('if'); return [...expr(m[1]), 0x04, 0x40]; }
    if (/^(?:otherwise|else)$/.test(s)) { if (stack.at(-1) !== 'if') fail('"otherwise" without an "if"'); stack[stack.length - 1] = 'else'; return [0x05]; }
    if (/^(?:end|done|stop)$/.test(s)) {
      const b = stack.pop(); if (!b) fail('"end" without a loop or "if"');
      return b === 'while' ? [0x0c, 0x00, 0x0b, 0x0b] : [0x0b];
    }
    if ((m = s.match(/^(?:return|give back|answer|the answer is|output)\s+(.+)$/))) return [...expr(m[1]), 0x0f];
    if ((m = s.match(/^(?:let|set)\s+(\w+)\s+(?:be|to|equal to|=)\s+(.+)$/))) return setVar(m[1], expr(m[2]));
    if ((m = s.match(/^(\w+)\s+(?:becomes|=)\s+(.+)$/))) return setVar(m[1], expr(m[2]));
    if ((m = s.match(/^(?:add)\s+(.+)\s+to\s+(\w+)$/))) return update(m[2], 0x6a, m[1]);
    if ((m = s.match(/^increase\s+(\w+)\s+by\s+(.+)$/))) return update(m[1], 0x6a, m[2]);
    if ((m = s.match(/^subtract\s+(.+)\s+from\s+(\w+)$/))) return update(m[2], 0x6b, m[1]);
    if ((m = s.match(/^decrease\s+(\w+)\s+by\s+(.+)$/))) return update(m[1], 0x6b, m[2]);
    if ((m = s.match(/^multiply\s+(\w+)\s+by\s+(.+)$/))) return update(m[1], 0x6c, m[2]);
    if ((m = s.match(/^divide\s+(\w+)\s+by\s+(.+)$/))) return update(m[1], 0x6d, m[2]);
    fail('I don\'t understand this sentence');
  }

  const lines = [];
  text.split('\n').forEach((raw, n) => {
    raw.split(/\.\s+|:\s+/).forEach(part => {
      const s = part.trim().toLowerCase().replace(/[.:;]+$/, '').trim();
      if (s && !s.startsWith('#')) lines.push({ n: n + 1, text: part.trim().replace(/[.]+$/, ''), s });
    });
  });
  const mapping = [];
  for (const l of lines) {
    try { mapping.push({ line: l.text, bytes: statement(l.s) }); }
    catch (e) { throw new Error(`Line ${l.n} ("${l.text}"): ${e.message}`); }
  }
  if (stack.length) throw new Error(`A ${stack.at(-1) === 'while' ? 'loop' : '"if"'} is missing its "end"`);
  if (!params.length) throw new Error('Start with "given ..." to name the inputs, e.g. "given n" or "given a and b"');

  const code = mapping.flatMap(m => m.bytes);
  const localDecl = locals.length ? [0x01, ...uleb(locals.length), 0x7f] : [0x00];
  const body = [...localDecl, ...code, 0x41, 0x00, 0x0b];
  const entry = [0x01, ...uleb(body.length), ...body];
  const typeSec = [0x01, 0x60, ...uleb(params.length), ...params.map(() => 0x7f), 0x01, 0x7f];
  const parts = [
    { line: 'WebAssembly header', bytes: [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00], meta: true },
    { line: `Type: ${params.length} number input${params.length > 1 ? 's' : ''} → 1 number out`, bytes: [0x01, ...uleb(typeSec.length), ...typeSec], meta: true },
    { line: 'Declare one function', bytes: [0x03, 0x02, 0x01, 0x00], meta: true },
    { line: 'Export it as "run"', bytes: [0x07, 0x07, 0x01, 0x03, 0x72, 0x75, 0x6e, 0x00, 0x00], meta: true },
    { line: `Code section, ${locals.length} working variable${locals.length === 1 ? '' : 's'}`, bytes: [0x0a, ...uleb(entry.length), 0x01, ...uleb(body.length), ...localDecl], meta: true },
    ...mapping,
    { line: 'End of function', bytes: [0x41, 0x00, 0x0b], meta: true },
  ];
  return { bytes: new Uint8Array(parts.flatMap(p => p.bytes)), parts, params };
}
if (typeof module !== 'undefined') module.exports = { compileEnglish };
