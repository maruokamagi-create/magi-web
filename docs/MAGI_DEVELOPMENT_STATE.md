# MAGI-WEB Development Continuity Ledger

> **AUTHORITATIVE DEVELOPMENT HANDOFF**
>
> This file is the canonical continuity record for long-running MAGI-WEB development.
> Before changing MAGI production code, read this file from **GitHub main**, verify the current main commit, and continue from the state recorded here.
> Chat summaries and memory are secondary. If they conflict with this ledger plus the actual GitHub main/Vercel state, GitHub wins.

## Ledger metadata

- Ledger schema: 1
- State updated: 2026-10-09
- State base main SHA: 49e6ba803e25862e38379840ad615f2b6fb9d484
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
`df4d13fdad9a11fe78019b5e2ff995d081dd10b1`

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

## Natural-third burden-language follow-up

- Main `96d298bf...` passed the staged full best-order path and the live closer path.
- The natural-third live E2E then failed deterministically in PRIMARY/CASPER because the generated prose strengthened the supplied Evidence level from 「兼任負担を考慮する必要がある」 into a claim about burden magnitude or concrete harm.
- Candidate structure itself was not the failure. Persona-batch now treats this exact burden-escalation-only guard as a soft prose issue: unsupported burden/harm sentences are removed, the candidate sequence is preserved, and any emptied explanatory field falls back to the exact supported Evidence level. Structural, roster, numeric, candidate and Evidence-source guards remain fail-closed.


## TEAM_REVIEW mixed soft-guard recovery follow-up

- Main `e6b5bf46...` passed the staged full best-order path, closer path, and natural-third path in production Live Deliberation run 37460085756.
- TEAM_REVIEW then failed in SECOND/CASPER with two simultaneous deterministic soft prose issues: unsupported burden concentration from usage spread, plus an unhedged future-outcome statement.
- The persona-batch recovery chain previously required every guard issue to belong to one single soft family. A mixed set of otherwise recoverable TEAM_REVIEW/burden/forecast prose therefore bypassed all soft sanitizers and returned a deterministic 503.
- Persona-batch now accepts a mixed set only when every issue belongs to one of those already-approved soft prose families, partitions the issues by family, and applies each existing sanitizer to its own subset. Any structural, roster, numeric, evidence-source, candidate, or unknown guard issue still fails closed.
- Deterministic unit coverage now exercises mixed TEAM_REVIEW + forecast and burden + forecast recovery, and the deliberation unit workflow is triggered by persona-batch changes so this path is no longer live-E2E-only coverage.


## Post-merge Live E2E verification trigger

- PR #84 merged as main `2429b4f4...`; the Vercel production deployment for that SHA completed successfully.
- The connector-driven squash merge did not produce the expected push-triggered Live Deliberation Actions run. To avoid leaving production acceptance unverified, a no-behavior-change comment in the Live E2E workflow plus this ledger update is pushed as one atomic main commit solely to trigger the production acceptance gate.
- Production behavior is unchanged by this trigger commit. The verification target remains the PR #84 mixed-soft persona-batch recovery.


## Staged TEAM_REVIEW E2E follow-up

- Production recheck of Live Deliberation run 37460085756 attempt 2 confirmed that the mixed-soft persona recovery no longer fails at SECOND/CASPER.
- The remaining failure moved outward: the legacy monolithic `mode=teamReview` selftest hit HTTP 504 on its first full request, then a retry failed at `TEAM_REVIEW_CROSS`. TEAM_REVIEW was still executing Evidence preparation, PRIMARY, CROSS, SECOND and FINAL inside one outer Vercel invocation.
- TEAM_REVIEW Live E2E now uses the same short-lived session-state architecture as full lineup: PREPARE -> PRIMARY -> CROSS -> SECOND -> FINAL are separate outer requests sharing one cached CASE and phase results.
- PRIMARY, CROSS, SECOND and FINAL each make only one inner phase request per outer selftest call; bounded retries are owned by the GitHub caller as fresh HTTP requests using the same session. This matches the browser retry boundary and prevents cumulative serverless-deadline consumption.
- Full-lineup staged PRIMARY is also explicitly limited to one inner persona-batch attempt, matching the existing ledger contract.


## Deterministic TEAM_REVIEW cross-examination follow-up

- Production Live Deliberation run 37463862268 confirmed that staged PREPARE and PRIMARY complete quickly, so the Vercel cumulative-timeout problem is resolved for TEAM_REVIEW.
- The first staged CROSS then returned the fail-closed cross shape with an empty MELCHIOR challenge on three fresh outer attempts. This is a CROSS content/guard issue, not a serverless-duration issue.
- TEAM_REVIEW CROSS is now deterministic from the three locked PRIMARY judgments, analogous to the existing deterministic candidate/full-lineup cross paths. It does not invent new player facts or numbers.
- The three fixed challenge streams explicitly force re-checking the exact inference boundaries that have caused recent TEAM_REVIEW failures: measured differences versus team-level weakness, measured batting differences versus unsupported causal/game-result claims, and usage differences versus unsupported extra facts.
- The deterministic cross is still passed through the existing cross-output guard before use. Any future guard conflict fails closed rather than weakening evidence validation.


## Sequential selection unsupported-metric follow-up

- Main `354742b2...` completed production Live Deliberation run 37465433877 successfully across staged best-order, closer, natural-third and TEAM_REVIEW.
- The downstream sequential suite run 37466134854 then failed in the synthetic single-slot selection smoke at PRIMARY/MELCHIOR. The model described 「長打率」「出塁率」 even though that fixed Evidence supplied AVG and OPS only.
- The existing deterministic guard correctly rejected both labels. The selection prompt already explicitly forbids decomposing OPS into OBP/SLG, so another prompt-only warning would not make the acceptance path reliable.
- Persona-batch now performs a narrow deterministic recovery only when every guard issue is exactly an unsupported non-numeric 出塁率/長打率 label. Sentences containing those unsupplied labels are removed and the existing candidate order is preserved. If an unsupported metric sentence contains any numeric value, or if any structural/roster/standard-defense/evidence-source/other guard issue is present, recovery is refused and the batch still fails closed.
- The sanitized result is re-run through the authoritative persona output guard before it can be returned. Deterministic unit coverage checks the recoverable label-only case, numeric fail-closed behavior, and mixed-hard-issue fail-closed behavior.


## Unsupported-metric recovery production verification

- PR #87 merged as main `a8fc3ae1...`; Vercel production deployment completed successfully.
- The first Live Deliberation run #113 attempt failed at staged lineup PRIMARY only with transient provider classes (`provider_retryable_http`, `invalid_structured_json`, then `timeout`). No deterministic guard or unsupported-metric recovery failure was involved.
- Re-running the failed Live workflow without any code change completed successfully across all four automatic real-data classes: staged full best-order, closer, natural third-batter, and staged TEAM_REVIEW.
- The downstream Sequential Deliberation Suite run #180 then completed successfully across all five jobs: selection, full-lineup, pitching-plan, deliberation, and reproducibility.
- This specifically verifies the previous sequential selection failure caused by unsupported non-numeric 出塁率/長打率 labels is resolved while the production Live acceptance path remains green.
- Current acceptance baseline: Live Deliberation #113 = SUCCESS (attempt 2); Sequential Suite #180 = SUCCESS.

## TEAM_REVIEW final semantic-grounding follow-up

- The current production acceptance baseline remains Live Deliberation #113 attempt 2 = SUCCESS and Sequential Suite #180 = SUCCESS, but inspection of the actual successful TEAM_REVIEW output showed that pass/fail alone was not sufficient proof of answer quality.
- The successful production output still contained a colloquial dependency assertion in BALTHASAR's visible persona text (「上位に頼りっきり」), while the existing TEAM_REVIEW dependency guard covered 「依存」「頼っている」「頼り切」 but not that exact colloquial spelling.
- The TEAM_REVIEW FINAL also promoted SECOND `primaryReason` text directly into 「現時点の重点課題」. In the observed run this elevated measured batting/usage spread into stronger claims such as a proven team weakness, tactical weakness, or development impact even though the project rule says measured spread alone does not prove dependency, causation, or team-wide weakness.
- The current fix extends the dependency guard/recovery only for the missing colloquial wording and adds a TEAM_REVIEW-only final grounding layer. Batting/usage spread is reduced to the directly supported measured difference when the source reason overreaches into dependency/weakness/causal impact. Directly observed non-inference findings remain unchanged.
- TEAM_REVIEW final prediction text is not published from spread-only review synthesis, so a current-state review cannot turn measured spread into unsupported future outcomes. A grounding warning records that dependency/causation/future effects are not established by numeric spread alone.
- Regression coverage now includes the exact production-style 「頼りっきり」 wording, safe soft recovery of that sentence, prevention of spread-to-proven-weakness elevation in FINAL, and preservation of directly observed findings.

## Natural-third staged Live E2E and inning-unit false-positive follow-up

- Main `5def482f...` (the TEAM_REVIEW final-grounding merge) passed the ordinary main unit/continuity/UI checks, but Production Live Deliberation run #114 failed before TEAM_REVIEW because the natural third-batter job remained monolithic.
- Run #114 attempt 1 first hit the Vercel outer-request timeout (HTTP 504). A fresh curl retry then failed deterministically in PRIMARY/MELCHIOR with `PERSONA_BATCH_VALIDATION_FAILED`: Evidence contained an IP value of 1 and the generic ambiguous-inning guard interpreted an unlabeled 「1回」 in non-pitching prose as that innings value.
- Run #114 attempt 2 reproduced the same deterministic guard issue immediately, so this was not treated as a transient provider failure and the guard was not weakened.
- The ambiguous-inning rule still blocks pitching prose such as 「現チームのサンプルはまだ5回」 when Evidence says IP=5.0, but it now excludes explicitly batting-order/batting sentences such as 「3番起用が1回」 from being reinterpreted as innings merely because the number overlaps an IP value. Regression coverage preserves both sides of that boundary.
- The exact natural-third Live E2E is now staged with the same short-lived server-side session architecture already used by full lineup and TEAM_REVIEW: PREPARE -> PRIMARY -> CROSS -> SECOND -> FINAL are separate outer requests. PRIMARY and SECOND use one inner persona-batch attempt per outer request, while bounded transport retries are fresh outer requests from the workflow.
- The natural-third workflow fails fast on deterministic persona validation and daily provider quota instead of hot-looping, while retaining bounded recovery for genuinely retryable request failures.

## Production Live #115 TEAM_REVIEW content inspection

- Main `7a97c002...` completed Production Live Deliberation #115 successfully across all four current real-data classes: staged full best-order, closer, staged natural third-batter, and staged TEAM_REVIEW.
- The staged natural-third path therefore resolved both failures seen in #114: it no longer depends on one long Vercel request, and the batting-order 「1回」 regression no longer trips the ambiguous-innings guard.
- Actual TEAM_REVIEW output inspection confirmed that the earlier colloquial 「頼りっきり」 wording was gone and FINAL `prediction` was empty as intended.
- One residual contradiction remained in FINAL: the recommendation correctly stated that numeric spread alone does not prove dependency or a team-wide weakness, while `majorReasons` still contained BALTHASAR's sentence that 「記録に見える偏りがチームの弱点である」. A second reason also retained meta-language that numeric spread did not justify changing the persona's judgment.
- The follow-up grounding therefore treats generic record/numeric spread plus weakness/strategy/judgment-overclaim language the same way as batting/usage-specific spread: it is reduced to the directly supported fact that verified records contain numeric differences.
- TEAM_REVIEW FINAL also drops future-causal warnings such as 「目先の効率だけに囚われると、組織全体の持続的な成長が損なわれる」 when the outcome is not directly established by Evidence. Directly observed non-inference findings remain preserved.
- Regression case R10 uses the exact production-style sentences from #115 so this contradiction cannot silently re-enter FINAL.


## Production Live #116 visible-persona semantic inspection

- Main `40bec687...` completed Production Live Deliberation #116 successfully across staged full best-order, closer, staged natural third-batter and staged TEAM_REVIEW. The downstream Production Sequential Deliberation Suite #184 also completed successfully.
- The #115 FINAL contradiction is resolved in #116: TEAM_REVIEW FINAL no longer says both 「数値差だけでは弱点と断定しない」 and 「偏りがチームの弱点である」 in its major reasons.
- Full log inspection still found a product-quality gap before FINAL. Visible PRIMARY/SECOND persona prose could convert measured batting spread or individual hitless results into stronger claims such as 「今の弱点は打線の偏り」, 「得点源が限定」, 「得点力や戦術的な課題に直結」, or generic future/development advice such as 「半年後や1年後」.
- A green workflow is therefore not sufficient unless visible PRIMARY/SECOND text is also grounded. Current branch `fix/team-review-visible-grounding-20261007` adds deterministic guards for spread-to-weakness/tactics/development escalation, individual batting result-to-scoring causality, and unsupported future/development advice.
- Soft recovery for those narrowly defined TEAM_REVIEW prose issues now preserves the directly observed record, removes the stronger inference, clears forecast content, and re-runs the authoritative persona guard before any sanitized result can be published. Unknown, structural, roster, numeric and evidence-source issues remain fail-closed.
- TEAM_REVIEW prompts are tightened to state explicitly that numeric spread, hitless counts and usage differences are reportable facts but do not by themselves prove a team-wide weakness, scoring dependency, tactical failure, development impact or wins.
- FINAL synthesis now derives a useful recent batting finding directly from structured `CASE.evidence.recentSix`, not from model prose: when present, players with AB>0 and H=0 are reported as a current observed fact. This keeps FINAL informative while preserving the inference boundary.
- Production Live TEAM_REVIEW acceptance is strengthened so PRIMARY and SECOND must reject the exact unsupported semantic classes observed in #116, and FINAL must contain the direct recent hitless fact without the old contradiction.



