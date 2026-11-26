import { CONCURSOS, PLATAFORMAS_PARCEIRAS, REGIOES_BRASIL, PLANOS, MARCA, ESTADOS_BRASIL } from './data/concursos.js';
import { scoreConcurso, SEARCH_SUGGESTIONS } from './search.js?v=3';

const STORAGE_KEY = 'check_no_concurso_state_v3';
const TODAY_ISO = '2026-11-24';

const DEFAULT_STATE = {
  tier: 'guest', // 'guest' | 'essencial' | 'completo-mensal' | 'completo-anual'
  subMethod: null,
  subSince: null,
  user: null, // { name, email, provider } — simulado; produção usa Supabase Auth
  savedIds: ['pm-sp-soldado-2026', 'tj-sp-2026'],
  alertIds: ['pm-sp-soldado-2026', 'tj-sp-2026'],
  prefs: {
    uf: 'TODOS',
    escolaridade: 'TODAS',
    area: 'TODAS',
    alertWhatsapp: true,
    alertNovos: true
  }
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      prefs: { ...DEFAULT_STATE.prefs, ...(parsed.prefs || {}) }
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

let state = loadState();
let catalog = [...CONCURSOS];
let activeView = 'concursos';
let activeDetailId = null;
let activeDetailTab = 'geral';
let billingCycle = 'mensal'; // 'mensal' | 'anual'
let selectedCheckoutPlan = 'essencial';
let deferredInstallPrompt = null;
let toastTimer = null;
let pushTimer = null;
const PAGE_SIZE = 24;
let visibleConcursosLimit = PAGE_SIZE;
let visibleCoursesLimit = PAGE_SIZE;

const filters = {
  q: '',
  regiao: 'TODAS',
  uf: 'TODOS',
  esfera: 'TODAS',
  area: 'TODAS',
  escolaridade: 'TODAS',
  status: 'ATIVOS',
  minSalario: 0,
  onlyUrgent: false,
  sort: 'destaque',
  quick: null
};

const courseFilters = {
  platform: 'TODAS',
  area: 'TODAS',
  sort: 'menor-preco'
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

function hasEssencial() {
  return state.tier === 'essencial' || state.tier === 'completo-mensal' || state.tier === 'completo-anual';
}

function hasCompleto() {
  return state.tier === 'completo-mensal' || state.tier === 'completo-anual';
}

function isEditalUnlocked(concurso) {
  return hasEssencial() || Boolean(concurso.destaqueGratuito);
}

function getPlanMeta(planId) {
  if (planId === 'completo-anual') return PLANOS.completoAnual;
  if (planId === 'completo-mensal') return PLANOS.completoMensal;
  return PLANOS.essencial;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatBRL(value) {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatDateBR(isoDate) {
  if (!isoDate) return 'A definir';
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const now = new Date(`${TODAY_ISO}T12:00:00`);
  const target = new Date(`${isoDate}T12:00:00`);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function formatVagasLabel(c) {
  if (c.vagas === 0 && c.vagasCR > 0) return 'Cadastro de Reserva';
  if (c.vagas > 0 && c.vagasCR > 0) return `${c.vagas.toLocaleString('pt-BR')} + CR`;
  return `${c.vagas.toLocaleString('pt-BR')}`;
}

function statusBadgeClass(status) {
  if (status === 'Inscrições Abertas') return 'badge-emerald';
  if (status === 'Edital Publicado') return 'badge-blue';
  if (status === 'Prova Agendada') return 'badge-purple';
  if (status === 'Encerrado') return 'badge-closed';
  return 'badge-gold';
}

function showToast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3600);
}

function showPushNotification(message) {
  const banner = $('#pushBanner');
  const textEl = $('#pushText');
  if (!banner || !textEl) return;
  textEl.textContent = message;
  banner.hidden = false;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    banner.hidden = true;
  }, 5500);
}

function platformColor(platformId) {
  const found = PLATAFORMAS_PARCEIRAS.find((p) => p.id === platformId);
  return found ? found.cor : '#0C4F83';
}

/* ======================================================
   INITIALIZATION & API HYDRATION
   ====================================================== */
async function hydrateFromApi() {
  try {
    const res = await fetch('/api/concursos');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        catalog = data.items;
      }
    }
  } catch {
    // Fallback to static ES module catalog
  }
}

