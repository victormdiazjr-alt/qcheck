# Pruebas que hay que correr a mano

`verificar.js` mira el código sin ejecutarlo. Esto lo complementa: **levanta los dos
servidores y les habla**, que es la única forma de saber si se comportan igual. Nacieron
de la auditoría del 6 ago 2026 (ver `DECISIONS.md` §19 y §20).

Node puro, sin una sola dependencia, como todo lo demás.

## Preparar los dos servidores

```
QC_TOKEN=llave-de-prueba QC_ADMIN=admin-de-prueba node serve.js 8461 &
npx wrangler d1 execute qcheck --local --file sync-esquema.sql
npx wrangler dev --local --port 8462 --var QC_TOKEN:llave-de-prueba --var QC_ADMIN:admin-de-prueba &
```

**Con `--local`.** Nunca contra producción: estas pruebas escriben.

## Correrlas

```
node pruebas/servidores-iguales.mjs    # 33 casos a los dos, comparando respuesta
node pruebas/candado-de-sesion.mjs     # exigir_sesion de punta a punta
```

Lo que se espera: `servidores-iguales` saca **una sola divergencia y es de diseño**
(fuera de `/api/` el servidor local sirve archivos y el Worker no). Cualquier otra hay
que mirarla. `candado-de-sesion` sale entero en verde.

## Cuándo

Antes de tocar `sync-servidor.js` o `sync-worker.js`, y después. Un cambio en uno solo
casi siempre significa que falta el gemelo.
