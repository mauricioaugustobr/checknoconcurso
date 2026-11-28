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
import { getSessionUser, contaBloqueada, authJson as json } from './auth.js';
import { db } from './db.js';
import { siteUrl } from './pages.js';
import { origemValida } from './plano-origem.js';

export const PLANOS_STRIPE = {
  essencial: 'cnc_essencial_mensal',
  'completo-mensal': 'cnc_completo_mensal',
  'completo-anual': 'cnc_completo_anual'
};
const TIER_POR_LOOKUP = Object.fromEntries(Object.entries(PLANOS_STRIPE).map(([tier, key]) => [key, tier]));
const STATUS_COM_ACESSO = new Set(['active', 'trialing', 'past_due']);

/**
 * Links de pagamento da Stripe (públicos por natureza). Usados quando ainda não há chave secreta:
 * a pessoa paga no link e o aviso assinado da Stripe (webhook) libera o plano.
 * STRIPE_PAYMENT_LINKS (JSON) na Vercel substitui estes, por exemplo ao passar para produção.
 */
const DEFAULT_PAYMENT_LINKS = {
  essencial: 'https://buy.stripe.com/test_aFabIU3lZ8U85Nd5wBe3e00',
  'completo-mensal': 'https://buy.stripe.com/test_9B6eV65u70nCdfF2kpe3e01',
  'completo-anual': 'https://buy.stripe.com/test_14A00caOr9YcejJ2kpe3e02'
};

export function paymentLinks() {
  try {
    if (process.env.STRIPE_PAYMENT_LINKS) return { ...DEFAULT_PAYMENT_LINKS, ...JSON.parse(process.env.STRIPE_PAYMENT_LINKS) };
  } catch { /* JSON inválido: usa os padrões */ }
  return DEFAULT_PAYMENT_LINKS;
}

function hasSecretKey() {
  return /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/.test(String(process.env.STRIPE_SECRET_KEY || '').trim());
}

/** Modo da chave secreta: 'live' (cobrança real), 'test' ou null (sem chave). */
export function modoDaChave() {
  if (!hasSecretKey()) return null;
  return /^(sk|rk)_live_/.test(String(process.env.STRIPE_SECRET_KEY).trim()) ? 'live' : 'test';
}

/** 'api' (chave secreta válida), 'link' (links de pagamento + aviso assinado) ou null (desligado). */
export function stripeMode() {
  if (hasSecretKey()) return 'api';
  if (process.env.STRIPE_WEBHOOK_SECRET && Object.keys(paymentLinks()).length) return 'link';
  return null;
}

