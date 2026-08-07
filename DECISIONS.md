# DECISIONS — QCheck

Por qué el proyecto está hecho así. Cada decisión con su motivo y su precio, para que
quien venga después pueda cambiarla a sabiendas en vez de tropezar con ella.

---

## 1. Sin compilación, sin dependencias

**Decidido:** HTML, CSS y JavaScript planos. Ni bundler, ni framework, ni npm, ni CDN.

**Por qué:** el cliente es una cuadrilla en carretera. Cualquiera abre una dirección y
trabaja. Además, un proyecto que se entiende leyendo un archivo sobrevive a que lo
retomen manos distintas — que es exactamente lo que pasa aquí.

**Precio:** hay que ser disciplinado a mano. No hay compilador que avise, así que
existe `verificar.js` para ocupar su lugar.

**Cuándo reconsiderarlo:** si el equipo crece a varios desarrolladores fijos.

---

## 2. `localStorage` como capa de datos, de momento

**Decidido:** todo vive en `localStorage["qc-pr52-db-v1"]`, aislado tras `loadDB()` y
`saveDB()`.

**Por qué:** permitió construir y validar el producto entero —incluidas las cartas de
control contra el Excel real de Rubén— sin esperar a un servidor.

**Precio, y es el grande:** cada aparato guarda lo suyo y no se sincronizan. Es la
limitación de fondo, y por eso Q-02 encabeza la lista.

**Cómo salir:** reescribir solo esas dos funciones. El aislamiento fue a propósito.

---

## 3. No se inventan datos. Nunca.

**Decidido:** si un dato no existe, se enseña que no existe. Sin plan del día no hay
barra de avance, hay un hueco. Sin red, el clima lo dice. Sin humedad registrada,
se avisa.

**Por qué:** esto es un instrumento de medición para un expediente que puede acabar
ante la ACT o la FHWA. Un número inventado que parece real es peor que un hueco.

**Precio:** la interfaz se ve incompleta hasta que alguien declara el plan del día.
Es deliberado: empuja a declararlo.

---

## 4. Umbrales derivados del propio dato, no constantes inventadas

**Decidido:** cuando hace falta un umbral y el plan no lo da, se saca del propio día.
«Detenido» compara el tiempo sin novedad con **el doble de la mediana entre camiones
de ese día**.

**Por qué:** un día de camiones cada 20 minutos y otro de cada hora no se pueden medir
con la misma constante. Y una constante inventada por el programador es una mentira
disfrazada de ingeniería.

---

## 5. Nada de interruptores

**Decidido:** el estado del tiro, el ritmo, la hora estimada de fin y los avisos se
deducen de los camiones. No hay ningún botón de «marcar como detenido».

**Por qué:** un tablero que depende de que alguien se acuerde de pulsar algo se muere
en la primera semana. El dato ya está ahí.

---

## 6. El color entra por el resplandor, no por el relleno

**Decidido:** ningún botón se pinta de color. Superficie de panel, borde teñido y
sombra de color.

**Por qué:** con botones rellenos, el verde y el rojo dejan de significar
«en cumplimiento» y «rechazado» y pasan a ser decoración. En una herramienta donde
el color **es** la información, eso es caro.

---

## 7. Los datos históricos no se tocan

**Decidido:** los 397 ensayos de `seed.js` y los comentarios que el inspector escribió
en el Excel («REJECTED - UW Out of Tolerance») se quedan **exactamente** como están,
aunque el resto de la interfaz esté en español.

**Por qué:** son el expediente. Reescribirlos sería alterar el registro.

---

## 8. Español de Puerto Rico, salvo lo que nació en inglés

**Decidido:** interfaz en español de la isla. Los términos que en la obra se dicen en
inglés se quedan en inglés y con mayúscula inicial: **Slump, Unit Weight, Moving
Average, Control Charts, Batch, Ticket, Set, PSI, CY**.

**Por qué:** es como se habla en la caseta, y cuadra con el Excel de Rubén. Y no basta
con que la palabra esté en el diccionario: «calima» es correcto en España y aquí nadie
la entiende — es **polvo del Sahara**. Igual «aguaceros», no «chubascos».

---

## 9. El NWS de San Juan como fuente del tiempo

**Decidido:** primario el Servicio Nacional de Meteorología, oficina de San Juan.
Open-Meteo para el nowcast de 15 minutos y como respaldo.

