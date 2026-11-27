/**
 * Matérias e bancas padronizadas — Check no Concurso.
 *
 * Os arquivos das provas (public/provas/*.json) continuam como foram extraídos do caderno
 * oficial. Este arquivo só acrescenta um nome padrão por cima:
 *   - bancas com dois nomes (CESPE/Cebraspe, VUNESP/Fundação Vunesp) viram um só;
 *   - matérias com nomes diferentes para a mesma coisa viram uma só (lista MATERIAS);
 *   - questões que o caderno só chamava de "Conhecimentos Gerais", "Prova objetiva" e
 *     parecidos recebem a matéria classificada em tools/materias/classificar.mjs
 *     (public/provas/materias-classificadas.json). Enunciado, alternativas e gabarito não mudam.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Lista oficial de matérias (a classificação só pode escolher uma destas). */
export const MATERIAS = [
  'Língua Portuguesa', 'Inglês', 'Matemática', 'Raciocínio Lógico', 'Matemática Financeira', 'Estatística',
  'Informática', 'Tecnologia da Informação', 'Atualidades', 'História', 'Geografia', 'Conhecimentos Locais',
  'Biologia', 'Física', 'Química', 'Ética no Serviço Público', 'Administração Geral', 'Administração Pública',
  'Administração Financeira e Orçamentária', 'Contabilidade Geral', 'Contabilidade Pública', 'Auditoria',
  'Economia', 'Finanças Públicas', 'Direito Constitucional', 'Direito Administrativo', 'Direito Penal',
  'Direito Processual Penal', 'Direito Penal Militar', 'Direito Processual Penal Militar', 'Direito Civil',
  'Direito Processual Civil', 'Direito do Consumidor', 'Direito Notarial e Registral',
  'Formação Humanística (Filosofia e Sociologia do Direito)', 'Direito Empresarial', 'Direito Tributário', 'Direito Financeiro',
  'Direito Previdenciário', 'Direito do Trabalho', 'Direito Processual do Trabalho', 'Direito Ambiental',
  'Direito Eleitoral', 'Direito Urbanístico', 'Direito da Criança e do Adolescente', 'Direitos Humanos',
  'Criminologia', 'Medicina Legal', 'Legislação Penal Especial', 'Legislação de Trânsito', 'Legislação Institucional',
  'Legislação Tributária', 'Saúde Pública (SUS)', 'Educação e Legislação Educacional',
  'Conhecimentos Específicos do Cargo'
];

/** Nomes genéricos do caderno: a matéria de verdade vem da classificação. */
export const GENERICAS = new Set([
  'Conhecimento Específico', 'Conhecimentos Específicos', 'Conhecimentos Especializados', 'Conhecimentos Básicos',
  'Conhecimentos Gerais', 'Conhecimentos Gerais - Médio', 'Prova objetiva', 'Direito', 'Noções de Direito',
  'Noções Gerais de Direito e Formação', 'Direito Processual', 'Noções de Legislação', 'Matemática e Raciocínio Lógico',
  ''
]);

