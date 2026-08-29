/* ============================================================
   UN APARATO LLENO NO PIERDE LO QUE EL TÉCNICO MIDIÓ — Q-148.

   Víctor, 29 de agosto de 2026: «el plan es que ahora se empiece a usar QCheck
   a diario para monitorear todos los tiros, así que necesitamos la
   infraestructura para manejar la cantidad de datos».

   Se midió generando el volumen en vez de estimarlo. Con un año de uso diario
   —5.000 ensayos— el almacén del navegador va por 4.310 KB, y el límite de
   Safari son unos 5 MB. A los 8.000 ensayos, `QuotaExceededError`.

   Que exista un techo es esperable y se arregla aparte (el aparato no tiene por
   qué llevar el histórico entero encima). Lo que NO es aceptable es cómo se
   chocaba contra él:

     · `saveDB()` llamaba a `setItem` a pelo, así que la excepción se llevaba
       por delante la línea que encola el cambio para subirlo.
     · Y dentro de `alGuardar()`, la copia de referencia —dos megas— se escribía
       ANTES que la cola —unos kilos—. Reventaba la grande y la pequeña no
       llegaba a escribirse.

   Juntas: el técnico teclea el slump, no se guarda, no se encola, no se sube, y
   la pantalla no dice nada. El camión siguiente igual.

   > Escribir dos veces es ruido. No escribir es perder una medida que ya no se
   > puede volver a tomar, porque el camión se fue.

   Esta prueba llena el almacén a propósito y comprueba lo único que importa:
   **que el dato llegue al servidor de todas formas**, y que se avise.
   ============================================================ */
import { readFileSync } from "node:fs";

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };

/* Un localStorage de mentira con tope, como el de Safari. */
function almacenConTope(tope) {
  const m = new Map();
  const caja = { tope };
  const usado = () => { let n = 0; for (const [k, v] of m) n += k.length + v.length; return n; };
  return {
    _m: m, _usado: usado, _caja: caja,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    removeItem: (k) => m.delete(k),
    setItem(k, v) {
      const antes = m.has(k) ? m.get(k).length : 0;
      if (usado() - antes + String(v).length > caja.tope) {
        const e = new Error("Setting the value of '" + k + "' exceeded the quota.");
        e.name = "QuotaExceededError";
        throw e;
      }
      m.set(k, String(v));
    },
    get length() { return m.size; },
    key: (i) => [...m.keys()][i],
  };
}
/* `Object.keys(localStorage)` es lo que usa `almacenUsado()`. */
const conLlaves = (a) => new Proxy(a, { ownKeys: (t) => [...t._m.keys()],
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });

function montar(tope) {
  const alm = conLlaves(almacenConTope(tope));
  alm.setItem("qc-api", "https://x"); alm.setItem("qc-token", "t");
  alm.setItem("qc-sync-visto", "1");
  const avisos = [];
  const subidas = [];
  const ctx = {
    localStorage: alm,
    document: { addEventListener() {}, hidden: false, getElementById: () => null },
    window: { addEventListener() {} }, navigator: { onLine: true },
    location: { pathname: "/muestras.html", protocol: "http:", hostname: "x", origin: "http://x" },
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0,
    crypto: { randomUUID: () => "u" + Math.random().toString(36).slice(2) },
    console: { ...console, warn() {}, error() {} },
    alert: (m) => avisos.push(String(m)),
    fetch: async (url, o) => {
      if (o && o.method === "POST") {
        const ops = JSON.parse(o.body).ops || [];
        subidas.push(...ops);
        return { ok: true, status: 200, json: async () => ({ seq: 1, aceptadas: ops.map((x) => x.uid), rechazadas: [] }) };
      }
      return { ok: true, status: 200, json: async () => ({ ops: [], seq: 0 }) };
    },
  };
  const src = "var DB_KEY = 'qc-pr52-db-v1';\n"
    + "var db = { tests: [], dayMeta: {}, humidity: [], plan: {}, project: {}, proyectos: [], proyectoActivo: 'p' };\n"
    + "function publishSpec(){}\n"
    + readFileSync("assets/sync.js", "utf8") + "\n"
    /* solo el trozo de core.js que hace falta: saveDB y sus avisos */
    + (() => { const c = readFileSync("assets/core.js", "utf8");
        const i = c.indexOf("function almacenUsado()");
        const f = c.indexOf("/* Sincronización en vivo.");
        return c.slice(i, f); })();
  const f = new Function(...Object.keys(ctx), src + "\n;return { QCSync, saveDB, db, almacenUsado, qcProyectar };");
  const api = f(...Object.values(ctx));
  return { api, alm, avisos, subidas };
}

