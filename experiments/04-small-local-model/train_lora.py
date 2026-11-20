import json, math, random, time, torch, sys
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import LoraConfig, get_peft_model
torch.manual_seed(0); random.seed(0); torch.set_num_threads(2)
MODEL = '/home/claude/models/qwen2.5-0.5b-instruct'; SYSTEM = 'Rewrite the request as a Structured English v0.3 program. Reply with the program only.'
EPOCHS = float(sys.argv[1]) if len(sys.argv) > 1 else 2
tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.float32)
model.gradient_checkpointing_enable(); model.enable_input_require_grads(); model.config.use_cache = False
model = get_peft_model(model, LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, target_modules=['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'], task_type='CAUSAL_LM'))
model.print_trainable_parameters()
pairs = [json.loads(l) for l in open('pairs_train.jsonl')]
def encode(p):
    prompt = tok.apply_chat_template([{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': p['everyday']}], tokenize=False, add_generation_prompt=True)
    a = tok(prompt)['input_ids']; b = tok(p['structured'] + tok.eos_token)['input_ids']
    return a + b, [-100] * len(a) + b          # learn only the program part
data = [encode(p) for p in pairs]
opt = torch.optim.AdamW([q for q in model.parameters() if q.requires_grad], lr=2e-4)
BS = 1; ACC = 4; steps = math.ceil(len(data) / (BS * ACC)) * EPOCHS; micro = 0; step = 0; t0 = time.time(); model.train()
while step < steps:
    random.shuffle(data)
    for i in range(0, len(data), BS):
        if step >= steps: break
        batch = data[i:i + BS]; L = max(len(x) for x, _ in batch)
        ids = torch.tensor([x + [tok.pad_token_id] * (L - len(x)) for x, _ in batch])
        lab = torch.tensor([y + [-100] * (L - len(y)) for _, y in batch])
        att = torch.tensor([[1] * len(x) + [0] * (L - len(x)) for x, _ in batch])
        lr = 2e-4 * min(1, (step + 1) / 20) * max(0.1, 1 - step / steps)
        for g in opt.param_groups: g['lr'] = lr
        loss = model(input_ids=ids, attention_mask=att, labels=lab).loss
        (loss / ACC).backward(); micro += 1
        if micro % ACC: continue
        opt.step(); opt.zero_grad(); step += 1
        if step % 40 == 0: model.save_pretrained('lora-adapter')
        if step % 10 == 0 or step == 1: print(f'step {step}/{int(steps)}  loss {loss.item():.3f}  {(time.time() - t0) / 60:.1f} min', flush=True)
model.save_pretrained('lora-adapter'); print('saved adapter', flush=True)
