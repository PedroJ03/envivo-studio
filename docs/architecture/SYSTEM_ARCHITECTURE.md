# EnVivo Studio - System Architecture

## Pipeline Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EnVivo Studio Content Pipeline                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Stage 1   │────▶│   Stage 2   │────▶│   Stage 3   │────▶│   Stage 4   │────▶│   Stage 5   │
│  INGESTION  │     │ SELECTION   │     │ GENERATION  │     │  APPROVAL   │     │  PUBLISH    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Automated  │     │   Human     │     │   Human +   │     │   Human     │     │  Automated  │
│    Data     │     │   Chooses   │     │     AI      │     │   Reviews   │     │   to IG     │
│  Collection │     │   Topics    │     │  (Brand)    │     │  & Edits    │     │   Graph API │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

## Detailed Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      EXTERNAL SOURCES                                       │
├──────────────────────────────┬──────────────────────────────┬──────────────────────────────┤
│      System A: Events        │      System B: News          │        Brand Assets         │
├──────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ • Wikimedia On This Day      │ • NewsAPI (Breaking)         │ • Filo.news Templates       │
│ • Ticketmaster Discovery     │ • GNews (Trending)           │ • Syne Font                 │
│ • Eventbrite Argentina       │ • Rolling Stone Scraper      │ • Logo Watermark            │
│ • Tandil Municipio           │ • Wikidata (Trivia)          │ • Section Badges            │
│ • RSS Feeds                  │                              │ • Photo Containers          │
└──────────────┬───────────────┴──────────────┬───────────────┴──────────────┬──────────────┘
               │                              │                              │
               ▼                              ▼                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       INGESTION LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                         Inngest Scheduled Functions                                  │  │
│  │  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────────┐  │  │
│  │  │ System A: 3x/day    │  │ System B Breaking   │  │ System B Daily              │  │  │
│  │  │ (8am, 3pm, 9pm)     │  │ Every 30 min        │  │ 6am Daily                   │  │  │
│  │  │                     │  │                     │  │                             │  │  │
│  │  │ • Wikimedia         │  │ • NewsAPI           │  │ • Wikidata                  │  │  │
│  │  │ • Ticketmaster      │  │ • GNews             │  │   Trivia                    │  │  │
│  │  │ • Eventbrite        │  │ • Rolling Stone     │  │                             │  │  │
│  │  │ • Tandil Scraper    │  │                     │  │                             │  │  │
│  │  │ • RSS Feeds         │  │                     │  │                             │  │  │
│  │  └──────────┬──────────┘  └──────────┬──────────┘  └─────────────┬───────────────┘  │  │
│  │             │                        │                           │                  │  │
│  │             └────────────────────────┴───────────────────────────┘                  │  │
│  │                                        │                                            │  │
│  │                                        ▼                                            │  │
│  │                         ┌──────────────────────────┐                               │  │
│  │                         │  Deduplication Engine    │                               │  │
│  │                         │  (3-tier: exact/hash/    │                               │  │
│  │                         │   fuzzy with priority)   │                               │  │
│  │                         └────────────┬─────────────┘                               │  │
│  └──────────────────────────────────────┼──────────────────────────────────────────────┘  │
│                                         │                                               │
└─────────────────────────────────────────┼───────────────────────────────────────────────┘
                                          │
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      DATABASE LAYER                                         │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────────────┐  │
│  │   calendar_events    │  │  content_feed_items  │  │     topic_selections             │  │
│  │   (System A)         │  │  (System B)          │  │     (Stage 2)                    │  │
│  │                      │  │                      │  │                                  │  │
│  │ • Concerts           │  │ • Breaking News      │  │ • source_type                    │  │
│  │ • Festivals          │  │ • Trending           │  │ • source_id                      │  │
│  │ • Local Events       │  │ • Curiosities        │  │ • formats[post/story/reel]       │  │
│  │ • Efemérides         │  │ • Trivia             │  │ • tone (5 options)               │  │
│  │                      │  │                      │  │ • urgency                        │  │
│  │ tenant_id + is_shared│  │ tenant_id + is_shared│  │ • target_publish_at              │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └──────────────┬───────────────────┘  │
│             │                         │                              │                     │
│             └─────────────┬───────────┴──────────────┬───────────────┘                     │
│                           │                          │                                    │
│                           ▼                          ▼                                    │
│              ┌────────────────────────┐  ┌────────────────────────┐                       │
│              │   candidate_content    │  │      sections          │                       │
│              │   (Stage 4)            │  │   (Brand System)       │                       │
│              │                        │  │                        │                       │
│              │ • Generated from       │  │ • Próximos Shows       │                       │
│              │   topic_selections     │  │ • Efemérides           │                       │
│              │                        │  │ • Noticias             │                       │
│              │ + brand templates      │  │ • Bandas Locales       │                       │
│              │ + AI generation        │  │                        │                       │
│              │                        │  │ Each with color +      │                       │
│              │ status:                │  │ template config        │                       │
│              │ candidate/approved/    │  │                        │                       │
│              │ published/archived     │  │                        │                       │
│              └──────────┬─────────────┘  └──────────┬─────────────┘                       │
│                         │                            │                                    │
└─────────────────────────┼────────────────────────────┼────────────────────────────────────┘
                          │                            │
                          ▼                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       API LAYER                                             │
