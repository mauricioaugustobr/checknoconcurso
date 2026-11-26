import { PROVAS, getProva } from "./data/provas.js";
import { CONCURSOS } from "./data/concursos.js";

const params = new URLSearchParams(location.search);
const concursoId = params.get("concurso");
const anoParam = Number(params.get("ano")) || null;

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};
const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);

const concurso = CONCURSOS.find((item) => item.id === concursoId) || null;
const prova = concurso ? getProva(concursoId, anoParam) : null;

const KEY = prova ? `cnc:prova:${concursoId}:${prova.ano}` : null;
let estado = carregarEstado();

function carregarEstado() {
  const base = { atual: 0, respostas: {}, inicio: Date.now(), finalizada: null, revisao: false };
  if (!KEY) return base;
  try {
    const salvo = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!salvo || typeof salvo !== "object") return base;
    return { ...base, ...salvo, revisao: false };
  } catch {
    return base;
  }
}

function salvar() {
  if (!KEY) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(estado));
  } catch {
    /* sem espaço no navegador: a prova continua funcionando */
  }
}

/* ------------------------------------------------------------------ */
/* Cabeçalho e apresentação                                            */
/* ------------------------------------------------------------------ */

function renderCabecalho() {
  const crumb = $("#crumb");
  crumb.innerHTML = "";
  if (concurso) {
    crumb.append(
      Object.assign(el("a", null, "Concursos"), { href: "/" }),
      svgChevron(),
      el("strong", null, concurso.sigla),
      svgChevron(),
      el("span", null, `Prova ${prova?.ano || anoParam || ""}`)
    );
  } else {
    crumb.append(el("span", null, "Provas anteriores"));
  }

  if (!concurso) {
    $("#prova-eyebrow").textContent = "Provas anteriores";
    $("#prova-titulo").textContent = "Resolução de prova";
    $("#prova-sub").textContent =
      "Escolha um concurso para resolver a prova anterior questão por questão.";
    return;
  }

  $("#prova-eyebrow").textContent = prova ? `Prova anterior · ${prova.banca}` : "Prova anterior";
  $("#prova-titulo").textContent = prova
    ? `${concurso.sigla} ${prova.ano} — prova resolvida`
    : `${concurso.sigla} — prova em curadoria`;

  if (prova) {
    const partes = [
      prova.cargo,
      `Banca ${prova.banca}`,
      prova.totalQuestoes
        ? `${prova.questoes.length} de ${prova.totalQuestoes} questões nesta prévia`
        : `${prova.questoes.length} questões`,
      "Gabarito comentado",
    ];
    $("#prova-sub").textContent = partes.join(" · ");
    document.title = `${concurso.sigla} ${prova.ano} — prova resolvida | Check no Concurso`;
    $("#timer").hidden = false;
  } else {
    $("#prova-sub").textContent =
      "Estamos conferindo o caderno e o gabarito oficial desta edição. A resolução entra assim que a curadoria terminar.";
  }

  if (prova?.status === "amostra") {
    $("#aviso").hidden = false;
    $("#aviso-texto").textContent =
      `${prova.questoes.length} questões de exemplo para você ver como a resolução funciona. A prova oficial de ${prova.ano} e o gabarito definitivo entram depois da curadoria.`;
  }
}

function svgChevron() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.5");
  svg.innerHTML = '<path d="m9 18 6-6-6-6"/>';
  return svg;
}

function svgIcone(nome) {
  const paths = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
    arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v3a3 3 0 0 1-3 3M7 5H4v3a3 3 0 0 0 3 3"/>',
  };
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths[nome] || "";
  return svg;
}

/* ------------------------------------------------------------------ */
/* Estado da questão                                                   */
/* ------------------------------------------------------------------ */

const total = prova ? prova.questoes.length : 0;
const respondidas = () => Object.keys(estado.respostas).length;
const acertos = () =>
  prova.questoes.filter((q) => estado.respostas[q.numero]?.certa).length;

let selecionada = null; // letra escolhida ainda não confirmada da questão atual
let intervalo = null;

function questaoAtual() {
  return prova?.questoes[estado.atual] || null;
}

