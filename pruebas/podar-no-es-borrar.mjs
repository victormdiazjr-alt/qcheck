/* ============================================================
   SOLTAR PESO NO ES BORRAR EL EXPEDIENTE — Q-149 y Q-150.

   Desde hoy el aparato no carga con el histórico: lleva el tiro abierto y los
   últimos 60 días, y el resto vive en el servidor. Se hizo porque con uso
   diario el almacén del navegador se llena —4.310 KB con un año dentro, y a
   los 8.000 ensayos `QuotaExceededError`— pero es, con diferencia, **el cambio
   más peligroso que se le puede hacer a esto**.

   El peligro es concreto y tiene nombre. La sincronización sube lo que ve de
   diferencia contra su copia de referencia. Si el aparato suelta mil ensayos
   viejos y esa diferencia se lee como «los han borrado», sube mil borrados y
   se lleva por delante el expediente de todos. Eso ya pasó una vez con un solo
   campo (Q-131, el vaciado de Pretensados que resucitaba) y costó una mañana.

   Esta prueba existe para que no pueda volver a pasar. Comprueba las cuatro
   cosas que lo impiden:

     1. Un registro que falta NO se sube como borrado (Q-149).
     2. No se poda si hay algo sin subir, ni a medio sincronizar.
     3. El tiro abierto no se poda, tenga la fecha que tenga.
     4. Después de podar, la sincronización no sube NADA.

   Si alguna se cae, no se despliega. No es una prueba de rendimiento: es el
   pestillo del expediente.
   ============================================================ */
import { readFileSync } from "node:fs";

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };

const hoy = () => new Date().toISOString().slice(0, 10);
const haceDias = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

function montar({ alDia = true, cola = [] } = {}) {
  const m = new Map([["qc-api", "https://x"], ["qc-token", "t"]]);
  if (alDia) { m.set("qc-sync-visto", "1"); m.set("qc-sync-seq", "100"); m.set("qc-sync-tope", "100"); }
  if (cola.length) m.set("qc-sync-cola", JSON.stringify(cola));
  const subidas = [];
  const ctx = {
    localStorage: { getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) },
    document: { addEventListener() {}, hidden: false },
    window: { addEventListener() {} }, navigator: { onLine: true },
    location: { pathname: "/muestras.html", protocol: "http:", hostname: "x", origin: "http://x" },
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0,
    crypto: { randomUUID: () => "u" + Math.random().toString(36).slice(2) },
    console: { ...console, warn() {}, info() {} },
    fetch: async (url, o) => {
      if (o && o.method === "POST") {
        const ops = JSON.parse(o.body).ops || [];
        subidas.push(...ops);
        return { ok: true, status: 200, json: async () => ({ seq: 100, aceptadas: ops.map((x) => x.uid), rechazadas: [] }) };
      }
      return { ok: true, status: 200, json: async () => ({ ops: [], seq: 100 }) };
    },
  };
  /* `tiroActivo` vive en core.js; aquí se pone uno de mentira que dice cuál es
     el vaciado abierto, que es lo único que `_podar` le pregunta. */
  const src = "var DB_KEY = 'qc-pr52-db-v1';\n"
    + "var db = { tests: [], dayMeta: {}, humidity: [], plan: {}, project: {}, proyectos: [], proyectoActivo: 'pr-52' };\n"
    + "var __abierto = null; function tiroActivo(){ return __abierto; }\n"
    + readFileSync("assets/sync.js", "utf8");
  const f = new Function(...Object.keys(ctx), src +
    "\n;return { QCSync, qcProyectar, qcCambios, db, ponerAbierto: (d) => { __abierto = d; } };");
  return { api: f(...Object.values(ctx)), alm: m, subidas };
}

const ensayo = (id, fecha) => ({ id, n: Number(id.replace(/\D/g, "")) || 1, date: fecha,
  proyecto: "pr-52", ticket: "T" + id, truck: "400", vol: 9, slump: 3, air: 2, uw: 150, temp: 88 });

