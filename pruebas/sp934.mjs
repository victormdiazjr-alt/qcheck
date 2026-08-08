/* Comprueba la aritmética de la SP-934 contra la propia especificación.

   La Tabla 934-6 existe, según la 934, «only to assist in the preliminary by
   hand verification purposes of the PWL estimation». O sea: la Autoridad
   publica la respuesta. Si nuestro cálculo no la reproduce, el nuestro está
   mal — y este archivo decide cuánto se cobra.

   node pruebas/sp934.mjs
*/
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../assets/sp934.js", import.meta.url), "utf8");
const mod = {};
new Function(src + `
  Object.assign(this, { porcentajeDeQ, pwlDeLote, pafCCS, pafCP, pafCUW, cpaf,
    sp934Lotes, sp934EvaluarLote, sp934LimitesCUW, SP934_CCS, m3DeCY, loteRechazado,
    sortearMuestreo, muestrasDelSorteo, verificarSorteo, generadorConSemilla,
    cilindrosDelLote, edadesDeRotura, vencimientosDeCilindro, estadoDeCilindros,
    avisoLaboratorio, SP934_CILINDROS, proyeccionDeLote, valorDeSublote, fmtVolumen, cyDeM3, cifra, pwlDeLote });
`).call(mod);

let bien = 0, mal = 0;
const ok = (c, q, extra = "") => { c ? (bien++, console.log(`  ✓ ${q}`)) : (mal++, console.log(`  ✕ ${q}   ${extra}`)); };
const t = (s) => console.log(`\n  ${s}`);

/* ═══ 1 · La Tabla 934-6, punto por punto ═══
   Filas leídas del PDF: PWL → valor de Q para cada tamaño de muestra.
   Columnas n = 3, 4, 5, 6, 7, 8, 9, 10. */
t("TABLA 934-6 — el PWL que publica la Autoridad");
const TABLA = [
  // PWL, [Q para n=3, 4, 5, 6, 7, 8, 9, 10]
  [99, [1.1541, 1.4700, 1.6714, 1.8008, 1.8888, 1.9520, 1.9994, 2.0362]],
  [98, [1.1524, 1.4400, 1.6016, 1.6982, 1.7612, 1.8053, 1.8379, 1.8630]],
  [97, [1.1496, 1.4100, 1.5427, 1.6181, 1.6661, 1.6993, 1.7235, 1.7420]],
  [96, [1.1456, 1.3800, 1.4897, 1.5497, 1.5871, 1.6127, 1.6313, 1.6454]],
];
const NS = [3, 4, 5, 6, 7, 8, 9, 10];
for (const [pwlEsperado, qs] of TABLA) {
  for (let i = 0; i < qs.length; i++) {
    const n = NS[i], q = qs[i];
    const p = mod.porcentajeDeQ(q, n);
    /* Media unidad de tolerancia: la tabla viene redondeada a enteros de PWL
       y a cuatro decimales de Q, así que exigir más sería exigirle precisión
       a la tabla, no al cálculo. */
    ok(Math.abs(p - pwlEsperado) < 0.6,
       `n=${String(n).padEnd(2)} Q=${q.toFixed(4)} → PWL ${pwlEsperado}`,
       `dio ${p.toFixed(3)}`);
  }
}

/* ═══ 2 · Los casos que no son tabla ═══ */
t("CASOS LÍMITE");
ok(mod.porcentajeDeQ(0, 10) === 50, "Q=0 es la media justa → 50 %");
ok(Math.abs(mod.porcentajeDeQ(-1.6454, 10) - (100 - 96)) < 0.6,
   "Q negativo se resta de 100 (paso 9 de 934-7.05)");
ok(mod.porcentajeDeQ(1.5, 2) === null, "con menos de 3 sub-lotes no hay PWL");

/* ═══ 3 · Un lote entero, a mano ═══ */
t("UN LOTE COMPLETO");
const vals = [3800, 4100, 3950, 4300, 4050, 3900, 4200, 4000, 3850, 4150];
const r = mod.pwlDeLote(vals, 3000, 5625);   // clase III, Tabla 934-3
ok(r.n === 10, "diez sub-lotes");
ok(Math.abs(r.media - 4030) < 0.5, `media ${r.media}`);
ok(r.pwl === 100, `todo dentro de límites → PWL ${r.pwl}`);
/* (-0.05·100² + 10·100 − 395)/100 = 1.05. Comprobado a mano contra la fórmula
   de 934-7.05(c): la primera vez lo escribí como 1.105 y era la prueba la que
   estaba mal, no el código. */
