/* ============================================================
   RECIBIR UN CAMIÓN — Q-136, 29 de agosto de 2026.

   Víctor, después de ver el primer tiro de verdad: «no es necesario tener una
   recepción, porque en este tiro el técnico es quien recibe el camión en la
   estación de muestras».

   Aquí vive lo mínimo para apuntar la llegada de un camión desde cualquier
   pantalla: leer el conduce de una foto y escribir la ficha. Recepción sigue
   teniendo lo suyo —la rejilla, los sellos de hora, el reparto entre losas—;
   esto es el hueso, para que Muestras pueda recibir sin que el técnico cambie
   de pantalla con las manos sucias.

   LO QUE NO HACE, Y ES A PROPÓSITO: no decide nada. Devuelve lo que leyó y lo
   escribe cuando alguien se lo pide. El veredicto, los límites y la
   comprobación de las yardas ordenadas siguen donde estaban.
   ============================================================ */

/* Lee el conduce de una foto. Devuelve los campos que el modelo leyó con
   seguridad; lo que no, viene en `null` — nunca inventado (Q-01). */
async function leerConduce(dataUrl) {
  const api = typeof qcApiURL === "function" ? qcApiURL() : "";
  if (!api) return { error: "sin-servidor" };
  const cab = { "Content-Type": "application/json" };
  const tk = typeof qcApiToken === "function" ? qcApiToken() : "";
  if (tk) cab["X-QC-Token"] = tk;
  const ses = localStorage.getItem("qc-sesion");
  if (ses) cab["X-QC-Sesion"] = ses;
  try {
    const r = await fetch(api + "/api/leer-conduce", {
      method: "POST", headers: cab,
      body: JSON.stringify({ imagen: String(dataUrl).split(",")[1], tipo: "image/jpeg" }),
    });
    const d = await r.json();
    if (!r.ok) return { error: (d && d.error) || "servidor" };
    return { campos: d.campos || {} };
  } catch (_) {
    return { error: "sin-senal" };
  }
}

/* Escribe la ficha del camión y la devuelve. El día, la obra, la concretera y
   el objetivo de unit weight NO se preguntan: salen del tiro y del plan, que es
   donde viven. Un dato que el técnico no decide no se le pregunta. */
function recibirCamion(v) {
  const dia = (typeof diaActivo === "function" ? diaActivo() : todayISO());
  const tiro = (db.dayMeta || {})[dia] || {};
  const obra = tiro.proyecto || (typeof proyectoActivo === "function" ? proyectoActivo() : "pr-52");
  const plan = (typeof planDe === "function" ? planDe(dia) : null) || db.plan || {};

  const t = {
    n: nextTestN(), id: uid(),
    date: dia,
    proyecto: obra,
    ticket: (v.ticket || "").trim() || null,
    truck: (v.truck || "").trim() || null,
    vol: num(v.vol),
    plant: (v.plant || "").trim() || null,
    company: (v.company || "").trim()
      || (db.project && db.project.concretera) || null,
    mix: (v.mix || "").trim() || tiro.mix || null,
    batch: v.batch || null,
    arrive: v.arrive || (typeof nowHM === "function" ? nowHM() : null),
    ident: (v.ident || "").trim() || null,
    uwTarget: (plan.uw || {}).target,
    ordenadas: v.ordenadas != null ? num(v.ordenadas) : null,
    source: v.source || "manual",
    rejected: false,
  };
  if (v.photo) t.photo = v.photo;

  db.tests.push(t);
  saveDB();
  return t;
}

/* Reduce una foto para mandarla: la que se lee va grande, la que se guarda
   pequeña. Misma idea que en Recepción — leer necesita detalle, guardar no. */
function reducirFoto(img, ancho, calidad) {
  const c = document.createElement("canvas");
  const e = Math.min(1, ancho / img.naturalWidth);
  c.width = Math.round(img.naturalWidth * e);
  c.height = Math.round(img.naturalHeight * e);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", calidad);
}
