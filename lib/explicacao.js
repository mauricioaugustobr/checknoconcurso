/**
 * Resposta comentada das questões de provas anteriores (só no servidor).
 *
 * GET /api/explicacao?c=<concurso>&q=<número>
 * - A questão é lida no servidor (o navegador só manda o concurso e o número),
 *   então ninguém consegue mandar um texto qualquer para a IA.
 * - A explicação tem sempre 3 parágrafos e segue o gabarito oficial.
 * - Cada questão é gerada uma única vez e fica guardada no banco (cnc_explicacoes);
 *   depois disso, todos os alunos recebem a mesma explicação, sem novo custo.
 * - A chave fica na variável OPENAI_API_KEY da Vercel. Nunca vai para o navegador.
 */
import { db } from './db.js';
import { getProva } from '../public/js/data/provas.js';
import { exigirPlano, lerProvaArquivo, NIVEL } from './acesso.js';

const MODELOS_PADRAO = ['gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini'];
const LIMITE_POR_IP = 40; // gerações novas por IP a cada 10 minutos (o cache não conta)
const JANELA_MS = 10 * 60 * 1000;

const examCache = new Map();
const emAndamento = new Map();
const porIp = new Map();
let schema;

const reply = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }
  });

export function hasOpenAI() {
  return /^sk-/.test((process.env.OPENAI_API_KEY || '').trim());
}

function ready(sql) {
  return (schema ||= sql`create table if not exists cnc_explicacoes (
      concurso_id text not null,
      numero int not null,
      prova_id text,
      gabarito text,
      paragrafos jsonb not null,
      modelo text,
      created_at timestamptz default now(),
      primary key (concurso_id, numero))`.catch((err) => {
    schema = null;
    throw err;
  }));
}

async function carregarProva(concursoId, origin) {
  const local = getProva(concursoId);
  if (local) return local;
  if (examCache.has(concursoId)) return examCache.get(concursoId);
  // As provas não ficam mais públicas: o servidor lê do próprio disco
  const exam = lerProvaArquivo(concursoId);
  if (!exam) return null;
  examCache.set(concursoId, exam);
  return exam;
}

function limitarIp(request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  const agora = Date.now();
  const lista = (porIp.get(ip) || []).filter((t) => agora - t < JANELA_MS);
  if (lista.length >= LIMITE_POR_IP) return false;
  lista.push(agora);
  porIp.set(ip, lista);
  if (porIp.size > 5000) porIp.clear();
  return true;
}

function rotulo(exam, letra) {
  if (exam.formato === 'certo-errado') return letra === 'C' ? 'Certo' : 'Errado';
  return letra;
}

export function montarPrompt(exam, q) {
  const certoErrado = exam.formato === 'certo-errado';
  const apoio = String(q.support || '').trim().slice(0, 7000);
  const alternativas = certoErrado
    ? 'Item de julgamento: o candidato marca Certo ou Errado.'
    : q.alternatives.map((a) => `(${a.letter}) ${a.text}`).join('\n');
  const faltaApoio = (q.needsSource || q.needsArt) && !apoio;

  const estrutura = certoErrado
    ? [
        '1º parágrafo: explique o que o item cobra e qual é o conceito, a regra ou o raciocínio por trás dele.',
        `2º parágrafo: explique por que o item está ${rotulo(exam, q.answer).toUpperCase()}, que é o gabarito oficial.`,
        '3º parágrafo: mostre a pegadinha mais comum nesse tipo de item e feche com uma dica prática para a prova.'
      ]
    : [
        '1º parágrafo: explique o que a questão cobra e qual é o conceito, a regra ou o raciocínio por trás dela.',
        `2º parágrafo: explique por que a alternativa ${q.answer}, que é o gabarito oficial, está correta.`,
        '3º parágrafo: diga por que cada uma das outras alternativas está errada, citando a letra de cada uma, e feche com uma dica prática para a prova.'
      ];

  const system = [
    'Você é professor de cursinho preparatório para concursos públicos no Brasil.',
    'Explica questões de provas anteriores em português do Brasil, com linguagem clara, direta e correta.',
    'O gabarito oficial informado é definitivo: nunca o contradiga nem diga que a banca errou.',
    'Não invente leis, artigos, súmulas, datas ou números. Cite um dispositivo legal só quando tiver certeza dele.',
    'Responda somente em JSON no formato {"paragrafos":["...","...","..."]}, com exatamente 3 parágrafos de 3 a 5 frases cada, sem markdown e sem títulos.'
  ].join(' ');

  const user = [
    `Prova: ${exam.titulo} (${exam.banca}, ${exam.ano}). Cargo: ${exam.cargo}.`,
    `Disciplina: ${q.subject}.`,
    apoio ? `Texto de apoio:\n${apoio}` : '',
    faltaApoio
      ? 'Atenção: esta questão usa um texto, tabela ou imagem do caderno que não foi enviado. Explique pelo enunciado e pelas alternativas, sem inventar o conteúdo que você não viu.'
      : '',
    `Questão ${q.number}:\n${q.stem}`,
    alternativas,
    `Gabarito oficial: ${rotulo(exam, q.answer)}.`,
    `Escreva a explicação em 3 parágrafos:\n${estrutura.join('\n')}`
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, user };
}

