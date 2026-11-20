import json, sys, time, re, subprocess, torch
from transformers import AutoTokenizer, AutoModelForCausalLM
torch.set_num_threads(2)
MODEL = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/models/qwen2.5-0.5b-instruct'
N = int(sys.argv[2]) if len(sys.argv) > 2 else 10
OUT = sys.argv[3] if len(sys.argv) > 3 else 'baseline.jsonl'
tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.float32)   # trust_remote_code stays off
model.eval()
spec = open(sys.argv[4] if len(sys.argv) > 4 else 'spec.txt').read()
apps = json.load(open('apps.json'))[:N]
def sandbox(program):
    p = subprocess.run(['node', 'sandbox.js'], input=json.dumps({'program': program}), capture_output=True, text=True, timeout=20)
    return json.loads(p.stdout.strip().splitlines()[-1])
with open(OUT, 'w') as f:
    for i, req in enumerate(apps):
        t0 = time.time()
        msgs = [{'role': 'user', 'content': spec + '\n\nREQUEST: ' + req}]
        for attempt in range(1, 4):
            enc = tok.apply_chat_template(msgs, add_generation_prompt=True, return_tensors='pt', return_dict=True); ids = enc['input_ids']
            with torch.no_grad():
                out = model.generate(**enc, max_new_tokens=450, do_sample=False)
            text = tok.decode(out[0][ids.shape[1]:], skip_special_tokens=True)
            m = re.search(r'<se>([\s\S]*?)(</se>|$)', text)
            program = (m.group(1) if m else text)
            program = '\n'.join(l for l in program.splitlines() if not l.strip().startswith('```') and not re.match(r'^\s*(your reply format|<note>|</?se>)', l, re.I)).strip()
            res = sandbox(program) if program else {'compiled': False, 'error': 'empty reply'}
            if res.get('compiled'): break
            msgs += [{'role': 'assistant', 'content': text}, {'role': 'user', 'content': 'The compiler rejected it: ' + str(res.get('error')) + '\nFix that line using only the allowed sentence patterns, and reply with the whole program inside <se></se>.'}]
        res['tries'] = attempt
        rec = {'request': req, 'seconds': round(time.time() - t0), 'prompt_tokens': ids.shape[1], **res, 'program': program[:1500]}
        f.write(json.dumps(rec) + '\n'); f.flush()
        print(f"{i+1}/{len(apps)} try {res['tries']} {'COMPILED' if res.get('compiled') else 'failed  '} {'+RUNS' if res.get('runs') else '     '} {rec['seconds']:4}s  {req[:50]}  | {str(res.get('error',''))[:90]}", flush=True)
