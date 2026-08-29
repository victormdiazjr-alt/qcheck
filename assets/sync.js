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
/* Si este aparato ha llegado a BAJAR algo del servidor alguna vez — Q-108. */
const QC_SYNC_VISTO = "qc-sync-visto";

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
/* DÓNDE VIVE EL SERVIDOR — Q-103, 28 ago 2026.

   En qterapr.com la app y el servidor son el mismo sitio: un aparato nuevo
   abre el enlace, entra con su cuenta y ya está sincronizando. Mañana se
   estrenan varios aparatos en obra a la vez, y cada paso que se le pida a
   alguien con las manos sucias es un paso que se hace mal o no se hace.

   En GitHub Pages no vale: allí la app es solo el papel y el servidor está en
   otra parte, así que se sigue pidiendo la llave por Conectar, como siempre.
   Y desde un archivo suelto, tampoco: no hay servidor al que apuntar. */
function qcApiURL() {
  const puesto = (localStorage.getItem(QC_API_URL) || "").replace(/\/+$/, "");
  if (puesto) return puesto;
  if (location.protocol === "file:" || location.hostname.endsWith("github.io")) return "";
  return location.origin;
}
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

/* Lo que empieza por `_` es CALCULADO, no medido, y no viaja nunca.

   `_ma5` —la Moving Average de la resistencia a 5 días— se guarda encima del
   ensayo para no recalcularla en cada repintado. Es un caché, no un dato: se
   deduce de los ensayos que ya están, así que cada aparato la saca sola. Sin
   esta regla, abrir las Control Charts mandaba **99 líneas** al registro y
   metía en el expediente cifras que nadie midió. */
function qcDerivado(campo) { return campo.charAt(0) === "_"; }

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
    for (const k of Object.keys(t)) if (k !== "id" && !qcDerivado(k)) o[k] = t[k];
    p.test[qcIdDe(t, "t")] = o;
  }
  for (const [dia, m] of Object.entries(base.dayMeta || {})) {
    if (m && m.source === "demo") continue;           // el plan sembrado tampoco viaja
    p.dayMeta[dia] = Object.assign({}, m);
  }
  for (const h of base.humidity || []) p.humidity[qcIdDe(h, "h")] = Object.assign({}, h);
  /* Q-59b: el plan es de la obra, así que viaja bajo el id de la obra. En
     singular, las dos se pisaban y una acababa juzgando con la vara de la
     otra — que es exactamente lo que hizo que el Field Display rechazara un
     camión bueno en la prueba del 10 de agosto. */
  for (const pr of base.proyectos || []) if (pr && pr.id && pr.plan) p.plan[pr.id] = Object.assign({}, pr.plan);
  /* Q-59, 10 ago 2026: UNA LÍNEA POR OBRA, cada una bajo su id.

     Iba `p.project[""]`, en singular, porque solo había una obra. Con dos, las
     dos se escribían en la misma fila del servidor y la última pisaba a la
     otra: un aparato podía bajarse el nombre del puente sobre los ensayos de
     la PR-52. Y en un registro que solo añade, eso no tiene vuelta. */
  for (const pr of base.proyectos || []) if (pr && pr.id) p.project[pr.id] = Object.assign({}, pr);
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
  /* Desde Q-07 esto es solo lo que este aparato CREE: si la petición lleva
     pase de sesión, el servidor lo pisa con quien de verdad está dentro. Se
     sigue mandando porque un servidor con `exigir_sesion` apagada —o el local
     de la obra sin cuentas dadas de alta— todavía se apoya en ello. */
  const usr = localStorage.getItem("qc-user") || "?";
  const anota = (ent, id, campo, valor) => ops.push({
    uid: dev + "|" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ent, id, campo, valor: valor === undefined ? null : valor, ts, dev, usr,
  });

  for (const ent of Object.keys(ahora)) {
    const A = antes[ent] || {}, B = ahora[ent];
    for (const id of Object.keys(B)) {
      const va = A[id] || {}, vb = B[id];
      for (const campo of Object.keys(vb)) {
        if (!qcIgual(va[campo], vb[campo])) anota(ent, id, campo, vb[campo]);
      }
      /* Un campo que ESTABA y ya no está también es un cambio. Sin esto,
         reprogramar el tiro —que borra el plan del día para empezar limpio—
         dejaba el plan viejo intacto en los demás aparatos: el iPad enseñando
         19 losas de un tiro que ya no existe. Lo que se quita se anota como
         quitado, y así viaja. */
      for (const campo of Object.keys(va)) {
        if (!(campo in vb) && va[campo] != null) anota(ent, id, campo, null);
      }
    }
    for (const id of Object.keys(A)) {
      if (id in B) continue;
      for (const campo of Object.keys(A[id])) if (A[id][campo] != null) anota(ent, id, campo, null);
    }
  }
  return ops;
}

