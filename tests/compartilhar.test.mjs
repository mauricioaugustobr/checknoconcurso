// Item 7: compartilhar concurso (Opção 1 da Designer UI/UX) — mensagem, imagens e botões.
import assert from 'node:assert/strict';
import fs from 'node:fs';

delete process.env.DATABASE_URL;
const d = await import('../public/js/compartilhar-dados.js');
const { botaoCompartilharHTML } = await import('../public/js/compartilhar.js');
const { getLiveCatalog } = await import('../lib/catalog-overrides.js');
const { renderConcursoPage, renderEstadoPage } = await import('../lib/pages.js');
const { renderImagemConcurso } = await import('../lib/og-rota.js');
const { GET: page } = await import('../api/page.js');
const { ehPrivado } = await import('../tools/build-public.mjs');

const catalog = await getLiveCatalog();
const pmsp = catalog.find((c) => c.id === 'pm-sp-soldado-2026');
assert.ok(pmsp, 'PM-SP no catálogo');

// Mensagem exata da Designer (sem prazo de inscrição)
const msg = d.mensagemCompartilhar(pmsp);
assert.equal(msg, [
  'Concurso PM-SP: Aluno-Soldado PM de 2ª Classe (Quadro de Praças)',
  '📍 Estado de São Paulo (SP)',
  '👥 2.000 vagas',
  '💰 Salário até R$ 5.482,51',
  'Veja datas, edital e situação atualizados:',
  'https://checknoconcurso.com.br/concurso/pm-sp-soldado-2026?utm_source=compartilhar'
].join('\n'));
assert.ok(!/inscriç/i.test(msg), 'mensagem sem prazo de inscrição');

// Regras de campos
assert.equal(d.vagasMensagem({ vagas: 0, vagasCR: 80 }), 'Cadastro reserva');
assert.equal(d.vagasMensagem({ vagas: 1 }), '1 vaga');
assert.equal(d.vagasMensagem({ vagas: 2000, vagasCR: 10 }), '2.000 vagas + cadastro reserva');
assert.deepEqual(d.vagasImagem({ vagas: 2000, vagasCR: 10 }), { texto: '2.000 + CR', pequeno: false });
assert.equal(d.provaTexto({}), 'A definir');
assert.equal(d.localConcurso({ uf: 'Nacional' }), 'Todo o Brasil');
assert.equal(d.localConcurso({ uf: 'DF', esfera: 'Estadual' }), 'Distrito Federal (DF)');
assert.equal(d.localConcurso({ uf: 'BA', esfera: 'Estadual' }), 'Estado da Bahia (BA)');
assert.equal(d.localConcurso({ uf: 'RJ', esfera: 'Estadual' }), 'Estado do Rio de Janeiro (RJ)');
for (const [orgao, cidade] of [
  ['Prefeitura de Formosa do Rio Preto (BA)', 'Formosa do Rio Preto'],
  ['Prefeitura do Rio de Janeiro (RJ)', 'Rio de Janeiro'],
  ['Câmara Municipal de Rio Branco (AC)', 'Rio Branco'],
  ['SMS - Secretaria Municipal de Saúde de São Miguel do Guamá (PA)', 'São Miguel do Guamá'],
  ['Prefeitura de Campo Limpo de Goiás e Câmara de Campo Limpo de Goiás (GO)', 'Campo Limpo de Goiás'],
  ['Prefeitura de Belo Horizonte (PBH — Saúde, Educação e Guarda)', 'Belo Horizonte'],
  ['FIMES - Fundação Integrada Municipal de Ensino Superior (GO)', null]
]) assert.equal(d.cidadeDoOrgao(orgao), cidade, orgao);
// Todo concurso municipal ganha cidade que aparece no nome do órgão (ou cai no estado)
for (const c of catalog.filter((x) => x.esfera === 'Municipal')) {
  const l = d.localConcurso(c);
  assert.ok(/^Estado /.test(l) || c.orgao.includes(l.replace(/ \([A-Z]{2}\)$/, '')), `${c.id}: ${l}`);
}

// Endereço da imagem muda quando o concurso é atualizado (WhatsApp guarda a prévia)
assert.match(d.imagemPrevia(pmsp), /\/og\/concurso\/pm-sp-soldado-2026\.png\?v=\d{4}-\d{2}-\d{2}$/);
assert.match(d.imagemStories(pmsp), /\/og\/stories\/pm-sp-soldado-2026\.png\?v=/);
assert.equal(d.dadosBotao(pmsp).arquivo, 'checknoconcurso-pm-sp-stories.png');

