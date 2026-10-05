# MAGI-WEB Development Continuity Ledger

> **AUTHORITATIVE DEVELOPMENT HANDOFF**
>
> This file is the canonical continuity record for long-running MAGI-WEB development.
> Before changing MAGI production code, read this file from **GitHub main**, verify the current main commit, and continue from the state recorded here.
> Chat summaries and memory are secondary. If they conflict with this ledger plus the actual GitHub main/Vercel state, GitHub wins.

## Ledger metadata

- Ledger schema: 1
- State updated: 2026-10-05
- State base main SHA: ddd1e29dc06348d6b61e606e245646c9691644cb
- Repository: maruokamagi-create/magi-web
- Production: magi-web.vercel.app
- Primary branch: main

## Non-negotiable project objective

MAGI must accept ordinary user questions, understand their meaning semantically, choose the evidence appropriate to that question, run the three-sage deliberation when deliberation is appropriate, and return a grounded, useful answer.

The project is **not** complete merely because:
- a selftest is green;
- one hard-coded question works;
- best-order selection works;
- a CSV was repaired;
- a production endpoint returns HTTP 200.

The common pipeline is the product:

**question understanding → intent/mode/domain/selection decision → evidence resolution → PRIMARY independent judgments → cross-examination → SECOND judgments → final answer**

A fix that only special-cases one literal question is not an acceptable architectural solution unless the literal is used solely as a regression test for a general semantic class.

## Definition of done for the current stabilization work

Do not declare the question-handling problem solved until the **actual production UI execution path** can complete and answer multiple materially different question classes, including at minimum:

1. current-team review / weakness or change;
2. full 1–9 lineup;
3. single batting-slot selection;
4. pitching-role selection such as closer;
5. individual-player evaluation;
6. team tactics / next-game strategy;
7. comparison;
8. direct statistics lookup;
9. ambiguous question that should CLARIFY rather than guess.

Tests must exercise the same production path used by the UI wherever possible. A test-only endpoint is supporting evidence, not a substitute for actual UI-path validation.

## Architecture invariants

- Gemini semantic authority is the top-level question-understanding authority.
- Semantic intent must not be silently overridden later by raw-question regex.
- TEAM_REVIEW is not player selection and must not be converted into LINEUP.
- FULL_LINEUP must review the complete current 14-player roster and actual appearance/position/order evidence.
- Historical/old-team evidence is reference material only and must not overwrite current-team evaluation.
- Facts and interpretation must remain separated.
- Unsupported numbers, roles, personality, mental traits, causal claims and future outcomes must not be invented.
- Deterministic evidence guards remain fail-closed. Do not weaken a guard merely to make a test green.
- A dated observation about one player/game/position must not be generalized into a team-wide weakness without repeated/team-level evidence.
- A recommendation to improve/monitor something is not itself proof that the team currently fails at it.
- Spread/concentration in batting rates alone does not prove dependency on specific hitters.
- Coach intent is date-sensitive and must not be inferred without evidence.
- Current roster and official names come from authoritative evidence, not hard-coded lineup assumptions.

## Data safety invariants

- Google Drive originals are read-only unless the user explicitly authorizes a repair/change.
- Never rename, move or reorganize Drive originals without explicit permission.
- Do not edit CSV originals merely to make code/tests pass.
- GitHub main + production Vercel are the software source of truth.
- For appearance/fielding/order, use the restored canonical current evidence and primary score-sheet records.
- Current canonical appearance set contains 13 games as of 2026-10-05.
- No Drive/CSV mutation was made by the TEAM_REVIEW fixes on 2026-10-05.

## Current verified software state

Base main SHA at this ledger update:
`ddd1e29dc06348d6b61e606e245646c9691644cb`

Recent architectural fixes already merged:

