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

## 27 · Si lo que se enseña no es de hoy, hay que decirlo

**Q-50 — 7 de agosto de 2026**

Desde Q-47 el Control Center cae al último vaciado cuando hoy no hay tiro
abierto, que es lo que se quiere: a las siete de la mañana lo útil es ver cómo
acabó el último. Pero la pantalla lo rotulaba igual que si fuera la jornada en
curso — la barra decía «Tiro · 190 / 150 cy · 100%» y el mosaico «Vaciado de
hoy». Eso no es un dato incompleto, es un dato falso: se lee como la obra de
ahora mismo.

Ahora, cuando el día que se enseña no es hoy:

  · la barra dice **«Último tiro»** con la fecha,
  · el estado del vaciado dice **«Último tiro · 18 jul 2026»**,
  · el mosaico dice **«Último vaciado · 18 jul 2026»**.

**El detalle que importa.** En pantalla estrecha la barra escondía el rótulo
«Tiro» para ganar sitio, y eso valía mientras el rótulo no dijera nada. Cuando
dice «Último tiro» ya no es decoración, es la advertencia — así que en estrecho
se sacrifican los segmentos de avance, que son adorno, y se queda el rótulo.

**Para que no vuelva a pasar.** Cualquier etiqueta que diga «hoy» tiene que
comprobar que el día que enseña es hoy. Una pantalla que cae a otro día por su
cuenta está obligada a decir a cuál.

## 28 · Navegación, no una lista de atajos

**Q-51 — 7 de agosto de 2026**

La cabecera llevaba «Results ↗ · Reportes ↗ · Field Display ↗»: tres links
sueltos que no eran navegación sino tres destinos elegidos a dedo. No servían
para lo que uno necesita el 90% de las veces —volver— y ocupaban el sitio
donde la vista busca los controles.

Fuera. En su lugar, en la barra de arriba y en **todas** las pantallas, lo que
hace cualquier navegador: **atrás · adelante · casa · cerrar**. A Results y a
Reportes se entra por los mosaicos del Control Center, que ya estaban.

  · **Adelante solo se enciende si hay algo delante.** El navegador no lo
    dice, así que se mira el tipo de navegación de esta carga: si llegamos con
    el botón de atrás, hay historia por delante; si llegamos siguiendo un
    enlace, no la hay. Un botón que no hace nada es peor que un botón ausente.
  · **Casa y cerrar desaparecen cuando ya estás en casa.**

**Y un fallo que salió por el camino.** `casaDe()` deducía la casa del `rol`,
así que al contratista, al concretero y a la Autoridad los mandaba a
`movil.html` —el portal de campo del equipo de QC— en vez de a su tablero. Ya
fallaba con la ✕ desde antes; el botón de casa lo habría heredado. Ahora manda
la capacidad `casa:` de la cuenta, que es de donde sale siempre el papel de
cada quien (AGENTS §3).

## 29 · Los avisos, abajo del todo y en ningún otro sitio

**Q-52 — 7 de agosto de 2026**

Q-43 ya los había sacado de los informes y de Results. Faltaba el Control
Center, donde estaban dos veces: en un panel a media pantalla y, peor, en el
**estado del proyecto** de la cabecera, que se ponía ámbar y decía «3 avisos
activos» en un día en el que no se rechazó un camión ni se salió de límite.

Un aviso es una sospecha del sistema sobre una tendencia. Es útil para mirar
de reojo y decidir si conviene ajustar la planta. No es un hecho de la obra, y
no puede teñir la cabecera ni competir con los números que sí mandan.

  · El estado del proyecto informa solo de **hechos**: camiones rechazados y
    ensayos fuera de límite.
  · Los avisos van en un panel **al final de la página**, apagados, con su
    marco. Quien los busca, los encuentra; quien entra a ver cómo va el tiro,
    no tropieza con ellos.
  · La humedad de planta, que estaba metida dentro del panel de avisos, sale a
    su propio recuadro: es del día en curso y se actúa sobre ella.

**Y un fallo que salió por el camino.** Los paneles nuevos de Q-48 y Q-48b se
escribieron con `<section class="card">` y **`.card` no existe en `qc.css`**.
Salían sin marco, sin fondo y sin aire — y en una pantalla oscura eso no canta:
parece una decisión de diseño. La clase de la casa es `.panel`, con
`.panel-head` y `.panel-body`.

**Para que no vuelva a pasar.** `verificar.js` tiene una comprobación nueva,
«Armazón»: las clases que arman una caja —`card`, `panel`, `panel-head`,
`panel-body`, `w`, `grid`, `data`, `btn`— tienen que estar definidas en
`qc.css`, o falla. Probada reintroduciendo el fallo a propósito: lo caza.

## 30 · Auditoría de la víspera del primer vaciado en vivo

**Q-53 — 7 de agosto de 2026**

Repaso completo antes de correr un tiro de verdad en varios aparatos.

**Los campos del expediente salían en crudo.** «Estado del sistema» enseñaba
`resultsAt 16:38` y `losasPlan 13` en vez de frases: la lista de nombres
legibles se quedó en los campos del camión y nunca creció con el plan del día.
Se sacaron del **propio expediente de producción** —879 ops, 16 campos escritos
de verdad y sin nombre— en vez de adivinarlos, más los de Q-47 y Q-48 que
mañana aparecen por primera vez.

**Cuando Cloudflare corta por cuota, decía «No signal».** Nada se perdía —lo
pendiente queda en cola y sube solo al volver— pero el rótulo mandaba al
técnico a mirar el WiFi mientras las muestras se amontonaban por otra razón.
El 429, el 1027 del plan gratis y el 503 ahora se dicen con su nombre:
«Server limit · N unsent». Probado de punta a punta: se corta el servidor, se
registra un camión, el camión se queda en pantalla y en cola, vuelve el
servidor y el camión sube solo.

**El sondeo de «Estado del sistema» pasa de 5 s a 10 s.** Era la pantalla más
cara —dos peticiones cada cinco segundos— y es de mirar, no de trabajar. El
sondeo del expediente **se queda en 3 s y no se toca**: es el corazón del
vaciado en vivo, y la víspera de un tiro no es el día de tocarlo.

**Lo que se midió y está bien.** Los dos servidores responden igual (33 casos,
una divergencia y es de diseño) y el candado de sesión sale entero —y `git`
confirma que esta auditoría no tocó ni `sync-worker.js` ni `sync-servidor.js`,
así que esa corrida sigue valiendo—. Lo publicado en las nueve pantallas es lo
último. Los assets viajan comprimidos: 422 KB en disco, 90 KB por el cable.
Producción contesta entre 0,13 y 0,30 s.

**Lo que queda como riesgo y no es código.** Con el plan gratis de Workers
—100.000 peticiones al día— seis aparatos durante nueve horas rondan las
75.000. Cabe, pero sin holgura, y el aviso de cuota existe precisamente porque
ese techo está más cerca de lo que parece.

**Y una capacidad que no está donde se creía.** La cuenta `admin` tiene
`firma: 0`, tanto en el cliente como en el servidor. El ingeniero de récord es
Rubén y solo Rubén: reabrir un tiro cerrado y descartar un vaciado del
expediente no los puede hacer nadie más. Es coherente con §22, pero conviene
saberlo antes y no delante de la pantalla.

**Ampliación (Q-51b, 7 ago 2026).** Quedaban seis botones-enlace en las
cabeceras: tres «🖥 Field Display» (contratista, conduce, producción) y tres
«← Control Center» (estado, reporte, settings). Eran lo mismo que los links de
la cabecera del Control Center —destinos elegidos a dedo, disfrazados de
botón— y sobraban desde que la barra de arriba lleva atrás, adelante, casa y
cerrar en todas las pantallas.

Antes de quitarlos se comprobó pantalla por pantalla que ninguna se quedaba
sin salida: las tres que no son casa de nadie ganan el botón de casa y la ✕;
las dos que sí lo son —contratista y producción— se quedan con atrás y
adelante, que es lo que corresponde a un tablero de una sola pantalla.

Lo que **no** se toca: «Conectar este aparato» en Estado del sistema y «Print
report» en el tablero del contratista. Son acciones, no navegación.

## 31 · El enlace de conexión tiene que sobrevivir a WhatsApp

**Q-54 — 7 de agosto de 2026**

El enlace llevaba dos parámetros —`?api=…&llave=…`— y ese **`&`** es justo lo
que parten WhatsApp y Mensajes cuando el texto se corta, se cita o se reenvía.
Llegaba un enlace sin llave y la pantalla salía pidiendo datos que quien lo
recibió no tiene. Víctor: «no me funciona ese link».

