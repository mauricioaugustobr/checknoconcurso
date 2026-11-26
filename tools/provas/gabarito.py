# Etapa 4b — Parser genérico de gabaritos. Retorna {versao: {numero: 'A'..'E' | 'C'/'E' | 'X' (anulada)}}.
# Entende: pares "1 - A" (Vunesp/FCC/AOCP), linha de números + linha de letras (Cebraspe/FGV),
# e seções por versão/tipo de caderno ("VERSÃO 1", "TIPO 2", "PROVA TIPO 3", "CADERNO 1").
import re, subprocess, sys, json, unicodedata

ANUL = r'(?:X|N|\*|#|ANULADA|ANULADO|NULA|ANUL)'
TOK = re.compile(r'^(?:[A-E]|' + ANUL + r')$', re.I)

def text_of(pdf):
    return subprocess.run(['pdftotext', '-raw', '-enc', 'UTF-8', pdf, '-'], capture_output=True).stdout.decode('utf-8', 'ignore')

def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def tok(x):
    x = x.strip().upper()
    if re.fullmatch(ANUL, x, re.I): return 'X'
    return x if re.fullmatch(r'[A-E]', x) else None

def parse_section(t):
    ans = {}
    for m in re.finditer(r'(?<![\d/.,])(\d{1,3})\s*[-–.:)]\s*(' + ANUL + r'|[A-E])(?![a-zà-ú])', t, re.I):
        ans.setdefault(int(m.group(1)), tok(m.group(2)))
    lines = [l.strip() for l in t.splitlines() if l.strip()]
    for i in range(len(lines) - 1):
        nums = lines[i].split()
        if len(nums) >= 3 and all(n.isdigit() for n in nums):
            ns = [int(n) for n in nums]
            k = 1  # maior prefixo sequencial (as grades do Cebraspe completam a linha com zeros)
            while k < len(ns) and ns[k] == ns[k - 1] + 1:
                k += 1
            if k >= 3:
                toks = lines[i + 1].split()[:k]
                if len(toks) == k and all(TOK.match(x) for x in toks):
                    for n, x in zip(ns[:k], toks): ans.setdefault(n, tok(x))
    return {k: v for k, v in ans.items() if v}

def parse(pdf):
    t = norm(text_of(pdf))
    # cada seção começa numa linha que cita a versão/tipo do caderno; a linha inteira vira a chave
    # (ex.: "Fiscal Estadual ... - PROVA TIPO 1", "VERSAO 2", "TIPO 3 - AMARELA")
    parts = re.split(r'\n([^\n]{0,160}?\b(?:VERSAO|TIPO|PROVA TIPO|CADERNO|GABARITO)\s*[:\-]?\s*(?:\d{1,2}|[A-D]|BRANCA|AMARELA|AZUL|VERDE|ROSA)\b[^\n]{0,60})(?=\n)', t, flags=re.I)
    out = {}
    if len(parts) > 1:
        head = parse_section(parts[0])
        if len(head) >= 10: out['unica'] = head
        for i in range(1, len(parts) - 1, 2):
            key = re.sub(r'\s+', ' ', parts[i].upper()).strip()
            sec = parse_section(parts[i + 1])
            if len(sec) >= 5:
                out[key] = {**out.get(key, {}), **sec}
    if not out:
        sec = parse_section(t)
        if sec: out['unica'] = sec
    return out

if __name__ == '__main__':
    r = parse(sys.argv[1])
    for k, v in r.items():
        print(k, len(v), ''.join(v[n] for n in sorted(v))[:120])
