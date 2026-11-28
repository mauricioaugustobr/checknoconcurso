import { computeStats, jsonResponse } from '../lib/catalog-api.js';
import { getLiveCatalog } from '../lib/catalog-overrides.js';
import { lerIndiceProvas } from '../lib/acesso.js';
import { handleUso } from '../lib/metricas.js';

// Números públicos do topo do site (só totais; o catálogo exige plano)
export async function GET() {
  try {
    const stats = computeStats(await getLiveCatalog());
    return jsonResponse({ ...stats, provasParaTreinar: Object.keys(lerIndiceProvas()).length });
  } catch (err) {
    console.error('[api/stats] error:', err);
    return jsonResponse({ error: 'Erro interno no servidor' }, 500);
  }
}

// Contador de acessos do painel de admin: POST /api/uso → /api/stats?acao=uso (vercel.json).
// Mesma função para não passar do limite de funções da Vercel.
export async function POST(request) {
  try {
    if (new URL(request.url).searchParams.get('acao') !== 'uso') return jsonResponse({ error: 'Método não permitido' }, 405);
    return await handleUso(request);
  } catch (err) {
    console.error('[api/stats] uso error:', err);
    return jsonResponse({ ok: false }, 500);
  }
}
