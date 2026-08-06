/* ============================================================
   SINCRONIZACIÓN — la misma API, corriendo en Cloudflare.

   Es `sync-servidor.js` con la única diferencia que importa: en vez de
   un archivo JSONL, el registro vive en D1 (SQLite). Las rutas, el
   formato y las reglas son idénticas, así que el cliente no distingue
   si habla con la laptop de la obra o con internet.

   DESPLIEGUE (una vez, con la cuenta de Cloudflare ya abierta)

     npx wrangler login
     npx wrangler d1 create qcheck
     # copiar el database_id que imprime → wrangler.toml
     npx wrangler d1 execute qcheck --remote --file=./sync-esquema.sql
     npx wrangler secret put QC_TOKEN        ← la llave del proyecto
     npx wrangler secret put QC_ADMIN        ← el secreto para dar de alta cuentas (Q-07)
     npx wrangler deploy

   Imprime el URL (`https://qcheck-api.<cuenta>.workers.dev`). Ese es el
   que se entra en Plan & Datos → Sincronización, en cada aparato, junto
   con la llave.

   **QC_ADMIN es OTRO secreto y no es la llave del proyecto.** La llave viaja
   dentro del enlace de conexión que tiene Rubén; si sirviera además para crear
   cuentas, cualquiera que viera ese enlace podría hacerse una. Dar de alta a
   alguien es cosa de Víctor y de nadie más — `node cuentas.js`.

   Al añadir Q-07 hay que volver a correr el esquema (es todo
   `CREATE TABLE IF NOT EXISTS`, así que no toca lo que ya está):

     npx wrangler d1 execute qcheck --remote --file=./sync-esquema.sql

   EL REGISTRO NO SE EDITA NI SE BORRA — igual que en local. Un dato que
   quedó mal se corrige con otra línea encima y las dos quedan. Un
   expediente de calidad que se puede reescribir por detrás no vale nada.
   ============================================================ */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-QC-Token, X-QC-Sesion, X-QC-Admin",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
};

/* ------------------------------------------------------------ Q-07: quién firma

   Idéntico a lo que hace `sync-servidor.js`, porque tiene que serlo: el mismo
   aparato habla con la laptop de la obra y con esto, y no puede notar la
   diferencia. Lo único que cambia es dónde se guarda.

   Sale todo de `crypto.subtle`, que viene dentro del Worker: **ni una
   dependencia**, que es la regla del §1 de DECISIONS. */

/* 100.000 y NO MÁS: es el techo que impone Cloudflare Workers a PBKDF2. Por
   encima, `deriveBits` lanza excepción y el Worker devuelve 500 — pasó en el
   despliegue del 5 ago 2026 con 210.000, que era lo que pedía OWASP.

   Y tiene que ser el MISMO número aquí y en `sync-servidor.js`: una clave
   creada contra la laptop de la obra se comprueba después contra esto. Si no
   coinciden, la cuenta entra en un sitio y no en el otro.

   Lo que compensa el techo es de dónde salen las claves: `cuentas.js` las
   inventa con 20 caracteres de un alfabeto de 54 —unos 115 bits—, y contra eso
   el número de vueltas da igual. Las vueltas protegen a la clave escrita a
   mano, y por eso ahí se exigen 12 caracteres. Ver DECISIONS §17. */
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
   esa diferencia se puede sacar el valor bueno a base de intentos. */
function mismoSecreto(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const ficha = (u) => ({
  usr: u.usr, nombre: u.nombre, rol: u.rol, tablero: !!u.tablero, config: !!u.config,
});

/* Quién trae este pase. Estira el vencimiento con cada uso: la sincronización
   toca el servidor cada 3 s, así que una sesión en uso no caduca nunca. La que
   caduca es la del aparato que se quedó olvidado en la caseta. Una sesión que
   se cae en mitad de un tiro es el fallo que no nos podemos permitir. */
async function sesionDe(env, token) {
  if (!token) return null;
  const s = await env.DB.prepare("SELECT * FROM sesiones WHERE tk = ?").bind(await huella(token)).first();
  if (!s) return null;
  const ahora = new Date();
  if (ahora > new Date(s.vence)) return null;
  const u = await env.DB.prepare("SELECT * FROM usuarios WHERE usr = ?").bind(s.usr).first();
  if (!u || !u.activo) return null;
  const vence = new Date(ahora.getTime() + SESION_HORAS * 3600e3).toISOString();
  await env.DB.prepare("UPDATE sesiones SET visto = ?, vence = ? WHERE tk = ?")
    .bind(ahora.toISOString(), vence, s.tk).run();
  return ficha(u);
}

async function exigeSesion(env) {
  const a = await env.DB.prepare("SELECT valor FROM ajustes WHERE clave = 'exigir_sesion'").first();
  return !!a && a.valor === "1";
}

function json(cuerpo, codigo = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: codigo,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, CORS),
  });
}

