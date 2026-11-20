"""Make training pairs: everyday request -> Structured English v0.3 program.
Programs come from 15 families with varied details; every program is checked by the real compiler before it's kept."""
import json, random, subprocess
R = random.Random(7)
COL = ['charcoal', 'blue', 'purple', 'teal', 'green', 'black', 'red', 'orange', 'pink']
INK = ['white', 'lime', 'yellow', 'sky', 'pink', 'white', 'white']
def pick(x): return R.choice(x)
def oops(s):  # occasional small typos, like real people
    if R.random() < 0.15 and len(s) > 12:
        i = R.randrange(3, len(s) - 3); s = s[:i] + s[i + 1] + s[i] + s[i + 2:]
    return s if R.random() < 0.7 else s.lower()
def keypad(dot=True, minus=False, c='C'):
    keys = '7 8 9 C 4 5 6 . 1 2 3 0' if dot else '7 8 9 C 4 5 6 0 1 2 3'
    if minus: keys = keys.replace(' .', ' −') if not dot else keys + ' −'
    return keys
out = []
def add(program, requests):
    out.append({'program': program.strip() + '\n', 'requests': [oops(r) for r in requests]})

# 1. counters
THINGS = [('glasses of water', 'GLASSES', 'water'), ('push-ups', 'PUSH UPS', 'pushups'), ('cups of tea', 'CUPS OF TEA', 'cups'), ('pages I read', 'PAGES', 'pages'),
          ('laps of the pool', 'LAPS', 'laps'), ('people coming in', 'VISITORS', 'visitors'), ('goals', 'GOALS', 'goals'), ('times I practised', 'PRACTICE', 'sessions'),
          ('steps', 'STEPS', 'steps'), ('sit-ups', 'SIT UPS', 'situps'), ('customers', 'CUSTOMERS', 'customers'), ('birds I spotted', 'BIRDS', 'birds')]
for thing, title, var in THINGS:
    for variant in range(2):
        step = pick([1, 1, 1, 2, 5, 10]); bg = pick(COL); ink = pick(INK); rnd = R.random() < 0.4; keep = R.random() < 0.4; minus = R.random() < 0.6
        btns = ' '.join(x for x in ['−' if minus else '', '"RESET"', '+'] if x)
        p = f'''The screen is {bg}.
Write "{title}" at the top in white.
Remember a number called {var}.
{"Keep " + var + " between visits." if keep else ""}
A display shows {var} in {ink}.
Buttons, {3 if minus else 2} per row: {btns}.
{"The buttons are round." if rnd else ""}
When I press +:
  {var.capitalize()} becomes {var} plus {step}.
{f"When I press −:{chr(10)}  If {var} is at least {step}, {var} becomes {var} minus {step}." if minus else ""}
When I press "RESET":
  {var.capitalize()} becomes 0.'''
        reqs = [f'a counter for {thing}', f'count how many {thing}', f'I want to keep track of {thing}' + (' and it should remember them' if keep else ''),
                f'tally of {thing}{", going up by " + str(step) if step > 1 else ""}', f'app to count {thing} with a reset button' + (' and round buttons' if rnd else '')]
        add(p, R.sample(reqs, 4))

# 2. converters
CONV = [('miles', 'kilometres', 'MILES', 'KM', 'times 1.609'), ('kilometres', 'miles', 'KM', 'MILES', 'divided by 1.609'), ('kilograms', 'pounds', 'KG', 'POUNDS', 'times 2.205'),
        ('pounds', 'kilograms', 'POUNDS', 'KG', 'divided by 2.205'), ('inches', 'centimetres', 'INCHES', 'CM', 'times 2.54'), ('centimetres', 'inches', 'CM', 'INCHES', 'divided by 2.54'),
        ('hours', 'minutes', 'HOURS', 'MINUTES', 'times 60'), ('minutes', 'seconds', 'MINUTES', 'SECONDS', 'times 60'), ('litres', 'pints', 'LITRES', 'PINTS', 'times 1.76'),
        ('pounds sterling', 'euros', 'POUNDS', 'EUROS', 'times 1.17'), ('stone', 'kilograms', 'STONE', 'KG', 'times 6.35'), ('feet', 'metres', 'FEET', 'METRES', 'times 0.3048'),
        ('celsius', 'fahrenheit', '°C', '°F', 'times 9 divided by 5 plus 32'), ('fahrenheit', 'celsius', '°F', '°C', '(VAR minus 32) times 5 divided by 9')]
