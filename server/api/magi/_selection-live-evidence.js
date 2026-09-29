import { CURRENT_ROSTER } from './_roster.js';
import { runDriveLiveAudit } from './_drive-live-audit.js';
import { buildRecentSixBattingEvidence } from './_recent-batting-form.js';
import { isFullLineupQuestion } from './_full-lineup.js';
import { isPitchingPlanQuestion } from './_pitching-plan.js';
import { buildPitchingDetailEvidence } from './_pitching-detail-evidence.js';
import { buildAppearanceFieldingEvidence } from './_appearance-fielding-evidence.js';
import { buildCoachObservationEvidence } from './_coach-observation-evidence.js';
import { buildNormalizedObservationEvidence } from './_normalized-observation-evidence.js';
import { buildCoachStrategySnapshotEvidence } from './_coach-strategy-snapshot-evidence.js';

export const SELECTION_LIVE_EVIDENCE_VERSION = 'selection-live-evidence-v17-dated-strategy-reference';

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
  if(isFullLineupQuestion({question})) return 'FULL_LINEUP';
  if(isPitchingPlanQuestion({question})) return 'PITCHING_PLAN';
  // A named player can be context for a selection question (for example,
  // "4番の大久保 陽翔につなぐ3番は誰？"). Detect explicit selection
  // intent before the focused-player guard so the full current roster remains
  // available as candidate Evidence.
  if(pitchingSelectionQuestion(question)) return 'PITCHING_ROLE';
  if(battingSelectionQuestion(question)) return 'BATTING_ORDER';
  if(hasNamedPlayer(routed)) return '';
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
  if(text(p.K9)) parts.push(`奪三振率(K/9) ${p.K9}`);
  if(text(p.BB)) parts.push(`与四球 ${p.BB}`);
  if(text(p.WHIP)) parts.push(`WHIP ${p.WHIP}`);
  if(text(p.BAA)) parts.push(`被打率 ${p.BAA}`);
  if(text(p.H)) parts.push(`被安打 ${p.H}`);
  if(text(p.R)) parts.push(`失点 ${p.R}`);
  if(text(p.ER)) parts.push(`自責点 ${p.ER}`);
  if(text(p.HR)) parts.push(`被本塁打 ${p.HR}`);
  if(text(p.WP)) parts.push(`暴投 ${p.WP}`);
  if(text(p.W)) parts.push(`勝利 ${p.W}`);
  if(text(p.L)) parts.push(`敗戦 ${p.L}`);
  if(text(p.SV)) parts.push(`セーブ ${p.SV}`);
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

