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

/* ---------- 4b. clases de armazón que no existen ----------

   El 7 ago 2026 se colaron tres `<section class="card">` en pantallas que
   comparten qc.css, donde `.card` no está definida en ninguna parte: los
   paneles salían sin marco, sin fondo y sin aire, y en una pantalla oscura eso
   no canta — parece una decisión de diseño. Se mira solo el puñado de clases
   que arman una caja, que son las que dejan la pantalla rota sin avisar; el
   resto puede ser dinámico y no se toca. Q-52. */
titulo("Armazón");
const ARMAZON = ["card", "panel", "panel-head", "panel-body", "w", "grid", "tbl", "data", "btn"];
/* `table.data` va calificada por elemento, así que el punto puede venir
   pegado a un nombre de etiqueta y no solo a un espacio o una coma. */
const enCSS = (c) => new RegExp("(^|[,\\s])[\\w-]*\\." + c + "\\b", "m").test(css);
const sinDefinir = new Set();
for (const f of html.concat(["assets/qc.js", "assets/core.js"])) {
  const src = leer(f);
  /* Las páginas sueltas —acceso, conectar— llevan su propio <style>. */
  const propio = src.includes("<style");
  for (const m of src.matchAll(/class="([^"$]+)"/g))
    for (const c of m[1].split(/\s+/))
      if (ARMAZON.includes(c) && !enCSS(c) && !(propio && new RegExp("\\." + c + "\\b").test(src)))
        sinDefinir.add(`${path.basename(f)}: .${c}`);
}
if (sinDefinir.size) mal(`clases de armazón usadas y sin definir: ${[...sinDefinir].join(", ")}`);
else bien("las clases que arman las cajas están todas definidas");

/* ---------- 4c. la SP-934 no se le enseña a nadie todavía ----------

   Víctor, 8 ago 2026: «qcheck debe seguir funcionando igual para Rubén y el
   técnico». Eso deja de ser una promesa que hay que recordar y pasa a ser algo
   que falla solo si se rompe.

   Dos cosas: que toda pantalla que cargue `sp934.js` esté en la lista de obras
   de `auth.js`, y que **ninguna pantalla enlace a ellas**. Un enlace es una
   puerta aunque la pantalla del otro lado eche a quien no toca. */
