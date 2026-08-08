/* ============================================================
   SINCRONIZACIÓN — el registro de cambios.

   Node puro, sin una sola dependencia. Lo monta `serve.js` para
   trabajar en local y en la red de la obra, y la misma lógica se
   despliega tal cual en Cloudflare Workers (ver `sync-worker.js`).

   POR QUÉ UN REGISTRO DE CAMBIOS Y NO "SUBIR LA BASE"
   ---------------------------------------------------
   Mandar la base entera de un lado a otro rompe en cuanto dos
   personas trabajan a la vez: el iPad escribe el Slump del camión
   407 mientras Recepción le sella "Termina vaciado" al MISMO
   camión, y el último en subir borra lo del otro.

   Aquí lo que viaja es una línea por cambio:

       camión 407 · slump · 3.0 · 22:56 · iPad de Rubén

   El servidor las numera en orden de llegada y cada aparato pide
   "dame lo que pasó desde la número N". Con eso:

   - Dos aparatos pueden tocar el mismo camión a la vez si tocan
     campos distintos, y no se pisan.
   - Queda la línea de tiempo completa de cada conduce: quién entró
     qué y cuándo. Eso es el expediente que pide la ACT, y sale de
     regalo (Q-05).
   - Lo que no se pudo subir se encola y sube al volver la señal.
     En obra eso va a pasar.

   EL REGISTRO NO SE EDITA NI SE BORRA. Es un archivo al que solo
   se le añaden líneas. Si un dato quedó mal, se corrige con otra
   línea encima, y las dos quedan. Un expediente de calidad que se
   puede reescribir por detrás no vale nada.
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

/* ------------------------------------------------------------ almacén

   Un archivo JSONL: una línea por cambio, se abre con cualquier
   editor y se lee. Para la escala de esto —unos miles de líneas al
   mes— sobra, y no arrastra una base de datos detrás. */
function crearAlmacen(archivo) {
  const ops = [];
  const vistos = new Set();   // uid de cada cambio, para que un reintento no duplique
  let seq = 0;

  if (fs.existsSync(archivo)) {
    for (const linea of fs.readFileSync(archivo, "utf8").split("\n")) {
      if (!linea.trim()) continue;
      try {
        const o = JSON.parse(linea);
        ops.push(o);
        if (o.uid) vistos.add(o.uid);
        if (o.seq > seq) seq = o.seq;
      } catch (_) { /* una línea rota no tumba el registro entero */ }
    }
  } else {
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
  }

  return {
    seq: () => seq,
    total: () => ops.length,

    /* Lo que pasó después de `desde`. El tope evita que un aparato que
       lleva un mes apagado se traiga medio proyecto de un tirón. */
    desde(desde, tope = 2000) {
      const fuera = [];
      for (const o of ops) {
        if (o.seq > desde) {
          fuera.push(o);
          if (fuera.length >= tope) break;
        }
      }
      return fuera;
    },

    /* Todo lo que le ha pasado a UN registro, en orden. Es lo que hace posible
       la línea de tiempo de un conduce (Q-05): el dato ya estaba aquí desde
       Q-02 —cada línea dice qué campo cambió, cuándo y quién— y lo único que
       faltaba era poder pedirlo por registro en vez de por número de cambio. */
    deRegistro(ent, id) {
      return ops.filter((o) => o.ent === ent && String(o.id) === String(id));
    },

    /* Las últimas `n`, de la más reciente hacia atrás — Q-36. */
    ultimas(n = 120) {
      return ops.slice(Math.max(0, ops.length - n)).reverse();
    },

    /* Añade y devuelve las que entraron de verdad. Un cambio que ya
       estaba —el aparato reintentó porque se cayó la señal justo al
       contestar— se reconoce por su uid y no se duplica.

       `autor` es quien firma, y cuando viene NO se negocia: lo pone el
       servidor desde la sesión y pisa lo que traiga el cuerpo. Ver Q-07. */
    anadir(entradas, autor) {
      const nuevas = [];
      for (const e of entradas) {
        if (!e || !e.ent || !e.campo) continue;
        if (e.uid && vistos.has(e.uid)) continue;
        const o = {
          seq: ++seq,
          uid: e.uid || `s${seq}`,
          ent: String(e.ent),
          id: String(e.id == null ? "" : e.id),
          campo: String(e.campo),
          valor: e.valor === undefined ? null : e.valor,
          ts: e.ts || new Date().toISOString(),
          dev: e.dev || "?",
          usr: autor != null ? autor : (e.usr || "?"),
        };
        ops.push(o);
        vistos.add(o.uid);
        nuevas.push(o);
      }
      if (nuevas.length) {
        fs.appendFileSync(archivo, nuevas.map((o) => JSON.stringify(o)).join("\n") + "\n");
      }
      return nuevas;
    },
  };
}

