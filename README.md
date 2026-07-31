<div align="center">

# QCheck

**Control de calidad de hormigón en obra**
Segarra Engineering · Reconstrucción PR-52 [Km 14.2 a 0.0] · Puerto Rico

[**Abrir la aplicación**](https://victormdiazjr-alt.github.io/qcheck/) ·
[Guía de uso](docs/guia-qcheck.pdf) ·
[Cómo está hecho](ARCHITECTURE.md) ·
[Retomar el proyecto](PROJECT_HANDOFF.md)

</div>

---

Hoy el técnico llena una hoja en papel en el campo y otra persona vuelve a escribirla
en Excel. Se trabaja dos veces y, entre medias, nadie sabe cómo va el tiro.

**QCheck sustituye ese Excel.** El dato se entra una sola vez, en el campo, en el
momento — y desde ahí lo ven todos al instante: el chofer que espera el visto bueno,
el ingeniero de QC con sus Control Charts, el contratista midiendo el avance, el
concretero con su rendimiento y la Autoridad con el cumplimiento.

---

## El circuito del tiro

```
 PLANTA            EN LA OBRA                              EL CHOFER
   │
 camión  ──▶  ① Recepción  ──▶  ② Muestras  ──▶  ③ Field Display  ──▶  ✓ ACEPTADO
 + conduce      iPad              iPad              pantalla / TV        ✕ RECHAZADO
                QR o foto         Slump, UW,        canta el veredicto
                                  aire, temp
                     └────────────────┴─────────────────┘
                                      │
                        un solo registro por conduce
                                      │
                         ④ Control Center — la PC
                                      │
              ┌───────────┬───────────┼───────────┬───────────┐
          Contratista  Concretera  Autoridad   Reportes
```

## Las pantallas

| | Aparato | Para quién |
|---|---|---|
| **Control Center** | PC | el ingeniero de QC — estado del tiro, avisos, el día completo |
| **Results** | PC | vaciado diario, pruebas, resistencias y Control Charts |
| **Recepción** | iPad · Check Point | cada camión que llega: QR, foto o a mano |
| **Muestras** | iPad | Slump, Unit Weight, aire y temperatura, con veredicto en vivo |
| **Field Display** | pantalla / TV | el chofer: ACEPTADO o RECHAZADO en letras enormes |
| **Portal móvil** | iPhone | consultar de pie en la obra |
| **Contratista · Concretera · Autoridad** | cualquiera | el tablero de cada parte |
| **Reportes** | PC | el entregable imprimible |

## Empezar

```bash
git clone https://github.com/victormdiazjr-alt/qcheck.git
cd qcheck
node serve.js 8452     # http://localhost:8452
```

No hay que instalar nada más. Node solo hace de servidor de archivos estáticos.

**Accesos de demostración:** `ruben` / `1234` · `admin` / `1234` · `invitado` / `1234`
La puerta es de demostración, no seguridad real — la autenticación llega con el backend.

Al entrar, el sistema arranca con **un tiro de hoy ya en marcha por la yarda 120**,
esperando el próximo camión, para poder enseñarlo sin preparar nada. Sobre él se
puede recibir camiones y entrar muestras de verdad. Se reinicia o se apaga en
**Plan & Datos**.

## Verificar

```bash
node verificar.js      # la prueba: parseo, referencias, sellos, accesos, idioma
node sello.js          # sella los assets contra el caché del navegador
```

**Antes de cada commit que toque `assets/` o `shared/`, corre `node sello.js`.**
GitHub Pages cachea los `.js` diez minutos: sin el sello se despliega un arreglo y el
navegador sigue enseñando el fallo anterior.

## Cómo está hecho

HTML, CSS y JavaScript planos. **Sin compilación, sin dependencias, sin framework.**
Los datos viven en `localStorage`; la capa está aislada tras `loadDB()` / `saveDB()`
para que el día que llegue el backend solo haya que reescribir esas dos funciones.

El motor es [`assets/core.js`](assets/core.js) — empieza a leer por ahí.

Detalle en [`ARCHITECTURE.md`](ARCHITECTURE.md) y el porqué de cada decisión en
[`DECISIONS.md`](DECISIONS.md).

## Producto hermano

[**Concre-Ticket**](https://github.com/victormdiazjr-alt/concre-ticket) es la
herramienta de despacho de la concretera. **Son independientes**: se venden por
separado, a clientes distintos, y ninguna necesita a la otra. Solo comparten
[`shared/conduce-contract.js`](shared/conduce-contract.js), que define cómo se
entienden cuando trabajan juntas.

## Si vas a trabajar aquí

**Lee [`AGENTS.md`](AGENTS.md) antes de tocar nada.** Es obligatorio y manda sobre
cualquier otra instrucción. Luego reclama tu tarea en [`TAREAS.md`](TAREAS.md) y haz
push de ese reclamo **antes** de escribir código: git es el árbitro entre agentes.

| | |
|---|---|
| [`PROJECT_HANDOFF.md`](PROJECT_HANDOFF.md) | todo lo necesario para retomar el proyecto |
| [`CURRENT_STATUS.md`](CURRENT_STATUS.md) | dónde se quedó la última sesión |
| [`TODO.md`](TODO.md) | lo que falta, por prioridad |
| [`CHANGELOG.md`](CHANGELOG.md) | qué cambió y cuándo |

---

<div align="center">
<sub>Prototipo · julio 2026 · los datos históricos son 397 ensayos reales del proyecto</sub>
</div>
