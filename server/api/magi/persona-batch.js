import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { PERSONA_PROMPTS } from './_prompts.js';
import { deterministicFullLineupCross, deterministicSelectionCross, isSelectionCase } from './orchestrate.js';
import { validatePersonaOutput, hasUnhedgedOutcomePrediction, isHardOutcomeGuarantee } from './_persona-output-guard.js';
import { CURRENT_ROSTER, canonicalizePlayerData } from './_roster.js';
import {
  PERSONA_RESPONSE_SCHEMA,
  buildPersonaRequest,
  finalizePersonaDraft,
  recoverSoftFullLineupLanguage,
  recoverSoftPitchingPlanLanguage,
  validPersonaCase
} from './persona.js';

const PERSONAS = ['melchior','balthasar','casper'];

const BATCH_SCHEMA = {
  type: 'OBJECT',
  properties: Object.fromEntries(PERSONAS.map(persona => [persona, PERSONA_RESPONSE_SCHEMA])),
  required: PERSONAS
};

const FULL_PERSONA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    checkedPlayers: { type: 'ARRAY', items: { type: 'STRING' } },
    candidatePlayers: { type: 'ARRAY', items: { type: 'STRING' } },
    candidateBasis: { type: 'STRING' },
    facts: { type: 'ARRAY', items: { type: 'STRING' } },
    confidence: { type: 'STRING', enum: ['HIGH','MEDIUM','LOW'] },
    judgment: { type: 'STRING', enum: ['GREEN','BLUE','YELLOW','RED'] },
    primaryReason: { type: 'STRING' },
    publicStatement: { type: 'STRING' },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
    dataConflict: { type: 'BOOLEAN' },
    reviewRequested: { type: 'BOOLEAN' },
    reviewReason: { type: 'STRING' },
    changedFromPrimary: { type: 'BOOLEAN' },
    changeReason: { type: 'STRING' }
  },
  required: ['checkedPlayers','candidatePlayers','candidateBasis','facts','confidence','judgment','primaryReason','publicStatement','warnings','dataConflict','reviewRequested','reviewReason','changedFromPrimary','changeReason']
};
const FULL_PHASE_SCHEMA = {
  type: 'OBJECT',
  properties: Object.fromEntries(PERSONAS.map(persona => [persona, FULL_PERSONA_SCHEMA])),
  required: PERSONAS
};
const FULL_BATCH_SCHEMA = {
  type: 'OBJECT',
  properties: { primary: FULL_PHASE_SCHEMA, second: FULL_PHASE_SCHEMA },
  required: ['primary','second']
};

function inflateFullDraft(raw, persona, phase) {
  return {
    persona: persona.toUpperCase(),
    phase,
    checkedPlayers: raw?.checkedPlayers || [],
    candidatePlayers: raw?.candidatePlayers || [],
    candidateBasis: raw?.candidateBasis || '',
    facts: raw?.facts || [],
    analysis: [],
    prediction: [],
    confidence: raw?.confidence || 'LOW',
    judgment: raw?.judgment || 'YELLOW',
    primaryReason: raw?.primaryReason || '',
    publicStatement: raw?.publicStatement || '',
    warnings: raw?.warnings || [],
    dataConflict: raw?.dataConflict === true,
    reviewRequested: raw?.reviewRequested === true,
    reviewReason: raw?.reviewReason || '',
    changedFromPrimary: raw?.changedFromPrimary === true,
    changeReason: raw?.changeReason || ''
  };
}

function batchSystemInstruction(phase) {
  if (phase === 'FULL') {
    return [
      'MAGI FULL DELIBERATION BATCH PROTOCOL.',
      'Return PRIMARY and SECOND work products for all three personas in one structured response, but preserve strict logical phase ordering.',
      'STEP 1 PRIMARY: each persona reasons independently from the shared CASE. During PRIMARY, another persona output is unavailable and must not be inferred, copied, harmonized, or anticipated.',
      'STEP 2 CROSS: do not invent free-form cross examination. SECOND may use only the deterministic comparison instruction assigned to that persona.',
      'STEP 3 SECOND: each persona may reconsider only its own PRIMARY plus its own deterministic comparison instruction and shared CASE evidence. It must not read another persona reasoning, facts, analysis, warnings, confidence, or SECOND output.',
      'A persona may see another persona candidate name only when its deterministic comparison instruction explicitly names it; this never grants access to that persona reasoning.',
      'Do not seek consensus or majority agreement. Preserve genuine disagreement. Do not create differences merely to appear independent.',
      'MELCHIOR uses only MELCHIOR role; BALTHASAR only BALTHASAR role; CASPER only CASPER role.',
      'Return exactly the requested schema. Never expose hidden reasoning.'
    ].join(' ');
  }
  if (phase === 'SECOND') {
    return [
      'MAGI SECOND BATCH PROTOCOL.',
      'Generate three separately reasoned SECOND judgments in one structured response.',
      'sharedContext is authoritative and applies identically to all three personas; it is supplied once to avoid duplicating the same CASE/Evidence.',
      'Each persona may use sharedContext plus only its own PRIMARY judgment and its own cross-examination compartment.',
      'Never expose or use another persona PRIMARY, challenge, reasoning, or generated SECOND output.',
      'MELCHIOR uses only MELCHIOR system role; BALTHASAR uses only BALTHASAR system role; CASPER uses only CASPER system role.',
      'Reconsideration is allowed only from evidence plus that persona own challenge. Do not seek consensus or majority agreement.',
      'Return exactly the requested schema.'
    ].join(' ');
  }
  return [
    'MAGI PRIMARY BATCH PROTOCOL.',
    'Generate three separately reasoned PRIMARY judgments in one structured response.',
    'sharedContext contains the authoritative CASE/Evidence once and applies identically to all three personas.',
    'Each persona must evaluate that shared CASE independently.',
    'MELCHIOR uses only MELCHIOR system role; BALTHASAR uses only BALTHASAR system role; CASPER uses only CASPER system role.',
    'Do not make one persona react to, quote, imitate, compromise with, or infer the output of another persona.',
    'There is no majority, consensus, cross-examination, or SECOND judgment in this call.',
    'Treat the three outputs as three isolated PRIMARY work products that merely share the same authoritative CASE evidence.',
    'Return exactly the requested schema.'
  ].join(' ');
}

