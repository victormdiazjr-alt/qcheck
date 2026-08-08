# Lo que pide la Autoridad para el conduce electrónico

Análisis de **«The Digital Highway: Transitioning PRHTA to e-Ticketing»**,
Juan C. Rivera-Ortiz, **Federal Highway — Puerto Rico and USVI Division**,
29 de abril de 2026. 24 diapositivas.

**Lo primero que importa: no es una idea de la Autoridad, es una transición
empujada por la FHWA federal.** Eso cambia el peso de todo lo demás: no es un
proyecto que pueda morir en un cambio de administración.

---

## 1 · El ciclo de vida que dibujan, y dónde caemos nosotros

La presentación parte el conduce digital en cuatro etapas:

| Etapa | Qué es | Estado en PR |
|---|---|---|
| **1 · Plant Loadout Integration** | Los datos se sacan **directamente del POS del suministrador** —asfalto, ready-mix o agregado— **vía API** | Es la etapa que toca |
| **2 · Transit & Fleet Tracking** | GPS, tiempos de ciclo, paradas no autorizadas | **NOT IN PR** |
| **3 · Mobile Field Verification** | El inspector recibe el conduce en iPad o teléfono. **Acepta, rechaza o añade notas al instante. Funciona sin señal y sincroniza después** | Es la etapa que toca |
| **4 · Centralized Administration** | El paquete entra solo en el sistema de gestión (Oracle Unifier / AASHTOware) para reporte diario y pago al contratista | **FUTURE** |

**La etapa 3 es, palabra por palabra, lo que QCheck ya hace** — incluido el
trabajo sin señal con sincronización posterior, que está probado de punta a
punta. La etapa 1 es QTicket. La 2 no aplica aquí y la 4 es futuro.

## 2 · Los 19 campos obligatorios

De la diapositiva *«Required e-Ticket Fields for Asphalt & Concrete»*:

> *«Custom API integration must accurately capture and transmit these 19
> specific data points to the Authority's Electronic Ticketing Portal.»*

**Zona 1 · Identidad del proyecto**
1. Nombre del contratista · 2. Contract ID · 3. Número de proyecto ·
4. Número de proyecto estatal (JP) · 5. Nombre del proyecto

**Zona 2 · Origen y material**
6. Nombre del suministrador · 7. Ubicación del suministrador · 8. Fecha ·
9. Descripción del material · 10. **Mix design ID**

**Zona 3 · Logística**
11. **Weigh Master ID** · 12. Transportista · 13. Número identificador del
vehículo · 14. **Número de carga secuencial**

**Zona 4 · Pesos**
15. Peso bruto legal del vehículo · 16. Peso bruto del vehículo ·
17. Tara · 18. **Peso neto del material** · 19. **Total diario acumulado de
peso neto**

> ⚠ **PRECISION ALERT: todos los pesos con exactitud de 0.01 unidades.**

## 3 · La arquitectura, en tres pasos

| Paso | Norma | Qué pasa |
|---|---|---|
| **1 · La planta** | **SS 161** | El sistema de pesaje del suministrador captura los 19 datos |
| **2 · La nube** | — | Se transmiten **automáticamente por una API propia al Electronic Ticketing Portal de la PRHTA** |
| **3 · El campo** | **SS 611** | El ingeniero, con un iPad Pro con LTE, recibe el conduce **en tiempo real** y verifica la carga en sitio **sin un solo papel** |

Y una comprobación de cumplimiento: **los camiones tienen que llevar el número
identificador bien visible y coincidiendo con el e-Ticket.**

## 4 · El hardware es obligatorio y está especificado

> *«Contractors must provide a minimum of two (2) devices for the field
> office.»*

**iPad Pro 11" (4.ª gen, 2022) — modelo A2761**: chip M2, 8 GB de RAM, 256 GB,
Wi-Fi 6, **Gigabit LTE** y Bluetooth 5.3. Con una nota en naranja:

> *«Cellular capability is non-negotiable for field access.»*

QCheck ya está diseñado para iPad y funciona sin señal. Esto no obliga a
cambiar nada; obliga a **decirlo** cuando se presente.

## 5 · Lo que hicieron otros, y qué aprender

| DOT | Enfoque | Lo que se llevaron |
|---|---|---|
| **PennDOT** | Aplicaciones propias (UAT, ECMS). Pilotos en 2017, 140+ proyectos en 2022 | **Quitaron el GPS obligatorio** tras la reacción de los contratistas |
| **DelDOT** | Portal comercial (**HaulHub**) + Oracle Unifier | La aprobación de estimados bajó **de 21 días a 3** |
| **Alabama y Kentucky** | Por fases y por material | **Empezar por un solo material** y **capturar primero en digital el proceso de papel que ya existe** |

**HaulHub es el competidor.** Es lo que compró DelDOT.

## 6 · Lo que esto significa para nosotros

**a. La etapa 3 ya la tenemos, y es la que nadie regala.** El portal de la
Autoridad recibe conduces; no muestrea hormigón, no lleva cilindros, no calcula
PWL ni factores de pago. QCheck no compite con el portal: **es la capa que el
portal no cubre.**

**b. Hay una tensión real en los 19 campos.** Están pensados para asfalto, que
se vende por peso. El ready-mix se vende por **volumen** —yardas cúbicas— y un
conduce de hormigón no trae peso bruto ni tara. La pesada sí trae pesos por
material, pero no es lo mismo que «peso neto del material» sobre una báscula de
camión. **Es una pregunta que hay que hacerle a la Autoridad antes de
programar nada**, y hacerla es en sí una señal de que sabemos de qué va esto.

**c. El consejo de Alabama y Kentucky es el nuestro.** *«Capture existing paper
processes digitally first.»* Es literalmente lo que hace QCheck con las
casillas en blanco del conduce: llegada a obra, comienzo y fin de vaciado, toma
de muestras. Ya vamos por donde ellos dicen.

**d. Lo de DelDOT es el número que vende.** De 21 días a 3 en aprobar
estimados. Cuando se hable de dinero con un contratista, ese es el argumento —
y no es nuestro, es de un DOT que ya lo hizo.

**e. El conduce de hoy no da los 19.** Ni el papel de Concre-Tech ni la foto
que toma el técnico. Solo salen del sistema de la planta, que es exactamente lo
que QTicket va a leer.

## 7 · Lo que hay que preguntarle a la Autoridad

1. **Peso contra volumen en ready-mix**: ¿cómo esperan los campos 15 a 19 en un
   conduce de hormigón?
2. **El Electronic Ticketing Portal**: ¿existe ya? ¿Hay documentación de la
   API? ¿Es de ellos o de un proveedor?
3. **Coordinación**, que la propia SP-934-4.04(h) exige para admitir el conduce
   electrónico.
4. **SS 161 y SS 611**: hacen falta las dos especificaciones completas.
