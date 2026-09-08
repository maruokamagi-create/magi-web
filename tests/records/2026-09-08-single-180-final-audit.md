# MAGI Single-Turn 180 — Final Run / Semantic Audit

Date: 2026-09-08 JST
Test suite: `single-180-v1`
Router shown during run: `v11-resolved-state-period-guard`

## Final browser result

- Executed: 180 / 180
- PASS: 178
- FAIL: 2
- API ERROR: 0
- FAIL cases visible in browser:
  - S166 `レポート見せて`
    - expected by v1 suite: `CLARIFY`
    - actual: `DOCUMENT_SEARCH`
    - assessment: genuine router defect. A bare generic document request does not identify which report/document should be opened. It should clarify rather than execute a broad document search.
  - S173 `陽翔の成績と起用どう？`
    - expected by v1 suite: `CLARIFY`
    - actual: `DELIBERATION`
    - assessment: the v1 expectation is too conservative. The user explicitly asks about usage (`起用`), which is a judgment request. A capable MAGI should be able to use relevant performance data as evidence and deliberate without forcing an unnecessary clarification.

## Important semantic audit finding

The objective is not to force 180/180 against stale expected labels. The objective is:

1. understand the user's question correctly;
2. answer it appropriately with the minimum necessary clarification.

During review, S174 `大野 竜暉の打撃と投手の両方まとめて` was also identified as a false-positive PASS in v1. The v1 suite expected `CLARIFY`, but the request is explicit: the user wants both batting and pitching. Asking the user to choose one is unnecessary. A new semantic route `PLAYER_OVERVIEW` is therefore introduced in the current wrapper for an explicit multi-domain factual summary.

Likewise, `4番どうする？` is an actionable team lineup decision: the candidate set can be the team roster, so a named player is not inherently required before deliberation.

## Changes after the run

Current wrapper advanced to `v12-intent-specificity-overview` with these general rules:

- bare generic document request (e.g. `レポート見せて`) -> `CLARIFY`;
- explicit one-player batting + pitching summary -> `PLAYER_OVERVIEW`;
- explicit open team lineup decision (e.g. `4番どうする？`) -> `DELIBERATION`;
- existing period-follow-up, comparison-axis, and context guards remain in place.

A focused audit page was added: `router-semantic-audit-smoke-test.html`.

The old 180-case result is preserved as historical evidence. It must not be rewritten as 180/180 after changing expectations.