# Instrucciones para OpenAI Codex

Copia y pega el bloque de abajo en Codex. Sirve igual para cualquier otro asistente
o para ti mismo desde otra computadora.

---

## Los dos repositorios

| Herramienta | Repositorio | En línea |
|---|---|---|
| **QCheck** — control de calidad (Segarra) | `victormdiazjr-alt/qcheck` | https://victormdiazjr-alt.github.io/qcheck/ |
| **Concre-Ticket** — despacho de planta | `victormdiazjr-alt/concre-ticket` | https://victormdiazjr-alt.github.io/concre-ticket/ |

Acceso de demostración en ambos: `admin` / `1234`.

---

## Bloque para pegar en Codex

```
Trabajarás en dos repositorios de GitHub de Víctor Díaz (usuario victormdiazjr-alt):

  · qcheck        — control de calidad de hormigón en obra (Segarra Engineering)
  · concre-ticket — despacho de planta y conduce digital para concreteras

Son dos productos INDEPENDIENTES para clientes distintos. Ninguno depende del otro.

ANTES DE TOCAR NADA, en el repositorio en el que vayas a trabajar:

  1. Lee AGENTS.md completo. Es obligatorio y manda sobre cualquier otra instrucción.
  2. Lee TAREAS.md.
  3. Reclama tu tarea moviéndola a "En curso" con el nombre `codex` y la fecha.
  4. Haz commit y push de ese reclamo ANTES de escribir una línea de código.
     Sin ese push, otro agente puede estar editando el mismo archivo ahora mismo.
  5. Al terminar, muévela a "Hecho", commit y push.

Reglas que no se negocian:

  · Sin paso de compilación. HTML, CSS y JavaScript planos. Nada de frameworks,
    bundlers ni dependencias de npm. Debe abrir con doble clic y funcionar sin internet.
  · Interfaz y comentarios en español.
  · Verifica en el navegador antes de decir que algo funciona (node serve.js 8452).
  · Borra los datos de prueba que crees.
  · shared/conduce-contract.js está en los dos repos y debe permanecer idéntico.
    NO lo edites por tu cuenta: anota la propuesta en TAREAS.md bajo "Contrato"
    y avisa a Víctor.
  · Nunca inventes límites, valores ni resultados. Si un dato no existe, muéstralo vacío.
  · En la página del cliente de Concre-Ticket (c/): jamás pidas datos de tarjeta ni
    credenciales, y mantén visible que el pago es una demostración.

Empieza confirmándome qué tareas ves disponibles en TAREAS.md y cuál propones tomar.
```

---

## Cómo se sincroniza el trabajo entre Codex y Claude Code

No hace falta ninguna integración especial: **`TAREAS.md` en cada repositorio es la
interfaz**. Los dos agentes leen y escriben el mismo archivo por git.

```
   Claude Code (este chat)                 OpenAI Codex
            │                                    │
            │  git pull                git pull  │
            ▼                                    ▼
        ┌─────────────────────────────────────────┐
        │  TAREAS.md   (en curso · pendiente ·    │
        │               contrato · hecho)         │
        └─────────────────────────────────────────┘
            ▲                                    ▲
            │  reclama + push          reclama + push
```

**Por qué funciona:** reclamar la tarea **antes** de escribir código y empujar ese
reclamo de inmediato convierte a git en el árbitro. El que llega primero se queda con
la tarea; el segundo ve el reclamo al hacer `pull` y escoge otra. Es el mismo mecanismo
que usan los equipos humanos, y no depende de que las dos herramientas se conozcan.

**Reglas del árbitro:**

- Reclamo sin push no vale.
- Dos agentes nunca deben tener la misma tarea "en curso". Si pasa por una carrera,
  gana el commit más antiguo; el otro revierte su reclamo.
- Una tarea "en curso" con más de 24 h sin avance queda libre — anótalo al reclamarla.
- Los cambios al contrato del conduce **no los decide ningún agente**: se proponen en
  TAREAS.md y los aprueba Víctor, y entonces se aplican en los dos repos a la vez.

## Trabajar desde otra computadora

```bash
git clone https://github.com/victormdiazjr-alt/qcheck.git
git clone https://github.com/victormdiazjr-alt/concre-ticket.git
cd qcheck && node serve.js 8452
```

No hace falta instalar nada más que Node para el servidor local — y ni eso, si abres
los archivos directamente con doble clic.
