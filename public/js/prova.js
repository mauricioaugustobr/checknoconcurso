import { PROVAS, getProva } from "./data/provas.js";

const examKey = new URLSearchParams(location.search).get("c") || Object.keys(PROVAS)[0];
// Provas novas ficam em /provas/<concurso>.json e só são baixadas quando a página abre.
async function loadExam(key) {
  const local = getProva(key);
  if (local) return local;
  if (!/^[a-z0-9-]+$/i.test(key)) return null;
  try {
    const res = await fetch(`/provas/${encodeURIComponent(key)}.json`, { cache: "no-cache" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
const exam = await loadExam(examKey);

const el = (id) => document.getElementById(id);
const STORE_KEY = `check-prova:${exam ? exam.id : examKey}`;

const intro = el("examIntro");
const runner = el("examRunner");
const empty = el("examEmpty");

let answers = {};
let revealed = {};
let current = 0;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved && saved.answers) {
      answers = saved.answers;
      revealed = saved.revealed || {};
      current = Math.min(Math.max(Number(saved.current) || 0, 0), exam.questoes.length - 1);
    }
  } catch {
    answers = {};
    revealed = {};
  }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ answers, revealed, current, at: Date.now() }));
  } catch {
    /* armazenamento indisponível: segue sem persistir */
  }
}

const LETTERS = ["A", "B", "C", "D", "E"];

function questionAt(i) {
  return exam.questoes[i];
}

function answeredCount() {
  return Object.keys(answers).length;
}

function correctCount() {
  return exam.questoes.filter((q) => answers[q.number] === q.answer).length;
}

if (!exam) {
  intro.hidden = true;
  runner.hidden = true;
  empty.hidden = false;
} else {
  initExam();
}