## Production Live #117 closer reliability follow-up

- Main `3cae4007...` merged the visible TEAM_REVIEW grounding fix. Production Live #117 then exposed two independent runtime reliability issues before TEAM_REVIEW could be rechecked.
- The best-order stage initially failed with only transient provider classes (`provider_retryable_http`, `timeout`, `invalid_structured_json`) and then succeeded on a fresh workflow attempt without any code change. This confirms the lineup logic itself was not the deterministic failure.
- The closer path remained monolithic. One closer request first hit HTTP 504, and the next request failed deterministically in PRIMARY/BALTHASAR because unsupported future-result language survived in assertive fields even though the existing soft forecast recovery only cleared `analysis` and `prediction`.
- Soft forecast recovery now removes only sentences that match the same unsupported hard-guarantee/unhedged-outcome class from all user-visible and assertive persona fields, preserves candidate structure, adds an explicit Evidence-boundary warning, and re-runs the authoritative persona guard. Numeric/roster/structural/evidence-source failures remain fail-closed.
- Closer production E2E is now staged as PREPARE -> PRIMARY -> CROSS -> SECOND -> FINAL using the same short-lived server-side session model as full lineup, natural third and TEAM_REVIEW. This removes the remaining long single-request closer path and avoids cumulative Vercel deadline consumption.
- Staged closer PREPARE verifies 14-player current Evidence, PITCHING_ROLE routing, pitcher eligibility, coach-observation availability and 坂田 暉馬's verified SV=2 before any persona generation. FINAL verifies every returned candidate is pitching-eligible and that save Evidence is actually used.
- Error responses now report the actual question for closer/natural-third/TEAM_REVIEW instead of always showing the best-order question, improving diagnosis without changing product behavior.



## Production Live #118 selection-grounding follow-up

- Main `36cb7fc3...` includes the staged closer path and broader unsupported-future soft recovery. Production Live #118 attempt 1 failed only on transient lineup provider output (`timeout`, `invalid_structured_json`) and was re-run without a code change.
- Attempt 2 completed staged best-order, staged closer and staged natural-third. The closer path now completes without the former monolithic 504 and uses the verified 坂田 暉馬 SV=2 Evidence.
- Semantic inspection of the successful closer output found residual inference overreach: verified ERA/WHIP/appearance numbers were described as 「安定している」「信頼できる」「長いイニングを任せられる」, and FINAL included a win-probability claim. Those qualities are not directly established by the supplied metrics alone.
- Semantic inspection of the successful natural-third output found the same pattern in batting-order form: verified 3番起用回数, AVG and OPS were elevated into 「戦術的に最も安定」 and 「チームの戦術で裏付け」; CASPER also added unsupported role-concentration/growth-impact warnings.
- New selection guards therefore distinguish directly observed numeric/usage facts from unsupported stability, trust, tactical-optimality and growth-impact claims. Narrow deterministic recovery removes only those unsupported sentences while preserving candidate structure and verified facts, then re-runs the authoritative guard.
- PITCHING_ROLE and BATTING_ORDER FINAL synthesis now grounds `majorReasons` and warnings with the same boundary so unsupported inference cannot re-enter at FINAL even when candidate aggregation itself is valid.
- The TEAM_REVIEW job in #118 still failed at PRIMARY/CASPER with the same pair of soft issues seen previously: unsupported burden concentration plus an unhedged future effect in the same response. TEAM_REVIEW recovery now performs one additional exact-class sentence cleanup after dependency/future recovery before authoritative re-validation. Hard numeric, roster, structural and evidence-source failures remain fail-closed.
- Regression coverage includes the exact #118 closer, natural-third and TEAM_REVIEW semantic classes.



## Production Live #119 metric-mismatch follow-up

- Main `546ef830...` contains the #118 selection-grounding fixes. Production Live #119 attempt 1 failed only at staged best-order PRIMARY with transient provider output classes (`timeout`, `invalid_structured_json`) and was re-run without a code change.
- Attempt 2 completed staged best-order successfully. The returned lineup used nine unique current players and nine unique standard defensive positions, with every position backed by official or first-practice starting evidence.
- The staged closer path then failed at PRIMARY/MELCHIOR because the model stated 「登板数4」 while the structured CASE/Evidence contained different verified APP values. The numeric guard correctly blocked publication.
- This is a model transcription error, not a reason to weaken numeric validation. A narrow selection-only recovery now removes the entire sentence containing the mismatched metric/value rather than correcting or guessing the number. Candidate structure and unrelated verified facts are preserved.
- Recovery is allowed only when every guard issue is exactly a supplied metric-value mismatch for APP/IP/SO/BB/HBP/ERA/WHIP/SV. Any roster, structural, evidence-source, unsupported-metric, or mixed hard issue remains fail-closed. The sanitized result is re-run through the authoritative persona guard before publication.
- Regression coverage includes the exact #119 「登板数4」 failure and proves mixed mismatch plus hard-error cases remain fail-closed.



## Production Live #119 repeated closer numeric-mismatch follow-up

- Main `546ef830...` contains the selection-grounding and TEAM_REVIEW mixed-soft-recovery changes from PR #94. All ordinary main checks passed after merge.
- Production Live #119 attempt 1 failed staged best-order PRIMARY only with transient provider classes (`timeout -> invalid_structured_json -> timeout`). No deterministic guard issue was reported.
- Attempt 2 completed staged best-order, then closer PRIMARY failed closed because MELCHIOR emitted `登板数4`, which does not match any supplied current Evidence value.
- Attempt 3 reproduced the exact same `登板数4 は supplied CASE/EVIDENCE の 登板数 値と一致しない` immediately. The source Evidence was not changed; the repeated identical generation indicates the same invalid model/canonical result can be reused, so repeated workflow reruns are not a sufficient recovery strategy.
- Persona-batch already had a deliberately narrow `recoverMismatchedSelectionMetricSentences` path: only candidate-selection cases, only when every issue is an exact numeric metric mismatch, remove only the sentence containing that mismatched number, preserve candidate structure and other verified facts, then re-run the authoritative persona guard. Mixed roster/structural/evidence failures remain fail-closed.
- Inspection found the regex-escaping statement inside that recovery path had been corrupted, so the intended sentence match could not work. The branch `fix/persona-appearance-count-recovery-20261007` repairs that line to the standard regex-special-character escape and retains the existing exact `登板数4` regression test.
- This repair does not substitute a corrected number and does not weaken numeric validation: the unsupported sentence is removed, and only Evidence-matching remaining text is publishable after re-validation.



## Production Live #120 mixed selection/forecast recovery follow-up

- Main `fd4f3e91...` added the narrow selection metric-mismatch sentence recovery intended to redact the repeated invalid `登板数4` phrase while preserving candidate structure and verified facts.
- Production Live #120 completed staged best-order and reached closer PRIMARY. The earlier numeric mismatch no longer surfaced as the blocking issue, confirming the metric-sentence recovery path was now being reached after the regex-escape repair work.
- Closer PRIMARY then failed closed in BALTHASAR with a mixed soft-issue set: `PITCHING_ROLEで投手数値から安定・信頼・長いイニング適性を断定している` plus the existing hard/unhedged future-result warnings.
- The existing selection-inference recovery accepted only a pure selection-inference issue set, while forecast recovery accepted only a pure forecast issue set. A response containing both safe-to-sanitize classes therefore failed even though neither issue required altering candidate structure or inventing Evidence.
- Branch `fix/mixed-selection-forecast-recovery-20261007` allows selection-inference recovery only when there is at least one recognized selection-soft issue and every remaining issue is either the same recognized selection-soft class or an existing recognized forecast-soft class. It first removes unsupported stability/trust/tactical/growth sentences, then applies the existing forecast sanitizer, preserves candidate order, and re-runs the authoritative persona guard.
- Numeric mismatches, roster/structure/source failures and any unknown guard class are still excluded from this mixed recovery and remain fail-closed.
- Regression coverage uses the exact #120 closer issue combination and verifies that unsupported stability/trust/guaranteed-win wording is removed while the two closer candidates are preserved.



## Production Live #122 visible selection semantics and TEAM_REVIEW recovery follow-up

- Main `b5cd7cfd...` completed staged best-order, staged closer and staged natural-third structurally in Production Live #122. TEAM_REVIEW still failed at PRIMARY/CASPER with the pure soft issue `TEAM_REVIEWで起用差から負担集中を断定している`.
- Full closer log inspection showed that structural success was still not sufficient. Visible persona text retained unsupported claims such as ERA/IP -> 「安定している」「信頼できる」, save count -> 「終盤の競った場面を切り抜けた実績」, unsupported 「確率的優位性」, and CASPER's generic 「半年後」「投手層」「チーム全体の成長」「過度な依存」 framing. FINAL also retained debate-meta wording and future/win rhetoric even though the candidate aggregation itself was valid.
- Full natural-third log inspection found the same pattern in batting-order form: 3番 starts were described as 「ポジション適性」 or 「最も確実な選択肢」, CASPER added generic半年後/growth framing, and Maruoka player names were rendered with `くん/君`.
- Current branch `fix/closer-visible-semantic-grounding-20261007` tightens the exact evidence boundaries rather than weakening validation: save count may remain a direct fact, but it does not by itself prove pressure-game experience or win probability; current-role questions do not admit generic future-development framing unless the user explicitly asks for it; 3番 usage may remain a direct usage fact but does not become position suitability, tactical certainty or player development evidence.
- Maruoka player honorific normalization is now deterministic for registered player names. Opponent names outside the Maruoka registry retain explicitly supplied `くん`. For an ambiguous Maruoka surname explicitly named in the user's current question, persona-batch also strips the honorific without guessing a different player identity.
- PITCHING_ROLE FINAL now derives a direct reason from structured Evidence when saves are present (for example, `坂田 暉馬は現チームで2セーブを記録している。`) and removes debate-meta/future/probability rhetoric from persona reasons before publication.
- Persona-batch performs a final authoritative guard pass after all deterministic sanitization and name normalization. Sanitized text therefore cannot bypass the same evidence guard used before recovery.
- The TEAM_REVIEW burden guard now recognizes explicit non-assertion language such as 「負担集中までは断定しません」 so its own safe fallback cannot retrigger the burden-concentration violation.
- Production acceptance is strengthened for closer and natural-third PRIMARY, SECOND and FINAL: the exact semantic classes found in #122, plus Maruoka honorific leakage, now fail the workflow even when structural candidate checks are green.



## Production Live #123 repeated closer semantic leak follow-up

- Main `ec091384...` tightened closer/natural-third visible semantic gates and added a final authoritative persona validation pass.
- Production Live #123 completed staged best-order, but closer PRIMARY still returned two user-visible overclaims that the workflow correctly rejected: MELCHIOR converted IP/ERA into 「安定している」 and CASPER added 「チーム全体の成長」 to a current-role question.
- Re-running the same #123 closer after deployment settlement reproduced the same PRIMARY text, so this is not treated as a one-off deployment race.
- The CASPER guard did not include the exact phrase 「チーム全体の成長」. That phrase is now explicitly covered.
- More importantly, known selection-semantic cleanup is now also applied unconditionally immediately before publication for PITCHING_ROLE/BATTING_ORDER outputs, then the authoritative guard runs again. This is defense-in-depth: it removes only the already-defined unsupported selection classes (metric-to-stability/trust, save-to-pressure inference, unsupported probability, batting-order tactical certainty, generic growth/development framing when not requested, and unsupported dependency framing) while preserving candidate structure and direct verified facts.
- Development/growth language remains available when the user explicitly asks a development question. Pressure wording remains available when direct pressure/high-leverage Evidence exists. Dependency wording remains available when that Evidence exists.
- Regression coverage uses the exact #123 MELCHIOR stability sentence and CASPER 「チーム全体の成長」 sentence, and verifies direct 坂田 暉馬 2セーブ Evidence and candidate order are preserved.



## Production Live #124 semantic + TEAM_REVIEW CROSS follow-up

