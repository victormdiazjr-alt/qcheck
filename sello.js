#!/usr/bin/env node
/* ============================================================
   SELLO DE VERSIÓN — contra el caché del navegador.

   GitHub Pages sirve los .js y .css con `cache-control: max-age=600`.
   Diez minutos en los que un navegador que ya tenía la página sigue
   usando el archivo viejo: se despliega un arreglo y el usuario ve el
   fallo de antes. En una demostración eso es un desastre.

   Esto le pone a cada referencia un sello sacado del CONTENIDO del
   archivo: `assets/core.js?v=a3f19c2b`. Mientras el archivo no cambie,
   la dirección no cambia y el caché sigue sirviendo — que es lo que se
   quiere. En cuanto cambia, la dirección cambia y el navegador está
   obligado a bajarlo.

   Se corre ANTES de cada commit que toque assets/ o shared/:

       node sello.js

   Es idempotente: correrlo dos veces no hace nada la segunda.
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const raiz = __dirname;
const REF = /(src|href)="((?:assets|shared)\/[^"?]+\.(?:js|css))(\?v=[^"]*)?"/g;

function sello(rel) {
  const abs = path.join(raiz, rel);
  if (!fs.existsSync(abs)) return null;
  return crypto.createHash("md5").update(fs.readFileSync(abs)).digest("hex").slice(0, 8);
}

let tocados = 0, referencias = 0;
for (const f of fs.readdirSync(raiz).filter((x) => x.endsWith(".html"))) {
  const abs = path.join(raiz, f);
  const antes = fs.readFileSync(abs, "utf8");
  const despues = antes.replace(REF, (todo, attr, rel) => {
    const v = sello(rel);
    if (!v) { console.warn(`  ! ${f}: no existe ${rel}`); return todo; }
    referencias++;
    return `${attr}="${rel}?v=${v}"`;
  });
  if (despues !== antes) { fs.writeFileSync(abs, despues); tocados++; console.log("  sellado", f); }
}
console.log(`${referencias} referencias · ${tocados} archivo(s) modificado(s)`);
