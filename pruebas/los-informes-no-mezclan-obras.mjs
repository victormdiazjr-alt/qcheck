/* Ruben, hace dos dias: «los reportes y resultados estan mezclados de Del Valle
   con los de EJ, Concre-Tech con Pretensados».
   Esto comprueba que NO se mezclan, con las dos obras de verdad. */
import { readFileSync } from "node:fs";

const HOY = new Date().toISOString().slice(0, 10);

function monta(activa) {
  const alm = new Map();
  const ctx = {
    localStorage: { getItem: (k) => alm.get(k) ?? null, setItem: (k,v)=>alm.set(k,String(v)), removeItem:(k)=>alm.delete(k) },
    document: { getElementById: () => null, addEventListener(){}, querySelectorAll: () => [],
                createElement: () => ({ style:{}, classList:{add(){}} }),
                documentElement: { dataset:{}, style:{ setProperty(){} } },
                head:{appendChild(){}}, body:{appendChild(){}} },
    window: { addEventListener(){}, matchMedia: () => ({ matches:false, addEventListener(){} }) },
    navigator: { onLine:true }, location: { pathname:"/reporte.html", hash:"", replace(){} },
    setInterval:()=>0, clearInterval(){}, setTimeout:()=>0, console,
    crypto:{ randomUUID:()=>"u" }, fetch: async()=>{ throw new Error("sin red"); },
    addEventListener(){}, removeEventListener(){}, requestAnimationFrame:()=>0,
  };
  const PLAN = { slump:{target:8,actLo:6.5,actHi:9.5,suspLo:5.5,suspHi:10.5},
                 uw:{target:152.9,act:2,susp:3},
                 air:{target:2,actLo:1,actHi:3.5,suspLo:0.5,suspHi:4.5}, temp:{max:95} };
  const t = (n, obra, truck) => ({ n, id:"t"+n, date:HOY, proyecto:obra, truck, ticket:String(1900+n),
                                   vol:8.5, arrive:"09:00", slump:7, uw:152, company: obra === "pr-52" ? "Concre-Tech" : "PRETENSADOS" });
  const src = readFileSync("assets/core.js","utf8");
  const f = new Function(...Object.keys(ctx), src + `
    ;db = { tests: ${JSON.stringify([t(1,"pr-52","101"), t(2,"pr-52","102"), t(3,"ac-220037","201")])},
            dayMeta: { "${HOY}": { cyPlan: 51, proyecto: "${activa}" } },
            humidity: [], plan: ${JSON.stringify(PLAN)},
            proyectos: [ { id:"pr-52", name:"PR-52 · Del Valle", contractor:"Del Valle Group", concretera:"Concre-Tech", plan: ${JSON.stringify(PLAN)} },
                         { id:"ac-220037", name:"AC-220037 · EJ", contractor:"EJ Construction", concretera:"PRETENSADOS", plan: ${JSON.stringify(PLAN)} } ],
            proyectoActivo: "${activa}" };
    db.project = db.proyectos.find(p => p.id === "${activa}");
    return { sortedTests, testsOfDate, dayProgress, testDates, proyectoActivo };`);
  return f(...Object.values(ctx));
}

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if(!ok) fallos++; };

console.log("\nCON LA PR-52 ABIERTA — nada de EJ / PRETENSADOS puede aparecer");
{
  const q = monta("pr-52");
  const ts = q.sortedTests();
  di(ts.length === 2, `2 ensayos, no 3: ${ts.length}`);
  di(ts.every((t) => t.proyecto === "pr-52"), "todos son de la PR-52");
  di(!ts.some((t) => t.company === "PRETENSADOS"), "ni un camión de PRETENSADOS");
  di(q.dayProgress(HOY).recibido === 17, `yardas = ${q.dayProgress(HOY).recibido}, solo las suyas`);
}

console.log("\nCON LA AC-220037 ABIERTA — y al revés");
{
  const q = monta("ac-220037");
  const ts = q.sortedTests();
  di(ts.length === 1, `1 ensayo: ${ts.length}`);
  di(ts.every((t) => t.proyecto === "ac-220037"), "todos son de AC-220037");
  di(!ts.some((t) => t.company === "Concre-Tech"), "ni un camión de Concre-Tech");
  di(q.dayProgress(HOY).recibido === 8.5, `yardas = ${q.dayProgress(HOY).recibido}`);
}

console.log("\nY el informe se encabeza con la obra abierta, no con un texto fijo");
{
  const rep = readFileSync("reporte.html","utf8");
  di(/db\.project\.name/.test(rep), "el título sale de db.project.name");
  di(/db\.project\.contractor/.test(rep), "el contratista sale de la obra");
  di(!/PR-52/.test(rep.replace(/<!--[\s\S]*?-->/g, "")), "no hay «PR-52» escrito a fuego fuera de comentarios");
}

console.log(fallos ? `\n${fallos} FALLO(S)\n` : "\nsin fallos\n");
process.exit(fallos ? 1 : 0);
