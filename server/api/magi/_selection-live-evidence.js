import { CURRENT_ROSTER } from './_roster.js';
import { runDriveLiveAudit } from './_drive-live-audit.js';
import { buildRecentSixBattingEvidence } from './_recent-batting-form.js';
import { isFullLineupQuestion } from './_full-lineup.js';
import { isPitchingPlanQuestion } from './_pitching-plan.js';

export const SELECTION_LIVE_EVIDENCE_VERSION = 'selection-live-evidence-v7-recent-six-batting';

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
  if(isPitchingPlanQuestion({question})) return 'PITCHING_PLAN';
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

function isPitchingKind(kind){return kind==='PITCHING_ROLE'||kind==='PITCHING_PLAN';}

function playerLine(name,entry,kind){
  const parts=isPitchingKind(kind) ? pitchingParts(entry?.pitching) : battingParts(entry?.batting);
  const label=isPitchingKind(kind)?'投手記録なし':'打撃記録なし';
  return `${name}：${parts.length?parts.join(' / '):label}`;
}

function recentPlayerLine(entry){
  const b=entry?.batting||{};
  const parts=[];
  parts.push(`${Number(entry?.games||0)}試合`);
  if(text(b.PA)) parts.push(`打席 ${b.PA}`);
  if(text(b.AB)) parts.push(`打数 ${b.AB}`);
  if(text(b.H)) parts.push(`安打 ${b.H}`);
  if(text(b.AVG)) parts.push(`打率 ${b.AVG}`);
  if(text(b.OBP)) parts.push(`出塁率 ${b.OBP}`);
  if(text(b.SLG)) parts.push(`長打率 ${b.SLG}`);
  if(text(b.OPS)) parts.push(`OPS ${b.OPS}`);
  return `${entry?.name||'選手'}：${parts.join(' / ')}`;
}

function historicalPlayer(name,byName){
  const entry=byName?.[name]||{};
  return {
    name,
    batting: entry?.batting ? {...entry.batting} : null,
    pitching: entry?.pitching ? {...entry.pitching} : null
  };
}

function sampleSizeRule(kind){
  if(isPitchingKind(kind)){
    return '率系の投手指標（防御率・WHIP・被打率など）は、登板数・投球回などの母数とセットで読む。小さい母数の好不調を安定した実力と断定しない。旧チームに十分な過去母数がある場合は再現性・経験の参考にするが、現在成績を上書きしない。母数の数値基準はEvidenceにない限り勝手に作らない。';
  }
  return '率系の打撃指標（打率・出塁率・長打率・OPSなど）は、打数・打席などの母数とセットで読む。小さい母数の高低を安定した実力と断定しない。旧チームに十分な過去母数がある場合は再現性・経験の重要な比較材料にするが、現在成績を上書きしない。母数の数値基準はEvidenceにない限り勝手に作らない。';
}

function pitchingPlanGameInnings(question,routed){
  const routedValue=Number(routed?.gameInnings);
  if(routedValue===7||routedValue===9)return routedValue;
  const q=normalized(question);
  if(/(?:9回制|9イニング|九回制|九イニング)/.test(q))return 9;
  return 7;
}

