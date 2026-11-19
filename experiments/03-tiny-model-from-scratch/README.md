# Training a small model from scratch: English → bytes

**Question:** can a small transformer, trained from nothing, learn to turn English requests straight into working WebAssembly?

## Setup

- `gen.py` generates **16,428** English → WebAssembly pairs across 21 kinds of integer task (add a constant, divisible by, max of two, factorial…). Every binary is verified by running it against test cases (`check.mjs`).
- Two test sets are held back from training:
  - **new wording:** one phrasing of every task is never shown in training
  - **new numbers:** the constants 7, 23, 42, 64 and 88 are never shown in training
- `train.py` trains a 750k-parameter encoder-decoder transformer: characters in, bytes out. It ran for 24 minutes on 2 CPUs (2,745 steps).
- Scoring is by **running the generated binary** against its tests, not by text match.

## Results

| Test set | Pass rate |
|---|---|
| Requests it trained on | **100%** |
| New wording | **5%** |
| New numbers | **5%** |

## What it means

The model memorised; it didn't generalise. It wrote perfect bytes for anything it had seen, so writing binary wasn't the problem. Understanding English was: starting from zero, it had no way to know that two different phrasings mean the same thing.

**Next:** start from a small open model that already knows English, and give it the easier job of rewriting into Structured English, leaving the bytes to the rule compiler.

## Reproduce

```bash
pip install torch
python3 gen.py          # writes data.jsonl (~4 MB) and prints split sizes
python3 train.py 24     # minutes of training; writes results.json
```

`check.mjs` needs Node 18+.