for a, b, la, lb, f in CONV:
    var = a.split()[0].replace('-', '')
    formula = f.replace('VAR', var) if 'VAR' in f else f'{var} {f}'
    neg = 'celsius' in a or 'fahrenheit' in a
    p = f'''The screen is {pick(COL)}.
Write "{la} TO {lb}" at the top in white.
Remember a number called {var}.
A display, labelled "{la}", shows {var} in white on black.
A display, labelled "{lb}", shows {formula} in {pick(INK)} on black.
Buttons, four per row: {keypad(dot=True)}{" −" if neg else ""}.
The C buttons are salmon.
When I press a digit:
  Type the digit into {var}.
When I press .:
  Type a point into {var}.
When I press C:
  Clear {var}.
{f"When I press −:{chr(10)}  {var.capitalize()} becomes 0 minus {var}." if neg else ""}'''
    add(p, [f'convert {a} to {b}', f'{a} to {b} converter', f'I need to change {a} into {b}', f'how many {b} is this many {a}?', f'a quick {a} → {b} calculator'])

# 3. countdowns and timers
for mins in [1, 2, 3, 5, 10, 15, 20, 25, 30, 45, 60]:
    secs = mins * 60; label = pick(['STUDY TIMER', 'FOCUS TIMER', 'COUNTDOWN', 'TIMER', 'WORKOUT TIMER'])
    p = f'''The screen is {pick(COL)}.
Write "{label}" at the top in white.
Remember a number called left starting at {secs}, and a number called running.
A display, labelled "SECONDS LEFT", shows left in {pick(INK)} on black.
A display, labelled "MINUTES LEFT", shows left divided by 60 in white on black.
Buttons, two per row: "START" "PAUSE".
Buttons, one per row: "RESET".
The "START" button is green.
The "PAUSE" button is salmon.
Every second:
  If running is 1, if left is more than 0, left becomes left minus 1.
When I press "START":
  Running becomes 1.
When I press "PAUSE":
  Running becomes 0.
When I press "RESET":
  Running becomes 0.
  Left becomes {secs}.'''
    add(p, [f'a {mins} minute timer', f'{mins} min countdown with start and pause', f'{label.lower()} for {mins} minutes', f'count down from {mins} minutes, I want to be able to pause it', f'set a timer for {mins} minutes'])
for tenth in [True, False]:
    p = f'''The screen is {pick(COL)}.
Write "STOPWATCH" at the top in white.
Remember a number called time, and a number called running.
A display shows time in {pick(INK)}.
Buttons, two per row: "START" "STOP".
Buttons, one per row: "RESET".
Every {"tenth of a second" if tenth else "second"}:
  If running is 1, time becomes time plus {"0.1" if tenth else "1"}.
When I press "START":
  Running becomes 1.
When I press "STOP":
  Running becomes 0.
When I press "RESET":
  Running becomes 0.
  Time becomes 0.'''
    add(p, ['a stopwatch', 'stopwatch with start stop and reset', 'time how long something takes' + (' to a tenth of a second' if tenth else ' in seconds'), 'I need a stop watch'])

