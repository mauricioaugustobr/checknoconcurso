# Etapa 3/4 — Extração e parser genérico de cadernos (múltipla escolha A–E/A–D e Certo/Errado).
# Lê o PDF em ordem de leitura (coluna esquerda, depois direita), remove cabeçalhos/rodapés repetidos,
# separa questões, alternativas e textos de apoio ("Leia o texto para responder às questões de 5 a 8").
import re, sys, json, collections
import pymupdf

QHEAD = [
    re.compile(r'^\s*quest[aã]o\s+(\d{1,3})\s*$', re.I),          # Cebraspe/AOCP: "Questão 12"
    re.compile(r'^\s*(\d{1,3})\s*$'),                              # FGV: número sozinho na linha
    re.compile(r'^\s*(\d{1,3})\s*[\.\)–-]\s+(?=\S)'),              # Vunesp/FCC: "12. Texto" / "12) Texto"
    re.compile(r'^\s*quest[aã]o\s+(\d{1,3})\s*[\.:–-]?\s*(?=\S)', re.I),
]

ALT_STYLES = {
    'paren': re.compile(r'^\s*\(([A-E])\)\s*(.*)$'),
    'close': re.compile(r'^\s*([A-Ea-e])\)\s*(.*)$'),
    'dot':   re.compile(r'^\s*([A-E])[\.\-–]\s+(.*)$'),
    'bare':  re.compile(r'^\s*([A-E])\s{1,4}(\S.*)$'),
    'solo':  re.compile(r'^\s*([A-E])\s*$()'),
    'dotsolo': re.compile(r'^\s*([A-Ea-e])[\.\)]\s*$()'),
}
SUPPORT = re.compile(r'(leia|considere|observe|analise|texto|tira|charge|gr[aá]fico|tabela|figura|poema|cart[uo]m|fragmento|trecho)[^\n]{0,90}?quest(?:[oõ]es|[aã]o)\s+(?:de\s+)?(?:n[ºo°.]*\s*)?(\d{1,3})\s*(?:a|e|até|-|–)\s*(\d{1,3})', re.I)
LEAD_SUPPORT = re.compile(r'^\s*(leia o texto|leia a tira|leia o poema|leia a charge|leia o trecho|considere o texto|texto para as quest|texto\s+[A-Z0-9][\w-]{0,10}\s*$)', re.I)
LABEL = re.compile(r'^\s*texto\s+([A-Z0-9][\w-]{0,10})\s*$', re.I)
SUBJ = re.compile(r'^\s*(?:[-–]{1,2}\s*)?((?:l[ií]ngua|conhecimentos|no[cç][oõ]es|matem[aá]tica|racioc[ií]nio|inform[aá]tica|direito|legisla[cç][aã]o|atualidades|hist[oó]ria|geografia|ci[eê]ncias|portugu[eê]s|ingl[eê]s|espanhol|f[ií]sica|qu[ií]mica|biologia|estat[ií]stica|contabilidade|administra[cç][aã]o|economia|[eé]tica|realidade|sa[uú]de|educa[cç][aã]o|pedagog|psicologia|arquivologia|auditoria|criminologia|enfermagem|tecnologia|conhecimento)[^.?!:;()]{0,70}?)\s*(?:[-–]{1,2})?\s*$', re.I)
CE_HEAD = re.compile(r'^\s*(\d{1,3})\s+(?=[A-ZÀ-Ú“"(])')
CE_INTRO = re.compile(r'^\s*(texto|text|julgue|leia|observe|analise|considerando|com base|a respeito|acerca|no que se refere|no que concerne|em rela[cç][aã]o|tendo em vista|quanto|considere|a partir|no tocante|relativamente|com rela[cç][aã]o|figura|tabela|gr[aá]fico)\b', re.I)
JUNK_TAIL = re.compile(r'^\s*(r\s?a\s?s\s?c\s?u\s?n\s?h\s?o|espa[cç]o livre|área livre|folha de rascunho|reda[cç][aã]o\s*$)', re.I)
JUNK_INLINE = re.compile(r'\s+(R a s c u n h o|RASCUNHO|ESPAÇO LIVRE)\b.*$')
CITE_TAIL = re.compile(r'\s*(Internet:\s*<[^>]*>|Dispon[ií]vel em:\s*\S+(\s*Acesso em[^.]*)?)\.?\s*(\(com adapta[cç][oõ]es\))?\.?\s*$', re.I)


