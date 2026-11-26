// Resposta comentada (3 parágrafos) de cada questão de prova anterior. A chave da OpenAI fica só no servidor.
import { handleExplicacao } from '../lib/explicacao.js';

export async function GET(request) {
  try {
    return await handleExplicacao(request);
  } catch (err) {
    console.error('[api/explicacao] erro:', err.message);
    return Response.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
