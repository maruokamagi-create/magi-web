# MAGI-WEB Development Continuity Ledger

> **AUTHORITATIVE DEVELOPMENT HANDOFF**
>
> This file is the canonical continuity record for long-running MAGI-WEB development.
> Before changing MAGI production code, read this file from **GitHub main**, verify the current main commit, and continue from the state recorded here.
> Chat summaries and memory are secondary. If they conflict with this ledger plus the actual GitHub main/Vercel state, GitHub wins.

## Ledger metadata

- Ledger schema: 1
- State updated: 2026-10-06
- State base main SHA: 07b3cc2dcef129c4837b0de236a712f2d87e4295
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

## Latest investigation (2026-10-05)

- Real UI progress mapping is now confirmed from `magi-formal-runner-v373.js`: 28%=PRIMARY, 54%=CROSS, 72%=SECOND, 88%=FINAL.
- `engine/magi-engine-v1.js` confirms the browser performs PRIMARY personas -> CROSS orchestrator -> SECOND personas -> FINAL orchestrator.
- The previous exact TEAM_REVIEW production selftest stopped after PRIMARY, so it could never validate the user's 72% failure. This was a test-path gap, not proof that the UI path was healthy.
- Current work extends the TEAM_REVIEW production probe through all four formal phases. Do not call the 72% issue solved until that full-path probe and the real UI path complete.

## Latest production finding after full-path validation

- Production sequential run 37301330326 failed at exact live best-order before TEAM_REVIEW: SECOND_MELCHIOR returned HTTP 503 on all five request-level attempts.
- Therefore the 72% class of failure is not specific to the weakness question. SECOND persona generation is a shared deliberation reliability fault.
- The persona endpoint already returns a safe provider failure class, but the live selftest discarded it. The live test now preserves that safe class so the common SECOND fault can be diagnosed without guessing.

## Provider-rate-limit root cause and common fix

- Full-path diagnostics identified `provider_rate_limit` as the shared failure class, first in SECOND and later in PRIMARY when the provider-heavy production smoke suite immediately preceded the live E2E.
- PR #57 changed the browser engine to use the existing persona-batch endpoint for PRIMARY and SECOND, reducing a normal deliberation from six persona provider generations to two phase generations while keeping deterministic CROSS between them and persona-isolated SECOND compartments.
- The sequential production suite itself can consume the same Gemini project immediately before real-question E2E. A provider cooldown is therefore inserted between synthetic smoke tests and live E2E so the regression test measures a normal user run rather than self-induced test saturation.

## Live E2E timeout finding

- On main `1f98d4c6...`, the four smoke stages passed, then exact-live-best-order repeatedly returned HTTP 504.
- The batch endpoint was making optional extra model correction calls inside the same serverless request after the initial batch generation. That can exceed the request execution window.
- Batch phases are therefore constrained to one model generation. Deterministic soft-prose recovery remains allowed only when hard roster, candidate, numeric, and lineup guards are valid; hard inconsistencies still fail closed.

## Batch forecast-only validation finding

- After removing inline correction generations, production candidate-selection PRIMARY failed only because BALTHASAR used an unhedged future prediction.
- This is a soft prose guard, not a roster, candidate, numeric, evidence-source, or lineup integrity failure. When every reported issue is forecast-certainty-only, batch processing now removes prediction/analysis prose deterministically. Hard structural and evidence inconsistencies remain fail-closed.

## Provider-budget test isolation

- Main `6968b56c...` passed selection, full-lineup, pitching-plan and deliberation smoke tests, then the first live best-order E2E failed at PRIMARY with `provider_rate_limit` even after the suite cooldown plus the live job wait.
- Therefore fixed sleeps inside one provider-heavy chain are not a reliable capacity boundary. Synthetic smoke/reproducibility remains one sequential suite; real-question live E2E is a separate push-triggered workflow for deliberation-path changes, so smoke tests no longer gate or directly precede the user-path acceptance run.

## Provider 429 retry-storm finding

- The first independently triggered live best-order E2E still encountered provider 429/`provider_rate_limit`. Its selftest helper then retried the same PRIMARY batch up to five times, while curl could also retry the whole request. That behavior amplifies shared-project saturation and does not represent a safe user-path recovery.
- Provider-rate-limit is now fail-fast in the live E2E helper and curl no longer retries the whole expensive deliberation request. Other retryable HTTP/timeout failures keep bounded request-level recovery. This change does not alter semantic/evidence decisions or weaken persona guards.

## Real UI provider-rate-limit retry behavior

