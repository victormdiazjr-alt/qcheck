# QCheck PR-52 — esta sesión no construye nada

**Estado: EN PRODUCCIÓN · NO TOCAR.**

`SESIONES.md` dice, literal, qué construye esta sesión: **«NADA. Se mantiene
intacto para que Rubén trabaje.»**

Esto es lo que Rubén Segarra usa **todos los días en obra**. Es lo único del
proyecto que, si se rompe, deja a alguien parado con un camión de hormigón
esperando. Ya pasó el 8 de agosto de 2026.

## Antes de tocar una sola línea, si algún día hay que tocarla

1. `~/Documents/Claude/qcheck/SEGUIMOS-AQUI.md` — el estado de producción.
2. `~/Documents/Claude/qcheck/DECISIONS.md` — sobre todo §54, §59 y §60.
3. `~/Documents/Claude/qcheck/AGENTS.md` — manda sobre cualquier otra instrucción.

## Las tres cosas que cuesta caro no saber

- **`sync-servidor.js` y `sync-worker.js` comparten texto pero NO comparten
  funciones.** Copiar una línea de uno al otro rompió producción, y
  `node --check` no lo cazó.
- **`exigir_sesion` está ENCENDIDO.** Todos entran con su clave. **Nadie necesita
  enlace de conexión nuevo.** Si alguien dice que no entra, la respuesta es su clave.
- **Un secreto de Cloudflare tarda segundos en propagarse** y mientras tanto las
  respuestas bailan. **Comprobar varias veces seguidas**, nunca una sola vez.

## Lo obligatorio en esta carpeta

```bash
node sello.js       # OBLIGATORIO en todo commit que toque assets/ o shared/
node verificar.js   # OBLIGATORIO antes de dar nada por bueno
```

**Y `datos/` no entra en git jamás.** Tiene la llave del proyecto, el secreto de
administración y las claves de todos. El 8 de agosto se publicó sin querer y hubo
que cambiar la llave entera. La llave del proyecto **sigue quemada**.
