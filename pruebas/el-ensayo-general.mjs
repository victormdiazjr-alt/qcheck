/* ============================================================
   EL ENSAYO GENERAL — el tiro entero, con pantallas y aparatos de verdad.

   Víctor, 29 de agosto de 2026, después de irse de la obra sin haber podido
   entrar un solo camión: «ya no hay tiro hasta la semana que viene, así que
   podemos seguir building and fixing. Y cuando esté todo arreglado entro el
   tiro de hoy».

   «Todo arreglado» no puede ser una sensación. Esto lo convierte en un hecho.

   QUÉ HACE, Y EN QUÉ SE DIFERENCIA DE LO DEMÁS
   --------------------------------------------
   `verificar.js` lee el código sin ejecutarlo. `un-tiro-entero-de-pr52.mjs`
   ejecuta `core.js` en un DOM de mentira: prueba la lógica, muy rápido.

   Esto es la otra mitad, la que faltaba: **dos navegadores de verdad, sobre las
   pantallas de verdad, sincronizando contra un servidor de verdad.** Uno hace
   de iPad del técnico y el otro de Field Display colgado en la obra. Se recorre
   el día entero en orden — sin tiro, programarlo, recibir el camión, medirlo,
   leer el veredicto, verlo aparecer en la pantalla de obra, cerrar, informar— y
   se comprueba lo que se ve, no lo que debería verse.

   Es lento (unos tres minutos) y necesita Chrome. Por eso no entra en
   `todas.sh` salvo que se pida: `QC_ENSAYO=1 node pruebas/el-ensayo-general.mjs`.
   **Es la prueba que hay que correr la víspera de un tiro.**

   NO TOCA NADA DE VERDAD: levanta su propio servidor en un puerto aparte, con
   un registro nuevo en un directorio temporal, y lo borra al terminar.

   DOS LECCIONES QUE COSTARON DOS VUELTAS, Y QUEDAN AQUÍ POR ESCRITO
   -----------------------------------------------------------------
   1. UNA PRUEBA QUE NO CONTROLA SU PUNTO DE PARTIDA NO ENCUENTRA FALLOS: LOS
      INVENTA. La primera versión dio ocho fallos y siete eran míos — programaba
      un tiro para otro día con el de hoy todavía abierto, y luego se extrañaba
      de que el camión cayera en el de hoy. Un fallo inventado cuesta lo mismo
      de perseguir que uno de verdad, y al final no había nada que arreglar.

   2. HAY QUE PREGUNTAR LO QUE SE QUIERE SABER. `tiroActivo()` contesta «qué día
      estoy mirando» —y un tiro cerrado hoy sigue siendo el de hoy, que es lo
      correcto para navegar—. Quien pregunta «¿hay alguno abierto?» tiene que
      llamar a `hayTiroActivo()`. Pregunté la primera esperando la segunda y di
      por roto código que estaba bien. Estuve a punto de «arreglarlo».

   LO QUE ENCONTRÓ LA PRIMERA VEZ QUE CORRIÓ DE VERDAD
   ---------------------------------------------------
   · Q-144: la fila de «recibir camión» se veía SIN NINGÚN TIRO ABIERTO.
     `pintarFilaRecibir()` la escondía bien con `hidden`, y `.recibir{display:flex}`
     la volvía a encender. El guardián estaba escrito y no hacía nada.
   · Q-145: con el tiro CERRADO, `recibirCamion()` seguía metiendo el camión
     dentro del día firmado, sin decir que lo estaba reabriendo.
   ============================================================ */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUERTO = Number(process.env.QC_ENSAYO_PUERTO || 8791);
const SITIO = `http://127.0.0.1:${PUERTO}`;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------- se salta */
if (process.env.QC_ENSAYO !== "1") {
  console.log("el ensayo general se salta — QC_ENSAYO=1 para correrlo (tarda ~3 min y necesita Chrome)");
  process.exit(0);
}
const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => existsSync(p));
if (!CHROME) {
  console.log("el ensayo general se salta — no hay Chrome en esta máquina");
  process.exit(0);
}

