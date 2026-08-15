/* Q-108 · Lo del 15 de agosto a las 12:11, reproducido.
   Un aparato recién conectado tenía la base más vacía que la de referencia, y
   la diferencia subió como 1.801 borrados. Aquí se comprueba que ya no. */
import { readFileSync } from "node:fs";

function montar({ estrenado }) {
  const alm = new Map([["qc-api", "https://x"], ["qc-token", "t"]]);
  if (estrenado) alm.set("qc-sync-visto", "1");
  const subidas = [];
  const ctx = {
    localStorage: { getItem:(k)=>alm.get(k)??null, setItem:(k,v)=>alm.set(k,String(v)), removeItem:(k)=>alm.delete(k) },
    document:{ addEventListener(){}, hidden:false }, window:{ addEventListener(){} },
    navigator:{ onLine:true }, location:{ pathname:"/conduce.html" },
    setInterval:()=>0, clearInterval(){}, setTimeout:()=>0,
    crypto:{ randomUUID:()=> "u" + Math.random().toString(36).slice(2) },
    console:{ ...console, warn(){} },
    fetch: async () => ({ ok:true, json: async () => ({ ops: [], seq: 0 }) }),
  };
  /* `db` es global y vive en core.js; sync.js solo lo usa. Se declara aquí
     para poder montar sync.js solo, que es lo que se quiere probar. */
  const src = "var db = null;\n" + readFileSync("assets/sync.js", "utf8");
  const f = new Function(...Object.keys(ctx), src + `
    ;return { QCSync, qcProyectar, qcCambios, poner: (b) => { db = b; } };`);
  const api = f(...Object.values(ctx));
  return { api, alm, subidas };
}

let fallos = 0;
const di=(ok,t)=>{ console.log(`  ${ok?"✓":"✗"} ${t}`); if(!ok) fallos++; };

/* La base de referencia tiene tres ensayos con datos. La del aparato, ninguno:
   es el aparato recién conectado del 15 de agosto. */
const BASE = { test: { t1:{ ticket:"1917", slump:8, proyecto:"ac-220037" },
                       t2:{ ticket:"1918", slump:7, proyecto:"ac-220037" },
                       t3:{ ticket:"1919", slump:6, proyecto:"ac-220037" } },
               dayMeta:{}, plan:{}, project:{}, humidity:{}, config:{} };

function corre(estrenado) {
  const { api, alm } = montar({ estrenado });
  alm.set("qc-sync-base", JSON.stringify(BASE));
  api.poner({ tests: [], dayMeta:{}, humidity:[], plan:{}, project:{}, proyectos:[], proyectoActivo:"p" });
  api.QCSync.alGuardar();
  const cola = JSON.parse(alm.get("qc-sync-cola") || "[]");
  return { total: cola.length, borrados: cola.filter((o)=>o.valor===null||o.valor===undefined).length };
}

console.log("\nEL APARATO DE LAS 12:11 — recién conectado, base vacía");
{
  const r = corre(false);
  di(r.borrados === 0, `no sube ni un borrado (subía 9 de 9): ${r.borrados}`);
  di(r.total === 0, `y no sube nada en total: ${r.total}`);
}

console.log("\nEL MISMO APARATO, YA ESTRENADO — sus borrados sí valen");
{
  const r = corre(true);
  di(r.borrados > 0, `ahora sí los sube: ${r.borrados}`);
}

console.log("\nY UN APARATO SIN ESTRENAR SIGUE PUDIENDO AÑADIR");
{
  const { api, alm } = montar({ estrenado:false });
  alm.set("qc-sync-base", JSON.stringify({ test:{}, dayMeta:{}, plan:{}, project:{}, humidity:{}, config:{} }));
  api.poner({ tests:[{ id:"n1", ticket:"5001", slump:4, date:"2026-08-15" }],
              dayMeta:{}, humidity:[], plan:{}, project:{}, proyectos:[], proyectoActivo:"p" });
  api.QCSync.alGuardar();
  const cola = JSON.parse(alm.get("qc-sync-cola") || "[]");
  di(cola.length > 0, `el camión nuevo sube igual: ${cola.length} apuntes`);
  di(cola.every((o)=>o.valor!==null), "y ninguno es un borrado");
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