# 4. splitters
for what, title in [('the bill', 'SPLIT THE BILL'), ('the rent', 'SPLIT THE RENT'), ('a pizza order', 'PIZZA SPLIT'), ('the electricity bill', 'BILL SPLIT'), ('a taxi fare', 'TAXI SPLIT'), ('holiday costs', 'HOLIDAY SPLIT')]:
    start = pick([2, 2, 3, 4])
    p = f'''The screen is {pick(COL)}.
Write "{title}" at the top in white.
Remember a number called total, and a number called people starting at {start}.
A display, labelled "TOTAL", shows total as money in white on black.
A display, labelled "PEOPLE", shows people in white on black.
A display, labelled "EACH PAYS", shows total divided by people as money in {pick(INK)} on black.
Buttons, two per row: "FEWER" "MORE".
Buttons, four per row: {keypad()}.
When I press a digit:
  Type the digit into total.
When I press .:
  Type a point into total.
When I press C:
  Clear total.
When I press "MORE":
  People becomes people plus 1.
When I press "FEWER":
  If people is more than 1, people becomes people minus 1.'''
    add(p, [f'split {what} between friends', f'divide {what} by the number of people', f'how much does everyone pay for {what}', f'{what} splitter', f'share {what} between flatmates'])

# 5. percentages: tips, discounts, VAT
for kind in ['tip', 'discount', 'vat']:
    for rates in [(10, 15, 20), (5, 10, 15), (12.5, 15, 20), (20, 30, 50), (10, 20, 25)]:
        if kind == 'vat' and rates != (10, 20, 25): continue
        r0 = rates[1]
        lab = {'tip': ('BILL', 'TIP', 'TOTAL', 'bill plus rate percent of bill'), 'discount': ('PRICE', 'YOU SAVE', 'YOU PAY', 'bill minus rate percent of bill'), 'vat': ('PRICE', 'VAT', 'WITH VAT', 'bill plus rate percent of bill')}[kind]
        p = f'''The screen is {pick(COL)}.
Write "{ {'tip': 'TIP CALCULATOR', 'discount': 'DISCOUNT', 'vat': 'VAT CALCULATOR'}[kind] }" at the top in white.
Remember a number called bill, and a number called rate starting at {r0}.
A display, labelled "{lab[0]}", shows bill as money in white on black.
A display, labelled "{lab[1]}", shows rate percent of bill as money in yellow on black.
A display, labelled "{lab[2]}", shows {lab[3]} as money in lime on black.
Buttons, three per row: {' '.join(f'"{r:g}%"' for r in rates)}.
Buttons, four per row: {keypad()}.
When I press a digit:
  Type the digit into bill.
When I press .:
  Type a point into bill.
When I press C:
  Clear bill.
''' + '\n'.join(f'When I press "{r:g}%":\n  Rate becomes {r:g}.' for r in rates)
        rs = ' / '.join(f'{r:g}' for r in rates)
        reqs = {'tip': [f'tip calculator with {rs} percent', f'work out the tip, options {rs}%', f'how much should I tip? let me pick {rs} percent', f'a tip and total calculator'],
                'discount': [f'discount calculator with {rs}% off', f'how much is it after {rs} percent off', f'sale price calculator', f'work out savings with {rs}% discounts'],
                'vat': ['add VAT to a price', 'VAT calculator', 'price including VAT at 20 percent', 'work out VAT']}[kind]
        add(p, reqs)