function safeTransient(res, error) {
  const transient = error?.timedOut === true || error?.retryable === true || [408,429,500,502,503,504].includes(Number(error?.status));
  const safeFailureClass = ['provider_rate_limit','model_unavailable','provider_retryable_http','provider_http','empty_text','invalid_structured_json','timeout','other'].includes(String(error?.failureClass || ''))
    ? String(error.failureClass) : (error?.timedOut === true ? 'timeout' : 'other');
  try {
    res.setHeader('X-MAGI-Gemini-Failure', safeFailureClass);
    if (safeFailureClass === 'provider_rate_limit') {
      const retryAfter = Number(error?.retryAfterSeconds);
      res.setHeader('Retry-After', String(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(60, Math.ceil(retryAfter)) : 15));
    }
  } catch {}
  if (transient) {
    try { res.setHeader('X-MAGI-Persona-Recovery', 'retry-persona-batch-request'); } catch {}
  }
  return sendJson(res, transient ? 503 : 500, {
    error: transient ? '3賢人の判断を一時的に取得できませんでした。' : '3賢人の判断を作成できませんでした。',
    code: 'PERSONA_BATCH_GENERATION_FAILED',
    retryExhausted: !transient,
    retryFreshRequest: transient,
    retryScope: transient ? 'PERSONA_BATCH_REQUEST' : '',
    diagnostic: {
      failureClass: safeFailureClass,
      ...(Array.isArray(error?.failureTrail) && error.failureTrail.length ? { providerTrail: error.failureTrail.slice(0, 8).map(row => ({
        slot: String(row?.slot || ''),
        model: String(row?.model || ''),
        failureClass: String(row?.failureClass || ''),
        quotaWindow: String(row?.quotaWindow || ''),
        quotaScope: String(row?.quotaScope || ''),
        quotaId: String(row?.quotaId || '')
      })) } : {}),
      ...(safeFailureClass === 'provider_rate_limit' && error?.providerDiagnostic ? { providerQuota: {
        providerStatus: String(error.providerDiagnostic.providerStatus || ''),
        quotaMetric: String(error.providerDiagnostic.quotaMetric || ''),
        quotaId: String(error.providerDiagnostic.quotaId || ''),
        model: String(error.providerDiagnostic.model || ''),
        location: String(error.providerDiagnostic.location || ''),
        retryDelay: String(error.providerDiagnostic.retryDelay || ''),
        quotaWindow: String(error.providerDiagnostic.quotaWindow || ''),
        quotaScope: String(error.providerDiagnostic.quotaScope || '')
      }} : {})
    }
  });
}

function recoverSoftBurdenEscalation(result, issues) {
  const list=Array.isArray(issues)?issues.map(v=>String(v||'')):[];
  const target='Evidenceの「負担を考慮する必要がある」を、負担の大きさや具体的悪影響の断定へ強めている';
  if(!list.length||!list.every(v=>v.includes(target)))return false;
  const unsafe=/(?:負担(?:が|は|も)?(?:大きい|大きすぎる|重い|過大|過度|集中)|過度な負担|負担集中|特定の選手への負担|特定の選手に負担|蓄積疲労|疲労蓄積|疲労(?:や|と|・)?負担.{0,8}蓄積|(?:疲労|負担).{0,8}(?:蓄積|積み重な)|(?:兼任|負担).{0,24}(?:コンディション|成長|パフォーマンス).{0,16}(?:影響が出|影響を与え|低下し|壊し|損な)|(?:コンディション|成長|パフォーマンス).{0,24}(?:兼任|負担).{0,16}(?:影響が出|影響を与え|低下し|壊し|損な)|(?:兼任|負担|固定).{0,48}(?:半年後|来年|将来|今後).{0,24}(?:響く|響き|影響が出|影響を与え|損な|低下|悪化))/;
  const cleanText=value=>{
    const raw=String(value||'').trim();
    if(!raw||!unsafe.test(raw))return raw;
    const kept=raw.split(/(?<=[。！？!?])/).map(s=>s.trim()).filter(Boolean).filter(s=>!unsafe.test(s));
    return kept.join('');
  };
  const cleanArray=value=>(Array.isArray(value)?value:[]).map(cleanText).filter(Boolean);
  result.facts=cleanArray(result.facts);
  result.analysis=cleanArray(result.analysis);
  result.prediction=cleanArray(result.prediction);
  result.warnings=cleanArray(result.warnings);
  for(const key of ['candidateBasis','primaryReason','publicStatement']){
    const before=String(result?.[key]||'').trim();
    const cleaned=cleanText(before);
    result[key]=cleaned || (before ? '兼任負担については、Evidenceにある「考慮する必要がある」という範囲だけを判断材料にします。' : '');
  }
  result.warnings=[...new Set([...(Array.isArray(result.warnings)?result.warnings:[]),'兼任負担は、Evidenceにある「考慮する必要がある」という範囲を超えて断定しません。'])];
  return true;
}

