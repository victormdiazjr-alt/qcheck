# QCheck

Control de calidad de hormigón en obra — **Segarra Engineering**.

Reemplaza el flujo de hoja de papel → Excel → reporte impreso por un registro digital
que se llena una sola vez, en el campo, y produce el entregable solo.

**En línea:** https://victormdiazjr-alt.github.io/qcheck/
Acceso de demostración: `admin` / `1234`

## Correr localmente

```bash
node serve.js 8452
```

Abre http://localhost:8452 — sin instalación, sin compilación, sin dependencias.

## Pantallas

| Pantalla | Para quién |
|---|---|
| `control-center.html` | Ingeniero de QC: pruebas, resistencias, cartas de control, plan de límites |
| `muestras.html` | Técnico en el iPad: entra los resultados junto al camión |
| `display.html` | Choferes y cuadrilla: veredicto del camión en pantalla grande |
| `contratista.html` | Contratista: yardas, losas, camiones esperando, cumplimiento |
| `produccion.html` | Rendimiento y ciclos de los camiones |
| `autoridad.html` | ACT / FHWA: resumen de cumplimiento (solo lectura) |
| `reporte.html` | El entregable: tabla matriz, media móvil, cartas y certificación |

## Trabajar en este repositorio

Lee **`AGENTS.md`** antes de tocar nada — aplica a personas y a agentes de IA.
Reclama tu tarea en **`TAREAS.md`** antes de empezar.

Documentación en `docs/`: arquitectura, hoja de ruta, despliegue y el contrato del conduce.

## Datos

Trae sembrados **397 ensayos reales** del proyecto PR-52 (nov 2025 – jul 2026), extraídos
de las cartas de control de Segarra. Se guardan en el navegador; el backend en la nube
es la tarea Q-02.
