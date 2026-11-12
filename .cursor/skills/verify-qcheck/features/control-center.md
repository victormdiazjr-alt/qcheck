# Control center del técnico

## Sub-features

- TODO: listar las sub-funciones al recorrerla con Vik o con credenciales de prueba.

## How to get to it (user POV)

Ruta: `/control-center.html`.

## Driving it with Playwright

```bash
BASE_URL=http://127.0.0.1:8461 PATHS=/control-center.html VERIFY_REPO=qcheck node .cursor/skills/verify-qcheck/smoke.mjs
```

Prueba de que funciona: Carga y pide acceso o muestra el tiro.

## Gotchas

- El smoke solo abre la pantalla. El recorrido con clics queda TODO hasta tener datos o cuentas de prueba.
