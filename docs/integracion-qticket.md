# Contrato de integración QCheck ↔ QTicket

**Este documento es el contrato entre dos productos que se construyen por
separado.** QTicket se está escribiendo en otro repo y en otra sesión. Si cada
lado inventa su mitad, se acaban teniendo dos mitades de un puente que no se
encuentran en el medio.

Ninguno de los dos cambia este contrato por su cuenta. Si hace falta cambiarlo,
se cambia aquí primero y se avisa al otro lado.

Nace de la presentación de FHWA del 29 de abril de 2026 (ver
`docs/e-ticketing-PRHTA.md`), que parte el conduce digital en etapas:
**QTicket es la etapa 1 —la planta— y QCheck es la etapa 3 —la verificación en
campo—.**

---

## 1 · Quién es dueño de qué

Esta es la regla que gobierna todo lo demás:

> **QTicket es dueño del conduce. QCheck es dueño de lo que pasa en la obra.**

Un dato que viene de la planta **no se edita en QCheck**. Ni el técnico, ni
Rubén, ni el administrador. Si el peso o el ticket están mal, se corrige en el
origen y vuelve a llegar — porque el conduce es una certificación firmada por
el operador de planta, y un expediente donde el destinatario puede reescribir
lo que le certificaron no vale nada.

| Lo pone QTicket (planta) | Lo pone QCheck (obra) |
|---|---|
| Número de conduce, camión, transportista | Llegada a obra |
| Suministrador, ubicación, mix design ID | Comienzo y fin de descarga |
| Volumen y pesos | Slump, aire, unit weight, temperatura |
| Weigh Master, carga secuencial | Losa / identificación de colocación |
| Hora de batch y de salida de planta | Cilindros y su custodia |
| Contrato, proyecto, contratista | Aceptación o rechazo, y por qué |

## 2 · La llave con la que se casan

Un conduce y un camión de QCheck son **el mismo hecho** cuando coinciden:

    suministrador (company) + número de conduce (ticket)

Es la llave que QCheck ya usa para detectar conduces repetidos
(`findConduce`). **El número de conduce solo no vale**: dos plantas distintas
pueden emitir el mismo número.

## 3 · Qué manda QTicket → QCheck

Un objeto por camión cargado. Los nombres son los que QCheck ya usa, para que
no haya una capa de traducción que se desincronice:

```json
{
  "origen": "qticket",
  "eticketId": "<id único de QTicket, estable para siempre>",
  "emitido": "2026-08-08T10:12:04Z",

  "ticket":  "67636",
  "truck":   "116",
  "company":  "Concre-Tech",
  "plant":    "01-SAN JUAN",
  "mix":      "AC300503SX",
  "material": "Hormigón 4000 psi",
  "vol":      10,
  "batch":    "06:18",

  "carrier":       "<transportista>",
  "weighMaster":   "<Weigh Master ID>",
  "cargaSecuencial": 14,
  "ordenadas":     150,

  "pesos": {
    "brutoLegal": null, "bruto": null, "tara": null,
    "neto": null, "acumuladoDiario": null
  },
  "volAcumuladoDiario": 137,

  "proyecto": {
    "contratista":   "Del Valle Group, Inc.",
    "contractId":    "...", "numeroProyecto": "...",
    "numeroEstatal": "...", "nombre": "..."
  },

  "pdf": "<url o id del conduce original>"
}
```

**Reglas duras:**

- **Un campo que no se sabe va en `null`, nunca en cero ni en cadena vacía.**
  Un cero es un dato; un hueco es un hueco. QCheck enseña los huecos como
  huecos y eso no se negocia.
- **`eticketId` es para siempre.** Es la única forma de reenviar una
  corrección sin duplicar el camión.
- **Los pesos van a 0.01**, como exige la Autoridad.
- **`material` no es `mix`.** El campo 9 de la Autoridad es la descripción
  —«Hormigón 4000 psi»— y el 10 es el mix design ID —«AC300503SX»—. El segundo
  no le dice nada a quien lee el conduce. Lo señaló la sesión de QTicket
  mapeando los 19 campos uno por uno contra este objeto, y tenía razón: aquí
  faltaban ese y el nombre del contratista.

## 4 · La tensión de los pesos, sin resolver

Los 19 campos de la Autoridad están pensados para **asfalto**, que se vende por
peso. El **ready-mix se vende por volumen** y su conduce no pasa por báscula de
camión: no hay peso bruto ni tara.