function recoverSoftTeamReviewDependency(result, issues) {
  const list=Array.isArray(issues)?issues.map(v=>String(v||'')):[];
  const softIssue=v=>v.includes('TEAM_REVIEWで打撃成績の偏りから依存・頼り・偏重を断定')
    ||v.includes('TEAM_REVIEWで起用差から負担集中を断定')
    ||v.includes('TEAM_REVIEWでEvidenceにない未出場選手を前提')
    ||v.includes('TEAM_REVIEWで数値差・偏りをチーム全体の弱点・戦術・育成影響へ拡張')
    ||v.includes('TEAM_REVIEWで個別打撃結果からチーム得点・戦術への因果を断定')
    ||v.includes('TEAM_REVIEWで個別打撃の偏りからチーム攻撃力への未確認の効果を主張')
    ||v.includes('TEAM_REVIEWで個別記録から長期的な成長・経験機会への効果を推定')
    ||v.includes('TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加');
  if(!list.length||!list.every(softIssue))return false;

  const spreadLike=/(?:数値(?:差|の開き|の偏り)|打撃成績.{0,24}(?:差|偏り|開き)|成績.{0,24}(?:差|偏り|開き|集中|濃淡)|生産力.{0,18}濃淡|特定.{0,24}成績.{0,24}集中|打線.{0,10}偏り|(?:差|開き)が(?:大きい|激しい)|上位.{0,20}下位|下位.{0,20}上位|高い数字.{0,36}低い|当たっている選手.{0,30}当たっていない選手|(?:打撃|起用).{0,18}(?:バランス|機会).{0,18}(?:偏り|偏って))/;
  const spreadOverclaim=/(?:弱点|戦術(?:上)?(?:の)?(?:課題)?|戦術(?:的)?な?.{0,12}(?:制約|問題|リスク)|戦術上.{0,18}(?:重要|ポイント)|実戦上.{0,12}課題|育成(?:上)?の課題|得点源|得点力|得点.{0,20}左右|左右されるリスク|打線.{0,12}(?:つながり|厚み)|攻撃.{0,12}(?:硬直|硬直化)|勝負.{0,12}分かれ道|勝ちへの道|勝ちに(?:つな|繋)げ|勝つため|勝負だ|直結|生産力|チーム力)/;
  const individualBattingCue=/(?:無安打|安打0|打率\s*\.?0(?:00)?|低打率|打てていない|当たっていない)/;
  const teamOutcomeCue=/(?:得点源|得点力|得点ルート|得点.{0,20}左右|左右されるリスク|打線.{0,12}(?:つながり|厚み)|勝負.{0,12}分かれ道|勝ち|勝利|勝ちに(?:つな|繋)げ|戦術(?:上)?(?:の)?課題|戦術(?:的)?な?.{0,12}(?:制約|問題|リスク)|戦術上.{0,18}(?:重要|ポイント)|生産力|直結)/;
  const developmentAdvice=/(?:半年後|1年後|将来|これから.{0,24}チーム.{0,24}(?:成長|強く)|チーム全体.{0,24}(?:成長|底上げ|強く)|組織的な成長|組織全体.{0,24}育成|育成機会|見守りたい|成長していく道筋|長期的.{0,20}(?:成長|チーム作り|選手層)|成長の機会|育成上の課題|選手層の育成を疎か|目先の勝敗|短期的な結果)/;

  const rewriteOne=value=>{
    let raw=String(value||'').trim();
    if(!raw)return '';

    raw=raw
      .replace(/(?:得点生産の)?依存度が高い/g,'選手間の打撃成績に数値差がある')
      .replace(/特定の(?:高打率|好調な)?(?:選手|打者)(?:だけ)?に(?:頼っている|頼る|依存している)/g,'選手間の打撃成績に数値差がある')
      .replace(/(?:上位|主力|特定の(?:選手|打者)|特定選手)(?:だけ)?に頼り(?:っ|つ)?きり[^。！？!?]*(?:[。！？!?]|$)/g,'選手間の打撃成績に数値差がある。')
      .replace(/(?:特定の(?:選手|打者)(?:だけ)?への)?依存/g,'打撃成績の数値差')
      .replace(/(?:上位|主力|特定選手)偏重/g,'打撃成績の数値差')
      .replace(/一部の選手に経験や負担が偏りがち(?:だ|です)?/g,'選手間で出場機会や記録量に差がある')
      .replace(/(?:一部|特定)(?:の)?選手(?:に|へ|への).{0,18}負担.{0,12}(?:集中|偏(?:る|り|って|りがち))/g,'選手間の出場機会の差')
      .replace(/負担.{0,12}(?:集中|偏(?:る|り|って|りがち)).{0,18}(?:一部|特定)(?:の)?選手/g,'選手間の出場機会の差')
      .replace(/特定(?:の)?選手への負担集中/g,'選手間の出場機会の差')
      .replace(/(?:試合に出ていない|試合に出場していない|出場していない)選手(?:たち)?/g,'出場記録の少ない選手');

    const ungroundedOffense=/(?:打撃成績.{0,24}(?:偏り|数値差)|(?:この|その)?偏り|数値差|打率の差|低打率)[^。！？!?]{0,85}(?:攻撃力|得点力|攻撃.{0,12}(?:選択肢|手段|幅)|得点.{0,12}(?:ルート|機会|選択肢))[^。！？!?]{0,70}(?:制限|制約|狭め|減ら|下げ|低下|影響|左右|直結|つなが|繋が|結びつ)/
      .test(raw);
    if(ungroundedOffense
      && !/(?:断定(?:しない|しません|できない|できません)|確認できない|未確認|とは言えない|根拠がない)/.test(raw))
      return '確認済みの打撃成績には選手間の数値差がある。';

    if(developmentAdvice.test(raw))return '';
    // TEAM_REVIEW cannot call a team over-reliant on certain players from
    // individual statistics alone. Replace such a claim with its evidence limit.
    if(/頼り(?:すぎ|過ぎ)/.test(raw)
      && !/(?:断定(?:しない|しません|できない|できません)|確認できない|根拠がない)/.test(raw))
      return '確認済みの個別記録だけでは、特定選手への依存は断定できない。';

    // Reject standalone tactical/scoring rhetoric even if the sample-size
    // description was in a previous sentence. Preserve only the evidence limit.
    const standaloneTactical=/(?:勝負.{0,12}分かれ道|勝ちへの道|勝ちに(?:つな|繋)げ|生産力|戦術上.{0,18}(?:重要|ポイント)|実戦上.{0,16}課題|攻撃.{0,16}硬直)/;
    if(standaloneTactical.test(raw)&&!/(?:偏り|差|集中|濃淡|生産力)/.test(raw)&&!/(?:断定(?:しない|しません|できない|できません)|確認できない|根拠がない)/.test(raw))
      return '確認済みの個別記録から、チーム全体の得点・戦術効果までは断定できない。';

    if(/(?:特定.{0,24}(?:選手|打者).{0,32}(?:調子|打撃).{0,32}(?:得点|勝敗).{0,20}左右|得点.{0,24}左右されるリスク)/.test(raw))return '';

    if(/(?:偏り|差|集中|濃淡|生産力)/.test(raw)&&/(?:勝ちへの道|勝ちに(?:つな|繋)げ|攻撃.{0,12}(?:硬直|硬直化)|実戦上.{0,12}課題|勝つため|勝負だ|戦術(?:的)?な?.{0,12}(?:制約|問題|リスク)|戦術上.{0,18}(?:重要|ポイント)|得点.{0,20}左右|左右されるリスク|生産力)/.test(raw)){
      return '確認済みの打撃成績には選手間の数値差がある。';
    }

    if(individualBattingCue.test(raw)&&teamOutcomeCue.test(raw)){
      const exactCount=raw.match(/直近\s*6\s*試合[^。！？!?]*?([0-9]+)選手が(?:安打0|無安打)/);
      if(exactCount)return `直近6試合で${exactCount[1]}選手が安打0であることは確認できる。`;
      if(/直近\s*6\s*試合/.test(raw)&&/(?:複数|一部の選手)/.test(raw))return '直近6試合で複数の選手が無安打または打率.000であることは確認できる。';
      return '確認済みの個別打撃記録には選手間の差がある。';
    }

    if(spreadLike.test(raw)&&spreadOverclaim.test(raw)){
      const usage=/(?:出場機会|打数|起用)/.test(raw);
      const batting=/(?:打撃|打線|打率|OPS|安打|上位|下位)/.test(raw);
      const recent=/直近\s*6\s*試合/.test(raw)&&/(?:無安打|安打が出ていない|安打0)/.test(raw);
      if(batting&&recent)return '確認済みの打撃成績には選手間の数値差があり、直近6試合で無安打の選手が複数確認されている。';
      if(usage)return '確認済みの出場機会や打数には選手間の差がある。';
      if(batting)return '確認済みの打撃成績には選手間の数値差がある。';
      return '確認済み記録には選手間の数値差がある。';
    }
    return raw;
  };

  const rewrite=value=>String(value||'').split(/(?<=[。！？!?])/).map(rewriteOne).filter(Boolean).join('');
  const cleanArray=value=>(Array.isArray(value)?value:[]).map(rewrite).filter(Boolean);
  result.facts=cleanArray(result.facts);
  result.analysis=cleanArray(result.analysis);
  result.prediction=[];
  result.primaryReason=rewrite(result.primaryReason);
  result.publicStatement=rewrite(result.publicStatement);
  result.warnings=cleanArray(result.warnings);
  if(!String(result.primaryReason||'').trim())result.primaryReason='確認済み記録と解釈を分け、現在確認できる事実だけを評価する。';
  if(!String(result.publicStatement||'').trim())result.publicStatement='確認済み記録には選手間の差があります。ただし、その差だけでチーム全体の弱点や因果関係までは断定しません。';
  result.warnings=[...new Set([...(Array.isArray(result.warnings)?result.warnings:[]),'TEAM_REVIEWでは、確認済み記録と解釈を分け、数値差だけから弱点・因果・将来影響を断定しません。'])];
  return true;
}

