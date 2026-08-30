/* ============================================================
   LEER EL CÓDIGO DE UN CONDUCE — Q-163, 30 de agosto de 2026.

   Víctor: «desde Muestras que haya un botón de ＋Camión y cuando le das te da
   a escoger si escanear QR code, escanear conduce o entrar a mano».

   El escáner vivía entero dentro de Recepción. Copiarlo a Muestras habría
   dejado dos lectores distintos leyendo el mismo papel, y el día que uno se
   arregle —como se acaba de arreglar el de Safari, Q-161— el otro se queda
   roto y nadie se entera hasta que hay un camión delante.

   Así que aquí vive una sola vez, y las dos pantallas lo llaman. Este archivo
   NO toca formularios: abre la cámara, mira fotogramas y devuelve lo que leyó.
   Qué hacer con ello lo decide cada pantalla, porque los campos se llaman
   distinto en cada una y eso es cosa suya.

   LAS TRES PIEZAS
   ---------------
     · `escanearQR()`  — abre la cámara y avisa cuando lee un código.
     · `pararQR()`     — la cierra y suelta todo. Hay que llamarla siempre.
     · `leerCodigoDeConduce()` — texto del código → qué es y qué trae.
   ============================================================ */
"use strict";

let _qrStream = null, _qrTimer = null, _qrCuarto = null, _qrObrero = null;

/* Abre el cuarto cerrado donde corre el lector de fuera — Q-81.

   Devuelve una función: se le da un fotograma, contesta el texto del código o
   `null`. El Worker se abre la PRIMERA vez que alguien pulsa «Escanear QR» y no
   antes: quien solo saca fotos de conduces no descarga esos 130 KB nunca. */
function abrirCuartoDelQR() {
  if (_qrCuarto) return _qrCuarto;
  const w = _qrObrero = new Worker("assets/qr-aislado.js");
  const esperando = new Map();
  let siguiente = 0;
  w.onmessage = (e) => {
    const { id, texto } = e.data || {};
    const ok = esperando.get(id);
    if (ok) { esperando.delete(id); ok(texto); }
  };
  /* Si el cuarto se cae, se contesta que no hay código y la cámara sigue: es
     preferible un escáner que no encuentra nada a una pantalla congelada con
     un camión esperando. */
  w.onerror = () => { for (const ok of esperando.values()) ok(null); esperando.clear(); };

  _qrCuarto = (imageData) => new Promise((ok) => {
    if (!_qrCuarto) return ok(null);
    const id = ++siguiente;
    esperando.set(id, ok);
    /* Los píxeles se MUEVEN, no se copian: 640×480 son 1,2 MB por fotograma y
       tres fotogramas por segundo. Copiarlos calienta el iPad para nada. */
    const datos = imageData.data;
    w.postMessage({ id, datos, ancho: imageData.width, alto: imageData.height },
                  [datos.buffer]);
    setTimeout(() => { if (esperando.delete(id)) ok(null); }, 3000);
  });
  return _qrCuarto;
}

/* Se cierra al salir del escáner. `terminate()` y no solo soltar la variable:
   sin eso el Worker sigue vivo con sus 130 KB dentro hasta que se cierre la
   pestaña, y en un iPad de obra eso se nota. */
function cerrarCuartoDelQR() {
  if (_qrObrero) { _qrObrero.terminate(); _qrObrero = null; }
  _qrCuarto = null;
}

/* Para la cámara y suelta todo. Se puede llamar dos veces sin que pase nada:
   la llaman el botón de cerrar, el propio escáner al leer, y la pantalla al
   irse — y las tres tienen que poder hacerlo sin mirar si ya estaba parado. */
function pararQR(wrap) {
  cerrarCuartoDelQR();
  if (_qrTimer) clearInterval(_qrTimer);
  if (_qrStream) _qrStream.getTracks().forEach((t) => t.stop());
  _qrTimer = _qrStream = null;
  if (wrap) wrap.style.display = "none";
}

/* Abre la cámara y empieza a mirar. `alLeer` se llama con el texto del código.
   Quien llama decide si sigue mirando o para — normalmente para. */
