/**
 * Painel de ADMIN — "Movimento do dia" (aba Visão geral): acessos ao site por hora, cadastros do dia
 * e contas ativas por hora. Os números vêm de /api/admin/metricas (lib/metricas.js), no horário de Brasília.
 * Gráficos em HTML e CSS, sem biblioteca. Todos os números também ficam na tabela "hora a hora".
 */
import { escapeHtml as esc } from '/js/markdown.js?v=1';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const FUSO = 'America/Sao_Paulo';
const num = (n) => Number(n || 0).toLocaleString('pt-BR');
const plural = (n, um, varios) => `${num(n)} ${Number(n) === 1 ? um : varios}`;
const faixaHora = (h) => `das ${h}h às ${h + 1}h`;
const horaMin = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }) : '—');
const horaDe = (iso) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso))) % 24;
const dataBr = (dia) => dia.split('-').reverse().join('/');
const hojeEmBrasilia = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function diaAnterior(dia) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Nome de cada origem de visita (mesma lista de lib/metricas.js). */
const NOME_ORIGEM = {
  'anuncio-meta': 'Anúncio da Meta (Instagram/Facebook)',
  'anuncio-google': 'Anúncio do Google',
  google: 'Busca no Google',
  buscas: 'Outras buscas (Bing, DuckDuckGo…)',
  instagram: 'Instagram (sem anúncio)',
  facebook: 'Facebook (sem anúncio)',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X (Twitter)',
  ia: 'ChatGPT e outras IAs',
  compartilhar: 'Botão Compartilhar do site',
  campanha: 'Outra campanha (link com utm)',
  sites: 'Outros sites',
  direto: 'Direto (digitado, favoritos ou app sem origem)'
};

const GRAFICOS = [
  { id: 'acessos', campo: 'visitas', titulo: 'Acessos por hora', sub: 'visitas ao site', um: 'acesso', varios: 'acessos',
    extra: (x) => plural(x.paginas, 'página aberta', 'páginas abertas') },
  { id: 'cadastros', campo: 'cadastros', titulo: 'Cadastros por hora', sub: 'contas criadas', um: 'cadastro', varios: 'cadastros' },
  { id: 'contas', campo: 'contas', titulo: 'Contas ativas por hora', sub: 'contas conectadas usando o site', um: 'conta ativa', varios: 'contas ativas' }
];

let dados = null;
let diaPedido = ''; // vazio = hoje
let horaMarcada = null;
let pedido = 0;
let relogio = null;

/** Escala do eixo: números redondos e no máximo 4 faixas (0, 5, 10, 15...). */
export function escalaY(max) {
  const m = Math.max(0, Number(max) || 0);
  if (!m) return { topo: 1, ticks: [0] };
  const base = 10 ** Math.floor(Math.log10(m));
  for (const f of [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10]) {
    const passo = Math.max(1, f * base);
    if (!Number.isInteger(passo)) continue;
    const n = Math.ceil(m / passo);
    if (n <= 4) return { topo: n * passo, ticks: Array.from({ length: n + 1 }, (_, i) => i * passo) };
  }
  return { topo: m, ticks: [0, m] };
}

function picoDe(horas, campo) {
  let melhor = null;
  for (const x of horas) if (x[campo] > 0 && (!melhor || x[campo] > melhor[campo])) melhor = x;
  return melhor;
}

function situacao(d, h) {
  if (!d.ehHoje) return 'passada';
  if (h > d.horaAtual) return 'futura';
  return h === d.horaAtual ? 'agora' : 'passada';
}

