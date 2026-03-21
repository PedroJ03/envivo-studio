import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const contentFormatEnum = pgEnum("content_format", [
  "post",
  "story",
  "carousel",
]);
export const sourceKindEnum = pgEnum("source_kind", [
  "manual",
  "upload",
  "scraped",
]);
export const candidateStatusEnum = pgEnum("candidate_status", [
  "candidate",
  "selected",
  "rejected",
  "archived",
]);
export const contentStateEnum = pgEnum("content_state", [
  "draft",
  "approved",
  "generating",
  "generated",
  "reviewed",
  "published",
  "rejected",
  "failed",
]);
export const operatorRoleEnum = pgEnum("operator_role", [
  "superadmin",
  "admin",
  "operator",
]);

// Topic Selection enums
export const topicSourceTypeEnum = pgEnum("topic_source_type", [
  "calendar_event",
  "content_feed_item",
]);

export const topicUrgencyEnum = pgEnum("topic_urgency", [
  "low",
  "medium",
  "high",
  "breaking",
]);

export const topicSelectionStatusEnum = pgEnum("topic_selection_status", [
  "pending",
  "generating",
  "ready",
  "discarded",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  igAccountId: text("ig_account_id"),
  igAccessToken: text("ig_access_token"),
  configJson: jsonb("config_json").$type<Record<string, unknown>>().default({}),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const operators = pgTable(
  "operators",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    role: operatorRoleEnum("role").notNull().default("operator"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_operators_email").on(table.email),
    index("idx_operators_tenant").on(table.tenantId),
  ],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    kind: sourceKindEnum("kind").notNull().default("manual"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    sourceUrl: text("source_url"),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_sources_tenant_slug").on(table.tenantId, table.slug)],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    eventDate: timestamp("event_date", { withTimezone: true }),
    venue: text("venue"),
    statusText: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_events_tenant").on(table.tenantId)],
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    originalUrl: text("original_url").notNull(),
    storageKey: text("storage_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_photos_tenant_event").on(table.tenantId, table.eventId),
  ],
);

export const personas = pgTable(
  "personas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    skillContentMd: text("skill_content_md").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_personas_tenant_slug").on(table.tenantId, table.slug)],
);

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    format: contentFormatEnum("format").notNull().default("post"),
    componentKey: text("component_key").notNull(),
    previewUrl: text("preview_url"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_templates_tenant_slug").on(table.tenantId, table.slug),
  ],
);

export const candidateContent = pgTable(
  "candidate_content",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    photoId: uuid("photo_id").references(() => photos.id, {
      onDelete: "set null",
    }),
    sectionId: uuid("section_id").references(
      (): any => {
        // Forward reference to sections table
        return sections.id;
      },
      {
        onDelete: "set null",
      },
    ),
    status: candidateStatusEnum("status").default("candidate").notNull(),
    title: text("title").notNull(),
    summaryJson: jsonb("summary_json")
      .$type<Record<string, unknown>>()
      .default({}),
    selectedFormat: contentFormatEnum("selected_format")
      .notNull()
      .default("post"),
    selectedTone: text("selected_tone"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_candidate_tenant_status").on(table.tenantId, table.status),
    index("idx_candidate_tenant_source").on(table.tenantId, table.sourceId),
    index("idx_candidate_section_id").on(table.sectionId),
  ],
);

export const contentStates = pgTable(
  "content_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    candidateContentId: uuid("candidate_content_id")
      .notNull()
      .references(() => candidateContent.id, { onDelete: "cascade" }),
    state: contentStateEnum("state").notNull().default("draft"),
    actor: text("actor"),
    rejectionReason: text("rejection_reason"),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, unknown>>()
      .default({}),
    igPostId: text("ig_post_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_content_state_tenant_content").on(
      table.tenantId,
      table.candidateContentId,
    ),
  ],
);

export const generatedOutputs = pgTable(
  "generated_outputs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contentStateId: uuid("content_state_id")
      .notNull()
      .references(() => contentStates.id, { onDelete: "cascade" }),
    candidateContentId: uuid("candidate_content_id")
      .notNull()
      .references(() => candidateContent.id, { onDelete: "cascade" }),
    fileUrl: text("file_url").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_generated_output_tenant_state").on(
      table.tenantId,
      table.contentStateId,
    ),
  ],
);

export const sourceRelations = relations(sources, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [sources.tenantId],
    references: [tenants.id],
  }),
  candidates: many(candidateContent),
  events: many(events),
  photos: many(photos),
}));

export const eventRelations = relations(events, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [events.tenantId],
    references: [tenants.id],
  }),
  source: one(sources, {
    fields: [events.sourceId],
    references: [sources.id],
  }),
  photos: many(photos),
}));

