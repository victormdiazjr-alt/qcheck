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

const QC_CUENTAS = {
  admin:    { clave: "1234", rol: "qc",       nombre: "Administrador", tablero: true, config: true },
  ruben:    { clave: "1234", rol: "qc",       nombre: "Rubén Segarra" },
  invitado: { clave: "1234", rol: "consulta", nombre: "Invitado" },
};

/* La ficha que mandó el servidor al entrar, si la hay. */
function qcIdentidad() {
  try { return JSON.parse(sessionStorage.getItem("qc-ident")) || null; } catch (_) { return null; }
}

/* Quién es el que está dentro. El servidor primero; la lista local solo
   cuando no hay servidor detrás. */
function qcCuenta() {
  const ficha = qcIdentidad();
  if (ficha) return ficha;
  return QC_CUENTAS[sessionStorage.getItem("qc-user")] || null;
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

