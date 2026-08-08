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
  /* Los límites con fecha (Q-40). Al abrir una base vieja se crea la primera
     versión desde el ensayo más antiguo: nada se vuelve a juzgar. */
  migrarPlanes();
}

/* La simulación: si hoy no tiene ni un camión, se arranca con un tiro ya en
   marcha para que el sistema se pueda enseñar. Ver assets/demo.js. */
const QC_NUEVO_TIRO = "qc-nuevo-tiro";
/* La limpieza de la simulación vive AQUÍ y no en demo.js — Q-46, 7 ago 2026.

   Estaba en `demo.js`, detrás de `if (DEMO_ACTIVA) return false`. Eso quiere
   decir que un aparato con ese archivo cacheado de cuando la simulación
   estaba encendida NO LIMPIA NUNCA: se queda con sus camiones inventados para
   siempre, y como llevan `source: "demo"` tampoco viajan al servidor. Nadie
   más los ve y él no puede dejar de verlos.

   Fue justo lo que pasó: el Control Center de Rubén decía 197 yardas y el de
   Víctor 157, y el arreglo que puse en `demo.js` tampoco le llegaba, por la
   misma razón que el problema.

   `core.js` es otro archivo, con su propio sello de versión, y lo carga toda
   pantalla que hace algo. Aquí la limpieza corre pase lo que pase con demo.js.
   Se cura solo al abrir. */
function limpiarResiduoSimulacion() {
  if (!db || !Array.isArray(db.tests)) return false;
  const antes = db.tests.length;
  db.tests = db.tests.filter((t) => t.source !== "demo");
  let toco = db.tests.length !== antes;
  for (const [dia, m] of Object.entries(db.dayMeta || {})) {
    if (!m || m.source !== "demo") continue;
    /* SOLO se borra lo que sigue siendo la simulación tal cual la sembró.
       Si hay camiones de verdad detrás, o el plan ya no es el de la
       simulación, es que una persona lo tocó: entonces se le quita la marca
       —que es lo que estaba mal— y el día pasa a viajar.

       Borrar de más aquí sería peor que el fallo original: se llevaría por
       delante el tiro que alguien acaba de programar y todavía no tiene
       camiones, que es la mañana de cualquier vaciado. */
    const hayCamionReal = testsOfDate(dia).some((x) => x.source !== "demo");
    const planIntacto = num(m.cyPlan) === 260 && num(m.losasPlan) === 13;
    if (hayCamionReal || !planIntacto) {
      delete db.dayMeta[dia].source; toco = true; continue;
    }
    delete db.dayMeta[dia]; toco = true;
  }
  if (toco) {
    console.warn("QCheck: se retiraron " + (antes - db.tests.length) +
                 " ensayos de la simulación que quedaban en este aparato.");
    saveDB();
  }
  return toco;
}

function sembrarDia() {
  /* Primero limpiar, siempre. No depende de demo.js. */
  limpiarResiduoSimulacion();
  /* La simulación se retiró para la primera prueba real (`DEMO_ACTIVA` en
     demo.js). Además de no sembrar, limpia el aparato: cuando se apagó ya
     estaba dentro del iPad, de la PC y del teléfono, y cada uno guarda lo
     suyo. Ver `retirarSimulacion()`. */
  if (typeof retirarSimulacion === "function" && retirarSimulacion()) return;
  if (db.demo === false) return;                       // alguien la apagó
  if (typeof sembrarTiroDemo !== "function") return;   // pantalla sin demo.js

  /* Cada acceso arranca un tiro nuevo: quien entra se encuentra siempre el
     mismo punto de partida y no lo que dejó a medias la visita anterior.
     El acceso deja la marca —no puede sembrar él mismo, no carga el motor— y
     la recoge la primera pantalla que sí lo carga.

     Esto solo pisa HOY. El histórico del proyecto sigue entero, y si alguien
     programó un tiro de verdad la simulación está apagada y ya salimos arriba. */
  if (sessionStorage.getItem(QC_NUEVO_TIRO) === "1") {
    sessionStorage.removeItem(QC_NUEVO_TIRO);
    /* `reiniciarDemo()` se planta solo si hoy hay camiones de verdad: esto corre
       en CADA acceso y `sessionStorage` es de cada pestaña y cada aparato, así
       que abrir el Field Display en otra tableta a media mañana no puede
       llevarse por delante el trabajo del día. */
    if (typeof reiniciarDemo === "function") { reiniciarDemo(); return; }
  }
  if (sembrarTiroDemo(db)) saveDB();
}
/* Esquema v2: record por conduce (compañía + número), humedades, plan del día.

   Va separado de `db` a propósito: la sincronización necesita migrar una copia
   limpia de `seed.js` para saber cómo se ve el histórico "sin tocar", y si esto
   solo supiera trabajar sobre la base global, esa copia quedaría a medias y los
   397 ensayos se leerían como nuevos. Pasó en la primera prueba: 7.878 líneas
   de nada camino del servidor. Una sola migración, dos usos. */
function migrateDB() { migrarBase(db); }
function migrarBase(db) {
  if (!db.humidity) db.humidity = [];
  if (!db.dayMeta) db.dayMeta = {};
  if (!db.plan.humidityMaxHours) db.plan.humidityMaxHours = 3;
  for (const t of db.tests) {
    if (!t.company) t.company = plantCompany(t.plant);   // clave: compañía + conduce
    if (!t.source) t.source = "excel";                    // qr | ocr | manual | excel
    /* `id` es la llave que viaja entre aparatos; `n` no sirve, porque cada
       aparato lo reparte por su cuenta y dos sin señal darían el mismo.
       Los del Excel lo deducen de su número, así que sale idéntico en todas
       partes: vienen del mismo seed.js. Ver assets/sync.js. */
    if (!t.id && typeof qcIdDe === "function") qcIdDe(t, "t");
  }
  for (const h of db.humidity) if (!h.id && typeof qcIdDe === "function") qcIdDe(h, "h");
  db.version = 2;
}
/* La compañía sale de la planta cuando no viene declarada (histórico) */
function plantCompany(plant) {
  if (!plant) return "—";
  return /san juan|gurabo/i.test(plant) ? "Concre-Tech" : String(plant).replace(/^\d+\s*-\s*/, "");
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
function saveDB() {
  publishSpec();
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  /* La sincronización se cuelga aquí y de ningún otro sitio: mira qué
     cambió respecto a la última vez y encola las líneas del registro.
     Por eso ninguna de las once pantallas tuvo que cambiar nada — siguen
     mutando `db` y llamando a `saveDB()` como siempre. Ver assets/sync.js. */
  if (typeof QCSync !== "undefined") { try { QCSync.alGuardar(); } catch (e) { console.error(e); } }
}

/* Sincronización en vivo. Dos caminos, el mismo aviso:
   - Entre pestañas del mismo aparato, el evento `storage` del navegador.
   - Entre aparatos distintos, el registro de cambios (assets/sync.js).
   La pantalla no distingue: le llega `onChange()` y repinta. */
function enableLiveSync(onChange) {
  window.addEventListener("storage", (e) => {
    if (e.key === DB_KEY && e.newValue) {
      try { db = JSON.parse(e.newValue); if (!db.dayMeta) db.dayMeta = {}; onChange(); } catch (_) {}
    }
  });
  if (typeof QCSync !== "undefined") { QCSync.alCambiar(onChange); QCSync.arrancar(); }
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
  /* La casa de la cuenta manda — Q-51. El contratista, el concretero y la
     Autoridad tienen su tablero por casa (`casa:` en usuarios.js), y hasta
     ahora tanto la ✕ como el volver los mandaban a `movil.html`, que no es su
     sitio: es el portal de campo del equipo de QC. Se deducía de `rol`, y el
     papel de cada quien sale de las capacidades de la cuenta, nunca de otra
     cosa (AGENTS §3). */
  const propia = typeof qcCasa === "function" && qcCasa();
  if (propia) return propia;
  if (typeof qcEsQC === "function" && !qcEsQC()) return "movil.html";
  return esTelefono() ? "movil.html" : "control-center.html";
}

async function cerrarVentana() {
  const casa = casaDe();
  const salir = document.exitFullscreen || document.webkitExitFullscreen;
  if (salir && (document.fullscreenElement || document.webkitFullscreenElement)) {
    try { await salir.call(document); } catch (_) {}
  }
  /* **El botón de cerrar SIEMPRE lleva a casa. Nunca cierra la sesión.**

     Antes, desde la propia casa, sacaba de la sesión. Era una trampa: el mismo
     botón significaba «volver» en diez pantallas y «cerrar sesión» en una, y
     así es como uno se desloguea sin querer en mitad de un tiro y se encuentra
     la pantalla de acceso (Víctor, 1 ago 2026).

     Salir tiene ahora su propia puerta, escrita con todas las letras, en el
     menú del Control Center y en el pie del portal. */
  location.href = casa;
}

/* Salir de la sesión, que ya no se hace por descuido con la ✕.

   Desde Q-07 también se le dice al servidor, para que el pase deje de valer
   ahí y no solo en este navegador. Se avisa y no se espera: si no hay señal,
   salir tiene que salir igual —el pase caduca solo—, y dejar al técnico
   mirando una pantalla que no responde porque el servidor no contesta sería
   cambiar un problema por otro peor. */
function salirDeQCheck() {
  if (!confirm("¿Salir de QCheck?\n\nHabrá que entrar otra vez con usuario y clave.")) return;
  const pase = sessionStorage.getItem("qc-sesion");
  const api = (localStorage.getItem("qc-api") || "").replace(/\/+$/, "");
  if (pase && api) {
    const cab = { "Content-Type": "application/json", "X-QC-Sesion": pase };
    const tk = localStorage.getItem("qc-token");
    if (tk) cab["X-QC-Token"] = tk;
    try { fetch(api + "/api/sesion/salir", { method: "POST", headers: cab, keepalive: true }); } catch (_) {}
  }
  sessionStorage.removeItem("qc-auth");
  sessionStorage.removeItem("qc-user");
  sessionStorage.removeItem("qc-sesion");
  sessionStorage.removeItem("qc-ident");
  location.href = "index.html";
}
const ICONO_SALIR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3.5H19a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5h-4.5"/><path d="M9.5 16 5.5 12l4-4"/><path d="M5.5 12h9"/></svg>`;

/* NAVEGACIÓN DE VERDAD, NO UNA LISTA DE ATAJOS — Q-51, 7 de agosto de 2026.

   La cabecera llevaba «Results ↗ · Reportes ↗ · Field Display ↗»: tres links
   sueltos que no eran navegación sino tres destinos elegidos a dedo. No
   servían para volver, que es lo que uno necesita el 90% de las veces, y en
   cambio ocupaban el sitio donde la vista busca los controles.

   Se cambian por lo que hace un navegador: atrás, adelante, casa y cerrar.
   A los destinos se entra por los mosaicos del Control Center, que ya están.

   «Adelante» solo se enciende si de verdad hay algo delante. El navegador no
   lo dice, así que se mira el tipo de navegación de esta carga: si llegamos
   aquí con el botón de atrás hay historia por delante; si llegamos siguiendo
   un enlace, no la hay y se apaga. Un botón que no hace nada es peor que un
   botón ausente. */
function hayAdelante() {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav && nav.type === "back_forward") { sessionStorage.setItem("qc-fwd", "1"); return true; }
    if (nav && nav.type === "navigate") sessionStorage.removeItem("qc-fwd");
  } catch (_) {}
  return sessionStorage.getItem("qc-fwd") === "1";
}

const ICONO_NAV = {
  atras:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>`,
  adelante: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>`,
  casa:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10.6 12 4l8.5 6.6"/><path d="M5.6 9.4V19a1 1 0 0 0 1 1h10.8a1 1 0 0 0 1-1V9.4"/><path d="M9.8 20v-5.4h4.4V20"/></svg>`,
};

function navHTML() {
  const casa = casaDe();
  const enCasa = location.pathname.split("/").pop() === casa;
  const fwd = hayAdelante();
  return `<div class="qcs-nav" id="qcs-nav">
    <button class="qcs-b" onclick="history.back()" title="Atrás" aria-label="Atrás">${ICONO_NAV.atras}</button>
    <button class="qcs-b" onclick="sessionStorage.removeItem('qc-fwd'); history.forward()"
            title="Adelante" aria-label="Adelante"${fwd ? "" : " disabled"}>${ICONO_NAV.adelante}</button>
    ${enCasa ? "" : `<a class="qcs-b" href="${esc(casa)}" title="${casa === "movil.html" ? "Portal" : "Control Center"}"
            aria-label="Ir al inicio">${ICONO_NAV.casa}</a>`}
  </div>`;
}

