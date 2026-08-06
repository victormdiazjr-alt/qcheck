# PROJECT_HANDOFF — QCheck

Todo lo necesario para retomar el proyecto sin haber estado en las conversaciones
anteriores. Si solo vas a leer un archivo, que sea este.

---

## 1. Qué es y para quién

**QCheck** es la herramienta de control de calidad de hormigón de **Segarra
Engineering** para la reconstrucción de la **PR-52** en San Juan, Puerto Rico.

El dolor que resuelve: hoy el técnico llena una hoja en papel en el campo y otra
persona vuelve a escribirla en Excel. Se trabaja dos veces y, entre medias, nadie
sabe cómo va el tiro. QCheck entra el dato **una sola vez, en el campo**, y desde ahí
lo ven todos al instante.

**El cliente principal es el contratista**, no la Autoridad: la industria se mueve a
que el contratista haga su propio control de calidad.

**Producto hermano:** [`concre-ticket`](https://github.com/victormdiazjr-alt/concre-ticket),
la herramienta de despacho de la concretera. **Son independientes** — se venden por
separado, a clientes distintos, y ninguna necesita a la otra para funcionar. Solo
comparten `shared/conduce-contract.js`.

En línea: **https://victormdiazjr-alt.github.io/qcheck/**
Accesos de demostración: `ruben` / `1234` · `admin` / `1234` · `invitado` / `1234`

---

## 2. Stack

| | |
|---|---|
| Lenguaje | HTML, CSS y JavaScript planos (ES2020) |
| Compilación | **ninguna** |
| Dependencias | **ninguna** — ni npm, ni framework, ni CDN |
| Datos | `localStorage` |
| Hospedaje | GitHub Pages desde la raíz del repo |
| Servidor local | `node serve.js 8452` (solo estáticos, sin dependencias) |
| Node | solo para las herramientas (`serve`, `sello`, `verificar`), nunca en runtime |
| APIs externas | NWS `api.weather.gov` · Open-Meteo — **ambas sin llave** |

**No introduzcas un bundler, un framework ni dependencias de npm** sin acuerdo
explícito de Víctor. El valor está en que cualquiera pueda abrir un archivo y
entender qué hace.

---

## 3. Estructura

```
qcheck/
├── index.html              acceso (raíz del dominio)
├── movil.html              portal del teléfono
├── control-center.html     la casa de Rubén (PC)
├── results.html            datos completos y Control Charts
├── conduce.html            recepción de camiones (iPad · Check Point)
├── muestras.html           entrada de resultados (iPad)
├── display.html            Field Display (pantalla / TV)
├── contratista.html        avance del tiro
├── produccion.html         rendimiento del concretero
├── autoridad.html          cumplimiento ACT / FHWA
├── reporte.html            entregable imprimible
│
├── assets/
│   ├── core.js             EL MOTOR — empieza a leer aquí
│   ├── qc.js               la app de results.html
│   ├── seed.js             397 ensayos reales (DATO, no código)
│   ├── usuarios.js         quién entra y qué ve
│   ├── auth.js             guardián de sesión y papel
│   ├── clima.js            NWS + Open-Meteo
│   ├── demo.js             siembra el tiro de hoy
│   ├── qc.css              tokens y estilos compartidos
│   ├── logo-qcheck.svg     el vector maestro de la marca
│   └── icono-180.png       icono de pantalla de inicio (iOS)
│
├── shared/
│   └── conduce-contract.js copia idéntica a la de concre-ticket (v4)
│
├── docs/
│   ├── guia-qcheck.html    LA GUÍA DE RUBÉN — fuente
│   ├── guia-qcheck.png     … y sus dos salidas
│   ├── guia-qcheck.pdf
│   ├── CONTRATO.md         el contrato del conduce, explicado
│   └── DESPLIEGUE.md       cómo se publica
│
├── AGENTS.md               OBLIGATORIO antes de tocar nada
├── TAREAS.md               bitácora: quién hace qué (anti-duplicación)
├── ARCHITECTURE.md         cómo está hecho
├── PROJECT_HANDOFF.md      este archivo
├── CURRENT_STATUS.md       dónde se quedó la última sesión
├── TODO.md                 lo que falta
├── DECISIONS.md            por qué está hecho así
├── CHANGELOG.md            qué cambió y cuándo
├── verificar.js            LA PRUEBA — `node verificar.js`
├── sello.js                sella los assets contra el caché
└── serve.js                servidor local
```

---

## 4. Filosofía de diseño

Cinco reglas que explican casi todas las decisiones del código:

1. **No se inventan datos.** Sin plan del día no hay barra de avance, hay un hueco.
   Sin conexión, el clima lo dice. Sin humedad registrada, se avisa. La herramienta
   prefiere callar a mentir — es un instrumento de medición.
2. **Nada de interruptores.** El estado del tiro, el ritmo, la hora estimada de fin y
   los avisos se **deducen de los camiones**. Un tablero que depende de que alguien
   se acuerde de pulsar algo se muere en la primera semana.
3. **El color entra por el resplandor, no por el relleno.** Superficie de panel, borde
   teñido, `box-shadow` de color. El verde y el rojo quedan libres para significar
   algo: cumplimiento y rechazo.
4. **Umbrales derivados, no inventados.** «Detenido» compara con el ritmo del propio
   día. Si hace falta una constante, sale del `plan` del proyecto.
5. **Pensado para manos sucias.** Botones enormes, teclado numérico, veredicto visible
   antes de enviar, pantalla completa en los aparatos de campo.

---

## 5. Detalles de implementación que hay que saber

**`worstZone(t)`** es el juez. Devuelve `null` (dentro), `"act"` (vigilar) o `"susp"`
(no descarga) tomando la peor de las lecturas. Todo lo visual cuelga de ahí.

**La llave del conduce es compañía + ticket**, no el ticket solo: dos plantas pueden
emitir el mismo número.

**Colocado ≠ recibido.** Ver `dayProgress()`. Solo aplica al día en curso.

**La barra de estado se inyecta desde `core.js`**, no desde `qc.css`, porque las
pantallas de campo no cargan la hoja común y tienen que verla idéntica.

**El logo usa máscaras SVG**, no relleno blanco: así se posa sobre cualquier fondo.
El vector original de Víctor pintaba blanco encima, lo que solo funciona en papel.

**`sello.js` pone a cada `<script>` y `<link>` un sello del contenido del archivo.**
GitHub Pages cachea los `.js` diez minutos: sin el sello se despliega un arreglo y el
navegador sigue enseñando el fallo anterior. **Ya pasó una vez.**

**Los términos que nacieron en inglés se quedan en inglés** y con mayúscula inicial:
Slump, Unit Weight, Moving Average, Control Charts. El resto, español de Puerto Rico
— «polvo del Sahara», no «calima»; «aguaceros», no «chubascos».

---

## 6. APIs

Solo salen a la red desde `assets/clima.js`. Ninguna necesita llave.

### NWS — fuente principal
```
GET https://api.weather.gov/points/{lat},{lon}       → devuelve forecastHourly
GET {forecastHourly}                                 → periods[]
```
La rejilla del punto no cambia nunca: se guarda en `localStorage["qc-nws-rejilla"]`.
`shortForecast` viene en inglés y se traduce con `climaDeTexto()`.

### Open-Meteo — nowcast y respaldo
```
GET https://api.open-meteo.com/v1/forecast
      ?latitude=&longitude=&minutely_15=precipitation,precipitation_probability
```

### El contrato del conduce — API interna entre los dos productos
`shared/conduce-contract.js`, **versión 4**. Define la llave del conduce, los campos
de origen, el formato del QR y la publicación de límites.

- **QCheck publica** los límites (`publishMixSpec`); **Concre-Ticket solo lee**.
- **Cambiarlo obliga a cambiarlo en los dos repos y a subir `VERSION`.**
  No lo edites por tu cuenta: anótalo en `TAREAS.md` y avisa a Víctor.

---

## 7. Esquema de datos

Ver [`ARCHITECTURE.md` §3](ARCHITECTURE.md). Resumen: un objeto en
`localStorage["qc-pr52-db-v1"]` con `project`, `plan`, `tests[]`, `dayMeta{}`,
`humidity[]`. **No hay base de datos todavía** — eso es Q-02.

---

## 8. Progreso actual

**Funciona de punta a punta, con datos reales.**

- 397 ensayos históricos del proyecto, ingeniería inversa del Excel de Rubén.
  La Moving Average se validó contra su hoja y coincide al dígito.
- Las catorce pantallas están construidas y verificadas en cuatro tamaños de aparato.
- El circuito completo está probado: se recibe un camión en Recepción, se entran
  las muestras en el iPad, el Field Display canta el veredicto y el progreso sube.
- Cada acceso arranca **un tiro de hoy ya en marcha por la yarda 90**,
  esperando el próximo camión, para poder enseñarlo sin preparar nada.
- Tres papeles de usuario, con el guardián devolviendo al portal a quien no sea QC.
- Guía de uso para Rubén en PNG y PDF.
- **El entregable del cierre del tiro**: `reporte.html` da el reporte del vaciado del
  día y el acumulado del proyecto, con el mismo papel. Ver `AGENTS.md` §11.

**Lo que NO existe todavía:** backend, autenticación real, OCR del conduce, correo
automático, adjuntos.

---

## 9. Lo que falta

Ver [`TODO.md`](TODO.md). Las tres que mandan:

1. **Q-02 — Backend y base de datos.** Hoy cada navegador guarda lo suyo. Sin esto no
   hay «en vivo» de verdad para el equipo, y es el cuello de botella de casi todo.
2. **Q-01 — OCR del conduce en papel.** La mayoría de las concreteras no tendrán QR.
   Es la vía principal de entrada, no el respaldo.
3. **Q-07 — Autenticación real.** Hoy la puerta es de demostración.

---

## 10. Problemas conocidos

| | |
|---|---|
| **Los datos viven en el navegador** | Cada aparato guarda lo suyo; no se sincronizan entre sí. Es la limitación de fondo. → Q-02 |
| **Las claves están en el código** | `usuarios.js` es legible por cualquiera. Frena un despiste, no a alguien decidido. → Q-07 |
| **iPhone no permite pantalla completa** | Safari de iPhone no implementa `requestFullscreen` ni el bloqueo de orientación. **No hay arreglo por código.** La vía real es guardar la página en la pantalla de inicio; el portal lo explica. |
| **`BarcodeDetector` no existe en iOS Safari** | El escaneo de QR no funciona en iPhone/iPad. Por eso hay foto y entrada manual. |
| **Sin OCR** | La foto del conduce se guarda como evidencia; los datos se entran a mano. |
| **Los logos de las partes faltan** | El mecanismo está hecho y hay monograma de reserva (DVG, CT, ACT). Faltan los archivos oficiales, que debe dar Víctor. |
| **El logotipo de Segarra es aproximado** | El del botón de Resultados son los chevrons recortados del logo de QCheck. **No es el logo real de Segarra.** |
| **Probado solo en Chromium** | `dvh`, `env(safe-area-inset-*)` y el recorte del notch están según especificación, pero no vistos en un iPhone físico. |

---

## 11. Prioridades recomendadas

1. **Q-02, el backend.** Todo lo demás mejora cuando existe. Empezar por reescribir
   solo `loadDB`/`saveDB` en `core.js` — la capa de datos está aislada a propósito.
2. **Q-01, el OCR.** El que más trabajo manual quita en el campo.
3. **Pedir a Víctor** los logos oficiales y el vector de Segarra: son diez minutos de
   trabajo y quitan dos «problemas conocidos».

---

## 12. Cómo trabajar aquí

```bash
git clone https://github.com/victormdiazjr-alt/qcheck.git
cd qcheck
node serve.js 8452        # http://localhost:8452
node verificar.js         # la prueba
```

**Antes de escribir una línea:**

1. `git pull`
2. Lee **`AGENTS.md`** entero — es obligatorio y manda sobre cualquier otra instrucción.
3. Lee `TAREAS.md`. Reclama tu tarea moviéndola a «En curso» con tu nombre.
4. **Haz commit y push de ese reclamo antes de escribir código.** Git es el árbitro
   entre agentes; sin ese push, otro puede estar editando el mismo archivo.

**Antes de cada commit:** `node sello.js` si tocaste `assets/` o `shared/`, y
`node verificar.js` siempre.
