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
  /* El invitado solo ve sus indicadores. Escribir la dirección a mano lo
     devuelve al portal — que frena un despiste, no a alguien decidido: esto
     vive en el navegador. El candado de verdad llega con el backend (Q-07). */
  var SOLO_ADMIN = ["control-center.html", "results.html", "conduce.html",
                    "muestras.html", "reporte.html", "portal.html"];
  if (sessionStorage.getItem("qc-user") !== "admin" && SOLO_ADMIN.indexOf(aqui) >= 0) {
    location.replace("movil.html");
  }
})();
