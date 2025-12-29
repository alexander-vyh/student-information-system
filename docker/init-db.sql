-- Initialize SIS database schemas
-- This script runs on first container startup

-- Create schemas for domain separation
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS student;
CREATE SCHEMA IF NOT EXISTS curriculum;
CREATE SCHEMA IF NOT EXISTS enrollment;
CREATE SCHEMA IF NOT EXISTS financial;
CREATE SCHEMA IF NOT EXISTS aid;
CREATE SCHEMA IF NOT EXISTS admissions;
CREATE SCHEMA IF NOT EXISTS international;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create extension for full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create extension for encryption (for SSN, etc.)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Grant usage on schemas to the application user
-- (In production, use a separate app user with limited privileges)
GRANT USAGE ON SCHEMA core TO PUBLIC;
GRANT USAGE ON SCHEMA identity TO PUBLIC;
GRANT USAGE ON SCHEMA student TO PUBLIC;
GRANT USAGE ON SCHEMA curriculum TO PUBLIC;
GRANT USAGE ON SCHEMA enrollment TO PUBLIC;
GRANT USAGE ON SCHEMA financial TO PUBLIC;
GRANT USAGE ON SCHEMA aid TO PUBLIC;
GRANT USAGE ON SCHEMA admissions TO PUBLIC;
GRANT USAGE ON SCHEMA international TO PUBLIC;
GRANT USAGE ON SCHEMA analytics TO PUBLIC;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to extract tax year from transaction date (for 1098-T)
CREATE OR REPLACE FUNCTION get_tax_year(transaction_date DATE)
RETURNS SMALLINT AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM transaction_date)::SMALLINT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Output success message
DO $$
BEGIN
  RAISE NOTICE 'SIS database schemas initialized successfully';
END $$;