- Main `8dcef384...` fixed the repeated #123 closer stability/growth leaks with pre-publication selection scrubbing. Production Live #124 then completed staged best-order, closer and natural-third.
- Closer PRIMARY no longer published the #123 ERA/IP -> stability claim or CASPER 「チーム全体の成長」 claim. Direct 坂田 暉馬 SV=2 Evidence remained intact.
- Semantic inspection still found two softer closer overclaims that the existing acceptance gate did not catch: BALTHASAR SECOND promoted saves into 「勝利に直結」「確実な勝ち筋」, and CASPER added unsupported 「過度な負担／負担集中」 wording despite no direct burden-concentration Evidence.
- PITCHING_ROLE guards and the pre-publication sanitizer now treat those current-case phrases as unsupported unless corresponding direct Evidence exists. FINAL grounding also strips debate-meta such as 「指摘された」「判断は変えない」 and unsupported burden warnings while preserving direct structured save facts.
- Natural-third completed, but CASPER still emitted generic 「選手たちの成長を見守り」 wording in a current batting-order question. The selection scrub now covers that plural growth wording unless the user explicitly asks a development question.
- TEAM_REVIEW PRIMARY completed but contained two remaining interpretation leaks: spread -> 「勝ちへの道／実戦上の重要な課題／攻撃の硬直化」 and CASPER generic 「チーム全体がどう成長していくか」. TEAM_REVIEW guards/recovery now classify those as unsupported current-state extrapolation and reduce them to verified numeric/usage facts or evidence-boundary wording.
- TEAM_REVIEW CROSS failed three times with `TEAM_REVIEW_CROSS_MELCHIOR_MISSING_CHALLENGE`. The deterministic cross itself had one challenge per persona, but its old wording triggered the same TEAM_REVIEW inference guard; fail-closed cross then intentionally erased all challenges. The deterministic challenge text has been rewritten to ask only for direct-fact vs unconfirmed-interpretation separation, and regression coverage now requires the full `validateCrossOutput(...,{focused:true})` result to be empty, not merely that challenge arrays exist.
- Production acceptance regexes now reject the exact #124 closer, natural-third and TEAM_REVIEW leak phrases so a future green run cannot hide these semantic regressions.



## Production Live #125 FULL_LINEUP transport reliability follow-up

- Main `0239d9d5...` contains the Live #124 TEAM_REVIEW CROSS and semantic-grounding fixes. Vercel production deployment is green and the ordinary main CI checks are green.
- Production Live #125 did not reach closer/natural-third/TEAM_REVIEW because staged best-order PRIMARY failed first. Attempt 1 produced three consecutive `timeout` failures from `PRIMARY_BATCH`.
- A fresh failed-job rerun reproduced two more batch timeouts. Its third PRIMARY batch response finally arrived, but MELCHIOR was rejected for two correct deterministic reasons: an unhedged future-result claim and `FULL_LINEUP_STANDARD_DEFENSE / NO_COMPLETE_STANDARD_STARTING_MATCHING`, meaning its chosen nine could not cover all nine standard positions from official-game or 練習第1試合 starting Evidence.
- Do not weaken either guard. The failure shows a transport/recovery mismatch: `persona-batch` performs one large Gemini generation for all three personas and intentionally performs no model correction pass, while the existing individual `/api/magi/persona` endpoint already supports one FULL_LINEUP correction pass and can rebuild an invalid nine using the exact standard-defense directive.
- The actual production browser engine is installed by `deliberation-integrity-v348.js` as `1.1.2-serial-integrity`. It currently prefers `/api/magi/persona-batch` for PRIMARY/SECOND and only uses individual persona requests for obsolete-endpoint 404/405 fallback. Therefore the #125 batch failure is relevant to the real UI path, not only the selftest.
- Current branch `fix/full-lineup-individual-persona-fallback-20261007` changes only FULL_LINEUP transport: PRIMARY and SECOND use three separate `/api/magi/persona` requests with a small 300ms stagger and parallel completion. Each persona keeps the same shared CASE/Evidence, but receives no other persona output during PRIMARY and only its own PRIMARY + own CROSS compartment during SECOND.
- Other question classes retain the existing batch path. This keeps the scope narrow and preserves the quota-efficient route where the large FULL_LINEUP Evidence packet is not involved.
- `api/magi-live-deliberation-selftest.js` mirrors the same FULL_LINEUP individual transport so the next Production Live run verifies the product path instead of the old batch-only path.
- A dedicated transport contract test verifies that FULL_LINEUP uses `/api/magi/persona` for PRIMARY/SECOND while the non-FULL_LINEUP batch route remains present.
- No Drive/CSV data is changed by this transport fix.


## Production Live #125 verification observability follow-up

- Main `8efe88c3...` now contains the merged #103 FULL_LINEUP individual-persona transport fix. The strict standard-defense and semantic guards remain unchanged.
- The existing Production Live #125 workflow run cannot verify closer, natural-third or TEAM_REVIEW after a best-order job failure because ordinary `needs` semantics skip every downstream job.
- Current branch `fix/live125-verification-observability-20261007` changes only verification behavior: downstream live classes remain sequential and keep their cooldowns, but run after an upstream failure unless the workflow was cancelled.
- The staged FULL_LINEUP PRIMARY/SECOND response summary now includes the already-published rationale fields so semantic inspection can read `candidateBasis`, facts/analysis/prediction, reasons, warnings and public statement instead of seeing only the candidate list and judgment.
- No MAGI decision policy, Evidence source, Google Drive file, provider model configuration, or Vercel plan/configuration is changed by this observability patch.

## Production Live #125 semantic-output follow-up

- Current pre-merge main `2bfdd67d...` contains the FULL_LINEUP individual-persona transport change and the live-observability change that keeps closer, natural-third and TEAM_REVIEW runnable after an upstream failure.
- Production Live #125 attempt 4 completed staged best-order structurally, but semantic inspection of the published SECOND output found unsupported BALTHASAR claims that batting numbers/order placement made the lineup `最も得点効率に結びつく`, built a `確実な勝利の道`, and `一番勝てる確率を高める`. Structural green therefore did not qualify as success.
- Root cause: the common persona evidence guard had PITCHING_ROLE and BATTING_ORDER-specific semantic checks but no corresponding FULL_LINEUP guard for batting-number/order -> scoring-efficiency or win-probability causality.
- FULL_LINEUP now has a deterministic BEST_ORDER semantic guard for that class. The individual persona prompt/correction path explicitly keeps raw AVG/OPS/OBP/SLG and batting-order placement as present comparison evidence only; they do not by themselves establish scoring efficiency, runner conversion, win probability, a certain win path, or the lineup most likely to win.
- Production Live best-order PRIMARY/SECOND acceptance now rejects the exact leaked semantic class, so a structurally valid nine-player order cannot pass merely because candidate/defense checks are green.
- In the same #125 attempt, closer PRIMARY first hit a transient timeout and then failed deterministically on CASPER with two simultaneous soft prose issues: unsupported SELECTION growth/development framing plus escalation of the supplied `兼任負担を考慮する必要がある` into stronger burden/consequence wording.
- The failure was not a reason to weaken either guard. The batch recovery dispatcher previously allowed selection-soft + forecast-soft combinations, while burden-soft recovery was handled by a separate path; a response containing selection-soft + burden-soft therefore fell between both recovery contracts and failed closed.
- Selection recovery now accepts that exact mixed soft class only, applies the existing selection scrub plus burden scrub, and re-runs the authoritative persona guard. Unknown, numeric, roster, structural and Evidence-source failures remain excluded and fail closed.
- Burden sentence cleanup is aligned with the existing burden guard so phrases such as `負担集中`, `特定の選手への負担`, excessive burden and accumulated fatigue cannot survive merely because the cleanup regex was narrower than validation.
- Regression coverage reproduces both #125 failures. No Google Drive/CSV data, provider billing setting, or Vercel plan is changed; Hobby/free remains required.
- Stale PR #106 was closed without merge because it was branched from `0239d9d5...` after main had already advanced. The authoritative fix is PR #107 from `2bfdd67d...`.

## Production Live #128 stale-production verification finding

- Main `37dcf495...` contains the merged #107 semantic-grounding/recovery fix and all ordinary GitHub checks are green.
- Vercel rejected the corresponding main deployment with `Deployment rate limited — retry in 24 hours` under the existing Hobby plan. No paid upgrade is authorized or required.
- Production Live #128 started anyway because the workflow's old `Wait for production deployment` step was only a fixed sleep. The workflow did not verify that `magi-web.vercel.app` was actually serving the triggering GitHub SHA.
- As a result, #128 best-order and closer exercised the older production deployment, not main `37dcf495...`. Best-order correctly failed the new workflow-side semantic acceptance regex on an old MELCHIOR `得点力が発揮` claim; closer reproduced the pre-#107 mixed CASPER selection+burden validation failure. Neither result is evidence that the merged #107 server fix failed, because that server code was not deployed.
- This is a verification-integrity fault: a production acceptance run must never attribute old production behavior to a newer main commit.
- The live selftest PREPARE responses now expose only safe deployment identity metadata from Vercel system environment variables: Git commit SHA, environment and commit ref.
- Every Production Live class now requires the runtime `VERCEL_GIT_COMMIT_SHA` to equal `GITHUB_SHA` and `VERCEL_ENV` to be `production` before PRIMARY. PREPARE is retried up to five times to allow normal deployment propagation; no Gemini/persona call is made while the production SHA is stale.
- A dedicated static contract test verifies all four PREPARE modes expose deployment identity and all four workflow classes enforce the SHA/environment match.
- This change does not deploy, promote, alter billing, mutate Drive/CSV data, or change any MAGI decision policy.

## Production Live #128 residual semantic-grounding follow-up

- Main `6643b673...` contains the deployed-SHA gate. Because Vercel Hobby rejected the current production deployment for build-rate-limit, the gate correctly prevents provider-heavy acceptance from treating stale production as current main.
- Manual inspection of the earlier stale-production #128 output still produced useful regression evidence for two semantic classes that had passed the then-current acceptance regexes.
- Natural-third output preserved direct facts such as `嶋田 栄志は3番で7試合スタメン`, but also elevated those facts into unsupported qualitative/causal language: `役割が定着している`, `3番の経験値`, `実戦経験が最も豊富`, and `打順の軸を安定させられる`.
- These phrases are now treated as the same BATTING_ORDER overclaim class already used for tactical stability/certainty. Actual start counts remain publishable; the overclaim sentence is removed and the authoritative persona guard is run again.
- TEAM_REVIEW output preserved the correct final boundary that hitless counts and rate spread do not prove dependency/causality, but persona text and FINAL warnings still leaked `戦術的な制約になり得る`, `特定の選手の調子に得点が左右されるリスク`, `組織的な成長`, and `チーム全体の底上げ`.
- Hedging with `なり得る` or `リスク` is no longer accepted as a substitute for direct team-level causal Evidence. The current-state TEAM_REVIEW guard and deterministic recovery remove those stronger inferences while retaining the measured spread/hitless/usage facts.
- TEAM_REVIEW FINAL warning grounding now removes the same unsupported scoring-dependency and generic growth language so sanitized persona text cannot re-enter during synthesis.
- Persona instructions explicitly state the evidence boundary: a count of 3番 starts proves usage count only, not role settlement/experience value/stability; team numeric spread does not prove tactical constraint, scoring dependency risk, organizational growth impact or team-wide bottom-up development.
- Production Live PRIMARY/SECOND/FINAL regexes now reject the #128 residual phrases even when structural status is green.
- Regression tests reproduce the exact #128 phrases at persona guard, deterministic batch recovery and FINAL synthesis layers.
- No Google Drive/CSV data is changed.

## Production Live shared deployment-readiness gate follow-up

- Main `df4d13fd...` contains the merged #110 residual semantic-grounding fix. PR CI was green for continuity and deterministic deliberation, including the new Live #128 guard/recovery/FINAL regressions.
- Vercel Hobby still rejects the current main production deployment with `Deployment rate limited — retry in 24 hours`. The project remains on the free/Hobby plan; no upgrade or paid bypass is authorized.
- The deployed-SHA guard is working in real Actions. Production Live run `37628213967` returned the stale production PREPARE payload, failed immediately at the SHA/environment assertion, and did not execute the best-order PRIMARY provider call.
- The previous workflow still allowed closer, natural-third and TEAM_REVIEW jobs to start after this deployment-mismatch failure because `if: !cancelled()` was intentionally added so semantic failures in an earlier class would not hide later classes. With a stale deployment, however, those jobs only consume cooldown time and repeat the same PREPARE failure.
- Current branch `fix/live-deployment-readiness-gate-20261007` separates **deployment readiness** from **semantic class observability**. A new `production-revision-ready` job checks the production PREPARE identity up to five times and never calls PRIMARY.
- `exact-live-best-order` now depends on that readiness job. Closer, natural-third and TEAM_REVIEW depend on both readiness and their preceding semantic class, and use `always()` only when `needs.production-revision-ready.result == 'success'`.
- Therefore a stale/missing production revision stops the whole provider-heavy suite once at the entrance, while a genuine best-order/closer/natural-third semantic failure still allows the later question classes to execute and remain observable.
- Each class keeps its own single PREPARE SHA/environment assertion as defense-in-depth after readiness succeeds; the redundant five-attempt PREPARE loops are removed from the individual class jobs.
- The static live-production-SHA contract test is expanded to require this shared readiness topology and prove the readiness block contains no PRIMARY call.
- The deliberation unit workflow path filters now include both the Production Live workflow and `scripts/test-live-production-sha-gate.mjs`, so workflow-only/readiness changes cannot bypass their own contract test on PR or main push.
- No MAGI decision policy, Evidence data, Google Drive/CSV file, Vercel billing setting or provider model configuration is changed.


