# Limpeza final de textos: códigos internos da banca e justificativas coladas.
import re
CODE = re.compile(r'<[A-Z0-9_]{8,}>\s*')
JUST = re.compile(r'\s*JUSTIFICATIVA\s*[-–:].*$', re.S)
FIM = re.compile(r'<FimJust>', re.I)
def txt(s):
    s = CODE.sub('', s or '')
    s = JUST.sub('', s)
    return FIM.sub('', s).strip()
