# Bitácora de tareas — QCheck

**Esta es la fuente de verdad sobre quién hace qué.** Antes de escribir una sola línea:
`git pull`, lee esto, reclama tu tarea, `git push`. Ver el protocolo en `AGENTS.md` §2.

Agentes que trabajan aquí: `claude` (Claude Code) · `codex` (OpenAI Codex) · `victor`.

---

## En curso

| id | tarea | agente | desde |
|----|-------|--------|-------|
| Q-07 | **Autenticación real** con usuarios y roles | claude | 2026-08-05 |

---

## Pendiente

| id | tarea | por qué importa | tamaño |
|----|-------|-----------------|--------|
| Q-29 | **Mudanza a `qcheck.dcreationspr.com`** — nameservers a Cloudflare, sitio en Pages, API en `api.qcheck…`, y **repartir el enlace nuevo una sola vez** dejando el viejo con redirección | Acordado con Víctor: **al terminar de construir**, cuando QCheck entre en uso oficial. Antes no — un enlace nuevo en mitad de las pruebas es confusión de más. Ver `DECISIONS.md` §16 | mediano |
| Q-01 | **OCR del conduce en papel** — foto → el sistema entra los datos solos | La mayoría de concreteras no tendrán QR: esta es la vía principal de entrada, no el respaldo | grande |
| Q-04 | **Correo automático al rechazar** | Hoy abre un correo pre-llenado; falta el envío real (necesita Q-02) | mediano |
| Q-05 | **Línea de tiempo de eventos por conduce** — *el dato ya existe*: el registro de cambios (Q-02) lo guarda entero. Falta la pantalla que lo enseñe | Modelo de datos definitivo: salida de planta, llegada, muestra, veredicto, vaciado, cilindros | pequeño |
| Q-06 | **Adjuntos en el conduce**: foto del conduce, pesadas, fotos de losa y cilindros | Cierra el expediente digital que hoy se arma a mano | mediano |
| Q-08 | **Más reglas de inteligencia** | La capa de avisos ya detecta agua, tendencia y humedad vencida; faltan reglas de temperatura y de tiempo de viaje | pequeño |
| Q-09 | **Aire en el tablero del productor** | El contrato ya publica los límites de aire; nadie los muestra | pequeño |
| Q-10 | **Integración con ArcGIS** | La inspección ya georreferencia losas ahí; evaluar el enlace | investigación |
| Q-11 | **Avance exacto por losa** | Un camión que reparte su carga no registra cuánto dejó en cada una | pequeño |

**El detalle de cada tarea está en [`TODO.md`](TODO.md).** Aquí solo se reclama.

---

## Contrato (afecta a los DOS repositorios)

Cambios propuestos a `shared/conduce-contract.js`. **No los apliques por tu cuenta:**
anótalos aquí, avisa a Víctor, y cuando se aprueben se cambian en los dos repos a la vez
subiendo la `VERSION`.

| propuesta | quién la pide | estado |
|-----------|----------------|--------|
| _(ninguna abierta)_ | | |

Versión vigente del contrato: **4**.

---

## Hecho

