import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyStripeSignature, handleCheckout, handleWebhook, handleConfirm, PLANOS_STRIPE, stripeApi } from '../lib/stripe.js';
import { createSessionToken, handleAuthConfig } from '../lib/auth.js';

delete process.env.DATABASE_URL;
const SECRET = 'q'.repeat(48);
process.env.SESSION_SECRET = SECRET;
const BASE = 'https://checknoconcurso.vercel.app';
const cookie = 'cnc_session=' + createSessionToken({ sub: '1', email: 'aluno@exemplo.com', name: 'Aluno', provider: 'google' }, SECRET);
const post = (path, { body, withCookie = true, origin = BASE } = {}) => new Request(BASE + path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', host: 'checknoconcurso.vercel.app', ...(origin ? { origin } : {}), ...(withCookie ? { cookie } : {}) },
  body: JSON.stringify(body || {})
});

async function run() {
  // 1. Planos ligados aos preços certos da Stripe
  assert.deepEqual(Object.keys(PLANOS_STRIPE), ['essencial', 'completo-mensal', 'completo-anual']);

  // 2. Sem chave: site avisa que pagamento não está configurado
  delete process.env.STRIPE_SECRET_KEY;
  assert.equal((await handleAuthConfig().json()).stripeEnabled, false);
  assert.equal((await handleCheckout(post('/api/stripe/checkout', { body: { plan: 'essencial' } }))).status, 503);

  // 3. Com chave: exige login, mesmo site e plano válido
  process.env.STRIPE_SECRET_KEY = 'sk_test_fakefakefake123';
  assert.equal((await handleAuthConfig().json()).stripeEnabled, true);
  process.env.STRIPE_SECRET_KEY = 'mk_qualquer_coisa_errada';
  assert.equal((await handleAuthConfig().json()).stripeEnabled, false, 'chave que não é secreta desliga os pagamentos');
  process.env.STRIPE_SECRET_KEY = 'sk_test_fakefakefake123';
  assert.equal((await handleCheckout(post('/api/stripe/checkout', { body: { plan: 'essencial' }, withCookie: false }))).status, 401);
  assert.equal((await handleCheckout(post('/api/stripe/checkout', { body: { plan: 'essencial' }, origin: 'https://evil.com' }))).status, 403);
  assert.equal((await handleCheckout(post('/api/stripe/checkout', { body: { plan: 'vip-gratis' } }))).status, 400);
  assert.equal((await handleConfirm(post('/api/stripe/confirm', { body: { session_id: 'qualquer' } }))).status, 400);

  // 4. Avisos da Stripe: só aceita com assinatura válida
  const whsec = 'whsec_teste';
  const payload = JSON.stringify({ id: 'evt_1', type: 'ping', data: { object: {} } });
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', whsec).update(`${t}.${payload}`).digest('hex');
  assert.equal(verifyStripeSignature(payload, `t=${t},v1=${sig}`, whsec), true);
  assert.equal(verifyStripeSignature(payload, `t=${t},v1=${'0'.repeat(64)}`, whsec), false, 'assinatura falsa');
  assert.equal(verifyStripeSignature(payload + 'x', `t=${t},v1=${sig}`, whsec), false, 'corpo alterado');
  assert.equal(verifyStripeSignature(payload, `t=${t - 3600},v1=${crypto.createHmac('sha256', whsec).update(`${t - 3600}.${payload}`).digest('hex')}`, whsec), false, 'aviso antigo');
  process.env.STRIPE_WEBHOOK_SECRET = whsec;
  const forged = new Request(BASE + '/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=abc' }, body: payload });
  assert.equal((await handleWebhook(forged)).status, 400, 'aviso falso é recusado');
  const good = new Request(BASE + '/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${sig}` }, body: payload });
  assert.equal((await handleWebhook(good)).status, 200);

  // 5. Cliente da Stripe monta os parâmetros no formato certo
  let captured = null;
  await stripeApi('POST', '/checkout/sessions', { mode: 'subscription', line_items: [{ price: 'price_1', quantity: 1 }], metadata: { email: 'a@b.com' } },
    { fetchImpl: async (url, opts) => { captured = { url, opts }; return { ok: true, json: async () => ({ id: 'cs_test_1' }) }; } });
  assert.ok(captured.opts.body.includes('line_items%5B0%5D%5Bprice%5D=price_1'));
  assert.ok(captured.opts.body.includes('metadata%5Bemail%5D=a%40b.com'));
  assert.equal(captured.opts.headers.Authorization, 'Bearer sk_test_fakefakefake123');

  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  console.log('OK: pagamentos Stripe — login obrigatório, planos, avisos assinados e chamadas à API validados.');
}

run().catch((err) => {
  console.error('FALHA NOS TESTES DA STRIPE:', err);
  process.exit(1);
});
