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
    /* ESTRENAR UN APARATO SE DICE POR TELEFONO — Q-122, 28 de agosto de 2026.
     *
     * Victor: «haz que el enlace de limpiar sea qterapr.com/new».
     *
     * Antes habia que mandar `preparar.html?k=<treinta y dos caracteres>`, que
     * no se dicta, no se copia bien de un WhatsApp citado y no se teclea en un
     * iPad con guante. Ahora se dice: qterapr punto com barra new.
     *
     * La llave la pone el servidor, que ya la tiene. Y no se pierde nada: la
     * llave sola no abre NADA —`exigir_sesion` esta encendido, asi que sin
     * usuario y clave no se lee ni se escribe una linea— y ya viajaba en cada
     * enlace de conexion que se manda por WhatsApp. Lo que decide quien entra
     * es la cuenta. */
    if (url.pathname === "/new") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/preparar.html?k=" + encodeURIComponent(env.QC_TOKEN || ""),
          "Cache-Control": "no-store",
        },
      });
    }

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
    /* ══════════════════════════════════════════════════════════════════════
       EL ASISTENTE DE OBRA — Q-116, 28 de agosto de 2026.

       Victor: «lo que quiero es decirle "creame este tiro" y darle paste al
       mensaje que me envio Ruben».

       Eso es lo que hace. Entra el mensaje tal cual llego por WhatsApp —«manana
       tiramos 160 yardas en el carril L2, fase 10, empezamos 6 am, losas de la
       0.400 a la 0.312»— y sale el tiro montado.

       DOS REGLAS, Y NO SE NEGOCIAN:

       1. **Propone, no escribe.** Devuelve un borrador; el formulario se abre
          relleno y Victor confirma campo por campo. Es el mismo trato que el
          lector de conduces (Q-01) y que el proximo ticket sugerido: nada entra
          al expediente porque lo diga un modelo. Un tiro mal montado cambia las
          yardas planificadas, el tramo y el cumplimiento del dia.

       2. **Lo que no se lee con seguridad va en `null`.** No se rellena el
          hueco con algo verosimil. En este proyecto un numero equivocado que
          parece bueno es peor que un hueco (DECISIONS §3): el hueco se ve.

       Y solo para quien lleva el contrato: `config`, el mismo permiso que abre
       Plan & Datos y el registro de Actividad. Ruben tiene un camion delante;
       su pantalla tiene que decirle que hacer en un segundo, no invitarle a
       conversar. */
    if (url.pathname === "/api/asistente" && req.method === "POST") {
      if (exige && !quien) return json({ error: "sesion" }, 401);
      if (quien && !quien.config) return json({ error: "rol" }, 403);
      if (!env.QC_ANTHROPIC) return json({ error: "sin-lector" }, 501);

      let d;
      try { d = await req.json(); } catch (_) { return json({ error: "json" }, 400); }
      const texto = String(d.texto || "").slice(0, 6000).trim();
      if (!texto) return json({ error: "texto" }, 400);
      const ctx = d.contexto && typeof d.contexto === "object" ? d.contexto : {};

      const oNulo = (t) => ({ anyOf: [{ type: t }, { type: "null" }] });
      const ESQUEMA = {
        type: "object",
        additionalProperties: false,
        required: ["respuesta", "tiro"],
        properties: {
          respuesta: { type: "string" },
          tiro: {
            anyOf: [{ type: "null" }, {
              type: "object",
              additionalProperties: false,
              required: ["fecha", "proyecto", "estructura", "es934", "horaInicio",
                         "cyPlan", "losasPlan", "losas", "mix", "fase", "cierre",
                         "lane", "km", "notas"],
              properties: {
                fecha: oNulo("string"), proyecto: oNulo("string"),
                estructura: oNulo("string"), es934: oNulo("boolean"),
                horaInicio: oNulo("string"), cyPlan: oNulo("number"),
                losasPlan: oNulo("number"), losas: oNulo("string"),
                mix: oNulo("string"), fase: oNulo("string"),
                cierre: oNulo("string"), lane: oNulo("string"),
                km: oNulo("string"), notas: oNulo("string"),
              },
            }],
          },
        },
      };

      const INSTRUCCIONES = [
        "Eres el asistente de QCheck, el sistema de control de calidad de hormigon de",
        "Segarra Engineering. Hablas con el ingeniero de record, en español de Puerto",
        "Rico, claro y sin rodeos. Los terminos tecnicos van en ingles: slump, unit",
        "weight, mix, tickets.",
        "",
        "TU TRABAJO PRINCIPAL: te pegan el mensaje que el tecnico mando por WhatsApp",
        "describiendo el vaciado de manana, y devuelves el tiro montado en `tiro`.",
        "",
        "REGLAS QUE NO SE ROMPEN:",
        "- Lo que el mensaje NO diga va en `null`. No inventes. Un hueco se ve y se",
        "  rellena a mano; un dato inventado que parece bueno se firma sin mirarlo.",
        "- `fecha` en formato AAAA-MM-DD. Si dicen «manana», calcula desde la fecha",
        "  de hoy que viene en el contexto.",
        "- `horaInicio` en formato HH:MM de 24 horas.",
        "- `estructura` solo puede ser uno de los valores que trae el contexto.",
        "- `proyecto` solo puede ser el id de una obra del contexto.",
        "- `mix` solo de la lista del contexto, si la hay.",
        "- `cyPlan` son yardas cubicas (CY). Si hablan de metros cubicos, convierte y",
        "  dilo en `respuesta`.",
        "- `losas` es el listado o el tramo tal como lo escribieron, sin reordenar.",
        "",
        "Si el mensaje no habla de un vaciado —es una pregunta sobre limites, sobre",
        "un camion, sobre como se hace algo— entonces `tiro` va en `null` y contestas",
        "en `respuesta`, con los datos del contexto delante.",
        "",
        "En `respuesta` di en dos o tres lineas que entendiste y, sobre todo, QUE TE",
        "FALTA: nombra los campos que quedaron en null para que los complete a mano.",
        "Nunca digas que has creado o guardado el tiro: tu propones, el confirma.",
        "",
        "CONTEXTO DE LA OBRA:",
        JSON.stringify(ctx),
      ].join("\n");

      const REINTENTABLE2 = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);
      const ESPERAS2 = [400, 1200];
      let r2, fallo2 = null;
      for (let intento = 0; intento <= ESPERAS2.length; intento++) {
        if (intento) await new Promise((s) => setTimeout(s, ESPERAS2[intento - 1]));
        try {
          r2 = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": env.QC_ANTHROPIC,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-opus-5",
              max_tokens: 8000,
              output_config: {
                effort: "medium",
                format: { type: "json_schema", schema: ESQUEMA },
              },
              system: INSTRUCCIONES,
              messages: [{ role: "user", content: texto }],
            }),
          });
        } catch (e) { fallo2 = e; continue; }
        if (!REINTENTABLE2.has(r2.status)) break;
      }
      if (!r2) return json({ error: "sin-respuesta", detalle: String(fallo2 || "") }, 502);
      if (!r2.ok) return json({ error: "modelo", codigo: r2.status }, 502);

      let salida;
      try {
        const cuerpo = await r2.json();
        const trozo = (cuerpo.content || []).find((c) => c.type === "text");
        salida = JSON.parse(trozo ? trozo.text : "{}");
      } catch (_) { return json({ error: "respuesta-ilegible" }, 502); }
      return json(salida);
    }

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
        /* `vol` ES EL CAMPO QUE MULTIPLICA EL DINERO — 14 ago 2026.
           Tenía una sola línea, y es el que más falla: Rubén no pudo leerlo de
           los PDF del 12 de agosto y tuvo que teclear las yardas de seis
           camiones. Lo de abajo sale de mirar un conduce de verdad, no de
           memoria: en el 1917 conviven entregada 8.50, acumulada 17.00 y
           ordenada 51.00 en la misma fila. */
        /* EL PAPEL VIENE CORRIDO MUY A MENUDO — Víctor, 14 ago 2026.

           «Muchos conduces tendrán los campos y la data corrida. Es bien normal
           que las concreteras no le presten atención a eso. Así que debemos ir
           preparados siempre.»

           El formulario va preimpreso y los datos los mete encima una matriz de
           puntos; si el rodillo va medio renglón desviado, **un número acaba
           debajo de la casilla de al lado**. Y no lo arregla nadie, porque para
           la planta el papel se entiende igual.

           Esto es peligroso justo por lo contrario de lo que parece: el
           resultado **no sale borroso, sale limpio y en la casilla equivocada**.
           Un lector que se fía de la posición devuelve un número perfectamente
           legible que significa otra cosa. Es la peor forma del fallo de este
           proyecto: **plausible, firmado, y nadie lo mira dos veces.** */
        "EL PAPEL VIENE CORRIDO MUY A MENUDO. Léelo por lo que SIGNIFICA, no por dónde CAE.",
        "",
        "El formulario va preimpreso y los datos los teclea encima una impresora de matriz",
        "de puntos. Es normal que salga desviada medio renglón o medio centímetro, y las",
        "plantas no lo corrigen porque para ellos el papel se entiende igual. Así que",
        "**un valor puede aparecer pegado a la casilla de al lado, o entre dos casillas**.",
        "",
        "Cuando eso pase:",
        "- **Manda la etiqueta, no la posición.** Sigue el renglón entero de izquierda a",
        "  derecha y mira qué rótulo le corresponde de verdad, aunque el número esté",
        "  desplazado. No cojas el valor «que está debajo» de un rótulo si el renglón",
        "  dice otra cosa.",
        "- **Compruébalo con algo que ya sepas.** Muchos datos aparecen dos veces en el",
        "  papel, o se pueden contrastar entre sí: `vol` suele repetirse en el renglón del",
        "  artículo; `vol` nunca puede ser mayor que `ordenadas`; el número de camión y el",
        "  de conduce son cosas distintas y de longitud distinta; una hora tiene dos",
        "  puntos. Si las dos apariciones no coinciden, **ese campo va a `ilegible`**.",
        "- **Si no puedes decidir a qué casilla pertenece un valor, va a `ilegible`.**",
        "  Un dato corrido no sale borroso: sale perfectamente legible y en el sitio",
        "  equivocado. Ese es el peor error posible aquí, porque parece bueno.",
        "  Prefiere siempre dejarlo vacío antes que asignarlo a la casilla de al lado.",
        "",
        "- `vol` son las yardas cúbicas que trae ESTE camión. Solo el número.",
        "  Va en «Cantidad Entregada», «Servidas» o «Cantidad», y en muchos conduces se",
        "  imprime TAMBIÉN en el renglón del artículo. Míralo en los dos sitios y",
        "  compáralos: si no coinciden, uno se leyó mal — devuélvelo en `ilegible`.",
        "  **NO lo confundas con «Cantidad Acumulada» ni con «Cantidad Ordenada»**, que",
        "  van en la misma fila: acumulada es lo que lleva el día, ordenada lo que se",
        "  pidió. En un conduce medido: entregada 8.50 · acumulada 17.00 · ordenada 51.00.",
        "  Está impreso en matriz de puntos y **el punto decimal es lo primero que se",
        "  pierde: 8.5 y 85 se parecen mucho**. Si no distingues el decimal con",
        "  seguridad, NO redondees ni escojas el más probable: va a `ilegible`.",
        "  Este número multiplica el precio y entra en lo que se cobra.",
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
        /* ESTE BLOQUE ESTABA PARTIDO POR LA MITAD — 14 ago 2026.
           La frase «…hay que mirarlo con cuidado: la tinta de» seguía SEIS
           LÍNEAS más abajo con «bolígrafo, el trazo irregular…». Entre medias
           se había metido, dentro de la frase, el párrafo de los nombres del
           esquema. Nadie lo vio porque el bloque se lee como una lista y cada
           línea suelta tiene sentido: **el fallo solo se ve leyéndolo seguido,
           que es justo como lo lee el modelo y no como lo lee una persona.**
           Aquí va entero y en orden. */
        "- `manuscrito` es la lista de campos que venían ESCRITOS A MANO y no impresos",
        "  por la planta. Es importante y hay que mirarlo con cuidado: la tinta de",
        "  bolígrafo, el trazo irregular y la posición torcida se distinguen del texto",
        "  impreso. Si un campo está impreso, NO lo pongas. Si dudas, no lo pongas",
        "  tampoco: aquí un aviso falso hace que dejen de mirarse los avisos.",
        "  Las casillas del ciclo (horas de salida, llegada, comienzo, fin) se rellenan",
        "  a mano por costumbre y eso es normal; aun así, dilo si las lees.",
        "  **Si el campo es uno de los del esquema, llámalo EXACTAMENTE como se llama",
        "  ahí** —ticket, truck, vol, batch, company, mix, ordenadas, chofer— y no con",
        "  otro nombre: hay un aviso en pantalla que depende de esos nombres, y un aviso",
        "  que nunca salta es peor que no tenerlo. Lo que no esté en el esquema, dilo",
        "  como quieras.",
      ].join("\n");

      /* SE REINTENTA, PORQUE UN TROPIEZO NO ES UN CONDUCE ILEGIBLE — 14 ago 2026.

         El 14 de agosto, con el primer camión del tiro de las vigas, el lector
         no leyó el conduce. El segundo entró bien con la misma cámara y el
         mismo papel. **No había nada roto: fue un tropiezo y no se volvía a
         intentar.** El técnico se comió teclear un camión entero al lado del
         chute, y nadie pudo saber por qué, porque la pantalla dice lo mismo
         para todos los fallos.

         Solo se reintenta lo que se arregla solo esperando —cola llena,
         sobrecarga, un corte de red—. Un 400 o un 401 no se reintentan: esos
         no mejoran por insistir y repetirlos solo hace esperar más de pie.

         Las esperas son cortas a propósito. Hay un camión con el chute abierto:
         más vale volver a mano en tres segundos que acertar en veinte. */
      const REINTENTABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);
      const ESPERAS = [400, 1200];   // ms; dos reintentos, ~1.6 s en el peor caso

      let r, ultimoFallo = null;
      for (let intento = 0; intento <= ESPERAS.length; intento++) {
        if (intento) await new Promise((s) => setTimeout(s, ESPERAS[intento - 1]));
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
          /* La red se cayó a mitad. Es de los que se arreglan solos. */
          r = null; ultimoFallo = { error: "sin-respuesta", codigo: 0 };
          continue;
        }
        if (r.ok) break;
        ultimoFallo = { error: "lector", codigo: r.status };
        if (!REINTENTABLE.has(r.status)) break;
        r = null;
      }

      if (!r || !r.ok) {
        /* Se dice el código y ya. El cuerpo del error puede traer trozos de la
           petición, y esto va a un aparato en la obra.
           Y va `reintentos`: sin él, un fallo que se repitió tres veces se lee
           igual que uno que pasó una vez, y son dos problemas distintos. */
        return json({ ...(ultimoFallo || { error: "lector", codigo: 0 }), reintentos: ESPERAS.length }, 502);
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

    /* ══════════════════════════════════════════════════════════════════
       «ME INTERESA» DESDE UN TABLERO — Q-69, 10 de agosto de 2026

       Víctor: «si le da al botón de contact us que me avise por la aplicación.
       Tú. Que no envíe nada.»

       No manda correo a propósito. `/api/correo` existe pero pide el secreto de
       administración —para que nadie lo use de servidor de basura— y la llave
       del correo ni siquiera está puesta. Esto **escribe una línea** y Víctor la
       ve dentro de QCheck, que es donde ya mira.

       POR QUÉ NO VA POR `/api/cambios`: los tableros entran con cuenta de
       CONSULTA y esa no escribe en el expediente, y así tiene que seguir siendo.
       Esta puerta es estrecha a propósito — solo escribe `interes`, nada más, y
       necesita sesión válida igual que todo lo demás. */
    /* ══════════════════════════════════════════════════════════════════
       AVISOS POR CORREO — Q-85, 10 de agosto de 2026

       Víctor: «QCheck me puede mandar un email?» — para enterarse de que entró
       otro aparato con la pantalla de estado cerrada.

       DOS DECISIONES DE SEGURIDAD, y las dos importan:

       1 · **Quien llama NO elige el destinatario.** Va a `QC_AVISOS_A` y a
           ningún otro sitio. Si el destino viajara en el cuerpo, esta ruta
           sería un servidor de correo abierto para cualquiera con una sesión.

       2 · **Quien llama NO escribe el texto.** Manda un TIPO de aviso y unos
           datos; el texto lo compone el servidor. Si el cuerpo llegara escrito,
           se podría mandar cualquier cosa desde nuestra dirección.

       Sin `QC_CORREO` puesta contesta 501 y lo dice — no se inventa que envió.
       Sin `QC_AVISOS_A`, lo mismo: no hay a quién avisar. */
    if (url.pathname === "/api/aviso" && req.method === "POST") {
      if (!quien) return json({ error: "sesion" }, 401);
      if (!env.QC_AVISOS_A) return json({ error: "sin-destino" }, 501);
      let d; try { d = await req.json(); } catch (_) { return json({ error: "json" }, 400); }

      const dato = (k, n) => String((d && d[k]) || "").slice(0, n).replace(/[<>]/g, "");
      const AVISOS = {
        llegada: () => {
          const q = dato("quien", 40) || "alguien";
          const ap = dato("aparato", 60) || "un aparato";
          const pg = dato("pagina", 40);
          return {
            asunto: `QCheck · entró ${q}`,
            texto: `${q} acaba de entrar a QCheck.\n\nAparato: ${ap}` +
                   (pg ? `\nPantalla: ${pg}` : "") +
                   `\nHora: ${new Date().toISOString()}\n\n— aviso automático de QCheck`,
          };
        },
      };
      const hacer = AVISOS[String(d && d.tipo)];
      if (!hacer) return json({ error: "tipo" }, 400);

      const { asunto, texto } = hacer();
      const r = await enviarCorreo(env, {
        para: String(env.QC_AVISOS_A).split(/[,;\s]+/).filter(Boolean),
        asunto, texto,
      });
      return json(r.ok ? { ok: true } : { error: r.error }, r.ok ? 200 : r.codigo);
    }

    if (url.pathname === "/api/interes" && req.method === "POST") {
      if (!quien) return json({ error: "sesion" }, 401);
      let d; try { d = await req.json(); } catch (_) { return json({ error: "json" }, 400); }
      const correo = String(d.correo || "").trim().slice(0, 120);
      /* Comprobación mínima: que parezca un correo. Ni validaciones finas ni
         listas de dominios — lo que importa es que llegue el aviso. */
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(correo)) return json({ error: "correo" }, 400);
      const ahora = new Date().toISOString();
      const id = "int-" + ahora.slice(0, 10) + "-" + quien.usr;
      await env.DB.prepare(
        "INSERT OR IGNORE INTO ops (uid, ent, id, campo, valor, ts, dev, usr) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(`interes-${id}-correo`, "interes", id, "correo",
             JSON.stringify(correo), ahora, String(d.dev || "?").slice(0, 60), quien.usr).run();
      await env.DB.prepare(
        "INSERT OR IGNORE INTO ops (uid, ent, id, campo, valor, ts, dev, usr) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(`interes-${id}-desde`, "interes", id, "desde",
             JSON.stringify(String(d.desde || "").slice(0, 40)), ahora, String(d.dev || "?").slice(0, 60), quien.usr).run();
      return json({ ok: true });
    }

    if (url.pathname === "/api/cambios" && req.method === "GET") {
      if (exige && !quien) return json({ error: "sesion" }, 401);
      const desde = Number(url.searchParams.get("desde") || 0) || 0;
      /* CUANTAS LINEAS POR VIAJE — Q-108, 28 de agosto de 2026.
       *
       * El tope evita que un aparato apagado un mes se traiga medio proyecto
       * de un tiron: pide otra vez y sigue desde donde quedo.
       *
       * Estuvo en 2.000 desde el principio, y esa noche se midio de donde
       * salia: de ningun sitio. Un numero redondo. Victor pregunto por que, y
       * la respuesta honesta era que nadie lo habia comprobado.
       *
       * Medido contra el worker de verdad, en una version de prueba aparte:
       *
       *     20.000 lineas (el expediente entero, 5,7 MB) → 1 segundo, sin error
       *
       * Cloudflare no pone ningun tope aqui. Lo que si es una razon de verdad
       * para trocear es LA COBERTURA EN OBRA: 5,7 MB de un tiron en el km 14
       * de la PR-52, con una raya de señal, se cortan a la mitad y hay que
       * empezar de cero. En trozos, lo cortado se reintenta solo y lo demas
       * ya esta dentro.
       *
       * ────────────────────────────────────────────────────────────────────
       * Y EL 29 POR LA MAÑANA SE QUITO EL TOPE — Q-125.
       *
       * Victor, con el iPad en la obra: «el sync que dividimos en 5000, quitale
       * el limite, a lo mejor es eso». Y era eso.
       *
       * Trocear parecia prudente, y era justo lo contrario. La historia llega
       * en orden, y las lineas que RETIRAN algo vienen despues de las que lo
       * crearon. Un aparato que se queda a mitad de la bajada tiene lo creado y
       * no tiene lo retirado: esa mañana, el iPad enseñaba en Recepcion el
       * vaciado de Pretensados del 14 de agosto —con su camion 209 y su viga
       * 404— que el servidor tiene retirado desde hace dias.
       *
       * > Media copia no es menos informacion. Es informacion falsa, y ademas
       * > con toda la pinta de estar bien.
       *
       * En un solo viaje eso no puede pasar: o llega el expediente entero, o no
       * llega nada y la pantalla de carga se queda puesta diciendolo. Medido
       * contra este mismo worker: 20.880 lineas, 5,7 MB, un segundo.
       *
       * El tope se queda escrito —100.000— como freno de mano por si algun dia
       * el expediente crece de verdad, no como reparto. */
      const { results } = await env.DB.prepare(
        "SELECT * FROM ops WHERE seq > ? ORDER BY seq LIMIT 100000"
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
