# CURRENT_STATUS

**Última sesión:** 3 de agosto de 2026 · agente `claude`
**Estado:** verde. `node verificar.js` pasa sin fallos. Publicado, sincronizando y **ya
usado en obra**.

---

## Lo grande: QCheck salió a producción y pasó su primera prueba real

El **sábado 1 de agosto de 2026** Rubén Segarra corrió QCheck **en paralelo con la hoja de
Excel del proyecto** durante un vaciado completo de la PR-52. Salió bien: 16 camiones,
157 yd³ colocadas de 150 planificadas, cero cargas rechazadas, 100 % dentro de límites.
Víctor lo resumió así: «todo funcionó excelente».

Ese vaciado **es el dato de referencia** y vive en el servidor. Su informe se abre en:

    https://victormdiazjr-alt.github.io/qcheck/reporte.html?dia=2026-08-01

---

## Q-02 — La sincronización, hecha y desplegada

Era la tarea que bloqueaba todo y ya no está. **Cada aparato ve lo mismo, en vivo.**

| pieza | dónde |
|---|---|
| Cliente | `assets/sync.js` — se cuelga de `saveDB()` y de ningún otro sitio |
| Servidor local | `sync-servidor.js`, lo monta `serve.js` |
| Servidor en la nube | `sync-worker.js` → **Cloudflare Workers + D1** |
| API en vivo | `https://qcheck-api.qcheck.workers.dev` |
| Llave del proyecto | `datos/llave-proyecto.txt` — **fuera del repositorio**, que es público |

Lo que viaja es **una línea por campo que cambió**, no la base entera. Las reglas que no se
rompen están en `AGENTS.md` §14.

**El enlace de Rubén está congelado** — ver `DECISIONS.md` §16. Es el único que se reparte:

    .../conectar.html?api=<servidor>&llave=<llave>

---

## Lo demás que se hizo en esta sesión

- **La simulación se retiró** (`DEMO_ACTIVA = false` en `assets/demo.js`). El sistema
  arranca con los 397 ensayos históricos y el día en blanco. Cada aparato se limpia solo.
- **Las losas se declaran por TRAMO** (`L3-0.431@L3-0.252`), como llegan en obra. De ahí
  **no** se generan los códigos de en medio — `AGENTS.md` §4, es una regla dura.
- **Cerrar el tiro lo dice una persona**: dentro de la puerta «Tiro» del Control Center, y
  un botón pequeño en Muestras que solo se activa sin camiones pendientes.
- **`estado.html`** — sala de máquinas del administrador: qué aparatos están conectados, en
  qué pantalla y desde cuándo.
- **«Plan & Datos» y «Estado del sistema» son solo del administrador** (`config: true`).
  Rubén no los ve.
- **El informe del vaciado abre con una hoja técnica escrita** —resumen en prosa,
  disposición y estadística (n, media, desviación de muestra, CV, mín, máx, normas ASTM)—
  porque el feedback de obra fue que lo anterior eran «print screens de los indicadores».
- La ✕ de la barra **ya no cierra sesión**; salir tiene su propia puerta.
- `verificar.js` **ahora parsea el código que va dentro del HTML**. Antes decía «sin
  fallos» con el Control Center en blanco en producción.

---

## Lo siguiente, por prioridad

1. **Q-07 — autenticación real.** Lo más urgente que queda. Hoy las claves son `1234` y la
   separación admin/usuario es de cortesía, no un candado. Antes de que esto lleve datos
   que la ACT vaya a firmar, hay que cerrarlo.
2. **Q-29 — mudanza a `qcheck.dcreationspr.com`.** Acordado con Víctor: **al terminar de
   construir**, no antes. Cambia el enlace de Rubén, y eso se hace una vez y avisando.
3. **Q-01 — OCR del conduce en papel.** La vía de entrada principal a medio plazo.
4. El resto, en `TAREAS.md`.

**Dos cosas esperan a Víctor, no a un agente:** los logos oficiales del contratista, la
concretera y la Autoridad, y el vector real de Segarra Engineering.

---

## Cómo se trabaja aquí

```bash
node serve.js 8452     # sirve las pantallas y monta la API de sincronización
node sello.js          # OBLIGATORIO en todo commit que toque assets/ o shared/
node verificar.js      # OBLIGATORIO antes de dar nada por bueno
```

Cuentas de demostración: `ruben / 1234` · `admin / 1234` · `invitado / 1234`.

**Lee `AGENTS.md` entero antes de tocar nada.** Manda sobre cualquier otra instrucción.
