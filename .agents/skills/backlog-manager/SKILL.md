# Skill: Backlog Manager

## Description

This skill enables agents to effectively review, update, and maintain the project backlog. It ensures consistency in how backlog items are tracked, prioritized, and communicated across all team members working on the EnVivo Studio project.

## When to Use

**MANDATORY - Use this skill when:**

1. **Starting a new session** - Always check the backlog before beginning work
2. **Completing a feature** - Update status and mark items as done
3. **Discovering new bugs/issues** - Add them to the appropriate priority level
4. **Planning next steps** - Review priorities with the user
5. **Context switching** - Before moving to a different task
6. **Ending a session** - Update progress and document blockers

**OPTIONAL - Use this skill when:**

- Estimating effort for new features
- Identifying dependencies between tasks
- Proposing sprint planning
- Documenting technical decisions that affect backlog items

## Why This Matters

Without consistent backlog management:
- Tasks get lost or forgotten
- Duplicate work happens
- Priority context is lost between sessions
- Team members work on wrong priorities
- Critical bugs remain unfixed

## Process

### Step 1: Read Backlog (ALWAYS FIRST)

```
READ: docs/BACKLOG.md
```

Understand:
- Current priorities (🚨 Critical, 🔧 High, 📝 Medium, 🎨 Low)
- What was completed in previous sessions
- What blockers exist
- What's planned for upcoming work

### Step 2: Assess Current Context

Check:
- What did the user request in this session?
- Does it align with backlog priorities?
- Are there dependencies on other backlog items?
- Is this a new issue or already documented?

### Step 3: Update Backlog (When Needed)

**Add new items:**
```markdown
### N. Item Title
**Status**: 🔲 Not Started  
**Impact**: [Critical/High/Medium/Low]  
**Effort**: [Small/Medium/Large]  

**Problem**:  
[Clear description]

**Acceptance Criteria**:
- [ ] Specific, measurable criteria
- [ ] Another criterion

**Technical Notes**:
[Implementation hints]
```

**Update existing items:**
- Change status emoji: 🔲 → ⚠️ → ✅
- Add strikethrough to completed items: ~~Item~~
- Update "Last Updated" date
- Add "**FIXED**" or "**IN PROGRESS**" annotations

### Step 4: Prioritize with User

Present to user:
```
Based on the backlog, here's what I recommend:

🚨 Critical (Fix first):
1. [Item name] - Why it's critical

🔧 High Priority (This sprint):
1. [Item name]
2. [Item name]

Current session fits with: [Priority level]
```

Ask: "Should we focus on [X] or would you prefer [Y]?"

### Step 5: Document Decisions

When user decides:
- Update item status (🔄 In Progress)
- Add note: "**Assigned to session: [date]**"
- Document any scope changes or clarifications

## Status Emojis Reference

| Emoji | Meaning | Use When |
|-------|---------|----------|
| 🔲 | Not Started | Item identified but no work done |
| 🔄 | In Progress | Currently being worked on |
| ⚠️ | Blocked | Has dependencies or blockers |
| ✅ | Complete | Done and verified |
| ~~text~~ | Deprecated | No longer relevant |

## Priority Guidelines

**🚨 Critical**: 
- Blocks core user workflow
- Production is broken
- Data loss risk
- Security issue

**🔧 High**:
- MVP feature missing
- Major UX problem
- Significant technical debt
- Blocks other important work

**📝 Medium**:
- Enhancement that improves UX
- Minor bugs
- Performance improvements
- Documentation gaps

**🎨 Low**:
- Nice to have features
- Future improvements
- Refactoring with no immediate benefit

## Anti-Patterns (NEVER DO)

❌ **Don't ignore the backlog** - Always read it first
❌ **Don't add vague items** - Be specific with acceptance criteria
❌ **Don't delete items** - Mark as deprecated with ~~strikethrough~~ and explain why
❌ **Don't change priorities silently** - Discuss with user first
❌ **Don't leave items in "In Progress" forever** - Update status or mark blocked
❌ **Don't duplicate items** - Search backlog before adding new

## Template for New Items

```markdown
### N. [Clear, Actionable Title]
**Status**: 🔲 Not Started  
**Impact**: [Critical/High/Medium/Low] - [Brief justification]  
**Effort**: [Small/Medium/Large]  
**Assigned**: [None/UserName/Session Date]  

**Problem**:  
[2-3 sentences explaining what needs to be fixed or built]

**Current Behavior**:  
[What happens now]

**Expected Behavior**:  
[What should happen]

**Acceptance Criteria**:
- [ ] Measurable criterion 1
- [ ] Measurable criterion 2
- [ ] Measurable criterion 3

**Technical Notes**:
- Relevant files: `path/to/file.ts`
- Related backlog items: #X, #Y
- Dependencies: [What must be done first]

**Context**:  
[Any additional context from user or previous sessions]
```

## Examples

### Good Backlog Item:
```markdown
### 1. Content Approval - Brand Integration
**Status**: 🔄 In Progress  
**Impact**: Critical - Blocks full user workflow  
**Effort**: Medium  
**Assigned**: Session 2026-03-21  

**Problem**:  
The "Revisar" button in `/content/[id]` fails because it doesn't integrate with the BrandComposer.
Users cannot preview content with brand templates applied before approving.

**Current Behavior**:  
Clicking "Revisar" causes error: [error message]

**Expected Behavior**:  
User sees preview with selected brand template, can switch variants, and approve.

**Acceptance Criteria**:
- [ ] Integrate BrandComposer into review page
- [ ] Display preview with template applied
- [ ] Allow switching template variants
- [ ] Generate final branded image

**Technical Notes**:
- Brand system: `src/lib/brand/`
- Review page: `src/app/(dashboard)/content/[id]/page.tsx`
- Related: #2 (Stage 2→3 Integration)
```

### Bad Backlog Item (Don't Do This):
```markdown
### 5. Fix stuff
Fix the broken things in the app.
```

## Integration with Workflow

```
User Request
    ↓
[SKILL: Backlog Manager]
    ↓
Read Backlog → Check Priority → Confirm with User
    ↓
[Do The Work]
    ↓
Update Backlog → Mark Complete → Commit
    ↓
Next Session: Read Updated Backlog
```

## Success Criteria

✅ User always knows current priorities
✅ No work is duplicated between sessions
✅ Blockers are clearly documented
✅ New issues are captured immediately
✅ Completed work is marked and celebrated
✅ Future sessions can pick up where previous left off

## Remember

**The backlog is the single source of truth for project state.**

Keep it accurate. Keep it updated. Keep it useful.

---

*This skill ensures all agents maintain consistent backlog hygiene across the EnVivo Studio project.*
