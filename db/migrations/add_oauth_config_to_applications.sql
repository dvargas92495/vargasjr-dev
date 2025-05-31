-- Add oauth_config column to applications table
ALTER TABLE applications ADD COLUMN oauth_config JSONB;
