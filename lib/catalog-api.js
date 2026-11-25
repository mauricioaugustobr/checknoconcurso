import { CONCURSOS, PLATAFORMAS_PARCEIRAS, PLANOS, MARCA, ESTADOS_BRASIL } from '../public/js/data/concursos.js';
import { scoreConcurso } from '../public/js/search.js';

export function getHealthPayload() {
  return {
    ok: true,
    service: 'check-no-concurso',
    domain: MARCA.dominio,
    timestamp: new Date().toISOString()
  };
}

export function computeStats(items = CONCURSOS) {
  const ativos = items.filter((c) => c.status !== 'Encerrado');
  const encerrados = items.filter((c) => c.status === 'Encerrado');
  const totalVagasAbertas = ativos.reduce((acc, c) => acc + c.vagas, 0);
  const inscricoesAbertas = items.filter((c) => c.status === 'Inscrições Abertas').length;
  const totalCursos = items.reduce((acc, c) => acc + c.cursos.length, 0);
  const totalProvasAnteriores = items.reduce((acc, c) => acc + c.provasAnteriores.length, 0);
  const maiorSalario = Math.max(...ativos.map((c) => c.salarioMax));
  return {
    marca: MARCA.nome,
    dominio: MARCA.dominio,
    totalConcursos: items.length,
    concursosAtivos: ativos.length,
    concursosEncerrados: encerrados.length,
    totalVagasAbertas,
    inscricoesAbertas,
    totalCursos,
    totalProvasAnteriores,
    maiorSalario,
    totalEstadosCobertos: Object.keys(ESTADOS_BRASIL).filter((uf) => items.some((c) => c.uf === uf)).length,
    planos: PLANOS
  };
}

export function getEstadosPayload(items = CONCURSOS) {
  const estados = Object.entries(ESTADOS_BRASIL).map(([uf, meta]) => {
    const doEstado = items.filter((c) => c.uf === uf);
    const ativosEstado = doEstado.filter((c) => c.status !== 'Encerrado');
    return {
      uf,
      nome: meta.nome,
      regiao: meta.regiao,
      total: doEstado.length,
      ativos: ativosEstado.length,
      vagasAtivas: ativosEstado.reduce((acc, c) => acc + c.vagas, 0),
      maiorSalario: ativosEstado.length ? Math.max(...ativosEstado.map((c) => c.salarioMax)) : 0
    };
  });
  return {
    totalEstados: estados.length,
    nacional: items.filter((c) => c.uf === 'Nacional').length,
    estados
  };
}

export function getConcursosPayload(searchParams, items = CONCURSOS) {
  const regiao = searchParams.get('regiao');
  const uf = searchParams.get('uf');
  const esfera = searchParams.get('esfera');
  const area = searchParams.get('area');
  const status = searchParams.get('status');
  const q = (searchParams.get('q') || '').trim().toLowerCase();

  let filtered = items;
  if (regiao && regiao !== 'TODAS') filtered = filtered.filter((c) => c.regiao === regiao);
  if (uf && uf !== 'TODOS') filtered = filtered.filter((c) => c.uf === uf || c.uf === 'Nacional');
  if (esfera && esfera !== 'TODAS') filtered = filtered.filter((c) => c.esfera === esfera);
  if (area && area !== 'TODAS') filtered = filtered.filter((c) => c.area === area);
  if (status && status !== 'TODOS') {
    if (status === 'ATIVOS') filtered = filtered.filter((c) => c.status !== 'Encerrado');
    else filtered = filtered.filter((c) => c.status === status);
  }
  if (q) {
    // Mesma busca da tela (public/js/search.js): acentos, hífen, siglas, plurais e erros de digitação
    filtered = filtered
      .map((c) => ({ c, s: scoreConcurso(c, q, ESTADOS_BRASIL[c.uf]?.nome || '') }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s || (y.c.importancia || 0) - (x.c.importancia || 0))
      .map((x) => x.c);
  }

  return {
    total: filtered.length,
    marca: MARCA,
    planos: PLANOS,
    plataformas: PLATAFORMAS_PARCEIRAS,
    items: filtered
  };
}

export function jsonResponse(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-cache' }
  });
}
