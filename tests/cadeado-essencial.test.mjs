// Item 11: prévia com cadeado para o Essencial + subir para o Completo sem cobrança dupla.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSessionToken } from '../lib/auth.js';

delete process.env.DATABASE_URL;
const SECRET = 'k'.repeat(48);
process.env.SESSION_SECRET = SECRET;
process.env.ADMIN_EMAILS = 'chefe@exemplo.com';
process.env.CNC_ACESSO_LIVRE = '0';

const { GET: concursos } = await import('../api/concursos.js');
const { previaDaProva } = await import('../lib/prova-previa.js');
const { deveIgnorarAssinatura, encerrarAssinaturaSubstituida } = await import('../lib/stripe.js');
const { cadeadoTreinoHTML, faixaTreinoTravadaHTML } = await import('../public/js/cadeado-essencial.js');

const BASE = 'https://checknoconcurso.com.br';
const cookie = (email) => 'cnc_session=' + createSessionToken({ sub: '1', email, name: 'Teste', provider: 'google' }, SECRET);
const req = (path, email) => new Request(BASE + path, { headers: email ? { cookie: cookie(email) } : {} });

// 1. A prévia nunca leva alternativas, gabarito nem explicação — em nenhuma prova
const indice = JSON.parse(fs.readFileSync(new URL('../public/provas/index.json', import.meta.url), 'utf8'));
for (const id of Object.keys(indice)) {
  const p = previaDaProva(id);
  assert.ok(p && p.questao, `prévia de ${id}`);
  const prova = JSON.parse(fs.readFileSync(new URL(`../public/provas/${id}.json`, import.meta.url), 'utf8'));
  const texto = JSON.stringify(p);
  assert.doesNotMatch(texto, /"answer"|"gabarito"|"explica|"alternatives"|"texto"/, id);
  const q = prova.questoes.find((x) => x.number === p.questao.numero);
  for (const alt of q.alternatives) if (String(alt.text || '').length > 25) assert.ok(!texto.includes(alt.text), `${id}: alternativa vazou`);
  assert.ok(p.questao.enunciado.length <= 262, `${id}: enunciado cortado`);
  assert.equal(p.total, prova.questoes.length);
  assert.ok(p.materias.length >= 1 && p.materias.length <= 6);
}
assert.equal(previaDaProva('index'), null);
assert.equal(previaDaProva('../etc/passwd'), null);
assert.equal(previaDaProva('nao-existe-2026'), null);

// 2. Rota: visitante 401, conta sem plano 403, com plano 200 e sem cache compartilhado
assert.equal((await concursos(req('/api/concursos?tipo=previa&c=pm-sp-soldado-2026'))).status, 401);
assert.equal((await concursos(req('/api/concursos?tipo=previa&c=pm-sp-soldado-2026', 'aluno@exemplo.com'))).status, 403);
let r = await concursos(req('/api/concursos?tipo=previa&c=pm-sp-soldado-2026', 'chefe@exemplo.com'));
assert.equal(r.status, 200);
assert.match(r.headers.get('cache-control'), /private/);
assert.equal((await r.json()).total, 60);
assert.equal((await concursos(req('/api/concursos?tipo=previa&c=index', 'chefe@exemplo.com'))).status, 404);
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.ok(vercel.rewrites.some((x) => x.source === '/api/prova-previa/:id' && x.destination.includes('tipo=previa')));

// 3. Tela: cadeado com dados reais e botões de subir de plano
const c = { id: 'pm-sp-soldado-2026', sigla: 'PM-SP' };
const html = cadeadoTreinoHTML(c, indice['pm-sp-soldado-2026'], previaDaProva('pm-sp-soldado-2026'));
assert.match(html, /Você já tem o Essencial\. Falta só o treino\./);
assert.match(html, /data-trigger-checkout="completo-anual"/);
assert.match(html, /data-trigger-checkout="completo-mensal"/);
assert.match(html, /Língua Portuguesa/);
assert.match(cadeadoTreinoHTML(c, indice['pm-sp-soldado-2026'], undefined), /Carregando a prévia/);
assert.match(faixaTreinoTravadaHTML(indice['pm-sp-soldado-2026']), /60 questões/);
assert.match(faixaTreinoTravadaHTML(undefined), /Ver o que vem no Completo/);
assert.doesNotMatch(cadeadoTreinoHTML({ id: 'x', sigla: '<b>' }, null, null), /<b>/, 'escapa o texto');

// 4. Assinatura antiga do Essencial não rebaixa quem subiu para o Completo
const gravada = { tier: 'completo-anual', status: 'active', stripe_subscription_id: 'sub_NOVA' };
assert.equal(deveIgnorarAssinatura(gravada, { id: 'sub_VELHA', status: 'canceled' }, 'essencial'), true);
assert.equal(deveIgnorarAssinatura(gravada, { id: 'sub_VELHA', status: 'active' }, 'essencial'), true);
assert.equal(deveIgnorarAssinatura(gravada, { id: 'sub_NOVA', status: 'canceled' }, 'completo-anual'), false, 'a própria assinatura sempre atualiza');
assert.equal(deveIgnorarAssinatura({ tier: 'essencial', status: 'active', stripe_subscription_id: 'sub_VELHA' }, { id: 'sub_NOVA', status: 'active' }, 'completo-anual'), false, 'subir de plano grava');
assert.equal(deveIgnorarAssinatura({ tier: 'completo-mensal', status: 'canceled', stripe_subscription_id: 'sub_A' }, { id: 'sub_B', status: 'active' }, 'essencial'), false, 'voltar a assinar depois de cancelar');
assert.equal(deveIgnorarAssinatura(null, { id: 'sub_X', status: 'active' }, 'essencial'), false);

// 5. Depois do Completo pago, encerra o Essencial antigo (só se for do mesmo e-mail e do Essencial)
process.env.STRIPE_SECRET_KEY = 'sk_test_' + 'a'.repeat(24);
const chamadas = [];
const api = (velha) => async (method, path) => {
  chamadas.push(`${method} ${path}`);
  return method === 'GET' ? velha : { status: 'canceled' };
};
const nova = { id: 'sub_NOVA', status: 'active', metadata: { substitui: 'sub_VELHA', email: 'a@b.com' } };
const essencialVelha = { id: 'sub_VELHA', status: 'active', metadata: { email: 'a@b.com' }, items: { data: [{ price: { lookup_key: 'cnc_essencial_mensal' } }] } };
assert.equal(await encerrarAssinaturaSubstituida(nova, 'a@b.com', { api: api(essencialVelha) }), true);
assert.deepEqual(chamadas, ['GET /subscriptions/sub_VELHA', 'DELETE /subscriptions/sub_VELHA?prorate=true']);
chamadas.length = 0;
assert.equal(await encerrarAssinaturaSubstituida(nova, 'a@b.com', { api: api({ ...essencialVelha, metadata: { email: 'outra@b.com' } }) }), false, 'de outra conta: não mexe');
assert.equal(await encerrarAssinaturaSubstituida(nova, 'a@b.com', { api: api({ ...essencialVelha, status: 'canceled' }) }), false, 'já encerrada');
assert.equal(await encerrarAssinaturaSubstituida(nova, 'a@b.com', { api: api({ ...essencialVelha, items: { data: [{ price: { lookup_key: 'cnc_completo_mensal' } }] } }) }), false, 'só encerra Essencial');
assert.ok(!chamadas.some((x) => x.startsWith('DELETE')));
assert.equal(await encerrarAssinaturaSubstituida({ ...nova, status: 'incomplete' }, 'a@b.com', { api: api(essencialVelha) }), false, 'Completo ainda não pago');
assert.equal(await encerrarAssinaturaSubstituida({ ...nova, metadata: { substitui: 'sub_X;DROP' } }, 'a@b.com', { api: api(essencialVelha) }), false);
delete process.env.STRIPE_SECRET_KEY;

console.log(`OK: item 11 — prévia com cadeado (${Object.keys(indice).length} provas sem respostas), rota protegida e subida para o Completo sem cobrança dupla.`);
