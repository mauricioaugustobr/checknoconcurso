/**
 * Pagamentos com Stripe (assinaturas) — só no servidor.
 * Chaves nas variáveis de ambiente da Vercel: STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET.
 * O navegador nunca vê essas chaves: ele só recebe o link do checkout hospedado pela Stripe.
 *
 * Rotas (api/stripe.js):
 *   POST /api/stripe/checkout  { plan }        → { url } da página de pagamento da Stripe
 *   POST /api/stripe/confirm   { session_id }  → confirma a assinatura na volta do pagamento
 *   POST /api/stripe/portal                    → { url } para gerenciar/cancelar a assinatura
 *   POST /api/stripe/webhook                   → avisos da Stripe (assinatura criada, renovada, cancelada)
 */
import crypto from 'node:crypto';
import { getSessionUser, authJson as json } from './auth.js';
import { db } from './db.js';
import { siteUrl } from './pages.js';

export const PLANOS_STRIPE = {
  essencial: 'cnc_essencial_mensal',
  'completo-mensal': 'cnc_completo_mensal',
  'completo-anual': 'cnc_completo_anual'
};
const TIER_POR_LOOKUP = Object.fromEntries(Object.entries(PLANOS_STRIPE).map(([tier, key]) => [key, tier]));
const STATUS_COM_ACESSO = new Set(['active', 'trialing', 'past_due']);