function detectAppMode() {
  const params = new URLSearchParams(window.location.search);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (params.get('app') === '1' || isStandalone) {
    document.body.classList.add('app-mode');
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

function populateSelects() {
  const ufs = [...new Set(catalog.map((c) => c.uf))].sort((a, b) => {
    if (a === 'Nacional') return -1;
    if (b === 'Nacional') return 1;
    return a.localeCompare(b);
  });
  const areas = [...new Set(catalog.map((c) => c.area))].sort((a, b) => a.localeCompare(b));

  const ufOptions = `<option value="TODOS">Todos os estados (27 UFs)</option>` +
    ufs.map((uf) => {
      const countUf = catalog.filter((c) => c.uf === uf && c.status !== 'Encerrado').length;
      const nomeEstado = ESTADOS_BRASIL[uf]?.nome;
      const label = uf === 'Nacional'
        ? `Nacional (Todo o Brasil · ${countUf})`
        : (nomeEstado ? `${uf} — ${nomeEstado} (${countUf})` : `${uf} (${countUf})`);
      return `<option value="${escapeHtml(uf)}">${escapeHtml(label)}</option>`;
    }).join('');
  $('#filterUf').innerHTML = ufOptions;
  $('#prefUf').innerHTML = ufOptions;

  const areaOptions = `<option value="TODAS">Todas as áreas</option>` +
    areas.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join('');
  $('#filterArea').innerHTML = areaOptions;
  $('#courseFilterArea').innerHTML = areaOptions;
  $('#prefArea').innerHTML = areaOptions;

  $('#courseFilterPlatform').innerHTML = `<option value="TODAS">Todas as plataformas</option>` +
    PLATAFORMAS_PARCEIRAS.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)}</option>`).join('');

  $('#partnersRow').innerHTML = PLATAFORMAS_PARCEIRAS.map((p) => `
    <div class="partner-pill">
      <span class="partner-dot" style="background:${escapeHtml(p.cor)}"></span>
      <span>${escapeHtml(p.nome)}</span>
    </div>
  `).join('');

  $('#prefUf').value = state.prefs.uf;
  $('#prefEscolaridade').value = state.prefs.escolaridade;
  $('#prefArea').value = state.prefs.area;
  $('#prefAlertWhatsapp').checked = Boolean(state.prefs.alertWhatsapp);
  $('#prefAlertNovos').checked = Boolean(state.prefs.alertNovos);
}

/* ======================================================
   RENDERING — HERO, AUTH, BILLING & CONCURSOS
   ====================================================== */
function renderHeroStats() {
  const ativos = catalog.filter((c) => c.status !== 'Encerrado');
  const encerrados = catalog.filter((c) => c.status === 'Encerrado');
  const totalVagas = ativos.reduce((sum, c) => sum + c.vagas, 0);
  const maiorSalario = Math.max(...ativos.map((c) => c.salarioMax));
  const totalProvas = catalog.reduce((sum, c) => sum + c.provasAnteriores.length, 0);

  $('#statVagas').textContent = totalVagas.toLocaleString('pt-BR');
  $('#statConcursos').textContent = `${ativos.length} + ${encerrados.length}`;
  $('#statMaiorSalario').textContent = formatBRL(maiorSalario).replace(',00', '');
  $('#statProvas').textContent = `${totalProvas.toLocaleString('pt-BR')} provas`;
}

function renderBillingCycleUI() {
  const isAnual = billingCycle === 'anual';
  $('#billMonthlyBtn').classList.toggle('active', !isAnual);
  $('#billAnnualBtn').classList.toggle('active', isAnual);

  if (isAnual) {
    $('#completoPlanPrice').innerHTML = `<strong>R$ 199,90</strong><span>/ano</span>`;
    $('#completoPlanSubnote').innerHTML = `Equivale a <strong>R$ 16,66/mês</strong> — economize <strong>R$ 15,98</strong> por ano vs. mensal`;
    $('#subCompletoBtn').dataset.pickPlan = 'completo-anual';
    if (!hasCompleto()) {
      $('#subCompletoBtn').textContent = 'Assinar Completo Anual · R$ 199,90/ano';
    }
  } else {
    $('#completoPlanPrice').innerHTML = `<strong>R$ 17,99</strong><span>/mês</span>`;
    $('#completoPlanSubnote').innerHTML = `Ou <strong>R$ 199,90/ano</strong> (equivale a R$ 16,66/mês — economize R$ 15,98)`;
    $('#subCompletoBtn').dataset.pickPlan = 'completo-mensal';
    if (!hasCompleto()) {
      $('#subCompletoBtn').textContent = 'Assinar Completo · R$ 17,99/mês';
    }
  }
}

function renderAuthUI() {
  $('#simGuestBtn').classList.toggle('active', state.tier === 'guest');
  $('#simEssencialBtn').classList.toggle('active', state.tier === 'essencial');
  $('#simCompletoBtn').classList.toggle('active', hasCompleto());

  const headerCta = $('#headerCtaBtn');
  const heroBtn = $('#heroSubscribeBtn');
  const heroPricePill = $('#heroPricePill');
  const upgradeStrip = $('#upgradeStrip');
  const activePlanBanner = $('#activePlanBanner');
  const subEssencialBtn = $('#subEssencialBtn');
  const subCompletoBtn = $('#subCompletoBtn');

  if (hasCompleto()) {
    const planLabel = state.tier === 'completo-anual' ? 'Check Completo Anual (R$ 199,90/ano)' : 'Check Completo (R$ 17,99/mês)';
    headerCta.innerHTML = '<span class="cta-label">Check Completo ✓</span>';
    headerCta.classList.add('is-pro');
    heroPricePill.textContent = 'Plano Completo Ativo ✓';
    heroBtn.textContent = 'Acesso Total Ativo · Ver Meus Salvos';
    upgradeStrip.hidden = true;
    activePlanBanner.hidden = false;
    $('#activePlanHeading').textContent = `Assinatura ativa: ${planLabel}`;
    const methodLabel = state.subMethod ? ` via ${state.subMethod}` : '';
    const dateLabel = state.subSince ? ` desde ${formatDateBR(state.subSince)}` : '';
    $('#activePlanDetails').textContent = `Acesso total${methodLabel}${dateLabel}: concursos, editais, cursos + 5 provas anteriores liberadas.`;
    subEssencialBtn.textContent = 'Incluído no seu Plano Completo ✓';
    subEssencialBtn.disabled = true;
    subCompletoBtn.textContent = 'Seu Plano Atual ✓';
    subCompletoBtn.disabled = true;
  } else if (state.tier === 'essencial') {
    headerCta.innerHTML = `<span class="cta-label">Liberar provas</span>${CTA_ARROW_SVG}`;
    headerCta.classList.remove('is-pro');
    heroPricePill.textContent = 'Essencial (R$ 6,99) Ativo';
    heroBtn.textContent = 'Fazer Upgrade para 5 Provas (R$ 17,99)';
    upgradeStrip.hidden = false;
    activePlanBanner.hidden = false;
    $('#activePlanHeading').textContent = 'Assinatura ativa: Check Essencial (R$ 6,99/mês)';
    const methodLabel = state.subMethod ? ` via ${state.subMethod}` : '';
    const dateLabel = state.subSince ? ` desde ${formatDateBR(state.subSince)}` : '';
    $('#activePlanDetails').textContent = `Editais, datas de prova e cursos liberados${methodLabel}${dateLabel}. Faça upgrade para o Completo para liberar as 5 provas anteriores.`;
    subEssencialBtn.textContent = 'Seu Plano Atual ✓ (R$ 6,99/mês)';
    subEssencialBtn.disabled = true;
    subCompletoBtn.disabled = false;
    renderBillingCycleUI();
  } else {
    headerCta.innerHTML = `<span class="cta-label">Assinar<span class="cta-label-extra"> agora</span></span>${CTA_ARROW_SVG}`;
    headerCta.classList.remove('is-pro');
    heroPricePill.textContent = 'A partir de R$ 6,99/mês';
    heroBtn.textContent = 'Assinar agora · a partir de R$ 6,99';
    upgradeStrip.hidden = false;
    activePlanBanner.hidden = true;
    subEssencialBtn.textContent = 'Assinar Essencial · R$ 6,99/mês';
    subEssencialBtn.disabled = false;
    subCompletoBtn.disabled = false;
    renderBillingCycleUI();
  }

  $('#navSavedCount').textContent = String(state.savedIds.length);
  $('#mobileSavedDot').hidden = state.savedIds.length === 0;
  const freeBox = $('#freeAccessBox');
  if (freeBox) freeBox.hidden = hasEssencial();
  renderAccountUI();
}

/* ======================================================
   LOGIN / CONTA (simulado em localStorage no protótipo)
   ====================================================== */
const CTA_ARROW_SVG = '<svg class="cta-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
let authMode = 'login'; // 'login' | 'signup'
let authReturnFocus = null;

function userInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// ADMIN: papel definido pelo servidor (lista ADMIN_EMAILS na Vercel). Libera todos os planos sem pagar.
function applyServerRole(u) {
  const isAdmin = Boolean(u && u.role === 'admin');
  if (state.user) state.user.role = isAdmin ? 'admin' : 'user';
  if (isAdmin && !state.adminGranted) {
    state.tierBeforeAdmin = state.tier;
    state.tier = 'completo-anual';
    state.adminGranted = true;
  } else if (!isAdmin && state.adminGranted) {
    state.tier = state.tierBeforeAdmin || 'guest';
    state.adminGranted = false;
  }
  // Pagamentos reais (Stripe): o plano vem só do servidor, nunca da simulação
  if (!isAdmin && stripeOn()) {
    if (u && u.plan) {
      state.tier = u.plan;
      state.paidGranted = true;
      state.subMethod = u.planMethod;
      state.planInfo = { status: u.planStatus, renovaEm: u.planRenewsAt, cancelaNoFim: u.planCancelAtPeriodEnd };
    } else if (state.paidGranted || (u && u.email)) {
      state.tier = 'guest';
      state.paidGranted = false;
      state.planInfo = null;
    }
  }
}

function stripeOn() {
  return Boolean(window.__cncConfig && window.__cncConfig.stripeEnabled);
}

async function stripePost(acao, body = {}) {
  const res = await fetch(`/api/stripe/${acao}`, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Não foi possível falar com o pagamento agora.');
  return data;
}

// Leva para a página de pagamento segura da Stripe
async function startStripeCheckout(plan) {
  showToast('Abrindo o pagamento seguro da Stripe…');
  try {
    const { url } = await stripePost('checkout', { plan });
    window.location.href = url;
  } catch (err) {
    showToast(err.message);
  }
}

async function openStripePortal() {
  try {
    const { url } = await stripePost('portal');
    window.location.href = url;
  } catch (err) {
    showToast(err.message);
  }
}

// Volta da Stripe: confirma a assinatura e libera o plano na hora
async function handleStripeReturn(params) {
  const status = params.get('assinatura');
  if (!status) return;
  const limpar = () => history.replaceState(null, '', window.location.pathname);
  if (status === 'cancelada') { showToast('Pagamento não concluído. Você pode assinar quando quiser.'); limpar(); return; }
  if (status === 'gerenciada') { limpar(); return; }
  if (status === 'sucesso' && params.get('session_id')) {
    try {
      showToast('Confirmando seu pagamento…');
      let r = { ativo: false };
      // O aviso da Stripe pode levar alguns segundos: tenta por até ~25 segundos
      for (let i = 0; i < 10 && !r.ativo; i++) {
        r = await stripePost('confirm', { session_id: params.get('session_id') });
        if (!r.ativo) await new Promise((ok) => setTimeout(ok, 2500));
      }
      if (r.ativo) {
        state.tier = r.plan;
        state.paidGranted = true;
        saveState();
        renderAll();
        showToast(`Assinatura ativa: ${getPlanMeta(r.plan).nome}. Bons estudos!`);
      } else {
        showToast('Pagamento recebido. A liberação pode levar alguns segundos — atualize a página.');
      }
    } catch (err) {
      showToast(err.message);
    }
    limpar();
  }
}

function planTagLabel() {
  if (state.user && state.user.role === 'admin') return 'Admin · acesso total';
  if (state.tier === 'completo-anual') return 'Check Completo Anual';
  if (state.tier === 'completo-mensal') return 'Check Completo';
  if (state.tier === 'essencial') return 'Check Essencial';
  return 'Plano Visitante';
}

function renderAccountUI() {
  const user = state.user;
  $('#headerLoginBtn').hidden = Boolean(user);
  $('#accountWrap').hidden = !user;
  $('#mobileAccountLabel').textContent = user ? 'Conta' : 'Entrar';
  const freeSignup = $('#freeSignupBtn');
  if (freeSignup) freeSignup.hidden = Boolean(user);
  if (!user) return;
  const firstName = user.name.split(/\s+/)[0];
  $('#accountAvatar').textContent = userInitials(user.name);
  $('#accountChipName').textContent = firstName;
  $('#accountMenuName').textContent = user.name;
  $('#accountMenuEmail').textContent = user.email;
  const tag = $('#accountMenuPlan');
  tag.textContent = planTagLabel();
  tag.classList.toggle('is-completo', hasCompleto());
  tag.classList.toggle('is-essencial', state.tier === 'essencial');
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === 'signup';
  $$('.auth-tab').forEach((tab) => {
    const on = tab.dataset.authMode === mode;
    tab.classList.toggle('active', on);
    tab.setAttribute('aria-selected', String(on));
  });
  $('#authTitle').textContent = isSignup ? 'Crie sua conta grátis' : 'Que bom te ver de novo';
  $('#authSub').textContent = isSignup
    ? 'Leva 30 segundos. Salve concursos e receba alertas de mudança de data.'
    : 'Entre para ver seus concursos salvos e alertas.';
  $('#authNameField').hidden = !isSignup;
  $('#forgotPasswordBtn').hidden = isSignup;
  $('#authRememberRow').hidden = isSignup;
  $('#authLegal').hidden = !isSignup;
  $('#authPassword').autocomplete = isSignup ? 'new-password' : 'current-password';
  $('#authSubmitBtn').textContent = isSignup ? 'Criar minha conta' : 'Entrar';
  $('#authSwitchText').innerHTML = isSignup
    ? 'Já tem conta? <button type="button" class="auth-link" data-auth-mode="login">Entrar</button>'
    : 'Ainda não tem conta? <button type="button" class="auth-link" data-auth-mode="signup">Criar conta grátis</button>';
  clearAuthErrors();
}

function clearAuthErrors() {
  ['authEmail', 'authPassword', 'authName'].forEach((id) => $(`#${id}`).removeAttribute('aria-invalid'));
  $('#authEmailError').hidden = true;
  $('#authPasswordError').hidden = true;
}

function openAuthModal(mode = 'login') {
  authReturnFocus = document.activeElement;
  setAuthMode(mode);
  $('#authForm').reset();
  $('#authRemember').checked = true;
  $('#authModal').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => (mode === 'signup' ? $('#authName') : $('#authEmail')).focus(), 30);
}

function closeAuthModal() {
  pendingCheckoutPlan = null; // fechou sem entrar: não abre o pagamento depois
  $('#authModal').hidden = true;
  document.body.style.overflow = '';
  if (authReturnFocus && typeof authReturnFocus.focus === 'function') authReturnFocus.focus();
}

function completeLogin(user) {
  state.user = user;
  const resumePlan = pendingCheckoutPlan;
  pendingCheckoutPlan = null;
  if (resumePlan && user.role !== 'admin') setTimeout(() => openCheckoutModal(resumePlan), 400);
  saveState();
  closeAuthModal();
  renderAll();
  showToast(`Pronto, ${user.name.split(/\s+/)[0]}! Você está conectado.`);
}

function handleAuthSubmit(e) {
  e.preventDefault();
  clearAuthErrors();
  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value;
  let ok = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    $('#authEmail').setAttribute('aria-invalid', 'true');
    $('#authEmailError').hidden = false;
    ok = false;
  }
  if (password.length < 8) {
    $('#authPassword').setAttribute('aria-invalid', 'true');
    $('#authPasswordError').hidden = false;
    ok = false;
  }
  if (!ok) {
    (email && $('#authEmailError').hidden ? $('#authPassword') : $('#authEmail')).focus();
    return;
  }
  const typedName = $('#authName').value.trim();
  const fallbackName = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  completeLogin({ name: (authMode === 'signup' && typedName) || fallbackName, email, provider: 'email' });
}

function closeAccountMenu() {
  $('#accountMenu').hidden = true;
  $('#accountChipBtn').setAttribute('aria-expanded', 'false');
}