/* ------------------------------------------------------------------ */
/* Renderização                                                        */
/* ------------------------------------------------------------------ */

function render() {
  if (!prova) {
    renderVazio();
    return;
  }
  $("#layout").hidden = false;
  $("#estado-vazio").hidden = true;

  const mostrandoResultado = Boolean(estado.finalizada) && !estado.revisao;
  $("#layout").style.gridTemplateColumns = "";
  $("#lateral").hidden = mostrandoResultado;
  if (mostrandoResultado) $("#layout").style.gridTemplateColumns = "1fr";

  if (mostrandoResultado) {
    renderResultado();
  } else {
    renderQuestao();
    renderLateral();
  }
  renderBarraMovel(mostrandoResultado);
  iniciarRelogio();
}

function renderQuestao() {
  const q = questaoAtual();
  if (!q) return;
  const registro = estado.respostas[q.numero];
  const revelado = Boolean(registro) || estado.revisao;
  const escolhida = registro?.letra || selecionada;
  const ultima = estado.atual === total - 1;

  const area = $("#area");
  area.innerHTML = "";

  const card = el("article", "card question");
  card.setAttribute("aria-labelledby", `q-enunciado-${q.numero}`);

  const meta = el("div", "q-meta");
  const numero = el("span", "q-num", `Questão ${q.numero}`);
  numero.append(el("span", null, ` de ${total}`));
  meta.append(numero, el("span", "chip is-brand", q.disciplina));
  if (prova.banca) meta.append(el("span", "chip", prova.banca));
  if (estado.revisao) meta.append(el("span", "chip", "Revisão"));
  card.append(meta);

  const enunciado = el("div", "q-enunciado");
  enunciado.id = `q-enunciado-${q.numero}`;
  enunciado.innerHTML = q.enunciado
    .split(/\n{2,}/)
    .map((par) => `<p>${escapeHtml(par).replace(/\n/g, "<br>")}</p>`)
    .join("");
  card.append(enunciado);

  const lista = el("ul", "alt-list");
  lista.setAttribute("role", "radiogroup");
  lista.setAttribute("aria-label", `Alternativas da questão ${q.numero}`);

  q.alternativas.forEach((alt) => {
    const item = el("li");
    const botao = el("button", "alt");
    botao.type = "button";
    botao.dataset.letra = alt.letra;
    botao.setAttribute("role", "radio");
    botao.setAttribute("aria-checked", String(escolhida === alt.letra));
    botao.disabled = revelado;

    if (revelado) {
      if (alt.letra === q.correta) botao.classList.add("is-correct");
      else if (alt.letra === escolhida) botao.classList.add("is-wrong");
      else botao.classList.add("is-muted");
    } else if (escolhida === alt.letra) {
      botao.classList.add("is-selected");
    }

    const letra = el("span", "letter", alt.letra);
    const texto = el("span", "txt", alt.texto);
    const icone = el("span", "icone");
    if (revelado) {
      if (alt.letra === q.correta) icone.append(svgIcone("check"));
      else if (alt.letra === escolhida) icone.append(svgIcone("x"));
    }
    botao.append(letra, texto, icone);
    botao.addEventListener("click", () => selecionar(alt.letra));
    item.append(botao);
    lista.append(item);
  });
  card.append(lista);

  if (revelado) card.append(montarExplicacao(q, registro));

  const acoes = el("div", "q-actions");
  const dica = el("p", "q-hint");
  if (revelado) {
    dica.textContent = estado.revisao
      ? "Revisão: gabarito e explicação liberados."
      : "Resposta registrada. O gabarito está explicado abaixo.";
  } else {
    dica.innerHTML =
      'Escolha uma alternativa · <kbd>A</kbd>–<kbd>E</kbd> para marcar · <kbd>Enter</kbd> para confirmar';
  }

  const botoes = el("div", "q-buttons");
  const anterior = el("button", "btn btn-ghost", "Anterior");
  anterior.type = "button";
  anterior.disabled = estado.atual === 0;
  anterior.addEventListener("click", () => irPara(estado.atual - 1));
  botoes.append(anterior);

  const principal = el("button", "btn btn-primary");
  principal.type = "button";
  if (revelado) {
    if (estado.revisao) {
      principal.append(document.createTextNode(ultima ? "Voltar ao resultado" : "Próxima questão"));
      if (!ultima) principal.prepend(svgIcone("arrowRight"));
      principal.addEventListener("click", () =>
        ultima ? voltarAoResultado() : irPara(estado.atual + 1)
      );
    } else if (ultima) {
      principal.append(document.createTextNode("Ver resultado"));
      principal.addEventListener("click", pedirFinalizacao);
    } else {
      principal.append(svgIcone("arrowRight"), document.createTextNode("Próxima questão"));
      principal.addEventListener("click", () => irPara(estado.atual + 1));
    }
  } else {
    principal.disabled = !escolhida;
    principal.append(document.createTextNode("Confirmar resposta"));
    principal.addEventListener("click", confirmar);
  }
  botoes.append(principal);
  acoes.append(dica, botoes);
  card.append(acoes);
  area.append(card);
}

