# Los módulos de la SP-934, y qué ve cada quien

Propuesta de arquitectura. Lo que sigue no es una lista de pantallas: es un
reparto de **para qué usa cada uno esta herramienta**, que es lo que decide si
la Autoridad la adopta o se queda con sus hojas de cálculo.

---

## La lectura estratégica, primero

La Autoridad no tiene hoy una herramienta para la 934 (Víctor, 8 ago 2026). Eso
es una oportunidad, pero conviene ser exacto sobre **cuál**:

**Su problema no es entrar datos. Es calcular y defender.** La 934 les obliga a
determinar un PWL por distribución beta y de ahí un factor de pago, por lote,
por tres características. Eso hoy se hace en Excel, a mano, tarde, y sin manera
de reconstruir de dónde salió un número cuando el contratista lo discute.

De ahí salen las tres cosas que hacen que nos elijan, y ninguna es una pantalla
bonita:

1. **Que el número sea el suyo.** Nuestro PWL reproduce la Tabla 934-6 que ellos
   publican, en 32 puntos de n=3 a n=10 (`pruebas/sp934.mjs`). Eso se enseña.
2. **Que se pueda rastrear.** De un factor de pago hasta el cilindro, el camión,
   el conduce, el técnico y la hora. Sin eso, un número es una opinión.
3. **Que el muestreo sea defendible.** La 934 exige azar (ASTM D3665). Si lo
   elige el técnico, el contratista puede impugnar el lote entero. Si lo elige
   el sistema y queda constancia de cómo, no.

Lo tercero es lo que nadie más va a hacer, y es barato para nosotros.

---

## Los módulos

### M1 · Lotes — el cimiento

Cambia la unidad de todo: hoy QCheck piensa en **días**, la 934 piensa en
**lotes** de 250 m³ en 10 sub-lotes de 25.

No sustituye al día: un tiro sigue siendo la jornada de obra y así se trabaja.
Pero un lote puede abarcar varios tiros y un tiro puede partirse entre dos
lotes, y esa correspondencia hay que enseñarla, no esconderla.

**Estado de un lote:** abierto · completo · evaluado · aceptado · rechazado.

### M2 · Muestreo aleatorio

El sistema elige el punto de muestreo dentro de cada sub-lote y le dice al
técnico **a qué camión**. Guarda cómo lo eligió y cuándo, antes de que el camión
llegue — que es lo que lo hace verificable.

Hoy lo decide el técnico. Bajo la 934 eso es un flanco: cualquiera puede alegar
que se muestreó el camión que convenía.

### M3 · Cilindros y laboratorio

Seis cilindros por sub-lote (7 y 28 días, o 7 y 56 en tablero), dos de
permeabilidad, dos por lote de tensión indirecta. Edades **del plan**, no del
código.

Cadena de custodia: quién los hizo, cuándo, cuándo salieron, quién los recibió.
La 934 exige coordinar con el laboratorio de la Autoridad **48 horas antes** del
vaciado — eso es un aviso que el programa puede dar solo.

### M4 · Evaluación del lote

PWL por característica, factor individual, factor compuesto, y el veredicto.
Con el detalle a la vista: media, desviación, QU, QL, PU, PL. **Nadie firma un
número que no puede reconstruir.**

De aquí sale el **reporte de lote**, que es el documento que la Autoridad mira.

### M5 · Permeabilidad — opcional por proyecto

La PR-52 no la lleva; proyectos 934 futuros sí. Aparece solo si el proyecto la
tiene, y su ausencia cambia la fórmula del compuesto (0.90/0.10 en vez de
0.45/0.45/0.10). Ya está resuelto en `assets/sp934.js`.

### M6 · Conduce conforme a 934-4.04(h)

Los trece renglones y las dos certificaciones firmadas. Hoy no se cumplen: la
mitad viven en la pesada y las firmas no están en ningún papel. Aquí es donde
enchufa **QTicket**.

