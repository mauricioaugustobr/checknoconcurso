import { computeStats, jsonResponse } from '../lib/catalog-api.js';

export function GET() {
  try {
    return jsonResponse(computeStats());
  } catch (err) {
    console.error('[api/stats] error:', err);
    return jsonResponse({ error: 'Erro interno no servidor' }, 500);
  }
}