function recoverSoftForecastLanguage(result, issues) {
  const list = Array.isArray(issues) ? issues.map(v => String(v || '')) : [];
  if (!list.length || !list.every(v => /(?:将来|不確実性|保証できない結果)/.test(v))) return false;

  const unsupportedFuture = value => {
    const s=String(value||'');
    return isHardOutcomeGuarantee(s)||hasUnhedgedOutcomePrediction(s);
  };
  const cleanText=value=>{
    const raw=String(value||'').trim();
    if(!raw)return '';
    return raw.split(/(?<=[。！？!?])/).map(s=>s.trim()).filter(Boolean).filter(s=>!unsupportedFuture(s)).join('');
  };
  const cleanArray=value=>(Array.isArray(value)?value:[]).map(cleanText).filter(Boolean);

  result.facts=cleanArray(result.facts);
  result.analysis=cleanArray(result.analysis);
  result.prediction=cleanArray(result.prediction);
  result.warnings=cleanArray(result.warnings);
  for(const key of ['candidateBasis','primaryReason','publicStatement','changeReason','reviewReason']){
    result[key]=cleanText(result?.[key]);
  }
  if(!String(result.primaryReason||'').trim())result.primaryReason='確認済みEvidenceの範囲だけで現在の判断を行います。';
  if(!String(result.publicStatement||'').trim())result.publicStatement='将来結果は断定しません。確認済みEvidenceの比較だけで判断します。';
  result.warnings=[...new Set([...(Array.isArray(result.warnings)?result.warnings:[]),'将来結果はEvidenceから確認できないため、判断根拠にせず断定しません。'])];
  return true;
}

export function sanitizeKnownSelectionProse(result, caseData, {allowGenericSelection=false}={}) {
  const selectionKind=String(caseData?.selectionKind||caseData?.evidence?.selectionKind||'').toUpperCase();
  // Generic current-player selection has the same Evidence boundaries, but
  // enable this sanitation only after the exact CASPER development/dependency
  // guard has rejected a draft. Regular generic requests are unchanged.
  const isGenericRecovery=allowGenericSelection
    && String(caseData?.mode||'').toLowerCase()==='selection'
    && (!selectionKind||selectionKind==='GENERIC_SELECTION');
  if(!['PITCHING_ROLE','BATTING_ORDER'].includes(selectionKind)&&!isGenericRecovery)return false;

  const evidenceText=JSON.stringify(caseData?.evidence||{});
  const question=String(caseData?.question||'');
  const developmentRequested=/(?:半年後|来年|将来|育成|成長|経験を積ませ|選手層|投手層)/.test(question);
  const hasDependencyEvidence=/(?:依存|頼り|役割集中)/.test(evidenceText);
  const hasBurdenEvidence=/(?:負担.{0,10}(?:大きい|大きすぎる|重い|過大|過度|集中|蓄積)|過度な負担|負担集中|蓄積疲労|疲労蓄積|コンディション.{0,16}(?:負担|影響))/.test(evidenceText);
  const hasPressureEvidence=/(?:競った場面|高圧場面|プレッシャー|勝負どころ|重要な場面|高レバレッジ)/.test(evidenceText);

  const pitchingStability=sentence=>
    /(?:防御率|WHIP|登板|投球回|イニング).{0,45}(?:安定(?:した|して|感)|信頼でき|信頼性|任せられ)/.test(sentence)
    ||/(?:安定(?:した|して|感)|信頼でき|信頼性|任せられ).{0,45}(?:防御率|WHIP|登板|投球回|イニング)/.test(sentence)
    ||/(?:長い|多くの?)イニング.{0,18}(?:任せ|投げら|投げ切)/.test(sentence);
  const pressureInference=sentence=>
    /(?:セーブ|締める実績|終盤).{0,42}(?:競った場面|高圧場面|プレッシャー|勝負どころ|重要な場面)/.test(sentence)
    ||/(?:競った場面|高圧場面|プレッシャー|勝負どころ|重要な場面).{0,42}(?:セーブ|締める実績|終盤)/.test(sentence);
  const probability=sentence=>/(?:確率的優位|勝利の確率|勝率を高め|勝てる確率|成功確率|勝利確率|勝利に直結|勝ちに直結|勝ち筋|勝ちパターン|勝ちへの道)/.test(sentence);
  const hasExplicitSlotContinuity=/(?:3番|打順).{0,30}(?:固定|継続|維持|方針)|(?:固定|継続|維持).{0,30}(?:3番|打順)/.test(evidenceText);
  const hasExplicitFormObservation=/(?:勢い|低調|好調|不調|状態の波|調子.{0,12}(?:良|悪|落)|安定した打撃)/.test(evidenceText);
  const battingTactics=sentence=>
    /(?:3番|打順|起用|打率|AVG|OPS|役割).{0,90}(?:戦術的に最も安定|戦術.{0,24}(?:裏付け|安定|合致)|最も確実な選択肢|定着度が高い|役割が定着|打順の軸.{0,12}安定|3番.{0,18}経験値|実戦経験.{0,18}(?:豊富|蓄積)|ポジション適性.{0,18}(?:豊富|高い)|チームの形.{0,18}馴染)/.test(sentence)
    ||/(?:戦術的に最も安定|戦術.{0,24}(?:裏付け|安定|合致)|最も確実な選択肢|定着度が高い|役割が定着|打順の軸.{0,12}安定|3番.{0,18}経験値|実戦経験.{0,18}(?:豊富|蓄積)|ポジション適性.{0,18}(?:豊富|高い)|チームの形.{0,18}馴染).{0,90}(?:3番|打順|起用|打率|AVG|OPS|役割)/.test(sentence)
    ||/(?:最も確実な選択肢|ポジション適性.{0,18}(?:豊富|高い)|定着度が高い|役割が定着|打順の軸.{0,12}安定|3番.{0,18}経験値|実戦経験.{0,18}(?:豊富|蓄積))/.test(sentence)
    ||(!hasExplicitSlotContinuity&&/(?:3番|打順|起用実績|スタメン|7試合|実績).{0,90}(?:固定されて|固定する|継続起用|継続する|打順の継続性|崩す理由にはなら|チームの形.{0,18}馴染|戦術.{0,24}合致|その位置に置く.{0,18}確実|選択.{0,18}確実|チームの安定.{0,18}(?:つなが|可能性))|(?:他の記録が示されない限り|他の記録がない限り).{0,48}(?:判断|選択).{0,24}(?:変更|変える).{0,16}(?:理由は(?:ない|ありません)|必要は(?:ない|ありません))/.test(sentence))
    ||(!hasExplicitFormObservation&&/(?:直近|打率|OPS|打撃成績|数値).{0,70}(?:勢い.{0,18}(?:落|陰り)|低調(?:な状態)?|状態の波|安定した打撃|安定して残|調子.{0,12}(?:良|悪|落))/.test(sentence))
    ||/(?:打順|起用).{0,50}(?:変える|変動|頻繁に変).{0,60}(?:全体の)?(?:つながり|連携).{0,24}(?:影響|崩|悪化)/.test(sentence);
  const development=sentence=>/(?:成長機会|育成|チームの成長|チーム全体の成長|チーム全体.{0,20}負担|チーム全体で.{0,20}経験|役割の分散|今後.{0,18}(?:成長|育成)|(?:大切に)?育てて|育てる|調整の過程|経験を積んでいく|負担をかけすぎ|役割集中.{0,28}(?:成長|育成|影響)|半年後|将来.{0,18}成長|将来(?:的)?な.{0,18}(?:チーム|投手層|選手層)|投手層.{0,18}(?:厚み|広げ)|選手層.{0,18}(?:厚み|広げ)|他の投手.{0,24}成長|別の投手.{0,24}成長|成長も促|選手全体.{0,20}成長|(?:固定|継続起用).{0,40}経験機会.{0,25}(?:影響|制限|狭め|減)|選手(?:たち)?の成長)/.test(sentence);
  const dependency=sentence=>/(?:過度な)?依存|頼りすぎ|頼り切/.test(sentence);
  const burden=sentence=>/(?:負担(?:が|は|も)?(?:大きい|大きすぎる|重い|過大|過度|集中)|過度な負担|負担集中|特定の選手への負担|特定の選手に負担|蓄積疲労|疲労蓄積|疲労(?:や|と|・)?負担.{0,8}蓄積|(?:疲労|負担).{0,8}(?:蓄積|積み重な)|コンディション.{0,20}負担)/.test(sentence);

  const unsafe=sentence=>
    (selectionKind==='PITCHING_ROLE' && pitchingStability(sentence))
    ||(selectionKind==='PITCHING_ROLE' && !hasPressureEvidence && pressureInference(sentence))
    ||(selectionKind==='PITCHING_ROLE' && probability(sentence))
    ||(selectionKind==='BATTING_ORDER' && battingTactics(sentence))
    ||(!developmentRequested && development(sentence))
    ||(!hasDependencyEvidence && dependency(sentence))
    ||(!hasBurdenEvidence && burden(sentence));

  const cleanText=value=>String(value||'').split(/(?<=[。！？!?])/).map(s=>s.trim()).filter(Boolean).filter(s=>!unsafe(s)).join('');
  const cleanArray=value=>(Array.isArray(value)?value:[]).map(cleanText).filter(Boolean);
  const before=JSON.stringify({
    facts:result?.facts,analysis:result?.analysis,prediction:result?.prediction,warnings:result?.warnings,
    candidateBasis:result?.candidateBasis,primaryReason:result?.primaryReason,publicStatement:result?.publicStatement,
    changeReason:result?.changeReason,reviewReason:result?.reviewReason
  });

  result.facts=cleanArray(result.facts);
  result.analysis=cleanArray(result.analysis);
  result.prediction=cleanArray(result.prediction);
  result.warnings=cleanArray(result.warnings);
  for(const key of ['candidateBasis','primaryReason','publicStatement','changeReason','reviewReason'])result[key]=cleanText(result?.[key]);

  const after=JSON.stringify({
    facts:result?.facts,analysis:result?.analysis,prediction:result?.prediction,warnings:result?.warnings,
    candidateBasis:result?.candidateBasis,primaryReason:result?.primaryReason,publicStatement:result?.publicStatement,
    changeReason:result?.changeReason,reviewReason:result?.reviewReason
  });
  return before!==after;
}

