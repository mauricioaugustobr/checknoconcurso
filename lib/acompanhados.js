/**
 * Item 12 · "Acompanhar este concurso" e "Meus concursos" — salvos na conta, não só no navegador.
 *
 * Rotas (dentro de api/concursos.js, por causa do limite de funções do plano Hobby):
 *   GET  /api/acompanhados → { ids, alertas, itens: [{ id, mudancas, conferidoEm, proximoPasso, linkOficial }] }
 *   POST /api/acompanhados → { acao: 'add' | 'remove' | 'alerta' | 'importar', id?, ids?, alerta? }
 *
 * Regras:
 * - Plano Essencial ou Completo. Só a própria pessoa lê e grava a própria lista (e-mail da sessão).
 * - "O que mudou" sai do histórico de ajustes do painel (tabela cnc_concurso_alteracoes, item 9):
 *   compara o valor de antes da 1ª mudança dos últimos 30 dias com o valor de agora.
 * - O "próximo passo" é calculado pela data de hoje no horário de Brasília.
 */
import { db, hasDatabase } from './db.js';
import { exigirPlano, NIVEL } from './acesso.js';
import { getSessionUser, isSameOrigin } from './auth.js';
import { getLiveCatalog, CAMPOS_EDITAVEIS } from './catalog-overrides.js';
import { CONCURSOS } from '../public/js/data/concursos.js';
import { hojeBR } from '../public/js/ultimos-dias.js';

export const MAX_ACOMPANHADOS = 200;
const ID_OK = /^[a-z0-9][a-z0-9-]{0,119}$/;
const DIAS_MUDANCAS = 30;

export const ROTULOS = {
  status: 'Situação',
  titulo: 'Título',
  banca: 'Banca',
  provaObservacao: 'Observação da prova',
  inscricaoInicio: 'Início das inscrições',
  inscricaoFim: 'Fim das inscrições',
  dataProva: 'Data da prova',
  vagas: 'Vagas',
  vagasCR: 'Cadastro reserva',
  salarioMin: 'Salário inicial',
  salarioMax: 'Salário máximo',
  taxaInscricao: 'Taxa de inscrição'
};
const TIPO = CAMPOS_EDITAVEIS;

const isoDia = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : null));
const normal = (campo, v) => {
  if (v === undefined || v === null || v === '') return null;
  if (TIPO[campo] === 'data') return isoDia(v);
  if (TIPO[campo] === 'numero') return Number(v);
  return String(v);
};

/**
 * Mudanças de um concurso: para cada campo citado no histórico recente,
 * "antes" = valor anterior à 1ª mudança do período; "agora" = valor publicado hoje.
 * rows: linhas de cnc_concurso_alteracoes desse concurso, em ordem de data.
 */
export function calcularMudancas(base, atual, rows) {
  const antes = new Map();
  for (const r of rows) {
    for (const campo of new Set([...Object.keys(r.antes || {}), ...Object.keys(r.depois || {})])) {
      if (!ROTULOS[campo] || antes.has(campo)) continue;
      const v = r.antes && campo in r.antes && r.antes[campo] !== null ? r.antes[campo] : base?.[campo];
      antes.set(campo, normal(campo, v));
    }
  }
  const out = [];
  for (const [campo, valorAntes] of antes) {
    const agora = normal(campo, atual?.[campo]);
    if (valorAntes === agora) continue;
    out.push({ campo, rotulo: ROTULOS[campo], tipo: TIPO[campo], antes: valorAntes, agora });
  }
  return out;
}

/** Próxima data que importa: abertura, fim das inscrições, prova ou resultado. */
export function proximoPasso(c, hoje = hojeBR()) {
  const ini = isoDia(c.inscricaoInicio);
  const fim = isoDia(c.inscricaoFim);
  const prova = isoDia(c.dataProva);
  const encerrado = c.status === 'Encerrado';
  if (!encerrado && ini && ini > hoje) return { tipo: 'abre', rotulo: 'Inscrições abrem', data: ini };
  if (!encerrado && fim && fim >= hoje) return { tipo: 'inscricao', rotulo: 'Inscrições até', data: fim };
  if (prova && prova >= hoje) return { tipo: 'prova', rotulo: 'Prova', data: prova };
  if (prova && prova < hoje) return { tipo: 'resultado', rotulo: 'Resultado', data: null, texto: 'Acompanhe o resultado no site da banca' };
  if (c.status === 'Previsto / Autorizado') return { tipo: 'edital', rotulo: 'Edital', data: null, texto: 'Aguardando o edital' };
  return { tipo: 'edital', rotulo: 'Prova', data: null, texto: c.provaObservacao || 'Data da prova a definir' };
}

function linkOficial(c) {
  const url = String(c.edital?.urlPdf || '');
  return /^https:\/\//i.test(url) ? url : null;
}

/* ---------- Banco ---------- */
let schema = null;
function garantirTabela(sql) {
  return (schema ||= sql`create table if not exists cnc_acompanhados (
      email text not null,
      concurso_id text not null,
      alerta boolean not null default true,
      criado_em timestamptz not null default now(),
      primary key (email, concurso_id)
    )`.catch((err) => { schema = null; throw err; }));
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
  });
}

