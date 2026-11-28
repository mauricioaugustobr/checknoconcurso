import assert from 'node:assert/strict';
import { createSessionToken, handleSession, getSessionUser } from '../lib/auth.js';
import { resumirSenha, confereSenha, senhaProvisoria, emailValido, senhaValida, normalizarEmail, subDaConta } from '../lib/conta-email.js';
import { handleCheckout } from '../lib/stripe.js';

// Testes sem banco: DATABASE_URL fica vazia de propósito (o fluxo com banco é testado à parte)
delete process.env.DATABASE_URL;
const SECRET = 'e'.repeat(48);
process.env.SESSION_SECRET = SECRET;
process.env.ADMIN_EMAILS = 'chefe@exemplo.com';
const BASE = 'https://checknoconcurso.vercel.app';
const post = (body, { origin = BASE } = {}) => new Request(BASE + '/api/auth/session', {
  method: 'POST',
  headers: { 'content-type': 'application/json', host: 'checknoconcurso.vercel.app', ...(origin ? { origin } : {}) },
  body: JSON.stringify(body)
});
const cookieDe = (user) => 'cnc_session=' + createSessionToken(user, SECRET);
const get = (user) => new Request(BASE + '/api/auth/session', { headers: { cookie: cookieDe(user) } });

async function run() {
  // 1. Senha: só o resumo scrypt é guardado, e a conferência funciona
  const guardado = await resumirSenha('senha-forte-123');
  assert.ok(guardado.startsWith('scrypt$') && !guardado.includes('senha-forte-123'), 'a senha nunca fica em texto');
  assert.equal(await confereSenha('senha-forte-123', guardado), true);
  assert.equal(await confereSenha('senha-errada-123', guardado), false);
  assert.equal(await confereSenha('qualquer', 'texto-sem-formato'), false);
  assert.notEqual(await resumirSenha('igual-igual-1'), await resumirSenha('igual-igual-1'), 'cada senha tem sal próprio');

  // 2. Senha provisória legível e validações
  for (let i = 0; i < 20; i++) assert.match(senhaProvisoria(), /^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
  assert.equal(emailValido('pessoa@exemplo.com'), true);
  assert.equal(emailValido('sem-arroba.com'), false);
  assert.equal(senhaValida('1234567'), false);
  assert.equal(senhaValida('12345678'), true);
  assert.equal(normalizarEmail('  Pessoa@Exemplo.COM '), 'pessoa@exemplo.com');
  assert.equal(subDaConta('a@b.com'), subDaConta('a@b.com'));
  assert.ok(subDaConta('a@b.com').startsWith('email:'));

  // 3. Rota: protegida contra outros sites, admin só com Google, sem banco responde com aviso claro
  assert.equal((await handleSession(post({ acao: 'criar', email: 'a@b.com', senha: '12345678' }, { origin: 'https://evil.com' }))).status, 403);
  const admin = await handleSession(post({ acao: 'entrar', email: 'Chefe@Exemplo.com', senha: '12345678' }));
  assert.equal(admin.status, 403, 'e-mail de admin não entra com senha');
  assert.match((await admin.json()).error, /Google/);
  assert.equal((await handleSession(post({ acao: 'apagar-tudo', email: 'a@b.com' }))).status, 400);
  const semBanco = await handleSession(post({ acao: 'criar', nome: 'Ana', email: 'ana@exemplo.com', senha: '12345678' }));
  assert.equal(semBanco.status, 503);
  assert.match((await semBanco.json()).error, /indisponível/);
  assert.equal((await handleSession(post({ acao: 'esqueci', email: '' }))).status, 400, 'esqueci sem e-mail');

  // 4. Sessão de quem entrou com e-mail e senha nunca vira admin (mesmo com e-mail da lista)
  assert.equal(getSessionUser(get({ sub: 'email:x', email: 'chefe@exemplo.com', name: 'X', provider: 'email' })).role, 'user');
  assert.equal(getSessionUser(get({ sub: 'g1', email: 'chefe@exemplo.com', name: 'X', provider: 'google' })).role, 'admin');
  const sessao = await (await handleSession(get({ sub: 'email:y', email: 'ana@exemplo.com', name: 'Ana', provider: 'email' }))).json();
  assert.equal(sessao.user.email, 'ana@exemplo.com');
  assert.equal(sessao.user.provider, 'email', 'a sessão por e-mail é reconhecida pelo servidor (pode pagar)');

  // 5. Pagamento: a conta por e-mail passa pelo login do cartão (aqui só o plano é inválido de propósito)
  process.env.STRIPE_SECRET_KEY = 'sk_test_fakefakefake123';
  const compra = await handleCheckout(new Request(BASE + '/api/stripe/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'checknoconcurso.vercel.app', origin: BASE, cookie: cookieDe({ sub: 'email:y', email: 'ana@exemplo.com', name: 'Ana', provider: 'email' }) },
    body: JSON.stringify({ plan: 'vip-gratis' })
  }));
  assert.equal(compra.status, 400, 'não é 401: a pessoa com e-mail e senha está logada para pagar');
  delete process.env.STRIPE_SECRET_KEY;

  console.log('OK: conta com e-mail e senha — resumo da senha, rota protegida, admin só com Google e sessão reconhecida.');
}

run().catch((err) => {
  console.error('FALHA NOS TESTES DA CONTA POR E-MAIL:', err);
  process.exit(1);
});
