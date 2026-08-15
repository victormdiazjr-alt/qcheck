/* ============================================================
   USUARIOS — quién entra y qué ve.

   Una sola lista. Antes el papel de cada quien se comprobaba
   con `qc-user === "admin"` repartido por cinco archivos, y
   añadir a alguien obligaba a tocarlos todos. Ahora se añade
   aquí y ya.

   Dos papeles:
     qc       — Rubén y quien lleve el control de calidad. Ve todo:
                Control Center, Results, Recepción, Muestras, reportes.
     consulta — el contratista, el concretero, la Autoridad. Solo
                sus indicadores, a través del portal.

   DE DÓNDE SALE LA IDENTIDAD — Q-07, 5 ago 2026
   ----------------------------------------------
   **Con servidor puesto, manda el servidor.** Al entrar, la ficha que
   devuelve `/api/sesion` —usuario, nombre, papel y capacidades— se
   guarda en `qc-ident` y es la que se lee aquí. La lista de abajo ni
   se mira.

   La lista local sigue existiendo para el aparato SIN servidor: QCheck
   es un producto independiente (§1) y tiene que abrir y enseñarse sin
   nada detrás. Pero esa sesión no puede escribir en el expediente
   compartido: con la bandera `exigir_sesion` encendida, el servidor
   rechaza lo que no traiga pase. Es una puerta para enseñar la
   herramienta, no una llave.

   Y el candado de verdad nunca estuvo aquí: esto vive en el navegador,
   así que frena un despiste. Quien decide es el servidor, y lo que
   decide es **quién firma cada línea del expediente**.
   ============================================================ */
"use strict";

/* SIN CLAVES — Q-65, 10 de agosto de 2026.

   Este archivo lleva desde el principio en un repositorio PÚBLICO con las
   claves dentro. Daba igual que fueran «1234» o de veinte caracteres: una clave
   publicada en internet no protege nada.

   Ya no hacen falta. El servidor exige sesión (`exigir_sesion`), las claves
   viven derivadas en la base con 100.000 vueltas y sal por usuario, y quien
   manda al entrar es el servidor: la lista local solo contestaba cuando el
   servidor no contestaba (ver `index.html`). Sin `clave` aquí, esa puerta
   trasera se cierra sola — la comparación nunca puede dar verdadera.

   LO QUE SÍ SE QUEDA es el papel de cada cuenta. Cuando un aparato ya entró una
   vez, `qcCuenta()` usa la ficha que mandó el servidor (`qc-ident`); esto es el
   respaldo para leer permisos sin señal, y no abre ninguna puerta.

   LO QUE ESTO CUESTA, dicho claro: un aparato que NUNCA ha entrado y no tiene
   señal ya no puede entrar. Es correcto — un teléfono nuevo se da de alta con
   cobertura, una vez, y a partir de ahí trabaja sin señal todo lo que haga
   falta. */
