# EnVivo Studio - Product Backlog

This document tracks all pending features, bugs, and technical debt for the EnVivo Studio platform.

Last Updated: March 21, 2026 (Content Approval - Brand Integration completed)

---

## 🎯 Current Status

| Stage                       | Status      | Completion |
| --------------------------- | ----------- | ---------- |
| Stage 1: Content Ingestion  | ✅ Complete | 100%       |
| Stage 2: Topic Selection    | ✅ Complete | 100%       |
| Stage 3: Content Generation | ✅ Complete | 100%       |
| Stage 4: Content Approval   | 🔄 Partial  | 85%        |
| Stage 5: Publication        | ✅ Complete | 100%       |

**Critical Gap**: Resuelta - Brand preview con TemplateVariantSelector implementado. Pendiente: integración con BrandComposer real.

---

## 🚨 Critical Priority

### 1. Content Approval - Brand Integration

**Status**: ✅ COMPLETED (2026-03-21)  
**Impact**: HIGH - Enables full user workflow  
**Effort**: Medium

**Implementation Summary**:

- `BrandPreviewLazy` component with dynamic import (ssr:false) for hydration safety
- `TemplateVariantSelector` with 8 variants: classic, minimal, centered, toplogo, fullbleed, split, magazine, duotone
- API routes: `/api/content/[id]/brand` and `/api/content/[id]/generate-image`
- Inngest function `generate-content-image` for async image generation
- `ContentDetailClient` component with optimistic updates
- 8 tests passing

**Files Created**:

- `src/lib/content/` (types, components, queries, index)
- `src/app/api/content/[id]/brand/route.ts`
- `src/app/api/content/[id]/generate-image/route.ts`
- `src/inngest/functions/generate-content-image.ts`
- `src/app/(dashboard)/content/[id]/ContentDetailClient.tsx`

**Pending**: BrandComposer real integration (placeholder preview)

---

### 2.1. BrandComposer Real Integration

**Status**: ✅ COMPLETED (2026-03-22)  
**Impact**: HIGH - Completes the preview functionality  
**Effort**: Medium

**Implementation Summary**:

- API route `/api/preview/[candidateId]` con composeBrandTemplate + Satori
- Acepta `?variant=` query param para preview en tiempo real
- BrandPreview hace fetch al API y muestra SVG
- Loading state con SkeletonLoader
- Error handling con fallback UI

**Files Created/Modified**:

- `src/app/api/preview/[candidateId]/route.ts` (NEW)
- `src/lib/content/components/BrandPreview.tsx` (MODIFIED)

**Verification**: PASS - variant change ahora dispara re-fetch

---

## 🔧 High Priority

### 3. NextAuth TypeScript Error

**Verification**: PASS - 8/8 tests passing

---

## 🔧 High Priority

### 2. Stage 2 → 3 Pipeline Integration

**Status**: ✅ COMPLETED (2026-03-21)  
**Impact**: HIGH - Completes the content workflow  
**Effort**: High

**Implementation Summary**:

- `generateContentFromSelection()` service implemented in `src/lib/generation/content-generator.ts`
- Inngest async worker `generate-content` with retry (3 attempts, exponential backoff) + fallback caption
- 5 tone personas created: informative, opinion, nostalgic, humorous, urgent
- Feature flag `ENABLE_GENERATION_PIPELINE` for gradual rollout
- 59 tests passing, build successful

**Files Created**:

- `src/lib/generation/` (types, errors, config, mappers, content-generator, index)
- `src/inngest/functions/generate-content.ts`
- `personas/` (5 tone files)

**Verification**: PASS WITH WARNINGS - 4 minor nomenclatura deviations documented (see SDD archive)

---

### 3. NextAuth TypeScript Error

**Status**: ⚠️ PARTIALLY FIXED (2026-03-22)  
**Impact**: MEDIUM - Blocks deployment  
**Effort**: Low

**Problem**:  
TypeScript error in auth route preventing `npm run build`.

**Fix Applied**:

- Created `src/auth/index.ts` to resolve path alias issue
- TypeScript error `@/auth` no longer fails

**Remaining Issue**:
Build still fails due to **preexisting errors** (not our changes):

- `tandil-municipio` module not found (`system-a-orchestrator.ts`)
- `.ttf` font files not supported by Turbopack

**Files to Modify**:

- `src/app/api/auth/[...nextauth]/route.ts` ✅ (fixed)
- `src/auth/index.ts` ✅ (created)

---

## 📝 Medium Priority

