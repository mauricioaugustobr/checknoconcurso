/**
 * Páginas renderizadas no servidor (para o Google e para quem chega por link):
 *  /concurso/:id   → página de cada concurso
 *  /concursos/:uf  → concursos de cada estado
 *  /blog e /blog/:slug
 *  /sitemap.xml
 * Mostra só dados públicos do plano grátis (data da prova, salário, vagas, situação).
 * Edital completo, Raio-X e provas continuam dentro do app, conforme o plano.
 */
import { escapeHtml, renderMarkdown } from './markdown.js';
import { ESTADOS_BRASIL, MARCA } from '../public/js/data/concursos.js';
import { getLiveCatalog } from './catalog-overrides.js';
import { listPosts, getPostBySlug } from './db.js';

const DEFAULT_SITE = 'https://checknoconcurso.vercel.app';

export function siteUrl(request) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  try {
    const u = new URL(request.url);
    const host = request.headers.get('x-forwarded-host') || u.host;
    if (/localhost|127\.0\.0\.1/.test(host)) return `${u.protocol}//${host}`;
    return `https://${host}`;
  } catch {
    return DEFAULT_SITE;
  }
}

const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n) => Number(n || 0).toLocaleString('pt-BR');
// Aceita "AAAA-MM-DD", texto ISO ou Date (o banco devolve Date)
const isoDay = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : ''));
const dataBR = (iso) => (iso ? isoDay(iso).split('-').reverse().join('/') : null);

function html(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      ...extra
    }
  });
}

function layout({ base, path, title, description, image, jsonLd = [], body, noindex = false, type = 'website' }) {
  const url = `${base}${path}`;
  const img = image || `${base}/og-image.png`;
  const ld = jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(url)}" />
  ${noindex ? '<meta name="robots" content="noindex, follow" />' : '<meta name="robots" content="index, follow, max-image-preview:large" />'}
  <meta name="theme-color" content="#0C4F83" />
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="Check no Concurso" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:image" content="${escapeHtml(img)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${escapeHtml(img)}" />
  <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" />
  <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/tokens.css?v=10" />
  <link rel="stylesheet" href="/css/pages.css?v=1" />
  ${ld}
</head>
<body>
  <header class="pg-header">
    <div class="pg-wrap pg-header-row">
      <a class="pg-logo" href="/" aria-label="Check no Concurso — início"><img src="/brand/logo-horizontal-claro.svg" alt="Check no Concurso" width="190" height="33"></a>
      <nav class="pg-nav" aria-label="Principal">
        <a href="/">Concursos</a>
        <a href="/blog">Blog</a>
        <a class="pg-cta" href="/#planos">Assinar</a>
      </nav>
    </div>
  </header>
  <main class="pg-wrap pg-main">
${body}
  </main>
  <footer class="pg-footer">
    <div class="pg-wrap">
      <p><strong>Check no Concurso</strong> — ${escapeHtml(MARCA.tagline || 'Todos os concursos do Brasil.')}</p>
      <p class="pg-footer-links"><a href="/">Concursos</a> · <a href="/blog">Blog</a> · <a href="/privacidade.html">Política de Privacidade</a></p>
    </div>
  </footer>
</body>
</html>`;
}

const breadcrumb = (base, items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${base}${path}` }))
});

function crumbsHtml(items) {
  return `<nav class="pg-crumbs" aria-label="Você está em">${items.map(([name, path], i) =>
    i === items.length - 1 ? `<span aria-current="page">${escapeHtml(name)}</span>` : `<a href="${escapeHtml(path)}">${escapeHtml(name)}</a>`
  ).join(' <span aria-hidden="true">›</span> ')}</nav>`;
}

function statusClass(status) {
  if (status === 'Inscrições Abertas') return 'is-open';
  if (status === 'Encerrado') return 'is-closed';
  if (status === 'Previsto / Autorizado') return 'is-planned';
  return 'is-info';
}

function concursoCard(c) {
  const prova = c.dataProva ? `Prova: ${dataBR(c.dataProva)}` : (c.inscricaoFim ? `Inscrições até ${dataBR(c.inscricaoFim)}` : c.status);
  return `<li class="pg-card">
      <a href="/concurso/${encodeURIComponent(c.id)}">
        <span class="pg-badge ${statusClass(c.status)}">${escapeHtml(c.status)}</span>
        <strong>${escapeHtml(c.sigla)} — ${escapeHtml(c.orgao)}</strong>
        <span class="pg-muted">${escapeHtml(c.titulo)}</span>
        <span class="pg-meta">${c.vagas ? `${num(c.vagas)} vagas` : 'Cadastro reserva'} · até ${brl(c.salarioMax)} · ${escapeHtml(prova)}</span>
      </a>
    </li>`;
}

