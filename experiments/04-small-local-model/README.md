# A small open model on my own machine (no Claude)

**Question:** can a free, tiny model do the AI step (everyday English → Structured English)?

**Model:** [Qwen2.5-0.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct): official, Apache-2.0, 0.5 billion parameters, ~1 GB, safetensors (numbers only, no code). Runs on 2 CPU cores, no GPU. Every generated app was compiled and run in a sealed sandbox: a worker thread with no imports, 64 MB heap and a 3 s limit.

## 1. Without training (just instructions)

| Setup | Compiled (first 10 lab requests) |
|---|---|
| Full instructions | 0/10: it replied with a question every time |
| Without the “ask a question” option | 2/10 |
| Plus repair (compiler error sent back, 3 tries) | 2/10: it repeats its mistakes |

A 0.5B model can't follow 1,100 words of instructions.

## 2. After training (LoRA, 1 pass)

- **529 training pairs** from 125 generated apps in 15 families (`gen_pairs.py`). Every program was checked by the compiler. The 20 test requests were removed from training.
- LoRA r=16 (1.75% of weights), 133 steps, **~40 min on 2 CPU cores**, loss 2.6 → 0.1, adapter 35 MB.
- Tested on the 20 lab requests it never saw, with a short prompt and no instructions:

| Measure | Result |
|---|---|
| Compiles and runs safely | **12/20 (60%)**, up from 2/10 on the same first 10 (now 8/10) |
| Actually does what was asked (judged by reading each program) | **5/20 (25%)** |

| # | Request | Compiled | Judgement |
|---|---|---|---|
| 1 | A calculator for adding up a shopping bill | ✓ | wrong: adds 1 instead of the price |
| 2 | A counter for how many glasses of water I drank today | ✓ | correct |
| 3 | A 25 minute study timer with start and pause | ✓ | wrong: 150 s instead of 25 min |
| 4 | Roll two dice and show both | ✓ | wrong: 8-sided, shows one die |
| 5 | A tip calculator where I can pick 10, 12.5 or 15 percent | ✓ | wrong: no 12.5% option |
| 6 | Convert miles to kilometres | ✓ | correct |
| 7 | A to-do list for my weekend | ✗ | – |
| 8 | A score keeper for a football match between two teams | ✓ | wrong: scores start at 120 |
| 9 | Split the rent between flatmates | ✓ | correct (odd title) |
| 10 | A coin flip that counts heads and tails | ✗ | – |
| 11 | A countdown from 60 seconds that stops at zero | ✓ | correct |
| 12 | Work out my BMI from height and weight | ✗ | – |
| 13 | A quiz on adding numbers with a results screen | ✓ | wrong: not a quiz |
| 14 | A game where I move a paddle to catch a falling ball | ✓ | wrong: no ball |
| 15 | A savings tracker: how much I have saved towards a goal of 500 pounds | ✗ | – |
| 16 | A pocket money calculator: weekly amount times number of weeks | ✗ | – |
| 17 | Count down the days left in a 30 day challenge | ✗ | – |
| 18 | A shopping list that remembers my items | ✗ | – |
| 19 | Hours and minutes to minutes converter | ✓ | correct |
| 20 | A reaction game: press the button as soon as the light turns green | ✗ | – |

## What it means
Training taught the model the **shapes** of apps very quickly (60% compile). It still fills in **details** badly: wrong numbers, missing options, nonsense logic. “Compiles” is not “correct”, so app correctness needs behaviour tests, not just compile checks.

**Next steps:** more varied numbers and wording in the training data; a bigger model (1.5B, needs more memory); behaviour checks in the lab; compare against Claude's score in the AI Accuracy Lab.