console.log("\nCON SITIO DE SOBRA — todo normal");
{
  const { api, alm, subidas, avisos } = montar(5 * 1024 * 1024);
  api.QCSync._estrenarBase();
  api.db.tests.push({ id: "t1", n: 1, date: "2026-08-29", ticket: "9001", slump: 3 });
  api.saveDB();
  di(!!alm.getItem("qc-pr52-db-v1"), "la base se guarda");
  di(subidas.length > 0, `y el dato sube: ${subidas.length} apunte(s)`);
  di(avisos.length === 0, "sin avisos, que no hace falta molestar");
}

console.log("\nSIN SITIO — el aparato no puede recordar, pero el dato NO se pierde");
{
  /* Se monta la situación de verdad: un aparato con un año de trabajo dentro,
     TODO ya sincronizado (está en la copia de referencia), y el almacén al
     borde. Entonces llega un camión. */
  const { api, alm, subidas, avisos } = montar(50 * 1024 * 1024);
  for (let i = 0; i < 300; i++) {
    api.db.tests.push({ id: "v" + i, n: i, date: "2026-01-01", ticket: String(1000 + i),
      truck: "4" + i, vol: 9, slump: 3, air: 2, uw: 150, temp: 88,
      mix: "AC300503SX - 3000 PSI @ 5 DAYS (SP-503)", company: "Concre-Tech" });
  }
  api.QCSync._guardarBase(api.qcProyectar(api.db));   // historia ya subida
  api.saveDB();
  const lleno = api.almacenUsado();
  di(lleno > 50 * 1024, `el aparato lleva un año de trabajo: ${Math.round(lleno / 1024)} KB`);

  /* Y AHORA SE ACABA EL SITIO: cabe un poco más, pero no otra copia entera. */
  alm._caja.tope = lleno + 100;   /* apenas cien bytes: no cabe otra copia de la base */

  const antes = subidas.length;
  api.db.tests.push({ id: "importante", n: 999, date: "2026-08-29",
    ticket: "77777", truck: "410", slump: 3.2, air: 2.1, uw: 150.2, temp: 88 });
  api.saveDB();

  const delCamion = subidas.slice(antes).filter((o) => o.id === "importante");
  di(delCamion.length > 0, `el camión sube igual: ${delCamion.length} apunte(s)`);
  const campos = new Set(delCamion.map((o) => o.campo));
  di(["slump", "air", "uw", "temp", "ticket"].every((c) => campos.has(c)),
     `con sus lecturas: ${["slump","air","uw","temp"].filter((c) => campos.has(c)).join(" ")}`);
  di(avisos.length > 0 && /sin espacio/i.test(avisos[0]),
     `y se avisa: «${(avisos[0] || "").split("\n")[0]}»`);
  di(avisos.length === 1, "una sola vez, no en cada tecla");
  di(alm.getItem("qc-sync-cola") !== null, "la cola queda escrita, que es lo insustituible");
}

console.log("\nLA COLA SE ESCRIBE ANTES QUE LA COPIA DE REFERENCIA");
{
  const c = readFileSync("assets/sync.js", "utf8");
  const iCola = c.indexOf("this._guardarCola(this._cola().concat(ops))");
  const iBase = c.indexOf("this._guardarBase(ahora)");
  di(iCola > 0 && iBase > 0 && iCola < iBase,
     "lo pequeño e imprescindible se escribe primero");
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
