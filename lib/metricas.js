/**
 * Movimento do site para o painel de ADMIN — Check no Concurso. Só no servidor.
 *
 * O que é contado (sempre no horário de Brasília):
 * - Acessos por hora: cada página aberta avisa POST /api/uso (public/js/uso.js). Aqui só somamos
 *   números por hora em cnc_visitas_hora: visitas (chegadas ao site), páginas abertas e a origem da
 *   visita, numa lista fixa (anúncio da Meta, busca no Google, direto...). Sem cookies, sem IP, sem
 *   navegador e sem o endereço da página: não dá para saber quem visitou.
 * - Contas ativas por hora: quem está conectado fica marcado como ativo naquela hora
 *   (cnc_atividade_hora: hora + e-mail). É um registro de acesso: some depois de 6 meses,
 *   como diz a Política de Privacidade.
 * - Cadastros do dia: contas criadas no dia (cnc_users.first_login_at, Google ou e-mail e senha).
 * Ficam de fora: a conta de admin, robôs, prévias da Vercel e o computador local.
 */
import { db } from './db.js';
import { getSessionUser, isSameOrigin } from './auth.js';

export const FUSO = 'America/Sao_Paulo';
const HORA_MS = 3_600_000;
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
const LIMITE_POR_MINUTO = 90;

/** Origens possíveis de uma visita (lista fixa; o painel mostra o nome de cada uma). */
export const ORIGENS = ['anuncio-meta', 'anuncio-google', 'google', 'buscas', 'instagram', 'facebook', 'whatsapp',
  'tiktok', 'youtube', 'x', 'ia', 'compartilhar', 'campanha', 'sites', 'direto'];

/* ---------- Datas no horário de Brasília ---------- */
export function diaEmBrasilia(data = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(data);
}

export function horaEmBrasilia(data = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', hourCycle: 'h23' }).format(data)) % 24;
}

