-- El registro de cambios de QCheck.
--
-- Una fila por cambio, y solo se añaden: nada se edita ni se borra. Si un
-- dato quedó mal se corrige con otra fila encima y las dos quedan, que es
-- lo que convierte esto en un expediente y no en una base de datos más.
--
-- `uid` es único a propósito: un aparato que reintenta porque se cayó la
-- señal justo al contestar manda la misma línea otra vez, y no debe entrar
-- dos veces. `INSERT OR IGNORE` se apoya en esto.

CREATE TABLE IF NOT EXISTS ops (
  seq   INTEGER PRIMARY KEY AUTOINCREMENT,
  uid   TEXT NOT NULL UNIQUE,
  ent   TEXT NOT NULL,          -- test · dayMeta · plan · project · humidity · config
  id    TEXT NOT NULL,          -- la llave del registro (id del ensayo, día, …)
  campo TEXT NOT NULL,
  valor TEXT,                   -- JSON: número, texto, false o un objeto entero
  ts    TEXT NOT NULL,          -- cuándo lo entró el técnico
  dev   TEXT,                   -- de qué aparato salió
  usr   TEXT                    -- quién estaba en sesión
);

-- Todas las consultas son "dame lo que pasó después de N".
CREATE INDEX IF NOT EXISTS ops_seq ON ops (seq);

-- Para la línea de tiempo de un conduce (Q-05).
CREATE INDEX IF NOT EXISTS ops_registro ON ops (ent, id, seq);

-- Quién está usando QCheck ahora mismo.
--
-- Una fila por aparato, y se PISA: aquí no hay expediente que guardar, es una
-- foto del momento. Cada aparato manda un latido cada 20 segundos diciendo en
-- qué pantalla está; el que deja de latir desaparece solo.
--
-- Las horas las pone el SERVIDOR, no el aparato. El reloj de un iPad en la
-- obra puede ir descuadrado, y entonces «conectado hace 3 horas» sería mentira.
CREATE TABLE IF NOT EXISTS presencia (
  dev    TEXT PRIMARY KEY,   -- el nombre que se le puso al aparato
  usr    TEXT,               -- quién tiene la sesión abierta
  pagina TEXT,               -- en qué pantalla está
  desde  TEXT NOT NULL,      -- cuándo empezó ESTA sesión
  visto  TEXT NOT NULL       -- último latido
);
CREATE INDEX IF NOT EXISTS presencia_visto ON presencia (visto);
