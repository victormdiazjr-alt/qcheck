/* ============================================================
   EL RESTO DEL EXPEDIENTE SE TRAE A MANO, Y SOLO POR ESTA SESIÓN — Q-150 bis.

   Víctor, 29 de agosto de 2026: «lo de darle load al resto del database que sea
   en las ventanas que hablamos. Y sea dándole a un botón o buscando info para
   antes de 60 días. No automático. Y que sea solo por esa sesión».

   Lo había puesto automático al abrir Results, Reportes y la de la Autoridad, y
   no es lo que pidió. Bajarse años de expediente con la señal de la obra es una
   decisión de quien mira, no un efecto secundario de haber entrado.

   Se comprueba con navegador de verdad, contra un servidor con historia vieja
   y reciente: que al abrir NO baje nada, que el botón lo traiga, y que al
   recargar el aparato vuelva a su ventana.

   Se salta si no hay Chrome; se pide con QC_ENSAYO=1 como el ensayo general.
   ============================================================ */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUERTO = Number(process.env.QC_HIST_PUERTO || 8793);
const SITIO = `http://127.0.0.1:${PUERTO}`;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

if (process.env.QC_ENSAYO !== "1") {
  console.log("se salta — QC_ENSAYO=1 para correrlo (necesita Chrome)");
  process.exit(0);
}
const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => existsSync(p));
if (!CHROME) { console.log("se salta — no hay Chrome"); process.exit(0); }

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };

const PLAN = { slump:{target:3,actLo:2,actHi:4,suspLo:1.5,suspHi:4.5},
  air:{target:2,actLo:0.5,actHi:4,suspLo:0,suspHi:4.5},
  uw:{target:150.1,act:2.3,susp:3}, tempMax:100,
  cs:{target:3000,age:5,action:2500,openTarget:2500,openLow:2200}, maWindow:6, maxElapsedMin:90 };

const dir = mkdtempSync(join(tmpdir(), "qc-hist-"));
const REG = join(dir, "c.jsonl");
{
  let seq = 0; const L = [];
  const l = (ent, id, campo, valor) => L.push(JSON.stringify({ seq: ++seq, uid: "s" + seq,
    ent, id, campo, valor, ts: "2026-01-01T00:00:00.000Z", dev: "semilla", usr: "admin" }));
  l("project", "pr-52", "name", "Reconstrucción PR-52");
  l("project", "pr-52", "concretera", "Concre-Tech");
  l("project", "pr-52", "plan", PLAN);
  const dia = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  /* 40 ensayos VIEJOS (300 dias) y 10 RECIENTES (5 dias). */
  for (let i = 0; i < 40; i++) {
    const id = "viejo" + i;
    l("test", id, "n", i + 1); l("test", id, "date", dia(300)); l("test", id, "proyecto", "pr-52");
    l("test", id, "ticket", String(5000 + i)); l("test", id, "slump", 3); l("test", id, "uw", 150);
  }
  l("dayMeta", dia(300), "proyecto", "pr-52"); l("dayMeta", dia(300), "cyPlan", 400);
  l("dayMeta", dia(300), "cerradoA", "2025-11-01T18:00:00.000Z");
  for (let i = 0; i < 10; i++) {
    const id = "nuevo" + i;
    l("test", id, "n", 100 + i); l("test", id, "date", dia(5)); l("test", id, "proyecto", "pr-52");
    l("test", id, "ticket", String(7000 + i)); l("test", id, "slump", 3); l("test", id, "uw", 150);
  }
  l("dayMeta", dia(5), "proyecto", "pr-52"); l("dayMeta", dia(5), "cyPlan", 100);
  l("dayMeta", dia(5), "cerradoA", new Date(Date.now() - 5 * 86400000).toISOString());
  writeFileSync(REG, L.join("\n") + "\n");
}

const { crearAlmacen, montarAPI, crearCuentas } = await import(join(RAIZ, "sync-servidor.js")).then((m) => m.default || m);
const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png" };
const atender = montarAPI(crearAlmacen(REG), "", { cuentas: crearCuentas(join(RAIZ, "datos")) });
const servidor = http.createServer((req, res) => {
  if (atender(req, res)) return;
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end("no"); return; }
  res.writeHead(200, { "Content-Type": MIME[p.slice(p.lastIndexOf("."))] || "application/octet-stream" });
  res.end(readFileSync(f));
}).listen(PUERTO);

