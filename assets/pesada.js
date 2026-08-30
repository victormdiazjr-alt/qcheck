/* ============================================================
   LA PESADA — Q-159, 30 de agosto de 2026.

   Víctor: «es la evidencia de las proporciones de materiales y es una data
   bien útil para tú rápidamente numéricamente detectar anomalías desde antes
   de descargar el camión».

   QUÉ ES
   ------
   El recibo de los pesos del batch. Viene IMPRESO EN LA MISMA HOJA que el
   conduce, debajo, y se entrega con él. O sea que la foto que el técnico ya
   saca del conduce trae la pesada dentro: no hay trabajo nuevo en obra.

   Los une el `ULink Tkt`, que es el número del conduce. Esa es la costura.

   QUÉ TRAE QUE EL CONDUCE NO
   --------------------------
   El conduce dice qué se vendió. La pesada dice **qué se pesó**: cuánto
   cemento, cuánta piedra, cuánta arena, cuánta agua, y contra qué objetivo.
   Es la única prueba de las proporciones, y llega a la obra ANTES de que el
   camión descargue.

   EL SUBMITTAL NO HACE FALTA PARA LO IMPORTANTE
   ---------------------------------------------
   El diseño de mezcla aprobado lo tiene Rubén, y sin él no se puede decir
   «fuera de especificación». Pero casi nada de lo que sigue lo necesita:

     · La pesada trae su PROPIO objetivo por material. La desviación se mide
       contra él, no contra el submittal.
     · Los otros dieciséis camiones del mismo tiro dicen cuál es lo normal.
       Un camión a 0.44 canta aunque nadie sepa cuál es el máximo aprobado.
     · El agua que se puede añadir la dice la propia pesada
       («Water available to add»), porque el diseño ya la reservó.

   Cuando llegue el submittal se le añade el límite duro y ya está: una línea
   más en la ficha del proyecto. Nada de esto cambia.

   EL AGUA, QUE ES LO QUE MÁS SE MALINTERPRETA
   -------------------------------------------
   El camión NO llega con el agua de diseño. Llega corto a propósito: la
   planta retiene unos galones para que el técnico los añada en obra si el
   slump lo pide. En el camión 116 del 29 de agosto:

       diseño        34.0 gal/CY × 10 CY = 340 gal
       humedad de los áridos                59.4 gal   (ya va dentro de la piedra y la arena)
       agua en balanza                     250.4 gal
       retenida para la obra                 30.0 gal   ← «Water available to add»

   Así que la relación agua/cemento que trae el camión (0.394) NO es la del
   diseño: la del diseño es la que sale al añadir los 30 galones, 0.434.
   Añadir esos 30 galones es CUMPLIR el diseño. Añadir el galón 31 es salirse.

   > La bandera no es el agua que se añade. Es el agua que se añade DE MÁS.

   Y eso se sabe sin submittal, porque la reserva viene impresa en el papel.

   ESTE ARCHIVO NO TOCA LA PANTALLA
   --------------------------------
   Solo lee texto y devuelve números, para que se pueda probar en el banco sin
   navegador — y para que el día que QBatch mande la pesada por su cuenta,
   entre por la misma puerta que hoy usa el texto pegado a mano.
   ============================================================ */
"use strict";

/* TOLERANCIAS DE DOSIFICACIÓN — ASTM C94 §9.3, en por ciento del objetivo.
   No son de la obra ni del proyecto: son de la norma que la propia planta
   dice cumplir en el conduce («La norma C-94 del ASTM dispone…»). Por eso se
   pueden aplicar hoy, sin esperar a nadie. */
const PESADA_TOL = { cemento: 1, arido: 2, agua: 1, aditivo: 3 };

/* Peso del agua. 8.33 lb/gal a temperatura de obra. Se usa para pasar los
   galones de la balanza a libras y poder dividir por el cemento. */
const LB_GALON = 8.33;

/* Un aditivo se dosifica en onzas líquidas y pesa algo más que el agua
   (~8.9 lb/gal). Son treinta libras de cuarenta mil: se cuentan porque el peso
   total tiene que ser el peso total, no porque cambien nada. */
const LB_ONZA_ADITIVO = 8.9 / 128;

