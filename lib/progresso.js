/**
 * Progresso das provas salvo na conta (servidor) — Check no Concurso.
 *
 * Antes, as respostas ficavam só no navegador: trocar de celular ou limpar o navegador
 * apagava tudo. Agora cada resposta também fica no banco (Neon), ligada à conta do Google.
 *
 * Rotas (dentro de api/concursos.js, por causa do limite de 12 funções do plano Hobby):
 *   GET  /api/progresso?prova=ID → estado salvo da prova
 *   POST /api/progresso          → envia respostas novas (em lote) e devolve o estado final
 *
 * Regras:
 * - Só a própria pessoa lê e grava o próprio progresso (e-mail da sessão, nunca do navegador).
 * - Exige o plano Check Completo (o mesmo das provas).
 * - O acerto é calculado aqui, pelo gabarito oficial; o navegador só manda a letra marcada.
 * - "Refazer a prova" abre uma nova tentativa; as anteriores ficam guardadas como histórico
 *   (base do caderno de erros e do painel de desempenho).
 * - A primeira resposta de cada questão vale (a tela trava a questão depois de conferir).
 *   Só uma questão pulada pode receber resposta depois.
 */
import crypto from 'node:crypto';
import { db, hasDatabase } from './db.js';
import { exigirPlano, lerProvaArquivo, lerIndiceProvas, NIVEL } from './acesso.js';
import { getSessionUser, isSameOrigin } from './auth.js';
import { getProva } from '../public/js/data/provas.js';

export const PULADA = '—';
const MAX_RESPOSTAS_POR_ENVIO = 400;
const MAX_CORPO_BYTES = 64 * 1024;

let schema = null;
function garantirTabelas(sql) {
  return (schema ||= (async () => {
    await sql`create table if not exists cnc_progresso_provas (
      email text not null,
      prova_id text not null,
      tentativa integer not null default 1,
      atual integer not null default 0,
      criado_em timestamptz not null default now(),
      atualizado_em timestamptz not null default now(),
      primary key (email, prova_id)
    )`;
    await sql`create table if not exists cnc_progresso_respostas (
      email text not null,
      prova_id text not null,
      tentativa integer not null,
      questao integer not null,
      resposta text not null,
      acertou boolean,
      respondida_em timestamptz not null default now(),
      primary key (email, prova_id, tentativa, questao)
    )`;
  })().catch((err) => { schema = null; throw err; }));
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
  });
}

/** Identificador da conta sem expor o e-mail (o navegador usa para saber de quem é o progresso local). */
export function contaId(email) {
  return crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 16);
}

// Cada prova tem dois nomes: o do link (/prova.html?c=pm-sp-soldado-2026) e o interno
// (prova.id, ex.: pm-sp-2025-soldado), usado no aparelho. O progresso fica sempre no nome interno.
let porIdInterno = null;
function mapaIdsInternos() {
  if (porIdInterno) return porIdInterno;
  porIdInterno = new Map();
  for (const chave of Object.keys(lerIndiceProvas())) {
    const p = lerPorChave(chave);
    if (p?.id && !porIdInterno.has(p.id)) porIdInterno.set(p.id, chave);
  }
  return porIdInterno;
}

function lerPorChave(id) {
  const prova = getProva(id) || lerProvaArquivo(id);
  return prova && Array.isArray(prova.questoes) ? prova : null;
}

/** Aceita o nome do link ou o interno. Devolve a prova (com prova.id = nome interno) ou null. */
export function carregarProva(id) {
  if (!/^[a-z0-9_-]{3,120}$/i.test(String(id || '')) || id === 'index') return null;
  const direta = /^[a-z0-9-]{3,80}$/i.test(id) ? lerPorChave(id) : null;
  if (direta) return direta.id ? direta : { ...direta, id };
  const chave = mapaIdsInternos().get(id);
  return chave ? lerPorChave(chave) : null;
}

/**
 * Confere as respostas enviadas contra a prova: questão existente, letra válida (ou pulada),
 * questão anulada não conta. Devolve [{ questao, resposta, acertou }].
 */
export function validarRespostas(prova, respostas) {
  if (!respostas || typeof respostas !== 'object' || Array.isArray(respostas)) return [];
  const porNumero = new Map(prova.questoes.map((q) => [String(q.number), q]));
  const validas = [];
  for (const [num, letra] of Object.entries(respostas).slice(0, MAX_RESPOSTAS_POR_ENVIO)) {
    const q = porNumero.get(String(num));
    if (!q || q.annulled || typeof letra !== 'string') continue;
    if (letra === PULADA) {
      validas.push({ questao: Number(q.number), resposta: PULADA, acertou: null });
      continue;
    }
    const letras = (q.alternatives || []).map((a) => a.letter);
    if (!letras.includes(letra)) continue;
    validas.push({ questao: Number(q.number), resposta: letra, acertou: letra === q.answer });
  }
  return validas;
}

function inteiro(v, { min = 0, max = 100000 } = {}) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

