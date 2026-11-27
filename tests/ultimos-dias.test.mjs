// Item 8: "Últimos dias para se inscrever" + selos de prazo (Opção 1 da Designer UI/UX).
import assert from 'node:assert/strict';
import fs from 'node:fs';

delete process.env.DATABASE_URL;
process.env.CNC_ACESSO_LIVRE = '0'; // trava ligada, como na Vercel
const u = await import('../public/js/ultimos-dias.js');
const { ultimosDiasPayload, camposPublicos } = await import('../lib/ultimos-dias.js');
const { GET } = await import('../api/concursos.js');
const { renderEstadoPage, renderConcursoPage } = await import('../lib/pages.js');
const { ehPrivado } = await import('../tools/build-public.mjs');

// Selos pela data (horário de Brasília), não pela situação gravada
const H = '2026-11-27';
const c = (fim, extra = {}) => ({ id: 'x', sigla: 'X', status: 'Inscrições Abertas', inscricaoInicio: '2026-11-01', inscricaoFim: fim, ...extra });
assert.deepEqual(u.seloPrazo(c('2026-11-27'), H), { tipo: 'hoje', texto: 'Termina hoje' });
assert.equal(u.seloPrazo(c('2026-11-28'), H).tipo, 'tres');
assert.equal(u.seloPrazo(c('2026-11-30'), H).tipo, 'tres');
assert.deepEqual(u.seloPrazo(c('2026-12-01'), H), { tipo: 'ate', texto: 'Até 01/12' });
assert.equal(u.seloPrazo(c('2026-12-04'), H).tipo, 'ate');
assert.equal(u.seloPrazo(c('2026-12-05'), H), null, '8 dias ou mais: sem selo');
assert.equal(u.seloPrazo(c('2026-11-26'), H), null, 'prazo vencido: sem selo');
assert.equal(u.seloPrazo(c('2026-11-28', { status: 'Encerrado' }), H), null);
assert.equal(u.seloPrazo(c('2026-12-28', { inscricaoInicio: H }), H).tipo, 'abriu');
assert.equal(u.seloPrazo(c('2026-11-29', { inscricaoInicio: H }), H).tipo, 'tres', 'abriu hoje e fecha em 7 dias: vale o prazo');
assert.equal(u.seloPrazo(c('2026-11-29', { inscricaoInicio: '2026-11-28' }), H), null, 'inscrições ainda não abriram');
assert.equal(u.seloPrazo(c(new Date('2026-11-27T00:00:00Z')), H).tipo, 'hoje', 'aceita Date do banco');
assert.equal(u.somarDias(H, 7), '2026-12-04');
assert.equal(u.somarDias('2026-12-28', 7), '2027-01-04');

// Seleção: até 6 no Brasil (mais relevantes, em ordem de prazo) e abas do estado com mais para o com menos
const lista = [
  c('2026-11-30', { id: 'a', sigla: 'A', uf: 'SC', importancia: 10 }),
  c('2026-11-27', { id: 'b', sigla: 'B', uf: 'MT', importancia: 90 }),
  c('2026-12-02', { id: 'd', sigla: 'D', uf: 'MT', importancia: 50 })
];
assert.deepEqual(u.fechamEm7(lista, H).map((x) => x.id), ['b', 'a', 'd']);
assert.deepEqual(u.selecaoBrasil(u.fechamEm7(lista, H), 2).map((x) => x.id), ['b', 'd']);
assert.deepEqual(u.abasPorEstado(u.fechamEm7(lista, H)).map((a) => `${a.uf}${a.total}`), ['MT2', 'SC1']);

// HTML do bloco da inicial: abas acessíveis, links e textos aprovados
let html = u.blocoHTML({ lista: u.fechamEm7(lista, H), hoje: H });
for (const t of ['Atualizado hoje, 27/11', 'Últimos dias para se inscrever', '3 concursos fecham as inscrições até 04/12.', 'role="tablist"', 'role="tab"', 'aria-selected="true"',
  'Todo o Brasil <span class="ud-num">3</span>', 'data-ultimos-todos', 'Ver os 2 de MT →', 'href="/concursos/mt#ultimos-dias"', 'Termina hoje', 'Últimos 3 dias', 'Ver concurso →',
  'Prazos tirados do edital de cada concurso. Antes de se inscrever, confira na página do concurso.']) assert.ok(html.includes(t), t);