/* ---------------- Números do dia ---------------- */
function cardsHTML(d) {
  const t = d.totais;
  const doDia = d.ehHoje ? 'hoje' : 'no dia';
  const nenhum = d.ehHoje ? 'ainda' : 'neste dia';
  const pico = picoDe(d.horas, 'contas');
  const cards = [
    [`Acessos ${doDia}`, t.visitas, plural(t.paginas, 'página aberta', 'páginas abertas')],
    [`Cadastros ${doDia}`, t.cadastros, t.cadastros ? `${num(t.cadastrosGoogle)} com Google · ${num(t.cadastrosEmail)} com e-mail` : `nenhum ${nenhum}`],
    [`Contas ativas ${doDia}`, t.contas, pico ? `pico de ${num(pico.contas)} às ${pico.h}h` : `nenhuma ${nenhum}`]
  ];
  return cards.map(([rotulo, valor, sub]) => `<div class="ad-stat"><span class="ad-stat-rotulo">${esc(rotulo)}</span><strong class="ad-stat-valor">${num(valor)}</strong><span class="ad-stat-sub">${esc(sub)}</span></div>`).join('');
}

/* ---------------- Gráfico de colunas por hora (0h a 23h) ---------------- */
function graficoHTML(g, d) {
  const max = Math.max(0, ...d.horas.map((x) => x[g.campo]));
  const { topo, ticks } = escalaY(max);
  const pico = picoDe(d.horas, g.campo);
  const total = g.id === 'contas' ? d.totais.contas : d.horas.reduce((t, x) => t + x[g.campo], 0);
  const resumo = !pico
    ? `${g.titulo}: nada registrado neste dia.`
    : `${g.titulo}: ${g.id === 'contas' ? plural(total, 'conta diferente', 'contas diferentes') : plural(total, g.um, g.varios)} no dia. Mais movimento ${faixaHora(pico.h)}: ${num(pico[g.campo])}. Use as setas para ouvir cada hora; a tabela "hora a hora" tem todos os números.`;
  const grade = ticks.map((t) => `<span class="${t === 0 ? 'is-base' : ''}" style="bottom:${((t / topo) * 100).toFixed(2)}%"><i>${num(t)}</i></span>`).join('');
  const colunas = d.horas.map((x) => {
    const v = x[g.campo];
    const alt = v > 0 ? Math.max(1.5, (v / topo) * 100) : 0;
    const barra = v > 0 ? `<span class="ad-bar" style="height:${alt.toFixed(2)}%"></span>` : '';
    const valor = pico && x.h === pico.h ? `<span class="ad-bar-valor" style="bottom:calc(${alt.toFixed(2)}% + 4px)">${num(v)}</span>` : '';
    return `<div class="ad-col is-${situacao(d, x.h)}" data-h="${x.h}">${barra}${valor}</div>`;
  }).join('');
  const eixo = d.horas.map((x) => `<span class="${x.h % 6 === 0 ? 'x6' : x.h % 3 === 0 ? 'x3' : 'x1'} is-${situacao(d, x.h)}">${x.h % 3 === 0 ? `${x.h}h` : ''}</span>`).join('');
  const vazio = pico ? '' : `<p class="ad-graf-vazio">${d.ehHoje ? 'Nada registrado ainda hoje.' : 'Nada registrado neste dia.'}</p>`;
  return `<figcaption class="ad-graf-titulo"><strong>${esc(g.titulo)}</strong><span>${esc(g.sub)}</span></figcaption>
    <div class="ad-graf-plot" tabindex="0" role="img" aria-label="${esc(resumo)}" data-grafico-plot="${g.id}">
      <div class="ad-graf-area">
        <div class="ad-graf-grade" aria-hidden="true">${grade}</div>
        <div class="ad-graf-cols" aria-hidden="true">${colunas}</div>
        ${vazio}
      </div>
      <div class="ad-graf-x" aria-hidden="true">${eixo}</div>
      <div class="ad-graf-dica" aria-hidden="true" hidden></div>
    </div>
    <p class="ad-sr" aria-live="polite" data-grafico-fala="${g.id}"></p>`;
}