/* ------------------------------------------------------------ Q-07: quién firma

   Las claves NO se guardan. Se guarda el resultado de derivarlas con
   PBKDF2-SHA256 y una sal propia de cada usuario, que es lo que impide que
   dos personas con la misma clave den el mismo hash.

   Todo esto sale de `crypto.subtle`, que viene dentro de Node y dentro de
   Cloudflare Workers. **No añade una sola dependencia** —la regla del §1 de
   DECISIONS sigue en pie— y por eso el código de aquí y el de `sync-worker.js`
   son el mismo salvo el almacén. */

/* 100.000 y NO MÁS: es el techo que impone Cloudflare Workers a PBKDF2, y este
   número tiene que ser el MISMO que el de `sync-worker.js` — una clave creada
   aquí, en la laptop de la obra, se comprueba después contra Cloudflare. Node
   aguantaría más, pero entonces la cuenta entraría en un sitio y no en el otro.

   Lo que compensa el techo es de dónde salen las claves: `cuentas.js` las
   inventa con unos 115 bits de entropía, y contra eso las vueltas dan igual.
   Protegen a la clave escrita a mano, y por eso ahí se exigen 12 caracteres. */
const VUELTAS = 100000;
const SESION_HORAS = 12;       /* lo que dura un turno; se estira con el uso */

function aHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function deHex(s) {
  const a = new Uint8Array(s.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(s.substr(i * 2, 2), 16);
  return a;
}
function alAzar(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return aHex(a);
}
async function derivarClave(clave, sal, vueltas) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveBits"]);
  const b = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: deHex(sal), iterations: vueltas, hash: "SHA-256" }, k, 256);
  return aHex(b);
}
async function huella(texto) {
  return aHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
}

/* Comparar con `===` tarda distinto según cuántos caracteres coinciden, y de
   esa diferencia se puede sacar el valor bueno a base de intentos. Aquí se
   recorre entero siempre. */
