/**
 * Aplica no catálogo os ajustes feitos pelo admin (tabela cnc_concurso_overrides).
 * Só campos da lista abaixo podem ser alterados — nada de código ou HTML vindo do painel.
 */
import { CONCURSOS } from '../public/js/data/concursos.js';
import { getOverrides } from './db.js';

export const STATUS_VALIDOS = ['Inscrições Abertas', 'Edital Publicado', 'Prova Agendada', 'Previsto / Autorizado', 'Encerrado'];

// campo -> tipo
export const CAMPOS_EDITAVEIS = {
  status: 'status',
  titulo: 'texto',
  banca: 'texto',
  provaObservacao: 'texto',
  inscricaoInicio: 'data',
  inscricaoFim: 'data',
  dataProva: 'data',
  vagas: 'numero',
  vagasCR: 'numero',
  salarioMin: 'numero',
  salarioMax: 'numero',
  taxaInscricao: 'numero'
};

/** Valida e limpa o que veio do painel. Lança erro com mensagem amigável. */
export function sanitizeOverride(input) {
  const out = {};
  for (const [campo, tipo] of Object.entries(CAMPOS_EDITAVEIS)) {
    if (!(campo in (input || {}))) continue;
    const v = input[campo];
    if (v === null || v === '') { out[campo] = null; continue; }
    if (tipo === 'status') {
      if (!STATUS_VALIDOS.includes(v)) throw new Error(`Status inválido: ${v}`);
      out[campo] = v;
    } else if (tipo === 'data') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new Error(`Data inválida em ${campo} (use AAAA-MM-DD)`);
      out[campo] = String(v);
    } else if (tipo === 'numero') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) throw new Error(`Número inválido em ${campo}`);
      out[campo] = n;
    } else {
      out[campo] = String(v).replace(/[<>]/g, '').slice(0, 300);
    }
  }
  return out;
}

export function applyOverrides(items, rows, { includeHidden = false } = {}) {
  if (!rows || rows.length === 0) return items;
  const map = new Map(rows.map((r) => [r.concurso_id, r]));
  const out = [];
  for (const c of items) {
    const o = map.get(c.id);
    if (!o) { out.push(c); continue; }
    if (o.hidden && !includeHidden) continue;
    const data = o.data || {};
    const merged = { ...c };
    for (const campo of Object.keys(CAMPOS_EDITAVEIS)) {
      if (data[campo] !== undefined && data[campo] !== null) merged[campo] = data[campo];
    }
    if (merged.salarioMax < merged.salarioMin) merged.salarioMax = merged.salarioMin;
    const upd = o.updated_at instanceof Date ? o.updated_at.toISOString() : String(o.updated_at || '');
    merged.atualizadoEm = upd.slice(0, 10) || merged.atualizadoEm;
    if (data.dataProva) merged.dataProvaAtualizadaEm = merged.atualizadoEm;
    if (includeHidden) merged._admin = { hidden: o.hidden, editado: true, data, updatedBy: o.updated_by, updatedAt: o.updated_at };
    out.push(merged);
  }
  return out;
}

/** Catálogo público já com os ajustes do admin. Se o banco falhar, devolve o catálogo estático. */
export async function getLiveCatalog({ includeHidden = false, fresh = false } = {}) {
  try {
    const rows = await getOverrides({ fresh });
    return applyOverrides(CONCURSOS, rows, { includeHidden });
  } catch (err) {
    console.warn('[catalog] usando catálogo estático:', err.message);
    return CONCURSOS;
  }
}