function initExam() {
  intro.hidden = false;
  document.title = `${exam.titulo} | Check no Concurso`;
  el("examTitle").textContent = exam.titulo;
  el("examSub").textContent = exam.dataProva
    ? `${exam.banca} · ${exam.orgao} · prova aplicada em ${formatDate(exam.dataProva)}.`
    : `${exam.banca} · ${exam.orgao} · prova de ${exam.ano}.`;
  el("examRunnerLabel").textContent = exam.titulo;

  const facts = [
    ["Banca", exam.banca],
    ["Questões", String(exam.total)],
    ["Cargo", exam.cargo],
    ["Ano", String(exam.ano)],
    ["Gabarito", "oficial da banca"],
  ];
  el("examFacts").innerHTML = facts
    .map(([k, v]) => `<li>${escapeHtml(k)}: <strong>${escapeHtml(v)}</strong></li>`)
    .join("");

  const caderno = el("cadernoLink");
  caderno.href = exam.fonte.caderno;
  const footerCaderno = el("footerCaderno");
  footerCaderno.href = exam.fonte.caderno;
  const footerGabarito = el("footerGabarito");
  footerGabarito.href = exam.fonte.gabarito;
  el("examSourceNote").textContent = exam.fonte.nota;

  const progress = el("examProgressBar") || document.querySelector(".exam-progress");
  if (progress) progress.setAttribute("aria-valuemax", String(exam.total));

  loadState();

  if (answeredCount() > 0) {
    el("startBtn").textContent = "Continuar de onde parei";
  }

  el("startBtn").addEventListener("click", () => {
    intro.hidden = true;
    runner.hidden = false;
    const firstUnanswered = exam.questoes.findIndex((q) => !answers[q.number]);
    current = firstUnanswered === -1 ? 0 : firstUnanswered;
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  el("finishBtn").addEventListener("click", showResult);
  el("prevBtn").addEventListener("click", () => goTo(current - 1));
  el("nextBtn").addEventListener("click", () => {
    if (current === exam.questoes.length - 1) showResult();
    else goTo(current + 1);
  });
  el("skipBtn").addEventListener("click", () => {
    const q = questionAt(current);
    if (!answers[q.number]) {
      answers[q.number] = "—";
      saveState();
      renderAll();
    }
    goTo(current + 1);
  });

  el("answerForm").addEventListener("submit", (event) => {
    event.preventDefault();
    checkAnswer();
  });

  document.addEventListener("keydown", (event) => {
    if (runner.hidden) return;
    if (event.target.matches("input, textarea, select")) return;
    const key = Number(event.key);
    const letters = (questionAt(current)?.alternatives || []).map((a) => a.letter);
    if (key >= 1 && key <= letters.length) {
      const input = document.querySelector(`input[name="choice"][value="${letters[key - 1]}"]`);
      if (input) {
        input.checked = true;
        paintSelection(letters[key - 1]);
      }
    } else if (event.key === "Enter" && !el("feedback").hidden) {
      event.preventDefault();
      goTo(current + 1);
    }
  });
}

function answerLabel(q) {
  if (exam.formato === "certo-errado") return q.answer === "C" ? "Certo" : "Errado";
  return q.answer;
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function goTo(index) {
  if (index < 0 || index >= exam.questoes.length) return;
  current = index;
  saveState();
  renderAll();
  el("questionCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderAll() {
  renderProgress();
  renderNavigator();
  renderQuestion();
  el("resultPanel").hidden = true;
}

function renderProgress() {
  const total = exam.total;
  const done = answeredCount();
  el("progressText").textContent = `${done} de ${total} respondidas · ${correctCount()} ${correctCount() === 1 ? "acerto" : "acertos"}`;
  el("progressBar").style.width = `${(done / total) * 100}%`;
  const bar = document.querySelector(".exam-progress");
  if (bar) bar.setAttribute("aria-valuenow", String(done));
}

function navClass(q) {
  const classes = ["nav-q"];
  if (q.annulled) classes.push("is-annulled");
  const a = answers[q.number];
  if (a) {
    if (a === q.answer) classes.push("is-correct");
    else if (a === "—") classes.push("is-skipped");
    else classes.push("is-wrong");
  }
  if (questionAt(current).number === q.number) classes.push("is-current");
  return classes.join(" ");
}

function renderNavigator() {
  const nav = el("questionNav");
  nav.innerHTML = "";
  exam.questoes.forEach((q, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = navClass(q);
    b.textContent = String(q.number);
    const state = !answers[q.number]
      ? "não respondida"
      : answers[q.number] === "—"
        ? "pulada"
        : answers[q.number] === q.answer
          ? "resposta correta"
          : "resposta incorreta";
    b.setAttribute("aria-label", `Questão ${q.number}, ${state}`);
    if (i === current) b.setAttribute("aria-current", "step");
    b.addEventListener("click", () => goTo(i));
    nav.append(b);
  });
}

function renderQuestion() {
  const q = questionAt(current);
  const chosen = answers[q.number];
  const isRevealed = Boolean(revealed[q.number]) || Boolean(chosen && chosen !== "—");

  el("questionSubject").textContent = q.subject;
  el("questionCounter").textContent = `Questão ${q.number} de ${exam.total}`;
  el("questionStem").textContent = q.stem;

  const support = el("questionSupport");
  if (q.support) {
    support.hidden = false;
    support.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = q.support;
    support.append(p);
  } else {
    support.hidden = true;
    support.innerHTML = "";
  }

  const figure = el("questionFigure");
  if (q.supportImage && q.supportImageKind === "figura") {
    figure.hidden = false;
    el("questionFigureImg").src = q.supportImage;
    el("questionFigureCaption").textContent = `Imagem do caderno oficial da ${exam.banca} (página ${q.page}).`;
  } else {
    figure.hidden = true;
    el("questionFigureImg").removeAttribute("src");
  }

  const pageArt = el("questionPageArt");
  if (q.supportImage && q.supportImageKind === "pagina") {
    pageArt.hidden = false;
    el("questionPageArtImg").src = q.supportImage;
    el("questionPageArtImg").alt = `Página ${q.page} do caderno oficial, com a figura da questão ${q.number}`;
  } else {
    pageArt.hidden = true;
    pageArt.open = false;
    el("questionPageArtImg").removeAttribute("src");
  }

  const source = el("questionSource");
  if ((q.needsSource || q.needsArt) && !q.support && !q.supportImage) {
    source.hidden = false;
    el("questionPage").textContent = String(q.page);
    el("questionSourceLink").href = `${exam.fonte.caderno}#page=${q.page}`;
  } else {
    source.hidden = true;
  }

  const fieldset = el("optionsFieldset");
  fieldset.innerHTML = "";
  fieldset.disabled = isRevealed;
  fieldset.classList.toggle("is-locked", isRevealed);

  q.alternatives.forEach((alt) => {
    const label = document.createElement("label");
    label.className = "exam-option";
    label.dataset.letter = alt.letter;
    label.innerHTML = `<input type="radio" name="choice" value="${alt.letter}" ${
      chosen === alt.letter ? "checked" : ""
    } /><span class="option-letter">${alt.letter}</span><span class="option-text"></span>`;
    label.querySelector(".option-text").textContent = alt.text;
    const input = label.querySelector("input");
    input.addEventListener("change", () => {
      if (!fieldset.disabled) paintSelection(alt.letter);
    });
    fieldset.append(label);
  });

  const feedback = el("feedback");
  feedback.hidden = true;
  feedback.className = "exam-feedback";
  feedback.innerHTML = "";
  el("explanation").hidden = true;

  const checkBtn = el("checkBtn");
  checkBtn.hidden = isRevealed;
  el("skipBtn").hidden = isRevealed;

  if (q.annulled) {
    fieldset.disabled = true;
    fieldset.classList.add("is-locked");
    checkBtn.hidden = true;
    el("skipBtn").hidden = true;
    const fb = el("feedback");
    fb.hidden = false;
    fb.className = "exam-feedback";
    fb.innerHTML = "<h3>Questão anulada pela banca</h3><p>Esta questão foi anulada no gabarito definitivo e não conta como acerto nem como erro.</p>";
    el("explanation").hidden = true;
    return;
  }

  if (isRevealed) {
    paintAnswer(q, chosen);
  }
}

function paintSelection(letter) {
  document.querySelectorAll(".exam-option").forEach((node) => {
    node.classList.toggle("is-selected", node.dataset.letter === letter);
  });
}

function checkAnswer() {
  const q = questionAt(current);
  if (q.annulled) return;
  if (revealed[q.number] || (answers[q.number] && answers[q.number] !== "-")) return;
  const input = document.querySelector('input[name="choice"]:checked');
  if (!input) {
    const feedback = el("feedback");
    feedback.className = "exam-feedback";
    feedback.hidden = false;
    feedback.innerHTML = "<h3>Escolha uma alternativa</h3><p>Marque A, B, C, D ou E para conferir.</p>";
    document.querySelector(".exam-option")?.focus();
    return;
  }
  const letter = input.value;
  answers[q.number] = letter;
  revealed[q.number] = true;
  saveState();
  renderProgress();
  renderNavigator();
  const fieldset = el("optionsFieldset");
  fieldset.disabled = true;
  fieldset.classList.add("is-locked");
  el("checkBtn").hidden = true;
  el("skipBtn").hidden = true;
  paintAnswer(q, letter);
  el("explanation").hidden = false;
}

function paintAnswer(q, chosen) {
  const fieldset = el("optionsFieldset");
  document.querySelectorAll(".exam-option").forEach((node) => {
    node.classList.remove("is-selected");
    if (node.dataset.letter === q.answer) node.classList.add("is-correct");
    if (chosen === node.dataset.letter && chosen !== q.answer) node.classList.add("is-wrong");
  });

  const feedback = el("feedback");
  feedback.hidden = false;
  const correct = chosen === q.answer;
  feedback.className = `exam-feedback ${correct ? "is-correct" : "is-wrong"}`;

  if (chosen === "—") {
    feedback.className = "exam-feedback";
    feedback.innerHTML = `<h3>Questão pulada</h3><p>Gabarito oficial: <strong>${answerLabel(q)}</strong>.</p>`;
  } else if (correct) {
    feedback.innerHTML = `<h3>Você acertou</h3><p>Gabarito oficial: <strong>${answerLabel(q)}</strong>.</p>`;
  } else {
    feedback.innerHTML = `<h3>Não foi desta vez</h3><p>Sua resposta: <strong>${escapeHtml(exam.formato === "certo-errado" ? (chosen === "C" ? "Certo" : "Errado") : chosen)}</strong>. Gabarito oficial: <strong>${answerLabel(q)}</strong>.</p>`;
  }

  el("explanation").hidden = false;
  el("checkBtn").hidden = true;
  el("skipBtn").hidden = true;
  fieldset.disabled = true;
  fieldset.classList.add("is-locked");
  loadExplanation(q);
}

// Resposta comentada: 3 parágrafos gerados no servidor e guardados também neste aparelho.
const EXPL_KEY = (n) => `check-explicacao:${examKey}:${n}`;

function renderExplanation(paragrafos) {
  const body = el("explanationBody");
  body.innerHTML = "";
  paragrafos.forEach((texto) => {
    const p = document.createElement("p");
    p.textContent = texto;
    body.append(p);
  });
}

async function loadExplanation(q) {
  const body = el("explanationBody");
  if (!body || q.annulled) return;
  try {
    const saved = JSON.parse(localStorage.getItem(EXPL_KEY(q.number)) || "null");
    if (saved && saved.answer === q.answer && Array.isArray(saved.paragrafos) && saved.paragrafos.length === 3) {
      renderExplanation(saved.paragrafos);
      return;
    }
  } catch {
    /* sem cache local */
  }
  body.innerHTML = '<p class="explanation-loading">Preparando a explicação desta questão…</p>';
  const numero = q.number;
  let data = {};
  let ok = false;
  try {
    const res = await fetch(`/api/explicacao?c=${encodeURIComponent(examKey)}&q=${numero}`, { cache: "no-store" });
    data = await res.json().catch(() => ({}));
    ok = res.ok && Array.isArray(data.paragrafos) && data.paragrafos.length === 3;
  } catch {
    ok = false;
  }
  if (questionAt(current).number !== numero) return; // a pessoa já mudou de questão
  if (ok) {
    renderExplanation(data.paragrafos);
    try {
      localStorage.setItem(EXPL_KEY(numero), JSON.stringify({ answer: q.answer, paragrafos: data.paragrafos }));
    } catch {
      /* armazenamento cheio: segue sem guardar */
    }
    return;
  }
  body.innerHTML = "";
  const msg = document.createElement("p");
  msg.className = "explanation-status";
  msg.textContent = data.pendente
    ? "A explicação desta questão está sendo preparada. Volte em instantes."
    : data.error || "Não foi possível carregar a explicação agora.";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "btn-ghost";
  retry.textContent = "Tentar de novo";
  retry.addEventListener("click", () => loadExplanation(q));
  body.append(msg, retry);
}

function showResult() {
  const panel = el("resultPanel");
  const total = exam.total;
  const answered = answeredCount();
  const correct = correctCount();
  const skipped = Object.values(answers).filter((a) => a === "-").length;
  const annulled = exam.questoes.filter((q) => q.annulled).length;
  const valid = Math.max(answered - skipped, 0);
  const wrong = Math.max(valid - correct, 0);
  const pct = valid ? Math.round((correct / valid) * 100) : 0;

  const bySubject = {};
  exam.questoes.forEach((q) => {
    const s = (bySubject[q.subject] ||= { total: 0, correct: 0, answered: 0 });
    s.total += 1;
    if (answers[q.number] && answers[q.number] !== "—") {
      s.answered += 1;
      if (answers[q.number] === q.answer) s.correct += 1;
    }
  });

  panel.innerHTML = `
    <h2>Seu resultado até aqui</h2>
    <p>${correct} ${correct === 1 ? "acerto" : "acertos"} em ${valid} ${valid === 1 ? "questão respondida" : "questões respondidas"} · ${pct}% de aproveitamento${skipped ? ` · ${skipped} ${skipped === 1 ? "pulada" : "puladas"}` : ""}${wrong ? ` · ${wrong} ${wrong === 1 ? "erro" : "erros"}` : ""}${annulled ? ` · ${annulled} ${annulled === 1 ? "anulada" : "anuladas"} pela banca` : ""}.</p>
    <div class="result-grid">
      ${Object.entries(bySubject)
        .filter(([, v]) => v.answered > 0)
        .map(([subject, v]) => {
          const p = v.answered ? Math.round((v.correct / v.answered) * 100) : 0;
          return `<div class="result-item">
            <strong>${escapeHtml(subject)}</strong>
            <span>${v.correct} de ${v.answered} respondidas · ${p}%</span>
            <div class="result-bar"><i style="width:${p}%"></i></div>
          </div>`;
        })
        .join("") || "<p>Responda ao menos uma questão para ver o desempenho por disciplina.</p>"}
    </div>
    <div class="exam-actions">
      <button type="button" class="btn-primary" id="continueBtn">Continuar de onde parei</button>
      <button type="button" class="btn-ghost" id="restartBtn">Refazer a prova</button>
    </div>
  `;
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });

  el("continueBtn").addEventListener("click", () => {
    const first = exam.questoes.findIndex((q) => !answers[q.number]);
    goTo(first === -1 ? exam.questoes.length - 1 : first);
  });
  el("restartBtn").addEventListener("click", () => {
    answers = {};
    revealed = {};
    current = 0;
    saveState();
    renderAll();
    el("questionCard").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