function mountCloseButton() {
  if (document.getElementById("close-btn")) return;
  const casa = casaDe();
  /* En la propia casa no hay a dónde volver: el botón sobra y se queda fuera.
     Antes ahí era donde sacaba de la sesión. */
  if (location.pathname.split("/").pop() === casa) return;
  const b = document.createElement("button");
  b.id = "close-btn";
  b.className = "close-btn";
  b.title = casa === "movil.html" ? "Volver al portal" : "Volver al Control Center";
  b.setAttribute("aria-label", b.title);
  b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>`;
  b.onclick = (e) => { e.stopPropagation(); cerrarVentana(); };
  (document.getElementById("qc-status") || document.body).appendChild(b);
}

/* ------------------------------------------------------------ marca de una parte
   El contratista, la concretera y la Autoridad salen con su logo donde aparece
   su nombre. Los archivos los pone Víctor en `db.project.logos` — son marcas
   registradas de cada empresa y no se bajan de la web por nuestra cuenta.

   Mientras no haya archivo NO se deja un hueco: se dibuja un monograma con las
   iniciales, que se ve intencionado y no roto.                              */
function inicialesDe(nombre) {
  /* Se cae la forma jurídica siempre, y los conectores solo si van en
     minúscula: "Del Valle Group" da DVG —"Del" es parte del nombre—, mientras
     que "Autoridad de Carreteras y Transportación" da ACT. */
  const palabras = String(nombre || "").replace(/[^\wÁÉÍÓÚÑáéíóúñ\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((x) => x && !/^(inc|corp|corporation|llc|sp|s\.?p|srl|co)$/i.test(x))
    .filter((x) => !/^(de|del|la|el|los|las|y|e|and|of|the)$/.test(x));   // solo minúsculas
  if (!palabras.length) return "—";
  return palabras.slice(0, 3).map((x) => x[0].toUpperCase()).join("");
}

function logoDeParte(parte) {
  const l = (db.project && db.project.logos) || {};
  return l[parte] || "";
}

/* `parte` = contratista | concretera | autoridad | qc */
function marcaHTML(parte, nombre, clase) {
  const src = logoDeParte(parte);
  const n = esc(nombre || "");
  if (src) return `<img class="marca-parte ${clase || ""}" src="${esc(src)}" alt="${n}" title="${n}">`;
  return `<span class="marca-parte mono ${clase || ""}" title="${n}">${esc(inicialesDe(nombre))}</span>`;
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
  /* `diasDelProyecto()` y no `testDates()` — Q-46, 7 ago 2026.

     `testDates()` solo devuelve días CON CAMIONES. Con eso, programar un tiro
     no hacía nada visible: el día nuevo no tiene camiones todavía, así que
     ninguna pantalla saltaba a él y todas seguían enseñando el vaciado
     anterior. Rubén programó el tiro de hoy y el iPad de Víctor seguía
     diciendo 157/150 y «camión 123 aceptado», del 1 de agosto.

     Un tiro programado ES el tiro de hoy desde que se programa, con cero
     camiones o con veinte. */
  return diaPorDefecto();
}

function mountStatusBar(day, opciones) {
  const o = opciones || {};
  let bar = document.getElementById("qc-status");
  if (!bar) {
    inyectarEstilosStatus();
    bar = document.createElement("div");
    bar.id = "qc-status";
    bar.className = "qcs";
      /* El atajo al estado del sistema — Q-45, 7 ago 2026. Era un mosaico del
         Control Center del mismo tamaño que Recepción, y es una pantalla de
         mirar, no una puerta de trabajo. Aquí queda a mano desde CUALQUIER
         pantalla, que es donde de verdad se echa en falta: uno se pregunta
         «¿estarán conectados?» estando en Muestras, no en el Control Center.

         Pegado al indicador de conexión porque cuentan lo mismo: quién está y
         cómo va la señal. Y solo lo ve quien puede entrar. */
      const veSistema = typeof qcVeConfig === "function" && qcVeConfig();
      bar.innerHTML = `
      <a class="qcs-tiro" id="qcs-tiro" href="results.html#daily"></a>
      ${veSistema ? `<a class="qcs-sistema" href="estado.html" title="Estado del sistema — qué aparatos están conectados">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3.5" width="18" height="6" rx="1.6"/><rect x="3" y="14.5" width="18" height="6" rx="1.6"/><path d="M6.6 6.5h.01M6.6 17.5h.01"/></svg>
      </a>` : ""}
      ${navHTML()}
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

/* EN INGLÉS A PROPÓSITO (Q-34, 6 ago 2026). Los rótulos de estado del
   servidor van en inglés en toda la herramienta —aquí, en `qc.js` y en el
   portal— porque antes estaban a medias: `index.html` decía «Online» y dos
   líneas más abajo «Sin conexión», el mismo aparato y el mismo servidor con
   dos idiomas. Los comentarios y el resto de la interfaz siguen en español;
   lo que se unificó es el vocabulario de estado. Si añades un estado nuevo,
   ponlo en inglés y en los tres sitios.

   La barra dice la verdad sobre la sincronización, no sobre el WiFi.
   `navigator.onLine` solo sabe si hay red; llegó a decir «En línea» con el
   servidor caído y los cambios amontonándose sin subir. En obra eso es peor
   que no decir nada: el técnico sigue entrando muestras convencido de que
   la PC de Rubén las está viendo. */
function pintarConexion() {
  const el = document.getElementById("qcs-conn");
  if (!el) return;
  const red = navigator.onLine !== false;
  const s = typeof QCSync !== "undefined" ? QCSync.estado : "apagado";
  const pend = typeof QCSync !== "undefined" ? QCSync.pendientes : 0;
  /* Tres colores, y el del medio importa: **verde es SOLO cuando está en la
     red**. «Solo este aparato» salía en verde porque no es un error, y así se
     leía como que todo iba bien — justo el estado que ya despistó dos veces.
     No es un fallo, pero tampoco es lo normal: va en gris apagado, que es como
     se ve algo que está por hacer. */
  let clase = "", texto;
  if (!red) { clase = " off"; texto = "Offline"; }
  else if (s === "apagado") { clase = " solo"; texto = "This device only"; }
  else if (s === "al-dia") { texto = "Online"; }
  else if (s === "sin-llave") { clase = " off"; texto = "Key rejected"; }
  /* Los tres «no sube» se dicen distinto porque se arreglan distinto: la llave
     la cambia el administrador, la sesión la arregla el propio técnico
     volviendo a entrar, y el papel no lo arregla nadie desde aquí. Un «Sin
     señal» genérico manda al técnico a mirar el WiFi mientras sus muestras se
     amontonan por otra razón. */
  else if (s === "sin-sesion") { clase = " off"; texto = pend ? `Sign in again · ${pend} unsent` : "Sign in again"; }
  else if (s === "sin-permiso") { clase = " off"; texto = "No write access"; }
  /* Cuota del servidor agotada. Nada se pierde —lo pendiente sigue en cola y
     sube solo cuando el servidor vuelve—, pero hay que decirlo con su nombre:
     el WiFi está bien y no hay nada que revisar en la obra. */
  else if (s === "sin-cuota") { clase = " off"; texto = pend ? `Server limit · ${pend} unsent` : "Server limit reached"; }
  else if (s === "sin-senal") { clase = " off"; texto = pend ? `No signal · ${pend} unsent` : "No signal"; }
  else { clase = " solo"; texto = "Connecting…"; }
  el.className = "qcs-conn" + clase;
  el.title = s === "apagado" ? "This device keeps its own work. Nobody else sees it." : "";
  el.querySelector("span").textContent = texto;
}

/* La barra tiene que decir DE QUÉ TIRO habla — Q-50, 7 de agosto de 2026.

   Decía «Tiro 190 / 150 cy · 100%» tanto si eso era lo de hoy como si era lo
   del 18 de julio. Desde que la pantalla cae al último vaciado cuando hoy no
   hay nada (Q-47), esa etiqueta miente por omisión: se lee como la obra de
   ahora mismo. Con «Último tiro · 18 jul 2026» se sabe en un vistazo que lo
   que hay delante es historia, no la jornada. */
function pintarTiro(day) {
  const el = document.getElementById("qcs-tiro");
  if (!el) return;
  const d = day || diaActivo();
  const esHoy = d === todayISO();
  const p = dayProgress(d);
  const hayPlan = p.cyPlan != null && p.cyPlan > 0;
  const pct = hayPlan ? p.pct : 0;
  // Sin plan de yardas no se inventa un total: se muestra lo vaciado y ya.
  const llenos = hayPlan ? Math.round(pct / 100 * QCS_SEGMENTOS) : 0;
  let segs = "";
  for (let i = 0; i < QCS_SEGMENTOS; i++)
    segs += `<i class="${i < llenos ? "on" : ""}"></i>`;
  el.className = "qcs-tiro" + (hayPlan ? "" : " sin-plan") + (esHoy ? "" : " pasado");
  el.href = "results.html#daily";
  el.title = esHoy
    ? (hayPlan ? "Avance del tiro" : "Defina las yardas planificadas del día")
    : `Último vaciado — ${fmtDate(d)}. Hoy no hay tiro abierto.`;
  el.innerHTML = `
    <span class="qcs-lb">${esHoy ? "Tiro" : "Último tiro"}</span>
    ${esHoy ? "" : `<span class="qcs-fecha">${esc(fmtDate(d))}</span>`}
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
/* Los botones de navegación — Q-51. Mismo tamaño y mismo aire que la ✕, que
   es el cuarto del grupo: se leen como una sola pieza de mando. */
.qcs-nav { display: flex; align-items: center; gap: 2px; margin-left: auto; }
.qcs-b {
  display: inline-flex; align-items: center; justify-content: center;
  width: calc(26px * var(--qcs-e,1)); height: calc(26px * var(--qcs-e,1));
  border: 0; border-radius: 7px; background: transparent; cursor: pointer;
  color: rgba(238,242,246,.66); text-decoration: none; padding: 0;
}
.qcs-b svg { width: calc(16px * var(--qcs-e,1)); height: calc(16px * var(--qcs-e,1)); }
.qcs-b:hover { background: rgba(238,242,246,.10); color: rgba(238,242,246,.95); }
.qcs-b[disabled] { opacity: .26; cursor: default; }
.qcs-b[disabled]:hover { background: transparent; color: rgba(238,242,246,.66); }
/* La ✕ ya no necesita empujarse sola a la derecha: la lleva el grupo. */
.qcs-nav ~ .close-btn, .qcs-nav ~ .qcs-conn { margin-left: 0; }

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
/* El atajo al estado del sistema (Q-45). Cuando está, es él quien empuja hacia
   la derecha y la conexión lo sigue pegada. */
.qcs-sistema {
  display: flex; align-items: center; flex: none; margin-left: auto;
  color: rgba(238,242,246,.42); text-decoration: none;
  padding: calc(3px * var(--qcs-e,1)) calc(9px * var(--qcs-e,1)) calc(3px * var(--qcs-e,1)) 0;
  transition: color .18s ease;
}
.qcs-sistema svg { width: calc(15px * var(--qcs-e,1)); height: calc(15px * var(--qcs-e,1)); display: block; }
.qcs-sistema:hover { color: #eef2f6; }
.qcs-sistema:focus-visible { outline: 2px solid #4a63d8; outline-offset: 2px; border-radius: 3px; }
.qcs-sistema + .qcs-conn { margin-left: 0; }
.qcs-conn i { width: calc(6px * var(--qcs-e,1)); height: calc(6px * var(--qcs-e,1));
  border-radius: 50%; background: currentColor; box-shadow: 0 0 calc(7px * var(--qcs-e,1)) currentColor;
  animation: qcsLatir 1.9s ease-in-out infinite; }
.qcs-conn.off { color: #ff5a52; }
.qcs-conn.off i { animation: none; }
/* «Solo este aparato»: ni verde ni rojo. No está roto, pero tampoco está en la
   red — y el punto no late, porque no hay nada latiendo. */
.qcs-conn.solo { color: rgba(238,242,246,.45); }
.qcs-conn.solo i { animation: none; box-shadow: none; }
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
function fmt(n, dp = 1, min = 0) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: Math.min(min, dp), maximumFractionDigits: dp });
}

/* EL SLUMP SIEMPRE CON DOS DECIMALES — Q-49, 7 de agosto de 2026.

   `fmt` recorta los ceros de la derecha, así que un slump de 3" salía «3» y
   uno de 3½" salía «3.5». En una medida de campo eso no vale: 3.00 y 3.50
   dicen con qué precisión se midió, y en una columna de números leídos a toda
   prisa en obra, «3» y «3.5» no se alinean ni se comparan de un vistazo.

   Vale para el valor medido y para los límites del plan: si el reporte dice
   que la zona de acción es 3.00–5.00", el camión que sale 3.00 se lee contra
   ella sin traducir nada. Una sola función para que no vuelva a haber dos
   criterios. */
function fmtSlump(n) { return fmt(n, 2, 2); }
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
/* ------------------------------------------------------------ límites en el tiempo

   Q-40, 7 ago 2026. Hasta hoy los límites eran UNO: `db.plan`. Las cinco
   funciones de zona lo leían directo, así que cambiar el slump de acción en
   Settings volvía a juzgar los 397 ensayos desde noviembre de 2025. Un tiro
   que se firmó conforme podía aparecer rechazado meses después, sin que nadie
   tocara un dato — y el reporte que ya vio la Autoridad decía otra cosa.

   Para un expediente de control de calidad eso no es un detalle de interfaz:
   es que el récord cambia solo.

   AHORA LOS LÍMITES TIENEN FECHA. `db.planes` guarda las versiones en orden,
   cada una con el día desde el que manda. Un ensayo se juzga SIEMPRE con los
   límites que regían el día en que se midió.

     db.planes = [
       { desde: "2025-11-25", plan: {…}, autor: "importado" },
       { desde: "2026-08-07", plan: {…}, autor: "ruben"     },
     ]

   Y UN TIRO CERRADO PESA MÁS QUE TODO ESO. Al cerrarlo se le congela una copia
   del plan encima (`dayMeta[dia].plan`), y esa copia manda sobre cualquier
   versión posterior. Es la garantía dura: lo firmado no se mueve ni aunque
   alguien enrede con las fechas.

   `db.plan` sigue existiendo y es el plan VIGENTE. Todo lo que ya lo leía para
   hablar del presente —Settings, el contrato, la cabecera de las cartas del
   día— sigue funcionando igual. */

/* Al abrir una base vieja, la primera versión arranca en el ensayo más
   antiguo. Así la actualización NO cambia ni un veredicto: toda la historia
   se sigue juzgando exactamente con lo que se juzgaba ayer. */
function migrarPlanes() {
  if (Array.isArray(db.planes) && db.planes.length) return;
  const fechas = (db.tests || []).map((t) => t.date).filter(Boolean).sort();
  db.planes = [{
    desde: fechas[0] || "1970-01-01",
    plan: JSON.parse(JSON.stringify(db.plan)),
    autor: "importado",
    ts: new Date().toISOString(),
  }];
}

/* Los límites que regían un día concreto.
   Orden de mando: lo congelado al cerrar > la versión vigente ese día. */
function planDe(dia) {
  if (!dia) return db.plan;
  const meta = (db.dayMeta || {})[dia];
  if (meta && meta.plan) return meta.plan;          // tiro cerrado: intocable
  const vs = db.planes;
  if (!Array.isArray(vs) || !vs.length) return db.plan;
  let elegido = vs[0].plan;
  for (const v of vs) { if (v.desde <= dia) elegido = v.plan; else break; }
  return elegido;
}

/* ¿Este día se juzga con límites distintos de los de hoy? Se avisa en pantalla
   y en el reporte: si alguien compara dos documentos del mismo proyecto y ve
   umbrales distintos, tiene que encontrar la explicación ahí y no suponer un
   error. */
function planDistintoDelVigente(dia) {
  return JSON.stringify(planDe(dia)) !== JSON.stringify(db.plan);
}

/* La frase que lo explica, o cadena vacía si no hay nada que explicar. */
function notaDeLimites(dia) {
  if (!dia || !planDistintoDelVigente(dia)) return "";
  const cerrado = (db.dayMeta || {})[dia] && (db.dayMeta || {})[dia].plan;
  return cerrado
    ? "Juzgado con los límites congelados al cerrar este vaciado."
    : "Juzgado con los límites que regían este día, no con los vigentes hoy.";
}

/* Guardar límites nuevos. NUNCA se toca una versión anterior: se añade una que
   rige desde hoy. Si ya hay una de hoy se sustituye —son correcciones del
   mismo día, no historia— y así no se llena la lista de versiones a cada
   tecleo. */
function guardarPlan(nuevo, autor) {
  migrarPlanes();
  const hoy = todayISO();
  const copia = JSON.parse(JSON.stringify(nuevo));
  const ultima = db.planes[db.planes.length - 1];
  if (ultima && ultima.desde === hoy) {
    ultima.plan = copia; ultima.autor = autor || "?"; ultima.ts = new Date().toISOString();
  } else {
    db.planes.push({ desde: hoy, plan: copia, autor: autor || "?", ts: new Date().toISOString() });
  }
  db.plan = copia;          // el vigente
  saveDB();
}

function zoneSlump(t) { const p = planDe(t && t.date).slump; return zoneRange(num(t.slump), p.actLo, p.actHi, p.suspLo, p.suspHi); }
function zoneAir(t)   { const p = planDe(t && t.date).air;   return zoneRange(num(t.air),   p.actLo, p.actHi, p.suspLo, p.suspHi); }
function zoneUW(t) {
  const p = planDe(t && t.date).uw;
  const target = num(t.uwTarget) ?? p.target;
  return zoneRange(num(t.uw), target - p.act, target + p.act, target - p.susp, target + p.susp);
}
function zoneTemp(t) {
  const v = num(t.temp); if (v == null) return null;
  const tope = planDe(t && t.date).tempMax;
  if (v > tope) return "susp";
  if (v > tope - 3) return "act";
  return "ok";
}
function zoneCS5(v, dia) {
  if (v == null) return null;
  const p = planDe(dia).cs;
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
/* ¿Este camión tiene ya un veredicto que signifique algo? (Q-33)

   Hace falta desde que Muestras guarda lo que se va midiendo: un camión con
   solo la temperatura puesta NO puede enseñarse como «OK», porque nadie ha
   juzgado nada todavía.

   El corte es slump + Unit Weight, que es el mismo que la propia pantalla usa
   para dejar enviar (`ready`) y para marcar un camión como hecho en el
   selector. No se usa `resultsAt`, que sería lo natural, por un motivo
   comprobado: **ninguno de los 397 ensayos del Excel lo tiene**, y con esa
   regla el expediente entero pasaría a «a medias». */
function tieneVeredicto(t) {
  return num(t.slump) != null && num(t.uw) != null;
}
/* Algo medido, pero no lo suficiente para juzgar. */
function aMedias(t) {
  if (tieneVeredicto(t)) return false;
  return ["slump", "uw", "air", "temp"].some((k) => num(t[k]) != null);
}

function estadoBadge(t) {
  if (t.rejected) return `<span class="badge susp">RECHAZADO</span>`;
  /* Va DESPUÉS de rechazado a propósito: los cuatro ensayos del histórico que
     tienen lecturas sueltas están todos rechazados, así que ninguno cambia de
     aspecto por esto. Se comprobó uno a uno. */
  if (aMedias(t)) return `<span class="badge act">A MEDIAS</span>`;
  const w = worstZone(t);
  if (w === "susp") return `<span class="badge susp">FUERA DE LÍMITE</span>`;
  if (w === "act") return `<span class="badge act">ACCIÓN</span>`;
  if (w === "ok") return `<span class="badge ok">OK</span>`;
  return `<span class="badge neutral">—</span>`;
}
function zClass(z) { return z ? ` class="num z-${z}"` : ` class="num"`; }

/* ------------------------------------------------------------ derived */
/* Un registro retirado lleva `borrado: true` y deja de contar en todas partes,
   pero NO se saca del archivo: el registro de cambios es un expediente y un
   expediente del que se pueden hacer desaparecer renglones no vale nada. Se
   retira, que es otra cosa, y queda quién lo retiró y cuándo. Además así el
   retiro viaja a los demás aparatos como cualquier otro cambio — un borrado
   de verdad no tendría cómo. */
function vivos(lista) { return lista.filter((t) => !t.borrado); }
function sortedTests() { return vivos(db.tests).sort((a, b) => a.n - b.n); }
/* Los días que un tablero puede enseñar — Q-44, 7 ago 2026.

   `testDates()` devuelve los días que tienen camiones. Eso deja fuera HOY
   hasta que llega el primero, y en un día de vaciado eso es justo cuando más
   se mira el tablero: a las siete de la mañana, esperando.

   Aquí se añade hoy si el día está en marcha —hay tiro programado o el día
   está abierto—, para que aparezca en la lista desde el principio aunque
   todavía no haya nada que contar. */
function diasDelProyecto() {
  const conPlan = Object.entries(db.dayMeta || {})
    .filter(([, m]) => m && !m.borrado &&
                       (m.cyPlan != null || m.losas || m.losasPlan != null ||
                        m.horaInicio || m.cerradoA))
    .map(([d]) => d);
  return [...new Set([...testDates(), ...conPlan])].sort().reverse();
}

/* El día que se enseña cuando nadie ha elegido — Q-47.

   NO es simplemente el primero de la lista. Desde que se pueden programar
   tiros para otro día, el primero puede ser el de la semana que viene, y un
   tiro de mañana no debe secuestrar la pantalla de hoy: la obra trabaja hoy.

     · si hoy tiene algo —plan o camiones—, hoy
     · si no, el día más reciente que YA HAYA PASADO
     · un tiro futuro se ve eligiéndolo, no solo. */
function diaPorDefecto() {
  const hoy = todayISO();
  /* Un día que el propio programa señala como fantasma —plan, ni un camión, y
     ya pasado— no puede ser la pantalla de arranque. Se ve en su aviso y se
     alcanza eligiéndolo; presidir el Control Center con «0 / 260 CY» de un
     vaciado que nunca ocurrió es justo lo contrario de lo que hace falta. */
  const fantasma = new Set((typeof diasFantasma === "function" ? diasFantasma() : []).map((f) => f.dia));
  const dias = diasDelProyecto().filter((d) => !fantasma.has(d));
  if (dias.includes(hoy)) return hoy;
  return dias.find((d) => d <= hoy) || dias[0] || hoy;
}


function testDates() { return [...new Set(vivos(db.tests).map((t) => t.date))].sort().reverse(); }

/* Retira todo lo registrado en un día. Es lo que hace falta antes del primer
   tiro de verdad: durante las pruebas se reciben camiones que no son del
   proyecto, y arrancar la jornada con ellos dentro falsea el reporte. */
function retirarDia(day) {
  let n = 0;
  for (const t of db.tests) if (t.date === day && !t.borrado) { t.borrado = true; n++; }
  if (n) saveDB();
  return n;
}
function testsOfDate(d) { return sortedTests().filter((t) => t.date === d); }

/* EL CONDUCE CONTRA EL TIRO PROGRAMADO — Q-55, 8 de agosto de 2026.

   El vaciado lo coordina el ingeniero en QCheck: pone las yardas del día antes
   de que llegue el primer camión. El conduce trae impreso, en la columna
   «Ordenadas», lo que la concretera cree que va a despachar ese día.

   Si esos dos números no coinciden, alguien está pidiendo o entregando otra
   cosa: se cambió el pedido por teléfono y no se apuntó, se despachó contra
   otra orden, o el plan se tecleó mal. Cualquiera de las tres se arregla con
   una llamada — pero solo si se ve con el PRIMER camión y no al cerrar el día,
   cuando ya hay hormigón puesto.

   Se compara con margen de media yarda: los conduces redondean. */
function discrepanciaDeOrden(day) {
  const d = day || diaActivo();
  const plan = num((db.dayMeta[d] || {}).cyPlan);
  if (plan == null) return null;
  const dichas = new Set();
  for (const t of testsOfDate(d)) {
    const o = num(t.ordenadas);
    if (o != null && Math.abs(o - plan) > 0.5) dichas.add(o);
  }
  if (!dichas.size) return null;
  return { plan, conduces: [...dichas].sort((a, b) => a - b), dia: d };
}
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

/* El ciclo de un camión: de Batch a fin de descarga, en minutos.

   `tope` es lo que dura el día entero. Un ciclo no puede pasarse de ahí, y si
   se pasa, el registro está mal —no el camión—: en el Excel histórico hay horas
   mal transcritas (la #331 del 20 jun trae el batch a las 9:39 y la descarga a
   las 7:33, o sea antes) y `minutesBetween`, que cruza la medianoche a
   propósito, las convertía en ciclos de 21 h. Ese registro no se toca: es el
   expediente. Se devuelve null para que no ensucie ningún promedio ni estire
   ninguna gráfica, y quien lo llame puede contar cuántos quedaron fuera.
   El tope sale del propio día, no de una constante inventada. */
function cicloCamion(t, tope) {
  const c = minutesBetween(t.batch, t.end);
  if (c == null) return null;
  return tope != null && c > tope ? null : c;
}
/* Day-level production stats (producer / contractor KPIs). */
/* ------------------------------------------------------------ estadística de ensayos

   Lo que convierte una bitácora en un informe técnico. Un listado de lecturas
   dice qué salió; la desviación estándar dice **si la planta está bajo
   control**, que es la pregunta de fondo — y es como la juzga ACI 214.

   El coeficiente de variación solo se calcula si la media no es cero, y con
   menos de dos lecturas no hay desviación posible: en esos casos se devuelve
   `null` y la hoja escribe «—». Un cero ahí sería decir «variación ninguna»,
   que es exactamente lo contrario de «no se puede saber». */
function estadisticas(vals) {
  const v = vals.map(num).filter((x) => x != null);
  if (!v.length) return null;
  const n = v.length;
  const media = v.reduce((a, b) => a + b, 0) / n;
  /* Desviación de MUESTRA (n−1): estas lecturas son una muestra del vaciado,
     no la población entera. Es la que usa ACI 214. */
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1)) : null;
  return {
    n, media, sd,
    cv: sd != null && media !== 0 ? (sd / media) * 100 : null,
    min: Math.min(...v), max: Math.max(...v),
  };
}

/* Las cuatro propiedades del hormigón fresco, cada una con su estadística y
   cuántas lecturas cayeron fuera. La zona la juzga el mismo motor que pinta el
   tablero (`zoneSlump`, `zoneAir`…): la hoja firmada y la pantalla no pueden
   discrepar. */
const QC_PROPIEDADES = [
  { k: "slump", n: "Slump", u: "in", dp: 2, dpMin: 2, norma: "ASTM C143" },
  { k: "uw", n: "Unit Weight", u: "pcf", dp: 1, norma: "ASTM C138" },
  { k: "air", n: "Aire", u: "%", dp: 1, norma: "ASTM C231" },
  { k: "temp", n: "Temperatura", u: "°F", dp: 0, norma: "ASTM C1064" },
];
function estadisticasDia(day) {
  const rows = testsOfDate(day);
  return QC_PROPIEDADES.map((p) => {
    const est = estadisticas(rows.map((t) => t[p.k]));
    let accion = 0, susp = 0;
    for (const t of rows) {
      if (num(t[p.k]) == null) continue;
      /* Las funciones de zona reciben el ENSAYO entero, no el valor suelto: el
         Unit Weight se juzga contra el objetivo del propio camión (`uwTarget`),
         que cambia con la mezcla, y eso no se puede saber desde un número. */
      const z = p.k === "slump" ? zoneSlump(t)
        : p.k === "air" ? zoneAir(t)
        : p.k === "uw" ? zoneUW(t)
        : zoneTemp(t);
      if (z === "susp") susp++; else if (z === "act") accion++;
    }
    return { ...p, est, accion, susp };
  });
}

function dayStats(day) {
  const rows = testsOfDate(day);
  const cy = rows.reduce((a, t) => a + (num(t.vol) || 0), 0);
  const crudos = rows.map((t) => minutesBetween(t.batch, t.end)).filter((x) => x != null);
  const waits = rows.map((t) => minutesBetween(t.arrive, t.start)).filter((x) => x != null);
  const starts = rows.map((t) => t.start || t.arrive).filter(Boolean).sort();
  const ends = rows.map((t) => t.end || t.testTime).filter(Boolean).sort();
  let hours = null;
  if (starts.length && ends.length) {
    const span = minutesBetween(starts[0], ends[ends.length - 1]);
    if (span != null && span > 0) hours = span / 60;
  }
  /* Los ciclos imposibles se quedan fuera del promedio y se cuentan aparte,
     para poder decir cuántos fueron. Ver `cicloCamion()`. */
  const tope = hours != null ? Math.round(hours * 60) : null;
  const cycles = rows.map((t) => cicloCamion(t, tope)).filter((x) => x != null);
  return {
    rows, cy, loads: rows.length,
    rejected: rows.filter((t) => t.rejected).length,
    cyPerHr: hours ? cy / hours : null,
    loadsPerHr: hours ? rows.length / hours : null,
    avgCycle: cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null,
    maxCycle: cycles.length ? Math.max(...cycles) : null,
    cyclesFuera: crudos.length - cycles.length,
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

/* ------------------------------------------------------------ el reparto (Q-11)

   Un camión que reparte su carga entre varias losas no dice cuánto dejó en cada
   una, y ese volumen NO se reparte a ojo — la cifra sale como un mínimo (`≥`).
   Eso no es un caso raro: **de los 372 ensayos con losa del histórico, 161 son
   cargas repartidas.** El `≥` está en casi la mitad del expediente.

   La salida es que el técnico lo declare, y para eso se reusa la sintaxis que
   este proyecto YA tiene en el plan del día:

       L3-0.943:6, L3-0.936:4

   El número tras los dos puntos son las yardas que ese camión dejó en esa losa.
   Es opcional: sin él, la losa sigue contándose como compartida y con `≥`, que
   es lo de hoy. Reusar la sintaxis en vez de inventar un campo tiene dos
   ventajas: el técnico ya la conoce del plan, y **los 161 registros históricos
   —que vienen del Excel en prosa, «SLAB L1-2.487 and L1-2.482»— siguen leyéndose
   igual sin tocarlos.** No hay migración que hacer.

   Devuelve solo los códigos que declaran yardas. Un `ident` sin dos puntos
   devuelve un objeto vacío, y todo se comporta como antes de Q-11. */
function repartoDe(ident) {
  const out = {};
  if (!ident) return out;
  for (const m of String(ident).matchAll(/(L\s?\d+\s?-\s?\d+\.\d+)\s*:\s*(\d+(?:\.\d+)?)/gi)) {
    const cy = num(m[2]);
    if (cy != null) out[m[1].replace(/\s+/g, "").toUpperCase()] = cy;
  }
  return out;
}

/* Lo que el reparto declarado no cuadra con lo que trajo el camión.

   Devuelve `null` cuando no hay nada que decir: sin reparto declarado, con una
   sola losa, o sin volumen. Devuelve la diferencia cuando la hay — y no se
   corrige ni se normaliza sola. Un reparto que no suma es un dato mal entrado,
   y ajustarlo por detrás para que cuadre sería inventar en qué losa cayó la
   diferencia, que es justo lo que este proyecto no hace (DECISIONS §3). */
function descuadreDeReparto(t) {
  const rep = repartoDe(t.ident);
  const codigos = Object.keys(rep);
  if (!codigos.length) return null;
  const vol = num(t.vol);
  if (vol == null) return null;
  /* Solo se juzga si TODAS las losas del conduce declararon su parte. Con un
     reparto a medias no se sabe cuánto tocaba a las que callan. */
  if (codigos.length !== slabCodes(t.ident).length) return null;
  const suma = codigos.reduce((a, c) => a + rep[c], 0);
  const dif = suma - vol;
  /* Una décima de yarda es redondeo del papel, no un error que valga la pena
     cantar. Media yarda ya es medio metro cúbico sin sitio. */
  return Math.abs(dif) < 0.15 ? null : { suma, vol, dif };
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
/* ------------------------------------------------------------ el tramo del día

   En obra el plan no llega como una lista de losas: llega como un TRAMO,
   `L3-0.431@L3-0.252`. Y de ahí **no se pueden sacar los códigos de las losas
   que hay en medio.** En este proyecto el paso entre losas consecutivas va de
   4 a 8 metros y cambia dentro de un mismo tiro —está en los 397 ensayos del
   Excel, se puede comprobar—, así que generarlas sería inventar losas que no
   existen: ninguna cuadraría con la que trae el camión, el tablero enseñaría
   un plan lleno de losas que nunca se llenan y las de verdad saldrían como
   "fuera de plan". Justo al revés de lo que se busca.

   Así que el tramo se guarda como lo que es —los dos extremos— y las losas se
   descubren de los camiones, que sí traen el código bueno. Lo que el tramo SÍ
   permite, y es lo que vale: **cantar el camión que se vació fuera del tramo
   del día**. Eso antes no se podía ver. */
function rangoDeLosas(texto) {
  const m = String(texto || "").match(
    /^\s*(L\s?\d+)\s*-\s*(\d+\.\d+)\s*(?:@|→|->|\bto\b|\ba\b)\s*(?:L\s?\d+\s*-\s*)?(\d+\.\d+)\s*$/i);
  if (!m) return null;
  const desde = Number(m[2]), hasta = Number(m[3]);
  const paso = pasoTipicoLosa();
  const metros = Math.round(Math.abs(desde - hasta) * 1000);
  return {
    carril: m[1].replace(/\s+/g, "").toUpperCase(),
    desde, hasta, metros,
    /* Cuántas losas caben: es una ESTIMACIÓN y se enseña con «≈». Sale del paso
       típico del propio proyecto, no de un número escogido a dedo. */
    estimadas: paso ? Math.round(metros / paso) + 1 : null,
    paso,
  };
}

/* El paso típico entre losas, sacado del histórico del propio proyecto.
   Se descartan los saltos de más de 12 m: esos no son una losa más larga,
   son una losa que nadie muestreó en medio. Se calcula una vez. */
function pasoTipicoLosa() {
  if (pasoTipicoLosa._v !== undefined) return pasoTipicoLosa._v;
  const porCarril = {};
  for (const t of db.tests) {
    for (const c of slabCodes(t.ident)) {
      const m = c.match(/^(L\d+)-(\d+\.\d+)$/);
      if (m) (porCarril[m[1]] = porCarril[m[1]] || new Set()).add(Number(m[2]));
    }
  }
  const saltos = [];
  for (const s of Object.values(porCarril)) {
    const v = [...s].sort((a, b) => a - b);
    for (let i = 1; i < v.length; i++) {
      const d = Math.round((v[i] - v[i - 1]) * 1000);
      if (d >= 3 && d <= 12) saltos.push(d);
    }
  }
  if (!saltos.length) return (pasoTipicoLosa._v = null);
  saltos.sort((a, b) => a - b);
  return (pasoTipicoLosa._v = saltos[Math.floor(saltos.length / 2)]);
}

/* ¿Cae esta losa dentro del tramo del día? Los extremos cuentan, y el tramo
   puede ir de mayor a menor —que es como se tira— o al revés. */
function losaEnRango(codigo, r) {
  const m = String(codigo).match(/^(L\d+)-(\d+\.\d+)$/);
  if (!m || !r) return true;
  if (m[1] !== r.carril) return false;
  const v = Number(m[2]);
  return v >= Math.min(r.desde, r.hasta) - 1e-9 && v <= Math.max(r.desde, r.hasta) + 1e-9;
}

function losasDelDia(day) {
  const meta = db.dayMeta[day] || {};
  const texto = String(meta.losas || "");
  const rango = rangoDeLosas(texto);
  const dec = rango ? null : texto.match(/L\s?\d+\s?-\s?\d+\.\d+(?:\s*:\s*\d+(?:\.\d+)?)?/gi);
  if (!rango && !dec) return { lista: [], hechas: 0, rango: null, fuera: [] };

  const rows = testsOfDate(day).filter((t) => !t.rejected);

  const plan = [];
  const vistos = new Set();
  if (rango) {
    /* Con un tramo, el plan lo escriben los camiones: se toma cada código que
       llegó y cae dentro, en el orden en que se tira. Sin yardas por losa,
       porque el tramo no las declara y repartirlas a ojo sería inventarlas. */
    const dentro = new Set();
    for (const t of rows) for (const c of slabCodes(t.ident)) if (losaEnRango(c, rango)) dentro.add(c);
    const orden = [...dentro].sort((a, b) => {
      const va = Number(a.split("-")[1]), vb = Number(b.split("-")[1]);
      return rango.desde >= rango.hasta ? vb - va : va - vb;
    });
    for (const codigo of orden) { vistos.add(codigo); plan.push({ codigo, cyPlan: null }); }
  } else {
    for (const x of dec) {
      const [c, cy] = x.split(":");
      const codigo = c.replace(/\s+/g, "").toUpperCase();
      if (vistos.has(codigo)) continue;
      vistos.add(codigo);
      plan.push({ codigo, cyPlan: cy == null ? null : num(cy.trim()) });
    }
  }

  const estado = {}, cy = {}, cargas = {}, compartida = {};
  for (const t of rows) {
    const cs = slabCodes(t.ident);
    const sola = cs.length === 1;
    /* Q-11: si el conduce declara cuánto dejó en cada losa, se atribuye eso.
       Una carga repartida deja de ser un `≥` en cuanto alguien dice el reparto;
       la que no lo diga sigue contándose como compartida, exactamente como
       antes. Las dos formas conviven en el mismo día sin estorbarse. */
    const rep = repartoDe(t.ident);
    for (const c of cs) {
      cargas[c] = (cargas[c] || 0) + 1;
      if (rep[c] != null) cy[c] = (cy[c] || 0) + rep[c];
      else if (sola) cy[c] = (cy[c] || 0) + (num(t.vol) || 0);
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
  /* Las losas que recibieron hormigón y NO están en el plan del día. Con un
     tramo declarado esto es una comprobación de verdad: un camión vaciado
     fuera del tramo es un error que hoy nadie ve hasta que se cierra el lote. */
  const fuera = [...new Set(rows.flatMap((t) => slabCodes(t.ident)))].filter((c) => !vistos.has(c));

  return { lista, hechas: lista.filter((l) => l.estado === "vaciada").length, rango, fuera };
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

/* ¿Alguien cerró el tiro a mano? Es la hora a la que se dio por terminado.

   Hace falta porque **el sistema no puede deducirlo**: un tiro puede acabar en
   120 de 150 yardas porque se acabó el hormigón, cayó un aguacero o se decidió
   parar, y desde fuera eso no se distingue de una pausa larga. Lo dice quien
   está allí. Lo demás del estado sí se deduce de los camiones. */
function tiroCerrado(day) {
  const m = db.dayMeta[day || todayISO()];
  return (m && m.cerradoA) || null;
}

/* ¿Se puede tocar este día? — Q-41.

   Mientras el tiro está abierto, cualquiera que lleve el control de calidad
   escribe. En cuanto se cierra, el día queda firmado: solo el ingeniero de
   récord puede corregirlo o reabrirlo.

   Devuelve `true` si se puede, o el motivo si no. Quien llama enseña el motivo
   en vez de un «no se puede» pelado. */
function puedeEditarDia(day) {
  const d = day || todayISO();
  if (!tiroCerrado(d)) return true;
  if (typeof qcFirma === "function" && qcFirma()) return true;
  const m = db.dayMeta[d] || {};
  return "El vaciado del " + fmtDate(d) + " está cerrado" +
    (m.cerradoPor ? " por " + m.cerradoPor : "") +
    ". Solo el ingeniero de récord puede corregirlo.";
}

/* Aviso y freno de una sola línea, para usar antes de escribir. */
function frenoDiaCerrado(day) {
  const r = puedeEditarDia(day);
  if (r === true) return false;
  alert(r);
  return true;
}

function estadoTiro(day) {
  const p = dayProgress(day);
  const completo = p.cyPlan != null && p.cyPlan > 0 && p.placed >= p.cyPlan;
  const cerradoA = tiroCerrado(day);

  /* Cerrado a mano manda sobre todo lo demás: si el técnico dijo que terminó,
     la pantalla no va a discutírselo porque falten yardas del plan. */
  /* Un día que no es hoy es, por definición, el último vaciado que hubo: la
     pantalla llegó aquí porque hoy no hay tiro abierto. Se dice con todas las
     letras y con su fecha — Q-50. */
  if (day !== todayISO())
    return { cls: "fin", icono: "check",
             txt: (completo || p.loads ? "Último tiro" : "Sin actividad") + ` · ${fmtDate(day)}` };

  if (cerradoA) return { cls: "fin", icono: "check", txt: `Tiro cerrado · ${cerradoA}` };
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

/* ------------------------------------------------------------ vaciados fantasma

   Q-46, 7 ago 2026. Un día puede quedar en el expediente con su PLAN puesto y
   sin un solo camión. Eso pasa por dos motivos, y uno es grave:

     · alguien programó el tiro y todavía no ha llegado nadie  → normal, es hoy
     · quedó el rastro de una simulación                       → basura firmada

   El 31 de julio de 2026 el expediente compartido tenía un plan de 260 yardas
   y 13 losas sin un solo camión detrás: son las cifras exactas de la
   simulación. Su plan viajó a todos los aparatos; la marca que lo delataba
   (`source: "demo"`) NO, porque la sincronización la excluye a propósito. Una
   vez ahí, ningún aparato puede distinguirlo de un vaciado de verdad y la
   limpieza automática no lo ve, porque solo borra lo que lleva la marca.

   Esta función los saca a la luz. No borra nada —§«nada se borra»— pero deja
   de ser invisible, que era lo único que hacía falta para que nadie lo notara
   durante días. */
function diasFantasma() {
  const hoy = todayISO();
  const fuera = [];
  for (const [dia, m] of Object.entries(db.dayMeta || {})) {
    if (!m || dia >= hoy) continue;                 // hoy con plan y sin camiones es normal
    if (m.borrado) continue;                        // ya se descartó: el aviso está atendido
    const tienePlan = m.cyPlan != null || m.losasPlan != null || m.losas;
    if (!tienePlan) continue;
    if (testsOfDate(dia).length) continue;          // tiene camiones: es real
    fuera.push({
      dia,
      cyPlan: num(m.cyPlan),
      losasPlan: num(m.losasPlan),
      /* La simulación siempre planifica lo mismo. Si cuadra, se puede decir
         de dónde salió en vez de dejar al que lo lea adivinando. */
      esSimulacion: num(m.cyPlan) === 260 && num(m.losasPlan) === 13,
    });
  }
  return fuera.sort((a, b) => a.dia.localeCompare(b.dia));
}

function dayProgress(day) {
  const meta = db.dayMeta[day] || {};
  const rows = testsOfDate(day);
  const recibido = rows.filter((t) => !t.rejected).reduce((a, t) => a + (num(t.vol) || 0), 0);
  /* Un camión que llegó y no ha terminado de descargar todavía no ha colocado
     nada: sus yardas van aparte.

     Esto vale mientras el tiro está ABIERTO. En un tiro terminado no queda
     nadie descargando, así que **lo recibido es lo colocado** — es la misma
     regla que ya se aplicaba a los días pasados, donde 95 de los registros
     históricos vienen del Excel sin hora de fin.

     Faltaba aplicarla al día de hoy una vez cerrado, y se notó: el 1 ago 2026
     el tiro acabó con 157 yardas y el tablero decía 147, porque a un camión no
     se le llegó a marcar «Termina vaciado». Diez yardas que no estaban en
     ningún sitio. Al cerrar el tiro aparecen — y la confirmación de cierre
     avisa de cuántos camiones quedan sin descarga cerrada, para que nadie las
     dé por buenas sin saberlo. */
  const abierto = day === todayISO() && !tiroCerrado(day);
  const enCurso = abierto
    ? rows.filter((t) => !t.rejected && t.arrive && !t.end).reduce((a, t) => a + (num(t.vol) || 0), 0)
    : 0;
  const placed = recibido - enCurso;
  const cyPlan = num(meta.cyPlan);
  /* Hay dos formas de declarar las losas del día y NO pueden contradecirse:
     la lista con sus códigos (`losas`, la que llena QC) y el simple conteo
     (`losasPlan`, lo único que sabe el contratista desde su pantalla). Si hay
     lista, manda la lista — contarla es exacto y el número escrito a mano se
     queda viejo en cuanto alguien añade una losa. El reporte ya lo hacía así. */
  /* Con LISTA declarada, contarla es exacto y manda sobre el número a mano.
     Con TRAMO no se puede contar —las losas se descubren según llegan, así que
     contarlas daría siempre el 100 %—: vale el número que declararon y, si no
     lo declararon, la estimación del tramo, que se enseña con «≈». */
  const L = losasDelDia(day);
  const losasPlan = L.rango
    ? (num(meta.losasPlan) || L.rango.estimadas)
    : (L.lista.length || num(meta.losasPlan));
  const losasPlanEstim = !!(L.rango && !num(meta.losasPlan) && L.rango.estimadas);
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
    losasPlan, losasDone, losasPlanEstim, rango: L.rango, losasFuera: L.fuera,
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

  // --- Regla del agua: Unit Weight bajando + slump subiendo ---
  if (uw.length >= 6 && sl.length >= 6) {
    const dUW = avg(uw.slice(-3).map((t) => num(t.uw))) - avg(uw.slice(-6, -3).map((t) => num(t.uw)));
    const dSL = avg(sl.slice(-3).map((t) => num(t.slump))) - avg(sl.slice(-6, -3).map((t) => num(t.slump)));
    if (dUW <= -0.8 && dSL >= 0.4) {
      out.push({
        level: "susp", icon: "💧", title: "Posible exceso de agua",
        text: `Unit Weight bajó ${fmt(Math.abs(dUW), 1)} pcf mientras el slump subió ${fmtSlump(dSL)}" en las últimas 3 pruebas.`,
        action: "Avisar a la planta: verificar humedades de los agregados.",
      });
    } else if (dUW >= 0.8 && dSL <= -0.4) {
      out.push({
        level: "act", icon: "🧱", title: "Mezcla secándose",
        text: `Unit Weight subió ${fmt(dUW, 1)} pcf y el slump bajó ${fmtSlump(Math.abs(dSL))}".`,
        action: "Verificar dosificación de agua y humedades en planta.",
      });
    }
  }

  // --- Tendencia sostenida de Unit Weight hacia un límite ---
  if (uw.length >= 4) {
    const last = uw.slice(-4).map((t) => num(t.uw));
    const target = num(uw[uw.length - 1].uwTarget) ?? db.plan.uw.target;
    const drift = last[last.length - 1] - last[0];
    const dist = Math.abs(last[last.length - 1] - target);
    const monotonic = last.every((v, i) => i === 0 || v <= last[i - 1]) ||
                      last.every((v, i) => i === 0 || v >= last[i - 1]);
    if (monotonic && Math.abs(drift) >= 1.0 && dist > db.plan.uw.act * 0.6) {
      out.push({
        level: "act", icon: "📉", title: `Unit Weight se está yendo ${drift < 0 ? "hacia abajo" : "hacia arriba"}`,
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

  /* --- El calor va subiendo hacia el límite (Q-08) ---

     El hormigón que llega caliente fragua antes de tiempo y pierde resistencia,
     y en agosto en Puerto Rico la temperatura sube sola con la mañana. Lo que
     falta no es saber que un camión se pasó —eso ya lo pinta la zona— sino
     verlo venir mientras todavía se puede hacer algo: adelantar el tiro, pedir
     hielo, parar.

     **El umbral no se inventa: es el del plan.** `zoneTemp()` ya dice cuándo un
     camión entra en zona de acción (`tempMax - 3`) y cuándo se pasa. Aquí solo
     se añade la dirección: que además esté SUBIENDO. Un día que ronda el límite
     sin moverse no necesita que nadie avise cada media hora. */
  const tp = rows.filter((t) => num(t.temp) != null);
  if (tp.length >= 3) {
    const ultimo = tp[tp.length - 1];
    const zona = zoneTemp(ultimo);
    if (zona === "act" || zona === "susp") {
      const v = num(ultimo.temp);
      const antes = avg(tp.slice(0, -1).map((t) => num(t.temp)));
      /* Medio grado sobre la media del día ya es tendencia; por debajo de eso
         es el ruido del propio termómetro. */
      if (antes != null && v - antes >= 0.5) {
        const pasado = zona === "susp";
        /* El vaciado abierto y el cerrado piden cosas distintas. En uno todavía
           se puede adelantar el tiro o pedir hielo; en el otro ya solo queda el
           expediente, y decirle a alguien que «adelante los tiros que queden»
           sobre un vaciado de julio es ruido. El aviso es el mismo hallazgo; lo
           que cambia es qué se hace con él.

           El icono NO es 🌡: ese ya lo lleva la humedad vencida, y dos avisos
           distintos con el mismo símbolo se confunden de un vistazo. */
        const abierto = day === todayISO() && !tiroCerrado(day);
        out.push({
          level: pasado ? "susp" : "act", icon: "☀",
          title: pasado ? "Temperatura sobre el límite y subiendo" : "La temperatura va subiendo",
          text: `El camión ${ultimo.truck || ultimo.ticket || "—"} llegó a ${fmt(v, 0)} °F`
            + ` — ${fmt(v - antes, 1)} °F sobre la media del día. El límite son ${db.plan.tempMax} °F.`,
          action: abierto
            ? (pasado
              ? "Decidir sobre esta carga y avisar a la planta antes del próximo camión."
              : "Adelantar los tiros que queden o pedir a la planta que enfríe la mezcla.")
            : (pasado
              ? "Queda en el expediente: esta carga entró por encima del límite de temperatura."
              : "Queda en el expediente: el día cerró con la temperatura subiendo hacia el límite."),
        });
      }
    }
  }

  /* --- Un camión que no va a llegar a tiempo (Q-08) ---

     Un camión tiene `maxElapsedMin` desde que sale de planta hasta que termina
     de descargar. Hoy se sabe cuál se pasó — cuando ya se pasó y no hay nada
     que hacer. Lo útil es el que todavía viene.

     **El umbral sale del propio día, no de un número inventado** (DECISIONS §4):
     se compara el tiempo que le queda contra lo que está tardando en descargar
     un camión HOY, en esta obra, con esta cuadrilla. Un día de descargas de 12
     minutos avisa más tarde que uno de descargas de 25, y así debe ser.

     Sin ningún camión terminado todavía no hay con qué comparar, y entonces no
     se avisa: inventar una duración de descarga sería justo lo que no se hace.

     Solo aplica a HOY. En un día pasado todos los camiones ya terminaron, y
     «ahora» no significa nada. */
  if (day === todayISO()) {
    const descargas = rows
      .map((t) => minutesBetween(t.arrive, t.end))
      .filter((m) => m != null && m > 0)
      .sort((a, b) => a - b);
    const tipica = descargas.length ? descargas[Math.floor(descargas.length / 2)] : null;
    if (tipica != null) {
      for (const t of rows) {
        if (!t.batch || t.end) continue;               // ya terminó, o no salió de planta
        const lleva = minutosDesde(t.batch);
        if (lleva == null) continue;
        const quedan = db.plan.maxElapsedMin - lleva;
        if (quedan >= tipica) continue;                // le da tiempo de sobra
        const cual = t.truck || t.ticket || "—";
        out.push(quedan < 0 ? {
          level: "susp", icon: "⏱", title: `El camión ${cual} pasó del tiempo`,
          text: `Salió de planta a las ${t.batch} — lleva ${fmt(lleva, 0)} min y el límite son ${db.plan.maxElapsedMin}.`,
          action: "Decidir sobre esta carga: pasado el límite el hormigón ya no cumple.",
        } : {
          level: "act", icon: "⏱", title: `El camión ${cual} va justo`,
          text: `Salió de planta a las ${t.batch}, van ${fmt(lleva, 0)} min. Le quedan ${fmt(quedan, 0)}`
            + ` y hoy se está tardando ${fmt(tipica, 0)} min en descargar.`,
          action: "Darle paso antes que a los demás, o avisar a la planta.",
        });
      }
    }
  }

  /* --- El reparto de una carga no cuadra (Q-11) ---
     Se canta y no se corrige. Ajustar la diferencia por detrás para que sume
     sería decidir en qué losa cayó ese hormigón, y eso no lo sabe nadie desde
     aquí. Quien lo sabe es el chofer, y todavía está en la obra. */
  for (const t of rows) {
    const d = descuadreDeReparto(t);
    if (!d) continue;
    out.push({
      level: "act", icon: "🧱",
      title: `El reparto del camión ${t.truck || t.ticket || "—"} no cuadra`,
      text: `Las losas suman ${fmt(d.suma, 1)} CY y el conduce trae ${fmt(d.vol, 1)} CY`
        + ` — ${d.dif > 0 ? "sobran" : "faltan"} ${fmt(Math.abs(d.dif), 1)} CY.`,
      action: "Corregir el reparto en Recepción antes de que se vaya el chofer.",
    });
  }

  return out;
}

/* Etiqueta de tendencia para las gráficas live (lo que Rubén realmente mira) */
function trendLabel(day, key) {
  const rows = testsOfDate(day).filter((t) => !t.rejected && num(t[key]) != null);
  if (rows.length < 4) return "";
  const v = rows.map((t) => num(t[key]));
  const d = (v.slice(-2).reduce((a, b) => a + b, 0) / 2) - (v.slice(-4, -2).reduce((a, b) => a + b, 0) / 2);
  if (Math.abs(d) < (key === "uw" ? 0.3 : 0.15)) return "▬ estable";
  const txt = key === "slump" ? fmtSlump(Math.abs(d)) : fmt(Math.abs(d), key === "uw" ? 1 : 2);
  return (d > 0 ? "▲ subiendo " : "▼ bajando ") + txt + (key === "uw" ? " pcf" : '"');
}

/* ------------------------------------------------------------ charts */
const CHART_DEFS = [
  { key: "slump", label: 'Slump (in)', get: (t) => num(t.slump), dp: 2, dpMin: 2 },
  { key: "air", label: "Aire (%)", get: (t) => num(t.air), dp: 1 },
  { key: "uw", label: "Unit Weight (pcf)", get: (t) => num(t.uw), dp: 1 },
  { key: "temp", label: "Temperatura (°F)", get: (t) => num(t.temp), dp: 0 },
];
function bandsFor(key, dia) {
  const p = planDe(dia);
  if (key === "slump") return { target: p.slump.target, actLo: p.slump.actLo, actHi: p.slump.actHi, suspLo: p.slump.suspLo, suspHi: p.slump.suspHi };
  if (key === "air") return { target: p.air.target, actLo: p.air.actLo, actHi: p.air.actHi, suspLo: p.air.suspLo, suspHi: p.air.suspHi };
  if (key === "uw") return { target: p.uw.target, actLo: p.uw.target - p.uw.act, actHi: p.uw.target + p.uw.act, suspLo: p.uw.target - p.uw.susp, suspHi: p.uw.target + p.uw.susp };
  if (key === "temp") return { target: null, actLo: null, actHi: p.tempMax - 3, suspLo: null, suspHi: p.tempMax };
  return {};
}

/* ------------------------------------------------------------ pista de gráficas

   Q-35, 6 ago 2026. Las cartas tenían `<title>`, que es el globito nativo del
   navegador, y solo en los puntos que se dibujan — los rechazados, los fuera
   de zona y el último. Un punto dentro de límites no se dibujaba y no había
   nada donde posar el cursor: la carta enseñaba la forma y se guardaba la
   cifra. Y `<title>` tarda casi un segundo en salir y **en el iPad no sale
   nunca**, que es justo donde se trabaja.

   Lo que hay ahora es una capa de lectura: un rectángulo transparente por
   punto, de arriba abajo de la carta, y una sola pista flotante compartida
   por toda la herramienta. En el iPad se toca y se puede arrastrar el dedo
   por la carta leyendo punto por punto.

   Los puntos se siguen dibujando igual —solo los que importan— porque la
   carta se lee de un vistazo por su forma, no por sus veintitantos círculos.
   Lo que cambia es que ahora se puede preguntar.

   Para engancharla desde otra carta: emite `pistaPunto()` por cada punto y
   mete `pistaCursor()` dentro del mismo `<svg>`. No hay que registrar nada:
   el oyente está puesto en `document` una sola vez y va por delegación, así
   que sobrevive a que la carta se vuelva a pintar entera. */

function pistaPunto({ x, y, w, alto, cx, cy, valor, detalle, estado }) {
  return `<rect class="ch-hit" x="${x}" y="${y}" width="${w}" height="${alto}" fill="transparent"` +
    ` data-qcp="${esc(valor)}" data-qcd="${esc(detalle)}"` +
    (estado ? ` data-qce="${esc(estado)}"` : "") +
    ` data-qcx="${cx}" data-qcy="${cy}"/>`;
}

function pistaCursor(y1, y2) {
  return `<g class="ch-cur" opacity="0" pointer-events="none">
    <line class="ch-cur-l" y1="${y1}" y2="${y2}" stroke="var(--ink-soft)" stroke-width="1" stroke-dasharray="3 3"/>
    <circle class="ch-cur-p" r="5" fill="none" stroke="var(--info)" stroke-width="2"/>
  </g>`;
}

function pistaGrafica() {
  if (pistaGrafica.puesta || typeof document === "undefined" || !document.body) return;
  pistaGrafica.puesta = true;
  const caja = document.createElement("div");
  caja.className = "ch-pista";
  document.body.appendChild(caja);
  let svgVivo = null;

  function apagarCursor() {
    if (!svgVivo) return;
    const c = svgVivo.querySelector(".ch-cur");
    if (c) c.setAttribute("opacity", "0");
    svgVivo = null;
  }
  function ocultar() { caja.classList.remove("on"); apagarCursor(); }

  function mostrar(hit, mx, my) {
    /* getAttribute devuelve el texto ya descodificado, así que vuelve a
       escaparse antes de pintarlo. Un ticket con comillas no rompe nada. */
    const est = hit.getAttribute("data-qce");
    caja.innerHTML =
      `<b>${esc(hit.getAttribute("data-qcp"))}</b>` +
      `<span>${esc(hit.getAttribute("data-qcd"))}</span>` +
      (est ? `<i>${esc(est)}</i>` : "");
    caja.classList.add("on");

    /* Se coloca arriba a la derecha del dedo, y se voltea si no cabe: en el
       iPad la mano tapa justo lo que se quiere leer. */
    const r = caja.getBoundingClientRect();
    let px = mx + 16, py = my - r.height - 16;
    if (px + r.width > innerWidth - 8) px = mx - r.width - 16;
    if (px < 8) px = 8;
    if (py < 8) py = my + 22;
    caja.style.left = Math.round(px) + "px";
    caja.style.top = Math.round(py) + "px";

    const svg = hit.ownerSVGElement;
    if (svg !== svgVivo) apagarCursor();
    svgVivo = svg;
    const cur = svg && svg.querySelector(".ch-cur");
    if (!cur) return;
    const cx = hit.getAttribute("data-qcx"), cy = hit.getAttribute("data-qcy");
    const li = cur.querySelector(".ch-cur-l"), pt = cur.querySelector(".ch-cur-p");
    if (li) { li.setAttribute("x1", cx); li.setAttribute("x2", cx); }
    if (pt) { pt.setAttribute("cx", cx); pt.setAttribute("cy", cy); }
    cur.setAttribute("opacity", "1");
  }

  function tocar(e) {
    const hit = e.target && e.target.closest ? e.target.closest(".ch-hit") : null;
    if (hit) mostrar(hit, e.clientX, e.clientY);
    else ocultar();
  }
  addEventListener("pointermove", tocar, { passive: true });
  addEventListener("pointerdown", tocar, { passive: true });
  addEventListener("pointercancel", ocultar, { passive: true });
  /* Al rodar la página la pista se queda flotando donde ya no hay punto. */
  addEventListener("scroll", ocultar, { passive: true, capture: true });
}

if (typeof document !== "undefined") {
  if (document.body) pistaGrafica();
  else addEventListener("DOMContentLoaded", pistaGrafica);
}

function svgChart({ pts, bands, dp, dpMin = 0, yUnit = "", pw = 13, h = 230 }) {
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
    <filter id="${uid}f" x="-120%" y="-120%" width="340%" height="340%">
      <feGaussianBlur stdDeviation="2.6"/>
    </filter>
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
  g += umbral(bands.suspHi, "var(--susp)", .5, fmt(bands.suspHi, dp, dpMin));
  g += umbral(bands.suspLo, "var(--susp)", .5, fmt(bands.suspLo, dp, dpMin));
  g += umbral(bands.actHi, "var(--act)", .42, fmt(bands.actHi, dp, dpMin));
  g += umbral(bands.actLo, "var(--act)", .42, fmt(bands.actLo, dp, dpMin));
  if (dentro(bands.target)) g += `
    <line x1="${ML}" x2="${W - MR}" y1="${Y(bands.target)}" y2="${Y(bands.target)}"
          stroke="var(--chart-target)" stroke-width="1" stroke-dasharray="2 4" opacity=".38"/>
    <text x="${ML - 7}" y="${Y(bands.target) + 3.2}" text-anchor="end" font-size="9.5"
          fill="var(--chart-text)" opacity=".9">${fmt(bands.target, dp, dpMin)}</text>`;

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
    const t = `<title>#${p.n} · ${esc(p.date)} · ticket ${esc(p.ticket || "—")} · ${fmt(p.v, dp, dpMin)}${yUnit}${p.rejected ? " · RECHAZADO" : ""}</title>`;
    if (p.rejected)
      g += `<g>${t}<path d="M${X(i) - 3.6},${Y(p.v) - 3.6} l7.2,7.2 M${X(i) + 3.6},${Y(p.v) - 3.6} l-7.2,7.2"
            stroke="var(--susp)" stroke-width="2.1" stroke-linecap="round"/></g>`;
    else if (ult)
      g += `<g class="ch-live">${t}
        <circle cx="${X(i)}" cy="${Y(p.v)}" r="6.2" fill="var(--chart-glow, #5b9dff)"
                filter="url(#${uid}f)" class="ch-glow"/>
        <circle cx="${X(i)}" cy="${Y(p.v)}" r="3.6" fill="${col}" stroke="var(--bg)" stroke-width="1.6" class="ch-dot"/>
      </g>`;
    else
      g += `<circle cx="${X(i)}" cy="${Y(p.v)}" r="2.8" fill="${col}"
            stroke="var(--bg)" stroke-width="1">${t}</circle>`;
  });

  /* valor actual, como la cotización de cierre */
  const u = pts[pts.length - 1];
  const uCol = u.rejected || u.z === "susp" ? "var(--susp)" : u.z === "act" ? "var(--act)" : "var(--chart-line, #5b8dbf)";
  g += `<text x="${X(pts.length - 1) + 8}" y="${Y(u.v) + 4}" font-size="12" font-weight="700" fill="${uCol}">${fmt(u.v, dp, dpMin)}</text>`;

  /* La capa de lectura va la última: tiene que quedar por encima de todo
     para recibir el cursor, y como es transparente no tapa nada. */
  g += pistaCursor(MT, H - MB);
  pts.forEach((p, i) => {
    const est = p.rejected ? "Rechazado"
      : p.z === "susp" ? "Fuera de límite de suspensión"
      : p.z === "act" ? "Zona de acción" : "";
    g += pistaPunto({
      x: X(i) - PW / 2, y: MT, w: PW, alto: H - MT - MB,
      cx: X(i), cy: Y(p.v),
      valor: fmt(p.v, dp, dpMin) + yUnit,
      detalle: `#${p.n} · ${p.date} · ticket ${p.ticket || "—"}`,
      estado: est,
    });
  });

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block">${g}</svg>`;
}

function chartFor(def, rangeN) {
  const tests = sortedTests().filter((t) => def.get(t) != null);
  const slice = rangeN === "all" ? tests : tests.slice(-rangeN);
  const zfn = def.key === "slump" ? zoneSlump : def.key === "air" ? zoneAir : def.key === "uw" ? zoneUW : zoneTemp;
  const pts = slice.map((t) => ({ n: t.n, date: t.date, ticket: t.ticket, v: def.get(t), z: zfn(t), rejected: t.rejected }));
  /* Carta de rango largo: los límites del día del último punto (Q-40). */
  return svgChart({ pts, bands: bandsFor(def.key, slice.length ? slice[slice.length - 1].date : null), dp: def.dp, dpMin: def.dpMin });
}
function chartForDay(def, day, pw = 30) {
  const tests = testsOfDate(day).filter((t) => def.get(t) != null);
  const zfn = def.key === "slump" ? zoneSlump : def.key === "air" ? zoneAir : def.key === "uw" ? zoneUW : zoneTemp;
  const pts = tests.map((t) => ({ n: t.n, date: t.date, ticket: t.ticket, v: def.get(t), z: zfn(t), rejected: t.rejected }));
  return svgChart({ pts, bands: bandsFor(def.key, day), dp: def.dp, dpMin: def.dpMin, pw });
}
function chartCS5(sets, rangeN) {
  const p = planDe(sets.length ? sets[sets.length - 1].date : null).cs;
  const withCS = sets.filter((s) => s.cs5 != null);
  const slice = rangeN === "all" ? withCS : withCS.slice(-rangeN);
  if (!slice.length) return `<div class="empty">Sin resultados de resistencia.</div>`;
  const pts = slice.map((s) => ({ n: s.n, date: s.date, ticket: s.ticket, v: s.cs5, z: zoneCS5(s.cs5, s.date), rejected: false, ma: s._ma5 }));
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


/* ------------------------------------------------------------ límites SPC

   Los límites del plan de control y su editor, compartidos — Q-37, 6 ago 2026.
   Vivían dentro de la pestaña «Plan & Datos» de Results, que es de admin. Al
   darle a Rubén su pantalla de Settings hacían falta en dos sitios, y dos
   copias de una tabla de límites es exactamente como se llega a que la
   herramienta juzgue con un límite y el reporte imprima otro.

   `panelLimites()` no calcula nada: enseña `db.plan` tal cual. Quien decide
   las zonas sigue siendo el motor de siempre. */

function panelLimites(editable) {
  const p = db.plan;
  return `<div class="panel">
    <div class="panel-head"><h2>Plan de control (límites SPC)</h2><div class="spacer"></div>
      ${editable ? `<button class="btn small" onclick="formPlan()">Editar</button>` : ""}</div>
    <div class="panel-body flush"><div class="table-wrap"><table class="data">
      <tr><th>Parámetro</th><th class="num">Objetivo</th><th class="num">Acción</th><th class="num">Suspensión</th></tr>
      <tr><td>Slump (in)</td><td class="num mono">${fmtSlump(p.slump.target)}</td><td class="num mono">${fmtSlump(p.slump.actLo)} – ${fmtSlump(p.slump.actHi)}</td><td class="num mono">${fmtSlump(p.slump.suspLo)} – ${fmtSlump(p.slump.suspHi)}</td></tr>
      <tr><td>Aire (%)</td><td class="num mono">${p.air.target}</td><td class="num mono">${p.air.actLo} – ${p.air.actHi}</td><td class="num mono">${p.air.suspLo} – ${p.air.suspHi}</td></tr>
      <tr><td>Unit Weight (pcf)</td><td class="num mono">${p.uw.target}</td><td class="num mono">± ${p.uw.act}</td><td class="num mono">± ${p.uw.susp}</td></tr>
      <tr><td>Temperatura (°F)</td><td class="num mono">—</td><td class="num mono">&gt; ${p.tempMax - 3}</td><td class="num mono">&gt; ${p.tempMax}</td></tr>
      <tr><td>Resistencia @ ${p.cs.age}d (psi)</td><td class="num mono">${fmt(p.cs.target, 0)}</td><td class="num mono">&lt; ${fmt(p.cs.target, 0)}</td><td class="num mono">&lt; ${fmt(p.cs.action, 0)}</td></tr>
      <tr><td>Apertura al tráfico (psi)</td><td class="num mono">${fmt(p.cs.openTarget, 0)}</td><td class="num mono" colspan="2">mínimo ${fmt(p.cs.openLow, 0)}</td></tr>
      <tr><td>Batch → descarga (min)</td><td class="num mono">—</td><td class="num mono" colspan="2">máx ${p.maxElapsedMin}</td></tr>
    </table></div></div>
  </div>`;
}

function formPlan(alGuardar) {
  const p = db.plan;
  openForm({
    title: "Plan de control — límites SPC",
    initial: {
      sT: p.slump.target, sAL: p.slump.actLo, sAH: p.slump.actHi, sSL: p.slump.suspLo, sSH: p.slump.suspHi,
      aT: p.air.target, aAL: p.air.actLo, aAH: p.air.actHi, aSL: p.air.suspLo, aSH: p.air.suspHi,
      uT: p.uw.target, uA: p.uw.act, uS: p.uw.susp,
      tMax: p.tempMax, cT: p.cs.target, cAge: p.cs.age, cA: p.cs.action, cOT: p.cs.openTarget, cOL: p.cs.openLow,
      maW: p.maWindow, elMax: p.maxElapsedMin,
    },
    fields: [
      { type: "label", label: "Slump (in)" },
      { key: "sT", label: "Objetivo", type: "number", step: "0.25" },
      { key: "sAL", label: "Acción mín", type: "number", step: "0.25" },
      { key: "sAH", label: "Acción máx", type: "number", step: "0.25" },
      { key: "sSL", label: "Suspensión mín", type: "number", step: "0.25" },
      { key: "sSH", label: "Suspensión máx", type: "number", step: "0.25" },
      { type: "label", label: "Aire (%)" },
      { key: "aT", label: "Objetivo", type: "number", step: "0.1" },
      { key: "aAL", label: "Acción mín", type: "number", step: "0.1" },
      { key: "aAH", label: "Acción máx", type: "number", step: "0.1" },
      { key: "aSL", label: "Suspensión mín", type: "number", step: "0.1" },
      { key: "aSH", label: "Suspensión máx", type: "number", step: "0.1" },
      { type: "label", label: "Unit Weight (pcf)" },
      { key: "uT", label: "Objetivo", type: "number", step: "0.1" },
      { key: "uA", label: "Acción ±", type: "number", step: "0.1" },
      { key: "uS", label: "Suspensión ±", type: "number", step: "0.1" },
      { type: "label", label: "Temperatura y descarga" },
      { key: "tMax", label: "Temp máx (°F)", type: "number", step: "1" },
      { key: "elMax", label: "Batch→descarga máx (min)", type: "number", step: "5" },
      { type: "label", label: "Resistencia (psi)" },
      { key: "cT", label: "Objetivo f'c", type: "number", step: "50" },
      { key: "cAge", label: "Edad (días)", type: "number", step: "1" },
      { key: "cA", label: "Límite acción (susp. si <)", type: "number", step: "50" },
      { key: "cOT", label: "Apertura tráfico objetivo", type: "number", step: "50" },
      { key: "cOL", label: "Apertura tráfico mínimo", type: "number", step: "50" },
      { key: "maW", label: "Ventana Moving Average", type: "number", step: "1" },
    ],
    onSave: (v) => {
      /* Q-40: se AÑADE una versión que rige desde hoy. Lo ya vaciado se sigue
         juzgando con los límites que tenía el día en que se midió, y un tiro
         cerrado ni se entera: lleva su propia copia congelada. */
      const quien = typeof qcCuenta === "function" ? qcCuenta() : null;
      guardarPlan({
        slump: { target: v.sT, actLo: v.sAL, actHi: v.sAH, suspLo: v.sSL, suspHi: v.sSH },
        air: { target: v.aT, actLo: v.aAL, actHi: v.aAH, suspLo: v.aSL, suspHi: v.aSH },
        uw: { target: v.uT, act: v.uA, susp: v.uS },
        tempMax: v.tMax, maxElapsedMin: v.elMax,
        cs: { target: v.cT, age: v.cAge, action: v.cA, openTarget: v.cOT, openLow: v.cOL },
        maWindow: v.maW,
      }, (quien && (quien.nombre || quien.usr)) || sessionStorage.getItem("qc-user") || "?");
      /* Results repinta con `render()`; Settings con lo suyo. Se pasa qué
         hacer en vez de llamar a `render()` a ciegas, que solo existe en
         Results y dejaba la pantalla de Settings sin refrescar. */
      if (typeof alGuardar === "function") alGuardar();
      else if (typeof render === "function") render();
      toast("Plan de control actualizado");
    },
  });
}


/* ------------------------------------------------------------ reporte escrito

   Q-38, 6 ago 2026. Los tres tableros enseñaban indicadores en pantalla y no
   había forma de llevárselos: el contratista que quiere el número del día en
   una reunión, o la Autoridad que necesita el papel, tenían que hacer una foto
   a la pantalla. Ahora cada tablero imprime lo suyo escrito.

   ESCRITO, NO UNA CAPTURA. Las cartas no se imprimen: una carta de control en
   blanco y negro y sin poder pasar el cursor por encima no dice nada. Lo que
   se imprime son las cifras que hay detrás, que es lo que se lee en una
   reunión y lo que se archiva.

   NO CALCULA NADA. Todo sale de `dayProgress()`, `estadisticasDia()`,
   `losasDelDia()`, los mismos que pintan la pantalla. Si
   aquí sale un número distinto del que se ve, es un fallo, no un criterio
   nuevo. Y un día sin lecturas lo dice: no se rellena con ceros (§3).

   Va en `core.js` y no en cada tablero a propósito. Tres copias de un reporte
   es como se llega a que el contratista y la Autoridad reciban dos papeles
   distintos del mismo día. */

function qcFilaEstadistica(e) {
  if (!e.est) return `<tr><td>${esc(e.n)}</td><td colspan="6" class="qc-sin">sin lecturas este día</td></tr>`;
  const s = e.est;
  return `<tr>
    <td>${esc(e.n)} <span class="qc-un">(${esc(e.u)})</span><div class="qc-norma">${esc(e.norma)}</div></td>
    <td class="n">${s.n}</td>
    <td class="n">${fmt(s.media, e.dp)}</td>
    <td class="n">${fmt(s.min, e.dp)}</td>
    <td class="n">${fmt(s.max, e.dp)}</td>
    <td class="n">${s.sd != null ? fmt(s.sd, e.dp) : "—"}</td>
    <td class="n">${e.accion || e.susp
      ? `${e.susp ? e.susp + " susp." : ""}${e.susp && e.accion ? " · " : ""}${e.accion ? e.accion + " acción" : ""}`
      : "todas dentro"}</td>
  </tr>`;
}

function reporteEscritoDelDia(day, quien) {
  const pr = db.project, pl = db.plan;
  const p = dayProgress(day);
  const filas = testsOfDate(day);
  const est = estadisticasDia(day);
  const abierto = day === todayISO() && !tiroCerrado(day);
  const ahora = new Date();

  if (!filas.length) {
    return `<article class="qc-reporte">
      <h1>${esc(pr.name)}</h1>
      <p class="qc-sub">${esc(quien)} · vaciado del ${esc(day)}</p>
      <p class="qc-sin" style="margin-top:26px">
        No hay ningún camión registrado en este día. No se imprime un reporte de un vaciado
        que no ocurrió.</p>
    </article>`;
  }

  const cel = (t, k, dp, dpMin = 0) => num(t[k]) != null ? fmt(num(t[k]), dp, dpMin) : "—";

  return `<article class="qc-reporte">
    <header class="qc-rep-cab">
      <div>
        <h1>${esc(pr.name)}</h1>
        <p class="qc-sub">Mezcla ${esc(pr.mixId)} · Contratista ${esc(pr.contractor || "—")} · QC ${esc(pr.qcFirm || "—")}</p>
      </div>
      <div class="qc-rep-sello">
        <div class="qc-rep-para">${esc(quien)}</div>
        <div>Vaciado del <b>${esc(day)}</b></div>
        <div class="qc-sin">Impreso ${esc(ahora.toLocaleString("es-PR"))}</div>
      </div>
    </header>

    <h2>El tiro</h2>
    <p class="qc-estado-tiro">${abierto
      ? "Tiro <b>ABIERTO</b> en el momento de imprimir: las cifras de abajo son las de este instante y pueden cambiar antes de que termine el día."
      : "Tiro <b>cerrado</b>. Las cifras son definitivas."}</p>
    <table class="qc-rep-tabla qc-rep-pares">
      <tr><td>Yardas colocadas</td><td class="n"><b>${fmt(p.placed, 1)} cy</b>${p.cyPlan ? ` de ${fmt(p.cyPlan, 0)} planificadas (${Math.round(p.pct)} %)` : ` <span class="qc-sin">— sin plan de yardas declarado</span>`}</td></tr>
      ${p.enCurso ? `<tr><td>Descargando ahora</td><td class="n">${fmt(p.enCurso, 1)} cy</td></tr>` : ""}
      <tr><td>Camiones</td><td class="n">${p.loads} recibidos${p.rejected ? ` · <b>${p.rejected} rechazado${p.rejected === 1 ? "" : "s"}</b>` : " · ninguno rechazado"}${p.waiting.length ? ` · ${p.waiting.length} esperando (${fmt(p.waitingCY, 1)} cy)` : ""}</td></tr>
      <!-- Las losas salen de dayProgress y NO de losasDelDia. Las dos existen y
           cuentan cosas distintas: losasDelDia solo tiene lista cuando las losas
           van declaradas en el plan del día, y sin plan devuelve cero. El
           tablero enseña dayProgress.losasDone, que las cuenta por la
           identificación de losa de los camiones descargados. El 6 ago 2026
           este reporte imprimió «0 losas» mientras el tablero decía 23. -->
      <tr><td>Losas</td><td class="n">${p.losasDone} vaciada${p.losasDone === 1 ? "" : "s"}${p.losasPlan ? ` de ${p.losasPlan} planificadas` : ""}${p.rango ? ` · ${esc(p.rango)}` : ""}</td></tr>
      <tr><td>Cumplimiento</td><td class="n">${p.compliancePct != null
        ? `<b>${Math.round(p.compliancePct)} %</b> — ${p.conforming} de ${p.evaluated} camiones evaluados dentro de límites`
        : `<span class="qc-sin">todavía no hay camiones con veredicto</span>`}</td></tr>
    </table>

    <h2>Indicadores del hormigón fresco</h2>
    <table class="qc-rep-tabla">
      <tr><th>Propiedad</th><th class="n">Lecturas</th><th class="n">Media</th><th class="n">Mín</th><th class="n">Máx</th><th class="n">Desv.</th><th class="n">Fuera de zona</th></tr>
      ${est.map((e) => qcFilaEstadistica(e)).join("")}
    </table>

    <h2>Camión por camión</h2>
    <table class="qc-rep-tabla qc-rep-camiones">
      <tr><th class="n">#</th><th>Ticket</th><th>Camión</th><th>Losa</th><th class="n">cy</th>
          <th class="n">Slump</th><th class="n">Aire</th><th class="n">Unit Weight</th><th class="n">Temp</th><th>Estado</th></tr>
      ${filas.map((t, i) => `<tr class="${t.rejected ? "rechazado" : ""}">
        <td class="n">${i + 1}</td>
        <td>${esc(t.ticket || "—")}</td>
        <td>${esc(t.truck || "—")}</td>
        <td>${esc(t.ident || "—")}</td>
        <td class="n">${cel(t, "vol", 1)}</td>
        <td class="n">${cel(t, "slump", 2, 2)}</td>
        <td class="n">${cel(t, "air", 1)}</td>
        <td class="n">${cel(t, "uw", 1)}</td>
        <td class="n">${cel(t, "temp", 0)}</td>
        <td>${t.rejected ? "RECHAZADO" : (num(t.slump) != null && num(t.uw) != null ? "evaluado" : "sin veredicto")}</td>
      </tr>`).join("")}
    </table>

    <h2>Contra qué se juzgó</h2>
    <p class="qc-sin" style="margin-bottom:8px">Plan de control vigente en el momento de imprimir.</p>
    ${panelLimitesTexto()}

    <footer class="qc-rep-pie">
      Generado por QCheck · ${esc(pr.name)} · ${esc(day)} · las cifras salen del expediente
      del proyecto y no se rellena ningún hueco: lo que no se midió aparece como «—».
    </footer>
  </article>`;
}

/* Los límites en versión de papel: la misma tabla que enseña `panelLimites()`,
   sin el marco de panel ni el botón de editar. */
function panelLimitesTexto() {
  const p = db.plan;
  return `<table class="qc-rep-tabla">
    <tr><th>Parámetro</th><th class="n">Objetivo</th><th class="n">Acción</th><th class="n">Suspensión</th></tr>
    <tr><td>Slump (in)</td><td class="n">${fmtSlump(p.slump.target)}</td><td class="n">${fmtSlump(p.slump.actLo)} – ${fmtSlump(p.slump.actHi)}</td><td class="n">${fmtSlump(p.slump.suspLo)} – ${fmtSlump(p.slump.suspHi)}</td></tr>
    <tr><td>Aire (%)</td><td class="n">${p.air.target}</td><td class="n">${p.air.actLo} – ${p.air.actHi}</td><td class="n">${p.air.suspLo} – ${p.air.suspHi}</td></tr>
    <tr><td>Unit Weight (pcf)</td><td class="n">${p.uw.target}</td><td class="n">± ${p.uw.act}</td><td class="n">± ${p.uw.susp}</td></tr>
    <tr><td>Temperatura (°F)</td><td class="n">—</td><td class="n">&gt; ${p.tempMax - 3}</td><td class="n">&gt; ${p.tempMax}</td></tr>
    <tr><td>Resistencia @ ${p.cs.age}d (psi)</td><td class="n">${fmt(p.cs.target, 0)}</td><td class="n">&lt; ${fmt(p.cs.target, 0)}</td><td class="n">&lt; ${fmt(p.cs.action, 0)}</td></tr>
    <tr><td>Batch → descarga (min)</td><td class="n">—</td><td class="n" colspan="2">máx ${p.maxElapsedMin}</td></tr>
  </table>`;
}

/* El botón. Se arma el reporte, se imprime y se retira: dejarlo colgado del
   documento haría que la siguiente impresión sacara dos. */
function imprimirTablero(quien, day) {
  const d = day || diaActivo();
  const caja = document.createElement("div");
  caja.id = "qc-impreso";
  caja.innerHTML = reporteEscritoDelDia(d, quien);
  document.body.appendChild(caja);
  /* La clase es la que de verdad esconde la pantalla al imprimir. El CSS
     también lo hace con `body:has(#qc-impreso)`, pero `:has()` no está en
     todas partes y sin él saldría el tablero entero debajo del reporte. Con
     las dos, si una falla la otra responde. */
  document.body.classList.add("qc-imprimiendo");
  const quitar = () => {
    document.body.classList.remove("qc-imprimiendo");
    if (caja.parentNode) caja.parentNode.removeChild(caja);
  };
  addEventListener("afterprint", quitar, { once: true });
  /* Safari en iPad no siempre dispara `afterprint`. La red de seguridad evita
     que el reporte se quede pegado al final de la pantalla. */
  setTimeout(quitar, 60000);
  print();
}

/* ------------------------------------------------------------ CSV / files */
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}
/* Una celda de CSV: comillas solo si el contenido las necesita.
   Se borró por descuido en la limpieza del 31 jul 2026 y con ella se llevó
   el botón «⬇ CSV» de las cuatro pantallas donde aparece — reventaba con
   "csvCell is not defined" sin decir nada en la interfaz. */
function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
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
  const csv = [headers, ...rows].map((r) => r.map((c) => csvCell(c)).join(",")).join("\r\n");
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
  if (zoneSlump(t) === "susp") reasons.push(`Slump ${fmtSlump(t.slump)}" (susp. ${fmtSlump(p.slump.suspLo)}–${fmtSlump(p.slump.suspHi)}")`);
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
    `  Slump: ${fmtSlump(t.slump)} in   (acción ${fmtSlump(p.slump.actLo)}–${fmtSlump(p.slump.actHi)} / susp ${fmtSlump(p.slump.suspLo)}–${fmtSlump(p.slump.suspHi)})`,
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

/* ------------------------------------------------------------ dashboards
   Concretero, contratista y Autoridad son la misma clase de cosa: mirar cómo va
   el tiro desde fuera, cada quien con lo suyo. Como tres botones sueltos
   llenaban el Control Center y el portal de puertas que la mayoría no abre, van
   detrás de una sola —«Dashboards»— que pregunta cuál (Víctor, 31 jul 2026).

   Vive aquí porque lo usan DOS pantallas y en este proyecto lo que usan dos
   pantallas no se duplica. Los estilos están en `qc.css`, que ambas cargan. */
const QC_DASHBOARDS = [
  { href: "produccion.html", n: "Concretero", r: "Ritmo, ciclos y calidad de sus camiones",
    ic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><rect x="4" y="12" width="3.4" height="8" rx="1"/><rect x="10.3" y="8" width="3.4" height="12" rx="1"/><rect x="16.6" y="4.5" width="3.4" height="15.5" rx="1"/></svg>` },
  { href: "contratista.html", n: "Contratista", r: "Avance del tiro, losas y cumplimiento",
    ic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20V10l9-6 9 6v10"/><rect x="8.5" y="13" width="7" height="7" rx="1"/></svg>` },
  { href: "autoridad.html", n: "Autoridad", r: "Cumplimiento para ACT y FHWA",
    ic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 20 6v6c0 5-3.4 8.4-8 9.5C7.4 20.4 4 17 4 12V6z"/><polyline points="8.8,12 11,14.2 15.4,9.6"/></svg>` },
];

/* Aguja de indicador: el arco, las marcas y la aguja marcando alto.
   Lleva los atributos de trazo en el propio SVG, como el resto de los iconos
   del proyecto: sin ellos el navegador los rellena de negro. Cada pantalla
   puede recolorearlo desde CSS, que gana a los atributos de presentación. */
const ICONO_DASHBOARDS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 18.4a10 10 0 1 1 16.8 0"/><path d="M12 14.6 16.6 9"/><path d="M5.6 14.2l1.5-.5M7.7 9.6l1.1 1.2M12 7.6v1.6M16.3 9.6l-1.1 1.2M18.4 14.2l-1.5-.5"/></svg>`;

/* La puerta que pregunta. La estrenó «Dashboards» y ahora la usa también
   «Tiro», así que dejó de ser suya: mismo dibujo, mismas teclas, mismo cierre.
   Cada opción lleva `href` —se va a otra pantalla— o `hacer`, que se ejecuta.

   Al escoger una acción la puerta **se cierra primero**: casi todas abren su
   propia confirmación detrás, y dos ventanas encima de otra no se entienden. */
function abrirEleccion(cfg) {
  if (document.getElementById("qcd")) return;
  const ov = document.createElement("div");
  ov.id = "qcd";
  ov.className = "qcd";
  ov.innerHTML = `<div class="qcd-caja" role="dialog" aria-modal="true" aria-label="${esc(cfg.titulo)}">
      <div class="qcd-cab">
        <div>
          <div class="qcd-k">${esc(cfg.titulo)}</div>
          <div class="qcd-t">${esc(cfg.pregunta)}</div>
        </div>
        <button class="qcd-x" type="button" aria-label="Cerrar">✕</button>
      </div>
      ${cfg.opciones.map((d, i) => {
        /* La coletilla es opcional. Los dashboards la llevan porque hay que
           saber cuál es cuál; «Programar tiro» y «Cerrar tiro» se explican
           solos y una línea de más solo estorba (Víctor, 1 ago 2026). */
        const dentro = `${d.ic}
        <div><div class="n">${esc(d.n)}</div>${d.r ? `<div class="r">${esc(d.r)}</div>` : ""}</div>
        <span class="fl">›</span>`;
        return d.href
          ? `<a class="qcd-op" href="${d.href}">${dentro}</a>`
          : `<button class="qcd-op" type="button" data-i="${i}">${dentro}</button>`;
      }).join("")}
    </div>`;
  ov.addEventListener("click", (e) => {
    if (e.target === ov || e.target.closest(".qcd-x")) { cerrarDashboards(); return; }
    const b = e.target.closest("button.qcd-op");
    if (!b) return;
    const op = cfg.opciones[+b.dataset.i];
    cerrarDashboards();
    if (op && op.hacer) op.hacer();
  });
  document.body.appendChild(ov);
  /* se guarda la referencia para poder quitar el oyente al cerrar */
  qcdEsc = (e) => { if (e.key === "Escape") cerrarDashboards(); };
  document.addEventListener("keydown", qcdEsc);
}

function abrirDashboards() {
  abrirEleccion({ titulo: "Dashboards", pregunta: "¿Cuál quiere ver?", opciones: QC_DASHBOARDS });
}
let qcdEsc = null;
function cerrarDashboards() {
  const ov = document.getElementById("qcd");
  if (ov) ov.remove();
  if (qcdEsc) { document.removeEventListener("keydown", qcdEsc); qcdEsc = null; }
}

/* ------------------------------------------------------------ modal form builder */
function openForm({ title, fields, initial = {}, onSave, onDelete = null, submitLabel = "Guardar", liveEval = null }) {
  const root = document.getElementById("modal-root");
  const fid = "f-" + uid();
  root.innerHTML = `
    <!-- El fondo NO cierra el formulario. Cerraba al primer roce y se llevaba
         todo lo escrito: en el iPad, llenando el plan del día con la mano
         sucia, un toque de más costaba empezar de cero. Se sale por Cancelar
         o por la ✕, que es donde uno mira cuando quiere salir. -->
    <div class="modal-backdrop">
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
    const values = {}; const faltan = [];
    for (const f of fields) {
      if (f.type === "label") continue;
      const el = form.elements[f.key];
      const v = el.value.trim();
      el.closest(".field").classList.remove("invalid");
      if (f.required && !v) { el.closest(".field").classList.add("invalid"); faltan.push({ f, el }); continue; }
      if (f.type === "number") values[f.key] = v === "" ? null : Number(v);
      else if (f.type === "checkbox") values[f.key] = v === "1";
      else values[f.key] = v;
    }
    /* Se nombra el que falta y se lleva el cursor ahí. «Complete los campos
       requeridos» obliga a buscarlo, y en un formulario de nueve campos, de
       pie y con prisa, eso es exactamente cuando alguien escribe cualquier
       cosa para salir del paso. */
    if (faltan.length) {
      toast(faltan.length === 1
        ? `Falta ${faltan[0].f.label.toLowerCase()}`
        : `Faltan ${faltan.length} datos: ${faltan.map((x) => x.f.label.toLowerCase()).join(", ")}`);
      faltan[0].el.focus();
      faltan[0].el.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
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

/* ============================================================ Q-05
   LA HISTORIA DE UN CONDUCE

   Dos cosas distintas, y por eso van en dos bloques:

   1. **El recorrido del camión** — sale de planta, llega, empieza a vaciar, se
      le toma la muestra, termina. Sale de los propios campos del registro y es
      lo que pasó *en la obra*.

   2. **Quién entró qué y cuándo** — sale del registro de cambios, que existe
      desde Q-02 y guarda una línea por campo que cambió. Es lo que pasó *en el
      expediente*, y desde Q-07 dice la verdad sobre el autor: el servidor lo
      estampa desde la sesión y el aparato no tiene voz. Antes de eso esta
      pantalla habría enseñado nombres autodeclarados, que para un expediente
      es peor que no enseñar ninguno.

   Los dos bloques pueden no cuadrar, y eso ES el dato: un camión que llegó a
   las 9:14 y cuyo Slump se entró a las 11:40 tuvo dos horas sin muestrear.

   El segundo bloque **necesita servidor**. Sin él se dice que no hay, no se
   inventa: el aparato suelto no guarda el registro de cambios, solo lo produce.
   ============================================================ */

/* Los hitos del camión, en el orden en que ocurren. */
const QC_HITOS = [
  { k: "batch",    n: "Sale de planta" },
  { k: "arrive",   n: "Llega a la obra" },
  { k: "start",    n: "Comienza a vaciar" },
  { k: "testTime", n: "Se toma la muestra" },
  { k: "end",      n: "Termina de vaciar" },
];

/* Cómo se llama cada campo cuando se cuenta quién lo tocó. Un renglón que
   dijera «uwTarget» no se lo puede leer nadie que no haya escrito el código. */
const QC_NOMBRE_CAMPO = {
  date: "Fecha", ticket: "Ticket", truck: "Camión", vol: "Volumen", plant: "Planta",
  lot: "Lote", ident: "Losa", company: "Concretera", mix: "Mezcla",
  batch: "Batch", arrive: "Llegada", start: "Comienza vaciado",
  testTime: "Toma de muestra", end: "Termina vaciado",
  slump: "Slump", uw: "Unit Weight", air: "Aire", temp: "Temperatura",
  uwTarget: "Objetivo de Unit Weight", rejected: "Rechazo",
  cs1: "Resistencia 1 día", cs5: "Resistencia 5 días", cs28: "Resistencia 28 días",
  comments: "Comentarios", source: "Origen", n: "Número de fila",
  resultsAt: "Resultados registrados",

  /* El plan del día. Salían en crudo en «Estado del sistema» —«losasPlan», «cyPlan»,
     «cerradoA»— hasta la auditoría del 7 ago 2026, que los sacó del propio
     expediente de producción en vez de adivinarlos: 16 campos escritos de verdad
     y sin nombre. Q-53. */
  cyPlan: "Yardas planificadas", losasPlan: "Losas planificadas", losas: "Losas",
  horaInicio: "Hora de arranque", fase: "Fase", lane: "Carril", km: "Kilómetro",
  cierre: "Cierre", notas: "Notas del día", fecha: "Día del vaciado",
  cerradoA: "Tiro cerrado a las", cerradoPor: "Tiro cerrado por",
  plan: "Límites congelados del día",
  borrado: "Tiro descartado", borradoMotivo: "Motivo del descarte",
  borradoPor: "Descartado por", borradoA: "Descartado el",

  /* Del plan de control y de la configuración. */
  humidityMaxHours: "Horas máximas entre humedades", tempMax: "Temperatura máxima",
  demo: "Simulación",
};

/* Un valor, como se lee en una frase. `false` en un campo de rechazo no es
   «false», es «retirado». */
function qcValorLegible(campo, v) {
  if (v == null || v === "") return "—";
  if (campo === "rejected") return v ? "RECHAZADO" : "rechazo retirado";
  return String(v);
}

function qcLineaHito(t, hito, previo) {
  const hora = t[hito.k];
  if (!hora) return `<tr class="qc-hito-no"><td>${esc(hito.n)}</td><td class="mono">—</td><td class="muted">sin registrar</td></tr>`;
  const salto = previo ? minutesBetween(previo, hora) : null;
  return `<tr><td>${esc(hito.n)}</td><td class="mono">${esc(hora)}</td>`
    + `<td class="muted">${salto != null && salto > 0 ? "+" + salto + " min" : ""}</td></tr>`;
}

async function lineaDeTiempo(n) {
  const t = db.tests.find((x) => x.n === n);
  if (!t) return;
  const raiz = document.getElementById("modal-root");
  if (!raiz) return;

  const rotulo = `Ticket ${t.ticket || "—"}${t.truck ? " · Camión " + t.truck : ""}`;

  /* El recorrido: cada hito con el tiempo que pasó desde el anterior QUE SÍ
     existe, no desde el de arriba en la lista — si nadie apuntó la llegada, el
     salto se mide contra el batch y no queda un hueco mudo. */
  let previo = null;
  const hitos = QC_HITOS.map((h) => {
    const fila = qcLineaHito(t, h, previo);
    if (t[h.k]) previo = t[h.k];
    return fila;
  }).join("");

  const veredicto = t.rejected
    ? `<div class="qc-veredicto susp">RECHAZADO</div>`
    : (num(t.slump) != null || num(t.uw) != null)
      ? `<div class="qc-veredicto ok">Aprobado</div>`
      : `<div class="qc-veredicto">Sin muestrear</div>`;

  raiz.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">Historia del conduce — ${esc(rotulo)}
          <div class="spacer"></div><button class="btn small" onclick="closeForm()">✕</button></div>
        <div class="modal-body">
          ${veredicto}
          <div class="fieldset-label">En la obra</div>
          <div class="table-wrap"><table class="data"><tr><th>Hito</th><th>Hora</th><th>Desde el anterior</th></tr>${hitos}</table></div>
          <div class="fieldset-label" style="margin-top:18px">En el expediente</div>
          <div id="qc-registro" class="muted">Buscando…</div>
        </div>
      </div>
    </div>`;

  const caja = document.getElementById("qc-registro");
  if (typeof qcSyncActivo !== "function" || !qcSyncActivo()) {
    caja.textContent = "Este aparato no está conectado al servidor, así que no tiene el registro de cambios. Se ve desde un aparato conectado.";
    return;
  }
  try {
    const r = await QCSync._pedir("/api/registro?ent=test&id=" + encodeURIComponent(qcIdDe(t, "t")));
    const ops = r.ops || [];
    if (!ops.length) {
      caja.textContent = "Sin cambios registrados. Los ensayos que vienen del Excel histórico no pasaron por aquí.";
      return;
    }
    /* Cinco columnas no caben en un teléfono, así que la tabla se desplaza
       DENTRO de su caja y no empuja la página a lo ancho (AGENTS §9b). */
    caja.innerHTML = `<div class="table-wrap"><table class="data"><tr><th>Cuándo</th><th>Qué</th><th>Valor</th><th>Quién</th><th>Aparato</th></tr>`
      + ops.map((o) => `<tr>
          <td class="mono">${esc((o.ts || "").replace("T", " ").slice(0, 16))}</td>
          <td>${esc(QC_NOMBRE_CAMPO[o.campo] || o.campo)}</td>
          <td class="mono">${esc(qcValorLegible(o.campo, o.valor))}</td>
          <td>${esc(o.usr || "—")}</td>
          <td class="muted">${esc(o.dev || "—")}</td>
        </tr>`).join("") + `</table></div>`;
  } catch (e) {
    /* Se dice lo que pasó. Un «no hay cambios» cuando lo que hubo fue un fallo
       de red sería mentir sobre el expediente. */
    caja.textContent = e.message === "sesion"
      ? "Hay que entrar otra vez para ver el registro."
      : "No se pudo leer el registro del servidor.";
  }
}

/* ------------------------------------------------------------ plan del día
   El plan del día lo escriben DOS pantallas —Results, en Plan & Datos, y el
   Control Center al programar el tiro—, así que vive aquí y no se duplica.

   `onSave` fusiona en vez de reemplazar: este formulario y el del contratista
   escriben el mismo día, y sustituir el objeto le borraba el plan al otro. */
/* ------------------------------------------------------------ cerrar el tiro

   Vive aquí porque lo usan DOS pantallas —el Control Center y Muestras— y en
   este proyecto lo que usan dos pantallas no se duplica.

   La confirmación no pregunta «¿está seguro?» a secas: enseña **lo que se está
   cerrando** —yardas, camiones— y avisa de lo que quedaría a medias. Un
   «¿seguro?» sin datos se contesta que sí sin leerlo, y cerrar con un camión
   sin muestrear deja un hueco en el expediente que ya no se puede rellenar. */
function cerrarTiro(day) {
  const d = day || todayISO();
  const p = dayProgress(d);
  const sinResultados = testsOfDate(d)
    .filter((t) => !t.rejected && (num(t.slump) == null || num(t.uw) == null)).length;
  const sinDescargar = p.waiting.length;

  const texto = [`Cerrar el vaciado del ${fmtDate(d)}.`, ""];
  texto.push(`Colocadas ${fmt(p.placed, 1)} CY${p.cyPlan ? ` de ${fmt(p.cyPlan, 0)} planificadas` : ""} · ${p.loads} camiones.`);
  if (sinResultados) texto.push(`⚠ ${sinResultados} camión${sinResultados === 1 ? "" : "es"} sin resultados de muestra.`);
  if (sinDescargar) texto.push(`⚠ ${sinDescargar} camión${sinDescargar === 1 ? "" : "es"} sin terminar de descargar.`);
  texto.push("", "El tablero dejará de esperar camiones y el reporte se firma como cerrado.",
             "Se puede reabrir si hace falta.", "", "¿Cerrar el tiro?");

  if (!confirm(texto.join("\n"))) return false;
  if (!db.dayMeta[d]) db.dayMeta[d] = {};
  db.dayMeta[d].cerradoA = nowHM();
  /* Q-40/Q-41: al cerrar se congela una COPIA de los límites sobre el día.
     A partir de aquí, ese vaciado se juzga con esto y con nada más — da igual
     cuántas veces se cambien los límites después, y da igual que alguien
     enrede con las fechas de las versiones. Es lo que se firma. */
  db.dayMeta[d].plan = JSON.parse(JSON.stringify(planDe(d)));
  /* Quién cerró el tiro sale de la sesión, no de lo que el navegador tenga
     apuntado: esto se imprime en el informe que se firma. Es el mismo criterio
     de Q-07, aplicado a un campo que viaja como valor y no como autor —el
     servidor estampa la columna `usr` del registro, pero el contenido de un
     campo no lo mira nadie, así que aquí hay que ponerlo bien de origen. */
  const quien = qcCuenta();
  db.dayMeta[d].cerradoPor = (quien && (quien.nombre || quien.usr))
    || sessionStorage.getItem("qc-user") || "?";
  saveDB();
  return true;
}

function reabrirTiro(day) {
  /* Q-41: reabrir un vaciado firmado es cosa del ingeniero de récord. */
  if (typeof qcFirma === "function" && !qcFirma()) {
    alert("Este vaciado está cerrado y firmado.\n\nSolo el ingeniero de récord puede reabrirlo.");
    return false;
  }
  const d = day || todayISO();
  if (!confirm(`El vaciado del ${fmtDate(d)} está cerrado desde las ${tiroCerrado(d)}.\n\n` +
               "¿Reabrirlo para seguir recibiendo camiones?")) return false;
  if (!db.dayMeta[d]) db.dayMeta[d] = {};
  db.dayMeta[d].cerradoA = null;
  db.dayMeta[d].cerradoPor = null;
  saveDB();
  return true;
}

function tiroDescartado(day) {
  const m = (db.dayMeta || {})[day || todayISO()];
  return !!(m && m.borrado);
}

/* DESCARTAR UN TIRO — Q-48, 7 de agosto de 2026.

   Un vaciado puede acabar en el expediente sin haber existido: una prueba del
   sistema que se sincronizó, un día que se abrió por error. Hasta ahora no
   había forma de quitarlo, porque `retirarDia()` retira camiones y el problema
   aquí es justo lo contrario — un plan sin un solo camión.

   Se descarta, que NO es borrar. El día se queda en el archivo con la marca,
   con quién lo descartó y por qué; lo que hace es dejar de contar y dejar de
   aparecer. Mismo criterio que un ensayo retirado (`vivos()`): un expediente
   del que se pueden hacer desaparecer renglones no vale nada, y además así el
   descarte viaja a los demás aparatos como cualquier otro cambio.

   Con camiones dentro no se descarta. Eso ya no es un día fantasma, es un día
   de obra, y sacarlo del récord no es una limpieza — es otra cosa. */
function descartarTiro(day, motivo) {
  const d = day || todayISO();
  if (typeof qcFirma === "function" && !qcFirma()) {
    alert("Descartar un vaciado del expediente es cosa del ingeniero de récord.");
    return false;
  }
  const camiones = testsOfDate(d).length;
  if (camiones) {
    alert(`El vaciado del ${fmtDate(d)} tiene ${camiones} camión${camiones === 1 ? "" : "es"} registrado${camiones === 1 ? "" : "s"}.\n\n` +
          "Un día con camiones no se descarta: es un día de obra.");
    return false;
  }
  const por = motivo != null ? motivo
    : prompt(`Descartar el vaciado del ${fmtDate(d)} del expediente.\n\n` +
             "No se borra: queda en el archivo marcado como descartado, con tu\n" +
             "nombre y el motivo. Deja de contar y deja de aparecer.\n\n" +
             "¿Por qué se descarta?", "Prueba del sistema, no fue un vaciado real");
  if (por == null || !String(por).trim()) return false;

  if (!db.dayMeta[d]) db.dayMeta[d] = {};
  db.dayMeta[d].borrado = true;
  db.dayMeta[d].borradoMotivo = String(por).trim();
  const quien = qcCuenta();
  db.dayMeta[d].borradoPor = (quien && (quien.nombre || quien.usr))
    || sessionStorage.getItem("qc-user") || "?";
  db.dayMeta[d].borradoA = new Date().toISOString();
  saveDB();
  return true;
}

function restaurarTiro(day) {
  const d = day || todayISO();
  if (typeof qcFirma === "function" && !qcFirma()) {
    alert("Devolver un vaciado al expediente es cosa del ingeniero de récord.");
    return false;
  }
  if (!db.dayMeta[d]) db.dayMeta[d] = {};
  db.dayMeta[d].borrado = false;
  saveDB();
  return true;
}

/* El icono lo comparten las dos pantallas, como la función. */
const ICONO_CERRAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 1 1-3.2-6.6"/><polyline points="8.6,12 11,14.4 16.4,8.2"/></svg>`;

function formDayMeta(day) {
  /* UN TIRO CERRADO NO SE EDITA — Q-41, ampliado el 7 ago 2026.

     El guardián estaba en Muestras y en Recepción, pero no aquí: se podía
     cambiar el plan de un vaciado ya firmado sin pasar por reabrirlo, y con
     eso cambiaban las yardas planificadas, el tramo y el cumplimiento de un
     día que ya tiene reporte emitido.

     Para corregirlo hay que reabrirlo primero. Que quede constancia de que se
     reabrió es justamente el punto. */
  if (tiroDescartado(day)) {
    alert(`El vaciado del ${fmtDate(day)} está descartado del expediente.`);
    return;
  }
  if (tiroCerrado(day)) {
    const m = db.dayMeta[day] || {};
    alert(`El vaciado del ${fmtDate(day)} está cerrado` +
          (m.cerradoPor ? ` por ${m.cerradoPor}` : "") + ` a las ${tiroCerrado(day)}.\n\n` +
          "Para corregirlo hay que reabrirlo primero.");
    return;
  }
  const meta = db.dayMeta[day] || {};
  openForm({
    title: `Datos del vaciado — ${fmtDate(day)}`,
    initial: { ...meta, fecha: day },
    fields: [
      /* LA FECHA, Q-47. Hasta hoy el tiro siempre era el de hoy: no se podía
         dejar programado el de mañana ni corregir el de ayer. Va la primera
         porque es la que decide sobre qué día escribe todo lo demás. */
      { key: "fecha", label: "Día del vaciado", type: "date", half: true, required: true,
        hint: "Se puede dejar programado un tiro para otro día" },
      /* Obligatorios los tres que el sistema NECESITA. Sin la hora no hay plan
         contra lo real; sin las yardas la barra de estado no puede enseñar
         avance y dice «sin plan»; sin el tramo no hay losas ni se puede cantar
         un camión vaciado fuera. Lo demás es contexto para el papel y puede
         faltar sin que nada deje de andar. */
      { key: "horaInicio", label: "Hora de comienzo", type: "time", half: true, required: true,
        hint: "A qué hora arranca el tiro" },
      { key: "cyPlan", label: "Yardas planificadas (CY)", type: "number", step: "5", half: true, required: true,
        hint: "Sin esto la barra de estado no puede mostrar el avance del tiro" },
      /* Los dos campos se llamaban igual —«Losas a tirar hoy»— y no había forma
         de saber cuál pedía qué. Uno es el conteo y el otro la lista; si se
         escribe la lista, el conteo sale de ella y este campo sobra. */
      { key: "losasPlan", label: "Cuántas losas", type: "number", step: "1", half: true,
        hint: "Opcional. Sin esto, del tramo sale una estimación y se enseña con «≈»." },
      { key: "losas", label: "Tramo del día", type: "textarea", full: true, required: true,
        placeholder: "L3-0.431@L3-0.252",
        hint: "El tramo tal como se lo dan: de la primera losa a la última. También acepta la lista completa separada por coma, si la tiene." },
      { key: "fase", label: "Fase" },
      { key: "cierre", label: "Cierre" },
      { key: "lane", label: "Carril", placeholder: "L1 / L2 / L3" },
      { key: "km", label: "Km (desde–hasta)", half: true, placeholder: "0.943 – 0.461" },
      { key: "notas", label: "Notas", type: "textarea", full: true },
    ],
    // Se fusiona: este formulario y el del contratista escriben el mismo día,
    // y reemplazar el objeto le borraba el plan al otro.
    onSave: (v) => {
        /* AL TOCARLO UNA PERSONA, DEJA DE SER SIMULACIÓN — Q-46, 7 ago 2026.

           El objeto se fusiona porque este formulario y el del contratista
           escriben el mismo día. Pero fusionar conservaba también `source`, y
           si la simulación había sembrado ese día, el plan REAL heredaba la
           marca `source: "demo"` — que es justo la que hace que la
           sincronización NO lo mande.

           Resultado: Rubén programaba el tiro, lo veía en su pantalla, y no
           salía de su PC. Víctor no veía ningún tiro y los dos Control Center
           decían cosas distintas. Costó dos arreglos fallidos encontrarlo.

           Quien programa un tiro es una persona. Desde ese momento el día es
           de verdad y viaja. */
      db.dayMeta[day] = { ...(db.dayMeta[day] || {}), ...v };
      delete db.dayMeta[day].source;
      saveDB(); render(); toast("Datos del día guardados");
    },
  });
}

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
      /* Aquí solo se exigen camión y volumen. Este formulario también sirve
         para CORREGIR ensayos del histórico, y de los 397 del Excel algunos
         vienen sin hora de batch o sin losa —así los entregó la inspección—:
         exigirlas dejaría un expediente antiguo imposible de arreglar. La
         puerta estricta va en Recepción (`CAMPOS_CAMION`), que es por donde
         entran los camiones nuevos y donde el error se evita en el origen. */
      { key: "truck", label: "Camión", required: true },
      { key: "vol", label: "Volumen (CY)", type: "number", step: "0.5", required: true },
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
      { key: "uw", label: "Unit Weight (pcf)", type: "number", step: "0.01" },
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
