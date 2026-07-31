# AGENTS.md — instrucciones para agentes de IA

Léeme **antes de tocar nada**. Aplica a Claude Code, OpenAI Codex y cualquier asistente
que trabaje en este repositorio. Dueño del proyecto: **Víctor Díaz**.

---

## 1. Qué es este repositorio

**QCheck** — herramienta de control de calidad de hormigón de **Segarra Engineering**.
Producto **independiente**. No depende de ninguna otra herramienta para funcionar.

Su hermana, **Concre-Ticket** (la concretera), vive en otro repositorio.
Lo único que comparten es `shared/conduce-contract.js` — ver §5.

## 1b. Mapa de la documentación

| Archivo | Para qué |
|---|---|
| **`AGENTS.md`** | este — obligatorio antes de tocar nada |
| `PROJECT_HANDOFF.md` | retomar el proyecto de cero |
| `ARCHITECTURE.md` | cómo está hecho |
| `DECISIONS.md` | **por qué** está hecho así, con el precio de cada decisión |
| `CURRENT_STATUS.md` | dónde se quedó la última sesión |
| `TODO.md` | lo que falta, por prioridad |
| `TAREAS.md` | quién está haciendo qué **ahora** |
| `CHANGELOG.md` | qué cambió y cuándo |

Antes de dar nada por bueno: **`node verificar.js`**.

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
**Los usuarios viven en `assets/usuarios.js` — una sola lista.** Para añadir a alguien se
toca ese archivo y nada más; el papel se comprueba con `qcEsQC()`, nunca con el nombre.

| usuario | clave | papel | dónde entra |
|---|---|---|---|
| `ruben` | 1234 | qc | teléfono → portal · computadora → Control Center |
| `admin` | 1234 | qc | igual que Rubén |
| `invitado` | 1234 | consulta | siempre al portal, sin Resultados |

El papel **se deduce del usuario en cada comprobación, no se guarda**: así una sesión abierta
antes de añadir a alguien no queda a medias. `auth.js` devuelve al portal a quien no lleve
el control de calidad si escribe a mano la dirección de una pantalla de QC. Como el acceso mismo, frena un despiste, no a
alguien decidido: vive en el navegador. El candado de verdad llega con el backend (Q-07).

Sin paso de compilación. HTML, CSS y JavaScript planos. **No introduzcas un bundler,
un framework ni dependencias de npm** sin acuerdo explícito de Víctor.

**Funcionar sin internet ya NO es requisito en esta fase** — Víctor lo levantó el
31 jul 2026. Se sirve por HTTP y punto. Sigue en pie lo de no meter dependencias:
el valor está en que cualquiera pueda abrir un archivo y entenderlo.

**Antes de cada commit que toque `assets/` o `shared/`, corre `node sello.js`.**
Le pone a cada `<script>` y `<link>` un sello sacado del contenido del archivo
(`core.js?v=b91072e1`). GitHub Pages cachea los .js diez minutos: sin el sello,
despliegas un arreglo y durante ese rato el navegador sigue enseñando el fallo
anterior — ya pasó una vez en una prueba. Es idempotente: correrlo de más no hace nada.

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
reporte.html          ← el entregable imprimible (dos alcances — ver §11)
conduce.html          ← recepción de camiones
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
- **Los términos técnicos que nacieron en inglés se quedan en inglés**, con mayúscula
  inicial: **Slump**, **Unit Weight**, **Moving Average**, **Control Charts**, Batch,
  Ticket, Set, PSI, CY. Es como se dicen en la obra aunque la frase sea en español, y así
  cuadran con el Excel de Rubén. Lo que sí es español se queda en español —resistencia,
  aire, lote, vaciado, losa, mezcla, conduce, camión— y **los comentarios del Excel
  histórico no se tocan nunca**.
- **Español de Puerto Rico** en el resto de la interfaz —incluida la pantalla de la Autoridad— y en
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

Detalle completo en `ARCHITECTURE.md` y `TODO.md`.

**La guía de Rubén** vive en `docs/guia-qcheck.html` — es la fuente. De ahí salen el PNG y
el PDF con Chrome sin ventana; los dos comandos están en el comentario de cabecera del
propio archivo. Si cambia cómo se usa algo, se edita el HTML y se vuelven a generar.

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

