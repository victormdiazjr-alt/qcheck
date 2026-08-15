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

console.log("\nEL LECTOR ESCRIBE SIEMPRE EN SUS CASILLAS");
di(/function limpiarCasillasDelLector\(\)/.test(html), "se vacían antes de leer");
di(/limpiarCasillasDelLector\(\);\n\s*const img = new Image/.test(html) ||
   /if \(!file\) return;\s*\n\s*limpiarCasillasDelLector\(\);/.test(html),
   "y se vacían ya al escoger la foto, no al contestar el servidor");
di(/if \(!yaVacias\) limpiarCasillasDelLector\(\);/.test(html),
   "y la garantía es del lector, no de quien lo llame");

console.log("\nPERO NO SE PIERDE LO QUE EL PAPEL NO TRAE");
di(/let valoresAntesDeEscanear = \{\};/.test(html), "se guarda lo que había antes de vaciar");
di(/if \(previos\[id\]\) \{ el\.value = previos\[id\]; devueltos\.push\(nombre\); \}/.test(html),
   "y vuelve a su sitio si la foto no lo trae");
di(/no ven\\u00eda/.test(html) && /se qued\\u00f3 lo que hab\\u00eda/.test(html), "diciéndolo");

console.log("\nY LO QUE EL PAPEL CAMBIA SE DICE");
di(/reemplazados\.push/.test(html), "se apunta lo que el papel pisó");
di(/OJO \\u2014 el papel cambi\\u00f3 /.test(html), "y se avisa con los dos números");
di(/No se pudo leer ning\\u00fan campo con seguridad/.test(html), "y el «no se pudo leer», solo cuando es verdad");

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
