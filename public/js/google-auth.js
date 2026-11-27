/**
 * Login com Google (front-end) — Check no Concurso.
 *
 * Usa o botão oficial do Google Identity Services. O token recebido do Google é
 * enviado ao servidor (/api/auth/google), que confere tudo e cria a sessão em cookie
 * HttpOnly. Este arquivo não guarda nenhum segredo: o Client ID do Google é público.
 *
 * Comunicação com o app.js por eventos de janela:
 *   cnc:auth-login   → login feito agora (detail = usuário)
 *   cnc:auth-session → sessão já existente ao abrir o site (detail = usuário ou null)
 *   cnc:auth-logout  → (ouvido aqui) encerra a sessão no servidor
 *   cnc:auth-error   → falha no login (detail = mensagem)
 */
const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiReady = null;
let clientId = null;

function emit(name, detail) {
  // Guarda o último aviso: o app.js pode ainda estar carregando e reaplica ao ficar pronto
  if (name === 'cnc:auth-session' || name === 'cnc:auth-login') {
    window.__cncAuthLast = { name, detail };
  }
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function loadGsi() {
  if (gsiReady) return gsiReady;
  gsiReady = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google);
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('GSI indisponível')));
    s.onerror = () => reject(new Error('Falha ao carregar o Google'));
    document.head.appendChild(s);
  });
  return gsiReady;
}

async function onCredential(response) {
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.user) throw new Error(data.error || 'Não foi possível entrar com o Google.');
    emit('cnc:auth-login', data.user);
  } catch (err) {
    emit('cnc:auth-error', err.message || 'Não foi possível entrar com o Google.');
  }
}

function renderOfficialButton(google) {
  const customBtn = document.getElementById('googleLoginBtn');
  if (!customBtn) return;
  let slot = document.getElementById('googleGsiSlot');
  if (!slot) {
    slot = document.createElement('div');
    slot.id = 'googleGsiSlot';
    slot.className = 'google-gsi-slot';
    slot.style.cssText = 'display:flex;justify-content:center;min-height:44px;width:100%;';
    customBtn.parentNode.insertBefore(slot, customBtn);
  }
  const width = Math.max(240, Math.min(400, Math.round(customBtn.getBoundingClientRect().width || slot.getBoundingClientRect().width || 320)));
  google.accounts.id.renderButton(slot, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'center',
    locale: 'pt-BR',
    width
  });
  // O botão oficial assume; o botão visual antigo fica guardado (oculto) como reserva.
  customBtn.hidden = true;
  customBtn.dataset.gsiReplaced = 'true';
}

async function init() {
  // 0. Configuração pública (Client ID do Google e se os pagamentos Stripe estão ligados)
  let cfg = window.__cncConfig || null;
  try {
    cfg = await (await fetch('/api/auth/config')).json();
    window.__cncConfig = cfg;
  } catch { /* offline */ }

  // 1. Restaura a sessão do servidor (se existir)
  try {
    const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
    const data = await res.json();
    // {offline:true} vem do Service Worker sem internet: não derruba a sessão local
    emit('cnc:auth-session', data.offline ? undefined : (data.user || null));
  } catch {
    emit('cnc:auth-session', undefined); // offline: mantém o estado local
  }

  // 2. Prepara o botão oficial do Google
  try {
    if (!cfg) cfg = window.__cncConfig = await (await fetch('/api/auth/config')).json();
    clientId = cfg.googleClientId;
    if (!clientId) return;
  } catch (err) {
    console.warn('[google-auth]', err.message);
    window.__cncGoogleUnavailable = true;
    return;
  }

  // O botão do Google só é desenhado quando a janela "Entrar" abre. Antes, ele era
  // desenhado em toda visita à página inicial, e o código do próprio Google gerava
  // um erro no console ("reading 'P'"), além de baixar o script para quem nunca entra.
  const modal = document.getElementById('authModal');
  if (!modal) {
    prepareGoogle().then(renderOfficialButton).catch(markUnavailable);
    return;
  }
  const showWhenOpen = () => {
    if (modal.hidden) return;
    prepareGoogle()
      .then((google) => requestAnimationFrame(() => renderOfficialButton(google)))
      .catch(markUnavailable);
  };
  new MutationObserver(showWhenOpen).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  showWhenOpen(); // a janela já pode estar aberta

  // Adianta só o download do script quando a pessoa vai clicar em "Entrar".
  const warm = () => { loadGsi().catch(() => {}); };
  ['headerLoginBtn', 'mobileAccountTab', 'freeSignupBtn'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerenter', warm, { once: true });
    el.addEventListener('touchstart', warm, { once: true, passive: true });
    el.addEventListener('focus', warm, { once: true });
  });
}

let gsiInitialized = null;
function prepareGoogle() {
  if (gsiInitialized) return gsiInitialized;
  window.__cncGoogleLoading = true;
  window.__cncGoogleUnavailable = false;
  gsiInitialized = loadGsi().then((google) => {
    google.accounts.id.initialize({
      client_id: clientId,
      callback: onCredential,
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
      use_fedcm_for_button: true
    });
    window.__cncGoogleLoading = false;
    return google;
  });
  // Se falhar, permite tentar de novo na próxima vez que a janela abrir.
  gsiInitialized.catch(() => { gsiInitialized = null; gsiReady = null; });
  return gsiInitialized;
}

function markUnavailable(err) {
  console.warn('[google-auth]', err && err.message);
  window.__cncGoogleLoading = false;
  window.__cncGoogleUnavailable = true;
}

window.addEventListener('cnc:auth-logout', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch { /* offline: o cookie expira sozinho */ }
  try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* ignore */ }
});

// Espera o app.js terminar de montar a página antes de anunciar a sessão.
if (document.readyState === 'complete') init();
else window.addEventListener('load', init, { once: true });
