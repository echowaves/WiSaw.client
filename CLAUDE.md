# BMad Workflow

This project uses the **BMad Method** for all structured development work. All features, fixes, and meaningful changes flow through BMad skills (installed via `skills-lock.json`, available in `.agents/skills/` and `.claude/skills/`). OpenSpec was removed on 2026-10-27; do not create or reference `openspec/` artifacts.

## Core Rule: Skill Awareness

Route work through the installed BMad skills instead of ad-hoc documents:

| Situation | Skill |
|-----------|-------|
| New feature / meaningful change (delegated work) | `bmad-build` |
| Explore an idea, pressure-test thinking | `bmad-spec`, `bmad-forge-idea`, `bmad-brainstorming` |
| Break work into epics/stories/tickets | `bmad-ticket` |
| PRD / brief / UX / architecture | `bmad-prd`, `bmad-product-brief`, `bmad-ux`, `bmad-architecture` |
| Research market/tech/competitors | `bmad-deep-recon` |
| Review code changes | `bmad-code-review` or `bmad-review` |
| Retrospective on a finished epic | `bmad-retrospective` |

Obvious, low-risk mechanical maintenance (typos, formatting, asset swaps) can be done directly without ceremony. When in doubt, ask BMad (`/bmad`) which skill fits.

## Project Context

- **This repo (WiSaw.client)**: React 18 SPA (Vite), JavaScript only, Apollo Client + GraphQL against AWS AppSync, React Bootstrap, plain CSS, `react-helmet-async` for SEO. Conventions: `.github/copilot-instructions.md` is the source of truth.
- **Backend repo**: `/Users/dmitry/hacks/wisaw/WiSaw.cdk` (AWS CDK, AppSync). API schema: `https://github.com/echowaves/WiSaw.cdk/blob/main/graphql/schema.graphql` via the GitHub MCP server.
- **Dependencies**: always use exact versions (no `^` or `~` prefixes)
- **Complexity limit**: maximum cyclomatic complexity of 8 — extract helpers, early returns
- **Security**: `.env` must never be committed; secrets must never be hardcoded
- **Deployment**: no CI/CD; build locally (`npm run build`) and upload static files to the wisaw.com S3 origin, then invalidate CloudFront (10-day pinned TTL)