- `5f4d7f3969ed` — restored 13-game appearance CSV used as canonical evidence.
- `5498d3642abd` — TEAM_REVIEW evidence separated from player selection.
- `87ef3a7e49fb` — orchestrator preserves semantic selection intent instead of reclassifying by raw regex.
- `61e48917260e` — persona-batch gained correction passes while deterministic guards remain fail-closed.
- `36e903932383` — TEAM_REVIEW gained an explicit persona mode instead of being treated as a focused player/role proposal.
- `c1ee31b39fac` — exact natural TEAM_REVIEW regression test added to production sequential suite.
- `cd5975871bf5` — TEAM_REVIEW live validation corrected so a legitimate full-14 checkedPlayers audit is not mistaken for candidate selection.
- `ddd1e29dc063` — TEAM_REVIEW grounding tightened against team-wide overgeneralization and unsupported dependency claims.

## What the real UI exposed

Literal regression question used:
`今の丸岡中の弱点は何？`

This sentence is a regression probe for the **general TEAM_REVIEW class**, not a product special case.

Observed sequence:
1. UI initially stopped at 28% with `PRIMARY batch response failed persona validation`.
2. Adding batch correction alone did not solve the UI failure.
3. Root architectural mismatch found: TEAM_REVIEW evidence/routing existed, but persona processing still treated every non-selection deliberation as a focused proposal.
4. After TEAM_REVIEW persona-mode separation, the UI advanced to 72%, proving the previous 28% failure changed, but the real UI still did not finish.
5. Exact production TEAM_REVIEW batch selftest then completed successfully.
6. That test exposed a false test assumption around `checkedPlayers`; full-roster auditing is allowed, candidate selection is not.
7. Production sequential suite subsequently completed successfully on `cd597587...`.
8. The user's actual iPhone UI still showed the 72% failure before the latest grounding-only change. Therefore **the real UI-path issue is NOT yet considered solved**.

## Current unresolved priority

**P0: actual production UI-path reliability across question classes.**

Do not spend the next cycle merely polishing the literal weakness question.

The next investigation must trace what the actual UI does after PRIMARY through the 72% stage:
- exact endpoint/action invoked;
- cross-examination payload;
- SECOND batch;
- finalization;
- client-side error mapping;
- any difference between UI case data and selftest case data.

Then generalize the fix across deliberation modes.

## Important failed/incomplete approaches

Do not repeat these as if they were solutions:

- “Production suite is green, therefore the UI is fixed.” False; the user reproduced failures afterward.
- “Add retry/correction to persona-batch and declare success.” Insufficient; UI moved from 28% to 72%.
- “Fix only TEAM_REVIEW wording.” Insufficient as a project strategy; the product must support many question classes.
- “Create another test that bypasses the real UI path.” Useful diagnostically, but not sufficient proof.
- “We can rely on chat handoff text.” Proven unreliable over long sessions.

## Required development protocol

For any PR that changes MAGI production behavior under the protected paths defined by the continuity guard:

1. Read this ledger from main before editing.
2. Compare the ledger base SHA with current main and inspect commits since that base.
3. State whether the new work changes objective, architecture invariants, unresolved priority, or verified state.
4. Update this ledger in the same PR.
5. Record what changed, why, what was actually verified, what remains unresolved, and the pre-merge main SHA used as the state base.
6. Never mark an issue solved solely from a narrower test than the user's failing path.

## Next concrete work

1. Trace the real UI formal-deliberation runner from the user's submit action through the 72% stage.
2. Map UI progress percentages to server/client phases.
3. Compare the UI's case/payload with the successful exact TEAM_REVIEW selftest payload.
4. Find the first divergence after successful PRIMARY.
5. Fix the common deliberation pipeline, not the literal question.
6. Add cross-class UI-path regression coverage.
7. Only after actual UI completion, evaluate answer quality.

## Handoff instruction for a new ChatGPT chat

The user should not need to paste a long historical summary.

The correct first action is:
1. open this file from GitHub **main**;
2. inspect current main and commits since `State base main SHA`;
3. inspect current Vercel/Actions state;
4. continue from **Current unresolved priority** and **Next concrete work**.

Do not restart architectural discovery from memory. Do not ask the user to reconstruct work already recorded here.
