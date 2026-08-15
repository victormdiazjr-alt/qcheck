/* ¿Puede tecnico1 hacer un tiro ENTERO?  Abrirlo, recibir camiones, medirlos
   y cerrarlo. Se cargan `usuarios.js`, `auth.js` y `core.js` de verdad. */
import { readFileSync } from "node:fs";

function comoQuien(usr) {
  const alm = new Map([["qc-usuario", usr]]);
  const ctx = {
    localStorage: { getItem: (k) => alm.get(k) ?? null, setItem: (k,v)=>alm.set(k,String(v)), removeItem:(k)=>alm.delete(k) },
    document: { getElementById: () => null, addEventListener(){}, querySelectorAll: () => [],
                createElement: () => ({ style:{}, classList:{add(){}} }),
                documentElement: { dataset:{}, style:{ setProperty(){} } },
                head:{appendChild(){}}, body:{appendChild(){}} },
    window: { addEventListener(){}, matchMedia: () => ({ matches:false, addEventListener(){} }) },
    navigator: { onLine:true }, location: { pathname:"/x.html", hash:"", replace(){} },
    setInterval:()=>0, clearInterval(){}, setTimeout:()=>0, console,
    crypto:{ randomUUID:()=>"u" }, fetch: async()=>{ throw new Error("sin red"); },
    addEventListener(){}, removeEventListener(){}, requestAnimationFrame:()=>0,
  };
  const src = readFileSync("assets/usuarios.js","utf8") + "\n" + readFileSync("assets/core.js","utf8");
  const f = new Function(...Object.keys(ctx), src + `
    ;return { qcCuenta, qcEsQC, qcVeTablero, qcVeConfig, qcFirma, qcRol };`);
  return f(...Object.values(ctx));
}

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if(!ok) fallos++; };

console.log("\nTECNICO1 — lo que necesita para correr un tiro entero");
{
  const q = comoQuien("tecnico1");
  di(q.qcEsQC(), "1 · entra en Recepción, Muestras y Results (rol qc)");
  di(q.qcVeTablero(), "2 · llega al Control Center — para PROGRAMAR y CERRAR el tiro");
  di(q.qcCuenta().limites === true, "3 · ve los límites contra los que mide");
}

console.log("\nY lo que NO puede, que también hay que comprobar");
{
  const q = comoQuien("tecnico1");
  di(!q.qcFirma(), "no reabre un tiro cerrado ni descarta un vaciado — es de Rubén");
  di(!q.qcVeConfig(), "no entra en la sala de máquinas (llave del servidor, límites)");
}

console.log("\nEl resto del equipo, igual — un tiro no lo cubre siempre el mismo");
for (const u of ["tecnico2", "yarvier"]) {
  const q = comoQuien(u);
  di(q.qcEsQC() && q.qcVeTablero() && !q.qcFirma(), `${u}: corre un tiro, no firma`);
}

console.log("\nRubén no pierde nada");
{
  const q = comoQuien("ruben");
  di(q.qcEsQC() && q.qcVeTablero() && q.qcFirma(), "sigue con todo, incluida la firma");
}

console.log("\nY quien mira desde fuera sigue fuera");
for (const u of ["contratista", "concretero", "autoridad", "invitado"]) {
  const q = comoQuien(u);
  di(!q.qcEsQC() && !q.qcVeTablero(), `${u}: no entra en las pantallas de QC`);
}

console.log(fallos ? `\n${fallos} FALLO(S)\n` : "\nsin fallos\n");
process.exit(fallos ? 1 : 0);