/* ---------------- /concurso/:id ---------------- */
export async function renderConcursoPage(request, id) {
  const base = siteUrl(request);
  const catalog = await getLiveCatalog();
  const c = catalog.find((x) => x.id === id);
  if (!c) return renderNotFound(request, 'Concurso não encontrado');
  const estado = ESTADOS_BRASIL[c.uf]?.nome || (c.uf === 'Nacional' ? 'Todo o Brasil' : c.uf);
  const title = `Concurso ${c.sigla} ${new Date().getFullYear()}: ${c.status}${c.dataProva ? `, prova em ${dataBR(c.dataProva)}` : ''} | Check no Concurso`;
  const description = `${c.orgao} (${estado}): ${c.vagas ? `${num(c.vagas)} vagas` : 'cadastro reserva'}, salário até ${brl(c.salarioMax)}, banca ${c.banca}. ${c.inscricaoFim ? `Inscrições até ${dataBR(c.inscricaoFim)}.` : ''} ${c.dataProva ? `Prova em ${dataBR(c.dataProva)}.` : ''}`.replace(/\s+/g, ' ').trim().slice(0, 300);
  const cargos = (c.edital?.cargos || []).slice(0, 12);
  const relacionados = catalog.filter((x) => x.uf === c.uf && x.id !== c.id && x.status !== 'Encerrado').slice(0, 6);
  const ufPath = c.uf === 'Nacional' ? '/' : `/concursos/${c.uf.toLowerCase()}`;
  const crumbs = [['Início', '/'], [c.uf === 'Nacional' ? 'Nacional' : `Concursos ${c.uf}`, ufPath], [c.sigla, `/concurso/${c.id}`]];

  const linhas = [
    ['Situação', c.status],
    ['Órgão', c.orgao],
    ['Estado', estado],
    ['Banca', c.banca],
    ['Escolaridade', c.escolaridade],
    ['Vagas', c.vagas ? `${num(c.vagas)} imediatas${c.vagasCR ? ` + cadastro reserva` : ''}` : 'Cadastro reserva'],
    ['Salário', c.salarioMin && c.salarioMin !== c.salarioMax ? `${brl(c.salarioMin)} a ${brl(c.salarioMax)}` : `até ${brl(c.salarioMax)}`],
    ['Inscrições', c.inscricaoInicio || c.inscricaoFim ? `${c.inscricaoInicio ? dataBR(c.inscricaoInicio) + ' a ' : 'até '}${dataBR(c.inscricaoFim) || 'conforme edital'}` : 'Conforme edital'],
    ['Taxa de inscrição', c.taxaInscricao ? brl(c.taxaInscricao) : (c.taxaInscricao === 0 ? 'Gratuita' : 'Conforme edital')],
    ['Data da prova', c.dataProva ? dataBR(c.dataProva) : 'A definir'],
    ['Atualizado em', dataBR(c.atualizadoEm) || '—']
  ];

  const body = `
    ${crumbsHtml(crumbs)}
    <article class="pg-article">
      <span class="pg-badge ${statusClass(c.status)}">${escapeHtml(c.status)}</span>
      <h1>Concurso ${escapeHtml(c.sigla)}: ${escapeHtml(c.titulo)}</h1>
      <p class="pg-lead">${escapeHtml(c.orgao)} · ${escapeHtml(estado)}${c.provaObservacao ? ` — ${escapeHtml(c.provaObservacao)}` : ''}</p>
      <dl class="pg-facts">${linhas.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>
      ${cargos.length ? `<h2>Cargos</h2><ul class="pg-list">${cargos.map((g) => `<li><strong>${escapeHtml(g.nome)}</strong>${g.vagas ? ` · ${num(g.vagas)} vagas` : ''}${g.salario ? ` · ${brl(g.salario)}` : ''}${g.escolaridade ? ` · ${escapeHtml(g.escolaridade)}` : ''}</li>`).join('')}</ul>` : ''}
      <div class="pg-box">
        <h2>Edital completo, Raio-X e provas anteriores</h2>
        <p>No Check no Concurso você vê o edital mastigado, o que mais cai, compara cursos e recebe alerta quando a data da prova mudar.</p>
        <p><a class="pg-btn" href="/?concurso=${encodeURIComponent(c.id)}">Ver ${escapeHtml(c.sigla)} no Check no Concurso</a></p>
        ${c.edital?.urlPdf ? `<p class="pg-muted">Fonte: <a href="${escapeHtml(c.edital.urlPdf)}" target="_blank" rel="noopener nofollow">${escapeHtml(c.fonteOficial || 'edital oficial')}</a></p>` : ''}
      </div>
      ${relacionados.length ? `<h2>Outros concursos em ${escapeHtml(estado)}</h2><ul class="pg-cards">${relacionados.map(concursoCard).join('')}</ul>` : ''}
    </article>`;
  return html(layout({ base, path: `/concurso/${c.id}`, title, description, body, jsonLd: [breadcrumb(base, crumbs)] }));
}