## Full-lineup final-vote semantics follow-up

- Review of current main found a separate structural flaw in `buildConsensusLineup`: when MELCHIOR, BALTHASAR and CASPER all produced different SECOND full-lineup proposals, the code ranked those three proposals by closeness to the shared average ranks and selected one anyway.
- That behavior violated the MAGI deliberation rule. A 1-1-1 split is a DEADLOCK; agreement score is diagnostic context, not authority to break a three-way tie.
- Branch `fix/full-lineup-deadlock-semantics-20261008` changes only the final proposal decision. It does not change Drive Evidence, batting/fielding data, persona prompts, or defensive eligibility.
- Exact full-order voting now applies: 3 identical SECOND proposals = `CONSENSUS / 3-0`; 2 identical proposals = `MAJORITY / 2-1` with the minority proposal preserved; 3 different proposals = `DEADLOCK / 1-1-1` and no final lineup is fabricated.
- A DEADLOCK exits before defensive assignment and returns `LINEUP_REVIEW_REQUIRED` with `FULL_LINEUP_DEADLOCK_1_1_1`.
- The existing rule that the final lineup must be one actual SECOND proposal remains intact. No synthetic fourth lineup is created by slot averaging.
- Regression coverage is extended so 3-0, 2-1 and 1-1-1 behaviors are explicit and fielding tests continue only from a valid majority/consensus batting proposal.
- No Google Drive/CSV data is changed. Vercel Hobby/free remains mandatory.


## Production Live current-main full-lineup follow-up (run 37645927583)

- Main `21aed6f45eae69cb8efd31de1b5fc81dc2df085d` was successfully deployed to Vercel production on the Hobby/free plan. The shared `production-revision-ready` gate observed the exact production SHA and passed.
- The first valid current-main staged best-order run reached PREPARE, PRIMARY, CROSS and SECOND. PREPARE confirmed all 14 players plus COMPLETE batting-order, appearance/fielding and normalized-observation Evidence.
- The new proposal-level vote rule worked: all three SECOND full-lineup proposals were different, so FINAL correctly returned `LINEUP_REVIEW_REQUIRED / DEADLOCK / 1-1-1` instead of selecting the proposal closest to average ranks.
- The live selftest contract was stale and treated every non-`LINEUP_RESULT` FINAL as invalid. Branch `fix/live132-full-lineup-deadlock-and-grounding-20261008` changes the live contract to accept only the exact fail-closed deadlock shape: `LINEUP_REVIEW_REQUIRED`, `NOT_EVALUATED`, `FULL_LINEUP_DEADLOCK_1_1_1`, `DEADLOCK`, `1-1-1`, empty lineup. Other review-required results remain failures.
- Manual semantic inspection of the same SECOND output found additional unsupported wording that the green structural gates did not catch: raw OPS/AVG described as 「安定」, batting placement described as creating/increasing scoring chances, legal fielding eligibility converted into defensive stability, lineup choice converted into improved team coordination, an unsupported current-slot 「固定」 claim, and a `recentSix` Evidence window of 6 games rewritten as 「直近5試合」.
- The FULL_LINEUP persona guard now blocks those exact inference classes even when hedged with 「可能性」, verifies any stated recent-game window against `evidence.recentSix.gameCount`, and blocks slot fixation unless Evidence contains an explicit current fixed policy.
- FULL_LINEUP PRIMARY/SECOND instructions now state the same boundaries before generation. The correction directive removes these claims instead of rephrasing them.
- Production Live PRIMARY/SECOND acceptance now rejects the Live output phrases for scoring-chance, metric stability, defensive stability, coordination effects and unsupported fixation.
- Regression tests reproduce the exact Live phrases and distinguish an incorrect 5-game window from the supplied 6-game window.
- No Google Drive/CSV data, roster data, coach Evidence, Vercel billing setting or paid service is changed.


## Production Live run 37645927583: closer / natural-third / TEAM_REVIEW semantic follow-up

- Exact production SHA `21aed6f45eae69cb8efd31de1b5fc81dc2df085d` was inspected beyond job conclusions.
- CLOSER was structurally green, but BALTHASAR still converted 「坂田 暉馬の2セーブ」 into unsupported outcome language: 「終盤の勝ちパターン」「一番の勝ち筋」「最も勝ちに直結」. Save count remains valid role evidence only; it does not establish a causal winning path.
- NATURAL THIRD was structurally green, but the output still converted 「嶋田 栄志の3番スタメン7試合」 into incumbency/tactical-fit claims such as 「戦術的運用に最も合致」「固定されてきた」「チームの形に最も馴染む」. It also converted recent AVG/OPS movement into qualitative form labels such as 「勢いが落ちる」「低調」「状態の波」「安定した打撃」, and inferred team-connection harm from batting-order changes. The direct usage count and direct numeric change remain usable; those interpretations require separate Evidence.
- TEAM_REVIEW correctly rejected MELCHIOR's spread-to-team-weakness inference at PRIMARY, but deterministic soft recovery could leave the same semantic class in another prose field and then restore the original draft, causing `PERSONA_BATCH_VALIDATION_FAILED`. The live workflow retried this deterministic failure three times.
- Branch `fix/live132-selection-and-team-review-grounding-20261008` aligns generator instructions, deterministic guard, batch sanitizer/recovery, FINAL grounding, Production Live acceptance, and regressions for these exact classes.
- PITCHING_ROLE now rejects generic 「勝ち筋」「勝ちパターン」「勝ちに直結」 in addition to existing win-probability/certain-win phrases when the causal relationship is not directly supplied.
- BATTING_ORDER now treats start count as usage only. It does not establish fixed/continuation priority, tactical fit, familiarity, qualitative form, or team-continuity effects unless Evidence directly supplies those facts.
- TEAM_REVIEW soft recovery now has a second safe fallback only when every remaining issue is still an already-recognized soft semantic class. The fallback removes causal prose and publishes an Evidence-limited non-causal statement; hard evidence, roster, numeric, or structural failures remain fail-closed.
- TEAM_REVIEW Production Live now stops immediately on deterministic `PERSONA_BATCH_VALIDATION_FAILED` instead of retrying the same rejected generation.
- Regression coverage reproduces the exact production leak classes at persona guard, batch recovery, FINAL aggregation and workflow-contract layers.
- No Google Drive/CSV data, roster source, coach source, Vercel billing setting or paid service is changed.


## Production Live current-main verification and residual grounding follow-up (2026-10-08)

- Vercel Hobby deployment quota cleared and current main `2b25087b1c03789ccba3802bb8d4459d90b003a1` was deployed directly to production as `dpl_6qZJDHFwsQENh3xYXhmVUkAuVtGV`. The shared production-revision readiness gate passed against the exact production SHA.
- Production Live run `37648717971` attempt 2 therefore tested the actual current main, not stale production.
- Best-order reached PREPARE/PRIMARY/CROSS but failed during SECOND after provider 503/rate-limit responses. Manual PRIMARY inspection also found two semantic defects that structural checks missed: BALTHASAR used unsupported `得点力を最大化 / 得点力を発揮 / 勝利へ近づく` outcome language, and MELCHIOR's `candidatePlayers` order disagreed with its numbered `candidateBasis/publicStatement` order.
- Closer completed structurally, but manual text inspection found residual CASPER development/workload framing such as `役割の分散`, `今後の成長`, `チーム全体の負担`, `大切に育てる`; FINAL could retain `今後の成長を考慮`.
- Natural-third completed structurally, but SECOND retained incumbency/meta claims such as `実績がある選手をその位置に置くのが確実`, `チームの安定につながる可能性`, and `他の記録が示されない限り、この判断を変更する理由はありません`.
- TEAM_REVIEW failed PRIMARY semantic acceptance. BALTHASAR still converted batting spread into `勝ちに繋げる`, `生産力に濃淡`, `戦術上の重要なポイント`, `戦術的リスク`; CASPER added `これからのチームの成長`, `チーム全体がどう強く`, `見守りたい`, `組織全体の育成機会`.
- PR #115 / branch `fix/live-best-order-grounding-consistency-20261008` adds guards, prompt constraints, deterministic selection sanitization/final grounding, TEAM_REVIEW recovery coverage, and Production Live rejection patterns for those exact residual classes.
- A dedicated `scripts/test-live133-residual-grounding.mjs` reproduces the observed best-order, closer, natural-third, TEAM_REVIEW and FINAL leakage. Its first two CI failures correctly exposed missing closer soft recovery and polite `理由はありません` handling; both were then added to detection/recovery/final layers.
- Vercel project `magi-web` now has `previewDeploymentsDisabled=true` to protect the Hobby 100-deployments/day budget. One explicit isolated Preview was created for branch SHA `25f11b20...` and reached READY. Automatic branch previews remain disabled. No billing upgrade and no Google Drive/CSV mutation occurred.
- Do not declare the four-class gate clear until PR #115 is green, merged, the resulting main SHA is deployed to production, and all four current-production staged flows are manually inspected through PRIMARY -> CROSS -> SECOND -> FINAL.

## 2026-10-08: SHA-matched production Live rerun and next diagnosis

- Canonical main and production deployment SHA: `786d6970db9feb0f696b1c4c6b4e2946926823b0`. The original workflow run had checked an older production revision before the new deployment was READY; deployment readiness and deliberation quality must be distinguished.
- Re-ran GitHub Actions production Live Selftest run `37657015253`, attempt 2. `production-revision-ready` passed with the exact main SHA. Results: best-order **failed**, closer **passed**, natural-third **passed**, TEAM_REVIEW **passed**.
- Best-order failed PRIMARY for BALTHASAR on three distinct stage calls with `PRIMARY_BALTHASAR_INVALID` despite complete 14-player evidence. The existing endpoint hides the exact rejection category. The failure can be a review flag, data conflict, or invalid nine-player selection; the available logs do not resolve which. Do not guess or weaken roster, fielding or grounding guards.
- Closer FINAL named 坂田 暉馬 first based on 2 recorded saves and preserved the four-inning small-sample and coach control concerns.
- Natural-third automated acceptance passed, but manual reading found residual unsupported phrasing: BALTHASAR `固定しつつ` and CASPER `チームの打撃力が向上する可能性`. Automated success does **not** imply full semantic acceptance.
- TEAM_REVIEW completed all staged steps and did not assert a causal link between observed individual batting differences and team-wide scoring or chronic weaknesses; language polish remains.
- PR #116 (`fix/live-lineup-rejection-diagnostics-20261008`) adds **diagnostic-only** rejection classification to the staged lineup selftest: enum/booleans/candidate counts, not underlying player records or rejected prose. Do not confuse this with fixing the underlying PRIMARY failure.
- Next: ensure PR #116 passes CI and continuity, then merge/deploy only after review; use a single controlled lineup-only production rerun to determine the rejection class and implement a grounded regression fix. Preserve Vercel Hobby/free, do not change Drive or CSV, and avoid repeated provider-rate-limit calls.

## 2026-10-08: Exact Live lineup guard rejection classified

- Production main SHA `b933af8ace4313475d0d133df4c72d9d508fde54`, GitHub Production Live Selftest run `37728398500`: `production-revision-ready` passed. Exact best-order PRIMARY failed three times with `PRIMARY_BALTHASAR_INVALID` and `reasonClass=EVIDENCE_OUTPUT_GUARD`, `reviewRequested=true`, `dataConflict=false`, candidateCount/unique/inRoster each 9. This disproves the theory that this specific rejection is due to a missing ninth name, duplicate names, or an out-of-roster pick.
- The exact reason is still unknown because `failClosedPersona()` contains specific guard-issue text only in `reviewReason`, which the Live selftest does not expose. Failure could be a semantic outcome claim, prose/order inconsistency, metric mismatch, etc. No guess is established as fact.
- Branch `fix/live-lineup-guard-issue-codes-20261008`: add read-only, non-sensitive `issueCodes` classifications from the existing first three guard issues, without exposing raw rejected text or player records; add explicit tests. Existing rejection rules remain fail-closed.
- Next: verify CI, merge only after green checks, confirm exact production SHA, observe the code in one staged best-order PRIMARY Live test and then fix the demonstrated issue. Do not disable evidence validation or modify Google Drive/CSV. Keep Vercel Hobby (free) and avoid rate-limit loops.

