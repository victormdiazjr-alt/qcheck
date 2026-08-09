# ARCHITECTURE — QCheck

Control de calidad de hormigón en obra. Sustituye el Excel donde hoy se transcriben
a mano los ensayos de campo del proyecto PR-52.

---

## 1. La forma del sistema

> **Corregido el 9 de agosto de 2026.** Este documento decía «no hay servidor» y «once
> páginas HTML». Las dos cosas dejaron de ser verdad: desde el 5 de agosto hay **dos
> servidores gemelos** y hoy son **diecinueve pantallas**. Se corrige aquí porque un
> documento de arquitectura que miente hace más daño que uno que no existe.

**Sigue sin haber compilación y sin una sola dependencia.** Diecinueve páginas HTML
planas que cargan JavaScript plano y comparten un único objeto en `localStorage`. Y
detrás, un registro sincronizado que puede vivir en la laptop de la obra o en internet.

```
┌───────────────────────────────────────────────────────────────────┐
│  NAVEGADOR — donde de verdad trabaja la obra                      │
│                                                                   │
│   index.html ──▶ usuarios.js ──▶ auth.js  (papel y guardián)      │
│                                                                   │
│   pantalla.html                                                   │
│      ├── shared/conduce-contract.js   interoperar con e-Ticket    │
│      ├── assets/seed.js               397 ensayos reales          │
│      ├── assets/core.js               EL MOTOR                    │
│      ├── assets/sp934.js              la aritmética de la 934     │
│      ├── assets/sync.js               habla con el servidor       │
│      ├── assets/qr-lector.js          + qr-aislado.js (jsQR)      │
│      ├── assets/demo.js               siembra el tiro de hoy      │
│      ├── assets/clima.js              NWS + Open-Meteo            │
│      └── (script propio de la pantalla)                           │
│                     │                                             │
│                     ▼                                             │
│         localStorage["qc-pr52-db-v1"]  ◀── fuente de verdad LOCAL │
│                     │                                             │
│         evento `storage` ──▶ las demás pestañas se repintan       │
└──────────────────────────┬────────────────────────────────────────┘
                           │  /api  ·  llave de proyecto + pase de sesión
                           ▼
┌───────────────────────────────────────────────────────────────────┐
│  DOS SERVIDORES GEMELOS — el mismo trato, contestan idéntico      │
│                                                                   │
│   sync-servidor.js   Node, en la laptop de la obra, sin internet  │
│   sync-worker.js     Cloudflare Worker + D1, para el resto        │
│                                                                   │
│   COMPARTEN EL TEXTO, NO LAS FUNCIONES. Copiar una línea de uno   │
│   al otro rompió producción el 8 ago 2026 y `node --check` no lo  │
│   cazó. Después de tocar cualquiera de los dos:                   │
│        node pruebas/servidores-iguales.mjs                        │
└───────────────────────────────────────────────────────────────────┘
```

**Por qué así.** El cliente es una cuadrilla en carretera. Cualquiera abre una dirección
y trabaja. Sin instalación, sin cuentas de nube, sin que un despliegue roto deje el
vaciado a ciegas. **Que la pantalla siga funcionando cuando se cae la red no es una
carencia: es la razón de que esto sirva en obra**, y es lo que hay que defender en
cualquier evolución futura.

El registro del servidor (Q-02) **ya existe**: es de solo añadir, nada se edita ni se
borra, y es lo que convierte esto en un expediente y no en una base de datos más.

---

## 2. Las capas

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Datos | `assets/seed.js` | 397 ensayos reales, ingeniería inversa del Excel de Rubén. **Es dato, no código.** |
| Motor | `assets/core.js` | Almacenamiento, zonas SPC, cálculos derivados, gráficas SVG, formularios, barra de estado, tema, sincronía entre pestañas. |
| Papeles | `assets/usuarios.js` | Quién entra y qué ve. Una sola lista. |
| Guardián | `assets/auth.js` | Corre en toda pantalla; redirige según el papel. |
| Interop | `shared/conduce-contract.js` | Contrato con Concre-Ticket. **Copia idéntica en los dos repos.** |
| Clima | `assets/clima.js` | Lo único que sale a internet. |
| Demo | `assets/demo.js` | Siembra un tiro en marcha si hoy está vacío. |
| Pantalla | el `<script>` de cada `.html` | Solo pintar. La lógica compartida vive en `core.js`. |

