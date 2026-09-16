from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, got {count} for {old[:80]!r}')
    p.write_text(s.replace(old, new, 1))


persona = 'server/api/magi/persona.js'
marker = 'function failClosedPersona(result, issues) {'
helper = r'''function recoverSoftFullLineupLanguage(result, issues, fullLineupCase) {
  if (!fullLineupCase || !Array.isArray(issues) || !issues.length) return false;
  const check = validateFullLineupOrder(result?.candidatePlayers);
  if (!check.ok) return false;
  const hard = issues.some(issue => /(?:FULL_LINEUP|正式ロスター|ロスター完全一致|対象外|9人の打順構成|candidatePlayers|打順構成エラー|数値.{0,30}(?:一致しない|存在しない)|選手名.{0,30}(?:存在しない|対象外)|supplied CASE\/EVIDENCE.{0,50}(?:値と一致しない|選手.*存在しない))/i.test(String(issue || '')));
  if (hard) return false;
  result.candidatePlayers = check.order;
  result.judgment = 'BLUE';
  result.confidence = result.confidence === 'HIGH' ? 'HIGH' : 'MEDIUM';
  result.reviewRequested = false;
  result.reviewReason = '';
  result.dataConflict = false;
  result.facts = [];
  result.analysis = [];
  result.prediction = [];
  result.candidateBasis = '確認できた今季通算成績と打数を基準に、現チーム14名から9人を比較してこの順番としました。';
  result.primaryReason = '確認できた記録だけを使い、現在の成績と打順のつながりを比較した案です。';
  result.publicStatement = `${check.order.map((name,index)=>`${index+1}番${name}`).join('、')} の順です。確認できた記録だけで比較しました。`;
  result.warnings = ['説明のうち確認できない内容は判断に使っていません。'];
  return true;
}

'''
replace_once(persona, marker, helper + marker)
replace_once(
    persona,
    "  const reason = `回答文の数値・選手参照をEvidenceと照合した結果、不整合を検出したため再確認が必要です。${issues.slice(0,3).join('／')}`;",
    "  const reason = `回答文に、確認できた記録と合わない内容があるため再確認が必要です。${issues.slice(0,3).join('／')}`;",
)
replace_once(
    persona,
    "    for (let attempt = 0; guardIssues.length && attempt < 3; attempt++) {",
    "    const correctionLimit = fullLineupCase ? 1 : 3;\n    for (let attempt = 0; guardIssues.length && attempt < correctionLimit; attempt++) {",
)
replace_once(
    persona,
    """      rawResult = await callGemini({
        systemInstruction: PERSONA_PROMPTS[persona],
        userPayload: correctionPayload,
        responseSchema: schema
      });""",
    """      try {
        rawResult = await callGemini({
          systemInstruction: PERSONA_PROMPTS[persona],
          userPayload: correctionPayload,
          responseSchema: schema
        });
      } catch (correctionError) {
        console.warn(`[MAGI persona correction] ${persona} ${phase}: ${correctionError?.message || correctionError}`);
        break;
      }""",
)
replace_once(
    persona,
    "    if (guardIssues.length) failClosedPersona(result, guardIssues);",
    "    if (guardIssues.length && !recoverSoftFullLineupLanguage(result, guardIssues, fullLineupCase)) failClosedPersona(result, guardIssues);",
)
replace_once(
    persona,
    """  } catch (error) {
    const status = error?.message === 'Request body too large' ? 413 : 500;
    console.error('[MAGI persona]', error?.message || error);
    return sendJson(res, status, { error: status === 413 ? 'Request body too large' : 'Persona execution failed' });
  }""",
    """  } catch (error) {
    const tooLarge = error?.message === 'Request body too large';
    const transient = error?.timedOut === true || error?.retryable === true || [408,429,500,502,503,504].includes(Number(error?.status));
    const status = tooLarge ? 413 : (transient ? 503 : 500);
    console.error('[MAGI persona]', error?.message || error);
    return sendJson(res, status, {
      error: tooLarge ? '送信データが大きすぎます。' : (transient ? '3賢人の回答を一時的に取得できませんでした。' : '3賢人の回答を作成できませんでした。'),
      code: tooLarge ? 'REQUEST_TOO_LARGE' : 'PERSONA_GENERATION_FAILED',
      retryExhausted: transient
    });
  }""",
)

client = 'deliberation-integrity-v348.js'
replace_once(
    client,
    """      const err=new Error(body?.error||`MAGI API error ${res.status}`);err.status=res.status;lastError=err;
      if(!(res.status===408||res.status===429||res.status>=500))throw err;
    }catch(error){lastError=error;if(error?.status&&!(error.status===408||error.status===429||error.status>=500))throw error}""",
    """      const err=new Error(body?.error||`MAGI API error ${res.status}`);err.status=res.status;err.retryExhausted=body?.retryExhausted===true;lastError=err;
      if(err.retryExhausted||!(res.status===408||res.status===429||res.status>=500))throw err;
    }catch(error){lastError=error;if(error?.retryExhausted)throw error;if(error?.status&&!(error.status===408||error.status===429||error.status>=500))throw error}""",
)
replace_once(
    client,
    "if(!/回答文の数値・選手参照をEvidenceと照合した結果、不整合/.test(reason))return false;",
    "if(!/(?:回答文の数値・選手参照をEvidenceと照合した結果、不整合|回答文に、確認できた記録と合わない内容)/.test(reason))return false;",
)
replace_once(
    client,
    "out.candidateBasis='説明文のうちEvidence照合に通らなかった表現を除外し、正式ロスター内の9人の打順案だけを保持して再審議を継続。';",
    "out.candidateBasis='確認できない説明は使わず、登録選手の中から選んだ9人の打順案で比較を続けます。';",
)
replace_once(
    client,
    "out.publicStatement=`${first}の標準案は ${names.map((name,i)=>`${i+1}番${name}`).join('、')} です。説明文の一部がEvidence照合に通らなかったため、その表現は採用せず、打順案だけを残して比較します。`;",
    "out.publicStatement=`${first}の標準案は ${names.map((name,i)=>`${i+1}番${name}`).join('、')} です。確認できない説明は判断に使わず、この打順案で比較を続けます。`;",
)
replace_once(
    client,
    "out.warnings=['説明文の一部をEvidence照合で除外。打順そのものは正式ロスター内で成立。'];",
    "out.warnings=['確認できない説明は判断に使っていません。打順案は登録選手の中で成立しています。'];",
)
