/* Check no Concurso — modo noturno.
   Carregar no <head> (sem defer) para não piscar o tema claro.
   Padrão: segue o celular/computador da pessoa. A escolha no botão fica salva. */
(function () {
  var KEY = 'cnc-tema';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function saved() {
    try { var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; } catch (e) { return null; }
  }
  function current() { return saved() || (mq && mq.matches ? 'dark' : 'light'); }

  function syncPage(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0B2540' : '#0C4F83');
    var logos = document.querySelectorAll('img[src*="logo-horizontal-claro"], img[src*="logo-horizontal-escuro"]');
    for (var i = 0; i < logos.length; i++) {
      var src = logos[i].getAttribute('src');
      logos[i].setAttribute('src', theme === 'dark'
        ? src.replace('logo-horizontal-claro', 'logo-horizontal-escuro')
        : src.replace('logo-horizontal-escuro', 'logo-horizontal-claro'));
    }
    var btns = document.querySelectorAll('.theme-toggle');
    for (var j = 0; j < btns.length; j++) {
      var dark = theme === 'dark';
      btns[j].setAttribute('aria-pressed', dark ? 'true' : 'false');
      btns[j].setAttribute('aria-label', dark ? 'Desligar modo noturno' : 'Ligar modo noturno');
      btns[j].title = dark ? 'Modo claro' : 'Modo noturno';
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    syncPage(theme);
  }

  apply(current());

  if (mq) {
    var onChange = function () { if (!saved()) apply(current()); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  var ICONS =
    '<svg class="tt-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
    '<svg class="tt-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/></svg>';

  function makeButton() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-toggle';
    b.innerHTML = ICONS;
    b.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
      apply(next);
    });
    return b;
  }

  function mount() {
    if (document.querySelector('.theme-toggle')) return;
    var b = makeButton();
    var spot;
    if ((spot = document.querySelector('.site-header .header-actions'))) {
      spot.insertBefore(b, spot.firstChild);
    } else if ((spot = document.querySelector('.pg-header .pg-nav'))) {
      spot.insertBefore(b, spot.querySelector('.pg-cta'));
    } else if ((spot = document.querySelector('.exam-header-row'))) {
      spot.insertBefore(b, spot.querySelector('.exam-back'));
    } else if ((spot = document.querySelector('.pay-header .inner'))) {
      spot.appendChild(b);
    } else if ((spot = document.querySelector('body > header .wrap'))) {
      spot.appendChild(b);
    } else {
      b.classList.add('theme-toggle-floating');
      document.body.appendChild(b);
    }
    syncPage(root.getAttribute('data-theme'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
