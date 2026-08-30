/* ============================================================
   UN APARATO MUY ATRASADO SE ESTRENA DE NUEVO — Q-154.

   La instantánea de un viaje (Q-141) solo entraba con el aparato EN BLANCO.
   Faltaba el otro caso, y es peor de lo que parece.

   Un aparato puede decir que va por la línea 41.000 y tener la copia VACÍA. No
   es raro, y encima lo provocamos nosotros: desde Q-148, cuando el almacén se
   llena se tira la copia local para hacerle sitio a la cola — a propósito,
   porque la copia se recupera y lo que el técnico midió no.

   Y ahí pasa lo que no se ve. La sincronización solo trae lo que viene DESPUÉS
   de esa línea. Los límites de la obra se escribieron hace meses, en la línea
   3. Ese aparato **no los pide nunca**: se queda con los de fábrica y juzga los
   camiones contra 95 °F en vez de contra 100. Sin un solo aviso, y con el
   expediente del servidor intacto y correcto.

   Medido con un iPad de repuesto de tres semanas: `planDe(hoy)` daba 95 con el
   servidor diciendo 100.

   > Decir por qué línea vas no es lo mismo que tener lo que hay hasta ella.

   Aquí se comprueba que, cuando el atraso es grande, el aparato se estrena
   otra vez en vez de seguir el hilo — y que la cola NO se toca, porque lo que
   escribió y no ha subido no está en ningún otro sitio del mundo.
   ============================================================ */
import { readFileSync } from "node:fs";

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };

function montar({ seq, topeServidor, cola = [] }) {
  const m = new Map([["qc-api", "https://x"], ["qc-token", "t"],
    ["qc-sync-seq", String(seq)], ["qc-sync-visto", "1"],
    ["qc-pr52-db-v1", JSON.stringify({ tests: [] })],
    ["qc-sync-base", JSON.stringify({ test: {} })]]);
  if (cola.length) m.set("qc-sync-cola", JSON.stringify(cola));
  const pedidas = [];
  const ctx = {
    localStorage: { getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) },
    document: { addEventListener() {}, hidden: false },
    window: { addEventListener() {} }, navigator: { onLine: true },
    location: { pathname: "/muestras.html", protocol: "http:", hostname: "x", origin: "http://x" },
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0,
    crypto: { randomUUID: () => "u" + Math.random().toString(36).slice(2) },
    console: { ...console, warn() {}, info() {} },
    fetch: async (url) => {
      const u = String(url);
      pedidas.push(u.replace("https://x", ""));
      if (u.includes("/api/estado")) {
        return { ok: true, status: 200, json: async () => ({ seq: topeServidor, estado: true,
          ops: [{ ent: "project", id: "pr-52", campo: "plan", valor: { slump: { actLo: 2 }, tempMax: 100 } }] }) };
      }
      /* El camino largo: paginas de 2.000 que NO traen la linea 3. */
      const desde = Number(u.split("desde=")[1] || 0);
      const hasta = Math.min(desde + 2000, topeServidor);
      return { ok: true, status: 200, json: async () => ({ seq: topeServidor,
        ops: desde >= topeServidor ? []
          : [{ uid: "o" + hasta, seq: hasta, ent: "test", id: "t" + hasta, campo: "slump", valor: 3, ts: "x" }] }) };
    },
  };
  const src = "var DB_KEY = 'qc-pr52-db-v1';\n"
    + "var db = { tests: [], dayMeta: {}, humidity: [], plan: {}, project: {}, proyectos: [], proyectoActivo: 'pr-52' };\n"
    + "function qcReconciliarN(){}\n"
    + readFileSync("assets/sync.js", "utf8");
  const f = new Function(...Object.keys(ctx), src + "\n;return { QCSync, db };");
  return { api: f(...Object.values(ctx)), alm: m, pedidas };
}

console.log("\nATRASO PEQUEÑO — se sigue el hilo, que es lo correcto");
{
  const { api, pedidas } = montar({ seq: 40000, topeServidor: 41000 });
  await api.QCSync._bajar();
  di(!pedidas.some((u) => u.includes("/api/estado")),
     `no se estrena por mil apuntes: ${pedidas.length} peticion(es), ninguna de estado`);
}

console.log("\nATRASO GRANDE — sale mas barato estrenarse otra vez");
{
  const { api, alm, pedidas } = montar({ seq: 3, topeServidor: 41747 });
  await api.QCSync._bajar();
  di(pedidas.some((u) => u.includes("/api/estado")), "pide el estado entero");
  di(pedidas.length <= 3, `y en pocos viajes: ${pedidas.length}`);
  di(Number(alm.get("qc-sync-seq")) === 41747, `queda en la linea del servidor: ${alm.get("qc-sync-seq")}`);
  const pr = (api.db.proyectos || []).find((x) => x.id === "pr-52");
  di(pr && pr.plan && pr.plan.tempMax === 100,
     `y RECUPERA los limites que estaban antes de su linea: tempMax=${pr && pr.plan && pr.plan.tempMax}`);
}

console.log("\nY LA COLA NO SE TOCA NUNCA");
{
  const pendiente = [{ uid: "x1", ent: "test", id: "t9", campo: "slump", valor: 3.2, ts: "x" }];
  const { api, alm } = montar({ seq: 3, topeServidor: 41747, cola: pendiente });
  await api.QCSync._bajar();
  const cola = JSON.parse(alm.get("qc-sync-cola") || "[]");
  di(cola.length === 1 && cola[0].uid === "x1",
     `lo que el tecnico midio y no subio sigue ahi: ${cola.length} apunte(s)`);
}

console.log("\nY NO SE ESTRENA EN BUCLE");
{
  const { api, pedidas } = montar({ seq: 3, topeServidor: 41747 });
  await api.QCSync._bajar();
  await api.QCSync._bajar();
  await api.QCSync._bajar();
  const estrenos = pedidas.filter((u) => u.includes("/api/estado")).length;
  di(estrenos === 1, `una sola vez por sesion: ${estrenos}`);
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
