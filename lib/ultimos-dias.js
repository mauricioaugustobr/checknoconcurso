/**
 * Item 8 · /api/ultimos-dias (público): concursos que fecham as inscrições nos próximos 7 dias.
 * Só campos que as páginas públicas /concurso/<id> e /concursos/<uf> já mostram.
 */
import { getLiveCatalog } from './catalog-overrides.js';
import { fechamEm7, hojeBR } from '../public/js/ultimos-dias.js';

const isoDay = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : null));
export const camposPublicos = (c) => ({
  id: c.id, sigla: c.sigla, titulo: c.titulo, uf: c.uf, status: c.status,
  vagas: c.vagas || 0, vagasCR: c.vagasCR || 0, salarioMax: c.salarioMax || 0,
  inscricaoInicio: isoDay(c.inscricaoInicio), inscricaoFim: isoDay(c.inscricaoFim), importancia: c.importancia || 0
});

export async function ultimosDiasPayload(hoje = hojeBR()) {
  const catalogo = (await getLiveCatalog()).map(camposPublicos);
  return { hoje, itens: fechamEm7(catalogo, hoje) };
}

export async function handleUltimosDias() {
  const body = await ultimosDiasPayload();
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=600' }
  });
}
