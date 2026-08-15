/* Q-118 · «No se pudo leer» solo cuando de verdad no se leyó.

   16 ago 2026, con un tiro corriendo. El técnico llevaba tres camiones bien y
   en el cuarto le salió «No se pudo leer ningún campo con seguridad». El
   servidor estaba sano y la foto era buena: los campos YA tenían valor, el
   lector no pisó ninguno, el contador se quedó en 0 y la pantalla lo llamó
   fallo de lectura.

   Un contador que baja por dos motivos distintos no dice nada. Aquí se
   comprueba que hay tres cuentas separadas y que cada una habla distinto. */
import { readFileSync } from "node:fs";

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };
const html = readFileSync("conduce.html", "utf8");

console.log("\nEL LECTOR DISTINGUE LO QUE LE PASA");
di(/const yaIguales = \[\], enConflicto = \[\];/.test(html), "lleva las tres cuentas por separado");
di(/if \(el\.value\) \{[\s\S]{0,400}?yaIguales\.push/.test(html), "un campo ya puesto no cuenta como ilegible");
di(/continue;\s*\/\/ lo que escribió una persona no se pisa/.test(html), "y lo que escribió una persona se sigue sin pisar");

console.log("\nY CADA CASO SE DICE CON SUS PALABRAS");
di(/ya estaban puestos y coinciden con la foto/.test(html), "ya estaba puesto e igual");
di(/OJO — la foto dice otra cosa en/.test(html), "ya estaba puesto y DISTINTO — que antes se callaba");
di(/No he tocado lo tuyo\. Mira el papel y decide/.test(html), "sin pisarlo, y diciendo quién decide");
di(/Solo AQUÍ es verdad que no se leyó nada/.test(html), "y el «no se pudo leer», solo cuando es verdad");

console.log("\nEL CONFLICTO LLEGA HASTA LA REVISIÓN DE REGISTRAR");
di(/enConflicto\.forEach\(\(x\) => \{ leidoDeLaFoto\[x\.id\] = x\.papel; \}\)/.test(html),
   "lo que decía el papel se guarda para enseñarlo");
di(/` · la foto decía \$\{esc\(dePapel\)\}`/.test(html), "y el panel dice qué decía la foto, no solo que cambió");

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
