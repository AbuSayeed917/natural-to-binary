# The AI Accuracy Lab

Measures how accurately an AI turns plain English into working binary, instead of guessing.

**Safety:** every AI-written binary runs in a sealed chamber:
1. **Sealed box:** WebAssembly can only touch its own memory, and the lab gives it no outside access. A binary that asks for any is refused.
2. **Separate room:** each binary runs in its own Web Worker, away from the page.
3. **Time limit:** stopped after 1 second (3 for apps), so endless loops can't hang anything.
4. **Memory limit:** binaries asking for more than 1 MB are refused before they start.

All four walls are tested: an endless loop, a 4 GB memory request, a module asking for outside access, and random garbage were each stopped, and the page kept running.

**Experiment A:** 30 plain-English number jobs. Claude writes either the **whole binary** or only the **function body**, with rules adding the packaging. Each result is graded against reference answers the AI never sees, with up to 2 repair rounds.

**Experiment B:** 20 everyday app requests → Structured English → compiler → binary, then the lab presses every button, sends keys and runs the timer for 3 seconds.

**Training set builder:** collects everyday-request → Structured-English pairs that compile, for training a small model (see `../kit`).

The lab uses Claude through claude.ai, so open it there. The live copy is `docs/lab.html`.
