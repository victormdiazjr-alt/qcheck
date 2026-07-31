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
control-center.html   ← DASHBOARD y casa: widgets clicables + menú de navegación
results.html          ← datos completos: vaciado diario, pruebas, resistencias, cartas
muestras.html         ← entrada de resultados en iPad
display.html          ← pantalla de campo (TV / tablet)
contratista.html      ← estado del tiro para el contratista
produccion.html       ← vista del concretero (ver §8)
autoridad.html        ← vista de cumplimiento para ACT / FHWA
reporte.html          ← el entregable imprimible
conduce.html          ← recepción de camiones
portal.html           ← menú alterno (heredado; el menú vive en el Control Center)
assets/               ← core.js (motor), qc.js, auth.js, seed.js, qc.css
shared/               ← contrato del conduce (copia — ver §5)
docs/                 ← arquitectura, hoja de ruta, despliegue, contrato
```

El héroe del Control Center va en dos bandas. Arriba, tres bloques en fila: **estado del
tiro** con su aro junto al **progreso en grande**, una **rejilla de datos** (comenzó, ritmo,
hora estimada de fin, camiones, último camión, tramo, mezcla) y el **tiempo del sitio**.
Abajo, **las losas de lado a lado**. Debajo del héroe, los widgets van **dos por fila**
(`grid cols-2`) — indicadores, avisos, último camión y cartas, todos con el mismo ancho. La rejilla existe para que no quede hueco muerto entre
el progreso y el tiempo — si un dato no existe, su casilla simplemente no se pinta.

`ritmoTiro(day)` calcula yardas por hora y **a qué hora acabaría a ese paso**, con las
yardas colocadas contra el tiempo desde el primer camión. No es una promesa: se enseña con
«≈». Con menos de tres camiones o menos de media hora no da número.

`estadoTiro(day)` en `core.js` deduce en qué anda el vaciado — *Vaciando, Camión esperando,
Esperando camión, Detenido, Tiro completado, Sin comenzar* — **de los camiones**, sin ningún
interruptor que alguien tenga que acordarse de mover. «Detenido» no usa un umbral inventado:
compara el tiempo sin novedad con **el ritmo del propio día** (el doble de la mediana entre
camiones), así que un día de camiones cada 20 min se da por detenido antes que uno de cada
hora. Un día que no es hoy siempre sale cerrado.

Las losas (`losasDelDia` en `core.js`) salen **solo** del plan del día, `dayMeta.losas`,
que se escribe `L3-0.943:24, L3-0.936:18, L3-0.929` — el número tras los dos puntos son
las yardas planificadas de esa losa, y es opcional. **Sin lista declarada no se pinta
nada, ni un aviso**: deducir el plan de lo que los camiones sirvieron sería inventarlo.

El avance de cada losa sale de los camiones, y aquí hay una trampa: **un camión que
reparte su carga entre varias losas no dice cuánto dejó en cada una.** Ese volumen NO se
reparte a ojo. Solo se atribuyen las yardas de los camiones que sirvieron una sola losa;
si además hubo cargas repartidas, la cifra se lee como un mínimo (`≥`). Cuando una losa
solo recibió cargas repartidas no se pinta una barra al 0 %: se dice cuántas cargas
compartidas la tocaron. Y una losa que nadie ha tocado enseña su código y nada más.

El **Control Center** es la pantalla principal: muestra en widgets lo que Rubén mira de
verdad y cada widget entra al detalle en `results.html#<pestaña>` (`daily`, `tests`,
`strength`, `charts`, `live`, `plan`). Si añades una pantalla de usuario, **agrégala al
menú** en `PANTALLAS` dentro de `control-center.html`.

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
- **Español de Puerto Rico** en toda la interfaz —incluida la pantalla de la Autoridad— y en
  los comentarios. No vale con que la palabra esté en el diccionario: tiene que ser la que
  se usa aquí. «Calima» es correcto en España y nadie la entiende en la isla; se dice
  **polvo del Sahara**. Igual **aguaceros**, no «chubascos». Los nombres de pantalla que
  eligió Víctor en inglés (Field Display, Control Center, Results) se quedan como están.
- **Los datos históricos no se traducen.** Los comentarios del Excel («REJECTED - UW Out of
  Tolerance») los escribió el inspector: son el expediente, no texto de interfaz.
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

## 8. Las DOS pantallas de producción — no son duplicado

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

## 9. La barra de estado y el modo kiosco

