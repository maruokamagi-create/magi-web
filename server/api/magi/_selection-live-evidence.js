import { CURRENT_ROSTER } from './_roster.js';
import { runDriveLiveAudit } from './_drive-live-audit.js';
import { isFullLineupQuestion } from './_full-lineup.js';

export const SELECTION_LIVE_EVIDENCE_VERSION = 'selection-live-evidence-v3-full-lineup-current-primary-old-reference';

function text(v){ return String(v ?? '').trim(); }
function normalized(question){ return text(question).normalize('NFKC'); }
function hasNamedPlayer(routed){ return Array.isArray(routed?.players) && routed.players.length > 0; }
function display(v){ const s=text(v); return s || '—'; }

function battingSelectionQuestion(question){
  const q=normalized(question);
  const slot=/(?:^|[^0-9])([1-9])番(?:打者)?/.test(q) || /打順|クリーンナップ|中軸|主軸|打線|オーダー|ベストオーダー|スタメン/.test(q);
  const choice=/誰|だれ|どの|候補|いい|良い|最適|ベスト|決め|どうする|どう組|組んで|組む|選ぶ|選定|考えて|作って/.test(q);
  return slot && choice;
}

function pitchingSelectionQuestion(question){
  const q=normalized(question);
  const role=/(?:先発投手|先発ピッチャー|先発は誰|誰を先発|エース|クローザー|抑え|守護神)/.test(q);
  const choice=/誰|だれ|どの|候補|いい|良い|最適|ベスト|決め|どうする|選ぶ|選定/.test(q);
  return role && choice;
}

export function selectionEvidenceKind(question,routed={}){
  if(hasNamedPlayer(routed)) return '';
  if(isFullLineupQuestion({question})) return 'FULL_LINEUP';
  if(pitchingSelectionQuestion(question)) return 'PITCHING_ROLE';
  if(battingSelectionQuestion(question)) return 'BATTING_ORDER';
  const domains=Array.isArray(routed?.domains)?routed.domains:[];
  if(domains.includes('LINEUP')) return 'BATTING_ORDER';
  return '';
}

export function shouldBuildCurrentSelectionEvidence(question,routed={}){
  return Boolean(selectionEvidenceKind(question,routed));
}

function battingParts(stats){
  const b=stats||{}, parts=[];
  if(text(b.AVG)) parts.push(`打率 ${b.AVG}`);
  if(text(b.OPS)) parts.push(`OPS ${b.OPS}`);
  if(text(b.OBP)) parts.push(`出塁率 ${b.OBP}`);
  if(text(b.SLG)) parts.push(`長打率 ${b.SLG}`);
  if(text(b.AB)) parts.push(`打数 ${b.AB}`);
  if(text(b.H)) parts.push(`安打 ${b.H}`);
  if(text(b.RBI)) parts.push(`打点 ${b.RBI}`);
  if(text(b.R)) parts.push(`得点 ${b.R}`);
  if(text(b.SO)) parts.push(`三振 ${b.SO}`);
  if(text(b.BB)) parts.push(`四球 ${b.BB}`);
  if(text(b.HBP)) parts.push(`死球 ${b.HBP}`);
  if(text(b.SB)) parts.push(`盗塁 ${b.SB}`);
  if(text(b.CS)) parts.push(`盗塁刺 ${b.CS}`);
  if(text(b.SAC)) parts.push(`犠打 ${b.SAC}`);
  if(text(b.SF)) parts.push(`犠飛 ${b.SF}`);
  return parts;
}

function pitchingParts(stats){
  const p=stats||{}, parts=[];
  if(text(p.APP)) parts.push(`登板 ${p.APP}`);
  if(text(p.ERA)) parts.push(`防御率 ${p.ERA}`);
  if(text(p.IP)) parts.push(`投球回 ${p.IP}`);
  if(text(p.SO)) parts.push(`奪三振 ${p.SO}`);
  if(text(p.BB)) parts.push(`与四球 ${p.BB}`);
  if(text(p.WHIP)) parts.push(`WHIP ${p.WHIP}`);
  if(text(p.BAA)) parts.push(`被打率 ${p.BAA}`);
  if(text(p.H)) parts.push(`被安打 ${p.H}`);
  if(text(p.R)) parts.push(`失点 ${p.R}`);
  if(text(p.ER)) parts.push(`自責点 ${p.ER}`);
  if(text(p.HR)) parts.push(`被本塁打 ${p.HR}`);
  if(text(p.WP)) parts.push(`暴投 ${p.WP}`);
  return parts;
}

function playerLine(name,entry,kind){
  const parts=kind==='PITCHING_ROLE' ? pitchingParts(entry?.pitching) : battingParts(entry?.batting);
  const label=kind==='PITCHING_ROLE'?'投手記録なし':'打撃記録なし';
  return `${name}：${parts.length?parts.join(' / '):label}`;
}

function historicalPlayer(name,byName){
  const entry=byName?.[name]||{};
  return {
    name,
    batting: entry?.batting ? {...entry.batting} : null,
    pitching: entry?.pitching ? {...entry.pitching} : null
  };
}

