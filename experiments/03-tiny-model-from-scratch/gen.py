"""Build English -> WebAssembly training pairs.
Code exists ONLY here, to manufacture data. The model never sees it; it sees English in, bytes out."""
import json, random

def uleb(n):
    out = []
    while True:
        b = n & 0x7f; n >>= 7
        out.append(b | (0x80 if n else 0))
        if not n: return out

def sleb(n):
    out = []
    while True:
        b = n & 0x7f; n >>= 7
        if (n == 0 and not b & 0x40) or (n == -1 and b & 0x40): out.append(b); return out
        out.append(b | 0x80)

def module(nparams, code, nlocals=0):
    typ = [0x01, 0x60, nparams] + [0x7f] * nparams + [0x01, 0x7f]
    decl = [0x01, nlocals, 0x7f] if nlocals else [0x00]
    body = decl + code + [0x0b]
    entry = [0x01] + uleb(len(body)) + body
    return bytes([0x00, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 0x01, *uleb(len(typ)), *typ,
                  0x03, 0x02, 0x01, 0x00, 0x07, 0x07, 0x01, 0x03, 0x72, 0x75, 0x6e, 0x00, 0x00,
                  0x0a, *uleb(len(entry)), *entry])

g = lambda i: [0x20, i]
k = lambda c: [0x41] + sleb(c)
i32 = lambda v: ((v + 2**31) % 2**32) - 2**31
WORDS = 'zero one two three four five six seven eight nine ten eleven twelve'.split()
SMALL = list(range(-20, 51))

