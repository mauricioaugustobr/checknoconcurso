// Item 6: tela de planos adaptada ao concurso de origem (Opção 1 da Designer UI/UX).
import assert from 'node:assert/strict';
import fs from 'node:fs';

delete process.env.DATABASE_URL;
process.env.CNC_ACESSO_LIVRE = '0'; // trava ligada, como na Vercel
const { resumoOrigem, origemValida } = await import('../lib/plano-origem.js');
const { renderConcursoPage, renderEstadoPage } = await import('../lib/pages.js');
const { amostraHTML } = await import('../public/js/amostra-questao.js');
const { getLiveCatalog } = await import('../lib/catalog-overrides.js');
const { lerIndiceProvas } = await import('../lib/acesso.js');
const { GET } = await import('../api/concursos.js');
const { ehPrivado } = await import('../tools/build-public.mjs');

// Id aceito só no formato das URLs /concurso/<id>
assert.equal(origemValida('pm-sp-soldado-2026'), 'pm-sp-soldado-2026');
for (const ruim of ['', 'PM-SP', '../x', 'a b', 'x"><script>', '-x', 'a'.repeat(101), null, 7]) {
  assert.equal(origemValida(ruim), null, `rejeita ${String(ruim).slice(0, 20)}`);
}

// Resumo: só dados públicos; etiquetas só quando valem
const catalog = await getLiveCatalog();
const indice = lerIndiceProvas();
const comProva = catalog.find((c) => indice[c.id]);
const semProva = catalog.find((c) => !indice[c.id]);
assert.ok(comProva && semProva);
const r1 = resumoOrigem(catalog, indice, comProva.id, '2026-11-27');
assert.equal(r1.sigla, comProva.sigla);
assert.equal(r1.temProvaPropria, true);
assert.ok(r1.provasNaArea >= 1);
assert.deepEqual(Object.keys(r1).sort(), ['anoProva', 'area', 'cargo', 'dataProva', 'id', 'inscricaoFim', 'orgao', 'provasNaArea', 'sigla', 'status', 'temProvaPropria'].sort());
assert.ok(!('edital' in r1) && !('cursos' in r1), 'nada de conteúdo pago');
assert.equal(resumoOrigem(catalog, indice, semProva.id).temProvaPropria, false);
assert.equal(resumoOrigem(catalog, indice, 'nao-existe-2099'), null);
const inscVencida = resumoOrigem([{ id: 'x', sigla: 'X', inscricaoFim: '2026-01-10' }], {}, 'x', '2026-11-27');
assert.equal(inscVencida.inscricaoFim, null, 'inscrição já encerrada não vira etiqueta');

// API pública do resumo (sem plano) e erro para id inválido
let res = await GET(new Request(`http://localhost/api/concursos?tipo=resumo&c=${comProva.id}`));
assert.equal(res.status, 200);
assert.equal((await res.json()).id, comProva.id);
assert.match(res.headers.get('Cache-Control'), /public/);
res = await GET(new Request('http://localhost/api/concursos?tipo=resumo&c=..%2Fx'));
assert.equal(res.status, 404);
// O catálogo completo continua exigindo plano
res = await GET(new Request('http://localhost/api/concursos'));
assert.ok([401, 403].includes(res.status));

// Página do concurso: botão novo, botão de hoje como secundário, todos levando o concurso junto
const pg = await (await renderConcursoPage(new Request(`http://localhost/concurso/${comProva.id}`), comProva.id)).text();
assert.ok(pg.includes(`Assinar e acompanhar ${comProva.sigla}`));
assert.ok(pg.includes(`href="/?origem=${comProva.id}#planos"`));
assert.ok(pg.includes(`Acompanhar ${comProva.sigla}<small>a partir de R$ 9,99/mês</small>`));
assert.ok(pg.includes(`Depois do pagamento, você vai direto para a ficha do ${comProva.sigla}.`));
assert.ok(pg.includes(`class="pg-btn pg-btn-secundario" href="/?concurso=${comProva.id}"`));
assert.ok(pg.includes(`class="pg-cta" href="/?origem=${comProva.id}#planos">Assinar</a>`), 'Assinar do topo leva o concurso');
assert.ok(pg.includes(`/?assinar=completo-mensal&amp;origem=${comProva.id}#planos`), 'questão de exemplo leva o concurso');
assert.ok(pg.includes('/css/plano-origem.css'));

// Páginas que não são de concurso continuam iguais
const est = await (await renderEstadoPage(new Request('http://localhost/concursos/sp'), 'sp')).text();
assert.ok(est.includes('class="pg-cta" href="/#planos">Assinar</a>'));
assert.ok(!est.includes('origem='));
assert.ok(amostraHTML({ modo: 'estado' }).includes('href="/?assinar=completo-mensal#planos"'));
assert.ok(!amostraHTML({ modo: 'concurso', origem: 'x"><b' }).includes('origem='), 'origem inválida é ignorada');

// Tela de planos: faixa, linhas e selo existem; a base de hoje continua (cartões, preços, botões)
const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
for (const trecho of ['id="planoOrigem"', 'data-origem-linha="essencial"', 'data-origem-linha="completo"', 'data-origem-selo', 'id="detailPaidNotice"',
  'Assinar Essencial · R$ 9,99/mês', 'Assinar Completo · R$ 23,99/mês', 'Escolha seu plano para usar o Check no Concurso']) {
  assert.ok(index.includes(trecho), trecho);
}

// Textos aprovados no módulo do navegador
const mod = fs.readFileSync(new URL('../public/js/plano-origem.js', import.meta.url), 'utf8');
for (const t of ['Você está vendo', 'Voltar ao ', 'Tirar o ', 'Assinatura ativa. Este é o seu concurso.', 'Check Completo liberado.', 'Check Essencial liberado.',
  'Treinar com prova anterior', 'Fechar aviso', 'Indicado', 'Este concurso ainda não tem prova anterior no Check no Concurso.']) {
  assert.ok(mod.includes(t) || index.includes(t), t);
}
assert.equal(ehPrivado('js/plano-origem.js'), false);
assert.equal(ehPrivado('css/plano-origem.css'), false);

// Pagamento: a origem segue até a Stripe e volta; validada no servidor
const stripe = fs.readFileSync(new URL('../lib/stripe.js', import.meta.url), 'utf8');
assert.ok(stripe.includes('origemValida(body.origem)'));
assert.ok(stripe.includes('&origem=${origem}'));

console.log('plano-origem: ok');
