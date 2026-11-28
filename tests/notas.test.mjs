import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createSessionToken } from '../lib/auth.js';
import { handleNotas } from '../lib/admin-api.js';
import { montarConsulta, formatarCpf, formatarDocumento, whatsapp, marcarNota, listarNotas } from '../lib/notas.js';
import { documentoValido, normalizarDocumento, normalizarTelefone, telefoneValido, conferirDadosDaNota } from '../lib/pix.js';
import { dadosDaNotaCompletos } from '../lib/stripe.js';
import { assinaturaDoCheck, faturaDoCheck, registrarPagamentoStripe, portalDoCheck, handleWebhook, modoDaChave } from '../lib/stripe.js';

// Testes sem banco: DATABASE_URL fica vazia de propósito
delete process.env.DATABASE_URL;
const SECRET = 'n'.repeat(48);
process.env.SESSION_SECRET = SECRET;
process.env.ADMIN_EMAILS = 'chefe@exemplo.com';
const BASE = 'https://checknoconcurso.vercel.app';
const cookieFor = (email) => 'cnc_session=' + createSessionToken({ sub: '1', email, name: 'Teste', provider: 'google' }, SECRET);
const req = (path, { method = 'GET', email, origin, body } = {}) => new Request(BASE + path, {
  method,
  headers: { ...(email ? { cookie: cookieFor(email) } : {}), ...(origin ? { origin, host: 'checknoconcurso.vercel.app' } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined
});

async function run() {
  // 1. Lista "Notas a emitir": só admin vê e marca
  assert.equal((await handleNotas(req('/api/admin/notas'))).status, 401, 'sem login');
  assert.equal((await handleNotas(req('/api/admin/notas', { email: 'aluno@exemplo.com' }))).status, 403, 'usuário comum');
  const vazio = await handleNotas(req('/api/admin/notas', { email: 'chefe@exemplo.com' }));
  assert.equal(vazio.status, 200);
  assert.equal((await vazio.json()).semBanco, true, 'sem banco a lista vem vazia, sem erro');
  const deFora = await handleNotas(req('/api/admin/notas', { method: 'POST', email: 'chefe@exemplo.com', origin: 'https://evil.com', body: { origem: 'pix', ref: 'abcdef123', emitida: true } }));
  assert.equal(deFora.status, 403, 'marcação vinda de outro site é bloqueada');
  assert.deepEqual(await listarNotas(), { itens: [], semBanco: true });

  // 2. Marcação valida a forma de pagamento e o pagamento antes de tocar no banco
  await assert.rejects(marcarNota({ origem: 'boleto', ref: 'abcdef123', emitida: true }, 'chefe@exemplo.com'), /Forma de pagamento inválida/);
  await assert.rejects(marcarNota({ origem: 'pix', ref: "x'; drop table--", emitida: true }, 'chefe@exemplo.com'), /Pagamento inválido/);
  await assert.rejects(marcarNota({ origem: 'cartao', ref: 'in_1AbCdEf', emitida: true }, 'chefe@exemplo.com'), /Banco de dados não configurado/);

  // 3. CPF no formato da nota
  assert.equal(formatarCpf('12345678909'), '123.456.789-09');
  assert.equal(formatarCpf('123.456.789-09'), '123.456.789-09');
  assert.equal(formatarCpf(''), null);
  assert.equal(formatarCpf(null), null);
  assert.equal(formatarDocumento('59147417000124'), '59.147.417/0001-24', 'CNPJ no formato da nota');
  assert.equal(formatarDocumento('12ABC34501DE35'), '12.ABC.345/01DE-35', 'CNPJ alfanumérico');

  // 3b. Compra aceita CPF ou CNPJ válidos (o CNPJ alfanumérico da Receita também)
  assert.equal(documentoValido(normalizarDocumento('529.982.247-25')), true, 'CPF válido');
  assert.equal(documentoValido(normalizarDocumento('529.982.247-24')), false, 'CPF com dígito errado');
  assert.equal(documentoValido(normalizarDocumento('59.147.417/0001-24')), true, 'CNPJ válido');
  assert.equal(documentoValido(normalizarDocumento('59.147.417/0001-25')), false, 'CNPJ com dígito errado');
  assert.equal(documentoValido(normalizarDocumento('12.ABC.345/01DE-35')), true, 'CNPJ alfanumérico válido');
  assert.equal(documentoValido(normalizarDocumento('11.111.111/1111-11')), false, 'CNPJ repetido');
  assert.equal(documentoValido('123'), false);

  // 3c. WhatsApp: número legível e link com o 55 do Brasil
  assert.deepEqual(whatsapp('11987654321'), { numero: '(11) 98765-4321', link: 'https://wa.me/5511987654321' });
  assert.deepEqual(whatsapp('5511987654321'), { numero: '(11) 98765-4321', link: 'https://wa.me/5511987654321' });
  assert.deepEqual(whatsapp('2133334444'), { numero: '(21) 3333-4444', link: 'https://wa.me/552133334444' });
  assert.deepEqual(whatsapp(''), { numero: null, link: null });
  assert.deepEqual(whatsapp('011987654321'), { numero: '(11) 98765-4321', link: 'https://wa.me/5511987654321' }, 'zero na frente');

  // 3d. Padrão do pagamento: nome, CPF/CNPJ, e-mail e WhatsApp obrigatórios (Pix e cartão)
  assert.equal(normalizarTelefone('0 (11) 98765-4321'), '11987654321');
  assert.equal(normalizarTelefone('+55 11 98765-4321'), '11987654321');
  assert.equal(telefoneValido('11987654321'), true);
  assert.equal(telefoneValido('1133334444'), true, 'fixo com DDD');
  assert.equal(telefoneValido('987654321'), false, 'sem DDD');
  const ok = { name: 'Pessoa Exemplo', cpf: '52998224725', email: 'pessoa@exemplo.com', phone: '11987654321' };
  assert.equal(conferirDadosDaNota(ok), null);
  assert.match(conferirDadosDaNota({ ...ok, name: '' }), /nome completo/);
  assert.match(conferirDadosDaNota({ ...ok, cpf: '123' }), /CPF ou CNPJ/);
  assert.match(conferirDadosDaNota({ ...ok, email: 'sem-arroba' }), /e-mail/);
  assert.match(conferirDadosDaNota({ ...ok, phone: '' }), /WhatsApp com DDD/);
  assert.equal(dadosDaNotaCompletos({ buyer_name: 'A', cpf: '52998224725', email: 'a@b.com', phone: '11987654321' }), true);
  assert.equal(dadosDaNotaCompletos({ buyer_name: 'A', cpf: '52998224725', email: 'a@b.com', phone: '' }), false, 'sem WhatsApp o cartão não abre');
  assert.equal(dadosDaNotaCompletos({}), false);

  // 4. Consulta: Pix pago + cartão real (modo teste e valor zero ficam de fora)
  assert.equal(montarConsulta({ pix: false, cartao: false, contatos: false }), null, 'sem tabelas de pagamento, nada a listar');
  const soPix = montarConsulta({ pix: true, cartao: false, contatos: false });
  assert.ok(soPix.includes('from cnc_pix_orders o where o.paid_at is not null'));
  assert.ok(soPix.includes('o.phone as telefone'), 'WhatsApp do Pix entra na lista');
  assert.ok(!soPix.includes('cnc_stripe_payments'));
  const tudo = montarConsulta({ pix: true, cartao: true, contatos: true }, { pendentes: true });
  assert.ok(tudo.includes('union all'));
  assert.ok(tudo.includes('left join cnc_billing_contacts bc on bc.account = p.email'), 'nome e CPF do cartão vêm do cadastro feito antes do pagamento');
  assert.ok(tudo.includes('where p.livemode and p.cents > 0'), 'cartão em modo teste não entra');
  assert.ok(tudo.includes('coalesce(p.buyer_name, bc.buyer_name)') && tudo.includes('coalesce(p.phone, bc.phone) as telefone'),
    'cartão: primeiro os dados guardados no pagamento, depois o cadastro');
  assert.ok(tudo.includes('where not coalesce(nf.emitida, false)'), 'filtro "Sem nota"');
  assert.ok(!montarConsulta({ pix: true, cartao: true, contatos: false }).includes('cnc_billing_contacts'), 'sem cadastro de cobrança, a consulta não depende dele');
  assert.ok(montarConsulta({ pix: true, cartao: false, contatos: false }, { limite: 50000 }).trim().endsWith('limit 1000'));

  // 5. Conta Stripe dividida com outra marca: só o que é do Check libera plano e entra nas notas
  const subCheck = { items: { data: [{ price: { lookup_key: 'cnc_completo_anual' } }] } };
  const subOutra = { items: { data: [{ price: { lookup_key: 'imoveno_pro_mensal' } }] }, metadata: {} };
  assert.equal(assinaturaDoCheck(subCheck), true);
  assert.equal(assinaturaDoCheck({ items: { data: [{ price: {} }] }, metadata: { app: 'checknoconcurso' } }), true);
  assert.equal(assinaturaDoCheck(subOutra), false);
  assert.equal(faturaDoCheck({ lines: { data: [{ pricing: { price_details: { price_lookup_key: 'cnc_essencial_mensal' } } }] } }), true);
  assert.equal(faturaDoCheck({ lines: { data: [{ price: { lookup_key: null } }] }, parent: { subscription_details: { metadata: { app: 'checknoconcurso' } } } }), true);
  assert.equal(faturaDoCheck({ lines: { data: [{ price: { lookup_key: 'imoveno_pro_mensal' } }] } }), false);
  assert.deepEqual(await registrarPagamentoStripe({ id: 'in_outra', lines: { data: [{ price: { lookup_key: 'imoveno_pro_mensal' } }] } }), { ignorado: true }, 'fatura de outra marca não é gravada');

  // 6. Portal de assinatura: usa a configuração do Check (nome e textos do Check), não a da outra marca
  const portal = await portalDoCheck({ api: async () => ({ data: [{ id: 'bpc_outra', metadata: {} }, { id: 'bpc_check', metadata: { app: 'checknoconcurso' } }] }) });
  assert.equal(portal, 'bpc_check');

  // 7. Aviso da Stripe no modo certo: com chave real, aviso de teste é ignorado (e o contrário)
  const whsec = 'whsec_teste_notas';
  process.env.STRIPE_WEBHOOK_SECRET = whsec;
  const aviso = (evento) => {
    const corpo = JSON.stringify(evento);
    const t = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', whsec).update(`${t}.${corpo}`).digest('hex');
    return new Request(BASE + '/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${sig}` }, body: corpo });
  };
  process.env.STRIPE_SECRET_KEY = 'sk_live_fakefakefake123';
  assert.equal(modoDaChave(), 'live');
  const testeComReal = await handleWebhook(aviso({ id: 'evt_t', type: 'invoice.paid', livemode: false, data: { object: { id: 'in_t' } } }));
  assert.equal(testeComReal.status, 200);
  assert.equal((await testeComReal.json()).ignorado, true, 'aviso de teste não mexe em nada quando a chave é real');
  process.env.STRIPE_SECRET_KEY = 'sk_test_fakefakefake123';
  assert.equal(modoDaChave(), 'test');
  assert.equal((await (await handleWebhook(aviso({ id: 'evt_l', type: 'invoice.paid', livemode: true, data: { object: { id: 'in_l' } } }))).json()).ignorado, true);
  const ping = await handleWebhook(aviso({ id: 'evt_p', type: 'ping', livemode: false, data: { object: {} } }));
  assert.equal(ping.status, 200);
  assert.equal((await ping.json()).ignorado, undefined, 'aviso do mesmo modo segue o caminho normal');
  // Segredo do aviso real guardado à parte também é aceito
  delete process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET_LIVE = whsec;
  assert.equal((await handleWebhook(aviso({ id: 'evt_p2', type: 'ping', livemode: false, data: { object: {} } }))).status, 200);
  delete process.env.STRIPE_WEBHOOK_SECRET_LIVE;
  delete process.env.STRIPE_SECRET_KEY;
  assert.equal(modoDaChave(), null);

  console.log('OK: Notas a emitir (permissões, consulta e marcação) e separação das vendas do Check na conta Stripe validadas.');
}

run().catch((err) => {
  console.error('FALHA NOS TESTES DAS NOTAS:', err);
  process.exit(1);
});
