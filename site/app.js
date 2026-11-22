// Llobregat flood forecast page: reads data/latest.json and draws it (English / Catalan).
"use strict";

const T = {
  en: {
    title: "Llobregat at Sant Joan Despí",
    subtitle: "Experimental flood forecast, updated every 30 minutes",
    disclaimer: "Research project, not an official warning system. Official information: Agència Catalana de l'Aigua and Protecció Civil de Catalunya.",
    level: "Forecast warning level",
    flow_now: "Flow now",
    threshold: "Warning threshold",
    threshold_help: "99th percentile of the training flows: a high flow, not necessarily a flood",
    chart_title: "Observed flow and forecast",
    chart_help: "Shaded bands: 80 % and 90 % prediction intervals. Dashed line: warning threshold.",
    table_title: "Forecast by lead time",
    col_h: "Lead time", col_time: "Time", col_central: "Forecast (m³/s)", col_80: "80 % interval",
    col_90: "90 % interval", col_state: "Warning",
    inputs_title: "Input data (ACA real-time network)",
    col_input: "Input", col_last: "Last reading", col_age: "Age", col_value: "Value", col_check: "Check",
    how_title: "How to read it",
    how_1: "The forecast combines a LightGBM model and a linear model trained on 25 years of ACA data (river gauges upstream, reservoirs and rain gauges). It uses only rain that has already fallen, so floods caused by rain in the lower basin can only be anticipated a few hours ahead.",
    how_2: "<b>Pre-alert</b>: the upper bound of the 90 % interval exceeds the threshold. <b>Alert</b>: the forecast itself exceeds it. In 2025–2026, the pre-alert came before the flow crossed the threshold in 29 of 32 episodes (a median of 3.5 h earlier), and the alert in 21 (2 h earlier). Beyond a few hours the forecast peaks tend to be too low.",
    how_3: "Model, validation and limitations: see the project repository.",
    data_source: "Data: Agència Catalana de l'Aigua (open data, real-time network).",
    normal: "Normal", pre_alert: "Pre-alert", alert: "Alert", unknown: "No forecast",
    help_normal: "No lead time exceeds the threshold.",
    help_pre_alert: "The flow could exceed the threshold (upper bound of the 90 % interval).",
    help_alert: "The forecast exceeds the threshold.",
    help_unknown: "The target station has no recent data.",
    issued: "Forecast issued", observed: "Observed", forecast: "Forecast",
    band80: "80 % interval", band90: "90 % interval", thr: "Threshold",
    no_target: "The Sant Joan Despí gauge has no recent data: no forecast can be issued.",
    stale_inputs: "Some inputs are more than 3 hours old; the forecast may be less accurate.",
    old_target: "The latest flow at Sant Joan Despí is more than 2 hours old.",
    ok: "ok", "no data": "no data", "out of range (units?)": "out of range (units?)",
    model: "Model trained on hydrological years", calib: "calibrated on",
    updated: "Page updated",
  },
  ca: {
    title: "El Llobregat a Sant Joan Despí",
    subtitle: "Predicció experimental de crescudes, cada 30 minuts",
    disclaimer: "Projecte de recerca, no és un sistema oficial d'avís. Informació oficial: Agència Catalana de l'Aigua i Protecció Civil de Catalunya.",
    level: "Nivell d'avís previst",
    flow_now: "Cabal ara",
    threshold: "Llindar d'avís",
    threshold_help: "Percentil 99 dels cabals d'entrenament: un cabal alt, no necessàriament una crescuda",
    chart_title: "Cabal observat i predicció",
    chart_help: "Bandes: intervals de predicció del 80 % i del 90 %. Línia discontínua: llindar d'avís.",
    table_title: "Predicció per horitzó",
    col_h: "Horitzó", col_time: "Hora", col_central: "Predicció (m³/s)", col_80: "Interval 80 %",
    col_90: "Interval 90 %", col_state: "Avís",
    inputs_title: "Dades d'entrada (xarxa en temps real de l'ACA)",
    col_input: "Entrada", col_last: "Última lectura", col_age: "Antiguitat", col_value: "Valor", col_check: "Comprovació",
    how_title: "Com llegir-ho",
    how_1: "La predicció combina un model LightGBM i un model lineal entrenats amb 25 anys de dades de l'ACA (estacions d'aforament aigües amunt, embassaments i pluviòmetres). Només fa servir la pluja que ja ha caigut: les crescudes causades per pluja a la part baixa de la conca només es poden anticipar unes poques hores abans.",
    how_2: "<b>Prealerta</b>: el límit superior de l'interval del 90 % supera el llindar. <b>Alerta</b>: la predicció mateixa el supera. El 2025–2026, la prealerta va arribar abans que el cabal superés el llindar en 29 de 32 episodis (una mediana de 3,5 h abans), i l'alerta en 21 (2 h abans). A partir d'unes hores, els pics previstos solen quedar curts.",
    how_3: "Model, validació i limitacions: vegeu el repositori del projecte.",
    data_source: "Dades: Agència Catalana de l'Aigua (dades obertes, xarxa en temps real).",
    normal: "Normal", pre_alert: "Prealerta", alert: "Alerta", unknown: "Sense predicció",
    help_normal: "Cap horitzó no supera el llindar.",
    help_pre_alert: "El cabal podria superar el llindar (límit superior de l'interval del 90 %).",
    help_alert: "La predicció supera el llindar.",
    help_unknown: "L'estació objectiu no té dades recents.",
    issued: "Predicció emesa", observed: "Observat", forecast: "Predicció",
    band80: "Interval 80 %", band90: "Interval 90 %", thr: "Llindar",
    no_target: "L'estació de Sant Joan Despí no té dades recents: no es pot fer cap predicció.",
    stale_inputs: "Algunes entrades tenen més de 3 hores; la predicció pot ser menys precisa.",
    old_target: "L'últim cabal de Sant Joan Despí té més de 2 hores.",
    ok: "correcte", "no data": "sense dades", "out of range (units?)": "fora de rang (unitats?)",
    model: "Model entrenat amb els anys hidrològics", calib: "calibrat amb",
    updated: "Pàgina actualitzada",
  },
};

