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

console.log("\nY UN APARATO SIN ESTRENAR TAMPOCO AÑADE — espera al primer viaje (Q-106)");
{
  const { api, alm } = montar({ estrenado:false });
  alm.set("qc-sync-base", JSON.stringify({ test:{}, dayMeta:{}, plan:{}, project:{}, humidity:{}, config:{} }));
  api.poner({ tests:[{ id:"n1", ticket:"5001", slump:4, date:"2026-08-15" }],
              dayMeta:{}, humidity:[], plan:{}, project:{}, proyectos:[], proyectoActivo:"p" });
  api.QCSync.alGuardar();
  const cola = JSON.parse(alm.get("qc-sync-cola") || "[]");
  /* Q-106 LO CAMBIO A PROPOSITO, el 28 de agosto: un aparato sin estrenar no
     sube NADA, tampoco lo que añade. La razon esta escrita entera en sync.js —
     «un aparato que no ha bajado nada del servidor no sabe que hay en el; ni
     puede decir que algo se borro, ni puede decir que algo es nuevo».

     No se pierde: `alGuardar` sale ANTES de tocar la copia de referencia, asi
     que en cuanto el aparato se estrena, el siguiente guardado vuelve a ver
     ese camion como cambio y lo sube. Lo unico que cambia es CUANDO.

     Y desde Q-141 esa espera es un viaje —menos de un segundo— en vez de las
     veintidos paginas de antes. */
  di(cola.length === 0, `sin estrenar no sube nada todavia: ${cola.length} apuntes`);
}

console.log("\nY NO SE DA POR ESTRENADO A MEDIAS");
{
  const c = readFileSync("assets/sync.js", "utf8");
  di(/if \(r\.seq != null && this\._seq\(\) >= r\.seq\) localStorage\.setItem\(QC_SYNC_VISTO/.test(c),
     "solo se marca estrenado al alcanzar el ultimo numero del servidor");
  /* Esto prohibia la linea `localStorage.setItem(QC_SYNC_VISTO, "1")` en
     cualquier sitio. La intencion era buena —que no se de por estrenado un
     aparato que solo bajo una pagina— pero prohibir el TEXTO prohibe tambien
     los usos legitimos: Q-141 la usa en `_bajarEstado`, donde el aparato acaba
     de recibir el estado ENTERO en un viaje y esta al dia de verdad.

     Se comprueba lo que importa: que dentro de `_bajarUna` —el camino de las
     paginas— la marca solo se ponga comparando con el ultimo numero. */
  const paginado = c.slice(c.indexOf("async _bajarUna()"), c.indexOf("async _empujar()") >= 0
    ? Math.max(c.indexOf("async _bajarUna()") + 1, c.indexOf("_sello()")) : c.length);
  di(!/^\s*localStorage\.setItem\(QC_SYNC_VISTO, "1"\);\s*$/m.test(paginado),
     "el camino de las paginas no se marca estrenado a la ligera");
}

console.log("\nY SE PONE AL DIA DE UN VIAJE (Q-141)");
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
      pedidas++;
      /* Q-141: el estado, de un viaje. */
      if (/\/api\/estado/.test(String(url))) {
        return { ok:true, json: async () => ({ seq: 10000, estado: true,
          ops: [{ ent:"config", id:"", campo:"demo", valor:false }] }) };
      }
      const desde = Number(String(url).split("desde=")[1] || 0);
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
  /* AQUI SE VE Q-141. Esto exigia CINCO viajes, porque el aparato reproducia la
     historia de 2.000 en 2.000. Desde el 29 de agosto pide `/api/estado` y se
     pone al dia de UNO — que era justo el objetivo: 22 peticiones seguidas, y
     las 22 tenian que salir bien; con un 5 % de fallo por viaje, el 68 % de
     las veces no terminaba. Ahora lo correcto es exigir lo contrario. */
  di(pedidas === 1, `se estreno en ${pedidas} viaje(s)`);
  di(alm.get("qc-sync-visto") === "1", "y queda estrenado");
  di(Number(alm.get("qc-sync-seq")) === 10000, `y en la linea ${alm.get("qc-sync-seq")} del servidor`);
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
