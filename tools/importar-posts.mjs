#!/usr/bin/env node
/**
 * Importa posts do blog escritos em Markdown (um arquivo .md por post) para o banco (tabela cnc_posts).
 *
 * Uso:
 *   node tools/importar-posts.mjs <pasta> [--publicar] [--sql saida.sql]
 *
 * - Sem --publicar, os posts entram como RASCUNHO (não aparecem no site).
 * - Com DATABASE_URL definido, grava direto no banco (atualiza se o slug já existir).
 * - Com --sql, só gera o SQL (para rodar no console do Neon), sem tocar no banco.
 *
 * Formato do arquivo (cabeçalho entre ---, depois o texto em Markdown):
 *   ---
 *   titulo: Concurso TJ-SP 2026: vagas, salário e data da prova
 *   slug: concurso-tj-sp-2026
 *   resumo: Frase de até 160 caracteres que responde a pergunta principal.
 *   seo_titulo: (opcional, até 60 caracteres)
 *   seo_descricao: (opcional, até 160 caracteres)
 *   tags: SP, concurso:tj-sp-2026, Tribunais
 *   capa: (opcional, URL https da imagem)
 *   ---
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const pasta = args.find((a) => !a.startsWith('--'));
const publicar = args.includes('--publicar');
const sqlIdx = args.indexOf('--sql');
const sqlOut = sqlIdx >= 0 ? args[sqlIdx + 1] : null;
if (!pasta) { console.error('Uso: node tools/importar-posts.mjs <pasta> [--publicar] [--sql saida.sql]'); process.exit(1); }

const { slugify } = await import('../public/js/markdown.js');
const { ESTADOS_BRASIL } = await import('../public/js/data/concursos.js');
const { CONCURSOS } = await import('../public/js/data/concursos.js');
const IDS = new Set(CONCURSOS.map((c) => c.id));

function lerPost(arquivo) {
  const bruto = fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = bruto.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('falta o cabeçalho entre --- e ---');
  const meta = {};
  for (const linha of m[1].split('\n')) {
    const k = linha.match(/^([a-z_]+)\s*:\s*(.*)$/i);
    if (k) meta[k[1].toLowerCase()] = k[2].trim().replace(/^["']|["']$/g, '');
  }
  const conteudo = m[2].trim();
  const post = {
    title: meta.titulo || meta.title,
    slug: slugify(meta.slug || meta.titulo || meta.title),
    excerpt: meta.resumo || meta.excerpt || '',
    seo_title: meta.seo_titulo || meta.seo_title || null,
    seo_description: meta.seo_descricao || meta.seo_description || null,
    tags: (meta.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    cover_url: meta.capa || meta.cover || null,
    content_md: conteudo,
    status: publicar ? 'published' : 'draft'
  };
  // Conferências: o que faltar ou estiver fora do padrão para o arquivo e avisa
  const erros = [];
  const avisos = [];
  if (!post.title) erros.push('falta "titulo"');
  if (!conteudo || conteudo.length < 400) erros.push('texto muito curto (menos de 400 caracteres)');
  if (post.excerpt.length > 200) avisos.push(`resumo com ${post.excerpt.length} caracteres (ideal: até 160)`);
  if (post.seo_title && post.seo_title.length > 65) avisos.push(`seo_titulo com ${post.seo_title.length} caracteres (ideal: até 60)`);
  if (post.seo_description && post.seo_description.length > 170) avisos.push(`seo_descricao com ${post.seo_description.length} caracteres (ideal: até 160)`);
  if (post.cover_url && !/^https:\/\//.test(post.cover_url)) erros.push('capa precisa ser uma URL https');
  for (const t of post.tags) {
    const id = t.match(/^concurso:(.+)$/i)?.[1];
    if (id && !IDS.has(id)) erros.push(`tag "${t}": concurso não existe no catálogo`);
    const uf = t.replace(/^uf:/i, '').toUpperCase();
    if (/^uf:/i.test(t) && !ESTADOS_BRASIL[uf]) erros.push(`tag "${t}": estado inválido`);
  }
  if (!/perguntas frequentes|perguntas e respostas|d[uú]vidas frequentes|\bfaq\b/i.test(conteudo)) avisos.push('sem seção "Perguntas frequentes" (as IAs usam essa seção)');
  if (/<[a-z][^>]*>/i.test(conteudo)) avisos.push('tem HTML no texto; ele aparece como texto, não como tag');
  return { post, erros, avisos };
}

const arquivos = fs.readdirSync(pasta).filter((f) => f.toLowerCase().endsWith('.md') && !f.startsWith('_') && !/^leia|^formato/i.test(f)).sort();
const prontos = [];
let falhas = 0;
for (const f of arquivos) {
  try {
    const { post, erros, avisos } = lerPost(path.join(pasta, f));
    if (erros.length) { falhas++; console.log(`✗ ${f}: ${erros.join('; ')}`); continue; }
    prontos.push(post);
    console.log(`✓ ${f} → /blog/${post.slug}${avisos.length ? `  (aviso: ${avisos.join('; ')})` : ''}`);
  } catch (err) { falhas++; console.log(`✗ ${f}: ${err.message}`); }
}
const slugs = prontos.map((p) => p.slug);
const repetidos = slugs.filter((s, i) => slugs.indexOf(s) !== i);
if (repetidos.length) { console.error(`Slugs repetidos: ${[...new Set(repetidos)].join(', ')}`); process.exit(1); }
console.log(`\n${prontos.length} prontos, ${falhas} com erro. Status: ${publicar ? 'PUBLICADO' : 'rascunho'}.`);

const autor = { email: 'blog@checknoconcurso.com.br', name: 'Equipe Check no Concurso' };
if (sqlOut) {
  const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
  const arr = (a) => `array[${a.map(q).join(', ')}]::text[]`;
  const sql = prontos.map((p) => `insert into cnc_posts (slug, title, excerpt, content_md, cover_url, seo_title, seo_description, tags, status, author_email, author_name, published_at)
values (${q(p.slug)}, ${q(p.title)}, ${q(p.excerpt)}, ${q(p.content_md)}, ${q(p.cover_url)}, ${q(p.seo_title)}, ${q(p.seo_description)}, ${arr(p.tags)}, ${q(p.status)}, ${q(autor.email)}, ${q(autor.name)}, ${p.status === 'published' ? 'now()' : 'null'})
on conflict (slug) do update set title = excluded.title, excerpt = excluded.excerpt, content_md = excluded.content_md, cover_url = excluded.cover_url,
  seo_title = excluded.seo_title, seo_description = excluded.seo_description, tags = excluded.tags, status = excluded.status,
  published_at = case when excluded.status = 'published' then coalesce(cnc_posts.published_at, now()) else null end, updated_at = now();`).join('\n\n');
  fs.writeFileSync(sqlOut, `-- Gerado por tools/importar-posts.mjs em ${new Date().toISOString()}\n${sql}\n`);
  console.log(`SQL salvo em ${sqlOut}`);
} else if (process.env.DATABASE_URL) {
  const { getPostBySlug, upsertPost } = await import('../lib/db.js');
  for (const p of prontos) {
    const atual = await getPostBySlug(p.slug, { includeDrafts: true });
    const r = await upsertPost({ ...p, id: atual?.id }, autor);
    console.log(`${atual ? 'atualizado' : 'criado'}: ${r.slug} (${r.status})`);
  }
} else {
  console.log('Nada gravado: defina DATABASE_URL para gravar no banco, ou use --sql para gerar o SQL.');
}
