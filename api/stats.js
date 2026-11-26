import { computeStats, jsonResponse } from '../lib/catalog-api.js';
import { getLiveCatalog } from '../lib/catalog-overrides.js';
import { lerIndiceProvas } from '../lib/acesso.js';

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
