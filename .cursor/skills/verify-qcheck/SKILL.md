---
name: verify-qcheck
description: Verifica QCheck (ensayo en obra, PR-52) manejando la app real (navegador y comandos del repo) y guardando evidencia. Úsala antes de dar por terminado cualquier cambio en este repo, para revisar el trabajo de otro agente, o cuando algo en vivo parezca roto.
---

# verify-qcheck

Superficie: Sitio estático HTML/JS (`serve.js` local, GitHub Pages) más la API `sync-worker.js` en Cloudflare (`qcheck-api`).

En vivo (solo lectura): https://victormdiazjr-alt.github.io/qcheck/

Esta skill la escribió un agente siguiendo `create-verification-skill` de pstack. Lo marcado TODO falta validarlo con Vik o con credenciales.

## Launch

Levanta una instancia propia, en una **copia desechable** del repo si la app escribe archivos:

```bash
cp -r . /tmp/qcheck-verify && cd /tmp/qcheck-verify
QC_TOKEN=llave-de-prueba QC_ADMIN=admin-de-prueba node serve.js 8461 > /tmp/qcheck-server.log 2>&1 &
echo $! > /tmp/qcheck-server.pid
for i in $(seq 1 90); do curl -fsS -o /dev/null http://127.0.0.1:8461/ && break; sleep 1; done
```

Lista: `curl` a `http://127.0.0.1:8461/` contesta sin error. Si el puerto ya está ocupado, no tumbes lo que hay: usa otro puerto.

Teardown: `kill $(cat /tmp/qcheck-server.pid)`. Mata solo el proceso que tú arrancaste, nunca por nombre.

## Doctor

Solo lectura. Córrelo primero y cada vez que algo se vea raro:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8461/   # 2xx/3xx = vale la pena manejarla
curl -s -o /dev/null -w '%{http_code}\n' https://victormdiazjr-alt.github.io/qcheck/
git -C . log -1 --oneline   # la versión que estás probando
```

## Chequeos del repo (insumo, no veredicto)

- verificar.js (revisión estática del proyecto): `node verificar.js`
- Desconectar aparato (Q-77): `node pruebas/desconectar-aparato.mjs`
- Echar a todos (Q-85): `node pruebas/echar-a-todos.mjs`

## Drive

Smoke de solo lectura con Playwright (abre cada ruta, sin clics). El helper está junto a esta skill:

```bash
BASE_URL=http://127.0.0.1:8461 PATHS=/index.html,/control-center.html,/muestras.html,/conduce.html VERIFY_REPO=qcheck \
  node .cursor/skills/verify-qcheck/smoke.mjs
```

Si `playwright` no está instalado en el repo: `npm i --prefix /tmp/pw playwright` y añade `PLAYWRIGHT_MODULE=/tmp/pw/node_modules/playwright/index.mjs`. Con Chrome del sistema: `CHROME_PATH=/usr/bin/google-chrome`.

El smoke solo prueba que las pantallas abren. Para dar por bueno un cambio, maneja la función tocada como usuario (clics y formularios con Playwright, selectores estables: texto visible, roles ARIA, `id`) siguiendo su archivo en `features/`.

Lighthouse (rendimiento, accesibilidad, SEO):

```bash
npx -y @lhci/cli@0.15 collect --url=http://127.0.0.1:8461/ --numberOfRuns=1 && npx -y @lhci/cli@0.15 upload --target=filesystem --outputDir=$HOME/verify-evidence/qcheck/lhci
```

## Evidence

- Va en `$HOME/verify-evidence/qcheck/<fecha>/` (fuera del repo): capturas PNG por ruta y `report.json` con estado HTTP, título y errores JS.
- Prueba el camino real del usuario, no setters internos ni endpoints de prueba.
- Captura la acción y el estado que resulta, no solo la pantalla final. Verifica efectos (filas, archivos, mensajes) además de lo visible.
- Mocks solo donde ya hay una frontera de producción (por ejemplo pagos simulados).

## Cleanup

```bash
kill $(cat /tmp/qcheck-server.pid) 2>/dev/null; rm -rf /tmp/qcheck-verify /tmp/qcheck-server.pid
```

La evidencia en `$HOME/verify-evidence/qcheck/` se queda.

## Cuidado

- Las pruebas de `pruebas/` ESCRIBEN. Solo con `--local`, nunca contra producción (lo dice `pruebas/LEEME.md`).
- `wrangler.toml` apunta a la D1 y al R2 de PRODUCCIÓN y reclama `qterapr.com` como dominio propio. Hoy `qterapr.com` sirve el sitio de QTera, no QCheck. Un `wrangler deploy` desde aquí podría quitarle el dominio al sitio de QTera. Nunca desplegar sin Vik.
- GitHub Pages de este repo marca estado `errored` en la API, aunque la URL responde 200.

## Falta validar (TODO)

- Credenciales de prueba (QC_TOKEN/QC_ADMIN de un entorno de prueba) para recorrer un tiro completo.
- `pruebas/servidores-iguales.mjs` y `candado-de-sesion.mjs` necesitan los dos servidores levantados (ver `pruebas/LEEME.md`); no van en CI todavía.

## Mapa de funciones

- [Portada / entrada](features/portada.md)
- [Control center del técnico](features/control-center.md)
- [Muestras](features/muestras.md)

Para mantener el mapa al día: skill `maintain-verification-skill`.