/* ---------------------------------------------------------------- la obra */
/* Los límites REALES de la PR-52, tal como están hoy en el expediente. Si
   cambian de verdad, cambian aquí — una prueba que juzga con otra vara no
   prueba nada. */
const PLAN = {
  slump: { target: 3, actLo: 2, actHi: 4, suspLo: 1.5, suspHi: 4.5 },
  air: { target: 2, actLo: 0.5, actHi: 4, suspLo: 0, suspHi: 4.5 },
  uw: { target: 150.1, act: 2.3, susp: 3 },
  tempMax: 100,
  cs: { target: 3000, age: 5, action: 2500, openTarget: 2500, openLow: 2200 },
  maWindow: 6, maxElapsedMin: 90,
};
const OBRA = { id: "pr-52", name: "Reconstrucción PR-52 [Km 14.2 a 0.0]", concretera: "Concre-Tech", plan: PLAN };

/* ---------------------------------------------------------------- marcador */
const fallos = [];
let hechas = 0;
function comprobar(nombre, ok, detalle) {
  hechas++;
  if (!ok) fallos.push(nombre + (detalle ? " — " + detalle : ""));
  console.log(`  ${ok ? "OK  " : "FALLA"}  ${nombre}${detalle ? "   · " + detalle : ""}`);
}

/* ---------------------------------------------------------------- servidor */
const dir = mkdtempSync(join(tmpdir(), "qc-ensayo-"));
const REGISTRO = join(dir, "cambios.jsonl");
{
  let seq = 0;
  const linea = (ent, id, campo, valor) => JSON.stringify({
    seq: ++seq, uid: `semilla-${seq}`, ent, id, campo, valor,
    ts: "2026-01-01T00:00:00.000Z", dev: "semilla", usr: "admin",
  });
  writeFileSync(REGISTRO, [
    linea("project", OBRA.id, "name", OBRA.name),
    linea("project", OBRA.id, "concretera", OBRA.concretera),
    linea("project", OBRA.id, "plan", OBRA.plan),
  ].join("\n") + "\n");
}

const { crearAlmacen, montarAPI, crearCuentas } = await import(join(RAIZ, "sync-servidor.js"))
  .then((m) => m.default || m);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };
const almacen = crearAlmacen(REGISTRO);
const atender = montarAPI(almacen, "", { cuentas: crearCuentas(join(RAIZ, "datos")) });
const { readFileSync, statSync } = await import("node:fs");
const servidor = http.createServer((req, res) => {
  if (atender(req, res)) return;
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end("no"); return; }
  res.writeHead(200, { "Content-Type": MIME[p.slice(p.lastIndexOf("."))] || "application/octet-stream" });
  res.end(readFileSync(f));
}).listen(PUERTO);

const limpiar = () => {
  try { servidor.close(); } catch (_) {}
  spawnSync("pkill", ["-f", "qc-ensayo-chrome"]);
  try { rmSync(dir, { recursive: true, force: true }); } catch (_) {}
};
process.on("exit", limpiar);

/* ---------------------------------------------------------------- aparatos */
async function abrirAparato(puerto, nombre) {
  const perfil = join(dir, "perfil-" + nombre);
  spawn(CHROME, ["--headless=new", "--remote-debugging-port=" + puerto,
    "--user-data-dir=" + perfil, "--no-first-run", "--hide-scrollbars",
    "--user-agent=qc-ensayo-chrome", "about:blank"], { stdio: "ignore" });
  await dormir(2500);
  const v = await (await fetch(`http://127.0.0.1:${puerto}/json/version`)).json();
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const p = new Map(); const consola = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && p.has(m.id)) { p.get(m.id)(m.result || {}); p.delete(m.id); }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      consola.push((m.params.args || []).map((a) => a.value || a.description || "").join(" "));
    }
    if (m.method === "Runtime.exceptionThrown") {
      consola.push("EXCEPCIÓN: " + (m.params.exceptionDetails?.exception?.description || ""));
    }
  });
  const cmd = (m, params, sid) => new Promise((res) => {
    const n = ++id; p.set(n, res);
    ws.send(JSON.stringify({ id: n, method: m, params: params || {}, sessionId: sid }));
  });
  const t = await cmd("Target.createTarget", { url: "about:blank" });
  const s = (await cmd("Target.attachToTarget", { targetId: t.targetId, flatten: true })).sessionId;
  await cmd("Page.enable", {}, s); await cmd("Runtime.enable", {}, s);
  await cmd("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, s);
  await cmd("Page.addScriptToEvaluateOnNewDocument", { source: "window.confirm=()=>true;window.alert=(m)=>{window.__aviso=m};" }, s);
  return {
    ir: async (u, espera) => { await cmd("Page.navigate", { url: SITIO + u }, s); await dormir(espera || 8000); },
    ver: async (e) => (await cmd("Runtime.evaluate", { returnByValue: true, expression: e, awaitPromise: true }, s)).result?.value,
    errores: () => consola.slice(),
    cerrar: () => ws.close(),
  };
}

