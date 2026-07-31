/* ============================================================
   QC core — shared engine for every role screen.
   Storage, SPC zones, derived data, SVG charts, forms, sync.
   Load order on every page: seed.js → core.js → page script.
   ============================================================ */
"use strict";

const DB_KEY = "qc-pr52-db-v1";
let db;

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) { db = JSON.parse(raw); migrateDB(); sembrarDia(); return; }
  } catch (e) { console.error(e); }
  db = {
    version: 2,
    project: structuredClone(QC_SEED.project),
    plan: structuredClone(QC_SEED.plan),
    tests: structuredClone(QC_SEED.tests),
    dayMeta: {},
    humidity: [],
  };
  migrateDB();
  sembrarDia();
  saveDB();
}

/* La simulación: si hoy no tiene ni un camión, se arranca con un tiro ya en
   marcha para que el sistema se pueda enseñar. Ver assets/demo.js. */
function sembrarDia() {
  if (db.demo === false) return;                       // alguien la apagó
  if (typeof sembrarTiroDemo !== "function") return;   // pantalla sin demo.js
  if (sembrarTiroDemo(db)) saveDB();
}
/* Esquema v2: record por conduce (compañía + número), humedades, plan del día */
function migrateDB() {
  if (!db.humidity) db.humidity = [];
  if (!db.dayMeta) db.dayMeta = {};
  if (!db.plan.humidityMaxHours) db.plan.humidityMaxHours = 3;
  for (const t of db.tests) {
    if (!t.company) t.company = plantCompany(t.plant);   // clave: compañía + conduce
    if (!t.source) t.source = "excel";                    // qr | ocr | manual | excel
  }
  db.version = 2;
}
/* La compañía sale de la planta cuando no viene declarada (histórico) */
function plantCompany(plant) {
  if (!plant) return "—";
  return /san juan|gurabo/i.test(plant) ? "Concretec" : String(plant).replace(/^\d+\s*-\s*/, "");
}
/* Clave única del conduce: nunca chocan tickets de plantas distintas */
function conduceKey(t) { return (t.company || "—") + "·" + (t.ticket || "?"); }
function findConduce(company, ticket) {
  return db.tests.find((t) => conduceKey(t) === (company || "—") + "·" + ticket) || null;
}
/* QCheck es la fuente de verdad de los límites: los publica en cada guardado
   para que la planta (e-Ticket) pueda colorear sus lecturas sin inventarlos.
   Contrato v3 — ver shared/conduce-contract.js */
function publishSpec() {
  const C = typeof window !== "undefined" && window.ConduceContract;
  if (C && C.publishMixSpec) {
    try { C.publishMixSpec(db, db.project && db.project.mixId, db.plan); } catch (_) {}
  }
}
function saveDB() { publishSpec(); localStorage.setItem(DB_KEY, JSON.stringify(db)); }

/* Cross-window live sync: other open role screens re-render when
   any window writes the DB (storage events fire cross-tab).     */
function enableLiveSync(onChange) {
  window.addEventListener("storage", (e) => {
    if (e.key === DB_KEY && e.newValue) {
      try { db = JSON.parse(e.newValue); if (!db.dayMeta) db.dayMeta = {}; onChange(); } catch (_) {}
    }
  });
}

/* ------------------------------------------------------------ theme (light/dark)
   One key shared by every screen; each page passes its own default.
   Changing it in one window updates the others live.             */
const THEME_KEY = "qc-theme";
/* silhouette icons (stroke, currentColor) */
const ICON_SUN = `<svg viewBox="0 0 24 24" style="width:58%;height:58%" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.3"/><path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5"/></svg>`;
const ICON_MOON = `<svg viewBox="0 0 24 24" style="width:56%;height:56%" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 14.5A8.6 8.6 0 0 1 9.5 3.8a8.6 8.6 0 1 0 10.7 10.7z"/></svg>`;
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const b = document.getElementById("theme-toggle");
  if (b) { b.innerHTML = t === "dark" ? ICON_SUN : ICON_MOON; b.title = t === "dark" ? "Modo claro" : "Modo oscuro"; }
}
function initTheme(def = "dark") {
  applyTheme(localStorage.getItem(THEME_KEY) || def);
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY && e.newValue) applyTheme(e.newValue);
  });
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}
function mountThemeToggle() {
  const b = document.createElement("button");
  b.id = "theme-toggle";
  b.className = "theme-toggle";
  b.title = "Modo claro / oscuro";
  b.onclick = (e) => { e.stopPropagation(); toggleTheme(); };
  document.body.appendChild(b);
  applyTheme(document.documentElement.dataset.theme || "light");
}

/* ------------------------------------------------------------ volver a la casa
   El botón de la esquina lleva al Control Center, que es la casa. Antes
   intentaba cerrar la pestaña primero y eso no es lo que se busca.

   Si la pantalla está a pantalla completa —el Field Display y Muestras lo
   están— hay que SALIR primero: navegar sin salir dejaría el Control Center
   ocupando la pantalla entera, sin barra del navegador ni forma de volver. */
/* ¿A dónde vuelve el botón? Depende de quién y desde dónde:
   - en un teléfono, al portal — el Control Center no cabe en la mano;
   - el invitado, siempre al portal: no tiene tablero.                    */
function casaDe() {
  if (sessionStorage.getItem("qc-user") !== "admin") return "movil.html";
  return esTelefono() ? "movil.html" : "control-center.html";
}