**El servidor del proyecto no cambia**, así que no tiene por qué viajar en el
enlace. Va de fábrica en `conectar.html`, y el enlace queda con **un solo
parámetro y ningún `&` que partir**:

    …/conectar.html?k=<llave>

`llave` sigue valiendo, y el campo del servidor se puede escribir a mano: el
día que haya un segundo proyecto, no hay nada que deshacer.

**Y una tarjeta.** Al pegar el enlace, WhatsApp, Mensajes y el correo enseñaban
un rectángulo gris con un URL. Ahora enseñan la tarjeta de QCheck —logo, «Smart
Quality Control», el proyecto y «Conectar este aparato»— con `og:`
y `twitter:`. La imagen va **absoluta**, porque los previsualizadores no
resuelven rutas relativas, y en JPEG de 73 KB: un PNG de 667 KB WhatsApp lo
descarta y vuelve a enseñar el rectángulo gris.

**Lo que NO se hizo, y por qué.** Sería más cómodo un enlace sin llave —
`…/entrar.html` a secas— con la llave dentro de la página. No: eso deja el
expediente de la obra abierto a quien adivine el URL de un sitio público. La
llave en el enlace es lo único que separa un aparato de la obra de cualquiera
con un navegador.

## 32 · El lector de conduces, encendido

**Q-32 — 8 de agosto de 2026**

El lector estaba construido desde Q-01 y desplegado, pero contestaba
`501 sin-lector`: faltaba el secreto `QC_ANTHROPIC` en Cloudflare. Ya está
puesto y **probado con un conduce**, no solo con un ping:

    ticket 55418 · camión 127 · 9.5 CY · batch 07:42 · sin ilegibles

El papel traía «7:42 AM» y el lector lo guardó en 24 horas, que es como lo
quiere el expediente. Tarda unos 8 segundos: la foto se adjunta al instante y
los campos se rellenan después, así que el técnico no espera mirando.

**Coste medido:** 3.476 tokens de entrada y 84 de salida por conduce, unos dos
centavos. Con $20 de crédito salen cerca de mil camiones.

**Lo que se aprendió por las malas.** Al preparar el comando le copié a Víctor
el comando al portapapeles, y ahí es donde él tenía la llave recién creada —
que solo se enseña una vez. La perdió y hubo que hacer otra. **El portapapeles
de quien está trabajando no se toca**: es un sitio con estado, y pisarlo borra
algo que a lo mejor no se puede recuperar. Si hace falta darle un comando
largo, se le da como texto para copiar, y él decide cuándo.

## 33 · El conduce contra el tiro programado

**Q-55 — 8 de agosto de 2026**

El vaciado lo coordina el ingeniero en QCheck: pone las yardas del día antes de
que llegue el primer camión. El conduce trae impreso, en la columna
«Ordenadas», lo que la concretera cree que va a despachar ese día. Son dos
números que deberían decir lo mismo y nadie los estaba comparando.

Cuando no cuadran, alguien está pidiendo o entregando otra cosa: se cambió el
pedido por teléfono y no se apuntó, se despachó contra otra orden, o el plan se
tecleó mal. Las tres se arreglan con una llamada — **pero solo si se ve con el
primer camión y no al cerrar el día**, cuando ya hay hormigón puesto.

  · El lector saca `ordenadas` del conduce, y viaja con el camión al
    expediente. No tiene campo en pantalla: el técnico no las teclea, no son
    suyas.
  · **En Recepción**, al registrar, si no cuadra se avisa y se puede parar. La
    pregunta no es retórica: puede que el conduce esté bien y el plan mal, y
    entonces lo que toca es hablar con el ingeniero, no seguir metiendo
    camiones contra una orden que nadie ha confirmado.
  · **En el Control Center**, un panel rojo arriba, no abajo con los avisos de
    tendencia. Esto no es una sospecha del sistema: son dos papeles que se
    contradicen y hay hormigón en camino.
  · Margen de media yarda, porque los conduces redondean.

**Y el slump impreso NO se lee.** El conduce trae un slump —3.00 en el de
Concre-Tech— que es el **teórico de diseño**, no el medido en obra. Meterlo
donde va el de campo sería falsear el ensayo, así que el lector tiene orden
expresa de no devolverlo. El slump lo mide el técnico con el cono y no lo trae
ningún papel.

**Ampliación (Q-55b, mismo día).** Al añadir `ordenadas` se rompieron dos
campos que antes salían bien, y no se vio hasta contrastar la lectura con la
anterior:

  · **`company` pasó a devolver «Del Valle Group»**, que es el CONTRATISTA que
    aparece en «Vendido a», no la concretera. La instrucción nueva nombraba a
    Concre-Tech como ejemplo y eso bastó para desviar el campo. Ahora dice con
    todas las letras que `company` es la del membrete, la que emite el conduce,
    y que el de «Vendido a» es otra empresa.
  · **`batch` bailaba entre tres horas del papel** —06:07, 06:12, 06:18— según
    lo que entrara en la foto. Queda fijado en la del CONDUCE, la de la
    cabecera junto a la fecha, que es la que se repite en «Salida de Planta».
    Si en el encuadre entra además la pesada de planta, sus horas se ignoran a
    propósito: el mismo camión no puede dar una hora distinta según lo que se
    fotografíe.

Comprobado con seis lecturas —tres de la página entera y tres del conduce
solo— y las seis dan lo mismo. **Un cambio en el prompt del lector es un cambio
de comportamiento y se verifica repitiendo lecturas, no una sola vez:** el
mismo papel tiene que dar el mismo resultado, y tiene que darlo aunque cambie
el encuadre.

## 34 · Un aviso que sale siempre deja de ser un aviso

**Q-56 — 8 de agosto de 2026**

El conduce de Concre-Tech no imprime hoy la planta. El lector la pedía igual,
así que la devolvía en `ilegible` en **todos** los camiones y el técnico leía
«1 campo no se leyó» cada vez — por un dato que no está en el papel y que
tampoco tiene casilla donde escribirlo.

Eso no es un aviso, es ruido. Y el ruido educa: una lista que siempre trae lo
mismo se deja de mirar, y el día que avise de algo real tampoco se mira. Se
quita `plant` del esquema del lector. QCheck sigue guardando la planta fija,
como venía haciendo desde el principio.

**Y una distinción que faltaba en las instrucciones.** `ilegible` es para lo
que **está** en el papel y no se deja leer —borroso, cortado, tapado—. Si el
conduce sencillamente no trae ese dato impreso, va `null` y **no** va a
`ilegible`: no hay nada que revisar. Son dos cosas distintas y confundirlas
llena la lista de huecos que nadie puede rellenar.

Víctor dice que el conduce traerá la planta pronto. Ese día se devuelve la
línea al esquema y ya está.

**Nota de método.** La primera comprobación tras desplegar dio `plant` todavía
presente y llevó a buscar el fallo en el código, que estaba bien: era el
despliegue a medio propagar. Tras un despliegue del Worker conviene esperar y
repetir antes de concluir que algo no funcionó — si no, se persigue un fantasma.

## 35 · La SP-934 se enciende, no sustituye

**Q-57 — 8 de agosto de 2026**

El próximo proyecto corre bajo la SP-934, que acepta el hormigón de otra
manera: por lotes de 250 m³, con estadística, y de ahí sale cuánto se cobra
(el análisis completo está en `docs/SP-934.md`). Es un modelo distinto del que
usa QCheck hoy, no una capa encima.

**QCheck tiene que seguir funcionando igual** — Víctor, 8 ago 2026. La PR-52
está corriendo con este programa ahora mismo. Así que la 934 **se enciende**, y
mientras esté apagada no existe.

Dos niveles, y el del día manda sobre el del proyecto:

  · `db.project.spec` — la norma del proyecto entero, en «Plan & Datos»
  · `db.dayMeta[dia].spec` — la de un tiro suelto, en el formulario del vaciado

Vacío significa **como siempre**, y no hay valor por defecto que encienda nada:
un proyecto en marcha no puede cambiar de criterio de aceptación porque alguien
despliegue una versión nueva.

**Al cerrar un tiro se congela la norma**, junto con los límites (Q-40/Q-41).
Un vaciado se juzga con la que regía el día que se firmó y con ninguna otra —
si el proyecto cambia de especificación después, lo ya firmado no se vuelve a
juzgar. Comprobado: se cierra un día bajo 934, se apaga la 934 del proyecto, y
ese día sigue siendo 934 mientras hoy no lo es.