# 6. score keepers
for a, b, sport, pts in [('HOME', 'AWAY', 'football match', [1]), ('RED', 'BLUE', 'game', [1]), ('US', 'THEM', 'quiz night', [1]), ('TEAM A', 'TEAM B', 'basketball game', [1, 2, 3]), ('HOME', 'AWAY', 'rugby match', [3, 5]), ('ME', 'YOU', 'card game', [1])]:
    va, vb = a.lower().replace(' ', '_'), b.lower().replace(' ', '_')
    btn_a = ' '.join(f'"{a} +{p}"' for p in pts); btn_b = ' '.join(f'"{b} +{p}"' for p in pts)
    per = min(len(pts), 3)
    p = f'''The screen is {pick(COL)}.
Write "{sport.upper()}" at the top in white.
Remember a number called {va}, and a number called {vb}.
A display, labelled "{a}", shows {va} in white on black.
A display, labelled "{b}", shows {vb} in yellow on black.
Buttons, {['one', 'two', 'three'][per - 1]} per row: {btn_a}.
Buttons, {['one', 'two', 'three'][per - 1]} per row: {btn_b}.
Buttons, one per row: "RESET".
''' + '\n'.join(f'When I press "{a} +{p}":\n  {va.capitalize()} becomes {va} plus {p}.' for p in pts) + '\n' + '\n'.join(f'When I press "{b} +{p}":\n  {vb.capitalize()} becomes {vb} plus {p}.' for p in pts) + f'\nWhen I press "RESET":\n  {va.capitalize()} becomes 0.\n  {vb.capitalize()} becomes 0.'
    add(p, [f'score keeper for a {sport}', f'keep score in a {sport} between {a.lower()} and {b.lower()}', f'scoreboard for {sport}', f'track points for two teams in a {sport}'])

# 7. dice, coins, random numbers
for sides in [6, 6, 4, 8, 10, 12, 20, 100]:
    two = R.random() < 0.4 and sides <= 12
    p = f'''The screen is {pick(COL)}.
Write "{'DICE' if sides <= 20 else 'RANDOM NUMBER'}" at the top in white.
Remember a number called first starting at 1{", and a number called second starting at 1" if two else ""}.
A display, labelled "{'DIE 1' if two else 'YOU ROLLED'}", shows first in white on black.
{'A display, labelled "DIE 2", shows second in white on black.' if two else ''}
{'A display, labelled "TOTAL", shows first plus second in yellow on black.' if two else ''}
Buttons, one per row: "ROLL".
When I press "ROLL":
  First becomes a random number from 1 to {sides}.
{f"  Second becomes a random number from 1 to {sides}." if two else ""}
When I press space:
  First becomes a random number from 1 to {sides}.'''
    add(p, ([f'roll two {sides} sided dice', f'two dice and the total', 'roll 2 dice'] if two else [f'roll a {sides} sided die', f'random number between 1 and {sides}', f'd{sides} dice roller']) + ['dice app'])
p = '''The screen is green.
Write "COIN FLIP" at the top in white.
Remember a number called coin, a number called heads, and a number called tails.
A display, labelled "HEADS", shows heads in white on black.
A display, labelled "TAILS", shows tails in yellow on black.
Buttons, one per row: "FLIP".
Buttons, one per row: "RESET".
When I press "FLIP":
  Coin becomes a random number from 1 to 2.
  If coin is 1, heads becomes heads plus 1.
  If coin is 2, tails becomes tails plus 1.
When I press "RESET":
  Heads becomes 0.
  Tails becomes 0.'''
add(p, ['flip a coin and count heads and tails', 'coin flip that keeps score', 'heads or tails counter', 'toss a coin app'])

# 8. lists
for name, title, item in [('to-do', 'TO DO', 'task'), ('shopping', 'SHOPPING LIST', 'item'), ('packing', 'PACKING LIST', 'thing'), ('homework', 'HOMEWORK', 'task'), ('grocery', 'GROCERIES', 'item'), ('chores', 'CHORES', 'chore'), ('reading', 'BOOKS TO READ', 'book'), ('gift', 'GIFT IDEAS', 'idea')]:
    keep = R.random() < 0.6; action = pick(['Tick it.', 'Tick it.', 'Remove it.'])
    p = f'''The screen is {pick(COL)}.
Write "{title}" at the top in {pick(['white', 'yellow', 'lime'])}.
A text box called {item}, labelled "NEW {item.upper()}".
A list called {item}s.
{f"Keep {item}s between visits." if keep else ""}
Buttons, two per row: "ADD" "CLEAR ALL".
When I press "ADD":
  Add {item} to {item}s.
When I press enter:
  Add {item} to {item}s.
When I press "CLEAR ALL":
  Clear {item}s.
When I click an item in {item}s:
  {action}'''
    add(p, [f'a {name} list' + (' that remembers' if keep else ''), f'{name} list I can {"tick off" if "Tick" in action else "remove items from"}', f'make me a {name} list', f'list for {name} with an add button'])

