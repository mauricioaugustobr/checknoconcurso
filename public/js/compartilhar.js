/**
 * Item 7 · Botão "Compartilhar" do concurso (Opção 1 da Designer UI/UX).
 *
 * botaoCompartilharHTML() desenha o botão como texto HTML (servidor e navegador):
 *  - variante 'pagina': botão com texto no topo da página pública (computador) + menu
 *    (prévia da imagem, WhatsApp, Copiar link, Imagem para Stories);
 *  - variante 'celular': 2 botões de 48 px ("Compartilhar" abre a janela do aparelho; "Stories");
 *  - variante 'ficha': ícone entre Salvar e ✕ na ficha do concurso (menu no computador,
 *    janela do aparelho no celular).
 * No navegador, ligarCompartilhar() cuida dos cliques (uma vez só, por delegação).
 * Medição no GA4 só para quem aceitou os cookies. Nada aqui chama a IA.
 */
const esc = (v) => String(v ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const ICONE = {
  compartilhar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
  whatsapp: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21l1.65-3.8A9 9 0 1 1 7.8 20.3L3 21"/></svg>',
  link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  stories: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5"/><line x1="11" y1="18" x2="13" y2="18"/></svg>'
};

const atributos = (d) => [
  ['data-compartilhar', d.id], ['data-sigla', d.sigla], ['data-link', d.link], ['data-mensagem', d.mensagem],
  ['data-previa', d.previa], ['data-stories', d.stories], ['data-arquivo', d.arquivo]
].map(([k, v]) => `${k}="${esc(v)}"`).join(' ');

function menuHTML(d, uid) {
  return `<div class="cmp-menu" id="${uid}" role="dialog" aria-label="Compartilhar ${esc(d.sigla)}" hidden>
      <p class="cmp-menu-titulo">Compartilhar ${esc(d.sigla)}</p>
      <img class="cmp-previa" data-src="${esc(d.previa)}" alt="Imagem de prévia do concurso ${esc(d.sigla)}" width="1200" height="630">
      <p class="cmp-legenda">Assim o link aparece no WhatsApp e no Telegram.</p>
      <a class="cmp-opcao" data-cmp="whatsapp" href="https://wa.me/?text=${encodeURIComponent(d.mensagem)}" target="_blank" rel="noopener">${ICONE.whatsapp}<span>WhatsApp</span><small>abre com a mensagem</small></a>
      <button type="button" class="cmp-opcao" data-cmp="copiar">${ICONE.link}<span>Copiar link</span></button>
      <button type="button" class="cmp-opcao" data-cmp="stories">${ICONE.stories}<span>Imagem para Stories</span><small>imagem em pé</small></button>
      <div class="cmp-falha" hidden><p>Não deu para copiar. Selecione o link abaixo e copie.</p><input type="text" readonly value="${esc(d.link)}" aria-label="Link do concurso"></div>
    </div>`;
}

let contador = 0;
/** HTML do botão. d = dadosBotao(c) de compartilhar-dados.js. */
export function botaoCompartilharHTML(d, { variante = 'pagina' } = {}) {
  if (!d || !d.id) return '';
  const uid = `cmp-menu-${variante}-${++contador}`;
  if (variante === 'celular') {
    return `<div class="cmp cmp-celular" ${atributos(d)}>
      <button type="button" class="cmp-btn" data-cmp="nativo" aria-label="Compartilhar o concurso ${esc(d.sigla)}">${ICONE.compartilhar}<span>Compartilhar</span></button>
      <button type="button" class="cmp-btn" data-cmp="stories" aria-label="Imagem do concurso ${esc(d.sigla)} para Stories">${ICONE.stories}<span>Stories</span></button>
    </div>`;
  }
  if (variante === 'ficha') {
    return `<div class="cmp cmp-ficha" ${atributos(d)}>
      <button type="button" class="icon-btn cmp-btn-ficha" data-cmp="abrir" aria-expanded="false" aria-controls="${uid}" aria-label="Compartilhar o concurso ${esc(d.sigla)}" title="Compartilhar">${ICONE.compartilhar}<span class="cmp-copiado" hidden>✓ Link copiado</span></button>
      ${menuHTML(d, uid)}
    </div>`;
  }
  return `<div class="cmp cmp-pagina" ${atributos(d)}>
      <button type="button" class="cmp-btn" data-cmp="abrir" aria-expanded="false" aria-controls="${uid}" aria-label="Compartilhar o concurso ${esc(d.sigla)}">${ICONE.compartilhar}<span class="cmp-rotulo">Compartilhar</span><span class="cmp-copiado" hidden>✓ Link copiado</span></button>
      ${menuHTML(d, uid)}
    </div>`;
}

/* ---------------- Navegador ---------------- */
function medir(metodo, id) {
  try {
    if (localStorage.getItem('cnc-cookies') !== 'aceito' || typeof window.gtag !== 'function') return;
    window.gtag('event', 'compartilhar', { metodo, concurso: id });
  } catch { /* sem medição */ }
}

function avisar(texto) {
  let el = document.getElementById('cmpAviso');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cmpAviso';
    el.className = 'cmp-aviso';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = '';
  // Pequena pausa para o leitor de tela anunciar de novo o mesmo texto
  setTimeout(() => { el.textContent = texto; el.classList.add('is-on'); }, 30);
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.classList.remove('is-on'); setTimeout(() => { el.textContent = ''; }, 250); }, 3500);
}

const ehCelular = () => window.matchMedia('(max-width: 720px), (pointer: coarse)').matches;

