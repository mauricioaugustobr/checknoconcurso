import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONCURSOS, PLATAFORMAS_PARCEIRAS, PLANOS, MARCA } from './public/js/data/concursos.js';

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

function computeStats(items) {
  const ativos = items.filter((c) => c.status !== 'Encerrado');
  const encerrados = items.filter((c) => c.status === 'Encerrado');
  const totalVagasAbertas = ativos.reduce((acc, c) => acc + c.vagas, 0);
  const inscricoesAbertas = items.filter((c) => c.status === 'Inscrições Abertas').length;
  const totalCursos = items.reduce((acc, c) => acc + c.cursos.length, 0);
  const totalProvasAnteriores = items.reduce((acc, c) => acc + c.provasAnteriores.length, 0);
  const maiorSalario = Math.max(...ativos.map((c) => c.salarioMax));
  return {
    marca: MARCA.nome,
    dominio: MARCA.dominio,
    totalConcursos: items.length,
    concursosAtivos: ativos.length,
    concursosEncerrados: encerrados.length,
    totalVagasAbertas,
    inscricoesAbertas,
    totalCursos,
    totalProvasAnteriores,
    maiorSalario,
    planos: PLANOS
  };
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(url.pathname);

      if (pathname === '/api/health') {
        return sendJson(res, 200, {
          ok: true,
          service: 'check-no-concurso',
          domain: MARCA.dominio,
          timestamp: new Date().toISOString()
        });
      }

      if (pathname === '/api/stats') {
        return sendJson(res, 200, computeStats(CONCURSOS));
      }

      if (pathname === '/api/concursos') {
        const uf = url.searchParams.get('uf');
        const esfera = url.searchParams.get('esfera');
        const area = url.searchParams.get('area');
        const status = url.searchParams.get('status');
        const q = (url.searchParams.get('q') || '').trim().toLowerCase();

        let filtered = CONCURSOS;
        if (uf && uf !== 'TODOS') filtered = filtered.filter((c) => c.uf === uf || c.uf === 'Nacional');
        if (esfera && esfera !== 'TODAS') filtered = filtered.filter((c) => c.esfera === esfera);
        if (area && area !== 'TODAS') filtered = filtered.filter((c) => c.area === area);
        if (status && status !== 'TODOS') {
          if (status === 'ATIVOS') filtered = filtered.filter((c) => c.status !== 'Encerrado');
          else filtered = filtered.filter((c) => c.status === status);
        }
        if (q) {
          filtered = filtered.filter((c) =>
            `${c.orgao} ${c.sigla} ${c.titulo} ${c.banca} ${c.area} ${c.uf}`.toLowerCase().includes(q)
          );
        }

        return sendJson(res, 200, {
          total: filtered.length,
          marca: MARCA,
          planos: PLANOS,
          plataformas: PLATAFORMAS_PARCEIRAS,
          items: filtered
        });
      }

      const safeRelPath = pathname === '/' ? '/index.html' : pathname;
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