- Independent live E2E still receives provider 429 on the first PRIMARY batch, so test chaining is not the sole cause; the shared Gemini project is presently capacity/quota constrained.
- The browser engine also retried every 503/429 without reading `diagnostic.failureClass`. It now fails fast specifically for `provider_rate_limit`, preventing an iPhone/user deliberation from immediately replaying the same expensive provider request. Other retryable transport/server failures retain bounded retries.

## Provider acceptance ordering fix

- The supposedly separate Live E2E and sequential smoke suite were still both triggered by the same main push, so they competed for the same Gemini project at the same time. This invalidated the intended provider-budget isolation.
- Live E2E is now the first provider acceptance gate for MAGI deliberation-path changes. The provider-heavy sequential smoke/reproducibility suite no longer runs on the same push; it is triggered only after the Live E2E workflow completes successfully (or manually).
- Live E2E push coverage is broadened to the common MAGI server path, gateway, engine and both relevant workflow files so evidence/routing/persona changes cannot bypass the user-path gate.

## Provider quota-scope diagnostic

- With Live E2E fully gated ahead of the sequential suite, the very first PRIMARY batch still receives provider 429. This proves concurrent MAGI smoke tests are no longer required to reproduce the failure.
- The provider response is now parsed only for non-secret quota metadata: provider status, quota metric/id, model/location dimensions, retry delay, and derived quota window/scope. API keys, project secrets, request content and raw provider messages are not exposed.
- Use this diagnostic to decide whether the free path is a timed retry, a model-scoped fallback, or a quota reset issue; do not guess.

## Confirmed FreeTier quota root cause and fallback rule

