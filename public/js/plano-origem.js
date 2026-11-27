/**
 * Item 6 · Tela de planos adaptada ao concurso de origem — Opção 1 da Designer UI/UX
 * ("faixa no topo + 1 linha em cada cartão").
 *
 * - Quem vem de /concurso/<id> chega em /?origem=<id>#planos. O id fica guardado nesta aba
 *   (sessionStorage) para sobreviver ao login, à página de pagamento e à volta da Stripe.
 * - A faixa "Você está vendo" e as linhas "No <SIGLA>: …" usam o resumo público do concurso
 *   (/api/concursos?tipo=resumo&c=<id>): os mesmos dados que a página pública já mostra.
 * - O ✕ tira o concurso e a tela volta a ser igual à de hoje.
 * - Depois do pagamento, a ficha do concurso mostra o aviso "Assinatura ativa" (avisoAssinaturaHTML).
 * Preços e botões dos cartões não mudam.
 */

const CHAVE = 'cnc-origem';
const VALIDADE_MS = 6 * 3600e3;
const ORIGEM_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const ddmm = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');
const ddmmaaaa = (iso) => (iso ? `${ddmm(iso)}/${iso.slice(0, 4)}` : '');

// CSS desta tela (carrega uma vez)
if (typeof document !== 'undefined' && !document.querySelector('link[data-plano-origem-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/css/plano-origem.css?v=2';
  link.dataset.planoOrigemCss = '';
  document.head.appendChild(link);
}

/* ---------------- Origem guardada nesta aba ---------------- */
export function lerOrigem(params = new URLSearchParams(window.location.search)) {
  const daUrl = params.get('origem');
  if (daUrl && ORIGEM_RE.test(daUrl)) {
    try { sessionStorage.setItem(CHAVE, JSON.stringify({ id: daUrl, em: Date.now() })); } catch { /* aba privada */ }
    return daUrl;
  }
  try {
    const salvo = JSON.parse(sessionStorage.getItem(CHAVE) || 'null');
    if (salvo && ORIGEM_RE.test(salvo.id) && Date.now() - salvo.em < VALIDADE_MS) return salvo.id;
  } catch { /* sem origem */ }
  return null;
}

export function limparOrigem() {
  try { sessionStorage.removeItem(CHAVE); } catch { /* nada */ }
  const url = new URL(window.location.href);
  if (url.searchParams.has('origem')) {
    url.searchParams.delete('origem');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
}

/* ---------------- Resumo público do concurso ---------------- */
const cacheResumo = new Map();
export function buscarResumo(id) {
  if (!id || !ORIGEM_RE.test(id)) return Promise.resolve(null);
  if (!cacheResumo.has(id)) {
    cacheResumo.set(id, fetch(`/api/concursos?tipo=resumo&c=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && d.sigla ? d : null))
      .catch(() => null));
  }
  return cacheResumo.get(id);
}

/* ---------------- Textos (iguais aos da Designer) ---------------- */
function linhaEssencial(r) {
  return `<strong>No ${esc(r.sigla)}:</strong> datas de inscrição e prova, edital oficial e alerta quando algo mudar.`;
}

function linhaCompleto(r) {
  if (!r.temProvaPropria) {
    return `<strong>No ${esc(r.sigla)}:</strong> tudo do Essencial. Ainda não há prova anterior deste concurso. O treino do Completo usa provas de outros concursos.`;
  }
  // Tem a prova anterior do próprio concurso; quando há outras da mesma área, elas entram também
  const propria = `a prova anterior do ${esc(r.sigla)}${r.anoProva ? ` (${esc(r.anoProva)})` : ''}`;
  const treino = r.provasNaArea > 1 && r.area
    ? `provas anteriores da área ${esc(r.area)}, incluindo ${propria}`
    : propria;
  return `<strong>No ${esc(r.sigla)}:</strong> tudo do Essencial + treinar com ${treino}, com explicação.`;
}

function faixaHTML(r) {
  const chips = [
    r.status ? `<span class="po-chip${r.status === 'Inscrições Abertas' ? ' is-open' : ''}">${esc(r.status)}</span>` : '',
    r.inscricaoFim ? `<span class="po-chip">Inscrições até ${esc(ddmm(r.inscricaoFim))}</span>` : '',
    r.dataProva ? `<span class="po-chip">Prova em ${esc(ddmmaaaa(r.dataProva))}</span>` : ''
  ].join('');
  return `
    <div class="po-info">
      <p class="po-eyebrow">Você está vendo</p>
      <p class="po-titulo">${esc(r.sigla)}${r.cargo ? ` · ${esc(r.cargo)}` : ''}</p>
      ${chips ? `<div class="po-chips">${chips}</div>` : ''}
      ${r.temProvaPropria ? '' : '<p class="po-nota">Este concurso ainda não tem prova anterior no Check no Concurso. Para acompanhá-lo, o Essencial já cobre o que você precisa.</p>'}
    </div>
    <div class="po-acoes">
      <a class="po-voltar" href="/concurso/${encodeURIComponent(r.id)}"><span aria-hidden="true">←</span> Voltar ao ${esc(r.sigla)}</a>
      <button type="button" class="po-x" data-origem-fechar aria-label="Tirar o ${esc(r.sigla)} desta tela"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
    </div>`;
}

/* ---------------- Tela de planos ---------------- */
function desmontar() {
  const faixa = document.getElementById('planoOrigem');
  if (faixa) { faixa.hidden = true; faixa.innerHTML = ''; delete faixa.dataset.id; }
  document.querySelectorAll('[data-origem-linha]').forEach((el) => { el.hidden = true; el.innerHTML = ''; });
  document.querySelectorAll('[data-origem-selo]').forEach((el) => { el.hidden = true; });
  document.querySelector('.plans-grid.two-plans')?.classList.remove('is-origem-sem-prova');
}

let ligado = false;
function ligarFechar() {
  if (ligado) return;
  ligado = true;
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-origem-fechar]')) return;
    limparOrigem();
    desmontar();
    document.querySelector('#view-plano h2')?.setAttribute('tabindex', '-1');
    document.querySelector('#view-plano h2')?.focus({ preventScroll: true });
  });
}

/** Desenha (ou tira) a faixa e as linhas. Pode ser chamada a cada vez que a tela de planos abre. */
export async function montarFaixaOrigem() {
  const faixa = document.getElementById('planoOrigem');
  if (!faixa) return null;
  ligarFechar();
  const id = lerOrigem();
  if (!id) { desmontar(); return null; }
  if (faixa.dataset.id === id && !faixa.hidden) return id;
  const r = await buscarResumo(id);
  if (!r || lerOrigem() !== id) { if (!r) desmontar(); return null; }
  faixa.innerHTML = faixaHTML(r);
  faixa.setAttribute('aria-label', `Concurso que você está vendo: ${r.sigla}`);
  faixa.dataset.id = id;
  faixa.hidden = false;
  const ess = document.querySelector('[data-origem-linha="essencial"]');
  const comp = document.querySelector('[data-origem-linha="completo"]');
  if (ess) { ess.innerHTML = linhaEssencial(r); ess.hidden = false; }
  if (comp) { comp.innerHTML = linhaCompleto(r); comp.hidden = false; }
  // Sem prova anterior: o Essencial vira o cartão em destaque
  const semProva = !r.temProvaPropria;
  document.querySelector('.plans-grid.two-plans')?.classList.toggle('is-origem-sem-prova', semProva);
  document.querySelectorAll('[data-origem-selo]').forEach((el) => { el.hidden = !semProva; });
  return id;
}

/* ---------------- Aviso depois do pagamento (topo da ficha do concurso) ---------------- */
export function avisoAssinaturaHTML(r, { completo = false } = {}) {
  if (!r) return '';
  const area = r.provasNaArea > 0 && r.area ? ` da área ${esc(r.area)}` : '';
  const texto = completo
    ? `Check Completo liberado. Você já vê as datas, o edital e os alertas do ${esc(r.sigla)}, e pode treinar com provas anteriores${area}.`
    : `Check Essencial liberado. Você já vê as datas, o edital e os alertas do ${esc(r.sigla)}.`;
  const treinar = completo && r.temProvaPropria
    ? `<a class="po-aviso-btn" href="/prova.html?c=${encodeURIComponent(r.id)}">Treinar com prova anterior</a>`
    : '';
  return `
    <div class="po-aviso" role="status">
      <span class="po-aviso-ck" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span>
      <div class="po-aviso-txt">
        <h3 class="po-aviso-titulo" tabindex="-1">Assinatura ativa. Este é o seu concurso.</h3>
        <p>${texto}</p>
        ${treinar}
      </div>
      <button type="button" class="po-aviso-x" data-aviso-fechar aria-label="Fechar aviso"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
    </div>`;
}
