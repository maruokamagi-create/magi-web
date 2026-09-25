import { CURRENT_ROSTER } from './_roster.js';
import { runDriveLiveAudit } from './_drive-live-audit.js';
import { buildRecentSixBattingEvidence } from './_recent-batting-form.js';
import { isFullLineupQuestion } from './_full-lineup.js';
import { isPitchingPlanQuestion } from './_pitching-plan.js';
import { buildPitchingDetailEvidence } from './_pitching-detail-evidence.js';

export const SELECTION_LIVE_EVIDENCE_VERSION = 'selection-live-evidence-v12-takeda-left-field';

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

  const [currentResult,oldResult,recentResult,currentPitchingResult,oldPitchingResult]=await Promise.allSettled([
    auditProvider({season:'current'}),
    auditProvider({season:'old'}),
    wantsRecentBatting ? buildRecentSixBattingEvidence() : Promise.resolve(null),
    isPitchingKind(kind) ? buildPitchingDetailEvidence('current') : Promise.resolve(null),
    isPitchingKind(kind) ? buildPitchingDetailEvidence('old') : Promise.resolve(null)
  ]);
  if(currentResult.status!=='fulfilled') throw currentResult.reason;

  const audit=currentResult.value;
  const byName=audit?.extracted?.playersByName||{};
  const missing=CURRENT_ROSTER.filter(name=>!Object.prototype.hasOwnProperty.call(byName,name));
  if(missing.length) throw new Error(`現チーム14名の正本確認が未完了です: ${missing.join('、')}`);

  const currentPitching=currentPitchingResult?.status==='fulfilled'?currentPitchingResult.value:null;
  const currentPitchingByName=Object.fromEntries((currentPitching?.players||[]).map(p=>[p.name,p.pitching]));
  const players=CURRENT_ROSTER.map(name=>({
    name,
    batting: byName[name]?.batting ? {...byName[name].batting} : null,
    pitching: isPitchingKind(kind) ? (currentPitchingByName[name]?{...currentPitchingByName[name]}:null) : (byName[name]?.pitching ? {...byName[name].pitching} : null)
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
      '【標準オーダーの基準線】相手投手の左右は事前に分からない前提なので、通常の標準ベストオーダーは基本的に右投手対応で組む。現在の上位5人の基準線は 1番 大野 竜暉、2番 坂田 暉馬、3番 嶋田 栄志、4番 大久保 陽翔、5番 中嶋 玲月。この並びは絶対固定ではないが、極端な不調、怪我、投手・守備事情、または新しい明確なEvidenceがない限り、軽い短期変動だけで崩さない。変更する場合は誰をなぜ動かすのかを具体的に説明する。',
      '【大野竜暉の上位評価】大野 竜暉は出塁率を1番適性の中心指標として重く見る。高い出塁率がEvidenceで確認できる場合、打率だけを理由に下位へ落とさない。過去の実戦母数・今季通算・直近状態と合わせ、坂田 暉馬・嶋田 栄志の少ない母数の高率を過大評価して大野の存在を薄くしない。',
      '【2〜3番の扱い】坂田 暉馬と嶋田 栄志は現在の標準2番・3番候補だが、少ない打数での高打率・高OPSだけを根拠に過度に持ち上げない。母数と過去実績を必ず併記し、大野 竜暉や大久保 陽翔との比較を省略しない。3番は固定ではなく、Evidenceが変われば再検討する。',
      '【チーム内役割・指導方針】大久保 陽翔は現チームのキャプテンであり、成績だけでなく精神的な柱としての役割も打順判断の重要な定性材料として加味する。ただしキャプテンだから自動的に特定打順へ固定するのではなく、過去実績・今季通算・直近6試合と合わせて判断する。近藤先生の起用思想として、主軸打者が極端に調子を落としている場合は単純に下位へ下げるだけでなく、1番に置いて打席数を増やし復調を促す戦術も有力案として検討する。大久保 陽翔を4番から動かす場合は「評価低下による降格」なのか「1番起用による復調促進」なのか「先発投手時の負担調整」なのかを明確に区別して説明する。',
      '【6〜8番は変動枠】6〜8番は固定しない。直近6試合の打撃状態、守備配置、先発投手、役割を重ねて毎試合調整する。橋向 結都は先発投手でない日は遊撃・6番を有力案とし、先発投手の日は打撃評価を下げたという意味ではなく投球への集中・負担調整として下位打線へ回す。誰を6〜8番へ入れるかは直近状態と守備成立で比較する。',
      '【武田晴琉翔の守備・打順】武田 晴琉翔は左翼が第一適性。フライアウト処理と走力を守備評価として重く見る。左翼起用を優先する一方、打順は9番に固定せず、打撃成績・相手・直近状態・1番へのつながりを材料に3賢人が可変で審議する。左翼起用と9番起用をセットで固定しない。',
      '【練習試合の運用】公式戦・標準オーダーと練習試合を混同しない。練習試合は打順・守備を柔軟に試してよい。特に第2試合は控えや競争中の選手の確認、複数ポジション、打順適性を試す実験枠として標準1〜5番や9番候補に縛られない。第2試合の実験的な打順を、その選手の通常評価や序列低下の根拠として扱わない。',
      '【現在の守備起用方針】大久保 陽翔は現在、投手・遊撃・三塁を守備候補とする。外野起用は想定しない。武田 晴琉翔は左翼を第一適性として優先する。過去や今季の実記録が別守備位置を含んでいても、現在の標準ベストオーダーでは確認済みの起用方針を優先する。',
      '【理由説明の必須深度】打順を並べるだけ、または「結果を残している」「打席を増やす」「得点力を上げる」だけの抽象説明は禁止。一次判断・二次判断とも、publicStatementとprimaryReasonで、①1〜2番を誰にした理由、②3〜5番の中軸をその順にした理由、③6〜9番をどうつなぐか、を具体的に説明する。利用可能なEvidenceがある場合は、少なくとも3選手について合計4個以上の正確な数値（打席/打数を伴う打率・OPS・出塁率など）を文章中に使い、過去実績・今季通算・直近6試合のどの層の数字か分かるようにする。二次判断で一次案を維持する場合も「維持する」で終えず、クロス審議で指摘された論点に答えたうえで、最低2つの具体的数値と選手名を使って維持理由を説明する。',
      '【大久保陽翔1番時の説明義務】大久保 陽翔を1番にする場合は、4番からの評価低下・降格として扱わず、キャプテン/精神的支柱という役割、打席数を増やす戦術意図、過去実績・今季通算・直近6試合の数字を照合し、「なぜ4番継続ではなく今は1番なのか」まで説明する。直近6試合と今季通算の対象期間が同じなら、それを独立した不調トレンドとして二重評価せず、「不調」と断定するには別の根拠が必要と明記する。',
      '【運用ルール】1番〜9番は現チーム14名から異なる9名で構成する。3賢人は独立して全打順を作り、クロス審議では具体的な打順番号と選手名を挙げて互いの並びを検証した後に二次案を出す。標準ベストオーダーは右投手想定を基本とし、左投手と事前に分かった場合だけ相手情報で微調整する。1〜5番は基準線を尊重しつつ極端な不調・怪我・明確なEvidenceで見直し、6〜9番は直近状態・守備・先発投手で柔軟に動かす。武田 晴琉翔は左翼を第一適性として優先するが、打順は固定しない。守備は実記録だけでなく確認済みの現在の起用方針を優先する。直近6のEvidenceがない場合は「好調」「不調」「最近上向き」などを作らない。旧チームの引退選手を打順に入れない。ここにない数値・性格・将来結果は作らない。'
    );
  }else if(kind==='PITCHING_PLAN'){
    lines.push(`【試合回数条件】${gameInnings}回制`, `【運用ルール】${gameInnings}回制の基本投手運用を「先発 → 第2投手 → 終盤 → クローザー」の4役で作る。基本案では現チームから異なる4投手を割り当てる。3賢人は全14名を確認して独立案を作り、クロス審議では具体的な役割名と選手名を挙げて相互検証する。回数・交代時点・連投耐性・高圧場面適性はEvidenceに明示されていない限り捏造しない。旧チーム記録は投球経験の参考にできるが、過去のクローザー等の役割経験を数値だけから推測しない。`);
  }else{
    lines.push('【運用ルール】候補は現チーム14名のみ。まず現チームの現在記録で判断し、旧チーム記録は実績・経験・再現性の重要な比較材料として使う。直近6試合のCSVが取得できた場合は短期状態も重ねる。ここにない数値・役割・性格・将来結果は作らない。母数や比較基準がない場合は、その不足を明示する。');
  }

  const sources=[];
  if(isPitchingKind(kind)&&currentPitching?.source) sources.push({...currentPitching.source,season:'current',priority:'PRIMARY_PITCHING_DETAIL'});
  if(isPitchingKind(kind)&&oldPitchingResult?.status==='fulfilled'&&oldPitchingResult.value?.source) sources.push({...oldPitchingResult.value.source,season:'old',priority:'HISTORICAL_PITCHING_DETAIL'});
  if(audit?.source) sources.push({...audit.source,season:'current',priority:'PRIMARY'});
  if(recentSix?.source) sources.push({...recentSix.source,season:'current',priority:'RECENT_FORM'});
  if(historicalReference.source) sources.push({...historicalReference.source,season:'old',priority:'HISTORICAL'});

  const summary=kind==='FULL_LINEUP'
    ? `現チーム14名の2026-2027通算正本を主評価にし、${recentSix.status==='COMPLETE'?'打撃詳細CSVから直近6試合を再集計し、':''}2025-2026の同14名の過去実績と、確認済みの役割・守備方針、右投手基本対応、上位5人の基準線、6〜9番の変動運用、武田晴琉翔の左翼第一適性、練習試合の柔軟運用を重ねた1〜9番打順審議用Evidenceです。`
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
    dataRule:'候補は現チーム14名のみ。標準ベストオーダーは基本右投手対応で、1〜5番は大野竜暉→坂田暉馬→嶋田栄志→大久保陽翔→中嶋玲月を現在の基準線とする。ただし極端な不調・怪我・投手守備事情・明確な新Evidenceがあれば変更する。大野は出塁率を1番適性で重く評価し、坂田・嶋田の小母数の高率を過大評価しない。6〜9番は直近状態・守備・先発投手で変動し、橋向結都は非登板時6番遊撃を有力案、先発時は下位へ。武田晴琉翔は左翼を第一適性として優先するが、打順は固定しない。練習試合は柔軟、特に第2試合は実験枠として通常序列の根拠にしない。現チーム通算を主評価し、過去実績・直近6・確認済み役割を重ね、ここにない数値・役割・選手・性格・将来結果は作らない。'
  };
}
