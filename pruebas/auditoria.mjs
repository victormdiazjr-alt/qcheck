/* ══════════════════════════════════════════════════════════════════════════
   AUDITORÍA DE QCHECK — 15 de agosto de 2026.

   Víctor: «haz una auditoría de todos los usuarios, que puedan completar todas
   las operaciones que QCheck hace, que puedan navegar libres de bloqueos, que
   no se mezcle la data de los proyectos, que todos los monitores de estatus se
   comporten como deben y no haya ningún error causando bugs.»

   Cuatro bloques, y se corre entera cada vez:

     A · CUENTAS      quién puede hacer qué, y quién no debe
     B · NAVEGACIÓN   qué pantalla abre cada cuenta y a dónde la echan
     C · OBRAS        que nada de una obra aparezca en la otra
     D · MONITORES    que digan la verdad, y que callen cuando no hay nada

   No prueba «que el código haga lo que dice el autor»: prueba las reglas del
   oficio contra el código que corre. Cuando algo se rompa aquí, se rompió algo
   que le importa a alguien de pie en la obra.
   ══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, readdirSync } from "node:fs";

const HOY = (() => { const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();

/* Las fichas TAL COMO LAS MANDA EL SERVIDOR. Se copian de `cuentas.js listar`
   y no de `usuarios.js`: con sesión encendida manda el servidor, y probar la
   lista local sería probar la copia que no se usa. */
const CUENTAS = {
  admin:       { rol:"qc",       tablero:true,  config:true,  limites:true,  firma:false, casa:null },
  ruben:       { rol:"qc",       tablero:true,  config:false, limites:true,  firma:true,  casa:null },
  tecnico:     { rol:"qc",       tablero:true,  config:false, limites:true,  firma:false, casa:null },
  tecnico1:    { rol:"qc",       tablero:true,  config:false, limites:true,  firma:false, casa:null },
  tecnico2:    { rol:"qc",       tablero:true,  config:false, limites:true,  firma:false, casa:null },
  yarvier:     { rol:"qc",       tablero:true,  config:false, limites:true,  firma:false, casa:null },
  concretero:  { rol:"consulta", tablero:false, config:false, limites:false, firma:false, casa:"produccion.html" },
  contratista: { rol:"consulta", tablero:false, config:false, limites:false, firma:false, casa:"contratista.html" },
  autoridad:   { rol:"consulta", tablero:false, config:false, limites:false, firma:false, casa:"autoridad.html" },
};
const DE_QC = ["admin", "ruben", "tecnico", "tecnico1", "tecnico2", "yarvier"];
const DE_FUERA = ["concretero", "contratista", "autoridad"];

const PLAN = { slump:{target:4,actLo:2.5,actHi:5.5,suspLo:1.5,suspHi:6.5},
               uw:{target:145,act:2,susp:3},
               air:{target:5,actLo:3.5,actHi:6.5,suspLo:2.5,suspHi:7.5},
               temp:{max:95}, maWindow:5 };

