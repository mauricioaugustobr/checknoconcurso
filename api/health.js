import { getHealthPayload, jsonResponse } from '../lib/catalog-api.js';

export function GET() {
  try {
    return jsonResponse(getHealthPayload());
  } catch (err) {
    console.error('[api/health] error:', err);
    return jsonResponse({ error: 'Erro interno no servidor' }, 500);
  }
}
