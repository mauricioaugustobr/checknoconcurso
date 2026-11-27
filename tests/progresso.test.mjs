// Progresso das provas salvo na conta: regras de acesso, validação e junção com o aparelho.
// Com PROGRESSO_TEST_DATABASE_URL (banco de teste, nunca o de produção) também roda o fluxo completo no banco.
import assert from 'node:assert/strict';
import { createSessionToken } from '../lib/auth.js';

const urlTeste = process.env.PROGRESSO_TEST_DATABASE_URL || '';
delete process.env.DATABASE_URL;
const SECRET = 'p'.repeat(48);
process.env.SESSION_SECRET = SECRET;
process.env.ADMIN_EMAILS = 'chefe@exemplo.com';
process.env.CNC_ACESSO_LIVRE = '0';

const { GET, POST } = await import('../api/concursos.js');
const { validarRespostas, carregarProva, contaId, PULADA } = await import('../lib/progresso.js');
const { mesclar, respostasPendentes } = await import('../public/js/progresso-sync.js');

const BASE = 'https://checknoconcurso.com.br';
const PROVA = 'pm-sp-soldado-2026';
const cookie = (email) => 'cnc_session=' + createSessionToken({ sub: '1', email, name: 'Teste', provider: 'google' }, SECRET);
const get = (email, prova = PROVA) => new Request(`${BASE}/api/concursos?tipo=progresso&prova=${prova}`, { headers: email ? { cookie: cookie(email) } : {} });
const post = (email, corpo, origin = BASE) => new Request(`${BASE}/api/concursos?tipo=progresso`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin, ...(email ? { cookie: cookie(email) } : {}) },
  body: JSON.stringify(corpo)
});

// ---------- Acesso ----------
let r = await GET(get(null));
assert.equal(r.status, 401);
assert.equal((await r.json()).codigo, 'login');
assert.equal((await POST(post(null, { prova: PROVA }))).status, 401);
r = await GET(get('aluno@exemplo.com'));
assert.equal(r.status, 403, 'sem plano Completo não salva progresso');
assert.equal((await POST(post('chefe@exemplo.com', { prova: PROVA }, 'https://site-malicioso.com'))).status, 403, 'outro site não envia');
r = await GET(get('chefe@exemplo.com'));
assert.equal(r.status, 503, 'sem banco: avisa e o aparelho segue com a cópia local');
assert.equal((await r.json()).codigo, 'sem-banco');
assert.match(r.headers.get('cache-control'), /no-store/);
// As outras rotas da função continuam só de leitura
assert.equal((await POST(new Request(`${BASE}/api/concursos`, { method: 'POST', headers: { origin: BASE } }))).status, 405);

// ---------- Validação das respostas (acerto calculado pelo gabarito oficial) ----------
const prova = carregarProva(PROVA);
assert.ok(prova && prova.questoes.length > 10);
assert.equal(carregarProva('index'), null);
assert.equal(carregarProva('../segredo'), null);
// O aparelho guarda pelo nome interno da prova; o link usa outro nome. Os dois valem e dão a mesma prova.
assert.notEqual(prova.id, PROVA);
assert.equal(carregarProva(prova.id)?.id, prova.id);
{
  const { lerIndiceProvas } = await import('../lib/acesso.js');
  for (const chave of Object.keys(lerIndiceProvas())) {
    const p = carregarProva(chave);
    assert.ok(p, `prova do índice carrega: ${chave}`);
    assert.equal(carregarProva(p.id)?.id, p.id, `nome interno também carrega: ${p.id}`);
  }
}
const valida = prova.questoes.find((q) => !q.annulled);
const errada = valida.alternatives.map((a) => a.letter).find((l) => l !== valida.answer);
const anulada = prova.questoes.find((q) => q.annulled);
const respostas = { [valida.number]: valida.answer, 99999: 'A', x: 'B', [prova.questoes[1].number]: 'Z' };
if (anulada) respostas[anulada.number] = 'A';
let v = validarRespostas(prova, respostas);
assert.deepEqual(v, [{ questao: Number(valida.number), resposta: valida.answer, acertou: true }], 'só fica a resposta válida');
v = validarRespostas(prova, { [valida.number]: errada });
assert.equal(v[0].acertou, false);
v = validarRespostas(prova, { [valida.number]: PULADA });
assert.deepEqual(v[0], { questao: Number(valida.number), resposta: PULADA, acertou: null });
assert.deepEqual(validarRespostas(prova, null), []);
assert.deepEqual(validarRespostas(prova, ['A']), []);
assert.equal(contaId('Chefe@Exemplo.com '), contaId('chefe@exemplo.com'));
assert.equal(contaId('chefe@exemplo.com').length, 16);

