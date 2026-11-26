// Etapa 7 — Publicação: copia as provas validadas (staged/*.json) e as já existentes em provas.js
// para public/provas/<concursoId>.json e regenera public/provas/index.json (índice leve).
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const REPO = process.argv[2]; const STAGED = path.resolve('staged');
const outDir = path.join(REPO, 'public/provas'); fs.mkdirSync(outDir, { recursive: true });
const { PROVAS } = await import(pathToFileURL(path.join(REPO, 'public/js/data/provas.js')).href);
const all = { ...PROVAS };
for (const f of fs.readdirSync(STAGED).filter((f) => f.endsWith('.json'))) {
  const p = JSON.parse(fs.readFileSync(path.join(STAGED, f), 'utf8'));
  if (PROVAS[p.concursoId]) continue; // nunca sobrescreve as provas já publicadas
  all[p.concursoId] = p;
}
const index = {};
for (const [id, p] of Object.entries(all)) {
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(p));
  index[id] = { titulo: p.titulo, ano: p.ano, banca: p.banca, cargo: p.cargo, total: p.total, formato: p.formato || 'multipla' };
}
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index));
console.log('publicadas', Object.keys(index).length);
