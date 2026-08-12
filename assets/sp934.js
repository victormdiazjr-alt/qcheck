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
  const v = (valores || []).map(cifra).filter((x) => x != null);
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
  const o = cifra(objetivo);
  if (o == null) return { lsl: null, usl: null };
  return { lsl: red(o - SP934_CUW_TOLERANCIA, 4), usl: red(o + SP934_CUW_TOLERANCIA, 4) };
}

/* TABLA 934-2 del borrador FINAL del 5 de diciembre de 2025.

   La permeabilidad solo tiene techo, y el nivel 1 no se juzga.

   CORREGIDO EL 10 DE AGOSTO DE 2026. Decía **1950** y citaba una «Tabla
   934-4» que en el borrador de diciembre ya no existe: la permeabilidad está
   en la 934-2 y su techo es **1,500 coulombs**. El 1950 venía de un borrador
   anterior — la numeración de las tablas cambió con él, que es la señal de
   que la fuente era otra edición.

   Un techo 450 coulombs más alto de la cuenta **no da ningún error**: acepta
   hormigón que la especificación rechaza, en la característica que pesa el
   45 % del factor de pago. Es el fallo de la edición vieja en el sitio más
   caro posible.

   La nota 7 de esa misma tabla, además, fija el defecto: **si los planos no
   indican nivel, se usa el 2 en todas las mezclas de la obra.** */
const SP934_CP_USL = { "1": null, "2": 1500 };
const SP934_CP_NIVEL_POR_DEFECTO = "2";

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

/* `Number(null)` es 0 y `Number.isFinite(0)` es cierto. Ese descuido ya costó
   un lote sano rechazado (Q-63) y volvió a colarse una hora después en
   `fmtVolumen`. Así que deja de estar al alcance: **en este archivo no se
   llama a `Number()` a pelo**, se llama a esto.

   Devuelve `null` para lo que no es un número, incluidos `null`, `undefined`
   y la cadena vacía. Un cero de verdad sigue siendo un cero. Q-64. */