/** Nome do caderno → nome padrão. */
const MAPA = {
  'Administração': 'Administração Geral',
  'Noções de Administração Pública': 'Administração Pública',
  'Auditoria Financeira': 'Auditoria', 'Auditoria Geral': 'Auditoria', 'Auditoria Governamental': 'Auditoria',
  'Auditoria de TI': 'Tecnologia da Informação',
  'Conhecimentos de Sus': 'Saúde Pública (SUS)',
  'Conhecimentos Político-Pedagógicos e Legislação': 'Educação e Legislação Educacional',
  'Conhecimentos Sobre Contagem/Mg': 'Conhecimentos Locais',
  'História e Geografia de Mato Grosso': 'Conhecimentos Locais', 'História e Geografia do Acre': 'Conhecimentos Locais',
  'Contabilidade': 'Contabilidade Geral', 'Contabilidade Avançada': 'Contabilidade Geral',
  'Contabilidade Aplicada ao Setor Público': 'Contabilidade Pública', 'Noções de Contabilidade Pública': 'Contabilidade Pública',
  'Noções de Criminologia': 'Criminologia',
  'Noções de Direito Administrativo': 'Direito Administrativo',
  'Direito Civil e Empresarial': 'Direito Civil',
  'Direito Comercial': 'Direito Empresarial', 'Direito Comercial e Empresarial': 'Direito Empresarial',
  'Noções de Direito Constitucional': 'Direito Constitucional', 'Direito Constitucional e Ministério Público': 'Direito Constitucional',
  'Direito da Infância e Juventude': 'Direito da Criança e do Adolescente',
  'Direito Financeiro e Tributário': 'Direito Financeiro',
  'Direito Penal Comum': 'Direito Penal', 'Noções de Direito Penal': 'Direito Penal',
  'Direito Processual Militar': 'Direito Processual Penal Militar',
  'Direito Processual Penal Comum': 'Direito Processual Penal',
  'Estatística Básica': 'Estatística',
  'Ética e Filosofia': 'Ética no Serviço Público', 'Ética Na Administração Pública': 'Ética no Serviço Público',
  'Geografia Geral e do Brasil': 'Geografia', 'História do Brasil': 'História',
  'Informática Básica': 'Informática', 'Noções Básicas de Informática': 'Informática', 'Noções de Informática': 'Informática',
  'Legislação da PMAC': 'Legislação Institucional', 'Legislação pertinente ao CBMAL': 'Legislação Institucional',
  'Legislação Pmrn': 'Legislação Institucional', 'Legislação Específica': 'Legislação Institucional',
  'Legislação Estadual': 'Legislação Institucional',
  'Legislação Extravagante': 'Legislação Penal Especial', 'Legislação Penal e Processual': 'Legislação Penal Especial',
  'Legislação Penal e Processual Penal Extravagante': 'Legislação Penal Especial',
  'Legislação Tributária Estadual': 'Legislação Tributária', 'Legislação Tributária Municipal': 'Legislação Tributária',
  'Língua Portuguesa – Médio': 'Língua Portuguesa', 'Língua Portuguesa e Interpretação de Texto': 'Língua Portuguesa',
  'Português': 'Língua Portuguesa',
  'Matemática Financeira e Estatística': 'Matemática Financeira',
  'Noções de Finanças Públicas': 'Finanças Públicas',
  'Raciocínio': 'Raciocínio Lógico', 'Raciocínio Lógico - Quantitativo': 'Raciocínio Lógico',
  'Raciocínio Lógico e Matemático': 'Raciocínio Lógico', 'Raciocínio Lógico-Matemático': 'Raciocínio Lógico'
};

const BANCAS = { CESPE: 'Cebraspe', 'CESPE/UnB': 'Cebraspe', 'Cebraspe (CESPE)': 'Cebraspe', VUNESP: 'Fundação Vunesp', Vunesp: 'Fundação Vunesp' };

const MATERIAS_SET = new Set(MATERIAS);

export function bancaPadrao(banca) {
  const b = String(banca || '').trim();
  return BANCAS[b] || b;
}

/** Nome padrão de uma matéria do caderno, ou null quando o nome é genérico. */
export function materiaDoCaderno(subject) {
  const s = String(subject || '').trim();
  if (GENERICAS.has(s)) return null;
  if (MAPA[s]) return MAPA[s];
  return s;
}

const ARQUIVO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'provas', 'materias-classificadas.json');
let classificadas = null;
export function lerClassificadas() {
  if (classificadas) return classificadas;
  try {
    classificadas = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')).provas || {};
  } catch {
    classificadas = {};
  }
  return classificadas;
}

/** Matéria padrão de uma questão: a do caderno (padronizada) ou a classificada; senão, o nome original. */
export function materiaDaQuestao(provaId, q) {
  const doCaderno = materiaDoCaderno(q.subject);
  if (doCaderno) return { materia: doCaderno, fonte: 'caderno' };
  const c = lerClassificadas()[provaId]?.[String(q.number)];
  if (c && MATERIAS_SET.has(c)) return { materia: c, fonte: 'classificada' };
  return { materia: String(q.subject || '').trim() || 'Sem matéria definida', fonte: 'caderno' };
}

/** Cópia da prova com banca padronizada e, em cada questão, `materia` (padrão) além do `subject` original. */
export function aplicarPadroes(prova) {
  if (!prova || !Array.isArray(prova.questoes)) return prova;
  return {
    ...prova,
    banca: bancaPadrao(prova.banca),
    questoes: prova.questoes.map((q) => ({ ...q, materia: materiaDaQuestao(prova.id, q).materia }))
  };
}

/** Índice leve das provas com a banca padronizada. */
export function aplicarPadroesIndice(indice) {
  const out = {};
  for (const [k, v] of Object.entries(indice || {})) out[k] = v && typeof v === 'object' ? { ...v, banca: bancaPadrao(v.banca) } : v;
  return out;
}
