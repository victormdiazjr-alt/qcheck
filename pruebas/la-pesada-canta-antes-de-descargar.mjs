/* ============================================================
   LA PESADA CANTA ANTES DE DESCARGAR — Q-159.

   Víctor: «es la evidencia de las proporciones de materiales y es una data
   bien útil para tú rápidamente numéricamente detectar anomalías desde antes
   de descargar el camión».

   Y, el mismo día: «el submittal lo tiene Rubén también».

   Esa segunda frase es la que gobierna esta prueba. El diseño de mezcla
   aprobado NO está, y no se sabe cuándo estará. Así que lo que aquí se
   comprueba es que **todo lo importante funciona sin él**: la pesada trae su
   propio objetivo por material, la reserva de agua viene impresa, y los demás
   camiones del tiro dicen cuál es lo normal.

   El texto de abajo es el del camión 116 del 29 de agosto de 2026, copiado del
   papel. No es un ejemplo inventado: si el lector deja de entenderlo, es que
   dejó de entender los papeles que llegan a la obra.
   ============================================================ */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = createRequire(import.meta.url)(join(RAIZ, "assets/pesada.js"));

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };
const cerca = (a, b, e) => a != null && Math.abs(a - b) <= e;

/* El camión 116 — Concre-Tech, planta de San Juan, 29 ago 2026, 06:50. */
const CAMION_116 = `
Job:      #28489    Date: Aug 29,26  Time:06:44/06:50  Plant:SJU Ref#:155918
ULink Tkt: 69298    Load Time: 5:55  Operator: GERARDO
Truck:    116       Driver:   HIRAN CASTRO
Client:   DELVA100  Client Name: DEL VALLE GROUP, INC.
Mix:      AC300503SX* Name: 3000 PSI @ 5 DAYS REG SP,
Amount:   10.00 CY  In Truck: 0.00 CY
Delivered: 40.00 CY Loads: 4
Site:     SAN JUAN-TRUJILLO ALTO-CAGUAS,AC-230061 PAVEMENT,RECONSTRUCTION PR-
Note:

Material              Bin Moist/SSD Design/LSU  Target  Actual *Note Jogs Time(s)
PIEDRA 3/4 SA          4 0.00/0.00%  1700/1700   17000   16940 Lb ------  6  14+30
ARENA NAT. ORIENTAL    3 3.50/0.00%  1419/1419   14687   14620 Lb ------  3  13+13
CEMENTO*01             1              650/650     6500    6520 Lb ------     40 (100%)
WR75                   3             7.00/7.00     455     454 Oz ------    107
STASIS                 1             2.00/2.00     130     129 Oz ------     35
WATER                                34.00/34.00  250.4   249.0 Ga -----     71
Tare(Start,End): Agg(40,50), Cem(-5,10)Lb
Scale discharge: Agg=266s, Cem=101s
Slump: 3.00
Total moisture:                                    59.4 Ga
Water available to add: 30.0 Ga
Water/Cement: 0.394     Water/CY: 30.8 Ga   Yield: 9.94
`;

console.log("\n1 · EL PAPEL DE VERDAD SE LEE ENTERO");
const p = P.parsearPesada(CAMION_116);
{
  di(!!p, "se reconoce como pesada");
  di(p.planta === "SJU", `la planta, que era la pregunta para Rubén: ${p.planta}`);
  di(p.ticket === "69298", `y el número de conduce que la une a su camión: ULink Tkt ${p.ticket}`);
  di(p.camion === "116" && p.mezcla === "AC300503SX", `camión ${p.camion}, mezcla ${p.mezcla}`);
  di(p.cy === 10 && p.reserva === 30, `${p.cy} CY con ${p.reserva} gal reservados para la obra`);

  const m = P.pesadaMateriales(p);
  di(m.length === 6, `los seis materiales: ${m.map((x) => x.nombre).join(", ")}`);
  /* El nombre lleva un «3/4» dentro. Leer de izquierda a derecha lo partía. */
  di(m[0].nombre === "PIEDRA 3/4 SA", `el nombre no se parte por el 3/4: «${m[0].nombre}»`);
  di(m[1].nombre === "ARENA NAT. ORIENTAL", `ni por los espacios: «${m[1].nombre}»`);
  di(m[0].target === 17000 && m[0].actual === 16940, "objetivo y real de la piedra");
  di(m[1].humedad === 3.5, `y la humedad de la arena, que es agua escondida: ${m[1].humedad} %`);
}

