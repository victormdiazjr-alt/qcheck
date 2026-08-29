# Pruebas que hay que correr a mano

`verificar.js` mira el código sin ejecutarlo. Esto lo complementa: **levanta los dos
servidores y les habla**, que es la única forma de saber si se comportan igual. Nacieron
de la auditoría del 6 ago 2026 (ver `DECISIONS.md` §19 y §20).

Node puro, sin una sola dependencia, como todo lo demás.

## Preparar los dos servidores

```
QC_TOKEN=llave-de-prueba QC_ADMIN=admin-de-prueba node serve.js 8461 &
npx wrangler d1 execute qcheck --local --file sync-esquema.sql
npx wrangler dev --local --port 8462 --var QC_TOKEN:llave-de-prueba --var QC_ADMIN:admin-de-prueba &
```

**Con `--local`.** Nunca contra producción: estas pruebas escriben.

**Los dos tienen que tener `exigir_sesion` igual.** Si no, el Worker contesta 401 en
media batería y el servidor local 200, y salen divergencias que no son de código sino
de estado — pasó el 8 ago 2026 y costó un rato. Se mira con `/api/salud`, que lo dice
en `sesiones`, y se iguala así:

```
npx wrangler d1 execute DB --local -c wrangler.toml --command "UPDATE ajustes SET valor='0' WHERE clave='exigir_sesion'"
```

## Correrlas

```
node pruebas/servidores-iguales.mjs    # 44 casos a los dos, comparando respuesta
node pruebas/candado-de-sesion.mjs     # exigir_sesion de punta a punta
node pruebas/desconectar-aparato.mjs   # Q-77, y este no necesita nada levantado
node pruebas/echar-a-todos.mjs         # Q-85, tampoco necesita nada levantado
```

Lo que se espera: `servidores-iguales` saca **una sola divergencia y es de diseño**
(fuera de `/api/` el servidor local sirve archivos y el Worker no). Cualquier otra hay
que mirarla. `candado-de-sesion`, `desconectar-aparato` y `echar-a-todos` salen enteros en verde.

Si el 8461 ya está ocupado por un servidor de verdad, se levanta el de prueba en otro
puerto y se le dice a la batería por dónde entrar — es mejor que tumbar el que alguien
puede estar usando:

```
QC_A=http://127.0.0.1:8463 node pruebas/servidores-iguales.mjs
```

**`servidores-iguales` escribe en `datos/`** —crea la cuenta `prueba` y mete líneas en el
registro de cambios—, así que conviene copiar `datos/usuarios.json` y `datos/cambios.jsonl`
antes y devolverlos después. `desconectar-aparato` no: se monta su propia carpeta.

## Cuándo

Antes de tocar `sync-servidor.js` o `sync-worker.js`, y después. Un cambio en uno solo
casi siempre significa que falta el gemelo.

## La aritmética de la SP-934

```
node pruebas/sp934.mjs
```

No necesita servidores: es matemática pura. Comprueba el cálculo de PWL contra
la **Tabla 934-6**, que la propia especificación publica «only to assist in the
preliminary by hand verification purposes» — la Autoridad da la respuesta, así
que si no la reproducimos el error es nuestro. Treinta y dos puntos de la tabla,
más los factores de pago, el rechazo y el reparto en lotes y sub-lotes.

**Se corre siempre que se toque `assets/sp934.js`.** Ese archivo decide cuánto
se cobra: un error ahí no se ve como un error, se ve como un número plausible.


## El ensayo general — la víspera de un tiro

```
QC_ENSAYO=1 node pruebas/el-ensayo-general.mjs
```

Todo lo demás mira el código o habla con los servidores. Esto abre **dos
navegadores de verdad sobre las pantallas de verdad** —uno hace de iPad del
técnico, el otro de Field Display colgado en la obra— y hace el día entero en
orden: sin tiro, programarlo, recibir el camión, medirlo, leer el veredicto,
verlo aparecer en la pantalla de obra, cerrar y sacar el informe. Levanta su
propio servidor con un registro nuevo y lo borra al terminar.

Tarda unos tres minutos y necesita Chrome, así que `todas.sh` lo salta salvo que
se pida con `QC_ENSAYO=1`. **Es la prueba que hay que correr la víspera de un
tiro**, y la que hay que creer cuando alguien pregunta si está todo bien.

Nació el 29 de agosto de 2026, después de que Víctor se fuera de la obra sin
haber podido entrar un solo camión. La primera vez que corrió de verdad encontró
tres cosas que llevaban horas escondidas:

- **Q-144** — la fila de «recibir camión» se veía sin ningún tiro abierto.
  `pintarFilaRecibir()` la escondía bien con `hidden`, y `.recibir{display:flex}`
  la volvía a encender. El guardián estaba escrito y no hacía nada.
- **Q-145** — con el tiro cerrado, `recibirCamion()` seguía metiendo el camión
  dentro del día firmado sin decir que lo estaba reabriendo.
- **Q-146** — `migrarPlanes()` congelaba los valores de fábrica como historial
  de límites, porque corre al cargar la página y en un aparato recién estrenado
  eso pasa antes de que bajen los límites de la obra. Los límites llegaban bien
  y cada camión se juzgaba igualmente contra el 95 de fábrica.

> Y dos lecciones sobre las pruebas mismas, que costaron dos vueltas: **una
> prueba que no controla su punto de partida no encuentra fallos, los inventa**
> —la primera versión dio ocho y siete eran míos—, y **hay que preguntar lo que
> se quiere saber**: `tiroActivo()` contesta «qué día estoy mirando» y
> `hayTiroActivo()` contesta «¿hay alguno abierto?». Confundirlas me hizo dar
> por roto código que estaba bien.
