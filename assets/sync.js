/* ============================================================
   SINCRONIZACIÓN — el lado del navegador.

   Se mete DEBAJO de `loadDB`/`saveDB` y ninguna pantalla se entera:
   los widgets siguen leyendo del mismo `db` de siempre. Por eso la
   base estuvo aislada detrás de esas dos funciones desde el primer
   día — este archivo es el cobro de esa decisión.

   CÓMO SABE QUÉ CAMBIÓ
   --------------------
   Guarda una copia de cómo estaba la base la última vez que se
   sincronizó (`qc-sync-base`). Al guardar, compara campo por campo
   y de la diferencia salen las líneas del registro. Así ninguna de
   las once pantallas tuvo que cambiar una línea para sincronizar:
   siguen mutando `db` y llamando `saveDB()` como siempre.

   QUÉ VIAJA Y QUÉ NO
   ------------------
   - **La simulación NO viaja.** Los ensayos con `source: "demo"` se
     quedan en su aparato. Cada uno siembra los suyos y el registro
     compartido queda limpio de datos inventados.
   - **El histórico SÍ puede viajar, pero no arranca viajando.** Los
     397 ensayos del Excel vienen en `seed.js`, idénticos en todos los
     aparatos, así que la copia de referencia se estrena con ellos
     dentro: al conectar por primera vez no se sube nada. Si alguien
     corrige uno después, eso sí sale como cambio.
   - **Nada se borra.** Un dato que quedó mal se corrige con otra
     línea encima; las dos quedan en el expediente.

   SIN SEÑAL
   ---------
   Lo que no se pudo subir se encola en `qc-sync-cola` y sube al
   volver la señal. En obra eso va a pasar, así que no es un extra.
   ============================================================ */
"use strict";

const QC_API_URL = "qc-api";        /* dónde vive el servidor */
const QC_API_TOKEN = "qc-token";    /* la llave del proyecto — nunca va en el repositorio */
const QC_SYNC_SEQ = "qc-sync-seq";  /* hasta qué número de cambio hemos leído */
const QC_SYNC_BASE = "qc-sync-base";
const QC_SYNC_COLA = "qc-sync-cola";
const QC_SYNC_DEV = "qc-dev";       /* nombre del aparato, para el expediente */

/* Cada aparato se bautiza solo la primera vez. Sirve para saber quién
   entró qué: "iPad · 3f2a". Se puede cambiar desde Plan & Datos. */
function qcAparato() {
  let d = localStorage.getItem(QC_SYNC_DEV);
  if (!d) {
    const ua = navigator.userAgent;
    const tipo = /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : "PC";
    d = tipo + " · " + Math.random().toString(36).slice(2, 6);
    localStorage.setItem(QC_SYNC_DEV, d);
  }
  return d;
}
function qcApiURL() { return (localStorage.getItem(QC_API_URL) || "").replace(/\/+$/, ""); }
function qcApiToken() { return localStorage.getItem(QC_API_TOKEN) || ""; }
function qcSyncActivo() { return !!qcApiURL(); }

/* ------------------------------------------------------------ identidad

   La llave que viaja es `id`, NUNCA `n`. `n` es un número de fila que
   cada aparato reparte por su cuenta (`nextTestN()` = el mayor + 1), así
   que dos aparatos sin señer pueden repartir el mismo y chocarían. `id`
   es único de nacimiento.

   Los 397 del Excel llevan un id deducido de su número —`x123`—, igual
   en todos los aparatos, porque vienen del mismo `seed.js`. */
function qcIdDe(reg, prefijo) {
  if (reg.id) return reg.id;
  if (reg.source === "excel" && reg.n != null) reg.id = "x" + reg.n;
  else reg.id = (prefijo || "r") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return reg.id;
}

/* ------------------------------------------------------------ la proyección

   La base, aplanada a `entidad → id → campo → valor`. Es lo que se
   compara para sacar los cambios. Los objetos anidados del plan (los
   límites de Slump, por ejemplo) viajan enteros como un solo campo: los
   toca una persona y muy de vez en cuando, no hace falta más fineza. */
