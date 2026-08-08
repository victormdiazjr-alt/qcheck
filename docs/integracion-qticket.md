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

## 9 · Lo que sigue sin decidir

**Autenticación entre servidores.** La llave de proyecto de QCheck es por obra
y va en el navegador; para máquina a máquina hace falta otra cosa.

> **Aviso a quien lo mire: `sello.js` NO sirve para esto.** Es el sellador de
> versiones — calcula el hash del contenido de cada asset y lo pega al `?v=`
> para romper la caché del navegador. No firma nada ni autentica a nadie. Si
> se construye autenticación creyendo que ahí hay algo, se pierde el tiempo.
