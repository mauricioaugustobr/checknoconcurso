/**
 * Painel de ADMIN — Check no Concurso.
 * Toda permissão é conferida no servidor (/api/admin/*). Esta tela só mostra e envia dados.
 */
import { renderMarkdown, slugify, escapeHtml as esc } from '/js/markdown.js?v=1';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const num = (n) => Number(n || 0).toLocaleString('pt-BR');
const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');
const quando = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

let meta = { campos: {}, status: [] };
let editingConcurso = null;
let editingPost = null;

function toast(msg) {
  const t = $('#adToast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 3200);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

/* ---------------- Acesso ---------------- */
async function boot() {
  let user = null;
  try { user = (await api('/api/auth/session')).user; } catch { /* sem sessão */ }
  if (!user || user.role !== 'admin') {
    $('#adGate').hidden = false;
    if (user) $('#adGateMsg').textContent = `Você entrou como ${user.email}, que não é administrador.`;
    return;
  }
  $('#adUser').textContent = `${user.name || user.email} · admin`;
  $('#adApp').hidden = false;
  bindTabs();
  bindConcursos();
  bindPosts();
  bindUsers();
  bindNotas();
  openTab(location.hash.replace('#', '') || 'geral');
}

/* ---------------- Abas ---------------- */
const loaders = { geral: loadOverview, concursos: loadConcursos, blog: loadPosts, usuarios: loadUsers, notas: loadNotas, cancelamentos: loadCancelamentos, registro: loadAudit };

function openTab(name) {
  if (!loaders[name]) name = 'geral';
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  history.replaceState(null, '', `#${name}`);
  loaders[name]().catch((err) => toast(err.message));
}

function bindTabs() {
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tab)));
  $$('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
}

