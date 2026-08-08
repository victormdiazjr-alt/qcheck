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
    sp934Lotes, sp934EvaluarLote, sp934LimitesCUW, SP934_CCS, m3DeCY, loteRechazado });
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

console.log(`\n  ${bien} bien · ${mal} mal\n`);
process.exit(mal ? 1 : 0);
