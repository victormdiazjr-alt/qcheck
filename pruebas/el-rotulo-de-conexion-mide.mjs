/* ¿El rótulo MIDE, o se queda en el valor de nacimiento?
   Se carga sync.js de verdad con un localStorage de mentira. */
import { readFileSync } from "node:fs";

function montar(qcApi, sitio) {
  const store = new Map();
  if (qcApi) { store.set("qc-api", qcApi); store.set("qc-token", "llave-de-mentira"); }
  const ctx = {
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null,
                    setItem: (k,v) => store.set(k,String(v)),
                    removeItem: k => store.delete(k) },
    document: { addEventListener(){}, hidden:false },
    window:   { addEventListener(){} },
    navigator:{ onLine:true },
    /* Q-103 (28 ago 2026) hizo que `qcApiURL()` mire `location.protocol` y
       `location.hostname` para decidir si puede caer en `location.origin`. Este
       banco solo tenia `pathname` y `href`, asi que la prueba reventaba con
       «Cannot read properties of undefined (reading 'endsWith')» — culpando al
       codigo de un hueco del banco, que ya paso una vez en esta misma carpeta. */
    location: { pathname: "/actividad.html", href: "http://x/actividad.html",
                protocol: "http:", hostname: "x", origin: "http://x", ...(sitio || {}) },
    fetch: async () => { throw new Error("sin red en la prueba"); },
    setInterval(){return 0}, clearInterval(){}, setTimeout(){return 0},
    crypto: { randomUUID: () => "uid" }, console,
  };
  ctx.self = ctx; ctx.globalThis = ctx;
  const src = readFileSync("assets/sync.js","utf8");
  const f = new Function("localStorage","document","window","navigator","fetch",
    "setInterval","clearInterval","setTimeout","crypto","console","location",
    src + "\n;return { QCSync, qcSyncActivo };");
  return f(ctx.localStorage, ctx.document, ctx.window, ctx.navigator, ctx.fetch,
           ctx.setInterval, ctx.clearInterval, ctx.setTimeout, ctx.crypto, console, ctx.location);
}

let fallos = 0;
const di = (ok, txt) => { console.log(`  ${ok ? "✓" : "✗"} ${txt}`); if(!ok) fallos++; };

/* QUE SIGNIFICA «SIN SERVIDOR» CAMBIO EL 28 DE AGOSTO — Q-103.

   Antes, sin `qc-api` guardado no habia servidor y punto. Ahora la app cae en
   `location.origin`, porque en qterapr.com la app y el servidor son el MISMO
   sitio: un aparato nuevo abre el enlace, entra con su cuenta y ya sincroniza,
   sin que nadie con las manos sucias tenga que pegar una llave.

   Asi que hoy «sin servidor» es un archivo suelto (`file:`) o GitHub Pages,
   donde de verdad no hay a quien preguntar. Esta prueba seguia montando un
   origen http normal y esperando «apagado» — y por eso llevaba en rojo. */
console.log("\nUN ARCHIVO SUELTO — ahi si es «solo este aparato»");
{
  const { QCSync } = montar(null, { protocol: "file:", hostname: "", origin: "null" });
  di(QCSync.estado === "apagado", `antes de arrancar: ${QCSync.estado}`);
  QCSync.arrancar();
  di(QCSync.estado === "apagado", `arrancar() lo deja en «apagado»: ${QCSync.estado}`);
}

console.log("\nEN SU PROPIO SITIO — el servidor es el mismo, sin pegar llave (Q-103)");
{
  const { QCSync } = montar(null);
  QCSync.arrancar();
  di(QCSync.estado !== "apagado", `arrancar() lo pone a medir: ${QCSync.estado}`);
}

console.log("\nCON servidor puesto — YA NO puede decir «solo este aparato»");
{
  const { QCSync } = montar("https://qcheck-api.qcheck.workers.dev");
  di(QCSync.estado === "apagado", `de nacimiento es «apagado» — ESTE era el fallo: ${QCSync.estado}`);
  QCSync.arrancar();
  di(QCSync.estado !== "apagado", `tras arrancar(): ${QCSync.estado}  (mide, ya no supone)`);
}

console.log("\nROMPEDOR — si alguien quita el arranque de actividad.html, esto avisa");
{
  const html = readFileSync("actividad.html","utf8");
  di(/QCSync\s*\.\s*arrancar\s*\(\s*\)/.test(html), "actividad.html arranca el motor");
  di(/assets\/sync\.js/.test(html), "actividad.html carga sync.js");
}

console.log(fallos ? `\n${fallos} FALLO(S)\n` : "\nsin fallos\n");
process.exit(fallos ? 1 : 0);