export function recoverSoftSelectionInference(result, issues, caseData, {focused=false}={}) {
  const list=Array.isArray(issues)?issues.map(v=>String(v||'')):[];
  const selectionSoft=v=>v.includes('PITCHING_ROLEで投手数値から安定・信頼・長いイニング適性を断定')
    ||v.includes('PITCHING_ROLEでセーブ実績から高圧・競った場面の経験を推定')
    ||v.includes('PITCHING_ROLEでEvidenceにない勝利・成功確率を主張')
    ||v.includes('BATTING_ORDERで実打順・打撃数値から戦術的安定性を断定')
    ||v.includes('BATTING_ORDERで起用回数から固定・継続優位・戦術適合を推定')
    ||v.includes('BATTING_ORDERで打撃数値の変化を勢い・低調・安定などの状態評価へ変換')
    ||v.includes('BATTING_ORDERで打順変更からチームのつながり・連携への因果を推定')
    ||v.includes('BATTING_ORDERで現在Evidenceを再比較せず判断変更不要を断定')
    ||v.includes('SELECTIONでEvidenceにない成長・育成・負担影響を追加')
    ||v.includes('SELECTIONでEvidenceにない依存・役割集中を追加');
  const burdenSoft=v=>v.includes('Evidenceの「負担を考慮する必要がある」を、負担の大きさや具体的悪影響の断定へ強めている');
  const forecastSoft=v=>/(?:将来|不確実性|保証できない結果)/.test(v);
  if(!list.length||!list.some(selectionSoft)||!list.every(v=>selectionSoft(v)||burdenSoft(v)||forecastSoft(v)))return false;
  const snapshot=JSON.parse(JSON.stringify(result||{}));
  const hasGenericCasperGroundingIssue=list.some(v=>
    v.includes('SELECTIONでEvidenceにない成長・育成・負担影響を追加')
    ||v.includes('SELECTIONでEvidenceにない依存・役割集中を追加'));
  sanitizeKnownSelectionProse(result,caseData,{allowGenericSelection:hasGenericCasperGroundingIssue});
  const burdenIssues=list.filter(burdenSoft);
  if(burdenIssues.length&&!recoverSoftBurdenEscalation(result,burdenIssues)){
    for(const key of Object.keys(result))delete result[key];
    Object.assign(result,snapshot);
    return false;
  }
  const forecastIssues=list.filter(forecastSoft);
  if(forecastIssues.length&&!recoverSoftForecastLanguage(result,forecastIssues)){
    for(const key of Object.keys(result))delete result[key];
    Object.assign(result,snapshot);
    return false;
  }
  if(!String(result.primaryReason||'').trim())result.primaryReason='確認済みの数値・実起用・役割実績の範囲だけで候補を比較する。';
  if(!String(result.publicStatement||'').trim())result.publicStatement='確認済みEvidenceの範囲だけで候補を比較します。';
  const remaining=validatePersonaOutput(caseData,result,{focused});
  if(remaining.length){
    for(const key of Object.keys(result))delete result[key];
    Object.assign(result,snapshot);
    return false;
  }
  return true;
}

