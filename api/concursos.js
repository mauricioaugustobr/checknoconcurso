import { getConcursosPayload, jsonResponse } from '../lib/catalog-api.js';
import { getLiveCatalog } from '../lib/catalog-overrides.js';
import { exigirPlano, lerIndiceProvas, lerProvaArquivo, NIVEL } from '../lib/acesso.js';
import { getProva } from '../public/js/data/provas.js';
import { handleProgresso } from '../lib/progresso.js';
import { aplicarPadroes, aplicarPadroesIndice } from '../lib/materias.js';

// Conteúdo pago: nunca fica em cache compartilhado (cada resposta depende da sessão)
const privado = (res) => {
  res.headers.set('Cache-Control', 'private, no-store');
  res.headers.set('Vary', 'Cookie');
  return res;
};

/**
 * /api/concursos              → catálogo completo (plano Essencial ou Completo)
 * /api/provas  (tipo=provas)  → índice das provas para treinar (qualquer plano)
 * /api/prova/:id (tipo=prova) → prova completa com gabarito (plano Completo)
 * /api/progresso (tipo=progresso) → progresso das provas salvo na conta (GET e POST, plano Completo)
 * Uma função só, por causa do limite de funções do plano Hobby da Vercel.
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo');

    if (tipo === 'progresso') return await handleProgresso(request);

    if (tipo === 'prova') {
      const { response } = await exigirPlano(request, NIVEL.completo);
      if (response) return response;
      const id = url.searchParams.get('c') || '';
      const prova = getProva(id) || lerProvaArquivo(id);
      if (!prova || id === 'index') return privado(jsonResponse({ error: 'Prova não encontrada.' }, 404));
      // Banca e matéria com nome padronizado (o arquivo da prova continua como veio do caderno)
      return privado(jsonResponse(aplicarPadroes(prova.id ? prova : { ...prova, id })));
    }

    const { response } = await exigirPlano(request, NIVEL.essencial);
    if (response) return response;

    if (tipo === 'provas') return privado(jsonResponse(aplicarPadroesIndice(lerIndiceProvas())));

    // Catálogo com os ajustes feitos no painel de admin (sem os concursos ocultos)
    const items = await getLiveCatalog();
    return privado(jsonResponse(getConcursosPayload(url.searchParams, items)));
  } catch (err) {
    console.error('[api/concursos] error:', err);
    return jsonResponse({ error: 'Erro interno no servidor' }, 500);
  }
}

// Só o progresso das provas aceita envio (as outras rotas desta função são de leitura)
export async function POST(request) {
  try {
    if (new URL(request.url).searchParams.get('tipo') !== 'progresso') {
      return jsonResponse({ error: 'Método não permitido' }, 405);
    }
    return await handleProgresso(request);
  } catch (err) {
    console.error('[api/concursos] progresso error:', err);
    return privado(jsonResponse({ error: 'Erro interno no servidor' }, 500));
  }
}