│                                                                                             │
│   INGESTION APIs                          TOPIC APIs                    CONTENT APIs        │
│   ┌────────────────────────┐             ┌────────────────────────┐   ┌─────────────────┐  │
│   │ GET /topics/pending    │             │ POST /topics/select    │   │ GET /content    │  │
│   │ (System A + B MINUS    │             │ (Create selection      │   │ POST /content   │  │
│   │  selections)           │             │  with formats/tones)   │   │ GET /content/id │  │
│   │                        │             │                        │   │ POST /publish   │  │
│   │ POST /topics/discard   │             │ GET /topics/selections │   │                 │  │
│   │ (Soft delete)          │             │ (List selections)      │   │                 │  │
│   └────────────────────────┘             └────────────────────────┘   └─────────────────┘  │
│                                                                                             │
└────────────────────────────────────────────────────────────────────────────────────────────┘
                          │                            │
                          ▼                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       UI LAYER                                              │
│                                                                                             │
│   ┌────────────────────────┐              ┌────────────────────────┐   ┌─────────────────┐ │
│   │     /topics            │              │     /content           │   │  Brand Composer │ │
│   │     (Stage 2)          │              │     (Stage 4)          │   │  (Stage 3)      │ │
│   │                        │              │                        │   │                 │ │
│   │ ┌──────────────────┐   │              │ ┌──────────────────┐   │   │ ┌─────────────┐ │ │
│   │ │ FilterBar        │   │              │ │ ContentList      │   │   │ │ Template    │ │ │
│   │ │ • Source         │   │              │ │ • Candidates     │   │   │ │ Selector    │ │ │
│   │ │ • Date Range     │   │              │ │ • Approved       │   │   │ │             │ │ │
│   │ │ • Type Tabs      │   │              │ │ • Published      │   │   │ │ Preview     │ │ │
│   │ └──────────────────┘   │              │ └──────────────────┘   │   │ │ Canvas      │ │ │
│   │                        │              │                        │   │ └─────────────┘ │ │
│   │ ┌──────────────────┐   │              │ ┌──────────────────┐   │   │                 │ │
│   │ │ TopicCard        │   │              │ │ Approval Actions │   │   │ Section:        │ │
│   │ │ • Image          │   │              │ │ • Approve        │   │   │ • Color         │ │
│   │ │ • Badges         │   │              │ │ • Edit           │   │   │ • Typography    │ │
│   │ │ • Actions        │   │              │ │ • Reject         │   │   │ • Composition   │ │
│   │ └──────────────────┘   │              │ └──────────────────┘   │   │                 │ │
│   │                        │              │                        │   └─────────────────┘ │
│   │ ┌──────────────────┐   │              └────────────────────────┘                       │
│   │ │ SelectionModal   │   │                                                              │
│   │ │ • Format Check   │   │                                                              │
│   │ │ • Tone Dropdown  │   │                                                              │
│   │ │ • Urgency Radio  │   │                                                              │
│   │ │ • Date Picker    │   │                                                              │
│   │ └──────────────────┘   │                                                              │
│   └────────────────────────┘                                                              │
│                                                                                             │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    COMPLETE USER FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

  1. INGESTION                          2. SELECTION                        3. GENERATION
     (Automated)                          (Human)                            (AI + Brand)
┌─────────────────────┐              ┌─────────────────────┐              ┌─────────────────────┐
│ 00:00 - System A    │              │ 09:00 - User opens  │              │ 09:05 - AI generates│
│ runs (8am schedule) │─────────────▶│ /topics page        │─────────────▶│ content with        │
│                     │              │                     │              │ selected tone       │
│ Events ingested:    │              │ Sees: Oasis concert │              │ + brand template    │
│ • Oasis at River    │              │ • Taylor Swift news │              │                     │
│ • Local Tandil fest │              │ • Efeméride:        │              │ Creates:            │
│ • Album anniversary │              │   OK Computer       │              │ • Instagram Post    │
│                     │              │                     │              │ • Instagram Story   │
└─────────────────────┘              └─────────────────────┘              │ • Reel Cover      │
                                                                          └──────────┬──────────┘
                                                                                     │
                                                                                     ▼
  4. APPROVAL                           5. PUBLICATION
     (Human)                             (Automated)