ok(mod.pafCCS(100) === 1.05, `PAF con PWL 100 = ${mod.pafCCS(100)} (bonificación del 5 %)`);
ok(mod.pafCCS(90) === 1.000, `PAF con PWL 90 = ${mod.pafCCS(90)} (el AQL paga a precio)`);
ok(mod.pafCCS(60) === 0.750, `PAF con PWL 60 = ${mod.pafCCS(60)}`);

/* La frontera de la fórmula: la 934 cambia de rama en PWL 80. */
const a80 = mod.pafCCS(80), b80 = (0.50 * 80 + 45) / 100;
ok(Math.abs(a80 - b80) < 0.002, `las dos ramas se juntan en PWL 80 (${a80} vs ${b80})`);

/* ═══ 4 · El factor compuesto, con y sin permeabilidad ═══ */
t("FACTOR COMPUESTO");
ok(mod.cpaf({ ccs: 1.0, cp: 1.0, cuw: 1.0 }) === 1.0, "todo al 100 % paga 1.000");
ok(mod.cpaf({ ccs: 1.0, cp: null, cuw: 1.0 }) === 1.0, "sin permeabilidad, también");
ok(mod.cpaf({ ccs: 0.9, cp: null, cuw: 1.0 }) === 0.910,
   `sin permeabilidad usa 0.90/0.10 → ${mod.cpaf({ ccs: 0.9, cp: null, cuw: 1.0 })}`);
ok(mod.cpaf({ ccs: 0.9, cp: 1.0, cuw: 1.0 }) === 0.955,
   `con permeabilidad usa 0.45/0.45/0.10 → ${mod.cpaf({ ccs: 0.9, cp: 1.0, cuw: 1.0 })}`);

/* ═══ 5 · Rechazo ═══ */
t("RECHAZO");
ok(mod.loteRechazado("ccs", { n: 10, pwl: 59 }, [], 3000, 5625), "PWL 59 rechaza el lote");
ok(!mod.loteRechazado("ccs", { n: 10, pwl: 61 }, [], 3000, 5625), "PWL 61 no rechaza, se descuenta");
ok(mod.loteRechazado("ccs", { n: 2 }, [2600], 3000, 5625),
   "con 2 sub-lotes, un valor bajo 0.900·LSL rechaza");
ok(!mod.loteRechazado("ccs", { n: 2 }, [2800], 3000, 5625),
   "2800 está sobre 0.900·LSL (2700): no rechaza");

/* ═══ 6 · Lotes y sub-lotes ═══ */
t("LOTES Y SUB-LOTES");
/* La numeración es global y correlativa, como en el expediente de verdad: dos
   series con la misma `n` se entrelazan al ordenar y el resultado no se parece
   a nada real. Lo aprendí escribiendo esta prueba. */
let seq = 0;
const hacer = (n, mix, dia) => Array.from({ length: n }, () =>
  ({ n: ++seq, date: dia, vol: 10, mix }));

/* 250 m³ = 327 CY. A 10 CY por camión, 33 camiones llenan un lote. */
const l1 = mod.sp934Lotes(hacer(40, "A", "2026-09-01"));
ok(l1.length === 2, `40 camiones de 10 CY dan ${l1.length} lotes`);
ok(l1[0].sublotes.length === 10, `el primero tiene ${l1[0].sublotes.length} sub-lotes`);
ok(l1[0].m3 <= 260 && l1[0].m3 >= 240, `y ${l1[0].m3} m³`);
ok(l1[1].parcial, "el segundo es parcial");

const l2 = mod.sp934Lotes([...hacer(5, "A", "2026-09-01"), ...hacer(5, "B", "2026-09-01")]);
ok(l2.length === 2, "cambiar el diseño de mezcla abre lote nuevo");
ok(l2[1].motivo === "cambio de diseño de mezcla", `motivo: ${l2[1].motivo}`);