console.log("\n2 · CADA MATERIAL SABE QUÉ ES, Y CONTRA QUÉ SE MIDE");
{
  const t = (n) => P.pesadaTipo(n);
  di(t("CEMENTO*01") === "cemento" && t("PIEDRA 3/4 SA") === "arido" &&
     t("WATER") === "agua" && t("WR75") === "aditivo", "cemento, árido, agua y aditivo se distinguen");
  di(P.PESADA_TOL.cemento === 1 && P.PESADA_TOL.arido === 2 && P.PESADA_TOL.aditivo === 3,
     "con las tolerancias de la ASTM C94, que la planta declara en el propio conduce");
  const ds = P.pesadaDesvios(p);
  di(ds.every((d) => d.zona === "ok"), "y este camión está dentro de todas");
  /* Y que no se pinte de ámbar un tiro entero por batchar un pelo corto: el
     agua salió a −0.56 % en TODOS los camiones del 29 de agosto. */
  const agua = ds.find((d) => d.tipo === "agua");
  di(agua.zona === "ok", `el agua a ${agua.pct.toFixed(2)} % no es un aviso: es como batcha la planta`);
}

console.log("\n3 · LA CUENTA DEL AGUA CUADRA CON LA DEL PAPEL");
{
  /* Si nuestra cuenta da lo mismo que la de la planta, es que entendimos la
     pesada. Es la única comprobación que no depende de creerle a nadie. */
  const mio = P.pesadaAC(p, 0);
  di(cerca(mio, p.ac, 0.001), `A/C impresa ${p.ac} · calculada de sus propios pesos ${mio.toFixed(4)}`);

  const a = P.pesadaAgua(p, 0);
  di(a.balanzaGa === 249 && a.humedadGa === 59.4,
     `y por partes: ${a.balanzaGa} gal de balanza + ${a.humedadGa} de humedad en los áridos`);
  di(P.pesadaCemento(p) === 6520, "sobre 6520 lb de cemento");
}

console.log("\n4 · EL CAMIÓN LLEGA CORTO A PROPÓSITO — Y ESO NO ES UNA FALTA");
{
  /* Lo más fácil de leer al revés en toda la pesada. El camión llega a 0.394
     porque la planta RETIENE 30 galones para que el técnico los añada mirando
     el slump. El diseño no es 0.394: es donde queda al añadirlos. */
  const llega = P.pesadaAC(p, 0);
  const tope = P.pesadaAC(p, p.reserva);
  di(cerca(llega, 0.394, 0.002), `llega a ${llega.toFixed(3)}`);
  di(cerca(tope, 0.432, 0.003), `y el diseño lo deja subir hasta ${tope.toFixed(3)} con los 30 gal reservados`);

  di(P.pesadaBanderas(p, { vol: 10, galObra: 30 }).length === 0,
     "añadir los 30 autorizados NO levanta ninguna bandera: es cumplir el diseño");

  const conMas = P.pesadaBanderas(p, { vol: 10, galObra: 45 });
  di(conMas.some((b) => b.nivel === "susp" && /agua/i.test(b.titulo)),
     "y el galón de más sí: " + (conMas[0] ? `«${conMas[0].titulo}»` : "—"));
  di(conMas[0] && /45.0/.test(conMas[0].detalle) && /30.0/.test(conMas[0].detalle),
     `diciendo cuánto y cuánto se podía: «${conMas[0] && conMas[0].detalle}»`);
  di(cerca(P.pesadaPorGalon(p), 0.00128, 0.0001),
     `y cada galón pesa ${(P.pesadaPorGalon(p) * 1000).toFixed(2)} milésimas de A/C`);
}

console.log("\n5 · LA DOSIFICACIÓN FUERA DE TOLERANCIA SE CAZA SIN SUBMITTAL");
{
  /* El mismo papel con el cemento 130 lb por encima: +2 % sobre 6500, el doble
     de lo que la C94 permite. Nadie necesita el diseño aprobado para verlo,
     porque el objetivo lo trae la propia pesada. */
  const malo = P.parsearPesada(CAMION_116.replace("6500    6520 Lb", "6500    6630 Lb"));
  const d = P.pesadaDesvios(malo).find((x) => x.tipo === "cemento");
  di(d.zona === "susp", `cemento a ${d.pct.toFixed(2)} % → suspensión`);
  const b = P.pesadaBanderas(malo, { vol: 10 });
  di(b.some((x) => x.nivel === "susp" && /CEMENTO/.test(x.titulo)), "y sale como bandera de suspensión");
  di(b.some((x) => /C94/.test(x.detalle)), "citando la norma, que es lo que se le enseña al chofer");
}