/* ================================================================ el ensayo */
const ses = await (await fetch(SITIO + "/api/sesion", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ usr: "ruben", clave: "q1234q", dev: "ensayo" }),
})).json();
if (!ses.tk) { console.log("no hay sesión — ¿existe la cuenta de Rubén en datos/?"); limpiar(); process.exit(2); }

const tecnico = await abrirAparato(9421, "tecnico");
const obra = await abrirAparato(9422, "obra");
const entrar = (a) => a.ver(
  `localStorage.setItem('qc-api','${SITIO}');
   localStorage.setItem('qc-sesion', ${JSON.stringify(ses.tk)});
   localStorage.setItem('qc-user','ruben'); localStorage.setItem('qc-auth','1');
   localStorage.setItem('qc-ident', ${JSON.stringify(JSON.stringify(ses.usuario))}); 'ok'`);

for (const a of [tecnico, obra]) { await a.ir("/index.html", 3000); await entrar(a); }
await tecnico.ir("/control-center.html", 16000);

let d;
console.log("\n1 · EL APARATO SE ESTRENA");
d = JSON.parse(await tecnico.ver(`JSON.stringify({
  linea: Number(localStorage.getItem('qc-sync-seq')||0),
  tope: Number(localStorage.getItem('qc-sync-tope')||0),
  alDia: localStorage.getItem('qc-sync-visto') === '1',
  abierto: hayTiroActivo(),
  limites: { slump: db.plan.slump && db.plan.slump.actLo, tempMax: db.plan.tempMax,
             uw: db.plan.uw && db.plan.uw.target } })`));
comprobar("se pone al día de un viaje", d.alDia && d.linea >= d.tope, `línea ${d.linea}/${d.tope}`);
comprobar("trae los límites de la obra",
  d.limites.slump === 2 && d.limites.tempMax === 100 && d.limites.uw === 150.1,
  `slump≥${d.limites.slump} tempMax=${d.limites.tempMax} uw=${d.limites.uw}`);
comprobar("parte sin ningún tiro abierto", d.abierto === false, "hayTiroActivo=" + d.abierto);

console.log("\n2 · SIN TIRO ABIERTO, NINGUNA PANTALLA OFRECE TIRO");
for (const [pag, quien] of [["/conduce.html", "Recepción"], ["/muestras.html", "Muestras"], ["/display.html", "Field Display"]]) {
  await tecnico.ir(pag, 10000);
  const t = JSON.parse(await tecnico.ver(`JSON.stringify({
    texto: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0, 240),
    formulario: !!document.querySelector('#manual-card:not([hidden])'),
    filaRecibir: (() => { const f = document.querySelector('.recibir');
      return !!f && getComputedStyle(f).display !== 'none'; })() })`));
  comprobar(`${quien} no invita a trabajar sin tiro`,
    !/tiro de hoy|camiones del tiro/i.test(t.texto) && !t.formulario && !t.filaRecibir,
    t.filaRecibir ? "la fila de recibir SIGUE VISIBLE (Q-144)" : t.texto.slice(0, 60));
}

