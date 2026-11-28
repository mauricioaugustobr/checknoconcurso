/**
 * Item 11 · Prévia com cadeado para quem assina o Check Essencial.
 * Mostra um pedaço real do treino do Completo (matérias da prova e o enunciado de 1 questão),
 * com as alternativas, o gabarito e a explicação fechados, e o botão para subir de plano.
 * Os dados vêm de /api/prova-previa/:id, que nunca manda alternativas nem respostas.
 */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const num = (n) => Number(n || 0).toLocaleString('pt-BR');

const LOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

if (typeof document !== 'undefined' && !document.querySelector('link[data-cadeado-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/css/cadeado-essencial.css?v=1';
  link.dataset.cadeadoCss = '';
  document.head.appendChild(link);
}

/* ---------- Busca da prévia (uma vez por concurso) ---------- */
const cache = new Map();
export function previaPronta(id) {
  return cache.get(id)?.dados;
}
export function buscarPrevia(id) {
  if (!cache.has(id)) {
    const item = { dados: undefined };
    item.pedido = fetch(`/api/prova-previa/${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { item.dados = d && !d.error ? d : null; })
      .catch(() => { item.dados = null; });
    cache.set(id, item);
  }
  return cache.get(id).pedido;
}

/* ---------- Botões de subir de plano (os mesmos do checkout que já existe) ---------- */
export function botoesSubirHTML() {
  return `
    <div class="cad-ctas">
      <button type="button" class="cad-btn cad-btn-main" data-trigger-checkout="completo-anual">Subir para o Completo anual · R$ 199,90/ano</button>
      <button type="button" class="cad-btn cad-btn-line" data-trigger-checkout="completo-mensal">Mensal · R$ 23,99/mês</button>
    </div>
    <p class="cad-note">O anual equivale a R$ 16,66/mês. Você continua com tudo do Essencial.</p>`;
}

/* ---------- Aba de treino da ficha (Essencial) ---------- */
/**
 * c: concurso do catálogo · indice: PROVAS[c.id] (pode faltar) · previa: dados, null (sem prévia) ou undefined (carregando)
 */
export function cadeadoTreinoHTML(c, indice, previa) {
  const p = previa || null;
  const ano = p?.ano || indice?.ano || '';
  const banca = p?.banca || indice?.banca || '';
  const total = p?.total || indice?.total || 0;
  const cargo = p?.cargo || indice?.cargo || '';
  const resumo = [banca && ano ? `${banca} ${ano}` : (banca || ano), cargo, total ? `${num(total)} questões` : '']
    .filter(Boolean).map(esc).join(' · ');

  const materias = p?.materias?.length ? `
    <div class="cad-bloco">
      <p class="cad-rotulo">Matérias desta prova</p>
      <ul class="cad-materias">
        ${p.materias.map((m) => `<li><span>${esc(m.nome)}</span><strong>${num(m.questoes)}</strong></li>`).join('')}
        ${p.outrasMaterias ? `<li class="cad-mais"><span>Mais ${num(p.outrasMaterias)} ${p.outrasMaterias === 1 ? 'matéria' : 'matérias'}</span></li>` : ''}
      </ul>
    </div>` : '';

  const q = p?.questao;
  const questao = q ? `
    <div class="cad-bloco">
      <p class="cad-rotulo">Uma questão desta prova</p>
      <div class="cad-questao">
        <p class="cad-q-head">Questão ${esc(q.numero)} · ${esc(q.materia)}</p>
        <p class="cad-q-stem">${esc(q.enunciado)}</p>
        <ul class="cad-alts" aria-label="Alternativas fechadas">
          ${q.letras.map((l, i) => `<li><span class="cad-let">${esc(l)}</span><span class="cad-bar" aria-hidden="true" style="width:${[86, 72, 92, 64, 78][i % 5]}%"></span></li>`).join('')}
        </ul>
        <div class="cad-selo">${LOCK}<span>As alternativas, o gabarito oficial e a explicação em 3 parágrafos abrem no Check Completo.</span></div>
      </div>
    </div>` : '';

  const carregando = previa === undefined && indice ? '<p class="cad-carregando" role="status">Carregando a prévia da prova…</p>' : '';

  return `
    <section class="cad" aria-labelledby="cadTitulo">
      <span class="badge-gold">Exclusivo Check Completo</span>
      <h3 class="cad-titulo" id="cadTitulo">Você já tem o Essencial. Falta só o treino.</h3>
      <p class="cad-sub">${indice || p
        ? `Prova anterior de ${esc(c.sigla)}${resumo ? `: ${resumo}` : ''}. No Completo, você responde e confere cada questão pelo gabarito oficial, com a explicação logo abaixo.`
        : `No Completo, você treina com questões de provas anteriores: cada resposta mostra o gabarito oficial e uma explicação em 3 parágrafos.`}</p>
      ${carregando}
      ${materias}
      ${questao}
      ${botoesSubirHTML()}
    </section>`;
}

/* ---------- Faixa "Treinar" no topo da ficha (Essencial) ---------- */
export function faixaTreinoTravadaHTML(indice) {
  const detalhe = indice
    ? `Prova de ${esc(indice.ano)} · ${num(indice.total)} questões · ${esc(indice.banca)}. Disponível no Check Completo.`
    : 'Disponível no Check Completo, para concursos que já tiveram prova anterior.';
  return `
    <div class="train-now-text">
      <strong class="cad-faixa-titulo">${LOCK}<span>Treinar com questões de provas anteriores</span></strong>
      <span>${detalhe}</span>
    </div>
    <button type="button" class="train-now-btn cad-faixa-btn" id="trainNowTabBtn">${indice ? 'Ver prévia da prova' : 'Ver o que vem no Completo'}</button>`;
}