**Ninguno de los dos productos se inventa esos números.** Van en `null` hasta
que la Autoridad diga qué espera de un conduce de hormigón. Es la pregunta
número uno de la lista de `docs/e-ticketing-PRHTA.md` §7.

**Pero el campo 19 sí existe en hormigón, en otra unidad.** El total corrido
del día es algo que la planta lleva de verdad — en **yardas cúbicas**, no en
libras. Dejarlo todo en `null` perdería el único acumulado que la planta sabe
llevar. Por eso `pesos.acumuladoDiario` va en `null` y `volAcumuladoDiario`
viaja aparte, con su unidad dicha. Cuál de los dos quiere la Autoridad va en la
pregunta, sin adelantar la respuesta. (Lo propuso la sesión de QTicket.)

## 5 · Qué devuelve QCheck → QTicket

Esto es la etapa 3 del modelo de FHWA: *«the inspector accepts, rejects, or
adds notes instantly»*. El veredicto tiene que volver al origen, o el ciclo no
se cierra.

```json
{
  "eticketId": "...",
  "veredicto": "aceptado" | "rechazado" | "aceptado-con-accion",
  "cuando": "2026-08-08T10:41:22Z",
  "quien":  "<nombre de la sesión, no del aparato>",
  "motivo": "<obligatorio si es rechazado>",
  "campo":  { "slump": 3.25, "uw": 149.8, "air": 2.1, "temp": 88 },
  "hitos":  { "arrive": "10:22", "start": "10:31", "end": "10:47" }
}
```

`aceptado-con-accion` existe porque en QCheck un camión puede entrar estando en
zona de acción: se acepta y se vigila. Colapsarlo a «aceptado» perdería
justamente lo que hace falta saber en la planta para corregir la mezcla.

## 6 · Cuando el contratista no es cliente nuestro

QTicket funciona igual. Simplemente no hay a dónde mandar el conduce ni de
dónde recibir el veredicto. **La integración es una ventaja cuando las dos
partes son clientes, no un requisito para que ninguno funcione.**

Lo mismo al revés: QCheck sigue funcionando con foto del conduce y con entrada
a mano cuando la concretera no tiene QTicket. **Ese camino no se retira nunca**
— es el que usa hoy la PR-52.

## 7 · Cómo distingue QCheck de dónde vino un camión

El campo `source` ya existe y hoy vale `"foto"` o `"manual"`. Se añade
`"qticket"`.

Eso importa para el expediente: un dato certificado por la planta y otro
tecleado por un técnico con el guante puesto **no valen lo mismo**, y quien
lea el récord dentro de dos años tiene derecho a saber cuál es cuál.

## 8 · Decidido el 8 de agosto de 2026

**Transporte: empuja QTicket, y QCheck ofrece lectura como red.**
La presentación de FHWA enseña al inspector viendo la carga *«before the truck
even arrives»*, y eso solo se consigue empujando en el momento del batch —
preguntando cada tanto siempre se llega tarde. QCheck expone además una
consulta por día y proyecto, **idempotente contra `eticketId`**, para recuperar
lo que se perdiera mientras uno de los dos estuvo caído. Empujar como vía
normal, preguntar como red.

**Ruta: directo, y el Portal aparte.** El conduce va de QTicket a QCheck
**directo**, y de QTicket al Electronic Ticketing Portal de la PRHTA como
obligación **separada**, no como escala. Tres razones, y las tres pesan:

  · No se sabe si el Portal ofrece lectura.
  · Colgar la entrega en obra de que un portal del gobierno esté arriba **rompe
    el vaciado** el día que se caiga.
  · El conduce privado y el residencial **no pasan por el Portal**, así que esa
    ruta solo serviría para obra pública.

Un origen, dos destinos.

## 9 · Autenticación entre servidores

Diseñada por la sesión de QTicket el 8 de agosto de 2026 y aceptada aquí, con
dos añadidos de este lado. Se escribe entera para que ninguno de los dos tenga
que reconstruirla de memoria.

### 9.1 · Dos saltos, no uno

**El vigilante de la planta no habla nunca con QCheck.** Habla solo con el
servidor de QTicket, y solo ese servidor habla con el de QCheck.

La razón es la PC de despacho: es una máquina compartida de una empresa que no
es nuestra, con gente entrando y saliendo. **Una credencial que abre la API de
QCheck no puede vivir ahí.** Con dos saltos, el secreto vive en un servidor y
lo que hay en la planta solo puede hablar con QTicket.

