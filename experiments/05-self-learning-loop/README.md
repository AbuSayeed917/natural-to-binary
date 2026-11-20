# Experiment 05: a self-learning loop

**Question:** can a small model get better at turning English into working apps **by itself**, with no human marking its work?

**Short answer:** yes, a little. After one round it passed **6/20** exam apps, up from **4/20**. But it only improves at things it can already sometimes do. Kinds of app it never got right stayed at zero.

## The loop

```
teacher (Claude) writes tasks + tests
        ↓
student (our small model) tries each task 4 times
        ↓
judge runs every try in a sealed box and checks what it DOES
        ↓
tries that pass every test become new training examples
        ↓
student trains on its own winners  →  sits the exam again
```

There's no human anywhere in the loop. The judge decides what counts as right.

- **The student** is Qwen2.5-0.5B-Instruct with the LoRA add-on from [experiment 04](../04-small-local-model). It runs on 2 CPU cores.
- **The teacher** is Claude, which wrote the 20 exam tasks and the 15 recipes that make 60 practice tasks with varied numbers and button names.
- **The exam tasks are never trained on.** Practice tasks use different numbers and wording.

## The judge

`judge.js` tests an app the way a person would:

1. It **reads the screen**, by finding every letter of the 5×7 font at sizes 1–4.
2. It **presses buttons it can see**, by label.
3. It types, waits, and checks what the screen now shows.

It never looks inside the program, so it can judge any binary that follows the host contract, including ones written directly as bytes.

Each test is a list of plain steps, for example:

```js
{ name: '5 seconds after START shows 40', steps: [{ press: 'START' }, { wait: 5 }, { see: 40 }] }
```

**Safety:** every app runs in a sealed worker thread:
- no imports (no outside access)
- at most 1 MB of app memory and 64 MB for the worker
- stopped after 6 seconds

**Is the judge itself right?**

| Check | Result |
|---|---|
| `check-exam.js`: a hand-written correct answer for every exam task | **20/20 pass**, so the tests are fair |
| `check-catches.js`: apps broken on purpose with the student's typical mistakes (start at 40 not 45, VAT 2% not 20%, a timer that goes below zero, a factor of 2.2 instead of 2.20462) | **10/10 caught** |

## Results (round 1)

| | Exam: compiles | Exam: passes **every** test |
|---|---|---|
| Before (experiment 04 model) | 11/20 | **4/20** |
| After one round of learning from itself | 12/20 | **6/20** |

**Practice:**
- 240 tries in total (60 tasks × 4).
- **124** compiled and **52** passed every test.
- At least one try passed on **25** of the 60 tasks.

The student then trained on 41 of its own winners, plus 120 old examples so it wouldn't forget them. Training took 41 steps, about 10 minutes.

**Newly passing apps:** the to-do list and the bill splitter.

### Which kinds of app it could already sometimes do, and which never

| Kind of app | Practice tries that passed |
|---|---|
| Counters | 21/32 |
| Unit converters | 9/24 |
| Dice | 8/24 |
| Countdowns | 6/32 |
| Day challenges ("30 days left, DONE takes one off") | **0/36** |
| "N-minute timer" | **0/12** |
| Stopwatches | **0/8** |

## What it taught me

1. **The judge is the most valuable part.** Its messages are specific and in plain English, e.g. *"expected to see 750, screen shows 75"* or *"there is no WEEK to press"*. That's exactly the feedback a learner needs.
2. **Self-learning only polishes what's already there.** If the student never gets a kind of app right, there are no winners to learn from, so it never improves at it. AlphaGo had the same issue and started by learning from human games. The fix for round 2 is for the teacher (Claude, still not a human) to write one correct example for each kind the student is stuck on.
3. **20 exam tasks are too few.** 4 → 6 is real progress on these tasks, but one app either way changes the score by 5%. The next exam should have 100 or more tasks.
4. **A 2-core CPU is the bottleneck.** One round took about 75 minutes. On a free Kaggle GPU or an M2 Pro with MLX, it would take minutes, which would allow many rounds.

## Files

| File | What it is |
|---|---|
| `judge.js` | The judge: screen reading, button pressing, test steps, sealed box |
| `judge-cli.js` | Judges a batch from Python (JSON lines in and out) |
| `tasks.js` | The exam (20 tasks with tests) and the practice-task recipes |
| `exam.json`, `train-tasks.json` | The same tasks, as data |
| `exam-reference.js` | One hand-written correct answer per exam task, used only to prove the tests are fair |
| `check-exam.js`, `check-catches.js` | Prove the judge is fair and catches mistakes |
| `loop.py` | The loop: `exam`, `practice`, `train` |
| `round1/` | Every try, every mark and every log from round 1 |

The trained add-on (35 MB) is not committed.
