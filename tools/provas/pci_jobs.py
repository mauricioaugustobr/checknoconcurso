# Gera jobs a partir das provas da PCI (pci/<slug>/) e roda a montagem/validação. Sem LLM.
import json, os, re, glob, sys, unicodedata
sys.path.insert(0, os.path.dirname(__file__))
import build as B, extract as E, gabarito2 as G2
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BASE)
ativos = {c['id']: c for c in json.load(open('ativos.json', encoding='utf-8'))}
best = json.load(open('best-pci.json', encoding='utf-8'))
slug2id = {b['link'].split('/download/')[1]: cid for cid, b in best.items()}
SMALL = {'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'para', 'com'}

def titulo_cargo(s):
    s = s.strip().lower()
    out = []
    for i, w in enumerate(s.split()):
        out.append(w if (w in SMALL and i) else (w.upper() if re.fullmatch(r'[ivx]+|qoc|ctsp|ebtt|ti|pm|bm|qompm', w) else w[:1].upper() + w[1:]))
    return ' '.join(out)

def pdftext(p, n=3):
    import pymupdf
    d = pymupdf.open(p)
    return ' '.join(d[i].get_text() for i in range(min(n, len(d))))

def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s or '') if unicodedata.category(c) != 'Mn').upper()

# casamentos revisados à mão: a prova da PCI é de outro órgão
WRONG_ORG = {'liberato-rs','agua boa-mg','ufmt','pedra branca','chapeco-sc','alegre-es','anchieta-es','cm-paraiso','uerj','cm-riobranco',
             'palmital-pr','sp aguas','cbm-pb','cbm-ma','cbm-pi','gcm-santana','cm-cuiaba','pc-rs','piratini-rs','ses-df'}
def sig(c): return norm(c['sigla']).lower().strip()

def choose_answers(job):
    cad = job['cadernos'][0]
    qs, _ = E.parse_pdf(cad)
    nums = [q['number'] for q in qs]
    if not nums: return None, 'caderno sem questoes reconheciveis'
    n = max(nums)
    v = B.caderno_version(cad)
    hints = [job['cargo'], pdftext(cad, 1)[:600]]
    ans, why = G2.answers_for(job['gabaritos'][0], n, hints, v[1] if v else None)
    if ans is None and len(set(nums)) < n:  # extração perdeu questões: tenta pelo total do gabarito
        secs = G2.sections(job['gabaritos'][0])
        sizes = sorted({max(s['ans']) for s in secs if s['ans']})
        for m in sizes:
            if m >= n:
                ans, why = G2.answers_for(job['gabaritos'][0], m, hints, v[1] if v else None)
                if ans: break
    return ans, why

def process(cid, slug, b, log, staged='staged'):
    d = os.path.join('pci', slug)
    pdfs = glob.glob(os.path.join(d, '*.pdf'))
    gabs = [p for p in pdfs if re.search(r'gab', os.path.basename(p), re.I) and not re.search(r'discursiv', p, re.I)]
    cads = [p for p in pdfs if p not in gabs and not re.search(r'gab', os.path.basename(p), re.I)]
    res = {'id': cid, 'slug': slug}
    if len(gabs) != 1 or len(cads) != 1:
        res['erro'] = f'arquivos: {len(cads)} caderno(s), {len(gabs)} gabarito(s)'
    else:
        gt = norm(pdftext(gabs[0]))
        if 'PRELIMINAR' in norm(os.path.basename(gabs[0])) + gt and 'DEFINITIV' not in gt:
            res['erro'] = 'gabarito preliminar (sem o definitivo)'
        elif len(pdftext(cads[0], 2).strip()) < 200:
            res['erro'] = 'caderno escaneado (sem texto)'
    if 'erro' not in res and sig(ativos[cid]) in WRONG_ORG:
        res['erro'] = 'prova encontrada e de outro orgao'
    if 'erro' not in res:
        c = ativos[cid]
        ano = int(b['ano'])
        cargo = titulo_cargo(b['descricao'])
        banca = b['organizadora'].strip()
        job = {'concursoId': cid, 'id': f'{cid}-pci-{b["id"]}', 'titulo': f'{b["orgao"].strip()} {ano} · {cargo}', 'ano': ano,
               'banca': banca.title() if banca.isupper() and len(banca) > 6 else banca, 'orgao': c['orgao'], 'cargo': cargo, 'dataProva': '',
               'cadernos': [os.path.abspath(cads[0])], 'gabaritos': [os.path.abspath(gabs[0])],
               'fonte': {'caderno': b['link'], 'gabarito': b['link'], 'paginaOficial': b['link'],
                         'nota': f'Caderno e gabarito da {banca} ({ano}), do acervo público da PCI Concursos.'}}
        json.dump(job, open(os.path.join('jobs', cid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        try:
            ans, why = choose_answers(job)
            if ans is None:
                raise ValueError(why)
            B.G.parse = lambda _p, _a=ans: {'selecionada': dict(_a)}
            job['versao'] = None
            prova, rep = B.build(job)
            rep['avisos'].append(why)
            if prova:
                got = {q['number'] for q in prova['questoes']}
                want = set(range(1, max(ans) + 1))
                if got != want:
                    rep['problemas'].append(f'questoes faltando ou sobrando: faltam {sorted(want - got)[:8]}, sobram {sorted(got - want)[:8]}')
                stems = [q['stem'] for q in prova['questoes']]
                if len(set(stems)) < len(stems) * 0.9:
                    rep['problemas'].append('enunciados repetidos')
            res.update({'total': rep.get('total'), 'problemas': rep['problemas'][:4]})
            json.dump(rep, open(os.path.join('reports', cid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            if prova and not rep['problemas']:
                json.dump(prova, open(os.path.join(staged, cid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
                res['ok'] = True
        except Exception as e:
            res['erro'] = str(e)[:200]
    log.write(json.dumps(res, ensure_ascii=False) + '\n'); log.flush()
    print('OK ' if res.get('ok') else '-- ', cid, res.get('total'), res.get('erro') or '; '.join(res.get('problemas') or [])[:150], flush=True)
    return res


if __name__ == '__main__':
    if sys.argv[1:2] == ['--alts']:
        alts = json.load(open('pci-alts.json', encoding='utf-8'))
        os.makedirs('staged-alt', exist_ok=True)
        log = open('pci-alt-log.jsonl', 'a', encoding='utf-8')
        for cid, cands in alts.items():
            for b in cands:
                slug = b['link'].split('/download/')[1]
                if not os.path.isdir(os.path.join('pci', slug)): continue
                if process(cid, slug, b, log, 'staged-alt').get('ok'): break
    else:
        only = set(sys.argv[1:])
        log = open('pci-build-log.jsonl', 'a', encoding='utf-8')
        for d in sorted(glob.glob('pci/*/')):
            slug = os.path.basename(os.path.normpath(d))
            cid = slug2id.get(slug)
            if not cid or (only and cid not in only and slug not in only): continue
            process(cid, slug, best[cid], log)
