/* ============================================================
   QC — Control Center (full version)
   Requires: seed.js + core.js loaded first.
   Role screens: movil.html · display.html · conduce.html ·
   produccion.html · autoridad.html — all share the same DB.
   ============================================================ */
"use strict";

/* ------------------------------------------------------------ UI state */
const state = { tab: "dashboard", day: null, search: "", showAll: false, chartRange: 80 };

/* «Plan & Datos» es configuración, no trabajo: servidor, llave del proyecto,
   límites del plan de control y ficha del proyecto. Solo la ve quien lleve
   `config: true` (`qcVeConfig()`), y la comprobación se hace en TRES sitios
   porque esconder el botón no es esconder la pantalla: la pestaña no se pinta,
   el enrutador no la acepta desde la dirección, y `switchTab` la rechaza. */
const TABS_BASE = ["dashboard", "live", "daily", "losas", "tests", "strength", "charts"];
function tabsVisibles() {
  return typeof qcVeConfig === "function" && qcVeConfig() ? TABS_BASE.concat("plan") : TABS_BASE;
}
function switchTab(tab, pushHash = true) {
  if (!tabsVisibles().includes(tab)) tab = "dashboard";
  state.tab = tab;
  document.querySelectorAll("#main-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  // deja la pestaña en la direccion, para que el Control Center pueda enlazar directo
  if (pushHash && location.hash.slice(1) !== tab) history.replaceState(null, "", "#" + tab);
  render();
}
/* Los widgets del Control Center abren results.html#<pestana> */
function tabFromHash() {
  const h = location.hash.slice(1);
  return tabsVisibles().includes(h) ? h : null;
}

/* La pestaña se quita del encabezado para quien no deba verla. Se hace aquí y
   no en el HTML porque el papel se deduce de la cuenta en cada carga, no se
   escribe en la página. */
function pintarPestanas() {
  if (typeof qcVeConfig === "function" && qcVeConfig()) return;
  const b = document.querySelector('#main-tabs button[data-tab="plan"]');
  if (b) b.remove();
}
function render() {
  if (typeof pintarTiro === "function") pintarTiro();   // el tiro sube en vivo
  const app = document.getElementById("app");
  if (state.tab === "dashboard") app.innerHTML = viewDashboard();
  else if (state.tab === "live") app.innerHTML = viewLive();
  else if (state.tab === "daily") app.innerHTML = viewDaily();
  else if (state.tab === "losas") app.innerHTML = viewLosas();
  else if (state.tab === "tests") app.innerHTML = viewTests();
  else if (state.tab === "strength") app.innerHTML = viewStrength();
  else if (state.tab === "charts") app.innerHTML = viewCharts();
  else if (state.tab === "plan") app.innerHTML = viewPlan();
}

/* ¿Y si alguien llega a `viewPlan()` por otro camino? No pinta nada. Es la
   tercera comprobación a propósito: como el resto del acceso, esto vive en el
   navegador y frena un despiste, no a alguien decidido. El candado de verdad
   llega con Q-07. */
function permiteConfig() { return typeof qcVeConfig !== "function" || qcVeConfig(); }

/* ------------------------------------------------------------ Dashboard */
function viewDashboard() {
  const tests = sortedTests();
  const totalCY = tests.reduce((a, t) => a + (num(t.vol) || 0), 0);
  const days = diasDelProyecto();
  const rejected = tests.filter((t) => t.rejected).length;
  const sets = strengthSets();
  const lastMA = [...sets].reverse().find((s) => s._ma5 != null);
  const last30 = tests.slice(-30);
  const okCount = last30.filter((t) => !t.rejected && worstZone(t) === "ok").length;

  const lastDay = days[0];
  const lastDayTests = lastDay ? testsOfDate(lastDay) : [];
  /* Aquí había un segundo juego de avisos (Moving Average bajo, rachas en
     zona de acción). Fuera por Q-43: los avisos viven solo en el Control
     Center. */
  return `
    <div class="grid cols-6">
      <div class="stat"><div class="label">Pruebas</div><div class="value">${tests.length}</div><div class="sub">${days.length} días de vaciado</div></div>
      <div class="stat"><div class="label">Hormigón</div><div class="value">${fmt(totalCY, 0)}</div><div class="sub">yardas cúbicas</div></div>
      <div class="stat ${rejected ? "alert" : ""}"><div class="label">Rechazados</div><div class="value">${rejected}</div><div class="sub">camiones</div></div>
      <div class="stat"><div class="label">Sets resistencia</div><div class="value">${sets.length}</div><div class="sub">${sets.filter((s) => s.cs5 != null).length} con 5 días</div></div>
      <div class="stat ${lastMA ? (lastMA._ma5 >= db.plan.cs.target ? "good" : "alert") : ""}"><div class="label">Moving Average 5d</div>
        <div class="value">${lastMA ? fmt(lastMA._ma5, 0) : "—"}</div><div class="sub">objetivo ${fmt(db.plan.cs.target, 0)} psi</div></div>
      <div class="stat ${okCount / (last30.length || 1) >= 0.8 ? "good" : ""}"><div class="label">Zona OK</div>
        <div class="value">${last30.length ? Math.round(okCount / last30.length * 100) + "%" : "—"}</div><div class="sub">últimas ${last30.length} pruebas</div></div>
    </div>


    <div class="grid cols-2" style="margin-top:16px">
      <div class="panel">
        <div class="panel-head"><h2>Último vaciado — ${lastDay ? fmtDate(lastDay) : "—"}</h2><div class="spacer"></div>
          <button class="btn small" onclick="state.day='${lastDay}'; switchTab('daily')">Abrir hoja</button></div>
        <div class="panel-body flush">
          ${lastDayTests.length ? `<div class="table-wrap"><table class="data">
            <tr><th>#</th><th>Losa / Ident.</th><th>Camión</th><th class="num">Slump</th><th class="num">UW</th><th class="num">Temp</th><th>Estado</th></tr>
            ${lastDayTests.slice(-8).map((t) => `<tr class="clickable ${t.rejected ? "rejected" : ""}" onclick="formTest(null,${t.n})">
              <td class="mono">${t.n}</td><td style="white-space:normal">${esc(shortIdent(t.ident))}</td><td class="mono">${esc(t.truck || "—")}</td>
              <td${zClass(zoneSlump(t))}>${fmtSlump(t.slump)}</td>
              <td${zClass(zoneUW(t))}>${fmt(t.uw, 2)}</td>
              <td${zClass(zoneTemp(t))}>${fmt(t.temp, 0)}</td>
              <td>${estadoBadge(t)}</td></tr>`).join("")}
          </table></div>` : `<div class="empty">Sin pruebas.</div>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Resistencia 5 días — últimas ${Math.min(10, sets.filter((s) => s.cs5 != null).length)}</h2><div class="spacer"></div>
          <button class="btn small" onclick="switchTab('strength')">Ver todas</button></div>
        <div class="panel-body flush">
          ${sets.filter((s) => s.cs5 != null).slice(-10).reverse().map((s) => {
            const z = zoneCS5(s.cs5, s.date);
            return `<div style="display:flex; align-items:center; gap:10px; padding:7px 16px; border-bottom:1px solid var(--line); font-size:13px">
              <span class="mono muted" style="width:78px">${fmtDate(s.date)}</span>
              <span class="mono" style="width:60px">#${esc(s.ticket)}</span>
              <b class="mono" style="width:70px; text-align:right; color:${z === "ok" ? "var(--ok)" : z === "act" ? "var(--act)" : "var(--susp)"}">${fmt(s.cs5, 0)}</b>
              <span class="muted">psi</span>
              ${s._ma5 != null ? `<span class="muted" style="margin-left:auto">MM: <b class="mono">${fmt(s._ma5, 0)}</b></span>` : ""}
            </div>`;
          }).join("") || `<div class="empty">Sin resultados de resistencia.</div>`}
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Carta rápida — Resistencia @ 5 días + Moving Average</h2><div class="spacer"></div>
        <button class="btn small" onclick="switchTab('charts')">Todas las cartas</button></div>
      <div class="panel-body"><div class="chart-scroll">${chartCS5(sets, 60)}</div></div>
    </div>`;
}

/* ------------------------------------------------------------ En Vivo */
function viewLive() {
  const days = diasDelProyecto();
  const day = state.day && days.includes(state.day) ? state.day : days[0];
  state.day = day;
  const rows = testsOfDate(day);
  const last = rows[rows.length - 1];
  const cy = rows.reduce((a, t) => a + (num(t.vol) || 0), 0);
  const nRej = rows.filter((t) => t.rejected).length;
  const meta = db.dayMeta[day] || {};

  let verdictHtml = `<div class="empty">Sin camiones registrados para esta fecha.</div>`;
  if (last) {
    const w = worstZone(last);
    const cls = last.rejected || w === "susp" ? "susp" : w === "act" ? "act" : "ok";
    const label = last.rejected ? "✕ RECHAZADO" : w === "susp" ? "✕ FUERA DE LÍMITE" : w === "act" ? "⚠ ACEPTADO — ACCIÓN" : "✓ ACEPTADO";
    const cell = (k, v, z, u, f) => `<div class="live-cell ${z ? "lz-" + z : ""}">
      <div class="k">${k}</div><div class="v mono">${v == null ? "—" : (f || ((x) => fmt(x, 2)))(v)}<span class="u">${u}</span></div></div>`;
    verdictHtml = `
      <div class="live-verdict ${cls}">
        <div>
          <div class="lv-truck">Load #${rows.length} · Camión ${esc(last.truck || "—")} · Ticket <b>${esc(last.ticket || "—")}</b></div>
          <div class="lv-ident">${esc(shortIdent(last.ident))} · muestra ${esc(last.testTime || last.start || "—")}</div>
        </div>
        <div class="lv-status">${label}</div>
      </div>
      <div class="live-grid">
        ${cell("Slump (in)", last.slump, zoneSlump(last), '"', fmtSlump)}
        ${cell("UW (pcf)", last.uw, zoneUW(last), "")}
        ${cell("Aire (%)", last.air, zoneAir(last), "%")}
        ${cell("Temp (°F)", last.temp, zoneTemp(last), "°")}
        <div class="live-cell"><div class="k">Hora</div><div class="v mono">${esc(last.end || last.testTime || last.start || "—")}</div></div>
      </div>
      ${last.rejected ? `<div style="margin-top:10px; text-align:right"><button class="btn danger" onclick="notifyReject(${last.n})">✉ Notificar rechazo a todas las partes</button></div>` : ""}`;
  }

  const h = lastHumidity(day);

  return `
    <div class="toolbar">
      <h2>Pantalla en vivo</h2>
      <select onchange="state.day=this.value; render()">
        ${days.map((d) => `<option value="${d}" ${d === day ? "selected" : ""}>${fmtDate(d)}</option>`).join("")}
      </select>
      <span class="muted" style="font-size:12.5px">${meta.fase ? "Fase " + esc(meta.fase) + " · " : ""}${meta.lane ? "Carril " + esc(meta.lane) : ""}</span>
      <div class="spacer"></div>
      <a class="btn" href="muestras.html" target="_blank">🧪 Muestras (iPad)</a>
      <a class="btn" href="display.html" target="_blank">🖥 Field Display</a>
      <button class="btn primary" onclick="formTest(null)">＋ Camión</button>
    </div>

    <!-- Los avisos salieron de aquí — Q-43, 7 ago 2026. Viven solo en el
         Control Center, que es donde está quien puede llamar a la planta.
         El control de humedad se queda: eso es un dato que se entra, no una
         deducción del sistema. -->
    <div class="notice" style="background:var(--panel-2); color:var(--ink-soft)">
      Humedad de agregados: ${h ? "última a las " + esc(h.time) : "sin registro hoy"}
      <button class="btn small" style="margin-left:10px" onclick="formHumidity()">＋ Humedad</button></div>

    <div class="grid cols-3">
      <div class="stat"><div class="label">Yardas acumuladas</div><div class="value live-big">${fmt(cy, 1)}</div><div class="sub">CY · ${fmtDate(day)}</div></div>
      <div class="stat"><div class="label">Loads</div><div class="value live-big">${rows.length}</div><div class="sub">camiones</div></div>
      <div class="stat ${nRej ? "alert" : "good"}"><div class="label">Rechazados</div><div class="value live-big">${nRej}</div><div class="sub">hoy</div></div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>Último camión</h2></div>
      <div class="panel-body">${verdictHtml}</div>
    </div>

    <div class="grid cols-2">
      <div class="panel">
        <div class="panel-head"><h2>Slump — en vivo</h2><div class="spacer"></div>
          <span class="muted" style="font-size:12px">${trendLabel(day, "slump")}</span></div>
        <div class="panel-body"><div class="chart-scroll">${chartForDay(CHART_DEFS[0], day)}</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Unit Weight — en vivo</h2><div class="spacer"></div>
          <span class="muted" style="font-size:12px">${trendLabel(day, "uw")}</span></div>
        <div class="panel-body"><div class="chart-scroll">${chartForDay(CHART_DEFS[2], day)}</div></div>
      </div>
    </div>
    <div class="grid cols-2">
      <div class="panel">
        <div class="panel-head"><h2>Aire (%)</h2></div>
        <div class="panel-body"><div class="chart-scroll">${chartForDay(CHART_DEFS[1], day)}</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Temperatura (°F)</h2></div>
        <div class="panel-body"><div class="chart-scroll">${chartForDay(CHART_DEFS[3], day)}</div></div>
      </div>
    </div>`;
}


function formHumidity() {
  openForm({
    title: "Registrar prueba de humedad (planta)",
    initial: { date: state.day || todayISO(), time: nowHM(), plant: "01-SAN JUAN" },
    fields: [
      { key: "date", label: "Fecha", type: "date", required: true },
      { key: "time", label: "Hora", type: "time", required: true },
      { key: "plant", label: "Planta" },
      { key: "note", label: "Nota", full: true, placeholder: "Ej. humedad arena 4.2%" },
    ],
    onSave: (v) => { addHumidity(v); render(); toast("Humedad registrada"); },
  });
}

/* ------------------------------------------------------------ Daily sheet */
function viewDaily() {
  const days = diasDelProyecto();
  if (!state.day || !days.includes(state.day)) state.day = days[0] || todayISO();
  const rows = testsOfDate(state.day);
  const meta = db.dayMeta[state.day] || {};
  const cy = rows.reduce((a, t) => a + (num(t.vol) || 0), 0);
  const nRej = rows.filter((t) => t.rejected).length;

  return `
    <div class="print-title">
      <h1>Hoja de Vaciado — ${fmtDate(state.day)}</h1>
      <div class="muted">${esc(db.project.name)} · ${esc(db.project.mixId)}${meta.fase ? " · Fase " + esc(meta.fase) : ""}${meta.lane ? " · Carril " + esc(meta.lane) : ""}</div>
    </div>

    <div class="toolbar">
      <h2>Vaciado diario</h2>
      <select onchange="state.day=this.value; render()">
        ${days.map((d) => `<option value="${d}" ${d === state.day ? "selected" : ""}>${fmtDate(d)}</option>`).join("")}
      </select>
      <button class="btn small" onclick="formDayMeta('${state.day}')">Plan y datos del día</button>
      <div class="spacer"></div>
      <a class="btn" href="reporte.html?dia=${state.day}">📄 Reporte del vaciado</a>
      <button class="btn" onclick="window.print()">🖨 Imprimir</button>
      <button class="btn primary" onclick="formTest(null)">＋ Camión</button>
    </div>

    <div class="panel"><div class="panel-body">
      <div class="day-meta">
        <div class="kv"><div class="k">Fase</div><b>${esc(meta.fase || "—")}</b></div>
        <div class="kv"><div class="k">Cierre</div><b>${esc(meta.cierre || "—")}</b></div>
        <div class="kv"><div class="k">Carril</div><b>${esc(meta.lane || "—")}</b></div>
        <div class="kv"><div class="k">Km</div><b>${esc(meta.km || "—")}</b></div>
        <div class="kv"><div class="k">Camiones</div><b>${rows.length}</b></div>
        <div class="kv"><div class="k">Volumen</div><b>${fmt(cy, 1)} CY</b></div>
        <div class="kv"><div class="k">Rechazados</div><b style="${nRej ? "color:var(--susp)" : ""}">${nRej}</b></div>
      </div>
    </div></div>

    <div class="panel"><div class="panel-body flush">
      ${rows.length ? `<div class="table-wrap"><table class="data">
        <tr><th>#</th><th>Losa / Identificación</th><th>Camión</th><th>Ticket</th>
            <th>Batch</th><th>Llegada</th><th>Comienza</th><th>Muestra</th><th>Termina</th><th class="num">Min</th>
            <th class="num">Slump (in)</th><th class="num">UW (pcf)</th><th class="num">Aire (%)</th><th class="num">Temp (°F)</th>
            <th>Estado</th><th>Comentarios</th><th class="no-print"></th></tr>
        ${rows.map((t) => {
          const el = minutesBetween(t.batch, t.end);
          return `<tr class="${t.rejected ? "rejected" : ""}">
            <td class="mono">${t.n}</td>
            <td style="white-space:normal; min-width:150px">${esc(shortIdent(t.ident))}</td>
            <td class="mono">${esc(t.truck || "—")}</td>
            <td class="mono"><b>${esc(t.ticket || "—")}</b></td>
            <td class="mono">${esc(t.batch || "—")}</td>
            <td class="mono">${esc(t.arrive || "—")}</td>
            <td class="mono">${esc(t.start || "—")}</td>
            <td class="mono">${esc(t.testTime || "—")}</td>
            <td class="mono">${esc(t.end || "—")}</td>
            <td${zClass(zoneElapsed(t))}>${el != null ? el : "—"}</td>
            <td${zClass(zoneSlump(t))}>${fmtSlump(t.slump)}</td>
            <td${zClass(zoneUW(t))}>${fmt(t.uw, 2)}</td>
            <td${zClass(zoneAir(t))}>${fmt(t.air, 1)}</td>
            <td${zClass(zoneTemp(t))}>${fmt(t.temp, 0)}</td>
            <td>${estadoBadge(t)}</td>
            <td style="white-space:normal; min-width:120px; font-size:12px">${esc(t.comments || "")}</td>
            <td class="no-print"><button class="btn link small" onclick="formTest(null,${t.n})">Editar</button><button class="btn link small" onclick="lineaDeTiempo(${t.n})" title="Qué le pasó a este camión y quién entró cada dato">Historia</button>${t.rejected ? `<button class="btn link small" style="color:var(--susp)" onclick="notifyReject(${t.n})">✉</button>` : ""}</td>
          </tr>`;
        }).join("")}
      </table></div>` : `<div class="empty">Sin camiones para esta fecha — pulse “＋ Camión”.</div>`}
    </div></div>

    <p class="muted" style="font-size:12px">
      Colores: <span class="badge ok">OK</span> dentro de límites de acción ·
      <span class="badge act">ACCIÓN</span> entre acción y suspensión ·
      <span class="badge susp">SUSPENSIÓN</span> fuera de límites — según plan de control (pestaña Plan &amp; Datos).
      “Min” = minutos batch→termina (límite ${db.plan.maxElapsedMin}).
    </p>`;
}

/* ------------------------------------------------------------ All tests */
function viewTests() {
  let rows = sortedTests();
  const q = state.search.toLowerCase();
  if (q) rows = rows.filter((t) => [t.ticket, t.truck, t.ident, t.lot, t.date].join(" ").toLowerCase().includes(q));
  const total = rows.length;
  if (!state.showAll) rows = rows.slice(-120);

  return `
    <div class="toolbar">
      <h2>Registro de pruebas</h2>
      <input type="search" id="t-search" placeholder="Buscar ticket, losa, lote…" value="${esc(state.search)}"
        oninput="state.search=this.value; render(); focusTSearch()">
      <div class="spacer"></div>
      <span class="muted" style="font-size:12.5px">${state.showAll ? total : Math.min(120, total)} de ${total}</span>
      ${total > 120 ? `<button class="btn small" onclick="state.showAll=!state.showAll; render()">${state.showAll ? "Últimas 120" : "Ver todas"}</button>` : ""}
      <button class="btn" onclick="exportCSV()">⬇ CSV</button>
      <button class="btn primary" onclick="formTest(null)">＋ Prueba</button>
    </div>
    <div class="panel"><div class="panel-body flush">
      <div class="table-wrap" style="max-height:68vh; overflow-y:auto"><table class="data">
        <tr><th>#</th><th>Fecha</th><th>Ticket</th><th>Camión</th><th class="num">CY</th><th>Lote</th><th>Identificación</th>
            <th class="num">Slump</th><th class="num">Aire</th><th class="num">UW</th><th class="num">Temp</th>
            <th class="num">1d</th><th class="num">5d</th><th class="num">28d</th><th>Estado</th></tr>
        ${rows.map((t) => `<tr class="clickable ${t.rejected ? "rejected" : ""}" onclick="formTest(null,${t.n})">
          <td class="mono">${t.n}</td>
          <td class="mono">${esc(t.date)}</td>
          <td class="mono"><b>${esc(t.ticket || "—")}</b></td>
          <td class="mono">${esc(t.truck || "—")}</td>
          <td class="num mono">${fmt(t.vol, 1)}</td>
          <td class="mono">${esc(t.lot || "—")}</td>
          <td style="white-space:normal; min-width:170px; font-size:12px">${esc(shortIdent(t.ident))}</td>
          <td${zClass(zoneSlump(t))}>${fmtSlump(t.slump)}</td>
          <td${zClass(zoneAir(t))}>${fmt(t.air, 1)}</td>
          <td${zClass(zoneUW(t))}>${fmt(t.uw, 2)}</td>
          <td${zClass(zoneTemp(t))}>${fmt(t.temp, 0)}</td>
          <td class="num mono">${fmt(t.cs1, 0)}</td>
          <td${zClass(zoneCS5(t.cs5, t.date))}>${fmt(t.cs5, 0)}</td>
          <td class="num mono">${fmt(t.cs28, 0)}</td>
          <td>${estadoBadge(t)}</td>
        </tr>`).join("")}
      </table></div>
    </div></div>`;
}
function focusTSearch() {
  const el = document.getElementById("t-search");
  if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}

/* ------------------------------------------------------------ Strength */
function viewStrength() {
  const sets = strengthSets();
  const p = db.plan.cs;
  return `
    <div class="toolbar">
      <h2>Resistencias &amp; Moving Average</h2>
      <div class="spacer"></div>
      <span class="muted" style="font-size:12.5px">Objetivo: ${fmt(p.target, 0)} psi @ ${p.age} días · Acción &lt; ${fmt(p.target, 0)} · Suspensión &lt; ${fmt(p.action, 0)} · Apertura al tráfico: ${fmt(p.openTarget, 0)} (mín ${fmt(p.openLow, 0)})</span>
    </div>
    <div class="panel"><div class="panel-body flush">
      ${sets.length ? `<div class="table-wrap" style="max-height:70vh; overflow-y:auto"><table class="data">
        <tr><th>Set</th><th>Fecha</th><th>Ticket</th><th>Camión</th><th>Identificación</th>
            <th class="num">1 día</th><th>Apertura (1d)</th><th class="num">${p.age} días</th><th class="num">28 días</th>
            <th class="num">Moving Average (${db.plan.maWindow})</th></tr>
        ${sets.map((s, i) => {
          const zma = s._ma5 == null ? null : (s._ma5 >= p.target ? "ok" : "susp");
          let open = "—";
          if (s.cs1 != null) {
            open = s.cs1 >= p.openTarget ? `<span class="badge ok">Sí (${fmt(s.cs1, 0)})</span>`
              : s.cs1 >= p.openLow ? `<span class="badge act">Marginal</span>`
              : `<span class="badge susp">No</span>`;
          }
          return `<tr>
            <td class="mono">${i + 1}</td>
            <td class="mono">${esc(s.date)}</td>
            <td class="mono"><b>${esc(s.ticket || "—")}</b></td>
            <td class="mono">${esc(s.truck || "—")}</td>
            <td style="white-space:normal; min-width:160px; font-size:12px">${esc(shortIdent(s.ident))}</td>
            <td class="num mono">${fmt(s.cs1, 0)}</td>
            <td>${open}</td>
            <td${zClass(zoneCS5(s.cs5, s.date))}><b>${fmt(s.cs5, 0)}</b></td>
            <td class="num mono">${fmt(s.cs28, 0)}</td>
            <td${zClass(zma)}>${fmt(s._ma5, 0)}</td>
          </tr>`;
        }).join("")}
      </table></div>` : `<div class="empty">Sin resultados de resistencia.</div>`}
    </div></div>
    <p class="muted" style="font-size:12px">Cada resultado es el promedio del set de cilindros rotos a esa edad (ASTM C39). La Moving Average cubre los últimos ${db.plan.maWindow} sets con resultado a ${p.age} días.</p>`;
}

/* ------------------------------------------------------------ Charts */
function viewCharts() {
  const sets = strengthSets();
  const r = state.chartRange;
  const rangeSel = `<select onchange="state.chartRange=this.value==='all'?'all':Number(this.value); render()">
    ${[40, 80, 150].map((n) => `<option value="${n}" ${r === n ? "selected" : ""}>Últimas ${n}</option>`).join("")}
    <option value="all" ${r === "all" ? "selected" : ""}>Todas</option>
  </select>`;
  return `
    <div class="toolbar">
      <h2>Control Charts</h2>
      ${rangeSel}
      <a class="btn primary" href="reporte.html?modo=acumulado">📄 Generar reporte</a>
      <div class="spacer"></div>
      <div class="chart-legend">
        <span><span class="sw" style="background:var(--susp); height:2px; margin-top:5px"></span>Límite de suspensión</span>
        <span><span class="sw" style="background:var(--act); height:2px; margin-top:5px"></span>Límite de acción</span>
        <span><span class="sw" style="background:var(--chart-target); height:2px; margin-top:5px; opacity:.5"></span>Objetivo</span>
        <span><span class="sw" style="background:var(--chart-line); border-radius:50%; width:8px; height:8px; margin-top:2px"></span>Última lectura</span>
        <span style="color:var(--susp); font-weight:700">✕ rechazado</span>
      </div>
    </div>
    ${CHART_DEFS.map((d) => `
      <div class="panel chart-block">
        <div class="panel-head"><h2>${esc(d.label)}</h2></div>
        <div class="panel-body"><div class="chart-scroll">${chartFor(d, r)}</div></div>
      </div>`).join("")}
    <div class="panel chart-block">
      <div class="panel-head"><h2>Resistencia @ ${db.plan.cs.age} días (psi) — puntos + Moving Average (línea oscura)</h2></div>
      <div class="panel-body"><div class="chart-scroll">${chartCS5(sets, r)}</div></div>
    </div>`;
}

/* ------------------------------------------------------------ Losas del tiro

   El detalle de lo que la banda del Control Center enseña resumido: cada losa
   con su avance y **qué camiones la sirvieron**, que es lo que hace falta
   cuando un número no cuadra y hay que ir al conduce.

   Se respeta aquí la misma regla que en el tablero: un camión que reparte su
   carga entre varias losas **no dice cuánto dejó en cada una**, así que su
   volumen no se reparte a ojo. Esas losas salen marcadas como compartidas y
   sus yardas se leen como un mínimo. */
function viewLosas() {
  const day = state.day && diasDelProyecto().includes(state.day) ? state.day : diasDelProyecto()[0];
  const L = losasDelDia(day);
  const p = dayProgress(day);
  const r = L.rango;
  const rows = testsOfDate(day).filter((t) => !t.rejected);
  /* Qué camiones tocaron cada losa. Del propio ensayo, no de una lista aparte. */
  const camiones = {};
  for (const t of rows) {
    for (const c of slabCodes(t.ident)) (camiones[c] = camiones[c] || []).push(t);
  }

  const cab = r
    ? `Tramo <b>${esc(r.carril)}-${r.desde.toFixed(3)} → ${r.hasta.toFixed(3)}</b> ·
       ${r.metros} m${r.estimadas ? ` · ≈${r.estimadas} losas` : ""}`
    : L.lista.length ? `<b>${L.lista.length}</b> losas declaradas` : "Sin losas declaradas";

  return `
    <div class="toolbar">
      <h2>Losas del vaciado</h2>
      <div class="spacer"></div>
      <select onchange="state.day=this.value; render()">
        ${diasDelProyecto().map((d) => `<option value="${d}" ${d === day ? "selected" : ""}>${fmtDate(d)}</option>`).join("")}
      </select>
    </div>

    <div class="panel"><div class="panel-body" style="font-size:13.5px">
      ${cab} · <b>${L.hechas}</b> vaciada${L.hechas === 1 ? "" : "s"} ·
      <b>${fmt(p.placed, 1)}</b> CY colocadas
      ${r ? `<div class="muted" style="margin-top:8px; font-size:12.5px">
        El tramo declara los dos extremos, no las losas de en medio: en este proyecto el paso entre
        losas va de 4 a 8 m y cambia dentro del mismo tiro, así que generarlas sería inventarlas.
        Las de abajo son las que <b>de verdad recibieron hormigón</b>, sacadas de los camiones.</div>` : ""}
    </div></div>

    ${L.fuera && L.fuera.length ? `<div class="panel" style="border-color:rgba(245,184,61,.45)">
      <div class="panel-body" style="font-size:13.5px; color:var(--act)">
        <b>Vaciadas fuera del tramo declarado:</b> ${L.fuera.map(esc).join(", ")}
      </div></div>` : ""}

    <div class="panel"><div class="panel-body flush">
      ${L.lista.length ? `<div class="table-wrap"><table class="data">
        <tr><th>Losa</th><th>Estado</th><th class="num">Yardas</th><th class="num">Plan</th>
            <th class="num">Cargas</th><th>Camiones (ticket · CY)</th></tr>
        ${L.lista.map((l) => {
          const est = l.estado === "vaciada" ? `<span class="badge ok">Vaciada</span>`
            : l.estado === "curso" ? `<span class="badge act">En curso</span>`
            : `<span class="badge">Pendiente</span>`;
          const cs = (camiones[l.codigo] || []);
          return `<tr>
            <td class="mono"><b>${esc(l.codigo)}</b></td>
            <td>${est}</td>
            <td class="num mono">${l.cargas ? `${l.compartida ? "≥ " : ""}${fmt(l.cy, 1)}` : "—"}</td>
            <td class="num mono">${l.cyPlan != null ? fmt(l.cyPlan, 0) : "—"}</td>
            <td class="num mono">${l.cargas || 0}</td>
            <td style="white-space:normal; min-width:220px; font-size:12px">
              ${cs.length ? cs.map((t) => `${esc(t.truck || "—")} · ${esc(t.ticket || "—")} · ${fmt(num(t.vol), 1)}`).join(" &nbsp;|&nbsp; ") : "—"}
            </td>
          </tr>`;
        }).join("")}
      </table></div>`
      : `<div class="empty" style="padding:26px; text-align:center; color:var(--ink-soft)">
           ${r ? "Ningún camión ha vaciado todavía. Las losas aparecen según llegan."
               : "Este día no tiene losas ni tramo declarados en el plan."}
         </div>`}
    </div></div>

    <div class="muted" style="font-size:12px; margin-top:10px">
      Un camión que reparte su carga entre varias losas no registra cuánto dejó en cada una: esas
      yardas se leen como un mínimo (≥) y no se reparten a ojo. Es la misma regla del tablero y
      del reporte.
    </div>`;
}

/* ------------------------------------------------------------ Sincronización

   El único sitio donde se configura el multi-aparato. La dirección del
   servidor y la llave del proyecto viven en este navegador y NO en el
   repositorio: el repositorio es público, y una llave dentro de él no es
   una llave. Cada aparato se configura una vez.

   Lo que se enseña aquí es estado, no instrucciones (§8a): si algo está
   mal se ve —«sin señal», «llave rechazada»— y se corrige. */
const QC_ESTADO_SYNC = {
  /* Los rótulos en inglés, las explicaciones en español: el rótulo es
     vocabulario de estado y se comparte con la barra (Q-34); la explicación
     la lee el técnico cuando algo va mal. */
  "apagado":    { t: "Not syncing", c: "var(--muted)", d: "Este aparato guarda solo lo suyo. Nadie más lo ve." },
  "conectando": { t: "Connecting…", c: "var(--act)",   d: "" },
  "al-dia":     { t: "Online",      c: "var(--ok)",    d: "Todo lo que pasa aquí lo ven los demás aparatos, y al revés." },
  "sin-senal":  { t: "No signal",   c: "var(--act)",   d: "Se sigue trabajando igual; lo entrado sube en cuanto vuelva la señal." },
  "sin-llave":  { t: "Key rejected", c: "var(--susp)", d: "El servidor no reconoce la llave del proyecto." },
};
function panelSync() {
  const e = QC_ESTADO_SYNC[QCSync.estado] || QC_ESTADO_SYNC.apagado;
  const pend = QCSync.pendientes;
  return `<div class="panel">
    <div class="panel-head"><h2>Sincronización</h2><div class="spacer"></div>
      <span style="font-weight:800; letter-spacing:.14em; text-transform:uppercase; font-size:12px; color:${e.c}">${e.t}</span>
      ${pend ? `<span class="muted" style="font-size:12px; margin-left:10px">${pend} sin subir</span>` : ""}
    </div>
    <div class="panel-body" style="font-size:13.5px">
      <p class="muted" style="margin:0 0 12px">${e.d}</p>
      <div class="grid cols-2" style="gap:12px">
        <label style="display:block">
          <span class="muted" style="font-size:11px; font-weight:800; letter-spacing:.2em; text-transform:uppercase">Servidor</span>
          <input id="sync-url" value="${esc(qcApiURL())}" placeholder="ej. https://qcheck-api.workers.dev"
            style="width:100%; margin-top:6px" spellcheck="false" autocapitalize="off">
        </label>
        <label style="display:block">
          <span class="muted" style="font-size:11px; font-weight:800; letter-spacing:.2em; text-transform:uppercase">Llave del proyecto</span>
          <input id="sync-token" value="${esc(qcApiToken())}" placeholder="sin llave"
            style="width:100%; margin-top:6px" spellcheck="false" autocapitalize="off">
        </label>
        <label style="display:block">
          <span class="muted" style="font-size:11px; font-weight:800; letter-spacing:.2em; text-transform:uppercase">Este aparato</span>
          <input id="sync-dev" value="${esc(qcAparato())}" style="width:100%; margin-top:6px">
        </label>
      </div>
      <div style="margin-top:14px; display:flex; gap:10px; align-items:center">
        <button class="btn small" onclick="guardarSync()">Guardar y conectar</button>
        <span id="sync-msg" class="muted" style="font-size:12.5px"></span>
      </div>
    </div>
  </div>`;
}
function guardarSync() {
  const url = document.getElementById("sync-url").value.trim().replace(/\/+$/, "");
  localStorage.setItem("qc-api", url);
  localStorage.setItem("qc-token", document.getElementById("sync-token").value.trim());
  localStorage.setItem("qc-dev", document.getElementById("sync-dev").value.trim() || qcAparato());
  const msg = document.getElementById("sync-msg");
  if (!url) { QCSync.estado = "apagado"; render(); return; }
  msg.textContent = "Probando…";
  fetch(url + "/api/salud")
    .then((r) => r.json())
    .then((s) => {
      msg.textContent = `Servidor al habla · ${s.cambios} cambios guardados`;
      QCSync.arrancar();
      setTimeout(render, 900);
    })
    .catch(() => { msg.textContent = "No contesta. Revise la dirección."; });
}

/* ------------------------------------------------------------ Plan & data */
function viewPlan() {
  if (!permiteConfig()) return "";
  const p = db.plan, pr = db.project;
  const enDemo = db.demo && db.demo === todayISO();
  return `
    ${enDemo ? `<div class="panel" style="border-color:rgba(245,184,61,.4)">
      <div class="panel-head"><h2>Simulación en curso</h2><div class="spacer"></div>
        <button class="btn small" onclick="if (reiniciarDemoPreguntando()) { render(); toast('Simulación reiniciada'); }">Reiniciar</button>
        <button class="btn small danger" onclick="apagarDemo(); render(); toast('Simulación apagada')">Apagar y empezar en blanco</button>
      </div>
      <div class="panel-body" style="font-size:13.5px" class="muted">
        El tiro de hoy es una <b>demostración</b>: se sembró al entrar para poder enseñar el
        sistema en marcha. Todo lo que se haga encima —recibir camiones, entrar muestras— es
        real y se guarda. <b>Apagar</b> borra el tiro simulado y deja el día en blanco para
        arrancar uno de verdad; los 397 ensayos históricos del proyecto no se tocan.
      </div>
    </div>` : ""}
    ${panelSync()}
    <div class="grid cols-2">
      <div class="panel">
        <div class="panel-head"><h2>Proyecto</h2><div class="spacer"></div>${
          (db.proyectos || []).length > 1 || (typeof qcVeConfig === "function" && qcVeConfig())
            ? `<button class="btn small" onclick="formObras()">Obras (${(db.proyectos || []).length})</button> ` : ""
        }<button class="btn small" onclick="formProject()">Editar</button></div>
        <div class="panel-body" style="font-size:14px">
          <p style="margin:4px 0"><b>${esc(pr.name)}</b></p>
          <p style="margin:4px 0" class="muted">Mezcla: ${esc(pr.mixId)}</p>
          <p style="margin:4px 0" class="muted">Contratista: ${esc(pr.contractor || "—")}${pr.concretera ? " · Concretera: " + esc(pr.concretera) : ""} · QC: ${esc(pr.qcFirm || "—")}</p>
          ${pr.estructuras ? `<p style="margin:4px 0" class="muted">Estructuras: ${esc(String(pr.estructuras).replace(/\n/g, " · "))}</p>` : ""}
          <p style="margin:4px 0" class="muted">Avisos de rechazo: ${esc(pr.notifyEmails || "— (configure emails)")}</p>
        </div>
      </div>
      ${panelLimites(true)}
      <div class="panel">
        <div class="panel-head"><h2>Exportar &amp; respaldo</h2></div>
        <div class="panel-body">
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" onclick="exportCSV()">⬇ CSV (todas las pruebas)</button>
            <button class="btn primary" onclick="backupJSON()">⬇ Respaldo (.json)</button>
            <label class="btn">⬆ Restaurar respaldo<input type="file" accept=".json" style="display:none" onchange="restoreJSON(this)"></label>
          </div>
          <p class="muted" style="font-size:12.5px">Los datos viven en este navegador. Descargue un respaldo al final de cada día de vaciado.</p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Zona de peligro</h2></div>
        <div class="panel-body">
          <button class="btn danger" onclick="resetSeed()">Restaurar historial original (borra cambios)</button>
          <p class="muted" style="font-size:12.5px">Vuelve a las ${QC_SEED.tests.length} pruebas importadas del Excel de Segarra (25 nov 2025 – 18 jul 2026).</p>
        </div>
      </div>
    </div>`;
}

/* ------------------------------------------------------------ backup / restore */
function backupJSON() {
  downloadFile(`qc-pr52-respaldo-${todayISO()}.json`, JSON.stringify(db, null, 1), "application/json");
  toast("Respaldo descargado");
}
function restoreJSON(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.tests) || !data.plan) throw new Error("No es un respaldo de QC");
      if (!confirm(`¿Restaurar respaldo con ${data.tests.length} pruebas? Reemplaza TODOS los datos actuales.`)) return;
      db = data; saveDB(); render(); toast("Respaldo restaurado");
    } catch (e) { alert("No se pudo restaurar: " + e.message); }
  };
  reader.readAsText(file);
  input.value = "";
}
function resetSeed() {
  if (!confirm("¿Restaurar el historial original del Excel? Se pierden los cambios hechos en la app.")) return;
  db = {
    version: 1,
    project: structuredClone(QC_SEED.project),
    plan: structuredClone(QC_SEED.plan),
    tests: structuredClone(QC_SEED.tests),
    dayMeta: db.dayMeta || {},
  };
  saveDB(); render(); toast("Historial restaurado");
}

/* ------------------------------------------------------------ meta forms */
/* `formProject()` se mudó a core.js — Q-90, 14 ago 2026.

   Vivía aquí, y `settings.html` la llamaba a través de `formObras()` sin cargar
   este archivo: «Abrir obra nueva» reventaba con un ReferenceError y la obra
   quedaba creada y MUDA, sin datos, sin 934 y sin límites — justo lo que Q-62
   existe para impedir. Nadie lo vio porque el error se lo tragaba el manejador
   del botón.

   Se va con sus tres hermanas —`formObras`, `formSP934`, `formPlan`—, por la
   misma razón que se movió `formObras` en Q-62: las cuatro se encadenan al
   crear una obra, así que las cuatro tienen que estar donde estén todas. */


/* `formObras()` vive en core.js desde Q-62: Settings también la necesita, y
   Settings no carga qc.js. */

/* ------------------------------------------------------------ boot */
document.getElementById("main-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-tab]");
  if (btn) switchTab(btn.dataset.tab);
});
loadDB();
initTheme();
mountThemeToggle();
pintarPestanas();                   // fuera «Plan & Datos» para quien no sea admin
enableLiveSync(() => render());
window.addEventListener("hashchange", () => { const t = tabFromHash(); if (t) switchTab(t, false); });
const inicial = tabFromHash();
if (inicial) state.tab = inicial;   // la pestaña se subraya abajo, tras pintar
/* Q-75: bajo el logo va el lema del producto, no la obra. Aquí la obra sí
   sigue estando a la vista — es el panel «Proyecto» de Plan & Datos y la
   cabecera de cada vista. */
document.getElementById("brand-subtitle").textContent = "Smart Building";
render();
mountStatusBar();
document.querySelectorAll("#main-tabs button")
  .forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