function mismoSecreto(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* ------------------------------------------------------------ cuentas y sesiones

   Dos archivos JSON al lado del registro de cambios, en `datos/`, que está en
   `.gitignore`: **este repositorio es público y una clave dentro de él no es
   una clave**, ni aunque esté derivada.

   Las sesiones se guardan en disco y no en memoria a propósito. Reiniciar el
   servidor de la obra —porque se actualizó, porque se fue la luz— no puede
   devolver a la pantalla de acceso al iPad que está en mitad de un vaciado. */
function crearCuentas(dir) {
  const fu = path.join(dir, "usuarios.json");
  const fs_ = path.join(dir, "sesiones.json");
  const leerJSON = (f, x) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (_) { return x; } };

  fs.mkdirSync(dir, { recursive: true });
  let usuarios = leerJSON(fu, {});
  let sesiones = leerJSON(fs_, {});
  let ajustes = leerJSON(path.join(dir, "ajustes.json"), {});

  const guardarU = () => fs.writeFileSync(fu, JSON.stringify(usuarios, null, 2));
  const guardarS = () => fs.writeFileSync(fs_, JSON.stringify(sesiones, null, 2));
  const guardarA = () => fs.writeFileSync(path.join(dir, "ajustes.json"), JSON.stringify(ajustes, null, 2));

  return {
    hayUsuarios: () => Object.keys(usuarios).length > 0,
    exigeSesion: () => ajustes.exigir_sesion === true,
    ponerAjuste(clave, valor) { ajustes[clave] = valor; guardarA(); },

    listar: () => Object.values(usuarios).map((u) => ({
      usr: u.usr, nombre: u.nombre, rol: u.rol, tablero: !!u.tablero,
      config: !!u.config, limites: !!u.limites, firma: !!u.firma, casa: u.casa || null,
      activo: u.activo !== false, creado: u.creado, visto: u.visto || null,
    })),

    async guardar(d) {
      const usr = String(d.usr || "").trim().toLowerCase();
      if (!usr) throw new Error("usuario");
      const antes = usuarios[usr] || {};
      const u = {
        usr,
        nombre: d.nombre != null ? String(d.nombre) : (antes.nombre || usr),
        rol: d.rol != null ? String(d.rol) : (antes.rol || "consulta"),
        tablero: d.tablero != null ? !!d.tablero : !!antes.tablero,
      /* `casa` y `limites` — Q-37, 6 ago 2026. `casa` es el tablero en el que
         vive una cuenta de consulta: entra ahí, no ve navegación y no puede
         salirse. `limites` abre la pantalla de Settings, que es la de Rubén y
         NO es «Plan & Datos». Las dos van en la cuenta y nunca se deducen del
         nombre de usuario (AGENTS §3). */
        config: d.config != null ? !!d.config : !!antes.config,
        limites: d.limites != null ? !!d.limites : !!antes.limites,
        firma: d.firma != null ? !!d.firma : !!antes.firma,
        casa: d.casa !== undefined ? (d.casa || null) : (antes.casa || null),
        activo: d.activo != null ? !!d.activo : antes.activo !== false,
        creado: antes.creado || new Date().toISOString(),
        visto: antes.visto || null,
        sal: antes.sal, hash: antes.hash, vueltas: antes.vueltas,
      };
      if (d.clave) {
        u.sal = alAzar(16);
        u.vueltas = VUELTAS;
        u.hash = await derivarClave(String(d.clave), u.sal, u.vueltas);
      }
      if (!u.hash) throw new Error("clave");
      if (u.rol !== "qc" && u.rol !== "consulta") throw new Error("rol");
      usuarios[usr] = u;
      guardarU();
      return u.usr;
    },

    /* Devuelve la sesión nueva, o null. Se tarda lo mismo con un usuario que
       no existe que con una clave mala: si contestara antes cuando el usuario
       no existe, se podría averiguar quién tiene cuenta a base de probar. */
    async entrar(usrCrudo, clave, dev) {
      const usr = String(usrCrudo || "").trim().toLowerCase();
      const u = usuarios[usr];
      const sal = u ? u.sal : "00000000000000000000000000000000";
      const vueltas = u ? u.vueltas : VUELTAS;
      const hash = await derivarClave(String(clave || ""), sal, vueltas);
      if (!u || u.activo === false || !mismoSecreto(hash, u.hash)) return null;

      const token = alAzar(32);
      const ahora = new Date();
      const vence = new Date(ahora.getTime() + SESION_HORAS * 3600e3);
      sesiones[await huella(token)] = {
        usr, dev: String(dev || "?").slice(0, 60),
        creada: ahora.toISOString(), vence: vence.toISOString(), visto: ahora.toISOString(),
      };
      u.visto = ahora.toISOString();
      guardarU(); guardarS();
      return { token, usuario: this.ficha(u), vence: vence.toISOString() };
    },

    ficha: (u) => ({
      usr: u.usr, nombre: u.nombre, rol: u.rol, tablero: !!u.tablero, config: !!u.config,
      limites: !!u.limites, firma: !!u.firma, casa: u.casa || null,
    }),

    /* Quién es el que trae este token. Estira el vencimiento: una sesión en
       uso no caduca, y la sincronización toca el servidor cada 3 segundos. */
    async deToken(token) {
      if (!token) return null;
      const s = sesiones[await huella(token)];
      if (!s) return null;
      const ahora = new Date();
      if (ahora > new Date(s.vence)) return null;
      const u = usuarios[s.usr];
      if (!u || u.activo === false) return null;
      s.visto = ahora.toISOString();
      s.vence = new Date(ahora.getTime() + SESION_HORAS * 3600e3).toISOString();
      guardarS();
      return this.ficha(u);
    },

    async salir(token) {
      if (!token) return;
      delete sesiones[await huella(token)];
      guardarS();
    },
  };
}