/* ------------------------------------------------------------ aplicar lo que llega */

/* Mete un cambio recibido dentro de `db`. Crea el registro si no existía:
   un camión recibido en el iPad tiene que aparecer en la PC. */
function qcAplicarOp(o) {
  if (qcDerivado(o.campo)) return;   // un calculado que llegue de fuera se ignora
  /* EL `id` ES LA LLAVE, NO UN CAMPO — Q-90, 14 ago 2026.

     Un apunte que diga «el campo `id` de este registro ahora vale nada» se
     aplicaba tal cual: se buscaba el registro POR su id, y acto seguido se le
     borraba el id. Quedaban fichas `{id: null}` — obras fantasma en el
     desplegable de «elegir proyecto», y en un ensayo sería peor: un camión sin
     llave no se vuelve a encontrar nunca.

     Un apunte así lo genera `qcCambios()` solo si un registro pierde su `id` en
     la foto local, que ya es un fallo — pero el que recibe no tiene por qué
     obedecerlo. Es de la misma familia que las 397 fichas vacías (Q-86): el
     servidor creando registros a partir de un campo suelto. */
  if (o.campo === "id") return;
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
    if (!o.id) { db.plan[o.campo] = o.valor; }        // formato viejo
    else {
      if (!db.proyectos) db.proyectos = [];
      let pr = db.proyectos.find((x) => x.id === o.id);
      if (!pr) { pr = { id: o.id }; db.proyectos.push(pr); }
      if (!pr.plan) pr.plan = {};
      pr.plan[o.campo] = o.valor;
      if (o.id === (db.proyectoActivo || "")) db.plan = pr.plan;
    }
  } else if (o.ent === "project") {
    /* Q-59. El id vacío es el formato viejo —una sola obra— y sigue entrando
       en la activa, para que una base que aún no ha migrado no se rompa. */
    if (!o.id) { db.project[o.campo] = o.valor; }
    else {
      if (!db.proyectos) db.proyectos = [];
      let pr = db.proyectos.find((x) => x.id === o.id);
      if (!pr) { pr = { id: o.id }; db.proyectos.push(pr); }
      pr[o.campo] = o.valor;
      /* Si la que llega es la que está abierta, `db.project` tiene que ser
         ESE objeto y no una copia: media pantalla lo lee directo. */
      if (o.id === (db.proyectoActivo || "")) db.project = pr;
    }
  } else if (o.ent === "config") {
    if (o.campo === "demo") db.demo = o.valor;
  }
}

/* `n` es de cada aparato, así que dos camiones creados a la vez en dos
   sitios pueden traer el mismo. Se resuelve sin preguntarle a nadie: el
   de `id` menor se queda con el número y el otro coge el siguiente libre.
   Todos los aparatos aplican la misma regla sobre las mismas líneas, así
   que todos llegan al mismo reparto. */
