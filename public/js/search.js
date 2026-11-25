/* ======================================================
   Busca de concursos — tolerante a acento, hífen, ordem e maiúsculas
   "pm sp", "PM-SP", "policia sao paulo", "fgv rj", "tj sp" funcionam.
   Cada palavra digitada precisa casar com o início de alguma palavra
   do concurso (órgão, sigla, cargo, banca, estado, área, nível, status).
   ====================================================== */

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Apelidos comuns de concurseiro -> termos que aparecem no catálogo
// Frases com mais de uma palavra precisam aparecer em sequência (ex.: "policia federal").
const ALIASES = {
  pf: 'policia federal',
  prf: 'policia rodoviaria federal',
  pc: 'policia civil',
  pm: 'policia militar',
  pp: 'policia penal',
  cbm: 'bombeiro',
  bombeiros: 'bombeiro',
  tj: 'tribunal de justica',
  trt: 'tribunal regional do trabalho',
  trf: 'tribunal regional federal',
  tre: 'tribunal regional eleitoral',
  mp: 'ministerio publico',
  tce: 'tribunal de contas',
  bb: 'banco do brasil',
  cef: 'caixa',
  professores: 'professor',
  prof: 'professor',
  ti: 'tecnologia da informacao',
  adm: 'administrativo',
  prefeituras: 'prefeitura',
  pref: 'prefeitura',
  abertas: 'inscricoes abertas',
  abertos: 'inscricoes abertas'
};

function phraseScore(phrase, idx) {
  if (!phrase.includes(' ')) return tokenScore(phrase, idx);
  let best = 0;
  for (const [field, text] of Object.entries(idx.fields)) {
    if (` ${text} `.includes(` ${phrase}`)) best = Math.max(best, WEIGHT[field]);
  }
  return best;
}

const cache = new WeakMap();

function indexOf(concurso, estadoNome) {
  let entry = cache.get(concurso);
  if (entry) return entry;
  const fields = {
    sigla: normalizeText(concurso.sigla),
    orgao: normalizeText(concurso.orgao),
    titulo: normalizeText(concurso.titulo),
    banca: normalizeText(concurso.banca),
    outros: normalizeText([
      concurso.uf, estadoNome, concurso.regiao, concurso.area, concurso.esfera,
      Array.isArray(concurso.escolaridade) ? concurso.escolaridade.join(' ') : concurso.escolaridade,
      concurso.status, concurso.cidade, concurso.cargos && concurso.cargos.join ? concurso.cargos.join(' ') : ''
    ].join(' '))
  };
  const words = {};
  for (const [k, v] of Object.entries(fields)) words[k] = v ? v.split(' ') : [];
  const compact = (fields.sigla + fields.orgao).replace(/ /g, '');
  entry = { fields, words, compact };
  cache.set(concurso, entry);
  return entry;
}

const WEIGHT = { sigla: 6, orgao: 4, titulo: 2, banca: 2, outros: 1 };

function tokenScore(token, idx) {
  let best = 0;
  for (const [field, list] of Object.entries(idx.words)) {
    for (const w of list) {
      if (w === token) { best = Math.max(best, WEIGHT[field] + 1); break; }
      // 1–2 letras (UF, siglas) só valem como palavra inteira; 3+ letras valem pelo começo
      if (token.length >= 3 && w.startsWith(token)) { best = Math.max(best, WEIGHT[field]); break; }
    }
  }
  // "pmsp", "tjsp": sigla colada
  if (!best && token.length >= 3 && idx.compact.includes(token)) best = 3;
  return best;
}

/**
 * Retorna 0 quando o concurso não casa com a busca, ou uma nota de relevância (> 0).
 */
export function scoreConcurso(concurso, query, estadoNome = '') {
  const q = normalizeText(query);
  if (!q) return 1;
  const idx = indexOf(concurso, estadoNome);
  const tokens = q.split(' ').filter(Boolean);
  let total = 0;
  for (const token of tokens) {
    let s = tokenScore(token, idx);
    if (!s && ALIASES[token]) s = phraseScore(ALIASES[token], idx);
    if (!s) return 0;
    total += s;
  }
  if (idx.fields.sigla === q || idx.fields.sigla.replace(/ /g, '') === q.replace(/ /g, '')) total += 20;
  else if (idx.fields.orgao.startsWith(q)) total += 8;
  return total;
}

export const SEARCH_SUGGESTIONS = ['PM-SP', 'Polícia Civil', 'Tribunal', 'Professor', 'Cebraspe', 'Prefeitura'];
