/**
 * Migração do progresso antigo — Check no Concurso.
 *
 * Até esta atualização, as respostas das provas ficavam só no navegador. Quando alguém
 * com o plano Check Completo entra (ou já está conectado) na página inicial, este arquivo
 * envia para a conta o progresso de todas as provas guardado neste aparelho.
 * Só manda o que ainda não chegou ao servidor; nada é apagado do aparelho.
 */
import { PREFIXO, enviarProgresso, respostasPendentes } from './progresso-sync.js?v=1';

let emAndamento = false;
let concluidaPara = null;

async function contaDoEmail(email) {
  if (!crypto?.subtle) return null;
  const bytes = new TextEncoder().encode(String(email).trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

function temCompleto(user) {
  return Boolean(user) && (user.role === 'admin' || String(user.plan || '').startsWith('completo'));
}

function provasGuardadas() {
  const lista = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);
      if (chave && chave.startsWith(PREFIXO)) lista.push(chave);
    }
  } catch { /* sem acesso ao armazenamento */ }
  return lista;
}

async function migrar(user) {
  if (emAndamento || !temCompleto(user) || !user.email) return;
  const conta = await contaDoEmail(user.email);
  if (!conta || concluidaPara === conta) return;
  emAndamento = true;
  try {
    for (const chave of provasGuardadas()) {
      let estado;
      try { estado = JSON.parse(localStorage.getItem(chave) || 'null'); } catch { continue; }
      if (!estado?.answers) continue;
      if (estado.conta && estado.conta !== conta) continue; // progresso de outra conta neste navegador
      const pendentes = respostasPendentes(estado);
      if (!Object.keys(pendentes).length) continue;
      const provaId = chave.slice(PREFIXO.length);
      // A posição só vai junto quando a prova nunca foi enviada (não passa por cima de outro aparelho)
      const r = await enviarProgresso(provaId, { ...estado, current: estado.conta ? null : estado.current });
      if (!r.ok) {
        if (r.status === 404) continue; // prova que saiu do acervo
        return; // sem plano, sem internet ou servidor fora: tenta na próxima visita
      }
      if (r.data.conta !== conta) return;
      // Relê o estado (a pessoa pode ter mexido em outra aba) e só marca o que foi enviado
      let atual;
      try { atual = JSON.parse(localStorage.getItem(chave) || 'null') || estado; } catch { atual = estado; }
      const enviadas = new Set(Object.keys(pendentes));
      atual.pend = Array.isArray(atual.pend) ? atual.pend.filter((n) => !enviadas.has(String(n))) : [];
      if (!atual.conta) {
        // Respostas feitas depois do envio continuam pendentes
        atual.pend = Object.keys(atual.answers || {}).filter((n) => !enviadas.has(n));
        atual.conta = r.data.conta;
        if (atual.tentativa == null) atual.tentativa = r.data.tentativa;
      }
      try { localStorage.setItem(chave, JSON.stringify(atual)); } catch { /* sem espaço */ }
    }
    concluidaPara = conta;
  } finally {
    emAndamento = false;
  }
}

function quandoOcioso(fn) {
  if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 5000 });
  else setTimeout(fn, 2000);
}

const aoEntrar = (event) => {
  const user = event.detail;
  if (user) quandoOcioso(() => migrar(user).catch(() => {}));
};
window.addEventListener('cnc:auth-session', aoEntrar);
window.addEventListener('cnc:auth-login', aoEntrar);
const ultimo = window.__cncAuthLast;
if (ultimo?.detail) aoEntrar({ detail: ultimo.detail });
