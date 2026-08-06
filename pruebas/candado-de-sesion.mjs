/* `exigir_sesion` de punta a punta — DECISIONS §20.
   Es la bandera que Víctor enciende en Q-30, el día que reparta las claves. Se prueba
   ANTES de ese día porque ese día siempre es un día de obra.
   Ver pruebas/LEEME.md para levantar el Worker local. */
/* ¿Qué pasa cuando se enciende `exigir_sesion`? Es lo próximo que hace Víctor
   (Q-30) y hasta hoy nunca se había probado de punta a punta. */
const W = "http://127.0.0.1:8462", TK = "llave-de-prueba", AD = "admin-de-prueba";
let ok = 0, mal = 0;
const t = (n, c, extra = "") => c ? (ok++, console.log("  ✓", n)) : (mal++, console.log("  ✗", n, extra));
const H = (x = {}) => ({ "Content-Type": "application/json", "X-QC-Token": TK, ...x });
const j = async (r) => { const x = await r.text(); try { return JSON.parse(x); } catch { return { _crudo: x.slice(0, 60) }; } };

console.log("\n  CANDADO DE SESIÓN (exigir_sesion)\n");

// cuenta de trabajo
await fetch(W + "/api/cuentas", { method: "POST", headers: H({ "X-QC-Admin": AD }),
  body: JSON.stringify({ usr: "tec", clave: "clave-larga-1234", rol: "qc", nombre: "Técnico" }) });

const conCandado = async (on) => {
  await fetch(W + "/api/cuentas", { method: "POST", headers: H({ "X-QC-Admin": AD }),
    body: JSON.stringify({ exigir_sesion: on }) });
  return (await j(await fetch(W + "/api/salud", { headers: H() }))).sesiones;
};

t("apagado de fábrica", (await conCandado(false)) === false);

// con el candado APAGADO: se puede escribir solo con la llave
let r = await fetch(W + "/api/cambios", { method: "POST", headers: H(),
  body: JSON.stringify({ ops: [{ uid: "c1", ent: "test", id: "1", campo: "slump", valor: 4, ts: new Date(Date.UTC(2026,7,6)).toISOString(), dev: "d", usr: "colado" }] }) });
t("apagado: la llave sola escribe", r.status === 200);

t("encendido", (await conCandado(true)) === true);

// con el candado ENCENDIDO
r = await fetch(W + "/api/cambios", { method: "POST", headers: H(),
  body: JSON.stringify({ ops: [{ uid: "c2", ent: "test", id: "1", campo: "slump", valor: 5, ts: new Date(Date.UTC(2026,7,6)).toISOString(), dev: "d", usr: "colado" }] }) });
t("encendido: la llave sola YA NO escribe", r.status === 401, "→ " + r.status);

r = await fetch(W + "/api/cambios?desde=0", { headers: H() });
t("encendido: leer sin pase tampoco", r.status === 401, "→ " + r.status);

const s = await j(await fetch(W + "/api/sesion", { method: "POST", headers: H(), body: JSON.stringify({ usr: "tec", clave: "clave-larga-1234" }) }));
t("encendido: se puede entrar", !!s.tk);

const pase = H({ "X-QC-Sesion": s.tk });
r = await fetch(W + "/api/cambios", { method: "POST", headers: pase,
  body: JSON.stringify({ ops: [{ uid: "c3", ent: "test", id: "1", campo: "slump", valor: 6, ts: new Date(Date.UTC(2026,7,6)).toISOString(), dev: "d", usr: "MENTIRA" }] }) });
t("con pase: escribe", r.status === 200, "→ " + r.status);

const ult = await j(await fetch(W + "/api/actividad?n=1", { headers: pase }));
t("la firma la pone el servidor, no el cuerpo", ult.ops && ult.ops[0].usr === "tec", "→ " + (ult.ops && ult.ops[0] && ult.ops[0].usr));

// una cuenta de solo mirar no debe poder escribir
await fetch(W + "/api/cuentas", { method: "POST", headers: H({ "X-QC-Admin": AD }),
  body: JSON.stringify({ usr: "mira", clave: "clave-larga-1234", rol: "consulta", nombre: "Mira", casa: "autoridad.html" }) });
const s2 = await j(await fetch(W + "/api/sesion", { method: "POST", headers: H(), body: JSON.stringify({ usr: "mira", clave: "clave-larga-1234" }) }));
t("la cuenta de mirar entra", !!s2.tk);
t("y trae su casa", s2.usuario && s2.usuario.casa === "autoridad.html", "→ " + (s2.usuario && s2.usuario.casa));
r = await fetch(W + "/api/cambios", { method: "POST", headers: H({ "X-QC-Sesion": s2.tk }),
  body: JSON.stringify({ ops: [{ uid: "c4", ent: "test", id: "1", campo: "slump", valor: 9, ts: new Date(Date.UTC(2026,7,6)).toISOString(), dev: "d", usr: "mira" }] }) });
t("la cuenta de mirar NO escribe en el expediente", r.status === 403, "→ " + r.status);

// pase inventado y pase cerrado
r = await fetch(W + "/api/cambios?desde=0", { headers: H({ "X-QC-Sesion": "inventado" }) });
t("pase inventado se rechaza", r.status === 401, "→ " + r.status);
await fetch(W + "/api/sesion/salir", { method: "POST", headers: pase, body: "{}" });
r = await fetch(W + "/api/cambios?desde=0", { headers: pase });
t("tras salir, el pase ya no vale", r.status === 401, "→ " + r.status);

await conCandado(false);
t("se puede volver a apagar", (await j(await fetch(W + "/api/salud", { headers: H() }))).sesiones === false);

console.log(`\n  ${ok} bien · ${mal} mal\n`);
process.exit(mal ? 1 : 0);