/* ---------------- /concursos/:uf ---------------- */
export async function renderEstadoPage(request, ufParam) {
  const base = siteUrl(request);
  const uf = String(ufParam || '').toUpperCase();
  const meta = ESTADOS_BRASIL[uf];
  if (!meta) return renderNotFound(request, 'Estado não encontrado');
  const catalog = await getLiveCatalog();
  const rank = { 'Inscrições Abertas': 0, 'Edital Publicado': 1, 'Prova Agendada': 2, 'Previsto / Autorizado': 3, 'Encerrado': 4 };
  const lista = catalog.filter((c) => c.uf === uf)
    .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || (b.importancia || 0) - (a.importancia || 0));
  const abertos = lista.filter((c) => c.status === 'Inscrições Abertas').length;
  const ano = new Date().getFullYear();
  const title = `Concursos ${meta.nome} (${uf}) ${ano}: ${abertos} com inscrições abertas | Check no Concurso`;
  const description = `Lista atualizada dos concursos públicos em ${meta.nome}: ${lista.length} concursos, ${abertos} com inscrições abertas, datas de prova, salários e vagas.`;
  const crumbs = [['Início', '/'], [`Concursos ${uf}`, `/concursos/${uf.toLowerCase()}`]];
  const outros = Object.entries(ESTADOS_BRASIL).filter(([u]) => u !== uf)
    .map(([u, m]) => `<a href="/concursos/${u.toLowerCase()}">${escapeHtml(m.nome)}</a>`).join(' · ');
  const body = `
    ${crumbsHtml(crumbs)}
    <h1>Concursos em ${escapeHtml(meta.nome)} (${uf})</h1>
    <p class="pg-lead">${num(lista.length)} concursos acompanhados · ${num(abertos)} com inscrições abertas. Atualizado pelo Check no Concurso.</p>
    <ul class="pg-cards">${lista.map(concursoCard).join('')}</ul>
    <h2>Concursos em outros estados</h2>
    <p class="pg-states">${outros}</p>`;
  return html(layout({ base, path: `/concursos/${uf.toLowerCase()}`, title, description, body, jsonLd: [breadcrumb(base, crumbs)] }));
}