export const photoRelations = relations(photos, ({ one }) => ({
  tenant: one(tenants, {
    fields: [photos.tenantId],
    references: [tenants.id],
  }),
  event: one(events, {
    fields: [photos.eventId],
    references: [events.id],
  }),
  source: one(sources, {
    fields: [photos.sourceId],
    references: [sources.id],
  }),
}));

export const candidateRelations = relations(
  candidateContent,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [candidateContent.tenantId],
      references: [tenants.id],
    }),
    source: one(sources, {
      fields: [candidateContent.sourceId],
      references: [sources.id],
    }),
    event: one(events, {
      fields: [candidateContent.eventId],
      references: [events.id],
    }),
    photo: one(photos, {
      fields: [candidateContent.photoId],
      references: [photos.id],
    }),
    section: one(sections, {
      fields: [candidateContent.sectionId],
      references: [sections.id],
    }),
    states: many(contentStates),
    outputs: many(generatedOutputs),
  }),
);

export const contentStateRelations = relations(
  contentStates,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [contentStates.tenantId],
      references: [tenants.id],
    }),
    candidate: one(candidateContent, {
      fields: [contentStates.candidateContentId],
      references: [candidateContent.id],
    }),
    outputs: many(generatedOutputs),
  }),
);

export const generatedOutputRelations = relations(
  generatedOutputs,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [generatedOutputs.tenantId],
      references: [tenants.id],
    }),
    candidate: one(candidateContent, {
      fields: [generatedOutputs.candidateContentId],
      references: [candidateContent.id],
    }),
    contentState: one(contentStates, {
      fields: [generatedOutputs.contentStateId],
      references: [contentStates.id],
    }),
  }),
);

export const operatorRelations = relations(operators, ({ one }) => ({
  tenant: one(tenants, {
    fields: [operators.tenantId],
    references: [tenants.id],
  }),
}));

// ============================================================================
// Content Ingestion Tables (Phase 1)
// ============================================================================

export const eventTypeEnum = pgEnum("event_type", [
  "historical",
  "concert",
  "festival",
  "local_event",
]);

export const contentFeedTypeEnum = pgEnum("content_feed_type", [
  "breaking_news",
  "trending",
  "curiosity",
  "trivia",
]);

export const sourceSystemEnum = pgEnum("source_system", ["A", "B"]);

export const sourceStatusEnum = pgEnum("source_status", [
  "active",
  "paused",
  "error",
]);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    eventType: eventTypeEnum("event_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    eventDate: text("event_date").notNull(), // ISO date string YYYY-MM-DD
    year: integer("year"),
    location: jsonb("location")
      .$type<{
        city?: string | null;
        region?: string | null;
        country?: string | null;
        venue?: string | null;
      }>()
      .default({
        city: undefined,
        region: undefined,
        country: undefined,
        venue: undefined,
      })
      .notNull(),
    artists: jsonb("artists")
      .$type<
        Array<{
          name: string;
          normalizedName: string;
          externalUrls?: Record<string, string>;
        }>
      >()
      .default([])
      .notNull(),
    images: jsonb("images")
      .$type<
        Array<{
          url: string;
          source?: string;
          caption?: string;
          license?: string;
        }>
      >()
      .default([])
      .notNull(),
    tags: text("tags").array().default([]).notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    isShared: boolean("is_shared").default(false).notNull(),
    priority: integer("priority").default(2).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    contentHash: text("content_hash").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_calendar_events_tenant_date").on(
      table.tenantId,
      table.eventDate,
    ),
    index("idx_calendar_events_source_event_type").on(
      table.source,
      table.eventType,
    ),
    index("idx_calendar_events_content_hash").on(table.contentHash),
    index("idx_calendar_events_upcoming").on(table.eventDate, table.priority),
  ],
);

export const contentFeedItems = pgTable(
  "content_feed_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    sourceUrl: text("source_url"),
    contentType: contentFeedTypeEnum("content_type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    hook: text("hook").notNull(),
    facts: jsonb("facts")
      .$type<
        Array<{
          fact: string;
          source?: string;
          verifiedAt?: Date;
        }>
      >()
      .default([])
      .notNull(),
    images: jsonb("images")
      .$type<
        Array<{
          url: string;
          source?: string;
          caption?: string;
          license?: string;
        }>
      >()
      .default([])
      .notNull(),
    tags: text("tags").array().notNull().default([]),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    isShared: boolean("is_shared").default(false).notNull(),
    publishAt: timestamp("publish_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    viralScore: integer("viral_score").default(0).notNull(),
    contentHash: text("content_hash").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_content_feed_items_tenant_publish").on(
      table.tenantId,
      table.publishAt,
    ),
    index("idx_content_feed_items_content_type").on(table.contentType),
    index("idx_content_feed_items_content_hash").on(table.contentHash),
  ],
);

