// Uma só função para as páginas lidas pelo Google (limite de funções do plano Hobby da Vercel).
// /concurso/:id, /concursos/:uf, /blog, /blog/:slug, /sitemap.xml, /llms.txt e /llms-full.txt chegam aqui pelo vercel.json.
import { renderConcursoPage, renderEstadoPage, renderBlogIndex, renderBlogPost, renderBlogRecentes, renderSitemap, renderNotFound, renderLlms } from '../lib/pages.js';
import { renderImagemConcurso } from '../lib/og-rota.js';

export function GET(request) {
  const p = new URL(request.url).searchParams;
  switch (p.get('tipo')) {
    case 'concurso': return renderConcursoPage(request, p.get('id') || '');
    case 'estado': return renderEstadoPage(request, p.get('uf') || '');
    case 'blog': return p.get('slug') ? renderBlogPost(request, p.get('slug')) : renderBlogIndex(request);
    case 'blog-recentes': return renderBlogRecentes(request);
    case 'sitemap': return renderSitemap(request);
    case 'llms': return renderLlms(request, { completo: p.get('completo') === '1' });
    // Item 7: imagens de compartilhamento (/og/concurso/<id>.png e /og/stories/<id>.png)
    case 'og': return renderImagemConcurso(request, p.get('formato'), p.get('arquivo'));
    default: return renderNotFound(request);
  }
}
