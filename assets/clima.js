/* ============================================================
   CLIMA — el tiempo en el sitio del vaciado.

   Para el hormigón esto no es adorno: el sol y la lluvia de la
   próxima hora deciden si se tira o se espera.

   Los datos vienen de Open-Meteo (gratis, sin llave, con CORS).
   Es la ÚNICA parte de QCheck que sale a internet. Si no hay red
   —y en carretera pasa— la tarjeta lo dice y no inventa nada.
   ============================================================ */
"use strict";

/* PR-52 a la altura de la salida de la PR-199 (Las Cumbres), San Juan.
   Lo dijo Víctor el 30 jul 2026. Se puede corregir en Plan & Datos:
   el proyecto manda si trae lat/lon propias. */
const CLIMA_DEFECTO = { lat: 18.362, lon: -66.091, lugar: "San Juan · PR-52 / PR-199" };
const CLIMA_REFRESCO_MIN = 15;

/* Códigos WMO agrupados a lo que de verdad importa en obra */
function climaTipo(code) {
  if (code === 0) return "despejado";
  if (code === 1 || code === 2) return "parcial";
  if (code === 3) return "nublado";
  if (code === 45 || code === 48) return "niebla";
  if (code >= 51 && code <= 57) return "llovizna";
  if (code >= 61 && code <= 67) return "lluvia";
  if (code >= 80 && code <= 82) return "chubascos";
  if (code >= 95) return "tormenta";
  if (code >= 71 && code <= 86) return "nieve";
  return "nublado";
}
const CLIMA_TEXTO = {
  despejado: "Despejado", parcial: "Parcialmente nublado", nublado: "Nublado",
  niebla: "Neblina", llovizna: "Llovizna", lluvia: "Lluvia",
  chubascos: "Chubascos", tormenta: "Tormenta", nieve: "Nieve",
};
/* ¿este tipo moja el vaciado? */
function climaMoja(t) { return t === "llovizna" || t === "lluvia" || t === "chubascos" || t === "tormenta"; }

/* ------------------------------------------------------------ iconos
   SVG puro, animados con CSS. Nada de librerías ni de archivos:
   el proyecto tiene que abrir con doble clic.                    */
function climaIcono(tipo, dia, grande) {
  const c = grande ? "cl-ico cl-ico-g" : "cl-ico";
  const sol = dia
    ? `<g class="cl-sol"><circle cx="16" cy="16" r="6.4"/></g>
       <g class="cl-rayos"><path d="M16 3.4v3.1M16 25.5v3.1M3.4 16h3.1M25.5 16h3.1M7.1 7.1l2.2 2.2M22.7 22.7l2.2 2.2M24.9 7.1l-2.2 2.2M9.3 22.7l-2.2 2.2"/></g>`
    : `<path class="cl-luna" d="M25 20.4A9.6 9.6 0 0 1 13.1 8.5a9.6 9.6 0 1 0 11.9 11.9z"/>`;
  const nube = (cls, d) => `<path class="cl-nube ${cls}" d="${d}"/>`;
  const N1 = "M11.6 25.5a5.3 5.3 0 0 1 .5-10.5 7.4 7.4 0 0 1 14.1 2.1 4.2 4.2 0 0 1-.7 8.4z";
  const gotas = (n) => Array.from({ length: n }, (_, i) =>
    `<line class="cl-gota" style="animation-delay:${(i * .28).toFixed(2)}s" x1="${11 + i * 5.2}" y1="27" x2="${9.6 + i * 5.2}" y2="30.6"/>`).join("");

  let g = "";
  if (tipo === "despejado") g = sol;
  else if (tipo === "parcial") g = `<g class="cl-tras">${sol}</g>${nube("cl-drift", N1)}`;
  else if (tipo === "nublado") g = `${nube("cl-drift2 cl-tenue", "M8.4 22.6a4.4 4.4 0 0 1 .4-8.7 6.2 6.2 0 0 1 11.8 1.8 3.5 3.5 0 0 1-.6 7z")}${nube("cl-drift", N1)}`;
  else if (tipo === "niebla") g = `${nube("cl-drift", N1)}<g class="cl-niebla"><line x1="7" y1="28" x2="25" y2="28"/><line x1="9.5" y1="31" x2="27" y2="31"/></g>`;
  else if (tipo === "llovizna") g = `${nube("", N1)}${gotas(2)}`;
  else if (tipo === "lluvia" || tipo === "nieve") g = `${nube("", N1)}${gotas(3)}`;
  else if (tipo === "chubascos") g = `<g class="cl-tras">${sol}</g>${nube("cl-drift", N1)}${gotas(3)}`;
  else if (tipo === "tormenta") g = `${nube("", N1)}${gotas(2)}<path class="cl-rayo" d="M17.6 25l-3.4 5.6h3l-1.8 4.6 5-6.2h-3.1l1.9-4z"/>`;
  return `<svg class="${c}" viewBox="0 0 32 36" aria-hidden="true">${g}</svg>`;
}

