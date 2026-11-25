import assert from 'node:assert/strict';
import { CONCURSOS, ESTADOS_BRASIL } from '../public/js/data/concursos.js';
import { scoreConcurso } from '../public/js/search.js';
import { getConcursosPayload } from '../lib/catalog-api.js';

function search(q) {
  return CONCURSOS
    .map((c) => ({ c, s: scoreConcurso(c, q, ESTADOS_BRASIL[c.uf]?.nome || '') }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}
const top = (q) => search(q)[0]?.sigla;
const has = (q, sigla) => search(q).some((c) => c.sigla === sigla);

// Siglas em qualquer formato
for (const q of ['PM-SP', 'pm sp', 'pmsp', 'Pm-Sp', 'policia militar sp']) assert.equal(top(q), 'PM-SP', `"${q}" deve trazer PM-SP primeiro`);
for (const q of ['TJ-SP', 'tj sp', 'tjsp', 'tribunal de justiça de são paulo']) assert.equal(top(q), 'TJ-SP', `"${q}" deve trazer TJ-SP primeiro`);

// Acentos, plurais e palavras de ligação
assert.ok(search('policia civil').length >= 20, '"policia civil" sem acento');
assert.ok(search('enfermeiros').length >= 10, 'plural "enfermeiros"');
assert.ok(search('fiscais').length >= 20, 'plural "fiscais"');
assert.ok(search('ensino médio').length >= search('nivel medio').length, '"ensino médio" não pode trazer menos que "nivel medio"');
assert.ok(has('concurso de professor em sp', 'SEDUC-SP'), 'frase natural "concurso de professor em sp"');

// Erros de digitação
assert.ok(search('profesor').length >= 30, 'erro de digitação "profesor"');
assert.ok(search('cebrapse').length >= 20, 'erro de digitação "cebrapse"');
assert.ok(has('policia militr', 'PM-SP'), 'erro de digitação "policia militr"');

// Cargos de dentro do edital, bancas e estados
assert.ok(search('escrivao').length >= 5, 'cargo "escrivão"');
assert.ok(search('vunesp').every((c) => /vunesp/i.test(c.banca)), 'banca Vunesp sem falsos resultados');
assert.ok(search('minas gerais').every((c) => c.uf === 'MG' || /minas/i.test(c.orgao)), 'estado por nome');

// Busca sem sentido não traz nada
assert.equal(search('zzzz').length, 0);

// API usa a mesma busca
const api = getConcursosPayload(new URLSearchParams('q=pm sp'));
assert.equal(api.items[0]?.sigla, 'PM-SP', 'API /api/concursos?q=pm sp deve trazer PM-SP primeiro');

console.log('OK: busca — siglas, acentos, plurais, erros de digitação, cargos e API validados.');