async function escanearQR({ wrap, video, nota, alLeer }) {
  /* LA CÁMARA PRIMERO, Y EL LECTOR DE QR DESPUÉS — Q-78.

     Antes se preguntaba por `BarcodeDetector` antes de nada, así que en un
     iPhone o un iPad el botón no encendía la cámara: soltaba un aviso y ahí se
     acababa. Safari no trae ese lector, y ese es justo el aparato que está en
     la obra.

     Ahora la cámara se abre siempre. Si el navegador sabe leer QR, lee; si no,
     se ve por la pantalla y se dice con todas las letras que en este aparato
     hay que apuntar el número a mano o escanear el conduce con la otra puerta.
     Enseñar la cámara y decir la verdad es mejor que un botón que no hace nada:
     el técnico ve que el aparato responde y sabe qué hacer a continuación. */
  try {
    _qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch (e) {
    /* En iOS la cámara solo se abre sobre HTTPS. Si se entra por IP a pelo, el
       navegador la niega y el mensaje del error no lo explica. */
    alert("No se pudo abrir la cámara: " + e.message
      + (location.protocol !== "https:" ? "\n\nEste aparato está entrando por " + location.protocol
         + " — la cámara solo funciona por https." : ""));
    return false;
  }

  video.srcObject = _qrStream;
  await video.play();
  if (wrap) wrap.style.display = "block";
  if (nota) nota.textContent = "";

  /* Dos maneras de leer el código, y se prueba la buena primero — Q-80.

     `BarcodeDetector` lo trae Chrome de Android y lo resuelve el propio
     sistema: rápido y sin cargar nada. Safari NO lo trae, y el aparato de la
     obra es un iPad, así que ahí se cae al lector propio (`assets/qr-lector.js`).

     OJO CON LO QUE SE ESCRIBE FUERA DE ESTE `if` — Q-161. Aquí había quedado un
     `new BarcodeDetector(...)` suelto, en el ámbito de la función, y en Safari
     lanzaba `ReferenceError` antes de armar el temporizador: la cámara se abría
     y no leía un código jamás. Nada que nombre `BarcodeDetector` puede vivir
     fuera de su rama. */
  let mirar;
  if ("BarcodeDetector" in window) {
    const detector = new BarcodeDetector({ formats: ["qr_code", "code_128", "code_39"] });
    mirar = async () => {
      const codes = await detector.detect(video);
      return codes.length ? codes[0].rawValue : null;
    };
  } else {
    /* El lector de fuera NO corre aquí — Q-81. Corre en un cuarto cerrado
       (`assets/qr-aislado.js`), donde el navegador no le da ni `localStorage` ni
       `sessionStorage` ni `document`. Entran píxeles, sale texto. Si esa pieza
       fuera maliciosa, no tendría desde dónde ver la llave del proyecto.

       Ver DECISIONS §57. */
    let cuarto;
    try {
      cuarto = abrirCuartoDelQR();
    } catch (_) {
      if (nota) nota.textContent =
        "No se pudo abrir el lector de códigos. Usa «Escanear conduce» o entra el ticket a mano.";
      return false;
    }
    /* El fotograma se mira reducido a 640 px de ancho. A tamaño completo el
       iPad tarda más en cada pasada que lo que dura la pasada, y la cámara se
       ve a tirones justo cuando hace falta apuntar bien. */
    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("2d", { willReadFrequently: true });
    mirar = async () => {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return null;
      const escala = Math.min(1, 640 / w);
      lienzo.width = Math.round(w * escala);
      lienzo.height = Math.round(h * escala);
      ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
      const d = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
      return await cuarto(d);
    };
  }
  _qrTimer = setInterval(async () => {
    try {
      const leido = await mirar();
      if (leido) alLeer(leido);
    } catch (_) {}
  }, 400);
  return true;
}

/* ------------------------------------------------------------ qué dice el código

   ¿Es esto el enlace de un conduce de QTicket? — Q-82.

   El QR que imprime QTicket NO lleva los datos dentro: lleva una dirección,
   `<lo que sea>/c/<id>`. No caben en un código: la ficha entera del contrato
   son ochocientos y pico caracteres y el generador de QTicket llega hasta unos
   doscientos. Así que el código lleva la llave y los datos se piden.

   Se reconoce por la FORMA, no por el dominio: cada concretera tendrá el suyo.
   Y solo por https —o localhost, para probar—, porque un QR lo imprime
   cualquiera y esto es texto que llega de fuera. */
function enlaceDeQTicket(raw, permitidos) {
  let u;
  try { u = new URL(String(raw).trim()); } catch (_) { return null; }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
  const m = u.pathname.match(/^\/c\/([0-9A-Za-z]{1,64})$/);
  if (!m) return null;

  /* Y EL SERVIDOR TIENE QUE SER UNO DE LOS DEL PROYECTO — Q-82.

     Sin esto, cualquiera imprime un QR con su propia dirección, lo cuela en el
     montón de conduces, y QCheck le pide los datos a un servidor de fuera y
     rellena el formulario con lo que le manden. Con choferes que ya alteran
     conduces a bolígrafo (banco de reglas 04), eso no es una hipótesis.

     La lista vive en el plan del proyecto, no en el código: cada concretera
     tendrá su dominio, y quien da de alta el proyecto es quien sabe cuál es.
     **Vacía por defecto: hasta que alguien la ponga, no se pide nada a nadie.**
     Puerta cerrada mientras no exista QTicket, que es hoy. */
  const lista = (permitidos || []).map((h) => String(h).toLowerCase());
  if (!lista.includes(u.hostname.toLowerCase())) {
    return { id: m[1], url: u.href, host: u.hostname, desconocido: true };
  }
  return { id: m[1], url: u.href, host: u.hostname };
}

/* Texto de un código → qué es. No toca ninguna pantalla: devuelve y ya.

     { tipo: "qticket",  enlace }            hay que pedirle la ficha
     { tipo: "ajeno",    host }              apunta a un servidor que no es del proyecto
     { tipo: "campos",   campos }            los datos venían dentro del código
     null                                    no se entiende */
function leerCodigoDeConduce(raw, permitidos) {
  const enlace = enlaceDeQTicket(raw, permitidos);
  if (enlace && enlace.desconocido) return { tipo: "ajeno", host: enlace.host, enlace };
  if (enlace) return { tipo: "qticket", enlace };

  /* Y si no es un enlace, lo desmonta el contrato — que sabe de las tres formas
     que existen: la dirección con fragmento (v4), el JSON de v1 a v3, y el
     delimitado de los sistemas ajenos. Antes esto se parseaba a mano aquí y se
     perdía la primera de las tres. */
  let d = null;
  if (typeof decodeConduceQR === "function") d = decodeConduceQR(raw);
  if (!d) {
    try { d = JSON.parse(raw); } catch (_) {
      const p = String(raw).trim().split(/[;|,]/).map((x) => x.trim());
      d = p[0] ? { ticket: p[0], truck: p[1], vol: p[2], batch: p[3] } : null;
    }
  }
  if (!d || !d.ticket) return null;

  /* Y UN NÚMERO DE CONDUCE TIENE QUE PARECERLO — Q-163, 30 de agosto de 2026.

     Las tres formas de leer un código acaban en un respaldo que parte el texto
     por `;` y se queda con el primer trozo. O sea: **cualquier texto que no
     estuviera vacío pasaba por número de conduce**.

     Con el escáner mirando también códigos de barras `code_128` y `code_39`,
     en una obra eso no es teórico: la etiqueta de una paleta, el código de una
     pieza o la pegatina de un extintor entraban como ticket, y el técnico se
     encontraba el campo relleno con algo que parecía leído del conduce. Un
     hueco se ve; un dato inventado se firma.

     Un número de conduce es corto y no lleva espacios. Lo que no lo parezca no
     se entiende — y no entender es la respuesta correcta.

     La comprobación va AQUÍ y no en el contrato: el contrato lo comparten los
     dos productos y su respaldo delimitado existe para tragarse formatos
     ajenos. Quien decide si esto es un conduce de esta obra es quien lo va a
     meter en el expediente. */
  const tk = String(d.ticket).trim();
  if (!/^[A-Za-z0-9\-]{1,20}$/.test(tk)) return null;
  return { tipo: "campos", campos: {
    ticket: tk,
    truck: d.truck == null ? null : String(d.truck),
    vol: d.vol == null || d.vol === "" ? null : Number(d.vol),
    batch: /^\d{1,2}:\d{2}$/.test(String(d.batch || "")) ? String(d.batch).padStart(5, "0") : null,
    mix: d.mix || null, company: d.company || null, plant: d.plant || null,
  } };
}

/* Pide la ficha del conduce a QTicket.

   **Lo que llega por aquí es de fuera y no se firma solo.** Un QR lo imprime
   cualquiera; esto rellena el formulario para que el técnico lo mire, igual
   que la foto. No se manda ninguna llave nuestra en la petición: ese servidor
   es de la concretera, no nuestro.

   Devuelve la ficha, o `null` con el motivo en `alAvisar` — que no es el fin:
   el número de conduce sigue estando en el enlace y con eso se puede seguir a
   mano. */
async function pedirConduceAQTicket(enlace, alAvisar) {
  if (alAvisar) alAvisar("Pidiendo el conduce a QTicket…", false);
  try {
    const r = await fetch(enlace.url + ".json", { credentials: "omit", mode: "cors" });
    if (!r.ok) throw new Error("contestó " + r.status);
    const d = await r.json();
    if (alAvisar) alAvisar("", false);
    return d;
  } catch (e) {
    if (alAvisar) alAvisar("Se leyó el código de QTicket (" + enlace.id +
      ") pero no se pudo pedir la ficha: " + e.message + ". Entra los datos a mano.", true);
    return null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { escanearQR, pararQR, leerCodigoDeConduce, enlaceDeQTicket,
    pedirConduceAQTicket, abrirCuartoDelQR, cerrarCuartoDelQR };
}