const limpiar = () => { try { servidor.close(); } catch (_) {}
  spawnSync("pkill", ["-f", "remote-debugging-port=9481"]);
  try { rmSync(dir, { recursive: true, force: true }); } catch (_) {} };
process.on("exit", limpiar);

const ses = await (await fetch(SITIO + "/api/sesion", { method:"POST",
  headers:{"Content-Type":"application/json"},
  body: JSON.stringify({ usr:"ruben", clave:"q1234q", dev:"hist" }) })).json();

spawn(CHROME, ["--headless=new", "--remote-debugging-port=9481", "--user-data-dir=" + join(dir, "p"),
  "--no-first-run", "about:blank"], { stdio:"ignore" });
await dormir(2500);
const v = await (await fetch("http://127.0.0.1:9481/json/version")).json();
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once:true }));
let id = 0; const p = new Map(); const pedidas = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
  if (m.id && p.has(m.id)) { p.get(m.id)(m.result || {}); p.delete(m.id); }
  if (m.method === "Network.requestWillBeSent") {
    const u = m.params.request.url; if (u.includes("/api/estado")) pedidas.push(u.replace(/^https?:\/\/[^/]+/, ""));
  } });
const cmd = (m, pa, s) => new Promise((r) => { const n = ++id; p.set(n, r);
  ws.send(JSON.stringify({ id:n, method:m, params:pa||{}, sessionId:s })); });
const t = await cmd("Target.createTarget", { url:"about:blank" });
const s = (await cmd("Target.attachToTarget", { targetId:t.targetId, flatten:true })).sessionId;
await cmd("Page.enable", {}, s); await cmd("Runtime.enable", {}, s); await cmd("Network.enable", {}, s);
const ver = async (e) => (await cmd("Runtime.evaluate", { returnByValue:true, expression:e, awaitPromise:true }, s)).result?.value;

await cmd("Page.navigate", { url: SITIO + "/index.html" }, s); await dormir(3000);
await ver(`localStorage.setItem('qc-api','${SITIO}');
  localStorage.setItem('qc-sesion', ${JSON.stringify(ses.tk)});
  localStorage.setItem('qc-user','ruben'); localStorage.setItem('qc-auth','1');
  localStorage.setItem('qc-ident', ${JSON.stringify(JSON.stringify(ses.usuario))}); 'ok'`);

for (const [pag, nombre] of [["/reporte.html","Reportes"], ["/results.html","Results"], ["/autoridad.html","Autoridad"]]) {
  console.log(`\n${nombre.toUpperCase()}`);
  pedidas.length = 0;
  await cmd("Page.navigate", { url: SITIO + pag }, s);
  await dormir(13000);

  let d = JSON.parse(await ver(`JSON.stringify({
    ensayos: (db.tests||[]).length,
    barra: !!document.getElementById("qc-hist"),
    boton: !!document.getElementById("qc-hist-bot"),
    texto: (document.getElementById("qc-hist-txt")||{}).textContent || "" })`));
  di(d.ensayos === 10, `al abrir solo se ven los recientes: ${d.ensayos} ensayos`);
  di(!pedidas.some((u) => u === "/api/estado"), `y NO se pidió el histórico solo (${pedidas.join(" ") || "solo la ventana"})`);
  di(d.barra && d.boton, "hay un botón para traerlo");
  di(/últimos 60 días/.test(d.texto), `y lo dice: «${d.texto.slice(0, 52)}…»`);

  /* Se le da al botón, como haría una persona. */
  await ver(`document.getElementById("qc-hist-bot").click(); 'ok'`);
  await dormir(6000);
  d = JSON.parse(await ver(`JSON.stringify({
    ensayos: (db.tests||[]).length,
    boton: !!document.getElementById("qc-hist-bot"),
    texto: (document.getElementById("qc-hist-txt")||{}).textContent || "" })`));
  di(d.ensayos === 50, `al darle al botón llega todo: ${d.ensayos} ensayos`);
  di(!d.boton && /esta pestaña/.test(d.texto), `y dice que es por esta sesión: «${d.texto.slice(0, 58)}…»`);

  /* Y al recargar, vuelve a su ventana. */
  await cmd("Page.navigate", { url: SITIO + pag }, s);
  await dormir(11000);
  const tras = await ver(`(db.tests||[]).length`);
  di(tras === 10, `al recargar vuelve a los 60 días: ${tras} ensayos`);
}

ws.close();
console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
limpiar();
process.exit(fallos ? 1 : 0);
