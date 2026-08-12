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
     npx wrangler secret put QC_CORREO       ← la llave con la que QCheck manda correo (Q-39)
     npx wrangler secret put QC_CORREO_DE    ← de qué dirección sale, p.ej. QCheck <qcheck@tu-dominio>
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
  limites: !!u.limites, firma: !!u.firma, casa: u.casa || null,
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

export default {
  /* La red de seguridad de arriba del todo — 6 ago 2026.

     Sin ella, cualquier error inesperado dentro salía como la página de error
     de Cloudflare, que es HTML. El aparato hace `r.json()` con eso y revienta
     con un fallo de sintaxis que no dice nada de lo que pasó de verdad: el
     técnico ve «se rompió» y nadie sabe dónde mirar.

     El servidor local ya lo tenía; era el Worker el que se salía del molde.
     Contesta SIEMPRE JSON, pase lo que pase. */
  async fetch(req, env) {
    try {
      return await this.atender(req, env);
    } catch (e) {
      console.error("fallo no previsto:", e && e.stack ? e.stack : e);
      return json({ error: "servidor" }, 500);
    }
  },

  async atender(req, env) {
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
          "SELECT usr, nombre, rol, tablero, config, limites, firma, casa, activo, creado, visto FROM usuarios ORDER BY usr"
        ).all();
        return json({ usuarios: results || [], exigir_sesion: exige });
      }
      if (req.method === "POST") {
        let d;
        try { d = await req.json(); } catch (_) { return json({ error: "json" }, 400); }

        /* Todas las sesiones a la basura — Q-85. El botón de después de un
           susto. No les quita la llave del proyecto: todos vuelven a entrar
           con su clave y no hay que repartir ningún enlace nuevo. */
        if (d.cerrar_sesiones === true) {
          const r = await env.DB.prepare("DELETE FROM sesiones").run();
          return json({ ok: true, cerradas: (r.meta && r.meta.changes) || 0 });
        }
        if (d.exigir_sesion != null) {
          await env.DB.prepare(
            "INSERT INTO ajustes (clave, valor) VALUES ('exigir_sesion', ?) " +
            "ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor"
          ).bind(d.exigir_sesion ? "1" : "0").run();
          return json({ ok: true, exigir_sesion: !!d.exigir_sesion });
        }

        const usr = String(d.usr || "").trim().toLowerCase();
        if (!usr) return json({ error: "usuario" }, 400);
        const antes = await env.DB.prepare("SELECT * FROM usuarios WHERE usr = ?").bind(usr).first();
        /* EL PAPEL SE CONSERVA SI NO VIENE. Hasta el 6 ago 2026 esto era
           `String(d.rol || "consulta")`, así que cualquier actualización
           parcial —darle una capacidad a alguien, por ejemplo— degradaba a la
           persona a `consulta` sin decir nada. Pasó de verdad ese día: se le
           dio Settings a Rubén y a Víctor y los dos dejaron de llevar el
           control de calidad hasta que se notó en la lista.

           `tablero` y `config` ya se conservaban, y el servidor local también
           conservaba el papel. Era el Worker el que se salía del molde, que es
           justo lo que AGENTS pide vigilar: los dos servidores tienen que
           contestar igual. */
        const rol = d.rol != null ? String(d.rol) : ((antes && antes.rol) || "consulta");
        if (rol !== "qc" && rol !== "consulta") return json({ error: "rol" }, 400);
        if (!antes && !d.clave) return json({ error: "clave" }, 400);

        const sal = d.clave ? alAzar(16) : antes.sal;
        const hash = d.clave ? await derivarClave(String(d.clave), sal, VUELTAS) : antes.hash;
        await env.DB.prepare(
          /* `limites` y `casa` — Q-37. Ver la nota gemela en sync-servidor.js:
             los dos servidores tienen que dar la MISMA ficha. */
          "INSERT INTO usuarios (usr, nombre, rol, tablero, config, limites, firma, casa, sal, hash, vueltas, activo, creado) " +
          "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(usr) DO UPDATE SET " +
          "nombre = excluded.nombre, rol = excluded.rol, tablero = excluded.tablero, " +
          "config = excluded.config, limites = excluded.limites, firma = excluded.firma, casa = excluded.casa, " +
          "sal = excluded.sal, hash = excluded.hash, " +
          "vueltas = excluded.vueltas, activo = excluded.activo"
        ).bind(usr, String(d.nombre || (antes && antes.nombre) || usr), rol,
               (d.tablero != null ? !!d.tablero : !!(antes && antes.tablero)) ? 1 : 0,
               (d.config != null ? !!d.config : !!(antes && antes.config)) ? 1 : 0,
               (d.limites != null ? !!d.limites : !!(antes && antes.limites)) ? 1 : 0,
               (d.firma != null ? !!d.firma : !!(antes && antes.firma)) ? 1 : 0,
               d.casa !== undefined ? (d.casa || null) : ((antes && antes.casa) || null),
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
      const prev = await env.DB.prepare("SELECT desde, visto, fuera FROM presencia WHERE dev = ?").bind(dev).first();

      /* ¿Lo desconectaron mientras no miraba? — Q-77. La orden esperaba en la
         fila y se entrega ahora, una sola vez: el aparato cierra la sesión solo
         y vuelve al acceso. Se limpia al entregarla porque si no, el aparato
         quedaría expulsado para siempre y no podría ni volver a entrar. */
      if (prev && prev.fuera) {
        await env.DB.prepare("UPDATE presencia SET fuera = NULL, visto = ? WHERE dev = ?")
          .bind(ahora, dev).run();
        return json({ ok: true, ahora, fuera: true });
      }

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

    /* Desconectar un aparato a mano — Q-77. Mismo trato que en
       `sync-servidor.js`: se le quitan las sesiones abiertas EN EL SERVIDOR y
       queda la orden esperando para que él se cierre en su siguiente latido.

       Quién puede: quien traiga la llave del proyecto, que es la puerta de toda
       esta API; y si además hay sesión, se exige `config` — la misma llave que
       abre la pantalla. Se comprueba aquí y no solo en el botón, porque la
       dirección se puede escribir a mano. */
    if (url.pathname === "/api/desconectar" && req.method === "POST") {
      if (quien && !quien.config) return json({ error: "config" }, 403);
      let d;
      try { d = await req.json(); } catch (_) { return json({ error: "json" }, 400); }
      const dev = String(d.dev || "").slice(0, 60);
      if (!dev) return json({ error: "dev" }, 400);
      const caidas = await env.DB.prepare("DELETE FROM sesiones WHERE dev = ?").bind(dev).run();
      const r = await env.DB.prepare("UPDATE presencia SET fuera = ? WHERE dev = ?")
        .bind(new Date().toISOString(), dev).run();
      /* `changes` dice si existía la fila. Sin latido previo no hay a quién
         avisar, y tampoco se inventa una: se dice que no se conocía. */
      const conocido = !!(r.meta && r.meta.changes);
      return json({ ok: true, dev, sesiones: (caidas.meta && caidas.meta.changes) || 0, conocido });
    }

    /* ---------------------------------------------------------- Q-01: leer el conduce

       La foto del conduce en papel entra aquí y salen los campos. **Propone; no
       guarda nada.** Lo que devuelve se pinta en gris en Recepción y el técnico
       confirma campo por campo — es el mismo trato que ya tenían el próximo
       conduce sugerido y la primera losa pendiente.

       Por qué así y no de otra manera: leer un papel arrugado con una foto
       nunca sale perfecto, y en este proyecto **un número equivocado que parece
       bueno es peor que un hueco** (DECISIONS §3). Si el modelo no lee un
       campo con seguridad devuelve `null` y el campo se queda vacío.

       La llamada se hace por HTTP a pelo y no con el SDK de Anthropic a
       propósito: el SDK es una dependencia de npm y el §1 de DECISIONS no las
       admite. `fetch` ya está en el Worker.

       La llave va en `QC_ANTHROPIC`, otro secreto más:
         npx wrangler secret put QC_ANTHROPIC
       Sin ella la ruta contesta 501 y Recepción sigue funcionando a mano, que
       es como funciona hoy. */
    if (url.pathname === "/api/leer-conduce" && req.method === "POST") {
      if (exige && !quien) return json({ error: "sesion" }, 401);
      if (quien && quien.rol !== "qc") return json({ error: "rol" }, 403);
      if (!env.QC_ANTHROPIC) return json({ error: "sin-lector" }, 501);

      let d;
      try { d = await req.json(); } catch (_) { return json({ error: "json" }, 400); }
      if (!d.imagen) return json({ error: "imagen" }, 400);

      /* Un campo que no se lee con seguridad vale `null`. El esquema lo permite
         a propósito: obligar a un tipo haría que el modelo rellenara el hueco
         con algo, y eso es justo lo que no puede pasar. */
      const oNulo = (t) => ({ anyOf: [{ type: t }, { type: "null" }] });
      const ESQUEMA = {
        type: "object",
        properties: {
          ticket:  oNulo("string"),   // número de conduce
          truck:   oNulo("string"),   // número de camión
          vol:     oNulo("number"),   // yardas (CY)
          batch:   oNulo("string"),   // hora de batch, HH:MM en 24 horas
          /* `plant` NO se pide — Q-56, 8 ago 2026. El conduce de Concre-Tech no
             imprime la planta hoy, así que el lector la devolvía en `ilegible`
             en TODOS los camiones: el técnico leía «1 campo no se leyó» cada
             vez, por algo que no está en el papel y que no tiene casilla donde
             escribirlo. Una lista de avisos que siempre trae lo mismo se deja
             de leer, y entonces el día que avise de verdad tampoco se lee.
             QCheck sigue guardando la planta, fija, como venía haciendo.
             Víctor dice que el conduce la traerá pronto: ese día se devuelve
             esta línea y ya está. */
          company: oNulo("string"),
          mix:     oNulo("string"),
          /* Las yardas ORDENADAS del día que trae impreso el conduce — no las
             de este camión, que van en `vol`. Sirven para una sola cosa y es
             importante: contrastarlas con el tiro que programó el ingeniero.
             Si no cuadran, alguien está pidiendo o entregando otra cosa, y eso
             se sabe con el primer camión y no al cerrar el día. Q-55. */
          ordenadas: oNulo("number"),
          chofer: oNulo("string"),
          manuscrito: { type: "array", items: { type: "string" } },
          ilegible: { type: "array", items: { type: "string" } },
        },
        required: ["ticket", "truck", "vol", "batch", "company", "mix", "ordenadas", "chofer", "manuscrito", "ilegible"],
        additionalProperties: false,
      };

      const INSTRUCCIONES = [
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
        "- `chofer` es el nombre del conductor. Se pide para COMPROBAR, no para",
        "  rellenar: si no se lee, devuélvelo null y no lo deduzcas del camión.",
        "- `manuscrito` es la lista de campos que venían ESCRITOS A MANO y no impresos",
        "  por la planta. Es importante y hay que mirarlo con cuidado: la tinta de",
        "  **Si el campo es uno de los del esquema, llámalo EXACTAMENTE como se llama",
        "  ahí** —ticket, truck, vol, batch, company, mix, ordenadas, chofer— y no con",
        "  otro nombre: hay un aviso en pantalla que depende de esos nombres, y un aviso",
        "  que nunca salta es peor que no tenerlo. Lo que no esté en el esquema, dilo",
        "  como quieras.",
        "  bolígrafo, el trazo irregular y la posición torcida se distinguen del texto",
        "  impreso. Si un campo está impreso, NO lo pongas. Si dudas, no lo pongas",
        "  tampoco: aquí un aviso falso hace que dejen de mirarse los avisos.",
        "  Las casillas del ciclo (horas de salida, llegada, comienzo, fin) se rellenan",
        "  a mano por costumbre y eso es normal; aun así, dilo si las lees.",
      ].join("\n");

      let r;
      try {
        r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": env.QC_ANTHROPIC,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-opus-5",
            /* Hay sitio de sobra: la respuesta es un JSON corto, pero el
               razonamiento del modelo también cuenta contra este tope y
               quedarse corto trunca la respuesta a media llave. */
            max_tokens: 8000,
            /* `medium` y no `high`: el técnico está de pie al lado del camión.
               En este modelo los niveles bajos rinden bastante más de lo que su
               nombre sugiere, y aquí la tarea es leer un papel, no razonar. */
            output_config: {
              effort: "medium",
              format: { type: "json_schema", schema: ESQUEMA },
            },
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: d.tipo || "image/jpeg", data: d.imagen } },
                { type: "text", text: INSTRUCCIONES },
              ],
            }],
          }),
        });
      } catch (_) {
        return json({ error: "sin-respuesta" }, 502);
      }

      if (!r.ok) {
        /* Se dice el código y ya. El cuerpo del error puede traer trozos de la
           petición, y esto va a un aparato en la obra. */
        return json({ error: "lector", codigo: r.status }, 502);
      }

      const m = await r.json();
      /* El modelo puede declinar una petición; entonces `content` viene vacío o
         a medias. Se comprueba ANTES de leerlo — si no, esto revienta con un
         camión esperando. */
      if (m.stop_reason === "refusal") return json({ error: "rechazado" }, 422);

      const texto = (m.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      let campos;
      try { campos = JSON.parse(texto); } catch (_) { return json({ error: "ilegible" }, 502); }

      return json({ campos, uso: m.usage || null });
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

    /* Lo último que ha pasado en el expediente — Q-36. `estado.html` la usa
       para decir qué está haciendo cada quien: la presencia dice en qué
       pantalla está, y esto dice qué tocó de verdad y cuándo.

       Va al revés que `/api/cambios`, que sirve para ponerse al día desde un
       número de cambio y devuelve las PRIMERAS. Aquí hacen falta las ÚLTIMAS,
       y pedirlas con `desde=0` traería las de la primera importación de 2026.
       Es de solo lectura y no mueve el reloj de sincronización de nadie. */
    if (url.pathname === "/api/actividad" && req.method === "GET") {
      if (exige && !quien) return json({ error: "sesion" }, 401);
      const n = Math.min(500, Math.max(1, Number(url.searchParams.get("n")) || 120));
      const { results } = await env.DB.prepare(
        "SELECT * FROM ops ORDER BY seq DESC LIMIT ?"
      ).bind(n).all();
      return json({ ahora: new Date().toISOString(), ops: (results || []).map(leerOp) });
    }

    /* Mandar un correo — Q-39. Detrás del secreto de administración y NO de la
       llave del proyecto: la llave viaja en el enlace de Rubén, y si sirviera
       para mandar correo, cualquiera que la viese podría escribir en nombre
       del proyecto. Dar de alta a alguien y mandar correo son cosa de Víctor. */
    if (url.pathname === "/api/correo" && req.method === "POST") {
      /* La misma comprobación que usa el alta de cuentas, ni más ni menos. */
      if (!env.QC_ADMIN || !mismoSecreto(String(req.headers.get("X-QC-Admin") || ""), env.QC_ADMIN))
        return json({ error: "admin" }, 403);
      let d; try { d = await req.json(); } catch (_) { return json({ error: "json" }, 400); }
      const r = await enviarCorreo(env, {
        para: d.para, asunto: d.asunto, html: d.html, texto: d.texto, responderA: d.responderA,
      });
      return json(r.ok ? { ok: true, id: r.id } : { error: r.error }, r.ok ? 200 : r.codigo);
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
      /* El guardado también por trozos, por el mismo tope. */
      for (let i = 0; i < lote.length; i += 90) await env.DB.batch(lote.slice(i, i + 90));

      /* Se confirma lo que de verdad quedó guardado, no lo que se mandó: el
         cliente solo descuela de su cola lo que el servidor reconoce. */
      /* DE 90 EN 90, y el número es un tope de D1 — Q-66, 10 de agosto de 2026.

         Esto preguntaba por TODOS los uid en una sola consulta, un parámetro por
         línea. D1 no admite tantos parámetros, así que a partir de unas cien
         líneas contestaba 500 y el aparato no podía sincronizar.

         Y no era un caso raro: `assets/sync.js` manda la cola ENTERA. Un aparato
         que pasa un día sin señal acumula más de cien cambios y **a partir de ahí
         no se pone al día nunca** — justo en obra y sin cobertura, que es para lo
         que existe el modo sin conexión.

         Se descubrió subiendo el histórico de la PR-52, no en obra. Si lo hubiera
         encontrado Rubén, lo habría encontrado con un tiro empezado. */
      const uids = ops.map((o) => String(o.uid || ""));
      const results = [];
      for (let i = 0; i < uids.length; i += 90) {
        const trozo = uids.slice(i, i + 90);
        const marcas = trozo.map(() => "?").join(",");
        const r = await env.DB.prepare(
          `SELECT uid FROM ops WHERE uid IN (${marcas})`
        ).bind(...trozo).all();
        for (const fila of (r.results || [])) results.push(fila);
      }
      const t = await env.DB.prepare("SELECT IFNULL(MAX(seq),0) AS seq FROM ops").first();
      return json({ seq: t.seq, aceptadas: (results || []).map((r) => r.uid) });
    }

    return json({ error: "ruta" }, 404);
  },
};