function fecharMenus(exceto) {
  document.querySelectorAll('.cmp-menu:not([hidden])').forEach((m) => {
    if (m === exceto) return;
    m.hidden = true;
    m.closest('.cmp')?.querySelector('[data-cmp="abrir"]')?.setAttribute('aria-expanded', 'false');
  });
}

function abrirMenu(raiz, botao) {
  const menu = raiz.querySelector('.cmp-menu');
  if (!menu) return;
  const abrir = menu.hidden;
  fecharMenus(menu);
  menu.hidden = !abrir;
  botao.setAttribute('aria-expanded', String(abrir));
  if (abrir) {
    const img = menu.querySelector('.cmp-previa');
    if (img && !img.getAttribute('src')) img.src = img.dataset.src;
    menu.querySelector('.cmp-falha').hidden = true;
    setTimeout(() => menu.querySelector('.cmp-opcao')?.focus(), 20);
  }
}

function mostrarCopiado(raiz) {
  const b = raiz.querySelector('[data-cmp="abrir"]');
  if (!b) return;
  const rot = b.querySelector('.cmp-rotulo');
  const ok = b.querySelector('.cmp-copiado');
  b.classList.add('is-copiado');
  if (rot) rot.hidden = true;
  if (ok) ok.hidden = false;
  clearTimeout(b._t);
  b._t = setTimeout(() => { b.classList.remove('is-copiado'); if (rot) rot.hidden = false; if (ok) ok.hidden = true; }, 3000);
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}

// Imagem do Stories guardada em memória (pedida antes, para o toque não perder a permissão de compartilhar)
const cacheStories = new Map();
function pegarStories(url) {
  if (!cacheStories.has(url)) cacheStories.set(url, fetch(url).then((r) => (r.ok ? r.blob() : Promise.reject(new Error('imagem')))).catch((e) => { cacheStories.delete(url); throw e; }));
  return cacheStories.get(url);
}

function baixar(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function stories(raiz) {
  const d = raiz.dataset;
  fecharMenus();
  const linkCopiado = await copiar(d.link);
  try {
    const blob = await pegarStories(d.stories);
    const arquivo = new File([blob], d.arquivo || 'checknoconcurso-stories.png', { type: 'image/png' });
    if (ehCelular() && navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo] });
        medir('stories', d.compartilhar);
        if (linkCopiado) avisar('Imagem pronta. O link foi copiado: no Stories, use o adesivo Link e cole.');
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // a pessoa fechou a janela
      }
    }
    baixar(blob, arquivo.name);
    medir('stories-download', d.compartilhar);
    avisar(linkCopiado ? 'Imagem baixada. O link foi copiado: no Stories, use o adesivo Link e cole.' : 'Imagem baixada.');
  } catch {
    avisar('Não foi possível preparar a imagem agora. Tente de novo.');
  }
}

async function nativo(raiz) {
  const d = raiz.dataset;
  if (navigator.share) {
    try {
      await navigator.share({ title: `Concurso ${d.sigla}`, text: d.mensagem });
      medir('nativo', d.compartilhar);
    } catch { /* a pessoa fechou a janela */ }
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(d.mensagem)}`, '_blank', 'noopener');
  medir('whatsapp', d.compartilhar);
}

let ligado = false;
export function ligarCompartilhar() {
  if (ligado || typeof document === 'undefined') return;
  ligado = true;

  document.addEventListener('click', async (e) => {
    const alvo = e.target.closest('[data-cmp]');
    if (!alvo) {
      if (!e.target.closest('.cmp-menu')) fecharMenus();
      return;
    }
    const raiz = alvo.closest('.cmp');
    if (!raiz) return;
    const acao = alvo.dataset.cmp;
    if (acao === 'abrir') {
      e.preventDefault();
      // Ficha no celular: janela de compartilhar do próprio aparelho
      if (raiz.classList.contains('cmp-ficha') && ehCelular() && navigator.share) return nativo(raiz);
      return abrirMenu(raiz, alvo);
    }
    if (acao === 'whatsapp') { medir('whatsapp', raiz.dataset.compartilhar); fecharMenus(); return; }
    if (acao === 'copiar') {
      e.preventDefault();
      if (await copiar(raiz.dataset.link)) {
        fecharMenus();
        mostrarCopiado(raiz);
        avisar('Link copiado.');
        medir('copiar', raiz.dataset.compartilhar);
      } else {
        const falha = raiz.querySelector('.cmp-falha');
        if (falha) { falha.hidden = false; const i = falha.querySelector('input'); i.focus(); i.select(); }
      }
      return;
    }
    if (acao === 'stories') { e.preventDefault(); return stories(raiz); }
    if (acao === 'nativo') { e.preventDefault(); return nativo(raiz); }
  });

  // Esc fecha o menu antes de fechar a ficha
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const aberto = document.querySelector('.cmp-menu:not([hidden])');
    if (!aberto) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const botao = aberto.closest('.cmp')?.querySelector('[data-cmp="abrir"]');
    fecharMenus();
    botao?.focus();
  }, true);

  // Celular: pede a imagem do Stories antes do toque (a janela de compartilhar exige o toque "fresco")
  const preparar = () => document.querySelectorAll('.cmp-celular[data-stories]').forEach((r) => {
    if (ehCelular() && navigator.canShare) pegarStories(r.dataset.stories).catch(() => {});
  });
  if ('requestIdleCallback' in window) requestIdleCallback(preparar, { timeout: 4000 });
  else setTimeout(preparar, 2500);
}

if (typeof document !== 'undefined') ligarCompartilhar();
