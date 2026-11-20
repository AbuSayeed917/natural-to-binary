# Training kit

- `check.js` reads Structured English programs (JSON lines on stdin) and reports which compile. It's used to score any model.
- `train_small_model.ipynb` is a Google Colab notebook that fine-tunes a small open model (Qwen2.5-1.5B-Instruct, using LoRA) on pairs from the lab, then compares compile rates before and after on apps it never saw. It hasn't been run on a GPU yet.
