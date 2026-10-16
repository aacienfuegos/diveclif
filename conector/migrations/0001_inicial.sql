-- Estado del conector de Dive Clif.

-- Una fila por propuesta. `correo` es la identidad que la creó: todo lo demás filtra por ella.
CREATE TABLE propuestas (
  id TEXT PRIMARY KEY,
  correo TEXT NOT NULL,
  slug TEXT NOT NULL,
  rama TEXT NOT NULL DEFAULT '',
  pr INTEGER NOT NULL DEFAULT 0,
  -- Último SHA que empujó el Worker.
  sha TEXT NOT NULL DEFAULT '',
  -- 1 si el viaje no existe en main.
  nuevo INTEGER NOT NULL,
  -- Fecha del PR (ISO), para la regla de fechas.
  creada TEXT NOT NULL,
  -- Último commit del Worker en esta propuesta, en milisegundos.
  ultimo_commit INTEGER NOT NULL DEFAULT 0,
  -- preparando | compilando | lista | no-publicable | esperando-andres | publicada | cerrada
  estado TEXT NOT NULL,
  -- Motivos como códigos (JSON); se traducen a frases fijas al enseñarlos.
  motivos TEXT NOT NULL DEFAULT '[]',
  -- SHA con el visto bueno de quien la pidió.
  visto_bueno TEXT,
  -- Avisos ya enviados, "<sha>:<estado>" (JSON).
  avisos TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX propuestas_correo ON propuestas (correo);
-- Como mucho una propuesta abierta por viaje.
CREATE UNIQUE INDEX propuestas_abierta_por_slug ON propuestas (slug) WHERE estado NOT IN ('publicada', 'cerrada');

-- Token del botón "Publicar": solo su hash, ligado a PR, SHA y correo. Se consume con DELETE ... RETURNING.
CREATE TABLE tokens_publicar (
  hash TEXT PRIMARY KEY,
  pr INTEGER NOT NULL,
  sha TEXT NOT NULL,
  correo TEXT NOT NULL,
  -- Milisegundos.
  caduca INTEGER NOT NULL
);

-- Límites: se comprueban y se suman en la misma sentencia.
CREATE TABLE contadores (
  clave TEXT NOT NULL,
  tipo TEXT NOT NULL,
  periodo TEXT NOT NULL,
  cuenta INTEGER NOT NULL,
  PRIMARY KEY (clave, tipo, periodo)
);
