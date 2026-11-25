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
  abertos: 'inscricoes abertas',
  gm: 'guarda municipal',
  gcm: 'guarda civil',
  penitenciario: 'policia penal',
  carcerario: 'policia penal',
  detran: 'transito'
};

// Palavras que não ajudam a filtrar ("concurso de professor em sp", "ensino médio")
const STOPWORDS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas', 'o', 'a', 'os', 'as',
  'para', 'pra', 'com', 'por', 'concurso', 'concursos', 'vaga', 'vagas', 'edital', 'editais',
  'ensino', 'nivel', 'cargo', 'cargos', 'publico', 'publica'
]);

// Distância de edição simples (erros de digitação: "profesor", "cebrapse")
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev[j - 2] + 1); // letras trocadas
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function singular(token) {
  if (token.length <= 4) return null;
  if (token.endsWith('oes')) return token.slice(0, -3) + 'ao'; // inscricoes -> inscricao
  if (token.endsWith('aes')) return token.slice(0, -3) + 'ao';
  if (token.endsWith('res') || token.endsWith('zes')) return token.slice(0, -2); // professores -> professor
  if (token.endsWith('is')) return token.slice(0, -2) + 'l'; // fiscais -> fiscal
  if (token.endsWith('s')) return token.slice(0, -1); // enfermeiros -> enfermeiro
  return null;
}

function fuzzyScore(token, idx) {
  if (token.length < 5 || /\d/.test(token)) return 0;
  const max = token.length >= 8 ? 2 : 1;
  let best = 0;
  for (const [field, list] of Object.entries(idx.words)) {
    for (const w of list) {
      if (w.length < 4) continue;
      const head = w.length > token.length ? w.slice(0, token.length) : w; // aceita começo de palavra
      if (editDistance(token, head, max) <= max || editDistance(token, w, max) <= max) {
        best = Math.max(best, Math.max(1, WEIGHT[field] - 1));
        break;
      }
    }
  }
  return best;
}

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
      concurso.status, concurso.cidade, concurso.cargos && concurso.cargos.join ? concurso.cargos.join(' ') : '',
      // cargos que estão dentro do edital (ex.: "Escrivão", "Agente de Trânsito")
      concurso.edital && Array.isArray(concurso.edital.cargos) ? concurso.edital.cargos.map((c) => c && c.nome).join(' ') : ''
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
  const allTokens = q.split(' ').filter(Boolean);
  const meaningful = allTokens.filter((t) => !STOPWORDS.has(t));
  const tokens = meaningful.length ? meaningful : allTokens;
  let total = 0;
  for (const token of tokens) {
    let s = tokenScore(token, idx);
    if (!s && ALIASES[token]) s = phraseScore(ALIASES[token], idx);
    if (!s) {
      const sing = singular(token);
      if (sing) s = tokenScore(sing, idx) || (ALIASES[sing] ? phraseScore(ALIASES[sing], idx) : 0);
    }
    if (!s) s = fuzzyScore(token, idx); // erro de digitação vale menos
    if (!s) return 0;
    total += s;
  }
  // Frase digitada aparece inteira no órgão/cargo: sobe no ranking ("policia federal")
  if (tokens.length > 1) {
    const phrase = tokens.join(' ');
    if (` ${idx.fields.orgao} `.includes(` ${phrase}`) || ` ${idx.fields.titulo} `.includes(` ${phrase}`)) total += 6;
  }
  if (idx.fields.sigla === q || idx.fields.sigla.replace(/ /g, '') === q.replace(/ /g, '')) total += 20;
  else if (idx.fields.orgao.startsWith(q)) total += 8;
  return total;
}

export const SEARCH_SUGGESTIONS = ['PM-SP', 'Polícia Civil', 'Tribunal', 'Professor', 'Cebraspe', 'Prefeitura'];