function montarExplicacao(q, registro) {
  const errou = registro && !registro.certa;
  const box = el("section", "explain" + (errou ? " is-wrong" : ""));
  box.setAttribute("aria-label", "Explicação da resposta");
  box.tabIndex = -1;

  const head = el("div", "explain-head");
  head.append(el("span", "letter-pill", q.correta));
  head.append(el("strong", null, errou ? "A correta é a alternativa " + q.correta : "Resposta correta"));
  box.append(head);

  if (registro) {
    box.append(
      el(
        "p",
        "sua-marca",
        registro.certa
          ? `Você marcou ${registro.letra} e acertou.`
          : `Você marcou ${registro.letra}. A correta é ${q.correta}.`
      )
    );
  }

  String(q.explicacao || "")
    .split(/\n{2,}/)
    .filter(Boolean)
    .forEach((par) => box.append(el("p", null, par)));

  if (q.fonte) box.append(el("span", "fonte", q.fonte));
  return box;
}

/* ------------------------------------------------------------------ */
/* Interação da questão                                                */
/* ------------------------------------------------------------------ */

function selecionar(letra) {
  if (estado.respostas[questaoAtual().numero]) return;
  selecionada = letra;
  const lista = document.querySelector(".alt-list");
  if (!lista) return;
  lista.querySelectorAll(".alt").forEach((btn) => {
    const ativo = btn.dataset.letra === letra;
    btn.classList.toggle("is-selected", ativo);
    btn.setAttribute("aria-checked", String(ativo));
  });
  const confirmarBtn = document.querySelector(".q-buttons .btn-primary");
  if (confirmarBtn) confirmarBtn.disabled = false;
  const confirmarMovel = document.querySelector(".mobile-bar .btn-primary");
  if (confirmarMovel) confirmarMovel.disabled = false;
}

function confirmar() {
  const q = questaoAtual();
  if (!q || !selecionada) return;
  estado.respostas[q.numero] = {
    letra: selecionada,
    certa: selecionada === q.correta,
  };
  selecionada = null;
  salvar();
  renderQuestao();
  renderLateral();
  renderBarraMovel(false);
  const box = document.querySelector(".explain");
  if (box) box.focus({ preventScroll: true });
  anunciar(
    estado.respostas[q.numero].certa
      ? `Resposta certa. Alternativa ${q.correta}.`
      : `Resposta errada. A correta é ${q.correta}.`
  );
}