**Entran a pantalla completa con el primer toque `display.html` y `muestras.html`**
(`pantallaCompletaAlTocar()`; iOS Safari no implementa la API y ahí simplemente no ocurre).
**Recepción no** — Víctor la sacó el 31 jul 2026: se usa entrando y saliendo de otras
pantallas, y ponerse a pantalla completa al tocarla estorbaba.

El botón de la esquina **lleva a la casa** — no cierra la pestaña. Cuál es la casa lo
decide `casaDe()`: en un teléfono, **el portal** (`movil.html`), porque el Control Center no
cabe en la mano; para el invitado, siempre el portal, que no tiene tablero; en el escritorio
con `admin`, el Control Center. Desde la propia casa el botón sale de la sesión, y el rótulo
lo dice: «Volver al portal», «Volver al Control Center» o «Salir».
Si la pantalla está a pantalla completa, `cerrarVentana()` **sale de fullscreen primero**:
navegar sin salir dejaría el Control Center ocupando la pantalla entera, sin barra del
navegador ni forma de volver. Desde la propia casa, el botón sale de la sesión.

No pide contraseña en ninguna pantalla: llegó a tener un candado en
las de campo y Víctor lo quitó el 31 jul 2026 por estorboso. Si algún día hace falta blindar
la salida de un iPad montado en obra, eso va con la autenticación real (Q-07), no con una
clave escrita en el navegador.

## 8a. El portal del teléfono

`movil.html`. Quien consulta el tiro desde el teléfono —el concretero, el contratista, la
Autoridad— **no entra datos**: mira. Por eso el portal tiene cuatro puertas y nada más
(Concretera, Contratista, Autoridad, Field Display), más un resumen del tiro arriba para no
tener que entrar a ver si está pasando algo.

- **Al entrar desde un teléfono, el acceso lleva aquí**, no al Control Center. `esTelefono()`
  mira el agente de usuario, **no el ancho**: el iPad en vertical mide 768 px y NO debe caer
  aquí — es el aparato de Muestras y necesita el tablero entero. iPadOS se anuncia como
  «Macintosh», así que no cuela. Del portal se salta al Control Center con un enlace al pie.
- **El Field Display se abre con `?acostar=1`**: pide pantalla completa y orientación
  horizontal (`acostarPantalla()`). **En el iPhone eso no se puede** — Safari de iPhone no
  implementa ni `requestFullscreen` ni el bloqueo de orientación. Por eso el plan B no es
  opcional: si el aparato está de pie sale un aviso de girarlo, que se quita solo al girar.
  Si tocas esto, no quites el aviso creyendo que sobra.
- Las demás pantallas de indicadores se abren normales, sin trucos.
- **Quien lleva el control de calidad ve además Resultados, y va primero.** Su logotipo son
  los chevrons apilados de Segarra Engineering, recortados del logo de QCheck y sin texto.
  **No es el logo real de Segarra** — ese nunca llegó al repositorio; si Víctor lo envía, se
  sustituye ahí.
- **El enlace al Control Center, al pie, NO lo ve Rubén.** No es cosa del papel: Rubén lleva
  el control de calidad y aun así no lo ve, porque ese tablero no cabe en un teléfono. Va por
  capacidad de la cuenta —`qcVeTablero()`, la marca `tablero: true` en `assets/usuarios.js`—
  y **no** comprobando `usuario === "admin"`, que es lo que §3 prohíbe.
- **Pantalla completa de verdad en iPhone = guardarlo en la pantalla de inicio**, y desde el
  31 jul 2026 es **requisito**, no consejo. Ver §12.
- **Las pantallas no dan instrucciones.** Víctor lo pidió el 31 jul 2026: el acceso ya no
  enseña las credenciales de demostración y el portal ya no explica cómo guardar el icono.
  Todo eso vive en la guía de usuario. Si te hace falta explicar algo dentro de una pantalla,
  probablemente la pantalla esté mal.

## 8b. La simulación — el tiro de hoy ya en marcha

`assets/demo.js`. El sistema siembra un vaciado ya empezado: **90 yardas de un plan de 260,
nueve camiones recibidos y el último terminado hace 3 minutos**. Un tablero vacío no
demuestra nada, y QCheck se enseña antes de usarse.