const QC_CUENTAS = {
  admin:    { rol: "qc",       nombre: "Administrador", tablero: true, config: true, limites: true },
  /* Q-77: Rubén lleva su Control Center. Trabaja el día entero del teléfono y
     esa es su casa, no un portal de resúmenes. */
  ruben:    { rol: "qc",       nombre: "Rubén Segarra", tablero: true, limites: true, firma: true },
  invitado: { rol: "consulta", nombre: "Invitado" },

  /* El técnico de campo de Rubén — 8 ago 2026. Ve lo mismo que Rubén (Víctor
     lo pidió así), o sea Recepción, Muestras, Results, Reportes y Settings.

     Lo que NO lleva es `firma`: reabrir un tiro cerrado y descartar un vaciado
     del expediente son actos del ingeniero de récord, y eso es Rubén en
     persona, no su puesto (DECISIONS §22). Tampoco `config`, que es la sala de
     máquinas. */
  tecnico:  { rol: "qc",       nombre: "Técnico de campo", limites: true },

  /* EL EQUIPO DE RUBÉN — Q-63, 10 de agosto de 2026.

     Yarvier es su técnico asistente y entra muestras y recepción; los dos
     técnicos, lo mismo. Ven los límites contra los que miden y NO los cambian:
     poner la vara con la que se juzga el hormigón es del ingeniero de récord
     (Q-62), y ninguno lleva `firma`.

     Claves distintas y no un `1234` para todos, y el motivo no es la fuerza
     —esto vive en el navegador y el repositorio es público, así que quien
     quiera leerlas las lee— sino que **el expediente firma con quien está
     dentro**. Si tres personas comparten cuenta, el récord no sabe quién midió,
     y eso es exactamente lo que este sistema existe para impedir.

     Son PROVISIONALES, para las pruebas. Cuando la puerta pase al servidor
     (Q-07 con `exigir_sesion`), se dan de alta con `cuentas.js`, que exige doce
     caracteres a todo el que escriba en el expediente. */
  /* `tablero` — Q-102, 14 ago 2026, la víspera del tiro de la PR-52.

     Víctor: «mañana va a haber tiro de Concre-Tech / PR-52, Rubén no es el que
     va a estar; estará tecnico1. Necesito que tecnico1 pueda entrar y trabajar
     un tiro completo.»

     Un tiro completo son cuatro cosas: **abrirlo, recibir camiones, medirlos y
     cerrarlo.** Las tres primeras las tenían ya. La cuarta no: hoy mismo se
     movió «Cerrar tiro» de Muestras al Control Center (Q-99) — con razón,
     porque firma el día y no puede vivir en la pantalla que se usa cien veces—
     **y sin `tablero` no hay forma de llegar hasta allí desde el teléfono.**

     O sea que el arreglo de esta mañana dejaba a quien no fuera Rubén sin
     poder cerrar su propio tiro. Se ve al juntar las dos cosas, no al hacer
     cada una.

     Esto NO les da más poder sobre el expediente: `cerrarTiro()` nunca ha
     exigido `firma`, y lo que sí la exige —reabrir un tiro cerrado, descartar
     un vaciado, devolverlo— la sigue exigiendo y sigue siendo de Rubén.
     `config` tampoco: la llave del servidor y los límites no se tocan desde
     aquí.

     Lo llevan los tres, y no solo tecnico1: el que cubre un tiro mañana puede
     ser otro pasado mañana, y una capacidad que se da por persona y no por
     puesto se queda vieja el primer día que alguien falta. */
  yarvier:  { rol: "qc", nombre: "Yarvier", limites: true, tablero: true },
  tecnico1: { rol: "qc", nombre: "Técnico 1", limites: true, tablero: true },
  tecnico2: { rol: "qc", nombre: "Técnico 2", limites: true, tablero: true },

  /* Las tres de fuera — Q-37, 6 ago 2026. Cada una entra y aparece en SU
     tablero, sin portal y sin navegación: no vienen a recorrer QCheck, vienen
     a mirar su número. Lo que ven ya era público para ellas —el contrato le
     publica los límites a la concretera desde la v4— así que esto no abre
     nada nuevo, solo les quita los tres clics de en medio.

     `casa` va en la cuenta y NUNCA se deduce del nombre de usuario (AGENTS §3):
     el día que la Autoridad quiera dos personas con acceso, se dan de alta dos
     cuentas con la misma casa y no hay que tocar código. */
  concretero:  { rol: "consulta", nombre: "Concretero",  casa: "produccion.html" },
  contratista: { rol: "consulta", nombre: "Contratista", casa: "contratista.html" },
  autoridad:   { rol: "consulta", nombre: "Autoridad",   casa: "autoridad.html" },
};

/* La ficha que mandó el servidor al entrar, si la hay. */
function qcIdentidad() {
  try { return JSON.parse(localStorage.getItem("qc-ident")) || null; } catch (_) { return null; }
}

/* Quién es el que está dentro. El servidor primero; la lista local solo
   cuando no hay servidor detrás. */
function qcCuenta() {
  const ficha = qcIdentidad();
  if (ficha) return ficha;
  return QC_CUENTAS[localStorage.getItem("qc-user")] || null;
}

/* El papel se deduce del usuario en cada comprobación, no se guarda:
   así una sesión abierta antes de añadir a alguien no queda a medias. */
function qcRol() {
  const c = qcCuenta();
  return (c && c.rol) || "consulta";
}

/* ¿Este usuario lleva el control de calidad? */
function qcEsQC() { return qcRol() === "qc"; }

/* ¿Puede saltar del portal del teléfono al Control Center?

   No es lo mismo que llevar el control de calidad: Rubén lo lleva y aun así
   NO debe ver ese enlace en el teléfono —el Control Center no cabe en la mano
   y desde el portal tiene todo lo que necesita en la obra—. Víctor lo pidió
   así el 31 jul 2026.

   Va como capacidad de la cuenta y no como `usuario === "admin"` a propósito:
   el papel de cada quien se deduce de esta lista y nunca del nombre (AGENTS §3).
   Para dárselo a alguien más, se le pone `tablero: true` aquí y ya —o en
   su cuenta del servidor, `node cuentas.js`, que es lo que manda desde Q-07. */
