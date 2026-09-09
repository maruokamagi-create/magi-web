# MAGI Live Pitching Answer Test — failure diagnosis

Date: 2026-09-09
Page: `/live-pitching-answer-test.html`

## Result before fix
- Executed: 8
- PASS: 2
- FAIL: 6
- API ERROR: 0

## Observed wrong live values
- 橋向 結都 今期 ERA: returned 5.25; authoritative aggregate target 2.00
- 大久保 陽翔 今期 ERA: returned 1.75; target 3.89
- 大久保 陽翔 今期 SO: returned 5; target 15
- 中嶋 玲月 今期 IP: returned 1; target 5.0
- 大久保 夢翔 今期 BB: returned 1; target 8
- 大久保 陽翔 2025-2026 ERA: returned 4.90; target 3.63

P06 appeared PASS only because its assertion checked labels, not the numeric summary; the visible summary itself was wrong. P08 old-team IP=56 was correct.

## Root cause
The generic XLSM player parser searched for the player's name in **any cell of a row**, then attached the highest-scoring pitching-like header found in the preceding 30 rows. In workbooks containing game/split/catcher/usage pitching tables, this can bind a player occurrence to a non-aggregate row or a misaligned header.

## Fix principle
For pitching totals, require the player name to be in the canonical `投手名`/player-name column of a pitching table, gather all valid candidates, reject/penalize split contexts, and prefer the cumulative aggregate candidate (largest valid IP as a tie-breaker). Never accept a player-name occurrence from arbitrary cells such as catcher or auxiliary tables.
