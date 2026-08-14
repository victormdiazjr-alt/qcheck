/* ¿El lector reintenta cuando el fallo se arregla solo, y NO reintenta cuando no?
   Se carga el worker DE VERDAD y se le cambia `fetch` por uno de mentira que
   cuenta llamadas. No se prueba una copia de la lógica: se prueba la que corre. */
import worker from "../sync-worker.js";

const IMG = "R0lGODlhAQABAAAAACw=";           // un pixel, vale para el camino
const env = {
  QC_ANTHROPIC: "llave-de-mentira",
  /* Base de mentira: `first` y `all` existen en los DOS niveles —con `bind()` y
     sin él— porque el worker los llama de las dos formas. Devolver `null` deja
     `exigeSesion` en falso, que es lo que hace falta para llegar al lector. */
  DB: (() => {
    const hoja = { all: async () => ({ results: [] }), first: async () => null,
                   run: async () => ({}) };
    const nodo = { ...hoja, bind: () => nodo };
    return { prepare: () => nodo, batch: async () => [] };
  })(),
};

function pide() {
  return new Request("https://x/api/leer-conduce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imagen: IMG, tipo: "image/jpeg" }),
  });
}

/* `respuestas` se van dando por orden; la última se repite si hacen falta más. */
async function corre(respuestas) {
  let llamadas = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async () => {
    const r = respuestas[Math.min(llamadas, respuestas.length - 1)];
    llamadas++;
    if (r === "revienta") throw new Error("red caida");
    if (typeof r === "number") return new Response("{}", { status: r });
    return new Response(JSON.stringify(r), { status: 200,
      headers: { "Content-Type": "application/json" } });
  };
  const t0 = Date.now();
  const res = await worker.fetch(pide(), env, { waitUntil(){} });
  globalThis.fetch = real;
  return { llamadas, status: res.status, cuerpo: await res.json(), ms: Date.now() - t0 };
}

let fallos = 0;
const di = (ok, txt) => { console.log(`  ${ok ? "✓" : "✗"} ${txt}`); if (!ok) fallos++; };
const BIEN = { content: [{ type: "text", text: JSON.stringify({ ticket: "1917", vol: 8.5 }) }],
               usage: {}, stop_reason: "end_turn" };

console.log("\nUn tropiezo y luego bien — LO DE RUBÉN, primer camión");
{
  const o = await corre([529, BIEN]);
  di(o.llamadas === 2, `reintentó y salió: ${o.llamadas} llamadas`);
  di(o.status === 200, `devolvió 200 (antes daba 502): ${o.status}`);
  di(o.cuerpo.campos?.ticket === "1917", `y trae los campos: ticket ${o.cuerpo.campos?.ticket}`);
}

console.log("\nLa red se cae y luego vuelve");
{
  const o = await corre(["revienta", BIEN]);
  di(o.llamadas === 2, `reintentó: ${o.llamadas} llamadas`);
  di(o.status === 200, `salió bien: ${o.status}`);
}

console.log("\nFalla siempre — se rinde, y NO se queda ahí de pie");
{
  const o = await corre([503]);
  di(o.llamadas === 3, `tres intentos y para: ${o.llamadas}`);
  di(o.cuerpo.reintentos === 2, `dice cuántos reintentó: ${o.cuerpo.reintentos}`);
  di(o.ms < 4000, `tardó ${o.ms} ms — el camión no espera`);
}

console.log("\nLo que NO se arregla esperando: no se reintenta");
{
  const o = await corre([400]);
  di(o.llamadas === 1, `un solo intento con un 400: ${o.llamadas}`);
  const p = await corre([401]);
  di(p.llamadas === 1, `un solo intento con un 401: ${p.llamadas}`);
}

console.log("\nA la primera, sin reintentos de más");
{
  const o = await corre([BIEN]);
  di(o.llamadas === 1, `una llamada: ${o.llamadas}`);
  di(o.status === 200, `200: ${o.status}`);
}

console.log(fallos ? `\n${fallos} FALLO(S)\n` : "\nsin fallos\n");
process.exit(fallos ? 1 : 0);
