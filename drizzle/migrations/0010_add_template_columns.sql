-- ============================================================================
-- Migration: Add template columns to candidate_content
-- Brand System - filo-news-brand-system
-- ============================================================================
--
-- Adds template_id and template_variant columns to support brand templates.
-- These columns are nullable for backward compatibility.
--
-- ============================================================================

ALTER TABLE candidate_content 
ADD COLUMN template_id text,
ADD COLUMN template_variant text;

-- Index for efficient template-based queries
CREATE INDEX idx_candidate_content_template_id ON candidate_content(template_id);

COMMENT ON COLUMN candidate_content.template_id IS 'Brand template format (e.g., post-vertical-45, story-9-16)';
COMMENT ON COLUMN candidate_content.template_variant IS 'Brand template variant (e.g., classic, centered, minimal)';