console.log("\n3 · SE PROGRAMA EL TIRO");
const DIA = await tecnico.ver("todayISO()");
await tecnico.ir("/control-center.html", 12000);
d = JSON.parse(await tecnico.ver(`(() => {
  db.dayMeta["${DIA}"] = { proyecto: "pr-52", estructura: "losas", fecha: "${DIA}",
    horaInicio: "06:00", cyPlan: 120, losasPlan: 2, losas: "L-10 y L-11",
    mix: "3000-A", recepcion: "muestras" };
  saveDB();
  return JSON.stringify({ abierto: hayTiroActivo("${DIA}"), activo: tiroActivo(),
    tecnicoRecibe: !recepcionAparte("${DIA}"),
    tempMaxDelDia: (planDe("${DIA}")||{}).tempMax }); })()`));
comprobar("el tiro cuenta como abierto", d.abierto === true && d.activo === DIA, "activo=" + d.activo);
comprobar("respeta «el técnico recibe y muestrea»", d.tecnicoRecibe === true);
comprobar("los límites resuelven por la obra del día", d.tempMaxDelDia === 100, "tempMax=" + d.tempMaxDelDia);

console.log("\n4 · LLEGA EL CAMIÓN (recibir y medir en una pantalla)");
await tecnico.ir("/muestras.html", 12000);
d = JSON.parse(await tecnico.ver(`JSON.stringify({ fila: (() => {
  const f = document.querySelector('.recibir');
  return !!f && getComputedStyle(f).display !== 'none'; })() })`));
comprobar("Muestras ofrece recibir el camión", d.fila);

d = JSON.parse(await tecnico.ver(`(() => {
  const t = recibirCamion({ ticket: "88001", truck: "410", vol: 9, ident: "L-10" });
  return JSON.stringify({ id: t && t.id, dia: t && t.date, obra: t && t.proyecto,
    uwTarget: t && t.uwTarget, mix: t && t.mix, ticket: t && t.ticket }); })()`));
comprobar("el camión se crea en el día del tiro", d.dia === DIA, "día=" + d.dia);
comprobar("hereda obra, mezcla y objetivo de unit weight",
  d.obra === "pr-52" && d.uwTarget === 150.1 && d.mix === "3000-A",
  `obra=${d.obra} uw=${d.uwTarget} mix=${d.mix}`);
/* POR `id`, NO POR `n`: un ensayo retirado no guarda su número (Q-99), así que
   `n` se reusa y puede haber dos con el mismo, uno vivo y uno retirado. */
const ID = d.id;

console.log("\n5 · EL VEREDICTO QUE LEE EL TÉCNICO");
d = JSON.parse(await tecnico.ver(`(() => {
  const v = (s,a,u,tp) => { state.buf.slump=s; state.buf.air=a; state.buf.uw=u; state.buf.temp=tp;
    const r = liveVerdict(); return r.word + " · " + r.sub; };
  return JSON.stringify({ bueno: v(3.0,2.0,150.0,88), slumpAlto: v(5.2,2.0,150.0,88),
    caliente: v(3.0,2.0,150.0,104), aireAlto: v(3.0,4.8,150.0,88) }); })()`));
comprobar("camión bueno → Aceptar", /aceptar/i.test(d.bueno) && !/fuera/i.test(d.bueno), d.bueno);
/* Q-115: el veredicto dice DE QUÉ, y nunca «de suspensión» — Víctor: «no sé
   qué es de suspensión; Fuera de Límite de Slump debe decir». */
comprobar("slump 5.2 (límite 2–4) → nombra el Slump, no «suspensión»",
  /rechazar/i.test(d.slumpAlto) && /slump/i.test(d.slumpAlto) && !/suspensi/i.test(d.slumpAlto), d.slumpAlto);
comprobar("104 °F (máximo 100) → nombra la Temp", /temp/i.test(d.caliente), d.caliente);
comprobar("aire 4.8 (límite 0.5–4) → nombra el Aire", /aire/i.test(d.aireAlto), d.aireAlto);

console.log("\n6 · SE ANOTAN LAS MEDIDAS Y LLEGAN A LA OBRA");
await tecnico.ver(`(() => { const t = (db.tests||[]).find(x => x.id === '${ID}');
  t.slump = 3.0; t.air = 2.0; t.uw = 150.0; t.temp = 88; t.rejected = false;
  saveDB(); return 'ok'; })()`);
