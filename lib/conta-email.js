/**
 * Conta com e-mail e senha (sem Google) — Check no Concurso. Só no servidor.
 *
 * A senha nunca é guardada: fica só o resumo scrypt, com sal aleatório. Depois de entrar, a pessoa
 * recebe o mesmo cookie de sessão do login com Google (lib/auth.js), então Pix, cartão, plano e
 * a lista "Notas a emitir" funcionam igual para as duas formas de entrar.
 *
 * Proteções:
 * - E-mail que já entra com o Google não cria senha (ninguém assume a conta de outra pessoa).
 * - Quando a pessoa entra com o Google usando o mesmo e-mail, a senha é desativada:
 *   o Google prova que o e-mail é dela.
 * - 8 senhas erradas seguidas bloqueiam a conta por 15 minutos.
 * - "Esqueci minha senha": o pedido aparece no painel admin, que gera uma senha provisória
 *   para enviar à pessoa (até o site ter envio de e-mail próprio).
 * - A conta de administrador só entra com o Google (conferido em lib/auth.js).
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db, recordLogin } from './db.js';

const scrypt = promisify(crypto.scrypt);
const PARAMS = { N: 16384, r: 8, p: 1 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MAX_ERROS = 8;
const BLOQUEIO_MINUTOS = 15;

/** Erro com a mensagem que a pessoa vê e o código HTTP. */
function erro(mensagem, status = 400) {
  return Object.assign(new Error(mensagem), { status });
}

export const normalizarEmail = (e) => String(e || '').trim().toLowerCase();
export const emailValido = (e) => EMAIL_RE.test(e) && e.length <= 254;
export const senhaValida = (s) => typeof s === 'string' && s.length >= 8 && s.length <= 200;

/** Identificador fixo da conta (o mesmo e-mail gera sempre o mesmo). */
export const subDaConta = (email) => `email:${crypto.createHash('sha256').update(email).digest('hex').slice(0, 24)}`;

