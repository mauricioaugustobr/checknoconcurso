const plan = new URLSearchParams(location.search).get("plan");

// Concurso de origem (item 6): veio de uma página de concurso? Depois de pagar, volta para a ficha dele.
const ORIGEM_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
const origem = (() => {
  const daUrl = new URLSearchParams(location.search).get("origem");
  if (daUrl && ORIGEM_RE.test(daUrl)) return daUrl;
  try {
    const salvo = JSON.parse(sessionStorage.getItem("cnc-origem") || "null");
    if (salvo && ORIGEM_RE.test(salvo.id) && Date.now() - salvo.em < 6 * 3600e3) return salvo.id;
  } catch { /* sem origem */ }
  return null;
})();
if (origem) {
  const trocar = document.querySelector(".summary-link");
  if (trocar) trocar.href = "/?origem=" + origem + "#planos";
}
const PLANS = {
  essencial: {
    name: "Check Essencial",
    desc: "Tudo do básico e do essencial: concursos, datas de prova, editais e cursos",
    price: "R$ 9,99",
    cadence: "/mês",
    note: "Assinatura mensal no cartão, com renovação automática. No Pix, o acesso não se renova.",
    features: [
      "Todos os concursos ativos e encerrados do Brasil",
      "Busca e filtros por estado, área, escolaridade e salário",
      "Salários, vagas e taxas de cada concurso",
      "Datas de prova atualizadas e alertas de retificação",
      "Editais oficiais e Raio-X das matérias",
      "Comparador de cursos com cupons de desconto",
    ],
  },
  "completo-mensal": {
    name: "Check Completo",
    desc: "Tudo do Essencial + treinar com questões de provas anteriores",
    price: "R$ 23,99",
    cadence: "/mês",
    note: "Assinatura mensal no cartão, com renovação automática. No Pix, o acesso não se renova.",
    features: [
      "Tudo do Check Essencial: concursos, editais e cursos",
      "Treinar com questões de provas anteriores (para concursos que já tiveram edições anteriores)",
      "Todas as questões com resposta e explicação em 3 parágrafos logo abaixo",
      "Gabaritos oficiais organizados por ano e banca",
    ],
  },
  "completo-anual": {
    name: "Check Completo",
    desc: "Doze meses de acesso total, com economia no ano",
    price: "R$ 199,90",
    cadence: "/ano",
    note: "Pagamento anual: 12 meses de acesso. No cartão a renovação é automática; no Pix, não.",
    features: [
      "Tudo do Check Essencial: concursos, editais e cursos",
      "Treinar com questões de provas anteriores (para concursos que já tiveram edições anteriores)",
      "Todas as questões com resposta e explicação em 3 parágrafos logo abaixo",
      "Gabaritos oficiais organizados por ano e banca",
    ],
  },
};

const elem = (id) => document.getElementById(id);

if (!Object.hasOwn(PLANS, plan)) location.replace("/");
const info = PLANS[plan];

// Cabeçalho do resumo
elem("plan-name").textContent = info.name;
elem("plan-desc").textContent = info.desc;
elem("plan-price").textContent = info.price;
elem("plan-cadence").textContent = info.cadence;
elem("plan-total").textContent = info.price;
elem("plan-note").textContent = info.note;
document.title = info.name + " | Pagamento — Check no Concurso";

const check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
check.setAttribute("viewBox", "0 0 24 24");
check.setAttribute("width", "16");
check.setAttribute("height", "16");
check.setAttribute("fill", "none");
check.setAttribute("stroke", "currentColor");
check.setAttribute("stroke-width", "2.6");
check.setAttribute("stroke-linecap", "round");
check.setAttribute("stroke-linejoin", "round");
check.setAttribute("aria-hidden", "true");
check.innerHTML = '<path d="M20 6 9 17l-5-5"/>';

for (const feature of info.features) {
  const item = document.createElement("li");
  item.append(check.cloneNode(true), document.createTextNode(feature));
  elem("plan-features").append(item);
}

function say(text, isError = false) {
  const box = elem("message");
  box.textContent = text;
  if (isError) box.dataset.error = "true";
  else delete box.dataset.error;
}

async function post(route, data) {
  const res = await fetch("/api/stripe/" + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Tente novamente.");
  return result;
}

function renderQr(code) {
  const box = elem("qr");
  if (!box) return;
  if (!code || typeof window.qrcode !== "function") {
    box.hidden = true;
    return;
  }
  try {
    const qr = window.qrcode(0, "M");
    qr.addData(code);
    qr.make();
    box.innerHTML = qr.createSvgTag({
      cellSize: 4,
      margin: 2,
      scalable: true,
    });
    box.hidden = false;
  } catch {
    box.hidden = true;
  }
}

async function display(order) {
  elem("buyer").hidden = true;
  elem("payment").hidden = false;
  elem("code").value = order.code;
  renderQr(order.code);
  window.scrollTo({ top: 0, behavior: "smooth" });
  say("");
  while (Date.now() < order.until) {
    try {
      if ((await post("pix", { txid: order.txid })).paid) {
        sessionStorage.removeItem("pixOrder");
        elem("payment").hidden = true;
        say("Pagamento confirmado! Seu plano está disponível.");
        // Veio de um concurso: abre a ficha dele com o aviso "Assinatura ativa"
        if (origem) {
          say("Pagamento confirmado! Abrindo a ficha do seu concurso…");
          setTimeout(() => location.assign("/?assinatura=ativa&origem=" + origem), 1200);
        }
        return;
      }
      say("Aguardando a confirmação do banco. Não feche esta página.");
    } catch (err) {
      say(err.message, true);
    }
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }
  sessionStorage.removeItem("pixOrder");
  elem("payment").hidden = true;
  elem("buyer").hidden = false;
  say("Código expirado. Se você já pagou, volte à sua conta para consultar o plano.", true);
}

elem("buyer").onsubmit = async (event) => {
  event.preventDefault();
  const card = event.submitter.value === "card";
  const data = {
    ...Object.fromEntries(new FormData(event.target)),
    plan,
    card,
  };
  for (const b of event.target.querySelectorAll("button")) b.disabled = true;
  say(card ? "Abrindo o pagamento seguro…" : "Gerando seu código Pix…");
  try {
    const order = await post("pix", data);
    if (card) {
      location.assign((await post("checkout", origem ? { plan, origem } : { plan })).url);
      return;
    }
    const saved = { ...order, plan, until: Date.now() + 1800000 };
    sessionStorage.setItem("pixOrder", JSON.stringify(saved));
    display(saved);
  } catch (err) {
    say(err.message, true);
  } finally {
    for (const b of elem("buyer").querySelectorAll("button"))
      b.disabled = false;
  }
};

elem("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(elem("code").value);
    say("Código Pix copiado. Cole no app do seu banco para pagar.");
  } catch {
    elem("code").select();
    say("Selecione o código e copie manualmente.", true);
  }
};

const saved = JSON.parse(sessionStorage.getItem("pixOrder") || "null");
if (saved?.plan === plan && saved.until > Date.now()) display(saved);
