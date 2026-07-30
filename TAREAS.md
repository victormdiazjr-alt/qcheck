# Bitácora de tareas — QCheck

**Esta es la fuente de verdad sobre quién hace qué.** Antes de escribir una sola línea:
`git pull`, lee esto, reclama tu tarea, `git push`. Ver el protocolo en `AGENTS.md` §2.

Agentes que trabajan aquí: `claude` (Claude Code) · `codex` (OpenAI Codex) · `victor`.

---

## En curso

_(vacío — reclama una tarea moviéndola aquí con tu nombre y la fecha)_

| id | tarea | agente | desde |
|----|-------|--------|-------|

---

## Pendiente

| id | tarea | por qué importa | tamaño |
|----|-------|-----------------|--------|
| Q-01 | **OCR del conduce en papel** — foto → el sistema entra los datos solos | La mayoría de concreteras no tendrán QR: esta es la vía principal de entrada, no el respaldo | grande |
| Q-02 | **Backend y base de datos en la nube** | Hoy cada navegador guarda lo suyo; sin esto no hay "correr en vivo" para el equipo | grande |
| Q-03 | **Reporte diario de vaciado** (el del mismo día, no el acumulado) | Es lo que se entrega al cerrar el tiro | mediano |
| Q-04 | **Correo automático al rechazar** | Hoy abre un correo pre-llenado; falta el envío real (necesita Q-02) | mediano |
| Q-05 | **Línea de tiempo de eventos por conduce** | Modelo de datos definitivo: salida de planta, llegada, muestra, veredicto, vaciado, cilindros | mediano |
| Q-06 | **Adjuntos en el conduce**: foto del conduce, pesadas, fotos de losa y cilindros | Cierra el expediente digital que hoy se arma a mano | mediano |
| Q-07 | **Autenticación real** con usuarios y roles | Hoy la puerta es de demostración (`admin`/`1234`), no protege nada | mediano (necesita Q-02) |
| Q-08 | **Más reglas de inteligencia** | La capa de avisos ya detecta agua, tendencia y humedad vencida; faltan reglas de temperatura y de tiempo de viaje | pequeño |
| Q-09 | **Aire en el tablero del productor** | El contrato ya publica los límites de aire; nadie los muestra | pequeño |
| Q-10 | **Integración con ArcGIS** | La inspección ya georreferencia losas ahí; evaluar el enlace | investigación |

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
| 2026-07-30 | Pantalla de acceso y guardián de sesión | claude |
| 2026-07-30 | Reporte imprimible: tabla matriz, media móvil, cartas y certificación | claude |
| 2026-07-30 | Contrato v4: independencia, QR como URL, límites publicados por QC | claude |
| 2026-07-30 | Dashboard del contratista: yardas, losas, camiones esperando, cumplimiento | claude |
| 2026-07-30 | Capa de inteligencia: agua, tendencia, humedad vencida, racha de acción | claude |
| 2026-07-30 | Pantalla Muestras para iPad con veredicto en vivo | claude |
| 2026-07-29 | Field Display, Control Center, cartas de control SPC y datos históricos | claude |