console.log("\n1 · UN REGISTRO QUE FALTA NO ES UN REGISTRO BORRADO (Q-149)");
{
  const { api } = montar();
  const antes = { test: { viejo: { ticket: "1917", slump: 8 }, nuevo: { ticket: "1918" } },
                  dayMeta: {}, plan: {}, project: {}, humidity: {}, config: {} };
  const ahora = { test: { nuevo: { ticket: "1918" } },
                  dayMeta: {}, plan: {}, project: {}, humidity: {}, config: {} };
  const ops = api.qcCambios(antes, ahora);
  di(ops.length === 0, `un ensayo que ya no está no genera nada: ${ops.length} apunte(s)`);
  di(!ops.some((o) => o.valor === null), "y desde luego ningún borrado");
}

console.log("\n2 · NO SE PODA SI HAY DUDA");
{
  const sinEstrenar = montar({ alDia: false });
  sinEstrenar.api.db.tests.push(ensayo("t1", haceDias(400)));
  di(sinEstrenar.api.QCSync._podar() === 0, "un aparato sin estrenar no poda");

  const conCola = montar({ cola: [{ uid: "x", ent: "test", id: "t9", campo: "slump", valor: 3 }] });
  conCola.api.db.tests.push(ensayo("t1", haceDias(400)));
  di(conCola.api.QCSync._podar() === 0, "con algo sin subir en la cola, tampoco");

  const aMedias = montar();
  aMedias.alm.set("qc-sync-seq", "50");     // el servidor va por 100
  aMedias.api.db.tests.push(ensayo("t1", haceDias(400)));
  di(aMedias.api.QCSync._podar() === 0, "y a medio sincronizar, tampoco");
}

console.log("\n3 · SE SUELTA LO VIEJO Y SE QUEDA LO QUE HACE FALTA");
{
  const { api } = montar();
  api.ponerAbierto(haceDias(200));                     // un tiro viejo pero ABIERTO
  api.db.tests.push(ensayo("viejo1", haceDias(400)));
  api.db.tests.push(ensayo("viejo2", haceDias(90)));
  api.db.tests.push(ensayo("reciente", haceDias(10)));
  api.db.tests.push(ensayo("dehoy", hoy()));
  api.db.tests.push(ensayo("delabierto", haceDias(200)));
  api.db.dayMeta[haceDias(400)] = { cyPlan: 100 };
  api.db.dayMeta[haceDias(10)] = { cyPlan: 100 };
  api.db.dayMeta[haceDias(200)] = { cyPlan: 100 };      // el del tiro abierto

  const soltados = api.QCSync._podar();
  const quedan = api.db.tests.map((t) => t.id).sort();
  di(soltados === 2, `se sueltan los de más de 60 días: ${soltados}`);
  di(quedan.join(",") === "dehoy,delabierto,reciente", `quedan: ${quedan.join(", ")}`);
  di(!!api.db.dayMeta[haceDias(200)], "el día del tiro ABIERTO se queda aunque sea viejo");
  di(!api.db.dayMeta[haceDias(400)], "y el día viejo y cerrado se suelta");
}

console.log("\n4 · DESPUÉS DE PODAR, NO SE SUBE NADA");
{
  const { api, subidas } = montar();
  api.ponerAbierto(hoy());
  for (let i = 0; i < 50; i++) api.db.tests.push(ensayo("v" + i, haceDias(300)));
  api.db.tests.push(ensayo("hoy1", hoy()));
  /* el aparato está al día: su copia de referencia refleja lo que hay */
  api.QCSync._guardarBase(api.qcProyectar(api.db));
  const antes = subidas.length;

  const soltados = api.QCSync._podar();
  api.QCSync.alGuardar();                 // el siguiente guardado, que es el peligro

  di(soltados === 50, `se soltaron ${soltados} ensayos viejos`);
  di(subidas.length === antes, `y no se subió NADA: ${subidas.length - antes} apunte(s)`);
  di(api.db.tests.length === 1, "en el aparato queda solo lo de la ventana");
}

console.log("\n5 · LA COPIA DE REFERENCIA SE PODA ANTES QUE LA BASE");
{
  const c = readFileSync("assets/sync.js", "utf8");
  const i = c.indexOf("_podar()");
  const trozo = c.slice(i, i + 3000);
  const iBase = trozo.indexOf("_guardarBase(qcProyectar(db))");
  const iDb = trozo.indexOf("localStorage.setItem(DB_KEY");
  di(iBase > 0 && iDb > 0 && iBase < iDb,
     "si falla en medio, el peor caso es ruido y no un borrado");
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