export async function buildCurrentSelectionEvidence({question,routed={},auditProvider=runDriveLiveAudit}={}){
  const kind=selectionEvidenceKind(question,routed);
  if(!kind) return null;

  const [currentResult,oldResult]=await Promise.allSettled([
    auditProvider({season:'current'}),
    auditProvider({season:'old'})
  ]);
  if(currentResult.status!=='fulfilled') throw currentResult.reason;

  const audit=currentResult.value;
  const byName=audit?.extracted?.playersByName||{};
  const missing=CURRENT_ROSTER.filter(name=>!Object.prototype.hasOwnProperty.call(byName,name));
  if(missing.length) throw new Error(`現チーム14名の正本確認が未完了です: ${missing.join('、')}`);

  const players=CURRENT_ROSTER.map(name=>({
    name,
    batting: byName[name]?.batting ? {...byName[name].batting} : null,
    pitching: byName[name]?.pitching ? {...byName[name].pitching} : null
  }));

  let historicalReference={
    status:'UNAVAILABLE',
    season:'old',
    scope:'2025-2026旧チーム',
    candidateEligible:false,
    players:[],
    source:null,
    warning:'旧チーム正本を取得できなかったため、今回は現チーム正本だけで判断する。'
  };
  if(oldResult.status==='fulfilled'){
    const oldAudit=oldResult.value;
    const oldByName=oldAudit?.extracted?.playersByName||{};
    const historicalPlayers=CURRENT_ROSTER.map(name=>historicalPlayer(name,oldByName));
    historicalReference={
      status:'COMPLETE',
      season:'old',
      scope:oldAudit?.seasonLabel||'2025-2026旧チーム',
      candidateEligible:false,
      players:historicalPlayers,
      source:oldAudit?.source?{...oldAudit.source}:null,
      periodStart:oldAudit?.extracted?.periodStart||'',
      periodEnd:oldAudit?.extracted?.periodEnd||'',
      warning:'旧チーム記録は現チーム14名の過去実績を確認する参考資料。現チームの候補選定を置き換えず、引退した旧3年生を現チーム候補に混ぜない。'
    };
  }

  const metricLabel=kind==='PITCHING_ROLE'?'投手':'打撃';
  const lines=[
    '【MAGI 選考Evidence】',
    '【主評価】2026-2027 現チーム',
    `対象：${audit?.seasonLabel||'2026-2027現チーム'}`,
    `集計期間：${display(audit?.extracted?.periodStart)} ～ ${display(audit?.extracted?.periodEnd)}`,
    `【現チーム全14選手・${metricLabel}】`,
    ...players.map(p=>playerLine(p.name,p,kind)),
    '【過年度の扱い】基本判断は現チーム。旧チームは現14名の過去実績を補助的に確認する比較材料としてだけ使う。旧チームの引退選手を現チーム候補に入れない。'
  ];

  if(historicalReference.status==='COMPLETE'){
    lines.push(
      `【参考】${historicalReference.scope}（現チーム14名の過去記録のみ）`,
      `参考期間：${display(historicalReference.periodStart)} ～ ${display(historicalReference.periodEnd)}`,
      ...historicalReference.players.map(p=>playerLine(p.name,p,kind))
    );
  }else{
    lines.push(`【参考】旧チーム：取得不可。${historicalReference.warning}`);
  }

  lines.push(
    kind==='FULL_LINEUP'
      ? '【運用ルール】1番〜9番は現チーム14名から異なる9名で構成する。3賢人は独立して全打順を作り、クロス審議後に二次案を出す。旧チーム記録は参考であり、引退選手を打順に入れない。ここにない数値・性格・将来結果は作らない。'
      : '【運用ルール】候補は現チーム14名のみ。まず現チームの現在記録で判断し、旧チーム記録は補助材料として必要な場合だけ参照する。ここにない数値・役割・性格・将来結果は作らない。母数や比較基準がない場合は、その不足を明示する。'
  );

  const sources=[];
  if(audit?.source) sources.push({...audit.source,season:'current',priority:'PRIMARY'});
  if(historicalReference.source) sources.push({...historicalReference.source,season:'old',priority:'REFERENCE'});

  return {
    count: players.length,
    files: sources.map(s=>s.name).filter(Boolean),
    summary:kind==='FULL_LINEUP'
      ? '現チーム14名の正本打撃記録を主評価にし、旧チームの同14名の過去記録を参考として付加した1〜9番打順審議用Evidenceです。'
      : `現チーム14名の正本${metricLabel}記録を主評価にし、取得できた場合は旧チームの同14名の過去記録を参考として付加しました。`,
    text: lines.join('\n'),
    sources,
    resolverVersion: SELECTION_LIVE_EVIDENCE_VERSION,
    selectionKind:kind,
    scope: audit?.seasonLabel||'2026-2027現チーム',
    primarySeason:'current',
    allCurrentTeamCheck:{status:'COMPLETE',players},
    historicalReference,
    dataRule:'候補は現チーム14名のみ。現チームを主評価、旧チームは参考。ここにない数値・役割・選手・性格・将来結果は作らない'
  };
}
