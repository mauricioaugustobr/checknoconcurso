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
  openTab(location.hash.replace('#', '') || 'geral');
}

/* ---------------- Abas ---------------- */
const loaders = { geral: loadOverview, concursos: loadConcursos, blog: loadPosts, usuarios: loadUsers, registro: loadAudit };

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
async function loadUsers() {
  const { users } = await api('/api/admin/users');
  $('#adUserRows').innerHTML = users.map((u) => `<tr>
      <td>${esc(u.name || '—')}</td><td>${esc(u.email)}</td><td>${num(u.logins)}</td>
      <td>${quando(u.first_login_at)}</td><td>${quando(u.last_login_at)}</td></tr>`).join('')
    || '<tr><td colspan="5" class="ad-muted">Ninguém entrou com o Google ainda.</td></tr>';
}

const ACOES = {
  'concurso.editar': 'editou o concurso', 'concurso.ocultar': 'ocultou o concurso', 'concurso.restaurar': 'desfez as edições do concurso',
  'post.criar': 'criou o post', 'post.editar': 'editou o post', 'post.excluir': 'excluiu o post'
};

async function loadAudit() {
  const { items } = await api('/api/admin/audit');
  $('#adAuditRows').innerHTML = items.map((a) => `<li><span>${quando(a.at)} · <strong>${esc(a.actor_email || '—')}</strong> ${esc(ACOES[a.action] || a.action)} <code>${esc(a.target || '')}</code></span></li>`).join('')
    || '<li class="ad-muted">Nenhuma alteração ainda.</li>';
}

boot();