async function cerrarVentana() {
  const casa = casaDe();
  const salir = document.exitFullscreen || document.webkitExitFullscreen;
  if (salir && (document.fullscreenElement || document.webkitFullscreenElement)) {
    try { await salir.call(document); } catch (_) {}
  }
  // desde la propia casa, el botón sale de la sesión
  location.href = location.pathname.split("/").pop() === casa ? "index.html" : casa;
}
function mountCloseButton() {
  if (document.getElementById("close-btn")) return;
  const b = document.createElement("button");
  b.id = "close-btn";
  b.className = "close-btn";
  const casa = casaDe();
  const enCasa = location.pathname.split("/").pop() === casa;
  b.title = enCasa ? "Salir"
    : casa === "movil.html" ? "Volver al portal" : "Volver al Control Center";
  b.setAttribute("aria-label", b.title);
  b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>`;
  b.onclick = (e) => { e.stopPropagation(); cerrarVentana(); };
  (document.getElementById("qc-status") || document.body).appendChild(b);
}

/* ------------------------------------------------------------ ¿es un teléfono?
   Se mira el agente de usuario y no el ancho a propósito: el iPad en vertical
   mide 768 px y NO debe ir al portal de teléfono — es el aparato de Muestras y
   necesita el Control Center entero. iPadOS se anuncia como "Macintosh", así
   que por aquí no cuela. */
function esTelefono() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua));
}

/* ------------------------------------------------------------ acostar la pantalla
   Pantalla completa y orientación horizontal. Funciona en Android y en el
   escritorio; en el iPhone NO: Safari de iPhone no implementa requestFullscreen
   ni el bloqueo de orientación. Por eso quien llame a esto tiene que tener un
   plan B visible — en el Field Display, el aviso de girar el teléfono. */
async function acostarPantalla() {
  const el = document.documentElement;
  const pedirFS = el.requestFullscreen || el.webkitRequestFullscreen;
  if (pedirFS && !document.fullscreenElement) {
    try { await pedirFS.call(el); } catch (_) { return false; }
  }
  const o = screen.orientation;
  if (o && o.lock) { try { await o.lock("landscape"); return true; } catch (_) {} }
  return !!document.fullscreenElement;
}

/* ------------------------------------------------------------ pantalla completa
   Las pantallas de campo entran a pantalla completa con el primer toque: el
   navegador solo lo permite dentro de un gesto del usuario, nunca al cargar.
   iOS Safari no implementa la API — ahí simplemente no pasa nada.        */
function pantallaCompletaAlTocar() {
  const el = document.documentElement;
  const pedir = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!pedir) return;
  const alTocar = () => {
    document.removeEventListener("pointerdown", alTocar, true);
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    try { const p = pedir.call(el); if (p && p.catch) p.catch(() => {}); } catch (_) {}
  };
  document.addEventListener("pointerdown", alTocar, true);
}

/* ------------------------------------------------------------ barra de estado
   Vive arriba a la derecha en TODAS las pantallas, como la barra de estado de
   un teléfono: el avance del tiro y la conexión siempre a la vista, sin que
   haya que buscarlos. El botón de cerrar se aloja aquí.                  */
const QCS_SEGMENTOS = 14;

/* El día que la pantalla está mirando. Cada pantalla lleva el suyo en `state`;
   si no, el más reciente con ensayos. */
function diaActivo() {
  if (typeof state !== "undefined" && state && state.day) return state.day;
  const d = testDates(), hoy = todayISO();
  return d.includes(hoy) ? hoy : (d[0] || hoy);
}

function mountStatusBar(day, opciones) {
  const o = opciones || {};
  let bar = document.getElementById("qc-status");
  if (!bar) {
    inyectarEstilosStatus();
    bar = document.createElement("div");
    bar.id = "qc-status";
    bar.className = "qcs";
    bar.innerHTML = `
      <a class="qcs-tiro" id="qcs-tiro" href="results.html#daily"></a>
      <div class="qcs-conn" id="qcs-conn"><i></i><span></span></div>`;
    document.body.appendChild(bar);
    document.documentElement.classList.add("qcs-fija");
    addEventListener("online", pintarConexion);
    addEventListener("offline", pintarConexion);
    mountCloseButton();
  }
  pintarConexion();
  pintarTiro(day || diaActivo());
  return bar;
}

function pintarConexion() {
  const el = document.getElementById("qcs-conn");
  if (!el) return;
  const on = navigator.onLine !== false;
  el.className = "qcs-conn" + (on ? "" : " off");
  el.querySelector("span").textContent = on ? "En línea" : "Sin conexión";
}

function pintarTiro(day) {
  const el = document.getElementById("qcs-tiro");
  if (!el) return;
  const p = dayProgress(day || diaActivo());
  const hayPlan = p.cyPlan != null && p.cyPlan > 0;
  const pct = hayPlan ? p.pct : 0;
  // Sin plan de yardas no se inventa un total: se muestra lo vaciado y ya.
  const llenos = hayPlan ? Math.round(pct / 100 * QCS_SEGMENTOS) : 0;
  let segs = "";
  for (let i = 0; i < QCS_SEGMENTOS; i++)
    segs += `<i class="${i < llenos ? "on" : ""}"></i>`;
  el.className = "qcs-tiro" + (hayPlan ? "" : " sin-plan");
  el.href = "results.html#daily";
  el.title = hayPlan ? "Avance del tiro" : "Defina las yardas planificadas del día";
  el.innerHTML = `
    <span class="qcs-lb">Tiro</span>
    <span class="qcs-seg">${segs}</span>
    <span class="qcs-cy">${fmt(p.placed, 1)}${hayPlan ? ` / ${fmt(p.cyPlan, 0)}` : ""} <b>cy</b></span>
    <span class="qcs-pc">${hayPlan ? Math.round(pct) + "%" : "sin plan"}</span>`;
}

function inyectarEstilosStatus() {
  if (document.getElementById("qcs-css")) return;
  const s = document.createElement("style");
  s.id = "qcs-css";
  // Se inyecta desde el motor para que las pantallas de campo, que no cargan
  // qc.css, tengan exactamente la misma barra. --qcs-e escala el conjunto.
  s.textContent = `
/* Alto de la franja. De aquí cuelga el desplazamiento de todo lo demás. */
:root { --qcs-h: calc(42px * var(--qcs-e, 1) + env(safe-area-inset-top)); }

/* La barra es una franja fija de borde a borde, arriba del todo, en TODAS las
   pantallas y a cualquier tamaño. Nada se pinta encima: el resto del GUI
   empieza justo debajo, desplazado por --qcs-h. */
.qcs {
  position: fixed; top: 0; left: 0; right: 0; z-index: 330;
  display: flex; align-items: center; gap: calc(10px * var(--qcs-e, 1));
  height: var(--qcs-h);
  padding: env(safe-area-inset-top) calc(10px + env(safe-area-inset-right)) 0
           calc(16px + env(safe-area-inset-left));
  background: rgba(8,11,16,.86); border-bottom: 1px solid rgba(255,255,255,.09);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  color: #eef2f6; font-variant-numeric: tabular-nums;
}
:root[data-theme="light"] .qcs { background: rgba(18,28,38,.94); }
/* el contenido de cada pantalla arranca bajo la franja */
html.qcs-fija body { padding-top: var(--qcs-h); }
html.qcs-fija header.qc-header { top: var(--qcs-h); }

/* El botón vive dentro de la barra: se define aquí completo para que las
   pantallas de campo, que no cargan qc.css, lo vean igual. */
.qcs .close-btn {
  position: static; flex: none; padding: 0; cursor: pointer; margin-left: auto;
  display: flex; align-items: center; justify-content: center;
  width: calc(30px * var(--qcs-e,1)); height: calc(30px * var(--qcs-e,1));
  border-radius: 50%; border: 1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.07); color: rgba(238,242,246,.62);
  transition: background .15s, color .15s, box-shadow .15s, transform .15s;
}
.qcs .close-btn svg { width: calc(15px * var(--qcs-e,1)); height: calc(15px * var(--qcs-e,1)); }
/* el color entra por el resplandor, no por el relleno */
.qcs .close-btn:hover { color: var(--susp, #ff5a52); border-color: rgba(255,90,82,.55);
  box-shadow: 0 0 0 3px rgba(255,90,82,.10), 0 0 16px -2px rgba(255,90,82,.7); transform: scale(1.06); }

.qcs-tiro { display: flex; align-items: center; gap: calc(8px * var(--qcs-e,1));
  text-decoration: none; color: inherit; min-width: 0; }
.qcs-tiro:hover .qcs-seg i.on { filter: brightness(1.25); }
.qcs-lb, .qcs-pc {
  white-space: nowrap;
  font-size: calc(9.5px * var(--qcs-e,1)); text-transform: uppercase;
  letter-spacing: .18em; font-weight: 800; color: rgba(238,242,246,.52);
}
.qcs-pc { letter-spacing: .06em; color: #96c93d; white-space: nowrap; }
.qcs-seg { display: flex; align-items: flex-end; gap: calc(2px * var(--qcs-e,1)); height: calc(13px * var(--qcs-e,1)); }
.qcs-seg i {
  display: block; width: calc(3px * var(--qcs-e,1)); height: 100%;
  border-radius: calc(1.5px * var(--qcs-e,1)); background: rgba(255,255,255,.15);
  transition: background .45s ease;
}
.qcs-seg i.on { background: #96c93d; box-shadow: 0 0 calc(5px * var(--qcs-e,1)) rgba(150,201,61,.55); }
.qcs-cy { font-size: calc(12.5px * var(--qcs-e,1)); font-weight: 300; letter-spacing: -.01em; white-space: nowrap; }
.qcs-cy b { font-size: calc(9.5px * var(--qcs-e,1)); font-weight: 700; color: rgba(238,242,246,.5); letter-spacing: .1em; text-transform: uppercase; }
.qcs-tiro.sin-plan .qcs-pc { color: rgba(238,242,246,.42); }
.qcs-conn { display: flex; align-items: center; gap: calc(6px * var(--qcs-e,1)); flex: none;
  font-size: calc(10.5px * var(--qcs-e,1)); font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: #34d27b; margin-left: auto;
  padding-right: calc(12px * var(--qcs-e,1)); }
/* con la conexión ya empujada a la derecha, el botón la sigue */
.qcs-conn + .close-btn { margin-left: 0; }
.qcs-conn i { width: calc(6px * var(--qcs-e,1)); height: calc(6px * var(--qcs-e,1));
  border-radius: 50%; background: currentColor; box-shadow: 0 0 calc(7px * var(--qcs-e,1)) currentColor;
  animation: qcsLatir 1.9s ease-in-out infinite; }
.qcs-conn.off { color: #ff5a52; }
.qcs-conn.off i { animation: none; }
@keyframes qcsLatir { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
@media (max-width: 820px) {
  .qcs { gap: 10px; padding-left: calc(13px + env(safe-area-inset-left)); }
  .qcs-lb, .qcs-conn span { display: none; }
  .qcs-conn { padding-right: calc(10px * var(--qcs-e,1)); }
}
/* en papel no hay barra, así que tampoco el hueco que le deja arriba */
@media print { .qcs { display: none !important; } html.qcs-fija body { padding-top: 0; } }
@media (prefers-reduced-motion: reduce) { .qcs-conn i { animation: none; } }

 50% { transform: translateX(6px); } 75% { transform: translateX(-3px); } }
`;
  document.head.appendChild(s);
}

/* ------------------------------------------------------------ helpers */
function uid() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); }
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function num(v) { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function fmt(n, dp = 1) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: dp });
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function nowHM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function parseDate(iso) { if (!iso) return null; const [y, m, dd] = iso.split("-").map(Number); return new Date(y, m - 1, dd); }
/* "06:00" -> "6:00 a. m."  — 12 horas, como pidió Víctor, escrito en español */
function hora12(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = +m[1], suf = h >= 12 ? "p. m." : "a. m.";
  return `${h % 12 || 12}:${m[2]} ${suf}`;
}

/* Cuándo arrancó de verdad el tiro: la primera hora que quedó registrada. */
function inicioReal(day) {
  const t = testsOfDate(day).filter((x) => !x.rejected)
    .map((x) => x.start || x.arrive || x.batch).filter(Boolean).sort();
  return t.length ? t[0] : null;
}

function fmtDate(iso) {
  const d = parseDate(iso); if (!d) return "—";
  return d.toLocaleDateString("es-PR", { year: "numeric", month: "short", day: "numeric" });
}
function minutesBetween(t1, t2) {
  if (!t1 || !t2) return null;
  const [h1, m1] = t1.split(":").map(Number), [h2, m2] = t2.split(":").map(Number);
  let diff = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diff < 0) diff += 1440;
  return diff;
}
function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ------------------------------------------------------------ SPC zones */
function zoneRange(v, actLo, actHi, suspLo, suspHi) {
  if (v == null) return null;
  if (v < suspLo || v > suspHi) return "susp";
  if (v < actLo || v > actHi) return "act";
  return "ok";
}
function zoneSlump(t) { const p = db.plan.slump; return zoneRange(num(t.slump), p.actLo, p.actHi, p.suspLo, p.suspHi); }
function zoneAir(t)   { const p = db.plan.air;   return zoneRange(num(t.air),   p.actLo, p.actHi, p.suspLo, p.suspHi); }
function zoneUW(t) {
  const p = db.plan.uw;
  const target = num(t.uwTarget) ?? p.target;
  return zoneRange(num(t.uw), target - p.act, target + p.act, target - p.susp, target + p.susp);
}
function zoneTemp(t) {
  const v = num(t.temp); if (v == null) return null;
  if (v > db.plan.tempMax) return "susp";
  if (v > db.plan.tempMax - 3) return "act";
  return "ok";
}
function zoneCS5(v) {
  if (v == null) return null;
  const p = db.plan.cs;
  if (v < p.action) return "susp";
  if (v < p.target) return "act";
  return "ok";
}
function zoneElapsed(t) {
  const el = minutesBetween(t.batch, t.end);
  if (el == null) return null;
  return el > db.plan.maxElapsedMin ? "susp" : "ok";
}
const Z_ORDER = { susp: 3, act: 2, ok: 1 };
function worstZone(t) {
  let w = null;
  for (const z of [zoneSlump(t), zoneAir(t), zoneUW(t), zoneTemp(t)]) {
    if (z && (!w || Z_ORDER[z] > Z_ORDER[w])) w = z;
  }
  return w;
}
function estadoBadge(t) {
  if (t.rejected) return `<span class="badge susp">RECHAZADO</span>`;
  const w = worstZone(t);
  if (w === "susp") return `<span class="badge susp">FUERA DE LÍMITE</span>`;
  if (w === "act") return `<span class="badge act">ACCIÓN</span>`;
  if (w === "ok") return `<span class="badge ok">OK</span>`;
  return `<span class="badge neutral">—</span>`;
}
function zClass(z) { return z ? ` class="num z-${z}"` : ` class="num"`; }

/* ------------------------------------------------------------ derived */
function sortedTests() { return [...db.tests].sort((a, b) => a.n - b.n); }
function testDates() { return [...new Set(db.tests.map((t) => t.date))].sort().reverse(); }
function testsOfDate(d) { return sortedTests().filter((t) => t.date === d); }
function nextTestN() { return db.tests.length ? Math.max(...db.tests.map((t) => t.n)) + 1 : 1; }
function shortIdent(s) {
  if (!s) return "—";
  return String(s).replace(/^Phase\s+(\d+)\s*-\s*/i, "F$1 · ").replace(/SLAB\s*/i, "");
}
function strengthSets() {
  const sets = sortedTests().filter((t) => t.cs1 != null || t.cs5 != null || t.cs28 != null);
  const w = db.plan.maWindow;
  const cs5s = [];
  for (const s of sets) {
    s._ma5 = null;
    if (s.cs5 != null) {
      cs5s.push(s.cs5);
      if (cs5s.length >= w) s._ma5 = cs5s.slice(-w).reduce((a, b) => a + b, 0) / w;
    }
  }
  return sets;
}

/* Day-level production stats (producer / contractor KPIs). */
function dayStats(day) {
  const rows = testsOfDate(day);
  const cy = rows.reduce((a, t) => a + (num(t.vol) || 0), 0);
  const cycles = rows.map((t) => minutesBetween(t.batch, t.end)).filter((x) => x != null);
  const waits = rows.map((t) => minutesBetween(t.arrive, t.start)).filter((x) => x != null);
  const starts = rows.map((t) => t.start || t.arrive).filter(Boolean).sort();
  const ends = rows.map((t) => t.end || t.testTime).filter(Boolean).sort();
  let hours = null;
  if (starts.length && ends.length) {
    const span = minutesBetween(starts[0], ends[ends.length - 1]);
    if (span != null && span > 0) hours = span / 60;
  }
  return {
    rows, cy, loads: rows.length,
    rejected: rows.filter((t) => t.rejected).length,
    cyPerHr: hours ? cy / hours : null,
    loadsPerHr: hours ? rows.length / hours : null,
    avgCycle: cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null,
    maxCycle: cycles.length ? Math.max(...cycles) : null,
    avgWait: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : null,
    firstStart: starts[0] || null, lastEnd: ends[ends.length - 1] || null, hours,
  };
}

/* ------------------------------------------------------------ plan del día / losas
   El contratista necesita: yardas colocadas y pendientes, camiones esperando,
   progreso del tiro y cuántas losas lleva de las planificadas.          */

/* Extrae códigos de losa del texto de identificación: "L3-0.936 to L3-0.929" → 2 */
function slabCodes(ident) {
  if (!ident) return [];
  const m = String(ident).match(/L\s?\d+\s?-\s?\d+\.\d+/gi);
  return m ? m.map((s) => s.replace(/\s+/g, "").toUpperCase()) : [];
}

/* ------------------------------------------------------------ losas del tiro
   Cuáles se van a tirar hoy y cómo va cada una.

   La lista sale del plan del día (`dayMeta.losas`), donde se escriben así:
       L3-0.943:24, L3-0.936:18, L3-0.929
   El número tras los dos puntos son las yardas planificadas de esa losa, y es
   opcional. Sin lista declarada NO hay losas: no se deduce un plan de lo que
   los camiones hayan servido — eso sería inventarlo.

   El avance de cada una sale de los camiones. Un camión que sirve una sola
   losa aporta sus yardas enteras; uno que reparte su carga entre varias no
   dice cuánto dejó en cada una, así que su volumen NO se reparte a ojo: la
   losa queda marcada como "compartida" y sus yardas se leen como un mínimo. */
function losasDelDia(day) {
  const meta = db.dayMeta[day] || {};
  const dec = String(meta.losas || "").match(/L\s?\d+\s?-\s?\d+\.\d+(?:\s*:\s*\d+(?:\.\d+)?)?/gi);
  if (!dec) return { lista: [], hechas: 0 };

  const plan = [];
  const vistos = new Set();
  for (const x of dec) {
    const [c, cy] = x.split(":");
    const codigo = c.replace(/\s+/g, "").toUpperCase();
    if (vistos.has(codigo)) continue;
    vistos.add(codigo);
    plan.push({ codigo, cyPlan: cy == null ? null : num(cy.trim()) });
  }

  const rows = testsOfDate(day).filter((t) => !t.rejected);
  const estado = {}, cy = {}, cargas = {}, compartida = {};
  for (const t of rows) {
    const cs = slabCodes(t.ident);
    const sola = cs.length === 1;
    for (const c of cs) {
      cargas[c] = (cargas[c] || 0) + 1;
      if (sola) cy[c] = (cy[c] || 0) + (num(t.vol) || 0);
      else compartida[c] = true;
      if (t.end) estado[c] = "vaciada";
      else if (t.arrive && estado[c] !== "vaciada") estado[c] = "curso";
    }
  }

  const lista = plan.map((l) => ({
    codigo: l.codigo,
    cyPlan: l.cyPlan,
    estado: estado[l.codigo] || "pendiente",
    cy: cy[l.codigo] || 0,
    cargas: cargas[l.codigo] || 0,
    compartida: !!compartida[l.codigo],
    pct: l.cyPlan ? Math.min(100, (cy[l.codigo] || 0) / l.cyPlan * 100) : null,
  }));
  return { lista, hechas: lista.filter((l) => l.estado === "vaciada").length };
}

/* Camión "esperando": llegó, no fue rechazado y todavía no terminó de descargar */
function trucksWaiting(day) {
  return testsOfDate(day).filter((t) => t.arrive && !t.end && !t.rejected);
}
function trucksDischarging(day) {
  return testsOfDate(day).filter((t) => t.start && !t.end && !t.rejected);
}

/* ------------------------------------------------------------ estado del tiro
   En qué anda el vaciado ahora mismo, deducido de los camiones — no hay ningún
   interruptor que alguien tenga que acordarse de mover.

   "Detenido" no usa un umbral inventado: se compara el tiempo sin novedad con
   el ritmo del propio día (el doble de la mediana entre camiones). Un día de
   camiones cada 20 min se considera detenido antes que uno de cada hora.  */
function minutosDesde(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date();
  let dif = (d.getHours() * 60 + d.getMinutes()) - (+m[1] * 60 + +m[2]);
  /* Un tiro que empezó anoche y sigue de madrugada daba negativo, y con él
     el ritmo y el "detenido" se apagaban. Si sale negativo, cruzó las 12. */
  if (dif < 0) dif += 24 * 60;
  return dif;
}
function ritmoDelDia(day) {
  const t = testsOfDate(day).filter((x) => !x.rejected).map((x) => x.arrive).filter(Boolean).sort();
  if (t.length < 3) return null;
  const huecos = [];
  for (let i = 1; i < t.length; i++) {
    const a = minutosDesde(t[i - 1]), b = minutosDesde(t[i]);
    if (a != null && b != null) huecos.push(a - b);
  }
  if (!huecos.length) return null;
  huecos.sort((x, y) => x - y);
  return huecos[Math.floor(huecos.length / 2)];   // mediana
}

/* "45 min", "2 h 20 min" — a partir de hora y media el minutero cansa */
function duracionCorta(min) {
  if (min < 90) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/* Ritmo del tiro y a qué hora acabaría a ese paso. Sale del propio día:
   yardas colocadas contra el tiempo transcurrido desde que llegó el primer
   camión. No es una promesa — es la proyección del ritmo que lleva, y por eso
   la interfaz la enseña con "≈". Con menos de tres camiones o menos de media
   hora de vaciado no da número: no habría de dónde sacarlo. */
function ritmoTiro(day) {
  const p = dayProgress(day);
  const rows = testsOfDate(day).filter((t) => !t.rejected);
  const horas = rows.map((t) => t.arrive || t.start).filter(Boolean).sort();
  if (rows.length < 3 || !horas.length || !p.placed) return null;
  const transcurrido = minutosDesde(horas[0]);
  if (transcurrido == null || transcurrido < 30) return null;

  const cyHora = p.placed / (transcurrido / 60);
  if (!Number.isFinite(cyHora) || cyHora <= 0) return null;
  let fin = null;
  if (p.pending != null && p.pending > 0) {
    const faltanMin = Math.round(p.pending / cyHora * 60);
    const d = new Date(Date.now() + faltanMin * 60000);
    fin = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  return { cyHora, fin };
}

function estadoTiro(day) {
  const p = dayProgress(day);
  const completo = p.cyPlan != null && p.cyPlan > 0 && p.placed >= p.cyPlan;

  if (day !== todayISO())
    return { cls: "fin", icono: "check", txt: completo || p.loads ? "Tiro cerrado" : "Sin actividad" };
  if (p.discharging.length) return { cls: "vaciando", icono: "flujo", txt: "Vaciando" };
  if (p.waiting.length)
    return { cls: "espera", icono: "camion",
             txt: p.waiting.length === 1 ? "Camión esperando" : `${p.waiting.length} camiones esperando` };
  if (completo) return { cls: "fin", icono: "check", txt: "Tiro completado" };
  if (!p.loads) return { cls: "quieto", icono: "raya", txt: "Sin comenzar" };

  const ultimo = testsOfDate(day).filter((t) => !t.rejected)
    .map((t) => t.end || t.start || t.arrive).filter(Boolean).sort().pop();
  const sinNovedad = minutosDesde(ultimo);
  const ritmo = ritmoDelDia(day);
  if (sinNovedad != null && ritmo && sinNovedad > ritmo * 2)
    return { cls: "detenido", icono: "pausa", txt: `Detenido · ${duracionCorta(sinNovedad)} sin camión` };
  return { cls: "espera", icono: "reloj", txt: "Esperando camión" };
}

function dayProgress(day) {
  const meta = db.dayMeta[day] || {};
  const rows = testsOfDate(day);
  const recibido = rows.filter((t) => !t.rejected).reduce((a, t) => a + (num(t.vol) || 0), 0);
  /* Un camión que llegó y no ha terminado de descargar todavía no ha colocado
     nada: sus yardas van aparte. Esto solo aplica al día en curso — 95 de los
     registros históricos vienen del Excel sin hora de fin, y ahí el tiro ya se
     cerró: lo recibido es lo colocado. */
  const enCurso = day === todayISO()
    ? rows.filter((t) => !t.rejected && t.arrive && !t.end).reduce((a, t) => a + (num(t.vol) || 0), 0)
    : 0;
  const placed = recibido - enCurso;
  const cyPlan = num(meta.cyPlan);
  const losasPlan = num(meta.losasPlan);
  const done = new Set();
  for (const t of rows) if (!t.rejected && t.end) slabCodes(t.ident).forEach((c) => done.add(c));
  const losasDone = done.size;
  const waiting = trucksWaiting(day);
  const evaluated = rows.filter((t) => worstZone(t) != null);
  const conforming = evaluated.filter((t) => !t.rejected && worstZone(t) !== "susp").length;
  return {
    placed, enCurso, recibido,
    cyPlan,
    pending: cyPlan != null ? Math.max(0, cyPlan - placed) : null,
    pct: cyPlan ? Math.min(100, placed / cyPlan * 100) : null,
    losasPlan, losasDone,
    losasPct: losasPlan ? Math.min(100, losasDone / losasPlan * 100) : null,
    waiting, waitingCY: waiting.reduce((a, t) => a + (num(t.vol) || 0), 0),
    discharging: trucksDischarging(day),
    loads: rows.length,
    rejected: rows.filter((t) => t.rejected).length,
    evaluated: evaluated.length, conforming,
    compliancePct: evaluated.length ? conforming / evaluated.length * 100 : null,
  };
}

/* ------------------------------------------------------------ humedades (planta) */
function addHumidity(entry) {
  db.humidity.push({ id: uid(), date: entry.date || todayISO(), time: entry.time || nowHM(),
                     plant: entry.plant || null, note: entry.note || null });
  saveDB();
}
function lastHumidity(day) {
  const list = db.humidity.filter((h) => h.date === (day || todayISO()))
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  return list.length ? list[list.length - 1] : null;
}

/* ------------------------------------------------------------ capa de inteligencia
   Convierte el registro en asesor: detecta tendencias y recomienda acción.
   Reglas derivadas de la práctica de Rubén con la planta.               */
function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }

function trendAlerts(day) {
  const rows = testsOfDate(day).filter((t) => !t.rejected);
  const out = [];
  const uw = rows.filter((t) => num(t.uw) != null);
  const sl = rows.filter((t) => num(t.slump) != null);

  // --- Regla del agua: peso unitario bajando + slump subiendo ---
  if (uw.length >= 6 && sl.length >= 6) {
    const dUW = avg(uw.slice(-3).map((t) => num(t.uw))) - avg(uw.slice(-6, -3).map((t) => num(t.uw)));
    const dSL = avg(sl.slice(-3).map((t) => num(t.slump))) - avg(sl.slice(-6, -3).map((t) => num(t.slump)));
    if (dUW <= -0.8 && dSL >= 0.4) {
      out.push({
        level: "susp", icon: "💧", title: "Posible exceso de agua",
        text: `Peso unitario bajó ${fmt(Math.abs(dUW), 1)} pcf mientras el slump subió ${fmt(dSL, 2)}" en las últimas 3 pruebas.`,
        action: "Avisar a la planta: verificar humedades de los agregados.",
      });
    } else if (dUW >= 0.8 && dSL <= -0.4) {
      out.push({
        level: "act", icon: "🧱", title: "Mezcla secándose",
        text: `Peso unitario subió ${fmt(dUW, 1)} pcf y el slump bajó ${fmt(Math.abs(dSL), 2)}".`,
        action: "Verificar dosificación de agua y humedades en planta.",
      });
    }
  }

  // --- Tendencia sostenida de peso unitario hacia un límite ---
  if (uw.length >= 4) {
    const last = uw.slice(-4).map((t) => num(t.uw));
    const target = num(uw[uw.length - 1].uwTarget) ?? db.plan.uw.target;
    const drift = last[last.length - 1] - last[0];
    const dist = Math.abs(last[last.length - 1] - target);
    const monotonic = last.every((v, i) => i === 0 || v <= last[i - 1]) ||
                      last.every((v, i) => i === 0 || v >= last[i - 1]);
    if (monotonic && Math.abs(drift) >= 1.0 && dist > db.plan.uw.act * 0.6) {
      out.push({
        level: "act", icon: "📉", title: `Peso unitario se está yendo ${drift < 0 ? "hacia abajo" : "hacia arriba"}`,
        text: `4 lecturas seguidas en la misma dirección (${fmt(drift, 1)} pcf). Objetivo ${fmt(target, 1)}.`,
        action: "Avisar a la planta antes de que se salga de límite.",
      });
    }
  }

  // --- Slump acercándose al límite de forma sostenida ---
  if (sl.length >= 4) {
    const last = sl.slice(-4).map((t) => num(t.slump));
    const p = db.plan.slump;
    const rising = last.every((v, i) => i === 0 || v >= last[i - 1]);
    const falling = last.every((v, i) => i === 0 || v <= last[i - 1]);
    if (rising && last[last.length - 1] >= p.actHi - 0.5 && last[last.length - 1] > last[0])
      out.push({ level: "act", icon: "📈", title: "Slump subiendo hacia el límite",
        text: `Última lectura ${fmt(last[last.length - 1], 2)}" (acción ${p.actHi}").`,
        action: "Vigilar próxima descarga; posible agua en el camión." });
    if (falling && last[last.length - 1] <= p.actLo + 0.5 && last[last.length - 1] < last[0])
      out.push({ level: "act", icon: "📉", title: "Slump bajando hacia el límite",
        text: `Última lectura ${fmt(last[last.length - 1], 2)}" (acción ${p.actLo}").`,
        action: "Verificar tiempo de viaje y dosificación." });
  }

  // --- Humedades de planta vencidas ---
  const h = lastHumidity(day);
  const ref = rows.length ? (rows[rows.length - 1].testTime || rows[rows.length - 1].arrive) : null;
  if (rows.length >= 3) {
    if (!h) {
      out.push({ level: "act", icon: "🌡", title: "Sin prueba de humedad registrada hoy",
        text: "No hay registro de humedades de agregados en este vaciado.",
        action: `Pedir a la planta una humedad (máx. cada ${db.plan.humidityMaxHours} h).` });
    } else if (ref) {
      const mins = minutesBetween(h.time, ref);
      if (mins != null && mins > db.plan.humidityMaxHours * 60) {
        out.push({ level: "act", icon: "🌡", title: "Humedad vencida",
          text: `Última humedad a las ${h.time} — hace ${fmt(mins / 60, 1)} h.`,
          action: `Solicitar nueva humedad (límite ${db.plan.humidityMaxHours} h).` });
      }
    }
  }

  // --- Racha en zona de acción ---
  const recent = rows.slice(-5).filter((t) => worstZone(t) === "act");
  if (recent.length >= 3)
    out.push({ level: "act", icon: "⚠", title: "Racha en zona de acción",
      text: `${recent.length} de las últimas 5 pruebas en zona de acción.`,
      action: "Ajuste de planta probablemente necesario." });

  return out;
}

