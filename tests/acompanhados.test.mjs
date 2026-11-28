// Item 12: "Acompanhar este concurso" e "Meus concursos" na conta.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSessionToken } from '../lib/auth.js';

delete process.env.DATABASE_URL;
const SECRET = 'k'.repeat(48);
process.env.SESSION_SECRET = SECRET;
process.env.ADMIN_EMAILS = 'chefe@exemplo.com';
process.env.CNC_ACESSO_LIVRE = '0';

const { GET, POST } = await import('../api/concursos.js');
const { calcularMudancas, proximoPasso, montarItens } = await import('../lib/acompanhados.js');
const { mudancasHTML, proximoPassoHTML, linkOficialHTML, esquecerListaDaConta } = await import('../public/js/acompanhados.js');
const { CONCURSOS } = await import('../public/js/data/concursos.js');
const { applyOverrides } = await import('../lib/catalog-overrides.js');

const BASE = 'https://checknoconcurso.com.br';
const cookie = (email) => 'cnc_session=' + createSessionToken({ sub: '1', email, name: 'Teste', provider: 'google' }, SECRET);
const req = (email, init = {}) => new Request(BASE + '/api/concursos?tipo=acompanhados', { ...init, headers: { ...(email ? { cookie: cookie(email) } : {}), ...(init.headers || {}) } });

// 1. Rota: visitante 401, conta sem plano 403, envio de outro site 403, sem banco 503 (nunca finge que salvou)
assert.equal((await GET(req())).status, 401);
assert.equal((await GET(req('aluno@exemplo.com'))).status, 403);
assert.equal((await POST(req('chefe@exemplo.com', { method: 'POST', headers: { origin: 'https://evil.com' }, body: '{}' }))).status, 403);
const semBanco = await GET(req('chefe@exemplo.com'));
assert.equal(semBanco.status, 503);
assert.match(semBanco.headers.get('cache-control'), /private/);
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.ok(vercel.rewrites.some((x) => x.source === '/api/acompanhados' && x.destination.includes('tipo=acompanhados')));

// 2. O que mudou: exemplo real de 27/11 (Montes Belos-GO, 3 mudanças)
const ID = 'prefeitura-de-sao-luis-de-montes-belos-go-2026-ativo';
const base = CONCURSOS.find((c) => c.id === ID);
assert.ok(base, 'concurso do exemplo existe');
const depois = { dataProva: '2027-01-24', inscricaoFim: '2026-12-18', inscricaoInicio: '2026-11-24' };
const atual = applyOverrides(CONCURSOS, [{ concurso_id: ID, data: depois, hidden: false, updated_at: new Date() }]).find((c) => c.id === ID);
const m = calcularMudancas(base, atual, [{ antes: null, depois, em: new Date() }]);
const porCampo = Object.fromEntries(m.map((x) => [x.campo, x]));
assert.equal(m.length, 3);
assert.deepEqual([porCampo.inscricaoFim.antes, porCampo.inscricaoFim.agora], [String(base.inscricaoFim).slice(0, 10), '2026-12-18']);
assert.equal(porCampo.dataProva.agora, '2027-01-24');
// Mudança desfeita depois não aparece; campo fora da lista nunca aparece
assert.deepEqual(calcularMudancas(base, base, [{ antes: null, depois: { inscricaoFim: '2026-12-18' } }, { antes: { inscricaoFim: '2026-12-18' }, depois: {} }]), []);
assert.deepEqual(calcularMudancas(base, { ...base, hidden: true }, [{ antes: null, depois: { hidden: true, codigo: '<script>' } }]), []);
// Situação: SEDUC-SP de "Edital Publicado" para "Inscrições Abertas"
const s = calcularMudancas({ status: 'Edital Publicado' }, { status: 'Inscrições Abertas' }, [{ antes: null, depois: { status: 'Inscrições Abertas' } }]);
assert.deepEqual(s.map((x) => [x.rotulo, x.antes, x.agora]), [['Situação', 'Edital Publicado', 'Inscrições Abertas']]);

// 3. Próximo passo pela data de Brasília
const H = '2026-11-27';
assert.deepEqual(proximoPasso(atual, H), { tipo: 'inscricao', rotulo: 'Inscrições até', data: '2026-12-18' });
assert.equal(proximoPasso({ status: 'Edital Publicado', inscricaoInicio: '2026-12-01', inscricaoFim: '2026-12-20', dataProva: '2027-02-01' }, H).tipo, 'abre');
assert.equal(proximoPasso({ status: 'Encerrado', inscricaoFim: '2026-12-20', dataProva: '2027-02-01' }, H).tipo, 'prova');
assert.equal(proximoPasso({ status: 'Encerrado', inscricaoFim: '2026-10-01', dataProva: '2026-11-01' }, H).tipo, 'resultado');
assert.equal(proximoPasso({ status: 'Previsto / Autorizado' }, H).texto, 'Aguardando o edital');

// 4. Itens sem banco: próximo passo e link oficial (só https), sem mudanças
const itens = await montarItens(null, ['pm-sp-soldado-2026', 'nao-existe'], { catalogo: CONCURSOS, hoje: H });
assert.equal(itens.length, 1);
assert.equal(itens[0].mudancas.length, 0);
assert.ok(itens[0].proximoPasso);
assert.match(itens[0].linkOficial || 'https://', /^https:\/\//);

// 5. Tela: antes riscado com texto, agora em negrito, escapa HTML
const info = { mudancas: m, conferidoEm: '2026-11-27T11:16:00Z', proximoPasso: proximoPasso(atual, H), linkOficial: 'https://www.exemplo.gov.br/edital' };
const html = mudancasHTML(info);
assert.match(html, /O que mudou no edital/);
assert.match(html, /Antes: <s>sem data<\/s>/);
assert.match(html, /Agora: <strong>18\/12\/2026<\/strong>/);
assert.match(html, /Conferido em 27\/11\/2026/);
assert.match(proximoPassoHTML(info), /Inscrições até: <strong>18\/12\/2026<\/strong>/);
assert.match(linkOficialHTML(info), /target="_blank" rel="noopener noreferrer"/);
assert.equal(mudancasHTML({ mudancas: [] }), '');
assert.doesNotMatch(mudancasHTML({ mudancas: [{ campo: 'titulo', rotulo: 'Título', tipo: 'texto', antes: '<b>x</b>', agora: 'y' }] }), /<b>x/);

// 6. Sair da conta: a lista da conta não fica no navegador; lista só local continua
const st = { savedIds: ['a'], alertIds: ['a'], acompanhadosConta: 'x@y.com', savedTouched: true };
esquecerListaDaConta(st);
assert.deepEqual([st.savedIds, st.alertIds, st.acompanhadosConta], [[], [], null]);
const local = { savedIds: ['a'], alertIds: [], acompanhadosConta: null };
esquecerListaDaConta(local);
assert.deepEqual(local.savedIds, ['a']);

// 7. Treino de 5 questões na página da prova
const prova = fs.readFileSync(new URL('../public/js/prova.js', import.meta.url), 'utf8');
assert.match(prova, /get\("treino"\) === "5"/);
const app = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
assert.match(app, /treino=5/);
assert.match(app, /hasCompleto\(\) && PROVAS\[c\.id\]/, 'Treinar 5 questões só para o Completo');

console.log('OK: item 12 — lista na conta protegida, o que mudou, próximo passo, link oficial e treino de 5 questões.');