function dicaHTML(g, d, h) {
  const x = d.horas[h];
  const sit = situacao(d, h);
  if (sit === 'futura') return `<span>ainda não chegou</span><span class="dica-hora">${faixaHora(h)}</span>`;
  const v = x[g.campo];
  const extra = g.extra ? `<span>${esc(g.extra(x))}</span>` : '';
  return `<span><strong>${num(v)}</strong> ${esc(Number(v) === 1 ? g.um : g.varios)}</span>${extra}<span class="dica-hora">${faixaHora(h)}${sit === 'agora' ? ' · em andamento' : ''}</span>`;
}

/** Destaca a mesma hora nos três gráficos; a caixinha com os números aparece no gráfico em uso. */
function marcar(h, gid, { falar = false } = {}) {
  const secao = $('#adMov');
  if (!secao || !dados) return;
  horaMarcada = h;
  $$('.ad-col.is-marcada', secao).forEach((c) => c.classList.remove('is-marcada'));
  if (h !== null) $$(`.ad-col[data-h="${h}"]`, secao).forEach((c) => c.classList.add('is-marcada'));
  for (const g of GRAFICOS) {
    const plot = $(`[data-grafico-plot="${g.id}"]`, secao);
    if (!plot) continue;
    const dica = $('.ad-graf-dica', plot);
    if (h === null || g.id !== gid) { dica.hidden = true; continue; }
    dica.innerHTML = dicaHTML(g, dados, h);
    dica.hidden = false;
    const cols = $('.ad-graf-cols', plot).getBoundingClientRect();
    const caixa = plot.getBoundingClientRect();
    const centro = cols.left - caixa.left + ((h + 0.5) / 24) * cols.width;
    const largura = dica.offsetWidth;
    dica.style.left = `${Math.max(0, Math.min(centro - largura / 2, caixa.width - largura))}px`;
    if (falar) $(`[data-grafico-fala="${g.id}"]`, secao).textContent = `${g.titulo}, ${dica.textContent.replace(/\s+/g, ' ').trim()}`;
  }
}

function horaPadrao(gid) {
  if (dados.ehHoje) return dados.horaAtual;
  const g = GRAFICOS.find((x) => x.id === gid);
  return picoDe(dados.horas, g.campo)?.h ?? 12;
}

function horaDoPonteiro(plot, x) {
  const r = $('.ad-graf-cols', plot).getBoundingClientRect();
  if (!r.width) return null;
  const h = Math.floor(((x - r.left) / r.width) * 24);
  return h < 0 || h > 23 ? null : h;
}

function ligarGraficos() {
  for (const plot of $$('[data-grafico-plot]')) {
    const gid = plot.dataset.graficoPlot;
    plot.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const h = horaDoPonteiro(plot, e.clientX);
      if (h !== null) marcar(h, gid);
    });
    plot.addEventListener('pointerdown', (e) => {
      const h = horaDoPonteiro(plot, e.clientX);
      if (h !== null) marcar(h, gid);
    });
    plot.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && document.activeElement !== plot) marcar(null); });
    plot.addEventListener('focus', () => marcar(horaMarcada ?? horaPadrao(gid), gid, { falar: true }));
    // Indo para outro gráfico, a hora tocada nele continua valendo
    plot.addEventListener('blur', (e) => { if (!e.relatedTarget?.closest?.('[data-grafico-plot]')) marcar(null); });
    plot.addEventListener('keydown', (e) => {
      let h = horaMarcada ?? horaPadrao(gid);
      if (e.key === 'ArrowLeft') h = Math.max(0, h - 1);
      else if (e.key === 'ArrowRight') h = Math.min(23, h + 1);
      else if (e.key === 'Home') h = 0;
      else if (e.key === 'End') h = dados.ehHoje ? dados.horaAtual : 23;
      else if (e.key === 'Escape') { plot.blur(); return; }
      else return;
      e.preventDefault();
      marcar(h, gid, { falar: true });
    });
  }
}

