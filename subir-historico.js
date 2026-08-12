/* ============================================================
   SUBIR EL HISTÓRICO AL SERVIDOR — Q-64, 10 de agosto de 2026.

   POR QUÉ EXISTE ESTO, que es lo importante:

   Los 397 ensayos de la PR-52 nunca estuvieron en el servidor. Vivían en
   `assets/seed.js`, dentro del repositorio — y cada aparato los sacaba del
   archivo, no de la base. El servidor tenía 894 líneas cuando 397 ensayos con
   sus campos son más de ocho mil.

   Eso quiere decir que el expediente que vendemos como imposible de reescribir
   **para el histórico no era un registro del servidor: era un archivo**. Quien
   pudiera editar el repositorio podía cambiar un resultado y ningún servidor se
   enteraba.

   Esto lo arregla: sube cada ensayo como líneas del expediente, con `uid`
   estable. Se puede correr dos veces sin miedo — el servidor hace
   `INSERT OR IGNORE` sobre `uid`, así que la segunda pasada no duplica nada.

   CÓMO SE CORRE

     QC_API=https://qcheck-api.qcheck.workers.dev \
     QC_TOKEN=<la llave del proyecto> \
     QC_USR=ruben QC_CLAVE=<su clave> \
     node subir-historico.js            ← enseña lo que haría, sin escribir

     ... y con --de-verdad al final, escribe.

   La clave se lee del entorno y NO se escribe en la línea de comandos ni queda
   en ningún archivo. Ver la cabecera de `cuentas.js`: lo que se teclea en la
   línea queda en el historial del terminal.

   EL AUTOR DE CADA LÍNEA. Estos ensayos los tecleó alguien en un Excel antes de
   que QCheck existiera. Firmarlos con la cuenta que los sube sería decir que
   los midió quien no los midió, así que van con `usr: "historico-excel"` y su
   fecha real. **Un dato que no sabe de dónde viene puede seguir siendo útil;
   uno que dice venir de donde no vino, no.**
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const API = (process.env.QC_API || "").replace(/\/+$/, "");
const TOKEN = process.env.QC_TOKEN || "";
const USR = process.env.QC_USR || "";
const CLAVE = process.env.QC_CLAVE || "";
const DE_VERDAD = process.argv.includes("--de-verdad");

const morir = (m) => { console.error("\n  ✗ " + m + "\n"); process.exit(1); };
if (!API) morir("falta QC_API");
if (!TOKEN) morir("falta QC_TOKEN — la llave del proyecto");

/* ---------------------------------------------------------- el corpus */
function leerSeed() {
  const s = fs.readFileSync(path.join(__dirname, "assets", "seed.js"), "utf8");
  return JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1));
}

/* Los mismos derivados que `qcDerivado()` en sync.js: lo que se recalcula no
   viaja, porque ocuparía sitio y podría contradecir al cálculo de mañana. */
const DERIVADO = new Set(["_ma5", "_zone", "_paf", "_pwl"]);

/* El `id` del ensayo se deduce de su número, igual que en `qcIdDe(t,"t")`, para
   que salga idéntico en todos los aparatos: todos vienen del mismo seed.js. */
const idDe = (t) => t.id || ("t-seed-" + t.n);

function opsDe(tests, proyecto) {
  const ops = [];
  for (const t of tests) {
    const id = idDe(t);
    for (const campo of Object.keys(t)) {
      if (campo === "id" || DERIVADO.has(campo)) continue;
      const valor = t[campo];
      if (valor === undefined) continue;
      ops.push({
        uid: `hist-${id}-${campo}`,          // estable: correrlo dos veces no duplica
        ent: "test", id, campo, valor,
        ts: (t.date ? t.date + "T12:00:00.000Z" : new Date(0).toISOString()),
        dev: "historico", usr: "historico-excel",
      });
    }
    if (proyecto && !t.proyecto) {
      ops.push({ uid: `hist-${id}-proyecto`, ent: "test", id, campo: "proyecto",
                 valor: proyecto, ts: (t.date || "1970-01-01") + "T12:00:00.000Z",
                 dev: "historico", usr: "historico-excel" });
    }
  }
  return ops;
}

/* ---------------------------------------------------------- el servidor */
async function pedir(ruta, opciones = {}, pase) {
  const cab = Object.assign({ "X-QC-Token": TOKEN, "Content-Type": "application/json" },
                            pase ? { "X-QC-Sesion": pase } : {}, opciones.headers || {});
  const r = await fetch(API + ruta, Object.assign({}, opciones, { headers: cab }));
  const cuerpo = await r.json().catch(() => ({}));
  return { estado: r.status, cuerpo };
}

async function main() {
  const seed = leerSeed();
  const proyecto = (seed.project && seed.project.id) || "pr-52";
  const ops = opsDe(seed.tests || [], proyecto);

  console.log(`\n  Corpus  : ${seed.tests.length} ensayos · «${seed.project.name}»`);
  console.log(`  Líneas  : ${ops.length} para el expediente`);
  console.log(`  Obra    : ${proyecto}`);
  console.log(`  Servidor: ${API}`);

  const salud = await pedir("/api/salud");
  if (salud.estado !== 200) morir(`el servidor contesta ${salud.estado}`);
  console.log(`  Ahora   : ${salud.cuerpo.cambios} líneas guardadas · seq ${salud.cuerpo.seq}` +
              `${salud.cuerpo.sesiones ? " · exige sesión" : ""}`);

  if (!DE_VERDAD) {
    console.log(`\n  Esto es un ENSAYO: no se ha escrito nada.`);
    console.log(`  Para escribir de verdad, añade  --de-verdad\n`);
    return;
  }

  let pase = null;
  if (salud.cuerpo.sesiones) {
    if (!USR || !CLAVE) morir("el servidor exige sesión: hacen falta QC_USR y QC_CLAVE");
    const s = await pedir("/api/sesion", { method: "POST", body: JSON.stringify({ usr: USR, clave: CLAVE }) });
    if (s.estado !== 200 || !s.cuerpo.pase) morir(`no pude entrar como ${USR} (${s.estado})`);
    pase = s.cuerpo.pase;
    console.log(`  Sesión  : dentro como ${USR}`);
  }

  /* De 500 en 500: un cuerpo enorme se cae por tiempo y deja medio subido. Con
     `uid` estable, volver a lanzarlo retoma sin duplicar. */
  const TANDA = 500;
  let subidas = 0;
  for (let i = 0; i < ops.length; i += TANDA) {
    const trozo = ops.slice(i, i + TANDA);
    const r = await pedir("/api/cambios", { method: "POST", body: JSON.stringify({ ops: trozo }) }, pase);
    if (r.estado !== 200) morir(`tanda ${i / TANDA + 1}: el servidor contestó ${r.estado} ${JSON.stringify(r.cuerpo)}`);
    subidas += trozo.length;
    process.stdout.write(`\r  Subiendo: ${subidas} / ${ops.length}`);
  }
  console.log("");

  const fin = await pedir("/api/salud");
  console.log(`\n  ✓ Hecho. El servidor pasa de ${salud.cuerpo.cambios} a ${fin.cuerpo.cambios} líneas.`);
  console.log(`    Se puede volver a correr: no duplica.\n`);
}

main().catch((e) => morir(e.message));
