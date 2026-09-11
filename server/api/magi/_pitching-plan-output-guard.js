import { isPitchingPlanQuestion } from './_pitching-plan.js';

function text(v){return String(v??'').trim();}
function sentenceParts(value){return String(value||'').split(/[。！？!?\n]+/).map(s=>s.trim()).filter(Boolean);}

function pitchingEvidencePlayers(caseData){
  const players=caseData?.evidence?.allCurrentTeamCheck?.players;
  return Array.isArray(players)?players:[];
}
function hasPitchingRecord(player){
  const p=player?.pitching;
  if(!p||typeof p!=='object')return false;
  return Object.values(p).some(v=>String(v??'').trim()!=='');
}
function pitchingRecordCount(caseData){return pitchingEvidencePlayers(caseData).filter(hasPitchingRecord).length;}
function factualEvidenceText(caseData){
  const evidence=caseData?.evidence||{};
  return JSON.stringify({
    allCurrentTeamCheck:evidence.allCurrentTeamCheck||null,
    historicalReference:evidence.historicalReference||null,
    currentTeam:evidence.currentTeam||null,
    oldTeam:evidence.oldTeam||null,
    gameEvidence:evidence.gameEvidence||null,
    roleEvidence:evidence.roleEvidence||null
  });
}
function thresholdEvidenceText(caseData){
  const evidence=caseData?.evidence||{};
  return JSON.stringify({
    sampleThreshold:evidence.sampleThreshold||null,
    roleSampleThreshold:evidence.roleSampleThreshold||null,
    thresholds:evidence.thresholds||null
  });
}

function personaText(result){
  return [
    result?.candidateBasis,
    ...(Array.isArray(result?.facts)?result.facts:[]),
    ...(Array.isArray(result?.analysis)?result.analysis:[]),
    result?.primaryReason,
    result?.publicStatement,
    ...(Array.isArray(result?.warnings)?result.warnings:[]),
    result?.reviewReason,
    result?.changeReason
  ].map(text).filter(Boolean).join('。');
}
function crossText(cross){
  const challenges=cross?.challenges||{};
  return [
    ...(Array.isArray(cross?.agreement)?cross.agreement:[]),
    ...(Array.isArray(cross?.disagreement)?cross.disagreement:[]),
    ...(Array.isArray(cross?.domainConflicts)?cross.domainConflicts:[]),
    ...(Array.isArray(cross?.warnings)?cross.warnings:[]),
    ...(Array.isArray(cross?.informationGaps)?cross.informationGaps:[]),
    ...(Array.isArray(challenges?.melchior)?challenges.melchior:[]),
    ...(Array.isArray(challenges?.balthasar)?challenges.balthasar:[]),
    ...(Array.isArray(challenges?.casper)?challenges.casper:[])
  ].map(text).filter(Boolean).join('。');
}

function validatePitchingPlanText(caseData,value){
  if(!isPitchingPlanQuestion(caseData))return[];
  const issues=[];
  const factual=factualEvidenceText(caseData);
  const thresholds=thresholdEvidenceText(caseData);
  const parts=sentenceParts(value);
  const actualPitchers=pitchingRecordCount(caseData);

  // A full-team evidence block lets us verify claims such as “only four pitchers have records”.
  if(actualPitchers>0){
    for(const sentence of parts){
      const match=sentence.match(/(?:投球記録|登板記録|記録)(?:が|の)?(?:確認できる|ある|存在する)?(?:投手|選手)?(?:が|は)?\s*([0-9]+)\s*人(?:しか|だけ|のみ)/);
      if(match&&Number(match[1])!==actualPitchers){
        issues.push(`投球記録がある選手数${match[1]}人はEvidenceの実数${actualPitchers}人と一致しない`);
      }
      const choiceMatch=sentence.match(/(?:この|現状の)?\s*([0-9]+)\s*人(?:以外|だけ|のみ).{0,18}(?:選択肢がない|選べない|構成するしかない)/);
      if(choiceMatch&&Number(choiceMatch[1])<actualPitchers){
        issues.push(`投球記録がある${actualPitchers}人を確認せず、${choiceMatch[1]}人しか選択肢がないと断定している`);
      }
    }
  }

  // Aggregate ERA/IP/APP do not establish consistency or stability by themselves.
  const hasStabilityEvidence=/(?:安定|安定性|継続性|ばらつき|試合別|登板別|標準偏差|連続.{0,8}(?:登板|試合))/.test(factual);
  if(!hasStabilityEvidence){
    const unsupported=parts.find(s=>/(?:安定している|安定した投球|安定感|安定した成績|安定した実績|安定して抑え)/.test(s));
    if(unsupported)issues.push('集計値だけから投球の安定性・再現性を事実として推定している');
  }

  // “Enough sample for this role” needs an explicit threshold/baseline in Evidence, not a policy sentence saying to consider sample size.
  const hasSampleThreshold=/(?:十分な母数|必要な母数|母数基準|サンプル基準|最低.{0,12}(?:登板|投球回)|(?:登板|投球回).{0,12}(?:基準|閾値|必要数))/.test(thresholds);
  if(!hasSampleThreshold){
    const unsupported=parts.find(s=>/(?:十分な母数(?:には)?達していない|母数が十分(?:で|では)ない|十分なサンプル(?:では|で)ない|(?:クローザー|先発|終盤|第?2投手).{0,28}(?:十分な母数|必要な母数))/.test(s));
    if(unsupported)issues.push('Evidenceに役割別の母数基準がないのに「十分な母数」の閾値を作っている');
  }

  // Role history/suitability is not encoded by generic pitching totals.
  const hasRoleEvidence=/(?:セーブ|クローザー.{0,12}(?:実績|起用|登板)|抑え.{0,12}(?:実績|起用|登板)|終盤.{0,12}(?:実績|起用|登板)|高レバレッジ|勝負どころ|プレッシャー)/.test(factual);
  if(!hasRoleEvidence){
    const unsupported=parts.find(s=>/(?:クローザー|抑え|終盤).{0,18}(?:適性がある|向いている|実績がある|経験が豊富|慣れている)/.test(s));
    if(unsupported)issues.push('一般投手成績だけから終盤・クローザーの役割適性や経験を推定している');
  }

  return [...new Set(issues)];
}

export function validatePitchingPlanPersonaOutput(caseData,result){
  return validatePitchingPlanText(caseData,personaText(result));
}
export function validatePitchingPlanCrossOutput(caseData,cross){
  return validatePitchingPlanText(caseData,crossText(cross));
}
