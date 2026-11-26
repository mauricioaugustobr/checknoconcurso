# Etapa 2 (Cebraspe) — acha a edição anterior do órgão na API pública do Cebraspe, escolhe o cargo
# mais parecido com o do concurso, baixa caderno(s) + gabarito(s) definitivo(s) e grava um job para o build.
import json, os, re, sys, time, unicodedata, urllib.request, difflib
sys.path.insert(0, os.path.dirname(__file__))
import nice
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'https://apis.cebraspe.org.br/cebraspe/eventos'
CDN = 'https://cdn.cebraspe.org.br/concursos/{ev}/arquivos/{f}'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130'}


def norm(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', s or '') if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^A-Z0-9 ]', ' ', s.upper())


def get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    for a in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                d = r.read()
            return d if binary else json.loads(d.decode('utf-8'))
        except Exception:
            time.sleep(2 * (a + 1))
    return None


def events():
    p = os.path.join(BASE, 'src', 'cebraspe-encerrados.json')
    d = json.load(open(p, encoding='utf-8'))
    return [e for g in d for e in g['eventos']]


ALIAS = {'PCDF': ['PC DF', 'PCDF'], 'PMDF': ['PM DF', 'PMDF'], 'CBMDF': ['CBM DF', 'CBMDF'], 'TJDFT': ['TJDFT'],
         'SEEC SEFAZ DF': ['SEEC DF', 'SEFAZ DF', 'SEEC'], 'SES DF': ['SES DF'], 'CAMARA DEPUTADOS': ['CAMARA DOS DEPUTADOS', 'CAMARA']}


def match_events(c, evs):
    sig = norm(c['sigla']).replace('  ', ' ').strip()
    cands = ALIAS.get(sig, [sig])
    uf = (c.get('uf') or '').upper()
    out = []
    for e in evs:
        name = norm(e['eventoNomeAbreviado'] + ' ' + (e['eventoURL'] or '').replace('_', ' '))
        toks = set(name.split())
        for cand in cands:
            ct = cand.split()
            if all(t in toks for t in ct) and (len(ct) > 1 or uf in toks or uf in ('', 'NACIONAL')):
                out.append(e); break
    out.sort(key=lambda e: e.get('eventoAno') or 0, reverse=True)
    return out


def pick_files(ev, cargo_text):
    d = get(f"{API}/{ev['eventoURL']}")
    if not d:
        return None
    files = (d.get('arquivosGabarito') or []) + (d.get('arquivosEdital') or [])
    cargos = {c['idArea'].lstrip('0'): c['area'] for c in (d.get('eventoCargos') or [])}
    desc = lambda f: norm(f['descricaoArquivo'])
    provas = [f for f in files if re.search(r'PROVA OBJETIVA|CADERNO DE PROVA|PROVAS OBJETIVAS', desc(f)) and not re.search(r'DISCURSIVA|ORAL|PRATICA|SEM EFEITO|REDACAO|COMUNICADO|EDITAL|RESULTADO|RECURSO|ALTERA', desc(f)) and not desc(f).strip().startswith('GABARITO') and not f['nomeArquivo'].upper().startswith('GAB')]
    gabs = [f for f in files if re.search(r'GABARITO(S)? (OFICIA(L|IS) )?DEFINITIVO', desc(f)) and not re.search(r'JUSTIFICATIVA|SEM EFEITO', desc(f))]
    if not provas or not gabs:
        return None
    # cargo mais parecido com o do concurso
    best_id, best = None, 0
    ct = norm(cargo_text)
    for cid, area in cargos.items():
        r = difflib.SequenceMatcher(None, ct, norm(area)).ratio()
        if r > best:
            best_id, best = cid, r
    def for_cargo(f):
        t = desc(f)
        nums = re.findall(r'CARGOS? (\d+(?:\s*(?:E|A|,)\s*\d+)*)', t)
        if 'TODOS' in t or not re.search(r'CARGO', t):
            return True
        if best_id is None:
            return re.search(r'\bCARGO 1\b', t) is not None
        ids = set()
        for grp in nums:
            ids |= set(re.findall(r'\d+', grp))
        return best_id in ids
    p_sel = [f for f in provas if for_cargo(f)]
    g_sel = [f for f in gabs if for_cargo(f)]
    if not p_sel or not g_sel:
        return None
    # pareia cada caderno com o gabarito de descrição mais parecida
    pairs = []
    code = lambda n: re.sub(r'(GAB(ARITO)?_?(DEFINITIVO|DEF)?_?|MATRIZ_?|_COM_JUSTIFICATIVA.*|\.PDF$)', '', n.upper())
    for f in p_sel:
        cf = code(f['nomeArquivo'])
        def score(g):
            cg = code(g['nomeArquivo'])
            m = difflib.SequenceMatcher(None, cf, cg).find_longest_match(0, len(cf), 0, len(cg))
            return (m.size / max(len(cf), 1), difflib.SequenceMatcher(None, desc(f), desc(g)).ratio())
        g = max(g_sel, key=score)
        pairs.append((f, g))
    return {'evento': d, 'cargo': cargos.get(best_id, ''), 'pairs': pairs}


def run(cid):
    ativos = {c['id']: c for c in json.load(open(os.path.join(BASE, 'ativos.json'), encoding='utf-8'))}
    c = ativos[cid]
    for ev in match_events(c, events())[:4]:
        sel = pick_files(ev, c.get('cargo') or c.get('titulo'))
        if not sel:
            continue
        evu = ev['eventoURL']
        wd = os.path.join(BASE, 'work', cid); os.makedirs(wd, exist_ok=True)
        cads, gabs, pares = [], [], []
        for f, g in sel['pairs']:
            par = []
            for x, lst in ((f, cads), (g, gabs)):
                path = os.path.join(wd, x['nomeArquivo'])
                if not os.path.exists(path):
                    b = get(CDN.format(ev=evu, f=x['nomeArquivo']), binary=True)
                    if not b or not b[:4] == b'%PDF':
                        break
                    open(path, 'wb').write(b)
                if path not in lst: lst.append(path)
                par.append(path)
            if len(par) == 2: pares.append(par)
        if not cads or not gabs:
            continue
        ano = ev.get('eventoAno') or 0
        job = {'concursoId': cid, 'id': f'{cid}-cebraspe-{evu.lower()}',
               'titulo': nice.titulo(c, ano, sel['cargo'] or 'Prova objetiva'),
               'ano': ano, 'banca': 'Cebraspe', 'orgao': c['orgao'], 'cargo': nice.cargo(sel['cargo']) or c.get('cargo', ''),
               'dataProva': '', 'cadernos': cads, 'gabaritos': gabs, 'pares': pares,
               'fonte': {'caderno': CDN.format(ev=evu, f=sel['pairs'][0][0]['nomeArquivo']),
                         'gabarito': CDN.format(ev=evu, f=sel['pairs'][0][1]['nomeArquivo']),
                         'paginaOficial': f'https://www.cebraspe.org.br/concursos/{evu}',
                         'nota': f"Caderno(s) e gabarito definitivo oficiais do Cebraspe ({ev['eventoNomeAbreviado'].strip()})."}}
        os.makedirs(os.path.join(BASE, 'jobs'), exist_ok=True)
        json.dump(job, open(os.path.join(BASE, 'jobs', cid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        return job
    return None


if __name__ == '__main__':
    for cid in sys.argv[1:]:
        j = run(cid)
        print(cid, '->', (j['titulo'], len(j['cadernos']), 'cadernos') if j else 'sem edicao Cebraspe utilizavel')