Tiene un segundo beneficio que no se buscaba: la firma lleva marca de tiempo, y
el reloj de una PC de despacho puede estar desviado. Entre servidores, con NTP,
eso deja de ser un problema.

### 9.2 · El mecanismo

- **Una credencial por pareja concretera ↔ obra**, emitida por QCheck. **No es
  la llave de proyecto**: esa vive en el navegador, y lo que se filtra en un
  navegador no puede ser lo que autoriza a un servidor.
- **Firma HMAC-SHA256** sobre `timestamp + nonce + cuerpo`. Cabeceras
  `keyId`, `timestamp`, `nonce`, `signature`. Se rechaza lo que llegue con más
  de **5 minutos** de desfase, y se guardan los nonce de esa ventana para que
  un reenvío no cuele dos veces.
- **Firma y no token al portador**, porque un token viaja entero en cada
  petición y acaba en los registros de cualquier proxy del camino: el día que
  alguien lea un log, tiene la llave. Una firma no pone el secreto en el cable
  y además **ata la firma al cuerpo**, así que nadie en el medio puede cambiar
  un peso sin romperla. En un expediente que certifica obra pública eso pesa
  más que la comodidad.
- **Ni OAuth ni mTLS.** OAuth pide un servidor de autorización que ninguno de
  los dos tiene; mTLS, repartir y renovar certificados por cliente. Para un
  puñado de concreteras es más máquina de la que hace falta. Si la Autoridad
  acaba exigiendo una de las dos, se cambia — pero que lo exija alguien.
- **Rotación con dos llaves vivas**, la actual y la anterior. Con una sola,
  rotar obliga a que los dos desplieguen en el mismo minuto, y eso no sale bien
  nunca a la primera.
- **Idempotencia por `eticketId`.** Reenviarlo actualiza, nunca duplica.
  Reintento con espera creciente; lo que se pierda del todo lo recupera la
  lectura por día del §8.

### 9.3 · Autenticar no es autorizar — añadido de QCheck

La firma dice **quién llama**. No dice **sobre qué puede escribir**.

La credencial es por pareja concretera ↔ obra, así que `keyId` identifica la
pareja. **QCheck comprueba además que el conduce pertenece a esa obra**: que el
proyecto del cuerpo case con el de la credencial. Sin esa comprobación, una
credencial legítima de la obra A podría meter camiones en el expediente de la
obra B — con firma válida y todo.

No es un caso rebuscado: es el fallo que aparece solo cuando una concretera
sirve a dos obras nuestras a la vez, que es exactamente lo que queremos que
pase.

**Un conduce cuya obra no case con la credencial se rechaza y se registra.**
No se acepta «por si acaso», y no se descarta en silencio.

### 9.4 · La vuelta también va firmada — añadido de QCheck

El §5 manda el veredicto de QCheck a QTicket. **Esa dirección se firma igual**,
con la credencial de QTicket y el mismo esquema. Un veredicto de aceptación es
tan sensible como el conduce: dice que un camión entró en la obra.

### 9.5 · Los dos servidores de QCheck, otra vez

QCheck tiene dos servidores gemelos que **tienen que contestar igual**:
`sync-servidor.js` (Node) y `sync-worker.js` (Cloudflare). Esto se implementa
en los dos o en ninguno. `pruebas/servidores-iguales.mjs` lo caza, y ha cazado
divergencias antes.

Los dos tienen HMAC-SHA256 disponible —`crypto` en Node, `crypto.subtle` en el
Worker—. En Cloudflare los nonce viven en D1 y hay que barrer los caducados;
una tabla de nonce que solo crece es una fuga lenta.

### 9.6 · Lo que decide Víctor, no nosotros

**Cómo se le entrega la credencial a una concretera la primera vez.** Quién se
la da a quién y con qué prueba de que la concretera es quien dice ser, es un
procedimiento de negocio.

Y una advertencia ganada a golpes: el 8 de agosto de 2026 se perdió una llave
de API por copiarle un comando encima del portapapeles. **Una credencial no se
manda por el mismo canal que las instrucciones para usarla**, y quien la reciba
tiene que poder verla una sola vez sin que nadie se la pise.

## 10 · Lo que sigue sin decidir

Nada bloqueante. Cuando aparezca algo, va aquí.
