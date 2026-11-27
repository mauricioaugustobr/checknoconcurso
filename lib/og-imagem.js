/**
 * Item 7 · Imagens de compartilhamento de cada concurso (Opção 1 da Designer UI/UX, azul-escuro).
 *  - Prévia 1200 × 630: aparece quando o link é colado no WhatsApp, Telegram ou Facebook.
 *  - Stories 1080 × 1920: para baixar e postar (área livre de 250 px em cima e 340 px embaixo).
 * Geradas no servidor com satori (layout) + resvg (PNG). Só dados públicos do concurso.
 * Fontes (OFL) em lib/og-fonts/: Inter 400/600/700/800 e Newsreader 600.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { vagasImagem, salarioTexto, provaTexto } from '../public/js/compartilhar-dados.js';

const PASTA = path.dirname(fileURLToPath(import.meta.url));
let fontes = null;
function carregarFontes() {
  if (fontes) return fontes;
  const f = (arq) => fs.readFileSync(path.join(PASTA, 'og-fonts', arq));
  fontes = [
    { name: 'Inter', data: f('inter-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'Inter', data: f('inter-latin-600-normal.woff'), weight: 600, style: 'normal' },
    { name: 'Inter', data: f('inter-latin-700-normal.woff'), weight: 700, style: 'normal' },
    { name: 'Inter', data: f('inter-latin-800-normal.woff'), weight: 800, style: 'normal' },
    { name: 'Newsreader', data: f('newsreader-latin-600-normal.woff'), weight: 600, style: 'normal' }
  ];
  return fontes;
}

// Logotipo horizontal para fundo escuro (só desenhos, sem texto: não depende de fonte)
let logo = null;
function logoEscuro() {
  if (!logo) {
    const svg = fs.readFileSync(path.join(PASTA, '..', 'public', 'brand', 'logo-horizontal-escuro.svg'));
    logo = `data:image/svg+xml;base64,${svg.toString('base64')}`;
  }
  return logo;
}

/* ---------- Mini "JSX" para o satori ---------- */
const h = (type, style = {}, ...children) => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.flat().filter((x) => x !== null && x !== undefined && x !== false) }
});
const texto = (style, t) => ({ type: 'div', props: { style: { display: 'block', ...style }, children: String(t ?? '') } });
const img = (src, style) => ({ type: 'img', props: { src, style } });

// Situação: verde (abertas), amarelo em fundo escuro (previsto) ou azul (demais)
function corSituacao(status) {
  if (/Abertas/i.test(status)) return { bg: '#0F3B2A', fg: '#7EE2AE', bd: '#2E8A5C' };
  if (/Previsto/i.test(status)) return { bg: '#2E2C17', fg: '#F4D632', bd: '#8F7A1F' };
  return { bg: '#173F66', fg: '#CFE6FA', bd: '#33699A' };
}

// Tamanho da sigla conforme o número de letras (regra da Designer)
function tamanhoSigla(sigla, tipo) {
  const n = String(sigla || '').length;
  const T = tipo === 'stories' ? [180, 156, 130, 104, 90] : [128, 112, 92, 72, 60];
  return n <= 6 ? T[0] : n <= 9 ? T[1] : n <= 13 ? T[2] : n <= 18 ? T[3] : T[4];
}

function chip(status, { fonte, pad, borda, ponto }) {
  const c = corSituacao(status);
  return h('div', { alignItems: 'center', gap: ponto - 2, background: c.bg, color: c.fg, border: `${borda}px solid ${c.bd}`, borderRadius: 999, padding: pad, fontSize: fonte, fontWeight: 700 },
    h('div', { width: ponto, height: ponto, borderRadius: 999, background: c.fg }),
    texto({}, status));
}

