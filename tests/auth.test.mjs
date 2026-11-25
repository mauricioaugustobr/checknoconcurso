import assert from 'node:assert/strict';
import {
  createSessionToken,
  readSessionToken,
  verifyGoogleCredential,
  getGoogleClientId,
  isAdminEmail,
  handleSession,
  handleLogout,
  handleGoogleLogin,
  handleAuthConfig
} from '../lib/auth.js';
import { createServer } from '../server.mjs';

const SECRET = 'x'.repeat(48);
const CLIENT_ID = getGoogleClientId();

async function run() {
  // 1. Sessão assinada: válida, adulterada, expirada
  const user = { sub: '1', email: 'a@b.com', name: 'Ana', provider: 'google' };
  const token = createSessionToken(user, SECRET);
  assert.equal(readSessionToken(token, SECRET).email, 'a@b.com');
  const [body, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...user, email: 'hacker@x.com', exp: 9999999999 })).toString('base64url');
  assert.equal(readSessionToken(`${forged}.${sig}`, SECRET), null, 'token adulterado deve ser recusado');
  assert.equal(readSessionToken(`${body}.${sig}`, 'y'.repeat(48)), null, 'segredo errado deve ser recusado');
  const old = createSessionToken(user, SECRET, Date.now() - 31 * 24 * 3600 * 1000);
  assert.equal(readSessionToken(old, SECRET), null, 'sessão expirada deve ser recusada');

  // 2. Verificação do token do Google (fetch simulado)
  const fakeFetch = (info, ok = true) => async () => ({ ok, json: async () => info });
  const base = { aud: CLIENT_ID, iss: 'https://accounts.google.com', exp: String(Math.floor(Date.now() / 1000) + 600), email_verified: 'true', sub: '123', email: 'c@d.com', name: 'Carla' };
  const ok = await verifyGoogleCredential('tok', { fetchImpl: fakeFetch(base) });
  assert.equal(ok.email, 'c@d.com');
  await assert.rejects(verifyGoogleCredential('tok', { fetchImpl: fakeFetch({ ...base, aud: 'outro-app' }) }), /outro aplicativo/);
  await assert.rejects(verifyGoogleCredential('tok', { fetchImpl: fakeFetch({ ...base, iss: 'evil.com' }) }), /Emissor/);
  await assert.rejects(verifyGoogleCredential('tok', { fetchImpl: fakeFetch({ ...base, email_verified: 'false' }) }), /não verificado/);
  await assert.rejects(verifyGoogleCredential('tok', { fetchImpl: fakeFetch({ ...base, exp: '1' }) }), /expirado/);
  await assert.rejects(verifyGoogleCredential('tok', { fetchImpl: fakeFetch({}, false) }), /recusado/);
  await assert.rejects(verifyGoogleCredential(''), /ausente/);

  // 2b. Admin vem só da variável de ambiente ADMIN_EMAILS (nunca do navegador)
  process.env.ADMIN_EMAILS = 'chefe@exemplo.com, outra@exemplo.com';
  assert.equal(isAdminEmail('Chefe@Exemplo.com '), true, 'admin ignora maiúsculas e espaços');
  assert.equal(isAdminEmail('qualquer@exemplo.com'), false);
  process.env.SESSION_SECRET = SECRET;
  const adminCookie = createSessionToken({ sub: '9', email: 'chefe@exemplo.com', name: 'Chefe', provider: 'google' }, SECRET);
  const adminSess = await handleSession(new Request('https://x.app/api/auth/session', { headers: { cookie: 'cnc_session=' + adminCookie } })).json();
  assert.equal(adminSess.user.role, 'admin', 'sessão do admin deve voltar com role admin');
  const userSess = await handleSession(new Request('https://x.app/api/auth/session', { headers: { cookie: 'cnc_session=' + token } })).json();
  assert.equal(userSess.user.role, 'user', 'usuário comum não é admin');
  delete process.env.ADMIN_EMAILS;
  const revoked = await handleSession(new Request('https://x.app/api/auth/session', { headers: { cookie: 'cnc_session=' + adminCookie } })).json();
  assert.equal(revoked.user.role, 'user', 'tirar o e-mail da lista remove o admin na hora');
  delete process.env.SESSION_SECRET;

  // 3. Handlers HTTP
  const cfg = await handleAuthConfig().json();
  assert.ok(cfg.googleClientId.endsWith('.apps.googleusercontent.com'));
  const noSession = await handleSession(new Request('https://checknoconcurso.vercel.app/api/auth/session')).json();
  assert.equal(noSession.user, null);
  const crossLogout = await handleLogout(new Request('https://checknoconcurso.vercel.app/api/auth/logout', { method: 'POST', headers: { origin: 'https://evil.com', host: 'checknoconcurso.vercel.app' } }));
  assert.equal(crossLogout.status, 403, 'logout vindo de outro site deve ser bloqueado');
  const crossLogin = await handleGoogleLogin(new Request('https://checknoconcurso.vercel.app/api/auth/google', { method: 'POST', headers: { origin: 'https://evil.com', host: 'checknoconcurso.vercel.app' }, body: '{}' }));
  assert.equal(crossLogin.status, 403, 'login vindo de outro site deve ser bloqueado');
  const getLogin = await handleGoogleLogin(new Request('https://checknoconcurso.vercel.app/api/auth/google'));
  assert.equal(getLogin.status, 405);

  // 4. Mesmas rotas no servidor local
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    const s = await (await fetch(`http://127.0.0.1:${port}/api/auth/session`)).json();
    assert.equal(s.user, null);
    const c = await (await fetch(`http://127.0.0.1:${port}/api/auth/config`)).json();
    assert.equal(c.googleClientId, CLIENT_ID);
    const bad = await fetch(`http://127.0.0.1:${port}/api/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: '' }) });
    assert.equal(bad.status, 401);
    for (const asset of ['/js/google-auth.js', '/privacidade.html']) {
      assert.equal((await fetch(`http://127.0.0.1:${port}${asset}`)).status, 200, `Falha ao servir ${asset}`);
    }
  } finally {
    await new Promise((r) => server.close(r));
  }

  console.log('OK: login com Google — sessão assinada, verificação do token e rotas /api/auth validadas.');
}

run().catch((err) => {
  console.error('FALHA NOS TESTES DE LOGIN:', err);
  process.exit(1);
});
