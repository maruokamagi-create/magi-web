# MAGI 旧チーム 詳細回答テスト — 8/8 PASS

Date: 2026-09-09

Result:
- PASS: 8
- FAIL: 0
- API ERROR: 0

Scope:
- 2025-2026 old team only
- batting/running detail based on XLSM master totals reconciled with CSV detail
- fielding detail based on XLSM master internal fielding-detail recalculation reconciled with CSV
- Gemini does not invent numeric values in this path

Cases covered:
1. individual stolen bases
2. individual walks + HBP
3. individual sacrifice hits + sacrifice flies
4. individual fielding chances + errors
5. individual fielding percentage
6. catcher caught-stealing count + caught-stealing percentage
7. team stolen bases
8. team errors

Important regression fixed before pass:
- Phrases such as `前チームの宮村 龍...` were falsely classified as team-wide because the substring `チームの` matched inside `前チームの`.
- Rule changed so an explicitly resolved single player takes precedence over generic team wording. Team-wide aggregation now requires explicit wording such as `チーム全体`, `全員`, or `全選手` when a player is not the target.

Final status: PASS 8/8. Old-team detail answer path is validated for the tested metrics.