**Por qué:** es la fuente oficial para Puerto Rico y la que citaría la ACT o la FHWA —
un meteorólogo ajusta esa rejilla a mano, no es salida cruda de modelo. Comparándolas
en vivo no coincidían: Open-Meteo decía llovizna y el NWS decía calima.

**Precio:** el NWS viene en inglés, así que su texto **no se muestra tal cual**; se
traduce a una condición propia.

---

## 10. La barra de estado es una franja fija, no una píldora

**Decidido:** de borde a borde, arriba, idéntica en todas las pantallas. El resto del
GUI empieza debajo, desplazado por `--qcs-h`.

**Por qué:** como píldora en la esquina le reservaba 400 px al encabezado, y eso
**desbordaba la página 752 px en un iPhone**. Una franja no le quita ancho a nadie.

---

## 11. Sello de versión en los assets

**Decidido:** `sello.js` pone a cada `<script>` y `<link>` un sello sacado del
contenido del archivo.

**Por qué:** GitHub Pages cachea los `.js` diez minutos. Sin sello se despliega un
arreglo y el navegador sigue enseñando el fallo anterior. **Pasó en una prueba real.**

**Lo que lo hizo posible:** Víctor levantó el requisito de funcionar sin internet.
Con `file://`, una interrogación en la dirección impide cargar el archivo.

---

## 12. Los logos de terceros no se bajan de sus webs

**Decidido:** el mecanismo está hecho (`marcaHTML()`), con monograma de reserva
(DVG, CT, ACT). **Los archivos los aporta Víctor.**

**Por qué:** son marcas registradas. Meterlas descargadas en un repositorio público de
una herramienta que se va a vender no es la base correcta, y esos archivos están en
los documentos del contrato.

---

## 13. La simulación arranca sola

**Decidido:** al entrar, si hoy no tiene ni un camión, se siembra un tiro en marcha
por la yarda 90, con el último camión terminado hace 3 minutos.

**Por qué:** QCheck se enseña antes de usarse y un tablero vacío no demuestra nada.
Las horas son **relativas a ahora**, así que a cualquier hora que se abra el estado es
coherente.

**Salvaguardas:** solo siembra si el día está vacío, lo que crea lleva
`source: "demo"`, y se reinicia o se apaga desde Plan & Datos.

---

## 14. Las dos pantallas de producción no se unifican

**Decidido:** existe una `produccion.html` en QCheck y otra en Concre-Ticket. Son
distintas a propósito.

**Por qué:** la de QCheck enseña lo que Segarra midió y aplica **surta quien surta**;
la de Concre-Ticket enseña lo interno de la planta y solo existe si la concretera es
cliente. La mayoría de las concreteras no tendrán Concre-Ticket. Además, la de QCheck
es la puerta comercial hacia la otra herramienta.

---

## 15. El botón de cerrar no cierra la pestaña

**Decidido:** lleva a la casa, que depende de quién y desde dónde: en teléfono el
portal, para el invitado siempre el portal, en PC con papel de QC el Control Center.
Y **sale de pantalla completa antes de navegar**.

**Por qué:** sin salir del fullscreen, volver desde el Field Display dejaba el Control
Center ocupando la pantalla entera, sin barra del navegador ni forma de salir.

---

## 16. El enlace de Rubén no se toca

**Decidido:** este enlace es **permanente** y ningún cambio lo puede romper:

```
https://victormdiazjr-alt.github.io/qcheck/conectar.html?api=…&llave=…
```

Víctor se lo dio a Rubén el 1 ago 2026 y quedó en que **ese sigue siendo el enlace**
pase lo que pase con el código, para no andar repartiendo direcciones nuevas cada vez.

**Qué queda congelado, y no es negociable:**

- `conectar.html` **existe siempre** y sigue aceptando `?api=` y `?llave=`.
- Con el aparato ya conectado a lo mismo, **pasa de largo a `index.html`** sin
  preguntar. Si algún día vuelve a pedir confirmación, el enlace deja de servir para
  el uso diario y Rubén se encuentra una pantalla que no entiende.
- La **llave del proyecto no se rota** sin volver a repartir el enlace a mano, aparato
  por aparato. Rotarla y no avisar deja a todo el mundo fuera en mitad de un tiro.
- El sitio sigue colgando de `victormdiazjr-alt.github.io/qcheck/`.