## 2026-10-08: Root cause of BEST_ORDER primary rejection confirmed and narrow reconciliation

- Current production SHA `30c6df0a9528f0f324124219b883e5e437770382`, Live run `37729004132`: BALTHASAR PRIMARY failed three times, exact `issueCodes=["ORDER_EXPLANATION_CONFLICT"]`. Structurally the nine candidates were unique and drawn from all 14 current players, and `dataConflict=false`. The candidate sequence and text explanation disagree; this is the observed issue, not an assumed numeric discrepancy.
- Branch `fix/live-lineup-order-explanation-reconcile-20261008` proposes narrowly reconciling **only** that single isolated order-prose contradiction after the standard model correction attempt. Preserve the model's structured nine-candidate batting order, discard the incompatible generated prose/arguments, and restate the 1–9 order explicitly. Do **not** recover mixed errors, unsupported numerics, missing roster members, data conflicts, or deficient standard-position fielding.
- The recovered row must pass `validatePersonaOutput` plus `personaFullLineupIssues` plus `personaPitchingPlanIssues` again before being accepted; otherwise remain fail-closed. Add explicit regression covering both positive and negative paths to Full Lineup Context Guard.
- Only after CI green, merge, production SHA readiness, and a fresh staged Live run should best-order success be claimed. Inspect the CROSS, SECOND, and FINAL stages and check every reported position against actual starting-position Evidence. Do not confuse correct serialization with strong strategic rationale.
- Keep Vercel Hobby/free. Never rewrite Google Drive, CSV, score sheets, or existing baseball records.

## 2026-10-08: BEST_ORDER moves from BALTHASAR to CASPER primary

- Production SHA `7c8ce7ab69490a213478cde8837b9396ebffb70c`, Live run `37729499470` passed exact SHA readiness and the earlier BALTHASAR PRIMARY blocker after PR #118 reconciliation. It then failed `PRIMARY_CASPER_INVALID` three times with `issueCodes=["ORDER_EXPLANATION_CONFLICT","UNSUPPORTED_DEVELOPMENT_OR_BURDEN"]`, `dataConflict=false`, and exactly 9 unique in-roster candidates. This is improvement, not a full pass.
- Branch `fix/live-lineup-mixed-prose-and-casper-grounding-20261008` extends the isolated narration-reconciliation path to one narrowly whitelisted class of CASPER unsupported growth/dependency/burden language when accompanied by the proven order description conflict. The generated explanatory text is discarded, the existing structured candidate sequence is unchanged, and all original validators must pass again before accepting. Any numeric, roster, other output or defense mismatch stays fail-closed.
- Extend the Full Lineup Context Guard regression to verify the mixed CASPER case and negatives for standalone unsupported language and any additional fielding guard issue. Only merge after CI succeeds; wait for previous Live run to complete to avoid parallel provider calls on Hobby.
- Continue live staged best-order tests through CROSS, SECOND and FINAL; preserve disagreements and independent rechecks. Manual semantic quality remains required before completion.

## 2026-10-08: TEAM_REVIEW isolated tactical leap discovered

- On production SHA `30c6df0a9528f0f324124219b883e5e437770382`, Live run `37729004132` TEAM_REVIEW PRIMARY returned a BALTHASAR statement `全体の得点力をどう形作るかが勝負の分かれ道だ` although only individual batting and usage records were confirmed. The GitHub semantic acceptance appropriately failed; therefore this run is not a four-class pass.
- Root: `validatePersonaOutput` TEAM_REVIEW guarded spread-to-tactic claims within a single sentence, but ungrounded tactical/score rhetoric in a separate sentence could escape. This is an evidence-to-causality mistake, not a deployment/roster issue.
- Branch `fix/team-review-standalone-tactical-overclaim-20261008`: extend TEAM_REVIEW rejection for the already disallowed standalone tactical phrases and reuse the existing soft-recovery class to replace unsupported rhetorical conclusions with explicit Evidence limitations. Preserve confirmed observations and numerical records; do not extrapolate performance, scoring or coaching intent. Add both positive failure and negative evidence-limitation tests plus a recover-and-revalidate regression.
- Independently, on SHA `3528b87101b6327c696a2ac56220dd639d556329`, production best-order accepted PRIMARY -> CROSS -> SECOND -> FINAL, but the final status was correctly `FULL_LINEUP_DEADLOCK_1_1_1` and no official 1–9 result. Do not silently turn three distinct orders into consensus or a slot-vote composite. Remaining semantic concern: BALTHASAR SECOND `試合に勝つための最適な組み合わせ` is not a proven outcome.
- Continue to evaluate live behavior and player-by-player rationale; do not declare MAGI final lineup ready merely because the structural workflow is green.

## 2026-10-08: Generic current-player selection soft guard in Sequential Suite

- SHA `3528b87101b6327c696a2ac56220dd639d556329` completed the four staged Production Live classes successfully (run `37729991061`), but BEST_ORDER final outcome remained correct `FULL_LINEUP_DEADLOCK_1_1_1` with no chosen lineup; Live PASS does not mean a resolved best order.
- Its sequential production acceptance run `37730444726` failed the initial `selection / production-selection` job `113158113869` at CASPER PRIMARY with deterministic `PERSONA_BATCH_VALIDATION_FAILED`, `guardIssueCodes=["SELECTIONでEvidenceにない成長・育成・負担影響を追加している"]`. The fixture has `mode:"selection"`, question `3番は誰がいい？`, and **no selectionKind**, unlike staged BATTING_ORDER. The guard properly blocks unsupported growth, but the known sanitizer only supported explicit PITCHING_ROLE/BATTING_ORDER kinds, so soft recovery rejected it. The four downstream suite jobs were skipped. No retry loop: `retryFreshRequest=false`.
- PR #120 (merged `6bf2f6d2b5b6d95880da395776ee6e4def98164b`) hardened standalone TEAM_REVIEW tactical rhetoric detection; code and tests green. This is separate from generic selection.
- Branch `fix/generic-selection-casper-grounding-20261008` adds **opt-in** generic-selection sanitation only within `recoverSoftSelectionInference` after exactly the known CASPER growth/dependency soft guard issue. It removes unsupported prose but preserves structured candidates, verified numbers, and other evidence. All existing output guards still re-run; numeric/roster/structural failures stay fail-closed. Normal generic-selection requests are unaffected.
- Test exact `mode:selection` + missing `selectionKind` generic fixture, preserving candidate order and verified facts, and negative without a guard issue or with a hard numeric issue. Require CI, merge, READY production SHA and sequential selection smoke confirmation before declaring generic selection stable.
- Preserve Vercel Hobby/free and Google Drive/CSV read-only. Avoid claiming the whole MAGI system finished until actual verified questions and explanations are sound.

## 2026-10-08: Sequential FULL_LINEUP smoke falsely rejected correct deadlock

