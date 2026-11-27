#!/usr/bin/env node
/**
 * Classifica por matéria as questões que o caderno oficial só chamava de "Conhecimentos Gerais",
 * "Prova objetiva" e parecidos. Roda uma vez, localmente; o resultado fica em
 * public/provas/materias-classificadas.json (privado: não vai para a pasta pública do site).
 *
 * - Só a etiqueta de matéria é decidida aqui. Enunciado, alternativas e gabarito não mudam.
 * - A resposta só vale se for um nome da lista oficial (lib/materias.js → MATERIAS).
 * - Pode ser interrompido e rodado de novo: pula o que já foi classificado.
 *
 * Uso: OPENAI_API_KEY=... node tools/materias/classificar.mjs [--modelo gpt-4.1-mini] [--limite N] [--simular]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATERIAS, materiaDoCaderno } from '../../lib/materias.js';
import { carregarProva } from '../../lib/progresso.js';
import { lerIndiceProvas } from '../../lib/acesso.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAIDA = path.join(raiz, 'public', 'provas', 'materias-classificadas.json');
const args = process.argv.slice(2);
const opt = (nome, padrao) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : padrao; };
const MODELO = opt('--modelo', 'gpt-4.1-mini');
const LIMITE = Number(opt('--limite', '0')) || Infinity;
const SIMULAR = args.includes('--simular');
const LOTE = 12;
const PARALELO = 6;
// Preço de tabela por 1 milhão de tokens (US$), só para o relatório de custo
const PRECO = { 'gpt-4.1-mini': [0.4, 1.6], 'gpt-4o-mini': [0.15, 0.6], 'gpt-4.1-nano': [0.1, 0.4] }[MODELO] || [0.4, 1.6];

const corta = (t, n) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

function textoDaQuestao(q) {
  const partes = [];
  if (q.support) partes.push(`Texto de apoio: ${corta(q.support, 300)}`);
  partes.push(corta(q.stem, 700));
  for (const a of q.alternatives || []) if (a.text && !/^(certo|errado)$/i.test(a.text)) partes.push(`${a.letter}) ${corta(a.text, 120)}`);
  return partes.join('\n');
}

const saida = fs.existsSync(SAIDA) ? JSON.parse(fs.readFileSync(SAIDA, 'utf8')) : { provas: {} };
saida.nota = 'Matéria das questões que o caderno oficial não separava por disciplina. Classificação automática (IA) restrita à lista oficial de lib/materias.js; enunciado, alternativas e gabarito não foram alterados.';
saida.modelo = MODELO;

// Monta os lotes: só questões genéricas, não anuladas também (a matéria ajuda nos filtros), ainda sem classificação
const lotes = [];
const vistas = new Set();
for (const chave of Object.keys(lerIndiceProvas())) {
  const prova = carregarProva(chave);
  if (!prova || vistas.has(prova.id)) continue;
  vistas.add(prova.id);
  const feitas = saida.provas[prova.id] || {};
  const pendentes = prova.questoes.filter((q) => !materiaDoCaderno(q.subject) && !MATERIAS.includes(feitas[String(q.number)]));
  for (let i = 0; i < pendentes.length; i += LOTE) lotes.push({ prova, questoes: pendentes.slice(i, i + LOTE) });
}
const total = lotes.reduce((s, l) => s + l.questoes.length, 0);
console.log(`${total} questões para classificar em ${lotes.length} lotes (modelo ${MODELO}).`);
if (SIMULAR) {
  const chars = lotes.reduce((s, l) => s + l.questoes.reduce((a, q) => a + textoDaQuestao(q).length, 0) + 1500, 0);
  const tokIn = Math.round(chars / 3.6);
  console.log(`Estimativa: ~${tokIn} tokens de entrada → US$ ${((tokIn / 1e6) * PRECO[0] + (total * 15 / 1e6) * PRECO[1]).toFixed(2)}`);
  process.exit(0);
}

const chave = (process.env.OPENAI_API_KEY || '').trim();
if (!/^sk-/.test(chave)) { console.error('OPENAI_API_KEY ausente.'); process.exit(1); }

const LISTA = MATERIAS.join('; ');
let usadoIn = 0;
let usadoOut = 0;
let feitas = 0;
let recusadas = 0;

async function classificarLote({ prova, questoes }) {
  const corpo = {
    model: MODELO,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Você classifica questões de concursos públicos brasileiros pela matéria (disciplina). Responda somente com JSON no formato {"numero": "Matéria"}. Use exatamente um nome da lista fornecida. Regras: ' +
        '(1) "Atualidades" é só para fatos dos últimos 3 anos; fatos históricos (guerras, governos, ditadura, redemocratização, Guerra Fria, Constituições antigas) são "História". ' +
        '(2) "Conhecimentos Locais" é história, geografia ou cultura de um estado ou município específico. ' +
        '(3) Questões sobre artigos da Constituição Federal atual são "Direito Constitucional"; sobre o estatuto, regulamento ou lei da própria corporação ou órgão são "Legislação Institucional". ' +
        '(4) Leis penais especiais (drogas, armas, tortura, abuso de autoridade, Maria da Penha, crimes hediondos) são "Legislação Penal Especial". ' +
        '(5) Interpretação de texto, gramática e redação oficial são "Língua Portuguesa". ' +
        '(6) Lógica proposicional, sequências e problemas de raciocínio são "Raciocínio Lógico"; contas, porcentagem, frações e geometria são "Matemática". ' +
        '(7) "Conhecimentos Específicos do Cargo" só quando o assunto for técnico da profissão (saúde, engenharia, pedagogia específica etc.) e não couber em nenhuma outra matéria da lista. ' +
        'Questões vizinhas costumam formar blocos da mesma matéria, mas classifique cada uma pelo seu conteúdo.' },
      { role: 'user', content: `Prova: ${prova.titulo} · banca ${prova.banca} · cargo ${prova.cargo}.\nLista de matérias: ${LISTA}.\n\nQuestões (em ordem; questões vizinhas costumam ser da mesma matéria):\n\n${questoes.map((q) => `### ${q.number}\n${textoDaQuestao(q)}`).join('\n\n')}` }
    ]
  };
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
        body: JSON.stringify(corpo)
      });
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 2000 * tentativa)); continue; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
      usadoIn += data.usage?.prompt_tokens || 0;
      usadoOut += data.usage?.completion_tokens || 0;
      const r = JSON.parse(data.choices[0].message.content);
      const destino = (saida.provas[prova.id] ||= {});
      for (const q of questoes) {
        const m = String(r[String(q.number)] || '').trim();
        if (MATERIAS.includes(m)) { destino[String(q.number)] = m; feitas++; } else recusadas++;
      }
      return;
    } catch (err) {
      if (tentativa === 3) { console.warn(`lote ${prova.id} falhou: ${err.message}`); recusadas += questoes.length; }
    }
  }
}

function gravar() {
  const ordenado = { ...saida, provas: Object.fromEntries(Object.entries(saida.provas).sort(([a], [b]) => a.localeCompare(b))) };
  fs.writeFileSync(SAIDA, JSON.stringify(ordenado, null, 1) + '\n');
}

let proximo = 0;
let enviadas = 0;
async function trabalhador() {
  while (proximo < lotes.length && enviadas < LIMITE) {
    const lote = lotes[proximo++];
    enviadas += lote.questoes.length;
    await classificarLote(lote);
    if (proximo % 20 === 0) { gravar(); console.log(`… ${feitas} classificadas, ${recusadas} sem resposta válida`); }
  }
}
await Promise.all(Array.from({ length: PARALELO }, trabalhador));

// Regra fixa depois da IA: perguntas sobre o próprio texto (parágrafo, período, vocábulo, trecho)
// são interpretação de texto, mesmo quando o texto fala de um tema atual.
const SOBRE_O_TEXTO = /(infere-se|o texto mostra|de um texto|par[áa]grafo|per[íi]odo d[oa]|voc[áa]bulo|trecho|(de acordo com|segundo|conforme|no|do) o? ?texto|“[^”]{2,40}”\s*\()/i;
const TI = /\b(software|UML|banco de dados|SQL|algoritmo|linguagem de programa|Java|Python|sistema operacional|redes? de computadores|protocolo TCP|hipervisor|m[áa]quinas? virtua|criptografia|firewall|engenharia de requisitos|scrum|ITIL|COBIT)\b/i;
let ajustadas = 0;
for (const chave of Object.keys(lerIndiceProvas())) {
  const prova = carregarProva(chave);
  const feitasProva = prova && saida.provas[prova.id];
  if (!feitasProva) continue;
  for (const q of prova.questoes) {
    const n = String(q.number);
    const stem = q.stem || '';
    if (feitasProva[n] === 'Atualidades' && SOBRE_O_TEXTO.test(stem) && !/^\s*leia o texto/i.test(stem)) {
      feitasProva[n] = 'Língua Portuguesa';
      ajustadas++;
    } else if (feitasProva[n] === 'Legislação Penal Especial' && /c[óo]digo penal|\bCP\b/.test(stem) && !/\blei n/i.test(stem)) {
      // Crimes do próprio Código Penal são Direito Penal; lei especial é a que fica fora dele
      feitasProva[n] = 'Direito Penal';
      ajustadas++;
    } else if (feitasProva[n] === 'Conhecimentos Específicos do Cargo' && TI.test(stem + ' ' + (q.alternatives || []).map((a) => a.text).join(' '))) {
      feitasProva[n] = 'Tecnologia da Informação';
      ajustadas++;
    }
  }
}
if (ajustadas) console.log(`Regras fixas: ${ajustadas} questões corrigidas (texto → Língua Portuguesa; Código Penal → Direito Penal; software → Tecnologia da Informação).`);
gravar();
const custo = (usadoIn / 1e6) * PRECO[0] + (usadoOut / 1e6) * PRECO[1];
console.log(`Pronto: ${feitas} classificadas, ${recusadas} sem resposta válida. Tokens: ${usadoIn} entrada, ${usadoOut} saída. Custo estimado: US$ ${custo.toFixed(4)}`);