function cifra(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function m3DeCY(cy) { const n = cifra(cy); return n == null ? 0 : n * CY_A_M3; }
function cyDeM3(m3) { const n = cifra(m3); return n == null ? 0 : n / CY_A_M3; }

/* LAS DOS UNIDADES SIEMPRE JUNTAS — Q-64, 8 de agosto de 2026.

   La 934 mide en metros cúbicos: el lote son 250 y el sub-lote 25. El conduce
   viene en yardas y la obra habla en yardas. Enseñar solo una obliga a
   convertir de cabeza, y convertir de cabeza a media mañana es como se cuelan
   los errores.

   Una sola función para que la pareja no pueda separarse. Si mañana alguien
   cambia el formato, cambia en los dos sitios a la vez o en ninguno. */
function fmtVolumen(m3, dec) {
  const n = cifra(m3);
  if (n == null) return "—";
  const d = dec == null ? 1 : dec;
  return `${n.toFixed(d)} m³ (${cyDeM3(n).toFixed(d)} CY)`;
}

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
  /* `Number(null)` es **0**, no NaN — y `Number.isFinite(0)` es cierto.

     Con el filtro anterior, un ensayo sin resistencia todavía (`cs28: null`,
     que es lo normal hasta que el laboratorio rompe los cilindros) entraba
     como un cero y arrastraba la media del sub-lote al suelo. En pantalla se
     veía «n 3 · media 0 · PWL 0 %» y el lote salía rechazado por no tener
     todavía los resultados que aún no podían existir.

     Es el fallo más caro que puede tener este archivo: un hueco convertido en
     dato, que es justo lo que DECISIONS §3 prohíbe. Se vio mirando la
     pantalla, no leyendo el código. Q-63, 8 ago 2026. */
  const v = [];
  for (const t of sublote.ensayos || []) {
    const n = cifra(t[campo]);
    if (n != null) v.push(n);
  }
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
    /* SE SORTEA UNA FRACCIÓN, NO UN METRO CÚBICO — y esto importa.

       El primer intento sorteaba una posición absoluta dentro de los 25 m³
       nominales. La prueba lo tumbó: los camiones no vienen de 25 m³ —vienen
       de 7,65— así que un sub-lote acaba con lo que acaba, y dos de cada diez
       terminaban antes del punto sorteado. Esos sub-lotes se quedaban sin
       muestrear, que es justo lo que la 934 no permite.

       Sorteando una fracción de 0 a 1 el punto siempre cae dentro, porque se
       aplica a lo que el sub-lote de verdad tuvo. Y no se pierde nada de lo
       que hace defendible el sorteo: la fracción se sortea y se firma ANTES,
       igual que antes; lo único que espera es la regla con la que se mide.

       `m3Estimado` va solo para que el técnico sepa por dónde andará. No
       decide nada. */
    const fraccion = red(azar(), 6);
    puntos.push({
      sublote: i + 1,
      fraccion,
      m3Estimado: red(fraccion * subM3, 2),
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
    if (!sub || !sub.ensayos.length) {
      salida.push({ ...p, estado: "sin-hormigon", ensayo: null, m3: null });
      continue;
    }
    /* La fracción se mide contra lo que ese sub-lote tuvo de verdad. */
    const total = sub.ensayos.reduce((a, t) => a + m3DeCY(t.vol), 0);
    const marca = p.fraccion * total;
    let acum = 0, elegido = null;
    for (const t of sub.ensayos) {
      const antes = acum;
      acum += m3DeCY(t.vol);
      if (antes <= marca && acum > marca) { elegido = t; break; }
    }
    /* Con la fracción entre 0 y 1 y el total mayor que cero, siempre hay uno.
       El último camión cubre el borde por si la coma flotante lo empuja. */
    if (!elegido) elegido = sub.ensayos[sub.ensayos.length - 1];
    salida.push({ ...p, estado: "asignado", ensayo: elegido, m3: red(marca, 2) });
  }
  return salida;
}

/* Rehacer el sorteo desde su semilla y comprobar que da lo mismo. Es lo que
   se le enseña a quien lo discuta, y lo que corre la prueba automática. */
function verificarSorteo(sorteo) {
  if (!sorteo || !sorteo.semilla) return false;
  const rehecho = generadorConSemilla(semillaDeLote(
    sorteo.proyecto, sorteo.lote, sorteo.cuando).valor);
  return sorteo.puntos.every((p) => red(rehecho(), 6) === p.fraccion);
}

/* ══════════════════════════════════════════════════════════════════════════
   CILINDROS Y CADENA DE CUSTODIA — M3. Q-61, 8 de agosto de 2026.

   La 934 pide, por sub-lote:

     · **6 cilindros** de resistencia, a dos edades (934-6.01-b-1)
     · **2 cilindros** de permeabilidad, AASHTO T 277 — solo si el proyecto la
       inspecciona
     · **2 por LOTE** de tensión indirecta, «for information purposes»

   Las edades salen del plan y no del código: 7 y 28 días normalmente, 7 y 56
   en tablero de puente. Ya se aprendió por las malas en Q-59, clavando 28 en
   un proyecto de 5 días — la pantalla rendía perfecta con números falsos.

   Y una fecha que el programa puede vigilar y una persona olvida: la 934 exige
   **coordinar con el laboratorio de la Autoridad 48 horas antes del vaciado**
   (934-6.01-f). Eso no es un dato, es un aviso.
   ══════════════════════════════════════════════════════════════════════════ */

const SP934_CILINDROS = {
  ccs: 6,          // resistencia, por sub-lote
  cp: 2,           // permeabilidad, por sub-lote
  tension: 2,      // tensión indirecta, por LOTE — solo informativo
};
const SP934_AVISO_LAB_HORAS = 48;

/* Las edades a las que se rompe. `tablero` cambia la segunda de 28 a 56. */
function edadesDeRotura(plan) {
  const p = plan || {};
  if (Array.isArray(p.edades) && p.edades.length) return p.edades.slice();
  return p.tablero ? [7, 56] : [7, 28];
}

/* Qué cilindros hacen falta para un lote, sub-lote por sub-lote.

   Se calcula sobre los sub-lotes QUE EXISTEN. Un sub-lote que aún no ha
   recibido hormigón no debe cilindros: pedirlos sería inventar trabajo, y el
   técnico aprendería a ignorar la lista. */
function cilindrosDelLote(lote, opciones) {
  const o = opciones || {};
  const edades = edadesDeRotura(o.plan);
  const conCP = !!o.permeabilidad;
  const filas = [];

  for (const s of lote.sublotes || []) {
    if (!s.ensayos || !s.ensayos.length) continue;
    filas.push({
      lote: lote.n, sublote: s.n, tipo: "ccs",
      cuantos: SP934_CILINDROS.ccs, edades,
      norma: "AASHTO T 22",
      etiqueta: `L${lote.n}-S${s.n}-CCS`,
    });
    if (conCP) filas.push({
      lote: lote.n, sublote: s.n, tipo: "cp",
      cuantos: SP934_CILINDROS.cp, edades: null,
      norma: "AASHTO T 277 / PRHTA T934-10",
      etiqueta: `L${lote.n}-S${s.n}-CP`,
    });
  }

  /* La tensión indirecta va por lote, no por sub-lote, y solo informa: no
     entra en ningún factor de pago. Se dice, para que nadie la cuente. */
  if (filas.length) filas.push({
    lote: lote.n, sublote: null, tipo: "tension",
    cuantos: SP934_CILINDROS.tension, edades: [28],
    norma: "AASHTO T 198", informativo: true,
    etiqueta: `L${lote.n}-TENSION`,
  });

  return filas;
}

/* Cuándo vence cada rotura. Sale de la fecha en que se hizo el cilindro, no
   de la del lote: dos sub-lotes del mismo lote pueden ser de días distintos. */
function vencimientosDeCilindro(fechaHecho, edades) {
  if (!fechaHecho) return [];
  return (edades || []).map((d) => {
    const f = new Date(fechaHecho + "T00:00:00Z");
    f.setUTCDate(f.getUTCDate() + d);
    return { edad: d, vence: f.toISOString().slice(0, 10) };
  });
}

/* El estado de un juego de cilindros. Lo que importa no es que exista el
   registro, sino **qué falta y desde cuándo**. */
function estadoDeCilindros(juego, hoy) {
  const h = hoy || null;
  if (!juego || !juego.hecho) return { estado: "pendiente", texto: "Sin hacer" };
  if (!juego.entregado) return { estado: "en-obra", texto: "Hecho, sin entregar al laboratorio" };
  const vencidos = (juego.roturas || []).filter((r) => r.resultado == null && h && r.vence < h);
  if (vencidos.length) return {
    estado: "vencido",
    texto: `${vencidos.length} rotura(s) vencida(s) sin resultado`,
    dias: vencidos.map((r) => diasEntre(r.vence, h)),
  };
  const faltan = (juego.roturas || []).filter((r) => r.resultado == null);
  if (faltan.length) return { estado: "esperando", texto: `Esperando ${faltan.length} rotura(s)` };
  return { estado: "completo", texto: "Completo" };
}

/* El aviso de las 48 horas. La 934 obliga a coordinar con el laboratorio de
   la Autoridad antes del vaciado; el programa lo sabe y la persona no siempre.

   Devuelve `null` cuando no hay nada que decir — un aviso que sale siempre
   deja de ser un aviso (Q-56). */
function avisoLaboratorio(diaDelVaciado, ahora, yaCoordinado) {
  if (!diaDelVaciado || !ahora || yaCoordinado) return null;
  const vaciado = new Date(diaDelVaciado + "T06:00:00Z");
  const horas = (vaciado - new Date(ahora)) / 3600000;
  if (horas < 0) return null;                       // ya pasó: no se avisa de lo que no tiene arreglo
  if (horas >= SP934_AVISO_LAB_HORAS) return null;  // todavía hay margen
  return {
    horas: Math.round(horas),
    texto: horas <= 0
      ? "El vaciado es hoy y no consta coordinación con el laboratorio."
      : `Quedan ${Math.round(horas)} h para el vaciado y no consta coordinación con el laboratorio (la SP-934 pide 48).`,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   EL REPORTE DE LOTE — M4. Q-62, 8 de agosto de 2026.

   Es el documento que mira la Autoridad y el que se firma. Todo lo demás de
   este archivo existe para poder emitirlo.

   **La regla que lo gobierna: nadie firma un número que no puede
   reconstruir.** Por eso no basta con dar el PWL y el factor de pago — van
   también la media, la desviación, los índices de calidad y los porcentajes
   parciales, que son los pasos 1 a 10 del artículo 934-7.05. Quien reciba el
   reporte tiene que poder rehacer la cuenta con una calculadora y llegar a lo
   mismo.

   Y el sorteo del muestreo va dentro **con su semilla**, que es lo que
   convierte «se eligió al azar» en algo comprobable en vez de una promesa.

   Este archivo devuelve HTML, no pinta. Quien lo llama decide si lo enseña o
   lo manda a la impresora — igual que `reporteEscritoDelDia` en `core.js`.
   ══════════════════════════════════════════════════════════════════════════ */

function reporteDeLote(lote, opciones) {
  const o = opciones || {};
  const ev = sp934EvaluarLote(lote, o.limites || {});
  const esc = o.esc || ((s) => String(s == null ? "" : s));
  const fecha = o.fmtDate || ((d) => d);
  const n = (x, d = 2) => (x == null ? "—" : Number(x).toFixed(d));

  const cab = (k, v) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`;

  /* El detalle del cálculo, característica por característica. Es la parte
     que nadie más publica y la que hace el reporte defendible. */
  const detalle = Object.entries(ev.aqc).map(([clave, r]) => {
    const cfg = (o.limites || {})[clave] || {};
    return `
    <section class="aqc">
      <h3>${esc(cfg.n || clave.toUpperCase())} <span>${esc(cfg.u || "")}</span></h3>
      <table class="calculo">
        <tr><td class="k">Límite inferior (LSL)</td><td>${cfg.lsl == null ? "no aplica" : n(cfg.lsl, 1)}</td>
            <td class="k">Límite superior (USL)</td><td>${cfg.usl == null ? "no aplica" : n(cfg.usl, 1)}</td></tr>
        <tr><td class="k">Sub-lotes (n)</td><td>${r.n || 0}</td>
            <td class="k">Media</td><td>${n(r.media, 4)}</td></tr>
        <tr><td class="k">Desviación (s)</td><td>${n(r.s, 4)}</td>
            <td class="k">—</td><td></td></tr>
        <tr><td class="k">Índice superior (QU)</td><td>${n(r.qu, 4)}</td>
            <td class="k">Índice inferior (QL)</td><td>${n(r.ql, 4)}</td></tr>
        <tr><td class="k">% bajo el USL (PU)</td><td>${n(r.pu, 3)}</td>
            <td class="k">% sobre el LSL (PL)</td><td>${n(r.pl, 3)}</td></tr>
        <tr class="destacada">
          <td class="k">PWL = (PU + PL) − 100</td><td><b>${r.pwl == null ? "—" : n(r.pwl, 3) + " %"}</b></td>
          <td class="k">Factor de pago</td><td><b>${n(r.paf, 3)}</b></td></tr>
      </table>
      ${r.valores && r.valores.length
        ? `<p class="valores">Valores de sub-lote: ${r.valores.map((v) => n(v, 1)).join(" · ")}</p>` : ""}
      ${r.rechazado ? `<p class="rechazo">Esta característica RECHAZA el lote.</p>` : ""}
      ${r.pwl == null ? `<p class="nota">${esc(r.motivo || "")} — con menos de tres sub-lotes la norma no usa PWL sino la Tabla 934-11.</p>` : ""}
    </section>`;
  }).join("");

  /* El sorteo, con su semilla. Sin esto el muestreo es una promesa. */
  const sorteo = o.sorteo ? `
    <section class="sorteo">
      <h3>Muestreo aleatorio — ASTM D3665</h3>
      <table class="ficha">
        ${cab("Sorteado el", o.sorteo.cuando)}
        ${cab("Por", o.sorteo.quien || "—")}
        ${cab("Método", o.sorteo.metodo)}
        ${cab("Semilla", o.sorteo.semilla)}
      </table>
      <p class="nota">El sorteo se hizo antes de recibir el hormigón y se puede
      rehacer desde su semilla: el mismo lote y el mismo instante dan el mismo
      resultado.</p>
    </section>` : "";

  return `
  <article class="rep934">
    <header>
      <h1>Reporte de lote ${lote.n}</h1>
      <p class="sub">SP-934 · Aceptación estadística — Autoridad de Carreteras de Puerto Rico</p>
    </header>

    <table class="ficha">
      ${cab("Proyecto", o.proyecto || "—")}
      ${cab("Contratista", o.contratista || "—")}
      ${cab("Firma de control de calidad", o.qcFirm || "—")}
      ${cab("Clase de hormigón", (o.limites && o.limites.ccs && o.limites.ccs.clase) || "—")}
      ${cab("Diseño de mezcla", lote.mezcla || "—")}
      ${cab("Período", fecha(lote.desde) + (lote.hasta !== lote.desde ? " – " + fecha(lote.hasta) : ""))}
      ${cab("Hormigón colocado", fmtVolumen(lote.m3))}
      ${cab("Sub-lotes", lote.sublotes.length + " de 10" + (lote.parcial ? " — lote parcial" : ""))}
      ${cab("Camiones", lote.ensayos.length)}
    </table>

    <section class="veredicto ${ev.rechazado ? "malo" : ev.cpaf != null && ev.cpaf < 1 ? "medio" : "bueno"}">
      <div class="etiqueta">Factor compuesto de pago</div>
      <div class="cifra">${ev.cpaf == null ? "—" : n(ev.cpaf, 3)}</div>
      <div class="formula">${(o.limites || {}).cp
        ? "0.45 · CCS + 0.45 · CP + 0.10 · CUW"
        : "0.90 · CCS + 0.10 · CUW — el proyecto no inspecciona permeabilidad"}</div>
      ${ev.rechazado ? `<div class="aviso">LOTE RECHAZADO</div>` : ""}
    </section>

    ${detalle}
    ${sorteo}

    <section class="metodo">
      <h3>Cómo se calculó</h3>
      <p>El PWL —percent within limits— se obtiene por integración de la
      distribución beta, según el artículo 934-7.05, pasos 1 a 10. El cálculo de
      esta plataforma reproduce la Tabla 934-6 que publica la propia
      especificación para verificación manual, en 32 puntos con muestras de
      tres a diez sub-lotes.</p>
      <p>Un lote se rechaza cuando su PWL cae por debajo de 60 %. El nivel de
      calidad aceptable (AQL) es 90 %; por debajo se aplica ajuste de pago.</p>
    </section>

    <section class="firmas">
      <div><div class="linea"></div>Ingeniero de récord</div>
      <div><div class="linea"></div>Autoridad de Carreteras</div>
    </section>
  </article>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   HACIA DÓNDE VA EL LOTE — M7. Q-63, 8 de agosto de 2026.

   Hoy el factor de pago se sabe a los 28 días, cuando el cheque viene corto y
   ya hay hormigón puesto y curado. Con cinco sub-lotes de diez se puede saber
   antes — y antes todavía se puede ajustar la planta.

   **Pero proyectar es adivinar, y aquí no se adivina** (DECISIONS §3). Así que
   esto no dice «el lote va a acabar en 0.94». Dice tres cosas, y las tres son
   hechos:

     · **Lo que hay** — el PWL de los sub-lotes que ya existen. No es una
       predicción: es el lote a día de hoy.
     · **El techo** — a cuánto puede llegar como máximo si todo lo que falta
       sale clavado en el objetivo. Si el techo ya está por debajo de 1.000,
       el dinero está perdido y no hay nada que esperar.
     · **El suelo** — a cuánto cae si lo que falta sale en el límite.

   El techo es el número que cambia decisiones. Un contratista que ve que su
   techo bajó de 1.000 en el sub-lote cuatro tiene seis sub-lotes para hablar
   con la planta; el mismo contratista enterándose a los 28 días no tiene nada.
   ══════════════════════════════════════════════════════════════════════════ */

/* Rellena los sub-lotes que faltan con un valor y recalcula. No se guarda
   nada: es una cuenta de «qué pasaría si», y se dice así. */
function _conRelleno(valores, faltan, valor, lsl, usl) {
  const v = valores.concat(new Array(Math.max(0, faltan)).fill(valor));
  return pwlDeLote(v, lsl, usl);
}

function proyeccionDeLote(lote, limites, opciones) {
  const o = opciones || {};
  const porLote = o.sublotesPorLote || Math.ceil(SP934_LOTE_M3 / SP934_SUBLOTE_M3);
  const hechos = (lote.sublotes || []).length;
  const faltan = Math.max(0, porLote - hechos);

  const salida = { sublotes: hechos, faltan, cerrado: faltan === 0, aqc: {} };

  for (const [clave, cfg] of Object.entries(limites || {})) {
    if (!cfg) continue;
    const vals = (lote.sublotes || [])
      .map((s) => valorDeSublote(s, cfg.campo)).filter((x) => x != null);
    if (!vals.length) continue;

    const paf = clave === "ccs" ? pafCCS : clave === "cp" ? pafCP : pafCUW;
    const ahora = pwlDeLote(vals, cfg.lsl, cfg.usl);

    /* El techo: lo que falta sale en el centro de los límites, que es lo mejor
       que puede pasar. Con un solo límite, en el punto más alejado de él. */
    const centro = cfg.lsl != null && cfg.usl != null ? (cfg.lsl + cfg.usl) / 2
      : cfg.usl != null ? cfg.usl * 0.5 : cfg.lsl * 1.5;
    const techo = faltan ? _conRelleno(vals, faltan, centro, cfg.lsl, cfg.usl) : ahora;

    /* El suelo: lo que falta sale justo en el límite. */
    const borde = cfg.lsl != null ? cfg.lsl : cfg.usl;
    const suelo = faltan ? _conRelleno(vals, faltan, borde, cfg.lsl, cfg.usl) : ahora;

    salida.aqc[clave] = {
      n: vals.length,
      ahora: { pwl: ahora.pwl, paf: paf(ahora.pwl) },
      techo: { pwl: techo.pwl, paf: paf(techo.pwl) },
      suelo: { pwl: suelo.pwl, paf: paf(suelo.pwl) },
    };
  }

  const comp = (cual) => cpaf({
    ccs: salida.aqc.ccs ? salida.aqc.ccs[cual].paf : null,
    cp: salida.aqc.cp ? salida.aqc.cp[cual].paf : null,
    cuw: salida.aqc.cuw ? salida.aqc.cuw[cual].paf : null,
  });
  salida.cpaf = { ahora: comp("ahora"), techo: comp("techo"), suelo: comp("suelo") };

  /* La única frase que importa: ¿queda algo que salvar?

     Se dice cuando el techo cae por debajo de 1.000 —el lote ya no puede
     pagarse entero, haga lo que haga la planta— y cuando cae por debajo de
     0.90, que es el umbral de aceptación. Con el lote cerrado no se avisa: ya
     no es un aviso, es el resultado. */
  salida.aviso = null;
  if (!salida.cerrado && salida.cpaf.techo != null) {
    if (salida.cpaf.techo < 0.9) salida.aviso = {
      grave: true,
      texto: `Aunque lo que falta salga perfecto, este lote no puede pasar de ${salida.cpaf.techo.toFixed(3)}.`,
    };
    else if (salida.cpaf.techo < 1) salida.aviso = {
      grave: false,
      texto: `El techo de este lote ya bajó de 1.000: como mucho puede pagar ${salida.cpaf.techo.toFixed(3)}.`,
    };
  }
  return salida;
}
