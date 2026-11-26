# Etapa 5/6 — Monta a prova no formato do site e valida. Sem LLM.
# Entrada: job JSON {concursoId, titulo, ano, banca, orgao, cargo, dataProva, cadernos:[pdf], gabaritos:[pdf],
#                    versao (opcional), fonte:{caderno, gabarito, paginaOficial, nota}}
# Saída: staged/<concursoId>.json (se aprovada) e reports/<concursoId>.json (sempre).
import json, os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(__file__))
import extract as E, gabarito as G, clean as CL
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = re.compile(r'\b(no texto|do texto|o texto|texto [0-9IVX]|the text|the author|o autor|a autora|fragmento|trecho|excerto|passage)\b', re.I)
FIG = re.compile(r'\b(figura|imagem|gr[aá]fico|tabela|tira|charge|quadrinho|ilustra[cç][aã]o|mapa|cartum|infogr[aá]fico)\b', re.I)


def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s or '') if unicodedata.category(c) != 'Mn').upper()


def caderno_version(pdf):
    import pymupdf
    doc = pymupdf.open(pdf)
    t = norm(' '.join(doc[i].get_text() for i in range(min(2, len(doc)))))
    m = re.search(r'\b(VERSAO|TIPO|PROVA TIPO|CADERNO)\s*[:\-]?\s*(\d{1,2}|[A-D])\b', t)
    return (m.group(1), m.group(2)) if m else None


def pick_key(gab, pdf, forced=None):
    keys = list(gab)
    if forced:
        ks = [k for k in keys if norm(k) == norm(forced)]
        return (ks[0], 'forcada') if ks else (None, 'versao forcada nao encontrada')
    if len(keys) == 1:
        return keys[0], 'unica'
    v = caderno_version(pdf)
    if v:
        ks = [k for k in keys if re.search(r'\b' + re.escape(v[1]) + r'\b', norm(k))]
        if len(ks) == 1:
            return ks[0], f'capa {v[0]} {v[1]}'
    return None, 'varias versoes no gabarito e a capa do caderno nao indica qual: ' + ', '.join(keys)