/* Monta la aplicación de verdad con una cuenta y una base puestas. */
function comoQuien(usr, { tests = [], dayMeta = {}, activo = "pr-52" } = {}) {
  const alm = new Map([["qc-ident", JSON.stringify({ usr, nombre: usr, ...CUENTAS[usr] })]]);
  const ctx = {
    localStorage:{ getItem:(k)=>alm.get(k)??null, setItem:(k,v)=>alm.set(k,String(v)), removeItem:(k)=>alm.delete(k) },
    document:{ getElementById:()=>null, addEventListener(){}, querySelectorAll:()=>[],
               createElement:()=>({style:{},classList:{add(){}}}),
               documentElement:{dataset:{},style:{setProperty(){}}}, head:{appendChild(){}}, body:{appendChild(){}} },
    window:{ addEventListener(){}, matchMedia:()=>({matches:false,addEventListener(){}}) },
    navigator:{ onLine:true, userAgent:"Mozilla/5.0 (Macintosh)" },
    screen:{ width:1512, height:982 },
    location:{ pathname:"/index.html", hash:"", replace(){} },
    setInterval:()=>0, clearInterval(){}, setTimeout:()=>0, console,
    crypto:{ randomUUID:()=>"u"+Math.random() }, fetch: async()=>{ throw new Error("sin red"); },
    addEventListener(){}, removeEventListener(){}, requestAnimationFrame:()=>0,
  };
  const src = readFileSync("assets/usuarios.js","utf8") + "\n" + readFileSync("assets/core.js","utf8");
  const f = new Function(...Object.keys(ctx), src + `
    ;db = { tests: ${JSON.stringify(tests)}, dayMeta: ${JSON.stringify(dayMeta)},
            humidity: [], plan: ${JSON.stringify(PLAN)},
            proyectos: [ { id:"pr-52", name:"Reconstrucción PR-52", contractor:"Del Valle Group",
                           concretera:"Concre-Tech", plan: ${JSON.stringify(PLAN)} },
                         { id:"ac-220037", name:"AC-220037 · Puentes", contractor:"EJ Construction",
                           concretera:"PRETENSADOS DE PR", spec:"934", plan: ${JSON.stringify(PLAN)} } ],
            proyectoActivo: ${JSON.stringify(activo)} };
    db.project = db.proyectos.find(p => p.id === ${JSON.stringify(activo)});
    saveDB = function(){};
    return { casaDe, qcEsQC, qcVeTablero, qcVeConfig, qcVeLimites, qcVeActividad, qcFirma, qcCasa,
             hayTiroActivo, estadoTiro, dayProgress, discrepanciaDeOrden, testsOfDate, sortedTests,
             tiroCerrado, proyectoActivo, abrirProyecto, worstZone, estadoBadge, puedeEditarDia, db };`);
  return f(...Object.values(ctx));
}

/* Las puertas, leídas de `auth.js` — no copiadas a mano, que se quedan viejas. */
const AUTH = readFileSync("assets/auth.js", "utf8");
const SOLO_QC = ["control-center.html","results.html","conduce.html","muestras.html","reporte.html"];
const EN_OBRAS = ["934.html","lotes.html","aceptacion.html"];

let fallos = 0, avisos = 0;
const seccion = (t) => console.log(`\n${t}`);
const di  = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };
const ojo = (t) => { console.log(`  ⚠ ${t}`); avisos++; };

/* ── A · CUENTAS ─────────────────────────────────────────────────────────── */
seccion("A · CADA CUENTA PUEDE HACER SU TRABAJO ENTERO");
for (const u of DE_QC) {
  const q = comoQuien(u);
  const ok = q.qcEsQC() && q.qcVeTablero() && q.qcVeLimites();
  di(ok, `${u.padEnd(10)} entra · Control Center · ve los límites contra los que mide`);
}

seccion("A2 · Y LO QUE NO DEBE PODER, NO PUEDE");
{
  const r = comoQuien("ruben");
  di(r.qcFirma(), "ruben es el único que firma: reabre y descarta vaciados");
  for (const u of DE_QC.filter((x) => x !== "ruben")) {
    di(!comoQuien(u).qcFirma(), `${u.padEnd(10)} NO puede reabrir ni descartar un vaciado`);
  }
  const a = comoQuien("admin");
  di(a.qcVeConfig(), "admin ve la sala de máquinas");
  for (const u of DE_QC.filter((x) => x !== "admin")) {
    di(!comoQuien(u).qcVeConfig(), `${u.padEnd(10)} NO entra en la sala de máquinas`);
  }
}

seccion("A3 · LOS DE FUERA MIRAN SU NÚMERO Y NADA MÁS");
for (const u of DE_FUERA) {
  const q = comoQuien(u);
  di(!q.qcEsQC() && !q.qcVeTablero() && !q.qcVeConfig() && !q.qcFirma() && q.qcCasa(),
     `${u.padEnd(12)} vive en ${q.qcCasa()}`);
}