export async function resumirSenha(senha, sal = crypto.randomBytes(16)) {
  const h = await scrypt(String(senha), sal, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${sal.toString('base64')}$${h.toString('base64')}`;
}

export async function confereSenha(senha, guardado) {
  const partes = String(guardado || '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, N, r, p, sal, resumo] = partes;
  const esperado = Buffer.from(resumo, 'base64');
  const calculado = await scrypt(String(senha), Buffer.from(sal, 'base64'), esperado.length, { N: Number(N), r: Number(r), p: Number(p) });
  return calculado.length === esperado.length && crypto.timingSafeEqual(calculado, esperado);
}

/** Senha provisória legível (sem 0/O nem 1/I/L), no formato XXXXX-XXXXX. */
export function senhaProvisoria() {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(10);
  const s = [...bytes].map((b) => letras[b % letras.length]).join('');
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

let schema = null;
function pronto(sql) {
  return (schema ||= sql`create table if not exists cnc_email_accounts (
      email text primary key,
      name text not null,
      pass_hash text,
      erros int not null default 0,
      bloqueada_ate timestamptz,
      pedido_senha_em timestamptz,
      desativada_motivo text,
      criada_em timestamptz not null default now(),
      atualizada_em timestamptz not null default now())`.catch((err) => { schema = null; throw err; }));
}

function banco(sql) {
  const s = sql === undefined ? db() : sql;
  if (!s) throw erro('O login por e-mail está indisponível agora. Tente de novo em instantes ou entre com o Google.', 503);
  return s;
}

const usuario = (email, nome) => ({ sub: subDaConta(email), email, name: nome, picture: null, provider: 'email' });

/** Cria a conta e devolve o usuário da sessão. */
export async function criarConta({ nome, email, senha }, { sql: sqlOpcional } = {}) {
  email = normalizarEmail(email);
  const nomeLimpo = String(nome || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!emailValido(email)) throw erro('Digite um e-mail válido.');
  if (!senhaValida(senha)) throw erro('A senha precisa ter pelo menos 8 caracteres.');
  const sql = banco(sqlOpcional);
  await pronto(sql);
  const [jaTem] = await sql`select provider from cnc_users where email = ${email} limit 1`.catch(() => []);
  const [conta] = await sql`select email from cnc_email_accounts where email = ${email} limit 1`;
  if (conta || jaTem?.provider === 'email') throw erro('Este e-mail já tem conta. Toque em "Entrar" e use a sua senha.', 409);
  if (jaTem) throw erro('Este e-mail já entra com o Google. Use o botão "Continuar com Google".', 409);
  const nomeFinal = nomeLimpo || email.split('@')[0];
  const criada = await sql`insert into cnc_email_accounts (email, name, pass_hash)
    values (${email}, ${nomeFinal}, ${await resumirSenha(senha)})
    on conflict (email) do nothing returning email`;
  if (!criada.length) throw erro('Este e-mail já tem conta. Toque em "Entrar" e use a sua senha.', 409);
  const u = usuario(email, nomeFinal);
  if (sqlOpcional === undefined) await recordLogin(u).catch(() => {});
  return u;
}

/** Confere e-mail e senha e devolve o usuário da sessão. */
export async function entrarComSenha({ email, senha }, { sql: sqlOpcional } = {}) {
  email = normalizarEmail(email);
  if (!emailValido(email)) throw erro('Digite um e-mail válido.');
  if (typeof senha !== 'string' || !senha) throw erro('Digite a sua senha.');
  const sql = banco(sqlOpcional);
  await pronto(sql);
  const [c] = await sql`select email, name, pass_hash, erros, bloqueada_ate, desativada_motivo from cnc_email_accounts where email = ${email}`;
  if (!c) throw erro('Não encontramos conta com este e-mail. Toque em "Criar conta" para criar a sua, ou entre com o Google.', 404);
  if (c.bloqueada_ate && new Date(c.bloqueada_ate) > new Date()) throw erro(`Muitas tentativas erradas. Tente de novo em ${BLOQUEIO_MINUTOS} minutos.`, 429);
  if (!c.pass_hash) {
    throw erro(c.desativada_motivo === 'google'
      ? 'Esta conta agora entra com o Google. Use o botão "Continuar com Google".'
      : 'Esta conta está sem senha. Toque em "Esqueci minha senha".', 403);
  }
  if (!(await confereSenha(senha, c.pass_hash))) {
    const erros = Number(c.erros || 0) + 1;
    const bloqueia = erros >= MAX_ERROS;
    await sql`update cnc_email_accounts set erros = ${bloqueia ? 0 : erros},
      bloqueada_ate = ${bloqueia ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60_000).toISOString() : null}::timestamptz,
      atualizada_em = now() where email = ${email}`;
    throw erro(bloqueia ? `Muitas tentativas erradas. Tente de novo em ${BLOQUEIO_MINUTOS} minutos.` : 'Senha incorreta. Confira e tente de novo.', bloqueia ? 429 : 401);
  }
  await sql`update cnc_email_accounts set erros = 0, bloqueada_ate = null, pedido_senha_em = null, atualizada_em = now() where email = ${email}`;
  const u = usuario(email, c.name);
  if (sqlOpcional === undefined) await recordLogin(u).catch(() => {});
  return u;
}

/** "Esqueci minha senha": marca o pedido para o admin. A resposta é sempre a mesma. */
export async function pedirNovaSenha(email, { sql: sqlOpcional } = {}) {
  email = normalizarEmail(email);
  if (!emailValido(email)) throw erro('Digite o seu e-mail no campo acima.');
  const sql = banco(sqlOpcional);
  await pronto(sql);
  await sql`update cnc_email_accounts set pedido_senha_em = now(), atualizada_em = now() where email = ${email} and pass_hash is not null`;
  return true;
}

/** Admin: gera uma senha provisória (mostrada uma vez) e desbloqueia a conta. */
export async function gerarSenhaProvisoria(email, { sql: sqlOpcional } = {}) {
  email = normalizarEmail(email);
  const sql = banco(sqlOpcional);
  await pronto(sql);
  const [c] = await sql`select desativada_motivo from cnc_email_accounts where email = ${email}`;
  if (!c) throw erro('Esta pessoa entra com o Google: não tem senha para trocar.', 404);
  if (c.desativada_motivo === 'google') throw erro('Esta conta passou a entrar com o Google. A senha não é mais usada.', 409);
  const nova = senhaProvisoria();
  await sql`update cnc_email_accounts set pass_hash = ${await resumirSenha(nova)}, erros = 0, bloqueada_ate = null,
    pedido_senha_em = null, atualizada_em = now() where email = ${email}`;
  return nova;
}

/** Entrou com o Google usando o mesmo e-mail: a senha deixa de valer. */
export async function desativarSenhaPorGoogle(email, { sql: sqlOpcional } = {}) {
  email = normalizarEmail(email);
  const sql = sqlOpcional === undefined ? db() : sqlOpcional;
  if (!sql || !email) return false;
  await pronto(sql);
  const r = await sql`update cnc_email_accounts set pass_hash = null, desativada_motivo = 'google', atualizada_em = now()
    where email = ${email} and pass_hash is not null returning email`;
  if (r.length) await sql`update cnc_users set provider = 'google' where email = ${email}`.catch(() => {});
  return r.length > 0;
}

/** Admin: contas com senha (para mostrar a forma de entrar e os pedidos de senha nova). */
export async function listarContasEmail({ sql: sqlOpcional } = {}) {
  const sql = sqlOpcional === undefined ? db() : sqlOpcional;
  if (!sql) return [];
  await pronto(sql);
  return sql`select email, pass_hash is not null as ativa, pedido_senha_em, desativada_motivo, bloqueada_ate from cnc_email_accounts`;
}
