# Etapa 4c — Leitor geral de gabaritos (vários cargos/versões no mesmo PDF). Sem LLM.
# Retorna lista de seções: [{'head': texto do cabeçalho, 'ans': {n: 'A'..'E'|'C'|'X'}}]
# Formatos: "01 B", "1-A", "01=A", "01) A", grades (linha de números/Q1.. + linha de letras),
# "Questões: 01 02 .. Respostas: C D ..", tabelas por versão ("T1 T2 T3 T4" / "Tipo 1 Tipo 2").
import re, subprocess, sys, unicodedata

ANS = r'(?:[A-E]|X|\*|#|NULA|ANULADA|ANULADO|ANUL)'


def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s or '') if unicodedata.category(c) != 'Mn')


def tok(x):
    x = x.strip().upper()
    return x if re.fullmatch(r'[A-E]', x) else 'X'


def text_of(pdf, mode='-layout'):
    r = subprocess.run(['pdftotext', mode, '-enc', 'UTF-8', pdf, '-'], capture_output=True)
    t = norm(r.stdout.decode('utf-8', 'ignore'))
    t = re.sub(r'pcimarkpci\s+\S+\s+\S+', ' ', t)
    t = re.sub(r'www\.pciconcursos\.com\.br', ' ', t)
    return t


PAIR = re.compile(r'(?<![\w/.,])Q?(\d{1,3})\s*(?:[-–.:)=]|\s)\s*(' + ANS + r')(?![\w])', re.I)


def grid_pairs(lines, i):
    """linha i = números (ou Q1 Q2 ..), linha seguinte (não vazia) = letras."""
    nums = re.findall(r'Q?(\d{1,3})', lines[i])
    if len(nums) < 4 or not re.fullmatch(r'[\sQq\d|]+', lines[i].replace('Questoes:', '').replace('QUESTOES:', '').replace('Questao', '')):
        return None
    for j in range(i + 1, min(i + 3, len(lines))):
        toks = re.findall(ANS, lines[j].replace('Respostas:', '').replace('RESPOSTAS:', ''), re.I)
        if len(toks) >= len(nums) - 1 and re.fullmatch(r'[\sA-Ea-e*#XNULADOnulado|:]+', lines[j].replace('Respostas', '').replace('RESPOSTAS', '')):
            ns = [int(n) for n in nums]
            if all(ns[k] == ns[k - 1] + 1 for k in range(1, len(ns))):
                return list(zip(ns, [tok(x) for x in toks[:len(ns)]])), j
    return None


def multi_version(lines):
    """Tabela "N  A B C D" com cabeçalho de versões (T1 T2 T3 T4 / TIPO 1 TIPO 2 ...)."""
    out = {}
    for i, l in enumerate(lines):
        hv = re.findall(r'\b(?:T|TIPO\s*|VERSAO\s*|PROVA\s*)(\d)\b', l.upper())
        if len(hv) >= 2 and len(re.sub(r'\b(?:T|TIPO\s*|VERSAO\s*|PROVA\s*)\d\b|QUESTAO|QUESTOES|GABARITO|N[O°º]', '', l.upper()).strip()) < 6:
            k = len(hv)
            for l2 in lines[i + 1:]:
                m = re.fullmatch(r'\s*(\d{1,3})\s+((?:' + ANS + r'\s+){' + str(k - 1) + r'}' + ANS + r')\s*', l2, re.I)
                if not m:
                    if re.search(r'\d', l2) and out: continue
                    continue
                n = int(m.group(1))
                for v, x in zip(hv, m.group(2).split()):
                    out.setdefault('VERSAO ' + v, {})[n] = tok(x)
    return out