/* ---------------- /blog ---------------- */
export async function renderBlogIndex(request) {
  const base = siteUrl(request);
  let posts = [];
  try { posts = await listPosts({ limit: 60 }); } catch (err) { console.warn('[blog] lista falhou:', err.message); }
  const crumbs = [['Início', '/'], ['Blog', '/blog']];
  const body = `
    ${crumbsHtml(crumbs)}
    <h1>Blog do Check no Concurso</h1>
    <p class="pg-lead">Notícias de editais, datas de prova e dicas para quem estuda para concurso.</p>
    ${posts.length
      ? `<ul class="pg-posts">${posts.map((p) => `<li class="pg-post-card">
          <a href="/blog/${encodeURIComponent(p.slug)}">
            ${p.cover_url ? `<img src="${escapeHtml(p.cover_url)}" alt="" loading="lazy">` : ''}
            <span class="pg-muted">${dataBR(p.published_at)}</span>
            <strong>${escapeHtml(p.title)}</strong>
            <span>${escapeHtml(p.excerpt)}</span>
          </a></li>`).join('')}</ul>`
      : '<p class="pg-box">Os primeiros artigos estão chegando. Enquanto isso, veja os <a href="/">concursos abertos</a>.</p>'}`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Blog', name: 'Blog do Check no Concurso', url: `${base}/blog`,
    blogPost: posts.slice(0, 20).map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${base}/blog/${p.slug}`, datePublished: p.published_at }))
  };
  return html(layout({ base, path: '/blog', title: 'Blog do Check no Concurso — editais, datas de prova e dicas', description: 'Notícias de editais, datas de prova e dicas de estudo para concursos públicos em todo o Brasil.', body, jsonLd: [ld, breadcrumb(base, crumbs)] }));
}

/* ---------------- /blog/:slug ---------------- */
export async function renderBlogPost(request, slug) {
  const base = siteUrl(request);
  let post = null;
  try { post = await getPostBySlug(slug); } catch (err) { console.warn('[blog] post falhou:', err.message); }
  if (!post) return renderNotFound(request, 'Artigo não encontrado');
  const crumbs = [['Início', '/'], ['Blog', '/blog'], [post.title, `/blog/${post.slug}`]];
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.seo_description || post.excerpt,
    datePublished: post.published_at, dateModified: post.updated_at, mainEntityOfPage: `${base}/blog/${post.slug}`,
    image: post.cover_url || `${base}/og-image.png`,
    author: { '@type': 'Organization', name: 'Check no Concurso' },
    publisher: { '@type': 'Organization', name: 'Check no Concurso', logo: { '@type': 'ImageObject', url: `${base}/icons/icon-512.png` } }
  };
  const body = `
    ${crumbsHtml(crumbs)}
    <article class="pg-article pg-post">
      <p class="pg-muted">${dataBR(post.published_at)}${post.tags?.length ? ` · ${post.tags.map(escapeHtml).join(', ')}` : ''}</p>
      <h1>${escapeHtml(post.title)}</h1>
      ${post.excerpt ? `<p class="pg-lead">${escapeHtml(post.excerpt)}</p>` : ''}
      ${post.cover_url ? `<img class="pg-cover" src="${escapeHtml(post.cover_url)}" alt="">` : ''}
      <div class="pg-prose">${renderMarkdown(post.content_md)}</div>
      <div class="pg-box"><p><strong>Acompanhe os concursos abertos</strong> e receba alerta quando a data da prova mudar.</p><p><a class="pg-btn" href="/">Ver concursos</a></p></div>
    </article>`;
  return html(layout({
    base, path: `/blog/${post.slug}`, type: 'article',
    title: `${post.seo_title || post.title} | Check no Concurso`,
    description: post.seo_description || post.excerpt || post.title,
    image: post.cover_url, body, jsonLd: [ld, breadcrumb(base, crumbs)]
  }));
}

export function renderNotFound(request, message = 'Página não encontrada') {
  const base = siteUrl(request);
  const body = `<h1>${escapeHtml(message)}</h1><p class="pg-lead">O endereço pode ter mudado. Veja os <a href="/">concursos abertos</a> ou o <a href="/blog">blog</a>.</p>`;
  return html(layout({ base, path: new URL(request.url).pathname, title: `${message} | Check no Concurso`, description: message, body, noindex: true }), 404, { 'Cache-Control': 'no-cache' });
}

/* ---------------- /sitemap.xml ---------------- */
export async function renderSitemap(request) {
  const base = siteUrl(request);
  const catalog = await getLiveCatalog();
  let posts = [];
  try { posts = await listPosts({ limit: 1000 }); } catch { /* sem banco: sitemap sem posts */ }
  const hoje = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${base}/`, lastmod: hoje, priority: '1.0', changefreq: 'daily' },
    { loc: `${base}/blog`, lastmod: hoje, priority: '0.8', changefreq: 'daily' },
    { loc: `${base}/privacidade.html`, priority: '0.2', changefreq: 'yearly' },
    ...Object.keys(ESTADOS_BRASIL).map((uf) => ({ loc: `${base}/concursos/${uf.toLowerCase()}`, lastmod: hoje, priority: '0.8', changefreq: 'daily' })),
    ...catalog.map((c) => ({ loc: `${base}/concurso/${encodeURIComponent(c.id)}`, lastmod: isoDay(c.atualizadoEm || hoje), priority: c.status === 'Encerrado' ? '0.3' : '0.7', changefreq: 'weekly' })),
    ...posts.map((p) => ({ loc: `${base}/blog/${encodeURIComponent(p.slug)}`, lastmod: isoDay(p.updated_at), priority: '0.6', changefreq: 'monthly' }))
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeHtml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600' } });
}