/* ------------------------------------------------------------ Q-01: leer el conduce

   Se llama por HTTP a pelo y no con el SDK de Anthropic a propósito: el SDK es
   una dependencia de npm y el §1 de DECISIONS no las admite. `fetch` ya viene
   dentro de Node.

   El esquema deja `null` en cada campo **a propósito**. Obligar a un tipo haría
   que el modelo rellenara el hueco con algo, y en este proyecto un número
   equivocado que parece bueno es peor que un hueco (DECISIONS §3). */
const QC_NULO = (t) => ({ anyOf: [{ type: t }, { type: "null" }] });
const QC_ESQUEMA_CONDUCE = {
  type: "object",
  properties: {
    ticket: QC_NULO("string"), truck: QC_NULO("string"), vol: QC_NULO("number"),
    batch: QC_NULO("string"),
    /* `plant` no se pide — ver la nota gemela en sync-worker.js (Q-56). */
    company: QC_NULO("string"), mix: QC_NULO("string"),
    /* Las yardas ORDENADAS del día, no las de este camión. Ver la nota gemela
       en sync-worker.js: los dos servidores tienen que dar la MISMA ficha. */
    ordenadas: QC_NULO("number"),
    ilegible: { type: "array", items: { type: "string" } },
  },
  required: ["ticket", "truck", "vol", "batch", "company", "mix", "ordenadas", "ilegible"],
  additionalProperties: false,
};
const QC_INSTRUCCIONES_CONDUCE = [
  "Esta es la foto de un conduce de hormigón premezclado (delivery ticket) de una obra en Puerto Rico.",
  "Saca solo los campos del esquema, tal como están impresos en el papel.",
  "",
  "REGLA QUE MANDA SOBRE TODO: si un campo no se lee con seguridad, devuélvelo como null",
  "y pon su nombre en `ilegible`. `ilegible` es para lo que ESTÁ en el papel y no se",
  "deja leer —borroso, cortado, tapado—. Si el conduce sencillamente no trae ese dato",
  "impreso, devuélvelo null y NO lo pongas en `ilegible`: no hay nada que revisar. No adivines, no completes, no deduzcas de otro campo,",
  "no arregles un dígito que se ve a medias. Este dato entra en un expediente de calidad",
  "que firma la Autoridad de Carreteras: un número equivocado que parece bueno hace más",
  "daño que un hueco, porque nadie lo va a mirar dos veces.",
  "",
  "- `vol` en yardas cúbicas, solo el número.",
  "- `batch` en formato de 24 horas, HH:MM. Es la hora que el CONDUCE trae impresa",
  "  en su cabecera, la que va al lado de la fecha y del número de camión, y que",
  "  suele repetirse abajo en «Salida de Planta». No la de ahora. Si el papel la",
  "  trae en 12 horas, conviértela.",
  "  Si en la foto entra además el papel de la pesada de planta —el listado de",
  "  materiales— NO uses sus horas («Load Time», «Time»): son otro momento y",
  "  harían que el mismo camión diera una hora distinta según lo que se fotografíe.",
  "  Manda siempre la del conduce.",
  "- `ticket` y `truck` tal cual, incluidos ceros a la izquierda si los hay.",
  "- `company` es la CONCRETERA que despacha el hormigón: la del membrete y el",
  "  logo de arriba, la que emite el conduce. NO es el cliente que aparece en",
  "  «Vendido a», que es el contratista de la obra y es otra empresa.",
  "- `ordenadas` son las yardas ORDENADAS para el día entero, no las de este camión.",
  "  Va en la columna «Ordenadas», al lado de «Servidas».",
  "  `vol` es lo que trae ESTE camión («Servidas» o «Cantidad»). No los confundas:",
  "  un camión trae 10 y el día puede tener 150 ordenadas.",
  "- El `Slump` impreso es el TEÓRICO de diseño, no el medido en obra. No lo devuelvas.",
].join("\n");

