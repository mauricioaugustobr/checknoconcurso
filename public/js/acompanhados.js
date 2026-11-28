/**
 * Item 12 · "Acompanhar este concurso" e "Meus concursos" na conta.
 * A lista fica no servidor (/api/acompanhados) para quem tem plano e entrou com a conta;
 * o navegador guarda só uma cópia. Na 1ª vez com a conta neste navegador, o que já estava
 * salvo aqui (e que a pessoa escolheu) é juntado à conta, sem apagar nada.
 */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const itens = new Map(); // id -> { mudancas, conferidoEm, proximoPasso, linkOficial }
let ligado = false; // a lista desta tela veio da conta

export const listaNaConta = () => ligado;
export const infoAcompanhado = (id) => itens.get(id) || null;

function aplicar(state, dados) {
  itens.clear();
  for (const it of dados.itens || []) itens.set(it.id, it);
  state.savedIds = [...(dados.ids || [])];
  state.alertIds = [...(dados.alertas || [])];
  ligado = true;
}

async function chamar(metodo, corpo) {
  const res = await fetch('/api/acompanhados', {
    method: metodo,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) {
    const erro = new Error(dados.error || 'Não foi possível atualizar sua lista agora.');
    erro.status = res.status;
    throw erro;
  }
  return dados;
}

/**
 * Busca a lista da conta. Na 1ª vez desta conta neste navegador, junta o que a pessoa
 * tinha salvo aqui (só se ela mexeu na lista; a lista de exemplo não vai para a conta).
 */
export async function sincronizarAcompanhados(state, { email } = {}) {
  if (!email) return false;
  try {
    let dados = await chamar('GET');
    // Lista de outra conta neste navegador nunca é juntada a esta
    if (!state.acompanhadosConta && state.savedTouched && state.savedIds.length) {
      dados = await chamar('POST', { acao: 'importar', ids: state.savedIds, alertas: state.alertIds });
    }
    aplicar(state, dados);
    state.acompanhadosConta = email;
    return true;
  } catch {
    ligado = false; // sem internet ou sem plano: continua com a cópia do navegador
    return false;
  }
}

/** Acompanhar, deixar de acompanhar ou ligar/desligar o aviso, já na conta. */
export async function alterarAcompanhado(state, acao, id, extra = {}) {
  const dados = await chamar('POST', { acao, id, ...extra });
  aplicar(state, dados);
  return dados;
}

/** Saiu da conta: a lista que veio da conta não fica neste navegador. */
export function esquecerListaDaConta(state) {
  if (!state.acompanhadosConta) return;
  state.savedIds = [];
  state.alertIds = [];
  state.acompanhadosConta = null;
  state.savedTouched = false;
  itens.clear();
  ligado = false;
}

/* ---------- Tela "Meus concursos" ---------- */
function valor(m, v) {
  if (v === null || v === undefined || v === '') {
    return m.campo === 'dataProva' ? 'a definir' : 'sem data';
  }
  if (m.tipo === 'data') return dataBR(v);
  if (m.campo.startsWith('salario') || m.campo === 'taxaInscricao') return brl(v);
  if (m.tipo === 'numero') return Number(v).toLocaleString('pt-BR');
  return String(v);
}

export function mudancasHTML(info) {
  if (!info?.mudancas?.length) return '';
  return `
    <div class="mc-mudou">
      <p class="mc-mudou-head"><strong>O que mudou no edital</strong>${info.conferidoEm ? `<span>Conferido em ${esc(dataBR(info.conferidoEm))}</span>` : ''}</p>
      <ul>
        ${info.mudancas.map((m) => `
          <li><span class="mc-campo">${esc(m.rotulo)}</span>
            <span class="mc-antes">Antes: <s>${esc(valor(m, m.antes))}</s></span>
            <span class="mc-seta" aria-hidden="true">→</span>
            <span class="mc-agora">Agora: <strong>${esc(valor(m, m.agora))}</strong></span></li>`).join('')}
      </ul>
    </div>`;
}

export function proximoPassoHTML(info) {
  const p = info?.proximoPasso;
  if (!p) return '';
  const texto = p.data ? `${esc(p.rotulo)}: <strong>${esc(dataBR(p.data))}</strong>` : `${esc(p.rotulo)}: <strong>${esc(p.texto || 'a definir')}</strong>`;
  return `<p class="mc-passo"><span class="mc-passo-rot">Próximo passo</span> ${texto}</p>`;
}

export function linkOficialHTML(info) {
  if (!info?.linkOficial) return '';
  return `<a class="btn-outline-sm mc-oficial" href="${esc(info.linkOficial)}" target="_blank" rel="noopener noreferrer">Fonte do edital ↗<span class="mc-sr"> (abre em nova aba)</span></a>`;
}
