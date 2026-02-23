-- MemeHouse Ops System Schema

CREATE TABLE IF NOT EXISTS operators (
  id SERIAL PRIMARY KEY,
  op_id VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  tier VARCHAR(20) NOT NULL DEFAULT 'T2',
  zone VARCHAR(50),
  hire_stage VARCHAR(50) NOT NULL DEFAULT 'Outreach',
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
  reliability INTEGER NOT NULL DEFAULT 3 CHECK (reliability >= 1 AND reliability <= 5),
  worked_with_memehouse BOOLEAN NOT NULL DEFAULT false,
  late_to_screen BOOLEAN NOT NULL DEFAULT false,
  rate_instability BOOLEAN NOT NULL DEFAULT false,
  gear TEXT[] NOT NULL DEFAULT '{}',
  perf_score INTEGER CHECK (perf_score >= 1 AND perf_score <= 5),
  rehire_eligible BOOLEAN,
  post_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  flat_hours NUMERIC(4,2) NOT NULL DEFAULT 12,
  ot_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.5,
  day_rate INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(255) NOT NULL,
  start_date DATE,
  end_date DATE,
  labor_budget_cap INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER operators_updated_at BEFORE UPDATE ON operators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Default event row (only if empty)
INSERT INTO events (event_name, start_date, end_date, labor_budget_cap)
SELECT 'Coachella 2026', '2026-04-10', '2026-04-27', 80000
WHERE NOT EXISTS (SELECT 1 FROM events LIMIT 1);