┌─────────────────────┐              ┌─────────────────────┐
│ 09:15 - User reviews│              │ 18:00 - Scheduled   │
│ generated content   │─────────────▶│ publish to          │
│                     │              │ Instagram           │
│ In /content page:   │              │                     │
│ • Preview with brand│              │ Posted with:        │
│ • Edit caption      │              │ • Image + Logo      │
│ • Change template   │              │ • Section badge     │
│ • Approve/Reject    │              │ • Branded caption   │
│                     │              │                     │
│ Click "Approve"     │              │ Metrics tracked:    │
│                     │              │ • Likes, Shares     │
└─────────────────────┘              └─────────────────────┘
```

## Multi-Tenancy Architecture

```
                    ┌─────────────────────────────┐
                    │        SUPER ADMIN          │
                    │    (manages all tenants)    │
                    └──────────────┬──────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Tenant: Tandil  │    │ Tenant: MDP      │    │ Tenant: BA       │
│  (@envivo.tandil)│    │(@envivo.mardel)  │    │(@envivo.ba)      │
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                        SHARED SOURCES                             │
│  (All tenants see these)                                          │
│  • Wikimedia (Efemérides)                                         │
│  • Ticketmaster (Worldwide concerts)                              │
│  • Eventbrite (Argentine artists)                                 │
│  • NewsAPI/GNews (Breaking news)                                  │
│  • Wikidata (Trivia)                                              │
└──────────────────────────────────────────────────────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ TENANT-LOCAL     │    │ TENANT-LOCAL     │    │ TENANT-LOCAL     │
│ SOURCES          │    │ SOURCES          │    │ SOURCES          │
│                  │    │                  │    │                  │
│ • Tandil Muni    │    │ • MDP Muni       │    │ • BA Muni        │
│ • El Diario RSS  │    │ • MDP local news │    │ • BA local news  │
│ • Local venues   │    │ • MDP venues     │    │ • BA venues      │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

## Key Integrations

```
┌─────────────────────────────────────────────────────────────────┐
│                      THIRD-PARTY INTEGRATIONS                    │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Instagram     │   Inngest       │      Data Sources           │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ • Graph API     │ • Scheduling    │ • Ticketmaster API          │
│ • Publishing    │ • Orchestration │ • Eventbrite API            │
│ • Media Upload  │ • Retries       │ • NewsAPI                   │
│ • Insights      │ • Observability │ • GNews                     │
│                 │                 │ • Wikimedia API             │
│                 │                 │ • Wikidata SPARQL           │
│                 │                 │ • RSS/Scraping              │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## Current Implementation Status

```
Legend:
✅ = Complete and deployed
🔄 = Partial / In Progress
🔲 = Not Started / Pending

Stage 0: Core Platform        [████████████████████] 100% ✅
├─ Multi-tenancy              [████████████████████] 100% ✅
├─ Authentication             [████████████████████] 100% ✅
└─ Instagram Publishing       [████████████████████] 100% ✅

Stage 1: Ingestion            [████████████████████] 100% ✅
├─ System A (Events)          [████████████████████] 100% ✅
├─ System B (News)            [████████████████████] 100% ✅
├─ Deduplication              [████████████████████] 100% ✅
└─ Tests                      [████████████████████] 100% ✅

Stage 2: Selection            [████████████████████] 100% ✅
├─ Topics UI                  [████████████████████] 100% ✅
├─ Selection Modal            [████████████████████] 100% ✅
├─ API Endpoints              [████████████████████] 100% ✅
└─ Tests                      [████████████████░░░░]  80% ✅

Stage 3: Generation           [████████████░░░░░░░░]  60% 🔄
├─ Brand System               [████████████████████] 100% ✅
├─ Templates                  [████████████████████] 100% ✅
├─ Composer                   [████████████████████] 100% ✅
└─ Pipeline Integration       [░░░░░░░░░░░░░░░░░░░░]   0% 🔲 (CRITICAL)

Stage 4: Approval             [████████░░░░░░░░░░░░]  40% 🔄
├─ Content List UI            [████████████████░░░░]  80% ✅
├─ Brand Preview              [░░░░░░░░░░░░░░░░░░░░]   0% 🔲
└─ Approval Actions           [████████████████░░░░]  80% ✅

Stage 5: Publishing           [████████████████████] 100% ✅
```

## Critical Gap: Stage 2 → Stage 3 Integration

The missing piece is the connector between topic selections and content generation:

```
Current State:
┌─────────────────┐         ┌─────────────────┐
│ topic_selection │   ???   │ BrandComposer   │
│   (Stage 2)     │ ═══════▶│   (Stage 3)     │
└─────────────────┘         └─────────────────┘
     Has:                        Has:
     • source_type               • Templates
     • formats                   • Fonts
     • tones                     • Sections
     • urgency                   • AI prompts
     • target_publish_at

Missing: The "glue" that takes a selection and generates a candidate
```

What needs to be built:

1. Service: `generateContentFromSelection(selection)`
2. Integration: Call BrandComposer with selection data
3. Pipeline: Create candidate_content from generated content
4. UI: Show generated preview before saving to candidate

This is the NEXT PRIORITY for the project.