/** Dia pedido no formato AAAA-MM-DD; inválido ou no futuro vira hoje. */
export function diaValido(dia, hoje) {
  const d = String(dia || '');
  if (!DIA_RE.test(d)) return hoje;
  const data = new Date(`${d}T12:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== d) return hoje;
  return d > hoje ? hoje : d;
}

/* ---------- Robôs e origem da visita ---------- */
const ROBO_RE = /bot|crawl|spider|slurp|scrap|facebookexternalhit|meta-external|inspectiontool|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|python|curl|wget|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|phantom|selenium|playwright|puppeteer|vercel/i;

/** Robôs de busca, de anúncios e de testes não contam como acesso. ("Cubot" é marca de celular.) */
export function ehRobo(userAgent) {
  const ua = String(userAgent || '').replace(/cubot/gi, '');
  return !ua.trim() || ROBO_RE.test(ua);
}

const limpa = (v, max) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, max);
const MIDIA_PAGA = /^(pago|paga|paid|cpc|ppc|cpm|cpv|ads?|anuncios?|paid[-_ ]?social|social[-_ ]?(pago|paid|ads)|display|trafego[-_ ]?pago)$/;

// utm_source → origem (a primeira regra que bate vale)
const POR_UTM = [
  ['compartilhar', /^compartilhar$/],
  ['ia', /^(chatgpt(\.com)?|openai|perplexity(\.ai)?|gemini|copilot|claude(\.ai)?)$/],
  ['instagram', /^(instagram|ig)$/],
  ['facebook', /^(facebook|fb)$/],
  ['whatsapp', /^(whatsapp|wa|zap)$/],
  ['tiktok', /^tiktok$/],
  ['youtube', /^(youtube|yt)$/],
  ['x', /^(x|twitter)$/],
  ['google', /^google$/],
  ['buscas', /^(bing|yahoo|duckduckgo|ecosia|yandex|brave)$/]
];

// Site de onde a pessoa veio (só o nome do site, sem o endereço da página) → origem
const POR_SITE = [
  ['ia', /(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|gemini\.google\.com|copilot\.microsoft\.com|claude\.ai|meta\.ai)$/],
  ['instagram', /instagram/],
  ['facebook', /facebook|(^|\.)fb\.(com|me)$/],
  ['whatsapp', /whatsapp|(^|\.)wa\.me$/],
  ['tiktok', /tiktok|musically/],
  ['youtube', /youtube|(^|\.)youtu\.be$/],
  ['x', /^(t\.co|twitter\.com|mobile\.twitter\.com|x\.com)$/],
  ['google', /(^|\.)google\.[a-z.]{2,7}$|googlequicksearchbox/],
  ['buscas', /(^|\.)(bing\.com|yahoo\.com|duckduckgo\.com|ecosia\.org|yandex\.[a-z]{2,3}|search\.brave\.com|baidu\.com)$/]
];

/**
 * De onde veio a visita. Dados do navegador: u = utm_source, m = utm_medium, r = site anterior,
 * g = veio de clique em anúncio do Google, f = veio de link do Facebook/Instagram.
 */
export function classificarOrigem(dados = {}) {
  const u = limpa(dados.u, 60);
  const m = limpa(dados.m, 60);
  const r = limpa(dados.r, 120).replace(/[^a-z0-9.-]/g, '').replace(/^www\./, '');
  const pago = MIDIA_PAGA.test(m);
  if (u === 'meta' || (pago && /^(facebook|fb|instagram|ig)$/.test(u))) return 'anuncio-meta';
  if (dados.g || (pago && /^(google|google-?ads|adwords)$/.test(u))) return 'anuncio-google';
  if (u) return (POR_UTM.find(([, re]) => re.test(u)) || ['campanha'])[0];
  if (r && r !== 'mail.google.com') {
    const regra = POR_SITE.find(([, re]) => re.test(r));
    if (regra) return regra[0];
  }
  if (dados.f) return 'facebook';
  return r ? 'sites' : 'direto';
}

/* ---------- Tabelas ---------- */
let tabelas = null;
function garantirTabelas(sql) {
  return (tabelas ||= Promise.all([
    sql`create table if not exists cnc_visitas_hora (
        hora timestamptz not null,
        origem text not null default '',
        visitas integer not null default 0,
        paginas integer not null default 0,
        primary key (hora, origem))`,
    sql`create table if not exists cnc_atividade_hora (
        hora timestamptz not null,
        email text not null,
        primary key (hora, email))`
  ]).catch((err) => { tabelas = null; throw err; }));
}

/* ---------- POST /api/uso: uma página aberta (ou a conta ainda em uso numa nova hora) ---------- */

// Prévias da Vercel não contam (o banco pode ser o mesmo da produção). Fora da Vercel, só com banco.
function ambienteConta() {
  if (!process.env.VERCEL) return true;
  const env = process.env.VERCEL_ENV;
  return !env || env === 'production';
}

// Proteção contra envio em massa: no máximo 90 avisos por minuto por aparelho, contados só na
// memória desta função (o IP nunca vai para o banco).
const janelas = new Map();
function excedeuLimite(request, agora) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || '';
  if (!ip) return false;
  const j = janelas.get(ip);
  if (!j || agora - j.inicio > 60_000) {
    if (janelas.size > 5000) janelas.clear();
    janelas.set(ip, { inicio: agora, n: 1 });
    return false;
  }
  j.n += 1;
  return j.n > LIMITE_POR_MINUTO;
}

function respostaUso(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
  });
}

/**
 * Corpo: { t: 'pv' (página aberta) | 'ping' (conta em uso numa nova hora), n: 1 se é uma visita nova, u, m, r, g, f }.
 * Resposta: { contado, conta (a pessoa está conectada), h (hora atual), agora } — o navegador usa conta e h
 * para avisar de novo só quando a hora mudar.
 */
export async function handleUso(request, { sql: sqlOpcional, agora = Date.now() } = {}) {
  if (request.method !== 'POST') return respostaUso({ error: 'Método não permitido' }, 405);
  const h = Math.floor(agora / HORA_MS);
  const nada = (motivo) => respostaUso({ ok: true, contado: false, motivo, conta: false, h, agora });
  // Só o próprio site: o navegador sempre manda Origin num POST
  if (!request.headers.get('origin') || !isSameOrigin(request)) return nada('origem');
  if (ehRobo(request.headers.get('user-agent'))) return nada('robo');
  if (!ambienteConta()) return nada('previa');
  if (excedeuLimite(request, agora)) return nada('limite');
  let dados;
  try {
    const texto = await request.text();
    if (texto.length > 2000) return nada('invalido');
    dados = JSON.parse(texto || '{}');
  } catch {
    return nada('invalido');
  }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return nada('invalido');
  const usuario = getSessionUser(request);
  if (usuario?.role === 'admin') return nada('admin');
  const sql = sqlOpcional === undefined ? db() : sqlOpcional;
  if (!sql) return nada('sem-banco');

  const pagina = dados.t !== 'ping';
  const nova = pagina && Number(dados.n) === 1;
  const origem = nova ? classificarOrigem(dados) : '';
  const email = usuario?.email ? String(usuario.email).trim().toLowerCase() : null;
  // Aviso de "conta em uso" sem conta conectada: nada a registrar
  if (!pagina && !email) return nada('sem-conta');
  const hora = new Date(h * HORA_MS).toISOString();
  try {
    await garantirTabelas(sql);
    await Promise.all([
      pagina
        ? sql`insert into cnc_visitas_hora (hora, origem, visitas, paginas) values (${hora}::timestamptz, ${origem}, ${nova ? 1 : 0}, 1)
            on conflict (hora, origem) do update set visitas = cnc_visitas_hora.visitas + excluded.visitas,
              paginas = cnc_visitas_hora.paginas + excluded.paginas`
        : null,
      email ? sql`insert into cnc_atividade_hora (hora, email) values (${hora}::timestamptz, ${email}) on conflict do nothing` : null
    ]);
  } catch (err) {
    console.warn('[uso] contagem falhou:', err.message);
    return respostaUso({ ok: false, contado: false, conta: Boolean(email), h, agora });
  }
  return respostaUso({ ok: true, contado: true, conta: Boolean(email), h, agora });
}

/* ---------- Painel de admin: números de um dia ---------- */

/** 24 horas (0h a 23h) com acessos, páginas, cadastros e contas ativas. */
export function montarHoras({ visitas = [], cadastros = [], contas = [] } = {}) {
  const horas = Array.from({ length: 24 }, (_, h) => ({ h, visitas: 0, paginas: 0, cadastros: 0, contas: 0 }));
  const somar = (linhas, campos) => {
    for (const r of linhas) {
      const x = horas[Number(r.h)];
      if (x) for (const c of campos) x[c] += Number(r[c]) || 0;
    }
  };
  somar(visitas, ['visitas', 'paginas']);
  somar(cadastros, ['cadastros']);
  somar(contas, ['contas']);
  return horas;
}

// Registro de acesso por conta: guardado por 6 meses (Política de Privacidade, item 7).
// A limpeza roda quando o admin abre o painel, no máximo a cada 6 horas.
let ultimaLimpeza = 0;
async function limparAtividadeAntiga(sql, agora) {
  if (agora - ultimaLimpeza < 6 * HORA_MS) return;
  ultimaLimpeza = agora;
  await sql`delete from cnc_atividade_hora where hora < now() - interval '6 months'`.catch((err) => {
    console.warn('[metricas] limpeza dos registros antigos falhou:', err.message);
  });
}

const iso = (v) => (v ? new Date(v).toISOString() : null);

export async function metricasDoDia(diaPedido, { sql: sqlOpcional, agora = new Date() } = {}) {
  const hoje = diaEmBrasilia(agora);
  const dia = diaValido(diaPedido, hoje);
  const ehHoje = dia === hoje;
  const base = { dia, hoje, ehHoje, horaAtual: ehHoje ? horaEmBrasilia(agora) : null, atualizadoEm: agora.toISOString(), fuso: FUSO };
  const sql = sqlOpcional === undefined ? db() : sqlOpcional;
  if (!sql) {
    return {
      ...base, semBanco: true, horas: montarHoras(),
      totais: { visitas: 0, paginas: 0, cadastros: 0, cadastrosEmail: 0, cadastrosGoogle: 0, contas: 0 },
      origens: [], cadastros: [], contasAtivas: [], contandoDesde: { acessos: null, contas: null }
    };
  }
  await garantirTabelas(sql);
  await limparAtividadeAntiga(sql, agora.getTime());

  // Começo e fim do dia em Brasília (o banco guarda tudo em UTC)
  const [visitasHora, origens, cadastrosHora, cadastros, contasHora, contas, desde] = await Promise.all([
    sql`select extract(hour from hora at time zone 'America/Sao_Paulo')::int as h, sum(visitas)::int as visitas, sum(paginas)::int as paginas
        from cnc_visitas_hora
        where hora >= (${dia}::date)::timestamp at time zone 'America/Sao_Paulo'
          and hora < (${dia}::date + 1)::timestamp at time zone 'America/Sao_Paulo'
        group by 1`,
    sql`select origem, sum(visitas)::int as visitas
        from cnc_visitas_hora
        where hora >= (${dia}::date)::timestamp at time zone 'America/Sao_Paulo'
          and hora < (${dia}::date + 1)::timestamp at time zone 'America/Sao_Paulo'
          and visitas > 0
        group by origem order by 2 desc, 1`,
    sql`select extract(hour from first_login_at at time zone 'America/Sao_Paulo')::int as h, count(*)::int as cadastros,
          count(*) filter (where provider = 'email')::int as por_email
        from cnc_users
        where first_login_at >= (${dia}::date)::timestamp at time zone 'America/Sao_Paulo'
          and first_login_at < (${dia}::date + 1)::timestamp at time zone 'America/Sao_Paulo'
        group by 1`,
    sql`select email, name, provider, first_login_at
        from cnc_users
        where first_login_at >= (${dia}::date)::timestamp at time zone 'America/Sao_Paulo'
          and first_login_at < (${dia}::date + 1)::timestamp at time zone 'America/Sao_Paulo'
        order by first_login_at desc limit 200`,
    sql`select extract(hour from hora at time zone 'America/Sao_Paulo')::int as h, count(*)::int as contas
        from cnc_atividade_hora
        where hora >= (${dia}::date)::timestamp at time zone 'America/Sao_Paulo'
          and hora < (${dia}::date + 1)::timestamp at time zone 'America/Sao_Paulo'
        group by 1`,
    sql`select a.email, max(u.name) as nome, count(*)::int as horas, max(a.hora) as ultima, count(*) over ()::int as total
        from cnc_atividade_hora a left join cnc_users u on u.email = a.email
        where a.hora >= (${dia}::date)::timestamp at time zone 'America/Sao_Paulo'
          and a.hora < (${dia}::date + 1)::timestamp at time zone 'America/Sao_Paulo'
        group by a.email order by ultima desc, a.email limit 300`,
    sql`select (select min(hora) from cnc_visitas_hora) as acessos, (select min(hora) from cnc_atividade_hora) as contas`
  ]);

  const horas = montarHoras({ visitas: visitasHora, cadastros: cadastrosHora, contas: contasHora });
  const soma = (campo) => horas.reduce((t, x) => t + x[campo], 0);
  const cadastrosEmail = cadastrosHora.reduce((t, r) => t + (Number(r.por_email) || 0), 0);
  const totalCadastros = soma('cadastros');
  return {
    ...base,
    semBanco: false,
    horas,
    totais: {
      visitas: soma('visitas'), paginas: soma('paginas'),
      cadastros: totalCadastros, cadastrosEmail, cadastrosGoogle: totalCadastros - cadastrosEmail,
      contas: Number(contas[0]?.total) || 0
    },
    origens: origens
      .map((o) => ({ origem: ORIGENS.includes(o.origem) ? o.origem : 'sites', visitas: Number(o.visitas) || 0 }))
      .reduce((lista, o) => {
        const igual = lista.find((x) => x.origem === o.origem);
        if (igual) igual.visitas += o.visitas; else lista.push(o);
        return lista;
      }, [])
      .sort((a, b) => b.visitas - a.visitas),
    cadastros: cadastros.map((c) => ({ email: c.email, nome: c.name || null, entrada: c.provider === 'email' ? 'senha' : 'google', em: iso(c.first_login_at) })),
    contasAtivas: contas.map((c) => ({ email: c.email, nome: c.nome || null, horas: Number(c.horas) || 0, ultima: iso(c.ultima) })),
    contandoDesde: { acessos: iso(desde[0]?.acessos), contas: iso(desde[0]?.contas) }
  };
}