**Regla:** si una función la usan dos pantallas, va en `core.js`. Nunca se duplica.

---

## 3. Modelo de datos

Un objeto en `localStorage["qc-pr52-db-v1"]`:

```js
{
  version: 2,
  project: {
    name, contractor, qcFirm, mixId, notifyEmails,
    lat, lon, place,                    // para el clima
    logos: { contratista, concretera, autoridad }
  },
  plan: {                               // los límites SPC — la ley del proyecto
    slump: { target, actLo, actHi, suspLo, suspHi },
    air:   { target, actLo, actHi, suspLo, suspHi },
    uw:    { target, act, susp },       // ± sobre el objetivo de planta
    tempMax, maWindow, maxElapsedMin,
    cs:    { target, age, action, openTarget, openLow }
  },
  tests: [ … ],                         // un registro por conduce
  dayMeta: { "YYYY-MM-DD": { … } },     // el plan de cada día
  humidity: [ … ],                      // humedades de agregado de la planta
  demo: "YYYY-MM-DD" | false
}
```

### `tests[]` — el registro del conduce

| Campo | Qué es |
|---|---|
| `n` | correlativo interno |
| `date` | `YYYY-MM-DD` |
| `ticket`, `company` | **la llave: compañía + conduce.** Dos plantas nunca chocan |
| `truck`, `vol`, `plant` | camión, yardas, planta de origen |
| `batch`, `arrive`, `start`, `end`, `testTime` | `HH:MM`, el recorrido del camión |
| `lot`, `ident` | lote y losas servidas (`"Phase 10 - Slab L3-0.443"`) |
| `slump`, `air`, `uw`, `temp` | ensayos en fresco |
| `cs1`, `cs5`, `cs28` | resistencias a compresión, psi |
| `uwTarget` | objetivo de Unit Weight de esa planta ese día |
| `rejected` | rechazado en campo |
| `source` | `excel · qr · ocr · manual · demo` |

### `dayMeta[fecha]` — el plan del día

`horaInicio`, `cyPlan`, `losasPlan`, `losas` (`"L3-0.443:24, L3-0.437:18"` — las
yardas por losa son opcionales), `fase`, `lane`, `km`, `cierre`, `notas`.

**Sin esto el tablero no puede enseñar avance, y no se lo inventa: deja el hueco.**

---

## 4. Las zonas SPC

El corazón del sistema. `worstZone(t)` devuelve la peor de todas las lecturas:

```
null  ── dentro de límites
"act"  ── zona de acción      → ámbar, se vigila
"susp" ── zona de suspensión  → rojo, no descarga
```

Los límites salen de `db.plan`, nunca del código. Reproducen exactamente las cartas
de Rubén; la Moving Average de 6 sets se validó contra su Excel y coincide al dígito.

---

## 5. Lo derivado, no lo guardado

Nada de esto se almacena: se calcula de los camiones en cada repintado. Por eso no
hay interruptores que alguien tenga que acordarse de mover.

| Función | Qué deduce |
|---|---|
| `estadoTiro(day)` | Vaciando · Camión esperando · Esperando camión · Detenido · Completado · Sin comenzar |
| `ritmoTiro(day)` | CY/h y a qué hora acabaría a ese paso |
| `dayProgress(day)` | colocado vs. recibido, losas, camiones esperando, cumplimiento |
| `losasDelDia(day)` | cada losa con su avance |
| `trendAlerts(day)` | mezcla secándose, racha en zona de acción, humedad vencida |

**Dos sutilezas que costaron encontrar:**

- **Colocado ≠ recibido.** Un camión que llegó y no ha terminado de descargar todavía
  no colocó nada: va en `enCurso`. Solo aplica al día en curso — 95 de los 397
  registros históricos vienen del Excel sin hora de fin.
- **«Detenido» no usa un umbral inventado.** Compara el tiempo sin novedad con el
  ritmo del propio día (el doble de la mediana entre camiones).

---