# 9. calculators
for title, bg in [('CALCULATOR', 'charcoal'), ('CALC', 'black'), ('MY CALCULATOR', 'blue')]:
    p = open('/home/claude/v3/programs/calculator.txt').read().replace('The screen is charcoal.', f'The screen is {bg}.').replace('"CALCULATOR"', f'"{title}"')
    add(p, ['a calculator', 'simple calculator with plus minus times divide', 'basic calculator app', 'I need a calculator with decimals'])
for title in ['ADD IT UP', 'RUNNING TOTAL', 'SHOPPING TOTAL']:
    p = f'''The screen is {pick(COL)}.
Write "{title}" at the top in white.
Remember a number called entry, and a number called total.
A display, labelled "THIS ITEM", shows entry as money in white on black.
A display, labelled "TOTAL", shows total as money in lime on black.
Buttons, two per row: "ADD" "START AGAIN".
Buttons, four per row: {keypad()}.
When I press a digit:
  Type the digit into entry.
When I press .:
  Type a point into entry.
When I press C:
  Clear entry.
When I press "ADD":
  Total becomes total plus entry.
  Clear entry.
When I press "START AGAIN":
  Total becomes 0.
  Clear entry.'''
    add(p, ['add up my shopping', 'running total of prices', 'a calculator for adding up a bill', 'keep adding amounts to a total'])

# 10. savings and goals
for goal in [100, 250, 500, 1000, 2000]:
    p = f'''The screen is {pick(COL)}.
Write "SAVINGS GOAL" at the top in white.
Remember a number called saved, and a number called amount.
Keep saved between visits.
A display, labelled "SAVED", shows saved as money in lime on black.
A display, labelled "STILL TO GO", shows {goal} minus saved as money in yellow on black.
A display, labelled "AMOUNT", shows amount as money in white on black.
Buttons, two per row: "ADD" "C".
Buttons, four per row: 7 8 9 4 5 6 1 2 3 . 0.
When I press a digit:
  Type the digit into amount.
When I press .:
  Type a point into amount.
When I press C:
  Clear amount.
When I press "ADD":
  Saved becomes saved plus amount.
  Clear amount.'''
    add(p, [f'savings tracker for a £{goal} goal', f'how much have I saved towards {goal} pounds', f'track my savings, target {goal}', 'saving up app that remembers'])

# 11. day countdowns / challenges
for days in [7, 14, 21, 30, 40, 66, 100]:
    p = f'''The screen is {pick(COL)}.
Write "{days} DAY CHALLENGE" at the top in white.
Remember a number called done.
Keep done between visits.
A display, labelled "DAYS DONE", shows done in white on black.
A display, labelled "DAYS LEFT", shows {days} minus done in yellow on black.
Buttons, one per row: "DAY DONE".
Buttons, one per row: "START OVER".
When I press "DAY DONE":
  If done is less than {days}, done becomes done plus 1.
When I press "START OVER":
  Done becomes 0.'''
    add(p, [f'{days} day challenge tracker', f'count down the days left in a {days} day challenge', f'track a {days}-day habit', f'how many days left of {days}'])

