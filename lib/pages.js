/**
 * Páginas renderizadas no servidor (para o Google e para quem chega por link):
 *  /concurso/:id   → página de cada concurso
 *  /concursos/:uf  → concursos de cada estado
 *  /blog e /blog/:slug
 *  /sitemap.xml
 * Vitrine pública para o Google e as IAs: só o resumo do concurso (situação, data da prova, salário, vagas).
 * O site em si exige plano (Essencial ou Completo): não existe plano grátis.
 * Edital completo, Raio-X e provas continuam dentro do app, conforme o plano.
 */
import { escapeHtml, renderMarkdown, slugify } from './markdown.js';
import { ESTADOS_BRASIL, MARCA, PLANOS } from '../public/js/data/concursos.js';
import { SEM_PROVA_ANTERIOR } from '../public/js/data/sem-prova.js';
import { getLiveCatalog } from './catalog-overrides.js';
import { listPosts, getPostBySlug } from './posts.js';
import { amostraHTML } from '../public/js/amostra-questao.js';

const DEFAULT_SITE = 'https://checknoconcurso.com.br';

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
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      ...extra
    }
  });
}

function layout({ base, path, title, description, image, jsonLd = [], body, noindex = false, type = 'website', origem = '' }) {
  const url = `${base}${path}`;
  // Página de concurso: "Planos" e "Assinar" levam o concurso junto (item 6)
  const planosHref = /^[a-z0-9][a-z0-9-]{0,99}$/.test(origem) ? `/?origem=${origem}#planos` : '/#planos';
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
  <link rel="stylesheet" href="/css/pages.css?v=5" />
  ${ld}
  ${body.includes('data-amostra=') ? '<link rel="stylesheet" href="/css/amostra-questao.css?v=2" />\n  <script type="module" src="/js/amostra-questao.js?v=2"></script>' : ''}
  ${body.includes('pg-assinar-concurso') ? '<link rel="stylesheet" href="/css/plano-origem.css?v=2" />' : ''}
  <link rel="stylesheet" href="/css/theme-dark.css?v=1" />
  <script src="/js/theme.js?v=1"></script>
  <script src="/js/consent.js?v=1"></script>
</head>
<body>
  <header class="pg-header">
    <div class="pg-wrap pg-header-row">
      <a class="pg-logo" href="/" aria-label="Check no Concurso — início"><img src="/brand/logo-horizontal-claro.svg" alt="Check no Concurso" width="190" height="33"></a>
      <nav class="pg-nav" aria-label="Principal">
        <a href="/">Concursos</a>
        <a class="pg-nav-blog" href="/blog"${path === '/blog' || path.startsWith('/blog/') ? ' aria-current="page"' : ''}>Blog</a>
        <a class="pg-nav-planos" href="${planosHref}">Planos</a>
        <a class="pg-cta" href="${planosHref}">Assinar</a>
      </nav>
    </div>
  </header>
  <main class="pg-wrap pg-main">
${body}
  </main>
  <footer class="pg-footer">
    <div class="pg-wrap">
      <p><strong>Check no Concurso</strong> — ${escapeHtml(MARCA.tagline || 'Todos os concursos do Brasil.')}</p>
      <p class="pg-footer-links"><a href="/">Concursos</a> · <a href="/blog">Blog</a> · <a href="/privacidade.html">Política de Privacidade</a> · <a href="/cancelamento.html">Cancelar assinatura</a> · <a href="#cookies-preferencias" data-cookies-preferencias>Preferências de cookies</a></p>
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

/* ---------------- Respostas diretas (para Google, ChatGPT, Gemini, Copilot, Perplexity, Claude e Meta AI) ---------------- */
// Preposição certa para cada estado: "no Acre", "na Bahia", "em São Paulo"
const PREP_UF = { AC: 'no', AP: 'no', AM: 'no', CE: 'no', DF: 'no', ES: 'no', MA: 'no', PA: 'no', PR: 'no', PI: 'no', RJ: 'no', RN: 'no', RS: 'no', TO: 'no', BA: 'na', PB: 'na' };
const DE_UF = { no: 'do', na: 'da', em: 'de' };
export const emEstado = (uf) => `${PREP_UF[uf] || 'em'} ${ESTADOS_BRASIL[uf]?.nome || uf}`;
export const deEstado = (uf) => `${DE_UF[PREP_UF[uf] || 'em']} ${ESTADOS_BRASIL[uf]?.nome || uf}`;
// Data de hoje no horário de Brasília (UTC-3)
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

// Situação conferida pelas datas, e não só pelo status salvo (que pode ter ficado para trás)
function inscricaoTexto(c, hoje = hojeBR()) {
  const ini = isoDay(c.inscricaoInicio);
  const fim = isoDay(c.inscricaoFim);
  if (!fim) return null;
  if (fim < hoje) return `As inscrições terminaram em ${dataBR(fim)}.`;
  if (ini && ini > hoje) return `As inscrições vão de ${dataBR(ini)} a ${dataBR(fim)}.`;
  return `As inscrições estão abertas até ${dataBR(fim)}${c.banca ? `, pelo site da banca ${c.banca}` : ''}.`;
}
const inscricaoAberta = (c, hoje = hojeBR()) => {
  const ini = isoDay(c.inscricaoInicio);
  const fim = isoDay(c.inscricaoFim);
  return Boolean(fim && fim >= hoje && (!ini || ini <= hoje));
};

function faqConcurso(c, estado) {
  const nome = `concurso ${c.sigla}`;
  const salario = c.salarioMin && c.salarioMin !== c.salarioMax ? `de ${brl(c.salarioMin)} a ${brl(c.salarioMax)}` : `de até ${brl(c.salarioMax)}`;
  const faq = [];
  faq.push([`Quando é a prova do ${nome}?`, c.dataProva
    ? `A prova do ${c.sigla} (${c.orgao}) está marcada para ${dataBR(c.dataProva)}${c.provaObservacao ? `. ${String(c.provaObservacao).replace(/[.\s]*$/, '.')}` : '.'}`
    : `A data da prova do ${c.sigla} ainda não foi definida. O Check no Concurso avisa assim que ela sair.`]);
  const insc = inscricaoTexto(c);
  if (insc) faq.push([`Até quando vão as inscrições do ${nome}?`, `${insc}${c.taxaInscricao ? ` A taxa é de ${brl(c.taxaInscricao)}.` : (c.taxaInscricao === 0 ? ' A inscrição é gratuita.' : '')}`]);
  if (c.salarioMax) faq.push([`Qual é o salário do ${nome}?`, `O salário é ${salario}, conforme o edital${c.edital?.cargos?.length > 1 ? ' (varia por cargo)' : ''}.`]);
  faq.push([`Quantas vagas tem o ${nome}?`, c.vagas ? `São ${num(c.vagas)} vagas imediatas${c.vagasCR ? ', além de cadastro reserva' : ''}.` : 'O concurso é para cadastro reserva.']);
  if (c.banca) faq.push([`Qual é a banca do ${nome}?`, `A banca organizadora é ${c.banca}.`]);
  if (SEM_PROVA_ANTERIOR.has(c.id)) faq.push([`Tem prova anterior do ${nome} para treinar?`, `Não. Não encontramos prova pública de um concurso anterior do ${c.orgao}: pode ser o primeiro concurso do órgão, ou a prova anterior não foi divulgada.`]);
  faq.push([`Onde acompanhar o ${nome}?`, `No Check no Concurso (checknoconcurso.com.br), que acompanha os concursos ${c.uf === 'Nacional' ? 'nacionais' : deEstado(c.uf)} e de todo o Brasil e avisa quando a data da prova muda.`]);
  return faq;
}

function faqHtml(faq, titulo = 'Perguntas frequentes') {
  if (!faq.length) return '';
  return `<section class="pg-faq" aria-labelledby="faq-titulo">
      <h2 id="faq-titulo">${escapeHtml(titulo)}</h2>
      ${faq.map(([q, a]) => `<h3>${escapeHtml(q)}</h3><p>${escapeHtml(a)}</p>`).join('\n      ')}
    </section>`;
}

const faqLd = (faq) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
});

