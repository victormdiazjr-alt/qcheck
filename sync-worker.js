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
     npx wrangler deploy

   Imprime el URL (`https://qcheck-api.<cuenta>.workers.dev`). Ese es el
   que se entra en Plan & Datos → Sincronización, en cada aparato, junto
   con la llave.

   EL REGISTRO NO SE EDITA NI SE BORRA — igual que en local. Un dato que
   quedó mal se corrige con otra línea encima y las dos quedan. Un
   expediente de calidad que se puede reescribir por detrás no vale nada.
   ============================================================ */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-QC-Token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
};

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
      return json({ ok: true, seq: r.seq, cambios: r.n, protegido });
    }

    if (protegido && req.headers.get("X-QC-Token") !== env.QC_TOKEN) return json({ error: "token" }, 401);

    if (url.pathname === "/api/cambios" && req.method === "GET") {
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
        o.ts || new Date().toISOString(), o.dev || "?", o.usr || "?"
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
