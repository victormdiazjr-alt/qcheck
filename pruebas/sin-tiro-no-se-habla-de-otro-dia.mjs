/* Q-110 · Sin tiro abierto, el Control Center no cuenta lo de otro día.
   Víctor lo vio tres veces seguidas y siempre por otra casilla: el avance del
   tiro, el aviso de yardas, y «Último camión 209 · Ticket 1917 · En pruebas».
   Las tres del vaciado de otro día, enseñadas como si estuvieran pasando. */
import { readFileSync } from "node:fs";

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };
const cc = readFileSync("control-center.html", "utf8");
const codigo = cc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");

console.log("\nLA RAÍZ: DE DÓNDE SALE EL DÍA DE LA PANTALLA");
di(/const day = hayTiroActivo\(\) \? diaActivo\(\) : todayISO\(\);/.test(codigo),
   "sin tiro abierto el día es HOY, no el último con datos");
di(!/const day = diaPorDefecto\(\);/.test(codigo),
   "ya no cae en el último día que tuvo camiones");

console.log("\nY ESO APAGA LAS NUEVE CASILLAS DE UNA VEZ");
{
  /* Se cuentan para que quede escrito cuántas dependían de ese día: si mañana
     alguien vuelve a poner `diaPorDefecto()`, vuelven las nueve, no una. */
  const usos = (codigo.match(/\(day\)/g) || []).length;
  di(usos >= 8, `${usos} casillas beben del mismo día`);
}

console.log("\nEL WIDGET DE HUMEDAD DE PLANTA SE FUE — Víctor, 15 ago");
di(!/Humedad de planta/.test(cc), "no queda en la pantalla");
di(!/const h = lastHumidity\(day\)/.test(codigo), "ni la variable que lo alimentaba");

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
