/**
 * Item 13 · Agenda da semana — só dos concursos que a pessoa acompanha (lista do item 12).
 * Cada dia mostra o que acontece: inscrições abrem, último dia de inscrição ou prova.
 * Os próximos 7 dias (a partir de hoje, no horário de Brasília) ficam em destaque;
 * depois vêm as próximas datas mais adiante. Tudo é calculado no navegador com o catálogo.
 * O catálogo não tem a data do resultado; quando tiver, entra aqui como mais um tipo.
 */
import { hojeBR, somarDias, diasAte } from './ultimos-dias.js?v=1';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const isoDia = (v) => (v ? String(v).slice(0, 10) : null);
const dataBR = (iso) => iso.split('-').reverse().join('/');
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const diaSemana = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();

export const TIPOS = {
  abre: { rotulo: 'Inscrições abrem', curto: 'Abrem inscrições', ordem: 2 },
  fim: { rotulo: 'Último dia de inscrição', curto: 'Último dia', ordem: 0 },
  prova: { rotulo: 'Prova', curto: 'Prova', ordem: 1 }
};

/** Datas que importam de cada concurso, de hoje em diante. */
export function eventosDosConcursos(lista, hoje = hojeBR()) {
  const out = [];
  for (const c of lista || []) {
    const encerrado = c.status === 'Encerrado';
    const ini = isoDia(c.inscricaoInicio);
    const fim = isoDia(c.inscricaoFim);
    const prova = isoDia(c.dataProva);
    if (!encerrado && ini && ini >= hoje && ini !== fim) out.push({ tipo: 'abre', data: ini, c });
    if (!encerrado && fim && fim >= hoje) out.push({ tipo: 'fim', data: fim, c });
    if (prova && prova >= hoje) out.push({ tipo: 'prova', data: prova, c });
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || TIPOS[a.tipo].ordem - TIPOS[b.tipo].ordem || String(a.c.sigla).localeCompare(String(b.c.sigla), 'pt-BR'));
}

/** { dias: 7 dias a partir de hoje com seus eventos, depois: próximas datas fora da semana } */
export function montarAgenda(lista, hoje = hojeBR(), { maisAdiante = 4 } = {}) {
  const eventos = eventosDosConcursos(lista, hoje);
  const fimSemana = somarDias(hoje, 6);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const data = somarDias(hoje, i);
    return { data, eventos: eventos.filter((e) => e.data === data) };
  });
  const depois = eventos.filter((e) => e.data > fimSemana).slice(0, maisAdiante);
  return { hoje, dias, depois, totalSemana: dias.reduce((n, d) => n + d.eventos.length, 0) };
}

function nomeDoDia(data, hoje) {
  const d = diasAte(data, hoje);
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Amanhã';
  return DIAS[diaSemana(data)];
}

function eventoHTML(e) {
  return `
        <li><button type="button" class="ag-ev ag-${e.tipo}" data-open-id="${esc(e.c.id)}" aria-label="${esc(TIPOS[e.tipo].rotulo)}: ${esc(e.c.sigla)}, ${esc(dataBR(e.data))}. Abrir concurso">
          <span class="ag-tipo">${esc(TIPOS[e.tipo].curto)}</span>
          <span class="ag-nome">${esc(e.c.sigla)}</span>
        </button></li>`;
}

export function agendaHTML(lista, hoje = hojeBR()) {
  if (!lista?.length) return '';
  const ag = montarAgenda(lista, hoje);
  const resumo = ag.totalSemana
    ? `${ag.totalSemana} ${ag.totalSemana === 1 ? 'data' : 'datas'} nos próximos 7 dias`
    : 'Nenhuma data nos próximos 7 dias';
  const dias = ag.dias.map((d) => {
    const vazio = !d.eventos.length;
    return `
      <li class="ag-dia${diasAte(d.data, hoje) === 0 ? ' is-hoje' : ''}${vazio ? ' is-vazio' : ''}">
        <p class="ag-data"><strong>${esc(nomeDoDia(d.data, hoje))}</strong><span>${esc(dataBR(d.data).slice(0, 5))}</span><span class="ag-sr">, ${esc(DIAS_LONGOS[diaSemana(d.data)])}</span></p>
        ${vazio ? '<p class="ag-nada">—<span class="ag-sr"> nada neste dia</span></p>' : `<ul class="ag-evs">${d.eventos.map(eventoHTML).join('')}</ul>`}
      </li>`;
  }).join('');
  const depois = ag.depois.length ? `
    <div class="ag-depois">
      <p class="ag-depois-tit">Mais adiante</p>
      <ul>
        ${ag.depois.map((e) => `<li><button type="button" class="ag-linha" data-open-id="${esc(e.c.id)}"><span class="ag-quando">${esc(dataBR(e.data))}</span><span class="ag-tipo-txt ag-${e.tipo}-txt">${esc(TIPOS[e.tipo].rotulo)}</span><strong>${esc(e.c.sigla)}</strong></button></li>`).join('')}
      </ul>
    </div>` : '';
  const temDatas = ag.totalSemana || ag.depois.length;
  return `
  <section class="ag" aria-labelledby="agTitulo">
    <div class="ag-head">
      <div>
        <h3 class="ag-titulo" id="agTitulo">Sua semana</h3>
        <p class="ag-sub">${esc(resumo)} · só dos concursos que você acompanha</p>
      </div>
      ${temDatas ? '<button type="button" class="btn-outline-sm ag-ics" data-agenda-ics>Adicionar ao calendário</button>' : ''}
    </div>
    <ol class="ag-dias">${dias}</ol>
    ${depois}
    <p class="ag-nota">Datas tiradas do edital de cada concurso. A data do resultado ainda não entra na agenda.</p>
  </section>`;
}

/* ---------- Arquivo de calendário (.ics) para o celular ou o computador ---------- */
const icsTexto = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, '\\n');

// Linhas do .ics com no máximo 75 caracteres (as seguintes começam com espaço)
function dobrar(linha) {
  if (linha.length <= 75) return linha;
  const partes = [linha.slice(0, 75)];
  for (let i = 75; i < linha.length; i += 74) partes.push(` ${linha.slice(i, i + 74)}`);
  return partes.join('\r\n');
}

export function agendaICS(lista, hoje = hojeBR(), { origem = 'https://checknoconcurso.com.br', agora = new Date() } = {}) {
  const stamp = agora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Check no Concurso//Agenda//PT-BR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Check no Concurso'];
  for (const e of eventosDosConcursos(lista, hoje)) {
    const dia = e.data.replace(/-/g, '');
    const fim = somarDias(e.data, 1).replace(/-/g, '');
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${e.c.id}-${e.tipo}-${dia}@checknoconcurso.com.br`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dia}`,
      `DTEND;VALUE=DATE:${fim}`,
      `SUMMARY:${icsTexto(`${TIPOS[e.tipo].rotulo} · ${e.c.sigla}`)}`,
      `DESCRIPTION:${icsTexto(`${e.c.titulo || e.c.orgao || ''}\nConfira no edital antes. ${origem}/concurso/${e.c.id}`)}`,
      `URL:${origem}/concurso/${e.c.id}`,
      'END:VEVENT'
    );
  }
  linhas.push('END:VCALENDAR');
  return linhas.map(dobrar).join('\r\n') + '\r\n';
}

export function baixarAgendaICS(lista) {
  const blob = new Blob([agendaICS(lista, hojeBR(), { origem: window.location.origin })], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'check-no-concurso-agenda.ics';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
