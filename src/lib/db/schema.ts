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

export const contentFormatEnum = pgEnum("content_format", ["post", "story", "carousel"]);
export const sourceKindEnum = pgEnum("source_kind", ["manual", "upload", "scraped"]);
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

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  igAccountId: text("ig_account_id"),
  igAccessToken: text("ig_access_token"),
  configJson: jsonb("config_json").$type<Record<string, unknown>>().default({}),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_sources_tenant_slug").on(table.tenantId, table.slug),
  ],
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_personas_tenant_slug").on(table.tenantId, table.slug),
  ],
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
    photoId: uuid("photo_id").references(() => photos.id, { onDelete: "set null" }),
    status: candidateStatusEnum("status").default("candidate").notNull(),
    title: text("title").notNull(),
    summaryJson: jsonb("summary_json").$type<Record<string, unknown>>().default({}),
    selectedFormat: contentFormatEnum("selected_format").notNull().default("post"),
    selectedTone: text("selected_tone"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_candidate_tenant_status").on(table.tenantId, table.status),
    index("idx_candidate_tenant_source").on(table.tenantId, table.sourceId),
  ],
);

export const contentStates = pgTable(
  "content_state",
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
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}),
    igPostId: text("ig_post_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_content_state_tenant_content").on(table.tenantId, table.candidateContentId),
  ],
);

export const generatedOutputs = pgTable(
  "generated_output",
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
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_generated_output_tenant_state").on(table.tenantId, table.contentStateId),
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

export const candidateRelations = relations(candidateContent, ({ one, many }) => ({
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
  states: many(contentStates),
  outputs: many(generatedOutputs),
}));

export const contentStateRelations = relations(contentStates, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contentStates.tenantId],
    references: [tenants.id],
  }),
  candidate: one(candidateContent, {
    fields: [contentStates.candidateContentId],
    references: [candidateContent.id],
  }),
  outputs: many(generatedOutputs),
}));

export const generatedOutputRelations = relations(generatedOutputs, ({ one }) => ({
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
}));

export const tenantRelations = relations(tenants, ({ many }) => ({
  sources: many(sources),
  candidates: many(candidateContent),
  personas: many(personas),
  templates: many(templates),
  contentStates: many(contentStates),
  generatedOutputs: many(generatedOutputs),
  events: many(events),
  photos: many(photos),
}));
