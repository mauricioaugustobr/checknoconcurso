import re
LOW = {'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'a', 'o', 'na', 'no', 'com'}
KEEP = {'TI', 'PM', 'PC', 'TJ', 'TRT', 'TRF', 'SEFAZ', 'II', 'III', 'IV', 'CFO', 'CFP', 'NS', 'NM'}
def cargo(t):
    t = re.sub(r'^\s*CARGO\s+\d+\s*[:\-–]\s*', '', t or '', flags=re.I).strip(' -–')
    t = re.sub(r'\s*[–-]\s*(PROVA )?TIPO\s*\d.*$', '', t, flags=re.I)
    t = re.sub(r'\s*[–-]\s*C[óo]digo\s*:.*$', '', t, flags=re.I)
    t = re.sub(r"\s*Tipo\s*\d.*$", "", t, flags=re.I)
    words = []
    for i, w in enumerate(t.split()):
        lw = w.lower()
        if w.upper() in KEEP: words.append(w.upper())
        elif i and lw in LOW: words.append(lw)
        else: words.append(lw[:1].upper() + lw[1:])
    return ' '.join(words)
def titulo(c, ano, cargo_nome):
    return f"{c['sigla']} {ano or ''} · {cargo(cargo_nome)}".replace('  ', ' ').strip()
