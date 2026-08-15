/* EL TIRO DE MAÑANA, DE PRINCIPIO A FIN, con `core.js` de verdad.
   Víctor: «necesito que pueda correr el tiro de mañana sin problemas».
   Esto no prueba funciones sueltas: hace el día entero en orden. */
import { readFileSync } from "node:fs";

const hoy = () => { const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const HOY = hoy();

/* Los límites reales de la PR-52 (Concre-Tech, 4000 psi). */
const PLAN = { slump:{target:4,actLo:2.5,actHi:5.5,suspLo:1.5,suspHi:6.5},
               uw:{target:145,act:2,susp:3},
               air:{target:5,actLo:3.5,actHi:6.5,suspLo:2.5,suspHi:7.5},
               temp:{max:95} };

function app() {
  const alm = new Map([["qc-user","tecnico1"]]);
  const ctx = {
    localStorage:{ getItem:(k)=>alm.get(k)??null, setItem:(k,v)=>alm.set(k,String(v)), removeItem:(k)=>alm.delete(k) },
    document:{ getElementById:()=>null, addEventListener(){}, querySelectorAll:()=>[],
               createElement:()=>({style:{},classList:{add(){}}}),
               documentElement:{dataset:{},style:{setProperty(){}}}, head:{appendChild(){}}, body:{appendChild(){}} },
    window:{ addEventListener(){}, matchMedia:()=>({matches:false,addEventListener(){}}) },
    navigator:{ onLine:true }, location:{ pathname:"/conduce.html", hash:"", replace(){} },
    setInterval:()=>0, clearInterval(){}, setTimeout:()=>0, console,
    crypto:{ randomUUID:()=>"u"+Math.floor(performance.now()*1e6) },
    fetch: async()=>{ throw new Error("sin red"); },
    addEventListener(){}, removeEventListener(){}, requestAnimationFrame:()=>0,
  };
  const src = readFileSync("assets/usuarios.js","utf8")+"\n"+readFileSync("assets/core.js","utf8");
  const f = new Function(...Object.keys(ctx), src + `
    ;db = { tests: [], dayMeta: {}, humidity: [], plan: ${JSON.stringify(PLAN)},
            proyectos: [ { id:"pr-52", name:"PR-52 · Del Valle", contractor:"Del Valle Group",
                           concretera:"Concre-Tech", plan: ${JSON.stringify(PLAN)} },
                         { id:"ac-220037", name:"AC-220037 · EJ", contractor:"EJ Construction",
                           concretera:"PRETENSADOS", plan: ${JSON.stringify(PLAN)} } ],
            proyectoActivo: "ac-220037" };
    db.project = db.proyectos.find(p=>p.id==="ac-220037");
    saveDB = function(){};
    return { db, dayProgress, worstZone, tiroCerrado, abrirProyecto, proyectoActivo,
             testsOfDate, sortedTests, estadoBadge, qcCuenta, zoneSlump, zoneUW, zoneAir,
             hayTiroActivo, estadoTiro };`);
  return f(...Object.values(ctx));
}

let fallos = 0;
const di = (ok,t)=>{ console.log(`  ${ok?"✓":"✗"} ${t}`); if(!ok) fallos++; };
const A = app();
const { db } = A;

console.log("\n① ABRE EL TIRO — y elige la PR-52 estando abierta la otra obra");
di(A.proyectoActivo() === "ac-220037", "empieza en AC-220037, como quedó hoy");
db.dayMeta[HOY] = { proyecto:"pr-52", cyPlan:60 };
A.abrirProyecto("pr-52");
di(A.proyectoActivo() === "pr-52", "elegir la obra en el tiro la abre: " + A.proyectoActivo());
di(db.project.concretera === "Concre-Tech", "y la concretera es " + db.project.concretera);

console.log("\n② ENTRAN SEIS CAMIONES");
const mete = (n, extra) => { db.tests.push({ n, id:"t"+n, date:HOY, proyecto:"pr-52",
  ticket:String(5100+n), truck:String(300+n), vol:10, company:"Concre-Tech",
  arrive:"08:0"+n, source:"foto", ...extra }); };
for (let i=1;i<=6;i++) mete(i);
di(A.testsOfDate(HOY).length === 6, "seis camiones en la obra: " + A.testsOfDate(HOY).length);
di(A.dayProgress(HOY).recibido === 60, "yardas = " + A.dayProgress(HOY).recibido + " de 60");
di(Math.round(A.dayProgress(HOY).pct ?? 0) === 100, "y el avance llega al 100 %");

console.log("\n③ SE MIDEN — uno bueno, uno en zona de acción, uno FUERA");
/* `resultsAt` lo pone la aplicación al pulsar Enviar. Sin él la prueba medía
   camiones que el sistema seguía considerando sin medir — no reproducía el
   flujo real, y por eso el monitor parecía no apagarse. */
db.tests[0].slump=4;   db.tests[0].uw=145; db.tests[0].air=5;   db.tests[0].resultsAt="09:20";
/* Zona de ACCIÓN es entre el límite de acción y el de suspensión: con 5.4 el
   slump seguía DENTRO (acción hasta 5.5) y la prueba pedía un aviso que no
   tocaba. El error era mío, no del código. */
db.tests[1].slump=6.0; db.tests[1].uw=146; db.tests[1].air=6.2; db.tests[1].resultsAt="09:35";
db.tests[2].slump=7.0; db.tests[2].uw=145; db.tests[2].air=5;   db.tests[2].resultsAt="09:50";
di(A.worstZone(db.tests[0]) === "ok",   "el bueno sale OK");
di(A.worstZone(db.tests[1]) === "act",  "el segundo, zona de acción");
di(A.worstZone(db.tests[2]) === "susp", "el tercero, FUERA de límite");

console.log("\n④ EL DE FUERA SE ACEPTA IGUAL — y queda escrito");
db.tests[2].aceptadoFuera = "Slump 7"; db.tests[2].aceptadoFueraAt = "09:40";
di(/ACEPTADO FUERA/.test(A.estadoBadge(db.tests[2])), "sale con su distintivo en la lista");
di(A.dayProgress(HOY).recibido === 60, "y sus yardas cuentan: " + A.dayProgress(HOY).recibido);

console.log("\n⑤ UN FANTASMA NO PUEDE COLARSE");
mete(7, { ticket:"", truck:"" });
di(A.dayProgress(HOY).recibido === 60, "las yardas NO suben: " + A.dayProgress(HOY).recibido);
di(A.dayProgress(HOY).sinNombre === 1, "y se avisa de 1 sin identificar");
db.tests.pop();

console.log("\n⑤bis EL MONITOR NO SE QUEDA EN «VACIANDO» PARA SIEMPRE");
{
  /* El caso literal de la foto de Víctor: 21:00, el tiro acabado hacía horas,
     y el monitor todavía decía VACIANDO por un camión de las 9:15. Pasaba
     porque el sello de fin, que es el único que apagaba ese estado, no se pone
     nunca en el trabajo real. */
  const c = db.tests[0];
  c.start = "09:10";
  di(A.dayProgress(HOY).discharging.length === 0,
     "con resultados puestos, deja de contar como descargando");
  const sinMedir = { n:99, id:"t99", date:HOY, proyecto:"pr-52", ticket:"5199",
                     truck:"399", vol:10, arrive:"09:00", start:"09:05" };
  db.tests.push(sinMedir);
  di(A.dayProgress(HOY).discharging.length === 1,
     "y uno que AÚN no se ha medido sí cuenta: " + A.dayProgress(HOY).discharging.length);
  db.tests.pop();
}

console.log("\n⑤ter LA CIFRA GRANDE Y SU PORCENTAJE DICEN LO MISMO");
{
  const cc = readFileSync("control-center.html","utf8");
  const mv = readFileSync("movil.html","utf8");
  di(/<b>\$\{fmt\(p\.recibido, 1\)\}<\/b>/.test(cc), "Control Center: la cifra grande es lo recibido");
  di(/<b>\$\{fmt\(p\.recibido, 1\)\}<\/b>/.test(mv), "Móvil: igual, y no discute con el Control Center");
}

console.log("\n⑥ SE CIERRA EL TIRO");
db.dayMeta[HOY].cerradoA = "16:20";
di(A.tiroCerrado(HOY) === "16:20", "cerrado a las " + A.tiroCerrado(HOY));
di(A.dayProgress(HOY).placed === 60, "cerrado, lo recibido ES lo colocado: " + A.dayProgress(HOY).placed);

console.log("\n⑥bis SIN TIRO ACTIVO NO HAY PROGRESO — Víctor, la noche del 14");
{
  /* Con el tiro cerrado ya no hay tiro activo, aunque sea de hoy. */
  di(A.hayTiroActivo(HOY) === false, "cerrado, deja de ser tiro activo");
  di(/Ready para Tirar|Tiro cerrado/.test(A.estadoTiro(HOY).txt),
     "y el monitor lo dice: «" + A.estadoTiro(HOY).txt + "»");
  /* Y el de ayer no ocupa la pantalla de hoy: se acabó la ventana de horas. */
  const ayer = (() => { const d=new Date(); d.setDate(d.getDate()-1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  di(A.hayTiroActivo(ayer) === false, "el de ayer tampoco es tiro activo");
  di(A.estadoTiro(ayer).txt === "Ready para Tirar",
     "y sale «" + A.estadoTiro(ayer).txt + "», sin cifras de un tiro que ya pasó");
}

console.log("\n⑦ Y NADA DE LA OTRA OBRA SE HA COLADO EN TODO EL DÍA");
di(A.sortedTests().every((t)=>t.proyecto==="pr-52"), "todos los ensayos son de la PR-52");
di(!A.sortedTests().some((t)=>t.company==="PRETENSADOS"), "ni un camión de PRETENSADOS");

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  el tiro entero corre sin un fallo\n");
process.exit(fallos ? 1 : 0);