export function recoverSoftPersonaBatchValidation(result, issues, caseData=null, {focused=false}={}) {
  const snapshot=JSON.parse(JSON.stringify(result||{}));
  const list = Array.isArray(issues) ? issues.map(v => String(v || '')) : [];
  const isTeamReviewSoft = v => v.includes('TEAM_REVIEWで打撃成績の偏りから依存・頼り・偏重を断定')
    || v.includes('TEAM_REVIEWで起用差から負担集中を断定')
    || v.includes('TEAM_REVIEWでEvidenceにない未出場選手を前提')
    || v.includes('TEAM_REVIEWで数値差・偏りをチーム全体の弱点・戦術・育成影響へ拡張')
    || v.includes('TEAM_REVIEWで個別打撃結果からチーム得点・戦術への因果を断定')
    || v.includes('TEAM_REVIEWで個別打撃の偏りからチーム攻撃力への未確認の効果を主張')
    || v.includes('TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加');
  const isBurdenSoft = v => v.includes('Evidenceの「負担を考慮する必要がある」を、負担の大きさや具体的悪影響の断定へ強めている');
  const isForecastSoft = v => /(?:将来|不確実性|保証できない結果)/.test(v);

  if (!list.length || !list.every(v => isTeamReviewSoft(v) || isBurdenSoft(v) || isForecastSoft(v))) return false;

  const teamReviewIssues = list.filter(isTeamReviewSoft);
  const burdenIssues = list.filter(v => isBurdenSoft(v) && !isTeamReviewSoft(v));
  const forecastIssues = list.filter(v => isForecastSoft(v) && !isTeamReviewSoft(v) && !isBurdenSoft(v));

  if (teamReviewIssues.length && !recoverSoftTeamReviewDependency(result, teamReviewIssues)) return false;
  if (burdenIssues.length && !recoverSoftBurdenEscalation(result, burdenIssues)) return false;
  if (forecastIssues.length && !recoverSoftForecastLanguage(result, forecastIssues)) return false;
  // TEAM_REVIEW often produces the unsupported burden and future-effect claim in
  // the same sentence. Run one final sentence-level cleanup for the exact guard
  // classes already identified above before re-validating. Do not touch hard
  // evidence, numeric, roster, or structural failures.
  if (teamReviewIssues.length) {
    const unsafeTeamReviewSentence = sentence =>
      /(?:負担.{0,12}(?:集中|偏(?:る|り|って|りがち))|経験や負担.{0,12}(?:集中|偏(?:る|り|って|りがち)))/.test(sentence)
      || hasUnhedgedOutcomePrediction(sentence)
      || isHardOutcomeGuarantee(sentence);
    const cleanTeamText=value=>String(value||'').split(/(?<=[。！？!?])/).map(s=>s.trim()).filter(Boolean).filter(s=>!unsafeTeamReviewSentence(s)).join('');
    const cleanTeamArray=value=>(Array.isArray(value)?value:[]).map(cleanTeamText).filter(Boolean);
    result.facts=cleanTeamArray(result.facts);
    result.analysis=cleanTeamArray(result.analysis);
    result.prediction=cleanTeamArray(result.prediction);
    result.warnings=cleanTeamArray(result.warnings);
    for(const key of ['candidateBasis','primaryReason','publicStatement','changeReason','reviewReason'])result[key]=cleanTeamText(result?.[key]);
    if(!String(result.primaryReason||'').trim())result.primaryReason='確認済み記録と解釈を分け、現在確認できる事実だけを評価する。';
    if(!String(result.publicStatement||'').trim())result.publicStatement='確認済み記録には選手間の差があります。ただし、その差だけで負担集中や将来影響までは断定しません。';
  }
  if(caseData){
    let remaining=validatePersonaOutput(caseData,result,{focused});
    if(remaining.length && teamReviewIssues.length && remaining.every(v=>isTeamReviewSoft(String(v))||isBurdenSoft(String(v))||isForecastSoft(String(v)))){
      // Second-stage fail-safe for current TEAM_REVIEW prose only. Preserve no
      // causal story: direct team facts are reintroduced deterministically by FINAL.
      result.facts=[];
      result.analysis=[];
      result.prediction=[];
      result.candidatePlayers=[];
      result.candidateBasis='';
      result.primaryReason='確認済み記録だけでは、数値差からチーム全体の弱点・戦術的制約・得点依存までは断定できない。';
      result.publicStatement='確認済み記録にある数値差や個別結果は事実として扱います。ただし、その差だけでチーム全体の弱点や得点への因果までは断定しません。';
      result.warnings=['TEAM_REVIEWでは数値差だけから弱点・因果・将来影響を断定しません。'];
      result.reviewRequested=false;
      result.reviewReason='';
      result.dataConflict=false;
      result.judgment='BLUE';
      result.confidence='MEDIUM';
      remaining=validatePersonaOutput(caseData,result,{focused});
    }
    if(remaining.length){
      for(const key of Object.keys(result))delete result[key];
      Object.assign(result,snapshot);
      return false;
    }
  }
  return true;
}

export function recoverMismatchedSelectionMetricSentences(result, issues, caseData, {focused=false}={}) {
  const list=Array.isArray(issues)?issues.map(v=>String(v||'')):[];
  const selectionKind=String(caseData?.selectionKind||caseData?.evidence?.selectionKind||'').toUpperCase();
  if(!selectionKind||selectionKind==='TEAM_REVIEW'||selectionKind==='FULL_LINEUP')return false;

  const parsed=list.map(issue=>{
    const m=issue.match(/^(登板数|投球回|奪三振|与四球|与死球|防御率|WHIP|セーブ)([-+]?\d+(?:\.\d+)?) は supplied CASE\/EVIDENCE の \1 値と一致しない$/i);
    return m?{label:m[1],value:m[2]}:null;
  });
  if(!list.length||parsed.some(v=>!v))return false;

  const snapshot=JSON.parse(JSON.stringify(result||{}));
  const labelPattern={
    '登板数':'(?:登板(?:数)?|試合(?:に)?登板)',
    '投球回':'(?:投球回(?:数)?|イニング)',
    '奪三振':'(?:奪三振(?:数)?)',
    '与四球':'(?:与四球(?:数)?|四球(?:数)?)',
    '与死球':'(?:与死球(?:数)?)',
    '防御率':'(?:防御率)',
    'WHIP':'(?:WHIP)',
    'セーブ':'(?:セーブ(?:数)?)'
  };
  const unsafe=sentence=>parsed.some(({label,value})=>{
    const escaped=String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const lp=labelPattern[label]||label;
    const reA=new RegExp(lp+'.{0,10}'+escaped+'(?![0-9.])','i');
    const reB=new RegExp(escaped+'(?![0-9.]).{0,10}'+lp,'i');
    return reA.test(sentence)||reB.test(sentence);
  });
  const cleanText=value=>String(value||'').split(/(?<=[。！？!?])/).map(s=>s.trim()).filter(Boolean).filter(s=>!unsafe(s)).join('');
  const cleanArray=value=>(Array.isArray(value)?value:[]).map(cleanText).filter(Boolean);

  result.facts=cleanArray(result.facts);
  result.analysis=cleanArray(result.analysis);
  result.prediction=cleanArray(result.prediction);
  result.warnings=cleanArray(result.warnings);
  for(const key of ['candidateBasis','primaryReason','publicStatement','changeReason','reviewReason'])result[key]=cleanText(result?.[key]);
  if(!String(result.primaryReason||'').trim())result.primaryReason='確認済みEvidenceと一致する数値だけを判断材料にする。';
  if(!String(result.publicStatement||'').trim())result.publicStatement='確認済みEvidenceと一致する記録だけで候補を比較します。';
  result.warnings=[...new Set([...(Array.isArray(result.warnings)?result.warnings:[]),'数値はEvidenceと一致する記録だけを使用します。'])];

  const remaining=validatePersonaOutput(caseData,result,{focused});
  if(remaining.length){
    for(const key of Object.keys(result))delete result[key];
    Object.assign(result,snapshot);
    return false;
  }
  return true;
}
export function recoverUnsupportedComponentMetricLabels(result, issues, caseData, { focused=false }={}) {
  const list=Array.isArray(issues)?issues.map(v=>String(v||'')):[];
  const unsupportedMetricIssue=v=>v.includes('Evidenceにない長打率を、存在する指標として述べている')
    ||v.includes('Evidenceにない出塁率を、存在する指標として述べている');
  if(!list.length||!list.every(unsupportedMetricIssue))return false;

  const forbidden=/(?:出塁率|長打率)/;
  const numericMetric=/(?:出塁率|長打率).{0,16}[0-9０-９]|[0-9０-９].{0,16}(?:出塁率|長打率)/;
  const outputFields=[
    ...(Array.isArray(result?.facts)?result.facts:[]),
    ...(Array.isArray(result?.analysis)?result.analysis:[]),
    ...(Array.isArray(result?.prediction)?result.prediction:[]),
    ...(Array.isArray(result?.warnings)?result.warnings:[]),
    result?.candidateBasis,result?.primaryReason,result?.publicStatement,result?.reviewReason,result?.changeReason
  ].map(v=>String(v||'')).filter(Boolean);
  if(outputFields.some(v=>numericMetric.test(v)))return false;

  const snapshot=JSON.parse(JSON.stringify(result||{}));
  const cleanText=value=>{
    const raw=String(value||'').trim();
    if(!raw||!forbidden.test(raw))return raw;
    return raw.split(/(?<=[。！？!?])/).map(s=>s.trim()).filter(Boolean).filter(s=>!forbidden.test(s)).join('');
  };
  const cleanArray=value=>(Array.isArray(value)?value:[]).map(cleanText).filter(Boolean);
  result.facts=cleanArray(result.facts);
  result.analysis=cleanArray(result.analysis);
  result.prediction=cleanArray(result.prediction);
  result.warnings=cleanArray(result.warnings);
  const firstCandidate=Array.isArray(result?.candidatePlayers)?String(result.candidatePlayers[0]||'').trim():'';
  const genericFallback=firstCandidate
    ? `${firstCandidate}を第一候補とします。比較はCASE.evidenceに明示された指標だけを使います。`
    : 'CASE.evidenceに明示された指標だけを判断根拠にします。';
  for(const key of ['candidateBasis','primaryReason','publicStatement','reviewReason','changeReason']){
    const before=String(result?.[key]||'').trim();
    const cleaned=cleanText(before);
    result[key]=cleaned||(before?genericFallback:'');
  }
  result.warnings=[...new Set([...(Array.isArray(result.warnings)?result.warnings:[]),'CASE.evidenceに明示された指標だけを判断根拠にします。'])];

  const remaining=validatePersonaOutput(caseData,result,{focused});
  if(remaining.length){
    for(const key of Object.keys(result))delete result[key];
    Object.assign(result,snapshot);
    return false;
  }
  return true;
}