/* UN ENSAYO RETIRADO NO OCUPA NÚMERO — Q-99, 28 ago 2026.

   Esto repartía números entre TODOS los ensayos, vivos y retirados por igual.
   Con el expediente limpio —donde cada camión bueno tiene detrás su versión
   vieja descartada— el retirado le ganaba el número al vivo y lo empujaba al
   final de la cuenta: el camión 452 del tiro del 22 de agosto salía como
   ensayo 4909. Y ese número es el que va al informe y el que tiene que cuadrar
   con el Control Chart.

   Dos reglas, y las dos dicen lo mismo: **el que cuenta es el que está vivo.**
   Los vivos reparten primero y se quedan con su número; los retirados van
   detrás y ceden. Y el techo de la cuenta sale solo de los vivos, para que el
   camión siguiente sea el 466 y no el 4906.

   El reparto sigue siendo el mismo en todos los aparatos —mismas líneas, mismo
   orden, misma regla—, así que todos llegan al mismo resultado sin
   preguntárselo a nadie. */
function qcReconciliarN() {
  const porN = new Map();
  let mayor = 0;
  for (const t of db.tests) {
    if (!t.borrado && t.n != null && t.n > mayor) mayor = t.n;
  }
  const vive = (t) => (t && t.borrado) ? 1 : 0;
  for (const t of [...db.tests].sort((a, b) =>
        vive(a) !== vive(b) ? vive(a) - vive(b)
      : String(a.id) < String(b.id) ? -1 : 1)) {
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
    let ops = qcCambios(this._base(), ahora);

    /* UN APARATO RECIÉN CONECTADO NO PUEDE BORRAR NADA — Q-108, 15 ago 2026.

       Hoy a las 12:11, el teléfono de tecnico1 se conectó por primera vez y
       **escribió `null` en 1.801 campos de 408 registros**: casi todo el
       histórico. No fue malicia ni un fallo de red. Fue esto:

         · la base de referencia se estrena con `seed.js`,
         · la base local de un aparato recién conectado estaba más vacía,
         · y la diferencia entre las dos se lee como «alguien borró esto».

       El aparato dijo la verdad sobre lo que él tenía. **El problema es que se
       le creyó sobre algo que nunca había visto.**

       > Un aparato que no ha bajado nada del servidor no sabe qué hay en él.
       > Puede añadir lo suyo; no puede decir que algo se borró.

       Así que hasta la primera bajada buena, **lo que se AÑADE sube y lo que
       BORRA no**. No se pierde nada: lo borrado de verdad, si lo fuera, vuelve
       a salir en el siguiente guardado, ya con el servidor conocido.

       Nada de esto se perdió —el expediente solo añade y cada valor sigue ahí—,
       pero durante horas lo que se veía encima era un hueco. */
    /* Y TAMPOCO PUEDE AÑADIR — Q-106, 28 de agosto de 2026.
     *
     * Lo de arriba tapaba media gotera. Hoy, preparando la salida a obra,
     * cuatro aparatos de prueba recien conectados escribieron 4.154 lineas en
     * el expediente de verdad: 4.072 ensayos que ya existian, subidos otra vez
     * como si fueran nuevos. Nadie tecleo un solo dato.
     *
     * Es el mismo error del 15 de agosto visto por el otro lado. La base de
     * referencia se estrena con `seed.js`; un aparato que todavia no ha bajado
     * nada compara ESO con lo suyo y la diferencia se lee como trabajo nuevo.
     *
     *   > Un aparato que no ha bajado nada del servidor no sabe que hay en el.
     *   > Ni puede decir que algo se borro, ni puede decir que algo es nuevo.
     *
     * Asi que hasta la primera bajada completa no sube NADA. Son unos segundos
     * —siete en la prueba de hoy, con el expediente entero—, y la pantalla dice
     * que esta cargando mientras tanto. Lo que se haga despues sube igual que
     * siempre, tambien sin señal: `visto` se enciende una vez y para siempre,
     * asi que un aparato que ya se estreno puede trabajar todo el dia sin
     * cobertura y subir al volver.
     *
     * Manana entran varios aparatos nuevos a la vez. Sin esto, cada uno de
     * ellos habria vaciado su copia de arranque encima del expediente firmado. */
    if (!localStorage.getItem(QC_SYNC_VISTO)) {
      if (ops.length) {
        try { console.warn(`QCheck: aparato sin estrenar — no se sube nada todavia (${ops.length} cambios en espera del primer bajado)`); } catch (_) {}
      }
      return;
    }

    if (!ops.length) return;
    this._guardarBase(ahora);
    this._guardarCola(this._cola().concat(ops));
    this._empujar();
  },

  async _pedir(ruta, opciones) {
    const cabeceras = { "Content-Type": "application/json" };
    const tk = qcApiToken();
    if (tk) cabeceras["X-QC-Token"] = tk;
    /* El pase de sesión (Q-07). Es lo que hace que el servidor firme cada línea
       con el nombre de quien de verdad está dentro, en vez de creerle al
       cuerpo del POST. Sin él, el aparato solo puede escribir mientras
       `exigir_sesion` siga apagada. */
    const ses = localStorage.getItem("qc-sesion");
    if (ses) cabeceras["X-QC-Sesion"] = ses;
    const r = await fetch(qcApiURL() + ruta, Object.assign({ headers: cabeceras }, opciones || {}));
    /* Los dos 401 no son el mismo problema y no se arreglan igual: la llave
       la cambia el administrador, y la sesión la arregla el propio técnico
       volviendo a entrar. La franja de arriba tiene que decir cuál es. */
    if (r.status === 401) {
      let motivo = "token";
      try { motivo = (await r.json()).error || "token"; } catch (_) {}
      throw new Error(motivo === "sesion" ? "sesion" : "token");
    }
    if (r.status === 403) throw new Error("rol");
    /* Cloudflare corta por cuota con 429 (y con 1027 cuando es el límite
       diario del plan gratis). Se distingue de «no hay señal» porque se
       arregla de otra manera: el WiFi está perfecto y mirarlo es perder el
       tiempo mientras las muestras se amontonan. Auditoría del 7 ago 2026. */
    if (r.status === 429 || r.status === 1027 || r.status === 503) throw new Error("cuota");
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
      this.estado = e.message === "token" ? "sin-llave"
        : e.message === "sesion" ? "sin-sesion"
        : e.message === "rol" ? "sin-permiso"
        : e.message === "cuota" ? "sin-cuota"
        : "sin-senal";
    }
  },

  /* Baja lo que hicieron los demás y lo mete en `db`. */
  /* UN APARATO NUEVO SE PONE AL DÍA DE UNA VEZ — Q-108 ter, 15 ago 2026.

     El servidor entrega los cambios de 2.000 en 2.000 y el expediente tiene
     52.000. Con una página por vuelta y una vuelta cada tres segundos, un
     aparato recién conectado tardaba **más de un minuto** en tenerlo todo — y
     durante ese minuto trabaja con un récord a medias: le falta la ficha de una
     obra, le faltan camiones, le faltan límites.

     Hoy le pasó al iPad del técnico: el desplegable de obras enseñaba una sola,
     porque la otra vivía en una página que aún no había llegado.

     Ahora, mientras quede algo por bajar, sigue pidiendo en la misma vuelta.
     El tope de 60 páginas es un freno de mano, no un límite de trabajo: son
     120.000 apuntes, muy por encima de lo que hay. Si algún día se alcanza, la
     vuelta siguiente sigue donde quedó — como antes, pero desde mucho más
     cerca. */
  async _bajar() {
    if (!qcSyncActivo()) return;
    for (let pagina = 0; pagina < 60; pagina++) {
      const quedaMas = await this._bajarUna();
      if (!quedaMas) return;
    }
  },

  /* Devuelve `true` si el servidor tiene todavía más de lo que se ha traído. */
  async _bajarUna() {
    try {
      const r = await this._pedir("/api/cambios?desde=" + this._seq());

      /* UN APARATO QUE VIENE DE OTRO MUNDO SE ESTRENA SOLO — Q-123, 28 de
         agosto de 2026.

         Si este aparato dice ir por una linea que el servidor ni siquiera ha
         escrito, lo que tiene guardado no es una copia atrasada: es una copia
         de OTRO registro. Y una copia asi no se corrige nunca, porque la
         sincronizacion solo trae lo que viene DESPUES de donde uno dice estar,
         y ahi ya no hay nada. El aparato se queda mirando datos de otro mundo
         para siempre, y ni recargar ni esperar lo arregla.

         Paso de verdad, la vispera del primer tiro: el iPad seguia enseñando
         una obra retirada y camiones que no existen, con /new hecho y todo.

         Cuando se detecta, el aparato se estrena solo: se tira lo guardado y
         se baja el expediente entero. Es lo mismo que hace `qterapr.com/new`,
         pero sin que nadie tenga que darse cuenta ni acordarse del enlace.

         Se hace con cuidado: se tira la BASE, no la cola. Lo que el tecnico
         escribio y todavia no ha subido se respeta y sube despues. */
      if (r && r.seq != null && this._seq() > r.seq) {
        try { console.warn(`QCheck: este aparato iba por la linea ${this._seq()} y el servidor va por la ${r.seq}. Se estrena solo.`); } catch (_) {}
        localStorage.removeItem(DB_KEY);
        localStorage.removeItem(QC_SYNC_BASE);
        localStorage.removeItem(QC_SYNC_VISTO);
        localStorage.removeItem("qc-sync-tope");
        this._guardarSeq(0);
        location.reload();
        return false;
      }
      if (r.ops && r.ops.length) {
        for (const o of r.ops) qcAplicarOp(o);
        qcReconciliarN();
        this._guardarSeq(r.ops[r.ops.length - 1].seq);
        /* Q-110: por donde va el servidor, para que la pantalla de carga pueda
           enseñar cuanto falta DE VERDAD en vez de una barra que se llena sola.
           Una barra que finge es peor que ninguna: cuando algo se atasca, sigue
           llenandose igual y nadie se entera. */
        if (r.seq != null) localStorage.setItem("qc-sync-tope", String(r.seq));
        /* La base se actualiza ANTES de guardar: si no, lo que acaba de
           llegar de fuera se leería como un cambio nuestro y volvería a
           subir en un bucle. */
        this._guardarBase(qcProyectar(db));
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        this._avisar();
      } else if (r.seq != null && this._seq() === 0) {
        this._guardarSeq(r.seq);
      }
      /* NO BASTA CON HABER BAJADO ALGO: HAY QUE ESTAR AL DÍA — Q-108 bis.

         La primera versión marcaba el aparato como estrenado tras la primera
         bajada buena. **No es suficiente, y se vio hoy mismo:** el servidor
         entrega los cambios de 2.000 en 2.000 y el expediente tiene 52.000, así
         que la primera bajada trae el 4 % — un aparato con el 4 % del récord
         seguía siendo un aparato que no sabe lo que hay.

         De ahí salían las dos cosas de esta tarde: el borrado de las 12:11 y el
         desplegable con una sola obra, porque la ficha de la otra vive en una
         página que todavía no había llegado.

         Ahora se marca cuando de verdad se ha llegado al final: `r.seq` es el
         último número del servidor, y hasta alcanzarlo este aparato mira pero
         no opina.

         > Estar conectado no es estar al día, y a medio camino se parecen. */
      if (r.seq != null && this._seq() >= r.seq) localStorage.setItem(QC_SYNC_VISTO, "1");
      this.estado = "al-dia";
      this.ultimo = new Date();
      /* ¿Queda más? Solo si el servidor dice que su último número es mayor que
         el nuestro. Sin ops en esta página no queda nada por definición. */
      return r.ops && r.ops.length > 0 && r.seq != null && this._seq() < r.seq;
    } catch (e) {
      this.estado = e.message === "token" ? "sin-llave"
        : e.message === "sesion" ? "sin-sesion"
        : e.message === "rol" ? "sin-permiso"
        : e.message === "cuota" ? "sin-cuota"
        : "sin-senal";
    }
  },

  /* Un latido cada 20 s diciendo en qué pantalla está este aparato. Es lo que
     alimenta la pantalla de estado del administrador. No lleva ningún dato del
     proyecto: nombre del aparato, quién tiene la sesión abierta y la pantalla.
     Si falla no se reintenta ni se encola — es una foto del momento, y una foto
     que se perdió ya no interesa. */
  _latir() {
    if (!qcSyncActivo()) return;
    const ahora = Date.now();
    if (this._ultimoLatido && ahora - this._ultimoLatido < 20000) return;
    this._ultimoLatido = ahora;
    const pagina = (location.pathname.split("/").pop() || "index.html");
    this._pedir("/api/latido", {
      method: "POST",
      body: JSON.stringify({ dev: qcAparato(), usr: localStorage.getItem("qc-user") || "?", pagina }),
    }).then((r) => { if (r && r.fuera) this._echar(); }).catch(() => {});
  },

  /* Nos desconectaron desde Estado del sistema — Q-77.

     **Desconectar es soltar el aparato del servidor, no solo cerrarle la
     sesión** (Víctor, 8 ago 2026). La diferencia importa: cerrar la sesión deja
     al aparato con la llave del proyecto en el bolsillo, así que seguía
     conectado y seguía latiendo. Aquí se le quita la llave y la dirección del
     servidor, que es lo que lo tiene enchufado. A partir de este momento no
     sincroniza, no late y desaparece de la lista de aparatos.

     Para volver hace falta **el enlace de conexión**, no solo la clave. Es caro
     a propósito: es lo que hace que «desconectado» quiera decir desconectado.

     **Lo encolado NO se borra.** Si el técnico tenía tres muestras sin subir
     cuando lo desconectaron, siguen en la cola y salen en cuanto alguien vuelva
     a conectar el aparato. Desconectar es echar a quien lo está usando, no
     tirar su trabajo — y esa diferencia, el día que pase, es todo.

     Tampoco se borra `qc-dev`: el aparato vuelve con su mismo nombre y su
     historial en la lista sigue teniendo sentido. */
  _echar() {
    if (this._echado) return;          // el ciclo va cada 3 s; una vez basta
    this._echado = true;
    localStorage.removeItem(QC_API_URL);
    localStorage.removeItem(QC_API_TOKEN);
    localStorage.removeItem("qc-auth");
    localStorage.removeItem("qc-user");
    localStorage.removeItem("qc-sesion");
    localStorage.removeItem("qc-ident");
    location.href = "index.html?fuera=1";
  },

  async _ciclo() {
    this._latir();
    await this._empujar();
    await this._bajar();
    /* La franja de arriba lleva el estado real de la sincronización, y está en
       todas las pantallas: es donde el técnico se entera de que lleva media
       hora entrando muestras que no salen del aparato. */
    if (typeof pintarConexion === "function") pintarConexion();
  },

  arrancar() {
    if (!qcSyncActivo()) { this.estado = "apagado"; return; }
    this.estado = "conectando";
    this._estrenarBase();
    this.pendientes = this._cola().length;
    clearInterval(this._timer);
    const paso = () => this._ciclo();
    paso();

    /* **Las pantallas de campo miran siempre rápido, escondidas o no.**
       El Field Display y Muestras existen para verse en vivo: uno cuelga en la
       obra sin que nadie lo toque y el otro está en la mano del técnico. Y
       resulta que `document.hidden` sale `true` en sitios donde la pantalla se
       está viendo perfectamente —una aplicación guardada en la pantalla de
       inicio del iPhone es el caso—, así que bajarlas a 20 s las dejaba
       muertas: Rubén entraba datos en la PC y el Field Display del teléfono
       tardaba en enterarse. Las demás sí se relajan cuando nadie mira. */
    const RAPIDA = /(display|muestras)\.html/.test(location.pathname);
    const arrancarTimer = () => {
      clearInterval(this._timer);
      this._timer = setInterval(paso, (!RAPIDA && document.hidden) ? 20000 : 3000);
    };
    arrancarTimer();

    /* iOS congela el JavaScript de una página que pasa a segundo plano y la
       descongela al volver. Sin estos avisos, volver a la aplicación enseñaba
       lo de hace un rato hasta que saltara el próximo intervalo. */
    document.addEventListener("visibilitychange", () => { arrancarTimer(); if (!document.hidden) paso(); });
    window.addEventListener("pageshow", paso);
    window.addEventListener("focus", paso);
    window.addEventListener("online", paso);
  },
};
