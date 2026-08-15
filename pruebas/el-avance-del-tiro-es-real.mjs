/* Un camión aceptado y vaciado, SIN sello de fin —que es como se trabaja de
   verdad— tiene que contar en el avance del tiro. Se carga `core.js` entero. */
import { readFileSync } from "node:fs";

/* EL DÍA SE LE PREGUNTA A LA APLICACIÓN, NO A UTC — 14 ago 2026.
   Esta prueba usaba `toISOString()`, que da la fecha en Londres, y `core.js`
   usa la local. Pasaba todo el día y **empezó a fallar sola al cruzar la
   medianoche UTC**, señalando a un código que estaba bien. Una prueba que
   falla por la hora a la que se ejecuta es peor que no tenerla. */
const HOY = (() => { const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
function monta(tests, cyPlan) {
  const almacen = new Map();
  const ctx = {
    localStorage: { getItem: (k) => almacen.get(k) ?? null,
                    setItem: (k, v) => almacen.set(k, String(v)),
                    removeItem: (k) => almacen.delete(k) },
    document: { getElementById: () => null, addEventListener(){}, createElement: () => ({ style:{}, classList:{ add(){} } }),
                documentElement: { dataset: {}, style: { setProperty(){} } }, head: { appendChild(){} }, body: { appendChild(){} } },
    window: { addEventListener(){}, matchMedia: () => ({ matches:false, addEventListener(){} }) },
    navigator: { onLine: true }, location: { pathname: "/x.html", hash: "" },
    setInterval: () => 0, clearInterval(){}, setTimeout: () => 0, console,
    crypto: { randomUUID: () => "u" }, fetch: async () => { throw new Error("sin red"); },
    /* `core.js` engancha oyentes sueltos al cargarse. Sin esto revienta
       antes de llegar a la cuenta que se quiere probar. */
    addEventListener(){}, removeEventListener(){}, requestAnimationFrame: () => 0,
  };
  const src = readFileSync("assets/core.js", "utf8");
  const f = new Function(...Object.keys(ctx), src + `
    ;db = { tests: ${JSON.stringify(tests)},
            dayMeta: { "${HOY}": { cyPlan: ${cyPlan} } },
            humidity: [],
            /* Un plan de límites de verdad: sin el, worstZone revienta al
               juzgar el primer camión. Los números son los del proyecto. */
            plan: { slump:{target:8,actLo:6.5,actHi:9.5,suspLo:5.5,suspHi:10.5},
                    uw:{target:152.9,act:2,susp:3},
                    air:{target:2,actLo:1,actHi:3.5,suspLo:0.5,suspHi:4.5},
                    temp:{max:95} },
            project: { id: "p" },
            proyectos: [{ id: "p", name: "P" }], proyectoActivo: "p" };
    return { dayProgress };`);
  return f(...Object.values(ctx));
}

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };
/* El campo se llama `proyecto`, no `obra` — lo aprendí escribiendo esto:
   con `obra` la prueba daba 0 y parecía que fallaba el código. */
const camion = (n, vol, extra) => ({ n, id: "t" + n, date: HOY, proyecto: "p", truck: String(200 + n),
  vol, arrive: "09:0" + n, slump: 7, uw: 152, ...extra });

console.log("\nCÓMO SE TRABAJA DE VERDAD — aceptado, vaciando, sin sello de fin");
{
  const { dayProgress } = monta([camion(1, 8.5)], 51);
  const p = dayProgress(HOY);
  di(p.recibido === 8.5, `recibido = ${p.recibido} (es lo que enseña la barra)`);
  di(p.placed === 0, `placed = ${p.placed} — sigue siendo lo colocado, para los informes`);
  di(p.recibido / 51 > 0.16, `avance ${Math.round(p.recibido / 51 * 100)} % — ya no es 0 %`);
}

console.log("\nDos camiones, uno rechazado: el rechazado NO cuenta");
{
  const { dayProgress } = monta([camion(1, 8.5), camion(2, 8.5, { rejected: true })], 51);
  di(dayProgress(HOY).recibido === 8.5, `recibido = ${dayProgress(HOY).recibido}`);
}

console.log("\nAceptado FUERA de límite: cuenta igual, porque entró");
{
  const { dayProgress } = monta([camion(1, 8.5, { aceptadoFuera: "Slump 9.5" })], 51);
  di(dayProgress(HOY).recibido === 8.5, `recibido = ${dayProgress(HOY).recibido}`);
}

console.log("\nSin camiones: cero de verdad, no un número inventado");
{
  const { dayProgress } = monta([], 51);
  di(dayProgress(HOY).recibido === 0, `recibido = ${dayProgress(HOY).recibido}`);
}

console.log("\nLOS FANTASMAS DE HOY — sin conduce y sin camión, con yardas heredadas");
{
  /* Es el caso literal del 14 de agosto: dos registros a la misma hora, sin
     ticket y sin truck, con las 8.5 del camión anterior. Pusieron el tiro en
     51/51 y 100 % con hormigón llegando. */
  const real = camion(1, 8.5, { ticket: "1923" });
  const fant = (n) => ({ n, id: "f" + n, date: HOY, proyecto: "p", vol: 8.5,
                         arrive: "11:18", ticket: "", truck: "" });
  const { dayProgress } = monta([real, fant(2), fant(3)], 51);
  const p = dayProgress(HOY);
  di(p.recibido === 8.5, `recibido = ${p.recibido} — solo el camión con nombre`);
  di(p.sinNombre === 2, `sinNombre = ${p.sinNombre} — se cuentan para poder avisar`);
  di(p.sinNombreCY === 17, `sinNombreCY = ${p.sinNombreCY} — las yardas que NO cuentan`);
  di(Math.round(p.recibido / 51 * 100) === 17, `avance ${Math.round(p.recibido / 51 * 100)} %, no 100 %`);
}

console.log("\nUno con camión pero SIN conduce: cuenta, porque tiene nombre");
{
  const { dayProgress } = monta([camion(1, 8.5, { ticket: "", truck: "209" })], 51);
  di(dayProgress(HOY).recibido === 8.5, `recibido = ${dayProgress(HOY).recibido}`);
  di(dayProgress(HOY).sinNombre === 0, `sinNombre = ${dayProgress(HOY).sinNombre}`);
}

console.log("\nY QUE LA PANTALLA USE ESE NÚMERO — lo otro solo prueba la cuenta");
{
  /* Sin esto, la prueba se queda verde aunque alguien devuelva la barra a
     `placed`: estaría comprobando que `recibido` vale 8.5, que es cierto y no
     sirve de nada. Es la trampa de todo el proyecto: una prueba que se lee
     bien, está en verde y no prueba lo que dice. */
  const core = readFileSync("assets/core.js", "utf8");
  const cuerpo = core.slice(core.indexOf("function pintarTiro"),
                            core.indexOf("function inyectarEstilosStatus"));
  di(/const avance = p\.recibido/.test(cuerpo), "la barra del tiro toma p.recibido");
  di(!/qcs-cy">\$\{fmt\(p\.placed/.test(cuerpo), "y ya NO pinta p.placed");

  const disp = readFileSync("display.html", "utf8");
  di(/dayProgress\(day\)\.recibido/.test(disp), "«Yardas hoy» del Field Display toma recibido");
  di(!/dayProgress\(day\)\.placed/.test(disp), "y ya NO toma placed");
}

console.log(fallos ? `\n${fallos} FALLO(S)\n` : "\nsin fallos\n");
process.exit(fallos ? 1 : 0);
