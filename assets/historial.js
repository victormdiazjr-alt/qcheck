/* ============================================================
   TRAER EL RESTO DEL EXPEDIENTE — a mano, y solo por esta sesión.

   Víctor, 29 de agosto de 2026: «lo de darle load al resto del database que sea
   en las ventanas que hablamos. Y sea dándole a un botón o buscando info para
   antes de 60 días. No automático. Y que sea solo por esa sesión».

   El aparato lleva encima los últimos 60 días (Q-150). Aquí está la puerta para
   lo anterior, en las tres pantallas que existen para mirar atrás: Results,
   Reportes y la de la Autoridad.

   TRES REGLAS, Y LAS TRES SON SUYAS
   ---------------------------------
   · **A MANO.** No se trae nada al abrir la pantalla. Se trae cuando alguien lo
     pide, porque bajarse años de expediente con la señal de la obra es una
     decisión, no un efecto secundario de haber entrado a mirar.
   · **O AL BUSCAR ATRÁS.** Si alguien elige un día anterior a la ventana, el
     botón se enciende y lo dice — pero sigue sin traer nada solo. Se avisa de
     que eso está en el servidor; darle o no es de quien mira.
   · **SOLO POR ESTA SESIÓN.** Lo que se trae va a memoria y no se guarda: ni en
     el aparato ni en la copia de referencia del expediente. Al recargar, el
     aparato vuelve a sus 60 días. Así traer el histórico para mirar una carta
     no convierte al iPad en el archivo de la obra otra vez.

   Y CUANDO NO HAY COBERTURA SE DICE. Una pantalla de resultados que enseña
   medio expediente sin avisar es peor que una que reconoce que no puede: quien
   la mire se la va a creer entera, y esto es un documento de calidad.
   ============================================================ */
"use strict";

/* Vive en memoria a propósito: se va con la pestaña, que es lo que se pidió. */
let _historialEnMemoria = false;

function historialCargado() { return _historialEnMemoria; }

function ventanaDias() {
  return Number(localStorage.getItem("qc-ventana-dias") || 60) || 60;
}

function diaFueraDeLaVentana(dia) {
  if (!dia || _historialEnMemoria) return false;
  const corte = new Date(Date.now() - ventanaDias() * 86400000).toISOString().slice(0, 10);
  return String(dia).slice(0, 10) < corte;
}

/* La barra. Se mete arriba del contenido y se pinta sola según el estado. */
function pintarBarraHistorial(alTerminar) {
  if (typeof qcSyncActivo === "function" && !qcSyncActivo()) return;
  if (document.getElementById("qc-hist")) return;

  const b = document.createElement("div");
  b.id = "qc-hist";
  b.style.cssText =
    "display:flex;align-items:center;gap:12px;flex-wrap:wrap;" +
    "margin:10px auto;max-width:1200px;padding:9px 14px;border-radius:8px;" +
    "background:var(--panel,#12171f);border:1px solid var(--line,rgba(255,255,255,.10));" +
    "font:500 13px/1.45 system-ui,-apple-system,sans-serif;color:var(--ink-soft,#77848f)";

  const txt = document.createElement("span");
  txt.id = "qc-hist-txt";
  txt.textContent = "Se ven los últimos " + ventanaDias() + " días. Lo anterior está en el servidor.";

  const bot = document.createElement("button");
  bot.id = "qc-hist-bot";
  bot.type = "button";
  bot.textContent = "Traer el histórico completo";
  bot.style.cssText =
    "margin-left:auto;padding:7px 14px;border-radius:6px;cursor:pointer;" +
    "border:1px solid var(--accent,#4a63d8);background:transparent;" +
    "color:var(--accent,#4a63d8);font:600 13px system-ui,sans-serif";

  bot.addEventListener("click", async () => {
    bot.disabled = true;
    bot.textContent = "Trayendo…";
    txt.textContent = "Bajando el resto del expediente…";
    const r = await QCSync.traerHistorial();
    if (r.ok) {
      _historialEnMemoria = true;
      bot.remove();
      txt.textContent = "Histórico completo cargado — solo mientras esta pestaña siga abierta.";
      b.style.borderColor = "var(--ok,#2e7d52)";
      if (typeof alTerminar === "function") alTerminar();
      return;
    }
    bot.disabled = false;
    bot.textContent = "Reintentar";
    /* Sin cobertura no se disimula: se dice lo que se está viendo y lo que no. */
    txt.textContent = r.motivo === "sin-senal"
      ? "Sin cobertura: no se pudo traer. Solo se ven los últimos " + ventanaDias() + " días."
      : "No se pudo traer el histórico. Solo se ven los últimos " + ventanaDias() + " días.";
    b.style.borderColor = "var(--susp,#c0392b)";
  });

  b.appendChild(txt);
  b.appendChild(bot);

  const app = document.getElementById("app") || document.querySelector("main");
  if (app && app.parentNode) app.parentNode.insertBefore(b, app);
  else document.body.insertBefore(b, document.body.firstChild);

  /* «O buscando info para antes de 60 días»: si alguien elige un día que no
     está encima, se enciende el aviso. Se ENCIENDE, no se trae — traerlo sigue
     siendo de quien mira. */
  document.addEventListener("change", (e) => {
    const v = e.target && e.target.value;
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(v || ""))) return;
    if (!diaFueraDeLaVentana(v)) return;
    const t = document.getElementById("qc-hist-txt");
    const q = document.getElementById("qc-hist-bot");
    if (!t || !q) return;
    t.textContent = "Ese día es anterior a los " + ventanaDias() + " días que lleva este aparato.";
    b.style.borderColor = "var(--act,#b8860b)";
    q.style.background = "var(--accent,#4a63d8)";
    q.style.color = "#fff";
  });
}