/* Etiqueta de tendencia para las gráficas live (lo que Rubén realmente mira) */
function trendLabel(day, key) {
  const rows = testsOfDate(day).filter((t) => !t.rejected && num(t[key]) != null);
  if (rows.length < 4) return "";
  const v = rows.map((t) => num(t[key]));
  const d = (v.slice(-2).reduce((a, b) => a + b, 0) / 2) - (v.slice(-4, -2).reduce((a, b) => a + b, 0) / 2);
  const dp = key === "uw" ? 1 : 2;
  if (Math.abs(d) < (key === "uw" ? 0.3 : 0.15)) return "▬ estable";
  return (d > 0 ? "▲ subiendo " : "▼ bajando ") + fmt(Math.abs(d), dp) + (key === "uw" ? " pcf" : '"');
}

/* ------------------------------------------------------------ charts */
const CHART_DEFS = [
  { key: "slump", label: 'Slump (in)', get: (t) => num(t.slump), dp: 2 },
  { key: "air", label: "Aire (%)", get: (t) => num(t.air), dp: 1 },
  { key: "uw", label: "Peso Unitario (pcf)", get: (t) => num(t.uw), dp: 1 },
  { key: "temp", label: "Temperatura (°F)", get: (t) => num(t.temp), dp: 0 },
];
function bandsFor(key) {
  const p = db.plan;
  if (key === "slump") return { target: p.slump.target, actLo: p.slump.actLo, actHi: p.slump.actHi, suspLo: p.slump.suspLo, suspHi: p.slump.suspHi };
  if (key === "air") return { target: p.air.target, actLo: p.air.actLo, actHi: p.air.actHi, suspLo: p.air.suspLo, suspHi: p.air.suspHi };
  if (key === "uw") return { target: p.uw.target, actLo: p.uw.target - p.uw.act, actHi: p.uw.target + p.uw.act, suspLo: p.uw.target - p.uw.susp, suspHi: p.uw.target + p.uw.susp };
  if (key === "temp") return { target: null, actLo: null, actHi: p.tempMax - 3, suspLo: null, suspHi: p.tempMax };
  return {};
}

