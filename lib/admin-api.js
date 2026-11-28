/**
 * API do painel de ADMIN (/admin). Toda rota exige sessão de admin (lib/auth.js → requireAdmin).
 * Cada alteração fica registrada em cnc_audit.
 */
import { requireAdmin, isAdminEmail, authJson as json } from './auth.js';
import { listManualAccess, setManualAccess } from './acesso-manual.js';
import { listarAssinaturasStripe, resumoPagamentosStripe } from './stripe.js';
import { resumoPagamentosPix } from './pix.js';
import { listarNotas, marcarNota } from './notas.js';
import {
  hasDatabase, countUsers, listUsers, listPosts, getPostById, upsertPost, deletePost,
  saveOverride, clearOverride, getOverrides, audit, listAudit, listCancellations
} from './db.js';
import { getLiveCatalog, sanitizeOverride, CAMPOS_EDITAVEIS, STATUS_VALIDOS } from './catalog-overrides.js';
import { computeStats } from './catalog-api.js';
import { scoreConcurso } from '../public/js/search.js';
import { ESTADOS_BRASIL } from '../public/js/data/concursos.js';
import { slugify } from './markdown.js';

const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const ok = (payload, status = 200) => json(payload, status, noStore);
const fail = (msg, status = 400) => json({ error: msg }, status, noStore);

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

function withGuard(fn) {
  return async (request) => {
    const g = requireAdmin(request);
    if (g.response) return g.response;
    try {
      return await fn(request, g.user, new URL(request.url));
    } catch (err) {
      console.error('[admin] erro:', err);
      return fail(err.message && err.message.length < 200 ? err.message : 'Erro interno no servidor', 500);
    }
  };
}

/* ---------- Visão geral ---------- */
export const handleOverview = withGuard(async () => {
  const catalog = await getLiveCatalog({ includeHidden: true });
  const visiveis = catalog.filter((c) => !c._admin?.hidden);
  const stats = computeStats(visiveis);
  const hoje = new Date().toISOString().slice(0, 10);
  const prazoVencido = visiveis.filter((c) => c.status === 'Inscrições Abertas' && c.inscricaoFim && c.inscricaoFim < hoje);
  const [usuarios, posts, overrides] = await Promise.all([
    countUsers().catch(() => ({ total: 0, ultimos7: 0, ultimos30: 0 })),
    listPosts({ includeDrafts: true, limit: 500 }).catch(() => []),
    getOverrides({ fresh: true }).catch(() => [])
  ]);
  return ok({
    banco: hasDatabase(),
    concursos: {
      total: stats.totalConcursos, ativos: stats.concursosAtivos, inscricoesAbertas: stats.inscricoesAbertas,
      encerrados: stats.concursosEncerrados, vagas: stats.totalVagasAbertas,
      editados: overrides.filter((o) => !o.hidden).length, ocultos: overrides.filter((o) => o.hidden).length,
      prazoVencido: prazoVencido.map((c) => ({ id: c.id, sigla: c.sigla, uf: c.uf, inscricaoFim: c.inscricaoFim }))
    },
    usuarios,
    blog: { total: posts.length, publicados: posts.filter((p) => p.status === 'published').length, rascunhos: posts.filter((p) => p.status === 'draft').length }
  });
});

/* ---------- Usuários: plano, pagamentos e liberação/bloqueio manual ---------- */
const NIVEL_TIER = { essencial: 1, 'completo-mensal': 2, 'completo-anual': 2 };
const STATUS_COM_ACESSO = new Set(['active', 'trialing', 'past_due']);

/** Mesma regra do servidor (lib/auth.js → withPlan), calculada em lote para a lista do admin. */
function situacaoDoUsuario(u, { stripe, pix, regra }) {
  if (isAdminEmail(u.email)) return { acesso: 'admin', plano: 'completo', origem: 'Administrador' };
  if (regra?.modo === 'bloqueado') return { acesso: 'bloqueado', plano: null, origem: 'Bloqueado pelo admin' };
  const agora = new Date();
  const candidatos = [];
  if (stripe && STATUS_COM_ACESSO.has(stripe.status)) candidatos.push({ plano: stripe.tier, origem: 'Cartão (Stripe)', ate: stripe.current_period_end });
  if (pix?.acesso_ate && new Date(pix.acesso_ate) > agora) candidatos.push({ plano: pix.ultimo_plano, origem: 'Pix', ate: pix.acesso_ate });
  const regraValida = regra?.modo === 'liberado' && (!regra.ate || new Date(regra.ate) > agora);
  if (regraValida) candidatos.push({ plano: regra.tier, origem: 'Liberado pelo admin', ate: regra.ate });
  candidatos.sort((a, b) => (NIVEL_TIER[b.plano] || 0) - (NIVEL_TIER[a.plano] || 0));
  const melhor = candidatos[0];
  return melhor ? { acesso: 'liberado', ...melhor } : { acesso: 'sem-plano', plano: null, origem: 'Sem pagamento' };
}

