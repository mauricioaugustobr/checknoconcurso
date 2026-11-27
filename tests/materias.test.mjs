// Matérias e bancas padronizadas: todo nome cai na lista oficial e os arquivos das provas não mudam.
import assert from 'node:assert/strict';
import { createSessionToken } from '../lib/auth.js';

delete process.env.DATABASE_URL;
const SECRET = 'm'.repeat(48);
process.env.SESSION_SECRET = SECRET;
process.env.ADMIN_EMAILS = 'chefe@exemplo.com';
process.env.CNC_ACESSO_LIVRE = '0';

const M = await import('../lib/materias.js');
const { carregarProva } = await import('../lib/progresso.js');
const { lerIndiceProvas } = await import('../lib/acesso.js');
const { ehPrivado } = await import('../tools/build-public.mjs');
const { GET } = await import('../api/concursos.js');

// Bancas com dois nomes viram um só
assert.equal(M.bancaPadrao('CESPE'), 'Cebraspe');
assert.equal(M.bancaPadrao('VUNESP'), 'Fundação Vunesp');
assert.equal(M.bancaPadrao('FGV'), 'FGV');

// Nomes equivalentes de matéria
assert.equal(M.materiaDoCaderno('Português'), 'Língua Portuguesa');
assert.equal(M.materiaDoCaderno('Noções de Informática'), 'Informática');
assert.equal(M.materiaDoCaderno('Raciocínio Lógico-Matemático'), 'Raciocínio Lógico');
assert.equal(M.materiaDoCaderno('Conhecimentos Gerais'), null, 'nome genérico vai para a classificação');

// Acervo inteiro: toda questão termina com uma matéria da lista oficial (no máximo 0,1% sem classificação)
const bancas = new Set();
let questoes = 0;
let semMateria = 0;
const vistas = new Set();
for (const chave of Object.keys(lerIndiceProvas())) {
  const prova = carregarProva(chave);
  if (vistas.has(prova.id)) continue;
  vistas.add(prova.id);
  bancas.add(M.bancaPadrao(prova.banca));
  for (const q of prova.questoes) {
    questoes++;
    const { materia } = M.materiaDaQuestao(prova.id, q);
    if (!M.MATERIAS.includes(materia)) semMateria++;
  }
}
assert.ok(questoes > 6000);
assert.ok(semMateria <= questoes * 0.001, `questões sem matéria da lista: ${semMateria}`);
assert.ok(!bancas.has('CESPE') && !bancas.has('VUNESP'), 'sem bancas duplicadas');

// A classificação é dado pago: não vai para a pasta pública
assert.ok(ehPrivado('provas/materias-classificadas.json'));

// API: prova com banca e matéria padronizadas; o nome original do caderno continua em `subject`
const cookie = 'cnc_session=' + createSessionToken({ sub: '1', email: 'chefe@exemplo.com', name: 'Chefe', provider: 'google' }, SECRET);
const r = await GET(new Request('https://checknoconcurso.com.br/api/concursos?tipo=prova&c=pm-sp-soldado-2026', { headers: { cookie } }));
assert.equal(r.status, 200);
const prova = await r.json();
assert.equal(prova.banca, 'Fundação Vunesp');
const q36 = prova.questoes.find((q) => q.number === 36);
assert.equal(q36.subject, 'Conhecimentos Gerais', 'arquivo original intacto');
assert.equal(q36.materia, 'História');
assert.ok(prova.questoes.every((q) => typeof q.materia === 'string' && q.materia));
const indice = await (await GET(new Request('https://checknoconcurso.com.br/api/concursos?tipo=provas', { headers: { cookie } }))).json();
assert.ok(Object.values(indice).every((p) => !['CESPE', 'VUNESP'].includes(p.banca)));

console.log(`OK: matérias e bancas padronizadas — ${questoes} questões, ${bancas.size} bancas, ${semMateria} sem matéria da lista.`);
