# MAGI Live Question → Answer Test

Date: 2026-09-09
Page: `/live-question-answer-test.html`

## Result
- Executed: 8
- PASS: 8
- FAIL: 0
- API ERROR: 0

## Scope
End-to-end verification from ordinary Japanese question through question understanding, season/target selection, authoritative Google Drive XLSM retrieval, deterministic numeric extraction/calculation, and final answer formatting.

Numeric retrieval and answer formatting do not use Gemini. The router may use Gemini for question understanding.

Verified cases include current-team individual OPS, current-team record/team OPS, old-team OPS, refusal to invent an unsupported career total, and clarification for an ambiguous document request.

## Evidence
User-provided result screenshot showed 8/8 PASS and 0 API errors. Example visible result: `陽翔の今期OPS教えて` → `大久保 陽翔の今期OPSは.912です。`
