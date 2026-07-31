# CURRENT_STATUS

**Última sesión:** 29–31 de julio de 2026 · agente `claude`
**Estado:** verde. `node verificar.js` pasa sin fallos. Publicado y funcionando.

---

## Lo que se completó en esta sesión

La sesión empezó con el prototipo ya en pie y lo llevó a producto presentable.

**Identidad y lenguaje visual**
- Logo nuevo de QCheck en las once pantallas, con los recortes rehechos como
  máscaras SVG — el vector original pintaba blanco encima y solo servía en papel.
- Se estableció la regla del **resplandor en vez del relleno**: ningún botón se
  pinta de color; el color entra por el borde y la sombra.
- Cartas de control con estética de gráfica de mercado: umbrales punteados, trazo
  progresivo y, en el último punto, un **resplandor azul que parpadea** (antes el
  punto crecía y se encogía, y competía con la línea).

**La barra de estado**
- Franja fija de borde a borde, arriba, **idéntica en todas las pantallas y a
  cualquier tamaño**. Lleva el avance del tiro en segmentos y el estado de conexión.
- Antes era una píldora que le reservaba 400 px al encabezado: eso **desbordaba la
  página 752 px en un iPhone**.

**El héroe del Control Center**
- Estado del tiro deducido de los camiones —Vaciando, Camión esperando, Esperando
  camión, Detenido, Completado, Sin comenzar— con su icono y color.
- Progreso en grande, rejilla de datos (comenzó, ritmo, hora estimada de fin,
  camiones, último camión, tramo, mezcla) y las losas de lado a lado.

**El tiempo del sitio**
- Fuente principal el **NWS, oficina de San Juan**; Open-Meteo para el nowcast de
  15 minutos y como respaldo. Iconos SVG animados propios.
- Se corrigió la ubicación: el tiro está en **San Juan, PR-52 salida de la PR-199**,
  no en Ponce.

**La simulación**
- Al entrar, si hoy está vacío, se siembra un tiro **en marcha por la yarda 120**
  esperando el próximo camión. Las horas son relativas a ahora.
- Verificado de punta a punta: recibir camión → entrar muestras → veredicto en el
  Field Display → el progreso sube.

**Móvil**
- Portal para iPhone (`movil.html`) con cuatro puertas, o cinco si es QC.
- Reflow vertical del Field Display y de Muestras, que estaban rotos de pie.
- Etiquetas de aplicación e icono para guardar en la pantalla de inicio.

**Usuarios**
- Tres cuentas con dos papeles, en **una sola lista** (`assets/usuarios.js`).
  Antes el papel se comprobaba con `qc-user === "admin"` repartido por cinco archivos.

**Idioma**
- Todo en español de Puerto Rico; la pantalla de la Autoridad estaba entera en inglés.
- Los términos que nacieron en inglés se quedan en inglés: Slump, Unit Weight,
  Moving Average, Control Charts.

**Documentación**
- Guía de uso para Rubén en `docs/guia-qcheck.html`, con el circuito del tiro en un
  diagrama. De ahí salen el PNG y el PDF.

**Fallos reales encontrados y corregidos**
- Desbordamiento horizontal de 752 px en iPhone.
- Las yardas de un camión que llegó y no había descargado se contaban como colocadas.
- Guardar «Datos del vaciado» desde Results **borraba el plan del día** del contratista.
- El cálculo de minutos no cruzaba la medianoche: apagaba el ritmo y el aviso de
  «Detenido» justo cuando más falta hacen.
- `portal.html` llevaba su propia copia del código del tema; al cargar el motor, las
  redeclaraciones rompían el bloque entero.
- La clase `cols-4` no existía en la hoja de estilos: la rejilla caía a una columna
  **en silencio**.
- La concretera se llama **Concre-Tech**, no «Concretec» — error mío en `plantCompany()`.
- Los estilos de tira del PNG se aplicaban también al papel y el PDF perdía la portada.

**Limpieza de cierre**
- Borrados: `csvCell()`, `qcNombre()`, la clase `.cols-4` y **`portal.html`**
  (menú heredado, duplicado del Control Center y confuso ahora que «portal» es móvil).
- Creado **`verificar.js`**, la prueba que el proyecto no tenía.

---

## Archivos tocados

| | |
|---|---|
| **Nuevos** | `movil.html`, `assets/usuarios.js`, `assets/clima.js`, `assets/demo.js`, `assets/icono-180.png`, `sello.js`, `verificar.js`, `docs/guia-qcheck.{html,png,pdf}`, `ARCHITECTURE.md`, `PROJECT_HANDOFF.md`, `CURRENT_STATUS.md`, `TODO.md`, `CHANGELOG.md`, `DECISIONS.md`, `.env.example` |
| **Reescritos a fondo** | `assets/core.js`, `assets/qc.css`, `control-center.html`, `display.html`, `muestras.html`, `conduce.html`, `autoridad.html` |
| **Modificados** | `index.html`, `results.html`, `contratista.html`, `produccion.html`, `reporte.html`, `assets/qc.js`, `assets/auth.js`, `AGENTS.md`, `TAREAS.md` |
| **Borrados** | `portal.html`, `docs/ARQUITECTURA.md`, `docs/ROADMAP.md`, `docs/COLABORACION.md` (consolidados) |

---

## Tareas abiertas

Ninguna a medias: la sesión cierra sin código sin terminar. Lo pendiente es trabajo
nuevo, en [`TODO.md`](TODO.md).

**Dos cosas esperan a Víctor, no a un agente:**
- Los archivos de logo oficiales del contratista, la concretera y la Autoridad.
- El vector real de Segarra Engineering (hoy hay una aproximación en el botón de
  Resultados del portal).

---

## Primera tarea sugerida para la próxima sesión

**Q-03 — el reporte diario del vaciado.**

Por qué esta y no el backend: es pequeña, se puede terminar en una sesión, y es lo
que Rubén **entrega al cerrar el tiro**. Hoy `reporte.html` solo produce el acumulado
del proyecto. Falta el del día: los camiones de la fecha, sus ensayos, las losas
tiradas, el cumplimiento y las incidencias, en una hoja.

Toda la información ya existe — `testsOfDate()`, `dayProgress()`, `losasDelDia()`,
`trendAlerts()`. Es composición, no cálculo nuevo.

Si prefieres atacar lo grande, entonces **Q-02, el backend**, y empieza por reescribir
solo `loadDB`/`saveDB` en `core.js`: la capa de datos está aislada justamente para eso.