/* ---------------- Tabela, origens e listas ---------------- */
function tabelaHTML(d) {
  const linhas = d.horas.map((x) => {
    const sit = situacao(d, x.h);
    const v = (n) => (sit === 'futura' ? '—' : num(n));
    return `<tr class="is-${sit}"><th scope="row">${x.h}h–${x.h + 1}h${sit === 'agora' ? ' <span class="ad-muted">(agora)</span>' : ''}</th>
      <td>${v(x.visitas)}</td><td>${v(x.paginas)}</td><td>${v(x.cadastros)}</td><td>${v(x.contas)}</td></tr>`;
  }).join('');
  const t = d.totais;
  return `${linhas}<tr class="ad-mov-total"><th scope="row">Total do dia</th><td>${num(t.visitas)}</td><td>${num(t.paginas)}</td><td>${num(t.cadastros)}</td><td>${num(t.contas)} <span class="ad-muted">diferentes</span></td></tr>`;
}

function origensHTML(d) {
  const total = d.origens.reduce((t, o) => t + o.visitas, 0);
  if (!total) return `<li class="ad-muted">${d.ehHoje ? 'Nenhum acesso registrado ainda hoje.' : 'Nenhum acesso registrado neste dia.'}</li>`;
  return d.origens.map((o) => {
    const parte = (o.visitas / total) * 100;
    const pct = parte > 0 && parte < 1 ? '<1%' : `${Math.round(parte)}%`;
    return `<li><span class="ad-orig-nome">${esc(NOME_ORIGEM[o.origem] || o.origem)}</span>
      <span class="ad-orig-num"><strong>${num(o.visitas)}</strong> · ${pct}</span>
      <span class="ad-orig-barra" aria-hidden="true"><i style="width:${Math.max(1.5, parte).toFixed(1)}%"></i></span></li>`;
  }).join('');
}

function cadastrosHTML(d) {
  if (!d.cadastros.length) return `<tr><td colspan="3" class="ad-muted">Nenhum cadastro ${d.ehHoje ? 'ainda hoje' : 'neste dia'}.</td></tr>`;
  return d.cadastros.map((c) => `<tr><td class="ad-nowrap">${horaMin(c.em)}</td>
      <td>${esc(c.nome || '—')}<br><span class="ad-muted">${esc(c.email)}</span></td>
      <td>${c.entrada === 'senha' ? 'E-mail e senha' : 'Google'}</td></tr>`).join('');
}

function contasHTML(d) {
  if (!d.contasAtivas.length) return `<tr><td colspan="3" class="ad-muted">Nenhuma conta ativa ${d.ehHoje ? 'ainda hoje' : 'neste dia'}.</td></tr>`;
  return d.contasAtivas.map((c) => `<tr><td>${esc(c.nome || '—')}<br><span class="ad-muted">${esc(c.email)}</span></td>
      <td class="ad-nowrap">${plural(c.horas, 'hora', 'horas')}</td>
      <td class="ad-nowrap">${c.ultima ? `${horaDe(c.ultima)}h` : '—'}</td></tr>`).join('');
}

function notaTexto(d) {
  if (d.semBanco) return 'O banco de dados não está ligado neste ambiente: os números aparecem no site publicado.';
  const partes = [];
  if (d.ehHoje) partes.push(`A hora atual (${d.horaAtual}h) ainda está em andamento.`);
  const inicio = d.contandoDesde?.acessos;
  if (!inicio) {
    partes.push('A contagem de acessos e de contas ativas começa com as próximas páginas abertas no site. Os cadastros têm todo o histórico.');
  } else {
    const diaInicio = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(inicio));
    const quando = `${dataBr(diaInicio)} às ${horaDe(inicio)}h`;
    if (d.dia < diaInicio) partes.push(`Neste dia ainda não havia contagem de acessos e de contas ativas: ela começou em ${quando}. Os cadastros têm todo o histórico.`);
    else if (d.dia === diaInicio) partes.push(`A contagem de acessos começou em ${quando}.`);
  }
  partes.push('Não entram na conta: a sua conta de admin, robôs de busca e de anúncios e testes automáticos.');
  return partes.join(' ');
}

