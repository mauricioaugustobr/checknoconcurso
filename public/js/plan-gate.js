/**
 * Tela "Escolha seu plano" (Designer UI/UX) — aparece no #planGate quando a pessoa não tem plano.
 * Uso (app.js): montarTelaPlano({ user, onChoose, onLogin, onLogout })
 *  - user: state.user ou null
 *  - onChoose(plano): 'essencial' | 'completo-mensal' | 'completo-anual'
 * Pode ser chamada a cada renderização: monta uma vez e depois só atualiza a linha da conta.
 * Não liga nem desliga a trava: quem mostra/esconde o #planGate é o app.js.
 */
import { PLANOS } from './data/site-info.js';

const CSS_HREF = '/css/plan-gate.css?v=2';
if (typeof document !== 'undefined' && !document.querySelector('link[data-plan-gate-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  link.dataset.planGateCss = '';
  document.head.appendChild(link);
}

const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ESSENCIAL = PLANOS.essencial;
const MENSAL = PLANOS.completoMensal;
const ANUAL = PLANOS.completoAnual;

// Escolha atual (fica guardada entre renderizações)
let escolha = 'essencial'; // 'essencial' | 'completo'
let ciclo = 'mensal'; // 'mensal' | 'anual' (só para o Completo)
let handlers = {};

const CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
const ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
const li = (t) => `<li>${CHECK}<span>${t}</span></li>`;

function planoEscolhido() {
  if (escolha === 'essencial') return { id: ESSENCIAL.id, nome: 'Assinar Essencial', preco: ESSENCIAL.rotuloPreco };
  if (ciclo === 'anual') return { id: ANUAL.id, nome: 'Assinar Completo anual', preco: ANUAL.rotuloPreco };
  return { id: MENSAL.id, nome: 'Assinar Completo', preco: MENSAL.rotuloPreco };
}

function template() {
  return `
    <p class="cnc-gate-kicker">Só para assinantes</p>
    <h2 class="cnc-gate-title" id="cncGateTitle">Escolha seu plano para começar</h2>
    <p class="cnc-gate-sub">Os dois planos dão acesso a todos os concursos do Brasil. O Completo inclui o treino com provas anteriores.</p>

    <div class="cnc-plans" role="radiogroup" aria-labelledby="cncGateTitle">
      <div class="cnc-plan" data-plan="essencial">
        <label class="cnc-plan-main">
          <input type="radio" name="cncPlano" value="essencial">
          <span class="cnc-radio" aria-hidden="true"></span>
          <span class="cnc-plan-head">
            <span class="cnc-plan-name">Essencial</span>
            <span class="cnc-plan-price"><strong>${esc(brl(ESSENCIAL.preco))}</strong><small>/mês</small></span>
          </span>
          <ul class="cnc-plan-list">
            ${li('Todos os concursos abertos e encerrados, com busca e filtros')}
            ${li('Datas de prova, prazos, salários, vagas e taxas')}
            ${li('Editais com Raio-X e alertas quando a data muda')}
            ${li('Comparador de cursos e concursos salvos')}
          </ul>
        </label>
      </div>

      <div class="cnc-plan" data-plan="completo">
        <label class="cnc-plan-main">
          <input type="radio" name="cncPlano" value="completo">
          <span class="cnc-radio" aria-hidden="true"></span>
          <span class="cnc-plan-head">
            <span class="cnc-plan-name">Completo <span class="cnc-tag">+ treino</span></span>
            <span class="cnc-plan-price" data-preco-completo></span>
          </span>
          <ul class="cnc-plan-list">
            ${li('<strong>Tudo do Essencial</strong>')}
            ${li('Treino com questões de provas anteriores, para concursos que já tiveram edições anteriores')}
            ${li('Resposta certa e explicação em 3 parágrafos em cada questão')}
          </ul>
        </label>
        <fieldset class="cnc-ciclo">
          <legend class="cnc-sr">Forma de pagamento do Completo</legend>
          <label><input type="radio" name="cncCiclo" value="mensal"><span>Mensal · ${esc(brl(MENSAL.preco))}</span></label>
          <label><input type="radio" name="cncCiclo" value="anual"><span>Anual · ${esc(brl(ANUAL.preco))} <em>economize ${esc(brl(ANUAL.economiaAnual))}</em></span></label>
        </fieldset>
      </div>
    </div>

    <button type="button" class="cnc-gate-cta" data-gate-cta><span class="cnc-cta-label" data-gate-cta-label></span>${ARROW}</button>
    <p class="cnc-gate-safe">Cancele quando quiser · Pix ou cartão</p>
    <p class="cnc-gate-account" data-gate-account></p>`;
}

function atualizarEscolha(root) {
  root.querySelectorAll('.cnc-plan').forEach((el) => el.classList.toggle('is-on', el.dataset.plan === escolha));
  root.querySelector(`input[name="cncPlano"][value="${escolha}"]`).checked = true;
  root.querySelector(`input[name="cncCiclo"][value="${ciclo}"]`).checked = true;
  root.querySelector('[data-preco-completo]').innerHTML = ciclo === 'anual'
    ? `<strong>${esc(brl(ANUAL.preco))}</strong><small>/ano</small><span class="cnc-equiv">${esc(brl(ANUAL.equivalenteMensal))}/mês</span>`
    : `<strong>${esc(brl(MENSAL.preco))}</strong><small>/mês</small>`;
  const p = planoEscolhido();
  root.querySelector('[data-gate-cta]').setAttribute('aria-label', `${p.nome}, ${p.preco}`);
  root.querySelector('[data-gate-cta-label]').innerHTML = `<span class="cnc-cta-nome">${esc(p.nome)}</span><span class="cnc-cta-preco"><span aria-hidden="true"> · </span>${esc(p.preco)}</span>`;
}

function atualizarConta(root, user) {
  const conta = root.querySelector('[data-gate-account]');
  if (user) {
    const nome = user.name || user.nome || user.email || 'sua conta';
    conta.innerHTML = `Conectado como <strong>${esc(nome)}</strong> · <button type="button" class="cnc-link" data-gate-logout>Sair</button>`;
  } else {
    conta.innerHTML = 'Já assina? <button type="button" class="cnc-link" data-gate-login>Entrar</button>';
  }
}

function ligarEventos(root) {
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'cncPlano') escolha = t.value;
    if (t.name === 'cncCiclo') { ciclo = t.value; escolha = 'completo'; }
    atualizarEscolha(root);
  });
  root.addEventListener('click', (e) => {
    // Tocar em "Mensal"/"Anual" já marcado não gera "change": seleciona o Completo mesmo assim
    if (e.target.matches?.('input[name="cncCiclo"]')) { ciclo = e.target.value; escolha = 'completo'; atualizarEscolha(root); return; }
    if (e.target.closest('[data-gate-cta]')) handlers.onChoose?.(planoEscolhido().id);
    else if (e.target.closest('[data-gate-login]')) handlers.onLogin?.();
    else if (e.target.closest('[data-gate-logout]')) handlers.onLogout?.();
  });
}

export function montarTelaPlano({ user = null, onChoose, onLogin, onLogout } = {}) {
  const root = document.getElementById('planGate');
  if (!root) return;
  handlers = { onChoose, onLogin, onLogout };
  if (root.dataset.cncGate !== '1') {
    root.className = 'cnc-gate';
    root.setAttribute('aria-labelledby', 'cncGateTitle');
    root.setAttribute('role', 'region');
    root.innerHTML = template();
    ligarEventos(root);
    root.dataset.cncGate = '1';
  }
  atualizarEscolha(root);
  atualizarConta(root, user);
}
