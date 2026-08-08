/* Guardián de sesión — QCheck.
   PROTOTIPO: es una puerta de demostración, no seguridad real.
   Las credenciales viven en el navegador; cualquiera puede ver el código.
   La autenticación de verdad llega con el backend propio. */
(function () {
  var aqui = location.pathname.split("/").pop();
  if (sessionStorage.getItem("qc-auth") !== "1") {
    location.replace("index.html?next=" + encodeURIComponent(aqui + location.search + location.hash));
    return;
  }
  /* Quien no lleva el control de calidad solo ve sus indicadores. Escribir la dirección a mano lo
     devuelve al portal — que frena un despiste, no a alguien decidido: esto
     vive en el navegador. El candado de verdad llega con el backend (Q-07). */
  var SOLO_QC = ["control-center.html", "results.html", "conduce.html",
                    "muestras.html", "reporte.html"];
  if (!qcEsQC() && SOLO_QC.indexOf(aqui) >= 0) {
    location.replace("movil.html");
  }

  /* LAS PANTALLAS DE LA SP-934 ESTÁN EN OBRAS — Q-57b, 8 ago 2026.

     Se construyen a la vista de nadie hasta que estén enteras: media función
     delante de un técnico es una función rota, y en obra la gente la toca.

     Va por `qcVeConfig()`, que hoy solo tiene la cuenta de Víctor. **El día
     que la 934 esté terminada, se saca de aquí y ya está** — es lo único que
     la separa de estar viva, y está en un solo sitio a propósito. */
  var EN_OBRAS_934 = ["934.html", "lotes.html", "aceptacion.html"];

  /* La DEMOSTRACIÓN sí la ve cualquiera que entre — Q-68. Sus datos son
     inventados y lleva la cinta que lo dice, así que no hay nada que proteger.
     Y hace falta que Rubén pueda abrirla sin pedirle permiso a nadie: una
     herramienta de enseñar que depende de que estés tú delante no sirve.

     Lo que sigue siendo solo de Víctor es el portal de construcción —qué falta,
     por qué se decidió cada cosa— y las pantallas de la 934 sobre datos reales. */
  if (EN_OBRAS_934.indexOf(aqui) >= 0 && !(typeof qcVeConfig === "function" && qcVeConfig())) {
    location.replace("control-center.html");
    return;
  }

  /* Settings es de quien lleva el control de calidad, no de quien mira — Q-37. */
  if (aqui === "settings.html" && !(typeof qcVeLimites === "function" && qcVeLimites())) {
    location.replace("control-center.html");
    return;
  }

  /* Quien tiene casa vive en una sola pantalla — Q-37.

     El contratista, el concretero y la Autoridad entran a su tablero y ahí se
     quedan. Escribir otra dirección a mano los devuelve a lo suyo, y la
     navegación de la cabecera se retira: el logo deja de ser una puerta y los
     enlaces a otras pantallas no se enseñan. Enseñarles botones que los van a
     mandar de vuelta es peor que no enseñarlos. */
  var casa = typeof qcCasa === "function" ? qcCasa() : null;
  if (casa) {
    if (aqui !== casa) { location.replace(casa); return; }
    addEventListener("DOMContentLoaded", function () {
      var enlaces = document.querySelectorAll("header a[href]");
      for (var i = 0; i < enlaces.length; i++) {
        var a = enlaces[i];
        if (!/\.html([?#]|$)/.test(a.getAttribute("href") || "")) continue;
        if (a.closest(".brand")) {
          /* El logo se queda —es la marca, y quitarlo dejaría la cabecera
             coja— pero deja de llevar a ningún sitio. */
          a.removeAttribute("href");
          a.removeAttribute("target");
          a.style.cursor = "default";
        } else {
          /* En línea a propósito: una regla de hoja puede traer su propio
             `display` y volver a enseñarlo. Ya pasó con `[hidden]` en el
             estado del sistema. */
          a.style.display = "none";
        }
      }
    });
  }
})();