// Texto puro de um trecho em markdown (para o JSON-LD)
const plain = (md) => String(md || '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[*_`>#|]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// Perguntas e respostas da seção "Perguntas frequentes" de um post (subtítulos = perguntas)
export function extractFaq(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => /^#{1,3}\s+.*(perguntas frequentes|perguntas e respostas|d[uú]vidas frequentes|\bfaq\b)/i.test(l));
  if (start < 0) return [];
  const level = lines[start].match(/^#+/)[0].length;
  const faq = [];
  let q = null;
  let a = [];
  const push = () => { if (q && plain(a.join(' '))) faq.push([plain(q), plain(a.join(' '))]); };
  for (let i = start + 1; i < lines.length; i++) {
    const h = lines[i].match(/^(#{1,4})\s+(.*)$/);
    if (h && h[1].length <= level) break;
    if (h) { push(); q = h[2]; a = []; continue; }
    const bold = lines[i].match(/^\s*\*\*(.+\?)\*\*\s*$/); // pergunta em negrito numa linha
    if (bold) { push(); q = bold[1]; a = []; continue; }
    if (q) a.push(lines[i]);
  }
  push();
  return faq.slice(0, 12);
}

// Tags do post: "SP" (estado) e "concurso:tj-sp-2026" ligam o post aos dados ao vivo
function postLinks(tags = []) {
  const ufs = [];
  const ids = [];
  for (const t of tags || []) {
    const s = String(t).trim();
    const uf = s.replace(/^uf:/i, '').toUpperCase();
    if (ESTADOS_BRASIL[uf] && (/^uf:/i.test(s) || /^[A-Za-z]{2}$/.test(s))) ufs.push(uf);
    const m = s.match(/^concurso:(.+)$/i);
    if (m) ids.push(m[1].trim());
  }
  return { ufs: [...new Set(ufs)], ids: [...new Set(ids)] };
}
const tagsVisiveis = (tags = []) => (tags || []).filter((t) => !/^(uf|concurso):/i.test(String(t)) && !(/^[A-Za-z]{2}$/.test(String(t).trim()) && ESTADOS_BRASIL[String(t).trim().toUpperCase()]));

function boxConcursoAoVivo(c) {
  const linhas = [
    ['Situação', inscricaoAberta(c) ? 'Inscrições abertas' : c.status],
    ['Inscrições', inscricaoTexto(c)?.replace(/\.$/, '') || 'Conforme edital'],
    ['Data da prova', c.dataProva ? dataBR(c.dataProva) : 'A definir'],
    ['Vagas', c.vagas ? `${num(c.vagas)}${c.vagasCR ? ' + cadastro reserva' : ''}` : 'Cadastro reserva'],
    ['Salário', `até ${brl(c.salarioMax)}`],
    ['Banca', c.banca]
  ];
  return `<aside class="pg-box pg-live" aria-label="Dados atualizados do concurso ${escapeHtml(c.sigla)}">
      <p class="pg-muted">Dados atualizados do concurso · conferidos em ${dataBR(c.atualizadoEm) || dataBR(hojeBR())}</p>
      <h2>${escapeHtml(c.sigla)} — ${escapeHtml(c.orgao)}</h2>
      <dl class="pg-facts">${linhas.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v || '—')}</dd></div>`).join('')}</dl>
      <p><a class="pg-btn" href="/concurso/${encodeURIComponent(c.id)}">Ver tudo sobre o ${escapeHtml(c.sigla)}</a></p>
    </aside>`;
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
  const faq = faqConcurso(c, estado);
  // Artigos do blog sobre este concurso primeiro, depois os do mesmo estado
  let postsBlog = [];
  try {
    const todos = await listPosts({ limit: 200 });
    const doConcurso = todos.filter((p) => postLinks(p.tags).ids.includes(c.id));
    const doEstado = todos.filter((p) => !doConcurso.includes(p) && postLinks(p.tags).ufs.includes(c.uf));
    postsBlog = [...doConcurso, ...doEstado].slice(0, 3);
  } catch { postsBlog = []; }

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
      ${amostraHTML({ modo: 'concurso', areaCatalogo: c.area, origem: c.id })}
      <div class="pg-box">
        <h2>Edital completo, Raio-X e provas anteriores</h2>
        <p>No Check no Concurso você vê o edital mastigado, o que mais cai, compara cursos e recebe alerta quando a data da prova mudar.</p>
        ${SEM_PROVA_ANTERIOR.has(c.id) ? '<p class="pg-muted"><strong>Este concurso não tem prova anterior.</strong> Não encontramos prova pública de um concurso anterior deste órgão: pode ser o primeiro concurso dele, ou a prova anterior não foi divulgada.</p>' : ''}
        <div class="pg-assinar-concurso">
          <p class="pg-assinar-acoes">
            <a class="pg-btn pg-btn-assinar" href="/?origem=${encodeURIComponent(c.id)}#planos" aria-label="Assinar e acompanhar ${escapeHtml(c.sigla)}, a partir de R$ 9,99 por mês"><span class="pg-assinar-longo">Assinar e acompanhar ${escapeHtml(c.sigla)}</span><span class="pg-assinar-curto">Acompanhar ${escapeHtml(c.sigla)}<small>a partir de R$ 9,99/mês</small></span></a>
            <a class="pg-btn pg-btn-secundario" href="/?concurso=${encodeURIComponent(c.id)}">Ver ${escapeHtml(c.sigla)} no Check no Concurso</a>
          </p>
          <p class="pg-assinar-apoio"><span class="pg-assinar-preco">A partir de R$ 9,99/mês. </span>Depois do pagamento, você vai direto para a ficha do ${escapeHtml(c.sigla)}.</p>
        </div>
        <p class="pg-muted">Para usar o Check no Concurso, escolha um dos 2 planos: Essencial (R$ 9,99/mês) ou Completo (R$ 23,99/mês, com treino de provas anteriores). <a href="/?origem=${encodeURIComponent(c.id)}#planos">Ver os planos</a></p>
        ${c.edital?.urlPdf ? `<p class="pg-muted">Fonte: <a href="${escapeHtml(c.edital.urlPdf)}" target="_blank" rel="noopener nofollow">${escapeHtml(c.fonteOficial || 'edital oficial')}</a></p>` : ''}
      </div>
      ${faqHtml(faq)}
      ${relacionados.length ? `<h2>Outros concursos ${escapeHtml(c.uf === 'Nacional' ? 'nacionais' : emEstado(c.uf))}</h2><ul class="pg-cards">${relacionados.map(concursoCard).join('')}</ul>` : ''}
      <h2>No blog do Check no Concurso</h2>
      ${postsBlog.length ? `<ul class="pg-posts is-related">${postsBlog.map((p) => postCard(p)).join('')}</ul>` : ''}
      <p class="pg-more"><a href="/blog">Ver todos os artigos do blog →</a></p>
    </article>`;
  return html(layout({ base, path: `/concurso/${c.id}`, title, description, body, jsonLd: [breadcrumb(base, crumbs), faqLd(faq)], origem: c.id }));
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
  const description = `Lista atualizada dos concursos públicos ${emEstado(uf)}: ${lista.length} concursos, ${abertos} com inscrições abertas, datas de prova, salários e vagas.`;
  const crumbs = [['Início', '/'], [`Concursos ${uf}`, `/concursos/${uf.toLowerCase()}`]];
  const outros = Object.entries(ESTADOS_BRASIL).filter(([u]) => u !== uf)
    .map(([u, m]) => `<a href="/concursos/${u.toLowerCase()}">${escapeHtml(m.nome)}</a>`).join(' · ');
  // Respostas diretas: inscrições abertas conferidas pela data de hoje
  const abertasHoje = lista.filter((c) => c.status !== 'Encerrado' && inscricaoAberta(c))
    .sort((a, b) => (b.importancia || 0) - (a.importancia || 0));
  const faq = [
    [`Quais concursos estão com inscrições abertas ${emEstado(uf)}?`, abertasHoje.length
      ? `Hoje, ${num(abertasHoje.length)} concursos ${emEstado(uf)} estão com inscrições abertas. Entre eles: ${abertasHoje.slice(0, 6).map((c) => `${c.sigla} (${c.vagas ? `${num(c.vagas)} vagas` : 'cadastro reserva'}, até ${brl(c.salarioMax)}, inscrições até ${dataBR(c.inscricaoFim)})`).join('; ')}.`
      : `Hoje não há concurso com inscrições abertas ${emEstado(uf)} no Check no Concurso. Veja os previstos e autorizados nesta página.`],
    [`Quantos concursos públicos há ${emEstado(uf)}?`, `O Check no Concurso acompanha ${num(lista.length)} concursos ${emEstado(uf)}: ${num(lista.filter((c) => c.status !== 'Encerrado').length)} ativos ou previstos e ${num(lista.filter((c) => c.status === 'Encerrado').length)} encerrados.`]
  ];
  let posts = [];
  try { posts = (await listPosts({ limit: 200 })).filter((p) => postLinks(p.tags).ufs.includes(uf)).slice(0, 4); } catch { /* sem banco */ }
  const body = `
    ${crumbsHtml(crumbs)}
    <h1>Concursos ${escapeHtml(emEstado(uf))} (${uf})</h1>
    <p class="pg-lead">${num(lista.length)} concursos acompanhados · ${num(abertos)} com inscrições abertas. Atualizado pelo Check no Concurso.</p>
    <ul class="pg-cards">${lista.slice(0, 6).map(concursoCard).join('')}</ul>
    ${amostraHTML({ modo: 'estado' })}
    ${lista.length > 6 ? `<ul class="pg-cards">${lista.slice(6).map(concursoCard).join('')}</ul>` : ''}
    ${posts.length ? `<h2>No blog: concursos ${escapeHtml(emEstado(uf))}</h2><ul class="pg-list">${posts.map((p) => `<li><a href="/blog/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></li>`).join('')}</ul>` : ''}
    <p class="pg-more"><a href="/blog">Ver todos os artigos do blog →</a></p>
    ${faqHtml(faq)}
    <h2>Concursos em outros estados</h2>
    <p class="pg-states">${outros}</p>`;
  return html(layout({ base, path: `/concursos/${uf.toLowerCase()}`, title, description, body, jsonLd: [breadcrumb(base, crumbs), faqLd(faq)] }));
}

/* ---------------- Peças visuais do blog (Designer UI/UX) ---------------- */
const minutosLeitura = (md) => Math.max(1, Math.round(plain(md).split(' ').filter(Boolean).length / 200));
const nomeUF = (uf) => ESTADOS_BRASIL[uf]?.nome || uf;

// Rótulo do post: o estado (posts de concurso) ou a primeira tag visível (guias)
function rotuloPost(p) {
  const { ufs } = postLinks(p.tags);
  if (ufs.length) return { uf: ufs[0], texto: nomeUF(ufs[0]), href: `/concursos/${ufs[0].toLowerCase()}` };
  return { uf: null, texto: tagsVisiveis(p.tags)[0] || 'Guia', href: null };
}

function postCard(p, { anchor = '' } = {}) {
  const r = rotuloPost(p);
  const min = p.content_md ? minutosLeitura(p.content_md) : null;
  return `<li class="pg-post-card ${r.uf ? 'is-uf' : 'is-guide'}"${anchor ? ` id="${anchor}"` : ''}>
          <a href="/blog/${encodeURIComponent(p.slug)}">
            ${p.cover_url ? `<img src="${escapeHtml(p.cover_url)}" alt="" loading="lazy">` : ''}
            <span class="pg-post-kicker">${r.uf ? `<span class="pg-uf" aria-hidden="true">${r.uf}</span>` : ''}${escapeHtml(r.texto)}</span>
            <strong>${escapeHtml(p.title)}</strong>
            ${p.excerpt ? `<span class="pg-post-excerpt">${escapeHtml(p.excerpt)}</span>` : ''}
            <span class="pg-post-meta"><time datetime="${isoDay(p.published_at)}">${dataBR(p.published_at)}</time>${min ? ` · ${min} min de leitura` : ''}</span>
          </a></li>`;
}

// Âncoras nos subtítulos (índice "Neste artigo") e seção de perguntas frequentes destacada
function prepararProsa(htmlProsa) {
  const usados = new Set();
  const toc = [];
  let out = htmlProsa.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner) => {
    const texto = inner.replace(/<[^>]+>/g, '');
    let id = slugify(texto.replace(/&[a-z#0-9]+;/gi, ' '));
    while (usados.has(id)) id += '-2';
    usados.add(id);
    if (!/perguntas frequentes|perguntas e respostas|d[uú]vidas frequentes|\bfaq\b|^fontes?\b/i.test(texto)) toc.push([id, texto]);
    return `<h2 id="${id}">${inner}</h2>`;
  });
  out = out.replace(/(<h2 id="[^"]+">[^<]*(?:Perguntas frequentes|Perguntas e respostas|D[uú]vidas frequentes|FAQ)[^<]*<\/h2>)([\s\S]*?)(?=<h2 |$)/i,
    (_, h, resto) => `<section class="pg-faq pg-faq-post">${h}${resto}</section>`);
  return { html: out, toc };
}

// O resumo costuma repetir o 1º parágrafo; nesse caso ele não aparece duas vezes
function resumoRepetido(post) {
  const ex = plain(post.excerpt).replace(/\s*(…|\.\.\.)$/, '').slice(0, 80);
  const primeiro = plain(String(post.content_md || '').split(/\n\s*\n/).find((b) => b.trim() && !/^\s*#/.test(b)) || '');
  return Boolean(ex) && primeiro.startsWith(ex);
}

// Chamada no meio do artigo: leva o leitor do blog para o site (ficha do concurso, estado ou lista geral)
function ctaMeioPost({ concursosDoPost = [], ufs = [] }) {
  const c = concursosDoPost[0];
  const uf = ufs[0];
  const titulo = c
    ? `Acompanhe o ${escapeHtml(c.sigla)} no Check no Concurso`
    : uf ? `Veja todos os concursos ${escapeHtml(emEstado(uf))}` : 'Encontre o seu concurso no Check no Concurso';
  const texto = c
    ? 'Data da prova, prazo de inscrição, vagas e salário conferidos no edital e atualizados quando mudam.'
    : uf ? 'Lista atualizada com inscrições abertas, datas de prova, salários e vagas de cada concurso.'
      : 'Todos os concursos do Brasil em um só lugar, com datas de prova, prazos, salários e editais resumidos.';
  const href = c ? `/concurso/${encodeURIComponent(c.id)}` : uf ? `/concursos/${uf.toLowerCase()}` : '/';
  const botao = c ? `Ver o ${escapeHtml(c.sigla)} no site` : uf ? `Concursos ${escapeHtml(deEstado(uf))}` : 'Ver concursos abertos';
  return `<aside class="pg-cta-inline" aria-label="Check no Concurso">
        <p class="pg-cta-inline-title">${titulo}</p>
        <p>${texto}</p>
        <p class="pg-cta-inline-actions"><a class="pg-btn" href="${href}">${botao} →</a> <a class="pg-cta-inline-link" href="/#planos">Ver os planos</a></p>
      </aside>`;
}

// Insere a chamada antes do 2º subtítulo do artigo (ou no fim, se o texto for curto)
function comCtaNoMeio(htmlProsa, cta) {
  let n = 0;
  let feito = false;
  // A seção de perguntas frequentes começa com <section>; a chamada fica antes dela, nunca dentro
  const out = htmlProsa.replace(/(?:<section class="pg-faq[^"]*">)?<h2 id="/g, (m) => {
    n += 1;
    if (n === 2 && !feito) { feito = true; return `${cta}\n${m}`; }
    return m;
  });
  return feito ? out : `${out}\n${cta}`;
}

// Nos guias (sem estado), atalhos para os concursos de cada estado
function atalhosEstados() {
  return `<nav class="pg-box pg-uf-links" aria-labelledby="uf-links-titulo">
        <h2 id="uf-links-titulo">Concursos abertos no seu estado</h2>
        <p class="pg-states">${Object.entries(ESTADOS_BRASIL).map(([u, m]) => `<a href="/concursos/${u.toLowerCase()}">${escapeHtml(m.nome)}</a>`).join(' · ')}</p>
      </nav>`;
}

function compartilhar(url, titulo) {
  const texto = encodeURIComponent(`${titulo} ${url}`);
  return `<div class="pg-share" aria-label="Compartilhar">
        <span>Mande para quem também estuda:</span>
        <a class="pg-share-btn is-wa" href="https://wa.me/?text=${texto}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="pg-share-btn" href="https://t.me/share/url?url=${encodeURIComponent(url)}&amp;text=${encodeURIComponent(titulo)}" target="_blank" rel="noopener">Telegram</a>
      </div>`;
}

/* ---------------- /blog ---------------- */
export async function renderBlogIndex(request) {
  const base = siteUrl(request);
  let posts = [];
  try { posts = await listPosts({ limit: 60 }); } catch (err) { console.warn('[blog] lista falhou:', err.message); }
  const crumbs = [['Início', '/'], ['Blog', '/blog']];
  // Concursos por estado (em ordem alfabética, para achar o seu) e guias (mais novos primeiro)
  const porEstado = posts.filter((p) => rotuloPost(p).uf)
    .sort((a, b) => nomeUF(rotuloPost(a).uf).localeCompare(nomeUF(rotuloPost(b).uf), 'pt-BR'));
  const guias = posts.filter((p) => !rotuloPost(p).uf);
  const ufsComPost = [...new Set(porEstado.map((p) => rotuloPost(p).uf))];
  const ancoraFeita = new Set();
  const ancora = (p) => { const uf = rotuloPost(p).uf; if (ancoraFeita.has(uf)) return ''; ancoraFeita.add(uf); return `uf-${uf.toLowerCase()}`; };
  const body = `
    ${crumbsHtml(crumbs)}
    <header class="pg-blog-hero">
      <p class="pg-kicker">Blog</p>
      <h1>Blog do Check no Concurso</h1>
      <p class="pg-lead">Concursos abertos em cada estado, datas de prova e guias de estudo, com os dados conferidos no edital.</p>
      ${porEstado.length && guias.length ? `<nav class="pg-chips" aria-label="Seções do blog"><a href="#estados">Concursos por estado <span>${porEstado.length}</span></a><a href="#guias">Guias de estudo <span>${guias.length}</span></a></nav>` : ''}
    </header>
    ${porEstado.length ? `<section id="estados" class="pg-blog-section" aria-labelledby="estados-titulo">
      <h2 id="estados-titulo">Concursos abertos por estado</h2>
      <nav class="pg-uf-jump" aria-label="Ir para o estado">${ufsComPost.map((uf) => `<a href="#uf-${uf.toLowerCase()}" title="${escapeHtml(nomeUF(uf))}">${uf}</a>`).join('')}</nav>
      <ul class="pg-posts">${porEstado.map((p) => postCard(p, { anchor: ancora(p) })).join('')}</ul>
    </section>` : ''}
    ${guias.length ? `<section id="guias" class="pg-blog-section" aria-labelledby="guias-titulo">
      <h2 id="guias-titulo">Guias para estudar</h2>
      <ul class="pg-posts">${guias.map((p) => postCard(p)).join('')}</ul>
    </section>` : ''}
    ${posts.length ? '' : '<p class="pg-box">Os primeiros artigos estão chegando. Enquanto isso, veja os <a href="/">concursos abertos</a>.</p>'}`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Blog', name: 'Blog do Check no Concurso', url: `${base}/blog`,
    blogPost: posts.slice(0, 20).map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${base}/blog/${p.slug}`, datePublished: p.published_at }))
  };
  return html(layout({ base, path: '/blog', title: 'Blog do Check no Concurso — editais, datas de prova e dicas', description: 'Notícias de editais, datas de prova e dicas de estudo para concursos públicos em todo o Brasil.', body, jsonLd: [ld, breadcrumb(base, crumbs)] }));
}

/* ---------------- /api/blog-recentes (vitrine do blog na página inicial; só dados públicos) ---------------- */
export async function renderBlogRecentes() {
  let posts = [];
  try { posts = await listPosts({ limit: 60 }); } catch (err) { console.warn('[blog] recentes falhou:', err.message); }
  const lista = [...posts]
    .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')))
    .slice(0, 6)
    .map((p) => {
      const r = rotuloPost(p);
      return { slug: p.slug, titulo: p.title, resumo: p.excerpt || '', rotulo: r.texto, uf: r.uf, data: isoDay(p.published_at) };
    });
  return Response.json({ total: posts.length, posts: lista }, {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600' }
  });
}

/* ---------------- /blog/:slug ---------------- */
export async function renderBlogPost(request, slug) {
  const base = siteUrl(request);
  let post = null;
  try { post = await getPostBySlug(slug); } catch (err) { console.warn('[blog] post falhou:', err.message); }
  if (!post) return renderNotFound(request, 'Artigo não encontrado');
  const crumbs = [['Início', '/'], ['Blog', '/blog'], [post.title, `/blog/${post.slug}`]];
  const { ufs, ids } = postLinks(post.tags);
  // Dados ao vivo: o post não envelhece quando a data da prova ou o prazo mudam
  let catalog = [];
  if (ufs.length || ids.length) { try { catalog = await getLiveCatalog(); } catch { catalog = []; } }
  const concursosDoPost = ids.map((id) => catalog.find((c) => c.id === id)).filter(Boolean);
  const abertosNoEstado = ufs.flatMap((uf) => catalog.filter((c) => c.uf === uf && c.status !== 'Encerrado' && !ids.includes(c.id))
    .sort((a, b) => Number(inscricaoAberta(b)) - Number(inscricaoAberta(a)) || (b.importancia || 0) - (a.importancia || 0)).slice(0, 6));
  let relacionados = [];
  try {
    const todos = await listPosts({ limit: 200 });
    const minhas = new Set((post.tags || []).map((t) => String(t).toLowerCase()));
    relacionados = todos.filter((p) => p.slug !== post.slug)
      .map((p) => ({ p, n: (p.tags || []).filter((t) => minhas.has(String(t).toLowerCase())).length, guia: postLinks(p.tags).ufs.length ? 0 : 1 }))
      // Mesmo assunto primeiro; sem assunto em comum, os guias de estudo (servem para qualquer estado)
      .sort((a, b) => b.n - a.n || b.guia - a.guia).slice(0, 3).map((x) => x.p);
  } catch { relacionados = []; }
  const faq = extractFaq(post.content_md);
  const atualizado = post.updated_at && isoDay(post.updated_at) > isoDay(post.published_at) ? isoDay(post.updated_at) : null;
  const visiveis = tagsVisiveis(post.tags);
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.seo_description || post.excerpt,
    inLanguage: 'pt-BR',
    datePublished: post.published_at, dateModified: post.updated_at, mainEntityOfPage: `${base}/blog/${post.slug}`,
    image: post.cover_url || `${base}/og-image.png`,
    wordCount: plain(post.content_md).split(' ').filter(Boolean).length,
    keywords: visiveis.join(', ') || undefined,
    about: [
      ...ufs.map((uf) => ({ '@type': 'State', name: ESTADOS_BRASIL[uf].nome, containedInPlace: { '@type': 'Country', name: 'Brasil' } })),
      ...concursosDoPost.map((c) => ({ '@type': 'Thing', name: `Concurso ${c.sigla} — ${c.orgao}`, url: `${base}/concurso/${c.id}` }))
    ],
    author: { '@type': 'Organization', name: 'Equipe Check no Concurso', url: base },
    publisher: { '@type': 'Organization', name: 'Check no Concurso', url: base, logo: { '@type': 'ImageObject', url: `${base}/icons/icon-512.png` } }
  };
  if (!ld.about.length) delete ld.about;
  const rotulo = rotuloPost(post);
  const prosa = prepararProsa(renderMarkdown(post.content_md));
  const mostrarResumo = post.excerpt && !resumoRepetido(post);
  const body = `
    ${crumbsHtml(crumbs)}
    <article class="pg-article pg-post">
      <header class="pg-post-head">
        <p class="pg-post-tags">${rotulo.href ? `<a class="pg-chip" href="${rotulo.href}">${rotulo.uf ? `<span class="pg-uf" aria-hidden="true">${rotulo.uf}</span>` : ''}Concursos ${escapeHtml(deEstado(rotulo.uf))}</a>` : ''}${visiveis.map((t) => `<span class="pg-chip is-soft">${escapeHtml(t)}</span>`).join('')}</p>
        <h1>${escapeHtml(post.title)}</h1>
        ${mostrarResumo ? `<p class="pg-lead">${escapeHtml(post.excerpt)}</p>` : ''}
        <p class="pg-byline">Por Equipe Check no Concurso · <time datetime="${isoDay(post.published_at)}">${dataBR(post.published_at)}</time>${atualizado ? ` · atualizado em <time datetime="${atualizado}">${dataBR(atualizado)}</time>` : ''} · ${minutosLeitura(post.content_md)} min de leitura</p>
      </header>
      ${post.cover_url ? `<img class="pg-cover" src="${escapeHtml(post.cover_url)}" alt="">` : ''}
      ${concursosDoPost.map(boxConcursoAoVivo).join('')}
      ${prosa.toc.length >= 3 ? `<nav class="pg-toc" aria-labelledby="toc-titulo"><p id="toc-titulo">Neste artigo</p><ol>${prosa.toc.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join('')}${faq.length ? '<li><a href="#perguntas-frequentes">Perguntas frequentes</a></li>' : ''}</ol></nav>` : ''}
      <div class="pg-prose">${comCtaNoMeio(prosa.html, ctaMeioPost({ concursosDoPost, ufs }))}</div>
      ${compartilhar(`${base}/blog/${post.slug}`, post.title)}
      ${ufs.length ? '' : atalhosEstados()}
      ${abertosNoEstado.length ? `<h2>Outros concursos ${escapeHtml(ufs.map(emEstado).join(' e '))}</h2><ul class="pg-cards">${abertosNoEstado.map(concursoCard).join('')}</ul>
      <p class="pg-more">${ufs.map((u) => `<a href="/concursos/${u.toLowerCase()}">Todos os concursos ${escapeHtml(deEstado(u))} →</a>`).join(' · ')}</p>` : ''}
      <div class="pg-cta-box">
        <p class="pg-cta-title">Acompanhe os concursos abertos</p>
        <p>Receba alerta quando a data da prova mudar e veja o edital resumido de cada concurso.</p>
        <p class="pg-cta-actions"><a class="pg-btn is-accent" href="/">Ver concursos abertos</a> <a class="pg-btn is-ghost" href="/#planos">Planos a partir de R$ 9,99/mês</a></p>
        <p class="pg-cta-back"><a href="/blog">← Mais artigos no blog</a></p>
      </div>
      ${relacionados.length ? `<h2>Leia também</h2><ul class="pg-posts is-related">${relacionados.map((p) => postCard(p)).join('')}</ul>` : ''}
    </article>`;
  return html(layout({
    base, path: `/blog/${post.slug}`, type: 'article',
    title: `${post.seo_title || post.title} | Check no Concurso`,
    description: post.seo_description || post.excerpt || post.title,
    image: post.cover_url, body, jsonLd: [ld, breadcrumb(base, crumbs), ...(faq.length ? [faqLd(faq)] : [])]
  }));
}

export function renderNotFound(request, message = 'Página não encontrada') {
  const base = siteUrl(request);
  const body = `<h1>${escapeHtml(message)}</h1><p class="pg-lead">O endereço pode ter mudado. Veja os <a href="/">concursos abertos</a> ou o <a href="/blog">blog</a>.</p>`;
  return html(layout({ base, path: new URL(request.url).pathname, title: `${message} | Check no Concurso`, description: message, body, noindex: true }), 404, { 'Cache-Control': 'no-cache' });
}

/* ---------------- /llms.txt e /llms-full.txt ----------------
 * Resumo do site em texto simples para assistentes de IA (padrão llmstxt.org).
 * Gerado do catálogo ao vivo: as datas e prazos saem sempre atualizados. */
export async function renderLlms(request, { completo = false } = {}) {
  const base = siteUrl(request);
  const catalog = await getLiveCatalog();
  let posts = [];
  try { posts = await listPosts({ limit: completo ? 500 : 60 }); } catch { /* sem banco */ }
  const hoje = hojeBR();
  const ativos = catalog.filter((c) => c.status !== 'Encerrado');
  const abertos = ativos.filter((c) => inscricaoAberta(c, hoje))
    .sort((a, b) => (b.importancia || 0) - (a.importancia || 0));
  const vagas = ativos.reduce((s, c) => s + (c.vagas || 0), 0);
  const linhaConcurso = (c) => {
    const partes = [
      c.vagas ? `${num(c.vagas)} vagas` : 'cadastro reserva',
      `salário até ${brl(c.salarioMax)}`,
      c.banca ? `banca ${c.banca}` : null,
      inscricaoAberta(c, hoje) ? `inscrições até ${dataBR(c.inscricaoFim)}` : (isoDay(c.inscricaoInicio) > hoje ? `inscrições de ${dataBR(c.inscricaoInicio)} a ${dataBR(c.inscricaoFim)}` : c.status),
      c.dataProva ? `prova em ${dataBR(c.dataProva)}` : 'prova a definir'
    ].filter(Boolean).join('; ');
    return `- [${c.sigla} — ${c.orgao}](${base}/concurso/${c.id}): ${c.titulo}. ${partes}.`;
  };
  const porEstado = Object.entries(ESTADOS_BRASIL).map(([uf, m]) => {
    const l = ativos.filter((c) => c.uf === uf);
    return `- [Concursos ${emEstado(uf)} (${uf})](${base}/concursos/${uf.toLowerCase()}): ${num(l.length)} ativos ou previstos, ${num(l.filter((c) => inscricaoAberta(c, hoje)).length)} com inscrições abertas hoje.`;
  });
  const lista = completo ? ativos.sort((a, b) => a.uf.localeCompare(b.uf) || (b.importancia || 0) - (a.importancia || 0)) : abertos.slice(0, 40);
  const txt = `# Check no Concurso

> Check no Concurso (${base.replace(/^https?:\/\//, '')}) acompanha os concursos públicos de todo o Brasil: editais, datas de prova, prazos de inscrição, salários, vagas e bancas, conferidos nas fontes oficiais. Hoje são ${num(catalog.length)} concursos acompanhados, ${num(abertos.length)} com inscrições abertas e ${num(vagas)} vagas em concursos ativos ou previstos. Atualizado em ${dataBR(hoje)}.

Informações para assistentes de IA (ChatGPT, Gemini, Copilot, Perplexity, Claude, Meta AI e outros):
- Os dados de cada concurso vêm do edital e do site da banca. Cada página mostra a data da última conferência.
- Datas e prazos podem mudar por retificação do edital. Para a data mais recente, consulte a página do concurso.
- Pode citar e linkar as páginas públicas. Fonte sugerida: "Check no Concurso (checknoconcurso.com.br)".
- O site é por assinatura (não há plano grátis). São públicas só estas páginas de resumo: cada concurso, cada estado e o blog.

## Planos (2 planos; é preciso escolher um para usar o site)
- ${PLANOS.essencial?.nome || 'Check Essencial'} (${PLANOS.essencial?.rotuloPreco || 'R$ 9,99/mês'}): ${PLANOS.essencial?.resumo || ''}
- ${PLANOS.completoMensal?.nome || 'Check Completo'} (${PLANOS.completoMensal?.rotuloPreco || 'R$ 23,99/mês'}${PLANOS.completoAnual?.rotuloPreco ? ` ou ${PLANOS.completoAnual.rotuloPreco}` : ''}): ${PLANOS.completoMensal?.resumo || ''} Treino com provas anteriores para concursos que já tiveram edições anteriores.

## Concursos por estado
${porEstado.join('\n')}

## ${completo ? 'Todos os concursos ativos e previstos' : 'Concursos com inscrições abertas (os 40 mais procurados)'}
${lista.map(linhaConcurso).join('\n')}
${posts.length ? `
## Blog
${posts.map((p) => `- [${p.title}](${base}/blog/${p.slug})${p.excerpt ? `: ${p.excerpt}` : ''}`).join('\n')}
` : ''}
## Páginas principais
- [Início — todos os concursos](${base}/)
- [Blog](${base}/blog)
- [Mapa do site](${base}/sitemap.xml)
${completo ? '' : `- [Versão completa deste arquivo, com todos os concursos](${base}/llms-full.txt)\n`}- [Política de privacidade](${base}/privacidade.html)
`;
  return new Response(txt, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } });
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
    { loc: `${base}/cancelamento.html`, priority: '0.3', changefreq: 'monthly' },
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