- Fully isolated Live E2E exposed the provider quota metadata: quota ID `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, quota metric `generate_content_free_tier_requests`, window `DAY`, scope `MODEL`, exhausted model `gemini-3.5-flash`, provider retry delay about 28811 seconds at the observed failure.
- Therefore the previous assumption that every provider 429 is project-wide was wrong. For a MODEL-scoped quota only, canonical mode may continue to the next distinct configured Gemini fallback model under the same FreeTier project. PROJECT-scoped limits still fail fast. Strict consistency mode still suppresses fallback.
- The separate closer-evidence-trace workflow duplicated provider-heavy work already covered by the Live E2E closer case and could compete for fallback quota when selftest code changed. It is now manual-only; Live E2E remains the automatic user-path gate.

## Batched input-token quota finding

- After model-scoped daily fallback was enabled, Live E2E progressed past the exhausted `gemini-3.5-flash` daily quota and reached `gemini-3.6-flash`.
- It then hit `GenerateContentInputTokensPerModelPerMinute-FreeTier` (MINUTE + MODEL) with a provider retry delay of about 43 seconds.
- The normal persona-batch request was duplicating the same large CASE/Evidence inside all three persona payloads. PRIMARY now sends one sharedContext (CASE, Evidence, roster, temporal/history context) plus only persona-specific role/instruction. SECOND also shares CASE/Evidence once and keeps only ownPrimaryJudgment/crossExamination in each isolated persona compartment.
- This reduces provider input-token pressure without dropping Evidence, changing semantic routing, sharing persona judgments across compartments, or weakening validation.

## FreeTier reserve-model fallback

- After shared-Evidence batching reduced duplicated input, the current run still reached a DAY+MODEL FreeTier limit on `gemini-3.6-flash`. Existing configured models have therefore consumed their daily free request budgets during this debugging session.
- Official Gemini documentation currently lists Standard Free Tier availability for `gemini-3.5-flash-lite`, `gemini-3.8-flash`, and `gemini-3.1-flash-lite`. Canonical mode now appends these as distinct FreeTier reserve models after the configured primary/fallback/last-resort chain. Strict mode still uses only the primary model.
- Reserve fallback does not enable billing or a paid API path. Hard validation, Evidence rules and persona isolation are unchanged. Safe failure diagnostics now include the attempted model trail so future quota failures can be attributed without exposing keys or raw prompts.

## Live E2E serverless-boundary correction

- After FreeTier reserve-model fallback was added, the exact-live-best-order acceptance request ended as HTTP 504 at roughly the serverless request window.
- The old Live E2E endpoint performed PRIMARY, CROSS, SECOND and FINAL inside one outer Vercel function call, while the real browser performs those phases as separate HTTP requests. Therefore the old acceptance harness could time out cumulatively even when each real UI phase request is individually viable.
- The lineup Live E2E is now staged across four separate outer requests (PRIMARY -> CROSS -> SECOND -> FINAL). State is kept in short-lived Vercel cache under a per-run session key; the endpoint returns only safe summaries, not the stored CASE/Evidence payload.
- The staged SECOND intentionally matches the browser engine and does not run the selftest-only "all three identical -> extra SECOND recheck" provider call.

## Live Evidence preparation boundary correction

- The first staged lineup run still 504'd during PRIMARY because that outer selftest invocation was doing two things the browser does separately: rebuilding live Evidence and then calling persona-batch.
- The production UI obtains its Evidence packet before entering the formal three-sage engine. The acceptance harness now mirrors that boundary: PREPARE builds/validates/stores the live CASE/Evidence only; PRIMARY, CROSS, SECOND and FINAL load the short-lived staged state and do not rebuild Evidence.
- This means a future PRIMARY timeout now measures the provider/persona request itself instead of evidence-resolution time plus provider time combined.

## TEAM_REVIEW selection-leak root cause

- On main `c493cd62...`, production Live E2E passed full lineup, closer and natural third-batter.
- TEAM_REVIEW then failed in PRIMARY with `TEAM_REVIEW_PRIMARY_MELCHIOR_BECAME_SELECTION`: MELCHIOR returned candidatePlayers/candidateBasis even though TEAM_REVIEW is non-selection.
- Root cause: the single-persona handler cleared candidate fields after finalization, but persona-batch used the shared `finalizePersonaDraft()` result directly. The shared finalizer now clears candidatePlayers/candidateBasis for every non-selection case before change tracking and validation, so single and batch paths share the same structural contract.
- A regression test verifies TEAM_REVIEW cannot leak selection candidates through the shared finalizer.

## Deterministic persona failure retry contract

- After non-selection candidate normalization, Live E2E again passed lineup, closer and natural-third. TEAM_REVIEW PRIMARY now fails with `PERSONA_BATCH_VALIDATION_FAILED`, not candidate leakage.
- The batch response already marks deterministic validation failures with `retryFreshRequest:false` and `retryExhausted:true`, but both the live E2E helper and browser engine were retrying generic HTTP 503 anyway.
- Both callers now honor the server retry contract. Live diagnostics also preserve safe `code`, `persona`, and `guardIssueCodes`, so the next TEAM_REVIEW failure identifies the exact Evidence-language guard without repeating the same invalid generation.
- Browser errors now carry the server code and endpoint into the formal runner diagnostic instead of collapsing every deterministic 503 into a generic retry.

## Live deliberation milestone and review-answer quality finding

- Main `0d823447...` has a fully green production Live Deliberation run across four materially different real-data classes: full best order, closer selection, natural third-batter selection, and TEAM_REVIEW. The downstream sequential production suite is also green.
- The original 72% failure is therefore no longer reproduced in the current automatic production acceptance path; PRIMARY -> CROSS -> SECOND -> FINAL completes for TEAM_REVIEW.
- Quality review of the successful TEAM_REVIEW output exposed a separate semantic problem: generic proposal finalization rendered the weakness question as `条件付きで採用し、条件を確認しながら運用する。`, which is proposal language and does not directly answer a review/evaluation question.
- The same output also contained an unhedged `得点生産の依存度が高い` claim even though TEAM_REVIEW prompting explicitly says batting-rate concentration alone does not establish dependency.
- TEAM_REVIEW and PLAYER_REVIEW now use review-specific final semantics instead of adopt/reject proposal wording. A deterministic guard blocks unhedged dependency claims in TEAM_REVIEW unless framed as uncertainty; the batch path can sanitize the dependency-only soft-prose failure without weakening structural/numeric/evidence guards.

## Provider fallback serverless-deadline finding

- After the review-answer quality fix on main `91c3d2bc...`, the production Live E2E PREPARE stage passed but the first fresh PRIMARY request ended as HTTP 504 at about the Vercel function deadline.
- This run changed the TEAM_REVIEW/persona instruction text, so the canonical result cache legitimately missed. The common Gemini helper could then try several configured/reserve models sequentially; known daily/minute quota failures plus per-model timeouts can cumulatively exceed one serverless request even though each individual attempt is bounded.
- Provider quota cooldowns are now persisted in Vercel cache. MODEL-scoped 429 responses store a per-model cooldown using the provider retry delay/window; PROJECT-scoped 429 stores a project cooldown. Later serverless requests skip known cooling-down models instead of spending another provider call on them.
- The common Gemini helper also has a 46-second total provider budget inside a request, with a minimum remaining-attempt threshold. This makes failure explicit before the outer Vercel deadline rather than returning an opaque 504, while still leaving room to reach a healthy reserve model.
- Canonical result caching, Evidence rules, persona isolation, strict-mode behavior and the free-only provider policy are unchanged.

## TEAM_REVIEW synonym-grounding follow-up

- Current main `2a12c559...` is green for all four production Live Deliberation classes (best order, closer, natural third, TEAM_REVIEW) and the downstream sequential suite.
- Inspection of the successful TEAM_REVIEW final output still found unsupported inference expressed without the literal word 依存: `特定の高打率選手に頼っている`, `上位偏重`, `一部の選手に経験や負担が偏りがち`, and `試合に出場していない選手`.
- These phrases are now guarded as the same soft evidence-language class. Batch recovery rewrites only those soft TEAM_REVIEW phrases to measured batting/usage differences; hard evidence, numeric, roster and structural failures remain fail-closed.
- Regression cases G42-G44 cover reliance synonyms, inferred burden concentration, and invented non-appearance.

## Provider deadline headroom follow-up

- The TEAM_REVIEW synonym guard unit suite is green on main `c05334b...`.
- The production Live E2E triggered by the guard change still hit an outer HTTP 504 during staged lineup PRIMARY. PREPARE completed, so Evidence preparation was not the timeout source.
- The common Gemini helper's 46-second provider budget left too little margin inside the roughly 60-second serverless window for cache reads, request construction, validation and response serialization. The total provider-attempt budget is tightened to 34 seconds; individual model attempts remain bounded and known quota cooldowns are still skipped.
- The intended failure mode when no model can respond in time is now an explicit bounded 503/diagnostic before the outer platform deadline, not an opaque 504.

## Full-lineup standard-defense constraint follow-up

- On main `f96aeb20...`, staged PREPARE completed but fresh PRIMARY failed deterministically for CASPER with `FULL_LINEUP_STANDARD_DEFENSE / NO_COMPLETE_STANDARD_STARTING_MATCHING`: CASPER chose nine players that could not form all nine standard defensive positions using official-game or practice-game-one starts.
- The hard guard was correct and remains fail-closed. The reliability gap was that the model had to reconstruct the one-to-one defensive matching from the much larger appearance/fielding packet.
- A compact deterministic `standardDefenseEligibility` summary is now built from the same appearance Evidence and supplied to every FULL_LINEUP persona. It contains only legal standard-start positions by player and players by position. PRIMARY and SECOND instructions explicitly require a one-to-one matching across the same selected nine before returning candidatePlayers.
- This does not invent positions, use practice-game-two experiments, use substitute-only positions, force a fixed lineup, or override persona judgment; it makes the existing structural constraint explicit before generation.

## Staged E2E retry-boundary correction

- Main `07b3cc2d...` made the standard-defense constraint explicit, but the next staged lineup PRIMARY still ended as an outer HTTP 504.
- PREPARE completed in about 8 seconds. The PRIMARY outer request then consumed the full platform window. The staged harness was still retrying an inner `/api/magi/persona-batch` request up to five times inside one outer Vercel function invocation whenever the batch returned a retryable 5xx/timeout.
- That retry topology does not match the browser: in the real UI, retries occur from the browser as separate HTTP requests, so they do not share one serverless deadline.
- Staged PRIMARY and SECOND now perform exactly one inner persona-batch attempt per outer selftest invocation. Bounded retries are moved to the GitHub caller as fresh outer requests using the same short-lived session state. Daily model quota failures fail fast instead of hot-looping.

## Next concrete work

1. Re-run production Live Deliberation after the review-semantics/TEAM_REVIEW language correction and inspect the actual TEAM_REVIEW final output, not only pass/fail.
2. Confirm the final recommendation directly answers the review question and does not use proposal adoption wording.
3. Confirm batting concentration is not converted into an unsupported dependency claim.
4. Expand acceptance coverage from the current four live classes to the remaining Definition-of-Done classes: individual-player evaluation, team tactics/next-game strategy, comparison, direct statistics lookup, and CLARIFY.
5. Only declare the current stabilization complete after those classes are routed and rendered through their real production paths.

## Handoff instruction for a new ChatGPT chat

The user should not need to paste a long historical summary.

The correct first action is:
1. open this file from GitHub **main**;
2. inspect current main and commits since `State base main SHA`;
3. inspect current Vercel/Actions state;
4. continue from **Current unresolved priority** and **Next concrete work**.

Do not restart architectural discovery from memory. Do not ask the user to reconstruct work already recorded here.