export const handleUsers = withGuard(async (request, admin) => {
  if (request.method === 'POST') {
    const body = await readJson(request);
    if (!body?.email) return fail('Informe o e-mail do usuário.');
    if (isAdminEmail(body.email)) return fail('A conta de administrador não pode ser bloqueada nem alterada aqui.');
    const r = await setManualAccess(body.email, { acao: body.acao, plano: body.plano, ate: body.ate, nota: body.nota }, admin.email);
    const acaoAudit = { liberar: 'usuario.liberar', bloquear: 'usuario.bloquear', automatico: 'usuario.automatico' }[body.acao] || 'usuario.acesso';
    await audit(admin.email, acaoAudit, r.email, { plano: body.plano || null, ate: body.ate || null, nota: body.nota || null }).catch(() => {});
    return ok({ ok: true, ...r });
  }
  const [users, regras, assinaturas, pagStripe, pagPix] = await Promise.all([
    listUsers({ limit: 500 }),
    listManualAccess().catch(() => []),
    listarAssinaturasStripe().catch(() => []),
    resumoPagamentosStripe().catch(() => []),
    resumoPagamentosPix().catch(() => [])
  ]);
  const porEmail = (rows) => new Map(rows.map((r) => [String(r.email).toLowerCase(), r]));
  const mRegra = porEmail(regras); const mSub = porEmail(assinaturas); const mPS = porEmail(pagStripe); const mPix = porEmail(pagPix);
  const lista = users.map((u) => {
    const e = String(u.email).toLowerCase();
    const stripe = mSub.get(e) || null; const pix = mPix.get(e) || null; const regra = mRegra.get(e) || null; const ps = mPS.get(e) || null;
    return {
      ...u,
      situacao: situacaoDoUsuario(u, { stripe, pix, regra }),
      regra: regra ? { modo: regra.modo, tier: regra.tier, ate: regra.ate, nota: regra.nota, por: regra.actor_email, em: regra.updated_at } : null,
      cartao: stripe ? { plano: stripe.tier, status: stripe.status, ate: stripe.current_period_end, cancelaNoFim: stripe.cancel_at_period_end } : null,
      pago: {
        totalCentavos: (ps?.cents || 0) + (pix?.cents || 0),
        cartaoCentavos: ps?.cents || 0, cartaoPagamentos: ps?.pagamentos || 0, cartaoReal: Boolean(ps?.real),
        pixCentavos: pix?.cents || 0, pixPagamentos: pix?.pagamentos || 0,
        ultimo: [ps?.ultimo, pix?.ultimo].filter(Boolean).sort().pop() || null
      }
    };
  });
  return ok({ users: lista });
});

/* ---------- Notas a emitir (a nota é feita à mão; aqui só a lista e a marcação) ---------- */
export const handleNotas = withGuard(async (request, admin, url) => {
  if (request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return fail('Dados inválidos.');
    const r = await marcarNota(body, admin.email);
    await audit(admin.email, r.emitida ? 'nota.emitida' : 'nota.desmarcada', `${r.origem}:${r.ref}`, { numero: r.numero }).catch(() => {});
    return ok({ ok: true, ...r });
  }
  if (request.method !== 'GET') return fail('Método não permitido', 405);
  return ok(await listarNotas({ pendentes: url.searchParams.get('filtro') !== 'todas' }));
});

/* ---------- Registro de ações ---------- */
export const handleAudit = withGuard(async () => ok({ items: await listAudit({ limit: 200 }) }));

/* ---------- Cancelamentos de assinatura ---------- */
export const handleCancelamentos = withGuard(async () => ok({ items: await listCancellations({ limit: 200 }) }));

