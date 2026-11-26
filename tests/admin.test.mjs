import assert from 'node:assert/strict';
import { createSessionToken } from '../lib/auth.js';
import { handleOverview, handleAdminConcursos, handleAdminPosts, handleUsers } from '../lib/admin-api.js';
import { sanitizeOverride, applyOverrides } from '../lib/catalog-overrides.js';
import { renderConcursoPage, renderEstadoPage, renderBlogIndex, renderSitemap, renderNotFound } from '../lib/pages.js';
import { renderMarkdown, slugify } from '../lib/markdown.js';
import { CONCURSOS } from '../public/js/data/concursos.js';
import { createServer } from '../server.mjs';

// Testes sem banco: DATABASE_URL fica vazia de propósito
delete process.env.DATABASE_URL;
const SECRET = 'z'.repeat(48);
process.env.SESSION_SECRET = SECRET;
process.env.ADMIN_EMAILS = 'chefe@exemplo.com';
const BASE = 'https://checknoconcurso.vercel.app';
const cookieFor = (email) => 'cnc_session=' + createSessionToken({ sub: '1', email, name: 'Teste', provider: 'google' }, SECRET);
const req = (path, { method = 'GET', email, origin, body } = {}) => new Request(BASE + path, {
  method,
  headers: { ...(email ? { cookie: cookieFor(email) } : {}), ...(origin ? { origin, host: 'checknoconcurso.vercel.app' } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined
});

async function run() {
  // 1. Painel: sem login → 401, usuário comum → 403, admin → 200
  assert.equal((await handleOverview(req('/api/admin/overview'))).status, 401);
  assert.equal((await handleOverview(req('/api/admin/overview', { email: 'aluno@exemplo.com' }))).status, 403);
  const ov = await handleOverview(req('/api/admin/overview', { email: 'chefe@exemplo.com' }));
  assert.equal(ov.status, 200);
  const ovData = await ov.json();
  assert.equal(ovData.banco, false);
  assert.equal(ovData.concursos.total, CONCURSOS.length);
  assert.equal((await handleUsers(req('/api/admin/users', { email: 'aluno@exemplo.com' }))).status, 403);

  // Alteração vinda de outro site é bloqueada mesmo para admin
  const cross = await handleAdminPosts(req('/api/admin/posts', { method: 'POST', email: 'chefe@exemplo.com', origin: 'https://evil.com', body: { title: 'x' } }));
  assert.equal(cross.status, 403, 'POST de outro site deve ser bloqueado');
  const list = await (await handleAdminConcursos(req('/api/admin/concursos?q=pm%20sp', { email: 'chefe@exemplo.com' }))).json();
  assert.equal(list.items[0].sigla, 'PM-SP');

  // 2. Validação das edições de concurso
  assert.deepEqual(sanitizeOverride({ status: 'Encerrado', dataProva: '2027-03-01', vagas: '120', titulo: '<b>Novo</b>' }),
    { status: 'Encerrado', dataProva: '2027-03-01', vagas: 120, titulo: 'bNovo/b' });
  assert.throws(() => sanitizeOverride({ status: 'Qualquer coisa' }), /Status inválido/);
  assert.throws(() => sanitizeOverride({ dataProva: '01/03/2027' }), /Data inválida/);
  assert.throws(() => sanitizeOverride({ vagas: -3 }), /Número inválido/);
  const alvo = CONCURSOS[0];
  const merged = applyOverrides(CONCURSOS, [{ concurso_id: alvo.id, data: { status: 'Encerrado' }, hidden: false, updated_at: new Date('2026-11-25T10:00:00Z') }]);
  assert.equal(merged.find((c) => c.id === alvo.id).status, 'Encerrado');
  assert.equal(merged.find((c) => c.id === alvo.id).atualizadoEm, '2026-11-25');
  const hidden = applyOverrides(CONCURSOS, [{ concurso_id: alvo.id, data: {}, hidden: true, updated_at: new Date() }]);
  assert.equal(hidden.length, CONCURSOS.length - 1, 'concurso oculto some do site');

  // 3. Páginas para o Google
  const pg = await renderConcursoPage(req('/concurso/' + alvo.id), alvo.id);
  assert.equal(pg.status, 200);
  const pgHtml = await pg.text();
  assert.ok(pgHtml.includes(`<link rel="canonical" href="${BASE}/concurso/${alvo.id}"`));
  assert.ok(pgHtml.includes(alvo.sigla) && pgHtml.includes('application/ld+json'));
  assert.equal((await renderConcursoPage(req('/concurso/nao-existe'), 'nao-existe')).status, 404);
  const sp = await (await renderEstadoPage(req('/concursos/sp'), 'sp')).text();
  assert.ok(sp.includes('Concursos em São Paulo'));
  assert.equal((await renderEstadoPage(req('/concursos/xx'), 'xx')).status, 404);
  const blog = await renderBlogIndex(req('/blog'));
  assert.equal(blog.status, 200);
  const sm = await (await renderSitemap(req('/sitemap.xml'))).text();
  const { postsDoRepositorio } = await import('../lib/posts.js');
  assert.equal((sm.match(/<url>/g) || []).length, 4 + 27 + CONCURSOS.length + postsDoRepositorio().length, 'sitemap: home, blog, privacidade, cancelamento, 27 estados, todos os concursos e os posts publicados');
  assert.ok((await renderNotFound(req('/x')).text()).includes('noindex'));

  // 4. Texto do blog é seguro
  const md = renderMarkdown('# Título\n\n<script>alert(1)</script> **forte** [x](javascript:alert(1))');
  assert.ok(!md.includes('<script>') && md.includes('&lt;script&gt;'), 'HTML digitado é escapado');
  assert.ok(!md.includes('javascript:'), 'links javascript: são bloqueados');
  assert.equal(slugify('Concurso PM-SP 2027: edital saiu!'), 'concurso-pm-sp-2027-edital-saiu');

  // 5. Rotas no servidor local
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    const base = `http://127.0.0.1:${port}`;
    for (const [path, code] of [['/concurso/' + alvo.id, 200], ['/concursos/rj', 200], ['/blog', 200], ['/sitemap.xml', 200], ['/robots.txt', 200], ['/admin', 200], ['/admin/admin.js', 200], ['/api/admin/overview', 401]]) {
      assert.equal((await fetch(base + path)).status, code, `${path} deveria responder ${code}`);
    }
  } finally {
    await new Promise((r) => server.close(r));
  }

  // 6. Plano Hobby da Vercel: no máximo 12 funções de servidor por site
  const fsm = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const contar = (dir) => fsm.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? contar(dir + '/' + e.name) : (e.name.endsWith('.js') ? 1 : 0)), 0);
  const funcoes = contar(fileURLToPath(new URL('../api', import.meta.url)));
  assert.ok(funcoes <= 12, `São ${funcoes} funções em api/ — o limite do plano Hobby da Vercel é 12`);

  console.log('OK: painel de admin (permissões e edições), páginas para o Google, blog e sitemap validados.');
}

run().catch((err) => {
  console.error('FALHA NOS TESTES DO ADMIN:', err);
  process.exit(1);
});
