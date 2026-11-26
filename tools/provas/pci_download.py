# Baixa os PDFs liberados (caderno + gabarito) listados em pci-urls/*.json para pci/<slug>/.
import json, os, glob, time, urllib.request
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BASE)
for f in sorted(glob.glob('pci-urls/*.json')):
    for slug, paths in json.load(open(f, encoding='utf-8')).items():
        if not isinstance(paths, list): continue
        d = os.path.join('pci', slug); os.makedirs(d, exist_ok=True)
        for p in paths:
            out = os.path.join(d, p.split('/')[-1])
            if os.path.exists(out) and os.path.getsize(out) > 1000: continue
            req = urllib.request.Request('https://www.pciconcursos.com.br/provas/' + p, headers={'User-Agent': 'Mozilla/5.0'})
            try:
                data = urllib.request.urlopen(req, timeout=60).read()
                if data[:4] == b'%PDF': open(out, 'wb').write(data)
                else: print('NAO-PDF', slug, p)
            except Exception as e:
                print('ERRO', slug, p, e)
            time.sleep(0.8)
for f in sorted(glob.glob('alt-urls/*.txt')):
    for line in open(f, encoding='utf-8'):
        parts = line.split()
        if len(parts) < 3: continue
        slug, paths = parts[0], parts[1:]
        d = os.path.join('pci', slug); os.makedirs(d, exist_ok=True)
        for p in paths:
            out = os.path.join(d, p.split('/')[-1])
            if os.path.exists(out) and os.path.getsize(out) > 1000: continue
            req = urllib.request.Request('https://www.pciconcursos.com.br/provas/' + p, headers={'User-Agent': 'Mozilla/5.0'})
            try:
                data = urllib.request.urlopen(req, timeout=60).read()
                if data[:4] == b'%PDF': open(out, 'wb').write(data)
                else: print('NAO-PDF', slug, p)
            except Exception as e:
                print('ERRO', slug, p, e)
            time.sleep(0.8)
print('fim', len(glob.glob('pci/*/*.pdf')), 'pdfs')
