# CHANGELOG — QCheck

Formato inspirado en *Keep a Changelog*. Las fechas son de 2026.
El proyecto no versiona por números todavía: se marca por hitos.

---

## [0.12] — 1 de agosto · «la primera prueba real»

La simulación sale y entra el trabajo de verdad.

### Cambiado
- **La simulación está apagada** (`DEMO_ACTIVA = false`). El sistema arranca con el
  histórico del proyecto y el día en blanco, listo para «Programar tiro». No basta con
  dejar de sembrarla: ya estaba dentro del iPad, de la PC y del teléfono, así que cada
  aparato **se limpia solo al abrir** y solo toca lo que lleva `source: "demo"`.
- **Las losas se declaran por TRAMO**, que es como llegan en obra: `L3-0.431@L3-0.252`.
  De ahí **no** se generan los códigos de en medio —el paso entre losas en este proyecto va
  de 4 a 8 m y cambia dentro del mismo tiro—, porque una losa inventada nunca cuadraría con
  la que trae el camión. Las losas se descubren de los camiones; el total sale con «≈» de
  la mediana del propio proyecto (7 m). Y el tramo permite algo que antes no se podía ver:
  **cantar el camión vaciado fuera del tramo del día**, en el tablero y en el reporte.
- **«Programar tiro» ofrece retirar los camiones que ya haya**, que es lo que hace falta
  tras una jornada de pruebas. Se **retiran**, no se borran: quedan marcados en el
  expediente y el retiro viaja a los demás aparatos.

### Arreglado
- **El formulario se cerraba al tocar fuera y se llevaba todo lo escrito.** En el iPad,
  llenando el plan con la mano sucia, un toque de más costaba empezar de cero. Ahora se
  sale por Cancelar o por la ✕.
- **Quitar un dato no viajaba.** Reprogramar el tiro borra el plan del día para empezar
  limpio, pero los demás aparatos se quedaban con el plan viejo: el iPad enseñando 19 losas
  de un tiro que ya no existía. Ahora lo que se quita se anota como quitado.

---

## [0.11] — 1 de agosto · «los aparatos se ven»

Q-02, la pieza que faltaba: hasta hoy cada navegador guardaba lo suyo y el iPad de la obra
no sabía nada de la PC de Rubén. Ahora el iPad entra los datos, la PC mira el Control
Center, el teléfono mira los indicadores y el Field Display canta en vivo, todos sobre lo
mismo.

### Añadido
- **Registro de cambios por campo** en vez de subir la base entera. Lo que viaja es
  *camión 407 · slump · 3.0 · 22:56 · iPad de Rubén*, así que dos aparatos pueden tocar el
  mismo camión a la vez sin pisarse — el caso real es el iPad escribiendo el Slump mientras
  Recepción sella «Termina vaciado». De regalo queda la línea de tiempo de cada conduce,
  que era Q-05 y es el expediente que pediría la ACT.
- **Cola para cuando no hay señal.** Lo entrado se guarda y sube al volver la cobertura. En
  obra eso va a pasar, así que no es un extra.
- **`assets/sync.js`** se cuelga de `saveDB()` y de ningún otro sitio: compara contra una
  copia de referencia y de la diferencia saca las líneas. **Ninguna de las once pantallas
  tuvo que cambiar una línea** — el aislamiento de la base detrás de `loadDB`/`saveDB`
  desde el primer día es lo que cobró hoy.
- **El mismo servidor, dos casas**: `sync-servidor.js` (Node sin dependencias, lo monta
  `serve.js`) y `sync-worker.js` (Cloudflare Workers + D1). Rutas y reglas idénticas, así
  que el cliente no distingue si habla con la laptop de la obra o con internet.
- Panel de **Sincronización** en Plan & Datos: dirección, llave del proyecto y nombre del
  aparato. Viven en el navegador, **no en el repositorio**, que es público.

