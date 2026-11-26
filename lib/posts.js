/**
 * Posts do blog vindos de duas fontes:
 *  - content/blog/*.md (posts publicados junto com o site, gerados por tools/importar-posts.mjs --para-repo)
 *  - banco (posts criados no painel de admin), que têm prioridade quando o endereço (slug) é o mesmo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPosts as listPostsBanco, getPostBySlug as getPostBySlugBanco } from './db.js';

const PASTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'blog');
let cache = null;

function lerArquivo(nome) {
  const bruto = fs.readFileSync(path.join(PASTA, nome), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = bruto.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  for (const linha of m[1].split('\n')) {
    const k = linha.match(/^([a-z_]+)\s*:\s*(.*)$/i);
    if (k) meta[k[1].toLowerCase()] = k[2].trim();
  }
  if (!meta.slug || !meta.titulo || meta.status !== 'published') return null;
  const publicado = meta.publicado || '2026-11-26T12:00:00.000Z';
  return {
    id: null,
    slug: meta.slug,
    title: meta.titulo,
    excerpt: meta.resumo || '',
    content_md: m[2].trim(),
    cover_url: meta.capa || null,
    seo_title: meta.seo_titulo || null,
    seo_description: meta.seo_descricao || null,
    tags: (meta.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    status: 'published',
    author_email: null,
    author_name: 'Equipe Check no Concurso',
    published_at: publicado,
    created_at: publicado,
    updated_at: meta.atualizado || publicado
  };
}

export function postsDoRepositorio() {
  if (cache) return cache;
  let nomes = [];
  try { nomes = fs.readdirSync(PASTA).filter((n) => n.endsWith('.md')); } catch { nomes = []; }
  const agora = Date.now();
  cache = nomes.map((n) => { try { return lerArquivo(n); } catch { return null; } })
    .filter((p) => p && Date.parse(p.published_at) <= agora);
  return cache;
}

const ordem = (a, b) => String(b.published_at).localeCompare(String(a.published_at)) || a.title.localeCompare(b.title, 'pt-BR');

/** Posts publicados (banco + arquivos), mais novos primeiro. */
export async function listPosts({ limit = 100 } = {}) {
  let banco = [];
  try { banco = await listPostsBanco({ limit: 1000 }); } catch { banco = []; }
  const doBanco = new Set(banco.map((p) => p.slug));
  const todos = [...banco.map((p) => ({ ...p, published_at: p.published_at instanceof Date ? p.published_at.toISOString() : p.published_at, updated_at: p.updated_at instanceof Date ? p.updated_at.toISOString() : p.updated_at })), ...postsDoRepositorio().filter((p) => !doBanco.has(p.slug))];
  return todos.sort(ordem).slice(0, limit);
}

export async function getPostBySlug(slug) {
  let p = null;
  try { p = await getPostBySlugBanco(slug); } catch { p = null; }
  return p || postsDoRepositorio().find((x) => x.slug === slug) || null;
}