const l3 = mod.sp934Lotes([...hacer(3, "A", "2026-01-01"), ...hacer(3, "A", "2026-04-01")]);
ok(l3.length === 2, "56 días o más sin producción abren lote nuevo");

/* ═══ 7 · Peso unitario ═══ */
t("PESO UNITARIO — Tabla 934-5");
const lim = mod.sp934LimitesCUW(150.1);
ok(lim.lsl === 147.2 && lim.usl === 153, `objetivo 150.1 → ${lim.lsl} a ${lim.usl} (±2.9)`);

/* ═══ 8 · Muestreo aleatorio (M2) ═══
   Lo que se comprueba aquí no es que los números salgan «aleatorios»: es que
   el sorteo se pueda REHACER. Esa es la propiedad que lo hace defendible ante
   la Autoridad, y la que se pierde en cuanto alguien mete un Math.random(). */
t("MUESTREO ALEATORIO — ASTM D3665");
const S1 = mod.sortearMuestreo({ proyecto: "PR-52", lote: 1, cuando: "2026-09-01T10:00:00Z", quien: "Rubén" });
ok(S1 !== null && S1.puntos.length === 10, `sortea ${S1 ? S1.puntos.length : 0} puntos, uno por sub-lote`);
ok(S1.puntos.every((p) => p.fraccion >= 0 && p.fraccion < 1),
   "cada punto es una fracción entre 0 y 1 del sub-lote");
ok(S1.puntos.every((p) => p.m3Estimado >= 0 && p.m3Estimado < 25),
   "la estimación en m³ cae dentro del sub-lote nominal");

/* Lo mismo dos veces da lo mismo. */
const S2 = mod.sortearMuestreo({ proyecto: "PR-52", lote: 1, cuando: "2026-09-01T10:00:00Z" });
ok(JSON.stringify(S1.puntos) === JSON.stringify(S2.puntos),
   "el mismo lote y el mismo instante dan EXACTAMENTE el mismo sorteo");
ok(mod.verificarSorteo(S1), "el sorteo se rehace desde su semilla y coincide");

/* Y cosas distintas dan cosas distintas: si no, no habría sorteo. */
const S3 = mod.sortearMuestreo({ proyecto: "PR-52", lote: 2, cuando: "2026-09-01T10:00:00Z" });
const S4 = mod.sortearMuestreo({ proyecto: "PR-52", lote: 1, cuando: "2026-09-01T10:00:01Z" });
ok(JSON.stringify(S1.puntos) !== JSON.stringify(S3.puntos), "otro lote, otro sorteo");
ok(JSON.stringify(S1.puntos) !== JSON.stringify(S4.puntos), "otro instante, otro sorteo");

/* Sin sello de tiempo no hay prueba, así que no hay sorteo. */
ok(mod.sortearMuestreo({ proyecto: "PR-52", lote: 1 }) === null,
   "sin cuándo no se sortea: un sorteo sin hora no demuestra nada");

/* Reparto: con 10.000 puntos, ¿se llenan todos los tramos del sub-lote? */
const azar = mod.generadorConSemilla(12345);
const cubos = new Array(10).fill(0);
for (let i = 0; i < 10000; i++) cubos[Math.floor(azar() * 10)]++;
const min = Math.min(...cubos), max = Math.max(...cubos);
ok(min > 850 && max < 1150, `reparto parejo en diez tramos (${min}–${max} de 1000 esperados)`);

/* A qué camión le toca. */
t("A QUÉ CAMIÓN LE TOCA");
let seq2 = 0;
const camiones = Array.from({ length: 40 }, () => ({ n: ++seq2, date: "2026-09-01", vol: 10, mix: "A" }));
const loteM = mod.sp934Lotes(camiones)[0];
const asignadas = mod.muestrasDelSorteo(loteM, S1);
ok(asignadas.length === 10, `una decisión por sub-lote (${asignadas.length})`);
const conCamion = asignadas.filter((a) => a.estado === "asignado");
ok(conCamion.length === 10, `los diez tienen camión asignado (${conCamion.length})`);
ok(conCamion.every((a) => a.ensayo && a.ensayo.n), "cada uno apunta a un camión concreto");
/* Un lote a medias: los sub-lotes vacíos se dicen, no se rellenan con el más cercano. */
const loteMedio = mod.sp934Lotes(camiones.slice(0, 12))[0];
const aMedias = mod.muestrasDelSorteo(loteMedio, S1);
ok(aMedias.some((a) => a.estado === "sin-hormigon"),
   "los sub-lotes que aún no existen se dicen, no se inventan");