**Una sola puerta.** Todo lo de la 934 pregunta por `es934(dia)` y por ningún
otro sitio. El día que haya una SP-935 se añade a `QC_SPECS` y no hay que ir a
buscar condiciones sueltas por diez pantallas.

**Cómo se comprueba que «sigue igual» es verdad.** Con la 934 apagada, el
Control Center rinde exactamente el mismo contenido antes y después del cambio
—1.403 caracteres las dos veces—. Cualquier módulo nuevo tiene que pasar esa
prueba: encender la norma cambia la pantalla, apagarla la deja como estaba.

**Ampliación (Q-57b, mismo día).** Nada de la 934 se enseña a Rubén ni al
técnico hasta que esté terminada (Víctor, 8 ago 2026). **Media función a la
vista es una función rota, y en obra la gente la toca.**

Auditado uno por uno lo que ya estaba expuesto:

  · `assets/sp934.js` — no lo carga ninguna pantalla. Invisible.
  · La especificación del proyecto vive en «Plan & Datos», detrás de
    `qcVeConfig()`, que hoy solo tiene la cuenta de Víctor. Ya estaba tapada.
  · **La especificación del tiro, en el formulario del vaciado, NO tenía
    puerta.** La veían Rubén y el técnico. Esa era la fuga.

Ahora va detrás de `qcVeConfig()` también. Comprobado entrando como cada uno:
Rubén y el técnico ven diez campos y ninguna mención a la norma; la cuenta de
Víctor ve once.

Cuando la 934 esté entera, quitar esa puerta es una línea — y es lo único que
separa el módulo de estar vivo.

## 36 · El muestreo se sortea, y el sorteo se puede rehacer

**Q-60 — 8 de agosto de 2026**

La 934 lo exige con todas las letras: *«The above-described sampling tests and
field procedures shall be performed on a random basis (ASTM D3665)»*.

Hoy decide el técnico a qué camión le saca muestra. Bajo la 934 eso es un
flanco: cualquiera puede alegar que se muestreó el camión que convenía, y con
eso no se impugna la muestra — **se impugna el lote entero**.

Que lo elija el programa no basta. Tiene que **demostrarse**, y por eso el
sorteo cumple tres cosas:

  1. Se hace **antes** de que llegue el hormigón.
  2. Queda escrito con quién lo pidió y cuándo.
  3. Es **reproducible**: se guarda la semilla y cualquiera puede rehacerlo.

La tercera es la que convence a un auditor. **`Math.random()` no sirve aquí**:
no se puede rehacer, así que hay que creerse el resultado. Se usa un generador
con semilla y la semilla se publica — se enseña el método, se enseña la
semilla, y quien dude que lo recalcule.

**El fallo que encontró la prueba, y que cambió el diseño.** La primera versión
sorteaba una posición absoluta dentro de los 25 m³ nominales del sub-lote. La
prueba la tumbó: los camiones no vienen de 25 m³ —vienen de 7,65— así que un
sub-lote acaba con lo que acaba, y **dos de cada diez terminaban antes del
punto sorteado**. Esos se quedaban sin muestrear.

Ahora se sortea una **fracción de 0 a 1** y se aplica a lo que el sub-lote de
verdad tuvo. El punto siempre cae dentro, y no se pierde nada de lo que hace
defendible el sorteo: la fracción se sortea y se firma antes igual que antes;
lo único que espera es la regla con la que se mide.

**Un sorteo sin hora no se hace.** Sin sello de tiempo no demuestra que se
decidió antes, y entonces no demuestra nada.

**Ampliación (Q-57c, 8 ago 2026).** «QCheck debe seguir funcionando igual para
Rubén y el técnico» dejó de ser una promesa que hay que recordar.

**Había un hueco de verdad:** `lotes.html` cargaba `auth.js` pero no estaba en
ninguna de sus listas, así que cualquiera que escribiera la dirección entraba —
Rubén incluido. Ahora hay una lista `EN_OBRAS_934` en `auth.js`, detrás de
`qcVeConfig()`.

Y `verificar.js` gana la comprobación **«SP-934 en obras»**, que exige dos
cosas: que toda pantalla que cargue `sp934.js` esté en esa lista, y que
**ninguna pantalla enlace a ellas**. Lo segundo importa igual que lo primero:
un enlace es una puerta aunque al otro lado eche a quien no toca.

Probado de las dos maneras. Rompiendo a propósito: se enlaza `lotes.html` desde
el Control Center → lo caza; se saca de la lista → lo caza. Y entrando como
cada uno: **Rubén y el técnico acaban en el Control Center, el contratista en
su tablero, y solo la cuenta de Víctor entra.**

**El día que la 934 esté terminada, se saca de `EN_OBRAS_934` y ya está.** Está
en un solo sitio a propósito.

## 37 · Cilindros: lo que importa no es el registro, es qué falta

**Q-61 — 8 de agosto de 2026**

La 934 pide por sub-lote **seis cilindros** de resistencia a dos edades, **dos**
de permeabilidad si el proyecto la lleva, y **dos por lote** de tensión
indirecta que son solo informativos. Las edades salen del plan —7 y 28, o 7 y
56 en tablero de puente— y **nunca del código**: eso ya se aprendió por las
malas en Q-59, clavando 28 días en un proyecto de 5 y obteniendo una pantalla
impecable con números falsos.

**Un sub-lote sin hormigón no debe cilindros.** Pedirlos sería inventar
trabajo, y el técnico aprendería a ignorar la lista — que es exactamente el
fallo de Q-56 con otro disfraz.

**La tensión indirecta va marcada como informativa**, porque no entra en ningún
factor de pago. Si no se dice, alguien la va a contar.

**Y el aviso de las 48 horas.** La 934 obliga a coordinar con el laboratorio de
la Autoridad antes del vaciado (934-6.01-f). Eso no es un dato que guardar: es
un plazo que el programa puede vigilar y una persona olvida. Con las reglas de
siempre — no se avisa si todavía hay margen, no se avisa si ya se coordinó, y
**no se avisa de un vaciado que ya pasó**, porque de eso no queda nada que
hacer y un aviso sin remedio solo enseña a ignorar los avisos.

El estado de un juego de cilindros no dice si existe el registro: dice **qué
falta y desde cuándo** — sin hacer, en obra, esperando, vencido o completo.

## 38 · El reporte de lote: nadie firma un número que no puede reconstruir

**Q-62 — 8 de agosto de 2026**

Es el documento que mira la Autoridad y el que se firma. Todo lo demás de la
934 existe para poder emitirlo.

**No basta con dar el PWL y el factor de pago.** Van también la media, la
desviación, los índices de calidad QU y QL, y los porcentajes parciales PU y
PL — que son los pasos 1 a 10 del artículo 934-7.05. Quien reciba el reporte
tiene que poder rehacer la cuenta con una calculadora y llegar a lo mismo. Un
número que solo se puede creer no sirve para acompañar un pago.

Y va también la lista de valores de sub-lote, para que el cálculo se pueda
rehacer desde el principio y no desde donde a nosotros nos convenga.

**El sorteo del muestreo va dentro, con su semilla.** Es lo que convierte «se
eligió al azar» en algo comprobable en vez de una promesa. Con la semilla
delante, cualquiera puede repetir el sorteo y ver que sale lo mismo.

**Se declara el método.** El reporte dice que el PWL sale por integración de
la distribución beta según 934-7.05, y que el cálculo reproduce la Tabla 934-6
que publica la propia especificación, en 32 puntos con muestras de tres a diez
sub-lotes. Eso último es un hecho comprobable, no una afirmación de marketing:
está en `pruebas/sp934.mjs`.

**En blanco y negro y sin adornos.** Esto se firma y se archiva; no es una
pantalla.

**Y el sorteo se guarda en el expediente, no en la pantalla.** Se hace una vez
por lote y no se rehace nunca: rehacerlo sería volver a tirar los dados hasta
que salga el camión que conviene, que es exactamente lo que la 934 impide.

## 39 · Hacia dónde va el lote, sin adivinar

**Q-63 — 8 de agosto de 2026**

Hoy el factor de pago se sabe a los 28 días, cuando el cheque viene corto y ya
hay hormigón puesto y curado. Con cinco sub-lotes de diez se puede saber antes,
y antes todavía se puede hablar con la planta.