### Arreglado en el camino
- El primer arranque subía **7.878 líneas**: los 397 ensayos del Excel enteros. La copia de
  referencia se estrenaba con `seed.js` crudo, y es `migrateDB()` la que le pone `company`,
  `source` e `id`. Se partió en `migrarBase(base)` para poder migrar una copia — una
  migración, dos usos.
- El plan del día **de la simulación** también viajaba: la PC recibía 260 yardas y trece
  losas sin un solo camión detrás. Ahora lleva `source: "demo"` y se queda en casa. De la
  simulación solo viaja su apagado.

### Verificado con dos almacenamientos separados
`localhost` y `127.0.0.1` son orígenes distintos para el navegador, o sea dos aparatos de
verdad. Camión recibido en uno → **EN PRUEBAS** en el otro. Muestras entradas en uno →
**ACEPTADO** con Slump 3.25 y Unit Weight 150.4 en el otro. Servidor apagado a media faena →
«sin señal», dos cambios encolados, y al volver subieron solos.

### Añadido después del despliegue
- **`conectar.html`** — un enlace por aparato y queda conectado. Trae la dirección y la
  llave en el URL y **las borra del URL en el acto**. La alternativa era teclear una llave
  de 32 caracteres en un iPad, de pie, en la obra.
- **La franja de arriba deja de mentir.** Decía «En línea» mirando el WiFi, con el servidor
  caído y los cambios amontonándose sin subir. Ahora dice «Solo este aparato», «Sin señal ·
  N sin subir» o «Llave rechazada». En obra un «En línea» falso es peor que no decir nada.

### Arreglado
- **`_ma5` viajaba al servidor.** La Moving Average se guarda encima del ensayo como caché,
  y abrir las Control Charts mandaba **99 líneas** al registro — cifras calculadas metidas
  en el expediente como si alguien las hubiera medido. Ahora nada que empiece por `_` sale
  del aparato, ni de ida ni de vuelta.

### Desplegado
**`https://qcheck-api.qcheck.workers.dev`** — Cloudflare Workers + D1, cuenta de Víctor.
Probado además entre el **sitio publicado** (`victormdiazjr-alt.github.io`) y un segundo
aparato: camión recibido en uno → **EN PRUEBAS** en el otro; muestras entradas en uno →
**ACEPTADO** con Slump 2.75 y Unit Weight 149.8 en el otro. La API rechaza con **401** a
quien no traiga la llave. El registro quedó en cero: los datos de prueba se borraron antes
de que nadie lo use de verdad.

---

## [0.10] — 31 de julio · «el ciclo cierra»

Dos fallos encontrados probando el ciclo completo la víspera del primer tiro en obra.
Ninguno de los dos daba error: los dos se veían como que la aplicación no hacía nada.

### Arreglado
- **Muestras: «Aprobar» no hacía nada.** La pantalla arrancaba en el último camión de la
  lista aunque ya estuviera muestreado —al abrirla sobre la simulación, los nueve camiones
  tienen resultados—, así que enviar guardaba encima de ese mismo camión y todo se repintaba
  igual. Ahora solo engancha sola un camión que **esté esperando resultados**; al enviar
  suelta los cuatro campos y vuelve a la fila, y si no hay nadie esperando lo dice.
- **La simulación borraba el trabajo del día.** `reiniciarDemo()` barría *todos* los ensayos
  de hoy y corría en **cada acceso**. Como `sessionStorage` es de cada pestaña y de cada
  aparato, abrir el Field Display en la tableta a media mañana —o volver a entrar tras una
  sesión caducada— borraba los camiones ya recibidos. Ahora se planta en cuanto hay un
  ensayo que no sea de la simulación; solo el botón de Plan & Datos puede forzarlo, y avisa.