/* Sub-lotes de tamaños dispares: la fracción tiene que aguantarlos todos.
   Es el caso que tumbó el primer diseño. */
let seq3 = 0;
const dispares = [3, 11, 7, 25, 4].flatMap((n) =>
  Array.from({ length: n }, () => ({ n: ++seq3, date: "2026-09-02", vol: 10, mix: "B" })));
const loteD = mod.sp934Lotes(dispares)[0];
const asigD = mod.muestrasDelSorteo(loteD, S1).filter((a) => a.estado !== "sin-hormigon");
ok(asigD.length > 0 && asigD.every((a) => a.ensayo),
   `con sub-lotes de tamaños dispares, los ${asigD.length} con hormigón tienen camión`);

/* ═══ 9 · Cilindros y custodia (M3) ═══ */
t("CILINDROS — SP-934-6.01");
let seq4 = 0;
const camsC = Array.from({ length: 40 }, () => ({ n: ++seq4, date: "2026-09-01", vol: 10, mix: "A" }));
const loteC = mod.sp934Lotes(camsC)[0];

const sinCP = mod.cilindrosDelLote(loteC, { plan: {}, permeabilidad: false });
const ccs = sinCP.filter((f) => f.tipo === "ccs");
ok(ccs.length === 10, `un juego de resistencia por sub-lote (${ccs.length})`);
ok(ccs.every((f) => f.cuantos === 6), "seis cilindros cada uno");
ok(ccs.every((f) => JSON.stringify(f.edades) === JSON.stringify([7, 28])), "a 7 y 28 días por defecto");
ok(sinCP.filter((f) => f.tipo === "cp").length === 0, "sin permeabilidad, no se piden cilindros de permeabilidad");
ok(sinCP.filter((f) => f.tipo === "tension").length === 1, "la tensión indirecta va por LOTE, no por sub-lote");
ok(sinCP.find((f) => f.tipo === "tension").informativo === true, "y va marcada como informativa");

const conCP = mod.cilindrosDelLote(loteC, { plan: {}, permeabilidad: true });
ok(conCP.filter((f) => f.tipo === "cp").length === 10, "con permeabilidad, dos por sub-lote");
ok(conCP.filter((f) => f.tipo === "cp").every((f) => f.cuantos === 2), "dos cilindros cada uno");

ok(JSON.stringify(mod.edadesDeRotura({ tablero: true })) === JSON.stringify([7, 56]),
   "en tablero de puente, 7 y 56 días");
ok(JSON.stringify(mod.edadesDeRotura({ edades: [7, 14, 28] })) === JSON.stringify([7, 14, 28]),
   "y el plan manda sobre todo");

/* Un sub-lote sin hormigón no debe cilindros: pedirlos seria inventar trabajo. */
const loteVacio = mod.sp934Lotes(camsC.slice(0, 5))[0];
ok(mod.cilindrosDelLote(loteVacio, { plan: {} }).filter((f) => f.tipo === "ccs").length ===
   loteVacio.sublotes.length,
   "solo se piden cilindros de los sub-lotes que ya tienen hormigón");

t("VENCIMIENTOS Y ESTADO");
const v = mod.vencimientosDeCilindro("2026-09-01", [7, 28]);
ok(v[0].vence === "2026-09-08" && v[1].vence === "2026-09-29", `7 y 28 días → ${v[0].vence} y ${v[1].vence}`);

ok(mod.estadoDeCilindros(null).estado === "pendiente", "sin hacer → pendiente");
ok(mod.estadoDeCilindros({ hecho: "2026-09-01" }).estado === "en-obra", "hecho y sin entregar → en obra");
ok(mod.estadoDeCilindros({ hecho: "2026-09-01", entregado: "2026-09-02",
     roturas: [{ vence: "2026-09-08", resultado: 4100 }, { vence: "2026-09-29", resultado: null }] },
     "2026-09-10").estado === "esperando", "una rotura hecha y otra por venir → esperando");
