/* ══════════════════════════════════════════════════════════════════════════
   SIMULACIÓN QCheck 934 — Q-67, 8 de agosto de 2026

   Un vaciado de verdad, inventado: la obra, los camiones, los ensayos y el
   laboratorio. Sirve para enseñar cómo se maneja un proyecto bajo la SP-934
   sin necesitar un proyecto 934 real.

   ─────────────────────────────────────────────────────────────────────────
   LO QUE NO PUEDE PASAR, Y POR QUÉ SE ESCRIBE AQUÍ ARRIBA

   El 31 de julio de 2026 la simulación anterior de QCheck se coló en el
   expediente compartido de la PR-52 y quedó ahí un vaciado de 260 CY que
   nunca ocurrió (ver DECISIONS §23 y Q-46). El fallo no fue tener una
   simulación: fue que sus datos podían confundirse con los de verdad.

   Así que esta se construye al revés:

     · **No usa `db`.** Ni lo lee ni lo escribe. Trabaja sobre su propio
       objeto, en memoria, y en su propia clave de almacenamiento.
     · **No sincroniza.** No hay ninguna ruta desde aquí al servidor.
     · **Se anuncia.** Toda pantalla de simulación lleva una marca visible
       que no se puede quitar desde dentro.
     · **Otra obra, otro contratista, otras fechas.** Nada aquí se parece a la
       PR-52 lo bastante como para confundirse en una captura de pantalla.

   Si alguna vez hace falta que esto escriba algo real, no se conecta: se
   escribe otra cosa.
   ══════════════════════════════════════════════════════════════════════════ */

const SIM_CLAVE = "qc-sim934";     // NUNCA "qc-db"
const SIM_MARCA = "SIMULACIÓN";

/* La obra. Deliberadamente distinta de la PR-52 en todo lo que se ve de un
   vistazo: otra carretera, otros kilómetros, otras fechas. */
const SIM_PROYECTO = {
  name: "Ampliación PR-22 · Km 8.4 a 12.1",
  contractor: "Del Valle Group, Inc.",
  qcFirm: "Segarra Engineering",
  concretera: "Concre-Tech",
  planta: "02-BAYAMÓN",
  contractId: "AC-240118",
  numeroProyecto: "PR-22-0084",
  numeroEstatal: "JP-2024-118",
  clase: "III",                     // LSL 3000 · USL 5625
  mixId: "AC400604SX",
  material: "Hormigón 4000 psi",
  edades: [7, 28],
  permeabilidad: null,              // este proyecto no la inspecciona
  uwTarget: 148.5,
  slumpTarget: 4.0,
};

/* Un generador con semilla fija: la simulación sale igual cada vez que se
   abre. Eso importa para enseñarla —nadie quiere que los números bailen
   mientras explica— y para poder hablar de «el camión 14» sabiendo cuál es. */