/* ------------------------------------------------------------ 1. leer

   El bloque de la pesada es texto de impresora de matriz: columnas alineadas
   con espacios, sin separadores. Se lee línea a línea y con tolerancia, porque
   el mismo papel sale distinto de cada planta y mañana saldrá de un lector
   automático que se comerá algún espacio.

   La regla de oro: **anclar por la derecha**. El nombre del material puede
   llevar números dentro («PIEDRA 3/4 SA») y puede llevar dos palabras o
   cuatro, pero lo que nunca cambia es que la fila termina en
   `objetivo  real  unidad`. Se busca eso y lo de delante se desmonta hacia
   atrás. Empezar por la izquierda fue el primer intento y partía la piedra
   de 3/4 en dos. */

/* ¿Este trozo es un número de los que la impresora pone entre el nombre y el
   objetivo? Silo, bin, humedad `3.50/0.00%`, diseño `1419/1419`. */
function _pesadaEsRelleno(tk) {
  return /^\d+$/.test(tk) || /^[\d.]+\/[\d.]+%?$/.test(tk);
}

function _pesadaFila(linea) {
  /* objetivo, real y unidad, al final de la parte útil de la línea. */
  const m = linea.match(/^(.*?)\s+([\d.,]+)\s+([\d.,]+)\s+(Lb|Oz|Ga)\b/i);
  if (!m) return null;
  const num = (s) => { const n = Number(String(s).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
  const target = num(m[2]), actual = num(m[3]);
  if (target == null || actual == null) return null;

  /* Y ahora hacia atrás, quitando el relleno hasta topar con el nombre. */
  const tk = m[1].trim().split(/\s+/);
  let humedad = null, diseno = null;
  while (tk.length > 1 && _pesadaEsRelleno(tk[tk.length - 1])) {
    const t = tk.pop();
    if (/%$/.test(t)) { const h = Number(t.split("/")[0]); if (Number.isFinite(h)) humedad = h; }
    else if (t.includes("/")) { const d = Number(t.split("/")[0]); if (Number.isFinite(d)) diseno = d; }
  }
  const nombre = tk.join(" ").trim();
  if (!nombre) return null;
  return { nombre, target, actual, unidad: m[4].toLowerCase(), humedad, diseno };
}

/* Saca un número suelto de una etiqueta: `Water/Cement: 0.394` → 0.394. */
function _pesadaTras(txt, etiqueta) {
  const re = new RegExp(etiqueta + "\\s*:?\\s*([\\d.]+)", "im");
  const m = txt.match(re);
  return m ? Number(m[1]) : null;
}

/* Lee el bloque entero. Devuelve el objeto que se guarda en la ficha del
   camión, o `null` si el texto no es una pesada. */
function parsearPesada(texto) {
  if (!texto || typeof texto !== "string") return null;
  const t = texto.replace(/\r/g, "");
  const mats = [];
  for (const linea of t.split("\n")) {
    if (/^\s*Material\b/i.test(linea)) continue;          /* la cabecera de la tabla */
    const f = _pesadaFila(linea);
    if (f) mats.push(f);
  }
  if (!mats.length) return null;

  const str = (re) => { const m = t.match(re); return m ? m[1].trim() : null; };
  const p = {
    planta:  str(/Plant\s*:?\s*([A-Za-z0-9_\-]+)/i),
    ticket:  str(/ULink\s*Tkt\s*:?\s*(\S+)/i),
    camion:  str(/Truck\s*:?\s*(\S+)/i),
    mezcla:  str(/^\s*Mix\s*:?\s*(\S+)/im),
    ref:     str(/Ref#\s*:?\s*(\S+)/i),
    obra:    str(/Job\s*:?\s*#?(\S+)/i),
    /* `Time:06:44/06:50` — cuándo empezó y cuándo terminó de cargar. */
    carga:   str(/Time\s*:?\s*(\d{1,2}:\d{2}\/\d{1,2}:\d{2})/i),
    cy:      _pesadaTras(t, "Amount"),
    /* Lo que la propia planta calcula. Se guarda tal cual, sin tocarlo: es
       parte de la evidencia, y sirve para contrastar nuestra propia cuenta. */
    ac:      _pesadaTras(t, "Water\\/Cement"),
    rend:    _pesadaTras(t, "Yield"),
    humedad: _pesadaTras(t, "Total moisture"),
    reserva: _pesadaTras(t, "Water available to add"),
    aguaCY:  _pesadaTras(t, "Water\\/CY"),
    slump:   _pesadaTras(t, "^\\s*Slump"),
    /* Cada material en cuatro casillas, que ocupan la cuarta parte que un
       objeto con nombres — y en el almacén de un iPad eso se nota. */
    mats: mats.map((m) => [m.nombre, m.target, m.actual, m.unidad, m.diseno, m.humedad]),
  };
  if (p.mezcla) p.mezcla = p.mezcla.replace(/\*+$/, "");
  return p;
}

/* Vuelve a poner nombres a las casillas, para no escribir `m[2]` por ahí. */
function pesadaMateriales(p) {
  if (!p || !Array.isArray(p.mats)) return [];
  return p.mats.map((m) => ({
    nombre: m[0], target: m[1], actual: m[2], unidad: m[3], diseno: m[4], humedad: m[5],
    tipo: pesadaTipo(m[0]),
  }));
}

function pesadaTipo(nombre) {
  const n = String(nombre || "").toUpperCase();
  if (/CEMENT|CEMENTO|FLY\s*ASH|CENIZA|SLAG|ESCORIA|POZOL/.test(n)) return "cemento";
  if (/WATER|AGUA/.test(n)) return "agua";
  if (/PIEDRA|GRAVA|ARENA|SAND|STONE|GRAVEL|AGG|POLVO|#\d/.test(n)) return "arido";
  return "aditivo";
}

/* ------------------------------------------------------------ 2. contar */

/* Desviación de cada material contra el objetivo de la propia pesada, y si
   pasa de la tolerancia de la C94. Aquí no interviene el submittal. */
function pesadaDesvios(p) {
  return pesadaMateriales(p).map((m) => {
    const pct = m.target ? ((m.actual - m.target) / m.target) * 100 : null;
    const tol = PESADA_TOL[m.tipo];
    return { ...m, pct, tol,
      /* La zona de acción empieza en dos tercios de la tolerancia: un cemento
         a 0.8 % todavía cumple, pero ya no está centrado, y ver eso venir es
         justo el punto de mirar la pesada antes de descargar.

         Dos tercios y no la mitad porque la planta batcha a propósito un poco
         por debajo del objetivo —el agua del 29 de agosto salió a −0.56 % en
         todos los camiones— y pintar de ámbar una columna entera en un tiro
         normal es enseñar ruido, que es la forma más rápida de que dejen de
         mirar la pantalla. */
      zona: pct == null ? null : Math.abs(pct) > tol ? "susp" : Math.abs(pct) > tol * 2 / 3 ? "act" : "ok" };
  });
}

function _uno(p, tipo) { return pesadaMateriales(p).filter((m) => m.tipo === tipo); }
function _suma(l, campo) { return l.reduce((a, m) => a + (Number(m[campo]) || 0), 0); }

/* El cemento del camión, en libras. Suma cemento y cementicios. */
function pesadaCemento(p) {
  const l = _uno(p, "cemento");
  return l.length ? _suma(l, "actual") : null;
}

/* EL AGUA, EN TRES PARTES.

   La que entró por la balanza, la que ya venía mojando los áridos, y la que
   el técnico añade en obra. Las tres cuentan igual para el cemento: al
   hormigón le da lo mismo por dónde entró el agua. */
function pesadaAgua(p, galObra) {
  const l = _uno(p, "agua");
  if (!l.length) return null;
  const balanzaGa = _suma(l, "actual");
  const humedadGa = Number(p.humedad) || 0;
  const obraGa = Number(galObra) || 0;
  return {
    balanzaGa, humedadGa, obraGa,
    totalGa: balanzaGa + humedadGa + obraGa,
    totalLb: (balanzaGa + humedadGa + obraGa) * LB_GALON,
    reservaGa: p.reserva == null ? null : Number(p.reserva),
    /* Lo que sobra de la reserva es agua que nadie autorizó. */
    excesoGa: p.reserva == null ? null : Math.max(0, obraGa - Number(p.reserva)),
  };
}

/* Agua entre cemento, contada por nosotros y no leída del papel. Sirve para
   dos cosas: para saber en cuánto queda si se añade agua, y para comprobar
   que el número impreso cuadra. */
function pesadaAC(p, galObra) {
  const c = pesadaCemento(p);
  const a = pesadaAgua(p, galObra);
  if (!c || !a) return null;
  return a.totalLb / c;
}

/* Cuánto sube la relación por cada galón que se añade. En un camión de 10 CY
   son ~0.0013: el técnico puede ver, antes de firmar, dónde lo deja. */
function pesadaPorGalon(p) {
  const c = pesadaCemento(p);
  return c ? LB_GALON / c : null;
}

/* EL RENDIMIENTO, QUE ES DONDE QCHECK APORTA LO SUYO — y no es poco.

   La planta calcula el rendimiento con el peso unitario de DISEÑO, porque es
   el único que tiene. QCheck mide el de verdad con el balde, en obra, en ese
   camión. Con el peso de la balanza —que es un hecho— y el peso unitario
   medido —que es otro hecho— el rendimiento sale sin suponer nada.

   El 29 de agosto el camión 121 facturó 10.00 yardas: el ticket calculó 9.93
   y con el peso unitario medido salieron 9.97. Cuatro centésimas por camión,
   diecisiete camiones, y eso es lo que nadie estaba mirando. */
function pesadaPesoTotal(p, galObra) {
  const ms = pesadaMateriales(p);
  if (!ms.length) return null;
  let lb = 0;
  for (const m of ms) {
    const v = Number(m.actual) || 0;
    if (m.unidad === "lb") lb += v;
    else if (m.unidad === "ga") lb += v * LB_GALON;
    else if (m.unidad === "oz") lb += v * LB_ONZA_ADITIVO;
  }
  /* La humedad de los áridos NO se suma: ya va dentro de sus libras, que se
     pesan mojadas. El agua de obra sí, que entra después de la balanza. */
  return lb + (Number(galObra) || 0) * LB_GALON;
}

function pesadaRendimiento(p, uwMedido, galObra) {
  const lb = pesadaPesoTotal(p, galObra);
  if (!lb || !uwMedido) return null;
  return lb / (Number(uwMedido) * 27);
}

/* ------------------------------------------------------------ 3. avisar

   Las banderas. Todas salen de la propia pesada o de comparar el camión con
   sus hermanos del mismo tiro; ninguna necesita el diseño de mezcla aprobado.

   `ctx` lleva lo que el camión solo no puede saber:
     · `hermanos` — las pesadas de los demás camiones del mismo día.
     · `uw`       — el peso unitario medido de ESTE camión.
     · `vol`      — las yardas facturadas en el conduce.
     · `galObra`  — el agua añadida en obra.  */
function _mediana(xs) {
  const l = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!l.length) return null;
  const m = l.length >> 1;
  return l.length % 2 ? l[m] : (l[m - 1] + l[m]) / 2;
}

function pesadaBanderas(p, ctx = {}) {
  if (!p) return [];
  const av = [];
  const galObra = Number(ctx.galObra) || 0;
  const di = (nivel, titulo, detalle) => av.push({ nivel, titulo, detalle });

  /* 1. DOSIFICACIÓN. Lo primero, porque es lo único que ya es una falta:
        la planta declara la C94 en el propio conduce. */
  for (const d of pesadaDesvios(p)) {
    if (d.zona === "susp") {
      di("susp", `${d.nombre} fuera de tolerancia`,
        `${fmtN(d.actual)} contra ${fmtN(d.target)} ${d.unidad} · ${fmtN(d.pct, 2)} % ` +
        `(ASTM C94 permite ±${d.tol} % en ${d.tipo})`);
    }
  }

  /* 2. AGUA DE MÁS. La reserva viene impresa; pasarse de ella es salirse del
        diseño, y es lo único de esta lista que todavía se puede evitar
        —el camión no ha descargado. */
  const agua = pesadaAgua(p, galObra);
  if (agua && agua.excesoGa > 0) {
    const ac = pesadaAC(p, galObra), acLim = pesadaAC(p, agua.reservaGa);
    di("susp", `Agua por encima de la autorizada`,
      `${fmtN(galObra, 1)} gal añadidos y el diseño solo reservaba ${fmtN(agua.reservaGa, 1)}. ` +
      `A/C queda en ${fmtN(ac, 3)} en vez de ${fmtN(acLim, 3)}.`);
  }

  /* 3. ESTE CAMIÓN CONTRA LOS DEMÁS DEL TIRO. Sin submittal, los hermanos son
        la referencia: si dieciséis vienen a 0.39 y uno a 0.44, ese uno se
        mira, y no hace falta saber cuál es el máximo aprobado para decirlo.
        Con menos de tres hermanos no se dice nada: dos números no hacen una
        costumbre. */
  const acs = (ctx.hermanos || []).map((h) => pesadaAC(h)).filter(Number.isFinite);
  if (acs.length >= 3) {
    const mio = pesadaAC(p), med = _mediana(acs);
    if (mio != null && med != null && Math.abs(mio - med) >= 0.02) {
      di("act", `A/C fuera de lo normal en este tiro`,
        `${fmtN(mio, 3)} contra ${fmtN(med, 3)} de los otros ${acs.length} camiones.`);
    }
  }

  /* 4. CEMENTO POR YARDA. Si a un camión le cae otra dosis de cemento por
        yarda que a sus hermanos, lo más probable es que traiga otra mezcla.
        Vale la pena preguntarlo antes de descargarlo, no después. */
  const cyDe = (x) => { const c = pesadaCemento(x), v = Number(x && x.cy); return c && v ? c / v : null; };
  const cems = (ctx.hermanos || []).map(cyDe).filter(Number.isFinite);
  if (cems.length >= 3) {
    const mio = cyDe(p), med = _mediana(cems);
    if (mio != null && med && Math.abs(mio - med) / med > 0.02) {
      di("act", `Cemento por yarda distinto al del tiro`,
        `${fmtN(mio, 0)} lb/CY contra ${fmtN(med, 0)} de los demás. ¿Es la misma mezcla?`);
    }
  }

  /* 5. RENDIMIENTO. Con el peso de la balanza y el peso unitario medido, lo
        que llegó de verdad. Menos de lo facturado es hormigón que se pagó y
        no vino. */
  const vol = Number(ctx.vol);
  const rend = pesadaRendimiento(p, ctx.uw, galObra);
  if (rend && vol) {
    const falta = (vol - rend) / vol;
    if (falta > 0.02) di("susp", `Rendimiento corto`,
      `${fmtN(rend, 2)} CY medidas contra ${fmtN(vol, 2)} facturadas (${fmtN(falta * 100, 1)} % de menos).`);
    else if (falta > 0.01) di("act", `Rendimiento por debajo de lo facturado`,
      `${fmtN(rend, 2)} CY medidas contra ${fmtN(vol, 2)} facturadas.`);
  }

  /* 6. EL PAPEL NO CUADRA CONSIGO MISMO. Nuestra cuenta contra la impresa. Si
        no coinciden, o la pesada se leyó mal o el papel no es lo que dice ser.
        En los dos casos hay que mirarlo antes de darlo por bueno. */
  if (p.ac != null) {
    const mio = pesadaAC(p);
    if (mio != null && Math.abs(mio - p.ac) > 0.01) {
      di("act", `La pesada no cuadra con lo que ella misma imprime`,
        `A/C impresa ${fmtN(p.ac, 3)}, y de sus propios pesos sale ${fmtN(mio, 3)}.`);
    }
  }

  const orden = { susp: 0, act: 1, nota: 2 };
  return av.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

/* Un formateador propio y diminuto: este archivo también corre en el banco de
   pruebas, donde `fmt` de core.js no existe. */
function fmtN(v, d = 1) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : "—";
}

/* La peor bandera de un camión, para pintar una casilla en la tabla. */
function pesadaZona(p, ctx) {
  const b = pesadaBanderas(p, ctx);
  if (b.some((x) => x.nivel === "susp")) return "susp";
  if (b.some((x) => x.nivel === "act")) return "act";
  return p ? "ok" : null;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parsearPesada, pesadaMateriales, pesadaTipo, pesadaDesvios,
    pesadaCemento, pesadaAgua, pesadaAC, pesadaPorGalon, pesadaPesoTotal,
    pesadaRendimiento, pesadaBanderas, pesadaZona, PESADA_TOL, LB_GALON };
}