**Por qué:** en obra, un enlace que cambia es un enlace que nadie encuentra. El técnico
lo tiene guardado en el teléfono y lo abre con las manos sucias; no va a buscar en el
correo cuál era el bueno. La estabilidad del enlace vale más que cualquier mejora que
obligue a cambiarlo.

**Precio, y hay que verlo venir:** **mudarse al dominio rompe el enlace.** El día que
QCheck pase a `qcheck.dcreationspr.com` hay que repartir uno nuevo. Se hace **una vez**,
avisando, y GitHub Pages se queda sirviendo el viejo con una redirección mientras tanto
— no se apaga el mismo día.

**Cuándo se cambia, acordado con Víctor el 1 ago 2026:** **al terminar de construir**, cuando
QCheck deje las pruebas y entre en uso oficial. Ese es el momento y no antes: mientras se
esté cambiando código a diario, un enlace nuevo es una confusión más encima de una prueba
que ya tiene bastante. Va como Q-29 en `TAREAS.md`.

**Cuándo deja de hacer falta la llave en el enlace:** con la autenticación real (Q-07).
Entonces cada quien entra con su cuenta y el aparato se conecta solo.

---

## 17. La firma del expediente la pone el servidor, no el aparato

**Decidido (5 ago 2026, Q-07):** el `usr` de cada línea del registro de cambios lo estampa
el servidor desde la sesión. Lo que venga en el cuerpo del POST se ignora.

**Por qué:** hasta aquí el autor era autodeclarado —`usr` viajaba en el cuerpo y nadie lo
comprobaba—, así que cualquiera con el enlace de conexión podía escribir una línea firmada
«ruben». El valor de este registro es que **no se puede reescribir por detrás** (§14 de
AGENTS); si además se puede firmar con el nombre de otro, ese valor no existe. Y esto acaba
delante de la ACT o la FHWA.

Lo que **no** era el problema, aunque lo pareciera: que las claves fueran `1234`. Eso deja
entrar a mirar. Lo otro deja escribir en el expediente con el nombre de otro.

**Precio, y hay tres:**

1. **La llave del proyecto deja de ser el candado y pasa a ser la matrícula del aparato.**
   Tenía que ser así para no tocar §16: el enlace de Rubén sigue funcionando igual.
2. **Un secreto más que custodiar** (`QC_ADMIN`), aparte de la llave. No hay forma de
   evitarlo: la llave la tiene Rubén dentro de su enlace, así que no puede ser también la
   que da de alta cuentas.
3. **La mudanza tiene un orden y no se puede saltar.** Crear cuentas → repartir claves y
   que cada aparato entre una vez → `exigir-sesion on`. Encenderlo antes deja a la cuadrilla
   fuera en mitad de un vaciado. Por eso la bandera existe y por eso `cuentas.js` pregunta
   antes de encenderla.

**Lo que sigue sin resolver, y hay que decirlo:** un aparato sin señal entra con la lista
local de `usuarios.js` para poder seguir trabajando. Eso es deliberado —dejar al técnico
fuera de su herramienta en obra es peor—, pero significa que **quien tenga el aparato puede
ver las pantallas**. Lo que no puede es escribir en el expediente compartido: sin pase de
sesión, con la bandera encendida, el servidor le rechaza los cambios. La confidencialidad
de lo que ya está en el aparato sigue dependiendo de quién tenga el aparato.

**Cuándo reconsiderarlo:** si hiciera falta que un aparato perdido no enseñe nada, esto se
resuelve cifrando la base local contra la clave del usuario, no con más candados en el
navegador. Es otro trabajo y bastante más grande.

---

## 18. Un dato que teclea una persona nunca entra al HTML sin `esc()`

**Salió de la auditoría del 6 ago 2026**, buscando fallos a propósito en vez de esperar
a que aparecieran.

**La raíz.** Estas pantallas arman HTML con plantillas de texto, y por ellas pasan campos
que teclea alguien: número de camión, de ticket, identificación de losa, comentarios.
Escribir `${t.truck}` en vez de `${esc(t.truck)}` **no da ningún error**. Funciona
perfectamente durante meses, hasta el día en que un valor lleva un `<`.

