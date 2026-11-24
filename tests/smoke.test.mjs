import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';
import { CONCURSOS, PLATAFORMAS_PARCEIRAS, PLANOS, MARCA } from '../public/js/data/concursos.js';

async function runTests() {
  // 1. Validate branding and pricing tiers
  assert.equal(MARCA.nome, 'Check no Concurso');
  assert.equal(MARCA.dominio, 'checknoconcurso.com.br');
  assert.equal(PLANOS.essencial.preco, 6.99);
  assert.equal(PLANOS.completoMensal.preco, 17.99);
  assert.equal(PLANOS.completoAnual.preco, 199.90);

  // 2. Validate real dataset integrity (active + scheduled + authorized + closed + 5 past exams each)
  assert.ok(CONCURSOS.length >= 18, 'Esperado pelo menos 18 concursos reais');
  assert.equal(new Set(CONCURSOS.map((c) => c.id)).size, CONCURSOS.length, 'IDs de concursos devem ser únicos');

  const open = CONCURSOS.filter((c) => c.status === 'Inscrições Abertas');
  const closed = CONCURSOS.filter((c) => c.status === 'Encerrado');
  const scheduled = CONCURSOS.filter((c) => c.status === 'Prova Agendada');
  const freeHighlights = CONCURSOS.filter((c) => c.destaqueGratuito);

  assert.ok(open.length >= 7, 'Deve conter concursos reais com inscrições abertas');
  assert.ok(closed.length >= 4, 'Deve conter concursos reais encerrados/terminados');
  assert.ok(scheduled.length >= 4, 'Deve conter concursos reais com prova agendada');
  assert.equal(freeHighlights.length, 3, 'Deve haver exatamente 3 destaques gratuitos para degustação');

  for (const c of CONCURSOS) {
    assert.ok(c.id && c.orgao && c.sigla && c.uf && c.banca && c.fonteOficial, `Campos básicos ausentes em ${c.id}`);
    assert.ok(c.dataProvaAtualizadaEm && c.provaObservacao, `Metadados de prova ausentes em ${c.id}`);
    assert.ok((c.vagas > 0 || c.vagasCR > 0) && c.salarioMax >= c.salarioMin, `Valores inválidos em ${c.id}`);
    assert.ok(c.edital && c.edital.cargos.length > 0 && c.edital.disciplinas.length > 0, `Edital incompleto em ${c.id}`);
    assert.ok(Array.isArray(c.cursos) && c.cursos.length >= 2, `Menos de 2 cursos comparados em ${c.id}`);
    assert.equal(c.provasAnteriores.length, 5, `Esperadas exatamente 5 provas anteriores em ${c.id}`);
    for (const course of c.cursos) {
      assert.ok(
        PLATAFORMAS_PARCEIRAS.some((p) => p.id === course.plataformaId),
        `Plataforma desconhecida ${course.plataformaId} em ${c.id}`
      );
    }
  }

  // 3. Probe local server endpoints & PWA assets
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await (await fetch(`${baseUrl}/api/health`)).json();
    assert.equal(health.ok, true);
    assert.equal(health.service, 'check-no-concurso');

    const stats = await (await fetch(`${baseUrl}/api/stats`)).json();
    assert.equal(stats.totalConcursos, CONCURSOS.length);
    assert.equal(stats.concursosEncerrados, closed.length);
    assert.equal(stats.totalProvasAnteriores, CONCURSOS.length * 5);

    const activeRes = await (await fetch(`${baseUrl}/api/concursos?status=ATIVOS`)).json();
    assert.ok(activeRes.items.every((i) => i.status !== 'Encerrado'));

    const closedRes = await (await fetch(`${baseUrl}/api/concursos?status=Encerrado`)).json();
    assert.equal(closedRes.items.length, closed.length);

    for (const asset of ['/', '/css/styles.css', '/js/app.js', '/manifest.webmanifest', '/sw.js', '/icons/icon.svg']) {
      const res = await fetch(`${baseUrl}${asset}`);
      assert.equal(res.status, 200, `Falha ao servir ${asset}`);
    }

    const html = await (await fetch(`${baseUrl}/`)).text();
    assert.ok(html.includes('Check no Concurso'), 'HTML deve conter marca Check no Concurso');
    assert.ok(html.includes('PM-SP, TJ-SP e TRT-4'), 'HTML deve listar os novos destaques reais');

    console.log(`OK: ${CONCURSOS.length} concursos REAIS validados (${stats.concursosAtivos} ativos + ${stats.concursosEncerrados} encerrados, ${stats.totalVagasAbertas.toLocaleString('pt-BR')} vagas imediatas abertas/previstas, ${stats.totalProvasAnteriores} provas anteriores mapeadas).`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

runTests().catch((err) => {
  console.error('FALHA NOS TESTES:', err);
  process.exit(1);
});
