/* ============================================================
   SIMULACIÓN — el tiro de hoy, ya en marcha.

   QCheck se enseña antes de usarse. Un tablero vacío no demuestra
   nada, así que al entrar el sistema arranca con un vaciado de hoy
   ya empezado: 90 yardas colocadas, nueve camiones recibidos y
   TODO A LA ESPERA DEL PRÓXIMO CAMIÓN.

   A partir de ahí no hay nada falso: se recibe el camión en
   Recepción, se entran las muestras en el iPad, el Field Display
   canta el veredicto y el progreso sube. Es la herramienta de
   verdad corriendo sobre un día ya empezado.

   Reglas:
   - **Cada acceso arranca un tiro nuevo.** Quien entra se encuentra
     siempre el mismo punto de partida —yarda 90, último camión hace
     3 minutos— y no lo que dejó a medias la visita anterior. Lo
     dispara el acceso poniendo una marca; la recoge `sembrarDia()`.
   - Fuera de eso, solo siembra si HOY no tiene ningún camión.
   - **El histórico no se toca nunca.** Los 397 ensayos del Excel y
     todos los días anteriores siguen enteros en Results y en las
     Control Charts: la simulación solo escribe sobre HOY.
   - **Si alguien programó un tiro de verdad, esto no se ejecuta.**
     `db.demo === false` apaga la simulación para siempre y ni el
     acceso la vuelve a encender. Ver `programarTiro()`.
   - Los ensayos que crea llevan `source: "demo"`, así que se
     distinguen y se pueden borrar sin tocar nada más.
   - Las horas son relativas a AHORA, no fijas: se abra a la hora
     que se abra, el último camión acaba de irse y el tiro está
     esperando al siguiente.
   ============================================================ */
"use strict";

const DEMO_CY_CAMION = 10;
const DEMO_CAMIONES = 9;               /* 9 x 10 = 90 yardas colocadas */
const DEMO_CY_LOSA = 20;               /* dos camiones por losa */
const DEMO_LOSAS = [
  "L3-0.443", "L3-0.437", "L3-0.429", "L3-0.421", "L3-0.413", "L3-0.405", "L3-0.397",
  "L3-0.389", "L3-0.381", "L3-0.373", "L3-0.365", "L3-0.357", "L3-0.349",
];                                     /* 13 losas x 20 = 260 yardas de plan */
const DEMO_PASO_MIN = 22;              /* ritmo entre camiones */
const DEMO_ULTIMO_HACE = 3;            /* el último terminó hace 3 min */

/* Lecturas creíbles: rondan el objetivo y alguna se acerca al límite,
   que es justo lo que hay que saber enseñar. */
const DEMO_LECTURAS = [
  { slump: 3.0,  air: 1.8, uw: 150.2, temp: 88 },
  { slump: 3.25, air: 1.6, uw: 149.8, temp: 89 },
  { slump: 2.75, air: 2.0, uw: 150.6, temp: 90 },
  { slump: 3.5,  air: 1.4, uw: 149.4, temp: 91 },
  { slump: 3.0,  air: 1.9, uw: 150.0, temp: 90 },
  { slump: 4.0,  air: 1.2, uw: 148.9, temp: 93 },   /* Slump en zona de acción */
  { slump: 3.25, air: 1.7, uw: 150.3, temp: 91 },
  { slump: 3.0,  air: 2.1, uw: 150.8, temp: 92 },
  { slump: 2.5,  air: 1.5, uw: 151.0, temp: 92 },
  { slump: 3.25, air: 1.8, uw: 150.1, temp: 94 },   /* temperatura en zona de acción */
  { slump: 3.0,  air: 1.6, uw: 149.9, temp: 93 },
  { slump: 3.5,  air: 1.3, uw: 149.6, temp: 94 },
];

function demoHM(fecha) {
  return String(fecha.getHours()).padStart(2, "0") + ":" + String(fecha.getMinutes()).padStart(2, "0");
}
function demoMenos(fecha, min) { return new Date(fecha.getTime() - min * 60000); }

/* ¿Hay ya algo de hoy? Entonces esto no se toca. */
function demoYaHayTiro(base, hoy) {
  return base.tests.some((t) => t.date === hoy);
}