titulo("SP-934 en obras");
const authSrc = leer("assets/auth.js");
const enObras = (authSrc.match(/EN_OBRAS_934 = \[([^\]]*)\]/) || [, ""])[1]
  .split(",").map((s) => s.trim().replace(/["']/g, "")).filter(Boolean);
/* Una pantalla que usa la aritmética de la 934 tiene que estar en una de dos
   situaciones, y no hay una tercera:

     · **en obras**, si trabaja sobre el expediente real, o
     · **de demostración**, si carga `sim934.js` — que es la prueba de que sus
       datos son inventados y de que no toca `db`.

   La segunda puede verla cualquiera: no hay nada que proteger en unos datos
   que no existen. Q-68. */
const pantallas934 = html.filter((f) => leer(f).includes("sp934.js"));
/* SETTINGS ES LA EXCEPCIÓN, Y A PROPÓSITO — Q-61, 10 de agosto de 2026.

   Las tres pantallas de la 934 —934, lotes, aceptación— siguen en obras: son
   las que JUZGAN, y media función que juzga es peor que ninguna.

   Settings no juzga: es donde Rubén DECLARA la clase, el nivel de permeabilidad
   y el Unit Weight objetivo de su obra. Sin eso no puede trabajar, porque no
   tiene Plan & Datos. Dejarlo detrás del candado significaba que el ingeniero
   de récord tenía que pedirle a Víctor el dato que decide el 45 % de su pago. */
const declaran = ["settings.html"];
const problemas = [];
for (const f of pantallas934) {
  const b = path.basename(f);
  const esDemo = leer(f).includes("sim934.js");
  if (!enObras.includes(b) && !esDemo && !declaran.includes(b))
    problemas.push(`${f} usa sp934.js sobre datos reales y no está en EN_OBRAS_934`);
  if (enObras.includes(b) && esDemo)
    problemas.push(`${f} es de demostración y está en EN_OBRAS_934 — sobra la puerta`);
}
for (const f of html) {
  /* Entre pantallas de la 934 sí se enlazan: viven todas tras la misma puerta,
     así que un enlace de una a otra no abre nada. Lo que no puede pasar es que
     una pantalla VIVA enlace a una en obras. */
  if (enObras.includes(path.basename(f))) continue;
  const src = leer(f);
  /* Con `includes` a secas, «934.html» casaba dentro de «sim934.html» y de
     «demo934.html». Es la tercera vez que un candado de este archivo se
     equivoca por buscar un trozo de palabra en vez de la palabra: pasó con
     `lot` dentro de `lotes` (Q-59) y con `plant` (Q-56).

     **Aquí ya no se busca texto: se busca una referencia a un archivo**, con
     el borde delante. Q-68. */
  for (const p of enObras) {
    const ref = new RegExp("(^|[^a-zA-Z0-9_.-])" + p.replace(".", "\\."));
    if (ref.test(src)) problemas.push(`${f} enlaza a ${p}, que no puede abrir`);
  }
}
if (problemas.length) problemas.forEach((s) => mal(s));
else bien(`${pantallas934.length} pantalla(s) de la 934, todas tras qcVeConfig() y sin enlazar`);

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
if (!auth.includes("settings.html")) mal("auth.js no protege settings.html");
const usuarios = leer("assets/usuarios.js");
const CUENTAS = ["admin", "ruben", "invitado", "concretero", "contratista", "autoridad"];
for (const u of CUENTAS)
  if (!new RegExp("\\b" + u + ":").test(usuarios)) mal(`falta la cuenta ${u}`);
/* Las tres de fuera tienen que tener casa: sin `casa` entrarían al portal y
   verían la navegación entera, que es justo lo que Q-37 vino a quitar. */
for (const u of ["concretero", "contratista", "autoridad"])
  if (!new RegExp("\\b" + u + ":[^}]*casa:").test(usuarios)) mal(`la cuenta ${u} no tiene casa`);
if (fallos === fallosAntes) bien(`seis pantallas de QC protegidas · ${CUENTAS.length} cuentas, tres con casa`);

/* ---------- 7. ¿se cuela dato de persona en el HTML sin escapar? ----------

   LA RAÍZ: estas pantallas arman HTML con plantillas de texto, y por ellas
   pasan campos que teclea una persona — número de camión, de ticket,
   identificación de losa, comentarios. Escribir `${t.truck}` en vez de
   `${esc(t.truck)}` no da ningún error: funciona perfectamente hasta el día
   que un valor lleva un `<`, y entonces el navegador se lo come como
   etiqueta.

   PASÓ DE VERDAD el 6 ago 2026, auditando: un camión llamado `A<b>&"X` metió
   doce elementos dentro de los SVG de Producción y fusionó dos etiquetas de
   punto en una. La gráfica seguía dibujándose, así que no habría saltado
   ninguna alarma — solo habría enseñado mal.

   No es cosa de un atacante: es la letra que se cuela al teclear con guantes,
   o lo que el lector de conduce (Q-01) proponga de una foto borrosa.

   POR ESO ESTO ESTÁ AQUÍ: pillarlo antes de subirlo, que es la única forma
   de que no vuelva. Si añades un campo que escribe una persona, métele
   `esc()` o añádelo a la lista. */
titulo("Escapado");
/* Los nombres van con frontera de palabra: sin ella, `lot` casaba dentro de
   «lotes» y «sublotes» y la comprobación gritaba por números que no puede
   escribir nadie. Un candado que da falsos positivos se acaba desactivando,
   y entonces deja de proteger. Q-59. */
const CAMPOS_DE_PERSONA = /\b(truck|ticket|ident|comments|plant|lot|company|mixId|nombre|contractor|qcFirm|notifyEmails|name|dev|usr|mix|mezcla|clase|motivo)\b/;
/* `.length` y `.size` son números y no pueden llevar HTML jamás. */
const NUMERO_SEGURO = /\.(length|size)\s*$/;
const YA_SEGURO = /\b(esc|fmt|num|Number|Math\.|encodeURI|encodeURIComponent|JSON\.stringify)\s*\(/;
const sinEscapar = [];
for (const f of [...html, "assets/core.js", "assets/qc.js", "assets/clima.js", "assets/sync.js"]) {
  if (!fs.existsSync(path.join(raiz, f))) continue;
  const lineas = leer(f).split("\n");
  lineas.forEach((linea, i) => {
    if (!(linea.includes("<") && linea.includes(">"))) return;   // solo donde se arma HTML
    for (const m of linea.matchAll(/\$\{([^{}]+)\}/g)) {
      const e = m[1].trim();
      if (YA_SEGURO.test(e) || NUMERO_SEGURO.test(e) || !CAMPOS_DE_PERSONA.test(e)) continue;
      if (/^[^?]*\?\s*"[^"]*"\s*:\s*"[^"]*"$/.test(e)) continue;  // ternario de literales
      sinEscapar.push(`${f}:${i + 1} → \${${e.slice(0, 50)}}`);
    }
  });
}
if (sinEscapar.length) sinEscapar.forEach((s) => mal(`dato de persona sin esc(): ${s}`));
else bien("ningún dato tecleado entra al HTML sin escapar");

/* ---------- 8. ¿el idioma es el acordado? ---------- */
titulo("Idioma");
/* ANTES SE SALTABA LO QUE VA DENTRO DE `<script>`, y ahí es donde vive casi
   todo el texto que ve el usuario: las pantallas modernas de QCheck arman su
   HTML en JavaScript. La comprobación pasaba en verde sobre archivos que no
   miraba. Se quitan los COMENTARIOS —donde sí se escribe en castellano a
   propósito— y se mira el resto. Q-70, 8 ago 2026. */
const enIngles = [];
for (const f of html.concat(["assets/qc.js", "assets/core.js", "assets/sp934.js", "assets/sim934.js"])) {
  if (!fs.existsSync(path.join(raiz, f))) continue;
  const s = leer(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")      // comentarios de bloque
    .replace(/^\s*\/\/.*$/gm, "")           // comentarios de línea
    .replace(/<!--[\s\S]*?-->/g, "");
  /* Los términos de la SP-934 también se dicen en inglés en obra y en el
     papeleo de la Autoridad: nadie dice «porcentaje dentro de límites», dicen
     PWL. Traducirlos aleja el programa del idioma del oficio. Q-70. */
  /* «Resistencia a compresión» NO está en esta lista, y estuvo un rato. La
     casa lleva años diciéndolo así en `reporte.html`, que es un documento que
     se firma y se archiva. Cambiar el texto de un papel firmado por un
     criterio recién inventado es exactamente lo que no se hace: la regla se
     escribió después que el documento, así que manda el documento. */
  for (const t of ["media móvil", "peso unitario", "revenimiento", "carta de control",
                   "porcentaje dentro de límites", "factor de ajuste de precio",
                   "peso volumétrico"])
    if (s.toLowerCase().includes(t)) enIngles.push(`${f}: "${t}" debería ir en inglés`);
}
if (enIngles.length) enIngles.forEach(ojo);
else bien("los términos técnicos van en inglés");

/* ---------- resultado ---------- */
console.log("\n" + "─".repeat(52));
console.log(fallos ? `  ${fallos} fallo(s)` : "  sin fallos");
if (avisos) console.log(`  ${avisos} aviso(s)`);
process.exit(fallos ? 1 : 0);