- **Cada acceso arranca un tiro nuevo** (Víctor, 31 jul 2026). Quien entra se encuentra
  siempre el mismo punto de partida y no lo que dejó a medias la visita anterior. El acceso
  no puede sembrarlo —no carga el motor ni los 397 ensayos, y meterlos en una pantalla de dos
  campos serían 150 KB de nada—, así que deja la marca `qc-nuevo-tiro` en `sessionStorage` y
  la recoge `sembrarDia()` en la primera pantalla que sí carga el motor.
- **Esto solo escribe sobre HOY.** El histórico del proyecto —los 397 ensayos del Excel y
  todos los días anteriores— sigue entero y analizable en Results y en las Control Charts.
- **Fuera de eso, nunca pisa datos**: solo siembra si el día está vacío. Lo que crea lleva
  `source: "demo"`.
- **Las horas son relativas a AHORA**, no fijas: se abra a la hora que se abra, el último
  camión acaba de irse y el estado es *Esperando camión*. El paso entre camiones se aprieta
  para que el tiro no acabe «empezando» de madrugada.
- A partir de ahí **no hay nada falso**: se recibe el camión en Recepción, se entran las
  muestras, el Field Display canta el veredicto y el progreso sube. Es la herramienta de
  verdad sobre un día ya empezado.
- En **Plan & Datos** hay un panel para **reiniciarla** o **apagarla** (apagar deja el día en
  blanco y no vuelve a sembrar; los 397 ensayos históricos no se tocan).
- **Para trabajar de verdad, Rubén programa el tiro desde el Control Center** — el botón
  «Programar tiro», el primero del menú. Eso borra el vaciado simulado de hoy, **apaga la
  simulación para siempre** (`db.demo = false`, y ni el acceso la vuelve a encender) y abre
  el plan del día. Es la frontera entre enseñar y trabajar: `programarTiro()` en `demo.js`.
- El plan del día (`formDayMeta`) vive en **`core.js`**, no en `qc.js`, porque lo abren dos
  pantallas: Results en Plan & Datos y el Control Center al programar el tiro.
- Recepción sugiere el **próximo conduce** y la **primera losa pendiente** — son marcadores
  de posición en gris, no se guarda nada hasta que el técnico lo confirme.

**Yardas colocadas ≠ recibidas.** Un camión que llegó y no ha terminado de descargar todavía
no colocó nada: `dayProgress` lo lleva en `enCurso`, aparte de `placed`. Eso **solo aplica al
día en curso** — 95 de los registros históricos vienen del Excel sin hora de fin, y ahí el
tiro ya se cerró: lo recibido es lo colocado.

## 8c. Las marcas de las partes

El contratista, la concretera y la Autoridad salen con su logo donde aparece su nombre
(`marcaHTML()` en `core.js`). **Los archivos los pone Víctor** en `db.project.logos`, desde
Plan & Datos → Proyecto: son marcas registradas de cada empresa y **no se bajan de sus webs
por nuestra cuenta**. Mientras no haya archivo no se deja un hueco — se dibuja un monograma
con las iniciales (DVG, CT, ACT), que se ve intencionado.

`inicialesDe()` deja caer la forma jurídica siempre y los conectores solo si van en
minúscula: «Del Valle Group» da DVG porque «Del» es parte del nombre, mientras que
«Autoridad de Carreteras y Transportación» da ACT.

**La concretera se llama Concre-Tech**, no «Concretec» — era un error mío en `plantCompany()`.

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

## 11. El reporte: dos alcances, una hoja de papel

`reporte.html` produce **dos** entregables con el mismo encabezado, pie, estilos de hoja y
reglas de impresión. Son el mismo producto con distinto alcance, no dos pantallas:

| | **Del vaciado** (`?dia=2026-07-31`) | **Acumulado** (`?modo=acumulado`) |
|---|---|---|
| Qué cubre | un día | el proyecto, o un rango con filtro de lote |
| Cuándo | **al cerrar el tiro** — es lo que se entrega | expediente, revisiones, cierre de lote |
| Hojas | cómo cerró · losas y avisos · bitácora de camiones · Control Charts del día · incidencias y firmas | portada · tabla matriz · Moving Average · Control Charts · rechazos y firmas |

