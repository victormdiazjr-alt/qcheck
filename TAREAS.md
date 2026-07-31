# Bitácora de tareas — QCheck

**Esta es la fuente de verdad sobre quién hace qué.** Antes de escribir una sola línea:
`git pull`, lee esto, reclama tu tarea, `git push`. Ver el protocolo en `AGENTS.md` §2.

Agentes que trabajan aquí: `claude` (Claude Code) · `codex` (OpenAI Codex) · `victor`.

---

## En curso

| id | tarea | agente | desde |
|----|-------|--------|-------|
| Q-12 | **Guía de usuario ilustrada** para Rubén: circuito de los aparatos, core features y arquitectura, con botón Run que detecta el aparato y lleva a su portal | claude (subagente) | 2026-07-31 |
| Q-14 | **El icono de iPhone abre como marcador, no como aplicación** — falta el manifest y seis pantallas no llevan las etiquetas | claude | 2026-07-31 |
| Q-15 | **El enlace al Control Center en el portal lo ve Rubén** y solo debe verlo el administrador | claude | 2026-07-31 |
| Q-16 | **Quitar el aviso de «añadir a la pantalla de inicio»** de las pantallas: pasa a la guía | claude | 2026-07-31 |

---

## Pendiente

| id | tarea | por qué importa | tamaño |
|----|-------|-----------------|--------|
| Q-01 | **OCR del conduce en papel** — foto → el sistema entra los datos solos | La mayoría de concreteras no tendrán QR: esta es la vía principal de entrada, no el respaldo | grande |
| Q-02 | **Backend y base de datos en la nube** | Hoy cada navegador guarda lo suyo; sin esto no hay "correr en vivo" para el equipo | grande |
| Q-04 | **Correo automático al rechazar** | Hoy abre un correo pre-llenado; falta el envío real (necesita Q-02) | mediano |
| Q-05 | **Línea de tiempo de eventos por conduce** | Modelo de datos definitivo: salida de planta, llegada, muestra, veredicto, vaciado, cilindros | mediano |
| Q-06 | **Adjuntos en el conduce**: foto del conduce, pesadas, fotos de losa y cilindros | Cierra el expediente digital que hoy se arma a mano | mediano |
| Q-07 | **Autenticación real** con usuarios y roles | Hoy la puerta es de demostración (`admin`/`1234`), no protege nada | mediano (necesita Q-02) |
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