let lang = (() => {
  try {
    const saved = localStorage.getItem("lang");
    if (saved) return saved;
  } catch (e) { /* storage unavailable */ }
  return (navigator.language || "en").toLowerCase().startsWith("ca") ? "ca" : "en";
})();
let data = null;
let chart = null;

const t = (k) => (T[lang] && T[lang][k]) || T.en[k] || k;
const fmt = (x, d = 1) => (x === null || x === undefined ? "—" : Number(x).toLocaleString(lang, { maximumFractionDigits: d, minimumFractionDigits: d }));
const time = (iso) => new Date(iso).toLocaleString(lang === "ca" ? "ca-ES" : "en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  if (data) render();
}

function render() {
  const card = document.getElementById("status-card");
  card.className = "card status " + data.level;
  document.getElementById("level-text").textContent = t(data.level);
  document.getElementById("level-help").textContent = t("help_" + data.level);
  document.getElementById("q-now").textContent = data.q_now === null ? "—" : fmt(data.q_now) + " m³/s";
  document.getElementById("issue").textContent = data.issue_time ? `${t("issued")}: ${time(data.issue_time)}` : "";
  document.getElementById("threshold").textContent = fmt(data.threshold_m3s, 0) + " m³/s";

  const msgs = document.getElementById("messages");
  msgs.innerHTML = "";
  data.messages.forEach((m) => {
    const d = document.createElement("div");
    d.className = "msg";
    d.textContent = t(m);
    msgs.appendChild(d);
  });

  const tb = document.querySelector("#fc-table tbody");
  tb.innerHTML = "";
  data.forecast.forEach((f) => {
    const state = f.alert ? "alert" : f.pre_alert ? "pre_alert" : "normal";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>+${fmt(f.h, 0)} h</td><td>${time(f.target_time)}</td><td><b>${fmt(f.central)}</b></td>
      <td>${fmt(f.lo80)} – ${fmt(f.hi80)}</td><td>${fmt(f.lo90)} – ${fmt(f.hi90)}</td>
      <td><span class="tag ${state}">${t(state)}</span></td>`;
    tb.appendChild(tr);
  });

  const ib = document.querySelector("#in-table tbody");
  ib.innerHTML = "";
  data.inputs.forEach((r) => {
    const tr = document.createElement("tr");
    const age = r.age_min === null ? "—" : r.age_min < 120 ? `${r.age_min} min` : `${fmt(r.age_min / 60, 0)} h`;
    tr.innerHTML = `<td>${r.key}</td><td>${r.last_reading ? time(r.last_reading) : "—"}</td><td>${age}</td>
      <td>${r.value === null ? "—" : fmt(r.value, 2)}</td><td class="${r.check === "ok" ? "" : "bad"}">${t(r.check)}</td>`;
    ib.appendChild(tr);
  });

  const m = data.model;
  document.getElementById("model-info").textContent =
    `${t("model")} ${m.train_years[0]}–${m.train_years[1]}, ${t("calib")} ${(m.calibration_years || []).join(", ")} · ${t("updated")}: ${time(data.generated)}`;
  drawChart();
}

function drawChart() {
  const obs = data.observed.map(([x, y]) => ({ x: Date.parse(x), y }));
  const last = data.q_now !== null && data.issue_time ? [{ x: Date.parse(data.issue_time), y: data.q_now }] : [];
  const fc = data.forecast;
  const pts = (key) => last.concat(fc.map((f) => ({ x: Date.parse(f.target_time), y: f[key] })));
  const xs = obs.map((p) => p.x).concat(fc.map((f) => Date.parse(f.target_time)));
  const thr = data.threshold_m3s;
  const thrLine = xs.length ? [{ x: Math.min(...xs), y: thr }, { x: Math.max(...xs), y: thr }] : [];
  const accent = css("--accent");
  const datasets = [
    { label: t("band90"), data: pts("hi90"), borderWidth: 0, pointRadius: 0, backgroundColor: css("--band90"), fill: "+1" },
    { label: "lo90", data: pts("lo90"), borderWidth: 0, pointRadius: 0, fill: false },
    { label: t("band80"), data: pts("hi80"), borderWidth: 0, pointRadius: 0, backgroundColor: css("--band80"), fill: "+1" },
    { label: "lo80", data: pts("lo80"), borderWidth: 0, pointRadius: 0, fill: false },
    { label: t("observed"), data: obs, borderColor: css("--observed"), borderWidth: 2, pointRadius: 0, fill: false },
    { label: t("forecast"), data: pts("central"), borderColor: accent, borderWidth: 2, pointRadius: 3, pointBackgroundColor: accent, fill: false },
    { label: t("thr"), data: thrLine, borderColor: css("--threshold"), borderWidth: 1, borderDash: [6, 4], pointRadius: 0, fill: false },
  ];
  document.getElementById("legend").innerHTML = [
    [t("observed"), css("--observed")], [t("forecast"), accent], [t("band80"), css("--band80")],
    [t("band90"), css("--band90")], [t("thr"), css("--threshold")],
  ].map(([l, c]) => `<span><i class="sw" style="background:${c}"></i>${l}</span>`).join("");

  const opts = {
    responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
    interaction: { mode: "nearest", axis: "x", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        filter: (i) => !["lo80", "lo90"].includes(i.dataset.label),
        callbacks: {
          title: (items) => (items.length ? time(new Date(items[0].parsed.x).toISOString()) : ""),
          label: (i) => `${i.dataset.label}: ${fmt(i.parsed.y)} m³/s`,
        },
      },
    },
    scales: {
      x: {
        type: "linear",
        grid: { color: css("--line") },
        afterBuildTicks: (axis) => {
          // Ticks on whole hours, every 6 or 12 h depending on the width
          const step = (axis.width < 500 ? 12 : 6) * 3600e3;
          const ticks = [];
          for (let v = Math.ceil(axis.min / step) * step; v <= axis.max; v += step) ticks.push({ value: v });
          axis.ticks = ticks;
        },
        ticks: { color: css("--ink-2"), autoSkip: false, maxRotation: 0, callback: (v) => time(new Date(v).toISOString()) },
      },
      y: {
        beginAtZero: true, grid: { color: css("--line") }, ticks: { color: css("--ink-2") },
        title: { display: true, text: "m³/s", color: css("--ink-2") },
      },
    },
  };
  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("chart"), { type: "line", data: { datasets }, options: opts });
}

document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => {
  lang = b.dataset.lang;
  try { localStorage.setItem("lang", lang); } catch (e) { /* storage unavailable */ }
  applyLang();
}));
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => data && drawChart());

applyLang();
fetch("data/latest.json", { cache: "no-store" })
  .then((r) => r.json())
  .then((d) => { data = d; render(); })
  .catch(() => {
    document.getElementById("messages").innerHTML = `<div class="msg">${t("no_target")}</div>`;
  });
