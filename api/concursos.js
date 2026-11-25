import { getConcursosPayload, jsonResponse } from '../lib/catalog-api.js';

export function GET(request) {
  try {
    const url = new URL(request.url);
    return jsonResponse(getConcursosPayload(url.searchParams));
  } catch (err) {
    console.error('[api/concursos] error:', err);
    return jsonResponse({ error: 'Erro interno no servidor' }, 500);
  }
}