**Todas las pantallas llevan la misma barra** — `mountStatusBar(dia, {kiosco})` en `core.js`.
Es la barra de estado del teléfono aplicada a la obra: avance del tiro (yardas colocadas
contra las planificadas, en segmentos) y estado de conexión, siempre a la vista. El botón
de cerrar vive dentro de ella.

**Es una franja fija de borde a borde, pegada arriba, en todas las pantallas y a cualquier
tamaño, y NADA se pinta encima.** El resto del GUI empieza justo debajo: `--qcs-h` lleva su
alto y de ahí cuelgan `body { padding-top }` y el `top` de los encabezados pegajosos. Si
añades una pantalla, no la desplaces a mano — basta con que llame a `mountStatusBar()`.
Sus estilos se **inyectan desde `core.js`**, no desde `qc.css`, para que las pantallas de
campo (que no cargan `qc.css`) la vean idéntica. `--qcs-e` escala el conjunto: el Field
Display la agranda porque se lee de lejos, y vuelve a 1 en pantallas bajitas.

Si el día no tiene yardas planificadas, la barra dice **«sin plan»** y lleva al formulario
donde se definen. **No inventes un total.**

**Las tres pantallas de campo — `display.html`, `muestras.html`, `conduce.html` — entran a
pantalla completa con el primer toque** (`pantallaCompletaAlTocar()`; iOS Safari no
implementa la API y ahí simplemente no ocurre).

El botón de cerrar **no pide contraseña en ninguna pantalla**: llegó a tener un candado en
las de campo y Víctor lo quitó el 31 jul 2026 por estorboso. Si algún día hace falta blindar
la salida de un iPad montado en obra, eso va con la autenticación real (Q-07), no con una
clave escrita en el navegador.

## 8b. La simulación — el tiro de hoy ya en marcha

`assets/demo.js`. Al entrar, si **hoy no tiene ni un camión**, el sistema siembra un vaciado
ya empezado: **120 yardas de un plan de 260, doce camiones recibidos y todo a la espera del
próximo**. Un tablero vacío no demuestra nada, y QCheck se enseña antes de usarse.

- **Nunca pisa datos**: solo siembra si el día está vacío. Lo que crea lleva `source: "demo"`.
- **Las horas son relativas a AHORA**, no fijas: se abra a la hora que se abra, el último
  camión acaba de irse y el estado es *Esperando camión*. El paso entre camiones se aprieta
  para que el tiro no acabe «empezando» de madrugada.
- A partir de ahí **no hay nada falso**: se recibe el camión en Recepción, se entran las
  muestras, el Field Display canta el veredicto y el progreso sube. Es la herramienta de
  verdad sobre un día ya empezado.
- En **Plan & Datos** hay un panel para **reiniciarla** o **apagarla** (apagar deja el día en
  blanco y no vuelve a sembrar; los 397 ensayos históricos no se tocan).
- Recepción sugiere el **próximo conduce** y la **primera losa pendiente** — son marcadores
  de posición en gris, no se guarda nada hasta que el técnico lo confirme.

**Yardas colocadas ≠ recibidas.** Un camión que llegó y no ha terminado de descargar todavía
no colocó nada: `dayProgress` lo lleva en `enCurso`, aparte de `placed`. Eso **solo aplica al
día en curso** — 95 de los registros históricos vienen del Excel sin hora de fin, y ahí el
tiro ya se cerró: lo recibido es lo colocado.

## 9a. El clima — la única salida a internet

`assets/clima.js` pinta el tiempo del sitio del tiro en el héroe del Control Center:
condición de ahora con icono animado y una tira de las próximas horas. Para hormigón no
es adorno — el sol y la lluvia de la próxima hora deciden si se tira o se espera.

- **Fuente principal: el NWS, oficina de San Juan** (`api.weather.gov`). Es la fuente
  oficial para Puerto Rico y la que citaría la ACT o la FHWA: un meteorólogo de la
  oficina ajusta esa rejilla a mano, no es salida cruda de un modelo. Gratis, sin llave,
  con CORS. Su texto viene en inglés y **no se muestra tal cual**: se traduce a una
  condición propia (`climaDeTexto`) porque la interfaz es en español. La rejilla del
  punto se guarda en `localStorage` — no cambia nunca.
- **Open-Meteo** cumple dos papeles: el **nowcast de 15 minutos**, que el NWS no publica
  y es lo que permite decir "lluvia en unos 25 min", y el **respaldo entero** si el NWS
  no contesta. Las dos consultas salen en paralelo.