export async function buildCurrentSelectionEvidence({question,routed={},auditProvider=runDriveLiveAudit,pitchingProvider=buildPitchingDetailEvidence,appearanceFieldingProvider=buildAppearanceFieldingEvidence,coachObservationProvider=buildCoachObservationEvidence,normalizedObservationProvider=buildNormalizedObservationEvidence,coachStrategyProvider=buildCoachStrategySnapshotEvidence,staffAccessContext=null}={}){
  const kind=selectionEvidenceKind(question,routed);
  if(!kind) return null;
  const gameInnings=kind==='PITCHING_PLAN'?pitchingPlanGameInnings(question,routed):null;
  const wantsRecentBatting=!isPitchingKind(kind);

  const wantsUsageEvidence=!isPitchingKind(kind);
  const wantsCoachPitchingEvidence=isPitchingKind(kind) && Boolean(staffAccessContext);
  const wantsNormalizedObservations=Boolean(staffAccessContext);
  const [currentResult,oldResult,recentResult,currentPitchingResult,oldPitchingResult,usageResult,coachResult,normalizedObservationResult,strategyResult]=await Promise.allSettled([
    auditProvider({season:'current'}),
    auditProvider({season:'old'}),
    wantsRecentBatting ? buildRecentSixBattingEvidence() : Promise.resolve(null),
    isPitchingKind(kind) ? pitchingProvider('current') : Promise.resolve(null),
    isPitchingKind(kind) ? pitchingProvider('old') : Promise.resolve(null),
    wantsUsageEvidence ? appearanceFieldingProvider() : Promise.resolve(null),
    wantsCoachPitchingEvidence ? coachObservationProvider({players:CURRENT_ROSTER,accessContext:staffAccessContext}) : Promise.resolve(null),
    wantsNormalizedObservations ? normalizedObservationProvider({players:CURRENT_ROSTER,accessContext:staffAccessContext}) : Promise.resolve(null),
    staffAccessContext ? coachStrategyProvider({accessContext:staffAccessContext}) : Promise.resolve(null)
  ]);
  if(currentResult.status!=='fulfilled') throw currentResult.reason;
  if(isPitchingKind(kind) && currentPitchingResult.status!=='fulfilled') throw new Error(`現チームの投手詳細CSVを取得できないため、投手選考を停止します: ${currentPitchingResult.reason?.message||'取得エラー'}`);

  const audit=currentResult.value;
  const byName=audit?.extracted?.playersByName||{};
  const missing=CURRENT_ROSTER.filter(name=>!Object.prototype.hasOwnProperty.call(byName,name));
  if(missing.length) throw new Error(`現チーム14名の正本確認が未完了です: ${missing.join('、')}`);

  const currentPitching=currentPitchingResult?.status==='fulfilled'?currentPitchingResult.value:null;
  const currentPitchingByName=Object.fromEntries((currentPitching?.players||[]).map(p=>[p.name,p.pitching]));
  const players=CURRENT_ROSTER.map(name=>({
    name,
    batting: byName[name]?.batting ? {...byName[name].batting} : null,
    pitching: isPitchingKind(kind) ? (currentPitchingByName[name]?{...currentPitchingByName[name],...Object.fromEntries(['W','L','SV'].filter(k=>text(byName[name]?.pitching?.[k])).map(k=>[k,byName[name].pitching[k]]))}:null) : (byName[name]?.pitching ? {...byName[name].pitching} : null)
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
    const oldPitching=oldPitchingResult?.status==='fulfilled'?oldPitchingResult.value:null;
    const oldPitchingByName=Object.fromEntries((oldPitching?.players||[]).map(p=>[p.name,p.pitching]));
    const historicalPlayers=CURRENT_ROSTER.map(name=>{const p=historicalPlayer(name,oldByName);if(isPitchingKind(kind))p.pitching=oldPitchingByName[name]?{...oldPitchingByName[name]}:null;return p;});
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

  const usageEvidence=usageResult?.status==='fulfilled'?usageResult.value:null;
  if(wantsUsageEvidence){
    if(usageEvidence?.status==='COMPLETE'){
      lines.push(
        '【実起用・守備Evidence】出場詳細CSVをスタメン/途中出場/実打順/スタメン守備位置の最優先記録として扱い、守備詳細CSVを実守備位置の補助記録として重ねる。',
        ...usageEvidence.players.map(p=>{
          const a=p.appearance||{}, f=p.fielding||{};
          const orders=Object.entries(a.battingOrders||{}).map(([k,v])=>`${k}番×${v}`).join('、')||'スタメン打順なし';
          const starts=Object.entries(a.startingPositions||{}).map(([k,v])=>`${k}×${v}`).join('、')||'スタメン守備なし';
          const field=Object.entries(f.positions||{}).map(([k,v])=>`${k}×${v}`).join('、')||'守備記録なし';
          return `${p.name}：スタメン ${a.starts||0} / 途中出場 ${a.substitutions||0} / 打順 ${orders} / スタメン守備 ${starts} / 実守備 ${field}`;
        })
      );
    }else{
      lines.push('【実起用・守備Evidence】取得不可。出場実績・守備実績を推測で補わない。');
    }
  }

  const coachEvidence=coachResult?.status==='fulfilled'?coachResult.value:null;
  const normalizedObservationEvidence=normalizedObservationResult?.status==='fulfilled'?normalizedObservationResult.value:null;
  const strategyEvidence=strategyResult?.status==='fulfilled'?strategyResult.value:null;
  if(wantsNormalizedObservations){
    if(normalizedObservationEvidence?.status==='COMPLETE'){
      // For PITCHING_ROLE the raw coach provider is already present, so exclude
      // normalized coach rows to prevent the same observation becoming two votes.
      const visible=(normalizedObservationEvidence.observations||[]).filter(o=>kind!=='PITCHING_ROLE'||o.sourceType!=='指導者');
      if(visible.length){
        lines.push(
          '【観察Evidence】統合台帳は原本の正規化ビュー。数値成績とは別系統で扱い、原本と同一の観察は独立票として二重加点しない。',
          ...visible.map(o=>`${o.recordedAt||'日時不明'} / ${o.sourceType||'情報源不明'} / ${o.provider||'提供者不明'} / ${o.player}：${o.statement}`)
        );
      }
    }else if(normalizedObservationResult?.status==='rejected'){
      lines.push(`【観察Evidence】Access Gateまたは取得処理で利用不可。推測で補わない：${normalizedObservationResult.reason?.code||normalizedObservationResult.reason?.message||'取得エラー'}`);
    }
  }

  if(strategyEvidence?.status==='REFERENCE_ONLY'){
    lines.push(
      `【過去の指導者起用方針】${strategyEvidence.effectiveAt}時点の起用案を補助Evidenceとして登録。現在の固定方針ではなく、最新の実起用・数値Evidence・日付の新しい指導者観察より優先しない。`,
      strategyEvidence.textExtractable ? strategyEvidence.text : '本文はPDFのためこの経路では未展開。内容を推測で補わない。'
    );
  }

  if(kind==='PITCHING_ROLE'){
    if(wantsCoachPitchingEvidence && coachEvidence?.status==='COMPLETE'){
      const pitchingCoachObs=(coachEvidence.observations||[]).filter(o=>/投手|投球|制球|継投|イニング|クローザー|抑え|守護神/.test(`${o.category} ${o.statement}`));
      if(pitchingCoachObs.length){
        lines.push(
          '【指導者観察・投手起用】以下は数値成績とは別系統のCOACH OBSERVATION。観察事実と意見・起用提案を区別し、数値Evidenceを上書きせず併記して審議する。',
          ...pitchingCoachObs.map(o=>`${o.recordedAt||'日時不明'} / ${o.provider||'提供者不明'} / ${o.player} / ${o.statementClass}：${o.statement}`)
        );
      }else{
        lines.push('【指導者観察・投手起用】アクセス済みだが、投手役割に直接関係する観察はなし。');
      }
    }else if(wantsCoachPitchingEvidence && coachResult?.status==='rejected'){
      lines.push(`【指導者観察・投手起用】Access Gateまたは取得処理で利用不可。推測で補わない：${coachResult.reason?.message||'取得エラー'}`);
    }else{
      lines.push('【指導者観察・投手起用】権限コンテキスト未付与のため未取得。数値Evidenceだけで指導者の現在方針を推測しない。');
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
    lines.push(
      '【打順審議ルール】標準オーダーをコード内の固定打順から決めない。現チーム通算、直近6試合、出場詳細、守備詳細、利用可能な観察Evidenceをその都度読み、1〜9番を審議する。過去の基準線や以前の起用案は、それ自体を現在の正解として扱わない。',
      '【打順適性】1〜2番、3〜5番、6〜9番の役割は、出塁・長打・母数・直近状態・実際の打順/守備起用・投手負担をEvidenceから比較して説明する。特定選手をコードだけを根拠に特定打順へ固定しない。',
      '【守備成立】守備位置は出場詳細CSVを最優先、守備詳細CSVを補助として実起用を確認する。コード内の固定ポジション案で実記録を上書きしない。現在の起用方針を観察Evidenceから使う場合は、情報源・時期・観察/提案の区別を明示する。',
      '【練習試合の解釈】公式戦と練習試合の起用を混同しない。実験的起用を通常序列の低下・固定役割の根拠にしない。試合区分をEvidenceから確認できない場合は推測しない。',
      '【理由説明の必須深度】打順を並べるだけ、または抽象説明だけは禁止。一次判断・二次判断とも、①1〜2番、②3〜5番、③6〜9番について具体的な選手名とEvidenceを使って説明する。利用可能な数値Evidenceがある場合は母数と対象期間を併記し、直近と通算の対象が重なる場合は独立Evidenceとして二重評価しない。',
      '【運用ルール】1番〜9番は現チーム14名から異なる9名で構成する。3賢人は独立して全打順を作り、クロス審議では具体的な打順番号と選手名を挙げて相互検証する。直近Evidenceがない場合は「好調」「不調」「最近上向き」などを作らない。旧チームの引退選手を候補に入れない。ここにない数値・役割・性格・将来結果は作らない。'
    );
  }else if(kind==='PITCHING_PLAN'){
    lines.push(`【試合回数条件】${gameInnings}回制`, `【運用ルール】${gameInnings}回制の基本投手運用を「先発 → 第2投手 → 終盤 → クローザー」の4役で作る。基本案では現チームから異なる4投手を割り当てる。3賢人は全14名を確認して独立案を作り、クロス審議では具体的な役割名と選手名を挙げて相互検証する。回数・交代時点・連投耐性・高圧場面適性はEvidenceに明示されていない限り捏造しない。旧チーム記録は投球経験の参考にできるが、過去のクローザー等の役割経験を数値だけから推測しない。`);
  }else if(kind==='PITCHING_ROLE'){
    const experienced=(currentPitching?.experiencedPlayers||[]);
    const closerRole=/(?:クローザー|抑え|守護神)/.test(normalized(question));
    lines.push(`【投手候補資格】現チームの投手詳細CSVに実際の投球行がある選手のみ投手候補にできる。該当者：${experienced.join('、')||'なし'}。投手記録なしの選手をクローザー・先発・中継ぎ候補へ入れない。捕手・守備記録を投手経験として扱わない。`,
      ...(closerRole?[`【クローザー役割実績】通算XLSMの勝利・敗戦・セーブを投手詳細CSVに補完して比較する。特にセーブは実際に試合を締めた役割実績として必ず評価材料に含める。セーブ数だけで自動決定はしないが、セーブ実績を無視して防御率・K/9だけで順位付けしない。`]:[]),
      '【運用ルール】クローザー等の投手役割は、まず投手詳細CSVの現チーム投球実績で比較し、旧チーム投手詳細CSVは過去の投球経験の参考にする。ERAは7回換算、奪三振率はK/9、WHIPは1イニング当たりで扱う。ここにない役割経験・高圧場面適性・性格・将来結果は作らない。');
  }else{
    lines.push('【運用ルール】候補は現チーム14名のみ。まず現チームの現在記録で判断し、旧チーム記録は実績・経験・再現性の重要な比較材料として使う。直近6試合のCSVが取得できた場合は短期状態も重ねる。ここにない数値・役割・性格・将来結果は作らない。母数や比較基準がない場合は、その不足を明示する。');
  }

  const sources=[];
  if(strategyEvidence?.source) sources.push({...strategyEvidence.source,season:'current',priority:'DATED_STRATEGY_REFERENCE',effectiveAt:strategyEvidence.effectiveAt,currentPolicy:false});
  if(usageEvidence?.status==='COMPLETE') sources.push(...usageEvidence.sources.map(source=>({...source,season:'current'})));
  if(normalizedObservationEvidence?.status==='COMPLETE' && normalizedObservationEvidence.source) sources.push({...normalizedObservationEvidence.source,season:'current',priority:'NORMALIZED_OBSERVATION'});
  if(kind==='PITCHING_ROLE' && coachEvidence?.status==='COMPLETE' && coachEvidence.source) sources.push({...coachEvidence.source,season:'current',priority:'COACH_OBSERVATION'});
  if(isPitchingKind(kind)&&currentPitching?.source) sources.push({...currentPitching.source,season:'current',priority:'PRIMARY_PITCHING_DETAIL'});
  if(isPitchingKind(kind)&&oldPitchingResult?.status==='fulfilled'&&oldPitchingResult.value?.source) sources.push({...oldPitchingResult.value.source,season:'old',priority:'HISTORICAL_PITCHING_DETAIL'});
  if(audit?.source) sources.push({...audit.source,season:'current',priority:'PRIMARY'});
  if(recentSix?.source) sources.push({...recentSix.source,season:'current',priority:'RECENT_FORM'});
  if(historicalReference.source) sources.push({...historicalReference.source,season:'old',priority:'HISTORICAL'});

  const pitchingEligible=isPitchingKind(kind)?(currentPitching?.experiencedPlayers||[]):[];  const summary=kind==='FULL_LINEUP'
    ? `現チーム14名の2026-2027通算正本を主評価にし、${recentSix.status==='COMPLETE'?'打撃詳細CSVから直近6試合を再集計し、':''}出場詳細・守備詳細・利用可能な観察Evidenceと過去実績を重ね、固定打順を前提にせず毎回再審議する1〜9番用Evidenceです。`
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
    strategySnapshotStatus: strategyEvidence?.status|| (staffAccessContext?'UNAVAILABLE':'ACCESS_CONTEXT_REQUIRED'),
    strategySnapshotError: staffAccessContext && strategyResult?.status==='rejected' ? String(strategyResult.reason?.code||strategyResult.reason?.message||'strategy_snapshot_unavailable') : '',
    strategySnapshotHttpStatus: staffAccessContext && strategyResult?.status==='rejected' ? (Number(strategyResult.reason?.status)||null) : null,
    normalizedObservationStatus: normalizedObservationEvidence?.status|| (wantsNormalizedObservations?'UNAVAILABLE':'ACCESS_CONTEXT_REQUIRED'),
    normalizedObservationError: wantsNormalizedObservations && normalizedObservationResult?.status==='rejected' ? String(normalizedObservationResult.reason?.code||normalizedObservationResult.reason?.message||'normalized_observation_unavailable') : '',
    normalizedObservationHttpStatus: wantsNormalizedObservations && normalizedObservationResult?.status==='rejected' ? (Number(normalizedObservationResult.reason?.status)||null) : null,
    coachObservationStatus: kind==='PITCHING_ROLE' ? (coachEvidence?.status|| (wantsCoachPitchingEvidence?'UNAVAILABLE':'ACCESS_CONTEXT_REQUIRED')) : 'NOT_APPLICABLE',
    coachObservationError: kind==='PITCHING_ROLE' && wantsCoachPitchingEvidence && coachResult?.status==='rejected' ? String(coachResult.reason?.code||coachResult.reason?.message||'coach_observation_unavailable') : '',
    coachObservationHttpStatus: kind==='PITCHING_ROLE' && wantsCoachPitchingEvidence && coachResult?.status==='rejected' ? (Number(coachResult.reason?.status)||null) : null,
    selectionKind:kind,
    gameInnings,
    scope: audit?.seasonLabel||'2026-2027現チーム',
    primarySeason:'current',
    allCurrentTeamCheck:{status:'COMPLETE',players},
    recentSix,
    historicalReference,
    sampleSizeRule:sampleRule,
    pitchingEligible,
    dataRule:'候補は現チーム14名のみ。打順・守備・役割をコード内の固定候補から決めず、現チーム通算・直近6・出場詳細・守備詳細・権限内の観察Evidenceを質問時点で比較する。過去実績は参考として現在を上書きしない。Evidenceにない数値・役割・性格・将来結果は作らない。'
  };
}

