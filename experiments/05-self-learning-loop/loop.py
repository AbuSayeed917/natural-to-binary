"""One round of the self-learning loop. No human in it: the judge decides what counts as right.

  python loop.py exam     ADAPTER OUT.jsonl            # the student sits the exam (1 try each, its best guess)
  python loop.py practice ADAPTER OUT.jsonl K           # the student tries every training task K times; the judge marks each try
  python loop.py train    ADAPTER_IN ADAPTER_OUT WINNERS.jsonl OLD_PAIRS.jsonl   # learn from its own winners

The student is Qwen2.5-0.5B-Instruct with the LoRA add-on from experiment 04. Everything runs on CPU here.
"""
import json, sys, os, time, math, random, subprocess, torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get('STUDENT', '/home/claude/models/qwen2.5-0.5b-instruct')
SYSTEM = 'Rewrite the request as a Structured English v0.3 program. Reply with the program only.'
torch.set_num_threads(2); torch.manual_seed(0); random.seed(0)
tok = AutoTokenizer.from_pretrained(MODEL)

def load(adapter, trainable=False):
    base = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.float32)
    return PeftModel.from_pretrained(base, adapter, is_trainable=trainable)

def generate(model, request, k=1):
    enc = tok.apply_chat_template([{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': request}],
                                  add_generation_prompt=True, return_tensors='pt', return_dict=True)
    with torch.no_grad():
        if k == 1: out = model.generate(**enc, max_new_tokens=480, do_sample=False)
        else: out = model.generate(**enc, max_new_tokens=480, do_sample=True, temperature=0.8, top_p=0.95, num_return_sequences=k)
    n = enc['input_ids'].shape[1]
    return [tok.decode(o[n:], skip_special_tokens=True).strip() for o in out]

def judge(jobs):
    p = subprocess.run(['node', os.path.join(HERE, 'judge-cli.js')], input='\n'.join(json.dumps(j) for j in jobs), capture_output=True, text=True, timeout=900)
    return [json.loads(l) for l in p.stdout.splitlines() if l.startswith('{')]

def exam(adapter, out):
    model = load(adapter).eval(); tasks = json.load(open(os.path.join(HERE, 'exam.json'))); passed = compiled = 0
    with open(out, 'w') as f:
        for i, t in enumerate(tasks):
            t0 = time.time(); prog = generate(model, t['request'])[0]
            r = judge([{'id': i, 'program': prog, 'tests': t['tests']}])[0]
            passed += r['passed']; compiled += r['compiled']
            f.write(json.dumps({'request': t['request'], **r, 'program': prog}) + '\n'); f.flush()
            print(f"{i+1:2}/{len(tasks)} {'PASS' if r['passed'] else 'fail'} {r.get('testsPassed', 0)}/{r.get('tests', len(t['tests']))} {time.time()-t0:4.0f}s {t['request'][:50]:50} | {(r['failed'] or '')[:80]}", flush=True)
    print(f'\nEXAM: compiled {compiled}/{len(tasks)}, PASSED ALL TESTS {passed}/{len(tasks)}', flush=True)

def practice(adapter, out, k):
    model = load(adapter).eval(); tasks = json.load(open(os.path.join(HERE, 'train-tasks.json'))); solved = 0
    with open(out, 'w') as f:
        for i, t in enumerate(tasks):
            t0 = time.time(); progs = generate(model, t['request'], k)
            rs = judge([{'id': j, 'program': p, 'tests': t['tests']} for j, p in enumerate(progs)])
            wins = [progs[r['id']] for r in rs if r['passed']]; solved += bool(wins)
            for r in rs: f.write(json.dumps({'task': i, 'request': t['request'], **r, 'program': progs[r['id']]}) + '\n')
            f.flush()
            best = max(rs, key=lambda r: (r['passed'], r.get('testsPassed', 0)))
            print(f"{i+1:2}/{len(tasks)} {len(wins)}/{k} passed {time.time()-t0:4.0f}s {t['request'][:50]:50} | {(best['failed'] or '')[:70]}", flush=True)
    print(f'\nPRACTICE: solved {solved}/{len(tasks)} tasks (at least one of {k} tries passed)', flush=True)

def train(adapter_in, adapter_out, winners_file, old_file, old_n=120, epochs=1):
    from collections import defaultdict
    by_task = defaultdict(list)
    for l in open(winners_file):
        r = json.loads(l)
        if r['passed'] and r['program'] not in by_task[r['request']]: by_task[r['request']].append(r['program'])
    new = [{'everyday': q, 'structured': p} for q, ps in by_task.items() for p in ps[:2]]   # at most 2 winners per task
    old = [json.loads(l) for l in open(old_file)]; random.shuffle(old)
    pairs = new + old[:old_n]                                                             # mix in old examples so it doesn't forget
    print(f'training on {len(new)} new winners from {len(by_task)} tasks + {min(old_n, len(old))} old examples', flush=True)
    model = load(adapter_in, trainable=True)
    model.gradient_checkpointing_enable(); model.enable_input_require_grads(); model.config.use_cache = False
    def encode(p):
        prompt = tok.apply_chat_template([{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': p['everyday']}], tokenize=False, add_generation_prompt=True)
        a = tok(prompt)['input_ids']; b = tok(p['structured'] + tok.eos_token)['input_ids']
        return a + b, [-100] * len(a) + b
    data = [encode(p) for p in pairs]
    opt = torch.optim.AdamW([q for q in model.parameters() if q.requires_grad], lr=1e-4)
    ACC = 4; steps = math.ceil(len(data) / ACC) * epochs; step = micro = 0; t0 = time.time(); model.train()
    while step < steps:
        random.shuffle(data)
        for x, y in data:
            if step >= steps: break
            for g in opt.param_groups: g['lr'] = 1e-4 * min(1, (step + 1) / 5) * max(0.1, 1 - step / steps)
            loss = model(input_ids=torch.tensor([x]), labels=torch.tensor([y])).loss
            (loss / ACC).backward(); micro += 1
            if micro % ACC: continue
            opt.step(); opt.zero_grad(); step += 1
            if step % 5 == 0 or step == 1: print(f'step {step}/{steps}  loss {loss.item():.3f}  {(time.time()-t0)/60:.1f} min', flush=True)
    model.save_pretrained(adapter_out); print('saved', adapter_out, flush=True)

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'exam': exam(sys.argv[2], sys.argv[3])
    elif cmd == 'practice': practice(sys.argv[2], sys.argv[3], int(sys.argv[4]))
    elif cmd == 'train': train(*sys.argv[2:6])
