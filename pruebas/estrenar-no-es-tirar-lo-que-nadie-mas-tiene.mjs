/* ============================================================
   ESTRENAR UN APARATO NO ES TIRAR LO QUE NADIE MÁS TIENE — Q-160.

   `qterapr.com/new` existe para arreglar un iPad confundido: lo vacía y le
   deja puestos el servidor y la llave. Se dice por teléfono y se hace de un
   toque, y por eso funciona.

   Pero `localStorage.clear()` no distingue. Se llevaba la copia del
   expediente —que vuelve del servidor en veinte segundos— y **la cola de lo
   que ese aparato midió y todavía no ha subido**, que no está en ningún otro
   sitio del mundo. Y las fotos de conduce esperando señal, que son prueba.

   O sea que el enlace que existe para ARREGLAR un aparato era, justo cuando
   de verdad hace falta —sin cobertura, en mitad de un tiro—, la forma más
   rápida de perder la mañana. Y callado.

   > Perder una prueba tiene que ser un ACTO de alguien. Nunca el efecto de
   > tocar un botón que decía otra cosa.

   Aquí se comprueban las dos mitades, y la primera importa tanto como la
   segunda: que el caso normal NO cambió nada.
   ============================================================ */
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };

/* El guion de la página, sacado del propio archivo: si alguien lo cambia, esta
   prueba prueba lo que hay, no una copia que se quedó vieja. */
const HTML = readFileSync(join(RAIZ, "preparar.html"), "utf8");
const GUION = (HTML.match(/<script>([\s\S]*?)<\/script>/) || [])[1];
if (!GUION) { console.log("  ✗ no se encuentra el guion de preparar.html"); process.exit(1); }

/* ------------------------------------------------------------ el servidor */
const dir = mkdtempSync(join(tmpdir(), "qc-prep-"));
const REG = join(dir, "c.jsonl");
writeFileSync(REG, JSON.stringify({ seq: 1, uid: "s1", ent: "project", id: "pr-52",
  campo: "name", valor: "PR-52", ts: "2026-01-01T00:00:00.000Z", dev: "s", usr: "admin" }) + "\n");
const { crearAlmacen, montarAPI } = await import(join(RAIZ, "sync-servidor.js")).then((m) => m.default || m);
const atender = montarAPI(crearAlmacen(REG), "", { fotos: join(dir, "conduces") });
const PUERTO = 8798;
const srv = http.createServer((q, r) => { if (!atender(q, r)) { r.writeHead(404); r.end("no"); } }).listen(PUERTO);
const SITIO = "http://127.0.0.1:" + PUERTO;
const limpiar = () => { try { srv.close(); } catch (_) {} try { rmSync(dir, { recursive: true, force: true }); } catch (_) {} };
process.on("exit", limpiar);

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

/* ------------------------------------------------------------ el aparato

   Un navegador de mentira con lo justo que la página toca. El almacén es un
   Map de verdad para poder mirar QUÉ quedó dentro después. */
