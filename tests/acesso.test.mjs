// Sem plano grátis: catálogo, provas e explicações só com plano, conferido no servidor.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSessionToken } from '../lib/auth.js';

delete process.env.DATABASE_URL;
const SECRET = 'k'.repeat(48);
process.env.SESSION_SECRET = SECRET;
process.env.ADMIN_EMAILS = 'chefe@exemplo.com';
process.env.CNC_ACESSO_LIVRE = '0'; // trava ligada, como em produção

const { GET: concursos } = await import('../api/concursos.js');
const { GET: stats } = await import('../api/stats.js');
const { handleExplicacao } = await import('../lib/explicacao.js');
const { ehPrivado } = await import('../tools/build-public.mjs');
const { PLANOS } = await import('../public/js/data/site-info.js');

const BASE = 'https://checknoconcurso.com.br';
const cookie = (email) => 'cnc_session=' + createSessionToken({ sub: '1', email, name: 'Teste', provider: 'google' }, SECRET);
const req = (path, email) => new Request(BASE + path, { headers: email ? { cookie: cookie(email) } : {} });

// Visitante: sem catálogo, sem provas, sem explicação
let r = await concursos(req('/api/concursos'));
assert.equal(r.status, 401);
assert.equal((await r.json()).codigo, 'login');
assert.equal((await concursos(req('/api/concursos?tipo=provas'))).status, 401);
assert.equal((await concursos(req('/api/concursos?tipo=prova&c=pm-sp-soldado-2026'))).status, 401);
assert.equal((await handleExplicacao(req('/api/explicacao?c=pm-sp-soldado-2026&q=1'))).status, 401);

// Conta sem assinatura: escolhe um plano
r = await concursos(req('/api/concursos', 'aluno@exemplo.com'));
assert.equal(r.status, 403);
assert.equal((await r.json()).codigo, 'plano');
assert.equal((await concursos(req('/api/concursos?tipo=prova&c=pm-sp-soldado-2026', 'aluno@exemplo.com'))).status, 403);

// Admin: acesso total, sem cache compartilhado
r = await concursos(req('/api/concursos', 'chefe@exemplo.com'));
assert.equal(r.status, 200);
assert.match(r.headers.get('cache-control'), /private/);
assert.ok((await r.json()).items.length > 300);
r = await concursos(req('/api/concursos?tipo=provas', 'chefe@exemplo.com'));
assert.ok(Object.keys(await r.json()).length > 10);
r = await concursos(req('/api/concursos?tipo=prova&c=gm-aracaju-se-2026', 'chefe@exemplo.com'));
assert.equal(r.status, 200);
assert.ok((await r.json()).questoes.length > 0);
r = await concursos(req('/api/concursos?tipo=prova&c=pm-sp-soldado-2026', 'chefe@exemplo.com'));
assert.equal(r.status, 200);
assert.equal((await concursos(req('/api/concursos?tipo=prova&c=index', 'chefe@exemplo.com'))).status, 404);

// Totais públicos do topo continuam abertos
r = await stats();
const st = await r.json();
assert.ok(st.concursosAtivos > 0 && st.provasParaTreinar > 0);

// Catálogo e provas não vão para a pasta pública
for (const f of ['js/data/concursos.js', 'js/data/estados-sul.js', 'js/data/provas.js', 'provas/index.json', 'provas/gm-aracaju-se-2026.json']) assert.ok(ehPrivado(f), f);
for (const f of ['js/app.js', 'js/data/site-info.js', 'js/data/estado-builder.js', 'js/data/sem-prova.js', 'index.html']) assert.ok(!ehPrivado(f), f);
const app = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
assert.doesNotMatch(app, /from '\.\/data\/concursos\.js'/);
const prova = fs.readFileSync(new URL('../public/js/prova.js', import.meta.url), 'utf8');
assert.doesNotMatch(prova, /data\/provas\.js/);

// Só 2 planos, sem plano grátis
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
assert.doesNotMatch(html, /Visitante Grátis|freeAccessBox|Criar conta grátis/);
assert.match(html, /id="planGate"/);
assert.equal(PLANOS.essencial.preco, 6.99);
assert.deepEqual(Object.keys(PLANOS), ['essencial', 'completoMensal', 'completoAnual']);

delete process.env.CNC_ACESSO_LIVRE;
console.log('OK: sem plano grátis — catálogo, provas e explicações exigem plano no servidor; dados pagos fora da pasta pública.');