**Pero proyectar es adivinar, y aquí no se adivina** (§3). Así que no se dice
«este lote va a acabar en 0.94». Se dicen tres cosas y las tres son hechos:

  · **Con lo que hay** — el lote a día de hoy. No es una predicción.
  · **El techo** — el máximo al que puede llegar si todo lo que falta sale
    clavado en el centro de los límites.
  · **El suelo** — a cuánto cae si sale justo en el límite.

**El techo es el número que cambia decisiones.** Un contratista que ve que su
techo bajó de 1.000 en el sub-lote cuatro tiene seis sub-lotes para hacer algo;
el mismo contratista enterándose a los 28 días no tiene nada. Por eso el aviso
salta ahí y dice el número, no una vaguedad.

De un lote **cerrado** no se proyecta: las tres cifras serían la misma y
repetirla tres veces no informa, confunde.

---

### El fallo que salió mirando la pantalla

**`Number(null)` es `0`, no `NaN` — y `Number.isFinite(0)` es cierto.**

Un ensayo sin resistencia todavía —`cs28: null`, que es lo normal hasta que el
laboratorio rompe los cilindros— entraba en la media como un cero y la
arrastraba al suelo. En pantalla salía **«n 3 · media 0 · PWL 0 % · rechaza»**:
un lote perfectamente sano rechazado por no tener aún unos resultados que
todavía no podían existir.

Es el fallo más caro que puede tener ese archivo, porque **convierte un hueco
en un dato** — justo lo que §3 prohíbe — y lo hace produciendo un número
plausible. Las pruebas no lo vieron: se vio en la pantalla, leyendo una tabla
que decía «media 0».

Ahora un `null`, un `undefined` y una cadena vacía son huecos, y **un cero de
verdad sigue siendo un dato**. Con prueba de las cuatro cosas y de que un lote
sin resultados no se rechaza: no hay nada que juzgar todavía.

## 40 · Las dos unidades, y una sola puerta para los números

**Q-64 — 8 de agosto de 2026**

La 934 mide en **metros cúbicos** —el lote son 250 y el sub-lote 25— y el
conduce viene en **yardas**, que es como habla la obra. Enseñar solo una obliga
a convertir de cabeza, y convertir de cabeza a media mañana es como se cuelan
los errores.

Las dos van siempre juntas, y por una sola función (`fmtVolumen`) para que la
pareja no pueda separarse: si mañana alguien cambia el formato, cambia en los
dos sitios a la vez o en ninguno.

### Y la piedra con la que se tropieza dos veces

`Number(null)` es **0**, y `Number.isFinite(0)` es **cierto**.

Ese descuido rechazó un lote sano en Q-63. **Y volvió a colarse una hora
después**, en `fmtVolumen`, recién escrita — con el arreglo anterior todavía
fresco. Un `null` salía como «0.0 m³ (0.0 CY)».

Dos veces en una hora no es mala suerte: es que la trampa está bien puesta. Así
que deja de estar al alcance. **En `sp934.js` no se llama a `Number()` a
pelo**: hay una sola puerta, `cifra()`, que devuelve `null` para `null`,
`undefined` y la cadena vacía, y deja pasar un cero de verdad.

Y una prueba que **barre todas las puertas de entrada** con los tres huecos, en
vez de confiar en que alguien se acuerde. Ese bloque existe precisamente porque
acordarse no funcionó.

## 41 · Permeabilidad, y la pantalla de la Autoridad

**Q-65 — 8 de agosto de 2026**

### La permeabilidad

Va en el formulario del laboratorio, junto a las resistencias, **y no en
Muestras**: no es una prueba de campo, es un resultado que devuelve el
laboratorio. Dos cilindros por sub-lote, AASHTO T 277.

Y **solo aparece si el proyecto se acepta bajo la 934 y además la
inspecciona**. La PR-52 no la lleva, y un campo vacío que nadie va a llenar
solo estorba al técnico — el mismo criterio de Q-56.

### La pantalla de aceptación

Es una pantalla de **decidir**, no de operar. Quien entra no muestrea, no
programa vaciados y no corrige datos: mira un lote, ve de dónde sale cada
número, y lo acepta o lo rechaza.

Por eso no se parece a la de lotes aunque enseñe lo mismo. Allí el ingeniero
vigila cómo se llena; aquí se cierra un expediente y se firma. **Meter botones
de operación aquí sería invitar a la Autoridad a hacer trabajo que no es suyo,
y a cargar con una responsabilidad que tampoco.**

  · **Solo lotes completos.** Uno a medias no se acepta ni se rechaza: se
    espera. Con menos sub-lotes de los que pide la norma, el resultado
    cambiaría con cada camión.
  · **Rechazar exige motivo.** Sin él no se guarda. Un rechazo sin razón no se
    le puede enseñar a un contratista.
  · **La decisión lleva quién y cuándo**, y no se borra: si se cambia de
    opinión, la nueva queda encima y las dos viven en el registro de cambios.
  · **El sorteo del muestreo va a la vista**, con su semilla. Quien acepta un
    lote puede comprobar que las muestras no se eligieron a dedo — que es
    justo lo que tiene derecho a verificar.

Probado: Rubén y el técnico acaban en el Control Center, la Autoridad en su
tablero de siempre, y solo la cuenta de Víctor entra. Las dos pantallas de la
934 están en `EN_OBRAS_934` y el verificador lo comprueba.

## 42 · El portal de la 934

**Q-66 — 8 de agosto de 2026**

Puerta de entrada a todo lo de la 934, y **no toca nada de QCheck**: no cambia
una pantalla, no añade un enlace en ninguna, no altera un dato. Es un sitio
nuevo que se abre solo si se sabe la dirección y se tiene la cuenta.

Sirve para dos cosas:

**Enseñar qué hace falta para manejar un proyecto 934**, con el artículo de la
norma al lado de cada capacidad. Y **lo pendiente se dice pendiente** — hoy,
ocho de diez, con el conduce conforme y el hormigón masivo aún sin hacer. Un
portal que asegura que todo está listo no se puede volver a creer el día que de
verdad lo esté.

**Y entrar, por cada tipo de usuario, en la pantalla que esa persona vería.**
Sin capturas ni maquetas: la pantalla, con datos. Es lo que separa esto de un
folleto — cualquiera puede dibujar lo que su producto haría; entrar y usarlo es
otra cosa.

Cada usuario lleva escrito **qué NO ve**, porque eso es tan producto como lo
que ve: el técnico no ve factores de pago, la concretera no ve el dinero del
contratista, y la Autoridad no opera. Son decisiones, no limitaciones, y
conviene decirlas antes de que alguien las lea como un hueco.

**Una regla del verificador tuvo que aflojarse, y con cuidado.** Las pantallas
de la 934 sí pueden enlazarse entre ellas —viven todas tras la misma puerta,
así que un enlace de una a otra no abre nada—. Lo que sigue prohibido, y
comprobado en cada corrida, es que una pantalla **viva** enlace a una en obras.

## 43 · La simulación de QCheck 934

**Q-67 — 8 de agosto de 2026**

Un prototipo funcional: un vaciado de Concre-Tech en la ampliación de la PR-22,
con dos lotes cerrados y el tercero por la mitad. Cuatro puertas —Rubén,
Carreteras, el contratista y la concretera— y **cuatro tableros distintos sobre
los mismos datos**.

Que sean distintos no es decoración: es la tesis del producto. Rubén opera y
firma; Carreteras decide y no opera; el contratista ve su dinero mientras aún
se puede hacer algo; la concretera ve su mezcla y **no ve los factores de
pago**, que son entre el contratista y la Autoridad.

**Lo que cada uno no ve está decidido con el mismo cuidado que lo que ve.**

### Cómo se evita repetir julio

El 31 de julio la simulación anterior se coló en el expediente compartido y
dejó un vaciado de 260 CY que nunca ocurrió (§23, Q-46). El fallo no fue tener
una simulación: fue que sus datos podían confundirse con los de verdad. Esta se
construye al revés:

  · **No usa `db`.** Ni lo lee ni lo escribe.
  · **No sincroniza.** No hay ruta desde aquí al servidor.
  · **Se anuncia** con una cinta fija que no se quita desde dentro.
  · **Otra obra, otro kilometraje, otras fechas.** Nada se parece a la PR-52 lo
    bastante como para confundirse en una captura de pantalla.

### Dos cosas que enseñó construirla

