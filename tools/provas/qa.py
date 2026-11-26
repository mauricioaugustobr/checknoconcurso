# QA automático das provas montadas: sinais de texto quebrado ou alternativas trocadas.
import json, glob, os, re, sys
rows = []
for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'staged', '*.json'))):
    p = json.load(open(f, encoding='utf-8'))
    qs = p['questoes']; n = len(qs)
    short = sum(1 for q in qs if len(q['stem']) < 25)
    dupalt = sum(1 for a, b in zip(qs, qs[1:]) if p['formato'] == 'multipla' and [x['text'] for x in a['alternatives']] == [x['text'] for x in b['alternatives']])
    longalt = sum(1 for q in qs for a in q['alternatives'] if len(a['text']) > 450)
    src = sum(1 for q in qs if q['needsSource'])
    sup = sum(1 for q in qs if q['support'])
    anul = sum(1 for q in qs if q['annulled'])
    junk = sum(1 for q in qs if re.search(r'rascunho|espa[cç]o livre|folha de respostas|caderno de quest', q['stem'] + ' '.join(a['text'] for a in q['alternatives']), re.I))
    leak = sum(1 for q in qs for a in q['alternatives'] if re.search(r'com adapta[cç][oõ]es|dispon[ií]vel em|Texto [A-Z0-9][\w-]*\s', a['text']))
    flag = short > n * 0.05 or leak > 0 or junk > 2 or n > 250
    rows.append((p['concursoId'], p['titulo'][:55], n, p['formato'][:5], short, dupalt, longalt, junk, leak, src, sup, anul, 'REVER' if flag else 'ok'))
for r in rows: print(' | '.join(str(x) for x in r))
print('total', len(rows), 'ok', sum(1 for r in rows if r[-1] == 'ok'))