function bindAuthEvents() {
  $('#headerLoginBtn').addEventListener('click', () => openAuthModal('login'));
  const freeSignupBtn = $('#freeSignupBtn');
  if (freeSignupBtn) freeSignupBtn.addEventListener('click', () => { pendingCheckoutPlan = null; openAuthModal('signup'); });
  $('#mobileAccountTab').addEventListener('click', () => {
    if (state.user) switchView('plano');
    else openAuthModal('login');
  });
  $('#closeAuthBtn').addEventListener('click', closeAuthModal);
  $('#authModal').addEventListener('click', (e) => {
    if (e.target.id === 'authModal') { closeAuthModal(); return; }
    const modeBtn = e.target.closest('[data-auth-mode]');
    if (modeBtn) {
      setAuthMode(modeBtn.dataset.authMode);
      (authMode === 'signup' ? $('#authName') : $('#authEmail')).focus();
    }
  });
  $('#authForm').addEventListener('submit', handleAuthSubmit);
  $('#togglePasswordBtn').addEventListener('click', () => {
    const input = $('#authPassword');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('#togglePasswordBtn').setAttribute('aria-pressed', String(show));
    $('#togglePasswordBtn').setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  });
  $('#forgotPasswordBtn').addEventListener('click', () => {
    const email = $('#authEmail').value.trim();
    showToast(email ? `Enviamos um link de redefinição para ${email} (simulação).` : 'Digite seu e-mail acima para receber o link de redefinição.');
    if (!email) $('#authEmail').focus();
  });
  // Botão reserva: só aparece se o botão oficial do Google não carregar (google-auth.js).
  $('#googleLoginBtn').addEventListener('click', () => {
    showToast('O login com Google não carregou. Verifique a internet ou bloqueadores e tente de novo.');
  });

  // Login real com Google (eventos enviados por /js/google-auth.js)
  window.addEventListener('cnc:auth-login', (e) => {
    const u = e.detail || {};
    if (!u.email) return;
    completeLogin({ name: u.name || u.email.split('@')[0], email: u.email, picture: u.picture || null, provider: 'google', role: u.role || 'user' });
    applyServerRole(u);
    saveState();
    renderAll();
  });
  window.addEventListener('cnc:auth-session', (e) => {
    const u = e.detail;
    if (u === undefined) return; // sem internet: mantém o estado local
    if (u && u.email) {
      if (!state.user || state.user.email !== u.email) {
        state.user = { name: u.name || u.email.split('@')[0], email: u.email, picture: u.picture || null, provider: 'google' };
      }
      applyServerRole(u);
      saveState();
      renderAll();
    } else if (state.user && state.user.provider === 'google') {
      // A sessão do Google expirou no servidor: encerra também no navegador
      state.user = null;
      applyServerRole(null);
      saveState();
      renderAll();
    }
  });
  window.addEventListener('cnc:auth-error', (e) => showToast(e.detail || 'Não foi possível entrar com o Google.'));

  $('#accountChipBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = $('#accountMenu');
    menu.hidden = !menu.hidden;
    $('#accountChipBtn').setAttribute('aria-expanded', String(!menu.hidden));
  });
  $('#accountMenu').addEventListener('click', () => closeAccountMenu());
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#accountWrap')) closeAccountMenu();
  });
  $('#logoutBtn').addEventListener('click', () => {
    if (state.user && state.user.provider === 'google') window.dispatchEvent(new CustomEvent('cnc:auth-logout'));
    state.user = null;
    applyServerRole(null);
    saveState();
    renderAll();
    showToast('Você saiu da sua conta.');
  });
}

function renderRegionsBar() {
  const html = REGIOES_BRASIL.map((reg) => {
    const count = reg.id === 'TODAS'
      ? catalog.length
      : catalog.filter((c) => c.regiao === reg.id).length;
    const activeClass = filters.regiao === reg.id ? 'active' : '';
    return `
      <button type="button" class="region-pill ${activeClass}" data-regiao="${escapeHtml(reg.id)}">
        <span>${escapeHtml(reg.nome)}</span>
        <small>${count}</small>
      </button>
    `;
  }).join('');
  $('#regionsBar').innerHTML = html;
}

function renderRecoSummary() {
  const parts = [];
  if (state.prefs.uf !== 'TODOS') parts.push(`Estado: ${state.prefs.uf}`);
  if (state.prefs.area !== 'TODAS') parts.push(`Área: ${state.prefs.area}`);
  if (state.prefs.escolaridade !== 'TODAS') parts.push(`Nível: ${state.prefs.escolaridade}`);

  if (parts.length === 0) {
    $('#recoSummary').innerHTML = `Mostrando concursos em <strong>Todo o Brasil</strong> — filtre por estado, área e escolaridade.`;
  } else {
    const matches = catalog.filter((c) => {
      if (c.status === 'Encerrado') return false;
      const ufOk = state.prefs.uf === 'TODOS' || c.uf === state.prefs.uf || c.uf === 'Nacional';
      const areaOk = state.prefs.area === 'TODAS' || c.area === state.prefs.area;
      const escOk = state.prefs.escolaridade === 'TODAS' || c.escolaridade.includes(state.prefs.escolaridade);
      return ufOk && areaOk && escOk;
    }).length;
    $('#recoSummary').innerHTML = `Seu perfil (<strong>${escapeHtml(parts.join(' · '))}</strong>) tem <strong>${matches} concursos reais ativos compatíveis</strong> agora.`;
  }
}

