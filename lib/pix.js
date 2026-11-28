import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { bank } from "./inter.js";
import { getSessionUser, contaBloqueada, authJson } from "./auth.js";

const prices = new Map([
  ["essencial", 999],
  ["completo-mensal", 2399],
  ["completo-anual", 19990],
]);
const key = "59147417000124";
const reply = (data, status = 200) =>
  authJson(data, status, { "Cache-Control": "no-store" });
let schema;
function ready(sql) {
  return (schema ||= sql`create table if not exists cnc_pix_orders (
    id text primary key, account text not null, plan text not null, cents int not null,
    buyer_name text not null, cpf text not null, email text not null, phone text not null,
    created_at timestamptz default now(), paid_at timestamptz, ends_at timestamptz, closed boolean default false)`.catch(
    (err) => {
      schema = null;
      throw err;
    },
  ));
}
function validCpf(s) {
  if (!/^\d{11}$/.test(s) || /^(\d)\1+$/.test(s)) return false;
  return [9, 10].every((n) => {
    const sum = [...s.slice(0, n)].reduce(
      (a, d, i) => a + Number(d) * (n + 1 - i),
      0,
    );
    return ((sum * 10) % 11) % 10 === Number(s[n]);
  });
}
/** CNPJ numérico ou alfanumérico (Receita Federal, desde 07/2026): 12 letras/números + 2 dígitos verificadores. */
function validCnpj(s) {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(s) || /^(.)\1+$/.test(s)) return false;
  const valor = (c) => c.charCodeAt(0) - 48;
  const digito = (n) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = pesos.reduce((a, p, i) => a + valor(s[i]) * p, 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(12) === Number(s[12]) && digito(13) === Number(s[13]);
}
/** Documento da nota: só letras e números, em maiúsculas (CPF fica só com dígitos). */
export function normalizarDocumento(v) {
  return String(v || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}
/** Aceita CPF (11 dígitos) ou CNPJ (14 caracteres) válidos. */
export function documentoValido(doc) {
  return validCpf(doc) || validCnpj(doc);
}
/** WhatsApp com DDD: só dígitos, sem zero na frente nem o 55 do Brasil (10 ou 11 dígitos). */
export function normalizarTelefone(v) {
  let d = String(v || "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d;
}
export const telefoneValido = (d) => /^[1-9]\d{9,10}$/.test(String(d || ""));
export const emailCompraValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "")) && String(e).length <= 254;
/**
 * Padrão de todo pagamento (Pix e cartão): nome, CPF ou CNPJ, e-mail e WhatsApp, os dados da nota fiscal.
 * Devolve a mensagem do primeiro dado que falta ou está errado, ou null quando está tudo certo.
 */