**El factor de pago de un lote en curso no existe, y decirlo vale más que
esconderlo.** La 934 lo calcula con roturas a 28 días y el hormigón se está
colocando hoy. En vez de enseñar guiones, la pantalla dice cuándo se sabrá y
enseña las roturas a **7 días** como lo que son: una señal temprana que **no se
convierte** a 28 —eso sería inventar un dato— pero que dice si la mezcla va por
donde debe, que es lo que permite llamar a la planta a tiempo.

**Promediar los camiones dentro de cada sub-lote aplana la dispersión.** El
lote «malo» de la simulación hubo que empeorarlo dos veces: con media 3.760 psi
y camiones muy dispares seguía pagando 1.05, porque la desviación que ve el PWL
es la de los sub-lotes, no la de los camiones.

Eso no es un detalle de la simulación: **es cómo funciona la 934 de verdad**.
Un lote irregular camión a camión puede salir impecable en la estadística,
porque la norma juzga sub-lotes. Conviene saberlo antes de prometerle a nadie
que el PWL detecta variabilidad.

## 44 · El portal de demostración, y lo interno por cuenta

**Q-68 — 8 de agosto de 2026**

`demo934.html`: se abre, se elige una parte y se entra en su pantalla con el
vaciado corriendo. **Cuatro botones y nada más.**

**Nada de cómo está hecho.** Ni qué falta por construir, ni por qué se decidió
una cosa y no otra, ni el estado de los módulos. Eso vive en `934.html`, que
sigue siendo solo de Víctor.

La razón no es esconder: **quien mira una demostración necesita ver el
producto, no el andamio.** Un portal que enseña las dos cosas a la vez no
consigue ninguna.

**Lo interno se decide por cuenta, no por pantalla** (`qcVeConfig()`), así que
la misma pantalla enseña o calla según quién entre — y no hay dos versiones que
mantener.

**Lo que no se esconde jamás, sea quien sea:** la cinta de simulación y el
aviso de que los datos son inventados. Eso no es diseño interno, es no engañar.

**Y la demo la abre cualquiera que entre a QCheck.** Sus datos no existen, así
que no hay nada que proteger — y una herramienta de enseñar que necesita que
estés tú delante no sirve para enseñar.

### El candado, afinado por tercera vez

La regla pasa a ser: una pantalla que usa la aritmética de la 934 está **en
obras** —trabaja sobre el expediente real— o es **de demostración** —carga
`sim934.js`, que es la prueba de que sus datos son inventados—. No hay tercera.

Y `934.html` casaba **dentro** de `sim934.html` y `demo934.html`, así que el
verificador creía que la demo enlazaba al portal interno. Es la tercera vez que
un candado de este archivo se equivoca por buscar un trozo de palabra: pasó con
`lot` dentro de `lotes` y con `plant`. **Ahora no busca texto, busca una
referencia a un archivo**, con el borde delante. Comprobado que sigue cazando
un enlace de verdad.

## 45 · El dinero en un botón, y lo de la 934 identificado

**Q-69 — 8 de agosto de 2026**

Corrección de arquitectura de Víctor, y tenía razón: yo había repartido los
factores de pago por tres paneles de la pantalla principal. **Todo lo de pago
va detrás de un solo botón `$`** en el control center.

**Son dos cabezas distintas.** En el control center se decide qué camión
muestrear y si el vaciado va al ritmo; dentro del botón se mira cuánto va a
cobrar el lote. Mezclarlas obliga a leer factores de pago mientras se dirige
una obra, y eso ni ayuda a lo primero ni se hace bien lo segundo.

**Y la 934 se integra en lo normal, no lo sustituye.** Un proyecto 934 sigue
siendo una obra: el vaciado del día, los camiones y el último veredicto mandan
igual. Van delante, como siempre. Lo de la norma se añade encima.

### Todo lo específico de la 934 lleva marca

QCheck lleva años juzgando camión a camión. La 934 añade otro criterio —por
lotes, estadístico— y **mezclarlos sin avisar es la manera más rápida de que
alguien lea un número con la vara equivocada**: un camión «aceptado» en control
de proceso puede estar dentro de un lote que la 934 descuenta, y las dos cosas
son ciertas a la vez.

Cada indicador, panel o pantalla que solo existe bajo la norma lleva una marca
`934`. Pequeña y constante: no compite con el dato, pero está siempre.

**Y un fallo que salió mirando la pantalla.** Metí la marca dentro del texto de
la etiqueta de un mosaico y salió el HTML en crudo: `esc()` estaba haciendo
exactamente su trabajo y era la llamada la que estaba mal. La marca pasa a ser
su propio parámetro — lo que es texto se escapa, y lo que es HTML de la casa
entra por otra puerta.

## 46 · Los términos del oficio, y el mismo GUI

**Q-70 — 8 de agosto de 2026**

### El candado de idioma no miraba donde había que mirar

Quitaba los bloques `<script>` antes de buscar — y ahí es donde vive **casi
todo el texto que ve el usuario**, porque las pantallas modernas de QCheck
arman su HTML en JavaScript. La comprobación salía en verde sobre archivos que
no leía.

Ahora quita los **comentarios** —donde sí se escribe en castellano a propósito—
y mira el resto, incluidos `assets/*.js`. Al encenderlo saltaron tres «peso
unitario» en las pantallas nuevas de la 934. Corregidos a **Unit Weight**.

Y se añaden los términos de la norma, que en obra y en el papeleo de la
Autoridad también se dicen en inglés: nadie dice «porcentaje dentro de
límites», dicen **PWL**.

### Una regla que se pasó de ancha, y volvió atrás

Metí «resistencia a compresión» en la lista y el verificador señaló
`reporte.html` — que es **producción y se imprime firmado**. La casa lleva años
diciéndolo así ahí.

**La regla se escribió después que el documento, así que manda el documento.**
Cambiar el texto de un papel que alguien firma por un criterio recién inventado
es exactamente lo que no se hace. Fuera de la lista, y escrito por qué para que
no vuelva a entrar.

### El GUI

El portal de demostración estrenaba clases propias. Pasa al vocabulario de la
casa —`panel`, `panel-head`, `panel-body`, `grid cols-2`— y solo conserva lo
que `.panel` no puede dar: que la tarjeta entera sea un enlace.

**Una pantalla que estrena su propio lenguaje visual deja de parecer el mismo
producto** — y lo que se está enseñando ahí es precisamente que es el mismo
producto.

## 47 · El botón del dinero, y fuera los saltos entre pantallas

**Q-71 — 8 de agosto de 2026**

**El `$` va grande y con el signo solo.** Es la única puerta al pago y tiene
que encontrarse de un vistazo; con texto se convertía en un botón más de una
fila de botones, que es exactamente de donde venía en Q-69.

Sin texto **no es sin nombre**: va en `title` y en `aria-label`, así que quien
pasa por encima lo lee y quien usa lector de pantalla lo oye.

**Y fuera los enlaces a las otras pantallas de rol.** Es el mismo criterio de
Q-51 con QCheck: **una lista de destinos no es navegación**. Para ver otra
parte se vuelve al portal, que es donde se elige — y la cinta ya lleva esa
puerta.

### Dos incoherencias que salieron al mirarlo

**La concretera tenía el botón del dinero** y justo debajo un párrafo
explicando que ella no ve factores de pago. Ahora **el botón no existe** para
ese rol: no se le esconde el contenido, se le quita la puerta. Un botón que hay
que explicar por qué no lleva a ninguna parte es peor que no tenerlo.

**Y `.spacer` está definido solo dentro de `.panel-head`**, así que en la
cabecera de rol no empujaba nada y el botón se pegaba al nombre. Se ve en la
pantalla en un segundo y en el código no se ve nunca.

## 48 · El aviso de simulación se muda a la barra

**Q-72 — 8 de agosto de 2026**

Era una franja a rayas cruzando la pantalla. Ocupaba sitio y no se parecía a
nada de QCheck. Ahora va **donde QCheck pone el estado** —la barra de arriba,
el mismo sitio donde la aplicación de verdad dice si está en línea— en ámbar,
que es lo que el programa usa para «no es un error, pero tampoco es lo normal».

**El aviso no se quita, se muda.** Que los datos sean inventados tiene que
verse siempre y desde cualquier pantalla. Lo que cambia es que ahora se lee
como parte del programa y no como una cinta pegada encima.

**Y la pantalla del ingeniero pasa a decir «Segarra Engineering»**, no un
nombre de persona: quien la usa hoy es Rubén y mañana puede ser otro técnico
suyo, y el expediente lo firma la firma.

### El fallo, y por qué importa más de lo que parece

