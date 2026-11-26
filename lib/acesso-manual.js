/**
 * Liberação e bloqueio manual de usuários pelo admin — Check no Concurso (só no servidor).
 *
 * Tabela cnc_user_access (uma linha por e-mail):
 *  - modo 'bloqueado': a conta perde o acesso mesmo que tenha pago, e não consegue comprar.
 *  - modo 'liberado': a conta ganha o plano escolhido (essencial ou completo) sem pagamento,
 *    até a data "ate" (ou sem prazo, se vazia). Se ela tiver um plano pago maior, vale o maior.
 *  - sem linha: o acesso segue só o pagamento (automático).
 * A conta de admin nunca é bloqueada por aqui (a trava do admin vem do e-mail na Vercel).
 */
import { db } from './db.js';

export const TIERS_LIBERAVEIS = { essencial: 'essencial', completo: 'completo-mensal' };
const NIVEL = { essencial: 1, 'completo-mensal': 2, 'completo-anual': 2 };

let schema;
function ready(sql) {
  return (schema ||= sql`create table if not exists cnc_user_access (
      email text primary key,
      modo text not null check (modo in ('liberado', 'bloqueado')),
      tier text,
      ate timestamptz,
      nota text,
      actor_email text,
      updated_at timestamptz default now())`.catch((err) => {
    schema = null;
    throw err;
  }));
}

/** Regra manual vigente para o e-mail (ou null). Liberação vencida é ignorada. */
export async function getManualAccess(email) {
  const sql = db();
  if (!sql || !email) return null;
  await ready(sql);
  const [row] = await sql`select email, modo, tier, ate, nota, updated_at from cnc_user_access where email = ${String(email).toLowerCase()}`;
  if (!row) return null;
  if (row.modo === 'liberado' && row.ate && new Date(row.ate) <= new Date()) return null;
  return row;
}

export async function listManualAccess() {
  const sql = db();
  if (!sql) return [];
  await ready(sql);
  return sql`select email, modo, tier, ate, nota, actor_email, updated_at from cnc_user_access`;
}

/**
 * acao: 'liberar' (com plano 'essencial' ou 'completo' e data opcional), 'bloquear' ou 'automatico' (apaga a regra).
 */
export async function setManualAccess(email, { acao, plano, ate, nota } = {}, actorEmail = null) {
  const sql = db();
  if (!sql) throw new Error('Banco de dados não configurado');
  await ready(sql);
  const alvo = String(email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(alvo)) throw new Error('E-mail inválido.');
  const obs = String(nota || '').trim().slice(0, 300) || null;
  if (acao === 'automatico') {
    await sql`delete from cnc_user_access where email = ${alvo}`;
    return { email: alvo, modo: null };
  }
  if (acao === 'bloquear') {
    await sql`insert into cnc_user_access (email, modo, tier, ate, nota, actor_email, updated_at)
      values (${alvo}, 'bloqueado', null, null, ${obs}, ${actorEmail}, now())
      on conflict (email) do update set modo = 'bloqueado', tier = null, ate = null, nota = excluded.nota,
        actor_email = excluded.actor_email, updated_at = now()`;
    return { email: alvo, modo: 'bloqueado' };
  }
  if (acao === 'liberar') {
    const tier = TIERS_LIBERAVEIS[plano];
    if (!tier) throw new Error('Escolha o plano a liberar: Essencial ou Completo.');
    let limite = null;
    if (ate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ate))) throw new Error('Data inválida.');
      limite = new Date(`${ate}T23:59:59-03:00`);
      if (Number.isNaN(limite.getTime()) || limite <= new Date()) throw new Error('A data final precisa ser no futuro.');
    }
    await sql`insert into cnc_user_access (email, modo, tier, ate, nota, actor_email, updated_at)
      values (${alvo}, 'liberado', ${tier}, ${limite ? limite.toISOString() : null}::timestamptz, ${obs}, ${actorEmail}, now())
      on conflict (email) do update set modo = 'liberado', tier = excluded.tier, ate = excluded.ate,
        nota = excluded.nota, actor_email = excluded.actor_email, updated_at = now()`;
    return { email: alvo, modo: 'liberado', tier, ate: limite };
  }
  throw new Error('Ação inválida.');
}

/** Aplica a regra manual sobre o plano pago já calculado. */
export function aplicarRegraManual(user, regra) {
  if (!regra || user?.role === 'admin') return user;
  if (regra.modo === 'bloqueado') {
    return { ...user, plan: null, planMethod: null, planStatus: null, planRenewsAt: null, bloqueado: true };
  }
  if (regra.modo === 'liberado' && (NIVEL[regra.tier] || 0) > (NIVEL[user.plan] || 0)) {
    return { ...user, plan: regra.tier, planMethod: 'Liberado pelo admin', planStatus: 'active', planRenewsAt: regra.ate || null, planCancelAtPeriodEnd: Boolean(regra.ate) };
  }
  return user;
}
