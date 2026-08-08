/* ══════════════════════════════════════════════════════════════════════════
   SP-934 — la aritmética de la aceptación estadística
   Q-58, 8 de agosto de 2026

   Vive aparte de `core.js` a propósito. Este archivo solo se usa cuando la
   norma está encendida (`es934()`), y tenerlo separado hace estructural la
   promesa de Q-57: con la 934 apagada, nada de esto corre.

   Todo lo de aquí sale de la Special Provision 934, borrador del 8 de
   diciembre de 2025. Donde hay un número, hay un artículo detrás. El análisis
   completo está en `docs/SP-934.md`.

   **Este archivo decide cuánto se cobra.** Un error aquí no se ve en pantalla
   como un error: se ve como un número plausible. Por eso el cálculo de PWL se
   comprueba contra la Tabla 934-6, que la propia especificación publica «only
   to assist in the preliminary by hand verification purposes» — está para
   esto exactamente. Ver `pruebas/sp934.mjs`.
   ══════════════════════════════════════════════════════════════════════════ */

/* ---------------------------------------------------------------- la beta */
/* PWL se calcula «by numerical integration of the beta distribution function»
   (934-7.05). Eso es la función beta incompleta regularizada, así que se hace
   bien —fracción continua de Lentz— y no con una integración a ojo: cerca de
   los extremos el integrando se dispara y una regla de Simpson devuelve
   números creíbles y falsos, que es la peor clase de error. */