- **Es lo único de QCheck que sale a la red.** Sin internet la tarjeta lo dice y
  **no inventa nada**; el resto de la herramienta sigue funcionando igual.
- En Puerto Rico el `haze` del NWS casi siempre es **polvo del Sahara**: se muestra como
  «Calima», no como neblina.
- Los iconos son **SVG propio animado con CSS**. No metas una librería ni un archivo de
  iconos: el proyecto tiene que abrir con doble clic.
- Las coordenadas viven en `db.project` (`lat`, `lon`, `place`) y se editan en
  **Plan & Datos → Proyecto**. Por defecto: **PR-52 a la altura de la salida de la
  PR-199 (Las Cumbres), San Juan** — 18.362, −66.091. Lo confirmó Víctor.
- Se consulta como mucho **cada 15 minutos**; el tablero se repinta muchas veces y el
  clima se sirve de memoria. No lo llames en cada `render()` sin ese resguardo.

## 9b. iPhone y iPad — reglas que no se rompen

Las pantallas de campo se abren en una tableta o un teléfono, así que **cada cambio
se prueba a 390×844 (iPhone), 768×1024 (iPad de pie) y 1024×768 (iPad acostado)**.

- **La página nunca se desplaza a lo ancho.** `scrollWidth` tiene que ser igual al
  ancho de la ventana. Lo que sea más ancho —una tabla, una gráfica, la hoja del
  reporte— se desplaza **dentro de su propio contenedor** con `overflow-x: auto`.
  Las columnas de rejilla necesitan `min-width: 0` o se estiran hasta el ancho de
  lo que llevan dentro.
- **Hasta 820 px la barra de estado es la franja de arriba**, no una píldora en la
  esquina: en un teléfono robarle 400 px al encabezado desbordaba la página.
- **`100dvh`, no `100vh`**: en iOS la barra de Safari entra y sale y `100vh` deja el
  pie fuera de la pantalla.
- **Field Display y Muestras están pensadas acostadas.** De pie se apilan con un
  bloque `@media (orientation: portrait)`, y ahí los tamaños salen del **ancho**
  (`vw`, o `min(vw, vh)` cuando también hay que caber a lo alto). Mezclar `vh` para
  el texto con `vw` para las columnas es lo que las rompía en vertical.
- **`env(safe-area-inset-*)`** en todo lo fijo: la franja de arriba, los botones
  flotantes y los pies. Las pantallas de kiosco llevan `viewport-fit=cover`.

## 10. Lenguaje visual — una sola identidad

**Todo QCheck usa el mismo lenguaje del Field Display y de Muestras.** Los tokens viven
en `assets/qc.css`; no inventes colores en las pantallas.

- **Oscuro por defecto**, con variante de día. Fondo `#0a0d12`, superficies `#12171f`.
- **Marca**: el logo es la Q azul con los chevrons de Segarra y la C centrada
  (`assets/logo-qcheck.svg`). En las pantallas va **en línea**, con los recortes hechos con
  máscaras SVG — nunca con relleno blanco encima, que solo funciona sobre papel. Su paleta
  sale de `--logo-blue/green/g1/g2`, aclarada sobre fondo oscuro y original sobre el papel
  del reporte. Colores de interfaz: azul `#4a63d8` y verde lima `#96c93d`.
- **Semántica**: verde `#34d27b` dentro de límites · ámbar `#f5b83d` zona de acción ·
  rojo `#ff5a52` fuera. Iguales en las cinco pantallas.
- **El naranja NO se usa en QCheck**: es la marca de Concre-Ticket. Si ves naranja aquí,
  es un descuido — cámbialo por `var(--accent2)`.
- **El color entra por el resplandor, no por el relleno.** Nada de botones pintados de
  verde o de azul: superficie de panel, borde teñido y un `box-shadow` de color alrededor.
  Así el color señala sin gritar y todo pertenece al mismo tablero oscuro. El botón de
  enviar de Muestras además respira, porque es la acción que se busca con la mano sucia.
- **Tipografía**: cifras grandes en peso ligero (300) con `tabular-nums`;
  micro-etiquetas en mayúsculas con `letter-spacing` amplio (.16em–.26em).
- Esquinas de 14 px, líneas de un pelo (`var(--line)`), sombras suaves.

La única excepción deliberada: **`reporte.html` imprime sobre hojas blancas**, porque el
papel es blanco. Su interfaz sigue el tema; las hojas no.