/* ---------- Prévia 1200 × 630 ---------- */
function arvorePrevia(c) {
  const v = vagasImagem(c);
  const tile = (rotulo, valor, { ouro = false, pequeno = false } = {}) => h('div', {
    flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: ouro ? '#F4D632' : '#102F4E', border: `2px solid ${ouro ? '#F4D632' : '#1F4569'}`, borderRadius: 20,
    color: ouro ? '#0B2239' : '#F4F8FB'
  },
  texto({ fontSize: 20, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: ouro ? '#0B2239' : '#A3B9CE' }, rotulo),
  texto({ fontSize: pequeno ? 32 : 42, fontWeight: 800, lineHeight: 1.15, marginTop: 4, whiteSpace: 'nowrap' }, valor));

  return h('div', { width: 1200 - 112, height: 630 - 92, flexDirection: 'column', background: '#0B2540', color: '#F4F8FB', paddingTop: 44, paddingRight: 56, paddingBottom: 48, paddingLeft: 56, fontFamily: 'Inter' },
    h('div', { justifyContent: 'space-between', alignItems: 'center', height: 52 },
      img(logoEscuro(), { height: 46, width: 268 }),
      c.status ? chip(c.status, { fonte: 24, pad: '10px 20px', borda: 2, ponto: 12 }) : null),
    h('div', { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 20px' },
      texto({ fontSize: 24, color: '#A3B9CE', maxWidth: 1000, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, c.orgao),
      texto({ fontFamily: 'Newsreader', fontWeight: 600, fontSize: tamanhoSigla(c.sigla, 'previa'), lineHeight: 1.02, margin: '6px 0 10px', maxWidth: 1080, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, c.sigla),
      texto({ fontSize: 30, lineHeight: 1.3, color: '#DCE7F1', maxWidth: 960, lineClamp: 2, overflow: 'hidden' }, c.titulo)),
    h('div', { gap: 16, height: 128 },
      tile('Vagas', v.texto, { pequeno: v.pequeno }),
      tile('Salário até', salarioTexto(c), { ouro: true }),
      tile('Prova', provaTexto(c))));
}

/* ---------- Stories 1080 × 1920 ---------- */
function arvoreStories(c) {
  const v = vagasImagem(c);
  const linha = (rotulo, valor, { ouro = false, pequeno = false } = {}) => h('div', {
    justifyContent: 'space-between', alignItems: 'center',
    background: ouro ? '#F4D632' : '#102F4E', border: `3px solid ${ouro ? '#F4D632' : '#1F4569'}`, borderRadius: 28, padding: '22px 40px',
    color: ouro ? '#0B2239' : '#F4F8FB'
  },
  texto({ fontSize: 32, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', color: ouro ? '#0B2239' : '#A3B9CE' }, rotulo),
  texto({ fontSize: pequeno ? 42 : 54, fontWeight: 800 }, valor));

  return h('div', { width: 1080 - 160, height: 1920 - 590, flexDirection: 'column', alignItems: 'center', background: '#0B2540', color: '#F4F8FB', paddingTop: 250, paddingRight: 80, paddingBottom: 340, paddingLeft: 80, fontFamily: 'Inter', textAlign: 'center' },
    h('div', { flex: 1, width: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
      img(logoEscuro(), { height: 80, width: 467, marginBottom: 40 }),
      c.status ? chip(c.status, { fonte: 34, pad: '14px 30px', borda: 3, ponto: 14 }) : null,
      texto({ fontSize: 34, color: '#A3B9CE', marginTop: 28, maxWidth: 900, lineClamp: 2, lineHeight: 1.3, overflow: 'hidden' }, c.orgao),
      texto({ fontFamily: 'Newsreader', fontWeight: 600, fontSize: tamanhoSigla(c.sigla, 'stories'), lineHeight: 1.02, margin: '14px 0 22px', maxWidth: 920 }, c.sigla),
      texto({ fontSize: 42, lineHeight: 1.3, color: '#DCE7F1', maxWidth: 900, lineClamp: 3, overflow: 'hidden' }, c.titulo),
      h('div', { flexDirection: 'column', gap: 14, width: '100%', marginTop: 40 },
        linha('Vagas', v.texto, { pequeno: v.pequeno }),
        linha('Salário até', salarioTexto(c), { ouro: true }),
        linha('Prova', provaTexto(c))),
      h('div', { flexDirection: 'column', alignItems: 'center', marginTop: 36 },
        texto({ fontSize: 34, color: '#C5D5E4' }, 'Datas e edital atualizados em'),
        texto({ fontSize: 40, color: '#9CC4E4', marginTop: 4, fontWeight: 700 }, 'checknoconcurso.com.br'))));
}

const MEDIDAS = { previa: [1200, 630], stories: [1080, 1920] };

/** PNG (Buffer) da prévia ou do Stories do concurso. */
export async function gerarImagem(c, formato = 'previa') {
  const [width, height] = MEDIDAS[formato] || MEDIDAS.previa;
  const arvore = formato === 'stories' ? arvoreStories(c) : arvorePrevia(c);
  const svg = await satori(arvore, { width, height, fonts: carregarFontes() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } }).render().asPng();
}
