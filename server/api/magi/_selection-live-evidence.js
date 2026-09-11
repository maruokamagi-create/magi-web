import { CURRENT_ROSTER } from './_roster.js';
import { runDriveLiveAudit } from './_drive-live-audit.js';

export const SELECTION_LIVE_EVIDENCE_VERSION = 'selection-live-evidence-v1';

function text(v){ return String(v ?? '').trim(); }
function battingSlotQuestion(question){
  const q=text(question).normalize('NFKC');
  const slot=/(?:^|[^0-9])([1-9])番(?:打者)?/.test(q) || /打順|クリーンナップ|中軸/.test(q);
  const choice=/誰|だれ|どの|候補|いい|良い|最適|ベスト|決め|どうする|組んで|組む/.test(q);
  return slot && choice;
}
function hasNamedPlayer(routed){ return Array.isArray(routed?.players) && routed.players.length > 0; }
function display(v){ const s=text(v); return s || '—'; }

export function shouldBuildCurrentSelectionEvidence(question,routed={}){
  if(hasNamedPlayer(routed)) return false;
  const domains=Array.isArray(routed?.domains)?routed.domains:[];
  return battingSlotQuestion(question) || domains.includes('LINEUP');
}

function playerLine(name,entry){
  const b=entry?.batting||{};
  const parts=[];
  if(text(b.AVG)) parts.push(`打率 ${b.AVG}`);
  if(text(b.OPS)) parts.push(`OPS ${b.OPS}`);
  if(text(b.OBP)) parts.push(`出塁率 ${b.OBP}`);
  if(text(b.SLG)) parts.push(`長打率 ${b.SLG}`);
  if(text(b.AB)) parts.push(`打数 ${b.AB}`);
  if(text(b.H)) parts.push(`安打 ${b.H}`);
  if(text(b.RBI)) parts.push(`打点 ${b.RBI}`);
  if(text(b.SO)) parts.push(`三振 ${b.SO}`);
  if(text(b.BB)) parts.push(`四球 ${b.BB}`);
  if(text(b.HBP)) parts.push(`死球 ${b.HBP}`);
  if(text(b.SB)) parts.push(`盗塁 ${b.SB}`);
  return `${name}：${parts.length?parts.join(' / '):'打撃記録なし'}`;
}

export async function buildCurrentSelectionEvidence({question,routed={},auditProvider=runDriveLiveAudit}={}){
  if(!shouldBuildCurrentSelectionEvidence(question,routed)) return null;
  const audit=await auditProvider({season:'current'});
  const byName=audit?.extracted?.playersByName||{};
  const missing=CURRENT_ROSTER.filter(name=>!Object.prototype.hasOwnProperty.call(byName,name));
  if(missing.length) throw new Error(`現チーム14名の正本確認が未完了です: ${missing.join('、')}`);

  const players=CURRENT_ROSTER.map(name=>({
    name,
    batting: byName[name]?.batting ? {...byName[name].batting} : null,
    pitching: byName[name]?.pitching ? {...byName[name].pitching} : null
  }));
  const lines=[
    '【MAGI 現チーム正本データ】',
    `対象：${audit?.seasonLabel||'2026-2027現チーム'}`,
    `集計期間：${display(audit?.extracted?.periodStart)} ～ ${display(audit?.extracted?.periodEnd)}`,
    '【全14選手・打撃】',
    ...players.map(p=>playerLine(p.name,p)),
    '【運用ルール】全14選手を確認してから候補を選ぶ。ここにない数値・役割・性格・将来結果は作らない。打席数等の母数がない場合は、その不足を明示する。'
  ];

  return {
    count: players.length,
    files: audit?.source?.name ? [audit.source.name] : [],
    summary: '現チーム14名の正本XLSMから打撃記録を読み取り、打順候補選定用のEvidenceを構成しました。',
    text: lines.join('\n'),
    sources: audit?.source ? [{...audit.source}] : [],
    resolverVersion: SELECTION_LIVE_EVIDENCE_VERSION,
    scope: audit?.seasonLabel||'2026-2027現チーム',
    allCurrentTeamCheck:{status:'COMPLETE',players},
    dataRule:'ここにない数値・役割・選手・性格・将来結果は作らない'
  };
}