// Botões: textos e acessibilidade
const pag = botaoCompartilharHTML(d.dadosBotao(pmsp), { variante: 'pagina' });
for (const t of ['aria-label="Compartilhar o concurso PM-SP"', 'Compartilhar PM-SP', 'Assim o link aparece no WhatsApp e no Telegram.', '>WhatsApp<', 'Copiar link', 'Imagem para Stories', '✓ Link copiado', 'Não deu para copiar. Selecione o link abaixo e copie.', 'https://wa.me/?text=']) {
  assert.ok(pag.includes(t), t);
}
assert.ok(botaoCompartilharHTML(d.dadosBotao(pmsp), { variante: 'celular' }).includes('data-cmp="nativo"'));
assert.ok(botaoCompartilharHTML(d.dadosBotao(pmsp), { variante: 'ficha' }).includes('icon-btn'));
assert.ok(!botaoCompartilharHTML(d.dadosBotao({ ...pmsp, sigla: '"><script>x</script>' })).includes('<script>x'), 'texto escapado');

// Imagens: PNG nas medidas certas; concurso inexistente cai na imagem genérica
const tamanho = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];
let res = await renderImagemConcurso(new Request('http://localhost/og/concurso/pm-sp-soldado-2026.png'), 'concurso', 'pm-sp-soldado-2026.png');
assert.equal(res.status, 200);
assert.equal(res.headers.get('Content-Type'), 'image/png');
let buf = Buffer.from(await res.arrayBuffer());
assert.deepEqual(tamanho(buf), [1200, 630]);
assert.ok(buf.length < 300 * 1024, 'prévia abaixo de 300 KB');
res = await renderImagemConcurso(new Request('http://localhost/og/stories/pm-sp-soldado-2026.png'), 'stories', 'pm-sp-soldado-2026.png');
assert.deepEqual(tamanho(Buffer.from(await res.arrayBuffer())), [1080, 1920]);
res = await renderImagemConcurso(new Request('http://localhost/og/concurso/x.png'), 'concurso', '../../etc/passwd');
assert.equal(res.status, 302);
res = await page(new Request('http://localhost/api/page?tipo=og&formato=concurso&arquivo=nao-existe-2099.png'));
assert.equal(res.status, 302);
// Concurso sem data de prova e só com cadastro reserva também gera
const semProva = catalog.find((c) => !c.dataProva && !c.vagas);
if (semProva) {
  res = await renderImagemConcurso(new Request('http://localhost/'), 'concurso', `${semProva.id}.png`);
  assert.equal(res.status, 200);
}

// Página do concurso: prévia própria, botões e script; outras páginas sem o botão
const html = await (await renderConcursoPage(new Request('http://localhost/concurso/pm-sp-soldado-2026'), 'pm-sp-soldado-2026')).text();
assert.ok(html.includes('<meta property="og:image" content="http://localhost/og/concurso/pm-sp-soldado-2026.png?v='));
assert.ok(html.includes('<meta property="og:image:width" content="1200" />'));
assert.ok(html.includes('cmp-pagina') && html.includes('cmp-celular'));
assert.ok(html.includes('/js/compartilhar.js?v=1') && html.includes('/css/compartilhar.css?v=1'));
assert.ok(html.includes('Assinar e acompanhar PM-SP'), 'botões do item 6 continuam');
const est = await (await renderEstadoPage(new Request('http://localhost/concursos/sp'), 'sp')).text();
assert.ok(!est.includes('data-compartilhar') && est.includes('/og-image.png'));

// Ficha dentro do site, arquivos públicos e rota da Vercel
const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
assert.ok(index.includes('id="detailShareSlot"') && index.includes('/css/compartilhar.css?v=1'));
for (const f of ['js/compartilhar.js', 'js/compartilhar-dados.js', 'css/compartilhar.css']) assert.equal(ehPrivado(f), false, f);
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.ok(vercel.rewrites.some((r) => r.source === '/og/:formato/:arquivo'));
assert.match(vercel.functions['api/page.js'].includeFiles, /lib\/og-fonts/);
assert.ok(fs.readdirSync(new URL('../api/', import.meta.url)).filter((f) => f.endsWith('.js')).length <= 12, 'limite de funções do Hobby');

console.log('compartilhar: ok');