/* ── B · NAVEGACIÓN ──────────────────────────────────────────────────────── */
seccion("B · NAVEGACIÓN: NADIE SE QUEDA ENCERRADO NI ENTRA DONDE NO DEBE");
for (const u of DE_QC) {
  const q = comoQuien(u);
  di(q.casaDe() === "control-center.html", `${u.padEnd(10)} aterriza en el Control Center`);
}
for (const u of DE_FUERA) {
  const q = comoQuien(u);
  di(q.casaDe() === CUENTAS[u].casa, `${u.padEnd(12)} aterriza en su tablero`);
}

seccion("B2 · LAS CINCO PANTALLAS DE TRABAJO, ABIERTAS PARA LOS SEIS");
for (const u of DE_QC) {
  const q = comoQuien(u);
  di(q.qcEsQC(), `${u.padEnd(10)} ${SOLO_QC.join(" · ")}`);
}
seccion("B3 · Y CERRADAS PARA LOS DE FUERA");
for (const u of DE_FUERA) di(!comoQuien(u).qcEsQC(), `${u.padEnd(12)} no entra en las de QC`);

seccion("B4 · LAS PANTALLAS EN OBRAS SIGUEN SIENDO DEL ADMINISTRADOR");
for (const u of Object.keys(CUENTAS)) {
  const puede = comoQuien(u).qcVeConfig();
  di(u === "admin" ? puede : !puede, `${u.padEnd(12)} ${EN_OBRAS.join(" · ")} — ${puede ? "sí" : "no"}`);
}

seccion("B5 · NINGUNA PANTALLA SE QUEDA SIN PUERTA NI CON UNA PUERTA ROTA");
{
  const pantallas = readdirSync(".").filter((f) => f.endsWith(".html") && f !== "guia-campo.html");
  const sinAuth = pantallas.filter((f) => {
    const s = readFileSync(f, "utf8");
    /* index y conectar son la entrada: no pueden exigir sesión. */
    if (f === "index.html" || f === "conectar.html") return false;
    /* Y `preparar.html` tampoco — Q-105. Es a donde lleva `qterapr.com/new`:
       limpia lo guardado y deja el aparato apuntando al servidor, ANTES de que
       nadie haya entrado. Pedirle sesión sería pedírsela justo al aparato que
       todavía no puede tenerla, que es el único caso para el que existe.
       No abre nada por sí sola: después hay que entrar con la cuenta igual. */
    if (f === "preparar.html") return false;
    return !/assets\/auth\.js/.test(s);
  });
  di(sinAuth.length === 0, sinAuth.length ? `sin puerta: ${sinAuth.join(", ")}` : `las ${pantallas.length} pantallas llevan su puerta`);
  const gate = (n) => new RegExp(n.replace(".", "\\.")).test(AUTH);
  di(SOLO_QC.every(gate), "las cinco de trabajo están nombradas en auth.js");
  di(EN_OBRAS.every(gate), "y las tres de la 934 también");
}

/* ── C · OBRAS ───────────────────────────────────────────────────────────── */
seccion("C · LAS DOS OBRAS NO SE MEZCLAN");
{
  const t = (n, obra, cia) => ({ n, id:"t"+n, date:HOY, proyecto:obra, ticket:String(5000+n),
                                 truck:String(300+n), vol:10, company:cia, arrive:"09:00",
                                 slump:4, uw:145, air:5, resultsAt:"09:20" });
  const TESTS = [t(1,"pr-52","Concre-Tech"), t(2,"pr-52","Concre-Tech"), t(3,"ac-220037","PRETENSADOS DE PR")];
  const META = { [HOY]: { cyPlan: 60, proyecto: "pr-52" } };

  const a = comoQuien("tecnico1", { tests: TESTS, dayMeta: META, activo: "pr-52" });
  di(a.sortedTests().length === 2, `PR-52 abierta: ${a.sortedTests().length} camiones, no 3`);
  di(a.sortedTests().every((x) => x.proyecto === "pr-52"), "todos de la PR-52");
  di(!a.sortedTests().some((x) => x.company === "PRETENSADOS DE PR"), "ni uno de PRETENSADOS");
  di(a.dayProgress(HOY).recibido === 20, `yardas ${a.dayProgress(HOY).recibido}, solo las suyas`);

  const b = comoQuien("tecnico1", { tests: TESTS, dayMeta: META, activo: "ac-220037" });
  di(b.sortedTests().length === 1, `AC-220037 abierta: ${b.sortedTests().length} camión`);
  di(!b.sortedTests().some((x) => x.company === "Concre-Tech"), "ni uno de Concre-Tech");

  /* Cambiar de obra no mueve un solo dato: solo cambia lo que se mira. */
  const c = comoQuien("tecnico1", { tests: TESTS, dayMeta: META, activo: "pr-52" });
  const antes = c.db.tests.map((x) => x.proyecto).join(",");
  c.abrirProyecto("ac-220037");
  di(c.db.tests.map((x) => x.proyecto).join(",") === antes, "cambiar de obra no re-etiqueta ningún camión");
  di(c.proyectoActivo() === "ac-220037", "y la obra abierta sí cambia");
}

