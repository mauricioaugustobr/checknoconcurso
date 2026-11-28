// Uma só função para todo o painel de admin (limite de funções do plano Hobby da Vercel).
// /api/admin/:acao → /api/admin?acao=:acao (vercel.json)
import { handleOverview, handleUsers, handleAudit, handleAdminConcursos, handleAdminPosts, handleCancelamentos, handleNotas, handleMetricas } from '../lib/admin-api.js';
import { authJson as json } from '../lib/auth.js';

const ACOES = {
  overview: handleOverview,
  metricas: handleMetricas,
  users: handleUsers,
  audit: handleAudit,
  concursos: handleAdminConcursos,
  posts: handleAdminPosts,
  cancelamentos: handleCancelamentos,
  notas: handleNotas
};

function route(request) {
  const acao = new URL(request.url).searchParams.get('acao');
  const handler = ACOES[acao];
  if (!handler) return json({ error: 'Rota do admin não encontrada' }, 404, { 'X-Robots-Tag': 'noindex' });
  return handler(request);
}

export const GET = route;
export const POST = route;
export const PUT = route;
export const DELETE = route;
