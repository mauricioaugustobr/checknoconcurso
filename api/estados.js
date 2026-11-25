import { getEstadosPayload, jsonResponse } from '../lib/catalog-api.js';

export function GET() {
  try {
    return jsonResponse(getEstadosPayload());
  } catch (err) {
    console.error('[api/estados] error:', err);
    return jsonResponse({ error: 'Erro interno no servidor' }, 500);
  }
}