# 12. quizzes
for op, sym, lo, hi in [('times', '×', 2, 9), ('plus', '+', 1, 20), ('times', '×', 2, 12), ('plus', '+', 10, 99), ('minus', '−', 10, 50)]:
    title = f'WHAT IS A {sym} B ?'
    p = f'''The screen is {pick(COL)}.
Remember a number called a, a number called b, a number called answer, a number called score, and a number called asked.
When the app opens:
  A becomes a random number from {lo} to {hi}.
  B becomes a random number from {lo} to {hi}.
On the "QUESTION" screen:
Write "{title}" at the top in white.
A display, labelled "A", shows a in white on black.
A display, labelled "B", shows b in white on black.
A display, labelled "YOUR ANSWER", shows answer in yellow on black.
Buttons, five per row: 1 2 3 4 5 6 7 8 9 0.
Buttons, two per row: "CLEAR" "CHECK".
On the "RESULT" screen:
Write "THE ANSWER WAS" at the top in white.
A display shows a {op} b in lime on black.
A display, labelled "SCORE", shows score in white on black.
A display, labelled "QUESTIONS", shows asked in white on black.
Buttons, one per row: "NEXT".
When I press a digit:
  Answer becomes answer times 10 plus the digit.
When I press "CLEAR":
  Answer becomes 0.
When I press "CHECK":
  If answer is a {op} b, score becomes score plus 1.
  Asked becomes asked plus 1.
  Go to the "RESULT" screen.
When I press "NEXT":
  A becomes a random number from {lo} to {hi}.
  B becomes a random number from {lo} to {hi}.
  Answer becomes 0.
  Go to the "QUESTION" screen.'''
    name = {'times': 'times tables', 'plus': 'adding', 'minus': 'taking away'}[op]
    add(p, [f'a quiz on {name}', f'{name} quiz with a results screen', f'test me on {name} up to {hi}', f'maths quiz: {name}'])

# 13. catch games
for thing, catcher, col in [('star', 'basket', 'yellow'), ('ball', 'paddle', 'white'), ('apple', 'basket', 'red'), ('coin', 'bag', 'yellow'), ('raindrop', 'bucket', 'sky')]:
    speed = pick([3, 4, 5, 6])
    p = f'''The screen is black.
Write "CATCH THE {thing.upper()}" at the top in {col}.
Remember a number called {catcher} starting at 80, a number called x starting at 40, a number called y starting at 40, and a number called score.
A display, labelled "CAUGHT", shows score in white on charcoal.
Draw a {col} circle of size 10 at x and y.
Draw a sky bar of size 8 at {catcher} and 184.
Buttons, two per row: "LEFT" "RIGHT".
Every tenth of a second:
  Y becomes y plus {speed}.
  If y is at least 180, if x is at least {catcher} minus 16, if x is at most {catcher} plus 16, score becomes score plus 1.
  If y is at least 180, x becomes a random number from 10 to 150.
  If y is at least 180, y becomes 45.
When I press "LEFT":
  If {catcher} is more than 16, {catcher} becomes {catcher} minus 12.
When I press "RIGHT":
  If {catcher} is less than 144, {catcher} becomes {catcher} plus 12.
When I press left:
  If {catcher} is more than 16, {catcher} becomes {catcher} minus 12.
When I press right:
  If {catcher} is less than 144, {catcher} becomes {catcher} plus 12.'''
    add(p, [f'a game where I catch a falling {thing}', f'move a {catcher} to catch {thing}s', f'catch the {thing} game with arrow keys', f'simple catching game'])

# 14. hours and minutes, ages, BMI-like two-input sums
p = '''The screen is teal.
Write "HOURS TO MINUTES" at the top in white.
Remember a number called hours, a number called minutes, and a number called mode starting at 1.
A display, labelled "HOURS", shows hours in white on black.
A display, labelled "MINUTES", shows minutes in white on black.
A display, labelled "TOTAL MINUTES", shows hours times 60 plus minutes in yellow on black.
Buttons, two per row: "HOURS" "MINUTES".
Buttons, four per row: 7 8 9 C 4 5 6 1 2 3 0.
When I press "HOURS":
  Mode becomes 1.
When I press "MINUTES":
  Mode becomes 2.
When I press a digit:
  If mode is 1, type the digit into hours.
  If mode is 2, type the digit into minutes.
When I press C:
  Clear hours.
  Clear minutes.'''
