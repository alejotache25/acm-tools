-- =============================================================
-- ACM Tools - Supabase Schema
-- Run this script in the Supabase SQL editor
-- =============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- USUARIOS (authentication)
-- =============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL UNIQUE,
  pin         TEXT NOT NULL,  -- SHA-256 hash
  rol         TEXT NOT NULL CHECK (rol IN ('admin', 'jefe')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- OPERARIOS
-- =============================================================
CREATE TABLE IF NOT EXISTS operarios (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  email       TEXT,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- JEFE_OPERARIO (assignment)
-- =============================================================
CREATE TABLE IF NOT EXISTS jefe_operario (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jefe_id         UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  operario_nombre TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jefe_operario_jefe ON jefe_operario(jefe_id);

-- =============================================================
-- CONFIG (app settings)
-- =============================================================
CREATE TABLE IF NOT EXISTS config (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_url     TEXT DEFAULT '',
  nombre_empresa  TEXT DEFAULT 'ACM Tools',
  logo_url        TEXT DEFAULT ''
);

-- Insert default config row
INSERT INTO config (nombre_empresa) VALUES ('ACM Tools')
ON CONFLICT DO NOTHING;

-- =============================================================
-- 01 INCIDENCIAS
-- =============================================================
CREATE TABLE IF NOT EXISTS incidencias (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operario      TEXT NOT NULL,
  año           INTEGER NOT NULL,
  fecha         DATE NOT NULL,
  id_incidencia INTEGER,
  ot            INTEGER,
  incidencia    TEXT NOT NULL,
  puntos        INTEGER DEFAULT 10,
  observaciones TEXT,
  jefe_id       UUID REFERENCES usuarios(id),
  sync_pending  BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidencias_operario ON incidencias(operario);
CREATE INDEX IF NOT EXISTS idx_incidencias_fecha    ON incidencias(fecha);

-- =============================================================
-- 02 CONTROL CALIDAD
-- =============================================================
CREATE TABLE IF NOT EXISTS control_calidad (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero      SERIAL,
  fecha       DATE NOT NULL,
  ot          INTEGER,
  operario    TEXT NOT NULL,
  cliente     TEXT,
  descripcion TEXT,
  tipo_cq     TEXT,
  horas       NUMERIC(6,2)  DEFAULT 0,
  importe_h   NUMERIC(8,2)  DEFAULT 0,
  materiales  NUMERIC(8,2)  DEFAULT 0,
  total_cq    NUMERIC(8,2)  DEFAULT 0,
  jefe_id     UUID REFERENCES usuarios(id),
  sync_pending BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cq_operario ON control_calidad(operario);
CREATE INDEX IF NOT EXISTS idx_cq_fecha    ON control_calidad(fecha);

-- =============================================================
-- 03 VISITAS
-- =============================================================
CREATE TABLE IF NOT EXISTS visitas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha       DATE NOT NULL,
  operario    TEXT NOT NULL,
  inspeccion  TEXT DEFAULT 'X PERICH',
  ot          INTEGER,
  tipo_visita TEXT,
  ok_visita   TEXT,
  jefe_id     UUID REFERENCES usuarios(id),
  sync_pending BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitas_operario ON visitas(operario);
CREATE INDEX IF NOT EXISTS idx_visitas_fecha    ON visitas(fecha);

-- =============================================================
-- 04 LIMPIEZA
-- =============================================================
CREATE TABLE IF NOT EXISTS limpieza (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha                 DATE NOT NULL,
  operario              TEXT NOT NULL,
  vestuario_h           NUMERIC(4,1) DEFAULT 0,
  limpieza_vh           NUMERIC(4,1) DEFAULT 0,
  limpieza_vh_sorpresa  NUMERIC(4,1) DEFAULT 0,
  seguridad_t           NUMERIC(4,1) DEFAULT 0,
  herramientas          NUMERIC(4,1) DEFAULT 0,
  observaciones         TEXT,
  jefe_id               UUID REFERENCES usuarios(id),
  sync_pending          BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_limpieza_operario ON limpieza(operario);
CREATE INDEX IF NOT EXISTS idx_limpieza_fecha    ON limpieza(fecha);

-- =============================================================
-- 05 HORAS IMPRODUCTIVAS
-- =============================================================
CREATE TABLE IF NOT EXISTS horas_improductivas (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha                DATE NOT NULL,
  operario             TEXT NOT NULL,
  h_recg_mat           NUMERIC(6,2) DEFAULT 0,
  h_reunion            NUMERIC(6,2) DEFAULT 0,
  h_mant_furgos        NUMERIC(6,2) DEFAULT 0,
  h_mant_instalaciones NUMERIC(6,2) DEFAULT 0,
  h_formacion          NUMERIC(6,2) DEFAULT 0,
  consumibles_e        NUMERIC(8,2) DEFAULT 0,
  observaciones        TEXT,
  jefe_id              UUID REFERENCES usuarios(id),
  sync_pending         BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_horas_operario ON horas_improductivas(operario);
CREATE INDEX IF NOT EXISTS idx_horas_fecha    ON horas_improductivas(fecha);

-- =============================================================
-- 06 ISSUS
-- =============================================================
CREATE TABLE IF NOT EXISTS issus (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha       DATE NOT NULL,
  operario    TEXT NOT NULL,
  id_issus    INTEGER,
  tipo        TEXT,
  descripcion TEXT,
  jefe_id     UUID REFERENCES usuarios(id),
  sync_pending BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issus_operario ON issus(operario);
CREATE INDEX IF NOT EXISTS idx_issus_fecha    ON issus(fecha);

-- =============================================================
-- KPI RESUMEN (CONSOLIDADO_RESUMEN)
-- =============================================================
CREATE TABLE IF NOT EXISTS kpi_resumen (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente     TEXT NOT NULL,
  mes        INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  año        INTEGER NOT NULL,
  importe    NUMERIC(10,2) DEFAULT 0,
  acumulado  NUMERIC(10,2) DEFAULT 0,
  a_cobrar   NUMERIC(10,2) DEFAULT 0,
  objetivo   NUMERIC(10,2) DEFAULT 0,
  dietas     NUMERIC(10,2) DEFAULT 0,
  h_extras   NUMERIC(10,2) DEFAULT 0,
  jefe_id    UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agente, mes, año)
);

-- =============================================================
-- KPI DETALLE (CONSOLIDADO_KPI)
-- =============================================================
CREATE TABLE IF NOT EXISTS kpi_detalle (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente            TEXT NOT NULL,
  mes               INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  año               INTEGER NOT NULL,
  -- Productividad
  prod_pct          NUMERIC(6,2) DEFAULT 0,
  prod_imp          NUMERIC(10,2) DEFAULT 0,
  prod_acum         NUMERIC(10,2) DEFAULT 0,
  -- Calidad Doc
  calidad_doc_pct   NUMERIC(6,2) DEFAULT 0,
  calidad_doc_imp   NUMERIC(10,2) DEFAULT 0,
  calidad_doc_acum  NUMERIC(10,2) DEFAULT 0,
  -- Control Visitas
  visitas_pct       NUMERIC(6,2) DEFAULT 0,
  visitas_imp       NUMERIC(10,2) DEFAULT 0,
  visitas_acum      NUMERIC(10,2) DEFAULT 0,
  -- Retorno
  retorno_pct       NUMERIC(6,2) DEFAULT 0,
  retorno_obj       NUMERIC(6,2) DEFAULT 0,
  retorno_imp       NUMERIC(10,2) DEFAULT 0,
  retorno_acum      NUMERIC(10,2) DEFAULT 0,
  -- Herramientas
  herramientas_pct  NUMERIC(6,2) DEFAULT 0,
  herramientas_imp  NUMERIC(10,2) DEFAULT 0,
  herramientas_acum NUMERIC(10,2) DEFAULT 0,
  -- Vehículo
  vehiculo_pct      NUMERIC(6,2) DEFAULT 0,
  vehiculo_imp      NUMERIC(10,2) DEFAULT 0,
  vehiculo_acum     NUMERIC(10,2) DEFAULT 0,
  -- Aseo
  aseo_pct          NUMERIC(6,2) DEFAULT 0,
  aseo_imp          NUMERIC(10,2) DEFAULT 0,
  aseo_acum         NUMERIC(10,2) DEFAULT 0,
  -- Horas Improductivas
  horas_obj         NUMERIC(10,2) DEFAULT 0,
  horas_inv         NUMERIC(10,2) DEFAULT 0,
  horas_dif         NUMERIC(10,2) DEFAULT 0,
  horas_pct         NUMERIC(6,2)  DEFAULT 0,
  penalizacion      NUMERIC(10,2) DEFAULT 0,
  -- Total
  total             NUMERIC(10,2) DEFAULT 0,
  jefe_id           UUID REFERENCES usuarios(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agente, mes, año)
);

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE operarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE jefe_operario      ENABLE ROW LEVEL SECURITY;
ALTER TABLE config             ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidencias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_calidad    ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE limpieza           ENABLE ROW LEVEL SECURITY;
ALTER TABLE horas_improductivas ENABLE ROW LEVEL SECURITY;
ALTER TABLE issus              ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_resumen        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_detalle        ENABLE ROW LEVEL SECURITY;

-- Allow full access via anon key (app handles auth in JS layer)
-- For production, replace with proper JWT-based policies
CREATE POLICY "allow_all" ON usuarios           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON operarios          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON jefe_operario      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON config             FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON incidencias        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON control_calidad    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON visitas            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON limpieza           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON horas_improductivas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON issus              FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON kpi_resumen        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON kpi_detalle        FOR ALL TO anon USING (true) WITH CHECK (true);
