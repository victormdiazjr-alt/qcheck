/* ============================================================
   LAS FOTOS DE LOS CONDUCES — Q-153, 29 de agosto de 2026.

   Víctor: «hazlo con R2 entonces».

   La foto del conduce se guardaba dentro de la ficha del camión, así que
   viajaba a todos los aparatos y se quedaba en el registro para siempre.
   Veinte camiones al día son 2 MB diarios dentro de un almacén de 5 MB.

   Ahora se guarda una vez en el archivador y en la ficha queda el enlace
   (`photoRef`), que son sesenta bytes. El iPad no se baja ninguna foto; solo la
   que alguien abre, y una vez abierta el navegador se la queda.

   LO QUE ESTE ARCHIVO EXISTE PARA RESOLVER
   ----------------------------------------
   Que el técnico escanea el conduce **sin cobertura**. Ahí no se puede subir
   nada, y la foto es prueba: perderla no es una opción, y meterla en la ficha
   —que es lo que hacía antes— tampoco.

   Así que la foto espera en un cajón aparte del aparato (`qc-fotos`), que NO
   viaja ni se sincroniza, y sube en cuanto hay señal. Cuando sube, se le pone
   el enlace a su camión y el cajón se vacía.

   > El camión entra igual, con señal o sin ella. La foto lo alcanza después.

   Y si el cajón se llena o el aparato no tiene sitio, se dice — nunca se tira
   una prueba en silencio.
   ============================================================ */
"use strict";

const QC_FOTOS = "qc-fotos";          /* cajón local: NO viaja, no se sincroniza */

function _fotosCajon() {
  try { return JSON.parse(localStorage.getItem(QC_FOTOS) || "[]"); } catch (_) { return []; }
}
function _fotosGuardar(c) {
  try { localStorage.setItem(QC_FOTOS, JSON.stringify(c)); return true; }
  catch (e) {
    try { console.error("QCheck: no cabe la foto del conduce en este aparato", e); } catch (_) {}
    if (typeof avisarAlmacenLleno === "function") avisarAlmacenLleno(e);
    return false;
  }
}
function fotosPendientes() { return _fotosCajon().length; }

/* Manda una foto al archivador. Devuelve la clave, o `null` si no se pudo. */
async function subirFoto(dataUrl, datos) {
  const api = typeof qcApiURL === "function" ? qcApiURL() : "";
  if (!api || !dataUrl) return null;
  const cab = { "Content-Type": "application/json" };
  const tk = typeof qcApiToken === "function" ? qcApiToken() : "";
  if (tk) cab["X-QC-Token"] = tk;
  const ses = localStorage.getItem("qc-sesion");
  if (ses) cab["X-QC-Sesion"] = ses;
  try {
    const r = await fetch(api + "/api/foto", {
      method: "POST", headers: cab,
      body: JSON.stringify({
        imagen: String(dataUrl).split(",")[1],
        tipo: "image/jpeg",
        uid: (datos && datos.uid) || null,
        ticket: (datos && datos.ticket) || null,
        dev: typeof qcAparato === "function" ? qcAparato() : "?",
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.clave ? d.clave : null;
  } catch (_) { return null; }
}

/* Guarda la foto de un camión: la sube si puede, y si no la deja esperando.
   Nunca devuelve la foto para meterla en la ficha — ese camino se cerró. */
async function archivarConduce(dataUrl, test) {
  if (!dataUrl || !test) return null;
  const clave = await subirFoto(dataUrl, { uid: test.id, ticket: test.ticket });
  if (clave) { test.photoRef = clave; return clave; }
  /* Sin señal: al cajón, con el id del camión para saber a quién pertenece. */
  const c = _fotosCajon();
  c.push({ id: test.id, ticket: test.ticket || null, dataUrl, ts: new Date().toISOString() });
  _fotosGuardar(c);
  try { console.warn(`QCheck: la foto del conduce ${test.ticket || ""} espera a que vuelva la señal (${c.length} en cola)`); } catch (_) {}
  return null;
}

/* Vacía el cajón cuando hay señal. Se llama sola desde el ciclo de
   sincronización, y una a una: si falla la primera, no se insiste con el resto
   —no hay señal— y se deja para la vuelta siguiente. */
async function subirFotosPendientes() {
  const c = _fotosCajon();
  if (!c.length) return 0;
  if (typeof qcSyncActivo === "function" && !qcSyncActivo()) return 0;
  let subidas = 0;
  while (c.length) {
    const f = c[0];
    const clave = await subirFoto(f.dataUrl, { uid: f.id, ticket: f.ticket });
    if (!clave) break;                      /* sigue sin señal: mañana será */
    c.shift(); subidas++;
    /* Se le pone el enlace a su camión, y eso sí viaja como un cambio normal. */
    const t = (typeof db !== "undefined" && (db.tests || []).find((x) => x.id === f.id));
    if (t) { t.photoRef = clave; if (typeof saveDB === "function") saveDB(); }
  }
  _fotosGuardar(c);
  if (subidas) { try { console.info(`QCheck: subidas ${subidas} foto(s) de conduce que esperaban señal`); } catch (_) {} }
  return subidas;
}

/* De dónde sale la imagen de un camión, en el orden en que se debe intentar:
   el archivador primero, y la foto vieja guardada dentro de la ficha después —
   que ya no se crea, pero puede existir en una base de antes. */
function fuenteDelConduce(t) {
  if (!t) return null;
  if (t.photoRef) {
    const api = typeof qcApiURL === "function" ? qcApiURL() : "";
    if (!api) return null;
    return api + "/api/foto?clave=" + encodeURIComponent(t.photoRef);
  }
  return t.photo || null;
}

/* La foto que todavía espera en el cajón de este aparato — para poder verla
   antes de que suba, que si no el técnico no puede comprobar lo que capturó. */
function conduceEnEspera(id) {
  const f = _fotosCajon().find((x) => x.id === id);
  return f ? f.dataUrl : null;
}
