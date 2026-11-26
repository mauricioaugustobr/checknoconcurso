/**
 * Página /cancelamento.html — cancelamento de assinatura em 1 clique.
 * Toda a decisão (cancelar de verdade, valor e data) é feita no servidor (/api/stripe/cancel).
 * Esta tela só mostra o estado e envia o pedido.
 */
const $ = (s) => document.querySelector(s);
const el = {
  carregando: $('#carregando'),
  deslogado: $('#deslogado'),
  logado: $('#logado'),
  semPlano: $('#semPlano'),
  semPlanoEmail: $('#semPlanoEmail'),
  planoTag: $('#planoTag'),
  planoNome: $('#planoNome'),
  contaEmail: $('#contaEmail'),
  formaPagamento: $('#formaPagamento'),
  rotuloData: $('#rotuloData'),
  dataFim: $('#dataFim'),
  avisoJaCancelada: $('#avisoJaCancelada'),
  acaoCancelar: $('#acaoCancelar'),
  acaoReembolso: $('#acaoReembolso'),
  btnCancelar: $('#btnCancelar'),
  explicacaoAcao: $('#explicacaoAcao'),
  confirmacao: $('#confirmacao'),
  textoConfirmacao: $('#textoConfirmacao'),
  btnConfirmar: $('#btnConfirmar'),
  btnVoltar: $('#btnVoltar'),
  resultado: $('#resultado'),
  detalhesCartao: $('#detalhesCartao'),
  btnPortal: $('#btnPortal'),
  formPedido: $('#formPedido'),
  pedidoEmail: $('#pedidoEmail'),
  btnPedido: $('#btnPedido'),
  pedidoResultado: $('#pedidoResultado')
};

const NOMES = {
  essencial: 'Check Essencial',
  'completo-mensal': 'Check Completo (mensal)',
  'completo-anual': 'Check Completo (anual)'
};

let sessao = null;

function mostrar(secao) {
  el.carregando.classList.add('hidden');
  for (const s of [el.deslogado, el.logado, el.semPlano]) {
    if (s === secao) s.classList.remove('hidden');
    else s.classList.add('hidden');
  }
}

function dataBR(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function aviso(tipo, html) {
  el.resultado.className = `note ${tipo ? `is-${tipo}` : ''}`;
  el.resultado.innerHTML = html;
  el.resultado.classList.remove('hidden');
}

async function api(path, body) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Não foi possível concluir agora. Tente de novo.');
    err.codigo = res.status;
    err.manual = Boolean(data.manual);
    throw err;
  }
  return data;
}

function pedirLogin() {
  const voltar = encodeURIComponent('/cancelamento.html');
  location.href = `/?entrar=1&voltar=${voltar}`;
}

async function carregar() {
  let user = null;
  try {
    user = (await api('/api/auth/session')).user;
  } catch {
    /* sem sessão seguimos como visitante */
  }
  sessao = user;
  if (!user) {
    mostrar(el.deslogado);
    return;
  }
  if (!user.plan) {
    el.semPlanoEmail.textContent = user.email || '—';
    mostrar(el.semPlano);
    return;
  }

  const pix = user.planMethod === 'Pix';
  // No Pix o servidor já informa cancel_at_period_end = true (não renova), então só o cartão tem "cancelamento".
  const cancelada = Boolean(user.planCancelAtPeriodEnd) && !pix;

  el.contaEmail.textContent = user.email || '—';
  el.planoNome.textContent = NOMES[user.plan] || 'Assinatura ativa';
  el.formaPagamento.textContent = pix ? 'Pix (pagamento único)' : 'Cartão de crédito (Stripe)';
  el.rotuloData.textContent = pix || cancelada ? 'Acesso até' : 'Próxima cobrança';
  el.dataFim.textContent = dataBR(user.planRenewsAt);
  el.planoTag.textContent = pix ? 'Pix · sem renovação' : cancelada ? 'Cancelada' : 'Assinatura ativa';
  el.planoTag.className = `tag ${cancelada ? 'is-off' : pix ? 'is-pix' : ''}`;

  if (pix) {
    el.acaoCancelar.classList.add('hidden');
    el.avisoJaCancelada.classList.remove('hidden');
    el.avisoJaCancelada.textContent = `Este acesso foi pago por Pix: é um pagamento único, não renova sozinho e não gera nenhuma cobrança futura. Ele termina em ${dataBR(user.planRenewsAt)}.`;
    el.acaoReembolso.classList.remove('hidden');
  } else if (cancelada) {
    el.acaoCancelar.classList.add('hidden');
    el.avisoJaCancelada.classList.remove('hidden');
    el.avisoJaCancelada.textContent = `Esta assinatura já está cancelada: nenhuma cobrança nova será feita. Você mantém o acesso até ${dataBR(user.planRenewsAt)}.`;
  } else {
    el.btnCancelar.textContent = 'Cancelar assinatura';
    el.explicacaoAcao.textContent = `Sua próxima cobrança está prevista para ${dataBR(user.planRenewsAt)}.`;
    el.textoConfirmacao.textContent = `Sua assinatura será encerrada no fim do período já pago (${dataBR(user.planRenewsAt)}). Nenhuma cobrança nova será feita e você mantém o acesso completo até essa data.`;
  }

  if (!pix && user.planMethod === 'Stripe') el.detalhesCartao.classList.remove('hidden');

  mostrar(el.logado);
  if (location.hash === '#pedido') el.formPedido.scrollIntoView({ behavior: 'smooth' });
}