export function stripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/* ---------- Cliente HTTP da Stripe (sem dependências) ---------- */
function encodeForm(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') encodeForm(item, `${key}[${i}]`, out);
        else out.push(`${encodeURIComponent(`${key}[]`)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof v === 'object') {
      encodeForm(v, key, out);
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
  return out;
}

export async function stripeApi(method, path, params = {}, { fetchImpl = fetch } = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Pagamentos ainda não configurados.');
  const qs = encodeForm(params).join('&');
  const url = `https://api.stripe.com/v1${path}${method === 'GET' && qs ? `?${qs}` : ''}`;
  const res = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-06-20'
    },
    body: method === 'GET' ? undefined : qs
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `Stripe respondeu ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

let priceCache = { at: 0, map: null };
async function getPriceIds() {
  if (priceCache.map && Date.now() - priceCache.at < 10 * 60_000) return priceCache.map;
  const res = await stripeApi('GET', '/prices', { lookup_keys: Object.values(PLANOS_STRIPE), active: 'true', limit: 10 });
  const map = {};
  for (const p of res.data || []) map[p.lookup_key] = p.id;
  priceCache = { at: Date.now(), map };
  return map;
}

/* ---------- Banco: assinaturas ---------- */
export async function getActiveSubscription(email) {
  const sql = db();
  if (!sql || !email) return null;
  const rows = await sql`select email, tier, status, stripe_customer_id, current_period_end, cancel_at_period_end
                         from cnc_subscriptions where email = ${email.toLowerCase()}`;
  const s = rows[0];
  if (!s || !STATUS_COM_ACESSO.has(s.status)) return null;
  return s;
}

async function getCustomerId(email) {
  const sql = db();
  if (!sql) return null;
  const rows = await sql`select stripe_customer_id from cnc_subscriptions where email = ${email.toLowerCase()}`;
  return rows[0]?.stripe_customer_id || null;
}

function periodEnd(sub) {
  const ts = sub.current_period_end || sub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

/** Grava/atualiza a assinatura a partir do objeto subscription da Stripe. */
export async function saveSubscription(sub, fallbackEmail) {
  const sql = db();
  if (!sql) throw new Error('Banco de dados não configurado');
  const email = String(sub.metadata?.email || fallbackEmail || '').toLowerCase();
  if (!email) throw new Error('Assinatura sem e-mail associado');
  const lookup = sub.items?.data?.[0]?.price?.lookup_key || null;
  const tier = TIER_POR_LOOKUP[lookup] || sub.metadata?.tier || 'essencial';
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  await sql`
    insert into cnc_subscriptions (email, tier, status, stripe_customer_id, stripe_subscription_id, price_lookup_key, current_period_end, cancel_at_period_end, updated_at)
    values (${email}, ${tier}, ${sub.status}, ${customer}, ${sub.id}, ${lookup}, ${periodEnd(sub)}::timestamptz, ${Boolean(sub.cancel_at_period_end)}, now())
    on conflict (email) do update set tier = excluded.tier, status = excluded.status,
      stripe_customer_id = excluded.stripe_customer_id, stripe_subscription_id = excluded.stripe_subscription_id,
      price_lookup_key = excluded.price_lookup_key, current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end, updated_at = now()`;
  return { email, tier, status: sub.status };
}

/* ---------- Rotas ---------- */
const noStore = { 'Cache-Control': 'no-store' };
const ok = (p, s = 200) => json(p, s, noStore);
const fail = (m, s = 400) => json({ error: m }, s, noStore);

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function handleCheckout(request) {
  if (request.method !== 'POST') return fail('Método não permitido', 405);
  if (!sameOrigin(request)) return fail('Origem não permitida', 403);
  if (!stripeEnabled()) return fail('Pagamentos ainda não configurados.', 503);
  const user = getSessionUser(request);
  if (!user) return fail('Entre com sua conta para assinar.', 401);
  const body = await request.json().catch(() => ({}));
  const tier = String(body.plan || '');
  const lookup = PLANOS_STRIPE[tier];
  if (!lookup) return fail('Plano inválido.');
  const atual = await getActiveSubscription(user.email).catch(() => null);
  if (atual && atual.tier === tier) return fail('Você já tem esse plano ativo.', 409);
  const prices = await getPriceIds();
  if (!prices[lookup]) return fail('Plano indisponível no momento.', 503);
  const base = siteUrl(request);
  const customer = await getCustomerId(user.email).catch(() => null);
  const meta = { email: user.email.toLowerCase(), tier, app: 'checknoconcurso' };
  const session = await stripeApi('POST', '/checkout/sessions', {
    mode: 'subscription',
    line_items: [{ price: prices[lookup], quantity: 1 }],
    ...(customer ? { customer } : { customer_email: user.email }),
    client_reference_id: user.email.toLowerCase(),
    metadata: meta,
    subscription_data: { metadata: meta },
    allow_promotion_codes: 'true',
    locale: 'pt-BR',
    success_url: `${base}/?assinatura=sucesso&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?assinatura=cancelada`
  });
  return ok({ url: session.url });
}

export async function handleConfirm(request) {
  if (request.method !== 'POST') return fail('Método não permitido', 405);
  if (!sameOrigin(request)) return fail('Origem não permitida', 403);
  const user = getSessionUser(request);
  if (!user) return fail('Entre com sua conta.', 401);
  const body = await request.json().catch(() => ({}));
  const id = String(body.session_id || '');
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return fail('Sessão de pagamento inválida.');
  const session = await stripeApi('GET', `/checkout/sessions/${id}`, { expand: ['subscription'] });
  const dono = String(session.metadata?.email || session.client_reference_id || '').toLowerCase();
  if (dono !== user.email.toLowerCase()) return fail('Este pagamento é de outra conta.', 403);
  if (session.status !== 'complete' || !session.subscription) return ok({ ativo: false, status: session.status });
  const saved = await saveSubscription(session.subscription, dono);
  return ok({ ativo: STATUS_COM_ACESSO.has(saved.status), plan: saved.tier, status: saved.status });
}

export async function handlePortal(request) {
  if (request.method !== 'POST') return fail('Método não permitido', 405);
  if (!sameOrigin(request)) return fail('Origem não permitida', 403);
  const user = getSessionUser(request);
  if (!user) return fail('Entre com sua conta.', 401);
  const customer = await getCustomerId(user.email);
  if (!customer) return fail('Você ainda não tem assinatura.', 404);
  const portal = await stripeApi('POST', '/billing_portal/sessions', { customer, return_url: `${siteUrl(request)}/?assinatura=gerenciada`, locale: 'pt-BR' });
  return ok({ url: portal.url });
}

/** Confere a assinatura do aviso da Stripe (cabeçalho Stripe-Signature). */
export function verifyStripeSignature(payload, header, secret, toleranceSec = 300, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=').map((s) => s.trim())).filter((p) => p.length === 2).map(([k, v]) => [k, v]));
  const t = Number(parts.t);
  const sigs = header.split(',').filter((p) => p.trim().startsWith('v1=')).map((p) => p.trim().slice(3));
  if (!t || !sigs.length) return false;
  if (Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

export async function handleWebhook(request) {
  if (request.method !== 'POST') return fail('Método não permitido', 405);
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) {
    return fail('Assinatura do aviso inválida.', 400);
  }
  const event = JSON.parse(payload);
  const sql = db();
  if (sql) {
    const fresh = await sql`insert into cnc_stripe_events (id, type) values (${event.id}, ${event.type}) on conflict (id) do nothing returning id`;
    if (fresh.length === 0) return ok({ recebido: true, repetido: true });
  }
  const obj = event.data?.object || {};
  try {
    if (event.type === 'checkout.session.completed' && obj.mode === 'subscription' && obj.subscription) {
      const sub = await stripeApi('GET', `/subscriptions/${obj.subscription}`);
      await saveSubscription(sub, obj.metadata?.email || obj.client_reference_id || obj.customer_details?.email);
    } else if (event.type.startsWith('customer.subscription.')) {
      const sub = await stripeApi('GET', `/subscriptions/${obj.id}`).catch(() => obj);
      await saveSubscription(sub, null);
    }
  } catch (err) {
    console.error('[stripe] webhook falhou:', event.type, err.message);
    if (sql) await sql`delete from cnc_stripe_events where id = ${event.id}`; // deixa a Stripe tentar de novo
    return fail('Falha ao processar o aviso.', 500);
  }
  return ok({ recebido: true });
}
