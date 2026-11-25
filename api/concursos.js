import { getConcursosPayload, jsonResponse } from '../lib/catalog-api.js';
import { getLiveCatalog } from '../lib/catalog-overrides.js';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    // Catálogo com os ajustes feitos no painel de admin (sem os concursos ocultos)
    const items = await getLiveCatalog();
    return jsonResponse(getConcursosPayload(url.searchParams, items));
  } catch (err) {
    console.error('[api/concursos] error:', err);
    return jsonResponse({ error: 'Erro interno no servidor' }, 500);
  }
}