async function lerEstado(sql, email, provaId) {
  const [linha] = await sql`select tentativa, atual, atualizado_em from cnc_progresso_provas
    where email = ${email} and prova_id = ${provaId}`;
  if (!linha) return null;
  const respostas = await sql`select questao, resposta from cnc_progresso_respostas
    where email = ${email} and prova_id = ${provaId} and tentativa = ${linha.tentativa}`;
  return {
    tentativa: linha.tentativa,
    atual: linha.atual,
    atualizadoEm: new Date(linha.atualizado_em).toISOString(),
    respostas: Object.fromEntries(respostas.map((r) => [String(r.questao), r.resposta]))
  };
}

/** Grava respostas de uma tentativa. Primeira resposta vale; pulada pode virar resposta. */
async function gravarRespostas(sql, email, provaId, tentativa, respostas) {
  if (!respostas.length) return;
  await sql`
    insert into cnc_progresso_respostas (email, prova_id, tentativa, questao, resposta, acertou)
    select ${email}, ${provaId}, ${tentativa}, r.questao, r.resposta, r.acertou
    from jsonb_to_recordset(${JSON.stringify(respostas)}::jsonb) as r(questao integer, resposta text, acertou boolean)
    on conflict (email, prova_id, tentativa, questao) do update
      set resposta = excluded.resposta, acertou = excluded.acertou, respondida_em = now()
      where cnc_progresso_respostas.resposta = ${PULADA} and excluded.resposta <> ${PULADA}`;
}

async function autorizar(request) {
  const user = getSessionUser(request);
  if (!user?.email) return { response: json({ error: 'Entre com sua conta para salvar seu progresso.', codigo: 'login' }, 401) };
  const { response } = await exigirPlano(request, NIVEL.completo);
  if (response) return { response };
  if (!hasDatabase()) return { response: json({ error: 'Progresso na conta indisponível agora.', codigo: 'sem-banco' }, 503) };
  return { email: user.email.trim().toLowerCase() };
}

export async function handleProgresso(request) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), { status: 405, headers: { Allow: 'GET, POST', 'Content-Type': 'application/json; charset=utf-8' } });
  }
  if (request.method === 'POST' && !isSameOrigin(request)) return json({ error: 'Origem não permitida' }, 403);

  const auth = await autorizar(request);
  if (auth.response) return auth.response;
  const { email } = auth;
  const sql = db();
  await garantirTabelas(sql);

  if (request.method === 'GET') {
    const prova = carregarProva(new URL(request.url).searchParams.get('prova') || '');
    if (!prova) return json({ error: 'Prova não encontrada.' }, 404);
    const provaId = prova.id;
    const estado = await lerEstado(sql, email, provaId);
    return json({ prova: provaId, conta: contaId(email), ...(estado || { tentativa: 0, atual: 0, atualizadoEm: null, respostas: {} }) });
  }

  // POST: corpo pequeno (lote de respostas)
  const texto = await request.text();
  if (texto.length > MAX_CORPO_BYTES) return json({ error: 'Envio grande demais.' }, 413);
  let corpo;
  try { corpo = JSON.parse(texto); } catch { return json({ error: 'Corpo da requisição inválido' }, 400); }
  const prova = carregarProva(String(corpo?.prova || ''));
  if (!prova) return json({ error: 'Prova não encontrada.' }, 404);
  const provaId = prova.id;

  const respostas = validarRespostas(prova, corpo.respostas);
  const tentativaEnviada = corpo.tentativa == null ? null : inteiro(corpo.tentativa, { min: 1, max: 10000 });
  const atual = inteiro(corpo.atual, { min: 0, max: prova.questoes.length - 1 });

  const existente = await lerEstado(sql, email, provaId);
  let tentativa;
  if (!existente) {
    tentativa = tentativaEnviada || 1;
    await sql`insert into cnc_progresso_provas (email, prova_id, tentativa, atual)
      values (${email}, ${provaId}, ${tentativa}, ${atual ?? 0})
      on conflict (email, prova_id) do update set
        tentativa = greatest(cnc_progresso_provas.tentativa, excluded.tentativa), atualizado_em = now()`;
  } else if (tentativaEnviada && tentativaEnviada > existente.tentativa) {
    // "Refazer a prova" neste aparelho: nova tentativa; a anterior fica no histórico
    tentativa = tentativaEnviada;
    await sql`update cnc_progresso_provas set tentativa = greatest(tentativa, ${tentativa}),
      atual = ${atual ?? 0}, atualizado_em = now() where email = ${email} and prova_id = ${provaId}`;
  } else {
    tentativa = existente.tentativa;
    if (atual != null && (tentativaEnviada == null || tentativaEnviada === tentativa)) {
      await sql`update cnc_progresso_provas set atual = ${atual}, atualizado_em = now()
        where email = ${email} and prova_id = ${provaId}`;
    } else if (respostas.length) {
      await sql`update cnc_progresso_provas set atualizado_em = now() where email = ${email} and prova_id = ${provaId}`;
    }
  }

  // Respostas de uma tentativa antiga (feitas sem internet antes de refazer em outro aparelho)
  // ficam no histórico dessa tentativa, sem misturar com a atual.
  const tentativaDasRespostas = tentativaEnviada && tentativaEnviada < tentativa ? tentativaEnviada : tentativa;
  await gravarRespostas(sql, email, provaId, tentativaDasRespostas, respostas);

  const estado = await lerEstado(sql, email, provaId);
  return json({ prova: provaId, conta: contaId(email), recebidas: respostas.length, ...estado });
}
