# CHANGELOG — QCheck

Formato inspirado en *Keep a Changelog*. Las fechas son de 2026.
El proyecto no versiona por números todavía: se marca por hitos.

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
