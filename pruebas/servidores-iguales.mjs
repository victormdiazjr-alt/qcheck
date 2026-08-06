/* Los dos servidores tienen que contestar lo mismo — DECISIONS §19.
   Se les manda la misma batería y se compara estado, si contestan JSON y el código de
   error. Leer los dos archivos y compararlos NO sirve: en la auditoría del 6 ago 2026
   el grep dijo que el servidor local no validaba, y era falso.
   Ver pruebas/LEEME.md para levantarlos. */
const A = { n: "local ", u: "http://127.0.0.1:8461" };
const B = { n: "worker", u: "http://127.0.0.1:8462" };
const TK = "llave-de-prueba", AD = "admin-de-prueba";

async function pega(s, ruta, { m = "GET", cab = {}, cuerpo, crudo } = {}) {
  const h = { "X-QC-Token": TK, ...cab };
  if (cuerpo !== undefined || crudo !== undefined) h["Content-Type"] = "application/json";
  try {
    const r = await fetch(s.u + ruta, { method: m, headers: h, body: crudo !== undefined ? crudo : (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined) });
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (_) {}
    return { s: r.status, json: !!j, e: j && j.error ? j.error : null, ct: (r.headers.get("content-type") || "").split(";")[0] };
  } catch (e) { return { s: "CAÍDA", json: false, e: e.message.slice(0, 40), ct: "" }; }
}

const CASOS = [
  ["salud",                        "/api/salud"],
  ["salud sin llave",              "/api/salud", { cab: { "X-QC-Token": "" } }],
  ["salud llave mala",             "/api/salud", { cab: { "X-QC-Token": "no" } }],
  ["ruta inventada",               "/api/no-existe"],
  ["fuera de /api",                "/otra-cosa"],
  ["cambios GET",                  "/api/cambios?desde=0"],
  ["cambios GET desde basura",     "/api/cambios?desde=hola"],
  ["cambios POST vacío",           "/api/cambios", { m: "POST", cuerpo: {} }],
  ["cambios POST sin ops",         "/api/cambios", { m: "POST", cuerpo: { algo: 1 } }],
  ["cambios POST ops no-lista",    "/api/cambios", { m: "POST", cuerpo: { ops: "no" } }],
  ["cambios POST JSON roto",       "/api/cambios", { m: "POST", crudo: "{no es json" }],
  ["cambios POST op sin campos",   "/api/cambios", { m: "POST", cuerpo: { ops: [{}] } }],
  ["cambios GET con método malo",  "/api/cambios", { m: "DELETE" }],
  ["registro sin id",              "/api/registro?ent=test"],
  ["registro con id",              "/api/registro?ent=test&id=1"],
  ["actividad",                    "/api/actividad"],
  ["actividad n=0",                "/api/actividad?n=0"],
  ["actividad n negativo",         "/api/actividad?n=-5"],
  ["actividad n basura",           "/api/actividad?n=hola"],
  ["presencia",                    "/api/presencia"],
  ["latido vacío",                 "/api/latido", { m: "POST", cuerpo: {} }],
  ["latido normal",                "/api/latido", { m: "POST", cuerpo: { dev: "d1", usr: "x", pagina: "index.html" } }],
  ["sesion vacía",                 "/api/sesion", { m: "POST", cuerpo: {} }],
  ["sesion usuario que no hay",    "/api/sesion", { m: "POST", cuerpo: { usr: "nadie", clave: "x" } }],
  ["sesion salir sin pase",        "/api/sesion/salir", { m: "POST", cuerpo: {} }],
  ["cuentas sin admin",            "/api/cuentas"],
  ["cuentas admin malo",           "/api/cuentas", { cab: { "X-QC-Admin": "no" } }],
  ["cuentas listar",               "/api/cuentas", { cab: { "X-QC-Admin": AD } }],
  ["cuentas crear sin usr",        "/api/cuentas", { m: "POST", cab: { "X-QC-Admin": AD }, cuerpo: { clave: "x" } }],
  ["cuentas crear sin clave",      "/api/cuentas", { m: "POST", cab: { "X-QC-Admin": AD }, cuerpo: { usr: "nuevo1" } }],
  ["cuentas crear rol inventado",  "/api/cuentas", { m: "POST", cab: { "X-QC-Admin": AD }, cuerpo: { usr: "nuevo2", clave: "abc", rol: "superjefe" } }],
  ["cuentas crear ok",             "/api/cuentas", { m: "POST", cab: { "X-QC-Admin": AD }, cuerpo: { usr: "prueba", clave: "clave-larga-123", rol: "qc", nombre: "Prueba" } }],
  ["leer-conduce sin llave IA",    "/api/leer-conduce", { m: "POST", cuerpo: { imagen: "x" } }],
];

console.log("\n  CASO                              LOCAL         WORKER        ¿IGUAL?\n" + "  " + "─".repeat(74));
let dif = 0, n = 0;
for (const [nombre, ruta, op] of CASOS) {
  const a = await pega(A, ruta, op), b = await pega(B, ruta, op);
  const igual = a.s === b.s && a.json === b.json && a.e === b.e;
  n++; if (!igual) dif++;
  const f = (r) => `${r.s} ${r.e ? r.e : (r.json ? "ok" : "no-json")}`.padEnd(13);
  console.log(`  ${nombre.padEnd(33)} ${f(a)} ${f(b)} ${igual ? "sí" : "◀ NO"}`);
}
console.log("  " + "─".repeat(74));
console.log(`  ${n} casos · ${dif} divergencia(s)\n`);
