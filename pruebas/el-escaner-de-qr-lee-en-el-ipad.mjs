/* ============================================================
   EL ESCÁNER DE QR TIENE QUE LEER EN EL IPAD — Q-161, y el lector
   compartido de Q-163.

   `startScan()` tenía dos caminos desde Q-80: `BarcodeDetector`, que trae
   Chrome de Android y resuelve el sistema, y el lector propio en un Worker,
   que es el que usa Safari porque no trae el otro.

   Entre los dos caminos y el `setInterval` había quedado una línea suelta de la
   versión anterior:

       const detector = new BarcodeDetector({ formats: [...] });

   FUERA del `if`. En Chrome no se nota: construye un detector que nadie usa.
   En Safari `BarcodeDetector` no existe, así que lanza `ReferenceError` antes
   de armar el temporizador — y como la función es `async`, la promesa se rompe
   sin decir nada.

   O sea: **en el iPad de obra la cámara se abría y no leía un código jamás**, y
   el único aparato donde funcionaba era el que no está en la obra.

   > Una rama que solo corre en el navegador que no está en obra no está
   > probada.

   Desde Q-163 el lector es uno solo y lo comparten Recepción y Muestras, así
   que esta prueba lo prueba a él — que es lo que había que conseguir: que
   arreglar el escáner una vez lo arregle en las dos pantallas.
   ============================================================ */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const QR = createRequire(import.meta.url)(join(RAIZ, "assets/qr-conduce.js"));

/* El contrato del conduce es un guion de navegador, sin exportaciones: se
   evalúa y se deja donde el módulo lo busca —suelto—, que es como lo encuentra
   en la página. Sin él, el lector cae al respaldo delimitado y la dirección del
   contrato no se entiende: exactamente lo que pasaba antes de Q-163. */
{
  const src = readFileSync(join(RAIZ, "shared/conduce-contract.js"), "utf8");
  const dentro = new Function(src + "\n;return { decodeConduceQR };")();
  globalThis.decodeConduceQR = dentro.decodeConduceQR;
}

let fallos = 0;
const di = (ok, t) => { console.log(`  ${ok ? "✓" : "✗"} ${t}`); if (!ok) fallos++; };

console.log("\n1 · NADA QUE NOMBRE BarcodeDetector VIVE FUERA DE SU RAMA");
{
  const src = readFileSync(join(RAIZ, "assets/qr-conduce.js"), "utf8");
  /* Dentro del `if` la sangría es de cuatro; en el ámbito de la función, dos.
     Ahí es donde estaba la línea que se comía el escáner del iPad. */
  di(!/^ {2}(const|let|var)[^\n]*BarcodeDetector/m.test(src),
     "no se construye ninguno en el ámbito de la función");
  di(/^ {4}const detector = new BarcodeDetector/m.test(src),
     "y dentro de su rama sí, que es donde hace falta");

  /* Y que no haya quedado una segunda copia en Recepción: el sentido de
     Q-163 es que exista UN lector, no dos parecidos. */
  const rec = readFileSync(join(RAIZ, "conduce.html"), "utf8");
  di(!/BarcodeDetector/.test(rec), "y Recepción ya no lleva su propia copia");
  di(/escanearQR\(/.test(rec) && /pararQR\(/.test(rec), "sino que llama a la compartida");
}

console.log("\n2 · SIN BarcodeDetector —COMO SAFARI— EL ESCÁNER ARRANCA IGUAL");
{
  let intervalos = 0, miradas = 0, avisos = "";
  const video = { srcObject: null, videoWidth: 640, videoHeight: 480, play: async () => {} };
  const wrap = { style: {} };
  const nota = { set textContent(v) { avisos = v; }, get textContent() { return avisos; } };

  /* Un navegador sin `BarcodeDetector`: eso es Safari, y eso es el iPad. */
  globalThis.window = {};
  globalThis.location = { protocol: "https:" };
  /* `navigator` en Node solo tiene lector: se define encima, que para eso se
     puede reconfigurar. Asignarlo a secas revienta con «has only a getter». */
  Object.defineProperty(globalThis, "navigator", { configurable: true,
    value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } } });
  globalThis.document = { createElement: () => ({
    getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }) }) }) };
  globalThis.Worker = function () { this.postMessage = () => {}; this.terminate = () => {}; };
  globalThis.alert = () => {};
  const setIntervalReal = globalThis.setInterval;
  globalThis.setInterval = (fn) => { intervalos++; miradas++; try { fn(); } catch (_) {} return 1; };
  globalThis.clearInterval = () => {};

  let error = null, arranco = false;
  try { arranco = await QR.escanearQR({ wrap, video, nota, alLeer: () => {} }); }
  catch (e) { error = e; }
  globalThis.setInterval = setIntervalReal;

  di(!error, error ? `revienta: ${error.message}` : "escanearQR() no revienta sin BarcodeDetector");
  di(arranco === true, "y dice que arrancó");
  di(intervalos === 1, `arma el temporizador que mira los fotogramas: ${intervalos}`);
  di(miradas > 0, "o sea que de verdad llega a mirar la cámara");
  di(wrap.style.display === "block", "y enseña la cámara, que es lo que el técnico tiene que ver");
}