/* El valor viaja como JSON dentro de una columna de texto: un campo puede
   ser un número, una cadena, `false` o el objeto de límites del plan. */
function leerOp(fila) {
  let valor = null;
  try { valor = JSON.parse(fila.valor); } catch (_) { valor = null; }
  return { seq: fila.seq, uid: fila.uid, ent: fila.ent, id: fila.id, campo: fila.campo, valor, ts: fila.ts, dev: fila.dev, usr: fila.usr };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (!url.pathname.startsWith("/api/")) return json({ error: "ruta" }, 404);

    const protegido = !!env.QC_TOKEN;

    if (url.pathname === "/api/salud") {
      const r = await env.DB.prepare("SELECT COUNT(*) AS n, IFNULL(MAX(seq),0) AS seq FROM ops").first();
      /* Que el servidor pida sesión es cosa que el aparato necesita saber ANTES
         de enseñar la pantalla de acceso: si no, ofrecería entrar con la lista
         local a alguien cuyo servidor ya no la acepta. */
      return json({ ok: true, seq: r.seq, cambios: r.n, protegido, sesiones: await exigeSesion(env) });
    }

    if (protegido && req.headers.get("X-QC-Token") !== env.QC_TOKEN) return json({ error: "token" }, 401);

    /* Quién trae este pase de sesión, si trae alguno. A partir de aquí `quien`
       es la ÚNICA fuente sobre la identidad: lo que venga en el cuerpo del POST
       ya no cuenta. Ahí está Q-07 entero. */
    const quien = await sesionDe(env, req.headers.get("X-QC-Sesion"));
    const exige = await exigeSesion(env);

    /* ---------------------------------------------------------- la sesión */

    if (url.pathname === "/api/sesion" && req.method === "POST") {
      let d;
      try { d = await req.json(); } catch (_) { return json({ error: "json" }, 400); }
      /* Sin cuentas dadas de alta se contesta 501 y NO 401, y la diferencia
         importa: el aparato entiende «este servidor todavía no lleva cuentas» y
         cae a su lista local, mientras que un 401 significaría «tu clave no
         vale» y lo dejaría fuera. Un servidor recién levantado dejaría a todo
         el mundo en la calle. */
      const cuantos = await env.DB.prepare("SELECT COUNT(*) AS n FROM usuarios").first();
      if (!cuantos || !cuantos.n) return json({ error: "sin-cuentas" }, 501);
      const usr = String(d.usr || "").trim().toLowerCase();
      const u = await env.DB.prepare("SELECT * FROM usuarios WHERE usr = ?").bind(usr).first();
      /* Se tarda lo mismo con un usuario que no existe que con una clave mala:
         si contestara antes cuando no existe, se podría averiguar quién tiene
         cuenta a base de probar nombres. */
      const sal = u ? u.sal : "00000000000000000000000000000000";
      const hash = await derivarClave(String(d.clave || ""), sal, u ? u.vueltas : VUELTAS);
      if (!u || !u.activo || !mismoSecreto(hash, u.hash)) return json({ error: "credenciales" }, 401);

      const token = alAzar(32);
      const ahora = new Date();
      const vence = new Date(ahora.getTime() + SESION_HORAS * 3600e3).toISOString();
      await env.DB.prepare(
        "INSERT INTO sesiones (tk, usr, dev, creada, vence, visto) VALUES (?,?,?,?,?,?)"
      ).bind(await huella(token), usr, String(d.dev || "?").slice(0, 60),
             ahora.toISOString(), vence, ahora.toISOString()).run();
      await env.DB.prepare("UPDATE usuarios SET visto = ? WHERE usr = ?").bind(ahora.toISOString(), usr).run();
      return json({ tk: token, usuario: ficha(u), vence });
    }

    if (url.pathname === "/api/sesion" && req.method === "GET") {
      if (!quien) return json({ error: "sesion" }, 401);
      return json({ usuario: quien });
    }

    if (url.pathname === "/api/sesion/salir" && req.method === "POST") {
      const t = req.headers.get("X-QC-Sesion");
      if (t) await env.DB.prepare("DELETE FROM sesiones WHERE tk = ?").bind(await huella(t)).run();
      return json({ ok: true });
    }

    /* ---------------------------------------------------------- cuentas (Víctor) */

    if (url.pathname === "/api/cuentas") {
      if (!env.QC_ADMIN || !mismoSecreto(String(req.headers.get("X-QC-Admin") || ""), env.QC_ADMIN)) {
        return json({ error: "admin" }, 403);
      }
      if (req.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT usr, nombre, rol, tablero, config, activo, creado, visto FROM usuarios ORDER BY usr"
        ).all();
        return json({ usuarios: results || [], exigir_sesion: exige });
      }
      if (req.method === "POST") {
        let d;
        try { d = await req.json(); } catch (_) { return json({ error: "json" }, 400); }

        if (d.exigir_sesion != null) {
          await env.DB.prepare(
            "INSERT INTO ajustes (clave, valor) VALUES ('exigir_sesion', ?) " +
            "ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor"
          ).bind(d.exigir_sesion ? "1" : "0").run();
          return json({ ok: true, exigir_sesion: !!d.exigir_sesion });
        }

        const usr = String(d.usr || "").trim().toLowerCase();
        if (!usr) return json({ error: "usuario" }, 400);
        const rol = String(d.rol || "consulta");
        if (rol !== "qc" && rol !== "consulta") return json({ error: "rol" }, 400);
        const antes = await env.DB.prepare("SELECT * FROM usuarios WHERE usr = ?").bind(usr).first();
        if (!antes && !d.clave) return json({ error: "clave" }, 400);

        const sal = d.clave ? alAzar(16) : antes.sal;
        const hash = d.clave ? await derivarClave(String(d.clave), sal, VUELTAS) : antes.hash;
        await env.DB.prepare(
          "INSERT INTO usuarios (usr, nombre, rol, tablero, config, sal, hash, vueltas, activo, creado) " +
          "VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(usr) DO UPDATE SET " +
          "nombre = excluded.nombre, rol = excluded.rol, tablero = excluded.tablero, " +
          "config = excluded.config, sal = excluded.sal, hash = excluded.hash, " +
          "vueltas = excluded.vueltas, activo = excluded.activo"
        ).bind(usr, String(d.nombre || (antes && antes.nombre) || usr), rol,
               (d.tablero != null ? !!d.tablero : !!(antes && antes.tablero)) ? 1 : 0,
               (d.config != null ? !!d.config : !!(antes && antes.config)) ? 1 : 0,
               sal, hash, d.clave ? VUELTAS : antes.vueltas,
               (d.activo != null ? !!d.activo : !(antes && !antes.activo)) ? 1 : 0,
               (antes && antes.creado) || new Date().toISOString()).run();
        return json({ ok: true, usr });
      }
    }

    /* ------------------------------------------------------- quién está dentro

       El latido pisa la fila del aparato: esto es una foto del momento, no un
       expediente. Las horas las pone el SERVIDOR — el reloj de un iPad en la
       obra puede ir descuadrado y «conectado hace 3 horas» sería mentira.

       `desde` solo se reinicia si el aparato llevaba más de 5 minutos callado:
       así cambiar de pantalla no cuenta como sesión nueva, y el tiempo que se
       enseña es de verdad el rato que lleva usando QCheck. */
    if (url.pathname === "/api/latido" && req.method === "POST") {
      let d;
      try { d = await req.json(); } catch (_) { return json({ error: "json" }, 400); }
      const dev = String(d.dev || "?").slice(0, 60);
      const ahora = new Date().toISOString();
      const prev = await env.DB.prepare("SELECT desde, visto FROM presencia WHERE dev = ?").bind(dev).first();
      const CORTE = 5 * 60 * 1000;
      const sigue = prev && (Date.parse(ahora) - Date.parse(prev.visto)) < CORTE;
      await env.DB.prepare(
        "INSERT INTO presencia (dev, usr, pagina, desde, visto) VALUES (?,?,?,?,?) " +
        "ON CONFLICT(dev) DO UPDATE SET usr = excluded.usr, pagina = excluded.pagina, " +
        "desde = excluded.desde, visto = excluded.visto"
      ).bind(dev,
             /* También aquí manda la sesión: la sala de máquinas enseña quién
                está dentro, y un nombre que se autodeclara no dice nada. */
             quien ? quien.usr : String(d.usr || "?").slice(0, 40),
             String(d.pagina || "?").slice(0, 60),
             sigue ? prev.desde : ahora, ahora).run();
      return json({ ok: true, ahora });
    }

    if (url.pathname === "/api/presencia" && req.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM presencia ORDER BY visto DESC LIMIT 100"
      ).all();
      /* Se manda también la hora del servidor: el navegador que pinta la
         pantalla calcula los «hace cuánto» contra ella y no contra su propio
         reloj, que es otro que puede ir descuadrado. */
      return json({ ahora: new Date().toISOString(), aparatos: results || [] });
    }

    /* La historia de un conduce — Q-05. Se apoya en el índice `ops_registro`,
       que existe desde Q-02 esperando justamente a esto: el dato ya estaba
       —cada línea dice qué campo cambió, cuándo y quién—, faltaba poder pedirlo
       por registro en vez de por número de cambio. */
    if (url.pathname === "/api/registro" && req.method === "GET") {
      if (exige && !quien) return json({ error: "sesion" }, 401);
      const ent = url.searchParams.get("ent") || "test";
      const id = url.searchParams.get("id") || "";
      if (!id) return json({ error: "id" }, 400);
      const { results } = await env.DB.prepare(
        "SELECT * FROM ops WHERE ent = ? AND id = ? ORDER BY seq"
      ).bind(ent, id).all();
      return json({ ops: (results || []).map(leerOp) });
    }

    if (url.pathname === "/api/cambios" && req.method === "GET") {
      if (exige && !quien) return json({ error: "sesion" }, 401);
      const desde = Number(url.searchParams.get("desde") || 0) || 0;
      /* El tope evita que un aparato apagado un mes se traiga medio proyecto
         de un tirón: pide otra vez y sigue desde donde quedó. */
      const { results } = await env.DB.prepare(
        "SELECT * FROM ops WHERE seq > ? ORDER BY seq LIMIT 2000"
      ).bind(desde).all();
      const tope = await env.DB.prepare("SELECT IFNULL(MAX(seq),0) AS seq FROM ops").first();
      return json({ seq: tope.seq, ops: (results || []).map(leerOp) });
    }

    if (url.pathname === "/api/cambios" && req.method === "POST") {
      /* AQUÍ está Q-07. Antes, el autor de cada línea del expediente era lo que
         el aparato dijera que era: `usr` viajaba en el cuerpo y nadie lo miraba.
         Ahora, si hay sesión, el autor lo pone el servidor y el cuerpo no tiene
         voz; y con la bandera encendida, sin sesión no se escribe. */
      if (exige && !quien) return json({ error: "sesion" }, 401);
      if (quien && quien.rol !== "qc") return json({ error: "rol" }, 403);
      let datos;
      try { datos = await req.json(); } catch (_) { return json({ error: "json" }, 400); }
      const ops = Array.isArray(datos.ops) ? datos.ops : [];
      if (!ops.length) {
        const t = await env.DB.prepare("SELECT IFNULL(MAX(seq),0) AS seq FROM ops").first();
        return json({ seq: t.seq, aceptadas: [] });
      }

      /* `INSERT OR IGNORE` sobre `uid` único: un reintento porque se cayó la
         señal justo al contestar no duplica la línea. */
      const stmt = env.DB.prepare(
        "INSERT OR IGNORE INTO ops (uid, ent, id, campo, valor, ts, dev, usr) VALUES (?,?,?,?,?,?,?,?)"
      );
      const lote = ops.map((o) => stmt.bind(
        String(o.uid || ""), String(o.ent || ""), String(o.id == null ? "" : o.id), String(o.campo || ""),
        JSON.stringify(o.valor === undefined ? null : o.valor),
        o.ts || new Date().toISOString(), o.dev || "?",
        /* La firma la pone el servidor. Lo que traiga el cuerpo se ignora. */
        quien ? quien.usr : (o.usr || "?")
      ));
      await env.DB.batch(lote);

      /* Se confirma lo que de verdad quedó guardado, no lo que se mandó: el
         cliente solo descuela de su cola lo que el servidor reconoce. */
      const uids = ops.map((o) => String(o.uid || ""));
      const marcas = uids.map(() => "?").join(",");
      const { results } = await env.DB.prepare(
        `SELECT uid FROM ops WHERE uid IN (${marcas})`
      ).bind(...uids).all();
      const t = await env.DB.prepare("SELECT IFNULL(MAX(seq),0) AS seq FROM ops").first();
      return json({ seq: t.seq, aceptadas: (results || []).map((r) => r.uid) });
    }

    return json({ error: "ruta" }, 404);
  },
};
