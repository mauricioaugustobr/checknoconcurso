/* Check no Concurso — aviso de cookies + Google Analytics com consentimento.
   Carregar no <head> (script comum, sem módulo).
   - Na primeira visita mostra o aviso com "Aceitar" e "Recusar".
   - O Google Analytics só é carregado depois de "Aceitar" (Consent Mode v2 começa negado).
   - A escolha fica salva em localStorage 'cnc-cookies' ('aceito' | 'recusado').
   - window.cncCookies.abrir() reabre o aviso (link na Política de Privacidade). */
(function () {
  var KEY = 'cnc-cookies';
  var GA_ID = 'G-G2T0RE4XV8';
  var host = location.hostname;
  // Só mede no domínio oficial (não em prévias da Vercel nem no computador local).
  var MEDIR = host === 'checknoconcurso.com.br' || host === 'www.checknoconcurso.com.br';
  // Área do admin nunca é medida.
  if (/^\/admin/.test(location.pathname)) MEDIR = false;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });

  function lerEscolha() {
    try { var v = localStorage.getItem(KEY); return v === 'aceito' || v === 'recusado' ? v : null; } catch (e) { return null; }
  }
  function salvarEscolha(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
  }

  var gaCarregado = false;
  function carregarGA() {
    if (!MEDIR || gaCarregado) return;
    gaCarregado = true;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  }

  function apagarCookiesGA() {
    var nomes = document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); })
      .filter(function (n) { return n === '_ga' || n.indexOf('_ga_') === 0 || n === '_gid'; });
    var dominios = ['', '; domain=' + host, '; domain=.' + host.replace(/^www\./, '')];
    nomes.forEach(function (n) {
      dominios.forEach(function (d) { document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d; });
    });
  }

  var CSS =
    '.cnc-cookies{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:560px;margin:0 auto;' +
    'background:var(--bg-surface,#fff);color:var(--text-primary,#0F2236);border:1px solid var(--border-default,#C5D5E4);' +
    'border-radius:16px;box-shadow:0 12px 40px rgba(11,37,64,.22);padding:18px 18px 16px;font:400 14px/1.5 Inter,system-ui,sans-serif}' +
    '.cnc-cookies[hidden]{display:none}' +
    '.cnc-cookies h2{margin:0 0 6px;font:600 16px/1.3 Inter,system-ui,sans-serif;color:var(--text-primary,#0F2236)}' +
    '.cnc-cookies p{margin:0 0 14px;color:var(--text-secondary,#2E465E)}' +
    '.cnc-cookies a{color:var(--brand-primary,#0C4F83);text-decoration:underline}' +
    '.cnc-cookies .cnc-ck-acoes{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}' +
    '.cnc-cookies button{appearance:none;border-radius:10px;padding:10px 18px;font:600 14px/1 Inter,system-ui,sans-serif;cursor:pointer;min-height:42px}' +
    '.cnc-cookies .cnc-ck-recusar{background:transparent;color:var(--text-primary,#0F2236);border:1px solid var(--border-strong,#9DB3C8)}' +
    '.cnc-cookies .cnc-ck-aceitar{background:var(--brand-primary,#0C4F83);color:var(--text-on-brand,#fff);border:1px solid var(--brand-primary,#0C4F83)}' +
    '.cnc-cookies button:focus-visible{outline:3px solid var(--accent-border,#F4D632);outline-offset:2px}' +
    '@media (max-width:480px){.cnc-cookies{left:10px;right:10px;bottom:10px;padding:16px}.cnc-cookies .cnc-ck-acoes button{flex:1}}';

  var caixa = null;
  function montar() {
    if (caixa) return caixa;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    caixa = document.createElement('section');
    caixa.className = 'cnc-cookies';
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-live', 'polite');
    caixa.setAttribute('aria-labelledby', 'cnc-ck-titulo');
    caixa.hidden = true;
    caixa.innerHTML =
      '<h2 id="cnc-ck-titulo">Cookies no Check no Concurso</h2>' +
      '<p>Usamos cookies essenciais para manter você conectado e o site funcionando. Com a sua permissão, também usamos o Google Analytics para entender, de forma agregada, como o site é usado e melhorá-lo. ' +
      'Saiba mais na <a href="/privacidade.html#cookies">Política de Privacidade</a>.</p>' +
      '<div class="cnc-ck-acoes">' +
      '<button type="button" class="cnc-ck-recusar">Recusar</button>' +
      '<button type="button" class="cnc-ck-aceitar">Aceitar</button>' +
      '</div>';
    caixa.querySelector('.cnc-ck-aceitar').addEventListener('click', function () {
      salvarEscolha('aceito');
      fechar();
      carregarGA();
    });
    caixa.querySelector('.cnc-ck-recusar').addEventListener('click', function () {
      var antes = lerEscolha();
      salvarEscolha('recusado');
      fechar();
      apagarCookiesGA();
      // Se o Analytics já estava ligado nesta página, recarrega para desligar de vez.
      if (antes === 'aceito' && gaCarregado) location.reload();
    });
    document.body.appendChild(caixa);
    return caixa;
  }
  function abrir() {
    var c = montar();
    c.hidden = false;
  }
  function fechar() { if (caixa) caixa.hidden = true; }

  window.cncCookies = { abrir: function () { quandoPronto(abrir); }, escolha: lerEscolha };

  function quandoPronto(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  var escolha = lerEscolha();
  if (escolha === 'aceito') carregarGA();
  else if (escolha === null) quandoPronto(abrir);

  // Links "Preferências de cookies" em qualquer página: <a href="#cookies-preferencias">
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('[data-cookies-preferencias], a[href="#cookies-preferencias"]') : null;
    if (!a) return;
    e.preventDefault();
    abrir();
  });
})();