**Lo que pasó de verdad.** Un camión llamado `A<b>&"X` metió **doce elementos dentro de
los SVG de Producción** y fusionó dos etiquetas de punto en una sola. La gráfica se
seguía dibujando: no habría saltado ninguna alarma, solo habría enseñado mal. Se
encontró poniendo ese valor a mano y mirando el resultado, no leyendo el código —
leyendo el código yo había concluido antes lo contrario.

**Y no hace falta un atacante.** Es la letra que se cuela al teclear con guantes, un
pegado con caracteres raros, o lo que el lector de conduce (Q-01) proponga de una foto
borrosa. En una herramienta de un solo equipo el riesgo no es que alguien entre: es que
el tablero mienta y nadie se entere.

**El arreglo.** Cuatro sitios corregidos (tres `<title>` de SVG en `produccion.html` y el
de `svgChart` en `core.js`, más un rótulo de barra y un ticket en `display.html`).

**Para que no vuelva:** `verificar.js` lo comprueba solo. Recorre las plantillas que
producen HTML y canta cualquier `${…}` que mencione un campo de persona sin pasar por
`esc()`, `fmt()` o `num()`, con archivo y línea. Se probó metiendo el fallo a mano: lo
caza. Si añades un campo que escribe alguien, o le pones `esc()` o lo añades a la lista.

## 19. Los dos servidores contestan lo mismo, y se comprueba corriéndolos

`sync-servidor.js` (Node, JSONL) y `sync-worker.js` (Cloudflare, D1) tienen que
comportarse igual. Estaba dicho en AGENTS desde el principio; lo que faltaba era una
forma de saberlo.

**La raíz.** Comparar los dos archivos leyéndolos no sirve. En la auditoría del 6 ago
2026 el `grep` decía que el servidor local no validaba nada de lo que el Worker sí
validaba — y era **falso**: levantar los dos y mandarles las mismas peticiones demostró
que los dos contestaban `400 usuario`, `400 clave` y `400 rol` igual. La estructura del
código diverge sin que diverja el comportamiento, y al revés.

**Cómo se comprueba.** Se levantan los dos —`node serve.js 8461` y `npx wrangler dev
--local --port 8462`, con el esquema aplicado a la D1 local— y se les manda la misma
batería comparando estado, tipo de respuesta y código de error. 33 casos, incluidos
JSON roto, métodos equivocados, parámetros con basura y rutas inventadas. Salió **una
sola divergencia y es de diseño**: fuera de `/api/` el servidor local sirve archivos y
el Worker no.

**Lo que sí encontró:** el Worker no tenía red de seguridad arriba del todo. Un error
inesperado salía como la página de error de Cloudflare, que es HTML; el aparato hace
`r.json()` con eso y revienta con un fallo de sintaxis que no dice nada de lo que pasó.
El servidor local ya lo tenía. Corregido: el Worker contesta JSON pase lo que pase.

## 20. Lo que se enciende algún día se prueba antes de ese día

`exigir_sesion` lleva desde Q-07 esperando a que Víctor reparta las claves. Nunca se
había probado de punta a punta: se sabía que existía, no que funcionara.

En la auditoría se probó entero contra un Worker local — 14 comprobaciones: que apagado
la llave sola escribe, que encendido ya no, que leer sin pase tampoco, que se puede
entrar, que la firma la pone el servidor y no el cuerpo del POST, que una cuenta de solo
mirar entra pero **no escribe** (403), que un pase inventado se rechaza, que tras salir
el pase deja de valer, y que se puede volver a apagar. Las 14 en verde.

**La regla:** una bandera que cambia el comportamiento del sistema no se deja sin probar
esperando al día que se encienda. Ese día siempre es un día de obra.

---

## 21. Los límites tienen fecha. Lo ya juzgado no se vuelve a juzgar

**Lo pidió Víctor el 7 ago 2026** al ver el riesgo antes que nadie.

**La raíz.** Los límites eran uno solo: `db.plan`. Las cinco funciones de zona lo leían
directo, así que cambiar el slump de acción en Settings **volvía a juzgar los 397 ensayos
desde noviembre de 2025**. Un vaciado firmado como conforme podía aparecer rechazado meses
después, sin que nadie tocara un dato, y el reporte que ya vio la Autoridad decía otra cosa
que el mismo reporte reimpreso.

En una herramienta cualquiera eso es un detalle de interfaz. En un expediente de control de
calidad **es que el récord cambia solo**, y es exactamente lo que un expediente existe para
impedir.

