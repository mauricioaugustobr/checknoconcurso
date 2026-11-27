/**
 * Questão de exemplo grátis, sem cadastro (opção A da Designer UI/UX) — Check no Concurso.
 *
 * amostraHTML() desenha o bloco como texto HTML: o servidor usa nas páginas públicas
 * (/concurso/:id e /concursos/:uf, bom para o Google) e o navegador usa na página inicial.
 * ativarAmostras() liga as abas, a conferência da resposta e a medição no GA4
 * (só para quem aceitou os cookies). Nada aqui chama o servidor nem a IA.
 */
import { AMOSTRAS, amostraDaArea } from './data/amostras.js';

const ORDEM_ABAS = ['policia', 'tribunais', 'administrativa'];
const esc = (v) => String(v ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function questaoHTML(chave, uid) {
  const a = AMOSTRAS[chave];
  if (!a) return '';
  const fonte = [a.banca, a.ano, a.orgao, a.cargo, a.materia].filter(Boolean).map(esc).join(' · ');
  return `
      <p class="qx-src"><span>${fonte}</span>
        <a href="${esc(a.caderno)}" target="_blank" rel="noopener nofollow">Ver caderno oficial ↗<span class="qx-sr"> (abre em nova aba)</span></a></p>
      <form class="qx-form" data-amostra-form="${esc(chave)}" novalidate>
        <fieldset>
          <legend>Questão ${esc(a.numero)} · ${esc(a.materia)}</legend>
          <p class="qx-stem">${esc(a.enunciado)}</p>
          <div class="qx-alts">
            ${a.alternativas.map((alt) => `
            <label class="qx-alt" data-letra="${esc(alt.letra)}">
              <input type="radio" name="${uid}-${esc(chave)}" value="${esc(alt.letra)}" />
              <span class="qx-let" aria-hidden="true">${esc(alt.letra)}</span>
              <span class="qx-txt"><span class="qx-sr">Alternativa ${esc(alt.letra)}: </span>${esc(alt.texto)}</span>
              <span class="qx-mark" hidden></span>
            </label>`).join('')}
          </div>
        </fieldset>
        <div class="qx-actions">
          <button type="submit" class="qx-btn qx-btn-primary">Conferir resposta</button>
          <button type="button" class="qx-btn qx-btn-ghost" data-amostra-reset hidden>Responder de novo</button>
        </div>
        <p class="qx-hint" role="alert" data-amostra-hint></p>
        <div class="qx-result" data-amostra-result tabindex="-1" hidden>
          <div class="qx-verdict" data-amostra-verdict></div>
          <div class="qx-expl">
            <h3>Por que a resposta é ${esc(a.gabarito)}</h3>
            ${a.explicacao.map((p) => `<p>${esc(p)}</p>`).join('')}
            <p class="qx-ai">Explicação escrita com apoio de inteligência artificial, a partir do gabarito oficial.</p>
          </div>
        </div>
      </form>`;
}

/**
 * modo: 'inicial' (com abas), 'concurso' (sem abas, área do concurso) ou 'estado' (com abas).
 * areaCatalogo: área do concurso no catálogo (Policial, Tribunais, Administrativa, Fiscal...).
 */
export function amostraHTML({ modo = 'inicial', areaCatalogo = '', planosNaPagina = false, origem = '' } = {}) {
  // Página de concurso: os botões levam o concurso junto para a tela de planos (item 6)
  const comOrigem = /^[a-z0-9][a-z0-9-]{0,99}$/.test(origem) ? `&amp;origem=${origem}` : '';
  const uid = `qx-${modo}`;
  const comAbas = modo !== 'concurso';
  const atual = comAbas ? 'administrativa' : amostraDaArea(areaCatalogo);
  const a = AMOSTRAS[atual];
  const titulo = modo === 'inicial' ? 'Resolva 1 questão de prova real antes de assinar' : 'Treine com uma questão de prova anterior';
  const sub = modo === 'inicial'
    ? 'Escolha a alternativa, confira o gabarito oficial e leia a explicação. É assim em todas as questões do Check Completo.'
    : comAbas
      ? 'Questão oficial de prova anterior. Escolha a área, responda e veja o gabarito com a explicação.'
      : `Questão oficial de um concurso da área ${a.area}. Responda e veja o gabarito com a explicação.`;
  // Página inicial: botões abrem a assinatura ali mesmo. Páginas públicas: levam aos planos.
  const botoes = planosNaPagina
    ? `<button type="button" class="qx-btn qx-btn-gold" data-pick-plan="completo-mensal" data-amostra-cta="mensal">Assinar Completo · R$ 23,99/mês</button>
          <button type="button" class="qx-btn qx-btn-line" data-pick-plan="completo-anual" data-amostra-cta="anual">Assinar anual · R$ 199,90/ano</button>`
    : `<a class="qx-btn qx-btn-gold" href="/?assinar=completo-mensal${comOrigem}#planos" data-amostra-cta="mensal">Assinar Completo · R$ 23,99/mês</a>
          <a class="qx-btn qx-btn-line" href="/?assinar=completo-anual${comOrigem}#planos" data-amostra-cta="anual">Assinar anual · R$ 199,90/ano</a>`;
  return `
  <section class="qx" id="questao-exemplo" data-amostra="${esc(modo)}" aria-labelledby="${uid}-titulo">
    <div class="qx-in">
      <span class="qx-eyebrow">Grátis · sem cadastro</span>
      <h2 class="qx-title" id="${uid}-titulo">${esc(titulo)}</h2>
      <p class="qx-sub">${esc(sub)}</p>
      ${comAbas ? `<div class="qx-areas" role="group" aria-label="Área da questão">
        ${ORDEM_ABAS.map((k) => `<button type="button" data-amostra-area="${k}" aria-pressed="${k === atual}">${esc(AMOSTRAS[k].area)}</button>`).join('')}
      </div>` : ''}
      <div class="qx-body" data-amostra-body data-uid="${uid}">${questaoHTML(atual, uid)}</div>
    </div>
    <div class="qx-cta">
      <span class="qx-seal">Check Completo</span>
      <h3>Treine com as 6.058 questões oficiais, todas com explicação</h3>
      <p>Provas anteriores de 69 concursos, com gabarito oficial e explicação em 3 parágrafos em cada questão. Seu progresso fica salvo na conta.</p>
      <div class="qx-row">
          ${botoes}
      </div>
      <small>O anual sai por R$ 16,66/mês. O mensal não tem fidelidade.</small>
    </div>
  </section>`;
}

/* ---------------- Navegador ---------------- */
function medir(evento, params) {
  try {
    if (localStorage.getItem('cnc-cookies') !== 'aceito' || typeof window.gtag !== 'function') return;
    window.gtag('event', evento, params);
  } catch { /* sem medição */ }
}

function ligarFormulario(secao) {
  const form = secao.querySelector('[data-amostra-form]');
  if (!form || form.dataset.ligado) return;
  form.dataset.ligado = '1';
  const chave = form.dataset.amostraForm;
  const a = AMOSTRAS[chave];
  const hint = form.querySelector('[data-amostra-hint]');
  const result = form.querySelector('[data-amostra-result]');
  const verdict = form.querySelector('[data-amostra-verdict]');
  const btnConferir = form.querySelector('button[type="submit"]');
  const btnReset = form.querySelector('[data-amostra-reset]');
  const radios = [...form.querySelectorAll('input[type="radio"]')];

  form.addEventListener('change', () => { hint.textContent = ''; });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const marcada = radios.find((r) => r.checked);
    if (!marcada) {
      hint.textContent = 'Escolha uma alternativa antes de conferir.';
      radios[0]?.focus();
      return;
    }
    const acertou = marcada.value === a.gabarito;
    form.querySelectorAll('.qx-alt').forEach((alt) => {
      const letra = alt.dataset.letra;
      const mark = alt.querySelector('.qx-mark');
      alt.classList.toggle('is-right', letra === a.gabarito);
      alt.classList.toggle('is-wrong', letra === marcada.value && !acertou);
      if (letra === a.gabarito) { mark.textContent = '✓ Gabarito oficial'; mark.hidden = false; }
      else if (letra === marcada.value) { mark.textContent = '✗ Sua resposta'; mark.hidden = false; }
    });
    radios.forEach((r) => { r.disabled = true; });
    verdict.className = `qx-verdict ${acertou ? 'ok' : 'no'}`;
    verdict.innerHTML = acertou
      ? `<h3>Você acertou!</h3><p>Gabarito oficial: ${esc(a.gabarito)}</p>`
      : `<h3>Não foi dessa vez.</h3><p>Gabarito oficial: ${esc(a.gabarito)} · Você marcou ${esc(marcada.value)}</p>`;
    result.hidden = false;
    btnConferir.hidden = true;
    btnReset.hidden = false;
    result.focus({ preventScroll: false });
    medir('amostra_conferir', { area: chave, acertou, pagina: secao.dataset.amostra });
  });
  btnReset.addEventListener('click', () => {
    form.reset();
    radios.forEach((r) => { r.disabled = false; });
    form.querySelectorAll('.qx-alt').forEach((alt) => {
      alt.classList.remove('is-right', 'is-wrong');
      const mark = alt.querySelector('.qx-mark');
      mark.hidden = true;
      mark.textContent = '';
    });
    result.hidden = true;
    btnReset.hidden = true;
    btnConferir.hidden = false;
    hint.textContent = '';
    radios[0]?.focus();
  });
}