function getFilteredConcursos() {
  const q = filters.q.trim();
  const searchScores = new Map();

  let list = catalog.filter((c) => {
    if (filters.status === 'ATIVOS' && c.status === 'Encerrado') return false;
    if (filters.status !== 'TODOS' && filters.status !== 'ATIVOS' && c.status !== filters.status) return false;
    if (filters.regiao !== 'TODAS' && c.regiao !== filters.regiao) return false;
    if (filters.uf !== 'TODOS' && c.uf !== filters.uf && c.uf !== 'Nacional') return false;
    if (filters.esfera !== 'TODAS' && c.esfera !== filters.esfera) return false;
    if (filters.area !== 'TODAS' && c.area !== filters.area) return false;
    if (filters.escolaridade !== 'TODAS' && !c.escolaridade.includes(filters.escolaridade)) return false;
    if (filters.minSalario > 0 && c.salarioMax < filters.minSalario) return false;
    if (filters.onlyUrgent) {
      const d = daysUntil(c.inscricaoFim);
      if (!(c.status === 'Inscrições Abertas' && d !== null && d >= 0 && d <= 18)) return false;
    }
    if (q) {
      const score = scoreConcurso(c, q, ESTADOS_BRASIL[c.uf]?.nome || '');
      if (!score) return false;
      searchScores.set(c, score);
    }
    return true;
  });

  list = [...list].sort((a, b) => {
    // Com busca e ordenação padrão: o que mais combina com o texto vem primeiro
    if (q && filters.sort === 'destaque') {
      const diff = (searchScores.get(b) || 0) - (searchScores.get(a) || 0);
      if (diff) return diff;
    }
    if (filters.sort === 'salario') return b.salarioMax - a.salarioMax;
    if (filters.sort === 'vagas') return (b.vagas + b.vagasCR * 0.01) - (a.vagas + a.vagasCR * 0.01);
    if (filters.sort === 'prazo') {
      const da = daysUntil(a.inscricaoFim);
      const db = daysUntil(b.inscricaoFim);
      const scoreA = da !== null && da >= 0 ? da : 99999;
      const scoreB = db !== null && db >= 0 ? db : 99999;
      return scoreA - scoreB;
    }
    if (filters.sort === 'prova') {
      const da = daysUntil(a.dataProva);
      const db = daysUntil(b.dataProva);
      const scoreA = da === null ? 99998 : (da >= 0 ? da : 50000 - da);
      const scoreB = db === null ? 99998 : (db >= 0 ? db : 50000 - db);
      return scoreA - scoreB;
    }
    if (!hasEssencial() && a.destaqueGratuito !== b.destaqueGratuito) {
      return a.destaqueGratuito ? -1 : 1;
    }
    if (a.status !== b.status) {
      const rank = {
        'Inscrições Abertas': 0,
        'Edital Publicado': 1,
        'Prova Agendada': 2,
        'Previsto / Autorizado': 3,
        'Encerrado': 4
      };
      return (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    }
    if (typeof a.importancia === 'number' && typeof b.importancia === 'number' && a.importancia !== b.importancia) {
      return b.importancia - a.importancia;
    }
    return b.vagas - a.vagas;
  });

  return list;
}

function hasActiveFilters() {
  return Boolean(
    filters.q ||
    filters.regiao !== 'TODAS' ||
    filters.uf !== 'TODOS' ||
    filters.esfera !== 'TODAS' ||
    filters.area !== 'TODAS' ||
    filters.escolaridade !== 'TODAS' ||
    filters.status !== 'ATIVOS' ||
    filters.minSalario > 0 ||
    filters.onlyUrgent
  );
}

function renderConcursosGrid() {
  const list = getFilteredConcursos();
  const totalVagasFiltradas = list.filter((c) => c.status !== 'Encerrado').reduce((acc, c) => acc + c.vagas, 0);
  const closedInCatalog = catalog.filter((c) => c.status === 'Encerrado').length;

  $('#resultsCount').innerHTML = `Exibindo <strong>${list.length}</strong> ${list.length === 1 ? 'concurso real' : 'concursos reais'} · <strong>${totalVagasFiltradas.toLocaleString('pt-BR')}</strong> vagas imediatas (+ CR · ${closedInCatalog} encerrados no histórico)`;
  $('#resetFiltersBtn').hidden = !hasActiveFilters();
  $('#toggleClosedQuickBtn').textContent = filters.status === 'ATIVOS'
    ? `Mostrar também ${closedInCatalog} encerrados`
    : 'Ver apenas ativos';

  const paginationEl = $('#concursosPagination');
  if (list.length === 0) {
    if (paginationEl) {
      paginationEl.hidden = true;
      paginationEl.innerHTML = '';
    }
    const q = filters.q.trim();
    const suggestions = SEARCH_SUGGESTIONS
      .map((s) => `<button type="button" class="chip" data-search-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`)
      .join('');
    $('#concursosGrid').innerHTML = q ? `
      <div class="empty-state search-empty" style="grid-column: 1 / -1;">
        <h3>Nenhum concurso encontrado para “${escapeHtml(q)}”</h3>
        <p>Confira a grafia ou tente o nome do órgão, a sigla, o cargo ou a banca.</p>
        ${hasNonSearchFilters() ? '<button type="button" class="btn-primary-sm" data-search-everywhere>Buscar em todo o Brasil, sem filtros</button>' : ''}
        <div class="search-suggest-row"><span>Tente:</span>${suggestions}</div>
        <button type="button" class="btn-ghost-sm" id="inlineResetBtn">Limpar busca e mostrar todos</button>
      </div>
    ` : `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>Nenhum concurso encontrado com esses filtros</h3>
        <p>Tente ampliar o estado, incluir concursos encerrados ou limpar a busca.</p>
        <button type="button" class="btn-primary-sm" id="inlineResetBtn">Mostrar todos os concursos ativos</button>
      </div>
    `;
    $('#inlineResetBtn')?.addEventListener('click', resetAllFilters);
    return;
  }

  const shownList = list.slice(0, visibleConcursosLimit);
  const remaining = list.length - shownList.length;

  $('#concursosGrid').innerHTML = shownList.map((c) => {
    const unlocked = isEditalUnlocked(c);
    const saved = state.savedIds.includes(c.id);
    const isClosed = c.status === 'Encerrado';
    const regDays = daysUntil(c.inscricaoFim);
    const examDays = daysUntil(c.dataProva);
    const isUrgent = c.status === 'Inscrições Abertas' && regDays !== null && regDays >= 0 && regDays <= 15;

    let deadlineCopy = c.inscricaoFim ? `Até ${formatDateBR(c.inscricaoFim).slice(0, 5)}` : 'Aguardando edital';
    if (isClosed) {
      deadlineCopy = 'Encerrado';
    } else if (c.status === 'Prova Agendada') {
      deadlineCopy = 'Inscrições encerradas';
    } else if (c.status === 'Inscrições Abertas' && regDays !== null && regDays >= 0) {
      if (regDays === 0) deadlineCopy = 'Encerra hoje';
      else if (regDays === 1) deadlineCopy = 'Encerra amanhã';
      else deadlineCopy = regDays <= 15 ? `Encerra em ${regDays}d` : `Até ${formatDateBR(c.inscricaoFim).slice(0, 5)}`;
    } else if (c.status === 'Edital Publicado' && c.inscricaoInicio) {
      deadlineCopy = `Abre ${formatDateBR(c.inscricaoInicio).slice(0, 5)}`;
    } else if (c.status === 'Previsto / Autorizado') {
      deadlineCopy = 'Edital em breve';
    }

    let examDateText = formatDateBR(c.dataProva);
    let examCountdown = '';
    if (isClosed) {
      examCountdown = 'Encerrado';
    } else if (!c.dataProva) {
      examDateText = c.status === 'Previsto / Autorizado' ? 'A definir' : 'Análise de títulos';
      examCountdown = c.status === 'Previsto / Autorizado' ? 'Previsto' : 'Sem prova';
    } else if (examDays !== null) {
      examCountdown = examDays === 0 ? 'Hoje' : (examDays > 0 ? `em ${examDays}d` : 'Realizada');
    }

    // Strict max 2 pills in card top row so all 3 columns align horizontally
    let secondaryBadge = '';
    if (isUrgent) {
      secondaryBadge = `<span class="badge-danger">${regDays <= 1 ? 'Último prazo' : 'Encerra logo'}</span>`;
    } else if (c.destaqueGratuito && !hasEssencial()) {
      secondaryBadge = '<span class="badge-gold">Grátis</span>';
    } else if (!unlocked) {
      secondaryBadge = '<span class="badge-neutral">Essencial</span>';
    }

    const ufLabel = c.uf === 'Nacional' ? 'Nacional' : c.uf;
    const shortBanca = c.banca.replace(/^Fundação\s+/i, '').replace(/\s*\(Própria\)/i, '');
    const vagasShort = c.vagas === 0 ? 'Cadastro Reserva' : formatVagasLabel(c);

    return `
      <article class="contest-card ${isClosed ? 'is-closed' : ''}" data-contest-id="${escapeHtml(c.id)}">
        <div class="card-top">
          <div class="card-badges">
            <span class="${statusBadgeClass(c.status)}">${escapeHtml(c.status)}</span>
            ${secondaryBadge}
          </div>
          <button type="button" class="save-icon-btn ${saved ? 'saved' : ''}" data-save-id="${escapeHtml(c.id)}" aria-label="${saved ? 'Remover dos salvos' : 'Salvar concurso'}" title="${saved ? 'Salvo' : 'Salvar concurso'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>

        <div class="card-identity">
          <span class="card-eyebrow">${escapeHtml(c.sigla)} · ${escapeHtml(ufLabel)} · ${escapeHtml(shortBanca)}</span>
          <h3 title="${escapeHtml(c.orgao)}">${escapeHtml(c.orgao)}</h3>
          <p class="card-role" title="${escapeHtml(c.titulo)}">${escapeHtml(c.titulo)}</p>
        </div>

        <div class="exam-date-strip ${isClosed ? 'closed' : ''}" title="${escapeHtml(c.provaObservacao)}">
          <div class="exam-date-main">
            <span class="exam-date-kicker">${isClosed ? 'Prova realizada' : 'Data da prova'}</span>
            <strong class="exam-date-val tabular">${escapeHtml(examDateText)}</strong>
          </div>
          <span class="exam-countdown-pill tabular">${escapeHtml(examCountdown)}</span>
        </div>

        <div class="card-metrics">
          <div class="metric-item">
            <span>Salário até</span>
            <strong class="salary">${formatBRL(c.salarioMax)}</strong>
          </div>
          <div class="metric-item metric-divider">
            <span>Vagas</span>
            <strong>${escapeHtml(vagasShort)}</strong>
          </div>
        </div>

        <div class="card-footer">
          <span class="deadline-text ${isUrgent ? 'urgent' : ''}">${escapeHtml(deadlineCopy)}</span>
          <button type="button" class="btn-card-open ${unlocked ? '' : 'locked'}" data-open-id="${escapeHtml(c.id)}">
            ${isClosed ? 'Ver histórico' : (unlocked ? 'Ver edital' : 'Desbloquear')}
          </button>
        </div>
      </article>
    `;
  }).join('');

  if (paginationEl) {
    if (remaining > 0) {
      const nextStep = Math.min(PAGE_SIZE, remaining);
      paginationEl.hidden = false;
      paginationEl.innerHTML = `
        <p class="pagination-info">Mostrando <strong>${shownList.length}</strong> de <strong>${list.length}</strong> concursos</p>
        <div class="pagination-actions">
          <button type="button" class="btn-primary-sm" id="loadMoreConcursosBtn">Carregar mais ${nextStep} concursos</button>
          <button type="button" class="btn-outline-sm" id="showAllConcursosBtn">Ver todos (${list.length})</button>
        </div>
      `;
      $('#loadMoreConcursosBtn')?.addEventListener('click', () => {
        visibleConcursosLimit += PAGE_SIZE;
        renderConcursosGrid();
      });
      $('#showAllConcursosBtn')?.addEventListener('click', () => {
        visibleConcursosLimit = list.length;
        renderConcursosGrid();
      });
    } else if (list.length > PAGE_SIZE) {
      paginationEl.hidden = false;
      paginationEl.innerHTML = `
        <p class="pagination-info">Todos os <strong>${list.length}</strong> concursos exibidos</p>
      `;
    } else {
      paginationEl.hidden = true;
      paginationEl.innerHTML = '';
    }
  }
}

/* ======================================================
   RENDERING — COURSES COMPARATOR VIEW
   ====================================================== */
function renderCoursesCatalog() {
  const flatCourses = [];
  for (const c of catalog) {
    for (const course of c.cursos) {
      flatCourses.push({
        ...course,
        concursoId: c.id,
        concursoSigla: c.sigla,
        concursoArea: c.area,
        concursoStatus: c.status,
        unlocked: isEditalUnlocked(c)
      });
    }
  }

  const filtered = flatCourses.filter((item) => {
    if (courseFilters.platform !== 'TODAS' && item.plataformaId !== courseFilters.platform) return false;
    if (courseFilters.area !== 'TODAS' && item.concursoArea !== courseFilters.area) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (courseFilters.sort === 'nota') return b.nota - a.nota || b.avaliacoes - a.avaliacoes;
    if (courseFilters.sort === 'carga') return parseInt(b.cargaHoraria, 10) - parseInt(a.cargaHoraria, 10);
    return a.precoMensal - b.precoMensal;
  });

  const shownCourses = filtered.slice(0, visibleCoursesLimit);
  const remainingCourses = filtered.length - shownCourses.length;
  $('#coursesCatalogGrid').innerHTML = shownCourses.map((course) => {
    const color = platformColor(course.plataformaId);
    return `
      <article class="course-card">
        <div class="course-card-top">
          <span class="platform-tag" style="background:${escapeHtml(color)}">${escapeHtml(course.plataforma)}</span>
          <span class="badge-neutral">${escapeHtml(course.concursoSigla)} · ${escapeHtml(course.concursoArea)}</span>
          <span class="badge-emerald">${escapeHtml(course.destaque)}</span>
        </div>
        <h4>${escapeHtml(course.titulo)}</h4>
        <div class="course-meta">
          <span>★ <strong>${course.nota.toFixed(1)}</strong> (${course.avaliacoes.toLocaleString('pt-BR')} avaliações)</span>
          <span>Carga: <strong>${escapeHtml(course.cargaHoraria)}</strong></span>
          <span>${escapeHtml(course.formato)}</span>
        </div>
        <div class="course-bottom">
          <div class="course-price">
            <strong class="tabular">${escapeHtml(course.parcelas)}</strong>
            <small>Referência na plataforma parceira (confira promoções vigentes)</small>
          </div>
          <div class="edital-actions">
            ${course.unlocked ? `
              <button type="button" class="coupon-btn" data-copy-coupon="${escapeHtml(course.cupom)}">Cupom: ${escapeHtml(course.cupom)}</button>
              <a class="btn-primary-sm" href="${escapeHtml(course.url)}" target="_blank" rel="noopener noreferrer">Acessar Plataforma ↗</a>
            ` : `
              <button type="button" class="btn-outline-sm" data-trigger-checkout="essencial">Desbloquear Link &amp; Cupom (R$ 6,99)</button>
            `}
          </div>
        </div>
      </article>
    `;
  }).join('');

  const coursesPagEl = $('#coursesPagination');
  if (coursesPagEl) {
    if (remainingCourses > 0) {
      const nextStep = Math.min(PAGE_SIZE, remainingCourses);
      coursesPagEl.hidden = false;
      coursesPagEl.innerHTML = `
        <p class="pagination-info">Mostrando <strong>${shownCourses.length}</strong> de <strong>${filtered.length}</strong> cursos comparados</p>
        <div class="pagination-actions">
          <button type="button" class="btn-primary-sm" id="loadMoreCoursesBtn">Carregar mais ${nextStep} cursos</button>
        </div>
      `;
      $('#loadMoreCoursesBtn')?.addEventListener('click', () => {
        visibleCoursesLimit += PAGE_SIZE;
        renderCoursesCatalog();
      });
    } else {
      coursesPagEl.hidden = true;
      coursesPagEl.innerHTML = '';
    }
  }
}

/* ======================================================
   RENDERING — SAVED & ALERTS VIEW
   ====================================================== */
function renderSavedView() {
  const savedItems = catalog.filter((c) => state.savedIds.includes(c.id));
  const container = $('#savedListContainer');

  if (savedItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Você ainda não salvou nenhum concurso</h3>
        <p>Toque no ícone de marcador em qualquer concurso para acompanhar datas de prova atualizadas, editais e ativar alertas no app.</p>
        <button type="button" class="btn-primary-sm" data-view-jump="concursos">Explorar concursos</button>
      </div>
    `;
    return;
  }

  container.innerHTML = savedItems.map((c) => {
    const alertOn = state.alertIds.includes(c.id);
    const examDays = daysUntil(c.dataProva);
    const examSummary = !c.dataProva
      ? c.provaObservacao
      : `Data da prova: ${formatDateBR(c.dataProva)} (${examDays >= 0 ? `faltam ${examDays} dias` : 'já realizada'})`;
    return `
      <div class="saved-item">
        <div>
          <div class="card-badges" style="margin-bottom:6px;">
            <span class="${statusBadgeClass(c.status)}">${escapeHtml(c.status)}</span>
            <span class="badge-neutral">${escapeHtml(c.uf)} · ${escapeHtml(c.banca)}</span>
          </div>
          <h3>${escapeHtml(c.orgao)} — ${escapeHtml(c.sigla)}</h3>
          <p class="muted-sm">
            <strong>${escapeHtml(examSummary)}</strong> · Salário até ${formatBRL(c.salarioMax)}
          </p>
        </div>
        <div class="saved-item-actions">
          <button type="button" class="btn-outline-sm" data-toggle-alert="${escapeHtml(c.id)}">
            ${alertOn ? 'Alerta Ativo ✓' : 'Ativar Alerta'}
          </button>
          <button type="button" class="btn-primary-sm" data-open-id="${escapeHtml(c.id)}">Abrir Concurso</button>
          <button type="button" class="icon-btn" data-save-id="${escapeHtml(c.id)}" title="Remover dos salvos" aria-label="Remover dos salvos">&times;</button>
        </div>
      </div>
    `;
  }).join('');
}

/* ======================================================
   CONTEST DETAIL MODAL (GERAL / EDITAL / CURSOS / 5 PROVAS)
   ====================================================== */
function openContestDetail(id, initialTab = 'geral') {
  const c = catalog.find((item) => item.id === id);
  if (!c) return;
  activeDetailId = id;
  activeDetailTab = initialTab;

  renderDetailModal();
  $('#detailModal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
  $('#detailModal').hidden = true;
  document.body.style.overflow = '';
  activeDetailId = null;
}

function renderDetailModal() {
  const c = catalog.find((item) => item.id === activeDetailId);
  if (!c) return;
  const saved = state.savedIds.includes(c.id);
  const editalUnlocked = isEditalUnlocked(c);
  const pastExamsUnlocked = hasCompleto();

  $('#detailBadges').innerHTML = `
    <span class="${statusBadgeClass(c.status)}">${escapeHtml(c.status)}</span>
    <span class="badge-neutral">${escapeHtml(c.esfera)} · ${escapeHtml(c.uf)}</span>
    <span class="badge-neutral">Banca ${escapeHtml(c.banca)}</span>
    ${c.destaqueGratuito && !hasEssencial() ? '<span class="badge-gold">Amostra Grátis Liberada</span>' : ''}
    ${hasCompleto() ? '<span class="badge-emerald">Check Completo Ativo</span>' : (hasEssencial() ? '<span class="badge-emerald">Check Essencial Ativo</span>' : '')}
  `;
  $('#detailTitle').textContent = `${c.orgao} (${c.sigla})`;
  $('#detailSubtitle').textContent = `${c.titulo} · Fonte: ${c.fonteOficial}`;

  $('#detailSaveBtn').classList.toggle('saved', saved);

  const taxaLabel = c.taxaInscricao === 0 ? 'Gratuita' : formatBRL(c.taxaInscricao);
  const provaLabel = c.dataProva ? formatDateBR(c.dataProva) : (c.status === 'Previsto / Autorizado' ? 'A definir' : 'Sem prova escrita');

  $('#detailKpis').innerHTML = `
    <div class="kpi-cell"><span>Data da Prova</span><strong>${escapeHtml(provaLabel)}</strong></div>
    <div class="kpi-cell"><span>Remuneração</span><strong>Até ${formatBRL(c.salarioMax)}</strong></div>
    <div class="kpi-cell"><span>Vagas</span><strong>${escapeHtml(formatVagasLabel(c))}</strong></div>
    <div class="kpi-cell"><span>Taxa de Inscrição</span><strong>${escapeHtml(taxaLabel)}</strong></div>
  `;

  $$('.modal-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.detailTab === activeDetailTab);
  });

  const body = $('#detailBody');
  if (activeDetailTab === 'geral') {
    body.innerHTML = `
      <div class="info-block">
        <h4>Cronograma Oficial (verificado em ${formatDateBR(c.dataProvaAtualizadaEm)})</h4>
        <div class="timeline-grid">
          <div class="timeline-step"><span>Publicação / Status</span><strong>${formatDateBR(c.edital.publicadoEm)}</strong></div>
          <div class="timeline-step"><span>Início Inscrições</span><strong>${formatDateBR(c.inscricaoInicio)}</strong></div>
          <div class="timeline-step"><span>Fim Inscrições</span><strong>${formatDateBR(c.inscricaoFim)}</strong></div>
          <div class="timeline-step highlight-exam"><span>${c.status === 'Encerrado' ? 'Prova Realizada' : 'Data da Prova'}</span><strong>${escapeHtml(provaLabel)}</strong></div>
        </div>
      </div>

      <div class="info-block">
        <h4>Cargos, Vagas e Salários</h4>
        <table class="cargos-table">
          <thead>
            <tr><th>Cargo</th><th>Escolaridade</th><th>Vagas</th><th>Inicial</th></tr>
          </thead>
          <tbody>
            ${c.edital.cargos.map((cargo) => `
              <tr>
                <td><strong>${escapeHtml(cargo.nome)}</strong></td>
                <td>${escapeHtml(cargo.escolaridade)}</td>
                <td class="tabular">${cargo.vagas === 0 ? 'CR' : cargo.vagas.toLocaleString('pt-BR')}</td>
                <td class="tabular"><strong>${formatBRL(cargo.salario)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="info-block">
        <h4>Benefícios e Etapas do Concurso</h4>
        <p class="muted-sm" style="margin-bottom:8px;"><strong>Resumo:</strong> ${escapeHtml(c.beneficiosResumo)}</p>
        <ul class="bullet-list">
          ${c.edital.etapas.map((etapa) => `<li>${escapeHtml(etapa)}</li>`).join('')}
        </ul>
      </div>

      <div class="edital-actions">
        <button type="button" class="btn-primary-sm" data-switch-tab="edital">Abrir Edital &amp; Raio-X</button>
        <button type="button" class="btn-outline-sm" data-switch-tab="cursos">Comparar ${c.cursos.length} Cursos</button>
        <button type="button" class="btn-outline-sm" data-switch-tab="provas">Ver 5 Provas Anteriores</button>
      </div>
    `;
    return;
  }

  if (activeDetailTab === 'edital') {
    if (!editalUnlocked) {
      body.innerHTML = renderPaywallGate(
        'Desbloqueie o Edital Oficial e o Raio-X Completo',
        `Acesse o link oficial da banca ${c.banca}, resumo completo das matérias com pesos, download do Dossiê do Edital e todos os concursos reais do Brasil a partir de R$ 6,99/mês.`,
        `<div class="disc-bar-item"><div class="disc-bar-top"><span>${escapeHtml(c.edital.disciplinas[0].nome)}</span><strong>${c.edital.disciplinas[0].peso}%</strong></div><div class="disc-track"><div class="disc-fill" style="width:${c.edital.disciplinas[0].peso}%"></div></div></div>
         <div class="disc-bar-item"><div class="disc-bar-top"><span>${escapeHtml(c.edital.disciplinas[1]?.nome || 'Língua Portuguesa')}</span><strong>${c.edital.disciplinas[1]?.peso || 20}%</strong></div><div class="disc-track"><div class="disc-fill" style="width:${c.edital.disciplinas[1]?.peso || 20}%"></div></div></div>`,
        'essencial'
      );
      return;
    }

    body.innerHTML = `
      <div class="edital-hero-box">
        <div>
          <strong>${escapeHtml(c.edital.numero)}</strong>
          <p class="muted-sm">Publicado em ${formatDateBR(c.edital.publicadoEm)}${c.edital.paginas ? ` · ${c.edital.paginas} páginas` : ''} · Banca ${escapeHtml(c.banca)}</p>
        </div>
        <div class="edital-actions">
          <button type="button" class="btn-primary-sm" id="downloadDossierBtn">Baixar Raio-X do Edital</button>
          <a class="btn-outline-sm" href="${escapeHtml(c.edital.urlPdf)}" target="_blank" rel="noopener noreferrer">Portal Oficial da Banca ↗</a>
        </div>
      </div>

      <div class="info-block">
        <h4>Raio-X das Disciplinas e Peso na Prova</h4>
        ${c.edital.disciplinas.map((d) => `
          <div class="disc-bar-item">
            <div class="disc-bar-top">
              <span><strong>${escapeHtml(d.nome)}</strong>${d.questoes > 1 ? ` (${d.questoes} questões)` : ''}</span>
              <strong class="tabular">${d.peso}% do peso</strong>
            </div>
            <div class="disc-track">
              <div class="disc-fill" style="width:${Math.min(100, d.peso)}%"></div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="info-block">
        <h4>Pontos-Chave Verificados no Edital</h4>
        <ul class="bullet-list">
          ${c.edital.requisitosChave.map((req) => `<li>${escapeHtml(req)}</li>`).join('')}
        </ul>
      </div>
    `;

    $('#downloadDossierBtn')?.addEventListener('click', () => downloadEditalDossier(c));
    return;
  }

  if (activeDetailTab === 'cursos') {
    if (!editalUnlocked) {
      body.innerHTML = renderPaywallGate(
        `Compare ${c.cursos.length} Cursos para ${c.sigla} com Links Diretos`,
        `Veja opções nas principais plataformas preparatórias (Estratégia, Gran Cursos, Direção, QConcursos, AlfaCon e Nova) a partir de R$ 6,99/mês.`,
        `<div class="course-card"><h4>${escapeHtml(c.cursos[0].titulo)}</h4><div class="course-meta"><span>★ ${c.cursos[0].nota}</span><span>${escapeHtml(c.cursos[0].cargaHoraria)}</span><span>${escapeHtml(c.cursos[0].parcelas)}</span></div></div>`,
        'essencial'
      );
      return;
    }

    body.innerHTML = `
      <p class="muted-sm" style="margin-bottom:14px;">
        Links diretos para as principais plataformas preparatórias voltadas para <strong>${escapeHtml(c.orgao)}</strong>. <em>Valores exibidos são estimativas de referência — consulte o preço atualizado no site da plataforma.</em>
      </p>
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${c.cursos.map((course) => `
          <article class="course-card">
            <div class="course-card-top">
              <span class="platform-tag" style="background:${escapeHtml(platformColor(course.plataformaId))}">${escapeHtml(course.plataforma)}</span>
              <span class="badge-emerald">${escapeHtml(course.destaque)}</span>
              <span class="muted-sm">★ <strong>${course.nota.toFixed(1)}</strong> (${course.avaliacoes.toLocaleString('pt-BR')})</span>
            </div>
            <h4>${escapeHtml(course.titulo)}</h4>
            <div class="course-meta">
              <span>${escapeHtml(course.formato)}</span>
              <span>· Carga horária: <strong>${escapeHtml(course.cargaHoraria)}</strong></span>
            </div>
            <div class="course-bottom">
              <div class="course-price">
                <strong class="tabular">${escapeHtml(course.parcelas)}</strong>
                <small>Valor de referência · compra direto na plataforma</small>
              </div>
              <div class="edital-actions">
                <button type="button" class="coupon-btn" data-copy-coupon="${escapeHtml(course.cupom)}">Cupom demo: ${escapeHtml(course.cupom)}</button>
                <a class="btn-primary-sm" href="${escapeHtml(course.url)}" target="_blank" rel="noopener noreferrer">Ir para ${escapeHtml(course.plataforma.split(' ')[0])} ↗</a>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    `;
    return;
  }

  if (activeDetailTab === 'provas') {
    if (!pastExamsUnlocked) {
      const sampleRow = c.provasAnteriores.slice(0, 2).map((p) => `
        <div class="past-exam-row">
          <div class="past-exam-left">
            <div class="past-exam-year">${p.ano}</div>
            <div><strong>${escapeHtml(p.edicao)} — Banca ${escapeHtml(p.banca)}</strong><p class="muted-sm">${p.questoes} questões · ${escapeHtml(p.gabarito)}</p></div>
          </div>
          <span class="badge-gold">Plano Completo</span>
        </div>
      `).join('');

      body.innerHTML = renderPaywallGate(
        `5 Provas Anteriores de ${c.sigla} + Gabaritos Oficiais (Em Breve)`,
        `Exclusivo do Plano Check Completo (R$ 17,99/mês ou R$ 199,90/ano — economize R$ 15,98). Acesso a tudo na plataforma mais o banco com as 5 últimas provas de todos os concursos abertos do Brasil.`,
        sampleRow,
        'completo-anual'
      );
      return;
    }

    body.innerHTML = `
      <div class="edital-hero-box gold-box">
        <div>
          <span class="badge-gold" style="margin-bottom:4px;">Recurso em Lançamento · Exclusivo Check Completo</span>
          <div><strong>Banco das 5 Provas Anteriores — ${escapeHtml(c.orgao)} (${escapeHtml(c.sigla)})</strong></div>
          <p class="muted-sm">Seu plano Completo garante acesso prioritário às 5 provas anteriores com gabarito definitivo oficial.</p>
        </div>
      </div>

      ${c.provasAnteriores.map((exam, idx) => `
        <div class="past-exam-row">
          <div class="past-exam-left">
            <div class="past-exam-year">${exam.ano}</div>
            <div>
              <strong>${escapeHtml(exam.edicao)} · Banca ${escapeHtml(exam.banca)}</strong>
              <p class="muted-sm">${escapeHtml(exam.cargo)} · ${exam.questoes} questões · ${escapeHtml(exam.gabarito)}</p>
            </div>
          </div>
          <div class="edital-actions">
            <span class="${idx === 0 ? 'badge-emerald' : 'badge-gold'}">${escapeHtml(exam.disponibilidade)}</span>
            <button type="button" class="btn-outline-sm" data-download-exam="${idx}">
              ${idx === 0 ? 'Baixar Prévia + Gabarito' : 'Avise-me / Baixar Modelo'}
            </button>
          </div>
        </div>
      `).join('')}
    `;

    body.querySelectorAll('[data-download-exam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.downloadExam);
        downloadPastExamSample(c, c.provasAnteriores[idx]);
      });
    });
  }
}

function renderPaywallGate(title, desc, blurredPreviewHtml, targetPlan = 'essencial') {
  const isCompletoTarget = targetPlan !== 'essencial';
  return `
    <div class="paywall-gate">
      <div class="paywall-preview-blur">${blurredPreviewHtml}</div>
      <span class="badge-gold">${isCompletoTarget ? 'Exclusivo Plano Check Completo' : 'Disponível a partir do Plano Essencial'}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(desc)}</p>
      <div class="paywall-cta-row">
        ${isCompletoTarget ? `
          <button type="button" class="btn-primary-sm" style="padding:11px 18px;" data-trigger-checkout="completo-anual">
            Assinar Anual · R$ 199,90/ano (Mais barato)
          </button>
          <button type="button" class="btn-outline-sm" style="padding:11px 16px;" data-trigger-checkout="completo-mensal">
            Mensal · R$ 17,99/mês
          </button>
        ` : `
          <button type="button" class="btn-primary-sm" style="padding:11px 18px;" data-trigger-checkout="essencial">
            Assinar Essencial · R$ 6,99/mês
          </button>
          <button type="button" class="btn-outline-sm" style="padding:11px 16px;" data-trigger-checkout="completo-anual">
            Ou Completo Anual (R$ 199,90)
          </button>
        `}
      </div>
    </div>
  `;
}

function downloadEditalDossier(c) {
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Raio-X do Edital — ${escapeHtml(c.orgao)}</title>
  <style>body{font-family:Segoe UI,Arial,sans-serif;max-width:820px;margin:32px auto;padding:0 20px;color:#0F2236;line-height:1.5}
  h1{color:#0C4F83;margin-bottom:4px} .meta{color:#475569;margin-bottom:20px} table{width:100%;border-collapse:collapse;margin:14px 0}
  th,td{border:1px solid #CBD5E1;padding:8px 10px;text-align:left} th{background:#F1F5F9} .box{background:#E6F1FA;border:1px solid #9CC4E4;padding:12px 16px;border-radius:8px;margin:16px 0}</style>
  </head><body>
  <h1>${escapeHtml(c.orgao)} (${escapeHtml(c.sigla)})</h1>
  <div class="meta">${escapeHtml(c.edital.numero)} · Fonte: ${escapeHtml(c.fonteOficial)} · Gerado por ${MARCA.nome} (${MARCA.dominio})</div>
  <div class="box"><strong>Status:</strong> ${escapeHtml(c.status)} · <strong>Data da Prova:</strong> ${formatDateBR(c.dataProva)} (${escapeHtml(c.provaObservacao)}) · <strong>Vagas:</strong> ${escapeHtml(formatVagasLabel(c))} · <strong>Salário até:</strong> ${formatBRL(c.salarioMax)}.</div>
  <h2>Cargos</h2><table><thead><tr><th>Cargo</th><th>Escolaridade</th><th>Vagas</th><th>Inicial</th></tr></thead><tbody>
  ${c.edital.cargos.map((cg) => `<tr><td>${escapeHtml(cg.nome)}</td><td>${escapeHtml(cg.escolaridade)}</td><td>${cg.vagas === 0 ? 'CR' : cg.vagas}</td><td>${formatBRL(cg.salario)}</td></tr>`).join('')}
  </tbody></table>
  <h2>Disciplinas e Pesos</h2><ul>${c.edital.disciplinas.map((d) => `<li><strong>${escapeHtml(d.nome)}</strong> (${d.peso}% do peso)</li>`).join('')}</ul>
  <h2>Pontos-Chave</h2><ul>${c.edital.requisitosChave.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
  <h2>Portal Oficial da Banca</h2><p><a href="${escapeHtml(c.edital.urlPdf)}">${escapeHtml(c.edital.urlPdf)}</a></p>
  </body></html>`;

  triggerFileDownload(html, `check-no-concurso-edital-${c.id}.html`);
  showToast(`Raio-X do edital ${c.sigla} baixado!`);
}

function downloadPastExamSample(c, exam) {
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Caderno de Prova — ${escapeHtml(exam.edicao)}</title>
  <style>body{font-family:Segoe UI,Arial,sans-serif;max-width:780px;margin:32px auto;padding:0 20px;color:#0F2236;line-height:1.6}
  h1{color:#0C4F83;margin-bottom:4px} .tag{background:#FEF9DC;border:1px solid #E3C540;color:#734B00;padding:8px 12px;border-radius:8px;margin:14px 0}</style>
  </head><body>
  <h1>${escapeHtml(exam.edicao)} — Caderno de Prova + Gabarito</h1>
  <p><strong>Órgão:</strong> ${escapeHtml(c.orgao)} · <strong>Cargo:</strong> ${escapeHtml(exam.cargo)} · <strong>Banca:</strong> ${escapeHtml(exam.banca)} · <strong>Total:</strong> ${exam.questoes} questões</p>
  <div class="tag"><strong>Prévia do Check no Concurso (${MARCA.dominio}):</strong> Em produção, este botão entregará o PDF completo da prova de ${exam.ano} + gabarito definitivo oficial.</div>
  <h2>Estrutura de Cobrança</h2>
  <ul>${c.edital.disciplinas.map((d) => `<li>${escapeHtml(d.nome)} — peso estimado de ${d.peso}%</li>`).join('')}</ul>
  </body></html>`;

  triggerFileDownload(html, `prova-${c.sigla.toLowerCase().replace(/\s+/g, '-')}-${exam.ano}.html`);
  showToast(`Prévia da prova ${exam.edicao} baixada!`);
}

function triggerFileDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ======================================================
   CHECKOUT & MULTI-PLAN FLOW
   ====================================================== */
function selectCheckoutPlan(planId) {
  selectedCheckoutPlan = planId;
  const meta = getPlanMeta(planId);
  $$('[data-checkout-plan]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.checkoutPlan === planId);
  });
  const precoFmt = meta.preco.toFixed(2).replace('.', ',');
  $('#pixCodeInput').value = `00020126580014BR.GOV.BCB.PIX0136checknoconcurso-com-br-${planId}5204000053039865405${meta.preco.toFixed(2)}5802BR`;
  $('#confirmPixBtn').textContent = `Simular Pagamento Pix Confirmado (R$ ${precoFmt})`;
  $('#confirmCardBtn').textContent = `Ativar ${meta.nome} · ${meta.rotuloPreco}`;
}

// Plano escolhido antes do login: abre o pagamento logo depois que a pessoa entra
let pendingCheckoutPlan = null;

function openCheckoutModal(initialPlan = 'essencial') {
  // Os planos pagos exigem conta: primeiro cadastro/login, depois o pagamento
  if (!state.user) {
    pendingCheckoutPlan = initialPlan;
    openAuthModal('signup');
    showToast('Crie sua conta grátis ou entre para continuar com o plano.');
    return;
  }
  // ADMIN já tem todos os planos liberados, sem pagar
  if (state.user.role === 'admin') {
    showToast('Você é admin: todos os planos já estão liberados para você.');
    return;
  }
  // Pagamento real: página segura da Stripe
  if (stripeOn()) {
    window.location.assign('/pagar.html?plan=' + encodeURIComponent(initialPlan));
    return;
  }
  selectCheckoutPlan(initialPlan);
  $('#checkoutModal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
  $('#checkoutModal').hidden = true;
  if ($('#detailModal').hidden && $('#appPreviewModal').hidden) {
    document.body.style.overflow = '';
  }
}

function activateSubscription(method) {
  state.tier = selectedCheckoutPlan;
  state.subMethod = method;
  state.subSince = TODAY_ISO;
  saveState();
  closeCheckoutModal();
  renderAll();
  if (activeDetailId && !$('#detailModal').hidden) {
    renderDetailModal();
  }
  const meta = getPlanMeta(state.tier);
  showToast(`${meta.nome} (${meta.rotuloPreco}) ativado via ${method}!`);
}

/* ======================================================
   NAVIGATION, FILTERS & EVENTS
   ====================================================== */
function switchView(viewName) {
  activeView = viewName;
  $$('[data-view-panel]').forEach((panel) => {
    const match = panel.dataset.viewPanel === viewName;
    panel.hidden = !match;
    panel.classList.toggle('active', match);
  });
  $$('.nav-link[data-view], .tab-btn[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (viewName === 'cursos') renderCoursesCatalog();
  if (viewName === 'salvos') renderSavedView();
}

function toggleSaveContest(id) {
  const idx = state.savedIds.indexOf(id);
  if (idx >= 0) {
    state.savedIds.splice(idx, 1);
    state.alertIds = state.alertIds.filter((a) => a !== id);
    showToast('Concurso removido dos seus salvos.');
  } else {
    state.savedIds.push(id);
    state.alertIds.push(id);
    showToast('Concurso salvo! Avisaremos sobre alterações na data da prova.');
  }
  saveState();
  renderAuthUI();
  renderConcursosGrid();
  if (activeView === 'salvos') renderSavedView();
  if (activeDetailId === id && !$('#detailModal').hidden) renderDetailModal();
}

/* ---------- Busca: aviso de resultados e atalhos ---------- */
function hasNonSearchFilters() {
  return filters.regiao !== 'TODAS' || filters.uf !== 'TODOS' || filters.esfera !== 'TODAS' ||
    filters.area !== 'TODAS' || filters.escolaridade !== 'TODAS' || filters.minSalario > 0 || filters.onlyUrgent;
}

function renderSearchHint() {
  const hint = $('#searchHint');
  if (!hint) return;
  const q = filters.q.trim();
  if (!q) { hint.hidden = true; hint.innerHTML = ''; return; }
  const total = getFilteredConcursos().length;
  hint.hidden = false;
  hint.classList.toggle('is-empty', total === 0);
  hint.innerHTML = total
    ? `<strong>${total}</strong> ${total === 1 ? 'concurso encontrado' : 'concursos encontrados'} para “${escapeHtml(q)}” · <button type="button" class="search-hint-link" data-search-jump>Ver resultados ↓</button>`
    : `Nenhum concurso para “${escapeHtml(q)}”. <button type="button" class="search-hint-link" data-search-jump>Ver sugestões ↓</button>`;
}

function scrollToSearchResults() {
  const target = $('#resultsCount') || $('#concursosGrid');
  if (!target) return;
  const y = target.getBoundingClientRect().top + window.scrollY - 96;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
}

function searchEverywhere() {
  const keep = filters.q;
  resetAllFilters();
  filters.q = keep;
  $('#globalSearchInput').value = keep;
  $('#clearSearchBtn').hidden = !keep;
  renderConcursosGrid();
  renderSearchHint();
}

function resetAllFilters() {
  filters.q = '';
  filters.regiao = 'TODAS';
  filters.uf = 'TODOS';
  filters.esfera = 'TODAS';
  filters.area = 'TODAS';
  filters.escolaridade = 'TODAS';
  filters.status = 'ATIVOS';
  filters.minSalario = 0;
  filters.onlyUrgent = false;
  filters.sort = 'destaque';
  filters.quick = null;
  visibleConcursosLimit = PAGE_SIZE;

  $('#globalSearchInput').value = '';
  $('#clearSearchBtn').hidden = true;
  if ($('#searchHint')) { $('#searchHint').hidden = true; $('#searchHint').innerHTML = ''; }
  $('#filterUf').value = 'TODOS';
  $('#filterEsfera').value = 'TODAS';
  $('#filterArea').value = 'TODAS';
  $('#filterEscolaridade').value = 'TODAS';
  $('#filterStatus').value = 'ATIVOS';
  $('#sortBy').value = 'destaque';
  $$('.chip').forEach((ch) => ch.classList.remove('active'));

  renderRegionsBar();
  renderConcursosGrid();
}

function applyQuickChip(key) {
  const wasActive = filters.quick === key;
  resetAllFilters();
  if (wasActive) return;

  filters.quick = key;
  const chipEl = $(`.chip[data-quick="${key}"]`);
  if (chipEl) chipEl.classList.add('active');

  if (key === 'abertos') {
    filters.status = 'Inscrições Abertas';
    $('#filterStatus').value = 'Inscrições Abertas';
  } else if (key === 'agendados') {
    filters.status = 'Prova Agendada';
    $('#filterStatus').value = 'Prova Agendada';
    filters.sort = 'prova';
    $('#sortBy').value = 'prova';
  } else if (key === 'encerrados') {
    filters.status = 'Encerrado';
    $('#filterStatus').value = 'Encerrado';
  } else if (key === 'nacional') {
    filters.regiao = 'Nacional';
  } else if (key === 'medio') {
    filters.escolaridade = 'Médio';
    $('#filterEscolaridade').value = 'Médio';
  } else if (key === '10k') {
    filters.minSalario = 10000;
    filters.sort = 'salario';
    $('#sortBy').value = 'salario';
  } else if (key === 'urgente') {
    filters.onlyUrgent = true;
    filters.sort = 'prazo';
    $('#sortBy').value = 'prazo';
  }

  renderRegionsBar();
  renderConcursosGrid();
}

async function copyText(text, successMsg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg);
  } catch {
    showToast(`${successMsg} (${text})`);
  }
}

function renderAll() {
  renderHeroStats();
  renderAuthUI();
  renderRegionsBar();
  renderRecoSummary();
  renderConcursosGrid();
  if (activeView === 'cursos') renderCoursesCatalog();
  if (activeView === 'salvos') renderSavedView();
}

function bindEvents() {
  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn) {
      switchView(viewBtn.dataset.view);
      return;
    }

    const jumpBtn = e.target.closest('[data-view-jump]');
    if (jumpBtn) {
      switchView(jumpBtn.dataset.viewJump);
      return;
    }

    const regionBtn = e.target.closest('[data-regiao]');
    if (regionBtn) {
      filters.regiao = regionBtn.dataset.regiao;
      if (filters.regiao !== 'TODAS' && filters.uf !== 'TODOS') {
        const ufReg = filters.uf === 'Nacional' ? 'Nacional' : ESTADOS_BRASIL[filters.uf]?.regiao;
        if (ufReg !== filters.regiao) {
          filters.uf = 'TODOS';
          $('#filterUf').value = 'TODOS';
        }
      }
      visibleConcursosLimit = PAGE_SIZE;
      renderRegionsBar();
      renderConcursosGrid();
      return;
    }

    const saveBtn = e.target.closest('[data-save-id]');
    if (saveBtn) {
      e.stopPropagation();
      toggleSaveContest(saveBtn.dataset.saveId);
      return;
    }

    const openBtn = e.target.closest('[data-open-id]');
    if (openBtn) {
      openContestDetail(openBtn.dataset.openId);
      return;
    }

    const switchTabBtn = e.target.closest('[data-switch-tab]');
    if (switchTabBtn) {
      activeDetailTab = switchTabBtn.dataset.switchTab;
      renderDetailModal();
      return;
    }

    const couponBtn = e.target.closest('[data-copy-coupon]');
    if (couponBtn) {
      const code = couponBtn.dataset.copyCoupon;
      copyText(code, `Cupom ilustrativo ${code} copiado!`);
      return;
    }

    const checkoutTrigger = e.target.closest('[data-trigger-checkout]');
    if (checkoutTrigger) {
      const plan = checkoutTrigger.dataset.triggerCheckout || 'essencial';
      openCheckoutModal(plan === '1' ? 'essencial' : plan);
      return;
    }

    const pickPlanBtn = e.target.closest('[data-pick-plan]');
    if (pickPlanBtn && !pickPlanBtn.disabled) {
      openCheckoutModal(pickPlanBtn.dataset.pickPlan);
      return;
    }

    const checkoutPlanChoice = e.target.closest('[data-checkout-plan]');
    if (checkoutPlanChoice) {
      selectCheckoutPlan(checkoutPlanChoice.dataset.checkoutPlan);
      return;
    }

    const alertToggle = e.target.closest('[data-toggle-alert]');
    if (alertToggle) {
      const id = alertToggle.dataset.toggleAlert;
      if (state.alertIds.includes(id)) {
        state.alertIds = state.alertIds.filter((x) => x !== id);
        showToast('Alerta pausado para este concurso.');
      } else {
        state.alertIds.push(id);
        showToast('Alerta ativado! Avisaremos sobre mudanças na data da prova.');
      }
      saveState();
      renderSavedView();
      return;
    }
  });

  $('#brandHomeLink').addEventListener('click', (e) => {
    e.preventDefault();
    switchView('concursos');
  });

  $('#simGuestBtn').addEventListener('click', () => {
    state.tier = 'guest';
    saveState();
    renderAll();
    if (activeDetailId && !$('#detailModal').hidden) renderDetailModal();
    showToast('Modo Visitante (3 destaques reais liberados: PM-SP, TJ-SP e TRT-4).');
  });

  $('#simEssencialBtn').addEventListener('click', () => {
    state.tier = 'essencial';
    state.subMethod = state.subMethod || 'Simulação';
    state.subSince = state.subSince || TODAY_ISO;
    saveState();
    renderAll();
    if (activeDetailId && !$('#detailModal').hidden) renderDetailModal();
    showToast('Modo Check Essencial (R$ 6,99/mês): editais e cursos liberados!');
  });

  $('#simCompletoBtn').addEventListener('click', () => {
    state.tier = 'completo-anual';
    state.subMethod = state.subMethod || 'Simulação';
    state.subSince = state.subSince || TODAY_ISO;
    saveState();
    renderAll();
    if (activeDetailId && !$('#detailModal').hidden) renderDetailModal();
    showToast('Modo Check Completo (R$ 17,99/mês · R$ 199,90/ano): tudo + 5 provas anteriores!');
  });

  $$('[data-billing]').forEach((btn) => {
    btn.addEventListener('click', () => {
      billingCycle = btn.dataset.billing;
      renderBillingCycleUI();
    });
  });

  let searchTimer = null;
  $('#globalSearchInput').addEventListener('input', (e) => {
    filters.q = e.target.value;
    $('#clearSearchBtn').hidden = !filters.q;
    visibleConcursosLimit = PAGE_SIZE;
    if (activeView !== 'concursos') switchView('concursos');
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { renderConcursosGrid(); renderSearchHint(); }, 120);
  });

  $('#globalSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && filters.q) {
      e.stopPropagation();
      $('#clearSearchBtn').click();
    }
  });

  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(searchTimer);
    renderConcursosGrid();
    renderSearchHint();
    scrollToSearchResults();
    $('#globalSearchInput').blur(); // fecha o teclado no celular
  });

  $('#clearSearchBtn').addEventListener('click', () => {
    filters.q = '';
    $('#globalSearchInput').value = '';
    $('#clearSearchBtn').hidden = true;
    visibleConcursosLimit = PAGE_SIZE;
    renderConcursosGrid();
    renderSearchHint();
    $('#globalSearchInput').focus();
  });

  $('#searchHint').addEventListener('click', (e) => {
    if (e.target.closest('[data-search-jump]')) scrollToSearchResults();
  });

  $('#concursosGrid').addEventListener('click', (e) => {
    const sug = e.target.closest('[data-search-suggest]');
    if (sug) {
      $('#globalSearchInput').value = sug.dataset.searchSuggest;
      filters.q = sug.dataset.searchSuggest;
      $('#clearSearchBtn').hidden = false;
      renderConcursosGrid();
      renderSearchHint();
      return;
    }
    if (e.target.closest('[data-search-everywhere]')) searchEverywhere();
  });

  $('#quickChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) applyQuickChip(chip.dataset.quick);
  });

  $('#filterStatus').addEventListener('change', (e) => { filters.status = e.target.value; visibleConcursosLimit = PAGE_SIZE; renderConcursosGrid(); });
  $('#filterUf').addEventListener('change', (e) => {
    filters.uf = e.target.value;
    if (filters.uf !== 'TODOS') {
      filters.regiao = 'TODAS';
      renderRegionsBar();
    }
    visibleConcursosLimit = PAGE_SIZE;
    renderConcursosGrid();
  });
  $('#filterEsfera').addEventListener('change', (e) => { filters.esfera = e.target.value; visibleConcursosLimit = PAGE_SIZE; renderConcursosGrid(); });
  $('#filterArea').addEventListener('change', (e) => { filters.area = e.target.value; visibleConcursosLimit = PAGE_SIZE; renderConcursosGrid(); });
  $('#filterEscolaridade').addEventListener('change', (e) => { filters.escolaridade = e.target.value; visibleConcursosLimit = PAGE_SIZE; renderConcursosGrid(); });
  $('#sortBy').addEventListener('change', (e) => { filters.sort = e.target.value; visibleConcursosLimit = PAGE_SIZE; renderConcursosGrid(); });
  $('#resetFiltersBtn').addEventListener('click', resetAllFilters);

  $('#toggleClosedQuickBtn').addEventListener('click', () => {
    filters.status = filters.status === 'ATIVOS' ? 'TODOS' : 'ATIVOS';
    $('#filterStatus').value = filters.status;
    renderConcursosGrid();
  });

  $('#courseFilterPlatform').addEventListener('change', (e) => { courseFilters.platform = e.target.value; visibleCoursesLimit = PAGE_SIZE; renderCoursesCatalog(); });
  $('#courseFilterArea').addEventListener('change', (e) => { courseFilters.area = e.target.value; visibleCoursesLimit = PAGE_SIZE; renderCoursesCatalog(); });
  $('#courseSortBy').addEventListener('change', (e) => { courseFilters.sort = e.target.value; visibleCoursesLimit = PAGE_SIZE; renderCoursesCatalog(); });

  $('#openPrefsBtn').addEventListener('click', () => switchView('salvos'));
  $('#prefsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.prefs = {
      uf: $('#prefUf').value,
      escolaridade: $('#prefEscolaridade').value,
      area: $('#prefArea').value,
      alertWhatsapp: $('#prefAlertWhatsapp').checked,
      alertNovos: $('#prefAlertNovos').checked
    };
    saveState();
    renderRecoSummary();
    showToast('Preferências salvas com sucesso!');
  });

  $('#headerCtaBtn').addEventListener('click', () => {
    if (hasCompleto()) switchView('plano');
    else if (state.tier === 'essencial') openCheckoutModal('completo-anual');
    else openCheckoutModal('essencial');
  });

  bindAuthEvents();

  $('#heroSubscribeBtn').addEventListener('click', () => {
    if (hasCompleto()) switchView('salvos');
    else if (state.tier === 'essencial') openCheckoutModal('completo-anual');
    else openCheckoutModal('essencial');
  });

  $('#stripSubscribeBtn').addEventListener('click', () => switchView('plano'));

  // O cancelamento tem página própria (/cancelamento.html), aberta pelo link do banner de plano.

  $('#closeDetailBtn').addEventListener('click', closeDetailModal);
  $('#detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') closeDetailModal();
  });
  $('#detailSaveBtn').addEventListener('click', () => {
    if (activeDetailId) toggleSaveContest(activeDetailId);
  });
  $$('.modal-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeDetailTab = btn.dataset.detailTab;
      renderDetailModal();
    });
  });

  $('#closeCheckoutBtn').addEventListener('click', closeCheckoutModal);
  $('#checkoutModal').addEventListener('click', (e) => {
    if (e.target.id === 'checkoutModal') closeCheckoutModal();
  });

  $$('.pay-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.pay;
      $$('.pay-tab').forEach((t) => t.classList.toggle('active', t.dataset.pay === mode));
      $('#payPanelPix').hidden = mode !== 'pix';
      $('#payPanelCard').hidden = mode !== 'card';
    });
  });

  $('#copyPixBtn').addEventListener('click', () => {
    copyText($('#pixCodeInput').value, 'Código Pix Copia e Cola copiado!');
  });

  $('#confirmPixBtn').addEventListener('click', () => activateSubscription('Pix'));

  $('#cardNumber').addEventListener('input', (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
    e.target.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  });

  $('#cardExp').addEventListener('input', (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  });

  $('#payPanelCard').addEventListener('submit', (e) => {
    e.preventDefault();
    activateSubscription('Cartão de Crédito');
  });

  const openAppPreview = () => {
    const modal = $('#appPreviewModal');
    const frame = $('#phonePreviewFrame');
    frame.src = '/?app=1';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  };
  const closeAppPreview = () => {
    $('#appPreviewModal').hidden = true;
    $('#phonePreviewFrame').src = 'about:blank';
    document.body.style.overflow = '';
  };

  $('#openAppPreviewBtn').addEventListener('click', openAppPreview);
  $('#planPreviewAppBtn')?.addEventListener('click', openAppPreview);
  $('#closeAppPreviewBtn').addEventListener('click', closeAppPreview);
  $('#appPreviewModal').addEventListener('click', (e) => {
    if (e.target.id === 'appPreviewModal') closeAppPreview();
  });

  const sampleAlerts = [
    'URGENTE: Inscrições do TRT-4 (RS) encerram AMANHÃ (25/11) — salários até R$ 18.380.',
    'TCDF (DF): Gabarito preliminar da prova de 22/11 liberado hoje pelo Cebraspe.',
    'SEDUC-SP (5.000 vagas, FGV): Inscrições abrem em 26/11 com prova em 25/04/2027.'
  ];
  let alertCounter = 0;

  $('#triggerPhonePushBtn').addEventListener('click', () => {
    const msg = sampleAlerts[alertCounter % sampleAlerts.length];
    alertCounter += 1;
    $('#phonePreviewFrame').contentWindow?.postMessage({ type: 'SIMULATE_PUSH', text: msg }, '*');
  });

  $('#testPushBtn').addEventListener('click', () => {
    const msg = sampleAlerts[alertCounter % sampleAlerts.length];
    alertCounter += 1;
    showPushNotification(msg);
  });

  $('#closePushBtn').addEventListener('click', () => {
    $('#pushBanner').hidden = true;
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    $('#nativeInstallWrap').hidden = false;
  });

  const openInstall = () => { $('#installModal').hidden = false; };
  const closeInstall = () => { $('#installModal').hidden = true; };

  $('#installPwaBtn').addEventListener('click', openInstall);
  $('#planInstallBtn')?.addEventListener('click', openInstall);
  $('#closeInstallBtn').addEventListener('click', closeInstall);
  $('#installModal').addEventListener('click', (e) => {
    if (e.target.id === 'installModal') closeInstall();
  });

  $('#triggerNativeInstallBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('#nativeInstallWrap').hidden = true;
    closeInstall();
  });

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      state = loadState();
      renderAll();
      if (activeDetailId && !$('#detailModal').hidden) renderDetailModal();
    }
  });

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SIMULATE_PUSH' && e.data.text) {
      showPushNotification(e.data.text);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#accountMenu').hidden) closeAccountMenu();
    else if (!$('#authModal').hidden) closeAuthModal();
    else if (!$('#checkoutModal').hidden) closeCheckoutModal();
    else if (!$('#detailModal').hidden) closeDetailModal();
    else if (!$('#appPreviewModal').hidden) closeAppPreview();
    else if (!$('#installModal').hidden) closeInstall();
  });
}