**El arreglo.** `db.planes` guarda las versiones en orden, cada una con el día desde el que
manda. `planDe(fecha)` devuelve la que regía ese día, y un ensayo se juzga siempre con la
suya. `db.plan` sigue siendo el vigente, así que todo lo que hablaba del presente sigue
igual. Las cartas y los reportes piden los límites del día que enseñan, no los de hoy.

**Al actualizar no cambia nada.** La primera versión arranca en la fecha del ensayo más
antiguo, de forma que toda la historia se sigue juzgando con lo que se juzgaba ayer.
Comprobado: cero veredictos alterados sobre los 397.

**Cuando un vaciado se cierra, se le congela una copia de los límites encima**
(`dayMeta[dia].plan`), y esa copia manda sobre cualquier versión posterior. Es la garantía
dura: lo firmado no se mueve ni aunque alguien enrede con las fechas.

**Y se dice.** Si un día se juzgó con límites distintos de los vigentes, el reporte lo
imprime bajo la certificación. Quien compare dos documentos del proyecto y vea umbrales
distintos tiene que encontrar la explicación ahí, no suponer que uno está mal.

## 22. El que firma el récord es el que puede tocarlo

Un vaciado cerrado deja de aceptar cambios. Reabrirlo o corregir un dato de un día cerrado
solo lo puede hacer **el ingeniero de récord** — quien responde por ese expediente ante la
Autoridad.

**Ni siquiera el administrador.** El administrador monta la herramienta; no certifica el
hormigón. Es la misma lógica que hace que Rubén no vea «Plan & Datos» (§3 de AGENTS y la
decisión del 1 ago): cada quien manda en lo suyo, y aquí lo suyo es la firma.

Va como capacidad `firma` en la cuenta y **nunca** como `usuario === "ruben"`: el día que
entre otro ingeniero de récord se le pone la capacidad y ya. Está en los dos servidores y
en la lista local, como el resto.

**Se avisa con el motivo**, no con un botón que no responde: *«El vaciado del 18 jul está
cerrado por Rubén Segarra. Solo el ingeniero de récord puede corregirlo.»*

---

## 23. La simulación no puede escribir sobre un día de verdad, y lo que dejó se ve

**Lo reportó Víctor el 7 ago 2026**: su Control Center decía 157/150 yardas y el de Rubén
197/150. El mismo vaciado, dos cifras.

**La raíz, en tres piezas que solas no hacen daño y juntas sí:**

1. **La simulación sembraba mirando solo si había camiones.** Un día puede existir con su
   PLAN puesto y sin un solo camión: es la mañana de un vaciado, antes del primer viaje.
   Sembrar ahí mete nueve camiones inventados dentro de un día de trabajo real.

2. **Lo que los distingue no viaja.** `source: "demo"` se excluye de la sincronización a
   propósito, y con razón: la simulación de un aparato no debe ensuciar a los demás. Pero
   eso significa que los camiones inventados **existen en un solo aparato**. El servidor no
   sabe de ellos y ningún otro los ve.

3. **Nada comparaba las dos cosas.** Dos personas mirando el mismo vaciado veían totales
   distintos y el sistema no tenía forma de notarlo.

**Y hay una cuarta pieza, peor, que la auditoría destapó de paso:** el 31 de julio de 2026
el expediente compartido tiene un plan de **260 yardas y 13 losas sin un solo camión** — las
cifras exactas de la simulación. Su plan viajó; la marca que lo delataba, no. Una vez ahí,
**ningún aparato puede distinguirlo de un vaciado real**, y la limpieza automática no lo ve
porque solo borra lo que lleva la marca. Es basura permanente dentro de un expediente que se
certifica.

**El arreglo, en dos partes:**

- **La simulación no entra en un día que ya tiene plan.** Si el día es de alguien, no se
  siembra. Antes bastaba con que no hubiera camiones todavía.

- **`diasFantasma()` los saca a la luz.** Cualquier día PASADO con plan y cero camiones se
  canta en el Control Center, y si sus cifras cuadran con las de la simulación se dice.
  No borra nada —§«nada se borra» sigue en pie—, pero deja de ser invisible, que era lo
  único que hacía falta para que nadie lo notara durante una semana.

**La regla que queda:** un dato que no viaja tiene que ser *imposible* de confundir con uno
que sí. Si la única diferencia es un campo que la sincronización descarta, entonces desde el
otro lado no hay diferencia ninguna — y el expediente deja de ser una sola verdad, que es lo
único que QCheck vende.