console.log("\n6 · LOS HERMANOS DEL TIRO SON LA REFERENCIA QUE FALTA");
{
  /* Sin submittal no se puede decir «fuera de especificación». Pero dieciséis
     camiones a 0.39 y uno a 0.44 es una anomalía diga lo que diga el papel que
     tiene Rubén, y eso se puede decir HOY. */
  const hermanos = [p, p, p, p];
  const mojado = P.parsearPesada(CAMION_116.replace("250.4   249.0 Ga", "250.4   289.0 Ga"));
  const b = P.pesadaBanderas(mojado, { hermanos, vol: 10 });
  di(b.some((x) => /A\/C fuera de lo normal/.test(x.titulo)),
     `el camión mojado canta contra sus hermanos: ${P.pesadaAC(mojado).toFixed(3)} contra ${P.pesadaAC(p).toFixed(3)}`);

  /* Y con dos hermanos NO se dice nada: dos números no hacen una costumbre. */
  di(!P.pesadaBanderas(mojado, { hermanos: [p, p], vol: 10 })
      .some((x) => /A\/C fuera de lo normal/.test(x.titulo)),
     "pero con dos hermanos se calla: dos números no son una costumbre");
}

console.log("\n7 · EL RENDIMIENTO CON EL PESO UNITARIO MEDIDO — LO QUE SOLO QCHECK TIENE");
{
  /* La planta calcula el rendimiento con el peso unitario de DISEÑO, porque es
     el único que tiene. QCheck lo mide con el balde en ese camión. */
  const lb = P.pesadaPesoTotal(p, 0);
  di(cerca(lb, 40195, 30), `peso en balanza: ${lb.toFixed(0)} lb`);
  const r = P.pesadaRendimiento(p, 149.2, 0);
  di(cerca(r, 9.98, 0.02), `con UW medido 149.2 → ${r.toFixed(2)} CY (el ticket calculó ${p.rend})`);
  di(P.pesadaBanderas(p, { uw: 149.2, vol: 10 }).length === 0, "y a 10.00 facturadas no falta nada");

  /* Un camión que rinde 9.6 de 10 facturadas es hormigón pagado que no vino. */
  const corto = P.pesadaBanderas(p, { uw: 155.5, vol: 10 });
  di(corto.some((x) => x.nivel === "susp" && /Rendimiento/.test(x.titulo)),
     "y si rinde corto de verdad, se dice: " + (corto.find((x) => /Rendimiento/.test(x.titulo)) || {}).detalle);
}

console.log("\n8 · UN PAPEL QUE NO CUADRA CONSIGO MISMO");
{
  /* Nuestra cuenta contra la impresa. Si no coinciden, o se leyó mal la pesada
     o el papel no es lo que dice ser. En los dos casos hay que mirarlo. */
  const raro = P.parsearPesada(CAMION_116.replace("Water/Cement: 0.394", "Water/Cement: 0.520"));
  di(P.pesadaBanderas(raro, { vol: 10 }).some((x) => /no cuadra/.test(x.titulo)),
     "se avisa cuando el A/C impreso no sale de sus propios pesos");
}

console.log("\n9 · Y AGUANTA UN PAPEL MAL LEÍDO");
{
  /* Mañana esto no lo pega una persona: lo escupe un lector. Un lector se come
     espacios, mete comas en los miles y a veces se salta una línea entera. */
  di(!P.parsearPesada("cualquier cosa"), "un texto que no es una pesada devuelve nada, no un objeto a medias");
  di(!P.parsearPesada(""), "y el vacío tampoco revienta");

  const conComas = P.parsearPesada(CAMION_116.replace("17000   16940 Lb", "17,000  16,940 Lb"));
  di(conComas && P.pesadaMateriales(conComas)[0].actual === 16940, "los miles con coma se leen igual");

  const apretado = P.parsearPesada(CAMION_116.replace(/ {2,}/g, " "));
  di(apretado && P.pesadaMateriales(apretado).length === 6 && P.pesadaCemento(apretado) === 6520,
     "y con las columnas apretadas a un espacio sigue saliendo entero");

  /* Media pesada es media pesada, y eso NO se guarda como si fuera entera. */
  const sinAgua = P.parsearPesada(CAMION_116.replace(/^WATER.*$/m, ""));
  di(sinAgua && P.pesadaAC(sinAgua) === null, "sin la línea del agua no se inventa una relación A/C");
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