function simAzar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Ruido normal, para que los ensayos no salgan en línea recta. */
function simNormal(azar, media, sigma) {
  const u = Math.max(1e-9, azar()), v = azar();
  return media + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function simHora(base, minutos) {
  const t = base + minutos;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/* ─────────────────────────────────────────────── el vaciado en curso ───── */
/* Un lote de 250 m³ por la mitad: cinco sub-lotes llenos de diez. A 10 CY por
   camión hacen falta unos 33 para el lote, así que la mitad son 17.

   Los dos lotes anteriores están cerrados y evaluados, porque un proyecto que
   empieza hoy no enseña nada: lo interesante es ver un lote cerrado al lado
   de uno a medias. */
function simConstruir() {
  const azar = simAzar(934_2026);
  const tests = [];
  let n = 0;

  const dia = (d) => `2026-08-${String(d).padStart(2, "0")}`;

  /* Dos lotes cerrados y el tercero a medias. Al primero se le baja un poco la
     resistencia a propósito: un lote que paga 1.05 y otro que paga 0.94 dicen
     más juntos que dos perfectos. */
  /* El primero sale bien y el segundo regular, a propósito. Dos lotes
     perfectos no enseñan nada: lo que hay que poder ver de un vistazo es la
     diferencia entre un lote que bonifica y uno que descuenta, porque esa
     diferencia es dinero y es la conversación que va a tener el contratista.

     El segundo se acerca al límite inferior (3.000 psi de la clase III) con
     bastante dispersión — que es exactamente como se ve un lote que se fue de
     las manos sin llegar a rechazarse. */
  const tandas = [
    { dia: dia(3), camiones: 33, mediaCS: 4520, sigmaCS: 210, ticket: 71200 },
    { dia: dia(5), camiones: 33, mediaCS: 3300, sigmaCS: 560, ticket: 71400 },
    /* La media del segundo lote es baja a propósito, y hubo que bajarla dos
       veces: **promediar los camiones dentro de cada sub-lote aplana la
       dispersión**, así que la desviación que ve el PWL es la mitad de la que
       tienen los camiones. Con media 3.760 el lote seguía pagando 1.05.

       Eso no es un detalle de la simulación: es cómo funciona la 934 de
       verdad. Un lote irregular camión a camión puede salir perfecto en la
       estadística, porque la norma juzga sub-lotes y no camiones. Conviene
       saberlo antes de prometerle a nadie que el PWL detecta variabilidad. */
    { dia: dia(8), camiones: 17, mediaCS: 4460, sigmaCS: 200, ticket: 71600 },
  ];

  tandas.forEach((tanda, iTanda) => {
    const enCurso = iTanda === tandas.length - 1;
    let minuto = 6 * 60 + 10;                    // arranca a las 6:10
    for (let i = 0; i < tanda.camiones; i++) {
      n++;
      const batch = simHora(0, minuto);
      const llega = simHora(0, minuto + 26 + Math.round(azar() * 8));
      const empieza = simHora(0, minuto + 34 + Math.round(azar() * 6));
      const termina = simHora(0, minuto + 48 + Math.round(azar() * 9));

      /* Los últimos tres camiones del lote en curso todavía están en la obra:
         uno descargando y dos esperando. Un tablero en vivo sin nada en vivo
         no enseña lo que hace falta enseñar. */
      const ultimos = enCurso && i >= tanda.camiones - 3;
      const descargando = enCurso && i === tanda.camiones - 3;

      const t = {
        n, id: `sim-${n}`, date: tanda.dia,
        ticket: String(tanda.ticket + i * 3),
        truck: String(140 + ((n * 7) % 26)),
        vol: 10,
        company: SIM_PROYECTO.concretera,
        plant: SIM_PROYECTO.planta,
        mix: SIM_PROYECTO.mixId,
        material: SIM_PROYECTO.material,
        ident: `F${2 + iTanda} · L${1 + (i % 4)}-${(8.4 + i * 0.06).toFixed(3)}`,
        batch, arrive: llega,
        start: ultimos && !descargando ? null : empieza,
        end: ultimos ? null : termina,
        uwTarget: SIM_PROYECTO.uwTarget,
        rejected: false,
        source: "qticket",                        // llegan por QTicket, no a mano
        ordenadas: tanda.camiones * 10,
      };

      /* Ensayos frescos. La 934 los muestrea por sub-lote, pero en obra se
         miden en más camiones de los que exige: se deja así porque es lo que
         pasa de verdad. */
      if (!ultimos || descargando) {
        t.slump = Math.round(simNormal(azar, SIM_PROYECTO.slumpTarget, 0.35) * 4) / 4;
        t.uw = Math.round(simNormal(azar, SIM_PROYECTO.uwTarget, 0.55) * 10) / 10;
        t.air = Math.round(simNormal(azar, 2.1, 0.35) * 10) / 10;
        t.temp = Math.round(simNormal(azar, 86, 2.4));
        t.testTime = simHora(0, minuto + 30);
      }

      /* Resistencias: solo las que ya rompió el laboratorio. Del lote en curso
         no hay ninguna a 28 días — es lo normal y es justo lo que hace útil la
         proyección. */
      if (!enCurso) {
        t.cs7 = Math.round(simNormal(azar, tanda.mediaCS * 0.78, tanda.sigmaCS * 0.8) / 10) * 10;
        t.cs28 = Math.round(simNormal(azar, tanda.mediaCS, tanda.sigmaCS) / 10) * 10;
      } else if (i < 10) {
        t.cs7 = Math.round(simNormal(azar, tanda.mediaCS * 0.78, tanda.sigmaCS * 0.8) / 10) * 10;
      }

      /* Un camión rechazado en el segundo lote: sin un rechazo, el tablero no
         enseña lo que pasa cuando algo va mal, que es para lo que sirve. */
      if (iTanda === 1 && i === 19) {
        t.rejected = true;
        t.slump = 6.5;
        t.comments = "Slump fuera de límite a la llegada. Devuelto a planta.";
      }

      tests.push(t);
      minuto += 13 + Math.round(azar() * 7);
    }
  });

  return {
    marca: SIM_MARCA,
    project: SIM_PROYECTO,
    plan: {
      slump: { target: 4.0, actLo: 3.0, actHi: 5.0, suspLo: 2.5, suspHi: 5.5 },
      air: { target: 2.0, actLo: 0.5, actHi: 4.0, suspLo: 0.0, suspHi: 4.5 },
      uw: { target: SIM_PROYECTO.uwTarget, act: 2.3, susp: 2.9 },
      cs: { target: 4000, age: 28, action: 3400 },
      tempMax: 95, maWindow: 6, maxElapsedMin: 90,
    },
    tests,
    dayMeta: {
      "2026-08-03": { cyPlan: 330, losasPlan: 26, horaInicio: "06:10", cerradoA: "15:40", cerradoPor: "Rubén Segarra" },
      "2026-08-05": { cyPlan: 330, losasPlan: 26, horaInicio: "06:10", cerradoA: "16:05", cerradoPor: "Rubén Segarra" },
      "2026-08-08": { cyPlan: 330, losasPlan: 26, horaInicio: "06:10" },
    },
    hoy: "2026-08-08",
  };
}

/* La simulación se construye una vez y se guarda en memoria. No se persiste a
   propósito: recargar la devuelve a su estado inicial, que es lo que hace
   falta cuando se está enseñando y alguien toca algo. */
let SIM = null;
function simDatos() { return SIM || (SIM = simConstruir()); }
function simReiniciar() { SIM = null; return simDatos(); }