### Verificado en el navegador, de punta a punta
Recepción → Muestras → Field Display → Control Center, con dos camiones nuevos: uno dentro
de límites (**ACEPTADO**, yardas 90 → 100 al cerrar la descarga) y uno fuera (**RECHAZADO**,
Slump 5.5", Unit Weight 145 pcf). El Field Display cantó **EN PRUEBAS** al recibir y el
veredicto al enviar, sin tocarlo. Un acceso nuevo en otra pestaña ya no borra nada.

---

## [0.9] — 31 de julio · «el mixer de Víctor»

### Cambiado
- **El camión hormigonera es el vector de Víctor**, `assets/mixer.svg`. Sustituye al PNG
  y con él a mis intentos de dibujarlo a mano, que no llegaban. El original venía para
  papel —trazo casi negro sobre rellenos blancos, invisible sobre el tablero oscuro—, así
  que se le reescribió la paleta: el trazo es `currentColor` y los rellenos se apagan.
- Con eso **vuelve a tomar el color del estado del tiro** en el aro del Control Center
  —ámbar esperando, verde vaciando, rojo detenido—, que era justo lo que se perdía con una
  imagen a color. Entra como máscara CSS, así que el trazado no se mete en el HTML.
- Se le recortó el lienzo a la caja del dibujo (ocupaba 697×394 dentro de 750×750 y
  flotaba en el centro) y en la guía se dibuja con su proporción real: el PNG iba estirado
  a 118×49 y no se notó hasta tener el vector.
- En la guía **no lleva volteo**: el vector ya viene con la cabina a la izquierda, o sea ya
  entra en reversa. El PNG anterior sí había que espejarlo.

---

## [0.8] — 31 de julio · «una puerta, tres tableros»

### Cambiado
- **Concretero, contratista y Autoridad dejan de ser tres botones sueltos** en el Control
  Center y en el portal del teléfono. Entran por una sola puerta —**Dashboards**, con una
  aguja de indicador— que pregunta cuál y lleva, con una línea que dice qué se ve dentro.
  Eran la misma clase de cosa —mirar cómo va el tiro desde fuera— y llenaban las dos
  pantallas de puertas que la mayoría no abre.
- La lista y la elección viven en **`core.js`** y los estilos en **`qc.css`**: las usan dos
  pantallas y en este proyecto lo que usan dos pantallas no se duplica.

### Arreglado
- El icono del gauge salía **relleno de negro**: le faltaban los atributos de trazo que
  llevan los demás iconos del proyecto.

---

## [0.7] — 31 de julio · «enseñar y trabajar»

### Añadido
- **Cada acceso arranca un tiro nuevo**: yarda 90 de un plan de 260, nueve camiones y el
  último terminado **hace 3 minutos**. Quien entra se encuentra siempre el mismo punto de
  partida y no lo que dejó a medias la visita anterior. El acceso deja la marca
  `qc-nuevo-tiro`; la recoge `sembrarDia()` en la primera pantalla que carga el motor,
  porque el acceso no puede sembrar (no carga los 397 ensayos y meterlos en una pantalla
  de dos campos serían 150 KB de nada).
- **«Programar tiro» en el Control Center**, el primer botón del menú. Es la frontera
  entre enseñar y trabajar: borra el vaciado simulado de hoy, **apaga la simulación para
  siempre** —ni el acceso la vuelve a encender— y abre el plan del día para declarar hora
  de comienzo, yardas y losas. Sin plan declarado el tablero no enseña avance y no se lo
  inventa, así que programar el tiro es el primer paso del día de verdad.
- **La guía de usuario ilustrada** (`docs/guia-usuario.html`): el circuito de los aparatos,
  los core features y la arquitectura, en el lenguaje visual oscuro de QCheck. Es para
  pantalla; la de papel (`guia-qcheck.html`) sigue siendo la que se imprime y se lleva en
  el bolsillo. Lleva un botón **Run** que detecta el aparato y lleva a cada quien a su
  portal, explicando antes cómo añadir QCheck a la pantalla de inicio.

### Cambiado
- El plan del día (`formDayMeta`) se mudó de `qc.js` a **`core.js`**: ahora lo abren dos
  pantallas —Results y el Control Center— y no se duplica.
- **El histórico no se toca nunca.** La simulación solo escribe sobre HOY: los 397 ensayos
  del Excel y todos los días anteriores siguen enteros y analizables en Results y en las
  Control Charts.

---

## [0.6] — 31 de julio · «lista para el field»

Todo esto salió de la primera prueba de campo de Víctor con el iPhone en la mano.

### Añadido
- **`manifest.webmanifest`** y el bloque de etiquetas de aplicación **en las once
  pantallas** (faltaba en seis). Sin ellos, el icono guardado en la pantalla de inicio
  abría como **marcador de Safari**, con una franja arriba enseñando el dominio en vez de
  la aplicación limpia. Detalle y trampas en `AGENTS.md` §12 — entre ellas que iOS congela
  estos datos al crear el icono: **hay que borrarlo y volver a añadirlo**.
- **Comprobación de conduce repetido en Recepción** (`saveArrival()`). La llave es
  compañía + ticket, nunca el ticket solo, y el registro guarda ya `company` desde que se
  crea: dejarlo para `migrateDB()` hacía que dos entradas seguidas del mismo ticket en la
  misma sesión no se reconocieran.

### Cambiado
- **Muestras ya no da de alta camiones.** Tenía su propia entrada —mixer, escaneo de QR,
  foto y entrada manual— duplicando Recepción. Se muestrea lo que ya llegó: los camiones
  entran por Recepción y solo por ahí. Son ~18.000 caracteres menos de pantalla.
- **Rubén ya no ve el enlace al Control Center** en el portal del teléfono. No es cosa del
  papel —Rubén lleva el control de calidad— sino de la cuenta: va por `qcVeTablero()` y la
  marca `tablero: true` en la lista de usuarios, no comprobando el nombre.
- **Las pantallas dejan de dar instrucciones.** Fuera las credenciales de demostración del
  acceso y el consejo de «añadir a la pantalla de inicio» del portal. Todo eso vive en la
  guía de usuario.

### Arreglado
- El comentario del portal decía «solo la ve el administrador» y el código se lo enseñaba
  a cualquiera con papel de QC. Ahora el código y el comentario dicen lo mismo.

---

## [0.5] — 31 de julio · «el reporte del vaciado» (Q-03)

### Añadido
- **El reporte del día** en `reporte.html`. Hasta ahora solo existía el acumulado del
  proyecto; el que se entrega al cerrar el tiro es este. Se abre con
  `reporte.html?dia=2026-07-31` y son seis hojas: cómo cerró el vaciado (plan contra lo
  real, ritmo y ciclos), las losas con las observaciones del sistema, la bitácora de
  camiones, las Control Charts del día en pares —**Slump y Unit Weight primero**, que es
  lo que Rubén mira— e incidencias con la certificación y las firmas.
- Todo sale del motor que ya pinta el Control Center (`dayProgress`, `dayStats`,
  `losasDelDia`, `trendAlerts`): la hoja firmada y el tablero **no pueden discrepar**.
- Un día **sin plan declarado** no se compara con nada y la hoja lo dice; un día **sin
  camiones** tampoco se rellena con ceros. Emitida con el tiro todavía abierto, lo avisa
  arriba y lo repite en la certificación.
- Acceso desde **Results → Vaciado Diario → 📄 Reporte del vaciado**, que abre el día
  que esté seleccionado.

### Arreglado
- **El reporte acumulado no cabía en el papel** (Q-13, de antes de Q-03). Sus hojas de
  tabla matriz medían ~1.200 px de contenido contra los 892 que caben en una carta, y la
  de Moving Average llegaba a 2.584: cada una imprimía en dos o tres páginas y el
  «Página N de M» del pie dejaba de ser verdad. Ahora los dos reportes reparten las filas
  con la misma función, `repartir()`, que además deja las hojas parejas —19 camiones
  salen 10 y 9, no 18 y 1—. El acumulado del proyecto pasa de 19 hojas que mentían a
  **30 hojas que son 30 páginas**, con la numeración de sets corrida a lo largo del
  reporte. Medido en cuatro escenarios: proyecto entero, filtrado por lote, un día en
  curso y un día cerrado. Ninguna hoja pasa de 883 px.
- **El botón «⬇ CSV» estaba roto en las cuatro pantallas donde aparece.** `exportCSV()`
  llamaba a `csvCell()`, que se borró en la limpieza del 31 de julio: reventaba con
  «csvCell is not defined» sin decir nada en la interfaz.
- **Ciclos de camión imposibles.** Un ciclo Batch → fin de descarga no puede durar más
  que el día entero. El Excel histórico trae horas mal transcritas —la #331 del 20 de
  junio anota el batch a las 9:39 y la descarga a las 7:33, o sea antes— y
  `minutesBetween`, que cruza la medianoche a propósito, las convertía en ciclos de
  21 h: la pantalla de la concretera enseñaba **«máximo 1314 min»**. El registro
  histórico no se toca; el ciclo imposible se queda fuera del promedio y se cuenta
  aparte para poder decirlo.
- El comando del PNG de la guía en su propio encabezado se había quedado corto
  (`--window-size=940,3200`) y Chrome cortaba la guía por abajo sin avisar.

---

## [0.4] — 31 de julio · «portable»

### Añadido
- **La guía lleva la dirección de cada pantalla** al pie de su tarjeta, partida por el
  slash para que nadie la copie mal, y una sección propia de **«Añadir a la pantalla de
  inicio»** con los cuatro pasos — es lo que quita las barras de Safari y da la pantalla
  completa en iPad y iPhone. Se avisa de que cada icono guarda su propia sesión y volverá
  a pedir la clave la primera vez.
- **`verificar.js`** — la prueba que el proyecto no tenía: parseo de todo el
  JavaScript, referencias rotas, sellos de versión al día, clases de rejilla
  definidas, código muerto, pantallas protegidas y términos técnicos.
- **`movil.html`** — portal para iPhone: cuatro puertas, o cinco si el usuario lleva
  el control de calidad. Se entra aquí desde el teléfono en vez de al Control Center.
- **`assets/usuarios.js`** — tres cuentas (`ruben`, `admin`, `invitado`) y dos papeles
  en una sola lista. Antes el papel se comprobaba repartido por cinco archivos.
- **Guía de uso para Rubén** (`docs/guia-qcheck.html`) con el circuito del tiro en un
  diagrama; de ahí salen el PNG y el PDF.
- **Etiquetas de aplicación e icono** para guardar en la pantalla de inicio de iOS —
  la única forma real de pantalla completa en iPhone.
- Marca de cada parte (contratista, concretera, Autoridad) donde aparece su nombre,
  con monograma de reserva cuando no hay archivo de logo.
- Documentación de traspaso: `ARCHITECTURE.md`, `PROJECT_HANDOFF.md`,
  `CURRENT_STATUS.md`, `TODO.md`, `DECISIONS.md`, `CHANGELOG.md`, `.env.example`.

### Cambiado
- El punto vivo de las Control Charts deja de crecer y encogerse: ahora respira un
  **resplandor azul** detrás, con desenfoque real.
- El botón de enviar de Muestras dice lo que va a pasar: **Aprobar** o **Rechazar**,
  y **no existe** mientras falte Slump o Unit Weight.
- El icono de nuevo camión pasa de ilustración con degradados a mixer de trazo,
  coherente con el resto de la iconografía.
- El botón de la esquina lleva a la casa —que depende de quién y desde dónde— y
  **sale de pantalla completa antes de navegar**.

### Eliminado
- **`portal.html`** — menú heredado, duplicado del Control Center y confuso ahora que
  «portal» es el del teléfono.
- `csvCell()`, `qcNombre()` y la clase `.cols-4`: código muerto.
- El candado con contraseña del botón de cerrar, y con él la clave escrita en el
  navegador y su diálogo.
- `docs/ARQUITECTURA.md`, `docs/ROADMAP.md` y `docs/COLABORACION.md`, consolidados en
  los documentos de la raíz.

### Corregido
- **`cols-4` no existía en la hoja de estilos:** la rejilla del tablero caía a una
  columna en silencio.
- Los estilos de tira del PNG de la guía se aplicaban también al papel, y el PDF
  perdía la portada.

---

## [0.3] — 31 de julio · «el tiro en marcha»

### Añadido
- **Simulación**: al entrar, si hoy está vacío, se siembra un vaciado ya empezado por
  la yarda 120 esperando el próximo camión. Horas relativas a ahora. Se reinicia o se
  apaga desde Plan & Datos.
- **Estado del tiro** deducido de los camiones: Vaciando · Camión esperando ·
  Esperando camión · Detenido · Completado · Sin comenzar.
- **Ritmo y hora estimada de fin**, calculados con las yardas colocadas contra el
  tiempo desde el primer camión.
- **Las losas del tiro** con el avance de cada una, declaradas en el plan del día.

### Corregido
- **Las yardas de un camión que llegó y no había descargado se contaban como
  colocadas.** Ahora van aparte, en `enCurso`, y solo aplica al día en curso.
- **Guardar «Datos del vaciado» desde Results borraba el plan del día** que había
  puesto el contratista.
- **El cálculo de minutos no cruzaba la medianoche**, y eso apagaba el ritmo y el
  aviso de «Detenido» justo cuando más falta hacen.

---

## [0.2] — 30–31 de julio · «identidad y móvil»

### Añadido
- **Logo nuevo de QCheck** en las once pantallas, con los recortes rehechos como
  máscaras SVG: el vector original pintaba blanco encima y solo servía sobre papel.
- **Barra de estado** de borde a borde, fija arriba, igual en todas las pantallas:
  avance del tiro en segmentos y estado de conexión.
- **El tiempo del sitio** desde el NWS de San Juan, con Open-Meteo para el nowcast de
  15 minutos y como respaldo. Iconos SVG animados propios.
- **`sello.js`** — sello de versión sacado del contenido de cada asset, contra los
  diez minutos de caché de GitHub Pages.
- Modo kiosco y pantalla completa al primer toque en Field Display y Muestras.

### Cambiado
- **El color entra por el resplandor, no por el relleno**, en toda la interfaz.
- Las Control Charts pasan a estética de gráfica de mercado: umbrales punteados,
  trazo progresivo, valor de cierre.
- Todo a **español de Puerto Rico** — la pantalla de la Autoridad estaba entera en
  inglés. Los términos que nacieron en inglés se quedan: Slump, Unit Weight,
  Moving Average, Control Charts.
- La ubicación del tiro se corrige a **San Juan, PR-52 salida de la PR-199**.
- La concretera se llama **Concre-Tech**, no «Concretec».

### Corregido
- **Desbordamiento horizontal de 752 px en iPhone**, porque la barra de estado le
  reservaba 400 px al encabezado.
- **Field Display y Muestras estaban rotos en vertical**: todo su tamaño salía de la
  altura, que de pie crece mientras el ancho se encoge.
- `portal.html` llevaba su propia copia del código del tema; al cargar el motor, las
  redeclaraciones rompían el bloque entero.

---

## [0.1] — 29–30 de julio · «el prototipo»

### Añadido
- Ingeniería inversa del Excel de Rubén Segarra: **397 ensayos reales** del proyecto y
  las zonas SPC. La Moving Average de 6 sets se validó contra su hoja y coincide.
- Las pantallas de rol: Control Center, Results, Field Display, Muestras, Recepción,
  Contratista, Concretera, Autoridad y el reporte imprimible.
- Capa de inteligencia (`trendAlerts`): mezcla secándose, racha en zona de acción,
  humedad de agregado vencida.
- **Contrato del conduce v4** (`shared/conduce-contract.js`), copia idéntica en los
  dos repositorios: llave compañía + conduce, formato del QR, publicación de límites.
- Los dos repositorios en GitHub con `AGENTS.md` y `TAREAS.md`, y el protocolo de
  reclamo de tareas que impide que dos agentes hagan el mismo trabajo.