async function leerConduce(llave, imagen, tipo) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": llave,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-5",
      /* La respuesta es un JSON corto, pero el razonamiento del modelo también
         cuenta contra este tope y quedarse corto la trunca a media llave. */
      max_tokens: 8000,
      /* `medium` y no `high`: el técnico está de pie al lado del camión, y la
         tarea es leer un papel, no razonar. */
      output_config: { effort: "medium", format: { type: "json_schema", schema: QC_ESQUEMA_CONDUCE } },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: tipo || "image/jpeg", data: imagen } },
          { type: "text", text: QC_INSTRUCCIONES_CONDUCE },
        ],
      }],
    }),
  });
  /* Solo el código: el cuerpo del error puede traer trozos de la petición y
     esto acaba en un aparato en la obra. */
  if (!r.ok) return { codigo: 502, cuerpo: { error: "lector", codigo: r.status } };
  const m = await r.json();
  /* El modelo puede declinar; entonces `content` viene vacío o a medias. Se
     comprueba ANTES de leerlo, o esto revienta con un camión esperando. */
  if (m.stop_reason === "refusal") return { codigo: 422, cuerpo: { error: "rechazado" } };
  const texto = (m.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return { codigo: 200, cuerpo: { campos: JSON.parse(texto), uso: m.usage || null } };
  } catch (_) { return { codigo: 502, cuerpo: { error: "ilegible" } }; }
}

/* ------------------------------------------------------------ la API

   Devuelve `true` si atendió la petición, para que `serve.js` sepa si le
   toca servir un archivo. */
/* ------------------------------------------------------------ correo saliente

   Q-39, 6 ago 2026. Hasta hoy QCheck no mandaba nada: el aviso de rechazo
   (Q-04) abría un correo pre-llenado y esperaba a que una persona le diera a
   enviar. Eso significa que si el técnico está con las manos llenas, el aviso
   no sale — y un rechazo que nadie ve a tiempo es hormigón colocado.

   Manda el SERVIDOR, no el aparato. Así sale igual de noche, con el iPad
   apagado y sin nadie delante.

   POR HTTP DIRECTO, SIN SDK. Igual que el lector de conduce (Q-01): una
   llamada `fetch` y ya. Aquí no entra una dependencia por mandar un correo.

   DORMIDO SIN LLAVE. Sin `QC_CORREO` puesta, la ruta contesta 501 y lo dice.
   No falla a medias ni se inventa que envió.

   LA CONTRASEÑA DE NADIE VIVE AQUÍ. Es una llave de ENVÍO: solo sirve para
   mandar correo, no da acceso a ningún buzón. Si se filtra, se revoca y ya.
   Una contraseña de Gmail habría abierto el buzón entero. */

async function enviarCorreo(env, { para, asunto, html, texto, responderA }) {
  if (!env.QC_CORREO) return { ok: false, codigo: 501, error: "sin-correo" };
  const de = env.QC_CORREO_DE || "QCheck <onboarding@resend.dev>";
  const destinos = Array.isArray(para) ? para : [para];
  if (!destinos.length || destinos.some((d) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d))))
    return { ok: false, codigo: 400, error: "destino" };

  const cuerpo = { from: de, to: destinos, subject: String(asunto || "").slice(0, 200) };
  if (html) cuerpo.html = html;
  if (texto) cuerpo.text = texto;
  if (!html && !texto) return { ok: false, codigo: 400, error: "vacio" };
  if (responderA) cuerpo.reply_to = responderA;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.QC_CORREO, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const d = await r.json().catch(() => ({}));
    /* El id que devuelve el servicio se guarda: es lo único que permite
       después preguntar si un aviso llegó de verdad o rebotó. */
    if (!r.ok) return { ok: false, codigo: r.status, error: (d && d.message) || "envio" };
    return { ok: true, id: d.id || null };
  } catch (e) {
    return { ok: false, codigo: 502, error: "sin-respuesta" };
  }
}