La barra se montó con las clases `.qcs` de QCheck… y **sus estilos los inyecta
`mountStatusBar()`**, que aquí no se llama porque lee el expediente real para
pintar el avance del tiro. Sin la inyección, `.qcs` no es más que un div
suelto: la barra acabó al final de la página, sin verse.

Durante ese rato **el aviso de simulación era invisible**. Ese es exactamente
el estado que §23 prohíbe, y llegó por quitar la franja antes de comprobar que
lo que la sustituía se veía. La barra tiene ahora estilos propios en `qc.css`
y no depende de nada que se inyecte desde fuera.

## 49 · El botón del dinero, en el idioma de la casa

**Q-73 — 8 de agosto de 2026**

La primera versión era un círculo verde relleno con el signo escrito **como
texto**. Grande sí, pero fuera del idioma de QCheck: aquí todo es panel oscuro,
borde fino de `--line`, el radio compartido, e iconos SVG con el mismo grosor
de trazo. Un glifo tipográfico dentro de un círculo de color cantaba al lado de
cualquier otra cosa de la pantalla.

Ahora es **lo mismo que una tarjeta** —fondo `--panel`, borde `--line`, radio
`--radius`— con un dólar dibujado a trazo como el resto de los iconos.

**Y el verde solo aparece al pasar por encima.** En QCheck el verde significa
«cumple»: gastarlo en un botón de navegación le quita significado donde sí lo
tiene. En reposo el icono es tinta, como todos los demás.

La lección no es de este botón: **un elemento nuevo no se diseña solo, se
diseña contra lo que ya existe.** Si hay que mirarlo dos veces para saber si
pertenece a la misma aplicación, no pertenece.

## 50 · La pantalla del pago

**Q-74 — 8 de agosto de 2026**

El botón `$` deja de abrir una ficha y **lleva a una pantalla completa**. Una
ficha se lee de pie; esto se estudia sentado: es la conversación de cuánto se
cobra, y se compara, se imprime y se lleva a una reunión.

Lleva cuatro cosas:

  · **El estado del contrato** — factor medio **ponderado por volumen**, no por
    número de lotes: un lote que descuenta pesa lo que pesa su hormigón.
  · **El lote en curso**, con suelo, ahora y techo — o con la fecha en que se
    sabrá, si todavía no hay roturas de 28 días.
  · **El histórico**, una barra por lote con la marca del **1.000** dibujada:
    es la frontera entre cobrar entero y que te descuenten, y verla convierte
    una tabla de números en una lectura de un vistazo.
  · **El detalle por característica y los reportes** que se firman.

De aquí no sale ninguna estimación comercial. Si un lote no tiene factor
todavía, dice que no lo tiene.

### Una regla que solo vive en un botón no es una regla

La concretera no tiene el botón del dinero desde Q-71. Pero **escribiendo la
dirección entraba igual**: la puerta estaba cerrada y la pared no existía.

Ahora la pantalla misma se niega y explica por qué. La lección va más allá de
esta pantalla: **esconder el acceso no es controlarlo**, y en cuanto una regla
importa —y aquí importa: son los factores de pago entre el contratista y la
Autoridad— tiene que estar donde se decide, no donde se pulsa.

## 51 · Navegación en la demostración

**Q-75 — 8 de agosto de 2026**

**Atrás, adelante y casa**, con los mismos iconos que la barra de QCheck
(`ICONO_NAV`). No es coherencia por coherencia: quien ve la demostración tiene
que reconocer el programa, y **la navegación es lo primero que se toca**.

Se aplica el criterio de Q-51 entero: «adelante» solo se enciende si de verdad
hay algo delante, mirando el tipo de navegación de esta carga. Un botón que no
hace nada es peor que un botón ausente.

**Casa quiere decir cosas distintas según dónde estés**, y eso es correcto: en
una pantalla de rol, casa es el portal de la demostración —de donde vienes y
donde eliges la siguiente parte—. En el portal, casa es el **Control Center**,
porque el portal ya es esta casa y desde ahí lo que hace falta es una salida de
vuelta a QCheck.

Sin esa salida, quien entrara desde un enlace se quedaba dentro de la
demostración sin manera de volver.

Probado con clics de verdad, no leyendo el código: portal → ingeniero → pago →
atrás → adelante → casa, y el «adelante» se enciende solo después de haber
retrocedido.


## 52 · El estado del sistema, entre la navegación y el en vivo

**Q-76 — 8 de agosto de 2026**

Víctor pidió el botoncito de estado entre los botones de navegación y el
indicador de en vivo. Mover el bloque en el HTML **no bastó**: `.qcs-nav` y
`.qcs-sistema` llevaban las dos `margin-left: auto`, y dos elementos que empujan
a la derecha en el mismo flex se separan entre ellos. El botón habría quedado
flotando en medio de la barra en vez de pegado al grupo.

Ahora empuja solo la navegación y el estado la sigue. Es el mismo error de
siempre en otra forma: **el orden del HTML y el orden que se ve no son lo
mismo cuando el CSS opina**.

## 53 · Desconectar un aparato

**Q-77 — 8 de agosto de 2026**

Un botón en cada tarjeta de Estado del sistema. Lo que había hasta ahora era
mirar: se veía que el iPad de la obra llevaba tres horas abierto en Muestras y
no se podía hacer nada al respecto.

### Que «desconectado» quiera decir algo

Son dos cosas, y hacen falta las dos:

1. **Al servidor se le caen las sesiones de ese aparato.** El pase deja de valer
   *ahí*, no solo en su navegador. Se busca por `dev` y no por token porque
   quien desconecta no es el aparato: es Víctor desde otra pantalla, y él no
   tiene el pase del iPad.
2. **Queda una orden esperando en la fila de presencia**, y el aparato la
   recoge en su siguiente latido —hasta 20 segundos—: **suelta la llave del
   proyecto y la dirección del servidor**, cierra la sesión y se va a la
   pantalla de acceso, que le dice por qué está ahí. Deja de sincronizar, deja
   de latir y desaparece de la lista.

La orden **espera**, a propósito. Si el iPad está apagado o sin señal no se
pierde: se cumple en cuanto vuelva. Una desconexión que solo funciona si el
aparato está mirando no sirve para lo que se pide de ella. Y se limpia al
entregarla, porque si no el aparato quedaría expulsado para siempre y no podría
ni volver a entrar.

### Soltar la llave, y no solo cerrar la sesión

La primera versión solo cerraba la sesión. Víctor lo miró y dijo lo que había
que decir: **«que se desconecte del servidor»**. Tenía razón y el matiz es todo
el asunto — un aparato con la sesión cerrada conserva la llave del proyecto, así
que seguía enchufado, seguía latiendo y seguía pudiendo sincronizar. Eso no es
desconectado; es deslogueado.

Ahora `_echar()` borra `qc-api` y `qc-token`. Para volver hace falta **el enlace
de conexión**, no solo la clave. Es caro a propósito: es lo que hace que la
palabra signifique lo que dice.

`qc-dev` **no** se borra: el aparato vuelve con su mismo nombre y su historial en
la lista sigue teniendo sentido.

### Lo encolado no se toca

La cola de cambios sin subir vive en `localStorage` y **se queda**. Si al técnico
lo desconectan con tres muestras sin sincronizar, siguen ahí y salen en cuanto
alguien vuelva a conectar el aparato. Desconectar es echar a quien lo está
usando, no tirar su trabajo, y el día que eso pase la diferencia es todo.

### Quién puede, y dónde se comprueba

Hoy: quien traiga la llave del proyecto, que es la puerta de toda esta API. Si
además hay sesión, se exige `config` — la misma llave que abre la pantalla.

Se comprueba **en el servidor** y no solo en el botón. Es la regla que ya se
escribió en §50 y vale igual aquí: una regla que solo vive en un botón no es una
regla, porque la dirección se puede escribir a mano.

### Lo que cuesta, dicho antes de que pase

Desconectar el iPad de la obra en mitad de un vaciado **para el trabajo hasta que
alguien le pase el enlace de conexión**. No es un botón de «vuelve a entrar»: es
un botón de «fuera». Por eso pregunta antes con el nombre del aparato y el de
quien lo está usando escritos con todas las letras, y por eso el aviso lo dice
en la pantalla de acceso, para que quien se lo encuentre sepa qué pedir.

Queda un resquicio honesto: la orden se entrega por el latido, así que quien
manipulara el navegador podría no obedecerla. Contra eso está la sesión caída, y
lo que la vuelve un candado de verdad es Q-30 (`exigir_sesion`). **Conviene
saberlo antes de contárselo a un cliente como si fuera un candado.**

