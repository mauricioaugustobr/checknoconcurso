/**
 * Trava de plano no servidor — Check no Concurso.
 * Não existe plano grátis: o catálogo de concursos exige o Check Essencial (ou superior)
 * e as provas anteriores e as explicações exigem o Check Completo.
 * O plano vem sempre do servidor (sessão do Google + assinatura no banco); nunca do navegador.
 *
 * Para abrir o site temporariamente (ex.: manutenção do pagamento), defina na Vercel
 * CNC_ACESSO_LIVRE=1. Sem banco e fora da Vercel (desenvolvimento local), a trava fica desligada.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSessionUser, withPlan } from './auth.js';
import { hasDatabase } from './db.js';

export const NIVEL = { nenhum: 0, essencial: 1, completo: 2 };
const NIVEL_POR_TIER = { essencial: 1, 'completo-mensal': 2, 'completo-anual': 2 };

export function travaLigada() {
  if (process.env.CNC_ACESSO_LIVRE === '1') return false;
  if (process.env.CNC_ACESSO_LIVRE === '0') return true;
  return Boolean(process.env.VERCEL || hasDatabase());
}

/** { user, tier, nivel } de quem fez o pedido. Admin tem acesso total. */
export async function getAcesso(request) {
  if (!travaLigada()) return { user: null, tier: 'livre', nivel: NIVEL.completo, livre: true };
  const sessao = getSessionUser(request);
  if (!sessao) return { user: null, tier: null, nivel: NIVEL.nenhum };
  if (sessao.role === 'admin') return { user: sessao, tier: 'admin', nivel: NIVEL.completo };
  const user = await withPlan(sessao);
  return { user, tier: user.plan || null, nivel: NIVEL_POR_TIER[user.plan] || NIVEL.nenhum };
}

function negado(status, error, codigo) {
  return new Response(JSON.stringify({ error, codigo }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
  });
}

/** Exige um nível de plano. Retorna { acesso } ou { response } com o erro pronto. */
export async function exigirPlano(request, nivelMinimo = NIVEL.essencial) {
  const acesso = await getAcesso(request);
  if (acesso.nivel >= nivelMinimo) return { acesso };
  if (!acesso.user) return { response: negado(401, 'Entre com sua conta e escolha um plano para usar o Check no Concurso.', 'login') };
  return {
    response: nivelMinimo >= NIVEL.completo
      ? negado(403, 'O treino com questões de provas anteriores é do plano Check Completo.', 'completo')
      : negado(403, 'Escolha um plano para usar o Check no Concurso.', 'plano')
  };
}

/* ---------- Provas anteriores (lidas do disco do servidor; não ficam públicas) ---------- */
const PASTA_PROVAS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'provas');
const cacheProvas = new Map();

export function lerProvaArquivo(id) {
  if (!/^[a-z0-9-]{3,80}$/i.test(String(id || ''))) return null;
  if (cacheProvas.has(id)) return cacheProvas.get(id);
  try {
    const dados = JSON.parse(fs.readFileSync(path.join(PASTA_PROVAS, `${id}.json`), 'utf8'));
    cacheProvas.set(id, dados);
    return dados;
  } catch {
    return null;
  }
}

export function lerIndiceProvas() {
  return lerProvaArquivo('index') || {};
}