export const ingestionSources = pgTable(
  "ingestion_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    system: sourceSystemEnum("system").notNull(),
    connectorType: text("connector_type").notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    isShared: boolean("is_shared").default(false).notNull(),
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    scheduleCron: text("schedule_cron"),
    priority: integer("priority").default(1).notNull(),
    rateLimitRps: integer("rate_limit_rps"),
    status: sourceStatusEnum("status").default("active").notNull(),
    lastIngestedAt: timestamp("last_ingested_at", { withTimezone: true }),
    lastError: text("last_error"),
    errorCount: integer("error_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_ingestion_sources_system_status").on(table.system, table.status),
    index("idx_ingestion_sources_tenant_active").on(
      table.tenantId,
      table.isShared,
      table.status,
    ),
  ],
);

// Relations for ingestion tables
export const calendarEventRelations = relations(calendarEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [calendarEvents.tenantId],
    references: [tenants.id],
  }),
}));

export const contentFeedItemRelations = relations(
  contentFeedItems,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [contentFeedItems.tenantId],
      references: [tenants.id],
    }),
  }),
);

export const ingestionSourceRelations = relations(
  ingestionSources,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [ingestionSources.tenantId],
      references: [tenants.id],
    }),
  }),
);

// ============================================================================
// Topic Selection Table (Stage 2 Pipeline)
// ============================================================================

export const topicSelections = pgTable(
  "topic_selections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sourceType: topicSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    formats: jsonb("formats")
      .$type<
        Array<{
          type: "post" | "story" | "reel";
          tone: "informative" | "opinion" | "nostalgic" | "humorous" | "urgent";
          priority: number;
        }>
      >()
      .default([])
      .notNull(),
    targetPublishAt: timestamp("target_publish_at", { withTimezone: true }),
    urgency: topicUrgencyEnum("urgency").notNull().default("medium"),
    status: topicSelectionStatusEnum("status").notNull().default("pending"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_topic_selections_tenant_status").on(
      table.tenantId,
      table.status,
    ),
    index("idx_topic_selections_source").on(table.sourceType, table.sourceId),
    index("idx_topic_selections_publish").on(table.targetPublishAt),
    index("idx_topic_selections_created").on(table.createdAt),
  ],
);

// Relations for topic selections
export const topicSelectionRelations = relations(
  topicSelections,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [topicSelections.tenantId],
      references: [tenants.id],
    }),
    operator: one(operators, {
      fields: [topicSelections.createdBy],
      references: [operators.id],
    }),
  }),
);

// Extend tenant relations
export const tenantRelations = relations(tenants, ({ many }) => ({
  sources: many(sources),
  candidates: many(candidateContent),
  personas: many(personas),
  templates: many(templates),
  contentStates: many(contentStates),
  generatedOutputs: many(generatedOutputs),
  events: many(events),
  photos: many(photos),
  operators: many(operators),
  calendarEvents: many(calendarEvents),
  contentFeedItems: many(contentFeedItems),
  ingestionSources: many(ingestionSources),
  topicSelections: many(topicSelections),
  sections: many(sections),
  brandConfigs: many(brandConfigs),
}));

// ============================================================================
// Brand System Tables - filo-news-brand-system
// ============================================================================

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(), // 'proximos-shows' | 'efemerides' | 'noticias' | 'bandas-locales'
    name: text("name").notNull(), // 'Próximos Shows' | 'Efemérides' | 'Noticias' | 'Bandas Locales'
    color: text("color").notNull(), // HEX format #RRGGBB
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_sections_tenant_id").on(table.tenantId),
    index("idx_sections_tenant_slug").on(table.tenantId, table.slug),
  ],
);

export const brandConfigs = pgTable(
  "brand_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .unique()
      .references(() => tenants.id, { onDelete: "cascade" }),
    primaryFont: text("primary_font").notNull().default("Syne"),
    logoSvg: text("logo_svg").notNull(),
    customColors: jsonb("custom_colors")
      .$type<Record<string, string>>()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_brand_configs_tenant_id").on(table.tenantId)],
);

// Relations for brand tables
export const sectionRelations = relations(sections, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [sections.tenantId],
    references: [tenants.id],
  }),
  candidates: many(candidateContent),
}));

export const brandConfigRelations = relations(brandConfigs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [brandConfigs.tenantId],
    references: [tenants.id],
  }),
}));
