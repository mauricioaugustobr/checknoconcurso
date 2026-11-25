/**
 * Login com Google (back-end) — Check no Concurso.
 *
 * Fluxo: o navegador recebe do Google um "ID token" (credential) pelo botão oficial
 * Google Identity Services e envia para POST /api/auth/google. Aqui o token é
 * verificado no próprio Google (tokeninfo), conferindo o Client ID (aud), o emissor,
 * a validade e o e-mail verificado. Só então criamos uma sessão em cookie HttpOnly,
 * assinada com HMAC-SHA256 (SESSION_SECRET, guardada apenas nas variáveis de ambiente).
 *
 * Nada aqui é enviado ao front-end além de nome, e-mail e foto do próprio usuário.
 */
import crypto from 'node:crypto';
import { recordLogin } from './db.js';
import { getActiveSubscription, stripeEnabled } from './stripe.js';

/** Plano pago ativo (da tabela cnc_subscriptions). Nunca derruba o login se o banco falhar. */
async function withPlan(user) {
  if (!user) return user;
  try {
    const sub = await getActiveSubscription(user.email);
    if (sub) return { ...user, plan: sub.tier, planStatus: sub.status, planRenewsAt: sub.current_period_end, planCancelAtPeriodEnd: sub.cancel_at_period_end };
  } catch (err) {
    console.warn('[auth] consulta do plano falhou:', err.message);
  }
  return { ...user, plan: null };
}

// O Client ID do Google é público por natureza (aparece no HTML de qualquer site com
// "Entrar com Google"). O valor da variável de ambiente tem prioridade.
const DEFAULT_GOOGLE_CLIENT_ID = '899082856265-car3te39rdo7lbstttpnggubet4c1sbr.apps.googleusercontent.com';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const SESSION_COOKIE = 'cnc_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

let devSecret = null;

/**
 * Administradores: lista de e-mails na variável de ambiente ADMIN_EMAILS (separados por vírgula).
 * Fica só no servidor/Vercel — nunca no código público. O papel é recalculado a cada pedido,
 * então tirar um e-mail da lista remove o acesso na hora, sem depender do cookie.
 */
export function isAdminEmail(email) {
  if (!email) return false;
  const list = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(String(email).trim().toLowerCase());
}

function publicUser(u) {
  const { sub, email, name, picture, provider } = u;
  return { sub, email, name, picture, provider, role: isAdminEmail(email) ? 'admin' : 'user' };
}

export function getGoogleClientId() {
  return (process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID).trim();
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  // Em produção (Vercel) a variável é obrigatória: nunca usar segredo padrão.
  if (process.env.VERCEL) return null;
  // Desenvolvimento local: segredo aleatório por processo (sessões somem ao reiniciar).
  if (!devSecret) devSecret = crypto.randomBytes(32).toString('hex');
  return devSecret;
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function sign(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function createSessionToken(user, secret, now = Date.now()) {
  const payload = { ...user, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + SESSION_MAX_AGE };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export function readSessionToken(token, secret, now = Date.now()) {
  if (!token || !secret || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = sign(body, secret);
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
}

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function isSecureRequest(request) {
  const url = new URL(request.url);
  return url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
}

function sessionCookie(value, request, maxAge = SESSION_MAX_AGE) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`
  ];
  if (isSecureRequest(request)) parts.push('Secure');
  return parts.join('; ');
}

/** Bloqueia chamadas de outros sites (proteção contra CSRF). */
function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // navegadores sempre enviam Origin em POST com fetch; sem Origin = chamada de servidor
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Confere o ID token diretamente no Google. Retorna o perfil público ou lança erro. */
export async function verifyGoogleCredential(credential, { fetchImpl = fetch, clientId = getGoogleClientId() } = {}) {
  if (!credential || typeof credential !== 'string' || credential.length > 4096) {
    throw new Error('Credencial ausente ou inválida');
  }
  const res = await fetchImpl(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) throw new Error('Token do Google recusado');
  const info = await res.json();
  if (info.aud !== clientId) throw new Error('Token emitido para outro aplicativo');
  if (!GOOGLE_ISSUERS.has(info.iss)) throw new Error('Emissor do token inválido');
  if (!info.exp || Number(info.exp) * 1000 < Date.now()) throw new Error('Token expirado');
  if (String(info.email_verified) !== 'true') throw new Error('E-mail do Google não verificado');
  return {
    sub: String(info.sub),
    email: String(info.email),
    name: String(info.name || info.given_name || info.email.split('@')[0]),
    picture: info.picture ? String(info.picture) : null,
    provider: 'google'
  };
}

export function handleAuthConfig() {
  return json({ googleClientId: getGoogleClientId(), stripeEnabled: stripeEnabled() }, 200, { 'Cache-Control': 'public, max-age=60' });
}

export async function handleGoogleLogin(request) {
  if (request.method !== 'POST') return json({ error: 'Método não permitido' }, 405, { Allow: 'POST' });
  if (!isSameOrigin(request)) return json({ error: 'Origem não permitida' }, 403);
  const secret = getSessionSecret();
  if (!secret) {
    console.error('[auth] SESSION_SECRET não configurada no ambiente');
    return json({ error: 'Login temporariamente indisponível' }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Corpo da requisição inválido' }, 400);
  }
  try {
    const user = await verifyGoogleCredential(body?.credential);
    const token = createSessionToken(user, secret);
    // Registra o usuário no banco (não bloqueia o login se o banco falhar)
    try { await recordLogin(user); } catch (e) { console.warn('[auth] registro do usuário falhou:', e.message); }
    return json({ user: await withPlan(publicUser(user)) }, 200, { 'Set-Cookie': sessionCookie(token, request) });
  } catch (err) {
    console.warn('[auth] login Google recusado:', err.message);
    return json({ error: 'Não foi possível entrar com o Google. Tente novamente.' }, 401);
  }
}

export async function handleSession(request) {
  const user = readSessionToken(getCookie(request, SESSION_COOKIE), getSessionSecret());
  if (!user) return json({ user: null });
  return json({ user: await withPlan(publicUser(user)) });
}

export function handleLogout(request) {
  if (request.method !== 'POST') return json({ error: 'Método não permitido' }, 405, { Allow: 'POST' });
  if (!isSameOrigin(request)) return json({ error: 'Origem não permitida' }, 403);
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', request, 0) });
}

/** Usuário da sessão (ou null), com papel calculado no servidor. */
export function getSessionUser(request) {
  const user = readSessionToken(getCookie(request, SESSION_COOKIE), getSessionSecret());
  return user ? publicUser(user) : null;
}

/**
 * Garante que quem chama é ADMIN. Retorna { user } ou { response } com o erro pronto.
 * Para métodos que alteram dados, também exige que o pedido venha do próprio site.
 */
export function requireAdmin(request) {
  const user = getSessionUser(request);
  if (!user) return { response: json({ error: 'Entre com sua conta para continuar.' }, 401) };
  if (user.role !== 'admin') return { response: json({ error: 'Acesso restrito ao administrador.' }, 403) };
  if (request.method !== 'GET' && request.method !== 'HEAD' && !isSameOrigin(request)) {
    return { response: json({ error: 'Origem não permitida' }, 403) };
  }
  return { user };
}

export { json as authJson };