function svgChart({ pts, bands, dp, yUnit = "", pw = 13, h = 230 }) {
  if (!pts.length) return `<div class="empty">Sin datos.</div>`;
  /* Estética de gráfica de mercado, no de hoja de cálculo:
     línea fina con degradado debajo, límites como líneas de umbral
     punteadas, y puntos solo donde importan — fuera de zona y el último. */
  const PW = pw, ML = 46, MR = 54, MT = 14, MB = 24, H = h;
  const W = ML + MR + Math.max(1, pts.length) * PW;
  const vals = pts.map((p) => p.v);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (bands.suspLo != null) lo = Math.min(lo, bands.suspLo);
  if (bands.suspHi != null) hi = Math.max(hi, bands.suspHi);
  const pad = (hi - lo || 1) * 0.16;
  lo -= pad; hi += pad;
  const Y = (v) => MT + (hi - v) / (hi - lo) * (H - MT - MB);
  const X = (i) => ML + i * PW + PW / 2;
  const uid = "g" + Math.random().toString(36).slice(2, 8);
  const dentro = (v) => v != null && v >= lo && v <= hi;

  let g = `<defs>
    <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--chart-line, #5b8dbf)" stop-opacity=".26"/>
      <stop offset="1" stop-color="var(--chart-line, #5b8dbf)" stop-opacity="0"/>
    </linearGradient>
  </defs>`;

  /* umbrales: como soportes y resistencias */
  const umbral = (v, color, op, txt) => dentro(v) ? `
    <line x1="${ML}" x2="${W - MR}" y1="${Y(v)}" y2="${Y(v)}" stroke="${color}"
          stroke-width="1" stroke-dasharray="5 5" opacity="${op}"/>
    <text x="${W - MR + 6}" y="${Y(v) + 3.2}" font-size="9.5" fill="${color}" opacity="${op + .25}">${txt}</text>` : "";
  g += umbral(bands.suspHi, "var(--susp)", .5, fmt(bands.suspHi, dp));
  g += umbral(bands.suspLo, "var(--susp)", .5, fmt(bands.suspLo, dp));
  g += umbral(bands.actHi, "var(--act)", .42, fmt(bands.actHi, dp));
  g += umbral(bands.actLo, "var(--act)", .42, fmt(bands.actLo, dp));
  if (dentro(bands.target)) g += `
    <line x1="${ML}" x2="${W - MR}" y1="${Y(bands.target)}" y2="${Y(bands.target)}"
          stroke="var(--chart-target)" stroke-width="1" stroke-dasharray="2 4" opacity=".38"/>
    <text x="${ML - 7}" y="${Y(bands.target) + 3.2}" text-anchor="end" font-size="9.5"
          fill="var(--chart-text)" opacity=".9">${fmt(bands.target, dp)}</text>`;

  /* separadores de día, apenas perceptibles */
  let lastDate = null, lastLabel = -999;
  pts.forEach((p, i) => {
    if (p.date === lastDate) return;
    lastDate = p.date;
    if (i > 0) g += `<line x1="${X(i) - PW / 2}" x2="${X(i) - PW / 2}" y1="${MT}" y2="${H - MB}"
      stroke="var(--chart-grid)" stroke-width="1"/>`;
    // solo se rotula si cabe: con muchos días las fechas se encimarían
    if (X(i) - lastLabel < 46) return;
    lastLabel = X(i);
    g += `<text x="${X(i)}" y="${H - 7}" font-size="9" fill="var(--chart-text)" opacity=".75">${p.date.slice(5)}</text>`;
  });

  /* área y línea */
  const linea = pts.map((p, i) => X(i) + "," + Y(p.v)).join(" ");
  g += `<polygon class="ch-area" points="${ML + PW / 2},${H - MB} ${linea} ${X(pts.length - 1)},${H - MB}" fill="url(#${uid})"/>`;
  g += `<polyline class="ch-line" points="${linea}" fill="none" stroke="var(--chart-line, #5b8dbf)"
        stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>`;

  /* puntos: solo lo que merece atención, y el último */
  pts.forEach((p, i) => {
    const ult = i === pts.length - 1;
    const fuera = p.rejected || p.z === "susp" || p.z === "act";
    if (!fuera && !ult) return;
    const col = p.rejected || p.z === "susp" ? "var(--susp)" : p.z === "act" ? "var(--act)" : "var(--chart-line, #5b8dbf)";
    const t = `<title>#${p.n} · ${p.date} · ticket ${p.ticket || "—"} · ${fmt(p.v, dp)}${yUnit}${p.rejected ? " · RECHAZADO" : ""}</title>`;
    if (p.rejected)
      g += `<g>${t}<path d="M${X(i) - 3.6},${Y(p.v) - 3.6} l7.2,7.2 M${X(i) + 3.6},${Y(p.v) - 3.6} l-7.2,7.2"
            stroke="var(--susp)" stroke-width="2.1" stroke-linecap="round"/></g>`;
    else if (ult)
      g += `<g class="ch-live">${t}
        <circle cx="${X(i)}" cy="${Y(p.v)}" r="7" fill="${col}" class="ch-pulse"/>
        <circle cx="${X(i)}" cy="${Y(p.v)}" r="3.6" fill="${col}" stroke="var(--bg)" stroke-width="1.6" class="ch-dot"/>
      </g>`;
    else
      g += `<circle cx="${X(i)}" cy="${Y(p.v)}" r="2.8" fill="${col}"
            stroke="var(--bg)" stroke-width="1">${t}</circle>`;
  });

  /* valor actual, como la cotización de cierre */
  const u = pts[pts.length - 1];
  const uCol = u.rejected || u.z === "susp" ? "var(--susp)" : u.z === "act" ? "var(--act)" : "var(--chart-line, #5b8dbf)";
  g += `<text x="${X(pts.length - 1) + 8}" y="${Y(u.v) + 4}" font-size="12" font-weight="700" fill="${uCol}">${fmt(u.v, dp)}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block">${g}</svg>`;
}

