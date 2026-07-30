# AGENTS.md — instrucciones para agentes de IA

Léeme **antes de tocar nada**. Aplica a Claude Code, OpenAI Codex y cualquier asistente
que trabaje en este repositorio. Dueño del proyecto: **Víctor Díaz**.

---

## 1. Qué es este repositorio

**QCheck** — herramienta de control de calidad de hormigón de **Segarra Engineering**.
Producto **independiente**. No depende de ninguna otra herramienta para funcionar.

Su hermana, **Concre-Ticket** (la concretera), vive en otro repositorio.
Lo único que comparten es `shared/conduce-contract.js` — ver §5.

## 2. Regla de oro: la bitácora manda

**`TAREAS.md` es la única fuente de verdad sobre quién está haciendo qué.**
Existe para que dos agentes en dos herramientas distintas **nunca hagan el mismo trabajo**.

Protocolo obligatorio, sin excepciones:

```
1. git pull                        ← SIEMPRE antes de empezar
2. Lee TAREAS.md
3. ¿Tu tarea ya está "en curso" por otro?  → NO la toques. Escoge otra o pregunta.
4. Reclámala: muévela a "En curso" con tu nombre y la fecha
5. git commit -m "tarea: reclamo <id>" && git push     ← ANTES de escribir código
6. Trabaja
7. Al terminar: muévela a "Hecho", commit y push
```

El paso 5 no es opcional. Si trabajas sin reclamar, otro agente puede estar
escribiendo el mismo archivo en este momento.

Si encuentras una tarea "en curso" con más de 24 h sin avanzar, puedes reclamarla —
anótalo en la bitácora.

## 3. Cómo correr el proyecto

```bash
node serve.js 8452
# abre http://localhost:8452  → pantalla de acceso
```
Usuario de demostración: `admin` / `1234`.

Sin paso de compilación. HTML, CSS y JavaScript planos. **No introduzcas un bundler,
un framework ni dependencias de npm** sin acuerdo explícito de Víctor: el proyecto
tiene que poder abrirse con doble clic y funcionar sin internet en carretera.

## 4. Estructura

```
index.html            ← acceso (la raíz del dominio)
control-center.html   ← panel de QC (pantalla principal)
muestras.html         ← entrada de resultados en iPad
display.html          ← pantalla de campo (TV / tablet)
contratista.html      ← estado del tiro para el contratista
produccion.html       ← rendimiento (vista de planta)
autoridad.html        ← vista de cumplimiento para ACT / FHWA
reporte.html          ← el entregable imprimible
conduce.html          ← recepción de camiones
portal.html           ← menú de pantallas
assets/               ← core.js (motor), qc.js, auth.js, seed.js, qc.css
shared/               ← contrato del conduce (copia — ver §5)
docs/                 ← arquitectura, hoja de ruta, despliegue, contrato
```

**`assets/core.js` es el motor**: almacenamiento, zonas SPC, cálculos, gráficas SVG,
formularios, tema y sincronización entre ventanas. Si una función la usan dos pantallas,
va en `core.js`. Nunca la dupliques.

## 5. El contrato compartido — cuidado aquí

`shared/conduce-contract.js` es **una copia** del mismo archivo que vive en el repositorio
de Concre-Ticket. Define cómo se entienden las dos herramientas: la llave del conduce,
los campos de origen, el formato del QR y la publicación de límites.

- **Cambiarlo obliga a cambiarlo en los dos repositorios y a subir `VERSION`.**
- Si crees que necesita un cambio: **anótalo en `TAREAS.md` bajo "Contrato" y avisa a Víctor.**
  No lo edites por tu cuenta.
- QCheck **publica** los límites de especificación; Concre-Ticket solo los **lee**.

## 6. Reglas de trabajo

- **Verifica en el navegador antes de decir que algo funciona.** Levanta el servidor,
  abre la pantalla, haz clic, mira la consola. Nunca reportes como funcionando algo
  que no viste funcionar.
- **Borra los datos de prueba** que crees. La base sembrada tiene 397 ensayos reales
  del proyecto; debe quedar como estaba.
- **Español** en la interfaz (es el idioma de la cuadrilla) y en los comentarios.
- **No inventes límites, valores ni resultados.** Si un dato no existe, muestra que no existe.
- Commits pequeños y descriptivos, en español.
- No subas `node_modules`, respaldos ni archivos temporales.

## 7. Contexto del negocio

- El cliente principal es el **contratista**, no la Autoridad: la industria se mueve a que
  el contratista haga su propio control de calidad.
- El dolor que resolvemos: hoy el técnico llena una hoja en papel y otra persona la
  vuelve a escribir en Excel. **Excel se reemplaza**; queda como formato de exportación.
- Rubén Segarra (el ingeniero de QC) mira sobre todo **peso unitario y revenimiento**,
  en vivo y con tendencia.
- La mayoría de las concreteras **no tendrán Concre-Ticket ni códigos QR**: llegan con
  conduce en papel. La entrada por foto y manual es la vía principal, no el respaldo.

Detalle completo en `docs/ARQUITECTURA.md` y `docs/ROADMAP.md`.

## 9. Las DOS pantallas de producción — no son duplicado

Existe una `produccion.html` en **cada** repositorio. Son distintas a propósito y
**ninguna sustituye a la otra. No las unifiques ni borres una.**

| | QCheck · `produccion.html` | Concre-Ticket · `produccion.html` |
|---|---|---|
| **De quién es el dato** | De QC: lo que Segarra midió en obra | De la planta: sus propios despachos |
| **Quién la ve** | El concretero que surte ESE vaciado | El dueño y el operador de la planta |
| **Cuándo aplica** | Siempre que QCheck inspeccione, **surta quien surta** | Solo si la concretera es cliente de Concre-Ticket |
| **Qué muestra** | Ritmo, ciclos batch→descarga, esperas y calidad de sus camiones | Lo anterior más lo interno: despachos, numeración, facturación |

La clave: **la mayoría de las concreteras no serán clientes de Concre-Ticket**, pero igual
surten vaciados que Segarra inspecciona. La pantalla de QCheck es lo que Segarra les
entrega en ese caso — información que hoy Rubén les pasa por teléfono. Es, además, la
puerta comercial hacia Concre-Ticket.
