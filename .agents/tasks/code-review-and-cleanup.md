# Task: Code Review and Cleanup

## Objective

Perform a comprehensive code review of recent changes and identify pre-existing errors and dead code in the repository.

## Context

### Recent Changes Made (by previous agent)

The following fixes were applied to resolve Next.js 16 compatibility issues:

1. **NextAuth Type Fix** (`src/auth.ts`)
   - Updated to use proper type casting for GET/POST handlers
   - Changed from custom types to `any` casting for NextAuth v4 compatibility

2. **Route Handler Params** (Next.js 16 requires params as Promise)
   - `src/app/api/content/[id]/compose/route.ts`
   - `src/app/api/content/[id]/publish/route.ts`
   - `src/app/api/content/[id]/route.ts`
   - `src/app/api/content/[id]/history/route.ts`
   - `src/app/api/events/[id]/scrape/route.ts`
   - Changed `RouteContext` type to wrap `params` in `Promise<>`
   - Updated param access to use `await context.params`

3. **Zod Schema Fix** (`src/app/api/topics/select/route.ts`)
   - Changed `z.record(z.unknown())` to `z.record(z.string(), z.any())`

4. **Date Type Fix** (`src/lib/ingestion/dedup-service.ts`)
   - Partial fix for date comparison (may need more work)

### Pre-existing Errors Found

The following errors existed BEFORE recent changes and are NOT related to Next.js 16:

1. **Type Errors in `src/lib/ingestion/dedup-service.ts`**
   ```
   - Type '{ eventDate: string; ... }' is not assignable to type 'NormalizedEvent'
   - Types of property 'eventDate' are incompatible: Type 'string' is not assignable to type 'Date'
   - No overload matches this call (Drizzle ORM insert)
   - Type 'Date' is not assignable to type 'string'
   ```
2. **Type Mismatches**
   - `eventDate` is stored as `string` in DB but typed as `Date` in TypeScript
   - Similar issues in `content_feed_items` and `calendar_events`

### Current Build Status

- ✓ Next.js compilation: SUCCESS
- ✗ TypeScript type check: FAILING (due to pre-existing errors)
- ✗ Production build: FAILING

## Tasks

### Task 1: Verify Recent Changes

Review all files modified in recent commits to ensure:

1. Changes are correct and follow best practices
2. No unintended side effects
3. Proper error handling is in place

Files to review:

- `src/auth.ts`
- `src/app/api/content/[id]/compose/route.ts`
- `src/app/api/content/[id]/publish/route.ts`
- `src/app/api/content/[id]/route.ts`
- `src/app/api/content/[id]/history/route.ts`
- `src/app/api/events/[id]/scrape/route.ts`
- `src/app/api/topics/select/route.ts`
- `src/lib/ingestion/dedup-service.ts`

### Task 2: Fix Pre-existing Type Errors

Fix the type errors in `dedup-service.ts` and related files:

1. **Analyze the type mismatch**:
   - Check how `eventDate` is defined in the database schema
   - Check how it's typed in TypeScript interfaces
   - Identify all places where the mismatch occurs

2. **Determine the correct fix**:
   - Option A: Change DB to store dates as Date/Timestamp
   - Option B: Change TypeScript types to use string for dates
   - Option C: Add proper conversion layer

3. **Apply the fix** consistently across:
   - `src/lib/ingestion/types.ts`
   - `src/lib/db/schema.ts`
   - `src/lib/ingestion/dedup-service.ts`
   - Any other affected files

### Task 3: Find Dead Code (Code Fantasma)

Search for and identify:

1. **Unused imports**:

   ```bash
   npx ts-prune -p tsconfig.json
   ```

   Or manually check for imports that are never used

2. **Unused functions/methods**:
   - Functions exported but never called
   - Methods in classes that are never invoked

3. **Unused variables**:
   - Variables declared but never read
   - Parameters that are never used

4. **Unused files**:
   - Components not imported anywhere
   - API routes that are not called
   - Utility functions with no consumers

5. **Deprecated code**:
   - Old implementations commented out
   - TODOs that are no longer relevant
   - Code for features that were removed

6. **Duplicate code**:
   - Same logic repeated in multiple places
   - Similar functions that could be unified

Files to pay special attention to:

- `src/lib/ingestion/` - Check if all connectors are used
- `src/app/(dashboard)/events/` - May be deprecated (redirects to /topics)
- `src/lib/composer/` - Check for unused methods
- `src/proxy.ts` vs old `middleware.ts`

### Task 4: Verify Build

After fixes, verify:

```bash
# TypeScript check
npm run typecheck

# Production build
npm run build

# Dev server starts
npm run dev
```

## Expected Output

Create a report with:

1. **Verification Summary**:
   - Recent changes reviewed (✓/✗)
   - Issues found in recent changes

2. **Pre-existing Errors Fixed**:
   - List of type errors fixed
   - Files modified
   - Explanation of the fix

3. **Dead Code Report**:
   - Unused imports found: [list]
   - Unused functions: [list]
   - Unused files: [list]
   - Code recommended for deletion: [list]

4. **Build Status**:
   - Before fixes: [status]
   - After fixes: [status]

5. **Recommendations**:
   - Code quality improvements
   - Refactoring suggestions
   - Architecture improvements

## Important Notes

- Do NOT delete code without being 100% sure it's unused
- If uncertain about dead code, mark it as "suspicious" in the report
- Keep the fixes minimal and focused
- Test that the application still works after changes
- Update the backlog if new issues are discovered

## Success Criteria

- [ ] All recent changes verified
- [ ] Pre-existing TypeScript errors fixed
- [ ] Dead code identified and documented
- [ ] Production build passes (`npm run build` succeeds)
- [ ] Dev server works (`npm run dev` starts without errors)
- [ ] Report created with findings

## Related Files

- Backlog: `docs/BACKLOG.md`
- Architecture: `docs/architecture/SYSTEM_ARCHITECTURE.md`
- Database schema: `src/lib/db/schema.ts`
- Migrations: `drizzle/migrations/`

## Questions?

If you find issues that require architectural decisions or significant refactoring, document them in the report and ask the user before proceeding.