function lnGamma(x) {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
             -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += g[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function betaCF(a, b, x) {
  const TINY = 1e-300, EPS = 3e-16;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/* I_x(a,b) — la beta incompleta regularizada. */
function betaInc(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b)
                      + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? bt * betaCF(a, b, x) / a
    : 1 - bt * betaCF(b, a, 1 - x) / b;
}

/* ------------------------------------------------------------------- PWL */
/* De un índice de calidad Q al porcentaje de lote dentro del límite.

   934-7.05, pasos 5 a 9:
     a = b = n/2 − 1
     el límite de integración sale de Q y del tamaño de la muestra
     si Q es negativo, se calcula con |Q| y se resta de 100 (paso 9) */
function porcentajeDeQ(Q, n) {
  if (n < 3) return null;                 // con menos de 3 no se usa PWL
  if (Q < 0) return 100 - porcentajeDeQ(-Q, n);
  const a = n / 2 - 1;
  const lim = 0.5 + Q * Math.sqrt(n) / (2 * (n - 1));
  if (lim >= 1) return 100;
  if (a <= 0) return lim >= 1 ? 100 : (lim <= 0 ? 0 : 100 * lim);
  /* Se limpia el ruido de coma flotante antes de devolver: la integración deja
     colas como 49.99999999999575 donde la respuesta es 50, y un porcentaje así
     asusta en pantalla y arrastra el redondeo a tres decimales que pide la
     norma en el paso siguiente. Seis decimales es mucho más de lo que la 934
     usa nunca. */
  return Number((100 * betaInc(a, a, lim)).toFixed(6));
}

const red = (x, n) => Number(x.toFixed(n));

/* El cálculo completo de un lote. `lsl` o `usl` en `null` significa que ese
   lado no tiene límite —la permeabilidad solo tiene techo (Tabla 934-4)— y
   entonces ese lado aporta el 100 %. */
function pwlDeLote(valores, lsl, usl) {
  const v = (valores || []).map(Number).filter(Number.isFinite);
  const n = v.length;
  if (n < 3) return { n, pwl: null, motivo: "menos de 3 sub-lotes" };

  const media = red(v.reduce((a, b) => a + b, 0) / n, 4);
  const sumaCuad = v.reduce((a, b) => a + b * b, 0);
  const suma = v.reduce((a, b) => a + b, 0);
  const s = red(Math.sqrt((n * sumaCuad - suma * suma) / (n * (n - 1))), 4);

  /* Desviación cero: todos los ensayos idénticos. Q se iría a infinito, así
     que se contesta con lo que significa —dentro o fuera— sin dividir. */
  if (s === 0) {
    const dentro = (lsl == null || media >= lsl) && (usl == null || media <= usl);
    return { n, media, s, qu: null, ql: null, pu: null, pl: null, pwl: dentro ? 100 : 0 };
  }

  const qu = usl == null ? null : red((usl - media) / s, 4);
  const ql = lsl == null ? null : red((media - lsl) / s, 4);
  const pu = qu == null ? 100 : red(porcentajeDeQ(qu, n), 3);
  const pl = ql == null ? 100 : red(porcentajeDeQ(ql, n), 3);

  /* Paso 10: PWL = (PU + PL) − 100 */
  let pwl = pu + pl - 100;
  if (pwl < 0) pwl = 0;
  if (pwl > 100) pwl = 100;
  return { n, media, s, qu, ql, pu, pl, pwl: red(pwl, 3) };
}

/* ------------------------------------------------ factores de ajuste de pago */
/* 934-7.05(c), literal. Redondeados a tres decimales por la propia norma. */
function pafCCS(pwl) {
  if (pwl == null) return null;
  const f = pwl >= 80
    ? (-0.05 * pwl * pwl + 10.00 * pwl - 395) / 100
    : (0.50 * pwl + 45.00) / 100;
  return red(f, 3);
}
function pafCP(pwl)  { return pwl == null ? null : red((0.50 * pwl + 55.00) / 100, 3); }
function pafCUW(pwl) { return pwl == null ? null : red((0.50 * pwl + 55.00) / 100, 3); }

/* El compuesto. La 934 da DOS fórmulas y la que toca depende de si el
   proyecto inspecciona permeabilidad:

     con permeabilidad:  0.45·CCS + 0.45·CP + 0.10·CUW
     sin permeabilidad:  0.90·CCS +           0.10·CUW

   La PR-52 no la lleva; proyectos 934 futuros sí (Víctor, 8 ago 2026). Por eso
   se decide con el dato y no con una constante. */
function cpaf({ ccs, cp, cuw }) {
  if (ccs == null || cuw == null) return null;
  const f = cp == null
    ? 0.90 * ccs + 0.10 * cuw
    : 0.45 * ccs + 0.45 * cp + 0.10 * cuw;
  return red(f, 3);
}

/* --------------------------------------------------------------- rechazo */
/* 934-6.01. Un lote se rechaza —no se descuenta, se rechaza— cuando el PWL
   cae por debajo de 60, y con menos de tres sub-lotes cuando un valor suelto
   se sale de los múltiplos que fija cada característica. */
const LIMITES_RECHAZO = {
  ccs: { pwlMin: 60, factorLSL: 0.900, factorUSL: 1.100 },
  cuw: { pwlMin: 60, factorUSL: 1.035, factorLSL: 1.035 },
  cp:  { pwlMin: 60, factorUSL: 1.300 },
};

function loteRechazado(aqc, r, valores, lsl, usl) {
  const L = LIMITES_RECHAZO[aqc];
  if (!L) return false;
  if (r.n >= 3) return r.pwl != null && r.pwl < L.pwlMin;
  return (valores || []).some((x) =>
    (usl != null && L.factorUSL != null && x > usl * L.factorUSL) ||
    (lsl != null && L.factorLSL != null && aqc === "ccs" && x < lsl * L.factorLSL));
}

/* --------------------------------------------- límites por clase (Tabla 934-3) */
const SP934_CCS = {
  I:    { lsl: 1000, usl: 3000 },   II:   { lsl: 2000, usl: 4250 },
  III:  { lsl: 3000, usl: 5625 },   IV:   { lsl: 4000, usl: 6925 },
  V:    { lsl: 5000, usl: 8950 },   VI:   { lsl: 6000, usl: 9650 },
  VII:  { lsl: 7000, usl: 10350 },  VIII: { lsl: 8000, usl: 11000 },
  IX:   { lsl: 9000, usl: 12400 },
};

/* Tabla 934-5: el peso unitario se juzga contra el objetivo ±2.9 pcf. No es
   el mismo criterio que usa QCheck en control de proceso (act 2.3 / susp 3.0),
   y son cosas distintas: aquello vigila la mezcla, esto decide el pago. */
const SP934_CUW_TOLERANCIA = 2.9;
function sp934LimitesCUW(objetivo) {
  const o = Number(objetivo);
  if (!Number.isFinite(o)) return { lsl: null, usl: null };
  return { lsl: red(o - SP934_CUW_TOLERANCIA, 4), usl: red(o + SP934_CUW_TOLERANCIA, 4) };
}

/* Tabla 934-4: la permeabilidad solo tiene techo, y el nivel 1 no se juzga. */
const SP934_CP_USL = { "1": null, "2": 1950 };

/* ------------------------------------------------------- lotes y sub-lotes */
/* 934-6.01(j): el lote son 250 m³ en 10 sub-lotes de 25 m³.

   Un lote nuevo empieza cuando se llena el anterior, **cuando cambia el
   diseño de mezcla**, o cuando pasan 56 días o más sin producción. Y un lote
   solo puede tener una clase de hormigón.

   El volumen manda sobre el reloj: los sub-lotes se cortan por metros cúbicos
   acumulados, no por días ni por camiones. Un tiro puede repartirse entre dos
   lotes y un lote puede abarcar varios tiros — que es justo lo que hoy QCheck
   no sabe representar. */
const SP934_LOTE_M3 = 250;
const SP934_SUBLOTE_M3 = 25;
const CY_A_M3 = 0.764554857984;

function m3DeCY(cy) { const n = Number(cy); return Number.isFinite(n) ? n * CY_A_M3 : 0; }

function diasEntre(a, b) {
  const d = (new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000;
  return Number.isFinite(d) ? d : 0;
}

/* Reparte una lista de ensayos —en orden de colocación— en lotes y sub-lotes.
   Devuelve los lotes, cada uno con sus sub-lotes y los ensayos de cada uno. */
function sp934Lotes(ensayos, opciones) {
  const o = opciones || {};
  const loteM3 = o.loteM3 || SP934_LOTE_M3;
  const subM3 = o.subloteM3 || SP934_SUBLOTE_M3;

  const orden = (ensayos || []).slice().sort((a, b) =>
    (a.date || "").localeCompare(b.date || "") || (a.n || 0) - (b.n || 0));

  const lotes = [];
  let lote = null;

  const abrir = (t, motivo) => {
    lote = {
      n: lotes.length + 1, motivo,
      clase: t.clase || o.clase || null,
      mezcla: t.mix || null,
      desde: t.date, hasta: t.date,
      m3: 0, sublotes: [], ensayos: [],
    };
    lotes.push(lote);
  };

  for (const t of orden) {
    const v = m3DeCY(t.vol);
    if (!lote) abrir(t, "primer hormigón");
    else if (lote.mezcla && t.mix && t.mix !== lote.mezcla) abrir(t, "cambio de diseño de mezcla");
    else if (lote.hasta && t.date && diasEntre(lote.hasta, t.date) >= 56) abrir(t, "56 días o más sin producción");
    else if (lote.m3 >= loteM3) abrir(t, "lote completo");

    /* El sub-lote al que cae este camión sale del volumen acumulado DENTRO
       del lote. Un camión que cruza la frontera cuenta en el sub-lote donde
       empieza: el ensayo es uno y no se parte. */
    const i = Math.min(Math.floor(lote.m3 / subM3), Math.ceil(loteM3 / subM3) - 1);
    if (!lote.sublotes[i]) lote.sublotes[i] = { n: i + 1, m3: 0, ensayos: [] };
    lote.sublotes[i].m3 += v;
    lote.sublotes[i].ensayos.push(t);
    lote.m3 += v;
    lote.hasta = t.date;
    lote.ensayos.push(t);
  }

  for (const l of lotes) {
    l.sublotes = l.sublotes.filter(Boolean);
    l.m3 = red(l.m3, 2);
    l.cy = red(l.m3 / CY_A_M3, 1);
    l.parcial = l.sublotes.length < Math.ceil(loteM3 / subM3);
    for (const s of l.sublotes) s.m3 = red(s.m3, 2);
  }
  return lotes;
}

/* Un sub-lote aporta UN valor a la estadística por característica: la 934
   evalúa sub-lotes, no camiones. Con varios ensayos dentro se promedia, que
   es lo que hace el laboratorio con un juego de cilindros. */
function valorDeSublote(sublote, campo) {
  const v = (sublote.ensayos || []).map((t) => Number(t[campo])).filter(Number.isFinite);
  return v.length ? red(v.reduce((a, b) => a + b, 0) / v.length, 4) : null;
}

function sp934EvaluarLote(lote, limites) {
  const salida = { lote: lote.n, sublotes: lote.sublotes.length, m3: lote.m3, aqc: {} };
  for (const [aqc, cfg] of Object.entries(limites || {})) {
    if (!cfg) continue;
    const vals = lote.sublotes.map((s) => valorDeSublote(s, cfg.campo)).filter((x) => x != null);
    const r = pwlDeLote(vals, cfg.lsl, cfg.usl);
    r.valores = vals;
    r.rechazado = loteRechazado(aqc, r, vals, cfg.lsl, cfg.usl);
    r.paf = aqc === "ccs" ? pafCCS(r.pwl) : aqc === "cp" ? pafCP(r.pwl) : pafCUW(r.pwl);
    salida.aqc[aqc] = r;
  }
  const a = salida.aqc;
  salida.cpaf = cpaf({
    ccs: a.ccs ? a.ccs.paf : null,
    cp: a.cp ? a.cp.paf : null,
    cuw: a.cuw ? a.cuw.paf : null,
  });
  salida.rechazado = Object.values(a).some((x) => x.rechazado);
  return salida;
}

/* ══════════════════════════════════════════════════════════════════════════
   MUESTREO ALEATORIO — M2. Q-60, 8 de agosto de 2026.

   La 934 lo exige con todas las letras: «The above-described sampling tests
   and field procedures shall be performed on a random basis (ASTM D3665)».

   Hoy decide el técnico a qué camión le saca muestra. Bajo la 934 eso es un
   flanco: cualquiera puede alegar que se muestreó el camión que convenía, y
   con eso se impugna el lote entero — no la muestra, **el lote**.

   Que lo elija el programa no basta. Tiene que poder **demostrarse**, y para
   eso el sorteo cumple tres condiciones:

     1. Se hace ANTES de que llegue el hormigón, no sobre la marcha.
     2. Queda escrito con quién lo pidió y cuándo.
     3. Es **reproducible**: se guarda la semilla y cualquiera puede rehacer
        el sorteo y obtener lo mismo.

   La tercera es la que convence a un auditor. `Math.random()` no vale para
   esto —no se puede rehacer, así que hay que creerse el resultado— y por eso
   aquí hay un generador con semilla: se publica la semilla, se publica el
   algoritmo, y quien dude que lo recalcule.
   ══════════════════════════════════════════════════════════════════════════ */

/* mulberry32: pequeño, determinista y suficiente para repartir puntos de
   muestreo. No es criptográfico y no hace falta que lo sea — aquí no se
   protege un secreto, se demuestra que nadie eligió a dedo. */
function generadorConSemilla(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Una semilla legible, que es parte de la prueba: quien la vea sabe de qué
   lote y de qué momento salió, y puede repetir el sorteo. */
function semillaDeLote(proyecto, lote, cuando) {
  const txt = `${proyecto || "?"}|lote-${lote}|${cuando}`;
  let h = 2166136261 >>> 0;                      // FNV-1a
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return { texto: txt, valor: h >>> 0 };
}

/* Sortea un punto dentro de cada sub-lote.

   El punto NO es «el camión número 3»: es **el metro cúbico** dentro del
   sub-lote donde toca muestrear. Se dice así porque en el momento del sorteo
   todavía no se sabe cuántos camiones van a hacer falta ni de qué tamaño
   vendrán, y porque la 934 divide por volumen y no por camiones.

   Al llegar el hormigón, le toca al camión que **cruza** esa marca. */
function sortearMuestreo(opciones) {
  const o = opciones || {};
  const nSublotes = o.sublotes || Math.ceil(SP934_LOTE_M3 / SP934_SUBLOTE_M3);
  const subM3 = o.subloteM3 || SP934_SUBLOTE_M3;
  const cuando = o.cuando;                        // ISO, lo pone quien llama
  if (!cuando) return null;                       // sin sello de tiempo no hay prueba

  const semilla = semillaDeLote(o.proyecto, o.lote, cuando);
  const azar = generadorConSemilla(semilla.valor);

  const puntos = [];
  for (let i = 0; i < nSublotes; i++) {
    /* Uniforme dentro del sub-lote, en metros cúbicos desde su comienzo.
       Se redondea a dos decimales: más precisión sería falsa, porque nadie
       mide el hormigón colocado al centímetro cúbico. */
    const dentro = red(azar() * subM3, 2);
    puntos.push({
      sublote: i + 1,
      m3DelSublote: dentro,
      m3DelLote: red(i * subM3 + dentro, 2),
    });
  }

  return {
    lote: o.lote,
    proyecto: o.proyecto || null,
    cuando,
    quien: o.quien || null,
    semilla: semilla.texto,
    metodo: "ASTM D3665 · mulberry32 con semilla FNV-1a",
    puntos,
  };
}

/* A qué camión le toca. Se resuelve con el hormigón ya colocado, pero la
   decisión estaba tomada antes: aquí solo se mira qué camión cruzó la marca.

   Devuelve, por sub-lote, el ensayo que cruza el punto sorteado. Si el
   sub-lote todavía no ha llegado a esa marca, el camión está por venir y se
   dice así — no se elige el más cercano, que sería volver a decidir a mano. */
function muestrasDelSorteo(lote, sorteo) {
  if (!lote || !sorteo) return [];
  const salida = [];
  for (const p of sorteo.puntos) {
    const sub = (lote.sublotes || []).find((s) => s.n === p.sublote);
    if (!sub) { salida.push({ ...p, estado: "sin-hormigon", ensayo: null }); continue; }
    let acum = 0, elegido = null;
    for (const t of sub.ensayos) {
      const antes = acum;
      acum += m3DeCY(t.vol);
      if (antes <= p.m3DelSublote && acum > p.m3DelSublote) { elegido = t; break; }
    }
    salida.push(elegido
      ? { ...p, estado: "asignado", ensayo: elegido }
      : { ...p, estado: acum >= p.m3DelSublote ? "sin-asignar" : "por-llegar", ensayo: null });
  }
  return salida;
}

/* Rehacer el sorteo desde su semilla y comprobar que da lo mismo. Es lo que
   se le enseña a quien lo discuta, y lo que corre la prueba automática. */
function verificarSorteo(sorteo) {
  if (!sorteo || !sorteo.semilla) return false;
  const rehecho = generadorConSemilla(semillaDeLote(
    sorteo.proyecto, sorteo.lote, sorteo.cuando).valor);
  const subM3 = SP934_SUBLOTE_M3;
  return sorteo.puntos.every((p, i) => red(rehecho() * subM3, 2) === p.m3DelSublote);
}
