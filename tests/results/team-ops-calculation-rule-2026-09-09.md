# Team OPS calculation rule — 2026-09-09

Correction from live XLSM test:
- Team OPS is not stored as an authoritative field in the XLSM master.
- MAGI must calculate team OPS from team batting aggregate values in the authoritative XLSM.
- Never average individual-player OPS values.

Primary formula:
- OBP = (H + BB + HBP) / (AB + BB + HBP + SF)
- TB = 1B + 2*2B + 3*3B + 4*HR
- SLG = TB / AB
- OPS = OBP + SLG
- Display to 3 decimal places.

Fallback only when the same aggregate table provides OBP and SLG but not enough raw totals:
- OPS = aggregate OBP + aggregate SLG

Scope:
- 2026-2027 current team authoritative XLSM
- 2025-2026 old team authoritative XLSM

Implementation:
- api/magi/_drive-live-audit.js
- parser version: deterministic-xlsx-v2-team-ops-calculated