function irPara(indice) {
  if (indice < 0 || indice >= total) return;
  estado.atual = indice;
  selecionada = null;
  salvar();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function anunciar(texto) {
  const live = $("#anuncio");
  if (live) live.textContent = texto;
}

/* ------------------------------------------------------------------ */
/* Lateral e barra do celular                                          */
/* ------------------------------------------------------------------ */

function renderLateral() {
  const lateral = $("#lateral");
  lateral.hidden = false;
  lateral.innerHTML = "";

  const info = el("div", "side-card");
  info.append(el("h2", null, "Sua prova"));
  info.append(el("p", "side-plan", prova.edicao));
  info.append(
    el("p", "side-sub", `${prova.cargo} · ${prova.banca}`)
  );
  lateral.append(info);

  const progresso = el("div", "side-card is-mapa-card");
  progresso.append(el("h2", null, "Progresso"));
  const topo = el("div", "progress-top");
  const contagem = el("strong", null, `${respondidas()} de ${total}`);
  topo.append(contagem, el("span", null, "respondidas"));
  progresso.append(topo);
  const barra = el("div", "bar");
  const preenchido = el("i");
  preenchido.style.width = `${total ? (respondidas() / total) * 100 : 0}%`;
  barra.append(preenchido);
  progresso.append(barra);
  progresso.append(montarMapa());
  progresso.append(montarLegenda());

  const acoes = el("div", "side-actions");
  const finalizar = el("button", "btn btn-primary", "Finalizar prova");
  finalizar.type = "button";
  finalizar.disabled = respondidas() === 0;
  finalizar.addEventListener("click", pedirFinalizacao);
  acoes.append(finalizar);

  const reiniciar = el("button", "text-link", "Recomeçar do zero");
  reiniciar.type = "button";
  reiniciar.addEventListener("click", pedirReinicio);
  acoes.append(reiniciar);
  progresso.append(acoes);

  const nota = el(
    "p",
    "side-note",
    "Seu progresso é salvo neste navegador. Você pode fechar e voltar depois."
  );
  progresso.append(nota);
  lateral.append(progresso);
}

function montarMapa() {
  const mapa = el("div", "mapa");
  mapa.setAttribute("role", "group");
  mapa.setAttribute("aria-label", "Ir para uma questão");
  prova.questoes.forEach((q, idx) => {
    const btn = el("button", null, String(q.numero));
    btn.type = "button";
    const reg = estado.respostas[q.numero];
    if (reg) btn.classList.add(reg.certa ? "is-right" : "is-wrong");
    if (idx === estado.atual) btn.classList.add("is-current");
    btn.setAttribute(
      "aria-label",
      `Questão ${q.numero}${reg ? (reg.certa ? ", respondida e certa" : ", respondida e errada") : ", em branco"}`
    );
    btn.addEventListener("click", () => irPara(idx));
    mapa.append(btn);
  });
  return mapa;
}

function montarLegenda() {
  const legenda = el("div", "legenda");
  [
    ["cur", "Atual"],
    ["ok", "Certa"],
    ["no", "Errada"],
  ].forEach(([classe, texto]) => {
    const item = el("span");
    item.append(el("i", classe), document.createTextNode(texto));
    legenda.append(item);
  });
  return legenda;
}

function renderBarraMovel(mostrandoResultado) {
  const antiga = document.querySelector(".mobile-bar");
  if (antiga) antiga.remove();
  if (mostrandoResultado) return;

  const barra = el("div", "mobile-bar");
  const topo = el("div", "mb-top");
  const info = el("strong", null, `Questão ${estado.atual + 1} de ${total}`);
  const mapa = el("button", "text-link", "Mapa da prova");
  mapa.type = "button";
  mapa.addEventListener("click", abrirMapaMovel);
  topo.append(info, mapa);
  barra.append(topo);

  const barraProgresso = el("div", "bar");
  const preenchido = el("i");
  preenchido.style.width = `${total ? (respondidas() / total) * 100 : 0}%`;
  barraProgresso.append(preenchido);
  barra.append(barraProgresso);

  const q = questaoAtual();
  const revelado = Boolean(estado.respostas[q.numero]) || estado.revisao;
  const ultima = estado.atual === total - 1;
  const acao = el("button", "btn btn-primary");
  acao.type = "button";
  if (revelado) {
    acao.append(document.createTextNode(
      estado.revisao ? (ultima ? "Voltar ao resultado" : "Próxima questão") : ultima ? "Ver resultado" : "Próxima questão"
    ));
    acao.addEventListener("click", () => {
      if (estado.revisao && ultima) voltarAoResultado();
      else if (!estado.revisao && ultima) pedirFinalizacao();
      else irPara(estado.atual + 1);
    });
  } else {
    acao.append(document.createTextNode("Confirmar resposta"));
    acao.disabled = !selecionada;
    acao.addEventListener("click", confirmar);
  }
  barra.append(acao);
  document.body.append(barra);
}

function abrirMapaMovel() {
  const conteudo = document.createElement("div");
  conteudo.className = "mapa";
  prova.questoes.forEach((q, idx) => {
    const btn = el("button", null, String(q.numero));
    btn.type = "button";
    const reg = estado.respostas[q.numero];
    if (reg) btn.classList.add(reg.certa ? "is-right" : "is-wrong");
    if (idx === estado.atual) btn.classList.add("is-current");
    btn.addEventListener("click", () => {
      fecharDialogo();
      irPara(idx);
    });
    conteudo.append(btn);
  });
  abrirDialogo({
    titulo: "Mapa da prova",
    texto: null,
    corpo: conteudo,
    ok: null,
    cancelar: "Fechar",
  });
}

/* ------------------------------------------------------------------ */
/* Resultado                                                           */
/* ------------------------------------------------------------------ */

function renderResultado() {
  const area = $("#area");
  area.innerHTML = "";
  const certas = acertos();
  const erradas = respondidas() - certas;
  const brancos = total - respondidas();
  const percentual = total ? Math.round((certas / total) * 100) : 0;
  const cor =
    percentual >= 70
      ? "var(--status-open-fg, #0C6B3B)"
      : percentual >= 50
      ? "var(--brand-primary, #0C4F83)"
      : "var(--status-danger-fg, #B91C1C)";

  const card = el("section", "card result");
  const head = el("div", "result-head");
  head.append(el("span", "eyebrow", "Resultado da prova"));
  head.append(el("h2", null, percentual >= 70 ? "Muito bom!" : percentual >= 50 ? "Bom começo" : "Hora de revisar"));
  head.append(
    el(
      "p",
      null,
      `Você acertou ${certas} de ${total} questões` +
        (prova.totalQuestoes && prova.status !== "completa"
          ? " nesta prévia"
          : "")
    )
  );
  card.append(head);

  const wrap = el("div", "score-wrap");
  const anel = el("div", "score-ring");
  anel.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 148 148" aria-hidden="true">
      <circle cx="74" cy="74" r="64" fill="none" stroke="var(--bg-surface-alt, #E9F0F6)" stroke-width="12"/>
      <circle cx="74" cy="74" r="64" fill="none" stroke="${cor}" stroke-width="12"
        stroke-linecap="round" stroke-dasharray="402.1"
        stroke-dashoffset="${402.1 - (402.1 * percentual) / 100}"/>
    </svg>`;
  const valor = el("div", "valor");
  valor.append(el("strong", null, `${percentual}%`), el("span", null, "de acerto"));
  anel.append(valor);
  wrap.append(anel);
  card.append(wrap);

  const stats = el("div", "score-stats");
  [
    ["ok", certas, "acertos"],
    ["no", erradas, "erros"],
    ["", brancos, "em branco"],
  ].forEach(([classe, numero, rotulo]) => {
    const item = el("div", "stat" + (classe ? ` ${classe}` : ""));
    item.append(el("strong", null, String(numero)), el("span", null, rotulo));
    stats.append(item);
  });
  card.append(stats);

  const porDisciplina = new Map();
  prova.questoes.forEach((q) => {
    const atual = porDisciplina.get(q.disciplina) || { total: 0, certas: 0 };
    atual.total += 1;
    if (estado.respostas[q.numero]?.certa) atual.certas += 1;
    porDisciplina.set(q.disciplina, atual);
  });
  if (porDisciplina.size > 1) {
    card.append(el("p", "result-sub", "Por disciplina"));
    const lista = el("ul", "disc-list");
    porDisciplina.forEach((dados, nome) => {
      const linha = el("li", "disc-row");
      const topo = el("div", "top");
      topo.append(el("strong", null, nome), el("span", null, `${dados.certas}/${dados.total}`));
      const barra = el("div", "bar");
      const i = el("i");
      i.style.width = `${(dados.certas / dados.total) * 100}%`;
      i.style.background =
        dados.certas === dados.total
          ? "var(--status-open-fg, #0C6B3B)"
          : dados.certas === 0
          ? "var(--status-danger-fg, #B91C1C)"
          : "var(--brand-primary, #0C4F83)";
      barra.append(i);
      linha.append(topo, barra);
      lista.append(linha);
    });
    card.append(lista);
  }

  card.append(el("p", "result-sub", "Questão por questão"));
  const revisao = el("ul", "review-list");
  prova.questoes.forEach((q, idx) => {
    const reg = estado.respostas[q.numero];
    const item = el("li");
    const botao = el("button");
    botao.type = "button";
    const marca = el("span", "n" + (reg ? (reg.certa ? " ok" : " no") : ""), String(q.numero));
    const texto = el("span", "txt", q.disciplina);
    const status = el(
      "span",
      "marca",
      reg ? (reg.certa ? `Acertou (${reg.letra})` : `Marcou ${reg.letra} · gabarito ${q.correta}`) : "Em branco"
    );
    botao.append(marca, texto, status);
    botao.addEventListener("click", () => {
      estado.revisao = true;
      estado.atual = idx;
      salvar();
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    item.append(botao);
    revisao.append(item);
  });
  card.append(revisao);

  const acoes = el("div", "result-actions");
  const revisar = el("button", "btn btn-outline");
  revisar.type = "button";
  revisar.append(svgIcone("arrowLeft"), document.createTextNode("Revisar questões"));
  revisar.addEventListener("click", () => {
    estado.revisao = true;
    estado.atual = 0;
    salvar();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  const refazer = el("button", "btn btn-ghost");
  refazer.type = "button";
  refazer.append(svgIcone("restart"), document.createTextNode("Refazer a prova"));
  refazer.addEventListener("click", pedirReinicio);
  acoes.append(revisar, refazer);
  card.append(acoes);

  area.append(card);
}

function pedirFinalizacao() {
  const restantes = total - respondidas();
  if (!respondidas()) return;
  abrirDialogo({
    titulo: "Finalizar a prova?",
    texto: restantes
      ? `Você deixou ${restantes} ${restantes === 1 ? "questão em branco" : "questões em branco"}. O resultado conta só as ${respondidas()} respondidas.`
      : "Todas as questões foram respondidas. Você verá o resultado e poderá revisar cada questão.",
    ok: "Ver resultado",
    aoConfirmar: () => {
      estado.finalizada = Date.now();
      estado.revisao = false;
      salvar();
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });
}

function pedirReinicio() {
  abrirDialogo({
    titulo: "Recomeçar do zero?",
    texto: "Todas as respostas desta prova serão apagadas neste navegador. O gabarito continua disponível.",
    ok: "Apagar e recomeçar",
    aoConfirmar: () => {
      estado = { atual: 0, respostas: {}, inicio: Date.now(), finalizada: null, revisao: false };
      salvar();
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });
}

function voltarAoResultado() {
  estado.revisao = false;
  salvar();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ------------------------------------------------------------------ */
/* Diálogo                                                             */
/* ------------------------------------------------------------------ */

let acaoDialogo = null;

function abrirDialogo({ titulo, texto, corpo, ok, cancelar = "Voltar", aoConfirmar }) {
  const dialog = $("#dialog");
  $("#dialog-title").textContent = titulo;
  const par = $("#dialog-text");
  par.textContent = texto || "";
  par.hidden = !texto;
  const antigo = dialog.querySelector(".dialog-extra");
  if (antigo) antigo.remove();
  if (corpo) {
    const extra = el("div", "dialog-extra");
    extra.append(corpo);
    dialog.querySelector(".dialog-body").insertBefore(extra, dialog.querySelector(".dialog-actions"));
  }
  const botaoOk = $("#dialog-ok");
  botaoOk.hidden = !ok;
  botaoOk.textContent = ok || "";
  dialog.querySelector('button[value="cancel"]').textContent = cancelar;
  acaoDialogo = aoConfirmar || null;
  dialog.showModal();
}

function fecharDialogo() {
  const dialog = $("#dialog");
  if (dialog.open) dialog.close();
  acaoDialogo = null;
}

$("#dialog").addEventListener("close", () => {
  if ($("#dialog").returnValue === "ok" && acaoDialogo) {
    const acao = acaoDialogo;
    acaoDialogo = null;
    acao();
  }
  acaoDialogo = null;
});

/* ------------------------------------------------------------------ */
/* Estado vazio                                                        */
/* ------------------------------------------------------------------ */

function renderVazio() {
  const box = $("#estado-vazio");
  box.hidden = false;
  box.innerHTML = "";
  const card = el("div", "card empty");

  if (!concurso) {
    card.append(el("span", "eyebrow", "Provas anteriores"));
    card.append(el("h2", null, "Escolha a prova que quer resolver"));
    card.append(
      el(
        "p",
        null,
        "As provas ficam dentro de cada concurso. Abra o concurso e toque em “5 Provas Anteriores” para começar."
      )
    );
    const link = el("a", "btn btn-primary", "Ver concursos abertos");
    link.href = "/";
    card.append(link);
  } else {
    card.append(el("span", "eyebrow", "Em curadoria"));
    card.append(el("h2", null, `A prova de ${concurso.sigla}${anoParam ? ` ${anoParam}` : ""} ainda não está disponível`));
    card.append(
      el(
        "p",
        null,
        "Estamos conferindo o caderno oficial e o gabarito antes de publicar. Nada entra no site sem essa checagem."
      )
    );
    const verConcurso = el("a", "btn btn-primary", "Ver o concurso");
    verConcurso.href = `/concurso/${concurso.id}`;
    const amostra = el("a", "btn btn-outline", "Ver a prévia de interface");
    amostra.href = "/prova.html?concurso=pm-sp-soldado-2026&ano=2025";
    const acoes = el("div", "empty-actions");
    acoes.append(verConcurso, amostra);
    card.append(acoes);
  }
  box.append(card);
  $("#layout").hidden = true;
}

/* ------------------------------------------------------------------ */
/* Relógio                                                             */
/* ------------------------------------------------------------------ */

function iniciarRelogio() {
  if (!prova) return;
  if (!estado.inicio) estado.inicio = Date.now();
  const alvo = $("#timer-value");
  const desenhar = () => {
    const segundos = Math.max(0, Math.floor((Date.now() - estado.inicio) / 1000));
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    alvo.textContent = [h, m, s]
      .filter((_, i) => h > 0 || i > 0)
      .map((n) => String(n).padStart(2, "0"))
      .join(":");
  };
  desenhar();
  clearInterval(intervalo);
  intervalo = setInterval(desenhar, 1000);
}

/* ------------------------------------------------------------------ */
/* Teclado                                                             */
/* ------------------------------------------------------------------ */

document.addEventListener("keydown", (event) => {
  if (!prova) return;
  if ($("#dialog").open) return;
  if (estado.finalizada && !estado.revisao) return;
  const alvo = event.target;
  if (alvo instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;

  const q = questaoAtual();
  if (!q) return;
  const respondida = Boolean(estado.respostas[q.numero]);

  if (event.key === "Enter") {
    if (respondida) {
      if (estado.revisao) {
        if (estado.atual === total - 1) voltarAoResultado();
        else irPara(estado.atual + 1);
      } else if (estado.atual === total - 1) pedirFinalizacao();
      else irPara(estado.atual + 1);
      event.preventDefault();
    } else if (selecionada) {
      confirmar();
      event.preventDefault();
    }
    return;
  }

  if (!respondida) {
    const letra = event.key.toUpperCase();
    if (/^[A-E]$/.test(letra) && q.alternativas.some((a) => a.letra === letra)) {
      selecionar(letra);
      event.preventDefault();
    }
    return;
  }

  if (event.key === "ArrowRight" && estado.atual < total - 1) irPara(estado.atual + 1);
  if (event.key === "ArrowLeft" && estado.atual > 0) irPara(estado.atual - 1);
});

/* ------------------------------------------------------------------ */
/* Início                                                              */
/* ------------------------------------------------------------------ */

const anuncio = document.createElement("p");
anuncio.id = "anuncio";
anuncio.setAttribute("role", "status");
anuncio.setAttribute("aria-live", "polite");
anuncio.className = "sr-only";
anuncio.style.cssText =
  "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
document.body.append(anuncio);

renderCabecalho();
render();