def page_lines(doc):
    """Retorna [(pagina, linha, na_margem)] em ordem de leitura por colunas."""
    out = []
    for pno, page in enumerate(doc, start=1):
        w, h = page.rect.width, page.rect.height
        blocks = [b for b in page.get_text('blocks') if b[6] == 0 and b[4].strip()]
        mid = w / 2
        right = [b for b in blocks if b[0] >= mid - w * 0.04]
        left = [b for b in blocks if b[2] <= mid + w * 0.04 and b not in right]
        full = [b for b in blocks if b not in left and b not in right]
        colh = lambda col: sum(x[3] - x[1] for x in col)
        if left and right and colh(left) > h * 0.12 and colh(right) > h * 0.12:
            seps = sorted(full, key=lambda b: b[1])
            seq, y0 = [], -1
            for sp in seps + [None]:
                y1 = sp[1] if sp else 1e9
                band = lambda col: sorted([b for b in col if y0 <= b[1] < y1], key=lambda b: b[1])
                seq += band(left) + band(right)
                if sp:
                    seq.append(sp); y0 = sp[1]
        else:
            seq = sorted(blocks, key=lambda b: (round(b[1]), b[0]))
        for b in seq:
            edge = 'top' if b[3] < h * 0.09 else ('bot' if b[1] > h * 0.92 else '')
            for ln in b[4].split('\n'):
                if ln.strip():
                    out.append((pno, ln.rstrip(), edge))
    return out


