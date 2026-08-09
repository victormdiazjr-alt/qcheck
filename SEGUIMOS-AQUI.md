# Dónde estamos — 9 de agosto de 2026, de madrugada

Esto lo escribe una sesión que se quedó sin sitio, para la siguiente. **Léelo
entero antes de tocar nada**, y después `AGENTS.md` y `DECISIONS.md`.

Si algo de aquí contradice al código, manda el código: esto es una foto de un
momento y el código es lo que corre.

---

## 1 · Lo que pasó hoy y hay que saber

**QCheck corrió su primer vaciado en vivo** en la PR-52. **Y Rubén no pudo
usarlo** — va a entrar los datos a mano hoy o mañana. **Nadie sabe todavía por
qué no pudo.** Esa es la pregunta más importante que hay abierta, y es de
Víctor: hasta que no diga qué le falló, no se puede arreglar.

El expediente de producción lo confirma: el último cambio de un camión es del
**7 de agosto**, y **ningún camión lleva `source: "foto"`** — el lector no ha
guardado ni uno en producción.

**Si Rubén va a meter esos conduces, que no los teclee: que les saque foto en
Recepción.** Mismo trabajo, y de regalo el lector rellena, la foto queda pegada
al camión, y son treinta conduces reales para el banco.

## 2 · Lo que se hizo esta noche, en orden

- **Q-77/77b** Desconectar un aparato desde Estado del sistema. Le caen las
  sesiones **y suelta la llave del proyecto**: para volver hace falta el enlace
  de conexión. Es el botón de «fuera».
- **Q-78** El conduce se ve a pantalla completa; «Escanear conduce» abre la
  cámara.
- **Q-79** El aviso del ajuste del último camión ya no manda parar el vaciado.
- **Q-80/81** El escáner de QR funciona en Safari, con jsQR — **la única pieza
  de QCheck que no escribimos nosotros** — encerrada en un Web Worker sin
  acceso a `localStorage`.
- **Q-82/83** QCheck y QTicket se hablan por internet. El QR lleva una
  dirección, no los datos, y el dominio va en lista blanca.
- **Q-84/84b** El lector marca lo escrito a bolígrafo y lee el chofer. **Rompí
  producción al desplegar** — ver §5.
- **Q-85** Cerrar todas las sesiones sin repartir enlaces nuevos.

## 3 · El estado de producción, ahora mismo

- **`exigir_sesion` ENCENDIDO.** Sin pase de sesión no se lee ni se escribe:
  probado, da 401 con la llave sola.
- **71 sesiones cerradas.** Todos vuelven a entrar con **su clave**, y **no
  necesitan enlace nuevo**. Si alguien llama diciendo que no entra, la respuesta
  es su clave.
- Las siete cuentas siguen activas.
- El Worker está desplegado con el lector nuevo (chofer + manuscrito).

**Esto tapa casi todo el riesgo de la llave quemada** (`DECISIONS` §54): la
llave sola ya no vale para nada. Cambiarla sigue siendo buena idea, ya no es
urgente.

## 4 · Lo que queda abierto

1. **Preguntarle a Víctor por qué Rubén no pudo usar QCheck.** Lo primero.
2. **El candado del navegador (CSP)** para que el lector de QR tampoco pueda
   hablar con nadie. Ver `DECISIONS` §57.
3. **El lector de QR nuestro**, y borrar jsQR. Repartido con QTicket: la
   aritmética la escribe él (ya tiene la Reed-Solomon del generador), la
   geometría la ponemos aquí. Él avisa cuando cierre lo de separar concreteras.
4. **El banco**: los 13 conduces por confirmar, el conduce alterado, y meter los
   del tiro cuando existan. Ver `~/Documents/Claude/qbanco/ESTADO.md`.
5. **Sin demostrar**: que el lector use los nombres del esquema al marcar un
   campo manuscrito. Hace falta un conduce con, por ejemplo, el número de
   conduce escrito a mano.
6. **La llave del proyecto**, quemada desde el 8 de agosto.

## 5 · Dos errores míos de esta noche, para que no se repitan

**Rompí `/api/leer-conduce` en producción.** Copié `QC_NULO(...)` de
`sync-servidor.js` a `sync-worker.js`, donde esa función no existe — la del
Worker se llama `oNulo`. `node --check` **no comprueba que los nombres existan**,
así que pasó todas las revisiones y solo falló al ejecutarse.

→ Los dos servidores comparten texto pero **no comparten funciones**. Copiar una
línea de uno a otro puede traerse un nombre que allí no está. Después de tocar
cualquiera de los dos: `node pruebas/servidores-iguales.mjs`, y si se toca el
lector, `qbanco/herramientas/mide-lo-escrito-a-mano.mjs` contra producción.

**Dejé un aviso que podía no saltar nunca.** El modelo devolvía los campos
manuscritos con sus propios nombres y la pantalla comparaba con los de QCheck.
Un aviso que nunca salta es peor que no tenerlo, porque da tranquilidad falsa.

## 6 · Cómo trabaja Víctor

- **Un paso por mensaje.** Los mensajes con varias opciones lo bloquean: si hay
  que decidir, recomienda una y sigue.
- **Lenguaje llano**, sin jerga. Explica el *qué* y el *porqué*, no el *cómo*.
- Cuando dice «no entiendo», **no repitas más despacio: cambia de enfoque.**
- **Comprueba en pantalla, no en el código.** «Debería funcionar» no es haberlo
  probado. Esta noche esa regla cazó tres fallos que el código no enseñaba.
- **No le toques el portapapeles.**

## 7 · Dónde está cada cosa

- `~/Documents/Claude/qcheck` — QCheck. Repo público, `datos/` fuera.
- `~/Documents/Claude/qbanco` — el banco: corpus, reglas del oficio y la medida.
  **Repo local sin remoto a propósito**: `datos/` lleva conduces de cliente.
- `~/Documents/Claude/qticket` — QTicket, otra sesión de Claude lo lleva. Se le
  habla con `send_message`. Hay contrato escrito en
  `qcheck/docs/integracion-qticket.md`.
- `~/Documents/Claude/wrangler.jsonc.DESACTIVADO` — **no lo reactives sin leer
  el LEEME de al lado.** Publicó la carpeta entera con las llaves dentro.