# family: (params, needs constants, english templates, byte builder, reference, test inputs)
FAM = {
 'add_const': (1, 1, ['add {c} to a number', 'return the input plus {c}', 'take a number and increase it by {c}',
   'give me the number that is {c} more than x', 'a function that adds {c} to whatever it gets', 'what is n + {c}', 'increase the value by {c}'],
   lambda c: g(0) + k(c[0]) + [0x6a], lambda c, x: x + c[0], SMALL),
 'sub_const': (1, 1, ['subtract {c} from a number', 'return the input minus {c}', 'take a number and decrease it by {c}',
   'give me the number that is {c} less than x', 'take away {c} from n', 'what is n - {c}', 'reduce the value by {c}'],
   lambda c: g(0) + k(c[0]) + [0x6b], lambda c, x: x - c[0], SMALL),
 'mul_const': (1, 1, ['multiply a number by {c}', 'return the input times {c}', 'scale n by a factor of {c}',
   'give me {c} times x', 'what is n * {c}', 'make the number {c} times bigger', 'a function that multiplies its input by {c}'],
   lambda c: g(0) + k(c[0]) + [0x6c], lambda c, x: x * c[0], SMALL),
 'mod_const': (1, 1, ['the remainder when n is divided by {c}', 'return x mod {c}', 'what is left over after dividing a number by {c}',
   'n modulo {c}', 'give me the remainder of x divided by {c}', 'compute n % {c}', 'find the remainder after splitting n into groups of {c}'],
   lambda c: g(0) + k(c[0]) + [0x6f], lambda c, x: x % c[0], list(range(0, 120))),
 'divisible': (1, 1, ['is n divisible by {c}', 'return 1 if x is a multiple of {c}, otherwise 0', 'check whether a number divides evenly by {c}',
   'does {c} go into n with no remainder', 'tell me if the input is divisible by {c}', 'is x a multiple of {c}', 'return true if n can be split into groups of {c} exactly'],
   lambda c: g(0) + k(c[0]) + [0x6f, 0x45], lambda c, x: int(x % c[0] == 0), list(range(0, 120))),
 'gt_const': (1, 1, ['is n greater than {c}', 'return 1 if x is bigger than {c}, otherwise 0', 'check whether a number is above {c}',
   'is the input more than {c}', 'tell me if n exceeds {c}', 'is x > {c}', 'return true when the value is larger than {c}'],
   lambda c: g(0) + k(c[0]) + [0x4a], lambda c, x: int(x > c[0]), list(range(-10, 110))),
 'lt_const': (1, 1, ['is n less than {c}', 'return 1 if x is smaller than {c}, otherwise 0', 'check whether a number is below {c}',
   'is the input under {c}', 'tell me if n is lower than {c}', 'is x < {c}', 'return true when the value is smaller than {c}'],
   lambda c: g(0) + k(c[0]) + [0x48], lambda c, x: int(x < c[0]), list(range(-10, 110))),
 'cap': (1, 1, ['cap a number at {c}', 'return the smaller of x and {c}', 'limit n so it is never more than {c}',
   'keep the value at most {c}', 'clamp x to a maximum of {c}', 'min of n and {c}', 'do not let the number go above {c}'],
   lambda c: g(0) + k(c[0]) + g(0) + k(c[0]) + [0x48, 0x1b], lambda c, x: min(x, c[0]), list(range(-10, 110))),
 'floor': (1, 1, ['make sure a number is at least {c}', 'return the larger of x and {c}', 'never let n drop below {c}',
   'keep the value at least {c}', 'clamp x to a minimum of {c}', 'max of n and {c}', 'raise the number to {c} if it is lower'],
   lambda c: g(0) + k(c[0]) + g(0) + k(c[0]) + [0x4a, 0x1b], lambda c, x: max(x, c[0]), list(range(-10, 110))),
 'square_plus': (1, 1, ['square a number and add {c}', 'return x squared plus {c}', 'multiply n by itself then add {c}',
   'n times n plus {c}', 'the square of the input increased by {c}', 'what is x*x + {c}', 'take the square of n and add {c} to it'],
   lambda c: g(0) + g(0) + [0x6c] + k(c[0]) + [0x6a], lambda c, x: x * x + c[0], SMALL),
 'linear': (1, 2, ['multiply a number by {c} then add {d}', 'return {c} times x plus {d}', 'scale n by {c} and add {d}',
   'n * {c} + {d}', 'take the input, times it by {c}, then add {d}', 'what is {c}x + {d}', 'compute {c} lots of n and then {d} more'],
   lambda c: g(0) + k(c[0]) + [0x6c] + k(c[1]) + [0x6a], lambda c, x: x * c[0] + c[1], SMALL),
 'add2': (2, 0, ['add two numbers', 'return a plus b', 'the sum of two numbers', 'add the inputs together', 'what is a + b', 'combine two numbers by adding them'],
   lambda c: g(0) + g(1) + [0x6a], lambda c, a, b: a + b, None),
 'sub2': (2, 0, ['subtract the second number from the first', 'return a minus b', 'the difference a - b', 'take b away from a', 'what is a - b', 'how much bigger is a than b'],
   lambda c: g(0) + g(1) + [0x6b], lambda c, a, b: a - b, None),
 'mul2': (2, 0, ['multiply two numbers', 'return a times b', 'the product of two numbers', 'multiply the inputs together', 'what is a * b', 'a lots of b'],
   lambda c: g(0) + g(1) + [0x6c], lambda c, a, b: a * b, None),
 'max2': (2, 0, ['the larger of two numbers', 'return whichever of a and b is bigger', 'the maximum of two values', 'which is greater, a or b', 'max of a and b', 'pick the bigger number'],
   lambda c: g(0) + g(1) + g(0) + g(1) + [0x4a, 0x1b], lambda c, a, b: max(a, b), None),
 'min2': (2, 0, ['the smaller of two numbers', 'return whichever of a and b is smaller', 'the minimum of two values', 'which is less, a or b', 'min of a and b', 'pick the smaller number'],
   lambda c: g(0) + g(1) + g(0) + g(1) + [0x48, 0x1b], lambda c, a, b: min(a, b), None),
 'abs': (1, 0, ['the absolute value of a number', 'return x without its minus sign', 'how far is n from zero', 'make a number positive', 'abs of x', 'distance of the input from 0'],
   lambda c: k(0) + g(0) + [0x6b] + g(0) + g(0) + k(0) + [0x48, 0x1b], lambda c, x: abs(x), SMALL),
 'is_even': (1, 0, ['is a number even', 'return 1 if n is even, otherwise 0', 'check whether x is even', 'tell me if the input is an even number', 'is n divisible by two', 'even or not'],
   lambda c: g(0) + k(1) + [0x71, 0x45], lambda c, x: int(x % 2 == 0), SMALL),
 'is_odd': (1, 0, ['is a number odd', 'return 1 if n is odd, otherwise 0', 'check whether x is odd', 'tell me if the input is an odd number', 'is n not divisible by two', 'odd or not'],
   lambda c: g(0) + k(1) + [0x71], lambda c, x: x & 1, SMALL),
 'sum_to_n': (1, 0, ['add up all the numbers from 1 to n', 'the sum of 1 to n', 'return 1 + 2 + ... + n', 'the nth triangle number', 'total of every whole number up to n', 'sum the integers from one to x'],
   lambda c: g(0) + g(0) + k(1) + [0x6a, 0x6c] + k(2) + [0x6d], lambda c, x: x * (x + 1) // 2, list(range(0, 200))),
 'factorial': (1, 0, ['the factorial of n', 'return n!', 'multiply together all numbers from 1 to n', 'n factorial', 'the product of every whole number up to x', 'how many ways to arrange n things in order'],
   lambda c: k(1) + [0x21, 1, 0x02, 0x40, 0x03, 0x40] + g(0) + k(1) + [0x4c, 0x0d, 1] + g(1) + g(0) + [0x6c, 0x21, 1] + g(0) + k(1) + [0x6b, 0x21, 0, 0x0c, 0, 0x0b, 0x0b] + g(1),
   lambda c, x: __import__('math').factorial(x), list(range(0, 13))),
}

HOLD_CONSTS = {7, 23, 42, 64, 88}   # never seen in training
LOCALS = {'factorial': 1}

def render(t, c):
    s = t.format(c=c[0] if c else '', d=c[1] if len(c) > 1 else '')
    return s

def build():
    rnd = random.Random(0)
    items = []
    for fam, (np_, nc, temps, build_b, ref, inputs) in FAM.items():
        held_template = len(temps) - 1     # last wording of each family is never trained on
        if nc == 0: combos = [()]
        elif nc == 1: combos = [(c,) for c in range(2 if fam in ('mod_const', 'divisible') else 1, 100)]
        else: combos = [(a, b) for a in range(2, 13) for b in range(1, 100)]
        for ti, t in enumerate(temps):
            for c in combos:
                code = module(np_, build_b(c), LOCALS.get(fam, 0))
                if np_ == 2: tests = [[a, b] for a, b in [(3, 9), (9, 3), (-4, 6), (0, 0), (25, -7)]]
                else: tests = [[x] for x in rnd.sample(inputs, 6)]
                tests = [[args, i32(ref(c, *args))] for args in tests]
                if ti == held_template: split = 'test_new_wording'
                elif any(v in HOLD_CONSTS for v in c): split = 'test_new_number'
                else: split = 'train'
                text = render(t, c)
                items.append({'text': text, 'hex': code.hex(), 'family': fam, 'tests': tests, 'split': split})
    # small numbers sometimes written as words, like people do
    for it in items:
        if it['split'] == 'train' and rnd.random() < 0.15:
            for n in range(12, 1, -1):
                if f' {n}' in ' ' + it['text'] + ' ':
                    it2 = dict(it); it2['text'] = (' ' + it['text'] + ' ').replace(f' {n} ', f' {WORDS[n]} ').strip(); items.append(it2); break
    rnd.shuffle(items)
    return items

if __name__ == '__main__':
    items = build()
    with open('data.jsonl', 'w') as f:
        for it in items: f.write(json.dumps(it) + '\n')
    from collections import Counter
    print(Counter(i['split'] for i in items), 'families:', len(FAM))
    print('longest binary:', max(len(i['hex']) // 2 for i in items), 'bytes; longest text:', max(len(i['text']) for i in items))