function qcVeTablero() {
  const c = qcCuenta();
  return !!(c && c.tablero);
}

/* ¿Puede ver la tripa del sistema? — «Plan & Datos»: la dirección del servidor,
   la llave del proyecto, los límites del plan de control, la ficha del proyecto
   y el panel de la simulación.

   **Rubén NO.** Lleva el control de calidad y aun así esto no es suyo: es
   configuración, y una llave de servidor o un límite de especificación tocados
   sin querer no dan un error — dan un expediente malo que nadie nota hasta que
   lo firma la Autoridad. Víctor lo pidió así el 1 ago 2026: quien usa la
   herramienta no ve cómo está montada.

   Igual que `qcVeTablero()`, va como capacidad de la cuenta y NUNCA como
   `usuario === "admin"`: el papel se deduce de esta lista y nunca del nombre
   (AGENTS §3). Para dárselo a alguien más se le pone `config: true` aquí. */
function qcVeConfig() {
  const c = qcCuenta();
  return !!(c && c.config);
}

/* ¿QUIÉN PUEDE MIRAR LO QUE HACEN LOS DEMÁS? — Q-96, 14 ago 2026.

   Víctor: «que el botón de actividad del log solo lo vea admin».

   Y hacía falta decirlo, porque `qcVeConfig()` no valía: hoy lo llevan Rubén,
   los tres técnicos y Yarvier —todos entran a Settings— así que con esa puerta
   la pantalla de Actividad se la habría encontrado el propio Rubén. Ver el
   registro de lo que hace la cuadrilla es de quien lleva el contrato, no de la
   cuadrilla.

   Va como CAPACIDAD y no como `usuario === "admin"` (AGENTS §3): el papel se
   deduce de la ficha y nunca del nombre. La capacidad que hoy tiene una sola
   cuenta es `limites` —«Plan & Datos», quien pone los umbrales con los que se
   juzga el hormigón—, y no es una elección caprichosa: quien decide la vara es
   quien responde de cómo se usa.

   El día que haga falta separarlo de verdad, esto pasa a ser su propia
   capacidad en la ficha —`auditoria`— y se cambia SOLO aquí. */
function qcVeActividad() {
  const c = qcCuenta();
  return !!(c && c.limites);
}


/* ¿Esta cuenta vive en una sola pantalla? — Q-37.

   Devuelve el archivo de su tablero, o `null` si es alguien que navega por
   QCheck. Quien tiene casa entra directo ahí, no ve navegación y no puede
   salirse: `auth.js` lo devuelve a su sitio si escribe otra dirección a mano.
   Es una comodidad, no un candado —esto vive en el navegador—, pero el
   candado de verdad tampoco hace falta aquí: lo que ven es su propio tablero
   de indicadores, que es justo lo que se les enseña. */
function qcCasa() {
  const c = qcCuenta();
  return (c && c.casa) || null;
}

/* ¿Ve la pantalla de Settings? — Q-37.

   Es la pantalla de Rubén, y a propósito NO es «Plan & Datos». Víctor lo
   decidió el 6 ago 2026: Rubén necesita poder corregir un límite del plan de
   control cuando el proyecto lo cambia, y para eso tenía que pasar por la
   pantalla donde también están la llave del servidor, la ficha del proyecto y
   la simulación. Settings enseña los límites y nada más; lo demás sigue
   detrás de `qcVeConfig()`.

   Lo que se toque aquí queda firmado en el expediente como cualquier otro
   cambio —quién y cuándo—, así que un límite mal puesto se ve y se deshace.
   Ese registro es lo que hace que esto no sea el riesgo que era en agosto. */
function qcVeLimites() {
  const c = qcCuenta();
  return !!(c && c.limites);
}

/* ¿Es el ingeniero de récord? — Q-41, 7 ago 2026.

   Un vaciado cerrado deja de aceptar cambios: el reporte ya se firmó y lo que
   dice es lo que pasó. Reabrirlo o corregir un dato de un día cerrado solo lo
   puede hacer quien responde por ese expediente ante la Autoridad.

   Víctor lo decidió así, y tiene sentido más allá de esta obra: el que firma
   el récord es el que puede tocarlo. Ni siquiera el administrador — el
   administrador monta la herramienta, no certifica el hormigón.

   Va como capacidad y NUNCA como `usuario === "ruben"` (AGENTS §3): el día que
   entre otro ingeniero de récord se le pone `firma: true` y ya. */
function qcFirma() {
  const c = qcCuenta();
  return !!(c && c.firma);
}
