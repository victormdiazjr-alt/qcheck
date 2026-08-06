# TODO — QCheck

Lo que falta, en orden de lo que más mueve la aguja.
Para **reclamar** una tarea usa [`TAREAS.md`](TAREAS.md), que es la bitácora viva
entre agentes. Este archivo dice *qué* hay que hacer; aquél, *quién lo está haciendo*.

---

## Primero

### Q-32 · Encender el lector de conduce y probarlo en obra — pequeño · **es de Víctor**
El código de Q-01 está escrito y probado hasta donde se puede sin llave. Falta:

1. Sacar una llave de API en console.anthropic.com
2. `npx wrangler secret put QC_ANTHROPIC` (y `QC_ANTHROPIC=... node serve.js` en local)
3. **Probarlo con conduces de verdad** — de las plantas que surten la PR-52, no con
   una foto de muestra. Lo que hay que medir no es si lee, sino **si deja campos
   vacíos cuando no está seguro**: un campo inventado que parece bueno es el fallo
   que este proyecto no puede tener.

Coste estimado: unos 3 ¢ por conduce (~50 ¢ en un vaciado de 16 camiones).

Si en obra falla mucho con conduces de matriz de puntos, el sitio donde se cambia el
lector es una sola función: `leerConduce()` en `sync-servidor.js` y su gemela en
`sync-worker.js`.

---

## Después

### Q-30 · Migrar los aparatos y encender el candado — pequeño · **es de Víctor**
El Worker está desplegado y las cuentas creadas (5 ago 2026), pero **`exigir_sesion` sigue
apagada**: hasta encenderla, un aparato sin migrar todavía puede escribir declarando su
propio autor. Lo que falta no es código:

1. Repartir las claves de `datos/claves-nuevas.txt` — **no por el mismo sitio que el
   enlace de conexión**
2. Que **cada aparato entre una vez** con su cuenta: el iPad de Rubén, su teléfono, la PC
3. Comprobarlo en `estado.html` (Víctor lo ve; Rubén no)
4. Y entonces:

```bash
QC_API=https://qcheck-api.qcheck.workers.dev node cuentas.js exigir-sesion on
```

Encender la bandera antes de que los aparatos hayan entrado deja a la cuadrilla sin poder
escribir en mitad de un vaciado. **No se hace un día de tiro.** Ver `DECISIONS.md` §17.

### Q-04 · Correo automático al rechazar — mediano · necesita Q-02
Hoy `notifyReject()` abre un correo pre-llenado. Falta el envío real.

### Q-31 · Que el aparato perdido no enseñe nada — grande
Q-07 cerró quién puede **escribir** en el expediente. Lo que sigue abierto es que un
aparato sin señal entra con la lista local de `usuarios.js` y ve las pantallas: es
deliberado —dejar al técnico fuera en obra es peor—, pero significa que quien tenga el
iPad ve lo que hay dentro. La salida no son más candados en el navegador, que se saltan
con la consola: es cifrar la base local contra la clave del usuario. Ver `DECISIONS.md` §17.

### Q-06 · Adjuntos en el conduce — mediano · necesita Q-02
Foto del conduce, pesadas, fotos de losa y cilindros. Cierra el expediente digital
que hoy se arma a mano.

### Q-10 · Integración con ArcGIS — investigación
La inspección ya georreferencia losas ahí. Evaluar el enlace.

---

## Esperan a Víctor, no a un agente

- **Los logos oficiales** del contratista (Del Valle Group), la concretera
  (Concre-Tech) y la Autoridad (ACT). El mecanismo está hecho y hay monograma de
  reserva; solo faltan los archivos. Se ponen en Plan & Datos → Proyecto.
- **El vector real de Segarra Engineering.** El del botón de Resultados del portal es
  una aproximación: los chevrons recortados del logo de QCheck.
- **Decidir sobre los términos fronterizos:** Resistencia (→ Strength), Aire
  (→ Air Content), Lote (→ Lot), Límite de acción/suspensión (→ Action/Suspension
  Limit). Vienen del Excel en inglés, así que son discutibles.

---

## Deuda técnica conocida

- **Probado solo en Chromium.** `dvh`, `env(safe-area-inset-*)` y el recorte del notch
  están según especificación pero no vistos en un iPhone físico.
- **`BarcodeDetector` no existe en iOS Safari** — el escaneo de QR no funciona ahí.
  Documentado, con foto y entrada manual como alternativa.
- **`assets/seed.js` pesa 150 KB** y se carga en las once pantallas. Cuando llegue el
  backend, deja de tener sentido.
