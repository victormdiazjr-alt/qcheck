# TODO — QCheck

Lo que falta, en orden de lo que más mueve la aguja.
Para **reclamar** una tarea usa [`TAREAS.md`](TAREAS.md), que es la bitácora viva
entre agentes. Este archivo dice *qué* hay que hacer; aquél, *quién lo está haciendo*.

---

## Primero

### Q-02 · Backend y base de datos en la nube — **grande**
Hoy cada navegador guarda lo suyo en `localStorage` y los aparatos no se sincronizan.
Es la limitación de fondo del proyecto: sin esto no hay «en vivo» de verdad para el
equipo, y bloquea Q-04, Q-06 y Q-07.

**Por dónde empezar:** la capa de datos está aislada a propósito. Reescribe solo
`loadDB()` y `saveDB()` en `assets/core.js` contra una API; el resto del motor no
debería enterarse. Mantén `enableLiveSync()` funcionando.

### Q-01 · OCR del conduce en papel — **grande**
La mayoría de las concreteras no tendrán QR: llegan con conduce en papel. Hoy la foto
se guarda como evidencia y los datos se entran a mano. **Esta es la vía principal de
entrada, no el respaldo.** Es lo que más trabajo manual quita en el campo.

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

### Q-05 · Línea de tiempo de eventos por conduce — mediano
Modelo de datos definitivo: salida de planta, llegada, muestra, veredicto, vaciado,
cilindros. Hoy son campos sueltos en el registro.

### Q-06 · Adjuntos en el conduce — mediano · necesita Q-02
Foto del conduce, pesadas, fotos de losa y cilindros. Cierra el expediente digital
que hoy se arma a mano.

### Q-08 · Más reglas de inteligencia — pequeño
`trendAlerts()` ya detecta agua, tendencia y humedad vencida. Faltan reglas de
temperatura y de tiempo de viaje.

### Q-09 · Aire en el tablero del productor — pequeño
El contrato ya publica los límites de aire y nadie los muestra.

### Q-11 · Avance exacto por losa — pequeño
Un camión que reparte su carga entre varias losas no registra cuánto dejó en cada una.
Hoy se atribuyen solo las yardas de los camiones que sirvieron una sola losa, y la
cifra sale con `≥`. Para exactitud haría falta un campo de reparto en Recepción.

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
