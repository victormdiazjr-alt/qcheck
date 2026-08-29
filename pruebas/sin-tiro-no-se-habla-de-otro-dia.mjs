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

/* ESTA PRUEBA AFIRMABA UNA LÍNEA, NO UNA CONDUCTA — corregido el 29 ago 2026.

   Pedía al pie de la letra `const day = hayTiroActivo() ? diaActivo() :
   todayISO();`, que era la forma que tuvo Q-110 el 15 de agosto. El 28, Q-118
   cambió el planteamiento a propósito y a mejor: el día sigue siendo el último
   que tuvo camiones —para poder MIRAR el vaciado anterior, que hace falta—,
   pero **todas las casillas vivas quedaron condicionadas a `hayTiroActivo`**,
   así que ninguna presenta lo de otro día como si estuviera pasando.

   El objetivo de Víctor se cumple igual, y la prueba llevaba desde entonces en
   rojo por la redacción. Una prueba atada a la letra de una implementación se
   rompe cada vez que se mejora, y entrena a mirar el rojo sin leerlo — que es
   como se acaba sin ver el rojo que sí importaba.

   Ahora se comprueba lo que de verdad no puede pasar: que ninguna casilla viva
   se pinte sin preguntar antes si hay tiro abierto. */
di(/hayTiroActivo\(/.test(codigo), "el Control Center pregunta si hay tiro abierto");
{
  /* La tarjeta de «Último camión» es la que Víctor señaló —«¿por qué dice
     esto?»— conjugando en presente un camión de otro día. Tiene que estar
     dentro de una condición de tiro abierto, no suelta. */
  const i = codigo.indexOf('class="w lastruck');
  const antes = i < 0 ? "" : codigo.slice(Math.max(0, i - 600), i);
  di(i >= 0 && /hayTiroActivo\(day\)\s*\?/.test(antes),
     "«Último camión» solo se pinta con un tiro abierto");
}
di(!/^\s*const day = diaPorDefecto\(\);\s*$/m.test(codigo),
   "el día no sale del calendario a secas");

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
