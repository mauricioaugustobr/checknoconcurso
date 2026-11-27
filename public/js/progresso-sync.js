/**
 * Progresso das provas na conta (front-end) — Check no Concurso.
 *
 * O navegador continua guardando tudo localmente (funciona mesmo sem internet) e,
 * em segundo plano, manda as respostas para a conta em lotes:
 *   - a cada 10 respostas novas, ou 60 segundos depois da primeira resposta pendente;
 *   - ao ver o resultado, ao sair da página ou ao trocar de aba;
 *   - quando a internet volta.
 * Nenhum segredo aqui: o servidor decide de quem é o progresso pela sessão (cookie HttpOnly).
 *
 * Campos extras guardados junto do estado local de cada prova (check-prova:ID):
 *   conta      → identificador da conta dona deste progresso (sem e-mail)
 *   tentativa  → número da tentativa no servidor (null = ainda não enviado)
 *   pend       → questões respondidas que ainda não chegaram ao servidor
 *   posPend    → a posição (questão atual) mudou e ainda não foi enviada
 */
export const PREFIXO = 'check-prova:';
const API = '/api/progresso';
const LOTE = 10;
const ESPERA_MS = 60_000;

/** Respostas que ainda precisam ir para o servidor. Progresso nunca enviado: todas. */
export function respostasPendentes(estado) {
  const answers = estado?.answers || {};
  if (!estado?.conta) return { ...answers };
  const out = {};
  for (const n of estado.pend || []) if (answers[n] != null) out[n] = answers[n];
  return out;
}

async function pedir(metodo, provaId, corpo, { keepalive = false } = {}) {
  try {
    const res = await fetch(metodo === 'GET' ? `${API}?prova=${encodeURIComponent(provaId)}` : API, {
      method: metodo,
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive,
      headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined
    });
    const data = await res.json().catch(() => ({}));
    // {offline:true} vem do Service Worker quando não há internet
    if (!res.ok || data.offline || !data.conta) return { ok: false, status: res.status, codigo: data.codigo || (data.offline ? 'offline' : null) };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, codigo: 'offline' };
  }
}

/** Envia o progresso local de uma prova (usado também na migração pela página inicial). */
export function enviarProgresso(provaId, estado, opcoes) {
  return pedir('POST', provaId, {
    prova: provaId,
    tentativa: estado?.tentativa ?? null,
    atual: Number.isInteger(estado?.current) ? estado.current : null,
    respostas: respostasPendentes(estado)
  }, opcoes);
}

export function lerProgressoServidor(provaId) {
  return pedir('GET', provaId);
}

/** Junta o estado local com o da conta. O servidor vale em caso de conflito. */
export function mesclar(local, servidor) {
  const mesmaTentativa = local.tentativa == null || local.tentativa === servidor.tentativa;
  const answers = mesmaTentativa ? { ...(local.answers || {}), ...servidor.respostas } : { ...servidor.respostas };
  const revealed = mesmaTentativa ? { ...(local.revealed || {}) } : {};
  const servidorMaisNovo = servidor.atualizadoEm && Date.parse(servidor.atualizadoEm) > (local.at || 0);
  const current = !mesmaTentativa || servidorMaisNovo ? servidor.atual : local.current;
  return {
    answers,
    revealed,
    current: Number.isInteger(current) ? current : 0,
    at: Date.now(),
    tentativa: servidor.tentativa || null,
    conta: servidor.conta,
    pend: [],
    posPend: false
  };
}

/**
 * Sincronizador da página da prova.
 * obter()        → { answers, revealed, current } atuais da tela
 * salvar()       → grava o estado local (a página chama meta() para incluir os campos extras)
 * aplicar(final) → a tela adota o estado juntado com a conta
 */
