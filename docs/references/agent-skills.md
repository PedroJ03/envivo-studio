# Agent Skills Catalog

This document catalogs the AI agent skills available in this project. These skills are stored in `.agents/skills/` and `.claude/skills/` (symlinks) but are **not committed to git** (see `.gitignore`).

To use these skills, copy them from a backup or source repository into `.agents/skills/`.

---

## Available Skills

### Content & Copywriting

| Skill                | Description                                        | Use Case                                   |
| -------------------- | -------------------------------------------------- | ------------------------------------------ |
| **ad-creative**      | Creates advertising creative concepts and copy     | Generate ad campaigns, headlines, visuals  |
| **copywriting**      | Professional copywriting frameworks and techniques | Landing pages, sales copy, email campaigns |
| **copy-editing**     | Editing and refining copy for clarity              | Improve existing copy, plain English       |
| **content-strategy** | Strategic content planning and architecture        | Content calendars, CMS planning, workflows |
| **social-content**   | Social media content creation                      | Posts, reels, stories across platforms     |

### SEO & Analytics

| Skill                  | Description                           | Use Case                                                |
| ---------------------- | ------------------------------------- | ------------------------------------------------------- |
| **ai-seo**             | AI-powered SEO optimization           | Keyword research, content optimization, ranking factors |
| **analytics-tracking** | Analytics implementation and tracking | GA4, GTM, event tracking setup                          |

### Marketing & Growth

| Skill                       | Description                            | Use Case                                      |
| --------------------------- | -------------------------------------- | --------------------------------------------- |
| **marketing-ideas**         | Generates marketing campaign ideas     | Brainstorming, campaign concepts              |
| **marketing-psychology**    | Behavioral psychology for marketing    | Persuasion, cognitive biases, user motivation |
| **launch-strategy**         | Product launch planning                | Go-to-market, launch sequences, timing        |
| **lead-magnets**            | Lead magnet creation and optimization  | Ebooks, tools, resources for lead gen         |
| **referral-program**        | Referral and affiliate program design  | Program structure, incentives, viral loops    |
| **competitor-alternatives** | Alternative positioning vs competitors | Differentiation, comparison content           |

### Product & UX

| Skill                         | Description                     | Use Case                                       |
| ----------------------------- | ------------------------------- | ---------------------------------------------- |
| **onboarding-cro**            | Onboarding optimization and CRO | User onboarding flows, conversion optimization |
| **product-marketing-context** | Product marketing strategy      | Positioning, messaging, launch                 |
| **churn-prevention**          | Retention and churn reduction   | Cancel flows, dunning, win-back campaigns      |

### Technical

| Skill                                | Description                          | Use Case                          |
| ------------------------------------ | ------------------------------------ | --------------------------------- |
| **supabase-postgres-best-practices** | Supabase and PostgreSQL optimization | Query optimization, RLS, indexing |

---

## Skill Structure

Each skill follows this structure:

```
.agents/skills/{skill-name}/
├── SKILL.md              # Main skill documentation
├── evals/
│   └── evals.json        # Evaluation criteria
└── references/           # Reference materials
    └── *.md              # Documentation, patterns, examples
```

---

## How to Install Skills

1. Copy the skill directory to `.agents/skills/`
2. The `.claude/skills/` directory contains symlinks for Claude compatibility
3. Restart your agent/IDE to load the new skills

---

## Custom Skills

To create custom skills for this project:

1. Create a directory in `.agents/skills/{your-skill}/`
2. Add a `SKILL.md` file with:
   - Description
   - When to use
   - Key patterns/rules
   - Examples
3. Add any reference materials in `references/`
4. Optionally add evaluation criteria in `evals/evals.json`

---

## Skills Used in This Project

Currently active skills in envivo-studio:

- **supabase-postgres-best-practices** - For database optimization and best practices
- **sdd-\*** (various) - For Spec-Driven Development workflow

---

_Last updated: March 21, 2026_