function qcProyectar(base) {
  const p = { test: {}, dayMeta: {}, plan: {}, project: {}, humidity: {}, config: {} };
  for (const t of base.tests || []) {
    if (t.source === "demo") continue;               // la simulación no viaja
    const o = {};
    for (const k of Object.keys(t)) if (k !== "id") o[k] = t[k];
    p.test[qcIdDe(t, "t")] = o;
  }
  for (const [dia, m] of Object.entries(base.dayMeta || {})) {
    if (m && m.source === "demo") continue;           // el plan sembrado tampoco viaja
    p.dayMeta[dia] = Object.assign({}, m);
  }
  for (const h of base.humidity || []) p.humidity[qcIdDe(h, "h")] = Object.assign({}, h);
  p.plan[""] = Object.assign({}, base.plan);
  p.project[""] = Object.assign({}, base.project);
  /* De la simulación solo viaja su APAGADO. `db.demo = false` significa que
     alguien programó un tiro de verdad, y eso los demás aparatos tienen que
     saberlo para no sembrar encima. La marca con fecha es cosa de cada uno. */
  p.config[""] = { demo: base.demo === false ? false : null };
  return p;
}

function qcIgual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === "object" || typeof b === "object") return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

/* Compara la proyección de ahora contra la de la última sincronización
   y devuelve una línea por cada campo que cambió. */
function qcCambios(antes, ahora) {
  const ops = [];
  const ts = new Date().toISOString();
  const dev = qcAparato();
  const usr = sessionStorage.getItem("qc-user") || "?";
  for (const ent of Object.keys(ahora)) {
    const A = antes[ent] || {}, B = ahora[ent];
    for (const id of Object.keys(B)) {
      const va = A[id] || {}, vb = B[id];
      for (const campo of Object.keys(vb)) {
        if (qcIgual(va[campo], vb[campo])) continue;
        ops.push({
          uid: dev + "|" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          ent, id, campo, valor: vb[campo] === undefined ? null : vb[campo], ts, dev, usr,
        });
      }
    }
  }
  return ops;
}

/* ------------------------------------------------------------ aplicar lo que llega */

/* Mete un cambio recibido dentro de `db`. Crea el registro si no existía:
   un camión recibido en el iPad tiene que aparecer en la PC. */
function qcAplicarOp(o) {
  if (o.ent === "test") {
    let t = (db.tests || []).find((x) => x.id === o.id);
    if (!t) { t = { id: o.id }; db.tests.push(t); }
    t[o.campo] = o.valor;
  } else if (o.ent === "dayMeta") {
    if (!db.dayMeta[o.id]) db.dayMeta[o.id] = {};
    db.dayMeta[o.id][o.campo] = o.valor;
  } else if (o.ent === "humidity") {
    let h = (db.humidity || []).find((x) => x.id === o.id);
    if (!h) { h = { id: o.id }; db.humidity.push(h); }
    h[o.campo] = o.valor;
  } else if (o.ent === "plan") {
    db.plan[o.campo] = o.valor;
  } else if (o.ent === "project") {
    db.project[o.campo] = o.valor;
  } else if (o.ent === "config") {
    if (o.campo === "demo") db.demo = o.valor;
  }
}

/* `n` es de cada aparato, así que dos camiones creados a la vez en dos
   sitios pueden traer el mismo. Se resuelve sin preguntarle a nadie: el
   de `id` menor se queda con el número y el otro coge el siguiente libre.
   Todos los aparatos aplican la misma regla sobre las mismas líneas, así
   que todos llegan al mismo reparto. */
function qcReconciliarN() {
  const porN = new Map();
  let mayor = 0;
  for (const t of db.tests) {
    if (t.n != null && t.n > mayor) mayor = t.n;
  }
  for (const t of [...db.tests].sort((a, b) => String(a.id) < String(b.id) ? -1 : 1)) {
    if (t.n == null) { t.n = ++mayor; continue; }
    const duena = porN.get(t.n);
    if (duena && duena !== t) t.n = ++mayor;
    else porN.set(t.n, t);
  }
}

