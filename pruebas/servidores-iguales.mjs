/* Los dos servidores tienen que contestar lo mismo — DECISIONS §19.
   Se les manda la misma batería y se compara estado, si contestan JSON y el código de
   error. Leer los dos archivos y compararlos NO sirve: en la auditoría del 6 ago 2026
   el grep dijo que el servidor local no validaba, y era falso.
   Ver pruebas/LEEME.md para levantarlos. */
/* Los puertos se pueden cambiar por variable de entorno. Hace falta cuando ya
   hay un servidor de verdad ocupando el 8461: levantar el de prueba en otro
   puerto es mejor que tumbar el que alguien puede estar usando. */
const A = { n: "local ", u: process.env.QC_A || "http://127.0.0.1:8461" };
const B = { n: "worker", u: process.env.QC_B || "http://127.0.0.1:8462" };
const TK = "llave-de-prueba", AD = "admin-de-prueba";

async function pega(s, ruta, { m = "GET", cab = {}, cuerpo, crudo } = {}) {
  const h = { "X-QC-Token": TK, ...cab };
  if (cuerpo !== undefined || crudo !== undefined) h["Content-Type"] = "application/json";
  try {
    const r = await fetch(s.u + ruta, { method: m, headers: h, body: crudo !== undefined ? crudo : (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined) });
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (_) {}
    return { s: r.status, json: !!j, e: j && j.error ? j.error : null, ct: (r.headers.get("content-type") || "").split(";")[0], j };
  } catch (e) { return { s: "CAÍDA", json: false, e: e.message.slice(0, 40), ct: "", j: null }; }
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
  /* Desconectar un aparato — Q-77. Va DESPUÉS del latido de arriba a propósito:
     así «d1» existe en los dos y se compara el caso de verdad, el del aparato
     conocido, y no dos «no lo conozco» que serían iguales por casualidad. */
  ["desconectar sin dev",          "/api/desconectar", { m: "POST", cuerpo: {} }],
  ["desconectar JSON roto",        "/api/desconectar", { m: "POST", crudo: "{no es json" }],
  ["desconectar método malo",      "/api/desconectar", { m: "GET" }],
  ["desconectar conocido",         "/api/desconectar", { m: "POST", cuerpo: { dev: "d1" }, mira: ["conocido"] }],
  ["desconectar desconocido",      "/api/desconectar", { m: "POST", cuerpo: { dev: "no-existe" }, mira: ["conocido"] }],
  ["latido tras desconectar",      "/api/latido", { m: "POST", cuerpo: { dev: "d1", usr: "x", pagina: "index.html" }, mira: ["fuera"] }],
  ["latido de después",            "/api/latido", { m: "POST", cuerpo: { dev: "d1", usr: "x", pagina: "index.html" }, mira: ["fuera"] }],
  /* Echar a todo el mundo — Q-85. Va al final: cierra las sesiones que
     abrieron los casos de arriba, así que si se pusiera antes las tumbaría. */
  ["cerrar sesiones sin admin",    "/api/cuentas", { m: "POST", cuerpo: { cerrar_sesiones: true } }],
  ["cerrar sesiones admin malo",   "/api/cuentas", { m: "POST", cab: { "X-QC-Admin": "no" }, cuerpo: { cerrar_sesiones: true } }],
  ["cerrar sesiones ok",           "/api/cuentas", { m: "POST", cab: { "X-QC-Admin": AD }, cuerpo: { cerrar_sesiones: true }, mira: ["ok"] }],
  ["cerrar sesiones valor falso",  "/api/cuentas", { m: "POST", cab: { "X-QC-Admin": AD }, cuerpo: { cerrar_sesiones: false } }],
];

/* SI FALTA ALGUNO DE LOS DOS, SE DICE Y SE SALTA — 29 ago 2026.

   Sin el Worker levantado esto sacaba 44 divergencias, todas «fetch failed», y
   `todas.sh` lo contaba como si los dos servidores se hubieran separado. Un
   comprobador que grita 44 veces por algo que no es un fallo ensena a no
   mirarlo — y este existe justo para el dia que los gemelos SI se separen. */
for (const s of [A, B]) {
  const r = await pega(s, "/api/salud");
  if (r.s === "CAÍDA") {
    console.log(`\n  se salta — no contesta el servidor ${s.n.trim()} en ${s.u}`);
    console.log("  (ver pruebas/LEEME.md para levantar los dos)\n");
    process.exit(0);
  }
}

console.log("\n  CASO                              LOCAL         WORKER        ¿IGUAL?\n" + "  " + "─".repeat(74));
let dif = 0, n = 0;
for (const [nombre, ruta, op] of CASOS) {
  const a = await pega(A, ruta, op), b = await pega(B, ruta, op);
  /* Comparar solo el código de estado deja pasar la mitad de lo que importa:
     «desconectar un aparato conocido» y «desconectar uno que no existe» son los
     dos un 200, y la diferencia entre ellos vive en el cuerpo. `mira` nombra
     los campos que además tienen que coincidir — Q-77. */
  const campos = (op && op.mira) || [];
  const mismoCuerpo = campos.every((c) => JSON.stringify(a.j && a.j[c]) === JSON.stringify(b.j && b.j[c]));
  const igual = a.s === b.s && a.json === b.json && a.e === b.e && mismoCuerpo;
  n++; if (!igual) dif++;
  const f = (r) => `${r.s} ${r.e ? r.e : campos.length
    ? campos.map((c) => c[0] + ":" + JSON.stringify(r.j && r.j[c])).join(" ")
    : (r.json ? "ok" : "no-json")}`.padEnd(13);
  console.log(`  ${nombre.padEnd(33)} ${f(a)} ${f(b)} ${igual ? "sí" : "◀ NO"}`);
}
console.log("  " + "─".repeat(74));
console.log(`  ${n} casos · ${dif} divergencia(s)\n`);