- Main and READY Vercel production SHA `fc278cea3b58b5af192f9f35b98afed20714424b`. The four-case staged Production Live run `37731176624` completed successfully.
- The follow-on Production Sequential Suite run `37731621626` advanced beyond its previously blocked regular player selection (selection job `113161803704` **success**, confirming the PR #121 remediation in production). The next full-lineup job `113161999735` reached FINAL and got `LINEUP_REVIEW_REQUIRED`, `FULL_LINEUP_DEADLOCK_1_1_1`, `1-1-1`, `lineup=[]`, `fieldingStatus=NOT_EVALUATED` for three distinct valid nine-player orders. The job failed because workflow `.github/workflows/magi-production-full-lineup-smoke.yml` erroneously required `LINEUP_RESULT` and all nine fielding positions unconditionally. The production solver correctly followed the no-fabricated-majority rule; this was a **smoke acceptance mismatch**, not a verified engine failure.
- That smoke fixture uses **entirely synthetic** batting and fielding, including official starting qualifications at all positions for every player. It is only suitable for testing structural contracts, NEVER as evidence of actual Maruoka players' ability or past appearances.
- Branch `fix/smoke-accept-legitimate-full-lineup-deadlock-20261008`: factor one jq acceptance contract into `scripts/validate-production-full-lineup-final.jq`, so the smoke accepts either (1) `LINEUP_RESULT` with real nine-position Evidence in its fixture and an authentic 3-0/2-1 proposal vote, or (2) exactly 1-1-1 DEADLOCK with three distinct nine-player proposals, no assigned lineup, fielding not evaluated, and unresolved conflicts. Other review outcomes, incomplete rosters, ungrounded fielding, fabricated compromises or votes remain failures. Add 13 true jq positive/negative tests and run in PR CI before updating main.
- After PR CI green and Vercel READY SHA, require sequential selection/full-lineup/pitching-plan/deliberation/reproducibility workflow results before declaring complete. A valid DEADLOCK is not a recommended best order: user still needs an evidence-grounded resolved 1–9 lineup or explicit explanation why impossible. Continue to audit rationales and actual current-year CSV/score Evidence, preserving zero paid costs and Drive read-only.

## 2026-10-08: Acceptance changes must retrigger SHA-gated production validation

- PR #122 merged as `8189470f2367054a791a2bbd0005cdd985471acd`; Vercel production URL served exactly this SHA in READY state. PR CI passed the full Deliberation Final suite, including the real-jq production final outcome contract, with 13/13 tests. The full-lineup smoke now accepts a genuine 1-1-1 DEADLOCK without accepting invented players, positions or a fake consensus.
- The Production Live Deliberation Selftest workflow was not auto-dispatched by PR #122 because its push paths only covered application code and two workflow files, not the full-lineup smoke or reusable jq contract. There was therefore no new Sequential Suite run proving the entire downstream chain after this smoke fix.
- Branch `fix/trigger-live-after-lineup-smoke-contract-20261008` extends that workflow's push path triggers to the smoke workflow, jq contract and contract test. This is CI orchestration only, does not change production API responses, Vercel billing, or scoring evidence. As before, the Live workflow must first verify the actual production SHA before any provider-heavy calls and will trigger Sequential Suite only after success.
- Acceptance still requires actual successful selection, full-lineup final with either a properly Evidence-qualified result or explicitly disclosed 1-1-1 DEADLOCK, then pitching plan, deliberation, and reproducibility. Never describe a test-accepted DEADLOCK as the team's final best order.
- Keep Google Drive/CSV read-only, no paid upgrade, and retain 3-sage independent vote integrity.

## 2026-10-08: Reproducibility smoke also required consensus unconditionally

- Current main SHA `7cdf2488e45ee082d5a14a221fac3bc14f35aab1`, obtained by merging PR #123; Vercel has served this revision at READY and production revision gate passed in run `37733555849`. Its Live and downstream sequential outcomes must be observed before any further merge.
- Source inspection shows `.github/workflows/magi-production-reproducibility-smoke.yml` demands `LINEUP_RESULT` and `fieldingStatus=COMPLETE` on both identical-Evidence full-lineup runs, even though the MAGI contract properly permits `FULL_LINEUP_DEADLOCK_1_1_1`. Thus reproducibility might be reported as failure solely because three distinct secondary lineups produce an honest, repeatable unresolved vote.
- Branch `fix/reproducibility-accept-legitimate-lineup-deadlock-20261008` changes the reproducibility smoke to reuse the exact, strictly tested `scripts/validate-production-full-lineup-final.jq` acceptance contract created in PR #122. Both runs must independently satisfy authentic 3-0/2-1 lineup-with-fielding or 1-1-1 deadlock with **no fabricated lineup**, and the replay must match all relevant results including status, vote, fielding and conflict metadata. Unrelated or malformed REVIEW_REQUIRED outcomes continue to fail.
- Add static regression of workflow wiring, plus trigger path to require SHA-matched Live acceptance after this workflow changes. This is **tests only**, not production model logic, and the fixture is synthetic, not any player's real defensive record.
- Do not merge while prior Live / Sequential Suite is still executing. Require PR local CI, then merge and verify READY SHA plus entire downstream sequence, accounting for Vercel Hobby/free provider quotas; do not run duplicate provider-heavy jobs.
- MAGI best order remains incomplete whenever it returns a 1-1-1 deadlock; true test acceptance is not the same as a recommended winning lineup.

## 2026-10-08: Actual Sequential Suite failure isolated to reproducibility

- On `7cdf2488e45ee082d5a14a221fac3bc14f35aab1`, Live production workflow `37733555849` completed all staged cases successfully with an exact READY production SHA.
- The subsequent Sequential Suite run `37734008007` passed jobs `selection / production-selection`, `full-lineup / production-full-lineup`, `pitching-plan / production-pitching-plan`, and `deliberation / production-deliberation`. Full-lineup smoke explicitly logged `PASS (status=LINEUP_REVIEW_REQUIRED, vote=1-1-1, fielding=NOT_EVALUATED)`, as intended. Reproducibility job `113171430463` **failed**; one-step workflow logs do not identify whether an earlier persona gate or the unconditional `LINEUP_RESULT` assertion caused its exit. Do not label its precise exit as confirmed until traced.
- PR #124 addresses the known unconditional reproducibility status assertion by reusing the strict verified final-outcome jq contract, separately compares all vote/fielding/conflict fields on identical-Evidence replay, and now adds safe progress markers `REPRO_STAGE` and final `{status, finalVote, fieldingStatus, reviewReason}` only, never rejected narrative or sensitive player records. Any subsequent failure should identify the stage without guessing.
- Do not merge this PR until both local CI and development continuity checks pass. With old Sequential Suite complete, proceed with a single SHA-matched deployment and next Live→Sequential chain; avoid redundant provider-quota calls.
- User-facing conclusion at this point: four sequential jobs succeeded, reproducibility unresolved; best-order itself remains 1-1-1 DEADLOCK, NOT a final 1–9 recommendation. No fee tier change or Drive/CSV writes.

## 2026-10-08: Sequential suite reaches reproducibility; PRIMARY structural acceptance silently fails

- Main and READY production SHA `cd171e4e6d2c5a3299fa4ad1713ed7df246ef1e8` passed all four staged Live E2E classes in run `37735068050`.
- Production Sequential Suite run `37735552966`: selection, full-lineup, pitching-plan and deliberation jobs **all passed**. Reproducibility job `113175360789` failed after `REPRO_STAGE tag=a phase=PRIMARY`, before the first CROSS. The API produced no logged HTTP failure. The last ordinary shell acceptance required `reviewRequested==false`, `dataConflict==false`, and 9 distinct candidates, but did not report which check failed. We must not assume a generic model error or a caching/replay problem when the first PRIMARY attempt has not passed yet.
- Branch `fix/repro-primary-rejection-safe-diagnostics-20261008` adds explicit fail-closed structural diagnostics for PRIMARY and SECOND to the existing reproducibility workflow. It logs persona/stage/tag, review/data-conflict flags, candidate/unique/checked counts, and only coarse predefined review classes. It never exposes the generated free-text, individual evidence, player selection, or raw reviewReason. Existing acceptance conditions and application behavior are unchanged.
- After green CI, run a SHA-gated normal Live plus Sequential Suite once, determine the concrete root cause of the first PRIMARY failure, and fix that cause without weakening evidence/roster/fielding verification. The synthetic full-fielding matrix in reproducibility workflow is **not** real appearance evidence.
- Do not treat four green sequential jobs as full product acceptance. Even a reproducibility PASS would not substitute for the actual production UI path. Preserve MAGI 1-1-1 DEADLOCK semantics and free Hobby quota.

## 2026-10-08: Complete sequential acceptance; real formal UI still rejected valid DEADLOCK

- Main and Vercel READY SHA `f614c7f522f576320e8c77b8e6e8d3e7cb06fc31` passed four staged Live E2E classes in `37740331753`. Production Sequential Suite `37741041207` passed all five jobs: generic player selection, full lineup, pitching plan, deliberation, and reproducibility.
- Reproducibility job `113193472077` completed PRIMARY/CROSS/SECOND/FINAL for two identical question/Evidence requests, accepted both results and passed strict persona, CROSS and FINAL stable-output comparisons. This proves **synthetic fixed-Evidence reproducibility in that test**, not automatically all real user questions.
- Subsequent source review exposed a **real production UI-path acceptance mismatch** in `magi-formal-runner-v373.js`: `validateDelivered()` required `result.final.lineup.length===9` unconditionally for `FULL_LINEUP`. The canonical orchestrator correctly returns `LINEUP_REVIEW_REQUIRED`, `FULL_LINEUP_DEADLOCK_1_1_1`, `finalVote=1-1-1`, `lineup=[]` and `fieldingStatus=NOT_EVALUATED` when three independent SECOND orders differ. Therefore the formal browser wrapper wrongly throws `最終ベストオーダーが9人で確定していません` instead of exposing the valid unresolved result. The legacy `engine-ui-v187.js` renderer already supports `LINEUP_REVIEW_REQUIRED` as `打順 確定保留`, so this is a narrow delivery-guard mismatch.
- Branch `fix/ui-formal-valid-deadlock-20261008` keeps numeric 14-player Evidence validation and the nine-player chosen-lineup guard, but also accepts **only** strict three-way deadlock: exact decision/status/vote/reviewReason, no selected lineup or fielding, valid 14-player current-roster membership, three unique complete 9-player SECOND orders, three matching proposal groups, slot conflicts and CROSS challenges. Any malformed/incomplete outcome still rejects. The UI reaches its existing hold verdict rather than a generic error, with a clear 99% hold progress message.
- Add real formal-runner VM regression with 14 synthetic players, valid 1-1-1 result, existing normal consensus, UI event delivery and input restore, plus fail-closed negatives for fabricated lineup/vote, missing cross/roster/group and incomplete result. Bump index bootstrap cache-busting query and bootstrap REV `426→427` so an iPhone Chrome refresh loads the new formal runner code. The production reproducibility smoke's three asset URLs now use `v=427` as well, and the UI regression verifies this contract, preventing a false post-deployment failure caused by stale test URLs. Add frontend paths and test to Deliberation Final Selftest workflow.
- Require PR CI and continuity success; merge only after checking current main and safe scope. After deployment READY, inspect the actual bootstrap and formal assets served by production and, when possible, verify via an authenticated browser UI. Do not claim the complete 9-class UI-path objective solved based solely on mocks or backend smoke. No CSV/Drive changes or paid Vercel plan.

## 2026-10-08: Follow-up bootstrap smoke contract alignment for v427

- UI deadlock fix PR #126 merged as `9714e366141e4c921353c48ee34f8c598c8eab9b`. It passed five pull-request CI workflows, including 15/15 VM regression for the actual formal UI runner, and changed `index.html`/bootstrap query revision from `426` to `427` to prevent stale browser assets.
- Production Browser Bootstrap Smoke run `37743045852` failed its **Static canonical architecture guard** because `.github/workflows/magi-production-bootstrap-smoke.yml` still asserted `magi-app-bootstrap-v363.js?v=426`, although the new index correctly uses `v=427`. Lineup Stats Smoke run `37743045780` independently passed the authoritative 14-player season stats, rate formatter and player-name normalization steps, but failed its final main-path hydration check because that workflow also expected old `magi-app-bootstrap-v363.js?v=426`. These are stale test URLs, **not** evidence that the production bootstrap or MAGI deliberation failed.
- Branch `fix/browser-bootstrap-smoke-rev427-20261008` updates six old `v=426` asset requests/assertions in the Browser Bootstrap Smoke workflow and two old references in `.github/workflows/magi-lineup-stats-smoke.yml` to `v=427`. It does not touch app code, UI result semantics, deployment access, Gemini calls, current-team Evidence, or Vercel Hobby/free settings.
- Main's full-production Live E2E run launched by PR #126 is still in progress when this follow-up branch was opened. Prepare and test this branch independently, but **do not merge while the previous Live or downstream Sequential Suite is active**, so that SHA-gated checks are not confused by a new deployment mid-run. Afterwards merge, verify that the bootstrap smoke passes at the new SHA, and keep real browser-interaction testing marked unverified until explicitly observed.

## 2026-10-08: Confirmed LIVE TEAM_REVIEW test-polarity failure and over-reliance claim

- Pre-merge canonical main and Vercel production SHA: `015b02efaa397d54d3656de43107d635b8842816`. PR #127 was independently merged from `9714e366` to correct stale `v=426` expectations in the bootstrap and lineup-stats smoke workflows after the app's confirmed `v=427` upgrade. Do not duplicate/revert that fix. New work does not change bootstrap, player data, or the formal UI hold-verdict guard.
- On canonical SHA `9714e366141e4c921353c48ee34f8c598c8eab9b`, Live run `37743045749` succeeded best-order, closer, natural-third and TEAM_REVIEW PREPARE/PRIMARY/CROSS/SECOND. It then failed the **TEAM_REVIEW SECOND workflow assertion** before FINAL. Exact BALTHASAR statement `戦術的制約の断定に繋げることはできない` correctly disclaimed causality, yet the smoke's flat forbidden-token regex rejected the embedded `戦術的制約`. This is a false-positive in acceptance, not evidence of an unsupported positive conclusion.
- Separately the same TEAM_REVIEW PRIMARY contained an actual ungrounded CASPER statement `一部の選手に頼りすぎている部分があります`. The deterministic TEAM_REVIEW dependency guard checked dependency and reliance variants but omitted `頼りすぎ／頼り過ぎ`. Extend that exact semantic class, and allow only the existing soft recovery to discard this claim while retaining verified facts and revalidating with the original guard. No user/coach intent may be invented.
- Branch `fix/team-review-polarity-casper-20261008` changes the backend guard + batch soft recovery; new assertions and recovery regression; and the Live TEAM_REVIEW acceptance filter to normalize only explicit denials of unsupported tactics/reliance before applying the **original** broad forbidden-assertion regex. Actual unsupported positive claims still fail. New deterministic CI test executes the **actual jq filters** against valid negations, ungrounded claims and mixed contradictory sentences before any provider-heavy Live acceptance can run.
- Require green deliberation + continuity CI before merging. After new SHA READY, inspect authentic production TEAM_REVIEW PRIMARY/SECOND/FINAL and BALTHASAR/CASPER rationale. Do not mistake structural success or synthetic tests for completion of the nine-class actual browser UI-path target. No Google Drive/CSV edit; preserve free Vercel Hobby.

## 2026-10-08: Live TEAM_REVIEW passes structure but leaks offensive-causality warning

- Starting canonical main and READY production SHA `251f5da21649c34afe680f728df8468beab7f780`. GitHub Production Live Selftest run `37747686672` completed all four staged classes successfully. BEST_ORDER FINAL reached `LINEUP_RESULT`, `MAJORITY (2-1)`, 9 selected players, and `fieldingStatus=COMPLETE`. This is one valid run, not a claim that every independent judgment is reproducible or fully explained.
- Manual reading of the run's TEAM_REVIEW job `113214715788` exposed a genuine BALTHASAR PRIMARY warning: `打撃成績の偏りがそのまま攻撃力の制限につながる点に注意すること。` It survived into `final.warnings` and `reDeliberationConditions`, while the deterministic FINAL recommendation separately said individual batting statistics cannot establish team-wide scoring causality. This contradiction is unacceptable even when Live structural acceptance is green. Another generated analysis suggested that batting differences might `攻撃の選択肢や得点ルートを狭めている可能性がある`; it was not supported by team-level scoring evidence.
- Branch `fix/team-review-unsupported-attack-effect-20261008`: extend TEAM_REVIEW evidence-language guard to reject batting-spread to team-offense harm, restriction, or scoring-route cause, even when hedged as possibility. Explicit denials (`とは断定できない`) and measured individual differences must still pass. Extend the existing **soft-recovery** whitelist to discard only this causal speculation and preserve confirmed individual facts, then rerun the original complete deterministic guard.
- Add direct regression for the exact offending production warning and speculative scoring-route statement, plus negative/noncausal and recovery tests. Do not weaken unrelated selection, lineup or source-evidence validations. Production Sequential Suite `37748390775` for the pre-change SHA may still be running; wait for it to finish before merging or triggering another provider-heavy run.
- Continue manual review after CI/deployment. The verified 2-to-1 lineup needs player-by-player reason quality: CASPER changed the 4/5 order at SECOND with a vague `より適した形` rationale; this is an unresolved explanation-quality issue and must not be presented as proven superiority. Keep the full nine-class real browser UI-path objective open. Vercel Hobby/free and Drive/CSV originals unchanged.

## 2026-10-08: Live coverage green but future growth/experience-effect claims still leaked

- Pre-merge source of truth: GitHub main + Vercel READY SHA `b7363c8c3041e276febff6e7ef211efa1a6a6382`. PR #129 fixed unsupported individual-batting-spread -> offensive impact in TEAM_REVIEW. SHA-matched Live `37749266961` passed all four staged classes through FINAL; current-production TEAM_REVIEW FINAL now no longer repeats the unsupported attack-limitation warning. Its CURRENT final remains cautious that individual batting spread does not prove team-wide scoring or permanent weaknesses. Earlier Sequential run `37748390775` completed all five jobs successfully on preceding SHA `251f5da2`; the newest SHA's Sequential suite `37749858615` may still be running.
- Manual read of Live TEAM_REVIEW PRIMARY job `113219553981` found CASPER: `打撃成績の数値差や出場機会の偏りは、長期的なチームの成長や選手層の厚さに影響を与える可能性がある` and a similar `長期的なチーム作り` warning. These infer future organizational impact from current individual records even hedged, not measured current-team evidence. They were absent from the FINAL on that run, but PRIMARY itself remains non-compliant with the stated fact/inference boundary.
- On the same SHA, natural-third Live job `113218965828` included CASPER FINAL warning `特定の選手への固定がチーム全体の経験機会に影響を与えるおそれがあります`. The original user asked who should bat third, not for a future player-development policy. Current Evidence does not establish the asserted experience effect. It also used `選手全体の成長につながる` in CASPER primary despite no developmental request.
- Branch `fix/selection-teamreview-growth-evidence-20261008`: guard the general semantic classes of individual batting/usage record -> hypothetical long-term team growth/experience outcomes in TEAM_REVIEW, and fixed batting-slot -> other players' experience opportunity or overall growth in normal CASPER BATTING_ORDER/SELECTION. A hedge such as `可能性`/`おそれ` is not a record of the claimed effect. Explicit evidence gaps must remain allowed. Extend existing **fail-closed** soft-recovery only for these exactly known prose guards, preserve player candidate arrays and confirmed individual numeric facts, and rerun the original evidence guard.
- Add two production-phrase guard tests, explicit-denial negative test, and two recovery regressions to existing deterministic deliberation suite. Require both PR CI and continuity green. Wait for the ongoing Sequential Suite to finish before merging a new main SHA; then verify deployment READY and the full Live stage outputs. Do not claim the overall 9-class **actual browser UI** goal complete from narrow selftests. Keep Vercel Hobby/free and Google Drive/CSV originals untouched.

## 2026-10-08: TEAM_REVIEW CASPER invents a present growth-opportunity weakness despite clean final

- Pre-merge canonical GitHub main and READY Vercel SHA `36e185d9e85f9fcc9bfe4258e6f69c33f81c80b8`. Production Live run `37750570724` completed all four classes through FINAL. BEST_ORDER produced a 2-1 valid 9-player fielding lineup; natural-third FINAL no longer contained the speculative fixed-lineup -> team experience-opportunity warning. TEAM_REVIEW FINAL remained fact-limited.
- Manual reading of TEAM_REVIEW PRIMARY job `113223885611` found CASPER analysis: `試合に出る選手だけでなく、出場機会が少ない選手も含めた全体の成長機会をどう確保するかという点が現在の課題である。` This assigns a **present weakness/current priority** to developmental opportunity based only on individual current-season batting and appearance records. Neither a causal development effect nor the coach's stated intent is established. A clean synthesized FINAL does not excuse unsupported PRIMARY.
- Branch `fix/team-review-current-growth-priority-20261008` addresses the **general** unsupported TEAM_REVIEW claim class: assertions that experience/growth opportunity, development, or team depth is currently a weakness/priority requiring action in a current-state assessment. Continue permitting explicit non-assertion/evidence-limit sentences. Reuse existing `TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している` guard and associated fail-closed soft recovery; do not add an unrelated bypass. Retain verified facts/candidate/evidence fields and rerun the original guard.
- Add exact production-sentence guard + recovery regression, and negative explicit uncertainty test in existing deterministic deliberation CI. Require CI/continuity green. Wait for concurrent SHA `36e185d9` Production Sequential run `37751174683` to finish before merge/deploy. Never change Drive, CSV, security or Vercel Hobby/free settings.
- Nine-class **authenticated real iPhone/browser UI-path** acceptance, individual-player evaluation, comparison, next-game strategy, direct stats and ambiguous CLARIFY are not fully verified. Continue on original canonical main+production without equating unit or staged selftest success to complete product readiness.

## 2026-10-08: A rhetorical growth-opportunity worry survives TEAM_REVIEW PRIMARY

- Starting source-of-truth main and READY Vercel production SHA: `57e99ec37834a4629e98fe8c2a54059f4dad3d57`. The existing guard correctly rejects unsupported current developmental priorities and causal effects; all four Live test classes passed on this SHA in run `37751934995`. The following is a **manual semantic-quality finding** despite structural green, not proof of total UI readiness.
- In run `37751934995`, CASPER PRIMARY produced a concern that other players may not receive sufficient growth opportunity (`他の選手にも成長の機会がしっかり回っているか気にかかります`) despite only aggregate batting/appearance records and no supported inference about development access. A separate analysis speculated about long-term growth impact. The FINAL was appropriately limited to measured facts, but unsupported PRIMARY prose and partial word replacement produced a broken phrase resembling `選手間の出場機会の差いないか`.
- Branch `fix/team-review-unverified-growth-concern-20261008` closes the *general* current-state TEAM_REVIEW gap for rhetorical worries about whether development/experience opportunities are adequate, allocated, or reaching all players. Allow explicit non-assertions of the evidence gap. Reuse the existing TEAM_REVIEW soft-guard class and revalidate after removal.
- Move the established `developmentAdvice` early whole-sentence drop **ahead of** broad partial Japanese phrase rewrites in `recoverSoftTeamReviewDependency`. This prevents unsupported developmental claims from being left as grammatically broken fragments. Do not alter factual records, candidate selections, roster, coach statements or numerical grounding checks. Regression tests must assert the exact concern is blocked, an explicit non-assertion allowed, the compound unsupported sentence removed, and direct batting facts retained.
- Require deterministic Deliberation Final CI and Development Continuity Guard green. Wait for ongoing production sequential run `37752540714` before merging/deploying; do not hot-loop provider calls. Preserve Vercel Hobby/free, security settings, Google Drive/CSV read-only, and the genuine best-order 1-1-1 deadlock rule.
- Manual response-quality review is still essential. Real authenticated iPhone/browser end-to-end completion for the full nine-class question taxonomy is not yet verified, nor is every player's slot rationale convincingly explained.

## 2026-10-08: TEAM_REVIEW individual AVG wrongly recast as scoring concentration

- Pre-merge canonical main and READY Vercel SHA `2682aafbb8c1f701119cd53176cc0dbfbba3bf40`. Its staged production Live run `37753251218` passed exact SHA readiness, best-order, closer and natural-third. TEAM_REVIEW job `113232844234` reached PREPARE and PRIMARY but failed the PRIMARY acceptance (the workflow correctly did not advance into CROSS/FINAL).
- Inspecting its authentic TEAM_REVIEW PRIMARY shows two ungrounded BALTHASAR claims: `特定の選手に得点力が偏っている現状` and `特定の打者に成績が集中している現状は、実戦における攻撃の選択肢に影響を与える可能性がある`. The Evidence contains individual batting rates and usage, not directly verified team scoring dependency, tactical restrictions or causal effects. Do not present these as confirmed facts, even with 「可能性」 wording.
- The existing TEAM_REVIEW guard recognized `打撃成績の偏り→攻撃力の制限` but failed this different rhetorical structure, so the batch returned the unsupported text. Branch `fix/team-review-scoring-concentration-20261008` adds two semantic patterns under the **same existing soft-guard classification**: individual-player scoring-power concentration, and concentration of individual batting records -> measured team tactical choice/scoring consequences. Preserve explicit negations, recorded individual stats and fielding/roster validations.
- Extend `recoverSoftTeamReviewDependency` to replace only those unsupported causal sentences with an explicit evidence boundary **before publishing**, then re-run `validatePersonaOutput`. Positive and qualified-denial regression, plus batch recovery test, are in the deterministic deliberation CI. This is not a broad rewrite of coaching strategy or model prompts.
- Require CI and development continuity green; after merge and READY SHA, inspect authentic production TEAM_REVIEW PRIMARY, SECOND and FINAL, including the absence of unsupported causal stories. A green structural result alone is insufficient. Continue to separate independent judgments, 1-1-1 deadlock, and valid 2-1 majority; no forced consensus.
- Do not edit Google Drive/CSV/score sheets, Vercel security or Hobby/free plan. Full authenticated iPhone/browser 9-class UI acceptance and 1–9 per-slot narrative accuracy remain unresolved priorities.

## 2026-10-08: TEAM_REVIEW CASPER sentence integrity after successful staged E2E

- Canonical main and READY Vercel production SHA at branch base: d272e2a194c9be70388c5cbaa46a9550b9778d03. Its Production Live Selftest run 37754450690 passed all four classes, including the actual TEAM_REVIEW PRIMARY/CROSS/SECOND/FINAL job 113236943271. Prior unsupported BALTHASAR scoring-concentration/tactic-selection inference no longer appeared in that run.
- Manual reading of authentic TEAM_REVIEW PRIMARY nevertheless found CASPER analysis: 「目先の試合の勝敗だけでなく、控え選手の経験や全体の成長バランスを見据えた運用が求められる」 (unverified development/experience priority), and 「選手間の出場機会の差していないか、チーム全体で取り組む姿勢が問われている」 (malformed replacement residue). A fact-limited FINAL does not make unsupported PRIMARY acceptable.
- The cause is generalized TEAM_REVIEW wording-guard incompleteness combined with partial string replacements inside recoverSoftTeamReviewDependency. The current user question is about observed team weaknesses, not speculative future coaching philosophy.
- Branch fix/team-review-casper-sentence-integrity-20261008 extends the existing unsupported current development soft guard to normative generic experience/growth prescriptions and malformed usage-difference fragments. Recovery removes speculative burden/experience/development sentences as whole units before phrase replacements, then re-runs complete original validatePersonaOutput, preserving facts and allowing explicit evidence-limit denials.
- Regress production phrases, explicit uncertainty, measured playing-time facts and no malformed output. Require deliberation + continuity CI green. Do not weaken numeric guard or turn a 1-1-1 deadlock into 2-1. Wait for ongoing prior Production Sequential Suite 37755091562 before main merge/deploy to avoid overlapping free-tier provider calls.
- Still open: authenticated iPhone/browser nine-class real UI acceptance and every selected slot's evidence-based rationale. Staged workflow success alone does not prove those user paths.

## 2026-10-08: Current SHA TEAM_REVIEW PRIMARY stopped by polarity bug, with genuine scoring-route overclaim

- Canonical pre-merge main and Vercel production SHA `7becd82bca101a02e7555c762e633cfc2b30fef8`. Its Production Live Selftest run `37755825609` passed SHA readiness, best-order, closer and natural third. TEAM_REVIEW job `113241666556` produced PREPARE and PRIMARY, then failed the PRIMARY acceptance jq assertion before CROSS/SECOND/FINAL.
- Exact false-positive: MELCHIOR wrote `打率の数値の差や一部の無安打状態を直ちにチーム全体の弱点や戦術的制約と断定するだけの追加的な因果関係の記録はEvidenceにない`. This explicitly rejects a team-wide causal inference. The smoke test rejected the bare `戦術的制約` token because PRIMARY had only a `頼りすぎ` negation normalization, unlike SECOND.
- Genuine overclaims separately present in BALTHASAR PRIMARY: `どうやって点を取るか、そこをはっきりさせないと勝てないぞ` and `試合中の得点ルートが限定されるリスクについて考慮する必要がある`. Neither follows from individual batting records. Do not treat correcting the smoke alone as resolving output quality.
- Branch `fix/team-review-scoring-route-polarity-20261008` adds a narrowly bounded PRIMARY acceptance normalization for explicit tactical **non-causal disclaimers** (no crossing Japanese sentence punctuation), without hiding an adjacent unsupported assertion. It adds TEAM_REVIEW evidence guards for unsupported scoring-route restriction and necessary-to-win predictions, extends only the corresponding known soft-recovery guard classes, preserves direct facts and reruns `validatePersonaOutput`. Adds positive/asserted and negative/disclaimed tests and checks the actual jq PRIMARY filter. The first three stages of this fix must not invent tactics, injuries, coach intent or team scoring statistics.
- Require CI + continuity green; merge only after checking exact main, and Vercel SHA READY. Run one controlled Live check; avoid rate-limit retry loops. Existing nine-class real browser acceptance and nine-player reasoning quality remain unresolved. Never alter Drive/CSV or free Vercel Hobby.

## 2026-10-08: Reserve-player development weakness reintroduced into TEAM_REVIEW PRIMARY

- Canonical pre-change `main` and Vercel READY SHA `c39cf7f90508cd10e56b20222dd1d5f2a4507433`. Production Live run `37795468517` passed all four SHA-gated staged classes, including TEAM_REVIEW PRIMARY/CROSS/SECOND/FINAL. Best-order returned a legitimate 1-1-1 deadlock; do not fabricate a majority.
- Manual examination of TEAM_REVIEW PRIMARY job `113376404164` found CASPER's published statement: `出場記録の少ない選手の経験や控えの育成という課題も、今のチームの大切な弱点として見ていく必要があります`. The verified selection/usage spread does not by itself prove a present team weakness in reserve-player development. The synthesized FINAL avoided this claim, but every published PRIMARY statement must also be evidence-grounded.
- This is a **general phrase-category gap** in an otherwise existing TEAM_REVIEW fail-closed guard: the current unsupported-development prescription covered `控え選手` / `全体` / `チーム` **before** `育成`, but omitted `控えの育成` and the explicit `弱点` predicate. The same gap existed in the recovery's pre-rewrite whole-sentence removal. Branch `fix/team-review-reserve-development-weakness-20261008` extends both existing checks to `控え（選手／の）` and `弱点` without changing guard type or risk classification. The normal existing soft recovery drops only unsupported developmental commentary and runs `validatePersonaOutput` again while preserving measured usage facts.
- Added a direct TEAM_REVIEW positive guard regression with the exact Live statement, a negative explicit denial, and a batch recovery test requiring original observed facts to survive. PR CI + continuity must pass before merge; avoid duplicate provider-heavy Live requests until the running production chain finishes. No changes to Drive, CSV, coach intent or Vercel Hobby/free.
- Still unresolved: actual authenticated iPhone/browser success for all nine question classes, player-by-player lineup evidence justification, and repeatable semantic-quality review. No selftest or single successful answer warrants a project-complete claim.

## 2026-10-09: Conditional batting-fix -> late scoring harm leak in TEAM_REVIEW

- Canonical main and READY production SHA at branch base: `9777aece8072009db7f649c6359a2d1d3f10051c`. The latest Production Live run `37797813166` passed all four staged jobs through FINAL. The previously unsupported CASPER statement `控えの育成という課題も今のチームの大切な弱点` did not recur in that run. BEST_ORDER appropriately held a genuine 1-1-1 `DEADLOCK`.
- Manual read of TEAM_REVIEW PRIMARY job `113384055000` revealed fresh unsupported BALTHASAR statements: `特定のバッターだけに頼った状態では厳しい` and `下位打線や直近で安打のない選手たちの出塁や進塁打の確率を高める手が打てなければ、試合終盤の得点力が限定される`. Both turn individual batting observations into a projected team-result limitation without measured team scoring/outcome Evidence. A clean FINAL does not excuse incorrect published PRIMARY.
- Branch `fix/team-review-conditional-scoring-leaps-20261009` extends the **existing** TEAM_REVIEW scoring-path/necessary-to-win issue classification to specifically handle conditional late-scoring decline and one-batter reliance -> claimed game-result disadvantage. Reuse that very same existing fail-closed soft recovery. Keep explicit non-assertion/evidence-limitation sentences, and retain measured batting facts and all player/roster/fielding validation. No numerical evidence is inferred or altered.
- Add positive-assertion vs negative-disclaimer regression and a batch recovery test preserving direct recorded facts while dropping the unsupported hypothetical consequences. Require deliberation/continuity CI. Do not hot-loop provider calls or merge amid older provider-heavy Sequential tests. After READY production SHA, run staged Live and inspect every published PRIMARY/SECOND/FINAL text.
- Still open: end-to-end authenticated real iPhone/browser checks for all nine question classes; a persuasive player-by-player rationale for each lineup slot; and avoiding overclaiming completed system quality from green synthetic checks. Keep Vercel Hobby/free and all Drive/CSV score originals read-only.

## 2026-10-09: Semantic team-aggregate stats routing gap

- Original analysis base SHA `9777aece8072009db7f649c6359a2d1d3f10051c`; rebased changes on latest main `bf55b6641c9522a799f8367fc0c0c11a5707a8a8` (merged #137 narrowed the unsupported TEAM_REVIEW reserve-development guard; overlapping #138 was closed). Its SHA-gated Live run `37797813166` began and best-order, closer, natural-third reached completed success; later steps may still be underway, so do not overlap heavy Gemini workflows.
- Inspecting the **actual** `main-live-answer-v362.js` → POST `/api/magi/core` → `understandRequestGeminiFirst` → `routedFromSemantic` → `buildLiveAnswer` chain exposed a general domain mismatch: `normalizeModel` requires **one named player** for any `SINGLE_VALUE` or `SUMMARY` regardless of the semantic target `TEAM`, while `routedFromSemantic` prioritizes `BATTING` even if `TEAM` is explicitly present with no individual. This wrongly asks for an individual on questions like `今季のチームOPSだけ教えて` and prevents the already supported `TEAM_LOOKUP` aggregate route.
- Branch `fix/semantic-team-aggregate-stats-20261009`: accept only high-confidence semantic `TEAM` requests with zero current/grounded player and `SINGLE_VALUE`/`SUMMARY` as `teamAggregate`, route them to the **existing** `TEAM_LOOKUP`; keep unrelated individual batting/pitching/fielding, ambiguous no-target, unsupported `FULL_REPORT`, and low-confidence `CLARIFY` fail-closed. No literal question string special cases, fabricated data or new external source.
- Add six deterministic regressions for actual semantic normalization + core routing + `buildLiveAnswer` with fixed fake XLSM provider; includes positive team OPS/record, unchanged personal metrics, ambiguous/no player, unsupported full team report and confidence gate. Wire to Deliberation Final CI for the changed semantic/core files, before merging.
- This is **local route contract evidence**, not verification of the authenticated production iPhone UI path. The remaining nine-class actual UI goal includes individual evaluation, tactics, comparison, direct statistics, and CLARIFY. Need verify production after CI, respecting free Vercel and protecting Drive/CSV and coach evidence.

## 2026-10-09: TEAM_REVIEW win-key and unverified alternative-tactic claims

- Baseline canonical GitHub main/READY production SHA: `6226bcef9c2b50756b87777cdae3aaee610e03c5`. The four-class Production Live workflow `37801269938` passed through TEAM_REVIEW FINAL. The BEST_ORDER returned a legitimate 1-1-1 DEADLOCK, so do not fabricate a selected 1–9 lineup.
- Manual read of TEAM_REVIEW job `113395622100` found two still-ungrounded PRIMARY BALTHASAR sentences: `下位打線の出塁や得点機での効率的な進め方が勝敗の鍵を握る` in analysis, and `攻撃の軸が抑え込まれた場合の代替策が不足する懸念がある` in warnings. Individual batting statistics and current appearance records alone do not prove either a particular necessary winning factor or the absence of an alternative attack tactic. The synthesized FINAL did not repeat these, but PRIMARY must also be evidence-grounded.
- Branch `fix/team-review-victory-key-and-alternative-overclaim-20261009` extends the **existing** TEAM_REVIEW win/scoring causal guard category to the observed "勝敗の鍵" and absent alternative strategy variants; the same existing fail-closed soft recovery replaces these sentences with an explicit evidence limitation before publication. Measured batting facts and direct negative statements (`とは断定できない`) remain intact.
- Positive and negative output-guard regressions and batch recovery/fact preservation are added. CI, continuity and source-guard must pass before main merge. Wait for any prior provider-heavy workflow to finish; avoid paid Vercel features or any Drive/CSV/score sheet writes.
- New team aggregate natural stats route PR #141 is merged as `6226bcef`; tests passed, but its actual authenticated iPhone Chrome TEAM OPS query is still unverified. Full nine-class authenticated browser path and specific reasons for all nine batting slots remain priority; do not equate a green staged backend run with project completion.

## 2026-10-09: Explicit TEAM aggregate question after named-player context

- Baseline main/READY production SHA `bb5af2f76b5b0526df75a25a3d444b596aeaa9a9`; TEAM_REVIEW victory-key/alternative-claim guard changes from PR #142 are preserved. The source-of-truth TEAM aggregate route introduced via PR #141 is in main and had six synthetic routing tests, but none checked a preceding player-focused conversation.
- `normalizeModel` uses `usesContextReference(question)` with the temporal phrase `今の` as an apparent player reference. `contextNames(context)` can therefore carry an unrelated previously named player into `groundedPlayers`, and `teamAggregateLookup` incorrectly rejects `今のチームOPSだけ教えて` even when Gemini correctly emits HIGH `TEAM`, SINGLE_VALUE, and no players. This could trigger an unjustified one-player clarification for an explicitly team-wide question.
- Branch `fix/team-aggregate-context-carry-20261009` permits a high-confidence TEAM SINGLE_VALUE/SUMMARY with no model-selected player and explicit TEAM-scope wording (`チーム／全体／全員`) to remain TEAM aggregate even when unrelated player names exist only in earlier conversation. It preserves explicit player names, genuine anaphora (`その選手` etc), low-confidence CLARIFY and unsupported FULL_REPORT. No runtime metric values or coach statements are changed.
- Extend the existing real semantic-normalizer + `routedFromSemantic` + synthetic XLSM `buildLiveAnswer` contract from six to ten cases: team OPS and team wins after named-player prior turns, explicit player-anaphora continuation, and ambiguous `その選手のチームOPS` clarification.
- Require Deliberation Final + Development Continuity CI and no overlapping provider-heavy SHA-gated Live before merge/deploy. Verify latest production SHA READY. **This does not establish authenticated iPhone/browser nine-class E2E**; that remains open and no direct Google Drive/CSV or Vercel Hobby/free changes are allowed.

## 2026-10-09: Semantic two-player batting COMPARISON requires its own verified Evidence

- Canonical branch base main `49e6ba803e25862e38379840ad615f2b6fb9d484` (PR #143 merged after green CI), Vercel `magi-web.vercel.app` READY at the same SHA. Its newly triggered Production Live run `37809003083` is underway; do not overlap Gemini-heavy deployments/tests. The previous SHA `bb5af2f76b5b0526df75a25a3d444b596aeaa9a9` completed all four SHA-gated live stages and all Sequential Suite jobs, but real authenticated iPhone UI paths remain unverified.
- Following the **actual** semantic `COMPARISON` -> `deliberationPayload` path exposed a two-player batting Evidence gap: `buildCurrentSelectionEvidence` refuses named-player non-selection questions, while the natural player-review special case handles exactly one player, and the existing pitching augmentation only handles `PITCHING`. Therefore `大野 竜暉と坂田 暉馬の今季打撃成績を比較して` can enter deliberation with no explicit matched batting table. Do not expect the language model to infer these two records.
- Newly observed background Live run `37809003083` on the preceding SHA `49e6ba803e25862e38379840ad615f2b6fb9d484` passed BEST_ORDER but failed **CLOSER SECOND**: after valid PREPARE/PRIMARY/CROSS, the Gemini persona-batch provider returned a transient `timeout` (`PERSONA_BATCH_GENERATION_FAILED`) on all three controlled requests, not a deterministic evidence-guard rejection. Do not hot-loop; this is separate from the two-player comparison Evidence change. Other live jobs may still be active.\n- Branch `fix/semantic-two-player-batting-comparison-evidence-20261009` creates a strict current-season, high-confidence semantic `COMPARISON` Evidence reader: exactly two distinct canonical **current-roster** players, `BATTING` domain, no pitching/fielding mixed domain, and supported current/unspecified time scope. Both must have batting AB/H/AVG rows from the **same** verified current `XLSM_MASTER`. Only whitelisted available metrics enter the packet, including the exact source, period and player names. Failed read/missing row -> fail-closed CLARIFY/HOLD, never invent figures or silently replace with old-team data.
- Integrate into `server/api/magi/core.js` *before* generic selection evidence. Preserve direct individual stat routes, actual member authentication gate, full-lineup and TEAM_REVIEW paths. Add deterministic `scripts/test-current-player-comparison-evidence.mjs` with successful, reversed, missing-stat, wrong-year, retired-player, unsupported-domain, Drive-error and explicit core-contract assertions. Wire into Deliberation Final CI on PR and push.
- **Unresolved after this patch:** scope beyond current batting comparisons, real browser authenticated response rendering, actual multi-player/tactics/PLAYER_REVIEW/CLARIFY E2E, and personalized per-slot nine-player evidence explanation quality. Only merge if CI success and review; verify deployment SHA before real production claims. Preserve Vercel Hobby/free; no Google Drive/CSV mutation.

## Next concrete work

1. Complete CI for `fix/live-deployment-readiness-gate-20261007`; merge only when continuity and the expanded live-SHA/readiness contract are green. Keep Vercel Hobby/free; do not upgrade for build-rate-limit.
2. Treat Production Live runs created while Vercel is serving an older SHA as deployment-readiness failures only. They must not consume Gemini/persona calls or be used to judge current-main semantics.
3. The first valid Production Live run on a freely deployed current main must prove `deployment.sha == GITHUB_SHA` and then execute best-order, closer, natural-third and TEAM_REVIEW sequentially through PRIMARY -> CROSS -> SECOND -> FINAL.
4. Inspect every published rationale field, not only job status. Reject batting-number/order -> scoring/win causality, batting-slot starts -> role settlement/experience-value/stability, save -> certain victory, metric -> stability/reliability, unsupported growth/development, unsupported burden concentration, TEAM_REVIEW spread -> tactical/scoring-dependency/future claims, and FINAL reintroduction.
5. Only after all four classes are structurally and semantically clean on the same production SHA, expand real-path acceptance to individual-player evaluation, player comparison, team tactics/next-game strategy, direct statistics lookup and CLARIFY.
6. Measure response latency by class and keep direct statistics/clarification paths out of unnecessary full deliberation. Do not declare stabilization complete until the remaining classes are verified through their real production paths and user-visible answer quality is acceptable.

## Handoff instruction for a new ChatGPT chat

The user should not need to paste a long historical summary.

The correct first action is:
1. open this file from GitHub **main**;
2. inspect current main and commits since `State base main SHA`;
3. inspect current Vercel/Actions state;
4. continue from **Current unresolved priority** and **Next concrete work**.

Do not restart architectural discovery from memory. Do not ask the user to reconstruct work already recorded here.
