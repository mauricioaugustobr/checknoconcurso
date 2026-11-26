# Orquestra o lote: para cada concurso ativo sem prova, tenta Cebraspe e FGV (na ordem da banca do concurso),
# gera o job, monta e valida. Resultado em batch-log.jsonl. Sem LLM.
import json, os, sys, subprocess, traceback
sys.path.insert(0, os.path.dirname(__file__))
import src_cebraspe as C, src_fgv as F, build as B
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ativos = json.load(open(os.path.join(BASE, 'ativos.json'), encoding='utf-8'))
done = {'pm-sp-soldado-2026', 'tj-sp-2026'}
log = open(os.path.join(BASE, 'batch-log.jsonl'), 'a', encoding='utf-8')
only = set(sys.argv[1:])
for c in ativos:
    cid = c['id']
    if cid in done or (only and cid not in only):
        continue
    order = [('fgv', F.run), ('cebraspe', C.run)] if 'FGV' in (c['banca'] or '') else [('cebraspe', C.run), ('fgv', F.run)]
    res = {'id': cid, 'fonte': None}
    for name, fn in order:
        try:
            job = fn(cid)
        except Exception as e:
            res.setdefault('erros', []).append(f'{name}: {e}'); job = None
        if not job:
            continue
        try:
            prova, rep = B.build(job)
        except Exception as e:
            res.setdefault('erros', []).append(f'build {name}: {e}'); continue
        os.makedirs(os.path.join(BASE, 'reports'), exist_ok=True)
        json.dump(rep, open(os.path.join(BASE, 'reports', cid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        res.update({'fonte': name, 'titulo': job['titulo'], 'total': rep.get('total'), 'problemas': rep['problemas'][:5]})
        if prova and not rep['problemas']:
            json.dump(prova, open(os.path.join(BASE, 'staged', cid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
            res['ok'] = True
            break
    log.write(json.dumps(res, ensure_ascii=False) + '\n'); log.flush()
    print(cid, 'OK' if res.get('ok') else '--', res.get('fonte'), res.get('total'), '; '.join(res.get('problemas') or [])[:120], flush=True)
