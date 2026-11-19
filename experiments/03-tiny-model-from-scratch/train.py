"""Train a tiny transformer from scratch: English characters in, raw bytes out. No code anywhere in its world."""
import json, math, random, sys, time, subprocess, torch, torch.nn as nn
torch.manual_seed(0); random.seed(0)
MINUTES = float(sys.argv[1]) if len(sys.argv) > 1 else 15

data = [json.loads(l) for l in open('data.jsonl')]
train = [d for d in data if d['split'] == 'train']
tests = {s: random.Random(1).sample([d for d in data if d['split'] == s], 300) for s in ('test_new_wording', 'test_new_number')}
tests['train_sample'] = random.Random(2).sample(train, 300)
chars = sorted({c for d in data for c in d['text'].lower()})
STOI = {c: i + 1 for i, c in enumerate(chars)}           # 0 = pad
BOS, EOS, PAD = 256, 257, 258
MAXS, MAXT = 64, 76

def enc_src(t): return [STOI.get(c, 0) for c in t.lower()][:MAXS]
def batch(items):
    S = torch.zeros(len(items), MAXS, dtype=torch.long)
    T = torch.full((len(items), MAXT), PAD, dtype=torch.long)
    for i, d in enumerate(items):
        s = enc_src(d['text']); S[i, :len(s)] = torch.tensor(s)
        t = [BOS] + list(bytes.fromhex(d['hex'])) + [EOS]; T[i, :len(t)] = torch.tensor(t)
    ls = max(1, int((S != 0).sum(1).max())); lt = int((T != PAD).sum(1).max())
    return S[:, :ls], T[:, :lt]

class Model(nn.Module):
    def __init__(s, d=128):
        super().__init__()
        s.se = nn.Embedding(len(chars) + 1, d); s.te = nn.Embedding(259, d)
        s.sp = nn.Embedding(MAXS, d); s.tp = nn.Embedding(MAXT, d)
        s.tf = nn.Transformer(d, 4, 2, 2, 256, 0.1, batch_first=True)
        s.out = nn.Linear(d, 259)
    def encode(s, S):
        return s.tf.encoder(s.se(S) + s.sp.weight[:S.size(1)], src_key_padding_mask=(S == 0))
    def decode(s, mem, S, T):
        L = T.size(1)
        h = s.tf.decoder(s.te(T) + s.tp.weight[:L], mem, tgt_mask=nn.Transformer.generate_square_subsequent_mask(L),
                         memory_key_padding_mask=(S == 0), tgt_is_causal=True)
        return s.out(h)

@torch.no_grad()
def generate(m, texts):
    m.eval()
    S = torch.zeros(len(texts), MAXS, dtype=torch.long)
    for i, t in enumerate(texts): s = enc_src(t); S[i, :len(s)] = torch.tensor(s)
    mem = m.encode(S); T = torch.full((len(texts), 1), BOS)
    for _ in range(MAXT - 1):
        nxt = m.decode(mem, S, T)[:, -1].argmax(-1, keepdim=True); T = torch.cat([T, nxt], 1)
        if ((T == EOS).any(1)).all(): break
    m.train()
    outs = []
    for row in T[:, 1:].tolist():
        b = []
        for x in row:
            if x >= 256: break
            b.append(x)
        outs.append(bytes(b).hex())
    return outs

def run_check(items, hexes):
    with open('/tmp/pred.jsonl', 'w') as f:
        for it, h in zip(items, hexes): f.write(json.dumps({'hex': h, 'tests': it['tests']}) + '\n')
    subprocess.run(['node', 'check.mjs', '/tmp/pred.jsonl', '/tmp/pred_ok.json'], check=True)
    return json.load(open('/tmp/pred_ok.json'))

def evaluate(m, final=False):
    res = {}
    for name, items in tests.items():
        hexes = generate(m, [d['text'] for d in items])
        ok = run_check(items, hexes)
        res[name] = sum(ok) / len(ok)
        if final:
            res[name + '_by_family'] = {}
            for it, o in zip(items, ok): res[name + '_by_family'].setdefault(it['family'], []).append(o)
    return res

if __name__ == '__main__':
    torch.set_num_threads(2)
    m = Model(); print('parameters:', sum(p.numel() for p in m.parameters()))
    opt = torch.optim.AdamW(m.parameters(), lr=8e-4, weight_decay=0.01)
    lossf = nn.CrossEntropyLoss(ignore_index=PAD, label_smoothing=0.05)
    start, step, log = time.time(), 0, []
    while time.time() - start < MINUTES * 60:
        random.shuffle(train)
        for i in range(0, len(train), 128):
            S, T = batch(train[i:i + 128])
            lr = 8e-4 * min(1, (step + 1) / 300)
            for g in opt.param_groups: g['lr'] = lr
            logits = m.decode(m.encode(S), S, T[:, :-1])
            loss = lossf(logits.reshape(-1, 259), T[:, 1:].reshape(-1))
            opt.zero_grad(); loss.backward(); nn.utils.clip_grad_norm_(m.parameters(), 1.0); opt.step(); step += 1
            if step % 250 == 0:
                r = evaluate(m); r.update(step=step, loss=round(loss.item(), 4), minutes=round((time.time() - start) / 60, 1))
                log.append(r); print(json.dumps(r), flush=True)
            if time.time() - start > MINUTES * 60: break
    torch.save({'model': m.state_dict(), 'chars': chars}, 'model.pt')
    final = evaluate(m, final=True)
    json.dump({'final': final, 'log': log, 'steps': step}, open('results.json', 'w'), indent=1)
    print('FINAL', json.dumps({k: v for k, v in final.items() if not k.endswith('family')}))