/* ── D · MONITORES ───────────────────────────────────────────────────────── */
seccion("D · LOS MONITORES DICEN LA VERDAD");
{
  const t = (n, extra) => ({ n, id:"t"+n, date:HOY, proyecto:"pr-52", ticket:String(6000+n),
                             truck:String(400+n), vol:10, arrive:"08:0"+n, slump:4, uw:145, air:5, ...extra });
  const META = { [HOY]: { cyPlan: 60, proyecto: "pr-52" } };

  const abierto = comoQuien("tecnico1", { tests:[t(1,{resultsAt:"08:30"}), t(2,{resultsAt:"08:50"})], dayMeta: META });
  di(abierto.hayTiroActivo(HOY), "con tiro de hoy sin cerrar: hay tiro activo");
  di(abierto.dayProgress(HOY).recibido === 20, `avance ${abierto.dayProgress(HOY).recibido} de 60`);
  di(Math.round(abierto.dayProgress(HOY).pct) === 33, `porcentaje ${Math.round(abierto.dayProgress(HOY).pct)} %`);
  di(abierto.dayProgress(HOY).pending === 40, `faltan ${abierto.dayProgress(HOY).pending}`);
  di(abierto.dayProgress(HOY).discharging.length === 0, "con resultados puestos, nadie sigue «vaciando»");

  const cerrado = comoQuien("tecnico1", { tests:[t(1,{resultsAt:"08:30"})],
    dayMeta:{ [HOY]: { cyPlan:60, proyecto:"pr-52", cerradoA:"16:00" } } });
  di(!cerrado.hayTiroActivo(HOY), "cerrado: deja de haber tiro activo");
  di(cerrado.discrepanciaDeOrden(HOY) === null, "y el aviso de yardas se calla");
  di(cerrado.dayProgress(HOY).placed === cerrado.dayProgress(HOY).recibido,
     "cerrado, lo recibido ES lo colocado");

  const ayer = (() => { const d = new Date(); d.setDate(d.getDate()-1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const viejo = comoQuien("tecnico1", { tests:[{ ...t(1,{resultsAt:"08:30"}), date: ayer }],
                                        dayMeta:{ [ayer]: { cyPlan:60, proyecto:"pr-52" } } });
  /* UN VACIADO SIN CERRAR NO ES HISTORIA, ES LO QUE ESTÁ PASANDO — Q-98.

     Esto afirmaba lo contrario: que el tiro de ayer NO es un tiro activo. Era
     verdad hasta el 28 de agosto de 2026, cuando se cambió a propósito. Se vio
     montando el tiro del sábado 22: el vaciado estaba abierto, con cuatro
     camiones dentro y el cuarto esperando muestras, y el Control Center
     presidía con «0 CY · sin comenzar» porque hoy era día 28.

     `hayTiroActivo()` dejó de preguntar «¿es de hoy?» y pasó a preguntar «¿está
     abierto?». Un tiro de ayer sin cerrar SÍ está abierto, y esa es justo la
     respuesta que hacía falta.

     La auditoría se quedó afirmando lo de antes, y llevaba desde entonces en
     rojo. Una prueba que afirma el comportamiento viejo después de un cambio
     deliberado es peor que no tener prueba: enseña a mirar el rojo sin leerlo,
     y el día que se ponga rojo de verdad tampoco lo va a leer nadie. */
  di(viejo.hayTiroActivo(ayer), "el tiro de ayer, sin cerrar, sigue siendo el tiro abierto");
  di(!viejo.hayTiroActivo(HOY), "y hoy, que no tiene ficha, no tiene tiro");
  const cerradoAyer = comoQuien("tecnico1", { tests:[{ ...t(1,{resultsAt:"08:30"}), date: ayer }],
    dayMeta:{ [ayer]: { cyPlan:60, proyecto:"pr-52", cerradoA:"16:00" } } });
  di(!cerradoAyer.hayTiroActivo(ayer), "y en cuanto se cierra, deja de estarlo");

  const fantasma = comoQuien("tecnico1", {
    tests:[t(1,{resultsAt:"08:30"}), { ...t(2), ticket:"", truck:"" }], dayMeta: META });
  di(fantasma.dayProgress(HOY).recibido === 10, "un camión sin conduce ni número no suma yardas");
  di(fantasma.dayProgress(HOY).sinNombre === 1, "y se avisa de que hay uno sin identificar");

  const fuera = comoQuien("tecnico1", { tests:[t(1,{ slump:7, resultsAt:"08:30", aceptadoFuera:"Slump 7" })], dayMeta: META });
  di(fuera.worstZone(fuera.db.tests[0]) === "susp", "un camión fuera de límite se ve fuera de límite");
  di(/ACEPTADO FUERA/.test(fuera.estadoBadge(fuera.db.tests[0])), "y si se acepta igual, queda escrito en la lista");
}

seccion("D2 · UN VACIADO FIRMADO NO SE REESCRIBE SOLO");
{
  const META = { [HOY]: { cyPlan:60, proyecto:"pr-52", cerradoA:"16:00" } };
  di(comoQuien("ruben",    { dayMeta: META }).puedeEditarDia(HOY) === true,
     "ruben puede corregir un vaciado cerrado — es el ingeniero de récord");
  for (const u of ["tecnico1", "yarvier", "admin"]) {
    di(typeof comoQuien(u, { dayMeta: META }).puedeEditarDia(HOY) === "string",
       `${u.padEnd(10)} no lo reescribe: se le dice por qué`);
  }
}

/* ── Cosas que no rompen nada pero conviene mirar ────────────────────────── */
seccion("D3 · EL REGISTRO DE QUIÉN HACE QUÉ ES DE UNA SOLA CUENTA");
{
  /* Víctor, 15 ago: «Actividad solo la puede ver admin». Antes colgaba de la
     llave de Settings y la veían seis: los técnicos podían mirar el registro de
     lo que hacen ellos mismos. */
  const conActividad = Object.keys(CUENTAS).filter((u) => comoQuien(u).qcVeActividad());
  di(conActividad.length === 1 && conActividad[0] === "admin",
     `la ve ${conActividad.join(", ") || "nadie"} — y solo esa`);
  for (const u of ["ruben", "tecnico1", "yarvier"]) {
    di(!comoQuien(u).qcVeActividad(), `${u.padEnd(10)} no ve el registro de la cuadrilla`);
  }
}

seccion("AVISOS — no son fallos, son decisiones que conviene revisar");
{
  if (!avisos) console.log("  (ninguno)");
}

/* ── Resumen ─────────────────────────────────────────────────────────────── */
console.log("\n" + "─".repeat(66));
if (fallos) console.log(`  ${fallos} FALLO(S)` + (avisos ? ` · ${avisos} aviso(s)` : ""));
else console.log(`  sin fallos` + (avisos ? ` · ${avisos} aviso(s) para revisar` : ""));
console.log("");
process.exit(fallos ? 1 : 0);
