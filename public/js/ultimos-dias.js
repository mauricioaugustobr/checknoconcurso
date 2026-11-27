/**
 * Item 8 · "Últimos dias para se inscrever" + selos de prazo (Opção 1 da Designer UI/UX:
 * faixa azul-escura com abas por estado).
 *
 * Funções puras (servidor e navegador):
 *  - seloPrazo(c, hoje): "Termina hoje", "Últimos 3 dias", "Até dd/mm" (4 a 7 dias) ou "Abriu hoje".
 *    Calculado pela data de hoje no horário de Brasília, e não pela situação gravada no catálogo.
 *  - fechamEm7(lista, hoje), selecaoBrasil(lista), abasPorEstado(lista)
 *  - blocoHTML(...) e seloHTML(...)
 * No navegador, a página inicial pede /api/ultimos-dias e desenha o bloco em #ultimosDiasInicial.
 * Só dados públicos (os mesmos das páginas /concurso/<id> e /concursos/<uf>).
 */
const esc = (v) => String(v ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const nf = (n) => Number(n || 0).toLocaleString('pt-BR');
const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
const isoDay = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : ''));
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

// Data de hoje no horário de Brasília (UTC-3)
export const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
export function somarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function diasAte(iso, hoje = hojeBR()) {
  if (!iso) return null;
  return Math.round((Date.parse(`${isoDay(iso)}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 864e5);
}

/** Selo de prazo do concurso, ou null (8 dias ou mais, encerrado ou sem datas). */
export function seloPrazo(c, hoje = hojeBR()) {
  if (!c || c.status === 'Encerrado') return null;
  const ini = isoDay(c.inscricaoInicio);
  const fim = isoDay(c.inscricaoFim);
  if (ini && ini > hoje) return null; // inscrições ainda não começaram
  const d = diasAte(fim, hoje);
  if (d !== null && d >= 0 && d <= 7) {
    if (d === 0) return { tipo: 'hoje', texto: 'Termina hoje' };
    if (d <= 3) return { tipo: 'tres', texto: 'Últimos 3 dias' };
    return { tipo: 'ate', texto: `Até ${ddmm(fim)}` };
  }
  if (ini && ini === hoje && (d === null || d >= 0)) return { tipo: 'abriu', texto: 'Abriu hoje' };
  return null;
}

/** Concursos com inscrições abertas que fecham de hoje até daqui a 7 dias, por ordem de prazo. */
export function fechamEm7(lista, hoje = hojeBR()) {
  return (lista || [])
    .filter((c) => { const s = seloPrazo(c, hoje); return s && s.tipo !== 'abriu'; })
    .sort((a, b) => isoDay(a.inscricaoFim).localeCompare(isoDay(b.inscricaoFim)) || (b.importancia || 0) - (a.importancia || 0));
}

/** "Todo o Brasil": os 6 mais relevantes (mais vagas e maior salário), mostrados em ordem de prazo. */
export function selecaoBrasil(lista, n = 6) {
  const peso = (c) => (c.importancia || 0) || (Math.log10((c.vagas || 0) + 1) * 10 + Math.log10((c.salarioMax || 0) + 1) * 5);
  return [...lista].sort((a, b) => peso(b) - peso(a)).slice(0, n)
    .sort((a, b) => isoDay(a.inscricaoFim).localeCompare(isoDay(b.inscricaoFim)) || peso(b) - peso(a));
}

/** Abas por estado: do que tem mais concursos para o que tem menos; os 6 que fecham primeiro em cada. */
export function abasPorEstado(lista, n = 6) {
  const grupos = new Map();
  for (const c of lista) {
    const uf = c.uf || 'Nacional';
    if (!grupos.has(uf)) grupos.set(uf, []);
    grupos.get(uf).push(c);
  }
  return [...grupos.entries()]
    .map(([uf, itens]) => ({ uf, total: itens.length, itens: itens.slice(0, n) }))
    .sort((a, b) => b.total - a.total || (a.uf === 'Nacional') - (b.uf === 'Nacional') || a.uf.localeCompare(b.uf));
}

/* ---------------- HTML ---------------- */
const ICONE = {
  hoje: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/></svg>',
  tres: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22"/><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/></svg>',
  ate: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  abriu: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>'
};

/** Selo pronto. Fica escuro/claro conforme o fundo (classe do bloco ou modo noturno). */
export function seloHTML(selo) {
  if (!selo) return '';
  return `<span class="ud-selo is-${selo.tipo}">${ICONE[selo.tipo] || ''}<span>${esc(selo.texto)}</span></span>`;
}

const vagasTexto = (c) => (c.vagas ? `${nf(c.vagas)} ${c.vagas === 1 ? 'vaga' : 'vagas'}${c.vagasCR ? ' + CR' : ''}` : 'Cadastro reserva');

function cartaoHTML(c, hoje) {
  const selo = seloPrazo(c, hoje);
  const fim = isoDay(c.inscricaoFim);
  const meta = `${vagasTexto(c)} · até ${brl(c.salarioMax)}`;
  return `<li class="ud-item">
        <a class="ud-cartao" href="/concurso/${encodeURIComponent(c.id)}" aria-label="${esc(`${c.sigla}: ${c.titulo}. ${selo ? selo.texto + '. ' : ''}Inscrições até ${ddmm(fim)}`)}">
          <span class="ud-topo">${seloHTML(selo)}<span class="ud-uf">${esc(c.uf === 'Nacional' ? 'BR' : c.uf)}</span></span>
          <span class="ud-sigla">${esc(c.sigla)}</span>
          <span class="ud-cargo">${esc(c.titulo)}</span>
          <span class="ud-meta">${esc(meta)}<span class="ud-meta-prazo"> · até ${esc(ddmm(fim))}</span></span>
          <span class="ud-rodape"><span>Inscrições até ${esc(ddmm(fim))}</span><span class="ud-ver">Ver concurso →</span></span>
          <span class="ud-seta" aria-hidden="true">›</span>
        </a>
      </li>`;
}

const concursosDe = (n, verbo) => `${nf(n)} ${n === 1 ? 'concurso' : 'concursos'}${verbo ? ` ${n === 1 ? 'fecha' : 'fecham'}` : ''}`;

/**
 * Bloco da página inicial (com abas) ou de uma página de estado (sem abas).
 *  lista: concursos que fecham em 7 dias (fechamEm7); hoje: AAAA-MM-DD
 *  estado: { uf, nome, de } na página de estado ("de" = "de São Paulo", "da Bahia"...)
 *  vazio: { proximo: { data, siglas: [] }, abriuHoje: {id, sigla} } quando o estado não tem prazo em 7 dias
 *  totalBrasil: total do Brasil (para o link da página de estado)
 */
export function blocoHTML({ lista = [], hoje = hojeBR(), estado = null, vazio = null, totalBrasil = 0 } = {}) {
  const ate = somarDias(hoje, 7);
  const rotulo = `<p class="ud-rotulo"><span class="ud-ponto" aria-hidden="true"></span>Atualizado hoje, ${esc(ddmm(hoje))}</p>`;
  const rodape = '<p class="ud-nota">Prazos tirados do edital de cada concurso. Antes de se inscrever, confira na página do concurso.</p>';

  // Página de estado sem prazo em 7 dias: faixa fina com o próximo prazo e atalhos
  if (estado && !lista.length) {
    const prox = vazio?.proximo;
    const frase = `<strong>Nenhum concurso ${esc(estado.de)} fecha as inscrições nos próximos 7 dias.</strong>${prox ? ` O próximo prazo em ${esc(estado.uf)} é ${esc(ddmm(prox.data))} (${esc(prox.siglas.join(' e '))}).` : ''}`;
    const atalhos = [
      vazio?.abriuHoje ? `<a class="ud-atalho" href="/concurso/${encodeURIComponent(vazio.abriuHoje.id)}">${seloHTML({ tipo: 'abriu', texto: 'Abriu hoje' })}<span>${esc(vazio.abriuHoje.sigla)} →</span></a>` : '',
      totalBrasil ? `<a class="ud-atalho" href="/#ultimos-dias">Ver os ${nf(totalBrasil)} do Brasil<span class="ud-so-pc"> que fecham até ${esc(ddmm(ate))}</span> →</a>` : ''
    ].join('');
    return `<section class="ud ud-vazio" id="ultimos-dias" aria-label="Prazos de inscrição ${esc(estado.de)}">
      <span class="ud-vazio-icone" aria-hidden="true">${ICONE.ate}</span>
      <div><p class="ud-vazio-texto">${frase}</p>${atalhos ? `<p class="ud-atalhos">${atalhos}</p>` : ''}</div>
    </section>`;
  }
  if (!lista.length) return '';

  if (estado) {
    const sub = `${concursosDe(lista.length, false)} ${esc(estado.de)} ${lista.length === 1 ? 'fecha' : 'fecham'} as inscrições até ${esc(ddmm(ate))}.`;
    return `<section class="ud" id="ultimos-dias" aria-labelledby="ud-titulo">
      <div class="ud-cabeca">
        <div>${rotulo}<h2 class="ud-titulo" id="ud-titulo">Últimos dias para se inscrever em ${esc(estado.uf)}</h2><p class="ud-sub">${sub}</p></div>
        ${totalBrasil ? `<a class="ud-todos" href="/#ultimos-dias">Ver os ${nf(totalBrasil)} do Brasil →</a>` : ''}
      </div>
      <ul class="ud-lista">${lista.slice(0, 6).map((c) => cartaoHTML(c, hoje)).join('')}</ul>
      ${totalBrasil ? `<p class="ud-todos-celular"><a class="ud-todos" href="/#ultimos-dias">Ver os ${nf(totalBrasil)} do Brasil →</a></p>` : ''}
      ${rodape}
    </section>`;
  }

  // Página inicial: "Todo o Brasil" + uma aba por estado
  const abas = [{ uf: 'BR', rotulo: 'Todo o Brasil', total: lista.length, itens: selecaoBrasil(lista) },
    ...abasPorEstado(lista).map((a) => ({ ...a, rotulo: a.uf === 'Nacional' ? 'Nacional' : a.uf }))];
  const linkTodos = (a) => (a.uf === 'BR'
    ? `<a class="ud-todos" href="/#planos" data-ultimos-todos>Ver os ${nf(a.total)} →</a>`
    : a.uf === 'Nacional' ? '' : `<a class="ud-todos" href="/concursos/${a.uf.toLowerCase()}#ultimos-dias">Ver os ${nf(a.total)} de ${esc(a.uf)} →</a>`);
  return `<section class="ud" id="ultimos-dias" aria-labelledby="ud-titulo" data-ud-abas>
      <div class="ud-cabeca">
        <div>${rotulo}<h2 class="ud-titulo" id="ud-titulo">Últimos dias para se inscrever</h2><p class="ud-sub">${concursosDe(lista.length, true)} as inscrições até ${esc(ddmm(ate))}.</p></div>
        <div class="ud-cabeca-link">${abas.map((a, i) => `<span data-ud-link="${i}"${i ? ' hidden' : ''}>${linkTodos(a)}</span>`).join('')}</div>
      </div>
      <div class="ud-abas-wrap">
        <div class="ud-abas" role="tablist" aria-label="Escolha o estado">
          ${abas.map((a, i) => `<button type="button" role="tab" class="ud-aba" id="ud-aba-${i}" aria-controls="ud-painel-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-ud-aba="${i}">${esc(a.rotulo)} <span class="ud-num">${nf(a.total)}</span></button>`).join('')}
        </div>
        <button type="button" class="ud-mais" data-ud-mais aria-label="Ver mais estados" hidden>›</button>
      </div>
      ${abas.map((a, i) => `<div class="ud-painel" role="tabpanel" id="ud-painel-${i}" aria-labelledby="ud-aba-${i}"${i ? ' hidden' : ''}>
        <ul class="ud-lista">${a.itens.map((c) => cartaoHTML(c, hoje)).join('')}</ul>
        <p class="ud-todos-celular">${linkTodos(a)}</p>
      </div>`).join('')}
      ${rodape}
    </section>`;
}

/* ---------------- Navegador ---------------- */
function ligarAbas(raiz) {
  const abas = [...raiz.querySelectorAll('[data-ud-aba]')];
  const lista = raiz.querySelector('.ud-abas');
  const mais = raiz.querySelector('[data-ud-mais]');
  const escolher = (i, foco) => {
    abas.forEach((b, j) => {
      const on = j === i;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      raiz.querySelector(`#ud-painel-${j}`).hidden = !on;
      const l = raiz.querySelector(`[data-ud-link="${j}"]`);
      if (l) l.hidden = !on;
    });
    if (foco) abas[i].focus();
    abas[i].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  abas.forEach((b, i) => {
    b.addEventListener('click', () => escolher(i, false));
    b.addEventListener('keydown', (e) => {
      const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      escolher((n + abas.length) % abas.length, true);
    });
  });
  // Seta "›": aparece quando há abas escondidas à direita
  const atualizar = () => { if (mais) mais.hidden = lista.scrollLeft + lista.clientWidth >= lista.scrollWidth - 4; };
  lista.addEventListener('scroll', atualizar, { passive: true });
  window.addEventListener('resize', atualizar);
  mais?.addEventListener('click', () => lista.scrollBy({ left: Math.max(200, lista.clientWidth * 0.7), behavior: 'smooth' }));
  atualizar();
}

export async function montarUltimosDias(alvo = document.getElementById('ultimosDiasInicial')) {
  if (!alvo) return;
  try {
    const r = await fetch('/api/ultimos-dias', { cache: 'no-cache' });
    if (!r.ok) return;
    const d = await r.json();
    const html = blocoHTML({ lista: d.itens || [], hoje: d.hoje });
    if (!html) return;
    alvo.innerHTML = html;
    alvo.hidden = false;
    const raiz = alvo.querySelector('[data-ud-abas]');
    if (raiz) ligarAbas(raiz);
    if (window.location.hash === '#ultimos-dias') alvo.scrollIntoView({ block: 'start' });
  } catch { /* sem internet: a página segue sem o bloco */ }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => montarUltimosDias());
  else montarUltimosDias();
}
