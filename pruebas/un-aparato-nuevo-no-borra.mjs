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

console.log("\nY A MEDIO BAJAR TAMPOCO — el servidor da 2.000 de 52.000 por vuelta");
{
  const c = readFileSync("assets/sync.js", "utf8");
  di(/if \(r\.seq != null && this\._seq\(\) >= r\.seq\) localStorage\.setItem\(QC_SYNC_VISTO/.test(c),
     "solo se marca estrenado al alcanzar el ultimo numero del servidor");
  di(!/^\s*localStorage\.setItem\(QC_SYNC_VISTO, "1"\);\s*$/m.test(c),
     "y ya no se marca por haber bajado una pagina cualquiera");
}

console.log("\nY SE PONE AL DIA DE UNA VEZ, no una pagina por vuelta");
{
  /* Un servidor con cinco paginas: se comprueba que las pide todas seguidas. */
  const alm = new Map([["qc-api","https://x"],["qc-token","t"]]);
  let pedidas = 0;
  const ctx = {
    localStorage:{ getItem:(k)=>alm.get(k)??null, setItem:(k,v)=>alm.set(k,String(v)), removeItem:(k)=>alm.delete(k) },
    document:{ addEventListener(){}, hidden:false }, window:{ addEventListener(){} },
    navigator:{ onLine:true }, location:{ pathname:"/x.html" },
    setInterval:()=>0, clearInterval(){}, setTimeout:()=>0,
    crypto:{ randomUUID:()=>"u"+Math.random() }, console:{ ...console, warn(){} },
    fetch: async (url) => {
      const desde = Number(String(url).split("desde=")[1] || 0);
      pedidas++;
      const hasta = Math.min(desde + 2000, 10000);
      const ops = desde >= 10000 ? []
        : [{ uid:"o"+hasta, ent:"config", id:"", campo:"demo", valor:false, seq:hasta, ts:"x" }];
      return { ok:true, json: async () => ({ ops, seq: 10000 }) };
    },
  };
  /* `DB_KEY` vive en core.js y sync.js lo usa. Sin declararlo aquí, la bajada
     reventaba en silencio dentro del try y el bucle paraba a la primera página:
     la prueba culpaba al código de un hueco del banco. */
  const src = "var DB_KEY = 'qc-db';\n"
            + "var db = { tests:[], dayMeta:{}, humidity:[], plan:{}, project:{}, proyectos:[] };\n"
            + readFileSync("assets/sync.js","utf8");
  const f = new Function(...Object.keys(ctx), src + "\n;return { QCSync };");
  const { QCSync } = f(...Object.values(ctx));
  await QCSync._bajar();
  di(pedidas >= 5, `pidio ${pedidas} paginas en una sola vuelta`);
  di(alm.get("qc-sync-visto") === "1", "y al llegar al final se marca estrenado");
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