/* ------------------------------------------------------------ el motor */
const QCSync = {
  estado: "apagado",   // apagado · conectando · al-dia · sin-senal
  pendientes: 0,
  ultimo: null,
  _oyentes: [],
  _timer: null,

  alCambiar(fn) { this._oyentes.push(fn); },
  _avisar() { for (const f of this._oyentes) { try { f(); } catch (_) {} } },

  _base() {
    try { return JSON.parse(localStorage.getItem(QC_SYNC_BASE)) || null; } catch (_) { return null; }
  },
  _guardarBase(p) { localStorage.setItem(QC_SYNC_BASE, JSON.stringify(p)); },
  _cola() {
    try { return JSON.parse(localStorage.getItem(QC_SYNC_COLA)) || []; } catch (_) { return []; }
  },
  _guardarCola(c) { localStorage.setItem(QC_SYNC_COLA, JSON.stringify(c)); this.pendientes = c.length; },
  _seq() { return Number(localStorage.getItem(QC_SYNC_SEQ) || 0) || 0; },
  _guardarSeq(n) { localStorage.setItem(QC_SYNC_SEQ, String(n)); },

  /* La copia de referencia se estrena con el `seed.js` dentro, así que
     conectar por primera vez no sube los 397 ensayos históricos: solo
     sale lo que este aparato tenga de más o distinto. */
  _estrenarBase() {
    if (this._base()) return;
    /* Se estrena con el `seed.js` **migrado**, no crudo. La migración es la que
       le pone `company`, `source` e `id` a los 397 ensayos históricos; sin ella
       la referencia no se parece a la base real y el primer arranque los sube
       todos al servidor. Por eso `migrarBase()` sabe trabajar sobre una copia. */
    const semilla = {
      tests: structuredClone((typeof QC_SEED !== "undefined" && QC_SEED.tests) || []),
      dayMeta: {}, humidity: [],
      plan: structuredClone((typeof QC_SEED !== "undefined" && QC_SEED.plan) || {}),
      project: structuredClone((typeof QC_SEED !== "undefined" && QC_SEED.project) || {}),
    };
    if (typeof migrarBase === "function") migrarBase(semilla);
    this._guardarBase(qcProyectar(semilla));
  },

  /* Lo llama `saveDB()`. Saca los cambios y los encola. */
  alGuardar() {
    if (!qcSyncActivo()) return;
    this._estrenarBase();
    const ahora = qcProyectar(db);
    const ops = qcCambios(this._base(), ahora);
    if (!ops.length) return;
    this._guardarBase(ahora);
    this._guardarCola(this._cola().concat(ops));
    this._empujar();
  },

  async _pedir(ruta, opciones) {
    const cabeceras = { "Content-Type": "application/json" };
    const tk = qcApiToken();
    if (tk) cabeceras["X-QC-Token"] = tk;
    const r = await fetch(qcApiURL() + ruta, Object.assign({ headers: cabeceras }, opciones || {}));
    if (r.status === 401) throw new Error("token");
    if (!r.ok) throw new Error("http " + r.status);
    return r.json();
  },

  /* Sube lo encolado. Solo se descuelan las que el servidor confirmó. */
  async _empujar() {
    const cola = this._cola();
    if (!cola.length || !qcSyncActivo()) return;
    try {
      const r = await this._pedir("/api/cambios", { method: "POST", body: JSON.stringify({ ops: cola }) });
      const ok = new Set(r.aceptadas || []);
      this._guardarCola(cola.filter((o) => !ok.has(o.uid)));
      this.estado = "al-dia";
    } catch (e) {
      this.estado = e.message === "token" ? "sin-llave" : "sin-senal";
    }
  },

  /* Baja lo que hicieron los demás y lo mete en `db`. */
  async _bajar() {
    if (!qcSyncActivo()) return;
    try {
      const r = await this._pedir("/api/cambios?desde=" + this._seq());
      if (r.ops && r.ops.length) {
        for (const o of r.ops) qcAplicarOp(o);
        qcReconciliarN();
        this._guardarSeq(r.ops[r.ops.length - 1].seq);
        /* La base se actualiza ANTES de guardar: si no, lo que acaba de
           llegar de fuera se leería como un cambio nuestro y volvería a
           subir en un bucle. */
        this._guardarBase(qcProyectar(db));
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        this._avisar();
      } else if (r.seq != null && this._seq() === 0) {
        this._guardarSeq(r.seq);
      }
      this.estado = "al-dia";
      this.ultimo = new Date();
    } catch (e) {
      this.estado = e.message === "token" ? "sin-llave" : "sin-senal";
    }
  },

  async _ciclo() {
    await this._empujar();
    await this._bajar();
  },

  arrancar() {
    if (!qcSyncActivo()) { this.estado = "apagado"; return; }
    this.estado = "conectando";
    this._estrenarBase();
    this.pendientes = this._cola().length;
    clearInterval(this._timer);
    const paso = () => this._ciclo();
    paso();
    /* Cada 3 s con la pantalla delante; cada 20 s si está escondida, que
       un Field Display en una TV no necesita gastar peticiones cuando
       nadie cambió de pestaña. */
    const arrancarTimer = () => {
      clearInterval(this._timer);
      this._timer = setInterval(paso, document.hidden ? 20000 : 3000);
    };
    arrancarTimer();
    document.addEventListener("visibilitychange", () => { arrancarTimer(); if (!document.hidden) paso(); });
    window.addEventListener("online", paso);
  },
};
