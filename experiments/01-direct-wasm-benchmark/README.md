# nl2bin — English → machine code, no source layer

An experiment to answer: **can a language model skip code and write executable binary directly from English?**

Each task is a plain-English spec plus test cases. A model writes a raw WebAssembly module as hex bytes, without WAT, source code or an assembler. The bytes run in a sandbox and are scored against the tests. The same specs also go through English → Python as a baseline.

## Files
- `tasks.json` — 10 English specs with test cases
- `candidates/claude-direct-wasm.json` — raw bytes Claude wrote by hand, first attempt
- `candidates/claude-python.json` — Python baseline
- `run.mjs` — scorer (validates the module, runs the tests, writes `results.json`)
- `generate.mjs` — gets fresh candidates from the Anthropic API

## Run
```bash
node run.mjs                                   # score the included candidates
ANTHROPIC_API_KEY=sk-... node generate.mjs claude-sonnet-5-5 s1
node run.mjs candidates/s1-wasm.json candidates/s1-python.json
```
Needs Node 18+ and Python 3. No dependencies.

## First result
Hand-emitted bytes: **10/10 tasks correct on the first attempt**, 38–91 bytes per module. Python: 10/10.

## Why this doesn't prove much yet
- The tasks are small, integer-only functions, which is the easiest case for raw bytes.
- It's one sample per task, and the same model wrote both the tests and the answers.
- Bytes can't be reviewed. When one fails, you can't read why.

## Next steps
1. Harder tasks: memory, strings, arrays, loops inside loops.
2. Five or more samples per task through `generate.mjs`, reporting pass@1 and pass@5.
3. Track tokens and cost per correct program (hex costs about 2 tokens per byte).
4. Write held-out tests separately from the model that generates the answers.
5. Stretch: a small instruction set designed around how models tokenise text (idea #2).
