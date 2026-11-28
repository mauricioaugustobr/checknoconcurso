// Movimento do dia no painel de admin: contador de acessos (POST /api/uso), contas ativas por hora,
// cadastros do dia e a rota /api/admin/metricas. Sem banco de verdade: as consultas vão para um banco de mentira.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSessionToken } from '../lib/auth.js';
import {
  classificarOrigem, ehRobo, diaValido, diaEmBrasilia, horaEmBrasilia, montarHoras, handleUso, metricasDoDia, ORIGENS
} from '../lib/metricas.js';
import { handleMetricas } from '../lib/admin-api.js';
import { POST as statsPost } from '../api/stats.js';
import { renderConcursoPage } from '../lib/pages.js';
import { CONCURSOS } from '../public/js/data/concursos.js';

delete process.env.DATABASE_URL;
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;
const SECRET = 'm'.repeat(48);
process.env.SESSION_SECRET = SECRET;
process.env.ADMIN_EMAILS = 'chefe@exemplo.com';
const SITE = 'https://checknoconcurso.com.br';
const CHROME = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const cookieDe = (email, provider = 'google') => 'cnc_session=' + createSessionToken({ sub: '1', email, name: 'Teste', provider }, SECRET);

let ipSeguinte = 1;
function uso(corpo, { origin = SITE, ua = CHROME, email, provider, ip, metodo = 'POST', bruto } = {}) {
  return new Request(`${SITE}/api/uso`, {
    method: metodo,
    headers: {
      host: 'checknoconcurso.com.br',
      'user-agent': ua,
      'content-type': 'application/json',
      'x-forwarded-for': ip || `10.0.0.${ipSeguinte++}`,
      ...(origin ? { origin } : {}),
      ...(email ? { cookie: cookieDe(email, provider) } : {})
    },
    body: metodo === 'POST' ? (bruto ?? JSON.stringify(corpo)) : undefined
  });
}

/** Banco de mentira: guarda cada consulta e responde conforme o texto do SQL. */
function bancoFalso(respostas = []) {
  const chamadas = [];
  const sql = (partes, ...valores) => {
    const texto = partes.join('?').replace(/\s+/g, ' ').trim();
    chamadas.push({ texto, valores });
    const r = respostas.find(([re]) => re.test(texto));
    return Promise.resolve(r ? r[1] : []);
  };
  sql.chamadas = chamadas;
  sql.de = (re) => chamadas.filter((c) => re.test(c.texto));
  return sql;
}

const corpo = async (res) => res.json();

