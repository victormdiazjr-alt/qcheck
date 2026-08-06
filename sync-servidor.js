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
      config: !!u.config, activo: u.activo !== false, creado: u.creado, visto: u.visto || null,
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
        config: d.config != null ? !!d.config : !!antes.config,
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

/* ------------------------------------------------------------ la API

   Devuelve `true` si atendió la petición, para que `serve.js` sepa si le
   toca servir un archivo. */
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
      if (!cuentas) return responder(res, 501, { error: "sin-cuentas" });
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