function montarAparato({ cola = [], fotos = [], senal = { valor: true }, responde = null, busqueda = "?k=llave-buena" } = {}) {
  const alm = new Map([
    ["qc-api", SITIO], ["qc-token", "t-viejo"], ["qc-sesion", "pase"],
    ["qc-dev", "iPad · prueba"], ["qc-user", "tecnico1"],
    ["qc-pr52-db-v1", JSON.stringify({ tests: [{ id: "t1", n: 1 }] })],
    ["qc-sync-seq", "1200"],
  ]);
  if (cola.length) alm.set("qc-sync-cola", JSON.stringify(cola));
  if (fotos.length) alm.set("qc-fotos", JSON.stringify(fotos));

  const el = (id) => ({ id, textContent: "", className: "", hijos: [],
    get firstChild() { return this.hijos[0] || null; },
    removeChild(n) { this.hijos = this.hijos.filter((x) => x !== n); },
    appendChild(n) { this.hijos.push(n); return n; } });
  const nodos = { t: el("t"), s: el("s"), b: el("b") };
  let fue = null, confirmado = true;
  const ctx = {
    document: {
      getElementById: (id) => nodos[id],
      createElement: () => ({ textContent: "", className: "", onclick: null }),
    },
    localStorage: {
      getItem: (k) => (alm.has(k) ? alm.get(k) : null),
      setItem: (k, v) => alm.set(k, String(v)),
      removeItem: (k) => alm.delete(k),
      clear: () => alm.clear(),
    },
    sessionStorage: { clear() {} },
    location: { search: busqueda, origin: SITIO, replace: (u) => { fue = u; } },
    fetch: async (u, o) => {
      if (!senal.valor) throw new TypeError("Failed to fetch");
      if (responde) { const r = responde(u, o); if (r) return r; }
      return fetch(u, o);
    },
    confirm: () => confirmado,
    URLSearchParams, setTimeout, console, TypeError, Set, Date, Math, JSON,
  };
  return {
    alm, nodos,
    correr: () => new Function(...Object.keys(ctx), GUION)(...Object.values(ctx)),
    adonde: () => fue,
    botones: () => nodos.b.hijos.map((x) => x.textContent),
    pulsar: (txt) => { const b = nodos.b.hijos.find((x) => x.textContent === txt); return b && b.onclick(); },
    diceQue: () => nodos.t.textContent + " · " + nodos.s.textContent,
    responder: (v) => { confirmado = v; },
  };
}
const esperar = (fn, ms = 2500) => new Promise((listo, mal) => {
  const t0 = Date.now();
  const mirar = () => fn() ? listo() : (Date.now() - t0 > ms ? mal(new Error("no llegó")) : setTimeout(mirar, 20));
  mirar();
});

const APUNTE = { uid: "x1", ent: "test", id: "t1", campo: "slump", valor: 3.25, ts: "2026-08-30T10:00:00.000Z", dev: "iPad · prueba", usr: "tecnico1" };

console.log("\n1 · UN APARATO AL DÍA SE PREPARA IGUAL QUE SIEMPRE");
{
  /* Lo primero que hay que no romper. Un iPad recién sacado de la caja, o uno
     que subió todo, tiene que entrar de un toque y sin ver ninguna pantalla
     nueva — y sin llamar al servidor para nada. */
  let llamadas = 0;
  const a = montarAparato({ responde: () => { llamadas++; return null; } });
  a.correr();
  await esperar(() => a.adonde());
  di(a.adonde() === "index.html", `entra directo: ${a.adonde()}`);
  di(llamadas === 0, `sin preguntarle nada al servidor: ${llamadas} llamada(s)`);
  di(a.alm.get("qc-api") === SITIO && a.alm.get("qc-token") === "llave-buena",
     "y con el servidor y la llave nueva puestos");
  di(!a.alm.has("qc-pr52-db-v1") && !a.alm.has("qc-sync-seq"), "la copia vieja, fuera");
  di(a.botones().length === 0, "y ningún botón: no hay nada que decidir");
}

console.log("\n2 · CON ALGO SIN SUBIR Y CON SEÑAL: SE SUBE, Y LUEGO SE BORRA");
{
  const a = montarAparato({ cola: [APUNTE] });
  a.correr();
  await esperar(() => a.adonde());
  di(a.adonde() === "index.html", "acaba entrando igual");
  const r = await fetch(SITIO + "/api/cambios?desde=0");
  const d = await r.json();
  di(d.ops.some((o) => o.uid === "x1" && o.campo === "slump" && o.valor === 3.25),
     "y el apunte del técnico está EN EL SERVIDOR antes de borrar nada");
}