assert.equal(u.blocoHTML({ lista: [], hoje: H }), '', 'sem prazos: a inicial não mostra o bloco');
assert.ok(!u.blocoHTML({ lista: [c('2026-11-28', { sigla: '"><script>x</script>', uf: 'SP' })], hoje: H }).includes('<script>x'), 'texto escapado');

// Estado vazio
html = u.blocoHTML({ lista: [], hoje: H, estado: { uf: 'SP', nome: 'São Paulo', de: 'de São Paulo' }, totalBrasil: 50, vazio: { proximo: { data: '2026-12-10', siglas: ['TJ-SP', 'Birigui-SP'] }, abriuHoje: { id: 'sete', sigla: 'Sete Barras' } } });
for (const t of ['Nenhum concurso de São Paulo fecha as inscrições nos próximos 7 dias.', 'O próximo prazo em SP é 10/12 (TJ-SP e Birigui-SP).', 'Abriu hoje', 'Sete Barras →', 'Ver os 50 do Brasil']) assert.ok(html.includes(t), t);

// API pública (sem plano), só campos públicos, cache compartilhado
const res = await GET(new Request('http://localhost/api/concursos?tipo=ultimos'));
assert.equal(res.status, 200);
assert.match(res.headers.get('Cache-Control'), /public/);
const dados = await res.json();
assert.match(dados.hoje, /^\d{4}-\d{2}-\d{2}$/);
for (const it of dados.itens) {
  assert.deepEqual(Object.keys(it).sort(), Object.keys(camposPublicos({})).sort());
  assert.ok(u.seloPrazo(it, dados.hoje) && u.seloPrazo(it, dados.hoje).tipo !== 'abriu', `${it.id} fecha em até 7 dias`);
}
assert.equal((await GET(new Request('http://localhost/api/concursos'))).status, 401, 'catálogo completo continua exigindo plano');
assert.deepEqual((await ultimosDiasPayload(dados.hoje)).itens.map((x) => x.id), dados.itens.map((x) => x.id));

// Páginas de estado: bloco (ou faixa vazia) + selos nos cartões; página do concurso com selo
const sc = await (await renderEstadoPage(new Request('http://localhost/concursos/sc'), 'sc')).text();
assert.ok(sc.includes('id="ultimos-dias"') && sc.includes('/css/ultimos-dias.css?v=1') && sc.includes('Todos os concursos em SC'));
const ufComPrazo = dados.itens.find((x) => x.uf && x.uf !== 'Nacional')?.uf;
if (ufComPrazo) {
  const pg = await (await renderEstadoPage(new Request('http://localhost/'), ufComPrazo.toLowerCase())).text();
  assert.ok(pg.includes(`Últimos dias para se inscrever em ${ufComPrazo}`));
  assert.ok(pg.includes('class="ud-selo'));
}
const primeiro = dados.itens[0];
if (primeiro) {
  const pc = await (await renderConcursoPage(new Request('http://localhost/'), primeiro.id)).text();
  assert.ok(pc.includes('class="ud-selo'), 'selo na página do concurso');
}

// Inicial, ficha, arquivos públicos e rota da Vercel
const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
assert.ok(index.includes('id="ultimosDiasInicial"') && index.includes('/js/ultimos-dias.js?v=1') && index.includes('/css/ultimos-dias.css?v=1'));
assert.ok(fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8').includes('seloHTML(seloPrazo(c))'));
for (const f of ['js/ultimos-dias.js', 'css/ultimos-dias.css']) assert.equal(ehPrivado(f), false, f);
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.ok(vercel.rewrites.some((r) => r.source === '/api/ultimos-dias' && r.destination === '/api/concursos?tipo=ultimos'));
assert.ok(fs.readdirSync(new URL('../api/', import.meta.url)).filter((f) => f.endsWith('.js')).length <= 12, 'limite de funções do Hobby');

console.log('ultimos-dias: ok');
