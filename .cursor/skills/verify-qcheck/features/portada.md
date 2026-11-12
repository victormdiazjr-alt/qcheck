# Portada / entrada

## Sub-features

- TODO: listar las sub-funciones al recorrerla con Vik o con credenciales de prueba.

## How to get to it (user POV)

Ruta: `/index.html`.

## Driving it with Playwright

```bash
BASE_URL=http://127.0.0.1:8461 PATHS=/index.html VERIFY_REPO=qcheck node .cursor/skills/verify-qcheck/smoke.mjs
```

Prueba de que funciona: Carga sin errores JS y muestra la entrada.

## Gotchas

- El smoke solo abre la pantalla. El recorrido con clics queda TODO hasta tener datos o cuentas de prueba.
