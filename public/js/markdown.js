/**
 * Markdown simples e seguro para os posts do blog.
 * Todo HTML digitado é escapado; só geramos as tags abaixo.
 * Suporta: # ## ### títulos, parágrafos, listas (- e 1.), **negrito**, *itálico*,
 * [link](https://...), > citação, --- linha e imagens ![alt](https://...).
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url) {
  const u = String(url || '').trim();
  if (/^https?:\/\//i.test(u) || u.startsWith('/')) return u.replace(/"/g, '%22');
  return '#';
}

function inline(text) {
  let s = escapeHtml(text);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => `<img src="${safeUrl(url.replace(/&amp;/g, '&'))}" alt="${alt}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const href = safeUrl(url.replace(/&amp;/g, '&'));
    const ext = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${href}"${ext}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s;
}

export function renderMarkdown(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let para = [];
  let list = null; // { type: 'ul'|'ol', items: [] }

  const flushPara = () => { if (para.length) { html.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => {
    if (list) { html.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`); list = null; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushPara(); flushList();
      const level = m[1].length + 1; // # vira h2 (o h1 é o título do post)
      html.push(`<h${level}>${inline(m[2])}</h${level}>`);
    } else if (/^---+$/.test(line.trim())) {
      flushPara(); flushList(); html.push('<hr>');
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); flushList(); html.push(`<blockquote>${inline(m[1])}</blockquote>`);
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(m[1]);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(m[1]);
    } else {
      flushList(); para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return html.join('\n');
}

export function slugify(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'post';
}
