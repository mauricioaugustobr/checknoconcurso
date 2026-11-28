// Item 13: agenda da semana dos concursos acompanhados.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { eventosDosConcursos, montarAgenda, agendaHTML, agendaICS } = await import('../public/js/agenda.js');

const H = '2026-11-27'; // sexta-feira
const c = (id, extra) => ({ id, sigla: id.toUpperCase(), titulo: `Concurso ${id}`, status: 'Inscrições Abertas', ...extra });
const lista = [
  c('a', { inscricaoInicio: '2026-11-01', inscricaoFim: '2026-11-27', dataProva: '2026-12-20' }), // fim hoje, prova depois
  c('b', { inscricaoInicio: '2026-11-30', inscricaoFim: '2026-12-15', dataProva: '2027-01-10' }), // abre segunda
  c('c', { inscricaoFim: '2026-11-20', dataProva: '2026-12-03', status: 'Prova Agendada' }),      // prova quinta
  c('d', { inscricaoFim: '2026-12-01', dataProva: null, status: 'Encerrado' }),                   // encerrado: sem fim
  c('e', { inscricaoFim: '2026-11-10', dataProva: '2026-11-15' })                                 // tudo no passado
];

// Eventos de hoje em diante, em ordem de data; encerrado não tem fim de inscrição; passado não entra
const ev = eventosDosConcursos(lista, H);
assert.deepEqual(ev.map((e) => `${e.data} ${e.tipo} ${e.c.id}`), [
  '2026-11-27 fim a', '2026-11-30 abre b', '2026-12-03 prova c', '2026-12-15 fim b', '2026-12-20 prova a', '2027-01-10 prova b'
]);

// Semana: 7 dias a partir de hoje, com os eventos no dia certo; o resto vai para "Mais adiante"
const ag = montarAgenda(lista, H);
assert.equal(ag.dias.length, 7);
assert.equal(ag.dias[0].data, H);
assert.equal(ag.dias[6].data, '2026-12-03');
assert.equal(ag.totalSemana, 3);
assert.deepEqual(ag.depois.map((e) => e.c.id), ['b', 'a', 'b']);

// Tela: Hoje, Amanhã, dia da semana; botões abrem o concurso; escapa HTML
const html = agendaHTML(lista, H);
assert.match(html, /Sua semana/);
assert.match(html, /3 datas nos próximos 7 dias/);
assert.match(html, /<strong>Hoje<\/strong><span>27\/11<\/span>/);
assert.match(html, /<strong>Amanhã<\/strong>/);
assert.match(html, /<strong>Seg<\/strong><span>30\/11<\/span>/);
assert.match(html, /data-open-id="c"/);
assert.match(html, /Mais adiante/);
assert.match(html, /data-agenda-ics/);
assert.equal(agendaHTML([], H), '');
assert.match(agendaHTML([c('z', { inscricaoFim: '2026-01-01' })], H), /Nenhuma data nos próximos 7 dias/);
assert.doesNotMatch(agendaHTML([c('x', { sigla: '<img src=x>', inscricaoFim: H })], H), /<img/);

// Arquivo .ics: um evento de dia inteiro por data, linhas de no máximo 75 caracteres
const ics = agendaICS(lista, H, { agora: new Date('2026-11-27T12:00:00Z') });
assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 6);
assert.match(ics, /DTSTART;VALUE=DATE:20261127\r\nDTEND;VALUE=DATE:20261128/);
assert.match(ics, /SUMMARY:Último dia de inscrição · A/);
for (const linha of ics.split('\r\n')) assert.ok(linha.length <= 75, linha);

// Ligada na tela "Meus concursos"
const app = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
assert.match(app, /agendaHTML\(savedItems, TODAY_ISO\)/);
assert.match(fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'), /id="agendaSlot"/);
console.log('OK: item 13 — agenda da semana (7 dias, mais adiante, calendário .ics).');