ok(mod.estadoDeCilindros({ hecho: "2026-09-01", entregado: "2026-09-02",
     roturas: [{ vence: "2026-09-08", resultado: null }] }, "2026-09-15").estado === "vencido",
   "rotura pasada sin resultado → vencida");
ok(mod.estadoDeCilindros({ hecho: "2026-09-01", entregado: "2026-09-02",
     roturas: [{ vence: "2026-09-08", resultado: 4100 }] }, "2026-09-15").estado === "completo",
   "todas con resultado → completo");

t("AVISO DEL LABORATORIO — 48 h");
ok(mod.avisoLaboratorio("2026-09-10", "2026-09-01T08:00:00Z") === null,
   "con nueve días por delante no se avisa");
const a48 = mod.avisoLaboratorio("2026-09-10", "2026-09-09T08:00:00Z");
ok(a48 !== null && a48.horas <= 48, `a menos de 48 h sí avisa (${a48 ? a48.horas : "?"} h)`);
ok(mod.avisoLaboratorio("2026-09-10", "2026-09-09T08:00:00Z", true) === null,
   "si ya se coordinó, no se avisa");
ok(mod.avisoLaboratorio("2026-09-01", "2026-09-09T08:00:00Z") === null,
   "de un vaciado que ya pasó no se avisa: no tiene arreglo");

/* ═══ 10 · Hacia dónde va el lote (M7) ═══
   Lo que se comprueba es que NO adivina: que el techo es un techo de verdad y
   que lo de «ahora» es el lote a día de hoy, no una predicción. */
t("HACIA DÓNDE VA EL LOTE");
const LIM = { ccs: { campo: "cs28", lsl: 3000, usl: 5625 },
              cuw: { campo: "uw", lsl: 147.2, usl: 153 } };
const hacerSub = (vals) => ({
  n: 1, sublotes: vals.map((v, i) => ({ n: i + 1, ensayos: [{ n: i + 1, cs28: v, uw: 150 }] })),
});

/* Cinco sub-lotes buenos: el techo tiene que poder llegar a 1.05. */
const buenos = hacerSub([4200, 4300, 4250, 4180, 4220]);
const pBuenos = mod.proyeccionDeLote(buenos, LIM);
ok(pBuenos.sublotes === 5 && pBuenos.faltan === 5, `cinco hechos, ${pBuenos.faltan} por venir`);
ok(pBuenos.cpaf.techo >= pBuenos.cpaf.ahora, "el techo nunca está por debajo de lo que hay");
ok(pBuenos.cpaf.suelo <= pBuenos.cpaf.ahora, "y el suelo nunca por encima");
ok(pBuenos.aviso === null, "con el lote bien encaminado no se avisa de nada");

/* Cinco sub-lotes malos: el techo tiene que haber caído, y hay que decirlo. */
const malos = hacerSub([2900, 3050, 2980, 3100, 2950]);
const pMalos = mod.proyeccionDeLote(malos, LIM);
ok(pMalos.cpaf.techo < 1, `con cinco sub-lotes flojos el techo ya bajó de 1.000 (${pMalos.cpaf.techo})`);
ok(pMalos.aviso !== null, "y se avisa");
ok(pMalos.aviso.texto.includes(String(pMalos.cpaf.techo.toFixed(3))),
   "el aviso dice el número, no una vaguedad");

/* Lote cerrado: no hay nada que proyectar, y no se avisa. */
const cerrado = hacerSub([2900, 3050, 2980, 3100, 2950, 3000, 2900, 3050, 2980, 3100]);
const pCerrado = mod.proyeccionDeLote(cerrado, LIM);
ok(pCerrado.cerrado === true, "diez de diez: el lote está cerrado");
ok(pCerrado.aviso === null, "de un lote cerrado no se avisa: ya no es aviso, es resultado");
ok(pCerrado.cpaf.ahora === pCerrado.cpaf.techo && pCerrado.cpaf.ahora === pCerrado.cpaf.suelo,
   "y las tres cifras coinciden, porque no falta nada");

