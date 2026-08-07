/* Servidor local: sirve los archivos y monta la API de sincronización.

     node serve.js [puerto]

   Escucha en todas las interfaces, no solo en 127.0.0.1, para que el iPad y
   el teléfono de la obra puedan entrar por el IP de la máquina. El token se
   pone con la variable QC_TOKEN; sin él la puerta queda abierta, que en una
   red local es lo cómodo y de cara a internet no vale.

   QC_ADMIN es OTRO secreto y es el que da de alta cuentas (`node cuentas.js`).
   Va aparte de QC_TOKEN a propósito: la llave del proyecto viaja dentro del
   enlace de conexión que tiene Rubén, así que si sirviera también para crear
   usuarios, cualquiera que viera ese enlace podría crearse uno. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { crearAlmacen, montarAPI, crearCuentas } = require("./sync-servidor");

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8452;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const almacen = crearAlmacen(path.join(ROOT, "datos", "cambios.jsonl"));
const cuentas = crearCuentas(path.join(ROOT, "datos"));
const atenderAPI = montarAPI(almacen, process.env.QC_TOKEN || "", {
  cuentas,
  admin: process.env.QC_ADMIN || "",
  /* La llave que lee el conduce de la foto (Q-01). Sin ella, Recepción sigue
     funcionando a mano — que es como funciona hoy. */
  anthropic: process.env.QC_ANTHROPIC || "",
  /* La llave con la que QCheck manda correo (Q-39). Sin ella, la ruta de
     correo contesta 501 y nadie se entera de nada — que es lo correcto:
     mejor callar que hacer creer que un aviso salió. */
  correo: process.env.QC_CORREO || "",
  correoDe: process.env.QC_CORREO_DE || "",
});

http.createServer((req, res) => {
  if (atenderAPI(req, res)) return;

  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath.endsWith("/")) urlPath += "index.html";
  let file = path.normalize(path.join(ROOT, urlPath));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end("Not found"); return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, "0.0.0.0", () => {
  console.log(`QCheck en http://localhost:${PORT}`);
  for (const [nombre, dirs] of Object.entries(os.networkInterfaces())) {
    for (const d of dirs || []) {
      if (d.family === "IPv4" && !d.internal) console.log(`  desde la obra (${nombre}): http://${d.address}:${PORT}`);
    }
  }
  console.log(`  registro de cambios: ${almacen.total()} líneas · seq ${almacen.seq()}`);
});
