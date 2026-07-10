CREATE TABLE IF NOT EXISTS use_cases (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  -- 'manual' = seeded by you, 'llm_approved' = discovered by LLM and approved
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  input_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES vendors(id),
  use_case_id INTEGER REFERENCES use_cases(id),
  covered BOOLEAN NOT NULL,
  confidence FLOAT,
  reasoning TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Holds new use cases the LLM discovered that are not yet in the master library.
-- These sit here until a human reviews and approves or rejects them.
CREATE TABLE IF NOT EXISTS pending_use_cases (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES vendors(id),
  -- the vendor whose evaluation triggered the discovery
  suggested_code VARCHAR(10),
  -- LLM-suggested code, e.g. C13 or U10, may need human adjustment
  suggested_domain_id INTEGER REFERENCES domains(id),
  -- the IAM domain this new use case belongs to
  suggested_name VARCHAR(100) NOT NULL,
  suggested_category VARCHAR(50) NOT NULL,
  suggested_description TEXT NOT NULL,
  llm_reasoning TEXT,
  -- why the LLM thinks this is a new, distinct use case
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- 'pending', 'approved', 'rejected'
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);