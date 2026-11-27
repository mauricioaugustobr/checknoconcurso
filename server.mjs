import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARCA } from './public/js/data/concursos.js';
import {
  getHealthPayload,
  computeStats,
  getEstadosPayload,
  getConcursosPayload
} from './lib/catalog-api.js';
import { handleAuthConfig, handleGoogleLogin, handleSession, handleLogout } from './lib/auth.js';
import { getLiveCatalog } from './lib/catalog-overrides.js';
import { renderImagemConcurso } from './lib/og-rota.js';
import { renderConcursoPage, renderEstadoPage, renderBlogIndex, renderBlogPost, renderBlogRecentes, renderSitemap, renderLlms } from './lib/pages.js';
import { handleOverview, handleUsers, handleAudit, handleAdminConcursos, handleAdminPosts, handleCancelamentos } from './lib/admin-api.js';
import { handleCheckout, handleConfirm, handlePortal, handleWebhook } from './lib/stripe.js';

import { handlePix } from './lib/pix.js';
import { handleCancel, handleCancelRequest } from './lib/cancel.js';
import { handleExplicacao } from './lib/explicacao.js';
import { GET as concursosApi, POST as concursosPost } from './api/concursos.js';
import { GET as statsApi } from './api/stats.js';
import { ehPrivado } from './tools/build-public.mjs';
const STRIPE_ROUTES = {
  pix: handlePix,
  checkout: handleCheckout,
  confirm: handleConfirm,
  portal: handlePortal,
  webhook: handleWebhook,
  cancel: handleCancel,
  request: handleCancelRequest
};

// Mesmas rotas das funções e "rewrites" da Vercel (vercel.json), para testar localmente
const DYNAMIC_ROUTES = [
  [/^\/api\/admin\/overview$/, (r) => handleOverview(r)],
  [/^\/api\/admin\/users$/, (r) => handleUsers(r)],
  [/^\/api\/admin\/audit$/, (r) => handleAudit(r)],
  [/^\/api\/admin\/concursos$/, (r) => handleAdminConcursos(r)],
  [/^\/api\/admin\/posts$/, (r) => handleAdminPosts(r)],
  [/^\/api\/admin\/cancelamentos$/, (r) => handleCancelamentos(r)],
  [/^\/og\/(concurso|stories)\/([^/]+)$/, (r, m) => renderImagemConcurso(r, m[1], decodeURIComponent(m[2]))],
  [/^\/concurso\/([^/]+)\/?$/, (r, m) => renderConcursoPage(r, decodeURIComponent(m[1]))],
  [/^\/concursos\/([a-zA-Z]{2})\/?$/, (r, m) => renderEstadoPage(r, m[1])],
  [/^\/blog\/?$/, (r) => renderBlogIndex(r)],
  [/^\/blog\/([^/]+)\/?$/, (r, m) => renderBlogPost(r, decodeURIComponent(m[1]))],
  [/^\/api\/blog-recentes$/, (r) => renderBlogRecentes(r)],
  [/^\/sitemap\.xml$/, (r) => renderSitemap(r)],
  [/^\/llms\.txt$/, (r) => renderLlms(r)],
  [/^\/llms-full\.txt$/, (r) => renderLlms(r, { completo: true })],
  [/^\/api\/explicacao$/, (r) => handleExplicacao(r)],
  [/^\/api\/stripe\/([a-z]+)$/, (r, m) => (STRIPE_ROUTES[m[1]]
    ? STRIPE_ROUTES[m[1]](r)
    : Response.json({ error: 'Rota de pagamento não encontrada' }, { status: 404 }))]
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3400);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  res.end(body);
}

// Rotas de login (mesma lógica das funções da Vercel em api/auth/*)
const AUTH_ROUTES = {
  '/api/auth/config': () => handleAuthConfig(),
  '/api/auth/google': (request) => handleGoogleLogin(request),
  '/api/auth/session': (request) => handleSession(request),
  '/api/auth/logout': (request) => handleLogout(request)
};

async function toWebRequest(req, url) {
  const chunks = [];
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    for await (const chunk of req) chunks.push(chunk);
  }
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v);
  }
  return new Request(url, {
    method: req.method,
    headers,
    body: chunks.length ? Buffer.concat(chunks) : undefined
  });
}

async function sendWebResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, key) => { headers[key] = value; });
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(url.pathname);

      if (pathname === '/api/health') {
        return sendJson(res, 200, getHealthPayload());
      }

      if (pathname === '/api/stats') {
        return sendWebResponse(res, await statsApi());
      }

      if (pathname === '/api/estados') {
        return sendJson(res, 200, getEstadosPayload());
      }

      // Catálogo e provas: só com plano (mesma função da Vercel, api/concursos.js)
      if (pathname === '/api/concursos' || pathname === '/api/provas' || pathname === '/api/progresso' || pathname.startsWith('/api/prova/')) {
        const apiUrl = new URL(url);
        if (pathname === '/api/progresso') {
          apiUrl.searchParams.set('tipo', 'progresso');
          const handler = req.method === 'POST' ? concursosPost : concursosApi;
          return sendWebResponse(res, await handler(await toWebRequest(req, apiUrl)));
        }
        if (pathname === '/api/provas') apiUrl.searchParams.set('tipo', 'provas');
        if (pathname.startsWith('/api/prova/')) { apiUrl.searchParams.set('tipo', 'prova'); apiUrl.searchParams.set('c', pathname.slice('/api/prova/'.length)); }
        return sendWebResponse(res, await concursosApi(await toWebRequest(req, apiUrl)));
      }

      for (const [pattern, handler] of DYNAMIC_ROUTES) {
        const m = pathname.match(pattern);
        if (m) return sendWebResponse(res, await handler(await toWebRequest(req, url), m));
      }

      if (AUTH_ROUTES[pathname]) {
        return sendWebResponse(res, await AUTH_ROUTES[pathname](await toWebRequest(req, url)));
      }

      const safeRelPath = pathname === '/' ? '/index.html' : (pathname === '/admin' ? '/admin/index.html' : pathname);
      // Igual à Vercel (tools/build-public.mjs): catálogo e provas não são arquivos públicos
      if (ehPrivado(safeRelPath.replace(/^\/+/, ''))) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Arquivo não encontrado');
      }
      const resolvedPath = path.normalize(path.join(PUBLIC_DIR, safeRelPath));
      if (!resolvedPath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        return res.end('Forbidden');
      }

      let targetFile = resolvedPath;
      try {
        const stat = await fs.stat(targetFile);
        if (stat.isDirectory()) targetFile = path.join(targetFile, 'index.html');
      } catch {
        if (!path.extname(safeRelPath)) {
          targetFile = path.join(PUBLIC_DIR, 'index.html');
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('Arquivo não encontrado');
        }
      }

      const ext = path.extname(targetFile).toLowerCase();
      const content = await fs.readFile(targetFile);
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
      });
      res.end(content);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Erro interno no servidor', details: err.message }));
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Check no Concurso (${MARCA.dominio}) rodando em http://localhost:${PORT}`);
  });
}
