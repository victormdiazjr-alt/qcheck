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
