# Despliegue — QCheck PR-52

## Dirección pública (activa)

**https://victormdiazjr-alt.github.io/qcheck-pr52/**

Todas las pantallas accesibles por URL, desde cualquier navegador y dispositivo:

| Pantalla | URL |
|---|---|
| Portal del teléfono | `/qc/movil.html` |
| Control Center (QC) | `/qc/index.html` |
| Muestras (iPad) | `/qc/muestras.html` |
| Contratista | `/qc/contratista.html` |
| Producción (planta) | `/qc/produccion.html` |
| Autoridad / FHWA | `/qc/autoridad.html` |
| Field Display | `/qc/display.html` |
| Demo con simulación | `https://victormdiazjr-alt.github.io/pr52-pantalla/` |

Repo: `victormdiazjr-alt/qcheck-pr52` · rama `main` · GitHub Pages.
Para actualizar: se reconstruye la carpeta del sitio desde `qc/` + `shared/` y se hace push.

## Arquitectura destino: dos sistemas, dos backends

Cada herramienta corre en **su propio dominio, con su propio backend y su propio
control center**. No comparten servidor ni base de datos. Se venden y se operan por separado.

```
   ┌──────────────────────────────┐        ┌──────────────────────────────┐
   │  e-Ticket  ·  la concretera  │        │  QCheck  ·  Segarra QC       │
   │  eticket.<dominio>           │        │  qcheck.<dominio>            │
   ├──────────────────────────────┤        ├──────────────────────────────┤
   │ Despacho · Producción        │        │ Recepción · Muestras         │
   │ Control center de planta     │        │ Field Display · Contratista  │
   │ Página pública del cliente   │        │ Autoridad · Control Center   │
   ├──────────────────────────────┤        ├──────────────────────────────┤
   │ backend propio · BD propia   │        │ backend propio · BD propia   │
   └──────────────┬───────────────┘        └───────────────┬──────────────┘
                  │                                        │
                  └───────── QR del conduce ───────────────┘
                        (interoperabilidad opcional)
```

**URLs previstas**

| Sistema | Dominio | Para quién |
|---|---|---|
| e-Ticket — planta | `eticket.<dominio>` | operador de la caseta, control center de la concretera |
| e-Ticket — cliente | `eticket.<dominio>/c/#…` | **el cliente residencial**, desde su teléfono, para ver y pagar |
| QCheck | `qcheck.<dominio>` | técnico, QC, contratista, autoridad |

El QR de e-Ticket apunta a **su propia URL pública**, configurable en el setup de la planta.
Ningún código asume que las dos herramientas viven en el mismo servidor.

## Dominio propio

GitHub Pages acepta dominio propio sin costo:
1. Comprar el dominio (ej. `qcheck.pr` o `qcheck.app`).
2. En el DNS del proveedor apuntar a GitHub Pages (registros A a las IP de Pages, o CNAME
   a `victormdiazjr-alt.github.io`).
3. En el repo: Settings → Pages → Custom domain, y activar *Enforce HTTPS*.

Decisión pendiente de Víctor: **qué dominio se compra.**

---

## Límite actual — importante

Hoy cada navegador guarda **sus propios datos** (almacenamiento local). Es decir: la URL ya
es pública y permanente, pero **dos dispositivos no comparten información**. Sirve para
demostrar y para operar en un solo equipo; **no es todavía el producto multiusuario.**

Lo que falta para que sea el sistema real:

| Pieza | Para qué |
|---|---|
| **Base de datos en la nube** | Que el conduce escrito en la planta lo vea QC en el campo y el contratista en su teléfono |
| **Tiempo real** | El "correr en vivo" que pidió Rubén: el veredicto aparece al instante en todas las pantallas |
| **Usuarios y roles** | Que la concretera no vea datos del proyecto y la Autoridad solo lea |
| **Correos automáticos** | Aviso de rechazo a todas las partes sin intervención |

### Recomendación técnica: **Supabase**

Encaja con lo que ya está construido y con lo que Rubén pidió:

- **Postgres real** — el record por conduce y sus pruebas son datos relacionales, no archivos.
- **Tiempo real integrado** — las pantallas se actualizan solas, sin inventar sincronización.
- **Roles a nivel de fila** — la planta ve lo suyo, el contratista lo suyo, la Autoridad solo lee.
- **Sin paso de compilación** — se llama desde el JavaScript que ya existe; no hay que rehacer las pantallas.
- Plan gratuito suficiente para el piloto de PR-52; escala pagando cuando entren más clientes.

Alternativas válidas: Firebase (más simple, menos relacional) o Cloudflare D1 (más barato a
escala, más trabajo de montaje).

**Migración estimada:** cambiar la capa de almacenamiento (hoy centralizada en `core.js` y en
`shared/conduce-contract.js`) por llamadas a Supabase. Las pantallas no se tocan — por eso se
mantuvo el almacenamiento en un solo lugar desde el principio.
