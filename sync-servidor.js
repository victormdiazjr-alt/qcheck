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
       contestar— se reconoce por su uid y no se duplica. */
    anadir(entradas) {
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
          usr: e.usr || "?",
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

/* ------------------------------------------------------------ la API

   Tres rutas y nada más. Devuelve `true` si atendió la petición, para
   que `serve.js` sepa si le toca servir un archivo. */
function montarAPI(almacen, token) {
  function responder(res, codigo, cuerpo) {
    const texto = JSON.stringify(cuerpo);
    res.writeHead(codigo, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-QC-Token",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Cache-Control": "no-store",
    });
    res.end(texto);
  }

  function autorizado(req) {
    if (!token) return true;   // sin token configurado, la puerta queda abierta (solo local)
    return req.headers["x-qc-token"] === token;
  }

  return function atender(req, res) {
    const url = new URL(req.url, "http://x");
    if (!url.pathname.startsWith("/api/")) return false;

    if (req.method === "OPTIONS") { responder(res, 204, {}); return true; }

    if (url.pathname === "/api/salud") {
      responder(res, 200, { ok: true, seq: almacen.seq(), cambios: almacen.total(), protegido: !!token });
      return true;
    }

    if (!autorizado(req)) { responder(res, 401, { error: "token" }); return true; }

    if (url.pathname === "/api/cambios" && req.method === "GET") {
      const desde = Number(url.searchParams.get("desde") || 0) || 0;
      const ops = almacen.desde(desde);
      responder(res, 200, { seq: almacen.seq(), ops });
      return true;
    }

    if (url.pathname === "/api/cambios" && req.method === "POST") {
      let cuerpo = "";
      req.on("data", (c) => {
        cuerpo += c;
        if (cuerpo.length > 4e6) req.destroy();   // nadie manda 4 MB de cambios
      });
      req.on("end", () => {
        let datos;
        try { datos = JSON.parse(cuerpo || "{}"); }
        catch (_) { responder(res, 400, { error: "json" }); return; }
        const nuevas = almacen.anadir(Array.isArray(datos.ops) ? datos.ops : []);
        responder(res, 200, { seq: almacen.seq(), aceptadas: nuevas.map((o) => o.uid) });
      });
      return true;
    }

    responder(res, 404, { error: "ruta" });
    return true;
  };
}

module.exports = { crearAlmacen, montarAPI };