export function conferirDadosDaNota({ name, cpf, email, phone }) {
  if (String(name || "").length < 3 || String(name).length > 150) return "Digite o nome completo ou a razão social.";
  if (!documentoValido(cpf)) return "Digite um CPF ou CNPJ válido.";
  if (!emailCompraValido(email)) return "Digite um e-mail válido.";
  if (!telefoneValido(phone)) return "Digite o WhatsApp com DDD, por exemplo (11) 91234-5678.";
  return null;
}
async function reconcile(sql, row) {
  if (row.paid_at) return true;
  const charge = await bank("GET", row.id);
  const value = (row.cents / 100).toFixed(2);
  const payment = charge.pix?.find(
    (p) =>
      p.txid === row.id &&
      p.valor === value &&
      p.endToEndId &&
      !p.devolucoes?.length,
  );
  if (
    charge.status !== "CONCLUIDA" &&
    charge.txid === row.id &&
    Date.now() - new Date(row.created_at).getTime() > 86400000
  ) {
    await sql`update cnc_pix_orders set closed=true where id=${row.id} and paid_at is null`;
  }
  if (
    charge.txid !== row.id ||
    charge.chave !== key ||
    charge.status !== "CONCLUIDA" ||
    charge.valor?.original !== value ||
    !payment
  )
    return false;
  await sql`update cnc_pix_orders set paid_at=${payment.horario}::timestamptz,
    ends_at=${payment.horario}::timestamptz + case when plan='completo-anual' then interval '1 year' else interval '1 month' end
    where id=${row.id} and paid_at is null`;
  return true;
}
export async function pixPlan(email) {
  if (!process.env.INTER_CLIENT_ID || !db()) return null;
  const sql = db();
  await ready(sql);
  const pending =
    await sql`select * from cnc_pix_orders where account=${email} and paid_at is null and not closed order by created_at limit 8`;
  await Promise.allSettled(pending.map((row) => reconcile(sql, row)));
  const rows =
    await sql`select plan as tier,'active' as status,ends_at as current_period_end,true as cancel_at_period_end from cnc_pix_orders where account=${email} and ends_at>now() order by (plan<>'essencial') desc,ends_at desc limit 1`;
  return rows[0];
}
/** Pagamentos Pix confirmados por conta: total pago, quantidade, último pagamento e fim do acesso. */
export async function resumoPagamentosPix() {
  const sql = db();
  if (!sql) return [];
  await ready(sql);
  return sql`select account as email, sum(cents)::int as cents, count(*)::int as pagamentos,
      max(paid_at) as ultimo, max(ends_at) as acesso_ate,
      (array_agg(plan order by paid_at desc))[1] as ultimo_plano
    from cnc_pix_orders where paid_at is not null group by account`;
}
export async function handlePix(req) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return reply({ error: "Origem inválida" }, 403);
  const user = getSessionUser(req);
  if (!user) return reply({ error: "Entre com sua conta para comprar." }, 401);
  const account = user.email.toLowerCase();
  const sql = db();
  await ready(sql);
  const b = await req.json();
  if (b.txid) {
    const [row] =
      await sql`select * from cnc_pix_orders where account=${account} and id=${b.txid}`;
    if (!row) return reply({ error: "Pedido não encontrado" }, 404);
    return reply({ paid: await reconcile(sql, row) });
  }
  if (await contaBloqueada(account))
    return reply({ error: "Esta conta está bloqueada. Fale com o suporte do Check no Concurso." }, 403);
  // CPF ou CNPJ (o campo continua se chamando "cpf" no formulário e no banco)
  const cpf = normalizarDocumento(b.cpf);
  const phone = normalizarTelefone(b.phone);
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim();
  if (!prices.has(b.plan))
    return reply({ error: "Confira o plano, nome, CPF ou CNPJ, e-mail e WhatsApp." }, 400);
  // Padrão: os 4 dados da nota são obrigatórios no Pix e no cartão (a mensagem diz qual corrigir)
  const erroDados = conferirDadosDaNota({ name, cpf, email, phone });
  if (erroDados) return reply({ error: erroDados }, 400);
  if (b.card === true) {
    await sql`create table if not exists cnc_billing_contacts(account text primary key,buyer_name text,cpf text,email text,phone text)`;
    await sql`insert into cnc_billing_contacts values(${account},${name},${cpf},${email},${phone}) on conflict(account) do update set buyer_name=excluded.buyer_name,cpf=excluded.cpf,email=excluded.email,phone=excluded.phone`;
    return reply({ saved: true });
  }
  const id = randomUUID().replaceAll("-", "");
  const cents = prices.get(b.plan);
  await sql`insert into cnc_pix_orders(id,account,plan,cents,buyer_name,cpf,email,phone) values(${id},${account},${b.plan},${cents},${name},${cpf},${email},${phone})`;
  const charge = await bank("PUT", id, {
    calendario: { expiracao: 1800 },
    valor: { original: (cents / 100).toFixed(2) },
    chave: key,
  });
  if (!charge.pixCopiaECola) throw new Error("Código Pix indisponível");
  return reply({ txid: id, code: charge.pixCopiaECola });
}
