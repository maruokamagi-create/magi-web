from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, got {count} for {old[:100]!r}')
    p.write_text(s.replace(old, new, 1))


path='server/api/magi/orchestrate.js'
marker='export function buildFullLineupResult(second, cross) {'
helper=r'''function deterministicFullLineupCross(primary) {
  const specs = [
    ['melchior','メルキオール'],
    ['balthasar','バルタザール'],
    ['casper','カスパー']
  ];
  const rows = specs.map(([key,jp]) => {
    const value = primary?.[key] || {};
    const order = Array.isArray(value?.candidatePlayers) ? value.candidatePlayers.map(x=>String(x||'').trim()).filter(Boolean) : [];
    return { key, jp, order };
  });
  if (rows.some(row => row.order.length !== 9 || new Set(row.order.map(playerKey)).size !== 9)) return null;

  const agreement = [];
  const disagreement = [];
  const differentSlots = [];
  for (let i=0;i<9;i++) {
    const values = rows.map(row=>row.order[i]);
    const unique = [...new Set(values.map(playerKey))];
    if (unique.length === 1) agreement.push(`${i+1}番は3賢人とも${values[0]}で一致しています。`);
    else {
      differentSlots.push(i);
      disagreement.push(`${i+1}番は${rows.map(row=>`${row.jp}：${row.order[i]}`).join('／')}で意見が分かれています。`);
    }
  }

  const challenges = { melchior:[], balthasar:[], casper:[] };
  rows.forEach((row,rowIndex)=>{
    const slot = differentSlots.find(i=>rows.some((other,j)=>j!==rowIndex && playerKey(other.order[i])!==playerKey(row.order[i]))) ?? 3;
    const own = row.order[slot];
    const other = rows.find((candidate,j)=>j!==rowIndex && playerKey(candidate.order[slot])!==playerKey(own));
    if (other) {
      challenges[row.key].push(`${row.jp}、あなたは${slot+1}番に${own}を置いています。${other.jp}の${other.order[slot]}案と比べ、確認できた記録と打線のつながりから、この配置を維持するか見直すか説明してください。`);
    } else {
      challenges[row.key].push(`${row.jp}、3賢人とも${slot+1}番に${own}を置いています。一致しているからこそ、この配置の弱点と、どんな記録の変化なら見直すか確認してください。`);
    }
  });

  return {
    agreement: agreement.slice(0,4),
    disagreement: disagreement.slice(0,4),
    domainConflicts: [],
    warnings: [],
    informationGaps: [],
    challenges
  };
}

'''
replace_once(path, marker, helper+marker)

old_initial='''      let rawResult = await callGemini({
        systemInstruction: ORCHESTRATOR,
        userPayload: basePayload,
        responseSchema: crossSchema
      });
      let result = canonicalizePlayerData(rawResult);
      let guardIssues = validateCrossOutput(body.case, result, { focused: !selectionCase });
'''
new_initial='''      let rawResult;
      let result;
      let guardIssues;
      try {
        rawResult = await callGemini({
          systemInstruction: ORCHESTRATOR,
          userPayload: basePayload,
          responseSchema: crossSchema
        });
        result = canonicalizePlayerData(rawResult);
        guardIssues = validateCrossOutput(body.case, result, { focused: !selectionCase });
      } catch (crossError) {
        const fallback = fullLineupCase ? deterministicFullLineupCross(body.primary) : null;
        if (fallback) return sendJson(res, 200, canonicalizePlayerData(fallback));
        throw crossError;
      }
'''
replace_once(path, old_initial, new_initial)

old_correction='''        rawResult = await callGemini({
          systemInstruction: ORCHESTRATOR,
          userPayload: correctionPayload,
          responseSchema: crossSchema
        });
        result = canonicalizePlayerData(rawResult);
        guardIssues = validateCrossOutput(body.case, result, { focused: !selectionCase });
'''
new_correction='''        try {
          rawResult = await callGemini({
            systemInstruction: ORCHESTRATOR,
            userPayload: correctionPayload,
            responseSchema: crossSchema
          });
          result = canonicalizePlayerData(rawResult);
          guardIssues = validateCrossOutput(body.case, result, { focused: !selectionCase });
        } catch (correctionError) {
          const fallback = fullLineupCase ? deterministicFullLineupCross(body.primary) : null;
          if (fallback) {
            result = fallback;
            guardIssues = [];
            break;
          }
          throw correctionError;
        }
'''
replace_once(path, old_correction, new_correction)

replace_once(path,
'''      if (guardIssues.length) result = failClosedCross(guardIssues);''',
'''      if (guardIssues.length) {
        const fallback = fullLineupCase ? deterministicFullLineupCross(body.primary) : null;
        result = fallback || failClosedCross(guardIssues);
      }''')

replace_once(path,
'''  } catch (error) {
    const status = error?.message === 'Request body too large' ? 413 : 500;
    console.error('[MAGI orchestrate]', error?.message || error);
    return sendJson(res, status, { error: status === 413 ? 'Request body too large' : 'Orchestration failed' });
  }''',
'''  } catch (error) {
    const tooLarge = error?.message === 'Request body too large';
    const transient = error?.timedOut === true || error?.retryable === true || [408,429,500,502,503,504].includes(Number(error?.status));
    const status = tooLarge ? 413 : (transient ? 503 : 500);
    console.error('[MAGI orchestrate]', error?.message || error);
    return sendJson(res, status, {
      error: tooLarge ? '送信データが大きすぎます。' : (transient ? '相互検証を一時的に取得できませんでした。' : '相互検証を作成できませんでした。'),
      code: tooLarge ? 'REQUEST_TOO_LARGE' : 'CROSS_EXAMINATION_FAILED',
      retryExhausted: transient
    });
  }''')
