# Publica as provas aprovadas (listas pci-ok.json / pci-alt-ok.json), com limpeza final.
# Só sobrescreve provas criadas por estas rodadas (as listas); nunca as publicadas antes.
import json, os, re, sys, collections
REPO = sys.argv[1]; pairs = [a.split('=') for a in sys.argv[2:]]  # lista.json=pasta_staged
out = os.path.join(REPO, 'public', 'provas'); idxp = os.path.join(out, 'index.json')
index = json.load(open(idxp, encoding='utf-8'))
mine = set()
for lst, _ in pairs:
    mine |= set(json.load(open(lst)))
LEAK = re.compile(r'\s*(?:A|As)\s+quest(?:ão|ões|ao|oes)\s+\d+[^.]*?(?:refere|referem|baseia|com base)[^.]*$', re.I)
SOFT = re.compile('­' + r'\s*')
REPL = re.compile(r'(\w)\s*' + '�' + r'\s*(\w)')


def clean(t):
    t = SOFT.sub('', t or '')
    for a, b in (('', ''), ('', ''), ('ﬁ', 'fi'), ('ﬂ', 'fl')):
        t = t.replace(a, b)
    t = REPL.sub(r'\1\2', t)
    return re.sub(r'\s{2,}', ' ', t).strip(' _')


added = 0
for lst, folder in pairs:
    for cid in json.load(open(lst)):
        if cid in index and cid not in mine:
            print('ja publicada antes, mantida:', cid); continue
        p = json.load(open(os.path.join(folder, cid + '.json'), encoding='utf-8'))
        cnt = collections.Counter(q['subject'] for q in p['questoes'])
        generic = cnt.most_common(1)[0][1] > 0.8 * len(p['questoes'])
        for q in p['questoes']:
            if generic:
                q['subject'] = 'Prova objetiva'
            q['stem'] = clean(q['stem'])
            q['support'] = clean(q.get('support', ''))
            for a in q['alternatives']:
                a['text'] = clean(LEAK.sub('', a['text']))
        json.dump(p, open(os.path.join(out, cid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        index[cid] = {'titulo': p['titulo'], 'ano': p['ano'], 'banca': p['banca'], 'cargo': p['cargo'], 'total': p['total'], 'formato': p.get('formato', 'multipla')}
        added += 1
json.dump(index, open(idxp, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('gravadas', added, 'total no indice', len(index))
