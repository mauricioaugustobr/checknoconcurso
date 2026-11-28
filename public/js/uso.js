/* Check no Concurso — contador de acessos próprio, sem cookies e sem identificar quem visita.
   Carregar no <head> com defer, em todas as páginas públicas (nunca no /admin).
   - Cada página aberta avisa o servidor (POST /api/uso), que só soma números por hora:
     visitas, páginas abertas e de onde a visita veio (anúncio, busca, link direto...).
     Vai só o nome do site anterior (ex.: l.instagram.com), nunca o endereço completo.
   - Quem está conectado também conta como conta ativa naquela hora; enquanto a pessoa usa o site,
     um novo aviso sai no máximo uma vez por hora.
   - No navegador fica só a marca de que esta visita já foi contada (sessionStorage 'cnc-visita',
     que some ao fechar a aba). Os gráficos ficam no painel de admin. */
(function () {
  'use strict';
  var host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || /^\/admin/.test(location.pathname)) return;
  if (navigator.webdriver || !window.fetch || !window.JSON) return;

  var CHAVE = 'cnc-visita';
  var semWww = function (h) { return String(h || '').replace(/^www\./, ''); };
  var refHost = '';
  try { refHost = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { refHost = ''; }
  // Veio de outra página do próprio site (inclusive numa aba nova): não é uma visita nova
  var interno = Boolean(refHost) && semWww(refHost) === semWww(host);
  var nova;
  try {
    nova = !sessionStorage.getItem(CHAVE) && !interno;
    sessionStorage.setItem(CHAVE, '1');
  } catch (e) {
    nova = !interno;
  }

  var dados = { t: 'pv', n: nova ? 1 : 0 };
  if (nova) {
    var p = new URLSearchParams(location.search);
    dados.u = (p.get('utm_source') || '').slice(0, 60);
    dados.m = (p.get('utm_medium') || '').slice(0, 60);
    dados.r = refHost.slice(0, 120);
    if (p.has('gclid') || p.has('gbraid') || p.has('wbraid')) dados.g = 1;
    if (p.has('fbclid')) dados.f = 1;
  }

  var conta = false;
  var horaAvisada = -1;
  var diferenca = 0; // relógio do servidor menos o do aparelho

  function enviar(corpo) {
    return fetch('/api/uso', {
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        if (typeof d.agora === 'number') diferenca = d.agora - Date.now();
        conta = Boolean(d.conta);
        if (conta && typeof d.h === 'number') horaAvisada = d.h;
      })
      .catch(function () { /* sem internet ou bloqueado: não atrapalha o site */ });
  }

  // Conta conectada em uso: avisa de novo quando a hora muda (no máximo 1 vez por hora)
  function talvezAtiva() {
    if (!conta || document.visibilityState !== 'visible') return;
    var h = Math.floor((Date.now() + diferenca) / 3600000);
    if (h === horaAvisada) return;
    horaAvisada = h;
    enviar({ t: 'ping' });
  }

  function comecar() {
    enviar(dados);
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, talvezAtiva, { passive: true, capture: true });
    });
    document.addEventListener('visibilitychange', talvezAtiva);
    // Entrou na conta nesta página: já conta como conta ativa nesta hora
    window.addEventListener('cnc:auth-login', function () { horaAvisada = -1; enviar({ t: 'ping' }); });
    window.addEventListener('cnc:auth-logout', function () { conta = false; });
  }

  // Página pré-carregada pelo navegador só conta quando a pessoa realmente abre
  if (document.prerendering) document.addEventListener('prerenderingchange', comecar, { once: true });
  else comecar();
})();
