/**
 * Item 6 · Tela de planos adaptada ao concurso de origem (Opção 1 da Designer UI/UX).
 *
 * Quem clica em "Assinar" numa página de concurso chega em /?origem=<id>#planos.
 * A tela de planos pede este resumo para desenhar a faixa "Você está vendo" e a linha
 * de cada cartão. São só dados que a página pública /concurso/<id> já mostra a qualquer
 * visitante (situação, datas, área). Nada do conteúdo pago sai daqui.
 */

// Id de concurso: letras minúsculas, números e hífen (o mesmo formato das URLs /concurso/<id>)
export const ORIGEM_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
export const origemValida = (v) => (typeof v === 'string' && ORIGEM_RE.test(v) ? v : null);

const isoDay = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : ''));
// Data de hoje no horário de Brasília (UTC-3)
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

/**
 * catalog: catálogo ao vivo (com os ajustes do painel); indice: /provas/index.json.
 * Devolve null quando o concurso não existe (ou está oculto).
 */
export function resumoOrigem(catalog, indice, id, hoje = hojeBR()) {
  const c = (catalog || []).find((x) => x.id === id);
  if (!c) return null;
  const idx = indice || {};
  const prova = idx[c.id] || null;
  // Provas anteriores de concursos da mesma área (o treino do Completo vale para todas)
  const areaDe = new Map((catalog || []).map((x) => [x.id, x.area]));
  const provasNaArea = Object.keys(idx).filter((k) => areaDe.get(k) === c.area).length;
  const fim = isoDay(c.inscricaoFim);
  const prova_ = isoDay(c.dataProva);
  return {
    id: c.id,
    sigla: c.sigla,
    cargo: c.titulo || '',
    orgao: c.orgao || '',
    status: c.status || '',
    // Só aparecem as etiquetas que existirem e ainda valerem
    inscricaoFim: fim && fim >= hoje ? fim : null,
    dataProva: prova_ || null,
    area: c.area || '',
    temProvaPropria: Boolean(prova),
    anoProva: prova?.ano || null,
    provasNaArea
  };
}
