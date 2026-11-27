/**
 * Item 7 · Compartilhar concurso (Opção 1 da Designer UI/UX) — dados comuns.
 * Usado pelo servidor (página pública e imagens de prévia/Stories) e pelo navegador (ficha do concurso).
 * Só usa dados públicos do concurso (os mesmos da página /concurso/<id>).
 * Regra: a mensagem NÃO leva o prazo de inscrição (pode ser prorrogado; o prazo fica na página).
 */
import { ESTADOS_BRASIL } from './data/site-info.js';

export const SITE = 'https://checknoconcurso.com.br';

const PREP_UF = { AC: 'do', AP: 'do', AM: 'do', CE: 'do', DF: 'do', ES: 'do', MA: 'do', PA: 'do', PR: 'do', PI: 'do', RJ: 'do', RN: 'do', RS: 'do', TO: 'do', BA: 'da', PB: 'da' };
const nf = (n) => Number(n || 0).toLocaleString('pt-BR');
const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
const isoDay = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : ''));
const dataBR = (iso) => (iso ? isoDay(iso).split('-').reverse().join('/') : '');

// Cidade de concursos municipais: o catálogo não tem campo próprio, ela sai do nome do órgão
export function cidadeDoOrgao(orgao) {
  const o = String(orgao || '');
  const limpa = (s) => s.split(/\s+e\s+(?:Câmara|Prefeitura|Secretaria)\b/)[0].trim();
  // "Prefeitura de X", "Câmara Municipal de X", "Guarda Civil Municipal de X", "Prefeitura e Câmara de X"
  const m = o.match(/(?:Prefeitura|Câmara|Guarda|Município)[^()—–]*?\s(?:de|do|da|dos|das)\s+([^()—–]+?)\s*(?:\(|—|–|$)/);
  if (m) return limpa(m[1]);
  // "Secretaria Municipal de Educação de X", "Instituto de Previdência de X"
  const s = o.match(/(?:Educação(?: e Cultura)?|Saúde|Previdência)\s+(?:de|do|da)\s+([^()—–]+?)\s*\(/);
  if (s) return limpa(s[1]);
  return null; // sem cidade clara (consórcio, fundação): usa o estado
}

export function localConcurso(c) {
  if (!c || c.uf === 'Nacional') return 'Todo o Brasil';
  const nome = ESTADOS_BRASIL[c.uf]?.nome || c.uf;
  if (c.uf === 'DF') return 'Distrito Federal (DF)';
  if (c.esfera === 'Municipal') {
    const cidade = cidadeDoOrgao(c.orgao);
    if (cidade) return `${cidade} (${c.uf})`;
  }
  return `Estado ${PREP_UF[c.uf] || 'de'} ${nome} (${c.uf})`;
}

// Vagas: "2.000" / "2.000 + CR" (imagem) e "2.000 vagas" / "2.000 vagas + cadastro reserva" (mensagem)
export function vagasImagem(c) {
  if (!c?.vagas) return { texto: 'Cadastro reserva', pequeno: true };
  return { texto: `${nf(c.vagas)}${c.vagasCR ? ' + CR' : ''}`, pequeno: false };
}
export function vagasMensagem(c) {
  if (!c?.vagas) return 'Cadastro reserva';
  return `${nf(c.vagas)} ${c.vagas === 1 ? 'vaga' : 'vagas'}${c.vagasCR ? ' + cadastro reserva' : ''}`;
}

export const salarioTexto = (c) => brl(c?.salarioMax);
export const provaTexto = (c) => (c?.dataProva ? dataBR(c.dataProva) : 'A definir');
export const versaoImagem = (c) => isoDay(c?.atualizadoEm) || isoDay(c?.dataProvaAtualizadaEm) || 'v1';

/** Endereço público da página do concurso (com marcação de origem para o Analytics). */
export function linkConcurso(c, { base = SITE, marcar = true } = {}) {
  return `${base}/concurso/${encodeURIComponent(c.id)}${marcar ? '?utm_source=compartilhar' : ''}`;
}
export const imagemPrevia = (c, base = SITE) => `${base}/og/concurso/${encodeURIComponent(c.id)}.png?v=${versaoImagem(c)}`;
export const imagemStories = (c, base = SITE) => `${base}/og/stories/${encodeURIComponent(c.id)}.png?v=${versaoImagem(c)}`;

/** Mensagem pronta (texto exato da Designer, Opção 1). */
export function mensagemCompartilhar(c, opts = {}) {
  return [
    `Concurso ${c.sigla}: ${c.titulo}`,
    `📍 ${localConcurso(c)}`,
    `👥 ${vagasMensagem(c)}`,
    `💰 Salário até ${salarioTexto(c)}`,
    'Veja datas, edital e situação atualizados:',
    linkConcurso(c, opts)
  ].join('\n');
}

/** Atributos data-* do botão Compartilhar (página pública e ficha). */
export function dadosBotao(c, base = SITE) {
  return {
    id: c.id,
    sigla: c.sigla,
    link: linkConcurso(c, { base }),
    mensagem: mensagemCompartilhar(c, { base }),
    previa: imagemPrevia(c, base),
    stories: imagemStories(c, base),
    arquivo: `checknoconcurso-${String(c.sigla || c.id).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-stories.png`
  };
}
