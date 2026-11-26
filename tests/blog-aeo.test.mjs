// Blog pronto para buscadores e IAs: FAQ do post, ligação com estado/concurso, llms.txt e robots.txt.
// Roda com: node --experimental-test-module-mocks --test tests/blog-aeo.test.mjs
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const POST = {
  id: 1, slug: 'concurso-tj-sp-2026', title: 'Concurso TJ-SP 2026: tudo o que você precisa saber',
  excerpt: 'Datas, vagas e salário do TJ-SP.', cover_url: null, seo_title: null, seo_description: null,
  tags: ['SP', 'concurso:tj-sp-2026', 'Tribunais'], status: 'published', author_email: 'x', author_name: 'x',
  published_at: '2026-11-26T12:00:00Z', created_at: '2026-11-26T12:00:00Z', updated_at: '2026-11-28T12:00:00Z',
  content_md: [
    '## Resumo rápido', '', 'O TJ-SP abriu concurso.', '',
    '| Item | Valor |', '|---|---|', '| Banca | Vunesp |', '',
    '## Perguntas frequentes', '',
    '### Quando é a prova do TJ-SP?', 'A prova está marcada para **14/03/2027**.', '',
    '### Qual o salário?', 'Até R$ 9.856,95.', '',
    '## Conclusão', 'Fim.'
  ].join('\n')
};

mock.module('../lib/db.js', {
  exports: {
    listPosts: async () => [POST, { ...POST, id: 2, slug: 'outro-post-sp', title: 'Outro post de SP', tags: ['SP'] }],
    getPostBySlug: async (slug) => (slug === POST.slug ? POST : null),
    getOverrides: async () => [],
    hasDatabase: () => false,
    db: () => null
  }
});

const pages = await import('../lib/pages.js');
const req = (path) => new Request(`https://checknoconcurso.com.br${path}`);

test('FAQ do post vira FAQPage', () => {
  const faq = pages.extractFaq(POST.content_md);
  assert.equal(faq.length, 2);
  assert.equal(faq[0][0], 'Quando é a prova do TJ-SP?');
  assert.match(faq[0][1], /14\/03\/2027/);
});

test('post mostra dados ao vivo, tabela, FAQ e estado', async () => {
  const html = await (await pages.renderBlogPost(req(`/blog/${POST.slug}`), POST.slug)).text();
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /"@type":"BlogPosting"/);
  assert.match(html, /"inLanguage":"pt-BR"/);
  assert.match(html, /Dados atualizados do concurso/);
  assert.match(html, /<table>/);
  assert.match(html, /Outros concursos em São Paulo/);
  assert.match(html, /atualizado em/);
  assert.match(html, /Leia também/);
  assert.doesNotMatch(html, /concurso:tj-sp-2026<\/|· SP, concurso:/, 'tags técnicas não aparecem para o leitor');
});

test('página do estado lista posts do estado e tem FAQ', async () => {
  const html = await (await pages.renderEstadoPage(req('/concursos/sp'), 'sp')).text();
  assert.match(html, /No blog: concursos em São Paulo/);
  assert.match(html, /"@type":"FAQPage"/);
  const ba = await (await pages.renderEstadoPage(req('/concursos/ba'), 'ba')).text();
  assert.match(ba, /Concursos na Bahia/);
});

test('llms.txt e robots.txt liberam as IAs', async () => {
  const txt = await (await pages.renderLlms(req('/llms.txt'))).text();
  assert.match(txt, /^# Check no Concurso/);
  assert.match(txt, /Concursos no Acre \(AC\)/);
  assert.match(txt, /Concurso TJ-SP 2026/);
  const full = await (await pages.renderLlms(req('/llms-full.txt'), { completo: true })).text();
  assert.ok(full.length > txt.length);
  const robots = fs.readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
  for (const bot of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'meta-externalagent', 'Bingbot']) assert.match(robots, new RegExp(`User-agent: ${bot}`));
  assert.match(robots, /Sitemap: https:\/\/checknoconcurso\.com\.br\/sitemap\.xml/);
});