export function stripeEnabled() {
  return stripeMode() !== null;
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
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!hasSecretKey()) throw new Error('Pagamentos ainda não configurados.');
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
  const rows = await sql`select email, tier, status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end
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

/* ---------- Item 11: subir do Essencial para o Completo sem cobrança dupla ---------- */
const NIVEL_TIER = { essencial: 1, 'completo-mensal': 2, 'completo-anual': 2 };
const SUB_ID = /^sub_[A-Za-z0-9]+$/;

/**
 * Um aviso de uma assinatura que NÃO é a gravada só pode substituir a gravada quando
 * não rebaixa o plano: a assinatura antiga do Essencial (cancelada ou renovando) não tira o Completo.
 */
export function deveIgnorarAssinatura(atual, sub, tierNovo) {
  if (!atual || !atual.stripe_subscription_id || atual.stripe_subscription_id === sub.id) return false;
  if (!STATUS_COM_ACESSO.has(sub.status)) return true;
  return STATUS_COM_ACESSO.has(atual.status) && (NIVEL_TIER[atual.tier] || 0) > (NIVEL_TIER[tierNovo] || 0);
}

/**
 * Depois que o Completo foi pago, encerra a assinatura do Essencial que ele substitui.
 * A Stripe credita o que sobrou do mês do Essencial na próxima fatura (prorate).
 * Só cancela se a antiga for do mesmo e-mail, do Essencial e ainda estiver ativa.
 */
export async function encerrarAssinaturaSubstituida(sub, email, { api = stripeApi } = {}) {
  const antiga = String(sub.metadata?.substitui || '');
  if (!SUB_ID.test(antiga) || antiga === sub.id || !STATUS_COM_ACESSO.has(sub.status) || !hasSecretKey()) return false;
  const velha = await api('GET', `/subscriptions/${antiga}`);
  const dono = String(velha.metadata?.email || '').toLowerCase();
  const lookup = velha.items?.data?.[0]?.price?.lookup_key || null;
  if (dono !== email || TIER_POR_LOOKUP[lookup] !== 'essencial' || velha.status === 'canceled') return false;
  await api('DELETE', `/subscriptions/${antiga}?prorate=true`);
  console.info('[stripe] Essencial encerrado após subir para o Completo:', antiga);
  return true;
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
  const [atual] = await sql`select tier, status, stripe_subscription_id from cnc_subscriptions where email = ${email}`;
  if (deveIgnorarAssinatura(atual, sub, tier)) return { email, tier: atual.tier, status: atual.status, ignorada: true };
  await sql`
    insert into cnc_subscriptions (email, tier, status, stripe_customer_id, stripe_subscription_id, price_lookup_key, current_period_end, cancel_at_period_end, updated_at)
    values (${email}, ${tier}, ${sub.status}, ${customer}, ${sub.id}, ${lookup}, ${periodEnd(sub)}::timestamptz, ${Boolean(sub.cancel_at_period_end)}, now())
    on conflict (email) do update set tier = excluded.tier, status = excluded.status,
      stripe_customer_id = excluded.stripe_customer_id, stripe_subscription_id = excluded.stripe_subscription_id,
      price_lookup_key = excluded.price_lookup_key, current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end, updated_at = now()`;
  // Subiu do Essencial para o Completo: encerra o Essencial (a confirmação e o aviso tentam; o 2º acha já encerrada)
  await encerrarAssinaturaSubstituida(sub, email).catch((err) => console.error('[stripe] não encerrou o Essencial antigo:', err.message));
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
  if (await contaBloqueada(user.email)) return fail('Esta conta está bloqueada. Fale com o suporte do Check no Concurso.', 403);
  const body = await request.json().catch(() => ({}));
  const tier = String(body.plan || '');
  const origem = origemValida(body.origem);
  const lookup = PLANOS_STRIPE[tier];
  if (!lookup) return fail('Plano inválido.');
  // Padrão do pagamento: nome, CPF ou CNPJ, e-mail e WhatsApp preenchidos antes do cartão (dados da nota fiscal)
  const sqlNota = db();
  if (sqlNota && !dadosDaNotaCompletos(await contatoDaNota(sqlNota, user.email.toLowerCase()))) {
    return fail('Antes de pagar, preencha nome, CPF ou CNPJ, e-mail e WhatsApp na página de pagamento.', 400);
  }
  const atual = await getActiveSubscription(user.email).catch(() => null);
  if (atual && atual.tier === tier) return fail('Você já tem esse plano ativo.', 409);
  if (stripeMode() === 'link') {
    const link = paymentLinks()[tier];
    if (!link) return fail('Plano indisponível no momento.', 503);
    const u = new URL(link);
    u.searchParams.set('prefilled_email', user.email);
    u.searchParams.set('locale', 'pt-BR');
    if (/^[A-Za-z0-9_-]{1,200}$/.test(String(user.sub || ''))) u.searchParams.set('client_reference_id', user.sub);
    return ok({ url: u.toString() });
  }
  const prices = await getPriceIds();
  if (!prices[lookup]) return fail('Plano indisponível no momento.', 503);
  const base = siteUrl(request);
  const customer = await getCustomerId(user.email).catch(() => null);
  const meta = { email: user.email.toLowerCase(), tier, app: 'checknoconcurso' };
  // Item 11: quem tem o Essencial no cartão e sobe para o Completo — o Essencial é encerrado depois do pagamento
  if (atual?.tier === 'essencial' && NIVEL_TIER[tier] > 1 && SUB_ID.test(String(atual.stripe_subscription_id || ''))) {
    meta.substitui = atual.stripe_subscription_id;
  }
  const session = await stripeApi('POST', '/checkout/sessions', {
    mode: 'subscription',
    // Só cartão: o Pix do site tem caminho próprio (Banco Inter); boleto não entra nas assinaturas
    payment_method_types: ['card'],
    line_items: [{ price: prices[lookup], quantity: 1 }],
    ...(customer ? { customer } : { customer_email: user.email }),
    client_reference_id: user.email.toLowerCase(),
    metadata: meta,
    subscription_data: { metadata: meta },
    allow_promotion_codes: 'true',
    locale: 'pt-BR',
    // Veio de uma página de concurso (item 6): volta para a ficha desse concurso
    success_url: `${base}/?assinatura=sucesso&session_id={CHECKOUT_SESSION_ID}${origem ? `&origem=${origem}` : ''}`,
    cancel_url: `${base}/?assinatura=cancelada${origem ? `&origem=${origem}#planos` : ''}`
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
  if (!hasSecretKey()) {
    // Modo link: quem libera é o aviso da Stripe; aqui só conferimos se já chegou
    const sub = await getActiveSubscription(user.email);
    return ok(sub ? { ativo: true, plan: sub.tier, status: sub.status } : { ativo: false, status: 'aguardando' });
  }
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
  if (!hasSecretKey()) return fail('Para alterar ou cancelar, use o link "Gerenciar assinatura" do recibo que a Stripe enviou para o seu e-mail.', 503);
  const configuration = await portalDoCheck();
  const portal = await stripeApi('POST', '/billing_portal/sessions', {
    customer, return_url: `${siteUrl(request)}/?assinatura=gerenciada`, locale: 'pt-BR',
    ...(configuration ? { configuration } : {})
  });
  return ok({ url: portal.url });
}

/* ---------- Conta Stripe dividida com outra marca: só o que é do Check entra aqui ---------- */
let portalCache = { at: 0, id: undefined };
/** Configuração do portal com metadata app=checknoconcurso (nome e textos do Check), se existir. */
export async function portalDoCheck({ api = stripeApi } = {}) {
  if (portalCache.id !== undefined && Date.now() - portalCache.at < 10 * 60_000) return portalCache.id;
  const res = await api('GET', '/billing_portal/configurations', { active: 'true', limit: 20 }).catch(() => ({ data: [] }));
  const cfg = (res.data || []).find((c) => c.metadata?.app === 'checknoconcurso');
  portalCache = { at: Date.now(), id: cfg?.id || null };
  return portalCache.id;
}

/** A assinatura é de um plano do Check? (preço com lookup_key do Check ou metadata app=checknoconcurso) */
export function assinaturaDoCheck(sub) {
  const lookup = sub?.items?.data?.[0]?.price?.lookup_key || null;
  return Boolean(TIER_POR_LOOKUP[lookup] || sub?.metadata?.app === 'checknoconcurso');
}

/** A fatura é de um plano do Check? */
export function faturaDoCheck(inv) {
  const linha = inv?.lines?.data?.[0] || {};
  const lookup = linha.price?.lookup_key || linha.pricing?.price_details?.price_lookup_key || null;
  const meta = inv?.subscription_details?.metadata || inv?.parent?.subscription_details?.metadata || {};
  return Boolean(TIER_POR_LOOKUP[lookup] || meta.app === 'checknoconcurso');
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
  // Aceita mais de um segredo (separados por vírgula): útil ao trocar de conta ou de modo teste/produção
  // STRIPE_WEBHOOK_SECRET_LIVE: segredo do aviso da conta real (modo produção), guardado à parte
  const segredos = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET_LIVE]
    .join(',').split(',').map((x) => x.trim()).filter(Boolean);
  const sigHeader = request.headers.get('stripe-signature');
  if (!segredos.some((sec) => verifyStripeSignature(payload, sigHeader, sec))) {
    return fail('Assinatura do aviso inválida.', 400);
  }
  const event = JSON.parse(payload);
  // Com chave secreta, só vale o aviso do mesmo modo: real com chave real, teste com chave de teste
  const modo = modoDaChave();
  if (modo && Boolean(event.livemode) !== (modo === 'live')) return ok({ recebido: true, ignorado: true });
  const sql = db();
  if (sql) {
    const fresh = await sql`insert into cnc_stripe_events (id, type) values (${event.id}, ${event.type}) on conflict (id) do nothing returning id`;
    if (fresh.length === 0) return ok({ recebido: true, repetido: true });
  }
  const obj = event.data?.object || {};
  try {
    if (event.type === 'invoice.paid') {
      await registrarPagamentoStripe(obj);
    } else if (!hasSecretKey()) {
      await handleEventWithoutKey(event.type, obj);
    } else if (event.type === 'checkout.session.completed' && obj.mode === 'subscription' && obj.subscription) {
      const sub = await stripeApi('GET', `/subscriptions/${obj.subscription}`);
      // Venda de outra marca na mesma conta Stripe: não libera plano no Check
      if (!assinaturaDoCheck(sub) && obj.metadata?.app !== 'checknoconcurso') return ok({ recebido: true, ignorado: true });
      await saveSubscription(sub, obj.metadata?.email || obj.client_reference_id || obj.customer_details?.email);
    } else if (event.type.startsWith('customer.subscription.')) {
      const sub = await stripeApi('GET', `/subscriptions/${obj.id}`).catch(() => obj);
      if (!assinaturaDoCheck(sub)) return ok({ recebido: true, ignorado: true });
      await saveSubscription(sub, null);
    }
  } catch (err) {
    console.error('[stripe] webhook falhou:', event.type, err.message);
    if (sql) await sql`delete from cnc_stripe_events where id = ${event.id}`; // deixa a Stripe tentar de novo
    return fail('Falha ao processar o aviso.', 500);
  }
  return ok({ recebido: true });
}

/* ---------- Pagamentos de cartão recebidos (para o admin ver quem pagou e quanto) ---------- */
let pagamentosSchema;
export function pagamentosReady(sql) {
  return (pagamentosSchema ||= (async () => {
    await sql`create table if not exists cnc_stripe_payments (
      invoice_id text primary key,
      email text not null,
      tier text,
      cents int not null,
      currency text,
      stripe_subscription_id text,
      paid_at timestamptz default now(),
      livemode boolean default false)`;
    // Dados da nota no momento do pagamento (cópia do que a pessoa preencheu no site antes de pagar)
    await sql`alter table cnc_stripe_payments add column if not exists buyer_name text,
      add column if not exists cpf text, add column if not exists contact_email text, add column if not exists phone text`;
  })().catch((err) => {
    pagamentosSchema = null;
    throw err;
  }));
}

/** Os 4 dados da nota (nome, CPF/CNPJ, e-mail e WhatsApp) estão preenchidos? */
export function dadosDaNotaCompletos(c) {
  return Boolean(c && ['buyer_name', 'cpf', 'email', 'phone'].every((k) => String(c[k] || '').trim()));
}

/** Nome, CPF/CNPJ, e-mail e WhatsApp que a pessoa preencheu antes de pagar com cartão (ou nada). */
async function contatoDaNota(sql, conta) {
  try {
    const [c] = await sql`select buyer_name, cpf, email, phone from cnc_billing_contacts where account = ${conta} limit 1`;
    return c || {};
  } catch {
    return {}; // tabela ainda não existe: ninguém preencheu o formulário de cartão
  }
}

/** Grava a fatura paga que vem no aviso assinado da Stripe (evento invoice.paid). */
export async function registrarPagamentoStripe(inv) {
  // Fatura de outra marca na mesma conta Stripe: não entra nos pagamentos nem nas notas do Check
  if (!faturaDoCheck(inv)) return { ignorado: true };
  const sql = db();
  if (!sql) throw new Error('Banco de dados não configurado');
  await pagamentosReady(sql);
  const subId = typeof inv.subscription === 'string' ? inv.subscription : (inv.subscription?.id || inv.parent?.subscription_details?.subscription || null);
  let email = String(inv.customer_email || '').toLowerCase();
  if (!email && subId) {
    const rows = await sql`select email from cnc_subscriptions where stripe_subscription_id = ${subId} limit 1`;
    email = rows[0]?.email || '';
  }
  if (!email) throw new Error('Fatura sem e-mail');
  const linha = inv.lines?.data?.[0] || {};
  const lookup = linha.price?.lookup_key || linha.pricing?.price_details?.price_lookup_key || null;
  const tier = TIER_POR_LOOKUP[lookup] || null;
  const pagoEm = inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : new Date().toISOString();
  const nota = await contatoDaNota(sql, email);
  await sql`insert into cnc_stripe_payments (invoice_id, email, tier, cents, currency, stripe_subscription_id, paid_at, livemode,
      buyer_name, cpf, contact_email, phone)
    values (${inv.id}, ${email}, ${tier}, ${Number(inv.amount_paid || 0)}, ${inv.currency || 'brl'}, ${subId}, ${pagoEm}::timestamptz, ${Boolean(inv.livemode)},
      ${nota.buyer_name || null}, ${nota.cpf || null}, ${nota.email || null}, ${nota.phone || null})
    on conflict (invoice_id) do nothing`;
}

/** Assinaturas de cartão gravadas (todas as situações), para o painel de admin. */
export async function listarAssinaturasStripe() {
  const sql = db();
  if (!sql) return [];
  return sql`select email, tier, status, current_period_end, cancel_at_period_end from cnc_subscriptions`.catch(() => []);
}

/** Pagamentos de cartão por e-mail: total pago, quantidade e último pagamento. */
export async function resumoPagamentosStripe() {
  const sql = db();
  if (!sql) return [];
  await pagamentosReady(sql);
  return sql`select email, sum(cents)::int as cents, count(*)::int as pagamentos, max(paid_at) as ultimo,
      bool_or(livemode) as real from cnc_stripe_payments group by email`;
}

/** Modo link (sem chave secreta): usa só os dados que vêm no próprio aviso assinado da Stripe. */
async function handleEventWithoutKey(type, obj) {
  const sql = db();
  if (!sql) throw new Error('Banco de dados não configurado');
  if (type === 'checkout.session.completed' && obj.mode === 'subscription' && obj.subscription) {
    let email = null;
    if (obj.client_reference_id) {
      const rows = await sql`select email from cnc_users where sub = ${obj.client_reference_id} limit 1`;
      email = rows[0]?.email || null;
    }
    email = String(email || obj.customer_details?.email || obj.customer_email || '').toLowerCase();
    if (!email) throw new Error('Pagamento sem e-mail');
    const tier = PLANOS_STRIPE[obj.metadata?.tier] ? obj.metadata.tier : 'essencial';
    await sql`
      insert into cnc_subscriptions (email, tier, status, stripe_customer_id, stripe_subscription_id, price_lookup_key, updated_at)
      values (${email}, ${tier}, 'active', ${obj.customer || null}, ${obj.subscription}, ${PLANOS_STRIPE[tier]}, now())
      on conflict (email) do update set tier = excluded.tier, status = 'active',
        stripe_customer_id = excluded.stripe_customer_id, stripe_subscription_id = excluded.stripe_subscription_id,
        price_lookup_key = excluded.price_lookup_key, cancel_at_period_end = false, updated_at = now()`;
    return;
  }
  if (type.startsWith('customer.subscription.') && obj.id) {
    const lookup = obj.items?.data?.[0]?.price?.lookup_key || null;
    const tier = TIER_POR_LOOKUP[lookup] || null;
    await sql`
      update cnc_subscriptions set status = ${obj.status}, cancel_at_period_end = ${Boolean(obj.cancel_at_period_end)},
        current_period_end = coalesce(${periodEnd(obj)}::timestamptz, current_period_end),
        tier = coalesce(${tier}, tier), price_lookup_key = coalesce(${lookup}, price_lookup_key), updated_at = now()
      where stripe_subscription_id = ${obj.id}`;
  }
}
