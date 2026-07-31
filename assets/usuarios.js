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
  admin:    { clave: "1234", rol: "qc",       nombre: "Administrador" },
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

function qcNombre() {
  const u = sessionStorage.getItem("qc-user");
  return (QC_CUENTAS[u] && QC_CUENTAS[u].nombre) || "";
}
