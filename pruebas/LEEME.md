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

## La aritmética de la SP-934

```
node pruebas/sp934.mjs
```

No necesita servidores: es matemática pura. Comprueba el cálculo de PWL contra
la **Tabla 934-6**, que la propia especificación publica «only to assist in the
preliminary by hand verification purposes» — la Autoridad da la respuesta, así
que si no la reproducimos el error es nuestro. Treinta y dos puntos de la tabla,
más los factores de pago, el rechazo y el reparto en lotes y sub-lotes.

**Se corre siempre que se toque `assets/sp934.js`.** Ese archivo decide cuánto
se cobra: un error ahí no se ve como un error, se ve como un número plausible.

