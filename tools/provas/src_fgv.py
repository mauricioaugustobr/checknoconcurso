# Etapa 2 (FGV) — acha a edição anterior do órgão no site da FGV Conhecimento, escolhe o caderno Tipo 1
# do cargo mais parecido e a seção do gabarito definitivo desse cargo/tipo, baixa e grava o job.
import json, os, re, sys, time, unicodedata, urllib.request, difflib
sys.path.insert(0, os.path.dirname(__file__))
import gabarito as G, nice
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130'}


def norm(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', s or '') if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', re.sub(r'[^A-Z0-9 ]', ' ', s.upper())).strip()


def get(url):
    req = urllib.request.Request(url, headers=UA)
    for a in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except Exception:
            time.sleep(2 * (a + 1))
    return None


STOP = {'CONCURSO', 'PUBLICO', 'PARA', 'A', 'O', 'DE', 'DO', 'DA', 'DOS', 'DAS', 'E', 'FGV', 'CONHECIMENTO', 'ESTADO', 'GERAL'}


def edition_score(c, slug, title):
    sig = re.sub(r'[^a-z0-9]', '', (c['sigla'] or '').lower())
    s_letters = re.sub(r'[^a-z0-9]', '', slug.split('/')[-1].lower())
    t = norm(title).replace(' FGV CONHECIMENTO', '')
    org = norm(re.sub(r'\(.*?\)', '', c['orgao']))
    a = set(org.split()) - STOP
    b = set(t.split()) - STOP
    jac = len(a & b) / max(1, len(a | b))
    score = jac
    if sig and re.match(re.escape(sig) + (r'(?!\d)' if sig[-1].isdigit() else ''), s_letters):
        score += 0.6
    if norm(title).startswith('PROCESSO SELETIVO'):
        score -= 0.3
    return score


def year_of(slug):
    m = re.search(r'(\d{2,4})(?!.*\d)', slug)
    if not m:
        return 0
    y = int(m.group(1))
    return y + 2000 if y < 100 else y


def pick(c, idx):
    scored = []
    for slug, v in idx.items():
        if not v.get('provas') or not v.get('gabs'):
            continue
        sc = edition_score(c, slug, v.get('title', ''))
        if sc >= 0.95 or (sc < 0.6 and sc >= 0.6):
            scored.append((sc, year_of(slug), slug))
    scored.sort(key=lambda x: (x[0] >= 1.2, x[1]), reverse=True)
    return scored


def run(cid):
    ativos = {c['id']: c for c in json.load(open(os.path.join(BASE, 'ativos.json'), encoding='utf-8'))}
    c = ativos[cid]
    idx = json.load(open(os.path.join(BASE, 'src', 'fgv-index.json'), encoding='utf-8'))
    cargo = norm(c.get('cargo') or c.get('titulo'))
    for sc, yr, slug in pick(c, idx)[:3]:
        v = idx[slug]
        tipo1 = [u for u in v['provas'] if re.search(r'tipo-?1\b', u, re.I)] or v['provas']
        name = lambda u: norm(re.sub(r'(cns|cnm|cnf|cod)?\d{2,}|tipo-?\d+|\.pdf', ' ', u.rsplit('/', 1)[-1].replace('-', ' ').replace('_', ' ')))
        tipo1.sort(key=lambda u: difflib.SequenceMatcher(None, cargo, name(u)).ratio(), reverse=True)
        wd = os.path.join(BASE, 'work', cid); os.makedirs(wd, exist_ok=True)
        for cad_url in tipo1[:3]:
            cad = os.path.join(wd, cad_url.rsplit('/', 1)[-1])
            if not os.path.exists(cad):
                b = get(cad_url)
                if not b or b[:4] != b'%PDF':
                    continue
                open(cad, 'wb').write(b)
            # gabarito definitivo de preferência
            gl = sorted(v['gabs'], key=lambda u: ('defin' not in u.lower(), 'prelim' in u.lower()))
            for gurl in gl[:3]:
                gp = os.path.join(wd, 'gab-' + gurl.rsplit('/', 1)[-1])
                if not os.path.exists(gp):
                    b = get(gurl)
                    if not b or b[:4] != b'%PDF':
                        continue
                    open(gp, 'wb').write(b)
                secs = G.parse(gp)
                keys = [k for k in secs if re.search(r'TIPO\s*1\b|VERSAO\s*1\b', k)] or list(secs)
                if not keys:
                    continue
                n = name(cad_url)
                key = max(keys, key=lambda k: difflib.SequenceMatcher(None, n, norm(re.sub(r'PROVA TIPO.*|TIPO\s*\d.*', '', k))).ratio())
                rk = difflib.SequenceMatcher(None, n, norm(re.sub(r'PROVA TIPO.*|TIPO\s*\d.*', '', key))).ratio()
                if len(keys) > 1 and rk < 0.5:
                    continue
                cargo_nome = re.sub(r'\s*-?\s*PROVA TIPO.*|\s*-?\s*TIPO\s*\d.*', '', key).strip().title() if key != 'unica' else n.title()
                job = {'concursoId': cid, 'id': f'{cid}-fgv-{slug.split("/")[-1]}',
                       'titulo': nice.titulo(c, yr, cargo_nome),
                       'ano': yr, 'banca': 'FGV', 'orgao': c['orgao'], 'cargo': nice.cargo(cargo_nome), 'dataProva': '',
                       'cadernos': [cad], 'gabaritos': [gp], 'versao': key,
                       'fonte': {'caderno': cad_url, 'gabarito': gurl, 'paginaOficial': 'https://conhecimento.fgv.br' + slug,
                                 'nota': 'Caderno Tipo 1 e gabarito definitivo oficiais da FGV.'}}
                json.dump(job, open(os.path.join(BASE, 'jobs', cid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
                return job
    return None


if __name__ == '__main__':
    for cid in sys.argv[1:]:
        try:
            j = run(cid)
        except Exception as e:
            j = None; print(cid, 'erro', e)
        print(cid, '->', j['titulo'] if j else 'sem edicao FGV utilizavel')