/* Lo de «ahora» tiene que ser exactamente la evaluación real, no una versión
   suavizada: si difiere, estaríamos enseñando dos verdades. */
const evReal = mod.sp934EvaluarLote(buenos, LIM);
ok(evReal.cpaf === pBuenos.cpaf.ahora,
   `«ahora» coincide con la evaluación del lote (${evReal.cpaf} = ${pBuenos.cpaf.ahora})`);

/* ═══ 11 · Un hueco no es un cero ═══
   El fallo más caro que puede tener este archivo, y estuvo dentro. */
t("UN HUECO NO ES UN CERO");
const sinResultado = { n: 1, ensayos: [{ n: 1, cs28: null }, { n: 2, cs28: null }] };
ok(mod.valorDeSublote(sinResultado, "cs28") === null,
   "un sub-lote sin resultados todavía vale null, no 0");
const aMedio = { n: 1, ensayos: [{ n: 1, cs28: 4000 }, { n: 2, cs28: null }, { n: 3 }] };
ok(mod.valorDeSublote(aMedio, "cs28") === 4000,
   `con un resultado de tres, la media es ese (${mod.valorDeSublote(aMedio, "cs28")})`);
ok(mod.valorDeSublote({ n: 1, ensayos: [{ cs28: 0 }] }, "cs28") === 0,
   "pero un CERO de verdad sí cuenta: es un dato, no un hueco");
ok(mod.valorDeSublote({ n: 1, ensayos: [{ cs28: "" }] }, "cs28") === null,
   "y una cadena vacía es un hueco");

/* De punta a punta: un lote sin resultados no puede salir rechazado. */
const sinRotos = { n: 1, sublotes: [1,2,3].map((i) => ({ n: i, ensayos: [{ n: i, cs28: null, uw: 150 }] })) };
const evSin = mod.sp934EvaluarLote(sinRotos, LIM);
ok(evSin.aqc.ccs.n === 0, "sin resultados de resistencia, n = 0");
ok(evSin.aqc.ccs.pwl === null, "y no hay PWL que dar");
ok(evSin.aqc.ccs.rechazado === false,
   "un lote sin resultados NO se rechaza: no hay nada que juzgar todavía");

t("LAS DOS UNIDADES");
ok(mod.fmtVolumen(250) === "250.0 m³ (327.0 CY)", `250 m³ → ${mod.fmtVolumen(250)}`);
ok(mod.fmtVolumen(null) === "—", "sin dato, un guion — no un cero");
ok(Math.abs(mod.cyDeM3(mod.m3DeCY(10)) - 10) < 1e-9, "convertir y volver da lo mismo");

/* ═══ 12 · Ninguna puerta de entrada confunde un hueco con un cero ═══
   Este bloque existe porque el mismo descuido se coló DOS veces en una hora:
   una vez en `valorDeSublote` (Q-63, rechazó un lote sano) y otra en
   `fmtVolumen` recién escrita (Q-64). `Number(null)` es 0 y
   `Number.isFinite(0)` es cierto, así que el error es fácil y silencioso.
   En vez de confiar en acordarse, se barren todas las puertas. */
t("NINGÚN HUECO SE VUELVE CERO");
for (const hueco of [null, undefined, ""]) {
  const q = hueco === "" ? '""' : String(hueco);
  ok(mod.cifra(hueco) === null, `cifra(${q}) es null`);
  ok(mod.fmtVolumen(hueco) === "—", `fmtVolumen(${q}) es un guion`);
  ok(mod.valorDeSublote({ ensayos: [{ x: hueco }] }, "x") === null, `valorDeSublote(${q}) es null`);
  ok(mod.pwlDeLote([hueco, hueco, hueco], 1, 10).n === 0, `pwlDeLote con tres ${q} no cuenta ninguno`);
}
ok(mod.cifra(0) === 0, "pero un cero de verdad sigue siendo cero");
ok(mod.cifra("3.5") === 3.5, "y un número en texto se lee");
ok(mod.cifra("hola") === null, "y lo que no es número, null");

console.log(`\n  ${bien} bien · ${mal} mal\n`);
process.exit(mal ? 1 : 0);
