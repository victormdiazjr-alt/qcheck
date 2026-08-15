/* Q-112 · Con la ficha que manda el servidor, tecnico1 aterriza en el Control
   Center — desde el iPad, desde el teléfono y desde la PC.
   Víctor: «asegúrate de que cuando se conecte enseñe el Control Center con los
   botones, como quedamos que sería de ahora en adelante en iPad». */
import { readFileSync } from "node:fs";

/* La ficha REAL devuelta hoy por /api/sesion para tecnico1. */
const FICHA = { usr:"tecnico1", nombre:"Técnico 1", rol:"qc",
                tablero:true, config:false, limites:true, firma:false, casa:null };

const APARATOS = {
  "iPad (normal)":            { ua:"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15", w:834,  h:1112 },
  "iPad «sitio para móvil»":  { ua:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1", w:834, h:1112 },
  "iPhone":                   { ua:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1", w:390, h:844 },
  "PC":                       { ua:"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36", w:1512, h:982 },
};

function casaCon(ficha, ap) {
  const alm = new Map([["qc-ident", JSON.stringify(ficha)]]);
  const ctx = {
    localStorage:{ getItem:(k)=>alm.get(k)??null, setItem:(k,v)=>alm.set(k,String(v)), removeItem:(k)=>alm.delete(k) },
    document:{ getElementById:()=>null, addEventListener(){}, querySelectorAll:()=>[],
               createElement:()=>({style:{},classList:{add(){}}}),
               documentElement:{dataset:{},style:{setProperty(){}}}, head:{appendChild(){}}, body:{appendChild(){}} },
    window:{ addEventListener(){}, matchMedia:()=>({matches:false,addEventListener(){}}) },
    navigator:{ onLine:true, userAgent: ap.ua },
    screen:{ width: ap.w, height: ap.h },
    location:{ pathname:"/index.html", hash:"", replace(){} },
    setInterval:()=>0, clearInterval(){}, setTimeout:()=>0, console,
    crypto:{ randomUUID:()=>"u" }, fetch: async()=>{ throw new Error("sin red"); },
    addEventListener(){}, removeEventListener(){}, requestAnimationFrame:()=>0,
  };
  const src = readFileSync("assets/usuarios.js","utf8") + "\n" + readFileSync("assets/core.js","utf8");
  const f = new Function(...Object.keys(ctx), src + `
    ;return { casaDe, esTelefono, qcVeTablero, qcVeLimites, qcVeConfig, qcFirma };`);
  return f(...Object.values(ctx));
}

let fallos = 0;
const di=(ok,t)=>{ console.log(`  ${ok?"✓":"✗"} ${t}`); if(!ok) fallos++; };

console.log("\nTECNICO1 ATERRIZA EN EL CONTROL CENTER, VENGA DE DONDE VENGA");
for (const [nombre, ap] of Object.entries(APARATOS)) {
  const q = casaCon(FICHA, ap);
  di(q.casaDe() === "control-center.html", `${nombre}: ${q.casaDe()}`);
}

console.log("\nY EL IPAD NO SE CUELA COMO TELÉFONO NI DISFRAZADO");
{
  const q = casaCon(FICHA, APARATOS["iPad «sitio para móvil»"]);
  di(q.esTelefono() === false, "con nombre de iPhone y pantalla de iPad: no es teléfono");
  const p = casaCon(FICHA, APARATOS["iPhone"]);
  di(p.esTelefono() === true, "y un iPhone de verdad sí lo es");
}

console.log("\nY VE LOS BOTONES QUE TIENE QUE VER");
{
  const q = casaCon(FICHA, APARATOS["iPad (normal)"]);
  di(q.qcVeTablero(), "Tiro, Recepción, Muestras, Field Display, Results, Reportes, Dashboards");
  di(q.qcVeLimites(), "y Settings, los límites contra los que mide");
  di(!q.qcVeConfig(), "sin la sala de máquinas");
  di(!q.qcFirma(), "y sin poder reabrir ni descartar un vaciado");
}

console.log("\nQUIEN NO LLEVA TABLERO SIGUE EN SU PORTAL");
{
  const q = casaCon({ ...FICHA, tablero:false }, APARATOS["iPhone"]);
  di(q.casaDe() === "movil.html", `sin tablero y en teléfono: ${q.casaDe()}`);
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
