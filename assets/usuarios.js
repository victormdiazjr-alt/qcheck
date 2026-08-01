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

   PROTOTIPO: las claves viven en el navegador y cualquiera puede
   leerlas en el código. Frena un despiste, no a alguien decidido.
   La autenticación de verdad llega con el backend (Q-07).
   ============================================================ */
"use strict";

const QC_CUENTAS = {
  admin:    { clave: "1234", rol: "qc",       nombre: "Administrador", tablero: true, config: true },
  ruben:    { clave: "1234", rol: "qc",       nombre: "Rubén Segarra" },
  invitado: { clave: "1234", rol: "consulta", nombre: "Invitado" },
};

/* El papel se deduce del usuario en cada comprobación, no se guarda:
   así una sesión abierta antes de añadir a alguien no queda a medias. */
function qcRol() {
  const u = sessionStorage.getItem("qc-user");
  return (QC_CUENTAS[u] && QC_CUENTAS[u].rol) || "consulta";
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
   Para dárselo a alguien más, se le pone `tablero: true` aquí y ya. */
function qcVeTablero() {
  const u = sessionStorage.getItem("qc-user");
  return !!(QC_CUENTAS[u] && QC_CUENTAS[u].tablero);
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
  const u = sessionStorage.getItem("qc-user");
  return !!(QC_CUENTAS[u] && QC_CUENTAS[u].config);
}

