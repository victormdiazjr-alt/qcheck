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

/* CUÁNTO PUEDE ESPERAR EL CAJÓN — Q-157, 30 de agosto de 2026.

   Medido: una foto de conduce guardada (900 px, calidad 0.6) pesa **130 KB**.
   Veinte camiones sin cobertura son 2,5 MB, y el almacén entero del navegador
   son unos 5 MB con la base ocupando ya cerca de uno. O sea: el cajón de fotos
   podía llevar al aparato exactamente contra la pared que acabábamos de quitar
   — por la puerta que abrimos al archivar en R2.

   Con señal esto no pasa nunca: la foto sube y no toca el cajón. Solo se llena
   en un tiro largo sin cobertura, que es justo cuando menos se puede fallar.

   Así que hay una escalera, y ningún escalón tira una prueba en silencio:

     1. Cabe entera, en la calidad buena que va al archivo.
     2. No cabe → se guarda una copia más pequeña (600 px, 0.45 ≈ 50 KB). Una
        foto legible más ligera es mejor prueba que ninguna foto.
     3. Tampoco cabe → NO se guarda, y se dice en voz alta, diciendo qué hacer.
        El camión queda registrado igual; lo que falta es la foto, y quien está
        delante tiene que saberlo para sacarla con el teléfono. */
const TOPE_CAJON = 1200000;           /* ~1,2 MB: nueve fotos buenas o veinticuatro reducidas */

function _pesoCajon(c) { return c.reduce((n, f) => n + (f.dataUrl || "").length, 0); }

/* Vuelve a comprimir una foto más pequeña. Devuelve la original si no se puede
   —mejor la grande que ninguna—, y quien llama decide si cabe. */
function _reducirMas(dataUrl) {
  return new Promise((listo) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          const e = Math.min(1, 600 / img.naturalWidth);
          c.width = Math.round(img.naturalWidth * e);
          c.height = Math.round(img.naturalHeight * e);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          listo(c.toDataURL("image/jpeg", 0.45));
        } catch (_) { listo(dataUrl); }
      };
      img.onerror = () => listo(dataUrl);
      img.src = dataUrl;
    } catch (_) { listo(dataUrl); }
  });
}

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
  /* Sin señal: al cajón, con el id del camión para saber a quién pertenece.
     Y por la escalera de Q-157, que el cajón tiene tope. */
  const c = _fotosCajon();
  const usado = _pesoCajon(c);
  let guardar = dataUrl;
  let reducida = false;
  if (usado + guardar.length > TOPE_CAJON) {
    guardar = await _reducirMas(dataUrl);
    reducida = guardar !== dataUrl;
  }
  if (usado + guardar.length > TOPE_CAJON) {
    /* Escalón 3: no cabe ni reducida. Se dice, con lo que hay que hacer. */
    const msg = "No se pudo guardar la foto de este conduce: el aparato está lleno " +
      "y ya hay " + c.length + " esperando a que vuelva la señal.\n\n" +
      "EL CAMIÓN SÍ QUEDÓ REGISTRADO — lo que falta es la foto.\n" +
      "Sácale una con la cámara del teléfono y guárdala tú hasta que haya cobertura.";
    try { console.error("QCheck: " + msg.replace(/\n/g, " ")); } catch (_) {}
    try { if (typeof alert === "function") alert(msg); } catch (_) {}
    return null;
  }
  c.push({ id: test.id, ticket: test.ticket || null, dataUrl: guardar,
           reducida: reducida || undefined, ts: new Date().toISOString() });
  _fotosGuardar(c);
  try {
    console.warn(`QCheck: la foto del conduce ${test.ticket || ""} espera señal` +
      ` (${c.length} en cola, ${Math.round(_pesoCajon(c) / 1024)} KB${reducida ? ", esta reducida por falta de sitio" : ""})`);
  } catch (_) {}
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

/* UNA ETIQUETA `<img>` NO SABE ENSEÑAR EL PASE — Q-158, 30 de agosto de 2026.

   El archivador pide sesión, como todo lo demás. Y una `<img src="...">` no
   puede mandar cabeceras: el navegador pide esa URL a pelo, sin el pase, y el
   servidor contesta 401. O sea que el visor de conduces **nunca habría podido
   enseñar una foto en producción**, donde `exigir_sesion` está encendido.

   Lo cazó el ensayo general por otra puerta, y menos mal: es de las que no se
   ven hasta que alguien intenta mirar un conduce delante de un chofer.

   La salida limpia no es abrir el archivador ni meter el pase en la dirección
   —que acaba en los registros del servidor y en el historial del navegador—:
   es pedir la foto como se piden las demás cosas, con el pase en la cabecera, y
   dársela a la etiqueta ya descargada. Eso es un `blob`.

   Quien lo use tiene que soltarlo después (`URL.revokeObjectURL`), que si no la
   memoria se va llenando de conduces mirados. */
async function cargarConduce(t) {
  if (!t) return null;
  /* La que todavía espera señal ya está aquí: se enseña tal cual. */
  if (typeof conduceEnEspera === "function") {
    const local = conduceEnEspera(t.id);
    if (local) return { src: local, soltar: () => {} };
  }
  if (t.photo) return { src: t.photo, soltar: () => {} };   /* base de antes */
  const url = fuenteDelConduce(t);
  if (!url) return null;
  const cab = {};
  const tk = typeof qcApiToken === "function" ? qcApiToken() : "";
  if (tk) cab["X-QC-Token"] = tk;
  const ses = localStorage.getItem("qc-sesion");
  if (ses) cab["X-QC-Sesion"] = ses;
  try {
    const r = await fetch(url, { headers: cab });
    if (!r.ok) return null;
    const b = await r.blob();
    const src = URL.createObjectURL(b);
    return { src, soltar: () => { try { URL.revokeObjectURL(src); } catch (_) {} } };
  } catch (_) { return null; }
}

/* La dirección de la foto en el archivador. Sirve para pedirla con cabeceras
   —ver `cargarConduce`—, NO para metérsela a una `<img>` directamente. */
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