function normalizeCaseRosterHonorifics(value, caseData){
  const normalized=canonicalizePlayerData(value);
  const question=String(caseData?.question||'');
  const referencedSurnames=[...new Set(CURRENT_ROSTER.filter(name=>question.includes(name)).map(name=>name.split(' ')[0]).filter(Boolean))];
  if(!referencedSurnames.length)return normalized;
  const escape=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const cleanString=input=>{
    let out=String(input??'');
    for(const surname of referencedSurnames){
      out=out.replace(new RegExp(escape(surname)+'(?:くん|君)','g'),surname);
    }
    return out;
  };
  const walk=input=>{
    if(Array.isArray(input))return input.map(walk);
    if(input&&typeof input==='object')return Object.fromEntries(Object.entries(input).map(([k,v])=>[k,walk(v)]));
    return typeof input==='string'?cleanString(input):input;
  };
  return walk(normalized);
}
export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);
    const requestedPhase = String(body?.phase || 'PRIMARY').toUpperCase();
    if (requestedPhase === 'FULL') return sendJson(res, 410, { error:'FULL batch experiment is retired', code:'PERSONA_FULL_BATCH_RETIRED', retryExhausted:true });
    const phase = ['PRIMARY','SECOND'].includes(requestedPhase) ? requestedPhase : 'PRIMARY';
    if (!validPersonaCase(body)) return sendJson(res, 400, { error: 'CASE is missing or invalid' });
    if (phase === 'SECOND' && (!body?.primary || !body?.crossExamination)) {
      return sendJson(res, 400, { error: 'SECOND batch requires isolated PRIMARY and cross-examination compartments' });
    }
    if (phase === 'FULL') {
      // FULL is intentionally fail-closed until the one-call response schema can
      // carry both PRIMARY and SECOND while preserving the deterministic CROSS.
      // Build the authoritative CROSS capability here first so FULL never invents
      // a second, divergent cross-examination implementation.
      const fullLineupCase = /(?:ベストオーダー|打順|オーダー|ラインナップ)/.test(String(body.case?.question || '')) && /(?:1番|１番|守備位置|ポジション|1.?9番|１.?９番)/.test(String(body.case?.question || ''));
      const crossBuilder = fullLineupCase
        ? deterministicFullLineupCross
        : (isSelectionCase(body.case) ? deterministicSelectionCross : null);
      if (!crossBuilder) {
        return sendJson(res, 400, {
          error: 'FULL batch is not supported for this case type yet',
          code: 'PERSONA_FULL_BATCH_UNSUPPORTED_CASE'
        });
      }
      // FULL shares the same CASE/roster/evidence across all three personas.
      // Do not repeat that large payload three times: send one authoritative
      // shared context plus only the persona-specific role/instruction.
      const builtPrimary = Object.fromEntries(PERSONAS.map(persona => {
        const { payload } = buildPersonaRequest(body, persona, 'PRIMARY');
        return [persona, payload];
      }));
      const sharedPrimary = builtPrimary.melchior;
      const primaryRequests = Object.fromEntries(PERSONAS.map(persona => [
        persona,
        {
          personaRole: PERSONA_PROMPTS[persona],
          instruction: builtPrimary[persona].instruction
        }
      ]));
      // A single model response cannot literally execute server code between its
      // PRIMARY and SECOND fields. Therefore FULL remains experimental and its
      // SECOND fields are not publishable until the server can reconstruct the
      // canonical CROSS from returned PRIMARY and verify that each SECOND is
      // consistent with that exact challenge.
      const rawFull = await callGemini({
        systemInstruction: batchSystemInstruction('FULL'),
        userPayload: {
          phase: 'FULL',
          sharedContext: {
            temporalContext: sharedPrimary.temporalContext,
            authoritativeCurrentRoster: sharedPrimary.authoritativeCurrentRoster,
            historicalWeightingRule: sharedPrimary.historicalWeightingRule,
            case: sharedPrimary.case
          },
          primaryPersonas: primaryRequests,
          crossPolicy: fullLineupCase ? 'CANONICAL_FULL_LINEUP_CROSS' : 'CANONICAL_SELECTION_CROSS',
          secondRule: 'SECOND is provisional. The server will reject it unless it matches the canonical CROSS reconstructed from PRIMARY.'
        },
        responseSchema: FULL_BATCH_SCHEMA
      });
      if (!rawFull?.primary || !rawFull?.second) {
        return sendJson(res, 503, { error:'FULL batch response is incomplete', code:'PERSONA_FULL_BATCH_INCOMPLETE', retryExhausted:true });
      }
      const primary = {};
      for (const persona of PERSONAS) {
        const finalized = finalizePersonaDraft(body, persona, 'PRIMARY', inflateFullDraft(rawFull.primary?.[persona], persona, 'PRIMARY'));
        if (!rawFull.primary?.[persona] || finalized.guardIssues.length || finalized.result.reviewRequested === true) {
          return sendJson(res, 503, { error:'FULL PRIMARY failed validation', code:'PERSONA_FULL_PRIMARY_VALIDATION_FAILED', persona:persona.toUpperCase(), retryExhausted:true });
        }
        primary[persona] = finalized.result;
      }
      const cross = crossBuilder(primary);
      if (!cross) {
        return sendJson(res, 503, { error:'FULL canonical CROSS could not be constructed', code:'PERSONA_FULL_CROSS_FAILED', retryExhausted:true });
      }
      const second = {};
      for (const persona of PERSONAS) {
        const challengeToSelf = Array.isArray(cross?.challenges?.[persona]) ? cross.challenges[persona] : [];
        if (!challengeToSelf.length) {
          return sendJson(res, 503, { error:'FULL canonical CROSS has no persona challenge', code:'PERSONA_FULL_CROSS_INCOMPLETE', persona:persona.toUpperCase(), retryExhausted:true });
        }
        const secondBody = {
          ...body,
          primarySelf: primary[persona],
          crossExamination: {
            ...cross,
            challengeToSelf,
            challengeTarget: persona.toUpperCase(),
            independenceRule:'他の2人格と同じ結論に合わせる必要はない。違いを作るためだけに変えてもいけない。一次案とEvidenceを自分の専門領域で再検証し、少なくとも1つの別案を比較したうえで、その案を採るか退けるかを自分で決めること。'
          }
        };
        const finalized = finalizePersonaDraft(secondBody, persona, 'SECOND', inflateFullDraft(rawFull.second?.[persona], persona, 'SECOND'));
        if (!rawFull.second?.[persona] || finalized.guardIssues.length || finalized.result.reviewRequested === true) {
          return sendJson(res, 503, { error:'FULL SECOND failed validation against canonical CROSS context', code:'PERSONA_FULL_SECOND_VALIDATION_FAILED', persona:persona.toUpperCase(), retryExhausted:true });
        }
        second[persona] = finalized.result;
      }
      // Structural validation now uses the exact server-reconstructed CROSS.
      // This still proves protocol-level, not separate-process, independence.
      return sendJson(res, 200, {
        experimental:true,
        publishable:false,
        isolationLevel:'PROTOCOL_LEVEL_SINGLE_PROVIDER_CALL',
        primary,
        cross,
        second
      });
    }

    const builtRequests = Object.fromEntries(PERSONAS.map(persona => {
      const isolatedBody = phase === 'SECOND'
        ? { case: body.case, primarySelf: body.primary?.[persona] || null, crossExamination: body.crossExamination?.[persona] || null }
        : body;
      return [persona, buildPersonaRequest(isolatedBody, persona, phase).payload];
    }));
    const shared = builtRequests.melchior || {};
    const sharedContext = {
      temporalContext: shared.temporalContext,
      authoritativeCurrentRoster: shared.authoritativeCurrentRoster,
      historicalWeightingRule: shared.historicalWeightingRule,
      ...(shared.standardDefenseEligibility ? { standardDefenseEligibility: shared.standardDefenseEligibility } : {}),
      case: shared.case
    };
    const personaRequests = Object.fromEntries(PERSONAS.map(persona => {
      const payload = builtRequests[persona] || {};
      return [persona, {
        personaRole: PERSONA_PROMPTS[persona],
        instruction: payload.instruction,
        ...(phase === 'SECOND' ? {
          ownPrimaryJudgment: payload.ownPrimaryJudgment || null,
          crossExamination: payload.crossExamination || null
        } : {})
      }];
    }));

    const raw = await callGemini({
      systemInstruction: batchSystemInstruction(phase),
      userPayload: {
        phase,
        sharedContext,
        isolationRule: phase === 'SECOND'
          ? 'Each persona receives the same sharedContext plus only its own PRIMARY and its own cross-examination compartment. Never cross-read persona compartments.'
          : 'Each persona receives the same sharedContext but must produce its own judgment without using another persona output.',
        personas: personaRequests
      },
      responseSchema: BATCH_SCHEMA
    });

    const out = {};
    for (const persona of PERSONAS) {
      if (!raw?.[persona] || typeof raw[persona] !== 'object') {
        return sendJson(res, 503, { error: phase + ' batch response is incomplete', code: 'PERSONA_BATCH_INCOMPLETE', retryExhausted: false });
      }
      const validationBody = phase === 'SECOND' ? { ...body, primarySelf: body.primary?.[persona] || null } : body;
      let personaRaw = raw[persona];
      let finalized = finalizePersonaDraft(validationBody, persona, phase, personaRaw);
      let { result, guardIssues } = finalized;

      // One model generation per batch phase. Extra correction generations can exceed the serverless request window.\n      // Soft prose issues may still be sanitized deterministically below; hard evidence guards remain fail-closed.\n\n      // Still fail closed after correction attempts. Deterministic evidence
      // validation remains authoritative; this does not weaken any guard.
      if (guardIssues.length
        && !recoverSoftPersonaBatchValidation(result, guardIssues, body.case, { focused: !finalized.candidateCase && !finalized.teamReviewCase })
        && !recoverSoftSelectionInference(result, guardIssues, body.case, { focused: !finalized.candidateCase && !finalized.teamReviewCase })
        && !recoverMismatchedSelectionMetricSentences(result, guardIssues, body.case, { focused: !finalized.candidateCase && !finalized.teamReviewCase })
        && !recoverUnsupportedComponentMetricLabels(result, guardIssues, body.case, { focused: !finalized.candidateCase && !finalized.teamReviewCase })
        && !recoverSoftFullLineupLanguage(result, guardIssues, finalized.fullLineupCase)
        && !recoverSoftPitchingPlanLanguage(result, guardIssues, finalized.pitchingPlanCase, body.case)) {
        return sendJson(res, 503, {
          error: phase + ' batch response failed persona validation',
          code: 'PERSONA_BATCH_VALIDATION_FAILED',
          persona: persona.toUpperCase(),
          retryExhausted: true,
          retryFreshRequest: false,
          retryScope: '',
          diagnostic: {
            guardIssueCount: guardIssues.length,
            guardIssueCodes: guardIssues.map((issue) => String(issue?.code || issue?.type || issue || 'UNKNOWN')).slice(0, 8)
          }
        });
      }
      if (result.reviewRequested === true) {
        return sendJson(res, 503, {
          error: phase + ' batch persona requires review',
          code: 'PERSONA_BATCH_REVIEW_REQUIRED',
          persona: persona.toUpperCase(),
          retryExhausted: true,
          retryFreshRequest: false,
          retryScope: ''
        });
      }
      if(finalized.candidateCase)sanitizeKnownSelectionProse(result,body.case);
      result=normalizeCaseRosterHonorifics(result,body.case);
      const publishIssues=validatePersonaOutput(body.case,result,{ focused: !finalized.candidateCase && !finalized.teamReviewCase });
      if(publishIssues.length){
        return sendJson(res,503,{
          error:phase+' batch sanitized persona failed final publish validation',
          code:'PERSONA_BATCH_FINAL_VALIDATION_FAILED',
          persona:persona.toUpperCase(),
          retryExhausted:true,
          retryFreshRequest:false,
          diagnostic:{guardIssueCount:publishIssues.length,guardIssueCodes:publishIssues.map(v=>String(v||'')).slice(0,8)}
        });
      }
      out[persona] = result;
    }
    return sendJson(res, 200, out);
  } catch (error) {
    console.error('[MAGI persona-batch]', error?.message || error);
    return safeTransient(res, error);
  }
}