function montarAPI(almacen, token, opciones) {
  const presencia = new Map();   // dev → { dev, usr, pagina, desde, visto }
  const cfg = opciones || {};
  const cuentas = cfg.cuentas || null;
  const admin = cfg.admin || "";

  function responder(res, codigo, cuerpo) {
    const texto = JSON.stringify(cuerpo);
    res.writeHead(codigo, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-QC-Token, X-QC-Sesion, X-QC-Admin",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Cache-Control": "no-store",
    });
    res.end(texto);
  }

  function autorizado(req) {
    if (!token) return true;   // sin token configurado, la puerta queda abierta (solo local)
    return req.headers["x-qc-token"] === token;
  }

  /* El secreto de administración es OTRO, y no es la llave del proyecto: esa
     va dentro del enlace de conexión que tiene Rubén, así que quien pueda dar
     de alta cuentas sería cualquiera que vea ese enlace. Dar de alta a alguien
     es cosa de Víctor y de nadie más. */
  function esAdmin(req) {
    return !!admin && mismoSecreto(String(req.headers["x-qc-admin"] || ""), admin);
  }

  function cuerpoDe(req, tope) {
    return new Promise((ok, no) => {
      let c = "";
      req.on("data", (t) => { c += t; if (c.length > (tope || 4e6)) req.destroy(); });
      req.on("end", () => { try { ok(JSON.parse(c || "{}")); } catch (_) { no(new Error("json")); } });
      req.on("error", no);
    });
  }

  async function atenderAsync(req, res, url) {
    if (req.method === "OPTIONS") return responder(res, 204, {});

    if (url.pathname === "/api/salud") {
      return responder(res, 200, {
        ok: true, seq: almacen.seq(), cambios: almacen.total(), protegido: !!token,
        /* Que el servidor pida sesión es cosa que el aparato necesita saber
           ANTES de enseñar la pantalla de acceso: si no, ofrecería entrar con
           la lista local a alguien cuyo servidor ya no la acepta. */
        sesiones: !!(cuentas && cuentas.exigeSesion()),
      });
    }

    if (!autorizado(req)) return responder(res, 401, { error: "token" });

    /* Quién trae este token de sesión, si trae alguno. A partir de aquí, `quien`
       es la ÚNICA fuente sobre la identidad: lo que venga en el cuerpo del POST
       ya no cuenta. */
    const quien = cuentas ? await cuentas.deToken(req.headers["x-qc-sesion"]) : null;
    const exige = !!(cuentas && cuentas.exigeSesion());

    /* ---------------------------------------------------------- la sesión */

    if (url.pathname === "/api/sesion" && req.method === "POST") {
      /* Sin cuentas dadas de alta se contesta 501 y NO 401, y la diferencia
         importa: el aparato entiende «este servidor todavía no lleva cuentas»
         y cae a su lista local, mientras que un 401 significaría «tu clave no
         vale» y lo dejaría fuera. Un servidor recién levantado —el de la obra,
         o el de un cliente nuevo— dejaría a todo el mundo en la calle. */
      if (!cuentas || !cuentas.hayUsuarios()) return responder(res, 501, { error: "sin-cuentas" });
      let d;
      try { d = await cuerpoDe(req, 1e4); } catch (_) { return responder(res, 400, { error: "json" }); }
      const s = await cuentas.entrar(d.usr, d.clave, d.dev);
      if (!s) return responder(res, 401, { error: "credenciales" });
      return responder(res, 200, { tk: s.token, usuario: s.usuario, vence: s.vence });
    }

    if (url.pathname === "/api/sesion" && req.method === "GET") {
      if (!quien) return responder(res, 401, { error: "sesion" });
      return responder(res, 200, { usuario: quien });
    }

    if (url.pathname === "/api/sesion/salir" && req.method === "POST") {
      if (cuentas) await cuentas.salir(req.headers["x-qc-sesion"]);
      return responder(res, 200, { ok: true });
    }

    /* ---------------------------------------------------------- cuentas (Víctor) */

    if (url.pathname === "/api/cuentas") {
      if (!cuentas) return responder(res, 501, { error: "sin-cuentas" });
      if (!esAdmin(req)) return responder(res, 403, { error: "admin" });
      if (req.method === "GET") {
        return responder(res, 200, { usuarios: cuentas.listar(), exigir_sesion: cuentas.exigeSesion() });
      }
      if (req.method === "POST") {
        let d;
        try { d = await cuerpoDe(req, 1e4); } catch (_) { return responder(res, 400, { error: "json" }); }
        if (d.exigir_sesion != null) {
          cuentas.ponerAjuste("exigir_sesion", !!d.exigir_sesion);
          return responder(res, 200, { ok: true, exigir_sesion: cuentas.exigeSesion() });
        }
        try {
          const usr = await cuentas.guardar(d);
          return responder(res, 200, { ok: true, usr });
        } catch (e) { return responder(res, 400, { error: e.message }); }
      }
    }

    /* ---------------------------------------------------------- lo de siempre */

    /* Quién está dentro. Vive en memoria a propósito: es una foto del momento,
       no un expediente, y si se reinicia el servidor los aparatos vuelven a
       aparecer al siguiente latido. Ver `sync-worker.js` para el mismo trato. */
    if (url.pathname === "/api/latido" && req.method === "POST") {
      let d;
      try { d = await cuerpoDe(req, 1e5); } catch (_) { return responder(res, 400, { error: "json" }); }
      const dev = String(d.dev || "?").slice(0, 60);
      const ahora = new Date().toISOString();
      const prev = presencia.get(dev);
      const sigue = prev && (Date.parse(ahora) - Date.parse(prev.visto)) < 5 * 60 * 1000;
      presencia.set(dev, {
        dev,
        /* También aquí manda la sesión: la sala de máquinas enseña quién está
           dentro, y un nombre que se autodeclara no dice nada. */
        usr: quien ? quien.usr : String(d.usr || "?").slice(0, 40),
        pagina: String(d.pagina || "?").slice(0, 60),
        desde: sigue ? prev.desde : ahora, visto: ahora,
      });
      return responder(res, 200, { ok: true, ahora });
    }

    if (url.pathname === "/api/presencia" && req.method === "GET") {
      const aparatos = [...presencia.values()].sort((a, b) => b.visto.localeCompare(a.visto));
      return responder(res, 200, { ahora: new Date().toISOString(), aparatos });
    }

    /* Leer el conduce de la foto — Q-01. Idéntico a `sync-worker.js`: el mismo
       aparato habla con la laptop de la obra y con Cloudflare, y no puede notar
       la diferencia. **Propone; no guarda nada.** La llave va en QC_ANTHROPIC;
       sin ella contesta 501 y Recepción sigue a mano, como hoy. */
    if (url.pathname === "/api/leer-conduce" && req.method === "POST") {
      if (exige && !quien) return responder(res, 401, { error: "sesion" });
      if (quien && quien.rol !== "qc") return responder(res, 403, { error: "rol" });
      if (!cfg.anthropic) return responder(res, 501, { error: "sin-lector" });
      let d;
      try { d = await cuerpoDe(req, 3e7); } catch (_) { return responder(res, 400, { error: "json" }); }
      if (!d.imagen) return responder(res, 400, { error: "imagen" });
      try {
        const leido = await leerConduce(cfg.anthropic, d.imagen, d.tipo);
        return responder(res, leido.codigo || 200, leido.cuerpo);
      } catch (_) { return responder(res, 502, { error: "sin-respuesta" }); }
    }

    /* La historia de un conduce — Q-05. Se pide por registro, no por número de
       cambio, porque lo que se quiere ver es «qué le pasó a ESTE camión». */
    if (url.pathname === "/api/registro" && req.method === "GET") {
      if (exige && !quien) return responder(res, 401, { error: "sesion" });
      const ent = url.searchParams.get("ent") || "test";
      const id = url.searchParams.get("id") || "";
      if (!id) return responder(res, 400, { error: "id" });
      return responder(res, 200, { ops: almacen.deRegistro(ent, id) });
    }

    /* Lo último que ha pasado en el expediente — Q-36. `estado.html` la usa
       para decir qué está haciendo cada quien: la presencia dice en qué
       pantalla está, y esto dice qué tocó de verdad y cuándo.

       Va al revés que `/api/cambios`, que sirve para ponerse al día desde un
       número de cambio y devuelve las PRIMERAS. Aquí hacen falta las ÚLTIMAS,
       y pedirlas con `desde=0` traería las de la primera importación de 2026.
       Es de solo lectura y no mueve el reloj de sincronización de nadie. */
    if (url.pathname === "/api/actividad" && req.method === "GET") {
      if (exige && !quien) return responder(res, 401, { error: "sesion" });
      const n = Math.min(500, Math.max(1, Number(url.searchParams.get("n")) || 120));
      return responder(res, 200, { ahora: new Date().toISOString(), ops: almacen.ultimas(n) });
    }

    /* Mandar un correo — Q-39. Gemela de la del Worker: los dos servidores
       tienen que contestar lo mismo (DECISIONS §19). */
    if (url.pathname === "/api/correo" && req.method === "POST") {
      if (!esAdmin(req)) return responder(res, 403, { error: "admin" });
      let d;
      try { d = await cuerpoDe(req, 2e6); } catch (_) { return responder(res, 400, { error: "json" }); }
      const r = await enviarCorreo({ QC_CORREO: cfg.correo || "", QC_CORREO_DE: cfg.correoDe || "" }, {
        para: d.para, asunto: d.asunto, html: d.html, texto: d.texto, responderA: d.responderA,
      });
      return responder(res, r.ok ? 200 : r.codigo, r.ok ? { ok: true, id: r.id } : { error: r.error });
    }

    if (url.pathname === "/api/cambios" && req.method === "GET") {
      if (exige && !quien) return responder(res, 401, { error: "sesion" });
      const desde = Number(url.searchParams.get("desde") || 0) || 0;
      const ops = almacen.desde(desde);
      return responder(res, 200, { seq: almacen.seq(), ops });
    }

    if (url.pathname === "/api/cambios" && req.method === "POST") {
      /* AQUÍ está Q-07. Antes, el autor de cada línea del expediente era lo que
         el aparato dijera que era: `usr` viajaba en el cuerpo y nadie lo miraba.
         Ahora, si hay sesión, el autor lo pone el servidor y el cuerpo no tiene
         voz; y con la bandera encendida, sin sesión no se escribe. */
      if (exige && !quien) return responder(res, 401, { error: "sesion" });
      if (quien && quien.rol !== "qc") return responder(res, 403, { error: "rol" });
      let datos;
      try { datos = await cuerpoDe(req, 4e6); } catch (_) { return responder(res, 400, { error: "json" }); }
      const nuevas = almacen.anadir(
        Array.isArray(datos.ops) ? datos.ops : [],
        quien ? quien.usr : null);
      return responder(res, 200, { seq: almacen.seq(), aceptadas: nuevas.map((o) => o.uid) });
    }

    return responder(res, 404, { error: "ruta" });
  }

  /* La capa de fuera sigue siendo síncrona: `serve.js` necesita saber en el
     acto si le toca servir un archivo o si esto ya se encargó. */
  return function atender(req, res) {
    const url = new URL(req.url, "http://x");
    if (!url.pathname.startsWith("/api/")) return false;
    atenderAsync(req, res, url).catch(() => {
      try { responder(res, 500, { error: "servidor" }); } catch (_) {}
    });
    return true;
  };
}

module.exports = { crearAlmacen, montarAPI, crearCuentas };