function normalizar(texto) {
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch {
    dados = { paragrafos: String(texto || '').split(/\n\s*\n/) };
  }
  let p = (Array.isArray(dados?.paragrafos) ? dados.paragrafos : [])
    .map((x) => String(x || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (p.length > 3) p = [p[0], p[1], p.slice(2).join(' ')];
  return p.length === 3 ? p : null;
}

async function chamarOpenAI(exam, q, origin) {
  const { system, user } = montarPrompt(exam, q);
  const imagem = q.supportImage && origin.startsWith('https://') ? `${origin}${q.supportImage}` : '';
  const conteudo = imagem
    ? [{ type: 'text', text: user }, { type: 'image_url', image_url: { url: imagem } }]
    : user;
  const modelos = [process.env.OPENAI_MODEL, ...MODELOS_PADRAO].filter((m, i, a) => m && a.indexOf(m) === i);
  let ultimoErro = 'sem resposta';

  for (const modelo of modelos) {
    for (const comImagem of imagem ? [true, false] : [false]) {
      const body = {
        model: modelo,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: comImagem ? conteudo : user }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 4000
      };
      // 'minimal' responde em ~7 s (com 'low' eram ~15 s), com texto de qualidade parecida.
      // Para voltar ao modo anterior, defina OPENAI_REASONING=low na Vercel.
      if (/^gpt-5|^o\d/.test(modelo)) body.reasoning_effort = process.env.OPENAI_REASONING || 'minimal';
      else body.temperature = 0.3;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(55_000)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const paragrafos = normalizar(data.choices?.[0]?.message?.content);
        if (paragrafos) return { paragrafos, modelo };
        ultimoErro = 'resposta fora do formato de 3 parágrafos';
        continue;
      }
      ultimoErro = `${res.status} ${data?.error?.code || data?.error?.type || ''}`.trim();
      if (res.status === 401 || res.status === 429) throw new Error(ultimoErro);
      // Modelo indisponível na conta ou imagem recusada: tenta a próxima opção.
    }
  }
  throw new Error(ultimoErro);
}

export async function handleExplicacao(request) {
  if (request.method !== 'GET') return reply({ error: 'Método não permitido' }, 405, { Allow: 'GET' });
  const url = new URL(request.url);
  const concursoId = url.searchParams.get('c') || '';
  const numero = Number(url.searchParams.get('q'));
  if (!/^[a-z0-9-]{3,80}$/i.test(concursoId) || !Number.isInteger(numero) || numero < 1 || numero > 500) {
    return reply({ error: 'Questão inválida.' }, 400);
  }

  // Explicação comentada: só para o plano Check Completo (conferido no servidor)
  const { response: semPlano } = await exigirPlano(request, NIVEL.completo);
  if (semPlano) return semPlano;

  const exam = await carregarProva(concursoId, url.origin);
  const q = exam?.questoes?.find((x) => x.number === numero);
  if (!q) return reply({ error: 'Questão não encontrada.' }, 404);
  if (q.annulled) return reply({ error: 'Questão anulada pela banca: não tem resposta comentada.' }, 409);

  const sql = db();
  if (sql) {
    try {
      await ready(sql);
      const [row] = await sql`select paragrafos, gabarito from cnc_explicacoes
        where concurso_id = ${concursoId} and numero = ${numero}`;
      if (row && row.gabarito === q.answer) return reply({ paragrafos: row.paragrafos, origem: 'cache' });
    } catch (err) {
      console.error('[explicacao] banco:', err.message);
    }
  }

  if (!hasOpenAI()) {
    return reply({ pendente: true, error: 'A explicação desta questão está sendo preparada.' }, 503);
  }

  const chave = `${concursoId}:${numero}`;
  if (!emAndamento.has(chave)) {
    if (!limitarIp(request)) {
      return reply({ error: 'Muitas explicações novas em pouco tempo. Aguarde alguns minutos.' }, 429);
    }
    emAndamento.set(
      chave,
      chamarOpenAI(exam, q, url.origin).finally(() => emAndamento.delete(chave))
    );
  }

  try {
    const { paragrafos, modelo } = await emAndamento.get(chave);
    if (sql) {
      await sql`insert into cnc_explicacoes (concurso_id, numero, prova_id, gabarito, paragrafos, modelo)
        values (${concursoId}, ${numero}, ${exam.id || null}, ${q.answer}, ${JSON.stringify(paragrafos)}::jsonb, ${modelo})
        on conflict (concurso_id, numero) do update set paragrafos = excluded.paragrafos,
          gabarito = excluded.gabarito, modelo = excluded.modelo, created_at = now()`.catch((err) =>
        console.error('[explicacao] salvar:', err.message)
      );
    }
    return reply({ paragrafos, origem: 'nova' });
  } catch (err) {
    console.error('[explicacao] openai:', err.message);
    return reply({ error: 'Não foi possível preparar a explicação agora. Tente de novo em instantes.' }, 502);
  }
}
