# Etapa 1 — Descoberta: para cada concurso ativo, consulta o conector oficial da PCI (pesquisar_provas)
# e guarda os candidatos (órgão, cargo, ano, banca). Sem LLM. Resultado: discover.json
import json, sys, time, re, unicodedata, urllib.request, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ativos = json.load(open(os.path.join(BASE, 'ativos.json'), encoding='utf-8'))
cache_path = os.path.join(BASE, 'discover-cache.json')
cache = json.load(open(cache_path, encoding='utf-8')) if os.path.exists(cache_path) else {}

def norm(s):
    s = unicodedata.normalize('NFD', s or '')
    return ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn').lower()

def call(termo):
    if termo in cache and cache[termo] is not None: return cache[termo]
    body = json.dumps({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"pesquisar_provas","arguments":{"termo":termo}}}).encode()
    req = urllib.request.Request('https://mcp.pciconcursos.com.br/mcp', data=body, headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','User-Agent':'check-provas/1.0'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                d = json.loads(r.read().decode('utf-8'))
            t = d['result']['content'][0]['text']
            try: data = json.loads(t).get('data', [])
            except Exception: data = []
            cache[termo] = data
            time.sleep(0.5)
            return data
        except Exception:
            time.sleep(3 * (attempt + 1))
    cache[termo] = None
    return None

PREFIX = {'pc':'policia civil','pm':'policia militar','cbm':'bombeiro','pcdf':'policia civil df','pmdf':'policia militar df','pf':'policia federal','pp':'policia penal'}

def base_terms(c):
    sig = norm(c['sigla']).replace('/', ' ').strip()
    uf = (c['uf'] or '').lower()
    org = norm(c['orgao'])
    ts = []
    if c['esfera'] == 'Municipal' or 'prefeitura' in org:
        city = re.sub(r'\(.*?\)', '', org)
        city = re.sub(r'^.*?prefeitura( municipal)? (de|do|da|dos|das) ', '', city)
        city = re.sub(r'^(secretaria .*? de |guarda municipal de |camara municipal de )', '', city)
        city = re.sub(r'\b(de|do|da|dos|das)\b', ' ', city)
        city = re.sub(r'[^a-z0-9 ]', ' ', city)
        city = re.sub(r'\s+', ' ', city).strip()
        ts.append(f'prefeitura {city} {uf}'.strip())
        ts.append(city)
    else:
        parts = [p for p in re.split(r'[-\s]+', sig) if p]
        p0 = parts[0] if parts else sig
        rest = ' '.join(parts[1:])
        if 'policia penal' in org: ts.append(f'policia penal {uf}')
        if p0 in PREFIX: ts.append(f'{PREFIX[p0]} {rest or uf}'.strip())
        ts.append(f'{p0} {rest}'.strip() if rest else (f'{p0} {uf}' if uf and uf != 'nacional' else p0))
    return list(dict.fromkeys(t for t in ts if t))

def gather(c):
    res = []
    for q in base_terms(c):
        d = call(q)
        if d: res.extend(d)
        if d and len(d) >= 50:
            for y in (2025, 2024, 2023, 2022, 2021, 2019):
                dy = call(f'{q} {y}')
                if dy: res.extend(dy)
        if res: break
    seen = {}
    for r in res: seen[r['id']] = r
    return list(seen.values())

if __name__ == '__main__':
    out = {}
    for i, c in enumerate(ativos):
        out[c['id']] = {'queries': base_terms(c), 'cands': gather(c)}
        if i % 10 == 0:
            json.dump(cache, open(cache_path, 'w', encoding='utf-8'), ensure_ascii=False)
            print(i, c['id'], len(out[c['id']]['cands']), flush=True)
    json.dump(cache, open(cache_path, 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(out, open(os.path.join(BASE, 'discover.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print('done', sum(1 for v in out.values() if v['cands']), 'with candidates of', len(out))
