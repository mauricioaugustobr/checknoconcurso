#!/usr/bin/env node
/**
 * Monta a pasta publicada na Vercel (dist/) a partir de public/, SEM o conteúdo pago:
 * o catálogo completo de concursos e as provas anteriores só saem pela API,
 * para quem tem plano. As funções do servidor continuam lendo esses arquivos do repositório.
 *
 * Uso: node tools/build-public.mjs   (a Vercel roda isto no deploy, ver vercel.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origem = path.join(raiz, 'public');
const destino = path.join(raiz, 'dist');

// Caminhos (relativos a public/) que NÃO vão para o site público
export const PRIVADOS = [
  /^js\/data\/concursos\.js$/,
  /^js\/data\/estados-[a-z0-9-]+\.js$/,
  /^js\/data\/provas\.js$/,
  /^provas\//
];
export const ehPrivado = (rel) => PRIVADOS.some((re) => re.test(rel.split(path.sep).join('/')));

function copiar(dir) {
  let n = 0;
  let pulados = 0;
  for (const nome of fs.readdirSync(path.join(origem, dir))) {
    const rel = path.join(dir, nome);
    const abs = path.join(origem, rel);
    if (ehPrivado(rel) || ehPrivado(`${rel}/`)) { pulados++; continue; }
    if (fs.statSync(abs).isDirectory()) {
      const r = copiar(rel);
      n += r.n; pulados += r.pulados;
    } else {
      fs.mkdirSync(path.join(destino, dir), { recursive: true });
      fs.copyFileSync(abs, path.join(destino, rel));
      n++;
    }
  }
  return { n, pulados };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.rmSync(destino, { recursive: true, force: true });
  fs.mkdirSync(destino, { recursive: true });
  const { n, pulados } = copiar('');
  console.log(`dist/: ${n} arquivos públicos copiados; ${pulados} itens privados ficaram de fora (catálogo e provas).`);
}
