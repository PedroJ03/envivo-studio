# EnVivo Studio - Product Backlog

This document tracks all pending features, bugs, and technical debt for the EnVivo Studio platform.

Last Updated: March 21, 2026

---

## 🎯 Current Status

| Stage                       | Status      | Completion |
| --------------------------- | ----------- | ---------- |
| Stage 1: Content Ingestion  | ✅ Complete | 100%       |
| Stage 2: Topic Selection    | ✅ Complete | 100%       |
| Stage 3: Content Generation | 🔲 Partial  | 60%        |
| Stage 4: Content Approval   | 🔲 Partial  | 40%        |
| Stage 5: Publication        | ✅ Complete | 100%       |

**Critical Gap**: Stage 2 → 3 integration (connecting topic selections to brand-based content generation)

---

## 🚨 Critical Priority

### 1. Content Approval - Brand Integration

**Status**: 🔲 Not Started  
**Impact**: HIGH - Blocks full user workflow  
**Effort**: Medium

**Problem**:  
The "Revisar" (Review) button in `/content/[id]` currently fails because it doesn't integrate with the BrandComposer. The system cannot display a preview of content with brand templates applied.

**Acceptance Criteria**:

- [ ] Integrate `BrandComposer` component into content review page
- [ ] Display preview with selected brand template applied
- [ ] Allow switching between template variants (classic, minimal, centered, etc.)
- [ ] Show section-specific styling (colors, badges)
- [ ] Generate final branded image for approval
- [ ] Save template selection to `candidate_content.template_id`

**Technical Notes**:

- Brand system exists in `src/lib/brand/`
- Templates: post-square-1:1, post-vertical-4:5, reel-cover-9:16, story-9:16
- Each template has variants: classic, minimal, centered, etc.
- Need to connect `candidate_content` → `BrandComposer` → preview canvas

**Files to Modify**:

- `src/app/(dashboard)/content/[id]/page.tsx`
- Create: `src/app/(dashboard)/content/[id]/review-client.tsx`

---

## 🔧 High Priority

### 2. Stage 2 → 3 Pipeline Integration

**Status**: 🔲 Not Started  
**Impact**: HIGH - Completes the content workflow  
**Effort**: High

**Problem**:  
No service connects `topic_selections` (Stage 2) with `candidate_content` generation (Stage 3). When a user selects a topic, it doesn't automatically generate content candidates.

**Acceptance Criteria**:

- [ ] Create service: `generateContentFromSelection(selection)`
- [ ] Use selected tone to generate appropriate copy
- [ ] Apply brand templates based on content section
- [ ] Create `candidate_content` records from generated content
- [ ] Support multiple formats per selection (post, story, reel)
- [ ] Trigger generation on topic selection or via batch job

**Technical Notes**:

- `topic_selections` has: source_type, formats[], tone, urgency
- `candidate_content` needs: title, summary, template_id, etc.
- May need AI service integration for copy generation
- Should respect tenant's brand configuration

**Files to Create/Modify**:

- Create: `src/lib/generation/content-generator.ts`
- Create: `src/lib/generation/tone-applier.ts`
- Modify: `src/lib/topics/queries.ts` (add generation trigger)

---

### 3. NextAuth TypeScript Error

**Status**: 🔲 Bug - Prevents Production Build  
**Impact**: MEDIUM - Blocks deployment  
**Effort**: Low

**Problem**:  
TypeScript error in auth route preventing `npm run build`:

```
Type error: Type 'typeof import("/api/auth/[...nextauth]/route")'
does not satisfy the constraint...
```

**Acceptance Criteria**:

- [ ] Fix TypeScript types in auth route
- [ ] Ensure `npm run build` completes successfully
- [ ] Verify auth still works in development

**Files to Modify**:

- `src/app/api/auth/[...nextauth]/route.ts`

---

## 📝 Medium Priority

### 4. Component Test Dependencies

**Status**: ⚠️ Partial - Tests exist but don't run  
**Impact**: LOW - Development experience  
**Effort**: Low

**Problem**:  
Component tests require `@testing-library/react` which is not installed.

**Acceptance Criteria**:

- [ ] Install `@testing-library/react` and `@testing-library/jest-dom`
- [ ] Verify tests run with `npm test`
- [ ] Fix any failing tests

**Command**:

```bash
npm install -D @testing-library/react @testing-library/jest-dom
```

---

### 5. Event Detail Page Redirect

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

### 6. Multi-Format Generation

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

### 7. Dashboard Analytics

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

### 8. Advanced Scheduling

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

- ⚠️ NextAuth TypeScript error (see #3 above)
- ✅ ~~Module not found: @/middleware~~ **FIXED**

### Tests

- ⚠️ Component tests need @testing-library/react (see #4 above)

---

## 📊 Sprint Planning Suggestions

### Sprint 1: Critical Fixes (This Week)

1. Content Approval - Brand Integration (#1)
2. Fix NextAuth TypeScript error (#3)
3. Install test dependencies (#4)

### Sprint 2: Pipeline Completion (Next Week)

1. Stage 2 → 3 Pipeline Integration (#2)
2. Multi-Format Generation (#6)

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