**Ampliación del 7 ago 2026, tras dos arreglos fallidos.** La causa de verdad no era el
sembrado: era que **el plan del día se fusiona al guardarlo** (`{...lo que había, ...lo
nuevo}`), y esa fusión conservaba `source: "demo"`. Rubén programaba un tiro REAL sobre un
día que la simulación había sembrado, el tiro heredaba la marca, y la sincronización —que
excluye lo marcado, y con razón— **no lo mandaba nunca**. Él lo veía en su pantalla; nadie
más. Los dos Control Center decían cosas distintas y ninguno estaba roto.

Ahora la marca se cae en cuanto una persona guarda el plan: **quien programa un tiro es una
persona, y desde ese momento el día es de verdad y viaja.**

Y la limpieza automática se volvió prudente: solo borra un día marcado si **sigue siendo la
simulación tal cual la sembró** (260 cy y 13 losas, sin camiones). Si hay camiones detrás, o
el plan ya no es el suyo, le quita la marca en vez de borrarlo. Borrar de más habría sido
peor que el fallo: se llevaría por delante el tiro que alguien acaba de programar y todavía
no tiene camiones — la mañana de cualquier vaciado.

**Y una tercera pieza, del mismo día.** Aunque el tiro ya viajaba, **ninguna pantalla
saltaba a él**: todas elegían el día con `testDates()`, que solo devuelve días CON CAMIONES.
Un tiro recién programado no tiene ninguno, así que el Control Center, Muestras, Recepción y
el Field Display seguían enseñando el vaciado anterior — 157/150 y «camión 123 aceptado» del
1 de agosto — mientras Rubén ya había programado el de hoy.

**Un tiro programado ES el tiro de hoy desde que se programa**, con cero camiones o con
veinte. Todo lo que elige día usa ahora `diasDelProyecto()`, que incluye hoy en cuanto hay
plan.

## 24 · Un tiro se programa; un tiro cerrado se reabre, no se edita

**Q-47 — 7 de agosto de 2026**

Dos reglas que hasta ahora el programa daba por supuestas y no eran ciertas.

**El tiro se planificaba siempre para hoy.** El formulario del vaciado no tenía
campo de fecha: escribía en `dayMeta[hoy]` y ya. Un vaciado se coordina días
antes —la concretera, las losas, la hora de arranque—, y no había manera de
dejarlo montado. Ahora el formulario abre con un campo **Día del vaciado**. Si
se cambia, el plan se muda a ese día: se avisa antes de pisar un plan que ya
exista, y el día viejo se borra solo si no tiene camiones. Un día con camiones
nunca se borra — DECISIONS §3, nada se inventa y nada se pierde.

**Un tiro cerrado se dejaba editar.** Cerrar era una etiqueta, no un candado:
el formulario abría igual y guardaba encima. Cerrar un vaciado es un acto de
récord —el expediente de ese día queda como quedó— así que ahora el formulario
se niega a abrir y dice que hay que reabrirlo primero. Reabrir sigue siendo
solo del ingeniero de récord (§22). La regla se aplica en los dos sitios donde
se edita el plan: el Control Center y el tablero del contratista.

**Y una trampa que salió de la primera regla.** Si se puede programar para
mañana, la lista de días la encabeza un día futuro. La pantalla por defecto
no puede ser esa: la obra trabaja hoy, y un tiro de la semana que viene no
puede secuestrar los indicadores. Quedan separadas dos cosas que antes eran
una sola:

  · `diasDelProyecto()` — todo día con camiones **o con plan**, futuro incluido.
  · `diaPorDefecto()` — hoy si hoy tiene algo; si no, el día más reciente
    **que ya haya pasado**. Un tiro futuro se ve eligiéndolo, nunca solo.

**Para que no vuelva a pasar.** La lista de días y el día que se enseña son
preguntas distintas y se contestan por separado. Cualquier pantalla nueva que
necesite un día de arranque usa `diaPorDefecto()`, nunca `dias[0]`.

## 25 · Un vaciado se descarta, no se borra

**Q-48 — 7 de agosto de 2026**