/* ---------------- Visão geral ---------------- */
async function loadOverview() {
  const d = await api('/api/admin/overview');
  $('#adNoDb').hidden = d.banco;
  const cards = [
    ['Concursos no site', num(d.concursos.total)],
    ['Inscrições abertas', num(d.concursos.inscricoesAbertas)],
    ['Vagas imediatas', num(d.concursos.vagas)],
    ['Editados / ocultos', `${num(d.concursos.editados)} / ${num(d.concursos.ocultos)}`],
    ['Usuários (Google)', num(d.usuarios.total)],
    ['Novos em 7 dias', num(d.usuarios.ultimos7)],
    ['Posts publicados', num(d.blog.publicados)],
    ['Rascunhos', num(d.blog.rascunhos)]
  ];
  $('#adStats').innerHTML = cards.map(([k, v]) => `<div class="ad-card"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
  const venc = d.concursos.prazoVencido;
  $('#adVencidos').innerHTML = venc.length
    ? venc.map((c) => `<li><span><strong>${esc(c.sigla)}</strong> · ${esc(c.uf)} · inscrições até ${dia(c.inscricaoFim)}</span><button type="button" class="ad-link" data-edit-concurso="${esc(c.id)}">Atualizar</button></li>`).join('')
    : '<li class="ad-muted">Nenhum. Tudo em dia.</li>';
}

/* ---------------- Concursos ---------------- */
function bindConcursos() {
  $('#adConcFilters').addEventListener('submit', (e) => { e.preventDefault(); loadConcursos(); });
  $('#adConcFiltro').addEventListener('change', () => loadConcursos());
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit-concurso]');
    if (b) openConcurso(b.dataset.editConcurso);
  });
  $('#adConcForm').addEventListener('submit', saveConcurso);
  $('#adConcReset').addEventListener('click', resetConcurso);
}

async function loadConcursos() {
  const params = new URLSearchParams();
  const q = $('#adConcQ').value.trim();
  const f = $('#adConcFiltro').value;
  if (q) params.set('q', q);
  if (f) params.set('filtro', f);
  const d = await api(`/api/admin/concursos?${params}`);
  meta = { campos: d.campos, status: d.status };
  $('#adConcCount').textContent = d.total > d.items.length ? `${num(d.total)} encontrados (mostrando ${d.items.length}). Use a busca para achar outros.` : `${num(d.total)} encontrados.`;
  $('#adConcRows').innerHTML = d.items.map((c) => `<tr class="${c._admin?.hidden ? 'is-hidden' : ''}">
      <td><strong>${esc(c.sigla)}</strong><br><span class="ad-muted">${esc(c.orgao)}</span>${c._admin ? `<br><span class="ad-pill">${c._admin.hidden ? 'Oculto' : 'Editado'}</span>` : ''}</td>
      <td>${esc(c.uf)}</td><td>${esc(c.status)}</td><td>${dia(c.inscricaoFim)}</td><td>${dia(c.dataProva)}</td>
      <td><button type="button" class="ad-link" data-edit-concurso="${esc(c.id)}">Editar</button></td></tr>`).join('')
    || '<tr><td colspan="6" class="ad-muted">Nenhum concurso encontrado.</td></tr>';
}

const LABELS = {
  status: 'Status', titulo: 'Título', banca: 'Banca', provaObservacao: 'Observação da prova',
  inscricaoInicio: 'Inscrições: início', inscricaoFim: 'Inscrições: fim', dataProva: 'Data da prova',
  vagas: 'Vagas imediatas', vagasCR: 'Cadastro reserva', salarioMin: 'Salário mínimo (R$)', salarioMax: 'Salário máximo (R$)', taxaInscricao: 'Taxa de inscrição (R$)'
};

async function openConcurso(id) {
  const d = await api(`/api/admin/concursos?id=${encodeURIComponent(id)}`);
  meta = { campos: d.campos, status: d.status };
  const c = d.item;
  editingConcurso = c;
  $('#adConcTitle').textContent = `Editar ${c.sigla}`;
  $('#adConcSub').textContent = `${c.orgao} · ${c.uf}${c._admin ? ` · última edição por ${c._admin.updatedBy || '—'} em ${quando(c._admin.updatedAt)}` : ''}`;
  $('#adConcFields').innerHTML = Object.entries(meta.campos).map(([campo, tipo]) => {
    const v = c[campo] ?? '';
    const label = esc(LABELS[campo] || campo);
    if (tipo === 'status') return `<label>${label}<select name="${campo}">${meta.status.map((s) => `<option ${s === v ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>`;
    if (tipo === 'data') return `<label>${label}<input type="date" name="${campo}" value="${esc(v || '')}"></label>`;
    if (tipo === 'numero') return `<label>${label}<input type="number" min="0" step="0.01" name="${campo}" value="${esc(v)}"></label>`;
    return `<label class="${campo === 'titulo' || campo === 'provaObservacao' ? 'ad-span2' : ''}">${label}<input name="${campo}" maxlength="300" value="${esc(v)}"></label>`;
  }).join('');
  $('#adConcHidden').checked = Boolean(c._admin?.hidden);
  $('#adConcView').href = `/concurso/${encodeURIComponent(c.id)}`;
  $('#adConcReset').hidden = !c._admin;
  $('#adConcError').hidden = true;
  $('#adConcDialog').showModal();
}

async function saveConcurso(e) {
  e.preventDefault();
  const form = $('#adConcForm');
  const data = {};
  for (const campo of Object.keys(meta.campos)) {
    const el = form.elements[campo];
    if (!el) continue;
    const original = editingConcurso[campo] ?? '';
    if (String(el.value) !== String(original)) data[campo] = el.value === '' ? null : el.value;
  }
  try {
    await api(`/api/admin/concursos?id=${encodeURIComponent(editingConcurso.id)}`, { method: 'PUT', body: { data: { ...(editingConcurso._admin ? pickCampos(editingConcurso) : {}), ...data }, hidden: $('#adConcHidden').checked } });
    $('#adConcDialog').close();
    toast('Concurso salvo. No site, a mudança aparece em até 2 minutos.');
    loadConcursos().catch(() => {});
    if (!$('[data-panel="geral"]').hidden) loadOverview().catch(() => {});
  } catch (err) {
    $('#adConcError').textContent = err.message;
    $('#adConcError').hidden = false;
  }
}

// Ao editar de novo, mantém só os campos que já tinham sido editados antes
function pickCampos(c) {
  return { ...((c._admin && c._admin.data) || {}) };
}

async function resetConcurso() {
  if (!editingConcurso || !confirm(`Desfazer todas as edições de ${editingConcurso.sigla} e voltar aos dados originais?`)) return;
  try {
    await api(`/api/admin/concursos?id=${encodeURIComponent(editingConcurso.id)}`, { method: 'DELETE' });
    $('#adConcDialog').close();
    toast('Edições desfeitas.');
    loadConcursos().catch(() => {});
  } catch (err) { toast(err.message); }
}

/* ---------------- Blog ---------------- */
function bindPosts() {
  $('#adNewPost').addEventListener('click', () => openPost(null));
  $('#adPostRows').addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit-post]');
    if (b) openPost(Number(b.dataset.editPost));
  });
  $('#adPostMd').addEventListener('input', updatePreview);
  $('#adPostForm').elements.title.addEventListener('input', (e) => {
    const slug = $('#adPostForm').elements.slug;
    if (!editingPost && !slug.dataset.touched) slug.placeholder = slugify(e.target.value);
  });
  $('#adPostForm').elements.slug.addEventListener('input', (e) => { e.target.dataset.touched = '1'; });
  $('#adPostDraft').addEventListener('click', () => savePost('draft'));
  $('#adPostPublish').addEventListener('click', () => savePost('published'));
  $('#adPostDelete').addEventListener('click', removePost);
}

