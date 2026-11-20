import json, sys, time, re, subprocess, torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
torch.set_num_threads(2)
MODEL = '/home/claude/models/qwen2.5-0.5b-instruct'; SYSTEM = 'Rewrite the request as a Structured English v0.3 program. Reply with the program only.'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'tuned.jsonl'; TRIES = int(sys.argv[2]) if len(sys.argv) > 2 else 1
tok = AutoTokenizer.from_pretrained(MODEL)
model = PeftModel.from_pretrained(AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.float32), 'lora-adapter').eval()
apps = json.load(open('apps.json'))
def sandbox(program):
    p = subprocess.run(['node', 'sandbox.js'], input=json.dumps({'program': program}), capture_output=True, text=True, timeout=20)
    return json.loads(p.stdout.strip().splitlines()[-1])
ok = runs = 0
with open(OUT, 'w') as f:
    for i, req in enumerate(apps):
        t0 = time.time(); msgs = [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': req}]
        for attempt in range(1, TRIES + 1):
            enc = tok.apply_chat_template(msgs, add_generation_prompt=True, return_tensors='pt', return_dict=True)
            with torch.no_grad():
                out = model.generate(**enc, max_new_tokens=520, do_sample=attempt > 1, temperature=0.7, top_p=0.95)
            program = tok.decode(out[0][enc['input_ids'].shape[1]:], skip_special_tokens=True).strip()
            res = sandbox(program) if program else {'compiled': False, 'error': 'empty'}
            if res.get('compiled'): break
        ok += bool(res.get('compiled')); runs += bool(res.get('runs'))
        f.write(json.dumps({'request': req, 'tries': attempt, **res, 'program': program}) + '\n'); f.flush()
        print(f"{i+1:2}/{len(apps)} try {attempt} {'COMPILED' if res.get('compiled') else 'failed  '} {'+RUNS' if res.get('runs') else '     '} {time.time()-t0:4.0f}s  {req[:55]:55} | {str(res.get('error') or '')[:70]}", flush=True)
print(f'\nCOMPILED {ok}/{len(apps)}   RUNS SAFELY {runs}/{len(apps)}', flush=True)