// ---------- Junção aparelho + conta (navegador) ----------
assert.deepEqual(respostasPendentes({ answers: { 1: 'A', 2: 'B' } }), { 1: 'A', 2: 'B' }, 'nunca enviado: manda tudo');
assert.deepEqual(respostasPendentes({ answers: { 1: 'A', 2: 'B' }, conta: 'x', pend: ['2'] }), { 2: 'B' });
const servidor = { conta: 'c1', tentativa: 2, atual: 7, atualizadoEm: new Date(Date.now() + 1000).toISOString(), respostas: { 3: 'C' } };
let m = mesclar({ answers: { 1: 'A' }, revealed: { 1: true }, current: 1, at: Date.now(), tentativa: null }, servidor);
assert.deepEqual(m.answers, { 1: 'A', 3: 'C' }, 'histórico do aparelho entra na conta');
assert.equal(m.current, 7, 'posição mais nova (do servidor) vale');
assert.equal(m.tentativa, 2);
assert.equal(m.conta, 'c1');
m = mesclar({ answers: { 1: 'A' }, revealed: { 1: true }, current: 1, at: Date.now(), tentativa: 1 }, servidor);
assert.deepEqual(m.answers, { 3: 'C' }, 'refez a prova em outro aparelho: vale a tentativa nova');
assert.deepEqual(m.revealed, {});
m = mesclar({ answers: { 3: 'A' }, current: 4, at: Date.now() + 5000, tentativa: 2 }, servidor);
assert.equal(m.answers[3], 'C', 'conflito: vale a primeira resposta, a do servidor');
assert.equal(m.current, 4, 'posição local mais nova vale');

// ---------- Fluxo completo no banco de teste ----------
if (urlTeste) {
  process.env.DATABASE_URL = urlTeste;
  const email = `teste-progresso-${Date.now()}@exemplo.com`;
  process.env.ADMIN_EMAILS = `chefe@exemplo.com,${email}`;
  const q = prova.questoes.filter((x) => !x.annulled);
  const [q1, q2, q3] = q;
  const outra = (x) => x.alternatives.map((a) => a.letter).find((l) => l !== x.answer);

  r = await GET(get(email));
  assert.equal(r.status, 200);
  let s = await r.json();
  assert.deepEqual([s.tentativa, s.atual, s.respostas], [0, 0, {}], 'conta nova sem progresso');
  assert.equal(s.conta, contaId(email));

  // Migração do aparelho: histórico antigo sem tentativa
  r = await POST(post(email, { prova: PROVA, tentativa: null, atual: 2, respostas: { [q1.number]: q1.answer, [q2.number]: outra(q2), [q3.number]: PULADA } }));
  s = await r.json();
  assert.equal(r.status, 200, JSON.stringify(s));
  assert.equal(s.recebidas, 3);
  assert.equal(s.tentativa, 1);
  assert.equal(s.atual, 2);
  assert.deepEqual(s.respostas, { [q1.number]: q1.answer, [q2.number]: outra(q2), [q3.number]: PULADA });

  // Reenvio (ex.: envio ao sair da página repetido) não duplica nem troca a primeira resposta
  r = await POST(post(email, { prova: PROVA, tentativa: 1, respostas: { [q1.number]: outra(q1), [q3.number]: q3.answer } }));
  s = await r.json();
  assert.equal(s.respostas[q1.number], q1.answer, 'primeira resposta vale');
  assert.equal(s.respostas[q3.number], q3.answer, 'pulada pode ser respondida depois');

  // Outro aparelho lê o mesmo progresso, pelo nome do link ou pelo nome interno
  s = await (await GET(get(email))).json();
  assert.equal(Object.keys(s.respostas).length, 3);
  assert.equal(s.prova, prova.id, 'progresso fica no nome interno');
  s = await (await GET(get(email, prova.id))).json();
  assert.equal(Object.keys(s.respostas).length, 3);

  // Refazer a prova: tentativa 2 começa vazia; a 1 fica no histórico
  r = await POST(post(email, { prova: PROVA, tentativa: 2, atual: 0, respostas: {} }));
  s = await r.json();
  assert.deepEqual([s.tentativa, s.atual, s.respostas], [2, 0, {}]);
  // Aparelho atrasado ainda na tentativa 1 (sem internet): vai para o histórico, não mistura
  r = await POST(post(email, { prova: PROVA, tentativa: 1, atual: 5, respostas: { [q2.number]: q2.answer } }));
  s = await r.json();
  assert.deepEqual([s.tentativa, s.atual, s.respostas], [2, 0, {}]);

  // Prova inexistente e corpo inválido
  assert.equal((await POST(post(email, { prova: 'nao-existe-123' }))).status, 404);
  assert.equal((await GET(get(email, 'index'))).status, 404);

  const { db } = await import('../lib/db.js');
  const sql = db();
  const hist = await sql`select prova_id, tentativa, questao, resposta, acertou from cnc_progresso_respostas where email = ${email} order by tentativa, questao`;
  assert.ok(hist.every((h) => h.prova_id === prova.id), 'um só registro por prova');
  assert.equal(hist.filter((h) => h.tentativa === 1).length, 3, 'tentativa 1 guardada');
  assert.equal(hist.find((h) => h.tentativa === 1 && h.questao === Number(q1.number)).acertou, true);
  assert.equal(hist.find((h) => h.tentativa === 1 && h.questao === Number(q2.number)).acertou, false);
  // Apaga só os dados criados por este teste
  await sql`delete from cnc_progresso_respostas where email = ${email}`;
  await sql`delete from cnc_progresso_provas where email = ${email}`;
  console.log('progresso.test.mjs: fluxo completo no banco de teste OK');
}

console.log('progresso.test.mjs OK');