### Probado

`pruebas/desconectar-aparato.mjs` —17 comprobaciones contra el servidor de
verdad sobre una carpeta de usar y tirar— y seis casos nuevos en
`servidores-iguales.mjs`, que ahora compara también campos del cuerpo: sin eso,
«desconecté un aparato conocido» y «no lo conocía» son los dos un 200 y la
batería los daba por iguales.

Y en pantalla, desconectando este mismo navegador: salió solo al acceso con el
aviso puesto, `qc-api` y `qc-token` quedaron vacíos, el nombre del aparato y la
muestra sin subir siguieron ahí, y el servidor dejó de recibir su latido — dos
lecturas de la presencia con seis segundos de diferencia dan la misma hora.

## 54 · La carpeta entera publicada en internet, con las llaves dentro

**8 de agosto de 2026**

Al correr `npx wrangler deploy` desde `qcheck` para subir el servidor, Wrangler
no subió el servidor: subió **la carpeta entera como sitio estático** a
`laude.qcheck.workers.dev`, con `datos/` dentro.

Quedaron legibles desde internet, sin contraseña: la llave del proyecto, el
secreto de administración, las claves de los usuarios —las de ahora y las
anteriores—, `usuarios.json` y el registro de cambios completo. Comprobado uno
por uno con `curl`: 200 en todos.

### Las dos causas, que son independientes

1. **Un `wrangler.jsonc` en la carpeta de arriba** (`~/Documents/Claude`) con
   `"assets": { "directory": "qcheck" }`. Wrangler sube por el árbol buscando
   configuración, y lo encontraba **antes** que `qcheck/wrangler.toml`. Así que
   `deploy` desde `qcheck` desplegaba otro proyecto, con otro nombre.
2. **Wrangler no mira `.gitignore`.** `datos/` está ahí para que no entre en el
   repositorio, y esa protección **no vale fuera de git**. Es una suposición que
   estaba metida en la cabeza de todos y en ningún sitio escrita.

### Lo que se hizo

Se desactivó el `wrangler.jsonc` —renombrado, no borrado, con un LEEME al lado
explicando por qué— y Víctor borró el Worker `laude`. Comprobado después: 404 en
todo, y QCheck intacto (las pantallas cargan y `qcheck-api` responde).

**La llave no se cambió**: decisión de Víctor, 8 ago 2026, para no dejar fuera a
Rubén y al técnico la noche antes del vaciado. Queda pendiente y es suyo.

### Lo que hay que llevarse de aquí

- **Un comando de despliegue puede publicar lo que no le pediste.** Antes de
  correr `deploy` en una carpeta nueva, mirar qué configuración va a coger, y
  con qué directorio de assets.
- **`.gitignore` protege de git y de nada más.** Si una herramienta lee la
  carpeta, `datos/` está dentro. Lo suyo es que los secretos no vivan bajo la
  raíz de nada que se pueda publicar.
- **No se supo cuánto tiempo estuvo expuesto.** El propio despliegue dijo «1313
  ya subidos», así que la copia era anterior a ese día.

## 55 · El conduce se puede leer, y la cámara se enciende

**Q-78 — 8 de agosto de 2026**

Dos cosas que Víctor pidió el mismo día, y que son la misma idea: lo que se ve
en Recepción tiene que servir para trabajar, no solo para saber que algo pasó.

### La miniatura no se leía

Al adjuntar la foto salía un cuadradito de 42 px. Servía para saber que había
foto; no servía para **leer el conduce**, y un conduce es un documento que a
veces hay que releer —cuando se reclama una yarda, cuando no cuadra una hora—.
En la lista de camiones había un 📎 que era puro adorno: decía que había foto y
no dejaba abrirla.

Ahora los dos abren el conduce a pantalla completa. Un toque en la imagen la
acerca a tamaño natural y el propio scroll —o el pellizco en el iPad— hace de
lupa; otro toque la aleja, y el fondo o Esc cierran.

**Lo que enseña es la foto que de verdad se guardó**, la de 900 px, no una copia
bonita hecha aparte. Si el conduce guardado no se lee, hay que enterarse ahora y
volver a tomarlo, no el día que alguien reclame.

Dos fallos que salieron al mirarlo en pantalla, y ninguno se habría visto
leyendo el código:

- **El visor iba por debajo de la barra de estado.** Estaba en `z-index: 90` y
  la barra en 330: se abría y la fila de cerrar quedaba tapada. Ahora en 400,
  como la ventana de tableros de `qc.css`.
- **La imagen se salía de la caja.** Con `display: grid` y `place-items:
  center`, el `max-height: 100%` de la imagen se mide contra una fila que crece
  con la imagen —contra sí misma—, así que no limitaba nada y el final del
  conduce no se veía. Con flex y `margin: auto` sí. El `margin: auto` tampoco es
  capricho: con `justify-content: center`, al acercar, la parte izquierda queda
  fuera del scroll y no se puede alcanzar.

### La cámara se preguntaba al revés

«Escanear QR» miraba primero si el navegador traía `BarcodeDetector` y, si no,
soltaba un aviso y ahí se acababa. Safari no lo trae — y Safari es justo el
navegador del iPad que está en la obra. Así que en el aparato de campo, el botón
no encendía la cámara.

Ahora **la cámara se abre siempre**, y el lector se consulta después. Si el
navegador sabe leer QR, lee. Si no, se ve por la pantalla y un aviso DENTRO del
visor —donde se está mirando, no arriba del todo— dice qué hacer en su lugar.
Enseñar la cámara y decir la verdad es mejor que un botón que no responde: el
técnico ve que el aparato reacciona y sabe cuál es el siguiente paso.

«Tomar foto» pasó a llamarse **«Escanear conduce»**: es la palabra que se usa en
obra y además dice lo que pasa después, que se lee solo. Lleva
`capture="environment"`, que en iPhone y iPad abre la cámara trasera directa; en
una PC no hay cámara y el navegador enseña el buscador de archivos, que es lo
correcto y es como Víctor lo usó la primera vez.

Si la cámara se niega, el mensaje añade una línea cuando la página no va por
`https`: en iOS la cámara solo funciona con https y el error del navegador no lo
explica.

### Lo que no se pudo probar aquí

El navegador de pruebas tiene la cámara bloqueada. Quedó demostrado que ahora se
pide la cámara **antes** de mirar el lector —que era el fallo—, pero **encender
la cámara de verdad hay que probarlo en el iPad**. Está dicho así y no de otra
manera a propósito: «debería funcionar» no es haberlo probado.

## 56 · La única pieza que no escribimos nosotros

**Q-80 — 9 de agosto de 2026**

`assets/qr-lector.js` es **jsQR 1.4.0**, de Cosmo Wolfe, licencia Apache-2.0.
No lo escribimos nosotros, y es lo único de todo QCheck que no.

### Por qué, si §1 dice que aquí no hay dependencias

Porque **Safari no sabe leer códigos QR desde una página web**. Chrome de
Android trae `BarcodeDetector` y lo resuelve el sistema; Safari no lo trae, y el
aparato de la obra es un iPad. Sin esta pieza, «Escanear QR» no puede funcionar
en el único sitio donde hace falta que funcione.

Las alternativas eran dos: escribir un decodificador entero —detección de los
patrones de esquina, corrección de errores Reed-Solomon, quitar la máscara, la
transformación de perspectiva— o no tener QR. Lo primero lleva días y no se
puede comprobar de un vistazo: un decodificador con un bug no falla, lee mal.
Víctor pidió que funcionara ahora.

### Lo que se conserva del espíritu de §1

**No hay nada que instalar.** No hay npm, no hay paso de compilación, y no se
pide a ningún CDN en tiempo de ejecución. Es un archivo, vive en el repositorio,
y funciona sin red igual que el resto.

Y se carga **solo cuando alguien pulsa «Escanear QR»**: quien nada más saca
fotos de conduces —que es el 100% del trabajo de mañana— no descarga esos
130 KB nunca.

### Lo que se comprobó antes de meterlo

- Que no llama a internet ni ejecuta texto: ni `fetch`, ni `XMLHttpRequest`, ni
  `eval`, ni `new Function`.
- Que **lee un código de verdad**. Se generó uno con el codificador que escribió
  QTicket (`qticket/qr.mjs`), se pintó en un lienzo con su margen blanco, y se
  leyó de vuelta: `67638;128;10.00;06:50`, exacto. Después, por el camino
  completo, hasta ver los campos del formulario rellenos.

  La primera pasada dio `null` y **el fallo era mío**: pegué la matriz cortada
  al pasarla al navegador. Conviene saberlo — un lector que devuelve `null` casi
  siempre está mirando una imagen mala, no fallando.