El 31 de julio de 2026 hay en el expediente compartido un vaciado de 260 CY y
13 losas **sin un solo camión**. Nadie vació nada ese día: es la firma exacta
de la simulación, que llegó al servidor por el fallo de Q-46 —la marca
`source: "demo"` se perdía al guardar encima y el sincronizador lo tomó por
obra real.

No alteraba ninguna estadística, porque no tiene ensayos. Pero es un día de
vaciado en el récord de la PR-52 que no ocurrió, y eso sale impreso.

**No había manera de quitarlo.** `retirarDia()` retira camiones, y aquí el
problema era el contrario: un plan sin camiones. Así que se añade lo que
faltaba, con el mismo criterio que ya rige para un ensayo retirado (`vivos()`):

  · **Se descarta, que no es borrar.** El día se queda en el archivo con
    `borrado: true`, el motivo, quién lo descartó y cuándo. Deja de contar y
    deja de aparecer, pero no desaparece. Un expediente del que se pueden
    hacer desaparecer renglones no vale nada — y además así el descarte viaja
    a los demás aparatos como cualquier otro cambio, cosa que un borrado de
    verdad no tendría cómo hacer.
  · **Solo el ingeniero de récord** (§22), igual que reabrir un tiro cerrado.
  · **Con camiones dentro no se descarta.** Eso ya no es un día fantasma, es
    un día de obra; sacarlo del récord no sería una limpieza sino otra cosa.
    La opción ni siquiera se ofrece — una opción que siempre falla no es una
    opción.
  · **Tiene vuelta atrás.** Los descartados se listan en Settings → Descartados
    con un botón para devolverlos. Un descarte irreversible sería un borrado
    con otro nombre.
  · **Un tiro descartado tampoco se edita**, como uno cerrado.

**Para que no vuelva a pasar.** La causa raíz —la simulación colándose en el
expediente— quedó cerrada en Q-46 y §23. Esto es lo otro que hacía falta: que
cuando algo entre donde no debe, exista la manera de sacarlo sin mentirle al
archivo.

**Ampliación (Q-48b, mismo día).** El botón para descartar se puso primero en
el menú de «Tiro», que actúa sobre el día activo — y un día fantasma nunca es
el día activo, así que era inalcanzable. Peor: `diasFantasma()` existía desde
Q-46, el Control Center lo calculaba, y **no lo pintaba en ningún sitio**. El
programa sabía que había un vaciado que nunca ocurrió y no se lo decía a nadie.

  · El aviso se pinta, con el botón dentro. Es el único sitio desde donde se
    alcanza un día que por definición no sale en ninguna lista.
  · `diaPorDefecto()` nunca elige un fantasma: presidir el Control Center con
    «0 / 260 CY» de un vaciado que no ocurrió es lo contrario de lo que hace
    falta.
  · `diasFantasma()` salta los ya descartados, o el aviso no se apagaba nunca.

**La lección.** Una función que detecta un problema y no tiene pantalla que la
enseñe no sirve de nada — y `verificar.js` no la ve, porque su chequeo de
código muerto mira funciones sin llamar, y ésta se llamaba. El aviso y la
acción que lo resuelve van juntos o no van.

## 26 · El slump siempre con dos decimales

**Q-49 — 7 de agosto de 2026**

`fmt()` recortaba los ceros de la derecha: un slump de 3" salía «3» y uno de
3½" salía «3.5». En una medida de campo eso no vale. 3.00 y 3.50 dicen con qué
precisión se midió, y en una columna leída a toda prisa en obra, «3» y «3.5»
no se alinean ni se comparan de un vistazo.

Vale para el valor medido **y para los límites del plan**: si el reporte dice
que la zona de acción es 3.00–5.00", el camión que sale 3.00 se lee contra
ella sin traducir nada.

`fmt(n, dp, min)` acepta un mínimo de decimales, y `fmtSlump(n)` es la única
puerta por la que sale un slump a pantalla o a papel — tabla, chip, celda en
vivo, umbrales y pistas de las cartas, motivo de rechazo, reporte escrito,
plan de control y la línea del contrato que se le publica a la concretera.

**La exportación a CSV se queda en crudo**, a propósito: eso va a una hoja de
cálculo, donde un número formateado como texto es un estorbo.

**Para que no vuelva a pasar.** Un slump que se imprima con `fmt()` a pelo es
un fallo. Se usa `fmtSlump()`; si hace falta pasarlo por un ayudante que toma
`dp`, el ayudante toma también `dpMin`.

