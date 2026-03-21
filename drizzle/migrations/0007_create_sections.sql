-- ============================================================================
-- Migration: Create sections table
-- Brand System - filo-news-brand-system
-- ============================================================================
--
-- This table stores the editorial sections/categories that content can belong to.
-- Each section has a distinctive color that will be used in brand templates.
--
-- Sections:
-- - Próximos Shows (violet #8B5CF6)
-- - Efemérides (amber #F59E0B)
-- - Noticias (cyan #06B6D4)
-- - Bandas Locales (emerald #10B981)
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug varchar(50) NOT NULL,
  name varchar(100) NOT NULL,
  color char(7) NOT NULL, -- HEX format #RRGGBB
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  updated_at timestamp with time zone DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, slug)
);

-- Index for efficient tenant-based lookups
CREATE INDEX idx_sections_tenant_id ON sections(tenant_id);

-- Constraint to ensure color is valid HEX format
ALTER TABLE sections ADD CONSTRAINT chk_sections_color
  CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

COMMENT ON TABLE sections IS 'Editorial sections/categories with brand colors';
COMMENT ON COLUMN sections.slug IS 'URL-friendly identifier: proximos-shows, efemerides, noticias, bandas-locales';
COMMENT ON COLUMN sections.color IS 'HEX color code like #8B5CF6 used for brand templates';
