/* ============================================================
   CUENTAS — quién puede entrar a QCheck. Q-07.

   Node puro, sin una sola dependencia. Habla con la misma API que usan
   los aparatos, así que sirve igual contra la laptop de la obra que
   contra Cloudflare: solo cambia la dirección.

     node cuentas.js listar
     node cuentas.js crear ruben --rol qc --nombre "Rubén Segarra"
     node cuentas.js clave ruben
     node cuentas.js baja ruben
     node cuentas.js alta ruben
     node cuentas.js exigir-sesion on
     node cuentas.js exigir-sesion off

   QUÉ HACE FALTA TENER PUESTO

     QC_API     dirección del servidor   (por defecto http://127.0.0.1:8452)
     QC_TOKEN   la llave del proyecto    (si no, se lee de datos/llave-proyecto.txt)
     QC_ADMIN   el secreto de administración — SIN ESTO NO SE CREA NADIE

   **QC_ADMIN no es la llave del proyecto y no puede serlo.** La llave viaja
   dentro del enlace de conexión que tiene Rubén; si sirviera además para dar
   de alta cuentas, cualquiera que viese ese enlace podría hacerse una y
   firmar el expediente. Dar de alta a alguien es cosa de Víctor.

   LA CLAVE NO SE ESCRIBE EN LA LÍNEA DE COMANDOS. Se pide aparte y no se ve
   al teclearla: lo que se escribe en la línea queda en el historial del
   terminal y en la lista de procesos, a la vista de cualquiera que pase por
   la máquina. Con `--generar` la inventa el propio programa.

   EL ORDEN DE LA MUDANZA, y no es negociable:

     1. Crear las cuentas          ← los aparatos siguen trabajando igual
     2. Repartir las claves y que cada aparato entre una vez
     3. `exigir-sesion on`         ← solo cuando TODOS estén dentro

   Encenderla antes deja a Rubén fuera en mitad de un vaciado. Ver
   `DECISIONS.md` §17.
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const API = (process.env.QC_API || "http://127.0.0.1:8452").replace(/\/+$/, "");
const ADMIN = process.env.QC_ADMIN || "";

/* La llave del proyecto vive FUERA del repositorio, que es público. */
function llaveProyecto() {
  if (process.env.QC_TOKEN) return process.env.QC_TOKEN;
  try {
    return fs.readFileSync(path.join(__dirname, "datos", "llave-proyecto.txt"), "utf8").trim();
  } catch (_) { return ""; }
}

function morir(mensaje) {
  console.error("\n  ✗ " + mensaje + "\n");
  process.exit(1);
}