function chartFor(def, rangeN) {
  const tests = sortedTests().filter((t) => def.get(t) != null);
  const slice = rangeN === "all" ? tests : tests.slice(-rangeN);
  const zfn = def.key === "slump" ? zoneSlump : def.key === "air" ? zoneAir : def.key === "uw" ? zoneUW : zoneTemp;
  const pts = slice.map((t) => ({ n: t.n, date: t.date, ticket: t.ticket, v: def.get(t), z: zfn(t), rejected: t.rejected }));
  return svgChart({ pts, bands: bandsFor(def.key), dp: def.dp });
}
function chartForDay(def, day, pw = 30) {
  const tests = testsOfDate(day).filter((t) => def.get(t) != null);
  const zfn = def.key === "slump" ? zoneSlump : def.key === "air" ? zoneAir : def.key === "uw" ? zoneUW : zoneTemp;
  const pts = tests.map((t) => ({ n: t.n, date: t.date, ticket: t.ticket, v: def.get(t), z: zfn(t), rejected: t.rejected }));
  return svgChart({ pts, bands: bandsFor(def.key), dp: def.dp, pw });
}
function chartCS5(sets, rangeN) {
  const p = db.plan.cs;
  const withCS = sets.filter((s) => s.cs5 != null);
  const slice = rangeN === "all" ? withCS : withCS.slice(-rangeN);
  if (!slice.length) return `<div class="empty">Sin resultados de resistencia.</div>`;
  const pts = slice.map((s) => ({ n: s.n, date: s.date, ticket: s.ticket, v: s.cs5, z: zoneCS5(s.cs5), rejected: false, ma: s._ma5 }));
  const bands = { target: p.target, actLo: p.action, actHi: null, suspLo: p.openLow, suspHi: null };
  let svg = svgChart({ pts, bands, dp: 0, yUnit: " psi" });
  const PW = 13, ML = 52, MT = 10, MB = 26, H = 230;
  const vals = pts.map((q) => q.v);
  let lo = Math.min(...vals, p.openLow), hi = Math.max(...vals);
  const pad = (hi - lo || 1) * 0.12; lo -= pad; hi += pad;
  const Y = (v) => MT + (hi - v) / (hi - lo) * (H - MT - MB);
  const X = (i) => ML + i * PW + PW / 2;
  const maPts = pts.map((q, i) => (q.ma != null ? X(i) + "," + Y(q.ma) : null)).filter(Boolean);
  if (maPts.length > 1)
    svg = svg.replace("</svg>", `<polyline fill="none" stroke="var(--chart-ma, #122c42)" stroke-width="2.4" stroke-dasharray="2 3" points="${maPts.join(" ")}"/></svg>`);
  return svg;
}