async function run() {
  /* 1. De onde veio a visita (lista fixa) */
  const casos = [
    [{ u: 'meta', m: 'pago' }, 'anuncio-meta'],
    [{ u: 'meta' }, 'anuncio-meta'],
    [{ u: 'Instagram', m: 'Pago' }, 'anuncio-meta'],
    [{ u: 'facebook', m: 'cpc', f: 1 }, 'anuncio-meta'],
    [{ u: 'google', m: 'pago' }, 'anuncio-google'],
    [{ g: 1, r: 'www.google.com' }, 'anuncio-google'],
    [{ r: 'www.google.com' }, 'google'],
    [{ r: 'www.google.com.br' }, 'google'],
    [{ r: 'com.google.android.googlequicksearchbox' }, 'google'],
    [{ r: 'mail.google.com' }, 'sites'],
    [{ r: 'gemini.google.com' }, 'ia'],
    [{ u: 'chatgpt.com' }, 'ia'],
    [{ r: 'www.bing.com' }, 'buscas'],
    [{ r: 'l.instagram.com' }, 'instagram'],
    [{ r: 'lm.facebook.com' }, 'facebook'],
    [{ f: 1 }, 'facebook'],
    [{ u: 'compartilhar', m: 'whatsapp' }, 'compartilhar'],
    [{ r: 'web.whatsapp.com' }, 'whatsapp'],
    [{ r: 't.co' }, 'x'],
    [{ r: 'www.youtube.com' }, 'youtube'],
    [{ r: 'www.tiktok.com' }, 'tiktok'],
    [{ u: 'newsletter-dezembro' }, 'campanha'],
    [{ r: 'blog.qualquer.com.br' }, 'sites'],
    [{}, 'direto'],
    [{ u: '', m: '', r: '' }, 'direto']
  ];
  for (const [dados, esperado] of casos) assert.equal(classificarOrigem(dados), esperado, `${JSON.stringify(dados)} → ${esperado}`);
  for (const [dados] of casos) assert.ok(ORIGENS.includes(classificarOrigem(dados)), 'toda origem está na lista fixa');
  assert.equal(classificarOrigem({ u: '<script>'.repeat(30) }), 'campanha', 'texto estranho não vira origem nova');

  /* 2. Robôs e testes automáticos não contam */
  for (const robo of [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'AdsBot-Google (+http://www.google.com/adsbot.html)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
    'curl/8.4.0', 'python-requests/2.31', '', null
  ]) assert.equal(ehRobo(robo), true, `robô: ${robo}`);
  for (const gente of [
    CHROME,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 Instagram 357.0.0.25.101 (iPhone15,2; iOS 18_1; pt_BR; pt-BR; scale=3.00; 1179x2556; 662129400)',
    'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
  ]) assert.equal(ehRobo(gente), false, `pessoa: ${gente}`);

  /* 3. Dia e hora sempre em Brasília */
  assert.equal(diaEmBrasilia(new Date('2026-11-29T02:30:00Z')), '2026-11-28', '23h30 em Brasília ainda é dia 28');
  assert.equal(horaEmBrasilia(new Date('2026-11-29T02:30:00Z')), 23);
  assert.equal(horaEmBrasilia(new Date('2026-11-28T03:05:00Z')), 0);
  assert.equal(diaValido('2026-11-27', '2026-11-28'), '2026-11-27');
  assert.equal(diaValido('2026-12-01', '2026-11-28'), '2026-11-28', 'dia no futuro vira hoje');
  assert.equal(diaValido('2026-02-30', '2026-11-28'), '2026-11-28', 'data que não existe vira hoje');
  assert.equal(diaValido("2026-11-27'; drop table cnc_users--", '2026-11-28'), '2026-11-28');
  assert.equal(diaValido(undefined, '2026-11-28'), '2026-11-28');
  const horas = montarHoras({ visitas: [{ h: 15, visitas: 3, paginas: 7 }], cadastros: [{ h: 15, cadastros: 1 }], contas: [{ h: 9, contas: 2 }, { h: 99, contas: 5 }] });
  assert.equal(horas.length, 24);
  assert.deepEqual(horas[15], { h: 15, visitas: 3, paginas: 7, cadastros: 1, contas: 0 });
  assert.equal(horas[9].contas, 2);
  assert.equal(horas.reduce((t, x) => t + x.contas, 0), 2, 'hora fora de 0–23 é ignorada');

  /* 4. POST /api/uso: o que conta e o que fica de fora */
  const agora = Date.parse('2026-11-28T18:20:00Z'); // 15h20 em Brasília
  const horaUtc = '2026-11-28T18:00:00.000Z';
  assert.equal((await handleUso(uso({}, { metodo: 'GET' }))).status, 405);
  let r = await corpo(await handleUso(uso({ t: 'pv', n: 1 }, { origin: null }), { sql: bancoFalso(), agora }));
  assert.deepEqual([r.contado, r.motivo], [false, 'origem'], 'sem Origin não conta');
  r = await corpo(await handleUso(uso({ t: 'pv', n: 1 }, { origin: 'https://outro-site.com' }), { sql: bancoFalso(), agora }));
  assert.equal(r.motivo, 'origem', 'aviso vindo de outro site não conta');
  r = await corpo(await handleUso(uso({ t: 'pv', n: 1 }, { ua: 'Googlebot/2.1' }), { sql: bancoFalso(), agora }));
  assert.equal(r.motivo, 'robo');
  r = await corpo(await handleUso(uso({ t: 'pv', n: 1 }, { bruto: '{isso não é json' }), { sql: bancoFalso(), agora }));
  assert.equal(r.motivo, 'invalido');
  r = await corpo(await handleUso(uso({ t: 'pv', n: 1 }, { bruto: 'x'.repeat(3000) }), { sql: bancoFalso(), agora }));
  assert.equal(r.motivo, 'invalido', 'corpo grande demais');
  r = await corpo(await handleUso(uso({ t: 'pv', n: 1 }), { sql: null, agora }));
  assert.equal(r.motivo, 'sem-banco');

  // Prévia da Vercel não conta (o banco pode ser o mesmo da produção)
  process.env.VERCEL = '1';
  process.env.VERCEL_ENV = 'preview';
  r = await corpo(await handleUso(uso({ t: 'pv', n: 1 }), { sql: bancoFalso(), agora }));
  assert.equal(r.motivo, 'previa');
  process.env.VERCEL_ENV = 'production';

  // Visita nova vinda do anúncio da Meta, sem conta: soma 1 visita e 1 página, na hora certa
  let banco = bancoFalso();
  r = await corpo(await handleUso(uso({ t: 'pv', n: 1, u: 'meta', m: 'pago', r: 'l.instagram.com' }), { sql: banco, agora }));
  assert.deepEqual([r.ok, r.contado, r.conta, r.h], [true, true, false, Math.floor(agora / 3_600_000)]);
  let ins = banco.de(/insert into cnc_visitas_hora/);
  assert.equal(ins.length, 1);
  assert.deepEqual(ins[0].valores, [horaUtc, 'anuncio-meta', 1]);
  assert.equal(banco.de(/cnc_atividade_hora \(hora, email\)/).length, 0, 'sem conta, nada de conta ativa');
  assert.ok(!JSON.stringify(banco.chamadas).includes('10.0.0.'), 'o IP nunca vai para o banco');

  // Outra página da mesma visita: só soma página, sem origem
  banco = bancoFalso();
  await handleUso(uso({ t: 'pv', n: 0, u: 'meta' }), { sql: banco, agora });
  assert.deepEqual(banco.de(/insert into cnc_visitas_hora/)[0].valores, [horaUtc, '', 0]);

  // Conta conectada: página + conta ativa naquela hora
  banco = bancoFalso();
  r = await corpo(await handleUso(uso({ t: 'pv', n: 1 }, { email: 'Aluna@Exemplo.com', provider: 'email' }), { sql: banco, agora }));
  assert.deepEqual([r.contado, r.conta], [true, true]);
  assert.deepEqual(banco.de(/insert into cnc_atividade_hora/)[0].valores, [horaUtc, 'aluna@exemplo.com']);
  assert.deepEqual(banco.de(/insert into cnc_visitas_hora/)[0].valores, [horaUtc, 'direto', 1]);

  // Aviso de "conta em uso" numa hora nova: só a conta ativa
  banco = bancoFalso();
  r = await corpo(await handleUso(uso({ t: 'ping' }, { email: 'aluna@exemplo.com' }), { sql: banco, agora }));
  assert.equal(r.conta, true);
  assert.equal(banco.de(/insert into cnc_visitas_hora/).length, 0, 'ping não conta como página');
  assert.equal(banco.de(/insert into cnc_atividade_hora/).length, 1);
  banco = bancoFalso();
  r = await corpo(await handleUso(uso({ t: 'ping' }), { sql: banco, agora }));
  assert.equal(r.motivo, 'sem-conta');
  assert.equal(banco.chamadas.length, 0);

  // A conta de admin não entra na conta
  banco = bancoFalso();
  r = await corpo(await handleUso(uso({ t: 'pv', n: 1 }, { email: 'chefe@exemplo.com' }), { sql: banco, agora }));
  assert.equal(r.motivo, 'admin');
  assert.equal(banco.chamadas.length, 0);

  // Envio em massa do mesmo aparelho é cortado depois de 90 avisos por minuto
  banco = bancoFalso();
  let ultimo;
  for (let i = 0; i < 91; i++) ultimo = await corpo(await handleUso(uso({ t: 'pv', n: 0 }, { ip: '200.200.200.200' }), { sql: banco, agora }));
  assert.equal(ultimo.motivo, 'limite');
  assert.equal(banco.de(/insert into cnc_visitas_hora/).length, 90);

  // Banco fora do ar: o site não quebra
  const quebrado = (partes) => (/insert/.test(partes.join('')) ? Promise.reject(new Error('fora do ar')) : Promise.resolve([]));
  r = await handleUso(uso({ t: 'pv', n: 1 }), { sql: quebrado, agora });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).contado, false);
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;

  /* 5. Números do dia para o painel */
  const vazio = await metricasDoDia('2026-11-28', { sql: null, agora: new Date(agora) });
  assert.equal(vazio.semBanco, true);
  assert.equal(vazio.horas.length, 24);
  assert.deepEqual([vazio.dia, vazio.ehHoje, vazio.horaAtual], ['2026-11-28', true, 15]);

  banco = bancoFalso([
    [/select extract\(hour from hora at time zone 'America\/Sao_Paulo'\)::int as h, sum\(visitas\)/, [{ h: 14, visitas: 4, paginas: 9 }, { h: 15, visitas: 2, paginas: 3 }]],
    [/select origem, sum\(visitas\)/, [{ origem: 'anuncio-meta', visitas: 4 }, { origem: 'direto', visitas: 2 }]],
    [/count\(\*\) filter \(where provider = 'email'\)/, [{ h: 14, cadastros: 2, por_email: 1 }]],
    [/select email, name, provider, first_login_at/, [
      { email: 'b@exemplo.com', name: 'Bia', provider: 'email', first_login_at: new Date('2026-11-28T17:40:00Z') },
      { email: 'c@exemplo.com', name: 'Caio', provider: 'google', first_login_at: new Date('2026-11-28T17:10:00Z') }
    ]],
    [/select extract\(hour from hora at time zone 'America\/Sao_Paulo'\)::int as h, count\(\*\)::int as contas/, [{ h: 14, contas: 2 }, { h: 15, contas: 1 }]],
    [/select a\.email/, [
      { email: 'b@exemplo.com', nome: 'Bia', horas: 2, ultima: new Date('2026-11-28T18:00:00Z'), total: 2 },
      { email: 'c@exemplo.com', nome: 'Caio', horas: 1, ultima: new Date('2026-11-28T17:00:00Z'), total: 2 }
    ]],
    [/select \(select min\(hora\)/, [{ acessos: new Date('2026-11-28T17:00:00Z'), contas: new Date('2026-11-28T17:00:00Z') }]]
  ]);
  const m = await metricasDoDia('2026-11-28', { sql: banco, agora: new Date(agora) });
  assert.equal(m.semBanco, false);
  assert.deepEqual(m.totais, { visitas: 6, paginas: 12, cadastros: 2, cadastrosEmail: 1, cadastrosGoogle: 1, contas: 2 });
  assert.equal(m.horas[14].visitas, 4);
  assert.equal(m.horas[15].contas, 1);
  assert.deepEqual(m.origens, [{ origem: 'anuncio-meta', visitas: 4 }, { origem: 'direto', visitas: 2 }]);
  assert.deepEqual(m.cadastros[0], { email: 'b@exemplo.com', nome: 'Bia', entrada: 'senha', em: '2026-11-28T17:40:00.000Z' });
  assert.equal(m.contasAtivas.length, 2);
  assert.equal(m.contandoDesde.acessos, '2026-11-28T17:00:00.000Z');
  // O dia vai para o banco como parâmetro (nunca colado no SQL)
  const consultasDoDia = banco.chamadas.filter((c) => /America\/Sao_Paulo/.test(c.texto) && /where/.test(c.texto));
  assert.equal(consultasDoDia.length, 6);
  assert.ok(consultasDoDia.every((c) => c.valores.length === 2 && c.valores.every((v) => v === '2026-11-28')));
  // Registro de conta ativa com mais de 6 meses é apagado (Política de Privacidade)
  assert.equal(banco.de(/delete from cnc_atividade_hora where hora < now\(\) - interval '6 months'/).length, 1);
  const outroDia = await metricasDoDia('2027-01-05', { sql: bancoFalso(), agora: new Date(agora) });
  assert.deepEqual([outroDia.dia, outroDia.ehHoje], ['2026-11-28', true], 'dia no futuro mostra hoje');
  const ontem = await metricasDoDia('2026-11-27', { sql: bancoFalso(), agora: new Date(agora) });
  assert.deepEqual([ontem.dia, ontem.ehHoje, ontem.horaAtual], ['2026-11-27', false, null]);

  /* 6. Rota do painel: só admin */
  const reqAdmin = (email) => new Request(`${SITE}/api/admin/metricas?dia=2026-11-28`, { headers: email ? { cookie: cookieDe(email) } : {} });
  assert.equal((await handleMetricas(reqAdmin())).status, 401);
  assert.equal((await handleMetricas(reqAdmin('aluna@exemplo.com'))).status, 403);
  const adm = await handleMetricas(reqAdmin('chefe@exemplo.com'));
  assert.equal(adm.status, 200);
  assert.equal(adm.headers.get('cache-control'), 'no-store');
  assert.equal((await adm.json()).semBanco, true);
  assert.equal((await handleMetricas(new Request(`${SITE}/api/admin/metricas`, { method: 'POST', headers: { cookie: cookieDe('chefe@exemplo.com'), origin: SITE, host: 'checknoconcurso.com.br' } }))).status, 405);
  const senha = new Request(`${SITE}/api/admin/metricas`, { headers: { cookie: cookieDe('chefe@exemplo.com', 'email') } });
  assert.equal((await handleMetricas(senha)).status, 403, 'admin só com a conta Google');

  /* 7. Função da Vercel e rotas */
  assert.equal((await statsPost(new Request(`${SITE}/api/stats`, { method: 'POST' }))).status, 405, 'POST em /api/stats sem acao=uso');
  const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(vercel.rewrites.some((x) => x.source === '/api/uso' && x.destination === '/api/stats?acao=uso'));
  const contar = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? contar(`${dir}/${e.name}`) : (e.name.endsWith('.js') ? 1 : 0)), 0);
  assert.ok(contar(fileURLToPath(new URL('../api', import.meta.url))) <= 12, 'sem função nova na Vercel');

  /* 8. O contador está em todas as páginas públicas, e nunca no admin */
  for (const pagina of ['index.html', 'pagar.html', 'prova.html', 'cancelamento.html', 'privacidade.html']) {
    const html = fs.readFileSync(new URL(`../public/${pagina}`, import.meta.url), 'utf8');
    assert.ok(html.includes('<script src="/js/uso.js?v=1" defer></script>'), `${pagina} tem o contador`);
  }
  const alvo = CONCURSOS[0];
  const pg = await (await renderConcursoPage(new Request(`${SITE}/concurso/${alvo.id}`), alvo.id)).text();
  assert.ok(pg.includes('/js/uso.js?v=1'), 'páginas de concurso, estado e blog têm o contador');
  const admin = fs.readFileSync(new URL('../public/admin/index.html', import.meta.url), 'utf8');
  assert.ok(!admin.includes('uso.js'), 'o painel de admin não conta acesso');
  assert.ok(admin.includes('id="adMov"') && admin.includes('data-grafico="acessos"') && admin.includes('data-grafico="contas"'));
  const script = fs.readFileSync(new URL('../public/js/uso.js', import.meta.url), 'utf8');
  assert.ok(script.includes("/^\\/admin/") && script.includes('localhost') && script.includes('navigator.webdriver'));
  assert.ok(!/document\.cookie|localStorage/.test(script), 'o contador não usa cookies nem armazenamento permanente');
  const privacidade = fs.readFileSync(new URL('../public/privacidade.html', import.meta.url), 'utf8');
  assert.ok(privacidade.includes('Contador de acessos próprio (sem cookies)'), 'a Política de Privacidade explica o contador');

  console.log('OK: movimento do dia (acessos por hora, origem, cadastros e contas ativas) validado.');
}

run().catch((err) => {
  console.error('FALHA NOS TESTES DO MOVIMENTO DO DIA:', err);
  process.exit(1);
});