### 5. Component Test Dependencies

**Status**: ✅ INSTALLED (2026-03-22)  
**Impact**: LOW - Development experience  
**Effort**: Low

**Problem**:  
Component tests require `@testing-library/react` which was not installed.

**Fix Applied**:

- Installed `@testing-library/react` and `@testing-library/jest-dom`
- 8 tests passing in `src/lib/content`

**Remaining**:

- Some existing tests fail due to preexisting issues
- `topic-card.test.tsx` has jest-dom matcher issues

**Command** (already run):

```bash
npm install -D @testing-library/react @testing-library/jest-dom
```

---

### 6. Event Detail Page Redirect

**Status**: 🔲 Improvement  
**Impact**: LOW - UX consistency  
**Effort**: Low

**Problem**:  
`/events/[id]` still shows legacy event detail. Should redirect to topics or show integrated view.

**Acceptance Criteria**:

- [ ] Decide: redirect to `/topics` or integrate with topic selection
- [ ] Update `src/app/(dashboard)/events/[id]/page.tsx`
- [ ] Ensure consistent navigation flow

---

### 7. Multi-Format Generation

**Status**: 🔲 Enhancement  
**Impact**: MEDIUM - Feature completeness  
**Effort**: Medium

**Problem**:  
Currently topic selection allows choosing multiple formats (post, story, reel) but the system doesn't generate all of them automatically.

**Acceptance Criteria**:

- [ ] When user selects multiple formats, generate all variants
- [ ] Apply appropriate templates for each format
- [ ] Show all generated variants in approval queue
- [ ] Allow approving/rejecting individually or in batch

---

## 🎨 Low Priority

### 8. Dashboard Analytics

**Status**: 🔲 Future Enhancement  
**Impact**: LOW - Nice to have  
**Effort**: High

**Description**:  
Add analytics dashboard showing:

- Posts published per week
- Engagement metrics (likes, shares, comments)
- Top performing content types
- Source performance (which ingestion sources generate best content)

---

### 9. Advanced Scheduling

**Status**: 🔲 Future Enhancement  
**Impact**: LOW - Nice to have  
**Effort**: Medium

**Description**:

- Calendar view for scheduled posts
- Drag-and-drop rescheduling
- Auto-scheduling based on optimal times
- Conflict detection (multiple posts at same time)

---

## 🐛 Known Issues

### Database

- ✅ ~~Missing columns in `candidate_content`~~ **FIXED**
- ✅ ~~set_config error~~ **FIXED**
- ✅ ~~middleware.ts missing~~ **FIXED**

### Build

- ⚠️ **Preexisting build errors** (NOT from recent SDDs):
  - `tandil-municipio` module not found in `system-a-orchestrator.ts`
  - `.ttf` font files not supported by Turbopack
  - These block `npm run build`
- ✅ ~~NextAuth TypeScript error~~ **FIXED** (created `src/auth/index.ts`)

### Tests

- ✅ ~~Component tests need @testing-library/react~~ **FIXED** (installed)

---

## 📊 Sprint Planning Suggestions

### Sprint 1: Critical Fixes (This Week)

1. ✅ ~~Content Approval - Brand Integration (#1)~~ **DONE**
2. ✅ ~~NextAuth TypeScript Error (#3)~~ **PARTIALLY DONE**
3. ✅ ~~Install test dependencies (#4)~~ **DONE**

### Sprint 1b: Build Errors (Requires Investigation)

1. Fix `tandil-municipio` module not found
2. Resolve `.ttf` font file issue with Turbopack

### Sprint 2: Brand Integration + Multi-Format (Next Week)

1. **Integrar BrandComposer real en BrandPreview** (placeholder actual)
2. Multi-Format Generation (#6) - verificar que funcione con pipeline completado

### Sprint 3: Polish & Features

1. Dashboard Analytics (#7)
2. Advanced Scheduling (#8)
3. Event Detail improvements (#5)

---

## 🏷️ Priority Legend

- 🚨 **Critical**: Blocks core functionality, fix immediately
- 🔧 **High**: Important for MVP completion
- 📝 **Medium**: Enhancements that improve UX
- 🎨 **Low**: Nice to have, future releases

---

## 📖 Related Documents

- [System Architecture](./architecture/SYSTEM_ARCHITECTURE.md)
- [Agent Skills Catalog](./references/agent-skills.md)
- [Database Schema](../../drizzle/migrations/)

---

_To update this backlog, edit `docs/BACKLOG.md` and commit changes._