/* ------------------------------------------------------------ CSV / files */
function csvCell(v) { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}
function exportCSV() {
  const headers = ["#", "Fecha", "Ticket", "Camion", "CY", "Planta", "Lote", "Identificacion", "Batch", "Llegada", "Comienza", "Muestra", "Termina", "Min", "Slump", "Aire", "UW", "UW objetivo", "Temp", "CS 1d", "CS 5d", "CS 28d", "MediaMovil5d", "Estado", "Comentarios"];
  const sets = strengthSets();
  const maOf = new Map(sets.map((s) => [s.n, s._ma5]));
  const rows = sortedTests().map((t) => [
    t.n, t.date, t.ticket, t.truck, t.vol, t.plant, t.lot, t.ident, t.batch, t.arrive, t.start, t.testTime, t.end,
    minutesBetween(t.batch, t.end) ?? "", t.slump, t.air, t.uw, t.uwTarget ?? db.plan.uw.target, t.temp,
    t.cs1, t.cs5, t.cs28, maOf.get(t.n) != null ? Math.round(maOf.get(t.n)) : "",
    t.rejected ? "RECHAZADO" : (worstZone(t) || "").toUpperCase(), t.comments,
  ]);
  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  downloadFile(`qc-pr52-pruebas-${todayISO()}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
  toast("CSV descargado");
}

/* ------------------------------------------------------------ rejection notice */
function notifyReject(n) {
  const t = db.tests.find((x) => x.n === n);
  if (!t) return;
  const meta = db.dayMeta[t.date] || {};
  const p = db.plan;
  const uwT = t.uwTarget ?? p.uw.target;
  const reasons = [];
  if (zoneSlump(t) === "susp") reasons.push(`Slump ${fmt(t.slump, 2)}" (susp. ${p.slump.suspLo}–${p.slump.suspHi}")`);
  if (zoneAir(t) === "susp") reasons.push(`Aire ${fmt(t.air, 1)}% (susp. ${p.air.suspLo}–${p.air.suspHi}%)`);
  if (zoneUW(t) === "susp") reasons.push(`UW ${fmt(t.uw, 2)} pcf (susp. ±${p.uw.susp} de ${uwT})`);
  if (zoneTemp(t) === "susp") reasons.push(`Temp ${fmt(t.temp, 0)} °F (máx ${p.tempMax})`);
  const subject = `RECHAZO DE CAMIÓN — Ticket ${t.ticket || "—"} — ${db.project.name}`;
  const body = [
    `AVISO DE RECHAZO DE HORMIGÓN`, ``,
    `Proyecto: ${db.project.name}`,
    `Mezcla: ${db.project.mixId}`,
    `Fecha: ${t.date}   Hora muestra: ${t.testTime || t.start || "—"}`,
    meta.fase || meta.lane ? `Fase: ${meta.fase || "—"}   Carril: ${meta.lane || "—"}   Cierre: ${meta.cierre || "—"}` : null,
    `Losa / Identificación: ${t.ident || "—"}`,
    `Ticket: ${t.ticket || "—"}   Camión: ${t.truck || "—"}   Volumen: ${fmt(t.vol, 1)} CY   Planta: ${t.plant || "—"}`, ``,
    `RESULTADOS:`,
    `  Slump: ${fmt(t.slump, 2)} in   (acción ${p.slump.actLo}–${p.slump.actHi} / susp ${p.slump.suspLo}–${p.slump.suspHi})`,
    `  UW: ${fmt(t.uw, 2)} pcf   (objetivo ${uwT} ±${p.uw.act} acción / ±${p.uw.susp} susp)`,
    `  Aire: ${fmt(t.air, 1)} %   (acción ${p.air.actLo}–${p.air.actHi} / susp ${p.air.suspLo}–${p.air.suspHi})`,
    `  Temp: ${fmt(t.temp, 0)} °F   (máx ${p.tempMax})`, ``,
    `MOTIVO: ${reasons.length ? reasons.join("; ") : (t.comments || "Rechazo manual — ver comentarios")}`,
    t.comments ? `Comentarios: ${t.comments}` : null, ``,
    `Generado por QC — Control de Hormigón PR-52`,
  ].filter((x) => x != null).join("\n");
  const to = db.project.notifyEmails || "";
  location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ------------------------------------------------------------ modal form builder */
function openForm({ title, fields, initial = {}, onSave, onDelete = null, submitLabel = "Guardar", liveEval = null }) {
  const root = document.getElementById("modal-root");
  const fid = "f-" + uid();
  root.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) closeForm()">
      <div class="modal">
        <div class="modal-head">${esc(title)}<div class="spacer"></div><button class="btn small" onclick="closeForm()">✕</button></div>
        <div class="modal-body"><form id="${fid}" onsubmit="return false"><div class="form-grid">
          ${fields.map((f) => {
            if (f.type === "label") return `<div class="fieldset-label">${esc(f.label)}</div>`;
            const val = initial[f.key] ?? f.default ?? "";
            let ctrl;
            if (f.type === "select")
              ctrl = `<select name="${f.key}">${(f.options || []).map((o) => `<option value="${esc(o.value)}" ${String(val) === String(o.value) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
            else if (f.type === "textarea")
              ctrl = `<textarea name="${f.key}" rows="2">${esc(val)}</textarea>`;
            else if (f.type === "checkbox")
              ctrl = `<select name="${f.key}"><option value="" ${!val ? "selected" : ""}>No</option><option value="1" ${val ? "selected" : ""}>Sí</option></select>`;
            else
              ctrl = `<input name="${f.key}" type="${f.type || "text"}" value="${esc(val)}" ${f.step != null ? `step="${f.step}"` : ""} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""} ${f.required ? "required" : ""}>`;
            return `<div class="field ${f.full ? "full" : ""} ${f.half ? "half" : ""}"><label>${esc(f.label)}${f.required ? " *" : ""}</label>${ctrl}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ""}</div>`;
          }).join("")}
        </div></form></div>
        ${liveEval ? `<div id="${fid}-live" style="padding:10px 20px; border-top:1px solid var(--line)"></div>` : ""}
        <div class="modal-foot">
          ${onDelete ? `<button class="btn danger" id="${fid}-del">Eliminar</button><div style="flex:1"></div>` : ""}
          <button class="btn" onclick="closeForm()">Cancelar</button>
          <button class="btn primary" id="${fid}-save">${esc(submitLabel)}</button>
        </div>
      </div>
    </div>`;
  document.getElementById(fid + "-save").onclick = () => {
    const form = document.getElementById(fid);
    const values = {}; let ok = true;
    for (const f of fields) {
      if (f.type === "label") continue;
      const el = form.elements[f.key];
      const v = el.value.trim();
      el.closest(".field").classList.remove("invalid");
      if (f.required && !v) { el.closest(".field").classList.add("invalid"); ok = false; continue; }
      if (f.type === "number") values[f.key] = v === "" ? null : Number(v);
      else if (f.type === "checkbox") values[f.key] = v === "1";
      else values[f.key] = v;
    }
    if (!ok) { toast("Complete los campos requeridos"); return; }
    onSave(values); closeForm();
  };
  if (onDelete) document.getElementById(fid + "-del").onclick = () => { onDelete(); closeForm(); };
  if (liveEval) {
    const form = document.getElementById(fid);
    const liveEl = document.getElementById(fid + "-live");
    const run = () => {
      const values = {};
      for (const f of fields) {
        if (f.type === "label") continue;
        const el = form.elements[f.key];
        if (!el) continue;
        const v = el.value.trim();
        if (f.type === "number") values[f.key] = v === "" ? null : Number(v);
        else if (f.type === "checkbox") values[f.key] = v === "1";
        else values[f.key] = v;
      }
      liveEl.innerHTML = liveEval(values);
    };
    form.addEventListener("input", run);
    form.addEventListener("change", run);
    run();
  }
  const first = root.querySelector("input, select, textarea");
  if (first) first.focus();
}
function closeForm() { const r = document.getElementById("modal-root"); if (r) r.innerHTML = ""; }