/* ------------------------------------------------------------ datos */
async function climaConsultar(lat, lon) {
  const u = "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${lat}&longitude=${lon}`
    + "&current=temperature_2m,weather_code,is_day,apparent_temperature"
    + "&hourly=temperature_2m,weather_code,precipitation_probability,is_day"
    + "&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=2";
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(u, { signal: ctrl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    const ahoraISO = j.current.time;
    const i0 = Math.max(0, j.hourly.time.indexOf(ahoraISO.slice(0, 13) + ":00"));
    const horas = [];
    for (let i = i0 + 1; i < Math.min(i0 + 7, j.hourly.time.length); i++) {
      horas.push({
        iso: j.hourly.time[i],
        t: j.hourly.temperature_2m[i],
        tipo: climaTipo(j.hourly.weather_code[i]),
        pp: j.hourly.precipitation_probability[i],
        dia: j.hourly.is_day[i] === 1,   // de madrugada el icono lleva luna, no sol
      });
    }
    return {
      t: j.current.temperature_2m,
      sensacion: j.current.apparent_temperature,
      tipo: climaTipo(j.current.weather_code),
      dia: j.current.is_day === 1,
      horas,
    };
  } finally { clearTimeout(corte); }
}

/* ------------------------------------------------------------ pintado */
function climaHora(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const ampm = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  return h + ampm;
}

/* Lo que de verdad se pregunta el que va a tirar: ¿me va a llover encima? */
function climaAviso(c) {
  const pronto = c.horas.slice(0, 3);
  const moja = pronto.find((h) => climaMoja(h.tipo) && h.pp >= 50);
  if (moja) return { txt: `${CLIMA_TEXTO[moja.tipo]} hacia las ${climaHora(moja.iso)}m`, mojado: true };
  if (climaMoja(c.tipo)) return { txt: "Lloviendo ahora", mojado: true };
  const pico = pronto.reduce((a, h) => (h.pp > a ? h.pp : a), 0);
  if (pico >= 30) return { txt: `${pico}% de lluvia en las próximas horas`, mojado: false };
  return null;
}

function climaHTML(c, lugar) {
  const av = climaAviso(c);
  const tiras = c.horas.map((h) => `
    <div class="cl-h">
      <div class="cl-hh">${climaHora(h.iso)}</div>
      ${climaIcono(h.tipo, h.dia, false)}
      <div class="cl-ht">${Math.round(h.t)}°</div>
      <div class="cl-hp ${h.pp >= 30 ? "on" : ""}">${h.pp >= 20 ? h.pp + "%" : ""}</div>
    </div>`).join("");
  return `
    <div class="cl-top">
      ${climaIcono(c.tipo, c.dia, true)}
      <div class="cl-now">
        <div class="cl-t">${Math.round(c.t)}<span>°F</span></div>
        <div class="cl-d">${CLIMA_TEXTO[c.tipo]}</div>
      </div>
      <div class="cl-loc">${esc(lugar)}</div>
    </div>
    ${av ? `<div class="cl-av ${av.mojado ? "moja" : ""}">${esc(av.txt)}</div>` : ""}
    <div class="cl-horas">${tiras}</div>`;
}

/* ------------------------------------------------------------ montaje */
function montarClima(el, opciones) {
  if (!el) return;
  // Lo que el proyecto no declare se queda con el valor por defecto: un null
  // no debe borrar unas coordenadas buenas.
  const o = Object.assign({}, CLIMA_DEFECTO);
  for (const k in (opciones || {})) if (opciones[k] != null && opciones[k] !== "") o[k] = opciones[k];
  climaEstilos();
  el.classList.add("clima");

  const fresco = () => montarClima._ts && (Date.now() - montarClima._ts) < CLIMA_REFRESCO_MIN * 60000;

  const pintar = async (forzar) => {
    // El tablero se repinta con cada cambio de datos; el tiempo no cambia tan
    // rápido ni conviene machacar el servicio, así que se sirve de memoria.
    if (!forzar && fresco() && montarClima._datos) {
      el.innerHTML = climaHTML(montarClima._datos, o.lugar);
      return;
    }
    if (navigator.onLine === false) {
      el.innerHTML = `<div class="cl-vacio">Sin conexión — el tiempo no se pudo consultar.</div>`;
      return;
    }
    el.innerHTML = `<div class="cl-vacio cl-cargando">Consultando el tiempo…</div>`;
    try {
      const c = await climaConsultar(o.lat, o.lon);
      montarClima._datos = c; montarClima._ts = Date.now();
      el.innerHTML = climaHTML(c, o.lugar);
    } catch (e) {
      // Nunca se inventa el tiempo: si no llegó, se dice.
      el.innerHTML = `<div class="cl-vacio">No se pudo consultar el tiempo.
        <button type="button" class="cl-reint">Reintentar</button></div>`;
      const b = el.querySelector(".cl-reint");
      if (b) b.onclick = () => pintar(true);
    }
  };

  pintar();
  clearInterval(montarClima._t);
  montarClima._t = setInterval(() => { if (!document.hidden) pintar(true); }, CLIMA_REFRESCO_MIN * 60000);
  if (!montarClima._online) {
    montarClima._online = true;
    addEventListener("online", () => { const e = document.getElementById("clima"); if (e) montarClima(e, o); });
  }
  return pintar;
}

function climaEstilos() {
  if (document.getElementById("clima-css")) return;
  const s = document.createElement("style");
  s.id = "clima-css";
  s.textContent = `
.clima { display: flex; flex-direction: column; gap: 9px; min-width: 268px; }
.cl-top { display: flex; align-items: center; gap: 11px; }
.cl-ico { width: 30px; height: 34px; flex: none; overflow: visible;
  fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.cl-ico-g { width: 46px; height: 52px; stroke-width: 1.9; }
.cl-sol circle { fill: #ffd166; stroke: none; }
.cl-rayos path { stroke: #ffd166; stroke-width: 2.1; transform-origin: 16px 16px;
  animation: clGirar 26s linear infinite; }
.cl-sol { transform-origin: 16px 16px; animation: clLatir 3.6s ease-in-out infinite; }
.cl-luna { fill: #e8eefc; stroke: none; }
.cl-tras { opacity: .95; }
.cl-nube { fill: #dbe6f2; stroke: none; }
.cl-tenue { fill: #a9bccf; opacity: .55; }
.cl-drift  { animation: clDeriva 7s ease-in-out infinite; }
.cl-drift2 { animation: clDeriva 9s ease-in-out infinite reverse; }
.cl-gota { stroke: #7fc4ff; stroke-width: 2.3; animation: clCaer 1.15s linear infinite; }
.cl-rayo { fill: #ffd166; stroke: none; animation: clFogonazo 2.6s ease-in-out infinite; }
.cl-niebla line { stroke: #b9c8d8; stroke-width: 2.2; animation: clDeriva 5.5s ease-in-out infinite; }
@keyframes clGirar { to { transform: rotate(360deg); } }
@keyframes clLatir { 0%,100% { transform: scale(1); } 50% { transform: scale(1.07); } }
@keyframes clDeriva { 0%,100% { transform: translateX(-1.1px); } 50% { transform: translateX(1.1px); } }
@keyframes clCaer { 0% { opacity: 0; transform: translateY(-3px); }
                    22% { opacity: 1; } 78% { opacity: 1; }
                    100% { opacity: 0; transform: translateY(5px); } }
@keyframes clFogonazo { 0%,86%,100% { opacity: .6; } 89%,95% { opacity: 1; } 92% { opacity: .55; } }

.cl-now { line-height: 1; }
.cl-t { font-size: 30px; font-weight: 200; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.cl-t span { font-size: 13px; font-weight: 600; opacity: .55; margin-left: 1px; }
.cl-d { font-size: 11.5px; margin-top: 4px; opacity: .72; }
.cl-loc { margin-left: auto; text-align: right; font-size: 9.5px; font-weight: 800;
  letter-spacing: .1em; text-transform: uppercase; opacity: .5; max-width: 130px; line-height: 1.5; }
.cl-av { font-size: 11.5px; font-weight: 600; opacity: .8; }
.cl-av.moja { color: #7fc4ff; opacity: 1; }
.cl-horas { display: flex; gap: 2px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.12); }
.cl-h { flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.cl-hh { font-size: 9.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .5; }
.cl-ht { font-size: 12.5px; font-weight: 500; font-variant-numeric: tabular-nums; }
.cl-hp { font-size: 9.5px; font-weight: 700; opacity: 0; color: #7fc4ff; min-height: 12px; }
.cl-hp.on, .cl-hp:not(:empty) { opacity: .85; }
.cl-vacio { font-size: 11.5px; opacity: .6; padding: 6px 0; }
.cl-cargando { animation: clLatirTxt 1.4s ease-in-out infinite; }
@keyframes clLatirTxt { 0%,100% { opacity: .35; } 50% { opacity: .7; } }
.cl-reint { margin-left: 8px; background: none; border: 1px solid rgba(255,255,255,.25);
  color: inherit; font: inherit; font-size: 11px; padding: 2px 9px; border-radius: 7px; cursor: pointer; }
@media (prefers-reduced-motion: reduce) {
  .cl-rayos path, .cl-sol, .cl-drift, .cl-drift2, .cl-gota, .cl-rayo, .cl-niebla line, .cl-cargando { animation: none; }
}
@media (max-width: 720px) { .clima { min-width: 0; width: 100%; } }
@media print { .clima { display: none; } }
`;
  document.head.appendChild(s);
}
