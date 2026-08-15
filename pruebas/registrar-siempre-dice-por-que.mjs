/* Q-114 · Si no se registra un camión, la pantalla dice por qué.
   Víctor: «el técnico escaneó un conduce, le da a registrar, no hace nada, y se
   abre el teclado del iPad». */
import { readFileSync } from "node:fs";

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };
const html = readFileSync("conduce.html", "utf8");
const cuerpo = html.slice(html.indexOf("function saveArrival"),
                          html.indexOf("function saveArrival") + 9000);
const codigo = cuerpo.replace(/\/\*[\s\S]*?\*\//g, "");

console.log("\nNINGUNA SALIDA DEJA LA PANTALLA MUDA");
{
  /* Se cuentan los `return` de saveArrival que no pasan por `noSeRegistra` ni
     por un `toast`. Un `focus()` a secas es justo lo que se veía como «el
     botón no hace nada». */
  const lineas = codigo.split("\n");
  const mudas = [];
  lineas.forEach((l, i) => {
    if (!/^\s*return;\s*$/.test(l)) return;
    const antes = lineas.slice(Math.max(0, i - 6), i).join("\n");
    if (/noSeRegistra|toast\(|frenoDiaCerrado|programarTiro|formDayMeta/.test(antes)) return;
    mudas.push(i + 1);
  });
  di(mudas.length === 0, mudas.length ? `salidas mudas en las líneas ${mudas.join(", ")}` : "todas explican o avisan");
}

console.log("\nY EL MOTIVO SE ESCRIBE DONDE NO SE BORRA AL TOCAR");
di(/function noSeRegistra\(motivo, campo\)/.test(html), "hay un solo sitio que lo escribe");
di(/a\.style\.display = "block"/.test(html), "y lo deja visible en la pantalla, no en un cartel");

console.log("\nLOS TRES MOTIVOS ESTÁN DICHOS CON PALABRAS");
di(/No se registró: falta el número de conduce o el del camión/.test(html), "sin conduce ni camión");
/* Q-117: lo leído ya no se acepta con un `confirm()` del navegador — se enseña
   entero en la pantalla al dar a Registrar, y hasta que no se diga que está
   bien no se guarda nada. */
/* Q-120: ya no hay paso de confirmación que comprobar. El lector escribe en
   las casillas y Registrar registra — Víctor, 16 ago: «si la lectura la hace
   bien que la escriba en los campos y al presionar registrar quede
   registrado». Lo que queda por comprobar es que no volvió a colarse ninguno. */
di(!/revisar-lectura/.test(html), "no hay ventana de confirmación en medio");
/* Los `confirm()` que quedan son de obra y se quedan: no hay tiro abierto, y
   el camión va fuera de límites. Lo que no puede volver es uno para aceptar lo
   que leyó la foto. */
/* Literal, y no una regla ancha: `/confirm\([^)]*leíd/` enganchaba
   `ordenadasLeidas` dentro del aviso de que el conduce no cuadra con el tiro
   —que es de obra y se queda—, y daba el fallo por bueno donde no lo había. */
di(!/Estos datos los leyó el sistema/.test(html) && !/Compara con el papel antes de registrar/.test(html),
   "ni una ventana para aceptar lo que leyó la foto");

di(/No se registró: " \+ \(\(typeof porQueNoSeSomete/.test(html), "y sin poder firmar en el servidor, con su motivo");

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