console.log("\n3 · SIN SEÑAL NO SE BORRA. Y ESTA ES LA QUE IMPORTA");
{
  const senal = { valor: false };
  const a = montarAparato({ cola: [APUNTE], senal });
  a.correr();
  await esperar(() => a.botones().length > 0);
  di(!a.adonde(), "no entra: se para");
  di(a.alm.has("qc-sync-cola"), "la cola sigue dentro del aparato");
  di(JSON.parse(a.alm.get("qc-sync-cola"))[0].uid === "x1", "con el apunte intacto");
  di(a.alm.has("qc-pr52-db-v1"), "y no se ha borrado nada de nada");
  di(/1 apunte/.test(a.diceQue()), `dice qué hay dentro: «${a.nodos.t.textContent}»`);
  di(/señal/i.test(a.diceQue()), "y por qué no pudo");
  di(/para siempre/.test(a.diceQue()), "y qué se pierde si se borra igual");
  di(a.botones().length === 2 && /Reintentar/.test(a.botones()[0]),
     `dos salidas, y la primera es la buena: ${a.botones().join(" · ")}`);
  di(/perderlo/i.test(a.botones()[1]), "la destructiva se llama por su nombre");

  console.log("\n4 · Y AL VOLVER LA SEÑAL, REINTENTAR TERMINA EL TRABAJO");
  senal.valor = true;
  a.pulsar("Reintentar");
  await esperar(() => a.adonde());
  di(a.adonde() === "index.html", "sube lo que faltaba y entra");
  const d = await (await fetch(SITIO + "/api/cambios?desde=0")).json();
  di(d.ops.filter((o) => o.uid === "x1").length >= 1, "con el apunte a salvo en el servidor");
}

console.log("\n5 · LA FOTO DEL CONDUCE TAMPOCO SE TIRA — Y SE ENGANCHA A SU CAMIÓN");
{
  const a = montarAparato({ fotos: [{ id: "t1", ticket: "69298", dataUrl: JPEG, ts: "x" }] });
  a.correr();
  await esperar(() => a.adonde());
  di(a.adonde() === "index.html", "se prepara");
  const d = await (await fetch(SITIO + "/api/cambios?desde=0")).json();
  const ref = d.ops.filter((o) => o.ent === "test" && o.campo === "photoRef" && o.id === "t1").pop();
  di(!!ref, "la foto subió al archivador");
  di(!!ref && /^conduce\//.test(String(ref.valor)), `y su camión se quedó con el enlace: ${ref && ref.valor}`);
  const f = await fetch(SITIO + "/api/foto?clave=" + encodeURIComponent(ref.valor));
  di(f.ok, "y la foto se puede ver desde el archivador");
}

console.log("\n6 · SIN PASE DE SESIÓN NO SE ADIVINA: SE MANDA A ENTRAR CON LA CLAVE");
{
  const a = montarAparato({ cola: [APUNTE],
    responde: (u) => (String(u).includes("/api/cambios")
      ? { ok: false, status: 401, json: async () => ({ error: "sesion" }) } : null) });
  a.correr();
  await esperar(() => a.botones().length > 0);
  di(!a.adonde() && a.alm.has("qc-sync-cola"), "no borra");
  di(/clave/i.test(a.diceQue()), `y dice cómo se arregla: «${a.nodos.s.textContent.slice(0, 64)}…»`);
}

console.log("\n7 · BORRAR IGUAL ES UN ACTO, Y HAY QUE FIRMARLO DOS VECES");
{
  const senal = { valor: false };
  const a = montarAparato({ cola: [APUNTE], senal });
  a.correr();
  await esperar(() => a.botones().length > 0);

  a.responder(false);
  a.pulsar("Borrar igual y perderlo");
  di(a.alm.has("qc-sync-cola") && !a.adonde(), "decir que no en el aviso NO borra");

  a.responder(true);
  a.pulsar("Borrar igual y perderlo");
  await esperar(() => a.adonde());
  di(!a.alm.has("qc-sync-cola"), "y decir que sí, sí — pero es una decisión, no un descuido");
}

console.log("\n8 · UN ENLACE SIN LLAVE NO TOCA NADA");
{
  /* El enlace se dicta por telefono y se teclea con guante. Uno a medias no
     puede ser peor que uno entero: si falta la llave, no se toca nada. */
  const a = montarAparato({ cola: [APUNTE], busqueda: "" });
  a.correr();
  di(a.alm.has("qc-sync-cola") && !a.adonde(), "sin llave no borra ni entra");
  di(/llave/i.test(a.nodos.t.textContent), `y lo dice: «${a.nodos.t.textContent}»`);
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
limpiar();
process.exit(fallos ? 1 : 0);