def strip_repeated(lines, npages):
    cnt = collections.Counter(re.sub(r'\d+', '#', l.strip()) for _, l, e in lines if e)
    thr = max(3, npages // 2)
    junk = {k for k, v in cnt.items() if v >= thr and len(k) < 120
            and not any(q.match(k.replace('#', '1')) for q in QHEAD) and not re.match(r'^\(?[A-E]\)?$', k.strip())}
    # número de página: só o número sozinho na margem que acompanha a página (n = página + deslocamento fixo)
    offs = collections.Counter(int(l) - p for p, l, e in lines if e == 'bot' and re.fullmatch(r'\s*\d{1,3}\s*', l))
    off = offs.most_common(1)[0][0] if offs and offs.most_common(1)[0][1] >= max(3, npages // 3) else None
    out = []
    for p, l, e in lines:
        k = re.sub(r'\d+', '#', l.strip())
        bare = re.fullmatch(r'\s*\d{1,3}\s*', l)
        if e and bare:
            if e == 'bot' and off is not None and int(l) - p == off:
                continue
        elif e and (k in junk or re.fullmatch(r'[#\s/|-]*(p[aá]gina|p[aá]g\.?)[#\s/|-]*(de\s*#)?', k, re.I)):
            continue
        out.append((p, l))
    return out


ANY_ALT = re.compile(r'^\s*(?:\(([A-Ea-e])\)|([A-Ea-e])\)|([A-E])[\.\-–]|([A-E])\s{1,4}\S|([A-E])\s*$)')


def _alt_score(lines, hits):
    """Quantos trechos de questão têm as alternativas A..D em ordem."""
    good = 0
    for k, (i, _) in enumerate(hits):
        end = hits[k + 1][0] if k + 1 < len(hits) else min(len(lines), i + 80)
        exp = 'A'
        for _, l in lines[i + 1:end]:
            m = ANY_ALT.match(l)
            if m:
                g = next(x for x in m.groups() if x).upper()
                if g == exp:
                    exp = chr(ord(exp) + 1)
                elif g == 'A':
                    exp = 'B'
            if exp > 'D':
                good += 1
                break
    return good


def find_questions(lines, expected=None):
    """Escolhe o padrão de cabeçalho e o ponto de partida cuja sequência N, N+1, ... tem alternativas."""
    best, best_key = None, None
    for pat in QHEAD:
        nums = []
        for i, (p, l) in enumerate(lines):
            m = pat.match(l)
            if m:
                nums.append((i, int(m.group(1))))
        starts = [k for k, (_, n) in enumerate(nums) if n in (0, 1)][:15] or list(range(min(3, len(nums))))
        for k0 in starts:
            hits, nxt = [], nums[k0][1]
            for i, n in nums[k0:]:
                if n == nxt:
                    hits.append((i, nxt)); nxt += 1
            key = (_alt_score(lines, hits), len(hits))
            if best_key is None or key > best_key:
                best, best_key = (pat, hits), key
    return best


def dehyphen(t):
    t = re.sub(r'(\w)-\n(\w)', r'\1\2', t)
    t = re.sub(r'\s*\n\s*', ' ', t)
    return re.sub(r'\s{2,}', ' ', t).strip()


def pick_style(lines):
    """Estilo de alternativa do caderno: o que forma mais sequências completas A..D/A..E."""
    best, bc = 'paren', -1
    for name, rx in ALT_STYLES.items():
        seqs, exp = 0, 0
        for _, l in lines:
            m = rx.match(l)
            if not m:
                continue
            g = m.group(1).upper()
            if g == 'ABCDE'[exp]:
                exp += 1
                if exp == 4:
                    seqs += 1
                if exp == 5:
                    exp = 0
            elif g == 'A':
                exp = 1
            else:
                exp = 0
        if seqs > bc:
            best, bc = name, seqs
    return best


def split_alts(body_lines, style='paren', letters='ABCDE'):
    rx = ALT_STYLES[style]
    stem, alts, cur = [], [], None
    expect = 0
    # o "A" que abre as alternativas é o último "A" seguido de B, C e D em ordem
    # (evita confundir enunciados como "A palavra ..." com a alternativa A)
    marks = [(j, rx.match(l).group(1).upper()) for j, l in enumerate(body_lines) if rx.match(l)]
    start = 0
    for k in range(len(marks) - 1, -1, -1):
        if marks[k][1] == 'A':
            seq = [x for _, x in marks[k:]]
            exp = 0
            for x in seq:
                if exp < 4 and x == 'ABCD'[exp]: exp += 1
            if exp == 4:
                start = marks[k][0]; break
    for idx, l in enumerate(body_lines):
        m = rx.match(l) if idx >= start else None
        if m and expect < len(letters) and m.group(1).upper() == letters[expect]:
            cur = [m.group(1).upper(), [m.group(2)] if m.group(2) else []]
            alts.append(cur); expect += 1
        elif cur is not None:
            cur[1].append(l)
        else:
            stem.append(l)
    tail = []
    if alts:
        # o texto de apoio das próximas questões e o "rascunho" costumam vir colados na última alternativa
        last = alts[-1][1]
        for j, l in enumerate(last):
            if j > 0 and (SUPPORT.search(l) or JUNK_TAIL.match(l) or LEAD_SUPPORT.match(l)):
                tail = last[j:]; alts[-1][1] = last[:j]; break
        # última alternativa longa demais em relação às outras: corta no fim da primeira frase
        others = [len(' '.join(t)) for _, t in alts[:-1]] or [0]
        last = alts[-1][1]
        if len(' '.join(last)) > max(500, 4 * max(others)):
            acc = []
            for l in last:
                acc.append(l)
                if re.search(r'[.;?!)]\s*$', l):
                    break
            if len(acc) < len(last):
                tail = last[len(acc):] + tail; alts[-1][1] = acc
    return dehyphen('\n'.join(stem)), [{'letter': a, 'text': CITE_TAIL.sub('', JUNK_INLINE.sub('', dehyphen('\n'.join(t))))} for a, t in alts], tail


def tag_subjects(lines):
    """Remove linhas de título de disciplina e devolve [(pag, linha, disciplina_corrente)]."""
    out, cur = [], ''
    CONNECT = {'e', 'de', 'do', 'da', 'dos', 'das', 'com', 'para', 'a', 'o', 'os', 'as', 'em', 'no', 'na', 'que', 'por', 'ou', 'como', 'ao', 'aos', 'à', 'às', 'pelo', 'pela', 'se', 'um', 'uma', 'sobre', 'entre'}
    for idx, (p, l) in enumerate(lines):
        m = SUBJ.match(l)
        words = l.strip().split()
        nxt = lines[idx + 1][1].strip() if idx + 1 < len(lines) else ''
        ok = (m and len(l.strip()) <= 70 and len(words) <= 8 and not re.search(r'\d{2,}', l)
              and l.strip()[:1].isupper() and words[-1].lower().strip(',') not in CONNECT
              and not (nxt[:1].islower()) and ',' not in l
              and (not l.strip().isupper() or l.strip().startswith('--') or len(words) <= 4))
        if ok:
            cur = re.sub(r'\s+', ' ', m.group(1)).strip(' -–').rstrip(',')
            cur = cur.title().replace(" De ", " de ").replace(" Da ", " da ").replace(" Do ", " do ").replace(" E ", " e ").replace(" Dos ", " dos ").replace(" Das ", " das ") if cur.isupper() else cur[:1].upper() + cur[1:]
            continue
        out.append((p, l, cur))
    return out


def parse_ce(path):
    """Cadernos Certo/Errado (Cebraspe): itens numerados; o bloco que começa com 'Texto'/'Julgue' vira apoio."""
    doc = pymupdf.open(path)
    tagged = tag_subjects(strip_repeated(page_lines(doc), len(doc)))
    lines = [(p, l) for p, l, _ in tagged]
    nums = []
    for i, (p, l) in enumerate(lines):
        m = CE_HEAD.match(l)
        if m:
            nums.append((i, int(m.group(1))))
        elif re.fullmatch(r'\s*\d{1,3}\s*', l) and i + 1 < len(lines) and lines[i + 1][1].strip()[:1].isupper():
            nums.append((i, int(l)))  # número do item sozinho na linha
    best = []
    for s0 in sorted({n for _, n in nums})[:12]:
        hits, nxt = [], s0
        for i, n in nums:
            if n == nxt: hits.append((i, n)); nxt += 1
        if len(hits) > len(best): best = hits
    qs, support, uses = [], '', 0
    first_i = best[0][0] if best else 0
    pre = [l for _, l in lines[:first_i]]
    for j, l in enumerate(pre):
        if CE_INTRO.match(l): support = dehyphen('\n'.join(pre[j:])); break
    for k, (i, n) in enumerate(best):
        end = best[k + 1][0] if k + 1 < len(best) else len(lines)
        first = lines[i][1]
        mh = CE_HEAD.match(first)
        body = ([first[mh.end():]] if mh else []) + [l for _, l in lines[i + 1:end]]
        stmt, rest = body, []
        for j, l in enumerate(body[1:], start=1):
            if (CE_INTRO.match(l) and body[j - 1].rstrip().endswith(('.', ':', '?', ')', '”'))) or JUNK_TAIL.match(l):
                stmt, rest = body[:j], body[j:]; break
        q = {'number': n, 'page': lines[i][0], 'subject': tagged[i][2], 'stem': dehyphen('\n'.join(stmt)),
             'alternatives': [{'letter': 'C', 'text': 'Certo'}, {'letter': 'E', 'text': 'Errado'}]}
        if qs and q['subject'] != qs[-1]['subject']:
            support, uses = '', 0  # mudou a disciplina: o texto anterior não vale mais
        if support and uses < 15 and len(support) > 120:
            q['support'] = support; uses += 1
        qs.append(q)
        if rest and not JUNK_TAIL.match(rest[0]):
            support, uses = dehyphen('\n'.join(rest)), 0
    return qs, lines


def parse_pdf(path, expected=None):
    doc = pymupdf.open(path)
    tagged = tag_subjects(strip_repeated(page_lines(doc), len(doc)))
    lines = [(p, l) for p, l, _ in tagged]
    pat, hits = find_questions(lines, expected)
    # textos rotulados ("Texto 1A1-I", "Texto II"): guardados para as questões que os citam
    heads = {i for i, _ in hits}
    labels, i = {}, 0
    while i < len(lines):
        m = LABEL.match(lines[i][1])
        if m:
            j = i + 1
            while j < len(lines) and j not in heads and not LABEL.match(lines[j][1]):
                j += 1
            labels[m.group(1).upper()] = dehyphen('\n'.join(l for _, l in lines[i + 1:j]))
            i = j
        else:
            i += 1
    style = pick_style(lines)
    qs, pending = [], []  # pending: (de, até, texto de apoio)
    for k, (i, n) in enumerate(hits):
        end = hits[k + 1][0] if k + 1 < len(hits) else len(lines)
        first = lines[i][1]
        m = pat.match(first)
        rest = first[m.end():] if m and m.end() < len(first) else ''
        body = ([rest] if rest.strip() else []) + [l for _, l in lines[i + 1:end]]
        just = None
        for j, l in enumerate(body):
            if '||JUSTIFICATIVAS||' in l:
                just = body[j + 1:]; body = body[:j]; break
        stem, alts, tail = split_alts(body, style)
        if len(alts) < 2:
            stem, alts, tail = dehyphen('\n'.join(body)), [], []
        q = {'number': n, 'page': lines[i][0], 'subject': tagged[i][2], 'stem': stem, 'alternatives': alts}
        for ref in re.findall(r'texto\s+([A-Z0-9][\w-]{0,10})', stem, re.I):
            if ref.upper() in labels:
                q['support'] = labels[ref.upper()]; break
        for a, b, txt in pending:
            if a <= n <= b:
                q['support'] = txt
        if tail:
            t = '\n'.join(tail)
            sm = SUPPORT.search(t)
            if sm:
                a, b = int(sm.group(2)), int(sm.group(3))
                after = t[sm.end():]
                if '\n' in after and after.strip()[:1] not in ('.', ':'):
                    after = after.split('\n', 1)[1]
                else:
                    after = after.lstrip('.: ')
                if b >= n + 1:
                    pending.append((a, b, dehyphen(after)))
        if just:
            jt = '\n'.join(just)
            q['justificativas'] = {mm.group(1): dehyphen(mm.group(2)).rstrip('*/ ').strip()
                                   for mm in re.finditer(r'\|\|([A-E])\|\|(.*?)(?=\|\|[A-E]\|\||$)', jt, re.S)}
        qs.append(q)
    return qs, lines


if __name__ == '__main__':
    qs, lines = parse_pdf(sys.argv[1])
    print(len(qs), 'questoes', pick_style(lines))
    for q in qs[:3] + qs[-2:]:
        print(json.dumps(q, ensure_ascii=False)[:600])
