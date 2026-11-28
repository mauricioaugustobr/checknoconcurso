/**
 * "Notas a emitir" (painel de admin): cada pagamento real, com nome, CPF, valor, data
 * e a marcação "nota emitida". A nota fiscal continua sendo emitida à mão, fora do site.
 *
 * - Pix: pedidos pagos (cnc_pix_orders, com nome e CPF informados na compra).
 * - Cartão: faturas pagas em modo real (cnc_stripe_payments.livemode), com nome e CPF que a pessoa
 *   informou no site antes do pagamento (cnc_billing_contacts). Cartão em modo teste não entra.
 * As tabelas de pagamento são criadas pelo Pix e pela Stripe no primeiro uso; aqui só se lê.
 */
import { db } from './db.js';

export const ORIGENS = new Set(['pix', 'cartao']);
const REF_OK = /^[A-Za-z0-9_-]{6,80}$/;

let schema = null;
function garantirTabela(sql) {
  return (schema ||= sql`create table if not exists cnc_notas_fiscais (
      origem text not null,
      ref text not null,
      emitida boolean not null default false,
      numero text,
      emitida_em timestamptz,
      emitida_por text,
      atualizado_em timestamptz not null default now(),
      primary key (origem, ref)
    )`.catch((err) => { schema = null; throw err; }));
}

/** Quais tabelas de pagamento já existem (o site cria cada uma no primeiro uso). */
async function tabelas(sql) {
  const [t] = await sql`select to_regclass('public.cnc_pix_orders') is not null as pix,
    to_regclass('public.cnc_stripe_payments') is not null as cartao,
    to_regclass('public.cnc_billing_contacts') is not null as contatos`;
  return t;
}

/** CPF só com números, no formato 000.000.000-00 quando tiver 11 dígitos. */
export function formatarCpf(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : (d || null);
}

/** Monta a consulta conforme as tabelas que existem. Exportada para teste. */
export function montarConsulta({ pix, cartao, contatos }, { pendentes = false, limite = 500 } = {}) {
  const partes = [];
  if (pix) {
    partes.push(`select 'pix'::text as origem, o.id as ref, o.buyer_name as nome, o.cpf, o.email, o.account,
        o.plan as plano, o.cents, o.paid_at as pago_em
      from cnc_pix_orders o where o.paid_at is not null`);
  }
  if (cartao) {
    partes.push(contatos
      ? `select 'cartao'::text as origem, p.invoice_id as ref, bc.buyer_name as nome, bc.cpf, coalesce(bc.email, p.email) as email,
          p.email as account, p.tier as plano, p.cents, p.paid_at as pago_em
        from cnc_stripe_payments p left join cnc_billing_contacts bc on bc.account = p.email
        where p.livemode and p.cents > 0`
      : `select 'cartao'::text as origem, p.invoice_id as ref, null::text as nome, null::text as cpf, p.email as email,
          p.email as account, p.tier as plano, p.cents, p.paid_at as pago_em
        from cnc_stripe_payments p where p.livemode and p.cents > 0`);
  }
  if (!partes.length) return null;
  const n = Math.max(1, Math.min(Number(limite) || 500, 1000));
  return `select x.*, coalesce(nf.emitida, false) as emitida, nf.numero, nf.emitida_em, nf.emitida_por
    from (${partes.join(' union all ')}) x
    left join cnc_notas_fiscais nf on nf.origem = x.origem and nf.ref = x.ref
    ${pendentes ? 'where not coalesce(nf.emitida, false)' : ''}
    order by x.pago_em desc nulls last
    limit ${n}`;
}

export async function listarNotas({ pendentes = false } = {}) {
  const sql = db();
  if (!sql) return { itens: [], semBanco: true };
  await garantirTabela(sql);
  const consulta = montarConsulta(await tabelas(sql), { pendentes });
  const rows = consulta ? await sql.query(consulta) : [];
  const itens = rows.map((r) => ({
    origem: r.origem,
    ref: r.ref,
    nome: r.nome || null,
    cpf: formatarCpf(r.cpf),
    email: r.email || r.account || null,
    plano: r.plano || null,
    centavos: Number(r.cents || 0),
    pagoEm: r.pago_em ? new Date(r.pago_em).toISOString() : null,
    emitida: Boolean(r.emitida),
    numero: r.numero || null,
    emitidaEm: r.emitida_em ? new Date(r.emitida_em).toISOString() : null,
    emitidaPor: r.emitida_por || null
  }));
  const pend = itens.filter((i) => !i.emitida);
  return {
    itens,
    resumo: { pendentes: pend.length, pendentesCentavos: pend.reduce((s, i) => s + i.centavos, 0) }
  };
}

/** Marca ou desmarca "nota emitida" (com o número da nota, se informado). */
export async function marcarNota({ origem, ref, emitida, numero }, adminEmail) {
  if (!ORIGENS.has(origem)) throw new Error('Forma de pagamento inválida.');
  if (!REF_OK.test(String(ref || ''))) throw new Error('Pagamento inválido.');
  const sql = db();
  if (!sql) throw new Error('Banco de dados não configurado.');
  await garantirTabela(sql);
  const t = await tabelas(sql);
  const existe = origem === 'pix'
    ? (t.pix ? (await sql`select 1 from cnc_pix_orders where id = ${ref} and paid_at is not null`).length : 0)
    : (t.cartao ? (await sql`select 1 from cnc_stripe_payments where invoice_id = ${ref} and livemode`).length : 0);
  if (!existe) throw new Error('Pagamento não encontrado.');
  const num = String(numero ?? '').replace(/[<>"']/g, '').trim().slice(0, 40) || null;
  const marcada = Boolean(emitida);
  await sql`insert into cnc_notas_fiscais (origem, ref, emitida, numero, emitida_em, emitida_por, atualizado_em)
    values (${origem}, ${ref}, ${marcada}, ${num}, ${marcada ? new Date().toISOString() : null}::timestamptz, ${marcada ? adminEmail : null}, now())
    on conflict (origem, ref) do update set emitida = excluded.emitida, numero = excluded.numero,
      emitida_em = case when excluded.emitida then coalesce(cnc_notas_fiscais.emitida_em, excluded.emitida_em) else null end,
      emitida_por = case when excluded.emitida then coalesce(cnc_notas_fiscais.emitida_por, excluded.emitida_por) else null end,
      atualizado_em = now()`;
  return { origem, ref, emitida: marcada, numero: num };
}
