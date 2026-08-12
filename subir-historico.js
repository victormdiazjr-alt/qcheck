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
     QC_TOKEN="$(tr -d "[:space:]" < datos/llave-proyecto.txt)" \
     node subir-historico.js                ← enseña lo que haría, sin escribir
     node subir-historico.js --de-verdad    ← escribe

   LA CLAVE LA PIDE EL PROGRAMA y no se ve al teclearla. No va en la línea de
   comandos: lo que se escribe ahí queda en el historial del terminal y en la
   lista de procesos, a la vista de cualquiera que pase por la máquina. Es lo
   mismo que hace `cuentas.js` y por el mismo motivo.

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

/* LA CLAVE SE PIDE, NO SE ESCRIBE EN LA LÍNEA — como en `cuentas.js`.

   La primera versión la esperaba en el entorno y el comando llevaba un hueco
   para rellenar. Víctor lo pegó tal cual y zsh se comió el `<` como redirección.
   Además, una clave escrita en la línea queda en el historial del terminal y en
   la lista de procesos. Se pide aquí, sin eco. */
function preguntarClave(texto) {
  return new Promise((resolve) => {
    process.stdout.write(texto);
    const tty = process.stdin;
    if (!tty.isTTY) { let d = ""; tty.on("data", (c) => d += c); tty.on("end", () => resolve(d.trim())); return; }
    tty.setRawMode(true); tty.resume(); tty.setEncoding("utf8");
    let clave = "", cerrado = false;
    /* CARÁCTER A CARÁCTER, y no el trozo entero — el fallo de la primera
       versión. Al PEGAR una clave, el terminal entrega el texto y el salto de
       línea **en el mismo trozo**; comparar el trozo con "\r" no coincidía y la
       clave se guardaba con el salto pegado al final. El servidor contestaba
       401 y parecía que la clave estaba mal. */
    const alTeclear = (trozo) => {
      if (cerrado) return;
      for (const c of String(trozo)) {
        if (c === "\n" || c === "\r" || c === "\u0004") {
          cerrado = true;
          tty.setRawMode(false); tty.pause(); tty.removeListener("data", alTeclear);
          process.stdout.write("\n"); resolve(clave);
          return;
        }
        if (c === "\u0003") { process.stdout.write("\n"); process.exit(1); }
        else if (c === "\u007f" || c === "\b") clave = clave.slice(0, -1);
        else if (c >= " ") clave += c;          // los de control no entran
      }
    };
    tty.on("data", alTeclear);
  });
}
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
    const usr = USR || "ruben";
    const clave = CLAVE || await preguntarClave(`  Clave de ${usr} (no se ve al teclear): `);
    if (!clave) morir("sin clave no se puede entrar");
    const s = await pedir("/api/sesion", { method: "POST", body: JSON.stringify({ usr, clave }) });
    /* EL PASE VIENE EN `tk`, no en `pase` — y esto costó una vuelta más. El
       servidor contestaba 200, o sea que la clave estaba bien, y este código
       leía un campo que no existe y decía «no pude entrar». Ver `index.html`,
       que guarda `s.tk` en `qc-sesion`. */
    if (s.estado !== 200) morir(`no pude entrar como ${usr} (${s.estado})`);
    pase = s.cuerpo.tk || s.cuerpo.pase;
    if (!pase) morir(`el servidor aceptó la clave pero no mandó pase: ${JSON.stringify(s.cuerpo).slice(0, 120)}`);
    console.log(`  Sesión  : dentro como ${usr}`);
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