function sembrarTiroDemo(base) {
  const hoy = todayISO();
  if (demoYaHayTiro(base, hoy)) return false;

  const ahora = new Date();
  const finUltimo = demoMenos(ahora, DEMO_ULTIMO_HACE);

  /* El paso entre camiones se aprieta si hace falta, para que el tiro no
     acabe "empezando" de madrugada cuando la demo se abre por la mañana.
     Lo que no se toca es que el último camión se acaba de ir: de eso depende
     que el sistema esté esperando al siguiente. */
  const DESDE_LAS_6 = 6 * 60;
  const minutosHoy = finUltimo.getHours() * 60 + finUltimo.getMinutes();
  const sitio = minutosHoy - DESDE_LAS_6 - 23;          // 23 = descarga + llegada del primero
  let paso = DEMO_PASO_MIN;
  if (sitio > 0) paso = Math.min(DEMO_PASO_MIN, Math.max(6, sitio / (DEMO_CAMIONES - 1)));
  const nBase = base.tests.reduce((a, t) => Math.max(a, t.n || 0), 0);
  const ticket0 = base.tests.reduce((a, t) => Math.max(a, +t.ticket || 0), 0) + 17;
  const camiones = ["101", "118", "121", "122", "126", "128", "129", "130"];
  const objetivoUW = (base.plan && base.plan.uw && base.plan.uw.target) || 150.1;

  const nuevos = [];
  for (let i = 0; i < DEMO_CAMIONES; i++) {
    /* el último camión es el que acaba de terminar; los demás van hacia atrás */
    const fin = demoMenos(finUltimo, Math.round((DEMO_CAMIONES - 1 - i) * paso));
    const inicio = demoMenos(fin, 18);
    const llegada = demoMenos(inicio, 5);
    const batch = demoMenos(llegada, 34);
    const muestra = demoMenos(inicio, 2);
    const L = DEMO_LECTURAS[i % DEMO_LECTURAS.length];
    const planta = i % 2 === 0 ? "01-SAN JUAN" : "02-GURABO";

    nuevos.push({
      n: nBase + i + 1,
      date: hoy,
      ticket: String(ticket0 + i),
      truck: camiones[i % camiones.length],
      vol: DEMO_CY_CAMION,
      plant: planta,
      company: plantCompany(planta),
      batch: demoHM(batch),
      arrive: demoHM(llegada),
      start: demoHM(inicio),
      end: demoHM(fin),
      lot: "29",
      ident: "Phase 10 - Slab " + DEMO_LOSAS[Math.floor(i / 2)],
      testTime: demoHM(muestra),
      slump: L.slump, air: L.air, uw: L.uw, temp: L.temp,
      cs1: null, cs5: null, cs28: null,
      uwTarget: objetivoUW,
      rejected: false,
      source: "demo",
    });
  }

  base.tests = base.tests.concat(nuevos);
  base.dayMeta[hoy] = {
    horaInicio: nuevos[0].start,
    cyPlan: DEMO_LOSAS.length * DEMO_CY_LOSA,
    losasPlan: DEMO_LOSAS.length,
    losas: DEMO_LOSAS.map((c) => `${c}:${DEMO_CY_LOSA}`).join(", "),
    fase: "10",
    lane: "L3",
    km: DEMO_LOSAS[0].replace("L3-", "") + " – " + DEMO_LOSAS[DEMO_LOSAS.length - 1].replace("L3-", ""),
  };
  base.demo = hoy;
  return true;
}

/* ¿Hay trabajo de verdad hoy? Lo que siembra la simulación lleva
   `source: "demo"`; un camión recibido en Recepción, no. */
function hayTrabajoReal(hoy) {
  const d = hoy || todayISO();
  return db.tests.some((t) => t.date === d && t.source !== "demo");
}

/* Vuelve a dejar el tiro como al entrar: borra el día y lo siembra de nuevo.

   **Se planta si hoy hay trabajo de verdad**, y esa guarda no es un detalle:
   esto corre solo en CADA acceso (`sembrarDia`), y `sessionStorage` es de cada
   pestaña y de cada aparato. Sin ella, abrir el Field Display en la tableta a
   media mañana —o volver a entrar porque caducó la sesión— borraba los
   camiones ya recibidos. La demostración nunca pisa trabajo real.

   `forzar` es solo para el botón de Plan & Datos, que sí puede querer barrer
   el día entero, y ahí se pregunta antes. */
function reiniciarDemo(forzar) {
  const hoy = todayISO();
  if (!forzar && hayTrabajoReal(hoy)) return false;
  db.tests = db.tests.filter((t) => t.date !== hoy);
  delete db.dayMeta[hoy];
  sembrarTiroDemo(db);
  saveDB();
  return true;
}

/* El botón «Reiniciar» de Plan & Datos. Si hoy solo hay simulación, reinicia
   sin molestar; si hay camiones de verdad, avisa de lo que se lleva por
   delante antes de hacerlo. */
function reiniciarDemoPreguntando() {
  if (reiniciarDemo()) return true;
  if (!confirm(
      "Hoy hay camiones recibidos de verdad, no de la simulación.\n\n" +
      "Reiniciar borra TODO el vaciado de hoy, incluidos esos camiones.\n" +
      "El histórico del proyecto no se toca. ¿Seguimos?")) return false;
  return reiniciarDemo(true);
}

/* Deja el sistema en blanco para el día de hoy: sin simulación, para
   arrancar un tiro de verdad desde cero. */
function apagarDemo() {
  const hoy = todayISO();
  db.tests = db.tests.filter((t) => !(t.date === hoy && t.source === "demo"));
  db.demo = false;
  saveDB();
}

/* ------------------------------------------------------------ el tiro de verdad

   La simulación es para enseñar. Para TRABAJAR, Rubén programa el tiro del día
   desde el Control Center, y eso es lo que separa una cosa de la otra:

   - se borra el vaciado simulado de hoy y la simulación queda apagada
     (`db.demo = false`), así que ni el acceso la vuelve a sembrar;
   - se abre el plan del día para declarar hora de comienzo, yardas y losas.

   Sin plan declarado el tablero no enseña avance y no se lo inventa: por eso
   programar el tiro es el primer paso del día de verdad, no un trámite.

   El histórico no se toca — ni aquí ni en ningún sitio de este archivo. */
function programarTiro() {
  const hoy = todayISO();
  const enDemo = db.tests.some((t) => t.date === hoy && t.source === "demo");
  if (enDemo && !confirm(
      "Programar el tiro de hoy borra el vaciado de demostración y apaga la simulación.\n\n" +
      "El histórico del proyecto no se toca. ¿Seguimos?")) return;

  apagarDemo();
  delete db.dayMeta[hoy];
  saveDB();
  formDayMeta(hoy);
}