| fecha | tarea | agente |
|-------|-------|--------|
| 2026-08-01 | **Q-02 — Sincronización entre aparatos**, por registro de cambios campo a campo. Desplegada en Cloudflare Workers + D1 (`qcheck-api.qcheck.workers.dev`) y probada de punta a punta entre el sitio publicado y un segundo aparato | claude |
| 2026-07-31 | **Q-28 — El ciclo cierra**: Muestras solo engancha camiones que esperan resultados y se limpia al enviar; la simulación deja de borrar el trabajo real en cada acceso | claude |
| 2026-07-31 | **Q-27 — La marca**: «Smart Quality Control» como descripción del nombre y «Build Connected» como lema | claude |
| 2026-07-31 | **Q-26 — La portada de la guía dice lo que hace la herramienta**: «Se mide una vez. Lo ve toda la obra», y fuera el párrafo | claude |
| 2026-07-31 | **Q-19 (cerrada) — El vector del mixer de Víctor** es ya el icono del camión hormigonera, y toma el color del estado | claude |
| 2026-07-31 | **Q-25 — Delete, Next y Clear** en el teclado de Muestras | claude |
| 2026-07-31 | **Q-24 — La portada de la guía, al hueso**: para quién, proyecto y acceso; fuera el aviso de la clave y la coletilla del pie | claude |
| 2026-07-31 | **Q-23 — Slump y Unit Weight suben** por encima de los avisos y del último camión en el Control Center | claude |
| 2026-07-31 | **Q-22 — El mixer de la guía entra en reversa**: volteado en horizontal, con la canaleta hacia la obra | claude |
| 2026-07-31 | **Q-21 — Dashboards también en el Control Center**: fuera los tres botones sueltos; la puerta y la elección viven en `core.js` y las comparten las dos pantallas | claude |
| 2026-07-31 | **Q-19 — El mixer de Víctor como icono único**: `assets/mixer.png`, blanco sobre transparente, por máscara para que tome el color del estado | claude |
| 2026-07-31 | **Q-20 — Los tres tableros entran por una sola puerta**, «Dashboards» con aguja de indicador, que pregunta cuál | claude |
| 2026-07-31 | **Q-18 — Tiro nuevo en cada acceso** (yarda 90, último camión hace 3 min) y **«Programar tiro»** desde el Control Center: la frontera entre enseñar y trabajar | claude |
| 2026-07-31 | **Q-12 — Guía de usuario ilustrada** (`docs/guia-usuario.html`): circuito de los aparatos, core features, arquitectura y botón Run | claude (subagente) |
| 2026-07-31 | **Q-17 — Muestras deja de dar de alta camiones** (duplicaba Recepción) y la comprobación de conduce repetido se muda a Recepción | claude |
| 2026-07-31 | **Q-16 — Las pantallas no dan instrucciones**: fuera las credenciales del acceso y el consejo de pantalla de inicio del portal | claude |
| 2026-07-31 | **Q-15 — Rubén ya no ve el enlace al Control Center** en el portal del teléfono | claude |
| 2026-07-31 | **Q-14 — El icono de la pantalla de inicio abre como aplicación**: manifest y etiquetas en las once pantallas | claude |
| 2026-07-31 | **Q-13 — El reporte acumulado cuadrado a la carta**: sus hojas imprimían en dos páginas y el «Página N de M» del pie mentía | claude |
| 2026-07-31 | **Q-03 — Reporte del vaciado del día**, con dos fallos reales de paso: el botón CSV (`csvCell` borrada) y los ciclos de camión imposibles del Excel histórico | claude |
| 2026-07-31 | Cierre de sesión: limpieza de código muerto, `verificar.js`, y la documentación de traspaso completa | claude |
| 2026-07-31 | Portal de teléfono, tres cuentas con papeles, guía de uso de Rubén | claude |
| 2026-07-31 | Simulación: el tiro de hoy arranca en marcha por la yarda 120 | claude |
| 2026-07-30 | Logo nuevo de QCheck en todas las pantallas, con recortes por máscara SVG (commit `ba1cae2`) | claude |
| 2026-07-30 | Barra de estado común: avance del tiro en segmentos y conexión, arriba a la derecha en todas las pantallas (`ba1cae2`) | claude |
| 2026-07-30 | Modo kiosco en Field Display, Muestras y Recepción: pantalla completa al primer toque y salida bajo contraseña (`ba1cae2`) | claude |
| 2026-07-30 | Cartas de control con estética de gráfica de mercado: umbrales punteados, trazo progresivo y punto vivo latiendo (`ba1cae2`) | claude |
| 2026-07-30 | Botón de cerrar en todas las ventanas, rejilla de dos widgets por fila en las pantallas de indicadores, sin avisos internos en la del contratista (`ba1cae2`) | claude |
| 2026-07-30 | Pantalla de acceso y guardián de sesión | claude |
| 2026-07-30 | Reporte imprimible: tabla matriz, media móvil, cartas y certificación | claude |
| 2026-07-30 | Contrato v4: independencia, QR como URL, límites publicados por QC | claude |
| 2026-07-30 | Dashboard del contratista: yardas, losas, camiones esperando, cumplimiento | claude |
| 2026-07-30 | Capa de inteligencia: agua, tendencia, humedad vencida, racha de acción | claude |
| 2026-07-30 | Pantalla Muestras para iPad con veredicto en vivo | claude |
| 2026-07-29 | Field Display, Control Center, cartas de control SPC y datos históricos | claude |