console.log("\n3 · UN CÓDIGO SE ENTIENDE, Y UNO DE FUERA NO SE OBEDECE");
{
  const c = (raw, hosts) => QR.leerCodigoDeConduce(raw, hosts);

  const json = c('{"ticket":"69298","truck":"116","vol":"10","batch":"6:50"}');
  di(json && json.tipo === "campos" && json.campos.ticket === "69298",
     `el JSON de siempre: ticket ${json && json.campos.ticket}`);
  di(json.campos.batch === "06:50", `y la hora se normaliza: ${json.campos.batch}`);

  const delim = c("69299;118;9.5;07:12");
  di(delim && delim.campos.truck === "118" && delim.campos.vol === 9.5,
     "el delimitado de los sistemas ajenos");

  /* La forma del contrato v4 —dirección con fragmento— la parseaba el contrato
     y Recepción no la usaba: tenía su propio desmontador. Ahora sí. */
  const url = c("https://qterapr.com/#v=4&k=x&tk=69300&tr=121&cy=10&mx=AC300503SX&bt=07:40");
  di(url && url.tipo === "campos" && url.campos.ticket === "69300",
     `y la dirección del contrato, que antes se perdía: ticket ${url && url.campos.ticket}`);
  di(url && url.campos.mix === "AC300503SX", "con su mezcla dentro");

  /* Q-82: un QR lo imprime cualquiera. Si apunta a un servidor que no es del
     proyecto, no se le pide nada — y se dice a dónde apuntaba. */
  const ajeno = c("https://cualquiera.example/c/abc123", ["qticket.example"]);
  di(ajeno && ajeno.tipo === "ajeno" && ajeno.host === "cualquiera.example",
     `un servidor de fuera no se obedece: ${ajeno && ajeno.host}`);
  const bueno = c("https://qticket.example/c/abc123", ["qticket.example"]);
  di(bueno && bueno.tipo === "qticket", "y el del proyecto sí");
  di(c("https://qticket.example/c/abc123", []).tipo === "ajeno",
     "sin lista declarada no se pide nada a nadie: puerta cerrada");
  di(c("http://qticket.example/c/abc123", ["qticket.example"]) === null ||
     c("http://qticket.example/c/abc123", ["qticket.example"]).tipo !== "qticket",
     "y por http tampoco, salvo en local");

  /* Con `code_128` y `code_39` encendidos, en una obra el escáner ve códigos
     de barras de todo: paletas, piezas, extintores. Ninguno es un conduce. */
  di(c("cualquier cosa") === null, "un texto cualquiera NO pasa por número de conduce");
  di(c("PALLET-ID 4471/ACME WAREHOUSE") === null, "ni la etiqueta de una paleta");
  di(c("https://otro.example/pagina") === null, "ni una dirección que no es un conduce");
  di(c("") === null, "y el vacío tampoco revienta");
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
