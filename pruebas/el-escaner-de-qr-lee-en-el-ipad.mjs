/* ============================================================
   EL ESCÁNER DE QR TIENE QUE LEER EN EL IPAD — Q-161.

   `startScan()` tenía dos caminos desde Q-80: `BarcodeDetector`, que trae
   Chrome de Android y resuelve el sistema, y el lector propio en un Worker,
   que es el que usa Safari porque no trae el otro.

   Pero entre los dos caminos y el `setInterval` había quedado una línea suelta
   de la versión anterior:

       const detector = new BarcodeDetector({ formats: [...] });

   FUERA del `if`. En Chrome no se nota: construye un detector que nadie usa.
   En Safari `BarcodeDetector` no existe, así que lanza `ReferenceError` antes
   de armar el temporizador — y como `startScan()` es `async`, la promesa se
   rompe sin decir nada.

   O sea: **en el iPad de obra la cámara se abría y no leía un código jamás**, y
   el único aparato donde funcionaba era el que no está en la obra.

   > Una rama que solo corre en el navegador que no está en obra no está
   > probada.

   Esta prueba corre el guion de Recepción SIN `BarcodeDetector`, que es como
   está Safari, y comprueba que llega a mirar fotogramas.
   ============================================================ */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = readFileSync(join(RAIZ, "conduce.html"), "utf8");
const GUION = (HTML.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/) || [])[1] || "";

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };

console.log("\n1 · LA LÍNEA QUE SOBRABA NO ESTÁ");
{
  /* Se busca en el ámbito de la FUNCIÓN —dos espacios de sangría—, que es donde
     estaba. Dentro del `if` sigue siendo correcta y ahí tiene que quedarse. */
  di(!/^ {2}const detector = new BarcodeDetector/m.test(GUION),
     "no se construye un BarcodeDetector fuera de la rama que lo tiene");
  di(/^ {4}const detector = new BarcodeDetector/m.test(GUION),
     "y dentro de su rama sí, que es donde hace falta");
}

console.log("\n2 · SIN BarcodeDetector —COMO SAFARI— EL ESCÁNER ARRANCA IGUAL");
{
  let intervalos = 0, miradas = 0;
  const nodo = (id) => ({ id, style: {}, textContent: "", value: "", srcObject: null,
    hidden: false, className: "", classList: { add() {}, remove() {}, toggle() {} },
    videoWidth: 640, videoHeight: 480, play: () => Promise.resolve(),
    getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }) }),
    setAttribute() {}, addEventListener() {}, appendChild(x) { return x; },
    querySelector: () => nodo("q"), querySelectorAll: () => [],
    scrollIntoView() {}, focus() {}, closest: () => null });
  const nodos = {};
  const ctx = {
    /* Un navegador sin `BarcodeDetector`: eso es un iPad. */
    window: { addEventListener() {} },
    document: {
      getElementById: (id) => (nodos[id] = nodos[id] || nodo(id)),
      createElement: () => nodo("lienzo"),
      querySelector: () => nodo("q"), addEventListener() {},
      hidden: false, body: { classList: { add() {}, remove() {} } },
    },
    navigator: {
      onLine: true,
      mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    },
    Worker: function () { this.postMessage = () => {}; this.terminate = () => {}; },
    setInterval: (fn) => { intervalos++; miradas++; try { fn(); } catch (_) {} return 1; },
    clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
    addEventListener() {}, removeEventListener() {}, requestAnimationFrame: () => 0,
    location: { pathname: "/conduce.html", hash: "", search: "", replace() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console: { ...console, warn() {}, info() {}, error() {} },
    alert() {}, confirm: () => true, fetch: async () => ({ ok: false }),
    URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
    Image: function () { this.src = ""; },
  };
  /* Las piezas que el guion espera de core.js y que aquí no hacen falta. */
  const relleno = [
    "var db = { tests: [], dayMeta: {}, project: {}, proyectos: [], plan: {} };",
    "function toast(){} function esc(s){return s} function uid(){return 'u'}",
    "function todayISO(){return '2026-08-30'} function nowHM(){return '07:00'}",
    "function diaActivo(){return '2026-08-30'} function testsOfDate(){return []}",
    "function saveDB(){} function num(v){return Number(v)||null}",
    "function qcApiURL(){return ''} function qcApiToken(){return ''}",
    "function plantCompany(){return 'Concre-Tech'} function nextTestN(){return 1}",
    "function planDe(){return {uw:{}}} function fmtDate(d){return d}",
    "function findConduce(){return null} function frenoDiaCerrado(){return false}",
    "function losasDelDia(){return {lista:[]}} function nombrePieza(){return 'Losa'}",
    "function proyectoActivo(){return 'pr-52'} function recepcionAparte(){return true}",
    "function es934(){return false} function puedeEditarDia(){return true}",
    "function tiroCerrado(){return null} function tiroDescartado(){return false}",
    "function qcVeConfig(){return true} function estadoBadge(){return ''}",
    "function loadDB(){return null}",
    "function initTheme(){return null}",
    "function mountThemeToggle(){return null}",
    "function mountStatusBar(){return null}",
    "function enableLiveSync(){return null}",
    "function fmt(){return null}",
  ].join("\n");

  let arranco = false, error = null;
  try {
    const f = new Function(...Object.keys(ctx), relleno + "\n" + GUION + "\n;return { startScan };");
    const api = f(...Object.values(ctx));
    /* `startScan` es async: si revienta por dentro, la promesa se rompe. Aquí
       eso se ve — que es justo lo que no se veía en el iPad. */
    api.startScan().then(() => { arranco = true; }, (e) => { error = e; });
  } catch (e) { error = e; }

  await new Promise((r) => setTimeout(r, 60));
  di(!error, error ? `revienta: ${error.message}` : "startScan() no revienta sin BarcodeDetector");
  di(intervalos === 1, `y arma el temporizador que mira los fotogramas: ${intervalos}`);
  di(miradas > 0, "o sea que de verdad llega a mirar la cámara");
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