/* ------------------------------------------------------------ truck test form (shared) */
function formTest(_ignored, n, opts = {}) {
  const existing = n != null ? db.tests.find((t) => t.n === n) : null;
  const init = existing || {
    date: (typeof state !== "undefined" && state.day) ? state.day : todayISO(),
    vol: 10, plant: "01-SAN JUAN",
    ...(opts.prefill || {}),
  };
  const uwT = existing && existing.uwTarget != null ? existing.uwTarget : db.plan.uw.target;
  openForm({
    title: existing ? `Editar prueba #${existing.n}` : `Nueva prueba / camión (#${nextTestN()})`,
    initial: init,
    liveEval: (v) => {
      const pseudo = { slump: v.slump, air: v.air, uw: v.uw, temp: v.temp, uwTarget: uwT };
      const parts = [
        { k: "Slump", val: v.slump, z: zoneSlump(pseudo), u: '"' },
        { k: "UW", val: v.uw, z: zoneUW(pseudo), u: " pcf" },
        { k: "Aire", val: v.air, z: zoneAir(pseudo), u: "%" },
        { k: "Temp", val: v.temp, z: zoneTemp(pseudo), u: " °F" },
      ];
      const chips = parts.map((p) => p.val == null
        ? `<span class="badge neutral">${p.k}: —</span>`
        : `<span class="badge ${p.z === "susp" ? "susp" : p.z === "act" ? "act" : "ok"}">${p.k}: ${fmt(p.val, 2)}${p.u}</span>`
      ).join(" ");
      const w = worstZone(pseudo);
      let verdict, cls;
      if (v.rejected) { verdict = "RECHAZADO (manual)"; cls = "susp"; }
      else if (w === "susp") { verdict = "✕ RECHAZAR — fuera de límites de suspensión"; cls = "susp"; }
      else if (w === "act") { verdict = "⚠ ACEPTAR — zona de acción, vigilar"; cls = "act"; }
      else if (w === "ok") { verdict = "✓ ACEPTAR CAMIÓN"; cls = "ok"; }
      else { verdict = "Ingrese resultados de las pruebas…"; cls = "neutral"; }
      return `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">${chips}
        <span class="badge ${cls}" style="margin-left:auto; font-size:14px; padding:7px 16px">${verdict}</span></div>`;
    },
    onDelete: existing ? () => {
      if (!confirm(`¿Eliminar prueba #${existing.n}?`)) return;
      db.tests = db.tests.filter((t) => t.n !== existing.n);
      saveDB(); render(); toast("Prueba eliminada");
    } : null,
    fields: [
      { type: "label", label: "Camión / entrega" },
      { key: "date", label: "Fecha", type: "date", required: true },
      { key: "ticket", label: "Ticket", required: true },
      { key: "truck", label: "Camión" },
      { key: "vol", label: "Volumen (CY)", type: "number", step: "0.5" },
      { key: "plant", label: "Planta" },
      { key: "lot", label: "Lote" },
      { key: "ident", label: "Losa / Identificación", full: true, placeholder: "p.ej. Phase 10 - Slab L3-0.943" },
      { type: "label", label: "Tiempos" },
      { key: "batch", label: "Batch", type: "time" },
      { key: "arrive", label: "Llegada", type: "time" },
      { key: "start", label: "Comienza vaciado", type: "time" },
      { key: "testTime", label: "Toma de muestra", type: "time" },
      { key: "end", label: "Termina vaciado", type: "time" },
      { type: "label", label: "Pruebas frescas" },
      { key: "slump", label: "Slump (in)", type: "number", step: "0.25" },
      { key: "uw", label: "Peso unitario (pcf)", type: "number", step: "0.01" },
      { key: "air", label: "Aire (%)", type: "number", step: "0.1" },
      { key: "temp", label: "Temp (°F)", type: "number", step: "1" },
      { key: "rejected", label: "¿Rechazado?", type: "checkbox" },
      { type: "label", label: "Resistencias (promedio del set, psi)" },
      { key: "cs1", label: "1 día", type: "number", step: "10" },
      { key: "cs5", label: "5 días", type: "number", step: "10" },
      { key: "cs28", label: "28 días", type: "number", step: "10" },
      { key: "comments", label: "Comentarios", type: "textarea", full: true },
    ],
    onSave: (v) => {
      if (existing) Object.assign(existing, v);
      else {
        v.n = nextTestN();
        v.id = uid();
        v.uwTarget = db.plan.uw.target;
        db.tests.push(v);
        if (typeof state !== "undefined") state.day = v.date;
      }
      saveDB(); render();
      toast(existing ? "Prueba actualizada" : "Prueba registrada");
      if (opts.after) opts.after(existing || v);
    },
  });
}
