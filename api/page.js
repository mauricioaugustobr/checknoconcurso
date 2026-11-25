// Uma só função para as páginas lidas pelo Google (limite de funções do plano Hobby da Vercel).
// /concurso/:id, /concursos/:uf, /blog, /blog/:slug e /sitemap.xml chegam aqui pelo vercel.json.
import { renderConcursoPage, renderEstadoPage, renderBlogIndex, renderBlogPost, renderSitemap, renderNotFound } from '../lib/pages.js';

export function GET(request) {
  const p = new URL(request.url).searchParams;
  switch (p.get('tipo')) {
    case 'concurso': return renderConcursoPage(request, p.get('id') || '');
    case 'estado': return renderEstadoPage(request, p.get('uf') || '');
    case 'blog': return p.get('slug') ? renderBlogPost(request, p.get('slug')) : renderBlogIndex(request);
    case 'sitemap': return renderSitemap(request);
    default: return renderNotFound(request);
  }
}