async function autorizar(request) {
  const user = getSessionUser(request);
  if (!user?.email) return { response: json({ error: 'Entre com sua conta para acompanhar concursos.', codigo: 'login' }, 401) };
  const { response } = await exigirPlano(request, NIVEL.essencial);
  if (response) return { response };
  if (!hasDatabase()) return { response: json({ error: 'Lista na conta indisponível agora.', codigo: 'sem-banco' }, 503) };
  return { email: user.email.trim().toLowerCase() };
}

async function lerLista(sql, email) {
  return sql`select concurso_id, alerta from cnc_acompanhados where email = ${email} order by criado_em`;
}

/** Resumo de cada concurso acompanhado: mudanças recentes, próximo passo e link oficial. */
export async function montarItens(sql, ids, { catalogo, hoje = hojeBR() } = {}) {
  if (!ids.length) return [];
  const live = new Map((catalogo || await getLiveCatalog()).map((c) => [c.id, c]));
  const base = new Map(CONCURSOS.map((c) => [c.id, c]));
  const rows = sql ? await sql`select concurso_id, antes, depois, em from cnc_concurso_alteracoes
      where concurso_id = any(${ids}) and em > now() - make_interval(days => ${DIAS_MUDANCAS}) order by em, id`.catch(() => []) : [];
  const porId = new Map();
  for (const r of rows) {
    if (!porId.has(r.concurso_id)) porId.set(r.concurso_id, []);
    porId.get(r.concurso_id).push(r);
  }
  return ids.filter((id) => live.has(id)).map((id) => {
    const c = live.get(id);
    const hist = porId.get(id) || [];
    const mudancas = calcularMudancas(base.get(id), c, hist);
    const ultima = hist.length ? hist[hist.length - 1].em : null;
    return {
      id,
      mudancas,
      conferidoEm: mudancas.length && ultima ? new Date(ultima).toISOString() : null,
      proximoPasso: proximoPasso(c, hoje),
      linkOficial: linkOficial(c)
    };
  });
}

function idsValidos(lista, catalogoIds) {
  const out = [];
  for (const id of Array.isArray(lista) ? lista : []) {
    const s = String(id || '');
    if (ID_OK.test(s) && catalogoIds.has(s) && !out.includes(s)) out.push(s);
    if (out.length >= MAX_ACOMPANHADOS) break;
  }
  return out;
}

export async function handleAcompanhados(request) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), { status: 405, headers: { Allow: 'GET, POST', 'Content-Type': 'application/json; charset=utf-8' } });
  }
  if (request.method === 'POST' && !isSameOrigin(request)) return json({ error: 'Origem não permitida' }, 403);
  const auth = await autorizar(request);
  if (auth.response) return auth.response;
  const { email } = auth;
  const sql = db();
  await garantirTabela(sql);
  const catalogo = await getLiveCatalog();
  const catalogoIds = new Set(catalogo.map((c) => c.id));

  if (request.method === 'POST') {
    const texto = await request.text();
    if (texto.length > 16 * 1024) return json({ error: 'Envio grande demais.' }, 413);
    let corpo;
    try { corpo = JSON.parse(texto); } catch { return json({ error: 'Corpo da requisição inválido' }, 400); }
    const acao = String(corpo?.acao || '');
    const [id] = idsValidos([corpo?.id], catalogoIds);
    if (acao === 'add' || acao === 'remove' || acao === 'alerta') {
      if (!id) return json({ error: 'Concurso não encontrado.' }, 404);
    }
    if (acao === 'add') {
      const [{ total }] = await sql`select count(*)::int as total from cnc_acompanhados where email = ${email}`;
      if (total >= MAX_ACOMPANHADOS) return json({ error: `Você pode acompanhar até ${MAX_ACOMPANHADOS} concursos.` }, 409);
      await sql`insert into cnc_acompanhados (email, concurso_id, alerta) values (${email}, ${id}, ${corpo.alerta !== false})
        on conflict (email, concurso_id) do nothing`;
    } else if (acao === 'remove') {
      await sql`delete from cnc_acompanhados where email = ${email} and concurso_id = ${id}`;
    } else if (acao === 'alerta') {
      await sql`update cnc_acompanhados set alerta = ${Boolean(corpo.alerta)} where email = ${email} and concurso_id = ${id}`;
    } else if (acao === 'importar') {
      // Primeira vez com a conta: junta o que estava só neste navegador (não apaga nada da conta)
      const ids = idsValidos(corpo?.ids, catalogoIds);
      const alertas = new Set(idsValidos(corpo?.alertas, catalogoIds));
      const [{ total }] = await sql`select count(*)::int as total from cnc_acompanhados where email = ${email}`;
      const cabem = ids.slice(0, Math.max(0, MAX_ACOMPANHADOS - total));
      if (cabem.length) {
        await sql`insert into cnc_acompanhados (email, concurso_id, alerta)
          select ${email}, x.id, x.alerta from jsonb_to_recordset(${JSON.stringify(cabem.map((i) => ({ id: i, alerta: alertas.has(i) })))}::jsonb) as x(id text, alerta boolean)
          on conflict (email, concurso_id) do nothing`;
      }
    } else {
      return json({ error: 'Ação inválida.' }, 400);
    }
  }

  const lista = (await lerLista(sql, email)).filter((r) => catalogoIds.has(r.concurso_id));
  const ids = lista.map((r) => r.concurso_id);
  return json({
    ids,
    alertas: lista.filter((r) => r.alerta).map((r) => r.concurso_id),
    itens: await montarItens(sql, ids, { catalogo })
  });
}
