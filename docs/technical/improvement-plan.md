# Improvement Plan — Workspace & Multi-Tenant PDF Flow

## Goal
Harden the guided tenant → formulário → submissão → PDF journey to be resilient, predictable, and testable, aligning API and UI behavior.

## Scope
- UI flows: `/workspace`, `/submissions`, `/formulario`, `/profile`
- APIs: `/api/submissions`, `/api/templates`, `/api/organizations`, tenant resolver
- Cross-cutting: RBAC/tenant isolation validation and PDF export/diff UX

## Work Items (ordered)
1) Submissions ordering (P0)  
   - API: return latest-first with explicit `desc(submission.createdAt)`.  
   - Rationale: prevents stale ordering assumptions and simplifies UI.

2) Tenant selection reliability (P0)  
   - After creating/activating tenant in `/workspace`, immediately refresh templates/submissions; keep `activeOrgId` unchanged if switch fails and surface an error toast/message.  
   - Add abort/ignore-stale logic on fetches to avoid interleaved responses during fast switches.

3) Message scoping (P1)  
   - Separate tenant feedback from submission/PDF feedback in `/workspace` to avoid overwriting or persisting unrelated errors.

4) Form data integrity (P1)  
   - In `/formulario`, key collected values with stable identifiers (prefer `name`/template keys) to prevent collisions when labels repeat.  
   - Add lightweight CEP error hint on lookup failure.

5) Diff upload performance (P1)  
   - In `/submissions`, stream PDF uploads via `Blob`/`FormData` or `readAsDataURL` instead of manual base64 loops to avoid main-thread blocking on large files.

6) Template lifecycle clarity (P1)  
   - Enforce publish state on read (`status === "published"`) or add a server-side publish step to avoid drafts being used by the workspace.

7) Tenant resolution safety (P2)  
   - Short-circuit early when hostname validation fails; avoid falling back to `lastActiveOrgId` on invalid hosts to prevent cross-tenant leakage.

8) Error transparency in profile (P2)  
   - Distinguish “no tenants” from “failed to load tenants” with an explicit error state.

9) Test coverage (P0)  
   - Add integration tests covering: tenant switch + template isolation; submission creation/export (latest-first); RBAC denial paths; workspace guided flow happy path; diff upload request shape.

## Acceptance Criteria
- Workspace reliably reflects the active tenant after any create/switch and shows correct templates/submissions.  
- Submissions list and exports are latest-first across UI/API.  
- No unhandled runtime errors when API responses are malformed.  
- Large PDF diff uploads do not freeze the UI.  
- Tests enforce tenant isolation, RBAC checks, and ordering.

## Timeline (suggested)
- Week 1: Items 1, 2, 9.  
- Week 2: Items 3–5.  
- Week 3: Items 6–8 and polish based on test results.