add(p, ['hours and minutes to minutes', 'convert hours and minutes into total minutes', 'how many minutes is 2 hours 30', 'time converter hours minutes'])
for title, a, b, formula, la, lb, money in [('BMI', 'weight', 'height', 'weight divided by (height times height)', 'WEIGHT KG', 'HEIGHT M', False),
                                             ('POCKET MONEY', 'weekly', 'weeks', 'weekly times weeks', 'EACH WEEK', 'WEEKS', True),
                                             ('FUEL COST', 'litres', 'price', 'litres times price', 'LITRES', 'PRICE PER LITRE', True),
                                             ('HOURLY PAY', 'hours', 'rate', 'hours times rate', 'HOURS', 'PAY PER HOUR', True)]:
    p = f'''The screen is {pick(COL)}.
Write "{title}" at the top in white.
Remember a number called {a}, a number called {b}, and a number called mode starting at 1.
A display, labelled "{la}", shows {a} in white on black.
A display, labelled "{lb}", shows {b} in white on black.
A display, labelled "RESULT", shows {formula}{" as money" if money else ""} in yellow on black.
Buttons, two per row: "{la.split()[0]}" "{lb.split()[0]}".
Buttons, four per row: 7 8 9 C 4 5 6 . 1 2 3 0.
When I press "{la.split()[0]}":
  Mode becomes 1.
When I press "{lb.split()[0]}":
  Mode becomes 2.
When I press a digit:
  If mode is 1, type the digit into {a}.
  If mode is 2, type the digit into {b}.
When I press .:
  If mode is 1, type a point into {a}.
  If mode is 2, type a point into {b}.
When I press C:
  Clear {a}.
  Clear {b}.'''
    add(p, [f'{title.lower()} calculator', f'work out {title.lower()} from {a} and {b}', f'calculate {formula.replace("times", "x")}', f'{title.lower()} app with two inputs'])

# 15. reaction / random light game
p = '''The screen is black.
Write "REACTION GAME" at the top in white.
Remember a number called wait starting at 30, a number called time, a number called ready, and a number called best starting at 999.
A display, labelled "YOUR TIME (TENTHS)", shows time in yellow on black.
A display, labelled "BEST", shows best in lime on black.
Draw a green circle of size 30 at 80 and 130.
Buttons, one per row: "PRESS".
Every tenth of a second:
  If ready is 0, wait becomes wait minus 1.
  If ready is 0, if wait is 0, ready becomes 1.
  If ready is 1, time becomes time plus 1.
When I press "PRESS":
  If ready is 1, if time is less than best, best becomes time.
  Ready becomes 0.
  Time becomes 0.
  Wait becomes a random number from 10 to 40.'''
add(p, ['a reaction game', 'test my reaction time', 'press the button as fast as you can game', 'reaction speed tester'])

# ---- check every program with the real compiler ----
lines = '\n'.join(json.dumps({'id': i, 'program': o['program']}) for i, o in enumerate(out))
res = subprocess.run(['node', '/home/claude/kit/check.js', '/home/claude/v3'], input=lines, capture_output=True, text=True).stdout.splitlines()
res = [json.loads(l) for l in res]
bad = [(out[r['id']]['program'].splitlines()[1], r['error']) for r in res if not r['ok']]
good = [o for o, r in zip(out, res) if r['ok']]
pairs = [{'everyday': q, 'structured': o['program']} for o in good for q in o['requests']]
R.shuffle(pairs)
with open('pairs.jsonl', 'w') as f:
    for p in pairs: f.write(json.dumps(p) + '\n')
print(f'{len(out)} programs made, {len(good)} compile, {len(bad)} rejected → {len(pairs)} training pairs')
for b in bad[:8]: print('  rejected:', b)
