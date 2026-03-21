-- ============================================================================
-- Migration: Add section_id to candidate_content
-- Brand System - filo-news-brand-system
-- ============================================================================
--
-- This adds the foreign key to link candidate_content to a section.
-- The column is nullable to maintain backward compatibility with existing content.
--
-- ============================================================================

ALTER TABLE candidate_content 
ADD COLUMN section_id uuid REFERENCES sections(id) ON DELETE SET NULL;

-- Index for efficient section-based queries (e.g., "get all candidates for efemerides")
CREATE INDEX idx_candidate_content_section_id ON candidate_content(section_id);

COMMENT ON COLUMN candidate_content.section_id IS 'FK to sections.id, nullable for backward compatibility';