function showTeamDemoBar() {
  // Faixa de testes (simular plano / prévia do app) só aparece com ?demo=1
  const bar = document.getElementById('demoBar');
  if (bar && new URLSearchParams(window.location.search).has('demo')) bar.hidden = false;
}

async function init() {
  showTeamDemoBar();
  detectAppMode();
  registerServiceWorker();
  await hydrateFromApi();
  populateSelects();
  bindEvents();
  renderAll();
  // O login pode ter avisado quem está conectado antes desta tela ficar pronta: reaplica
  const lastAuth = window.__cncAuthLast;
  if (lastAuth) window.dispatchEvent(new CustomEvent('cnc:auth-session', { detail: lastAuth.detail }));
  openFromLink();
}

// Links vindos das páginas públicas (/concurso/...) e do painel de admin
function openFromLink() {
  const params = new URLSearchParams(window.location.search);
  handleStripeReturn(params);
  const concursoId = params.get('concurso');
  if (concursoId && catalog.some((c) => c.id === concursoId)) openContestDetail(concursoId);
  if (params.has('entrar') && !state.user) openAuthModal('login');
  // Volta para a página de origem depois do login (só caminhos conhecidos deste site)
  const voltar = params.get('voltar');
  if (voltar && ['/admin', '/cancelamento.html'].includes(voltar)) {
    const destino = voltar;
    if (state.user) {
      if (destino !== '/admin' || state.user.role === 'admin') window.location.href = destino;
    } else {
      window.addEventListener('cnc:auth-login', () => setTimeout(() => { window.location.href = destino; }, 600), { once: true });
    }
  }
}

init();