// Link "Ver exemplo de questão comentada" no cartão do Completo: rola até o bloco
function ligarAtalhos() {
  if (document.documentElement.dataset.amostraAtalhos) return;
  document.documentElement.dataset.amostraAtalhos = '1';
  document.addEventListener('click', (e) => {
    const ir = e.target.closest('[data-amostra-ir]');
    if (!ir) return;
    e.preventDefault();
    const alvo = document.getElementById('questao-exemplo');
    if (!alvo) return;
    alvo.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    alvo.querySelector('h2')?.setAttribute('tabindex', '-1');
    alvo.querySelector('h2')?.focus({ preventScroll: true });
    medir('amostra_atalho', {});
  });
}

export function ativarAmostras(raiz = document) {
  ligarAtalhos();
  raiz.querySelectorAll('[data-amostra]').forEach((secao) => {
    if (secao.dataset.ativo) return;
    secao.dataset.ativo = '1';
    ligarFormulario(secao);
    secao.querySelectorAll('[data-amostra-area]').forEach((aba) => {
      aba.addEventListener('click', () => {
        const chave = aba.dataset.amostraArea;
        secao.querySelectorAll('[data-amostra-area]').forEach((b) => b.setAttribute('aria-pressed', String(b === aba)));
        const corpo = secao.querySelector('[data-amostra-body]');
        corpo.innerHTML = questaoHTML(chave, corpo.dataset.uid);
        ligarFormulario(secao);
        medir('amostra_area', { area: chave, pagina: secao.dataset.amostra });
      });
    });
    secao.querySelectorAll('[data-amostra-cta]').forEach((b) => b.addEventListener('click', () => {
      medir('amostra_assinar', { plano: b.dataset.amostraCta, pagina: secao.dataset.amostra });
    }));
  });
}

if (typeof document !== 'undefined') {
  const iniciar = () => {
    // Página inicial: o bloco é desenhado aqui, logo abaixo dos cartões de plano
    const vaga = document.getElementById('amostraQuestaoSlot');
    if (vaga && !vaga.firstElementChild) vaga.innerHTML = amostraHTML({ modo: 'inicial', planosNaPagina: true });
    ativarAmostras();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
}
