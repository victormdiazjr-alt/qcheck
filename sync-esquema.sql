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

-- Para la instantánea que estrena un aparato — Q-141, y el índice, Q-150.
--
-- `/api/estado` pregunta "de cada (ent, id, campo), ¿cuál es la última?", y el
-- índice de arriba no sirve para eso: agrupa por `seq`, no por `campo`. Con el
-- registro de hoy son 0,9 s y no molesta; con tres años de uso diario —unos
-- 400.000 apuntes— sí, y se nota justo donde peor: un aparato estrenándose en
-- obra con un camión esperando.
--
-- Se aplica con:
--   npx wrangler d1 execute qcheck --remote --file sync-esquema.sql
CREATE INDEX IF NOT EXISTS ops_estado ON ops (ent, id, campo, seq);

-- Y para recortar la ventana de días: `/api/estado?dias=60` busca los ensayos
-- cuya fecha entra en la ventana antes de armar nada.
CREATE INDEX IF NOT EXISTS ops_fecha ON ops (ent, campo, valor);

-- Quién está usando QCheck ahora mismo.
--
-- Una fila por aparato, y se PISA: aquí no hay expediente que guardar, es una
-- foto del momento. Cada aparato manda un latido cada 20 segundos diciendo en
-- qué pantalla está; el que deja de latir desaparece solo.
--
-- Las horas las pone el SERVIDOR, no el aparato. El reloj de un iPad en la
-- obra puede ir descuadrado, y entonces «conectado hace 3 horas» sería mentira.
-- `fuera` — Q-77. Cuando Víctor desconecta un aparato desde Estado del
-- sistema, aquí queda la hora. El aparato se entera en su siguiente latido:
-- el servidor le contesta que está fuera, él cierra la sesión y vuelve a la
-- pantalla de acceso, y la marca se limpia al entregarla.
--
-- Queda esperando a propósito. Si el iPad está apagado o sin señal, la orden
-- no se pierde: se cumple en cuanto vuelva. Una desconexión que solo funciona
-- si el aparato está mirando no sirve para lo que se pide de ella.
CREATE TABLE IF NOT EXISTS presencia (
  dev    TEXT PRIMARY KEY,   -- el nombre que se le puso al aparato
  usr    TEXT,               -- quién tiene la sesión abierta
  pagina TEXT,               -- en qué pantalla está
  desde  TEXT NOT NULL,      -- cuándo empezó ESTA sesión
  visto  TEXT NOT NULL,      -- último latido
  fuera  TEXT                -- desconectado a mano; null mientras no lo esté
);
CREATE INDEX IF NOT EXISTS presencia_visto ON presencia (visto);

-- Para las bases que ya existían antes de Q-77. D1 no tiene `ADD COLUMN IF NOT
-- EXISTS`, así que esta línea da error «duplicate column» en una base ya
-- migrada — es el error correcto y se ignora sin más.
ALTER TABLE presencia ADD COLUMN fuera TEXT;

-- ============================================================ Q-07
--
-- Quién es cada quien, de verdad.
--
-- Hasta aquí, el `usr` de cada fila de `ops` era lo que el aparato DECÍA
-- que era: viajaba en el cuerpo del POST y nadie lo comprobaba. Con eso,
-- cualquiera con el enlace de conexión podía escribir una línea firmada
-- «ruben». Un registro que no se puede borrar pero sí firmar con el nombre
-- de otro no es un expediente: es un cuaderno anónimo.
--
-- Desde Q-07 el `usr` lo pone el SERVIDOR, sacado de la sesión. El aparato
-- ya no tiene voz en quién firma.

CREATE TABLE IF NOT EXISTS usuarios (
  usr     TEXT PRIMARY KEY,        -- en minúsculas, como se teclea
  nombre  TEXT NOT NULL,           -- «Rubén Segarra», lo que se enseña
  rol     TEXT NOT NULL,           -- qc · consulta
  tablero INTEGER NOT NULL DEFAULT 0,  -- ¿salta del portal al Control Center?
  config  INTEGER NOT NULL DEFAULT 0,  -- ¿ve «Plan & Datos» y «Estado del sistema»?
  limites INTEGER NOT NULL DEFAULT 0,  -- ¿ve «Settings»? (los límites del plan) — Q-37
  casa    TEXT,                        -- tablero único donde vive esta cuenta — Q-37
  firma   INTEGER NOT NULL DEFAULT 0,  -- ¿ingeniero de récord? toca vaciados cerrados — Q-41
  sal     TEXT NOT NULL,           -- 16 bytes en hex, distinta para cada quien
  hash    TEXT NOT NULL,           -- PBKDF2-SHA256 de la clave con esa sal
  vueltas INTEGER NOT NULL,        -- iteraciones; se guarda para poder subirlas después
  activo  INTEGER NOT NULL DEFAULT 1,
  creado  TEXT NOT NULL,
  visto   TEXT                     -- último acceso, para saber quién ya no usa esto
);

-- La clave NO se guarda, ni cifrada ni de ninguna otra forma: se guarda el
-- resultado de derivarla con PBKDF2-SHA256 y una sal propia de cada usuario.
-- Sin sal, dos personas con la misma clave dan el mismo hash y se ve a simple
-- vista. Las vueltas van en su columna porque el número correcto sube con los
-- años: guardarlo permite subirlo sin invalidar las claves que ya existen.

-- ------------------------------------------------------------ sesiones
--
-- Se guarda el HASH del token de sesión, no el token. Si algún día alguien se
-- lleva una copia de la base, con lo que hay aquí no puede entrar como nadie:
-- del hash no se saca el token. Es la misma razón por la que no se guardan las
-- claves, aplicada al pase de entrada.
--
-- `vence` es DESLIZANTE y se estira con cada uso. En obra un vaciado dura lo
-- que dura y la sincronización toca el servidor cada 3 segundos, así que una
-- sesión en uso no caduca nunca; la que caduca es la del aparato que se quedó
-- olvidado en la caseta. Una sesión que se cae en mitad de un tiro y devuelve
-- al técnico a la pantalla de acceso, con las manos sucias, es exactamente el
-- fallo que no nos podemos permitir.
CREATE TABLE IF NOT EXISTS sesiones (
  tk     TEXT PRIMARY KEY,   -- SHA-256 del token que lleva el aparato
  usr    TEXT NOT NULL,
  dev    TEXT,               -- de qué aparato se entró
  creada TEXT NOT NULL,
  vence  TEXT NOT NULL,
  visto  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sesiones_usr ON sesiones (usr);
CREATE INDEX IF NOT EXISTS sesiones_vence ON sesiones (vence);

-- ------------------------------------------------------------ ajustes
--
-- `exigir_sesion` es el interruptor de la mudanza, y existe porque esto entra
-- en un sistema que YA está en uso. Con la bandera apagada el servidor sigue
-- aceptando exactamente lo de antes —llave del proyecto y nada más—, pero si
-- el aparato ya trae sesión, el `usr` sale de ella. Así se dan de alta las
-- cuentas, se migran los aparatos uno por uno, y solo cuando todos están
-- dentro se enciende.
--
-- Encenderla de golpe el día que se crean los usuarios dejaría a Rubén fuera
-- en mitad de un vaciado, que es justo lo que no puede pasar.
CREATE TABLE IF NOT EXISTS ajustes (
  clave TEXT PRIMARY KEY,
  valor TEXT
);
