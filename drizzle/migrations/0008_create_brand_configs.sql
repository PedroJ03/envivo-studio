-- ============================================================================
-- Migration: Create brand_configs table
-- Brand System - filo-news-brand-system
-- ============================================================================
--
-- This table stores brand configuration per tenant.
-- Contains typography settings, logo SVG, and custom color overrides.
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS brand_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  primary_font varchar(50) NOT NULL DEFAULT 'Syne',
  logo_svg text NOT NULL,
  custom_colors jsonb DEFAULT '{}', -- Override de colores por sección
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  updated_at timestamp with time zone DEFAULT NOW() NOT NULL
);

-- Index for tenant lookups
CREATE INDEX idx_brand_configs_tenant_id ON brand_configs(tenant_id);

COMMENT ON TABLE brand_configs IS 'Brand configuration per tenant (typography, logo, colors)';
COMMENT ON COLUMN brand_configs.primary_font IS 'Primary font family, default Syne';
COMMENT ON COLUMN brand_configs.logo_svg IS 'Inline SVG logo markup';
COMMENT ON COLUMN brand_configs.custom_colors IS 'JSON object with section slug keys and HEX color values';