function updatePreview() {
  $('#adPostPreview').innerHTML = renderMarkdown($('#adPostMd').value) || '<p class="ad-muted">O texto aparece aqui enquanto você escreve.</p>';
}

async function loadPosts() {
  const { posts } = await api('/api/admin/posts');
  $('#adPostRows').innerHTML = posts.map((p) => `<tr>
      <td><strong>${esc(p.title)}</strong><br><span class="ad-muted">/blog/${esc(p.slug)}</span></td>
      <td><span class="ad-pill ${p.status === 'published' ? 'is-ok' : ''}">${p.status === 'published' ? 'Publicado' : 'Rascunho'}</span></td>
      <td>${quando(p.published_at || p.updated_at)}</td>
      <td class="ad-nowrap"><button type="button" class="ad-link" data-edit-post="${p.id}">Editar</button>${p.status === 'published' ? ` · <a class="ad-link" href="/blog/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">Ver</a>` : ''}</td></tr>`).join('')
    || '<tr><td colspan="4" class="ad-muted">Nenhum post ainda. Clique em "+ Novo post".</td></tr>';
}

async function openPost(id) {
  const form = $('#adPostForm');
  form.reset();
  delete form.elements.slug.dataset.touched;
  editingPost = null;
  if (id) {
    const { post } = await api(`/api/admin/posts?id=${id}`);
    editingPost = post;
    for (const k of ['title', 'slug', 'excerpt', 'cover_url', 'seo_title', 'seo_description', 'content_md']) form.elements[k].value = post[k] || '';
    form.elements.tags.value = (post.tags || []).join(', ');
    form.elements.slug.dataset.touched = '1';
  }
  $('#adPostTitle').textContent = id ? 'Editar post' : 'Novo post';
  $('#adPostDelete').hidden = !id;
  $('#adPostPublish').textContent = editingPost?.status === 'published' ? 'Salvar e manter publicado' : 'Publicar';
  $('#adPostDraft').textContent = editingPost?.status === 'published' ? 'Voltar para rascunho' : 'Salvar rascunho';
  $('#adPostError').hidden = true;
  updatePreview();
  $('#adPostDialog').showModal();
}

