-- MemeHouse Ops System Schema

-- Portal users (invite-only). Passwords stored as bcrypt hashes.
-- Roles: admin, production_lead, camera_operator. No public signup.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'camera_operator' CHECK (role IN ('admin', 'production_lead', 'camera_operator')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  reset_token VARCHAR(255),
  reset_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token) WHERE reset_token IS NOT NULL;

-- Invites: admin creates invite; invitee uses setup link to verify email and set password.
CREATE TABLE IF NOT EXISTS invites (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'camera_operator' CHECK (role IN ('admin', 'production_lead', 'camera_operator')),
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites (token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites (email);
CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON invites (expires_at);

CREATE TABLE IF NOT EXISTS operators (
  id SERIAL PRIMARY KEY,
  op_id VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  tier VARCHAR(20) NOT NULL DEFAULT 'T2',
  zone VARCHAR(50),
  hire_stage VARCHAR(50) NOT NULL DEFAULT 'Outreach',
  active BOOLEAN NOT NULL DEFAULT true,
  cred_status VARCHAR(50) NOT NULL DEFAULT 'Not Started',
  cred_type VARCHAR(50) NOT NULL DEFAULT 'None',
  day_rate INTEGER NOT NULL DEFAULT 0,
  source VARCHAR(100),
  is_buffer BOOLEAN NOT NULL DEFAULT false,
  phone VARCHAR(30),
  reel BOOLEAN NOT NULL DEFAULT false,
  refs BOOLEAN NOT NULL DEFAULT false,
  loa BOOLEAN NOT NULL DEFAULT false,
  w9 BOOLEAN NOT NULL DEFAULT false,
  planned_days INTEGER NOT NULL DEFAULT 1,
  reliability INTEGER NOT NULL DEFAULT 3 CHECK (reliability >= 1 AND reliability <= 5),
  worked_with_memehouse BOOLEAN NOT NULL DEFAULT false,
  late_to_screen BOOLEAN NOT NULL DEFAULT false,
  rate_instability BOOLEAN NOT NULL DEFAULT false,
  gear TEXT[] NOT NULL DEFAULT '{}',
  perf_score INTEGER CHECK (perf_score >= 1 AND perf_score <= 5),
  rehire_eligible BOOLEAN,
  post_notes TEXT,
  notes TEXT,
  project_id VARCHAR(128),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project–operator assignments (global operators reused across projects; effective rate = project_day_rate ?? operators.day_rate)
CREATE TABLE IF NOT EXISTS project_operators (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL,
  operator_id INTEGER NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  zone VARCHAR(50),
  hire_stage VARCHAR(50) NOT NULL DEFAULT 'Outreach',
  cred_status VARCHAR(50) NOT NULL DEFAULT 'Not Started',
  cred_type VARCHAR(50) NOT NULL DEFAULT 'None',
  planned_days INTEGER NOT NULL DEFAULT 1,
  project_day_rate INTEGER,
  tier VARCHAR(20),
  availability_status VARCHAR(50),
  available_through DATE,
  availability_note TEXT,
  availability_updated_by VARCHAR(255),
  availability_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, operator_id)
);
CREATE INDEX IF NOT EXISTS idx_project_operators_project ON project_operators (project_id);
CREATE INDEX IF NOT EXISTS idx_project_operators_operator ON project_operators (operator_id);

-- Audit log for star rating changes (credibility/auditability)
CREATE TABLE IF NOT EXISTS operator_rating_history (
  id SERIAL PRIMARY KEY,
  operator_id INTEGER NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  old_rating INTEGER NOT NULL CHECK (old_rating >= 1 AND old_rating <= 5),
  new_rating INTEGER NOT NULL CHECK (new_rating >= 1 AND new_rating <= 5),
  reason TEXT,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_operator_rating_history_operator ON operator_rating_history (operator_id);

CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  shift_id VARCHAR(30) UNIQUE NOT NULL,
  operator_id INTEGER REFERENCES operators(id) ON DELETE SET NULL,
  operator_name VARCHAR(255),
  zone VARCHAR(50),
  date DATE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  on_break BOOLEAN NOT NULL DEFAULT false,
  break_started_at TIMESTAMPTZ,
  break_ended_at TIMESTAMPTZ,
  flat_hours NUMERIC(4,2) NOT NULL DEFAULT 12,
  ot_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.5,
  day_rate INTEGER NOT NULL DEFAULT 0,
  hours NUMERIC(4,2),
  ot_hours NUMERIC(4,2),
  notes TEXT,
  worked_hours NUMERIC(5,2),
  overtime_hours NUMERIC(5,2),
  overtime_pay NUMERIC(8,2),
  total_pay NUMERIC(8,2),
  project_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shifts_operator_clockout ON shifts (operator_id, end_time);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(255) NOT NULL,
  start_date DATE,
  end_date DATE,
  labor_budget_cap INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at (idempotent: drop then create so schema can run multiple times)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS operators_updated_at ON operators;
CREATE TRIGGER operators_updated_at BEFORE UPDATE ON operators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS project_operators_updated_at ON project_operators;
CREATE TRIGGER project_operators_updated_at BEFORE UPDATE ON project_operators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Default event row (only if none exist)
INSERT INTO events (event_name, start_date, end_date, labor_budget_cap)
SELECT 'Coachella 2026', '2026-04-10'::date, '2026-04-27'::date, 80000
WHERE NOT EXISTS (SELECT 1 FROM events LIMIT 1);