### M7 · Proyección de pago — el que vende

Con cinco sub-lotes de diez ya se sabe hacia dónde va el lote. Hoy eso se
descubre a los 28 días, cuando el cheque viene corto y no hay nada que hacer.

Enseñar la trayectoria del PWL mientras el lote se llena convierte QCheck de
libro de registro en herramienta de decisión. **Es la función por la que un
contratista paga sin discutir.**

### M8 · Expediente y auditoría

De un factor de pago hacia atrás hasta el camión. Nada se borra, todo lleva
autor y hora. Ya es como funciona QCheck; bajo la 934 pasa de ser una virtud a
ser el argumento.

---

## Qué ve cada usuario

### Autoridad de Carreteras — rol nuevo

Es quien acepta. **No entra datos: verifica y decide.**

| Ve | Hace |
|---|---|
| Lotes del proyecto y su estado | Acepta o rechaza un lote, con motivo |
| La evaluación completa, con el detalle del cálculo | Descarga el reporte de lote |
| La cadena de un número hasta el camión | Consulta el expediente |
| Cómo se eligió cada punto de muestreo | — |
| Certificación del técnico que muestreó (TTCP, SP-667) | — |

**No ve** lo interno del contratista ni de la concretera. Su pantalla es de
aceptación, no de operación.

### Contratista

Le pagan por lote y el factor le afecta directamente.

| Ve | Hace |
|---|---|
| Sus lotes y el factor **proyectado** | Nada que altere el expediente |
| El aviso cuando un lote va camino de bajar de 90 % | — |
| Qué falta para cerrar cada lote | — |
| Conduce contra orden (Q-55) | — |
| Su histórico y sus reportes | Imprime |

**Su alarma es distinta de la del técnico:** al técnico le importa el camión de
ahora; al contratista, la tendencia de las próximas cincuenta yardas.

### Concretera

Un lote rechazado es su problema antes que el de nadie.

| Ve | Hace |
|---|---|
| Cómo rinde **su diseño de mezcla** entre lotes | Ajusta la planta |
| Objetivo contra real de cada material | — |
| Sus conduces y sus humedades | — |
| Aviso temprano de deriva | — |

**No ve los factores de pago.** Eso es entre el contratista y la Autoridad, y
meterlo en su pantalla convierte una herramienta de calidad en una de
negociación. Ve la calidad, que es lo que puede corregir.

### Firma de control de calidad — Rubén, ingeniero de récord

Es quien opera el programa y quien firma.

| Ve | Hace |
|---|---|
| Todo lo operativo | Programa el vaciado y los lotes |
| El plan de muestreo del día | Cierra y firma lotes |
| Cilindros pendientes y vencidos | Reabre lo cerrado (solo él) |
| La evaluación con el detalle | Emite el reporte |

### Técnico de campo

Necesita saber **qué hacer ahora**, y nada más.

| Ve | Hace |
|---|---|
| A qué camión le toca muestra | Recibe camiones |
| Qué ensayos y cuántos cilindros | Entra ensayos |
| Las etiquetas de los cilindros | Marca hitos |
| Lo que falta del sub-lote en curso | — |

**No ve** PWL, ni factores, ni dinero. Un número de pago en la pantalla de quien
toma la muestra es una presión que no debe existir.

---

## Por dónde construir

1. **M1 Lotes** — sin la unidad no hay nada
2. **M4 Evaluación** — la aritmética ya está hecha y verificada
3. **M3 Cilindros** — es lo que alimenta M4
4. **M2 Muestreo aleatorio** — barato y es el argumento ante la Autoridad
5. **M7 Proyección** — lo que vende
6. **M5 Permeabilidad** — cuando llegue el proyecto que la lleve
7. **Rol Autoridad** — al final, cuando haya algo que enseñarles

Todo detrás de `es934()`, y nada a la vista de Rubén ni del técnico hasta que
esté terminado (Q-57b).
