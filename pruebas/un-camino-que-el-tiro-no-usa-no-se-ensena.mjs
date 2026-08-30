/* ============================================================
   UN CAMINO QUE ESTE TIRO NO USA NO SE ENSEÑA — Q-162.

   Víctor, mirando Muestras: «sigue viéndose el botón de recepción».

   Q-136 dejó que cada tiro diga si tiene parada de Recepción, y por omisión NO
   la tiene: el técnico recibe el camión en la misma estación donde lo mide. La
   fila de recibir sale y se esconde bien según eso desde ayer.

   Pero los ATAJOS a Recepción se quedaron fijos, de cuando era el único camino
   por donde entraba un camión: el «⇄ Recepción» de la cabecera de Muestras y
   el mosaico resaltado del teléfono.

   Y no es un botón de sobra. Es un botón grande, en la esquina donde se mira
   para salir, delante de alguien con el camión esperando. El que lo toque
   acaba en una estación que nadie está atendiendo, teclea el camión allí, y
   vuelve a Muestras a buscarlo.

   > Enseñar un camino es proponerlo.

   Aquí se comprueban los dos sentidos, porque esconderlo siempre sería el
   mismo fallo al revés: hay tiros con recepción aparte y ahí el atajo es justo
   lo que hace falta.
   ============================================================ */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };
const guionDe = (arch) => [...readFileSync(join(RAIZ, arch), "utf8")
  .matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");

console.log("\n1 · EL INTERRUPTOR DEL TIRO MANDA, Y POR OMISIÓN NO HAY RECEPCIÓN");
{
  /* `recepcionAparte()` es de core.js y es la única puerta. Se comprueba aquí
     porque todo lo demás cuelga de ella. */
  const ctx = { db: { dayMeta: {}, tests: [] } };
  const src = readFileSync(join(RAIZ, "assets/core.js"), "utf8")
    .match(/function recepcionAparte\(dia\) \{[\s\S]*?\n\}/)[0];
  const f = new Function("db", "diaActivo", "testsOfDate",
    src + "\n;return recepcionAparte;")(ctx.db, () => "2026-08-30", () => []);
  di(f("2026-08-30") === false, "un tiro nuevo sin decir nada: NO hay recepción aparte");
  ctx.db.dayMeta["2026-08-30"] = { recepcion: "muestras" };
  di(f("2026-08-30") === false, "y si el tiro lo dice, tampoco");
  ctx.db.dayMeta["2026-08-30"] = { recepcion: "aparte" };
  di(f("2026-08-30") === true, "solo cuando el tiro pide una estación aparte");
}

console.log("\n2 · MUESTRAS: EL ATAJO SE VA CON LA FILA, NO SE QUEDA SOLO");
{
  const g = guionDe("muestras.html");
  const trozo = (g.match(/function pintarFilaRecibir\(\)[\s\S]*?\n\}/) || [""])[0];
  di(/fila\.hidden = aparte/.test(trozo), "la fila de recibir sigue mirando el interruptor");
  di(/a\[href="conduce\.html"\]/.test(trozo),
     "y el enlace a Recepción se decide en el MISMO sitio, con el mismo dato");
  /* Por destino y no por clase: `.ver-rejilla` la comparte otro botón que no
     tiene nada que ver, y esconderlo por clase se llevaría los dos. */
  di(!/\.ver-rejilla[^\n]*hidden = aparte/.test(trozo),
     "y no por la clase, que la comparte un botón que no tiene nada que ver");

  /* Y que no quede ningún enlace a Recepción fuera de esa decisión. Se cuentan
     las ETIQUETAS `<a>`, no las apariciones del texto: el propio selector de
     arriba lleva `href="conduce.html"` dentro y contaría como una. */
  const html = readFileSync(join(RAIZ, "muestras.html"), "utf8");
  const enlaces = (html.match(/<a\b[^>]*href="conduce\.html"/g) || []).length;
  di(enlaces === 1, `solo queda uno, y es el de la cabecera: ${enlaces}`);

  /* Y el hueco de «no hay tiro» ya no manda a Recepción a hacer algo que se
     puede hacer aquí: ofrece programarlo. */
  di(/onclick="programarTiro\(\)"/.test(html), "sin tiro, la salida es programarlo");
}

console.log("\n3 · EL TELÉFONO NO PROPONE RECEPCIÓN SI EL TIRO NO LA TIENE");
{
  const g = guionDe("movil.html");
  di(/recepcionAparte/.test(g), "movil.html consulta el interruptor del tiro");
  const arma = (conRecepcion) => {
    const f = new Function("recepcionAparte", "PUERTAS_TRABAJO",
      `const conRecepcion = typeof recepcionAparte !== "function" || recepcionAparte();
       return PUERTAS_TRABAJO.filter((x) => conRecepcion || x.href !== "conduce.html");`);
    return f(() => conRecepcion,
      [{ href: "conduce.html", n: "Recepción" }, { href: "muestras.html", n: "Muestras" }]);
  };
  di(arma(false).length === 1 && arma(false)[0].href === "muestras.html",
     "sin recepción, lo primero que propone es Muestras");
  di(arma(true).length === 2 && arma(true)[0].href === "conduce.html",
     "y con recepción aparte, primero recibir — que es el orden del día");
}

console.log("\n4 · PERO RECEPCIÓN NO DESAPARECE DEL PROGRAMA");
{
  /* Esconder el atajo no es borrar la pantalla. Hay tiros que la usan, y para
     ponerle la recepción a uno hay que poder llegar a ella. El menú completo
     del Control Center es un MENÚ, no una sugerencia, y ahí se queda. */
  const cc = readFileSync(join(RAIZ, "control-center.html"), "utf8");
  di(/href: "conduce\.html", n: "Recepción"/.test(cc),
     "sigue en el menú completo del Control Center");
  const auth = readFileSync(join(RAIZ, "assets/auth.js"), "utf8");
  di(/conduce\.html/.test(auth), "y sigue protegida como pantalla de QC");
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