el.btnCancelar.addEventListener('click', () => {
  el.confirmacao.classList.remove('hidden');
  el.resultado.classList.add('hidden');
  el.confirmacao.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.btnConfirmar.focus();
});

el.btnVoltar.addEventListener('click', () => {
  el.confirmacao.classList.add('hidden');
  el.btnCancelar.focus();
});

el.btnConfirmar.addEventListener('click', async () => {
  el.btnConfirmar.disabled = true;
  el.btnConfirmar.textContent = 'Cancelando…';
  try {
    const r = await api('/api/stripe/cancel', {});
    el.acaoCancelar.classList.add('hidden');
    el.confirmacao.classList.add('hidden');
    el.rotuloData.textContent = 'Acesso até';
    if (r.ate) el.dataFim.textContent = dataBR(r.ate);
    el.planoTag.textContent = 'Cancelada';
    el.planoTag.className = 'tag is-off';
    const base = r.method === 'Pix'
      ? (r.mensagem || 'Seu acesso por Pix não renova. Nada mais será cobrado.')
      : `Assinatura cancelada. Nenhuma cobrança nova será feita e você mantém o acesso até ${dataBR(r.ate)}.`;    const protocolo = r.protocolo ? ` <br><br><span class="muted">Protocolo: <strong>${r.protocolo}</strong></span>` : '';
    aviso('ok', `<strong>Tudo certo.</strong><br>${base}${protocolo}<br><br>Você pode continuar usando normalmente até essa data. Se mudar de ideia, assine de novo em <a href="/#planos">checknoconcurso.com.br</a>.`);
    el.resultado.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    el.confirmacao.classList.add('hidden');
    aviso('error', `${err.message}${err.manual ? ' Se preferir, registre o pedido no formulário abaixo.' : ''}`);
    if (err.codigo === 401) pedirLogin();
    if (err.manual && sessao?.email) {
      el.pedidoEmail.value = sessao.email;
      el.formPedido.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } finally {
    el.btnConfirmar.disabled = false;
    el.btnConfirmar.textContent = 'Sim, cancelar';
  }
});

el.btnPortal.addEventListener('click', async () => {
  el.btnPortal.disabled = true;
  try {
    const { url } = await api('/api/stripe/portal', {});
    location.href = url;
  } catch (err) {
    aviso('error', err.message);
  } finally {
    el.btnPortal.disabled = false;
  }
});

el.formPedido.addEventListener('submit', async (e) => {
  e.preventDefault();
  const botao = el.btnPedido;
  const dados = Object.fromEntries(new FormData(el.formPedido));
  if (!dados.email) {
    el.pedidoResultado.className = 'note is-error';
    el.pedidoResultado.textContent = 'Informe o e-mail usado na compra.';
    el.pedidoResultado.classList.remove('hidden');
    el.pedidoEmail.focus();
    return;
  }
  botao.disabled = true;
  botao.textContent = 'Enviando…';
  try {
    const r = await api('/api/stripe/request', dados);
    el.formPedido.classList.add('hidden');
    el.pedidoResultado.className = 'note is-ok';
    el.pedidoResultado.innerHTML = `<strong>Pedido registrado.</strong><br>Protocolo <strong>${r.protocolo}</strong>.
      ${r.repetido ? 'Já tínhamos um pedido recente com este e-mail: ele está em andamento.' : 'Nossa equipe vai concluir o cancelamento e responder no e-mail informado.'}
      <br><br>Se o pagamento foi no cartão, você também pode usar o link “Gerenciar assinatura” do recibo da Stripe.`;
    el.pedidoResultado.classList.remove('hidden');
    el.pedidoResultado.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    el.pedidoResultado.className = 'note is-error';
    el.pedidoResultado.textContent = err.message;
    el.pedidoResultado.classList.remove('hidden');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Registrar pedido de cancelamento';
  }
});

carregar();