async function savePost(status) {
  const f = $('#adPostForm').elements;
  const body = {
    title: f.title.value, slug: f.slug.value || slugify(f.title.value), excerpt: f.excerpt.value,
    tags: f.tags.value, cover_url: f.cover_url.value, seo_title: f.seo_title.value,
    seo_description: f.seo_description.value, content_md: f.content_md.value, status
  };
  if (!body.title.trim()) { $('#adPostError').textContent = 'Escreva um título.'; $('#adPostError').hidden = false; return; }
  try {
    const path = editingPost ? `/api/admin/posts?id=${editingPost.id}` : '/api/admin/posts';
    const { post } = await api(path, { method: editingPost ? 'PUT' : 'POST', body });
    $('#adPostDialog').close();
    toast(status === 'published' ? `Publicado em /blog/${post.slug} (no ar em até 2 minutos)` : 'Rascunho salvo.');
    loadPosts().catch(() => {});
  } catch (err) {
    $('#adPostError').textContent = err.message;
    $('#adPostError').hidden = false;
  }
}

async function removePost() {
  if (!editingPost || !confirm(`Excluir o post "${editingPost.title}"? Isso não pode ser desfeito.`)) return;
  try {
    await api(`/api/admin/posts?id=${editingPost.id}`, { method: 'DELETE' });
    $('#adPostDialog').close();
    toast('Post excluído.');
    loadPosts().catch(() => {});
  } catch (err) { toast(err.message); }
}

/* ---------------- Usuários e registro ---------------- */
const NOME_PLANO = { essencial: 'Essencial', 'completo-mensal': 'Completo mensal', 'completo-anual': 'Completo anual', completo: 'Completo' };
const SITUACAO_ACESSO = {
  admin: ['Admin', 'is-ok'], liberado: ['Liberado', 'is-ok'], bloqueado: ['Bloqueado', 'is-danger'], 'sem-plano': ['Sem plano', '']
};

function celulaSituacao(s) {
  const [rotulo, cls] = SITUACAO_ACESSO[s.acesso] || [s.acesso, ''];
  const plano = s.plano ? ` · ${esc(NOME_PLANO[s.plano] || s.plano)}` : '';
  const ate = s.ate ? `<br><span class="ad-muted">até ${dia(s.ate)}</span>` : '';
  return `<span class="ad-pill ${cls}">${rotulo}</span>${plano}<br><span class="ad-muted">${esc(s.origem || '')}</span>${ate}`;
}

function celulaPago(p) {
  if (!p.totalCentavos) return '<span class="ad-muted">Nada pago</span>';
  const partes = [];
  if (p.pixCentavos) partes.push(`Pix ${brl(p.pixCentavos / 100)} (${p.pixPagamentos}x)`);
  if (p.cartaoCentavos) partes.push(`Cartão ${brl(p.cartaoCentavos / 100)} (${p.cartaoPagamentos}x)${p.cartaoReal ? '' : ' · teste'}`);
  return `<strong>${brl(p.totalCentavos / 100)}</strong><br><span class="ad-muted">${partes.join(' · ')}</span>${p.ultimo ? `<br><span class="ad-muted">último em ${dia(p.ultimo)}</span>` : ''}`;
}

function valorAtual(u) {
  if (!u.regra) return 'automatico';
  if (u.regra.modo === 'bloqueado') return 'bloquear';
  return u.regra.tier === 'essencial' ? 'liberar-essencial' : 'liberar-completo';
}

function celulaAcao(u) {
  if (u.situacao.acesso === 'admin') return '<span class="ad-muted">—</span>';
  const v = valorAtual(u);
  const opt = (val, txt) => `<option value="${val}"${v === val ? ' selected' : ''}>${txt}</option>`;
  const ate = u.regra?.ate ? String(u.regra.ate).slice(0, 10) : '';
  return `<form class="ad-user-acao" data-email="${esc(u.email)}">
      <select name="acao" aria-label="Acesso de ${esc(u.email)}">
        ${opt('automatico', 'Automático (pelo pagamento)')}${opt('liberar-essencial', 'Liberar Essencial')}${opt('liberar-completo', 'Liberar Completo')}${opt('bloquear', 'Bloquear')}
      </select>
      <label class="ad-user-ate" ${v.startsWith('liberar') ? '' : 'hidden'}>até <input type="date" name="ate" value="${ate}" aria-label="Liberado até (vazio = sem prazo)"></label>
      <button type="submit" class="ad-btn ad-btn-sm">Salvar</button>
      ${u.regra?.nota ? `<span class="ad-muted">${esc(u.regra.nota)}</span>` : ''}
    </form>`;
}

