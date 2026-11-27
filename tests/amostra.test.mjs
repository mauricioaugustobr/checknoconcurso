// Questão de exemplo grátis: idêntica ao acervo oficial, sem chamada de IA, presente nas páginas públicas.
import assert from 'node:assert/strict';
import fs from 'node:fs';

delete process.env.DATABASE_URL;
const { AMOSTRAS, amostraDaArea } = await import('../public/js/data/amostras.js');
const { amostraHTML } = await import('../public/js/amostra-questao.js');
const { carregarProva } = await import('../lib/progresso.js');
const { bancaPadrao } = await import('../lib/materias.js');
const { renderConcursoPage, renderEstadoPage } = await import('../lib/pages.js');
const { ehPrivado } = await import('../tools/build-public.mjs');

const limpa = (s) => String(s).replace(/\s+/g, ' ').trim();
assert.deepEqual(Object.keys(AMOSTRAS), ['policia', 'tribunais', 'administrativa']);
for (const [chave, a] of Object.entries(AMOSTRAS)) {
  const prova = carregarProva(a.concursoId);
  const q = prova.questoes.find((x) => x.number === a.numero);
  assert.ok(q && !q.annulled, `${chave}: questão existe e não foi anulada`);
  assert.equal(a.gabarito, q.answer, `${chave}: gabarito oficial`);
  assert.equal(a.enunciado, limpa(q.stem), `${chave}: enunciado igual ao caderno`);
  assert.deepEqual(a.alternativas.map((x) => [x.letra, x.texto]), q.alternatives.map((x) => [x.letter, limpa(x.text)]), `${chave}: alternativas iguais`);
  assert.equal(a.banca, bancaPadrao(prova.banca));
  assert.equal(a.caderno, prova.fonte.caderno);
  assert.equal(a.explicacao.length, 3, `${chave}: 3 parágrafos`);
  assert.ok(a.explicacao[1].includes(`alternativa ${a.gabarito} está correta`), `${chave}: explicação aponta o gabarito oficial`);
  assert.ok(!q.supportImage && !q.support && !q.needsSource, `${chave}: não depende de texto ou imagem do caderno`);
}
assert.equal(amostraDaArea('Policial'), 'policia');
assert.equal(amostraDaArea('Tribunais'), 'tribunais');
assert.equal(amostraDaArea('Fiscal'), 'administrativa');

// O arquivo de exemplo é público de propósito (as provas completas continuam privadas)
assert.equal(ehPrivado('js/data/amostras.js'), false);
assert.equal(ehPrivado('provas/pm-ro-2026-previsto.json'), true);

// HTML: sem abas na página do concurso, com abas nas outras; texto escapado; chamada final com os preços
let html = amostraHTML({ modo: 'concurso', areaCatalogo: 'Policial' });
assert.ok(html.includes('Treine com uma questão de prova anterior'));
assert.ok(!html.includes('data-amostra-area='));
assert.ok(html.includes(AMOSTRAS.policia.alternativas[0].texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')));
assert.ok(html.includes('href="/?assinar=completo-mensal#planos"'));
html = amostraHTML({ modo: 'inicial', planosNaPagina: true });
assert.ok(html.includes('Resolva 1 questão de prova real antes de assinar'));
assert.equal((html.match(/data-amostra-area=/g) || []).length, 3);
assert.ok(html.includes('data-pick-plan="completo-anual"'));
assert.ok(html.includes('aria-pressed="true"') && html.includes('data-amostra-area="administrativa" aria-pressed="true"'));

// Páginas públicas renderizadas pelo servidor
const req = (p) => new Request('https://checknoconcurso.com.br' + p);
let r = await renderConcursoPage(req('/concurso/pm-ro-2026-previsto'), 'pm-ro-2026-previsto');
let pagina = await r.text();
assert.ok(pagina.includes('data-amostra="concurso"'), 'bloco na página do concurso');
assert.ok(pagina.includes('/css/amostra-questao.css') && pagina.includes('/js/amostra-questao.js'));
assert.ok(pagina.includes(AMOSTRAS.policia.enunciado.slice(0, 40)), 'questão da área do concurso (Polícia)');
r = await renderEstadoPage(req('/concursos/sp'), 'sp');
pagina = await r.text();
assert.ok(pagina.includes('data-amostra="estado"'), 'bloco na página do estado');
// Páginas sem o bloco não carregam o CSS e o JS dele
const { renderBlogIndex } = await import('../lib/pages.js');
pagina = await (await renderBlogIndex(req('/blog'))).text();
assert.ok(!pagina.includes('/js/amostra-questao.js'));

// Página inicial: link no cartão do Completo, vaga do bloco e arquivos
const inicio = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
assert.ok(inicio.includes('data-amostra-ir') && inicio.includes('id="amostraQuestaoSlot"'));
assert.ok(inicio.includes('/js/amostra-questao.js') && inicio.includes('/css/amostra-questao.css'));

console.log('OK: questão de exemplo — 3 questões iguais ao acervo oficial, páginas públicas e inicial com o bloco.');
