-- =============================================================
--  Base de datos del portafolio de Edward Mesa
--  Motor: MySQL 8+ / MariaDB 10.5+
--
--  Uso:
--    mysql -u root -p < database/portafolio.sql
-- =============================================================

DROP DATABASE IF EXISTS portafolio;
CREATE DATABASE portafolio
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE portafolio;

-- -------------------------------------------------------------
-- Servicios ofrecidos (sección "Mis Servicios")
-- -------------------------------------------------------------
CREATE TABLE servicios (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titulo      VARCHAR(100) NOT NULL,
  descripcion TEXT,
  icono       VARCHAR(60),               -- clase de Font Awesome
  orden       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Habilidades con su nivel en % (sección "Mis Habilidades")
-- -------------------------------------------------------------
CREATE TABLE habilidades (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre    VARCHAR(60) NOT NULL UNIQUE,
  icono     VARCHAR(60),
  nivel     TINYINT UNSIGNED NOT NULL,
  orden     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT chk_nivel CHECK (nivel BETWEEN 0 AND 100)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Proyectos (sección "Mis Proyectos")
-- -------------------------------------------------------------
CREATE TABLE proyectos (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(120) NOT NULL,
  descripcion  TEXT,
  imagen_url   VARCHAR(255),
  demo_url     VARCHAR(255),
  repo_url     VARCHAR(255),
  fecha        DATE,
  destacado    BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Relación muchos a muchos: qué habilidades se usaron en cada proyecto
CREATE TABLE proyecto_habilidad (
  proyecto_id  INT UNSIGNED NOT NULL,
  habilidad_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (proyecto_id, habilidad_id),
  FOREIGN KEY (proyecto_id)  REFERENCES proyectos(id)   ON DELETE CASCADE,
  FOREIGN KEY (habilidad_id) REFERENCES habilidades(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Mensajes del formulario de contacto
-- (campos: Nombres, Email, Asunto, Mensaje)
-- -------------------------------------------------------------
CREATE TABLE mensajes_contacto (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombres    VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL,
  asunto     VARCHAR(150),
  mensaje    TEXT NOT NULL,
  leido      BOOLEAN NOT NULL DEFAULT FALSE,
  enviado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_leido (leido)
) ENGINE=InnoDB;

-- =============================================================
--  Datos iniciales (tomados de index.html)
-- =============================================================
INSERT INTO servicios (titulo, descripcion, icono, orden) VALUES
  ('Diseño Web',      'Sitios web modernos y responsivos.',           'fab fa-accusoft',     1),
  ('Automatizacion',  'Automatización de procesos y tareas web.',     'fas fa-chart-line',   2),
  ('Diseño de Apps',  'Diseño de interfaces para aplicaciones.',      'fas fa-blender-phone',3);

INSERT INTO habilidades (nombre, icono, nivel, orden) VALUES
  ('HTML5',              'fab fa-html5',       95, 1),
  ('CSS3',               'fab fa-css3',        85, 2),
  ('JavaScript',         'fab fa-js',          90, 3),
  ('Automatizacion Web', 'fas fa-cogs',        80, 4),
  ('UI/UX',              'fas fa-paint-brush', 95, 5);

INSERT INTO proyectos (nombre, descripcion, fecha, destacado) VALUES
  ('Portafolio personal', 'Sitio web responsivo para mostrar mis servicios y proyectos.', CURDATE(), TRUE);

INSERT INTO proyecto_habilidad (proyecto_id, habilidad_id)
SELECT p.id, h.id
FROM proyectos p
JOIN habilidades h ON h.nombre IN ('HTML5', 'CSS3', 'JavaScript')
WHERE p.nombre = 'Portafolio personal';

-- =============================================================
--  Consultas de ejemplo
-- =============================================================
-- Mensajes sin leer, del más reciente al más antiguo:
--   SELECT * FROM mensajes_contacto WHERE leido = FALSE ORDER BY enviado_en DESC;
--
-- Proyectos con las tecnologías usadas:
--   SELECT p.nombre, GROUP_CONCAT(h.nombre ORDER BY h.orden SEPARATOR ', ') AS tecnologias
--   FROM proyectos p
--   LEFT JOIN proyecto_habilidad ph ON ph.proyecto_id = p.id
--   LEFT JOIN habilidades h ON h.id = ph.habilidad_id
--   GROUP BY p.id;
