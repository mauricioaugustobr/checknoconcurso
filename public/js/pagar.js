const plan = new URLSearchParams(location.search).get("plan");
const labels = {
  essencial: "Essencial · R$ 6,99 por mês",
  "completo-mensal": "Completo · R$ 17,99 por mês",
  "completo-anual": "Completo · R$ 199,90 por ano",
};
const elem = (id) => document.getElementById(id);
if (!Object.hasOwn(labels, plan)) location.replace("/");
elem("plan").textContent = labels[plan];
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
async function display(order) {
  elem("buyer").hidden = true;
  elem("payment").hidden = false;
  elem("code").value = order.code;
  while (Date.now() < order.until) {
    try {
      if ((await post("pix", { txid: order.txid })).paid) {
        sessionStorage.removeItem("pixOrder");
        elem("payment").hidden = true;
        elem("message").textContent =
          "Pagamento confirmado! Seu plano está disponível.";
        return;
      }
      elem("message").textContent = "Aguardando confirmação.";
    } catch (err) {
      elem("message").textContent = err.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }
  sessionStorage.removeItem("pixOrder");
  elem("payment").hidden = true;
  elem("buyer").hidden = false;
  elem("message").textContent =
    "Código expirado. Se você já pagou, volte à sua conta para consultar o plano.";
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
  try {
    const order = await post("pix", data);
    if (card) {
      location.assign((await post("checkout", { plan })).url);
      return;
    }
    const saved = { ...order, plan, until: Date.now() + 1800000 };
    sessionStorage.setItem("pixOrder", JSON.stringify(saved));
    display(saved);
  } catch (err) {
    elem("message").textContent = err.message;
  } finally {
    for (const b of elem("buyer").querySelectorAll("button"))
      b.disabled = false;
  }
};
elem("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(elem("code").value);
    elem("message").textContent = "Código copiado.";
  } catch {
    elem("code").select();
  }
};
const saved = JSON.parse(sessionStorage.getItem("pixOrder") || "null");
if (saved?.plan === plan && saved.until > Date.now()) display(saved);