async function pedir(ruta, metodo, cuerpo) {
  const cab = { "Content-Type": "application/json" };
  const tk = llaveProyecto();
  if (tk) cab["X-QC-Token"] = tk;
  if (ADMIN) cab["X-QC-Admin"] = ADMIN;
  let r;
  try {
    r = await fetch(API + ruta, {
      method: metodo || "GET", headers: cab,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch (e) { morir(`no contesta ${API} — ¿está levantado el servidor?`); }

  const datos = await r.json().catch(() => ({}));
  if (r.status === 403) morir("el secreto de administración no vale. Ponlo en QC_ADMIN.");
  if (r.status === 401) morir("la llave del proyecto no vale. Ponla en QC_TOKEN o en datos/llave-proyecto.txt.");
  if (r.status === 501) morir("este servidor no tiene cuentas montadas.");
  if (!r.ok) morir(`el servidor contestó ${r.status}: ${datos.error || "sin detalle"}`);
  return datos;
}

/* Se teclea a ciegas: nadie que mire la pantalla por encima del hombro la ve,
   y no queda en el historial. Se pide dos veces porque una clave mal tecleada
   deja a alguien fuera y no hay forma de averiguar qué se escribió. */
function preguntarClave(rotulo) {
  return new Promise((listo) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const alEscribir = rl._writeToOutput;
    rl._writeToOutput = function (s) {
      if (s.includes(rotulo)) alEscribir.call(rl, s);
    };
    rl.question(rotulo, (v) => { rl.close(); process.stdout.write("\n"); listo(v); });
  });
}

function claveInventada() {
  /* Sin caracteres que se confundan al dictarla por teléfono, que es como se
     va a repartir: nada de l/1/I ni de O/0. */
  const abc = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = require("crypto").randomBytes(20);
  return [...b].map((n) => abc[n % abc.length]).join("").replace(/(.{5})/g, "$1-").replace(/-$/, "");
}

function opcion(args, nombre) {
  const i = args.indexOf("--" + nombre);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true) : null;
}

async function main() {
  const [, , orden, ...args] = process.argv;

  if (!orden || orden === "ayuda" || orden === "--help") {
    console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^\/\* =+\n/, ""));
    return;
  }

  /* Se comprueba ANTES de pedir nada. Preguntar una clave dos veces para
     después decir que faltaba el secreto es hacer teclear a cambio de nada. */
  if (!ADMIN) morir("falta el secreto de administración. Ponlo en QC_ADMIN.");

  if (orden === "listar") {
    const d = await pedir("/api/cuentas");
    console.log("");
    if (!d.usuarios.length) console.log("  (todavía no hay ninguna cuenta)");
    for (const u of d.usuarios) {
      const marcas = [u.rol, u.tablero ? "tablero" : null, u.config ? "Plan & Datos" : null,
                      u.activo ? null : "DE BAJA"].filter(Boolean).join(" · ");
      console.log(`  ${u.usr.padEnd(12)} ${String(u.nombre).padEnd(22)} ${marcas}`);
    }
    console.log(`\n  exigir sesión: ${d.exigir_sesion ? "SÍ — sin pase no se escribe" : "no — todavía se acepta la llave sola"}\n`);
    return;
  }

  if (orden === "exigir-sesion") {
    const valor = args[0];
    if (valor !== "on" && valor !== "off") morir("dime `on` u `off`.");
    if (valor === "on") {
      const d = await pedir("/api/cuentas");
      const conQC = d.usuarios.filter((u) => u.rol === "qc" && u.activo);
      if (!conQC.length) morir("no hay ninguna cuenta de QC activa: encenderlo dejaría a todo el mundo fuera.");
      console.log(`\n  Van a quedar dentro ${conQC.length} cuenta(s) de QC: ${conQC.map((u) => u.usr).join(", ")}`);
      console.log("  Cualquier aparato que no haya entrado con una de ellas DEJA DE PODER ESCRIBIR.\n");
      const si = await preguntarClave("  Escribe SI para confirmar: ");
      if (si.trim().toUpperCase() !== "SI") morir("no se tocó nada.");
    }
    await pedir("/api/cuentas", "POST", { exigir_sesion: valor === "on" });
    console.log(`\n  ✓ exigir sesión: ${valor === "on" ? "ENCENDIDO" : "apagado"}\n`);
    return;
  }

  const usr = args[0];
  if (!usr || usr.startsWith("--")) morir("dime de qué usuario.");

  if (orden === "baja" || orden === "alta") {
    await pedir("/api/cuentas", "POST", { usr, activo: orden === "alta" });
    console.log(`\n  ✓ ${usr} queda ${orden === "alta" ? "de alta" : "DE BAJA"}\n`);
    return;
  }

  if (orden === "crear" || orden === "clave") {
    let clave;
    if (opcion(args, "generar")) {
      clave = claveInventada();
    } else {
      clave = await preguntarClave(`  Clave para ${usr}: `);
      /* Doce y no ocho. El derivado está topado a 100.000 vueltas por
         Cloudflare, así que lo que de verdad separa una clave buena de una
         mala aquí es su largo. Con `--generar` esto no aplica: salen 20
         caracteres al azar. */
      if (clave.length < 12) morir("al menos 12 caracteres. O usa --generar.");
      const otra = await preguntarClave("  Otra vez: ");
      if (clave !== otra) morir("no coinciden.");
    }

    const cuerpo = { usr, clave };
    if (orden === "crear") {
      cuerpo.rol = opcion(args, "rol") || "consulta";
      cuerpo.nombre = opcion(args, "nombre") || usr;
      cuerpo.tablero = !!opcion(args, "tablero");
      cuerpo.config = !!opcion(args, "config");
      if (cuerpo.rol !== "qc" && cuerpo.rol !== "consulta") morir("el papel es `qc` o `consulta`.");
    }
    await pedir("/api/cuentas", "POST", cuerpo);

    console.log(`\n  ✓ ${orden === "crear" ? "cuenta creada" : "clave cambiada"}: ${usr}`);
    if (opcion(args, "generar")) {
      console.log(`\n    clave: ${clave}\n`);
      console.log("    Apúntala AHORA: no se puede volver a leer, solo cambiar.");
      console.log("    Y no la mandes por el mismo sitio que el enlace de conexión.\n");
    } else {
      console.log("");
    }
    return;
  }

  morir(`no sé qué es «${orden}». Prueba \`node cuentas.js ayuda\`.`);
}

main();
