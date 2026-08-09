/* Q-77 — desconectar un aparato. Se prueba contra el servidor de verdad
   (sync-servidor.js), levantado sobre una carpeta de usar y tirar. */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

/* Se levanta el servidor de verdad sobre una carpeta de usar y tirar. No hace
   falta tener nada corriendo antes, y no toca `datos/`: la batería de
   `servidores-iguales.mjs` sí escribe, y esta no tiene por qué. */
const require = createRequire(import.meta.url);
const { crearAlmacen, montarAPI, crearCuentas } = require("../sync-servidor.js");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qc-q77-"));
const TOKEN = "llave-de-prueba";

const cuentas = crearCuentas(dir);
await cuentas.guardar({ usr: "jefe", clave: "1234", rol: "qc", config: true });
await cuentas.guardar({ usr: "tecnico", clave: "1234", rol: "qc", config: false });

const atender = montarAPI(crearAlmacen(path.join(dir, "cambios.jsonl")), TOKEN, { cuentas, admin: "x" });
const srv = http.createServer((req, res) => { if (!atender(req, res)) { res.writeHead(404); res.end(); } });
await new Promise((ok) => srv.listen(0, ok));
const base = "http://127.0.0.1:" + srv.address().port;

let fallos = 0;
function ok(que, cond, visto) {
  if (cond) console.log("  ✓ " + que);
  else { fallos++; console.log("  ✗ " + que + (visto !== undefined ? "  → " + JSON.stringify(visto) : "")); }
}

async function pedir(ruta, opciones = {}, ses) {
  const headers = { "Content-Type": "application/json", "X-QC-Token": TOKEN, ...(opciones.headers || {}) };
  if (ses) headers["X-QC-Sesion"] = ses;
  const r = await fetch(base + ruta, { ...opciones, headers });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

const latir = (dev, ses) => pedir("/api/latido", { method: "POST", body: JSON.stringify({ dev, usr: "?", pagina: "muestras.html" }) }, ses);
const desconectar = (dev, ses) => pedir("/api/desconectar", { method: "POST", body: JSON.stringify({ dev }) }, ses);
const presencia = () => pedir("/api/presencia");

console.log("\nUn aparato que late, se desconecta y se entera");
await latir("IPAD-OBRA");
ok("aparece en la presencia", (await presencia()).cuerpo.aparatos.some((a) => a.dev === "IPAD-OBRA"));

let r = await desconectar("IPAD-OBRA");
ok("el servidor lo acepta", r.status === 200 && r.cuerpo.ok, r);
ok("dice que conocía el aparato", r.cuerpo.conocido === true, r.cuerpo);

r = await latir("IPAD-OBRA");
ok("el siguiente latido le dice que está fuera", r.cuerpo.fuera === true, r.cuerpo);

r = await latir("IPAD-OBRA");
ok("el latido de después ya es normal — no queda expulsado para siempre", !r.cuerpo.fuera, r.cuerpo);

console.log("\nUn aparato del que nunca se supo");
r = await desconectar("NUNCA-VISTO");
ok("no se inventa una fila: dice que no lo conocía", r.status === 200 && r.cuerpo.conocido === false, r.cuerpo);

console.log("\nLa sesión deja de valer EN EL SERVIDOR, no solo en su navegador");
let s = await pedir("/api/sesion", { method: "POST", body: JSON.stringify({ usr: "tecnico", clave: "1234", dev: "IPAD-OBRA" }) });
const paseTecnico = s.cuerpo.tk;
ok("el técnico entra", !!paseTecnico, s.cuerpo);
ok("y su pase vale", (await pedir("/api/sesion", {}, paseTecnico)).status === 200);

s = await pedir("/api/sesion", { method: "POST", body: JSON.stringify({ usr: "jefe", clave: "1234", dev: "PORTATIL" }) });
const paseJefe = s.cuerpo.tk;

r = await desconectar("IPAD-OBRA", paseJefe);
ok("el jefe desconecta el iPad", r.status === 200, r);
ok("y cuenta la sesión que tiró", r.cuerpo.sesiones === 1, r.cuerpo);
ok("el pase del técnico ya no vale", (await pedir("/api/sesion", {}, paseTecnico)).status === 401);
ok("el del jefe sigue valiendo — solo cayó el aparato nombrado", (await pedir("/api/sesion", {}, paseJefe)).status === 200);

console.log("\nQuién puede desconectar");
s = await pedir("/api/sesion", { method: "POST", body: JSON.stringify({ usr: "tecnico", clave: "1234", dev: "IPAD-OBRA" }) });
r = await desconectar("PORTATIL", s.cuerpo.tk);
ok("una sesión sin `config` recibe 403 del SERVIDOR, no solo del botón", r.status === 403, r);
ok("y no le pasó nada al portátil", (await pedir("/api/sesion", {}, paseJefe)).status === 200);

console.log("\nCosas mal pedidas");
ok("sin `dev` contesta 400", (await desconectar("", paseJefe)).status === 400);
ok("sin la llave del proyecto contesta 401",
   (await fetch(base + "/api/desconectar", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{\"dev\":\"x\"}" })).status === 401);

srv.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} fallo(s)\n` : "\nsin fallos\n");
process.exit(fallos ? 1 : 0);
