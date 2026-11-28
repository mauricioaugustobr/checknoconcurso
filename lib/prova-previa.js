/**
 * Item 11 · Prévia com cadeado para quem assina o Essencial.
 * /api/prova-previa/:id (tipo=previa) → resumo da prova anterior do concurso, para o plano Essencial ou maior.
 *
 * Entrega SÓ o que convence sem entregar o treino:
 *  - ano, banca, cargo e total de questões (o índice /api/provas já mostra isso ao Essencial);
 *  - quantas questões há por matéria;
 *  - o enunciado de 1 questão (sem texto de apoio), cortado.
 * Nunca entrega o texto das alternativas, o gabarito nem a explicação: isso continua só no Completo.
 */
import { lerIndiceProvas, lerProvaArquivo } from './acesso.js';
import { getProva } from '../public/js/data/provas.js';
import { bancaPadrao, materiaDaQuestao } from './materias.js';

const LIMITE_ENUNCIADO = 260;

function cortar(texto, limite = LIMITE_ENUNCIADO) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (t.length <= limite) return { texto: t, cortado: false };
  const corte = t.slice(0, limite);
  const fim = corte.lastIndexOf(' ');
  return { texto: `${corte.slice(0, fim > limite * 0.6 ? fim : limite).replace(/[\s,;:.–-]+$/, '')}…`, cortado: true };
}

/** Questão boa para mostrar: anulada não, sem imagem nem texto de apoio, enunciado de tamanho médio. */
function escolherQuestao(questoes) {
  const validas = questoes.filter((q) => q && q.stem && !q.annulled && Array.isArray(q.alternatives) && q.alternatives.length >= 2);
  const semApoio = validas.filter((q) => !q.needsArt && !q.support && !q.supportImage && !/ingl|espanh|english/i.test(q.subject || ''));
  // Evita enunciado que depende de algo que a prévia não mostra (texto, tira, gráfico, lacunas)
  const DEPENDE = /lacuna|par[áa]grafo|per[íi]odo|linha|texto|tira|charge|figura|gr[áa]fico|imagem|quadro|tabela|trecho|abaixo|a seguir|seguinte/i;
  const media = (q) => q.stem.length >= 80 && q.stem.length <= 400;
  return semApoio.find((q) => media(q) && !DEPENDE.test(q.stem))
    || semApoio.find(media) || semApoio[0] || validas[0] || null;
}

export function previaDaProva(id) {
  if (!/^[a-z0-9-]{3,80}$/i.test(String(id || '')) || id === 'index') return null;
  const indice = lerIndiceProvas();
  if (!indice[id]) return null;
  const prova = getProva(id) || lerProvaArquivo(id);
  if (!prova || !Array.isArray(prova.questoes) || !prova.questoes.length) return null;
  const provaId = prova.id || id;

  const contagem = new Map();
  for (const q of prova.questoes) {
    const m = materiaDaQuestao(provaId, q).materia;
    contagem.set(m, (contagem.get(m) || 0) + 1);
  }
  const materias = [...contagem.entries()]
    .map(([nome, questoes]) => ({ nome, questoes }))
    .sort((a, b) => b.questoes - a.questoes || a.nome.localeCompare(b.nome, 'pt-BR'));

  const q = escolherQuestao(prova.questoes);
  const enunciado = q ? cortar(q.stem) : null;
  return {
    id,
    ano: prova.ano || indice[id].ano || null,
    banca: bancaPadrao(prova.banca || indice[id].banca),
    cargo: prova.cargo || indice[id].cargo || '',
    total: prova.questoes.length,
    materias: materias.slice(0, 6),
    outrasMaterias: Math.max(0, materias.length - 6),
    questao: q ? {
      numero: q.number,
      materia: materiaDaQuestao(provaId, q).materia,
      enunciado: enunciado.texto,
      cortado: enunciado.cortado,
      // Só as letras: o texto das alternativas e o gabarito ficam no servidor
      letras: q.alternatives.map((a) => String(a.letter || '').slice(0, 1)).filter(Boolean)
    } : null
  };
}