async function loadUsers() {
  const { users } = await api('/api/admin/users');
  const resumo = users.reduce((a, u) => { a[u.situacao.acesso] = (a[u.situacao.acesso] || 0) + 1; a.total += u.pago.totalCentavos; return a; }, { total: 0 });
  const r = $('#adUserResumo');
  if (r) r.textContent = `${num(users.length)} cadastros · ${num(resumo.liberado || 0)} com acesso · ${num(resumo['sem-plano'] || 0)} sem plano · ${num(resumo.bloqueado || 0)} bloqueados · ${brl(resumo.total / 100)} recebidos`;
  $('#adUserRows').innerHTML = users.map((u) => `<tr>
      <td>${esc(u.name || '—')}<br><span class="ad-muted">${esc(u.email)}</span></td>
      <td>${celulaSituacao(u.situacao)}</td>
      <td>${celulaPago(u.pago)}</td>
      <td>${celulaAcao(u)}</td>
      <td class="ad-nowrap">${num(u.logins)}x<br><span class="ad-muted">${quando(u.last_login_at)}</span></td></tr>`).join('')
    || '<tr><td colspan="5" class="ad-muted">Ninguém entrou com o Google ainda.</td></tr>';
}

function bindUsers() {
  const rows = $('#adUserRows');
  rows.addEventListener('change', (e) => {
    if (e.target.name !== 'acao') return;
    const label = e.target.closest('form').querySelector('.ad-user-ate');
    label.hidden = !e.target.value.startsWith('liberar');
  });
  rows.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.dataset.email;
    const escolha = form.acao.value;
    const [acao, plano] = escolha.split('-');
    let nota = '';
    if (acao === 'bloquear') {
      if (!confirm(`Bloquear ${email}? A pessoa perde o acesso mesmo que tenha pago e não consegue comprar. A cobrança do cartão NÃO é cancelada por aqui.`)) return;
      nota = prompt('Motivo do bloqueio (opcional):') || '';
    } else if (acao === 'liberar') {
      nota = prompt(`Motivo da liberação de ${email} (opcional):`) || '';
    }
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      await api('/api/admin/users', { method: 'POST', body: { email, acao: acao === 'automatico' ? 'automatico' : acao, plano, ate: acao === 'liberar' ? form.ate.value : '', nota } });
      toast(acao === 'bloquear' ? 'Usuário bloqueado.' : acao === 'liberar' ? 'Acesso liberado.' : 'Voltou ao automático (pelo pagamento).');
      await loadUsers();
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });
}

/* ---------------- Cancelamentos ---------------- */
const SITUACAO_CANCEL = {
  pendente: 'Pendente',
  cancelado: 'Cancelado no site',
  nao_renova: 'Pix sem renovação'
};

async function loadCancelamentos() {
  const { items } = await api('/api/admin/cancelamentos');
  $('#adCancelRows').innerHTML = items.map((c) => `<tr>
      <td class="ad-nowrap">${quando(c.requested_at)}</td>
      <td>${esc(c.email)}${c.name ? `<br><span class="ad-muted">${esc(c.name)}</span>` : ''}</td>
      <td>${esc(c.method || '—')}</td>
      <td><span class="ad-pill ${c.status === 'pendente' ? 'is-danger' : 'is-ok'}">${esc(SITUACAO_CANCEL[c.status] || c.status)}</span></td>
      <td class="ad-nowrap">${quando(c.access_until)}</td>
      <td>${esc(c.note || '—')}</td></tr>`).join('')
    || '<tr><td colspan="6" class="ad-muted">Nenhum pedido de cancelamento ainda.</td></tr>';
}

