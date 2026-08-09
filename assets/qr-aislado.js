/* ══════════════════════════════════════════════════════════════════════════
   EL CUARTO CERRADO DEL LECTOR DE QR — Q-81, 9 de agosto de 2026

   Aquí dentro corre `qr-lector.js`, que es la única pieza de QCheck escrita
   por otros (jsQR — ver DECISIONS §56). Y corre aquí **porque aquí no hay nada
   que robar**.

   Esto es un Web Worker. Un Worker no tiene `localStorage`, no tiene
   `sessionStorage`, no tiene `document` y no tiene `window`. No es que se lo
   prohibamos nosotros: **es que el navegador no se los da**. Así que el código
   de fuera, sea lo que sea, no puede ver:

     · `qc-token`   — la llave del proyecto
     · `qc-sesion`  — el pase de quien está dentro
     · `qc-api`     — a qué servidor hablamos
     · nada del expediente

   Lo único que entra por la puerta son **los píxeles de un fotograma**, y lo
   único que sale es **el texto del código o nada**.

   Víctor lo preguntó tal cual —«¿es seguro?»— y esta es la respuesta que no
   depende de fiarse: no hace falta leerse 130 KB comprimidos para saber que un
   cuarto sin ventanas no tiene vistas.

   Lo que esto NO resuelve, y queda escrito para que nadie lo dé por resuelto:
   un Worker **sí puede** pedir cosas a internet. No tiene nada que mandar, pero
   podría hablar. Eso se cierra con el candado del navegador (Content Security
   Policy), que va después del vaciado.
   ══════════════════════════════════════════════════════════════════════════ */

importScripts("qr-lector.js");

self.onmessage = (e) => {
  const { datos, ancho, alto, id } = e.data || {};
  let texto = null;
  try {
    /* `attemptBoth` prueba también el código invertido: un conduce fotografiado
       contra el sol sale con los cuadros al revés y si no, no lo caza. */
    const r = self.jsQR(datos, ancho, alto, { inversionAttempts: "attemptBoth" });
    if (r && r.data) texto = r.data;
  } catch (_) { /* un fotograma malo no es un error: es que no había código */ }
  self.postMessage({ id, texto });
};