## 6. Las diecinueve pantallas

| Pantalla | Aparato | Para quién |
|---|---|---|
| `index.html` | cualquiera | acceso |
| `movil.html` | iPhone | portal: cuatro puertas, o cinco si es QC |
| `control-center.html` | PC | Rubén — la casa |
| `results.html` | PC | datos completos y Control Charts |
| `conduce.html` | iPad · Check Point | recepción de camiones |
| `muestras.html` | iPad | entrada de resultados |
| `display.html` | pantalla / TV | el veredicto para el chofer |
| `contratista.html` | cualquiera | avance del tiro |
| `produccion.html` | cualquiera | rendimiento del concretero |
| `autoridad.html` | cualquiera | cumplimiento ACT / FHWA |
| `reporte.html` | PC | el entregable imprimible: del vaciado del día (`?dia=`) y acumulado del proyecto |
| `conectar.html` | cualquiera | conectar el aparato al servidor, una vez (§16) |
| `estado.html` | PC | qué aparatos están conectados y qué hace cada quien — solo `config` |
| `settings.html` | PC | los límites del plan de control — solo `limites`. Es la de Rubén (Q-37) |
| `lotes.html` | PC | los lotes y sub-lotes de la SP-934 |
| `aceptacion.html` | PC | la aceptación según la SP-934 |
| `934.html` | PC | el portal de la SP-934 |
| `sim934.html` | PC | simulación de la 934 — herramienta, no producto |
| `demo934.html` | PC | demostración de la 934 — herramienta, no producto |

**Los tres tableros se abren solos para quien tiene `casa`.** El contratista, el
concretero y la Autoridad entran directos al suyo, sin navegación y sin poder salirse
(Q-37), y desde el 6 ago 2026 los tres imprimen un reporte escrito del día (Q-38).

**Las dos pantallas de producción no son duplicado.** Existe una `produccion.html` en
cada repositorio: la de QCheck enseña lo que Segarra midió (aplica surta quien surta),
la de Concre-Ticket enseña lo interno de la planta. No unificar.

---

## 7. Lo que sale a internet

> **Corregido el 9 de agosto de 2026.** Aquí decía «solo el clima» y ya no es cierto.

Cuatro cosas, y conviene tenerlas contadas porque cada salida a internet es una
puerta:

1. **El registro sincronizado** — `/api` contra el Worker, con llave de proyecto y pase
   de sesión. Es la principal, y también funciona contra la laptop de la obra.
2. **El lector de conduces** — el servidor manda la foto a la API de Claude y devuelve
   la ficha. La llave vive en el servidor (`QC_ANTHROPIC`); **el navegador nunca la ve**.
3. **La ficha de un conduce de QTicket** — al leer un QR, y **solo** si el dominio está
   en la lista blanca del proyecto (`project.qticketHosts`), que está vacía de fábrica.
   Va sin ninguna credencial nuestra: ese servidor es de la concretera.
4. **El clima**, que era lo único que había antes.

### El clima, en detalle

- **Fuente principal: NWS, oficina de San Juan** (`api.weather.gov`) — la oficial para
  Puerto Rico, con un meteorólogo ajustando la rejilla. Su texto viene en inglés y
  **no se muestra tal cual**: se traduce a una condición propia.
- **Open-Meteo** para el nowcast de 15 minutos (el NWS no lo publica) y como respaldo
  entero si el NWS no contesta.
- Sin red, la tarjeta lo dice. **No inventa.**

---

## 8. Reglas que sostienen todo

1. **No se inventan datos.** Si algo no existe, se enseña que no existe.
2. **El color entra por el resplandor, no por el relleno.**
3. **La barra de estado es una franja fija arriba; el resto del GUI empieza debajo.**
4. **Español de Puerto Rico**, salvo los términos que nacieron en inglés: Slump,
   Unit Weight, Moving Average, Control Charts, Batch, Ticket, Set, PSI, CY.
5. **`node sello.js` antes de cada commit que toque `assets/` o `shared/`.**
6. **`node verificar.js` antes de dar nada por bueno.**

Detalle operativo en [`AGENTS.md`](AGENTS.md) — es obligatorio para cualquier agente.