export async function buildCurrentSelectionEvidence({question,routed={},auditProvider=runDriveLiveAudit}={}){
  const kind=selectionEvidenceKind(question,routed);
  if(!kind) return null;
  const gameInnings=kind==='PITCHING_PLAN'?pitchingPlanGameInnings(question,routed):null;
  const wantsRecentBatting=!isPitchingKind(kind);

  const [currentResult,oldResult,recentResult]=await Promise.allSettled([
    auditProvider({season:'current'}),
    auditProvider({season:'old'}),
    wantsRecentBatting ? buildRecentSixBattingEvidence() : Promise.resolve(null)
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

  let recentSix={
    status:wantsRecentBatting?'UNAVAILABLE':'NOT_APPLICABLE',
    players:[],
    source:null,
    gameCount:0,
    totalRecordedGames:0,
    windowStart:'',
    windowEnd:'',
    sameAsCurrentSeasonWindow:false,
    warning:wantsRecentBatting?'直近6試合の打撃詳細CSVを取得できなかったため、最近の調子は評価材料にしない。':''
  };
  if(wantsRecentBatting && recentResult.status==='fulfilled' && recentResult.value){
    recentSix=recentResult.value;
  }else if(wantsRecentBatting && recentResult.status==='rejected'){
    recentSix.warning=`直近6試合の打撃詳細CSVを取得できませんでした: ${recentResult.reason?.message||'取得エラー'}。最近の好調・不調は断定しない。`;
  }

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
      warning:'旧チーム記録は現チーム14名の過去実績・経験・再現性を確認する重要な比較材料。ただし現チームの候補選定を置き換えず、引退した旧3年生を現チーム候補に混ぜない。'
    };
  }

  const metricLabel=isPitchingKind(kind)?'投手':'打撃';
  const sampleRule=sampleSizeRule(kind);
  const lines=[
    '【MAGI 選考Evidence】',
    '【主評価】2026-2027 現チーム',
    `対象：${audit?.seasonLabel||'2026-2027現チーム'}`,
    `集計期間：${display(audit?.extracted?.periodStart)} ～ ${display(audit?.extracted?.periodEnd)}`,
    `【現チーム全14選手・${metricLabel}】`,
    ...players.map(p=>playerLine(p.name,p,kind))
  ];

  if(wantsRecentBatting){
    if(recentSix.status==='COMPLETE'){
      const overlap=recentSix.sameAsCurrentSeasonWindow
        ? '。現時点ではCSVに記録された今季全試合が6試合以下のため、直近6と今季通算の対象試合が同じ。独立した上昇・下降トレンドとはみなさない。'
        : '。今季通算とは別に、最新6試合の短期状態として扱う。';
      lines.push(
        `【直近${recentSix.gameCount}試合・打撃】${display(recentSix.windowStart)} ～ ${display(recentSix.windowEnd)}${overlap}`,
        ...recentSix.players.map(recentPlayerLine)
      );
    }else{
      lines.push(`【直近6試合・打撃】取得不可。${recentSix.warning}`);
    }
  }

  lines.push(
    `【母数ルール】${sampleRule}`,
    '【過年度の扱い】基本判断は現チーム。ただし旧チームの現14名の記録は、実績・経験・再現性を見る重要な比較材料として明示的に使う。過去だけで現在を上書きせず、現在の小さい母数だけで過去の積み上げも消さない。旧チームの引退選手を現チーム候補に入れない。'
  );

  if(historicalReference.status==='COMPLETE'){
    lines.push(
      `【過去実績】${historicalReference.scope}（現チーム14名の過去記録のみ）`,
      `参考期間：${display(historicalReference.periodStart)} ～ ${display(historicalReference.periodEnd)}`,
      ...historicalReference.players.map(p=>playerLine(p.name,p,kind))
    );
  }else{
    lines.push(`【過去実績】旧チーム：取得不可。${historicalReference.warning}`);
  }

  if(kind==='FULL_LINEUP'){
    lines.push('【運用ルール】1番〜9番は現チーム14名から異なる9名で構成する。3賢人は独立して全打順を作り、クロス審議では具体的な打順番号と選手名を挙げて互いの並びを検証した後に二次案を出す。標準ベストオーダーは相手投手の左右別データがなくても決定し、相手情報は後から微調整する条件として扱う。特に1〜5番は「過去実績 → 今季通算 → 直近6試合」の3層を比較して理由を説明する。中軸候補を別の選手より下げる場合は、3層のどの具体的数値がその変更を支持するかを説明できない限り変更理由として認めない。直近6のEvidenceがない場合は「好調」「不調」「最近上向き」などを作らない。旧チームの引退選手を打順に入れない。ここにない数値・性格・将来結果は作らない。');
  }else if(kind==='PITCHING_PLAN'){
    lines.push(`【試合回数条件】${gameInnings}回制`, `【運用ルール】${gameInnings}回制の基本投手運用を「先発 → 第2投手 → 終盤 → クローザー」の4役で作る。基本案では現チームから異なる4投手を割り当てる。3賢人は全14名を確認して独立案を作り、クロス審議では具体的な役割名と選手名を挙げて相互検証する。回数・交代時点・連投耐性・高圧場面適性はEvidenceに明示されていない限り捏造しない。旧チーム記録は投球経験の参考にできるが、過去のクローザー等の役割経験を数値だけから推測しない。`);
  }else{
    lines.push('【運用ルール】候補は現チーム14名のみ。まず現チームの現在記録で判断し、旧チーム記録は実績・経験・再現性の重要な比較材料として使う。直近6試合のCSVが取得できた場合は短期状態も重ねる。ここにない数値・役割・性格・将来結果は作らない。母数や比較基準がない場合は、その不足を明示する。');
  }

  const sources=[];
  if(audit?.source) sources.push({...audit.source,season:'current',priority:'PRIMARY'});
  if(recentSix?.source) sources.push({...recentSix.source,season:'current',priority:'RECENT_FORM'});
  if(historicalReference.source) sources.push({...historicalReference.source,season:'old',priority:'HISTORICAL'});

  const summary=kind==='FULL_LINEUP'
    ? `現チーム14名の2026-2027通算正本を主評価にし、${recentSix.status==='COMPLETE'?'打撃詳細CSVから直近6試合を再集計し、':''}2025-2026の同14名の過去実績も重ねた1〜9番打順審議用Evidenceです。標準打順は相手別データ不足だけでは保留しません。`
    : kind==='PITCHING_PLAN'
      ? `現チーム14名の正本投手記録を主評価にし、旧チームの同14名の過去投球記録を参考として付加した${gameInnings}回制4役投手運用の審議用Evidenceです。率系指標は母数とセットで扱います。`
      : `現チーム14名の正本${metricLabel}記録を主評価にし、${recentSix.status==='COMPLETE'?'直近6試合の打撃詳細と、':''}取得できた過去実績を比較材料として付加しました。率系指標は母数とセットで扱います。`;

  return {
    count: players.length,
    files: sources.map(s=>s.name).filter(Boolean),
    summary,
    text: lines.join('\n'),
    sources,
    resolverVersion: SELECTION_LIVE_EVIDENCE_VERSION,
    selectionKind:kind,
    gameInnings,
    scope: audit?.seasonLabel||'2026-2027現チーム',
    primarySeason:'current',
    allCurrentTeamCheck:{status:'COMPLETE',players},
    recentSix,
    historicalReference,
    sampleSizeRule:sampleRule,
    dataRule:'候補は現チーム14名のみ。現チーム通算を主評価し、過去実績は経験・再現性の重要な比較材料、直近6試合は短期状態として重ねる。標準ベストオーダーは相手別情報不足だけでは保留しない。ここにない数値・役割・選手・性格・将来結果は作らない'
  };
}
