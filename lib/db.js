/**
 * Banco de dados (Neon Postgres) — só no servidor.
 * A conexão vem da variável de ambiente DATABASE_URL (Vercel). Nunca vai para o navegador.
 * Sem DATABASE_URL (ex.: desenvolvimento local), as funções devolvem valores vazios
 * e o site continua funcionando com o catálogo estático.
 */
import { neon } from '@neondatabase/serverless';

let sqlClient = null;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function db() {
  if (!hasDatabase()) return null;
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

/* ---------- Usuários (registrados a cada login com Google) ---------- */
export async function recordLogin(user) {
  const sql = db();
  if (!sql || !user?.email) return;
  await sql`
    insert into cnc_users (email, sub, name, picture, provider)
    values (${user.email.toLowerCase()}, ${user.sub || null}, ${user.name || null}, ${user.picture || null}, ${user.provider || 'google'})
    on conflict (email) do update set
      sub = excluded.sub, name = excluded.name, picture = excluded.picture,
      last_login_at = now(), logins = cnc_users.logins + 1`;
}

export async function listUsers({ limit = 200 } = {}) {
  const sql = db();
  if (!sql) return [];
  return sql`select email, name, picture, provider, first_login_at, last_login_at, logins
             from cnc_users order by last_login_at desc limit ${limit}`;
}

export async function countUsers() {
  const sql = db();
  if (!sql) return { total: 0, ultimos7: 0, ultimos30: 0 };
  const [r] = await sql`select count(*)::int as total,
      count(*) filter (where first_login_at > now() - interval '7 days')::int as ultimos7,
      count(*) filter (where last_login_at > now() - interval '30 days')::int as ultimos30
    from cnc_users`;
  return r;
}

/* ---------- Ajustes de concursos feitos pelo admin ---------- */
let overridesCache = { at: 0, rows: null };
const OVERRIDES_TTL_MS = 30_000;

export async function getOverrides({ fresh = false } = {}) {
  const sql = db();
  if (!sql) return [];
  if (!fresh && overridesCache.rows && Date.now() - overridesCache.at < OVERRIDES_TTL_MS) return overridesCache.rows;
  const rows = await sql`select concurso_id, data, hidden, updated_by, updated_at from cnc_concurso_overrides`;
  overridesCache = { at: Date.now(), rows };
  return rows;
}

export async function saveOverride(concursoId, data, hidden, actorEmail) {
  const sql = db();
  if (!sql) throw new Error('Banco de dados não configurado');
  await sql`
    insert into cnc_concurso_overrides (concurso_id, data, hidden, updated_by, updated_at)
    values (${concursoId}, ${JSON.stringify(data)}::jsonb, ${Boolean(hidden)}, ${actorEmail}, now())
    on conflict (concurso_id) do update set data = excluded.data, hidden = excluded.hidden,
      updated_by = excluded.updated_by, updated_at = now()`;
  overridesCache = { at: 0, rows: null };
}

export async function clearOverride(concursoId) {
  const sql = db();
  if (!sql) throw new Error('Banco de dados não configurado');
  await sql`delete from cnc_concurso_overrides where concurso_id = ${concursoId}`;
  overridesCache = { at: 0, rows: null };
}

/* ---------- Blog ---------- */
const POST_COLS = 'id, slug, title, excerpt, content_md, cover_url, seo_title, seo_description, tags, status, author_email, author_name, published_at, created_at, updated_at';

export async function listPosts({ includeDrafts = false, limit = 100 } = {}) {
  const sql = db();
  if (!sql) return [];
  return includeDrafts
    ? sql.query(`select ${POST_COLS} from cnc_posts order by coalesce(published_at, updated_at) desc limit $1`, [limit])
    : sql.query(`select ${POST_COLS} from cnc_posts where status = 'published' and published_at <= now() order by published_at desc limit $1`, [limit]);
}

export async function getPostBySlug(slug, { includeDrafts = false } = {}) {
  const sql = db();
  if (!sql) return null;
  const rows = includeDrafts
    ? await sql.query(`select ${POST_COLS} from cnc_posts where slug = $1`, [slug])
    : await sql.query(`select ${POST_COLS} from cnc_posts where slug = $1 and status = 'published' and published_at <= now()`, [slug]);
  return rows[0] || null;
}

export async function getPostById(id) {
  const sql = db();
  if (!sql) return null;
  const rows = await sql.query(`select ${POST_COLS} from cnc_posts where id = $1`, [id]);
  return rows[0] || null;
}

export async function upsertPost(post, actor) {
  const sql = db();
  if (!sql) throw new Error('Banco de dados não configurado');
  const publishedAt = post.status === 'published' ? (post.published_at || new Date().toISOString()) : null;
  if (post.id) {
    const rows = await sql`
      update cnc_posts set slug = ${post.slug}, title = ${post.title}, excerpt = ${post.excerpt},
        content_md = ${post.content_md}, cover_url = ${post.cover_url}, seo_title = ${post.seo_title},
        seo_description = ${post.seo_description}, tags = ${post.tags}, status = ${post.status},
        published_at = case when ${post.status} = 'published' then coalesce(published_at, ${publishedAt}::timestamptz) else null end,
        updated_at = now()
      where id = ${post.id} returning id, slug, status`;
    return rows[0] || null;
  }
  const rows = await sql`
    insert into cnc_posts (slug, title, excerpt, content_md, cover_url, seo_title, seo_description, tags, status, author_email, author_name, published_at)
    values (${post.slug}, ${post.title}, ${post.excerpt}, ${post.content_md}, ${post.cover_url}, ${post.seo_title},
            ${post.seo_description}, ${post.tags}, ${post.status}, ${actor.email}, ${actor.name}, ${publishedAt}::timestamptz)
    returning id, slug, status`;
  return rows[0];
}

export async function deletePost(id) {
  const sql = db();
  if (!sql) throw new Error('Banco de dados não configurado');
  const rows = await sql`delete from cnc_posts where id = ${id} returning id, slug, title`;
  return rows[0] || null;
}

/* ---------- Registro de ações do admin ---------- */
export async function audit(actorEmail, action, target, details = {}) {
  const sql = db();
  if (!sql) return;
  try {
    await sql`insert into cnc_audit (actor_email, action, target, details) values (${actorEmail}, ${action}, ${target}, ${JSON.stringify(details)}::jsonb)`;
  } catch (err) {
    console.warn('[audit] falhou:', err.message);
  }
}

export async function listAudit({ limit = 100 } = {}) {
  const sql = db();
  if (!sql) return [];
  return sql`select id, actor_email, action, target, details, at from cnc_audit order by at desc limit ${limit}`;
}