export function criarProgresso(provaId, { obter, salvar, aplicar }) {
  const meta = { conta: null, tentativa: null, pend: new Set(), posPend: false };
  let tentativaServidor = 0;
  let contaServidor = null; // conhecida depois da primeira resposta do servidor nesta visita
  let semConta = false; // visitante sem login, sem plano ou sem banco: fica só no aparelho
  let timer = null;
  let enviando = null;

  function agendar() {
    if (semConta) return;
    if (meta.pend.size >= LOTE) return void enviarAgora();
    if (!timer) timer = setTimeout(() => { timer = null; enviarAgora(); }, ESPERA_MS);
  }

  async function enviarAgora({ keepalive = false } = {}) {
    if (semConta || !contaServidor) return;
    if (!meta.pend.size && !meta.posPend) return;
    if (timer) { clearTimeout(timer); timer = null; }
    if (enviando && !keepalive) return enviando;
    const lote = [...meta.pend];
    const posicao = meta.posPend;
    const { answers, current } = obter();
    const estado = { answers, current: posicao ? current : null, conta: meta.conta, tentativa: meta.tentativa, pend: lote };
    const envio = (async () => {
      const r = await enviarProgresso(provaId, estado, { keepalive });
      if (r.ok) {
        lote.forEach((n) => meta.pend.delete(n));
        if (posicao) meta.posPend = false;
        tentativaServidor = Math.max(tentativaServidor, r.data.tentativa || 0);
        salvar();
      } else if (r.status === 401 || r.status === 403 || r.status === 503) {
        semConta = true;
      }
    })();
    if (!keepalive) {
      enviando = envio.finally(() => { enviando = null; if (meta.pend.size >= LOTE) enviarAgora(); });
      return enviando;
    }
    return envio;
  }

  // Sai da página ou troca de aba: manda o que faltar (keepalive deixa o envio terminar)
  const aoSair = () => enviarAgora({ keepalive: true });
  addEventListener('pagehide', aoSair);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') aoSair(); });
  addEventListener('online', () => { if (contaServidor) enviarAgora(); else if (!semConta) sincronizarAoAbrir(null); });

  /** Lê os campos extras do estado salvo no aparelho. */
  function carregarMeta(salvo) {
    meta.conta = salvo?.conta || null;
    meta.tentativa = Number.isInteger(salvo?.tentativa) ? salvo.tentativa : null;
    meta.pend = new Set(Array.isArray(salvo?.pend) ? salvo.pend.map(String) : []);
    meta.posPend = Boolean(salvo?.posPend);
  }

  /**
   * Ao abrir a prova: busca o progresso da conta, envia o que só existe neste aparelho
   * (inclusive o histórico de antes desta atualização) e devolve o estado juntado,
   * ou null se continuar só no aparelho.
   */
  async function sincronizarAoAbrir(local) {
    const base = local || { ...obter(), at: Date.now() };
    const pendAntes = new Set(meta.pend);
    let r = await lerProgressoServidor(provaId);
    if (!r.ok) {
      if (r.status === 401 || r.status === 403 || r.status === 503) semConta = true;
      return null;
    }
    let servidor = r.data;
    contaServidor = servidor.conta;
    tentativaServidor = servidor.tentativa || 0;

    let atual = { ...base, conta: meta.conta, tentativa: meta.tentativa, pend: [...meta.pend], posPend: meta.posPend };
    if (meta.conta && meta.conta !== servidor.conta) {
      // Progresso de outra conta neste navegador: guarda à parte e não mistura
      try { localStorage.setItem(`check-prova-outra-conta:${provaId}:${meta.conta}`, JSON.stringify(atual)); } catch { /* sem espaço */ }
      atual = { answers: {}, revealed: {}, current: 0, at: 0, conta: null, tentativa: servidor.tentativa || null, pend: [], posPend: false };
    }

    const pendentes = respostasPendentes(atual);
    const reiniciouAqui = atual.tentativa != null && atual.tentativa > (servidor.tentativa || 0);
    if (Object.keys(pendentes).length || atual.posPend || reiniciouAqui) {
      r = await enviarProgresso(provaId, { ...atual, current: atual.current });
      if (r.ok) servidor = r.data;
      else return null; // tenta de novo mais tarde; nada se perde no aparelho
    }

    const final = mesclar(atual, servidor);
    // Respostas dadas enquanto a conta respondia continuam valendo e pendentes
    const agora = obter();
    const novas = [...meta.pend].filter((n) => !pendAntes.has(n));
    carregarMeta(final);
    for (const n of novas) {
      if (agora.answers?.[n] != null) {
        final.answers[n] = agora.answers[n];
        if (agora.revealed?.[n]) final.revealed[n] = true;
        meta.pend.add(n);
      }
    }
    final.pend = [...meta.pend];
    tentativaServidor = servidor.tentativa || 0;
    aplicar?.(final);
    if (meta.pend.size) agendar();
    return final;
  }

  return {
    meta: () => ({ conta: meta.conta, tentativa: meta.tentativa, pend: [...meta.pend], posPend: meta.posPend }),
    carregarMeta,
    sincronizarAoAbrir,
    enviarAgora,
    /** Questão respondida ou pulada. */
    marcar(numero) {
      meta.pend.add(String(numero));
      agendar();
    },
    /** A pessoa mudou de questão (vai junto no próximo envio). */
    marcarPosicao() {
      if (semConta) return;
      meta.posPend = true;
    },
    /** "Refazer a prova": nova tentativa; a anterior fica no histórico da conta. */
    reiniciar() {
      meta.pend.clear();
      if (meta.conta || contaServidor) {
        meta.tentativa = Math.max(meta.tentativa || 1, tentativaServidor || 1) + 1;
        meta.posPend = true;
        setTimeout(() => enviarAgora(), 0);
      } else {
        meta.tentativa = null;
        meta.posPend = false;
      }
    },
    /** true quando o progresso desta prova já está ligado à conta. */
    naConta: () => Boolean(contaServidor) && !semConta
  };
}
