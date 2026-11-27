/**
 * Item 7 · /og/concurso/<id>.png (prévia 1200 × 630) e /og/stories/<id>.png (Stories 1080 × 1920).
 * Entra na função api/page.js (limite de 12 funções do plano Hobby da Vercel).
 * Concurso inexistente ou erro: devolve a imagem genérica do site (nunca deixa o link sem prévia).
 */
import { getLiveCatalog } from './catalog-overrides.js';
import { origemValida } from './plano-origem.js';

const png = (buf, cache) => new Response(buf, { status: 200, headers: { 'Content-Type': 'image/png', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' } });

export async function renderImagemConcurso(request, formatoParam, arquivoParam) {
  const formato = formatoParam === 'stories' ? 'stories' : 'previa';
  const id = origemValida(String(arquivoParam || '').replace(/\.png$/i, ''));
  const generica = () => Response.redirect(new URL('/og-image.png', request.url), 302);
  if (!id) return generica();
  try {
    const c = (await getLiveCatalog()).find((x) => x.id === id);
    if (!c) return generica();
    // Carrega o gerador só aqui: as páginas HTML desta função não pagam o custo de abrir o satori/resvg
    const { gerarImagem } = await import('./og-imagem.js');
    const buf = await gerarImagem(c, formato);
    // O endereço muda (?v=data de atualização) quando o concurso muda: pode guardar por bastante tempo
    return png(buf, 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400');
  } catch (err) {
    console.error('[og] erro ao gerar imagem:', err);
    return generica();
  }
}