/* ---------------- Desenho e carregamento ---------------- */
function desenhar(d) {
  const ontem = diaAnterior(d.hoje);
  $$('[data-mov-dia]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.movDia === 'hoje' ? d.dia === d.hoje : d.dia === ontem)));
  const campoDia = $('#adMovDia');
  campoDia.max = d.hoje;
  campoDia.value = d.dia;
  const semana = new Date(`${d.dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
  const atualizado = new Date(d.atualizadoEm).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
  $('#adMovSub').textContent = `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${dataBr(d.dia)} · horário de Brasília · atualizado às ${atualizado}${d.ehHoje ? ' (atualiza sozinho a cada minuto)' : ''}`;
  $('#adMovCards').innerHTML = cardsHTML(d);
  for (const g of GRAFICOS) $(`[data-grafico="${g.id}"]`).innerHTML = graficoHTML(g, d);
  horaMarcada = null;
  ligarGraficos();
  $('#adMovNota').textContent = notaTexto(d);
  $('#adMovHoras').innerHTML = tabelaHTML(d);
  $('#adMovOrigens').innerHTML = origensHTML(d);
  $('#adMovCadTitulo').textContent = `Cadastros ${d.ehHoje ? 'de hoje' : 'do dia'} (${num(d.totais.cadastros)})`;
  $('#adMovCadastros').innerHTML = cadastrosHTML(d);
  $('#adMovContasResumo').textContent = `Ver as contas ativas ${d.ehHoje ? 'hoje' : 'no dia'} (${num(d.totais.contas)})`;
  $('#adMovContas').innerHTML = contasHTML(d);
}

export async function carregarMovimento({ silencioso = false } = {}) {
  const secao = $('#adMov');
  if (!secao) return;
  const este = ++pedido;
  secao.classList.add('is-carregando');
  try {
    const res = await fetch(`/api/admin/metricas${diaPedido ? `?dia=${encodeURIComponent(diaPedido)}` : ''}`, { credentials: 'same-origin' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || `Erro ${res.status}`);
    if (este !== pedido) return; // chegou uma resposta mais nova
    dados = d;
    desenhar(d);
    $('#adMovAviso').hidden = true;
  } catch (err) {
    if (este !== pedido) return;
    const aviso = $('#adMovAviso');
    aviso.textContent = `Não foi possível carregar o movimento do dia: ${err.message}`;
    aviso.hidden = false;
    if (!silencioso) throw err;
  } finally {
    if (este === pedido) secao.classList.remove('is-carregando');
  }
}

const painelAberto = () => { const p = $('[data-panel="geral"]'); return Boolean(p && !p.hidden); };
const podeAtualizarSozinho = () => dados?.ehHoje && !diaPedido && painelAberto() && document.visibilityState === 'visible' && horaMarcada === null;

export function iniciarMovimento() {
  const secao = $('#adMov');
  if (!secao) return;
  $$('[data-mov-dia]', secao).forEach((b) => b.addEventListener('click', () => {
    diaPedido = b.dataset.movDia === 'ontem' ? diaAnterior(dados?.hoje || hojeEmBrasilia()) : '';
    carregarMovimento().catch(() => {});
  }));
  $('#adMovDia').addEventListener('change', (e) => {
    const v = e.target.value;
    diaPedido = v && v !== (dados?.hoje || hojeEmBrasilia()) ? v : '';
    carregarMovimento().catch(() => {});
  });
  $('#adMovAtualizar').addEventListener('click', () => carregarMovimento().catch(() => {}));
  // Toque fora dos gráficos esconde a caixinha (no celular ela fica até tocar em outro lugar)
  document.addEventListener('pointerdown', (e) => {
    if (horaMarcada !== null && !e.target.closest('[data-grafico-plot]')) marcar(null);
  });
  document.addEventListener('visibilitychange', () => { if (podeAtualizarSozinho()) carregarMovimento({ silencioso: true }); });
  clearInterval(relogio);
  relogio = setInterval(() => { if (podeAtualizarSozinho()) carregarMovimento({ silencioso: true }); }, 60_000);
}