await dormir(9000);
await obra.ir("/display.html", 15000);
d = JSON.parse(await obra.ver(`JSON.stringify({
  loVe: !!(db.tests||[]).find(t => t.id === '${ID}'),
  slump: ((db.tests||[]).find(t => t.id === '${ID}')||{}).slump,
  ticket: ((db.tests||[]).find(t => t.id === '${ID}')||{}).ticket,
  texto: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0, 200) })`));
comprobar("el Field Display recibe el camión del técnico", d.loVe, "ticket=" + d.ticket);
comprobar("con sus lecturas", d.slump === 3, "slump=" + d.slump);
comprobar("y no dice «sin tiro»", !/sin tiro/i.test(d.texto), d.texto.slice(0, 60));

console.log("\n7 · SE CIERRA EL TIRO Y SALE EN EL INFORME");
await tecnico.ir("/control-center.html", 12000);
await tecnico.ver(`(() => { const m = db.dayMeta["${DIA}"];
  m.cerradoA = new Date().toISOString(); m.cerradoPor = 'ruben'; saveDB(); return 'ok'; })()`);
await dormir(6000);
d = JSON.parse(await tecnico.ver(`JSON.stringify({
  abierto: hayTiroActivo("${DIA}"), cerrado: !!tiroCerrado("${DIA}"),
  firma: qcFirma(), puede: puedeEditarDia("${DIA}"),
  sinFirma: (() => { const f = window.qcFirma; window.qcFirma = () => false;
    const r = puedeEditarDia("${DIA}"); window.qcFirma = f; return r; })() })`));
comprobar("cerrado deja de contar como abierto", d.abierto === false && d.cerrado);
/* Un día cerrado se protege de quien NO firma, no de todos: Rubén es el
   ingeniero de récord y reabrirlo es justo lo que su firma le permite. */
comprobar("quien firma puede corregir un día cerrado", d.firma === true && d.puede === true,
  `firma=${d.firma}`);
comprobar("a quien NO firma, el día cerrado le dice que no",
  typeof d.sinFirma === "string" && /cerrad/i.test(d.sinFirma), String(d.sinFirma).slice(0, 58));

await tecnico.ir("/reporte.html", 13000);
d = JSON.parse(await tecnico.ver(`JSON.stringify({
  sale: (document.body.innerText||'').includes("${DIA}") ||
        [...document.querySelectorAll('option')].some(o => (o.value||'') === "${DIA}") })`));
comprobar("el tiro cerrado aparece en Reportes", d.sale);

console.log("\n8 · CON EL TIRO CERRADO NO SE RECIBEN CAMIONES");
await tecnico.ir("/muestras.html", 12000);
d = JSON.parse(await tecnico.ver(`JSON.stringify({ fila: (() => {
  const f = document.querySelector('.recibir');
  return !!f && getComputedStyle(f).display !== 'none'; })() })`));
comprobar("Muestras ya no ofrece recibir", !d.fila);
/* Q-145: y si alguien llama a la función directamente, se le pregunta —
   reabrir un día firmado es un acto, no un descuido. Aquí se dice que no. */
d = JSON.parse(await tecnico.ver(`(() => {
  window.confirm = () => false;
  const t = recibirCamion({ ticket: "99999", truck: "999", vol: 9 });
  return JSON.stringify({ creo: !!t, dia: t && t.date }); })()`));
comprobar("recibirCamion no mete camiones en un día cerrado", !d.creo,
  d.creo ? "creó uno en " + d.dia : "preguntó y respetó el no");

console.log("\n9 · ERRORES EN CONSOLA");
const errs = [...tecnico.errores(), ...obra.errores()].filter((e) => e && !/favicon|manifest/i.test(e));
comprobar("ninguna pantalla lanza errores", errs.length === 0, errs.slice(0, 2).join(" | ").slice(0, 110));

console.log("\n" + "=".repeat(62));
console.log(`  ${hechas - fallos.length} de ${hechas} comprobaciones pasan`);
if (fallos.length) { console.log("\n  LO QUE FALLA:"); for (const f of fallos) console.log("   · " + f); }
else console.log("\n  EL TIRO ENTERO PASA, DE PRINCIPIO A FIN.");
console.log("=".repeat(62));

tecnico.cerrar(); obra.cerrar();
limpiar();
process.exit(fallos.length ? 1 : 0);
