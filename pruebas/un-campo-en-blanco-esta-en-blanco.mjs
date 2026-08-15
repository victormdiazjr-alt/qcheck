/* UN CAMPO EN BLANCO ESTÁ EN BLANCO — Q-116, 15 de agosto de 2026.

   Víctor: «los campos en toda el app cuando estén en blanco q estén realmente
   vacíos. y los q sean códigos o nomenclaturas que tengan una sugerencia pero
   bien clarito.»

   Dos cosas distintas, y las dos se comprueban aquí:

     · Ningún campo llega con un VALOR que no escribió nadie. Ese fue el
       `value="10"` de Q-91 y el volumen heredado de Q-93, y por ahí entraron
       los dos camiones fantasma con yardas prestadas de Q-101.
     · La pista que sí se deja —la forma de un código— no se puede confundir
       con un valor: lleva «ej.» delante y va en cursiva y apagada.

   Se mira el HTML tal cual, sin navegador, porque lo que falla aquí es lo que
   está ESCRITO en el fichero. */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
let fallos = 0;
const di = (ok, q) => { console.log(`  ${ok ? "✓" : "✗"} ${q}`); if (!ok) fallos++; };

const pantallas = readdirSync(raiz).filter((f) => f.endsWith(".html"));

console.log("\nNADIE LLEGA CON UN VALOR QUE NO ESCRIBIÓ NADIE");
{
  const malos = [];
  for (const f of pantallas) {
    const html = readFileSync(join(raiz, f), "utf8");
    for (const m of html.matchAll(/<input\b[^>]*>/g)) {
      const et = m[0];
      if (/type=["']?(checkbox|radio|hidden|submit|button)/.test(et)) continue;
      const v = et.match(/\svalue="([^"]*)"/);
      // `value="${...}"` es un dato de verdad que la pantalla vuelve a pintar.
      if (v && v[1] && !v[1].includes("${")) malos.push(`${f}: ${v[1]}`);
    }
  }
  di(malos.length === 0, malos.length ? `campos con valor de fábrica — ${malos.join(", ")}` : "ningún campo trae valor de fábrica");
}
{
  const html = readFileSync(join(raiz, "conduce.html"), "utf8");
  di(!/v\.value = ult\.vol/.test(html), "el volumen del camión anterior no se escribe solo");
  di(/v\.placeholder = `ej\. \$\{ult\.vol\}/.test(html), "se sugiere como pista, que sí se puede dejar en blanco");
  di(!/classList\.add\("heredado"\)/.test(html) && !/input\.heredado/.test(html),
     "y no queda nada de la herencia vieja");
}

console.log("\nUNA PISTA NO SE PARECE A UN VALOR");
{
  const malas = [];
  for (const f of pantallas) {
    const html = readFileSync(join(raiz, f), "utf8");
    for (const m of html.matchAll(/placeholder="([^"]*)"/g)) {
      const t = m[1];
      if (!t || t.includes("${") || t.startsWith("ej.")) continue;
      // Una frase que manda hacer algo se entiende sola: «pega aquí la llave».
      // Lo que no vale es un dato suelto, que se lee como si ya estuviera puesto.
      if (/^[\w.\-/:]+$/.test(t) || t === "—") malas.push(`${f}: ${t}`);
    }
  }
  di(malas.length === 0, malas.length ? `pistas que parecen valores — ${malas.join(", ")}` : "todas las pistas se leen como pistas");
}
{
  /* Y las que NO están en el HTML: las que la pantalla escribe sola. Son las
     que más engañan —el número que sigue al del último conduce llevaba la
     pinta exacta de un conduce de verdad— y no las ve el barrido de arriba. */
  const malas = [];
  for (const f of [...pantallas.map((f) => [f, join(raiz, f)]),
                   ["assets/core.js", join(raiz, "assets/core.js")],
                   ["assets/qc.js", join(raiz, "assets/qc.js")]]) {
    for (const m of readFileSync(f[1], "utf8").matchAll(/\.placeholder = ([^;\n]+);/g)) {
      const v = m[1].trim();
      if (v === '""' || /ej\./.test(v)) continue;
      malas.push(`${f[0]}: ${v.slice(0, 46)}`);
    }
  }
  di(malas.length === 0, malas.length ? `pistas puestas en marcha sin «ej.» — ${malas.join(" | ")}` : "también las que la pantalla escribe sola");
}
{
  const css = readFileSync(join(raiz, "assets/qc.css"), "utf8");
  di(/input::placeholder[^}]*font-style: italic/.test(css), "y van en cursiva en la hoja compartida");
  // Solo las que tienen campos: una pantalla de solo lectura no necesita regla.
  const propias = pantallas.filter((f) => {
    const t = readFileSync(join(raiz, f), "utf8");
    return !t.includes("qc.css") && /<input\b|<textarea\b/.test(t);
  });
  const sin = propias.filter((f) => !readFileSync(join(raiz, f), "utf8").includes("::placeholder"));
  di(sin.length === 0, sin.length ? `pantallas de hoja propia sin la regla: ${sin.join(", ")}` : "y también en las de hoja propia");
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