def build(job):
    rep = {'concursoId': job['concursoId'], 'problemas': [], 'avisos': []}
    gabs = {}
    for g in job['gabaritos']:
        for k, v in G.parse(g).items():
            gabs.setdefault(k, {}).update(v)
    if not gabs:
        rep['problemas'].append('gabarito ilegivel'); return None, rep
    questoes = []
    pares = job.get('pares') or [[pdf, None] for pdf in job['cadernos']]
    offset, seen_max = 0, 0
    for pdf, gpdf in pares:
        if gpdf:  # gabarito próprio deste caderno (Cebraspe publica um por caderno)
            gabs = {}
            for k, v in G.parse(gpdf).items():
                gabs.setdefault(k, {}).update(v)
            if not gabs:
                rep['problemas'].append(f'gabarito ilegivel: {os.path.basename(gpdf)}'); return None, rep
        key, why = pick_key(gabs, pdf, job.get('versao'))
        if not key:
            rep['problemas'].append(why); return None, rep
        rep['avisos'].append(f'versao do gabarito: {key} ({why})')
        gab = gabs[key]
        letters = set(gab.values()) - {'X'}
        ce = letters <= {'C', 'E'} and len(gab) >= 20
        qs, _ = (E.parse_ce(pdf) if ce else E.parse_pdf(pdf))
        sem = [q['number'] for q in qs if q['number'] not in gab]
        if len(sem) > 3:
            rep['problemas'].append(f'{len(sem)} questoes do caderno sem resposta no gabarito ({os.path.basename(pdf)}): {sem[:8]}')
        # cadernos com numeração própria (1..N em cada um): renumera em sequência
        nums_here = [q['number'] for q in qs if q['number'] in gab]
        falta = sorted(set(gab) - set(nums_here))
        if falta and gpdf:
            rep['problemas'].append(f'{len(falta)} questoes do gabarito sem enunciado ({os.path.basename(pdf)}): {falta[:10]}')
        if len(set(nums_here)) != len(nums_here):
            rep['problemas'].append(f'numeros repetidos em {os.path.basename(pdf)}')
        offset = seen_max if nums_here and min(nums_here) <= seen_max else 0
        for q in qs:
            if q['number'] in gab:
                q['_ce'] = ce
                ans = gab[q['number']]
                q['number'] += offset
                questoes.append((q, ans))
                seen_max = max(seen_max, q['number'])
    if not questoes:
        rep['problemas'].append('nenhuma questao casou com o gabarito'); return None, rep
    nums = [q['number'] for q, _ in questoes]
    missing = []
    if len(pares) == 1 and len(gabs) == 1:
        expected = sorted(next(iter(gabs.values())))
        missing = sorted(set(expected) - set(nums))
    if len(set(nums)) != len(nums):
        rep['problemas'].append('numeros repetidos')
    if nums != sorted(nums):
        rep['problemas'].append('ordem quebrada')
    if missing:
        rep['problemas'].append(f'{len(missing)} questoes do gabarito sem enunciado: {missing[:10]}')
    out, last_subject = [], ''
    for q, ans in questoes:
        alts = q['alternatives']
        if not q['_ce']:
            if len(alts) not in (4, 5):
                rep['problemas'].append(f"q{q['number']}: {len(alts)} alternativas"); continue
            if any(not a['text'] or len(a['text']) > 900 for a in alts):
                rep['problemas'].append(f"q{q['number']}: alternativa vazia ou longa demais")
            if ans != 'X' and ans not in [a['letter'] for a in alts]:
                rep['problemas'].append(f"q{q['number']}: gabarito {ans} fora das alternativas")
        if len(q['stem']) < 8 and not q.get('support'):
            rep['problemas'].append(f"q{q['number']}: enunciado vazio")
        subj = q.get('subject') or last_subject
        last_subject = subj or last_subject
        needs = bool(FIG.search(q['stem']) or REF.search(q['stem'])) and not q.get('support')
        alts = [{'letter': a['letter'], 'text': CL.txt(a['text'])} for a in alts]
        out.append({'number': q['number'], 'page': q['page'], 'subject': subj or 'Conhecimentos Gerais',
                    'stem': CL.txt(q['stem']), 'alternatives': alts, 'answer': ans if ans != 'X' else (alts[0]['letter'] if alts else 'A'),
                    'annulled': ans == 'X', 'support': CL.txt(q.get('support', '')), 'supportImage': '', 'supportImageKind': '',
                    'needsSource': needs})
    # disciplina vazia no começo: herda a primeira encontrada
    first = next((x['subject'] for x in out if x['subject'] != 'Conhecimentos Gerais'), None)
    for x in out:
        if x['subject'] == 'Conhecimentos Gerais' and first: x['subject'] = first
        else: break
    rep['total'] = len(out)
    rep['formato'] = 'certo-errado' if any(q['_ce'] for q, _ in questoes) else 'multipla'
    if len(out) < 10:
        rep['problemas'].append('menos de 10 questoes')
    prova = {k: job[k] for k in ('concursoId', 'titulo', 'ano', 'banca', 'orgao', 'cargo', 'dataProva') if k in job}
    prova['id'] = job.get('id') or f"{job['concursoId']}-{job['ano']}"
    prova['total'] = len(out)
    prova['formato'] = rep['formato']
    prova['fonte'] = job['fonte']
    prova['questoes'] = out
    return prova, rep


if __name__ == '__main__':
    job = json.load(open(sys.argv[1], encoding='utf-8'))
    prova, rep = build(job)
    os.makedirs(os.path.join(BASE, 'reports'), exist_ok=True)
    json.dump(rep, open(os.path.join(BASE, 'reports', job['concursoId'] + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    ok = prova is not None and not rep['problemas']
    if ok:
        json.dump(prova, open(os.path.join(BASE, 'staged', job['concursoId'] + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(('OK ' if ok else 'REVISAR ') + job['concursoId'], rep.get('total'), rep.get('formato'), '|', '; '.join(rep['problemas'][:4]))
