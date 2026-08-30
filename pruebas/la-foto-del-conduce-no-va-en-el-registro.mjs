/* ============================================================
   LA FOTO DEL CONDUCE VA AL ARCHIVADOR, NO AL REGISTRO — Q-153.

   Víctor: «hazlo con R2 entonces».

   La foto se guardaba dentro de la ficha del camión, así que viajaba a todos
   los aparatos y se quedaba en el registro —que no se borra— para siempre.
   Veinte camiones al día son 2 MB diarios dentro de un almacén de 5 MB.

   Ahora se guarda una vez en el archivador y en la ficha queda el enlace. Aquí
   se comprueban las cuatro cosas que tienen que ser verdad, y la tercera es la
   que importa de verdad en obra:

     1. Con señal, la foto sube y la ficha lleva el enlace, no la imagen.
     2. El registro RECHAZA una foto aunque alguien la mande — el pestillo,
        para que no vuelva a colarse por una versión vieja.
     3. SIN SEÑAL, el camión entra igual y la foto espera. No se pierde y no se
        mete en la ficha: es prueba del expediente.
     4. Al volver la señal, sube sola y se engancha a su camión.
   ============================================================ */
import { readFileSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };

/* Un JPEG diminuto pero de verdad, para no depender de nada de fuera. */
const JPEG = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf" +
  "/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
const FOTO = "data:image/jpeg;base64," + JPEG;

const dir = mkdtempSync(join(tmpdir(), "qc-foto-"));
const REG = join(dir, "c.jsonl");
writeFileSync(REG, JSON.stringify({ seq: 1, uid: "s1", ent: "project", id: "pr-52",
  campo: "name", valor: "PR-52", ts: "2026-01-01T00:00:00.000Z", dev: "s", usr: "admin" }) + "\n");

const { crearAlmacen, montarAPI } = await import(join(RAIZ, "sync-servidor.js")).then((m) => m.default || m);
const atender = montarAPI(crearAlmacen(REG), "", { fotos: join(dir, "conduces") });
const PUERTO = 8799;
const srv = http.createServer((req, res) => { if (!atender(req, res)) { res.writeHead(404); res.end("no"); } }).listen(PUERTO);
const SITIO = "http://127.0.0.1:" + PUERTO;
const limpiar = () => { try { srv.close(); } catch (_) {} try { rmSync(dir, { recursive: true, force: true }); } catch (_) {} };
process.on("exit", limpiar);

/* El aparato: los modulos de verdad, con un localStorage de mentira. */
function montarAparato({ conSenal = true } = {}) {
  const m = new Map([["qc-api", SITIO], ["qc-dev", "PC · prueba"], ["qc-user", "ruben"]]);
  const ctx = {
    localStorage: { getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) },
    console: { ...console, warn() {}, info() {}, error() {} },
    fetch: async (...a) => { if (!conSenal.valor) throw new TypeError("Failed to fetch"); return fetch(...a); },
    db: null,
  };
  const src = "var db = { tests: [] };\n"
    + "function qcApiURL(){ return localStorage.getItem('qc-api') || ''; }\n"
    + "function qcApiToken(){ return ''; }\n"
    + "function qcSyncActivo(){ return !!qcApiURL(); }\n"
    + "function qcAparato(){ return 'PC · prueba'; }\n"
    + "var guardados = 0; function saveDB(){ guardados++; }\n"
    + readFileSync(join(RAIZ, "assets/fotos.js"), "utf8");
  const f = new Function(...Object.keys(ctx), src +
    "\n;return { archivarConduce, subirFotosPendientes, fuenteDelConduce, conduceEnEspera, fotosPendientes, db };");
  return { api: f(...Object.values(ctx)), alm: m };
}

console.log("\n1 · CON SEÑAL: LA FOTO AL ARCHIVADOR, EL ENLACE A LA FICHA");
{
  const senal = { valor: true };
  const { api } = montarAparato({ conSenal: senal });
  const t = { id: "t1", ticket: "88001", truck: "410" };
  api.db.tests.push(t);
  const clave = await api.archivarConduce(FOTO, t);
  di(!!clave, `sube y devuelve la clave: ${String(clave).slice(0, 34)}…`);
  di(t.photoRef === clave, "la ficha lleva el enlace");
  di(!t.photo, "y NO lleva la imagen dentro");
  di(api.fotosPendientes() === 0, "no queda nada esperando");

  const r = await fetch(api.fuenteDelConduce(t));
  const bytes = new Uint8Array(await r.arrayBuffer());
  di(r.ok && bytes.length > 0, `y la foto se puede ver: ${bytes.length} bytes`);
  di((r.headers.get("content-type") || "").includes("image"), "servida como imagen");
}

console.log("\n2 · EL PESTILLO: EL REGISTRO RECHAZA UNA FOTO");
{
  const r = await fetch(SITIO + "/api/cambios", { method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ops: [
      { uid: "f1", ent: "test", id: "t9", campo: "photo", valor: FOTO, ts: "x", dev: "viejo" },
      { uid: "f2", ent: "test", id: "t9", campo: "ticket", valor: "99999", ts: "x", dev: "viejo" },
    ] }) });
  const d = await r.json();
  const rechazada = (d.rechazadas || []).find((x) => x.uid === "f1");
  di(!!rechazada, "la foto se rechaza");
  di(rechazada && /archivador/.test(rechazada.motivo), `diciendo por qué: «${rechazada && rechazada.motivo}»`);
  di((d.aceptadas || []).includes("f2"), "y el resto del camión entra igual");
}

console.log("\n3 · SIN SEÑAL: EL CAMIÓN ENTRA Y LA FOTO ESPERA");
{
  const senal = { valor: false };
  const { api, alm } = montarAparato({ conSenal: senal });
  const t = { id: "t2", ticket: "88002", truck: "411" };
  api.db.tests.push(t);
  const clave = await api.archivarConduce(FOTO, t);
  di(clave === null, "no se pudo subir, y se dice");
  di(!t.photo && !t.photoRef, "la ficha NO se queda con la imagen dentro");
  di(api.fotosPendientes() === 1, `la foto espera en el cajón: ${api.fotosPendientes()}`);
  di(api.conduceEnEspera("t2") === FOTO, "y el técnico puede verla mientras espera");
  di(!alm.has("qc-sync-cola"), "el cajón de fotos es aparte: no ensucia la cola del expediente");

  console.log("\n4 · Y AL VOLVER LA SEÑAL, SUBE SOLA");
  senal.valor = true;
  const subidas = await api.subirFotosPendientes();
  di(subidas === 1, `sube ${subidas} foto(s)`);
  di(!!t.photoRef, `y se engancha a su camión: ${String(t.photoRef).slice(0, 30)}…`);
  di(api.fotosPendientes() === 0, "el cajón queda vacío");
  const r = await fetch(api.fuenteDelConduce(t));
  di(r.ok, "y la foto ya se puede ver desde el archivador");
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
limpiar();
process.exit(fallos ? 1 : 0);