### Lo que sigue sin estar

Nada de esto lee un QR **que no exista**. Los conduces de Concre-Tech son papel
y no llevan código. Esto es para cuando exista QTicket, que es quien va a
imprimirlos.

## 57 · El lector de fuera, en un cuarto sin ventanas

**Q-81 — 9 de agosto de 2026**

Víctor preguntó lo que había que preguntar: **«¿es seguro que usemos eso?»**

La respuesta honesta era incómoda. Yo había comprobado que `qr-lector.js` no
llama a internet ni ejecuta texto, y que lee de verdad. Pero son 130 KB
comprimidos: nadie se los lee línea por línea, y una llamada montada por partes
—`window['fe'+'tch']`— se le escapa a cualquier búsqueda.

Y el riesgo era real y concreto: esa página lleva en el navegador **la llave del
proyecto** (`qc-token`) y **el pase de la sesión** (`qc-sesion`).

### Lo que se hizo

El lector de fuera **ya no corre en la página**. Corre dentro de un Web Worker
(`assets/qr-aislado.js`), y un Worker no tiene `localStorage`, ni
`sessionStorage`, ni `document`, ni `window`. **No se lo prohibimos nosotros: el
navegador no se los da.**

Entran los píxeles de un fotograma. Sale el texto del código, o nada.

### Por qué esta respuesta vale más que «lo revisé»

Porque no depende de fiarse de nadie. No hace falta auditar 130 KB para saber
que un cuarto sin ventanas no tiene vistas. Comprobado en el navegador con la
llave puesta a propósito:

```
en la página:      qc-token = "LLAVE-DE-PRUEBA-NO-DEBE-VERSE"
dentro del cuarto: localStorage undefined · sessionStorage undefined
                   document undefined · window undefined
                   leer la llave → NO ALCANZA (TypeError)
```

Y sigue leyendo: el mismo cuarto devolvió `67638;128;10.00;06:50` exacto.

### Lo que esto NO resuelve

Un Worker **sí puede** pedir cosas a internet. No tiene nada que mandar —esa es
la gracia— pero podría hablar. Eso se cierra con el candado del navegador
(Content Security Policy), y **no se hizo esta noche a propósito**: una CSP mal
puesta rompe cosas en silencio, y mañana hay vaciado en vivo.

### A dónde va esto

Lo de fuera es temporal. QTicket ya escribió un **generador** de códigos QR
propio, con su corrección de errores Reed-Solomon hecha a mano. Escribir el
**lector** es la otra mitad, y es más dura —hay que encontrar el código en la
foto, enderezarlo y muestrearlo— pero comparte la misma aritmética.

Y hay un atajo honesto que lo hace mucho más pequeño: **no necesitamos leer
cualquier QR del mundo, solo los que imprime QTicket.** Controlamos los dos
extremos. Con la versión y la máscara fijadas por nosotros, y comprobando los
síndromes de Reed-Solomon para **detectar** errores en vez de corregirlos, un
código dudoso se rechaza y se pide otra foto. Que es exactamente la regla de la
casa: **un hueco es mejor que un número equivocado.**

El día que ese lector exista, `qr-lector.js` se borra y §56 se cierra.

## 58 · El botón de echar a todo el mundo

**Q-85 — 9 de agosto de 2026**

Víctor: «bota a todo el mundo y que todos tengan que volver a entrar».

Y ahí había una diferencia que no estaba dicha en ningún sitio, y que importa:

- **Desconectar un aparato** (Q-77) le quita también la llave del proyecto. Para
  volver hace falta **el enlace de conexión**. Es el botón de «fuera».
- **Cerrar las sesiones** solo tira los pases. Todos vuelven tecleando su clave,
  y **no hay que repartir ningún enlace nuevo**. Es el botón de «otra vez».

Lo que pedía Víctor era lo segundo, y no existía.

### Por qué hace falta tenerlo

Es el botón de después de un susto: una llave filtrada, un aparato perdido,
alguien que ya no trabaja aquí. Sin él, la única manera de echar a todo el mundo
era desconectar aparato por aparato y volver a repartir el enlace a cada uno.

Y hoy hace falta de verdad: la llave del proyecto se publicó sin querer el 8 de
agosto (§54). Con `exigir_sesion` apagado, esa llave sola basta para escribir en
el expediente. **Encenderlo y cerrar las sesiones tapa casi todo ese riesgo sin
tocar la llave** — que es más barato y menos molesto que cambiarla.

### Quién puede

El secreto de administración, no la llave del proyecto. Una sesión de QC
tampoco vale: probado que devuelve 403 y que no se echa a nadie. Echar a todo el
mundo es cosa de Víctor, igual que dar de alta cuentas.

### Comprobado

`pruebas/echar-a-todos.mjs` —contra el servidor de verdad, sobre una carpeta de
usar y tirar— y cuatro casos más en `servidores-iguales.mjs`, que ahora son 44
con una sola divergencia, la de diseño.

Lo que se probó: que los dos pases mueren, que el que echa lo cuenta, que se
puede volver a entrar con la clave y sin enlace nuevo, que sin el secreto de
administración da 403 y no echa a nadie, y que con `exigir_sesion` encendido la
llave sola ya no escribe.

## 59 · La llave quemada, cambiada — y la pantalla de conectar, que estaba rota

**Q-86 — 9 de agosto de 2026**

La llave del proyecto quedó a la vista de internet el 8 de agosto (§54). Víctor
decidió aquel día no cambiarla todavía, para no dejar fuera a Rubén y al técnico
la noche antes del vaciado: «cuando terminemos pruebas la cambiamos». Ese
momento llegó, y se cambió.

    npx wrangler secret put QC_TOKEN

**Comprobado contra producción**, que es lo único que cuenta: contra
`/api/cambios`, la llave vieja da `401 {"error":"token"}` y la nueva pasa la
puerta y contesta `401 {"error":"sesion"}` — que es lo correcto con
`exigir_sesion` encendido. `/api/salud` **no sirve para probar una llave**:
contesta a cualquiera a propósito, para que un aparato sepa si el servidor pide
sesión antes de enseñar la pantalla de acceso.

### Y aquí salió lo de verdad importante

Al ir a probar el enlace nuevo, `conectar.html` llamaba **mala a la llave
buena** y se negaba a guardarla. O sea: **desde que se encendió `exigir_sesion`,
ningún aparato podía conectarse.** No se había notado porque nadie necesitaba
enlace nuevo (§58) — el fallo estaba dormido esperando justo a este día.

La pantalla comprueba la llave pidiendo algo protegido y miraba solo el número:

    if (r2.status === 401) → «La llave no es la de este proyecto»

Pero un 401 tiene dos motivos distintos, y el cuerpo los separa —igual en los
dos servidores:

- `{"error":"token"}` → la llave no pasó la puerta. Es llave mala.
- `{"error":"sesion"}` → la llave **sí** pasó, y el servidor solo quiere que
  alguien entre con su clave. Que es exactamente lo siguiente que pasa.

Ahora se mira el cuerpo, no el número.

### Lo que hay que llevarse de aquí

- **Un código de estado no es un diagnóstico.** El mismo 401 quería decir «vete»
  y «casi, ahora identifícate». Juntarlos costó tener la puerta cerrada por
  fuera sin saberlo.
- **Encender una bandera rompe cosas lejos de donde se enciende.** `exigir_sesion`
  se tocó en el servidor y quien se rompió fue una pantalla que nadie miró.
- **Lo dormido se despierta en el peor momento.** Este fallo llevaba un día
  puesto y eligió aparecer el día que había que repartir enlaces nuevos.

### Comprobado

En pantalla, contra el servidor de producción y con el enlace de verdad:

- Con la llave nueva → «Servidor al habla · 884 cambios guardados», guarda la
  llave y el servidor, y pasa a `index.html`.
- Con la llave vieja, la quemada → «La llave no es la de este proyecto», y **no**
  guarda nada. El aviso que tiene que saltar, sigue saltando.

### Lo que queda

El **secreto de administración** (`QC_ADMIN`) y **las claves de los usuarios**
también quedaron a la vista el 8 de agosto, y siguen sin cambiar. `QC_ADMIN` no
deja fuera a nadie al cambiarlo —solo lo usa Víctor con `node cuentas.js`—, así
que es el más barato de los tres.
