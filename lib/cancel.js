/**
 * Cancelamento de assinatura — Check no Concurso.
 *
 * Rotas (api/stripe.js, para não criar outra função no plano Hobby da Vercel):
 *   POST /api/stripe/cancel   → quem está logado cancela em 1 clique
 *   POST /api/stripe/request  → quem não consegue entrar registra o pedido (o admin vê no painel)
 *
 * Regras:
 *  - Cartão (Stripe): a assinatura é marcada para terminar no fim do período já pago.
 *    Nada é cobrado de novo e o acesso continua até a data final.
 *  - Pix: a compra é única, sem renovação automática. Aqui só registramos a intenção,
 *    para ficar documentado e não haver cobrança futura.
 *  - Nunca cancelamos nada de um e-mail sem sessão daquele e-mail.
 */
import { randomUUID } from 'node:crypto';
import { getSessionUser, authJson as json } from './auth.js';
import { db } from './db.js';
import { stripeApi, stripeMode } from './stripe.js';

const noStore = { 'Cache-Control': 'no-store' };
const ok = (p, s = 200) => json(p, s, noStore);
const fail = (msg, s = 400, extra = {}) => json({ error: msg, ...extra }, s, noStore);

const STATUS_COM_ACESSO = new Set(['active', 'trialing', 'past_due']);

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;
  try { return new URL(origin).host === host; } catch { return false; }
}

let schema = null;
/** Cria a tabela de cancelamentos na primeira chamada (sem migração manual). */
function ready(sql) {
  return (schema ||= sql`
    create table if not exists cnc_cancellations (
      id text primary key,
      account text,
      email text not null,
      name text,
      method text,
      status text not null default 'confirmado',
      access_until timestamptz,
      note text,
      source text,
      requested_at timestamptz default now()
    )`.catch((err) => {
    schema = null;
    throw err;
  }));
}

const iso = (v) => (v ? new Date(v).toISOString() : null);
const dataBR = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null;
};
const protocolo = (id) => String(id).replace(/-/g, '').slice(0, 8).toUpperCase();

function periodEnd(sub) {
  const ts = sub?.current_period_end || sub?.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

/** Assinatura de cartão: marca para não renovar, mantendo o acesso até o fim do período pago. */
async function cancelarCartao(sql, user, email, sub) {
  const atual = iso(sub.current_period_end);
  if (sub.cancel_at_period_end) {
    return ok({ ok: true, method: 'Stripe', ate: atual, jaCancelada: true });
  }
  if (!sub.stripe_subscription_id) {
    return fail('Não encontramos a assinatura no cartão. Registre o pedido abaixo que resolvemos para você.', 409, { manual: true });
  }
  if (stripeMode() !== 'api') {
    return fail('O cancelamento automático não está disponível agora. Use o link "Gerenciar assinatura" do recibo da Stripe ou registre o pedido abaixo.', 503, { manual: true });
  }
  const atualizada = await stripeApi('POST', `/subscriptions/${sub.stripe_subscription_id}`, { cancel_at_period_end: 'true' });
  const ate = periodEnd(atualizada) || atual;
  await sql`update cnc_subscriptions
    set cancel_at_period_end = true, current_period_end = coalesce(${ate}::timestamptz, current_period_end), updated_at = now()
    where email = ${email}`;
  const id = randomUUID();
  await sql`insert into cnc_cancellations (id, account, email, name, method, status, access_until, source)
    values (${id}, ${email}, ${email}, ${user.name || null}, 'Stripe', 'cancelado', ${ate}::timestamptz, 'app')`;
  return ok({ ok: true, method: 'Stripe', ate, jaCancelada: false, protocolo: protocolo(id) });
}

export async function handleCancel(request) {
  if (request.method !== 'POST') return fail('Método não permitido', 405);
  if (!sameOrigin(request)) return fail('Origem não permitida', 403);
  const user = getSessionUser(request);
  if (!user) return fail('Entre com sua conta para cancelar.', 401);
  const sql = db();
  if (!sql) return fail('Não foi possível registrar o cancelamento agora. Tente de novo em instantes.', 503);
  const email = user.email.toLowerCase();
  await ready(sql);

  const [sub] = await sql`select stripe_subscription_id, tier, status, current_period_end, cancel_at_period_end
    from cnc_subscriptions where email = ${email} limit 1`;

  if (sub && STATUS_COM_ACESSO.has(sub.status)) {
    try {
      return await cancelarCartao(sql, user, email, sub);
    } catch (err) {
      console.error('[cancel] Stripe falhou:', err.message);
      return fail('Não conseguimos falar com a operadora do cartão agora. Tente de novo em alguns minutos ou registre o pedido abaixo.', 502, { manual: true });
    }
  }

  const [pix] = await sql`select id, plan, ends_at from cnc_pix_orders
    where account = ${email} and ends_at > now() order by ends_at desc limit 1`;

  if (pix) {
    const ate = iso(pix.ends_at);
    const id = randomUUID();
    await sql`insert into cnc_cancellations (id, account, email, name, method, status, access_until, source)
      values (${id}, ${email}, ${email}, ${user.name || null}, 'Pix', 'nao_renova', ${ate}::timestamptz, 'app')`;
    return ok({
      ok: true,
      method: 'Pix',
      ate,
      jaCancelada: true,
      protocolo: protocolo(id),
      mensagem: `Seu pagamento por Pix é único e não renova. Nada mais será cobrado${dataBR(ate) ? ` e você mantém o acesso até ${dataBR(ate)}` : ''}.`
    });
  }

  return fail('Não encontramos uma assinatura ativa nesta conta. Se você pagou com outro e-mail, registre o pedido abaixo.', 404, { manual: true });
}

export async function handleCancelRequest(request) {
  if (request.method !== 'POST') return fail('Método não permitido', 405);
  if (!sameOrigin(request)) return fail('Origem não permitida', 403);
  const sql = db();
  if (!sql) return fail('Não foi possível registrar o pedido agora. Tente de novo em instantes.', 503);

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim().slice(0, 150);
  const note = String(body.note || '').trim().slice(0, 500);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return fail('Informe o e-mail usado na compra.');
  }

  await ready(sql);
  // Mesmo e-mail repetindo o pedido em 1 hora: devolve o protocolo já criado (evita duplicar).
  const [recente] = await sql`select id from cnc_cancellations
    where lower(email) = ${email} and source = 'form' and requested_at > now() - interval '1 hour'
    order by requested_at desc limit 1`;
  if (recente) return ok({ ok: true, protocolo: protocolo(recente.id), repetido: true });

  const id = randomUUID();
  await sql`insert into cnc_cancellations (id, email, name, note, status, source)
    values (${id}, ${email}, ${name || null}, ${note || null}, 'pendente', 'form')`;
  return ok({ ok: true, protocolo: protocolo(id) });
}
