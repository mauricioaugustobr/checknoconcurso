// Seção "Do blog" na página inicial: mostra os artigos mais recentes (dados públicos de /api/blog-recentes).
// Fica aberta para todos, inclusive para quem ainda não assinou.
const lista = document.getElementById('blogStripList');
const secao = document.getElementById('blogStrip');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dataBR = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '');

async function carregar() {
  if (!lista || !secao) return;
  try {
    const r = await fetch('/api/blog-recentes', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const { posts = [] } = await r.json();
    if (!posts.length) { lista.innerHTML = '<li class="blog-strip-empty"><a href="/blog">Abrir o blog →</a></li>'; return; }
    lista.innerHTML = posts.map((p) => `
      <li class="blog-strip-card">
        <a href="/blog/${encodeURIComponent(p.slug)}">
          <span class="blog-strip-label">${p.uf ? `<span class="blog-strip-uf" aria-hidden="true">${esc(p.uf)}</span>` : ''}${esc(p.rotulo)}</span>
          <strong>${esc(p.titulo)}</strong>
          ${p.resumo ? `<span class="blog-strip-excerpt">${esc(p.resumo)}</span>` : ''}
          ${p.data ? `<time datetime="${esc(p.data)}">${dataBR(p.data)}</time>` : ''}
        </a>
      </li>`).join('');
  } catch {
    // Sem os artigos, a seção continua com o botão "Ver todos os artigos"
    lista.innerHTML = '<li class="blog-strip-empty"><a href="/blog">Abrir o blog →</a></li>';
  }
}

carregar();