**Por defecto abre el del día**, porque es el que se saca a diario. El acumulado está a un
clic. `render()` reparte a `renderDiario()` o `renderAcumulado()` y **la barra se pinta una
sola vez**, en `barra()`.

Reglas que no se rompen aquí:

- **El reporte no calcula nada por su cuenta.** Sale de `dayProgress`, `dayStats`,
  `losasDelDia` y `trendAlerts`, el mismo motor que pinta el Control Center: si un número
  del papel firmado no cuadra con el tablero, es un fallo.
- **Cada `<div class="sheet">` tiene que caber en una carta.** El pie dice «Página N de M»
  y deja de ser verdad en cuanto una hoja se desborda a dos páginas. El presupuesto son
  **892 px de contenido** (11 in − márgenes de `@page` − el relleno de la hoja). Por eso van
  **18 camiones por hoja** en la bitácora y **dos cartas por hoja**, no cuatro. Si añades una
  sección, mide: `alto de .sheet en pantalla − 134`.
- **Un día sin plan declarado no se compara con nada, y un día sin camiones no se rellena
  con ceros.** La hoja dice que no existe. Igual con las losas: sin lista declarada no se
  deduce el plan de lo que sirvieron los camiones.
- **Si el tiro sigue abierto, la hoja lo avisa** arriba y en la certificación. Se firma lo
  que hay, y hay que saber que es una foto a media faena.

## 12. La aplicación en la pantalla de inicio

**Añadir QCheck a la pantalla de inicio es requisito**, no un consejo (Víctor, 31 jul 2026).
Es la única forma de que las pantallas de campo abran limpias en iPhone y iPad.

Para que el icono guardado abra **como aplicación** y no como marcador de Safari —con una
franja arriba enseñando el dominio— hacen falta **las dos cosas, en todas las pantallas**:

- **`manifest.webmanifest`** en la raíz, con `display: "standalone"`, `scope` y `start_url`
  relativos (el sitio cuelga de `/qcheck/`, no del dominio), y los colores de fondo y de
  tema en `#0a0d12`. Desde iOS 16.4 Safari lee el manifest; antes solo miraba las etiquetas
  de Apple, y por eso van las dos.
- **El bloque de etiquetas** justo debajo del `<meta name="viewport">`: `rel="manifest"`,
  `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `status-bar-style`,
  `apple-mobile-web-app-title` y el `apple-touch-icon` de 180 px.

**Si añades una pantalla, cópiale ese bloque.** Faltaba en seis de las once y ahí el icono
abría como marcador. `node verificar.js` comprueba que el manifest exista, no que esté
enlazado: no te fíes, míralo.

Dos cosas que hay que saber y decir sin rodeos:

- **iOS no deja añadir nada a la pantalla de inicio por código. No existe API.** Safari
  obliga a tocar Compartir → «Añadir a inicio». Cualquier «Run» o botón de instalar en iOS
  solo puede *guiar*; si alguna vez parece que lo hace solo, está mintiendo.
- **iOS congela estos datos cuando se crea el icono.** Cambiar el manifest o las etiquetas
  no arregla un icono ya guardado: hay que borrarlo y volver a añadirlo.

## 13. Los camiones entran por Recepción, y solo por ahí

Muestras **no da de alta camiones**. Se muestrea lo que ya llegó: el selector de arriba
lista los camiones del día y arranca en el primero pendiente. Tenía su propia alta —mixer,
escaneo de QR, foto y entrada manual— y era un duplicado de Recepción; Víctor la quitó el
31 jul 2026. Si un camión no aparece en Muestras, lo que falta es recibirlo en Recepción.

**La comprobación de conduce repetido vive ahora en `saveArrival()` de `conduce.html`.**
Estaba en la alta de Muestras y se fue con ella; sin ella, el mismo conduce entrado dos
veces duplica las yardas. La llave es **compañía + ticket**, nunca el ticket solo, y por eso
el registro guarda `company` desde que se crea: si se dejaba para `migrateDB()`, dos entradas
seguidas en la misma sesión no se reconocían como repetidas.