const ACOES = {
  'concurso.editar': 'editou o concurso', 'concurso.ocultar': 'ocultou o concurso', 'concurso.restaurar': 'desfez as edições do concurso',
  'post.criar': 'criou o post', 'post.editar': 'editou o post', 'post.excluir': 'excluiu o post',
  'usuario.liberar': 'liberou o acesso de', 'usuario.bloquear': 'bloqueou', 'usuario.automatico': 'voltou ao automático o acesso de',
  'nota.emitida': 'marcou nota emitida do pagamento', 'nota.desmarcada': 'desfez a marcação de nota do pagamento'
};

/* ---------------- Notas a emitir (a nota é feita à mão; aqui só a marcação) ---------------- */
let filtroNotas = 'pendentes';
const PLANO_NOTA = { essencial: 'Essencial mensal', 'completo-mensal': 'Completo mensal', 'completo-anual': 'Completo anual' };
const itensNotas = new Map();
// Mensagem pronta para pedir os dados da nota por e-mail ou WhatsApp (você revisa antes de enviar)
const ASSUNTO_NOTA = 'Dados para a sua nota fiscal - Check no Concurso';
const PEDIDO_NOTA = 'Olá! Aqui é do Check no Concurso. Obrigado pela assinatura! Para emitir a sua nota fiscal, pode confirmar o seu nome completo e o CPF (ou o CNPJ e a razão social, se for empresa)?';
const EMAIL_LINK_OK = /^[^\s"'<>?&#]+@[^\s"'<>?&#]+$/;

function contatoNota(n) {
  const email = n.email
    ? (EMAIL_LINK_OK.test(n.email)
      ? `<a href="mailto:${esc(n.email)}?subject=${encodeURIComponent(ASSUNTO_NOTA)}&amp;body=${encodeURIComponent(PEDIDO_NOTA)}">${esc(n.email)}</a>`
      : `<span>${esc(n.email)}</span>`)
    : '<span class="ad-muted">sem e-mail</span>';
  const zap = n.whatsapp
    ? (n.whatsappLink
      ? `<a href="${esc(n.whatsappLink)}?text=${encodeURIComponent(PEDIDO_NOTA)}" target="_blank" rel="noopener">WhatsApp ${esc(n.whatsapp)}</a>`
      : `<span>WhatsApp ${esc(n.whatsapp)}</span>`)
    : '<span class="ad-muted">sem WhatsApp</span>';
  const conta = n.conta && n.conta !== n.email ? `<span class="ad-muted">conta no site: ${esc(n.conta)}</span>` : '';
  return `${email}${zap}${conta}`;
}

/** Texto com todos os dados do pagamento, para colar no emissor de nota. */
function textoNota(n) {
  return [
    `Nome: ${n.nome || '(não informado)'}`,
    `${n.tipoDocumento || 'CPF'}: ${n.cpf || '(não informado)'}`,
    `E-mail: ${n.email || '(não informado)'}`,
    `WhatsApp: ${n.whatsapp || '(não informado)'}`,
    ...(n.conta && n.conta !== n.email ? [`Conta no site: ${n.conta}`] : []),
    `Valor: ${brl(n.centavos / 100)}`,
    `Plano: ${PLANO_NOTA[n.plano] || n.plano || '—'}`,
    `Forma de pagamento: ${n.origem === 'pix' ? 'Pix' : 'Cartão'}`,
    `Pago em: ${quando(n.pagoEm)}`
  ].join('\n');
}

async function loadNotas() {
  const data = await api(`/api/admin/notas?filtro=${filtroNotas}`);
  $$('[data-notas-filtro]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.notasFiltro === filtroNotas)));
  const r = data.resumo || { pendentes: 0, pendentesCentavos: 0 };
  $('#adNotasResumo').textContent = data.semBanco
    ? 'Banco de dados indisponível agora.'
    : (r.pendentes ? `${num(r.pendentes)} ${r.pendentes === 1 ? 'pagamento sem nota' : 'pagamentos sem nota'} · ${brl(r.pendentesCentavos / 100)}` : 'Nenhum pagamento sem nota.');
  itensNotas.clear();
  (data.itens || []).forEach((n) => itensNotas.set(`${n.origem}:${n.ref}`, n));
  $('#adNotasRows').innerHTML = (data.itens || []).map((n) => `<tr data-origem="${esc(n.origem)}" data-ref="${esc(n.ref)}">
      <td class="ad-nowrap">${quando(n.pagoEm)}</td>
      <td>${esc(n.nome || '—')}${n.nome ? '' : '<br><span class="ad-muted">sem nome no cadastro</span>'}</td>
      <td class="ad-nowrap">${n.cpf ? `${esc(n.cpf)}<br><span class="ad-muted">${esc(n.tipoDocumento || 'CPF')}</span>` : '—'}</td>
      <td class="ad-nowrap">${brl(n.centavos / 100)}</td>
      <td>${esc(PLANO_NOTA[n.plano] || n.plano || '—')}</td>
      <td>${n.origem === 'pix' ? 'Pix' : 'Cartão'}</td>
      <td class="ad-contato">${contatoNota(n)}</td>
      <td class="ad-nota">
        <label class="ad-check"><input type="checkbox" data-nota-emitida ${n.emitida ? 'checked' : ''}> Nota emitida</label>
        <input type="text" data-nota-numero maxlength="40" placeholder="nº da nota (opcional)" aria-label="Número da nota" value="${esc(n.numero || '')}">
        ${n.emitida && n.emitidaEm ? `<span class="ad-muted">em ${quando(n.emitidaEm)}</span>` : ''}
        <button type="button" class="ad-btn-ghost ad-btn-sm" data-nota-copiar>Copiar dados</button>
      </td></tr>`).join('')
    || `<tr><td colspan="8" class="ad-muted">${filtroNotas === 'pendentes' ? 'Nenhum pagamento sem nota.' : 'Nenhum pagamento real ainda.'}</td></tr>`;
}

function bindNotas() {
  $$('[data-notas-filtro]').forEach((b) => b.addEventListener('click', () => {
    filtroNotas = b.dataset.notasFiltro;
    loadNotas().catch((err) => toast(err.message));
  }));
  $('#adNotasRows').addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-nota-copiar]');
    if (!botao) return;
    const tr = botao.closest('tr[data-ref]');
    const n = tr && itensNotas.get(`${tr.dataset.origem}:${tr.dataset.ref}`);
    if (!n) return;
    try {
      await navigator.clipboard.writeText(textoNota(n));
      toast('Dados copiados. Cole no emissor da nota.');
    } catch {
      toast('Não foi possível copiar. Selecione os dados na linha da tabela.');
    }
  });
  $('#adNotasRows').addEventListener('change', async (e) => {
    const tr = e.target.closest('tr[data-ref]');
    if (!tr || !e.target.matches('[data-nota-emitida], [data-nota-numero]')) return;
    const caixa = $('[data-nota-emitida]', tr);
    const emitida = caixa.checked;
    try {
      await api('/api/admin/notas', { method: 'POST', body: { origem: tr.dataset.origem, ref: tr.dataset.ref, emitida, numero: $('[data-nota-numero]', tr).value } });
      toast(emitida ? 'Nota marcada como emitida.' : 'Marcação salva.');
      if (filtroNotas === 'pendentes' && emitida) loadNotas().catch(() => {});
    } catch (err) {
      if (e.target === caixa) caixa.checked = !emitida;
      toast(err.message);
    }
  });
}

async function loadAudit() {
  const { items } = await api('/api/admin/audit');
  $('#adAuditRows').innerHTML = items.map((a) => `<li><span>${quando(a.at)} · <strong>${esc(a.actor_email || '—')}</strong> ${esc(ACOES[a.action] || a.action)} <code>${esc(a.target || '')}</code></span></li>`).join('')
    || '<li class="ad-muted">Nenhuma alteração ainda.</li>';
}

boot();