def sections(pdf, modes=('-layout', '-raw')):
    secs = []
    for mode in modes:
        t = text_of(pdf, mode)
        lines = [l for l in t.splitlines() if l.strip()]
        mv = multi_version(lines)
        if mv and max(len(v) for v in mv.values()) >= 10:
            head = ' '.join(lines[:6])
            return [{'head': head + ' ' + k, 'ans': v} for k, v in mv.items()]
        cur, head_buf, last_n, found = None, [], 0, []

        def close():
            if cur and len(cur['ans']) >= 5:
                found.append(cur)

        i = 0
        while i < len(lines):
            l = lines[i]
            g = grid_pairs(lines, i)
            if g:
                pairs, j = g
                i = j + 1
            else:
                pairs = [(int(a), tok(b)) for a, b in PAIR.findall(l)]
                # linha só com texto (cabeçalho de cargo/versão)
                letters = sum(1 for _ in re.finditer(r'\b' + ANS + r'\b', l))
                if not pairs or len(pairs) * 3 < len(l.split()) - letters:
                    if not pairs:
                        head_buf.append(l.strip())
                        head_buf = head_buf[-4:]
                        i += 1
                        continue
                i += 1
            pairs.sort()
            for n, a in pairs:
                if cur is None or n in cur['ans']:
                    close()
                    cur = {'head': ' | '.join(head_buf), 'ans': {}}
                if n not in cur['ans']:
                    cur['ans'][n] = a
                last_n = n
            head_buf = []
        close()
        # limpa seções sem começo em 1 ou com buracos grandes
        good = []
        for s in found:
            ns = sorted(s['ans'])
            if ns[0] <= 2 and ns[-1] - len(ns) <= 2:
                good.append(s)
        if good:
            return good
    return []


def _pick(secs, n_questions, hints, version):
    if not secs:
        return None, 'gabarito ilegivel'
    fit = [s for s in secs if set(range(1, n_questions + 1)) <= set(s['ans']) and max(s['ans']) <= n_questions + 2]
    if not fit:
        return None, f'nenhuma secao do gabarito tem {n_questions} questoes ({", ".join(str(len(s["ans"])) for s in secs[:8])})'
    hw = {w for w in re.findall(r'[A-Z]{4,}', norm(' '.join(hints)).upper())} - {'PROVA', 'CARGO', 'CONCURSO', 'PUBLICO', 'NIVEL', 'GABARITO', 'TIPO', 'VERSAO', 'CADERNO', 'EDITAL', 'MUNICIPAL', 'PREFEITURA', 'ESTADO', 'SUPERIOR', 'MEDIO'}

    def score(s):
        h = norm(s['head']).upper()
        sc = sum(2 for w in hw if w in h)
        if version and re.search(r'(?:TIPO|VERSAO|CADERNO|PROVA)\s*[:\-]?\s*' + re.escape(version) + r'', h):
            sc += 5
        if version and re.search(r'(?:TIPO|VERSAO|CADERNO|PROVA)\s*[:\-]?\s*(?!' + re.escape(version) + r')\w', h):
            sc -= 5
        return sc

    if len(fit) == 1:
        return fit[0]['ans'], 'unica secao compativel'
    ranked = sorted(fit, key=score, reverse=True)
    s0, s1 = score(ranked[0]), score(ranked[1])
    same = all(ranked[0]['ans'].get(k) == ranked[1]['ans'].get(k) for k in range(1, n_questions + 1))
    if s0 > s1 or same:
        return ranked[0]['ans'], f'secao escolhida pelo cargo/versao: {ranked[0]["head"][:80]}'
    return None, f'{len(fit)} secoes compativeis e nenhuma se destaca pelo cargo/versao'


def answers_for(pdf, n_questions, hints, version=None):
    """Lê o gabarito de dois jeitos (layout e ordem do arquivo). Só aceita se os dois concordarem."""
    a1, w1 = _pick(sections(pdf, ('-layout',)), n_questions, hints, version)
    a2, w2 = _pick(sections(pdf, ('-raw',)), n_questions, hints, version)
    if a1 and a2:
        diff = [k for k in range(1, n_questions + 1) if a1.get(k) != a2.get(k)]
        if diff:
            return None, f'as duas leituras do gabarito divergem nas questoes {diff[:8]}'
        return a1, w1 + ' (duas leituras iguais)'
    one = a1 or a2
    if one:
        t = text_of(pdf, '-raw')
        reps = max((len(re.findall(r'(?<![\w/.,])0?%d\s*(?:[-–.:)=]|\s)\s*' % k + ANS + r'(?![\w])', t, re.I)) for k in (1, 2, 3)), default=0)
        if reps <= 1:
            return one, (w1 if a1 else w2) + ' (gabarito de secao unica)'
        return None, 'so uma das leituras achou o gabarito e o arquivo tem varias secoes'
    return None, w1 if 'nenhuma' in w1 or 'secoes' in w1 else w2


if __name__ == '__main__':
    for s in sections(sys.argv[1]):
        v = s['ans']
        print(len(v), '|', s['head'][:90], '|', ''.join(v[n] for n in sorted(v))[:70])
