/* Q-85 — cerrar todas las sesiones. Contra el servidor de verdad, carpeta de usar y tirar. */
import http from "node:http"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { crearAlmacen, montarAPI, crearCuentas } = require("../sync-servidor.js");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qc-q85-"));
const TK = "llave", AD = "admin-secreto";
const cuentas = crearCuentas(dir);
await cuentas.guardar({ usr: "ruben", clave: "1234", rol: "qc" });
await cuentas.guardar({ usr: "tecnico", clave: "1234", rol: "qc" });
const atender = montarAPI(crearAlmacen(path.join(dir, "c.jsonl")), TK, { cuentas, admin: AD });
const srv = http.createServer((q, s) => { if (!atender(q, s)) { s.writeHead(404); s.end(); } });
await new Promise(ok => srv.listen(0, ok));
const base = "http://127.0.0.1:" + srv.address().port;
let fallos = 0;
const ok = (q, c, v) => { if (c) console.log("  ✓ " + q); else { fallos++; console.log("  ✗ " + q + (v !== undefined ? "  → " + JSON.stringify(v) : "")); } };
const pedir = async (r, o = {}, ses, adm) => {
  const h = { "Content-Type": "application/json", "X-QC-Token": TK };
  if (ses) h["X-QC-Sesion"] = ses; if (adm) h["X-QC-Admin"] = AD;
  const x = await fetch(base + r, { ...o, headers: h });
  return { status: x.status, c: await x.json().catch(() => null) };
};
const entrar = async (u) => (await pedir("/api/sesion", { method: "POST", body: JSON.stringify({ usr: u, clave: "1234", dev: u + "-pc" }) })).c.tk;

console.log("\nDos personas dentro");
const a = await entrar("ruben"), b = await entrar("tecnico");
ok("Rubén tiene pase", (await pedir("/api/sesion", {}, a)).status === 200);
ok("el técnico también", (await pedir("/api/sesion", {}, b)).status === 200);

console.log("\nSe echa a todo el mundo");
let r = await pedir("/api/cuentas", { method: "POST", body: JSON.stringify({ cerrar_sesiones: true }) }, null, true);
ok("el servidor lo acepta y dice cuántas cerró", r.status === 200 && r.c.cerradas === 2, r.c);
ok("el pase de Rubén ya no vale", (await pedir("/api/sesion", {}, a)).status === 401);
ok("el del técnico tampoco", (await pedir("/api/sesion", {}, b)).status === 401);

console.log("\nPueden volver a entrar con su clave, sin enlace nuevo");
const a2 = await entrar("ruben");
ok("Rubén entra otra vez", !!a2 && (await pedir("/api/sesion", {}, a2)).status === 200);

console.log("\nQuién puede echar a todos");
r = await pedir("/api/cuentas", { method: "POST", body: JSON.stringify({ cerrar_sesiones: true }) });
ok("sin el secreto de administración: 403", r.status === 403, r);
r = await pedir("/api/cuentas", { method: "POST", body: JSON.stringify({ cerrar_sesiones: true }) }, a2);
ok("con una sesión de QC pero sin ese secreto: 403", r.status === 403, r);
ok("y el pase de Rubén sigue vivo — no se echó a nadie", (await pedir("/api/sesion", {}, a2)).status === 200);

console.log("\nCon exigir-sesión encendido, sin pase no se escribe");
await pedir("/api/cuentas", { method: "POST", body: JSON.stringify({ exigir_sesion: true }) }, null, true);
r = await pedir("/api/cambios", { method: "POST", body: JSON.stringify({ ops: [{ ent: "test", id: "1", campo: "slump", valor: 3 }] }) });
ok("solo con la llave del proyecto: 401", r.status === 401, r);
r = await pedir("/api/cambios", { method: "POST", body: JSON.stringify({ ops: [{ ent: "test", id: "1", campo: "slump", valor: 3 }] }) }, a2);
ok("con la clave de Rubén: entra", r.status === 200, r.c);

srv.close(); fs.rmSync(dir, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} fallo(s)\n` : "\nsin fallos\n");
process.exit(fallos ? 1 : 0);
