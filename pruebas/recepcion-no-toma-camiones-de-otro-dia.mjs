/* Q-107 · Recepción enseña los camiones de ESTE tiro. Si no hay, no hay.
   Víctor, con el tiro de hoy abierto: «está saliendo un camión en el tiro de
   hoy en Recepción, de 8.5, del tiro de ayer». */
import { readFileSync } from "node:fs";

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };
const html = readFileSync("conduce.html", "utf8");
const codigo = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");

console.log("\nRECEPCIÓN NO TOMA PRESTADOS CAMIONES DE OTRO DÍA");
di(/const shown = day;/.test(codigo), "lo que se enseña es el tiro activo, y nada más");
di(!/testsOfDate\(day\)\.length \? day :/.test(codigo),
   "ya no hay respaldo que caiga en el último día con camiones");
di(!/const days = diasDelProyecto\(\)/.test(codigo),
   "y no queda la variable que solo servía para eso");

console.log("\nY EL HUECO SIGUE DICIENDO QUÉ HACER");
di(/Ning[uú]n cami[oó]n registrado hoy/.test(html),
   "«Ningún camión registrado hoy. Escanee el primer conduce al llegar»");

console.log("\nEL CONTADOR DEL PRÓXIMO CAMIÓN CUENTA LOS DE HOY");
di(/testsOfDate\(day\)\.length \+ 1/.test(codigo),
   "«Camión #N» sale del tiro activo, no del día prestado");

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
