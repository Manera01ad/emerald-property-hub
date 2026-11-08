# PropWise AI: OpenHands free local QA pilot

Work only in this isolated clone: `/projects/emerald-property-hub`.
GitHub task: https://github.com/Manera01ad/emerald-property-hub/issues/53

## Objective

Perform ONE low-risk quality-assurance exercise: identify an existing mockable regression gap in public property-listing visibility, photo permission checks, or enquiry consent, and propose a narrow test improvement. Prefer a single test file with a reproducible assertion. If the test framework cannot run locally, document exactly why.

## Mandatory rules

1. Read `AGENTS.md`, `docs/cto/CTO_TEAM.md` and `docs/CURRENT_STATE.md` first. PropWise AI already migrated away from Lovable. Do NOT restart migration discovery.
2. Edit ONLY under `e2e/` or `src/test/`. If necessary target tests are elsewhere, **stop and report** rather than modifying out-of-scope files.
3. Do not access production, real user data, personal documents, `.env`, GitHub tokens, service-role credentials, payment APIs or private photos. Use mock fixtures only.
4. Never modify databases, run migrations, deploy, change authentication/RLS policies, GitHub Actions, branch protection, `AGENTS.md` or repository settings.
5. Do not install unfamiliar external packages, run privilege-escalation commands, open ports, or change local security settings.
6. Do not push, merge or approve a PR. This pilot works only in a local clone. The owner decides whether the result should become a PR.
7. Keep the change to one focused task; do not rewrite or format the entire project.
8. If the local model cannot reason reliably or tools repeatedly fail, stop rather than inventing test results.

## Completion report

State: tested / not tested; files changed; test command and exact exit status; expected behavior; any other affected code; risks and limitations; why any acceptance criterion remains incomplete.

Do not claim a test passed unless you actually ran it.
