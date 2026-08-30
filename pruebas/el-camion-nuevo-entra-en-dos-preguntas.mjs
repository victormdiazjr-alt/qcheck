/* ============================================================
   EL CAMIÓN NUEVO ENTRA EN DOS PREGUNTAS — Q-163.

   Víctor: «desde Muestras que haya un botón de ＋Camión y cuando le das te da
   a escoger… q sea escanear conduce o entrar manual, y escanear sea escanear
   QR o foto de conduce».

       ＋ Camión ─┬─ Escanear conduce ─┬─ Código QR
                  │                    └─ Foto del conduce
                  └─ Entrar manual

   Los dos escalones son suyos y son los correctos: «escanear» es UNA intención
   con dos maneras, no dos opciones sueltas. Poner las tres al mismo nivel
   obliga a elegir la máquina antes que el propósito.

   Antes de esto era una tira siempre puesta debajo de la cabecera: se comía una
   fila de pantalla las veinticuatro horas para algo que pasa quince veces en
   una mañana, y no tenía el QR.

   Lo que se comprueba aquí es lo que no se ve en una captura: que lo leído se
   marca como leído y NO como escrito, y que la pantalla dice qué falta por
   teclear. Es Q-01, y es lo que separa un dato del expediente de una
   suposición.
   ============================================================ */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = readFileSync(join(RAIZ, "muestras.html"), "utf8");
let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };

console.log("\n1 · LOS DOS ESCALONES ESTÁN, Y EN ESE ORDEN");
{
  di(/id="btn-camion"[^>]*onclick="abrirRecibir\(\)"/.test(HTML), "el botón ＋ Camión abre el panel");
  di(/recPaso\('escanear'\)[\s\S]{0,400}?Escanear conduce/.test(HTML) &&
     /recPaso\('campos'\)[\s\S]{0,400}?Entrar manual/.test(HTML),
     "primer escalón: escanear el conduce, o entrar manual");
  di(/recQR\(\)[\s\S]{0,300}?Código QR/.test(HTML) &&
     /id="rec-file"[\s\S]{0,200}?onchange="recFoto\(this\)"/.test(HTML),
     "segundo escalón: el código, o la foto del papel");
  di(HTML.indexOf('id="rec-menu"') < HTML.indexOf('id="rec-escanear"'),
     "y el menú va antes que el escáner, que es el orden de la decisión");
  /* La cámara del iPad, sin pasar por el carrete. */
  di(/id="rec-file"[^>]*capture="environment"/.test(HTML), "la foto abre la cámara trasera directamente");
  /* Y el botón no puede quedarse puesto en un tiro con recepción aparte. */
  di(/b\.hidden = aparte \|\| !vivo/.test(HTML), "y no sale si el tiro tiene Recepción aparte, ni sin tiro");
}

console.log("\n2 · LAS CUATRO CASILLAS SIGUEN LLAMÁNDOSE IGUAL");
{
  /* `recFoto()` y `recibirYMedir()` escriben y leen por id. Cambiar el envoltorio
     no puede cambiarles el suelo: si un id se renombra, el camión entra vacío y
     nadie se entera hasta que se cierra el tiro. */
  for (const id of ["rec-ticket", "rec-truck", "rec-vol", "rec-ident", "rec-aviso"]) {
    di(HTML.includes(`id="${id}"`), `sigue existiendo #${id}`);
  }
}

console.log("\n3 · LO LEÍDO SE MARCA COMO LEÍDO, Y SE DICE QUÉ FALTA");
{
  /* Se corre el trozo de verdad del panel, con un navegador de mentira. */
  const guion = HTML.match(/\/\* ---------- el panel del camión nuevo \(Q-163\) ---------- \*\/[\s\S]*?(?=function recFoto)/)[0];
  const nodos = {};
  const nodo = (id) => (nodos[id] = nodos[id] || {
    id, value: "", hidden: false, textContent: "", className: "", placeholder: "",
    clases: new Set(),
    classList: { add(c) { nodos[id].clases.add(c); }, remove(c) { nodos[id].clases.delete(c); } },
    addEventListener() {},
  });
  const ctx = {
    document: { getElementById: nodo, querySelectorAll: () => [] },
    db: { project: {}, dayMeta: {} },
    diaActivo: () => "2026-08-30",
    testsOfDate: () => [],
    losasDelDia: () => ({ lista: [{ codigo: "L2-0.312", estado: "pendiente" }] }),
    frenoDiaCerrado: () => false,
    recepcionAparte: () => false,
    leerCodigoDeConduce: (raw) => (raw === "malo" ? null
      : { tipo: "campos", campos: { ticket: "69301", truck: "124", vol: 10 } }),
    pedirConduceAQTicket: async () => null,
    pararQR: () => {},
    escanearQR: async () => true,
    recFotoGuardada: null,
  };
  const api = new Function(...Object.keys(ctx),
    "let recLeido = null;\n" + guion + "\n;return { recPaso, abrirRecibir, cerrarRecibir, recCodigo, recRellenar, nodos: null, leido: () => recLeido };"
  )(...Object.values(ctx));

  api.abrirRecibir();
  di(nodos["recibir"].hidden === false, "＋ Camión abre el panel");
  di(nodos["rec-menu"].hidden === false && nodos["rec-campos"].hidden === true,
     "y arranca en la primera pregunta, no en el formulario");
  di(nodos["rec-ident"].placeholder === "ej. L2-0.312",
     `la losa que toca va de PISTA, con «ej.» delante: «${nodos["rec-ident"].placeholder}»`);

  api.recCodigo("{}");
  di(nodos["rec-campos"].hidden === false, "leído el código, se pasa a las casillas");
  di(nodos["rec-ticket"].value === "69301" && nodos["rec-truck"].value === "124",
     "con lo que traía dentro");
  di(nodos["rec-ticket"].clases.has("leido"), "marcado como LEÍDO, no como escrito por alguien (Q-01)");
  di(!nodos["rec-ident"].clases.has("leido") && nodos["rec-ident"].value === "",
     "y la losa, que no venía, se queda en blanco y sin marcar");
  di(/Falta por teclear: losa/.test(nodos["rec-aviso"].textContent),
     `y se dice qué falta: «${nodos["rec-aviso"].textContent}»`);

  api.recCodigo("malo");
  di(/no se entendió/i.test(nodos["rec-aviso"].textContent) &&
     nodos["rec-aviso"].className.includes("mal"),
     "un código que no se entiende se dice, y lleva a teclearlo");

  api.cerrarRecibir();
  di(nodos["recibir"].hidden === true, "y el panel se cierra cuando se cierra");
}

console.log("\n4 · Y EL PANEL SE VA SOLO CUANDO EL CAMIÓN YA ESTÁ DENTRO");
{
  /* Lo que viene después de recibir es MEDIR, y el camión ya queda abierto
     detrás. Dejar el panel puesto tapando la lectura sería un toque de más
     justo cuando el técnico ya tiene el cono en la mano. */
  const tras = HTML.match(/function recibirYMedir\(\)[\s\S]*?\n\}/)[0];
  di(/cerrarRecibir\(\)/.test(tras), "recibirYMedir cierra el panel al terminar");
  di(/state\.n = t\.n/.test(tras), "y deja el camión abierto para medirlo");
  di(!/rec-aviso/.test(tras), "el «recibido» se dice por el aviso de la pantalla, no dentro de un panel que ya no está");
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