/* ---------- Concursos ---------- */
export const handleAdminConcursos = withGuard(async (request, user, url) => {
  const id = url.searchParams.get('id');
  if (request.method === 'GET') {
    const catalog = await getLiveCatalog({ includeHidden: true, fresh: true });
    if (id) {
      const c = catalog.find((x) => x.id === id);
      return c ? ok({ item: c, campos: CAMPOS_EDITAVEIS, status: STATUS_VALIDOS }) : fail('Concurso não encontrado', 404);
    }
    const q = (url.searchParams.get('q') || '').trim();
    const uf = url.searchParams.get('uf');
    const filtro = url.searchParams.get('filtro'); // editados | ocultos | vencidos
    let list = catalog;
    if (uf) list = list.filter((c) => c.uf === uf);
    if (filtro === 'editados') list = list.filter((c) => c._admin && !c._admin.hidden);
    if (filtro === 'ocultos') list = list.filter((c) => c._admin?.hidden);
    if (filtro === 'vencidos') {
      const hoje = new Date().toISOString().slice(0, 10);
      list = list.filter((c) => c.status === 'Inscrições Abertas' && c.inscricaoFim && c.inscricaoFim < hoje);
    }
    if (q) {
      list = list.map((c) => ({ c, s: scoreConcurso(c, q, ESTADOS_BRASIL[c.uf]?.nome || '') }))
        .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.c);
    }
    const total = list.length;
    const items = list.slice(0, 200).map((c) => ({
      id: c.id, sigla: c.sigla, orgao: c.orgao, titulo: c.titulo, uf: c.uf, banca: c.banca, status: c.status,
      vagas: c.vagas, vagasCR: c.vagasCR, salarioMin: c.salarioMin, salarioMax: c.salarioMax, taxaInscricao: c.taxaInscricao,
      inscricaoInicio: c.inscricaoInicio, inscricaoFim: c.inscricaoFim, dataProva: c.dataProva, provaObservacao: c.provaObservacao,
      atualizadoEm: c.atualizadoEm, _admin: c._admin || null
    }));
    return ok({ total, items, campos: CAMPOS_EDITAVEIS, status: STATUS_VALIDOS });
  }
  if (!id) return fail('Informe o concurso (id).');
  const catalog = await getLiveCatalog({ includeHidden: true, fresh: true });
  if (!catalog.some((c) => c.id === id)) return fail('Concurso não encontrado', 404);
  if (request.method === 'PUT') {
    const body = await readJson(request);
    if (!body) return fail('Dados inválidos.');
    const data = sanitizeOverride(body.data || {});
    await saveOverride(id, data, Boolean(body.hidden), user.email);
    await audit(user.email, body.hidden ? 'concurso.ocultar' : 'concurso.editar', id, { data, hidden: Boolean(body.hidden) });
    return ok({ ok: true });
  }
  if (request.method === 'DELETE') {
    await clearOverride(id);
    await audit(user.email, 'concurso.restaurar', id);
    return ok({ ok: true });
  }
  return fail('Método não permitido', 405);
});

/* ---------- Blog ---------- */
function cleanPost(body) {
  const title = String(body.title || '').trim().slice(0, 160);
  if (!title) throw new Error('O título é obrigatório.');
  const slug = slugify(body.slug || title);
  const status = body.status === 'published' ? 'published' : 'draft';
  const cover = String(body.cover_url || '').trim();
  if (cover && !/^https:\/\//i.test(cover) && !cover.startsWith('/')) throw new Error('A imagem de capa precisa ser um link https:// ou um caminho do site.');
  const tags = Array.isArray(body.tags)
    ? body.tags
    : String(body.tags || '').split(',');
  return {
    id: body.id ? Number(body.id) : null,
    title, slug, status,
    excerpt: String(body.excerpt || '').trim().slice(0, 300),
    content_md: String(body.content_md || '').slice(0, 100_000),
    cover_url: cover || null,
    seo_title: String(body.seo_title || '').trim().slice(0, 70) || null,
    seo_description: String(body.seo_description || '').trim().slice(0, 170) || null,
    tags: tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 10)
  };
}

export const handleAdminPosts = withGuard(async (request, user, url) => {
  const id = url.searchParams.get('id');
  if (request.method === 'GET') {
    if (id) {
      const post = await getPostById(Number(id));
      return post ? ok({ post }) : fail('Post não encontrado', 404);
    }
    return ok({ posts: await listPosts({ includeDrafts: true, limit: 500 }) });
  }
  if (request.method === 'POST' || request.method === 'PUT') {
    const body = await readJson(request);
    if (!body) return fail('Dados inválidos.');
    const post = cleanPost({ ...body, id: request.method === 'PUT' ? (id || body.id) : null });
    try {
      const saved = await upsertPost(post, { email: user.email, name: user.name });
      if (!saved) return fail('Post não encontrado', 404);
      await audit(user.email, request.method === 'POST' ? 'post.criar' : 'post.editar', saved.slug, { id: saved.id, status: saved.status });
      return ok({ post: saved }, request.method === 'POST' ? 201 : 200);
    } catch (err) {
      if (/duplicate key|unique/i.test(err.message)) return fail('Já existe um post com esse endereço (slug). Mude o título ou o slug.', 409);
      throw err;
    }
  }
  if (request.method === 'DELETE') {
    if (!id) return fail('Informe o post (id).');
    const removed = await deletePost(Number(id));
    if (!removed) return fail('Post não encontrado', 404);
    await audit(user.email, 'post.excluir', removed.slug, { id: removed.id, title: removed.title });
    return ok({ ok: true });
  }
  return fail('Método não permitido', 405);
});
