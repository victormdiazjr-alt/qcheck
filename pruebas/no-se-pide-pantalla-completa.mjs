/* Q-106 · Nadie pide pantalla completa al tocar, y la aplicación entera está
   preparada para arrancar sin barras desde la pantalla de inicio de iOS. */
import { readFileSync, readdirSync } from "node:fs";

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };
const pantallas = readdirSync(".").filter((f) => f.endsWith(".html") && f !== "guia-campo.html");

console.log("\nNADIE PIDE PANTALLA COMPLETA AL TOCAR");
{
  const culpables = [];
  for (const f of [...pantallas, "assets/core.js"]) {
    const s = readFileSync(f, "utf8")
      /* Los comentarios cuentan la historia y NO son código: si contaran, esta
         prueba se pondría roja por el propio texto que explica el arreglo. */
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");
    /* Se buscan las DOS cosas: la API y los nombres de las funciones que la
       envolvían. Con solo la API, esta prueba dio verde con un `goFullscreen()`
       vivo apuntando a una función ya borrada — verde por mirar donde no era. */
    if (/requestFullscreen|webkitRequestFullscreen|goFullscreen|pantallaCompletaAlTocar|acostarPantalla/.test(s))
      culpables.push(f);
  }
  di(culpables.length === 0, culpables.length ? `todavía piden: ${culpables.join(", ")}` : "ninguna pantalla lo pide");
  const core = readFileSync("assets/core.js", "utf8");
  di(!/function pantallaCompletaAlTocar/.test(core), "la función se borró, no se dejó apagada");
  di(!/function acostarPantalla/.test(core), "y la de acostar la pantalla también");
}

console.log("\nY TODAS ARRANCAN SIN BARRAS DESDE LA PANTALLA DE INICIO");
{
  const faltan = pantallas.filter((f) => {
    const s = readFileSync(f, "utf8");
    return !/apple-mobile-web-app-capable"\s+content="yes"/.test(s) || !/rel="manifest"/.test(s);
  });
  di(faltan.length === 0, faltan.length ? `sin etiquetas: ${faltan.join(", ")}` : `las ${pantallas.length} pantallas llevan sus etiquetas`);
  const m = JSON.parse(readFileSync("manifest.webmanifest", "utf8"));
  di(m.display === "standalone", `el manifiesto dice «${m.display}»`);
}

console.log("\nY EL AVISO DE GIRAR EL TELÉFONO SE QUEDA");
di(/Gire el tel/.test(readFileSync("display.html", "utf8")),
   "eso no era pantalla completa: era decirle a una persona qué hacer");

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
