#!/usr/bin/env node
/* ============================================================
   VERIFICAR — la prueba del proyecto.

   No hay compilación, así que no hay compilador que avise. Esto
   ocupa su lugar: comprueba lo que en este proyecto ha fallado
   de verdad alguna vez, en silencio.

       node verificar.js

   Sale con código 1 si algo está mal, para que sirva en CI.
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const os = require("os");

const raiz = __dirname;
const html = fs.readdirSync(raiz).filter((f) => f.endsWith(".html"));
const js = [
  ...fs.readdirSync(path.join(raiz, "assets")).filter((f) => f.endsWith(".js")).map((f) => "assets/" + f),
  ...fs.readdirSync(path.join(raiz, "shared")).filter((f) => f.endsWith(".js")).map((f) => "shared/" + f),
  "serve.js", "sello.js", "verificar.js",
];

let fallos = 0, avisos = 0;
const mal = (m) => { console.log("  ✕ " + m); fallos++; };
const ojo = (m) => { console.log("  ! " + m); avisos++; };
const bien = (m) => console.log("  ✓ " + m);
const titulo = (t) => console.log("\n" + t);

const leer = (rel) => fs.readFileSync(path.join(raiz, rel), "utf8");

/* ---------- 1. ¿parsea todo el JavaScript? ----------

   Los archivos .js Y **el código que va dentro de las pantallas**. Esto último
   faltaba, y costó caro: el 1 ago 2026 un comentario HTML con acentos graves
   dentro de una plantilla cerró la cadena, el script entero de
   `control-center.html` dejó de parsear, y esta comprobación dijo «sin fallos»
   mientras la pantalla salía en blanco en producción. La mitad del código de
   este proyecto vive dentro del HTML: no mirarlo era mirar a medias. */
titulo("JavaScript");
let malJS = 0;
const revisar = (nombre, codigo) => {
  const tmp = path.join(os.tmpdir(), "qc-check-" + process.pid + ".js");
  fs.writeFileSync(tmp, codigo);
  const r = cp.spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
  fs.unlinkSync(tmp);
  if (r.status !== 0) {
    const linea = (r.stderr || "").split("\n").find((l) => l.includes("Error")) || "";
    mal(`${nombre} no parsea: ${linea.trim()}`);
    malJS++;
  }
};
for (const f of js) revisar(f, leer(f));
let bloques = 0;
for (const f of html) {
  const fuente = leer(f);
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, i = 0;
  while ((m = re.exec(fuente))) {
    if (!m[1].trim()) continue;
    bloques++;
    revisar(`${f} (script ${++i})`, m[1]);
  }
}
if (!malJS) bien(`${js.length} archivos y ${bloques} scripts dentro de pantallas parsean`);

/* ---------- 2. ¿existe todo lo que se referencia? ---------- */
titulo("Referencias");
let refs = 0, rotas = 0;
for (const f of html) {
  const s = leer(f);
  for (const m of s.matchAll(/(?:src|href)="((?!https?:|mailto:|#|data:)[^"]+)"/g)) {
    const rel = m[1].split("?")[0].split("#")[0];
    if (!rel || rel.includes("${")) continue;   // rutas que arma el JavaScript
    refs++;
    if (!fs.existsSync(path.join(raiz, rel))) { mal(`${f} → ${rel} no existe`); rotas++; }
  }
}
if (!rotas) bien(`${refs} referencias, ninguna rota`);

/* ---------- 3. ¿están los sellos al día? ----------
   Si no, se despliega un arreglo y el navegador sigue sirviendo
   el archivo viejo hasta diez minutos. Ya pasó una vez. */
titulo("Sellos de versión");
const antes = html.map((f) => leer(f));
cp.spawnSync(process.execPath, [path.join(raiz, "sello.js")], { cwd: raiz });
const cambiados = html.filter((f, i) => leer(f) !== antes[i]);
if (cambiados.length) mal(`sellos desfasados en: ${cambiados.join(", ")} — se corrigieron, vuelve a commitear`);
else bien("todos los assets llevan el sello de su contenido");

/* ---------- 4. ¿toda clase cols-N usada está definida? ----------
   Una que falte no rompe: deja la rejilla en una columna, callada. */
titulo("Rejillas");
const css = leer("assets/qc.css");
const definidas = new Set([...css.matchAll(/^\.(cols-\d+)/gm)].map((m) => m[1]));
const usadas = new Set();
for (const f of html.concat(["assets/qc.js"]))
  for (const m of leer(f).matchAll(/\bcols-(\d+)\b/g)) usadas.add("cols-" + m[1]);
const huerfanas = [...usadas].filter((c) => !definidas.has(c));
if (huerfanas.length) mal(`usadas y sin definir en qc.css: ${huerfanas.join(", ")}`);
else bien(`${usadas.size} clases de rejilla, todas definidas`);

/* ---------- 5. ¿queda código muerto? ---------- */
titulo("Código muerto");
const fuente = html.concat(js.filter((f) => !f.endsWith("seed.js"))).map(leer).join("\n");
const muertas = [];
for (const f of ["assets/core.js", "assets/qc.js", "assets/usuarios.js",
                 "assets/clima.js", "assets/demo.js"]) {
  for (const m of leer(f).matchAll(/^(?:async )?function ([A-Za-z_]\w*)/gm)) {
    const usos = (fuente.match(new RegExp("\\b" + m[1] + "\\s*\\(", "g")) || []).length;
    if (usos <= 1) muertas.push(`${path.basename(f)}:${m[1]}`);
  }
}
if (muertas.length) ojo(`funciones sin usar: ${muertas.join(", ")}`);
else bien("ninguna función queda sin usar");

/* ---------- 6. ¿el guardián protege lo que debe? ---------- */
titulo("Accesos");
const fallosAntes = fallos;
const auth = leer("assets/auth.js");
for (const p of ["control-center.html", "results.html", "conduce.html", "muestras.html", "reporte.html"])
  if (!auth.includes(p)) mal(`auth.js no protege ${p}`);
const usuarios = leer("assets/usuarios.js");
for (const u of ["admin", "ruben", "invitado"])
  if (!new RegExp("\\b" + u + ":").test(usuarios)) mal(`falta la cuenta ${u}`);
if (fallos === fallosAntes) bien("cinco pantallas de QC protegidas · tres cuentas");

/* ---------- 7. ¿el idioma es el acordado? ---------- */
titulo("Idioma");
const enIngles = [];
for (const f of html) {
  const s = leer(f).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  for (const t of ["Moving Average", "Unit Weight", "Slump", "Control Chart"])
    if (s.includes(t)) { /* correcto: son los términos que van en inglés */ }
  for (const t of ["media móvil", "peso unitario", "revenimiento", "carta de control"])
    if (s.toLowerCase().includes(t)) enIngles.push(`${f}: "${t}" debería ir en inglés`);
}
if (enIngles.length) enIngles.forEach(ojo);
else bien("los términos técnicos van en inglés");

/* ---------- resultado ---------- */
console.log("\n" + "─".repeat(52));
console.log(fallos ? `  ${fallos} fallo(s)` : "  sin fallos");
if (avisos) console.log(`  ${avisos} aviso(s)`);
process.exit(fallos ? 1 : 0);
