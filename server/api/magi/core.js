import { rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { requireApprovedMember } from '../drive/_access.js';
import { buildLiveAnswer } from './_live-answer.js';
import { buildStrictPitchingAnswer } from './_strict-pitching-answer.js';
import { buildVerifiedDetailAnswer } from './_detail-live-answer.js';
import { shouldUseVerifiedOldDetailAnswer } from './_verified-detail-route.js';
import { resolveQuestionEvidence } from './_evidence-resolver.js';
import { buildCurrentSelectionEvidence } from './_selection-live-evidence.js';
import { buildAppearanceDetailEvidence } from './_appearance-detail-evidence.js';
import { understandRequestGeminiFirst } from './_semantic-authority.js';
import { CURRENT_ROSTER } from './_roster.js';
import { buildObservationEvidence } from './_observation-evidence.js';
import { runDriveLiveAudit } from './_drive-live-audit.js';
import { needsCrossEvidenceAnalysis } from './_evaluation-routing.js';

export const CORE_VERSION='magi-core-v11-natural-evaluation';
const SAMPLE_ROUTE_VERSION='sample-route-v1';

function text(v){return String(v||'').trim()}
function normalized(v){return text(v).normalize('NFKC').replace(/[\s　]+/g,'')}
function isExistingPdfReference(q){
  const s=String(q||'');
  return /(?:\.pdf\b|PDF(?:ファイル|資料|文書|レポート)?)[^。！？!?]{0,40}(?:見て|確認して|読んで|参照して|中身|内容|記載|探して|検索して|開いて)/i.test(s)
    || /(?:見て|確認して|読んで|参照して|探して|検索して|開いて)[^。！？!?]{0,40}(?:\.pdf\b|PDF(?:ファイル|資料|文書|レポート)?)/i.test(s);
}
function hasPdfModifier(q){
  const s=String(q||'');
  if(!/(?:PDF|ＰＤＦ)/i.test(s)||isExistingPdfReference(s))return false;
  return /(?:PDF|ＰＤＦ)(?:形式)?(?:にして|化して|で出して|で見せて|で保存して|で作って|でお願い|で表示して|で出力して|で)?/i.test(s);
}
function clarificationAnswer(message){
  return text(message)||'質問の意味を正確に確認したいので、もう少し具体的に教えてください。';
}
function starterSamplePlayer(question){
  const q=normalized(question);
  return CURRENT_ROSTER.find(name=>q.includes(normalized(`${name}選手を現在のスタメンとして起用すべきか`)))||'';
}
function sampleSemantic(question){
  const q=normalized(question);
  const base={
    semanticVersion:SAMPLE_ROUTE_VERSION,
    confidence:'HIGH',specificSeason:'',metric:'',opponent:'',breakdowns:[],clarificationQuestion:'',needsData:true,
    validated:true,semanticAuthority:'SAMPLE_EXACT_ROUTE',gameInnings:null
  };
  if(q===normalized('現在のエース候補は誰が適任か、現チーム14名の投手成績と起用実績を比較して審議してください。')){
    return {...base,mode:'DELIBERATION',understoodRequest:'現チーム14名の投手成績と起用実績を比較し、現在のエース候補を審議する。',routeReason:'登録済み質問サンプル「エース候補」の確定ルート。',players:[],domains:['PITCHING','TEAM'],timeScope:'CURRENT_SEASON',selectionKind:'GENERIC_SELECTION'};
  }
  if(q===normalized('7回制の投手運用を、先発→第2投手→終盤→クローザーの4役で組んで審議してください。')){
    return {...base,mode:'DELIBERATION',understoodRequest:'7回制の先発・第2投手・終盤・クローザーの4役を現チームから組む。',routeReason:'登録済み質問サンプル「投手運用」の確定ルート。',players:[],domains:['PITCHING','TACTICS','TEAM'],timeScope:'CURRENT_SEASON',selectionKind:'PITCHING_PLAN',gameInnings:7};
  }
  if(q===normalized('現チーム14名の現在データをもとに、今のチームで最優先に改善すべき課題を審議してください。')){
    return {...base,mode:'DELIBERATION',understoodRequest:'現チーム14名の現在データを横断し、今のチームで最優先に改善すべき課題を審議する。',routeReason:'登録済み質問サンプル「チーム改善課題」の確定ルート。',players:[],domains:['TEAM','BATTING','PITCHING','FIELDING'],timeScope:'CURRENT_SEASON',selectionKind:'NONE'};
  }
  const starter=starterSamplePlayer(question);
  if(starter&&q===normalized(`${starter}選手を現在のスタメンとして起用すべきか、今季成績・守備位置・起用実績をもとに審議してください。`)){
    return {...base,mode:'DELIBERATION',understoodRequest:`${starter}選手を現在のスタメンとして起用する案を、今季成績・守備位置・起用実績から審議する。`,routeReason:'登録済み質問サンプル「スタメン起用」の確定ルート。',players:[starter],domains:['TEAM','BATTING','FIELDING'],timeScope:'CURRENT_SEASON',selectionKind:'NONE'};
  }
  return null;
}
function isTeamReviewSample(question){
  return normalized(question)===normalized('現チーム14名の現在データをもとに、今のチームで最優先に改善すべき課題を審議してください。');
}
function isStarterEvaluationSample(question){return Boolean(starterSamplePlayer(question));}
function routedFromSemantic(semantic){
  const domains=Array.isArray(semantic?.domains)?semantic.domains:[];
  const domain=domains.find(d=>['BATTING','PITCHING','FIELDING'].includes(d))||domains[0]||'OTHER';
  let route='GENERAL_QUESTION';
  if(domain==='PITCHING')route='PITCHING_LOOKUP';
  else if(domain==='BATTING')route='BATTING_LOOKUP';
  else if(domain==='FIELDING')route='FIELDING_LOOKUP';
  else if(domain==='TEAM')route='TEAM_LOOKUP';
  else if(Array.isArray(semantic?.players)&&semantic.players.length===1)route='PLAYER_OVERVIEW';
  return {
    route,modelRoute:route,confidence:semantic?.confidence||'HIGH',
    understoodRequest:semantic?.understoodRequest||'',routeReason:semantic?.routeReason||'',
    players:Array.isArray(semantic?.players)?semantic.players:[],domains,
    timeScope:semantic?.timeScope||'UNSPECIFIED',specificSeason:semantic?.specificSeason||'',opponent:semantic?.opponent||'',gameInnings:semantic?.gameInnings||null,
    selectionKind:semantic?.selectionKind||'NONE',
    needsDeliberation:false,needsClarification:false,clarificationQuestion:'',contextRequired:false,contextReferences:[],ambiguities:[],unresolvedEntities:[],
    safeToExecute:true,safetyStatus:'READY',routerVersion:semantic?.semanticVersion||'semantic-authority'
  };
}
function deliberationRouteFromSemantic(semantic){
  return {
    route:'DELIBERATION',modelRoute:'DELIBERATION',confidence:semantic?.confidence||'HIGH',
    understoodRequest:semantic?.understoodRequest||'',routeReason:semantic?.routeReason||'',
    players:Array.isArray(semantic?.players)?semantic.players:[],domains:Array.isArray(semantic?.domains)?semantic.domains:[],
    timeScope:semantic?.timeScope||'UNSPECIFIED',specificSeason:semantic?.specificSeason||'',opponent:semantic?.opponent||'',gameInnings:semantic?.gameInnings||null,
    selectionKind:semantic?.selectionKind||'GENERIC_SELECTION',
    needsDeliberation:true,needsClarification:false,clarificationQuestion:'',contextRequired:false,contextReferences:[],ambiguities:[],unresolvedEntities:[],validationIssues:[],
    safeToExecute:true,safetyStatus:'READY',routerVersion:semantic?.semanticVersion||'semantic-authority'
  };
}
function reportKind(semantic){
  const ds=Array.isArray(semantic?.domains)?semantic.domains:[];
  if(ds.includes('PITCHING'))return'PITCHING';
  if(ds.includes('FIELDING'))return'FIELDING';
  if(ds.includes('BATTING'))return'BATTING';
  return'';
}
async function attachAppearanceEvidence(evidence,{reviewKind='',focusPlayer=''}={}){
  if(!evidence)return evidence;
  const appearance=await buildAppearanceDetailEvidence();
  evidence.appearanceDetail=appearance;
  if(appearance?.source){
    evidence.sources=[...(Array.isArray(evidence.sources)?evidence.sources:[]),appearance.source];
    evidence.files=[...new Set([...(Array.isArray(evidence.files)?evidence.files:[]),appearance.source.name].filter(Boolean))];
  }
  if(appearance?.text)evidence.text=`${text(evidence.text)}\n${appearance.text}`.trim();
  if(reviewKind)evidence.reviewKind=reviewKind;
  if(focusPlayer)evidence.focusPlayer=focusPlayer;
  return evidence;
}
async function buildSpecialSampleEvidence({question,routed,semantic}){
  const teamReview=isTeamReviewSample(question);
  const starter=starterSamplePlayer(question);
  if(!teamReview&&!starter)return null;
  const forcedRouted={...routed,players:[],domains:['LINEUP']};
  const evidence=await buildCurrentSelectionEvidence({question:'現チーム14名からスタメン候補を選ぶ',routed:forcedRouted});
  if(!evidence)return null;
  await attachAppearanceEvidence(evidence,{reviewKind:teamReview?'TEAM_REVIEW':'STARTER_EVALUATION',focusPlayer:starter});
  if(teamReview){
    evidence.summary='現チーム14名の今季打撃・投手データ、過去実績、直近状態、出場・守備起用実績を横断し、改善課題の優先順位を審議するための正本Evidence。';
    evidence.dataRule='TEAM_REVIEWでは候補選手を選ぶのではなく、確認できるチーム全体の記録から改善課題を特定する。MELCHIORは数値・記録、BALTHASARは試合運用・戦術、CASPERは役割・成長・チームへの影響を重視し、Evidenceにない事実は作らない。';
    evidence.teamReviewInstruction='賛否だけで終わらず、各賢人は現時点の最優先改善課題を具体的に1つ以上示し、根拠と見直し条件を述べる。';
  }else{
    evidence.summary=`${starter}選手のスタメン起用案を、現チーム比較・今季成績・直近状態・守備位置・実際の起用実績から審議するための正本Evidence。`;
    evidence.dataRule=`STARTER_EVALUATIONでは${starter}選手の起用案そのものを評価する。出場詳細_2026-2027.csvのスタメン／途中出場・守備位置・実打順を最優先の起用記録として扱い、他選手を勝手に代替候補へ広げない。`;
  }
  return evidence;
}
async function deliberationPayload({question,semantic,routed,role='member'}){
  const resolution=await resolveQuestionEvidence({question,routed,role});
  if(resolution?.requestedDocument&&resolution.status!=='RESOLVED'){
    const names=(resolution?.candidates||[]).slice(0,3).map(x=>x.name).filter(Boolean);
    const answer=names.length?`参照する資料を一意に決められませんでした。候補は「${names.join('」「')}」です。どれを使うか教えてください。`:'参照する資料を一意に決められませんでした。資料名をもう少し具体的に教えてください。';
    return {ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',answer,needsClarification:true,clarificationQuestion:answer,semantic,evidenceResolution:resolution};
  }

  let effectiveResolution=resolution;
  if(!resolution?.requestedDocument){
    const naturalTeamReview = !Array.isArray(semantic?.players) || semantic.players.length===0
      ? needsCrossEvidenceAnalysis(question,semantic)
      : false;
    if(naturalTeamReview){
      const teamRouted={...routed,players:[],domains:['LINEUP']};
      const teamEvidence=await buildCurrentSelectionEvidence({question:'現チーム14名からスタメン候補を選ぶ',routed:teamRouted});
      if(teamEvidence){
        await attachAppearanceEvidence(teamEvidence,{reviewKind:'TEAM_REVIEW'});
        teamEvidence.summary='現チーム14名の今季打撃・投手データ、過去実績、直近状態、出場・守備起用実績を横断し、チームの強み・弱点・変化・課題を分析するための正本Evidence。';
        teamEvidence.dataRule=`${text(teamEvidence.dataRule)} TEAM_REVIEWでは候補選手を選ぶのではなく、確認できるチーム全体の記録から質問された強み・弱点・変化・課題を分析する。Evidenceにない事実は作らない。`.trim();
        effectiveResolution={version:teamEvidence.resolverVersion,status:'RESOLVED',requestedDocument:false,source:'CURRENT_MASTER_NATURAL_TEAM_REVIEW',evidence:teamEvidence};
      }
    }

    const specialEvidence=effectiveResolution?.evidence?null:await buildSpecialSampleEvidence({question,routed,semantic});
    if(specialEvidence){
      effectiveResolution={version:specialEvidence.resolverVersion,status:'RESOLVED',requestedDocument:false,source:'CURRENT_MASTER_SAMPLE_REVIEW',evidence:specialEvidence};
    }else if(!effectiveResolution?.evidence){
      const selectionRouted=String(routed?.selectionKind||'').toUpperCase()==='FULL_LINEUP'?{...routed,players:[]}:routed;
      const liveSelectionEvidence=await buildCurrentSelectionEvidence({question,routed:selectionRouted});
      if(liveSelectionEvidence){
        if(String(liveSelectionEvidence.selectionKind||'').toUpperCase()==='FULL_LINEUP'){
          const appearance=await buildAppearanceDetailEvidence();
          liveSelectionEvidence.appearanceDetail=appearance;
          if(appearance?.source){
            liveSelectionEvidence.sources=[...(Array.isArray(liveSelectionEvidence.sources)?liveSelectionEvidence.sources:[]),appearance.source];
            liveSelectionEvidence.files=[...new Set([...(Array.isArray(liveSelectionEvidence.files)?liveSelectionEvidence.files:[]),appearance.source.name].filter(Boolean))];
          }
          if(appearance?.text)liveSelectionEvidence.text=`${text(liveSelectionEvidence.text)}\n${appearance.text}`.trim();
          liveSelectionEvidence.summary=`${text(liveSelectionEvidence.summary)} 出場詳細_2026-2027.csvのスタメン／途中出場・実守備位置・実打順を起用判断の最優先記録として追加参照します。`.trim();
          liveSelectionEvidence.dataRule=`${text(liveSelectionEvidence.dataRule)} 出場詳細_2026-2027.csvを守備配置・起用判断の最優先記録とし、奇数試合（第1試合・公式戦想定）と偶数試合（第2試合・チャレンジ）を分けて評価する。`.trim();
        }
        effectiveResolution={
          version:liveSelectionEvidence.resolverVersion,
          status:'RESOLVED',
          requestedDocument:false,
          source:'CURRENT_MASTER_LIVE_SELECTION',
          evidence:liveSelectionEvidence
        };
      }
    }
  }

  // A natural single-player evaluation needs that player's current official batting/pitching row
  // plus actual appearance/position history before observations are considered.
  const naturalPlayerReview = !resolution?.requestedDocument && Array.isArray(semantic?.players) && semantic.players.length===1
    && needsCrossEvidenceAnalysis(question,semantic);
  if(naturalPlayerReview){
    try{
      const requested=semantic.players[0];
      const canonical=CURRENT_ROSTER.find(rosterName=>normalized(rosterName)===normalized(requested));
      if(canonical){
        const audit=await runDriveLiveAudit({season:'current'});
        const entry=audit?.extracted?.playersByName?.[canonical];
        if(entry){
          const packet=effectiveResolution?.evidence||{text:'',sources:[],files:[]};
          const source={...audit.source,type:'XLSM_MASTER',season:'current',priority:'PRIMARY'};
          const batting=entry?.batting?{...entry.batting}:null,pitching=entry?.pitching?{...entry.pitching}:null;
          packet.playerReview={name:canonical,periodStart:audit.extracted?.periodStart||'',periodEnd:audit.extracted?.periodEnd||'',batting,pitching,source};
          packet.sources=[...(Array.isArray(packet.sources)?packet.sources:[]),source];
          packet.files=[...new Set([...(Array.isArray(packet.files)?packet.files:[]),source.name].filter(Boolean))];
          packet.count=Math.max(Number(packet.count)||0,1);
          const battingLine=batting?['打率 '+text(batting.AVG),'OPS '+text(batting.OPS),'打数 '+text(batting.AB),'安打 '+text(batting.H),'打点 '+text(batting.RBI),'得点 '+text(batting.R),'三振 '+text(batting.SO),'四球 '+text(batting.BB),'盗塁 '+text(batting.SB)].filter(x=>!/[ ]$/.test(x)).join(' / '):'打撃記録なし';
          const pitchingLine=pitching?['登板 '+text(pitching.APP),'防御率 '+text(pitching.ERA),'投球回 '+text(pitching.IP),'奪三振 '+text(pitching.SO),'WHIP '+text(pitching.WHIP)].filter(x=>!/[ ]$/.test(x)).join(' / '):'投手記録なし';
          packet.text=`${text(packet.text)}\n【対象選手・今季正本XLSM】\n${canonical}：${battingLine}\n投手：${pitchingLine}`.trim();
          packet.summary=`${canonical}選手の現在評価を、今季正本成績・実際の出場/守備起用・独立した観察情報から審議するEvidence。`;
          packet.dataRule=`${text(packet.dataRule)} PLAYER_REVIEWでは対象選手の正本数値と実起用記録を主Evidenceとし、観察情報は独立資料として扱う。Evidenceにない性格・能力・状態を推測しない。`.trim();
          await attachAppearanceEvidence(packet,{reviewKind:'PLAYER_REVIEW',focusPlayer:canonical});
          effectiveResolution={...(effectiveResolution||{}),status:'RESOLVED',source:'CURRENT_MASTER_NATURAL_PLAYER_REVIEW',evidence:packet};
        }
      }
    }catch(error){console.error('[MAGI natural player review evidence]',error?.message||error)}
  }

  // A named pitcher deliberation needs the current official pitching row as well
  // as the independently reported observation ledger.
  const focusNames = (Array.isArray(semantic?.players) ? semantic.players : [])
    .filter(name => CURRENT_ROSTER.some(rosterName => normalized(rosterName) === normalized(name)));
  if (!naturalPlayerReview && !resolution?.requestedDocument && focusNames.length && (semantic?.domains || []).includes('PITCHING')) {
    try {
      const audit = await runDriveLiveAudit({ season: 'current' });
      const rows = focusNames.map(name => {
        const canonical = CURRENT_ROSTER.find(rosterName => normalized(rosterName) === normalized(name));
        const entry = audit?.extracted?.playersByName?.[canonical];
        if (!entry?.pitching || !entry?.sources?.pitching) return null;
        const p = entry.pitching;
        const values = [
          ['登板', p.APP], ['防御率', p.ERA], ['投球回', p.IP],
          ['奪三振', p.SO], ['与四球', p.BB], ['WHIP', p.WHIP],
          ['被打率', p.BAA], ['被安打', p.H], ['失点', p.R], ['自責点', p.ER]
        ].filter(([, value]) => text(value)).map(([label, value]) => `${label} ${value}`);
        return { name: canonical, pitching: p, location: entry.sources.pitching,
          line: `${canonical}：${values.join(' / ')}` };
      }).filter(Boolean);
      if (rows.length) {
        const packet = effectiveResolution?.evidence || { text: '', sources: [], files: [] };
        const source = { ...audit.source, type: 'XLSM_MASTER', season: 'current', priority: 'PRIMARY' };
        packet.currentPitching = {
          periodStart: audit.extracted.periodStart, periodEnd: audit.extracted.periodEnd,
          source, players: rows.map(({ name, pitching, location }) => ({ name, pitching, location }))
        };
        packet.sources = [...(Array.isArray(packet.sources) ? packet.sources : []), source];
        packet.files = [...new Set([...(Array.isArray(packet.files) ? packet.files : []), source.name].filter(Boolean))];
        packet.count = Math.max(Number(packet.count) || 0, rows.length);
        packet.text = `${text(packet.text)}\n【今季投手成績・正本XLSM】\n集計期間：${audit.extracted.periodStart || '不明'} ～ ${audit.extracted.periodEnd || '不明'}\n${rows.map(row => row.line).join('\n')}`.trim();
        packet.dataRule = `${text(packet.dataRule)} 今季投手成績は正本XLSMの対象選手の投手行のみを使う。打撃成績を投手成績へ流用しない。登板・投球回などの母数と率を併記し、観察情報とは独立に評価する。指定選手以外を起用候補に広げない。`.trim();
        effectiveResolution = { ...(effectiveResolution || {}), status: 'RESOLVED',
          source: effectiveResolution?.source || 'CURRENT_MASTER_PLAYER_PITCHING', evidence: packet };
      }
    } catch (error) {
      console.error('[MAGI current pitching evidence]', error?.message || error);
    }
  }

  // Observations are an independent source. A Drive outage must not replace or erase
  // the verified match and appearance records already selected above.
  try {
    const players = Array.isArray(semantic?.players) ? semantic.players : [];
    const observations = await buildObservationEvidence({
      players,
      team: !players.length || /チーム|ベンチ|全体/.test(question)
    });
    if (observations.entries.length) {
      const packet = effectiveResolution?.evidence || { text: '', sources: [], files: [] };
      packet.observations = observations;
      packet.sources = [...(Array.isArray(packet.sources) ? packet.sources : []), observations.source];
      packet.files = [...new Set([...(Array.isArray(packet.files) ? packet.files : []), observations.source.name])];
      packet.text = `${text(packet.text)}\n【独立した観察Evidence】\n${observations.text}`.trim();
      packet.dataRule = `${text(packet.dataRule)} ${observations.dataRule}`.trim();
      effectiveResolution = {
        ...(effectiveResolution || {}),
        status: 'RESOLVED',
        source: effectiveResolution?.source || 'OBSERVATION_LEDGER',
        evidence: packet
      };
    }
  } catch (error) {
    console.error('[MAGI observation evidence]', error?.message || error);
  }

  return {
    ok:true,handled:true,coreVersion:CORE_VERSION,route:'DELIBERATION',action:'DELIBERATE',
    routerVersion:routed?.routerVersion||semantic?.semanticVersion||null,understoodRequest:semantic?.understoodRequest||question,
    domains:Array.isArray(semantic?.domains)?semantic.domains:[],players:Array.isArray(semantic?.players)?semantic.players:[],
    timeScope:semantic?.timeScope||'UNSPECIFIED',specificSeason:semantic?.specificSeason||'',opponent:semantic?.opponent||'',gameInnings:semantic?.gameInnings||null,
    selectionKind:semantic?.selectionKind||'NONE',
    evidencePacket:effectiveResolution?.evidence||null,evidenceResolution:effectiveResolution,semantic,fastPath:false
  };
}
async function documentPayload({question,semantic,role='member'}){
  const routed=routedFromSemantic(semantic);
  const resolution=await resolveQuestionEvidence({question,routed,role});
  if(resolution?.status==='RESOLVED'&&resolution?.evidence){
    const source=resolution?.evidence?.sourceName||resolution?.evidence?.name||resolution?.source||'指定資料';
    return {
      ok:true,handled:true,coreVersion:CORE_VERSION,route:'DOCUMENT_SEARCH',action:'ANSWER',
      answer:`${source}を確認しました。`,understoodRequest:semantic.understoodRequest,semantic,
      evidencePacket:resolution.evidence,evidenceResolution:resolution,fastPath:false
    };
  }
  const names=(resolution?.candidates||[]).slice(0,3).map(x=>x.name).filter(Boolean);
  const answer=names.length?`参照する資料を一意に決められませんでした。候補は「${names.join('」「')}」です。どれを使うか教えてください。`:'参照する資料を特定できませんでした。資料名をもう少し具体的に教えてください。';
  return {ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',answer,clarificationQuestion:answer,needsClarification:true,semantic,evidenceResolution:resolution,fastPath:false};
}

export default async function handler(req,res){
  if(!requirePost(req,res)||!requireSameOrigin(req,res)||!rateLimit(req,res))return;
  try{
    const member=await requireApprovedMember(req,res);if(!member)return;
    const body=await readBody(req);
    const question=text(body?.question);
    const context=Array.isArray(body?.context)?body.context:[];
    if(!question)return sendJson(res,400,{ok:false,error:'question is required'});

    // Gemini is the single semantic authority for every production question.
    // Registered samples remain execution/evidence helpers only; they do not bypass semantic understanding.
    const semantic=await understandRequestGeminiFirst(question,context);

    if(semantic.mode==='CLARIFY'){
      const answer=clarificationAnswer(semantic.clarificationQuestion);
      return sendJson(res,200,{ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',answer,clarificationQuestion:answer,needsClarification:true,semantic,fastPath:false});
    }

    if(hasPdfModifier(question)){
      return sendJson(res,200,{ok:true,handled:false,coreVersion:CORE_VERSION,reason:'OUTPUT_FORMAT_FALLBACK_AFTER_SEMANTIC',semantic,fastPath:false});
    }

    if(semantic.mode==='FULL_REPORT'){
      const kind=reportKind(semantic);
      if(kind){
        return sendJson(res,200,{
          ok:true,handled:true,coreVersion:CORE_VERSION,route:`${kind}_REPORT`,action:'FULL_REPORT',reportKind:kind,
          understoodRequest:semantic.understoodRequest,players:semantic.players,domains:semantic.domains,timeScope:semantic.timeScope,
          specificSeason:semantic.specificSeason,opponent:semantic.opponent,breakdowns:semantic.breakdowns,semantic,fastPath:false
        });
      }
      const answer='一覧表示する成績種別を確定できませんでした。打撃・投手・守備のどれを見たいか教えてください。';
      return sendJson(res,200,{ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',answer,clarificationQuestion:answer,needsClarification:true,semantic,fastPath:false});
    }

    if(semantic.mode==='DELIBERATION'||semantic.mode==='COMPARISON'){
      const routed=deliberationRouteFromSemantic(semantic);
      return sendJson(res,200,await deliberationPayload({question,semantic,routed,role:member.role}));
    }

    if(semantic.mode==='DOCUMENT_SEARCH'){
      return sendJson(res,200,await documentPayload({question,semantic,role:member.role}));
    }

    if(['SINGLE_VALUE','SUMMARY','GENERAL'].includes(semantic.mode)){
      if(needsCrossEvidenceAnalysis(question,semantic)){
        const routed=deliberationRouteFromSemantic({...semantic,domains:[...new Set([...(semantic?.domains||[]),'TEAM','BATTING','PITCHING','FIELDING'])]});
        return sendJson(res,200,await deliberationPayload({question,semantic:{...semantic,mode:'DELIBERATION'},routed,role:member.role}));
      }
      const routed=routedFromSemantic(semantic);
      if(semantic.mode==='GENERAL'&&routed.route==='GENERAL_QUESTION'){
        const answer='質問の意味は理解できましたが、現在のMAGIで実行する処理を安全に確定できませんでした。対象の選手・試合・知りたいことをもう少し具体的に教えてください。';
        return sendJson(res,200,{ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',answer,clarificationQuestion:answer,needsClarification:true,semantic,fastPath:false});
      }
      if(routed.route==='FIELDING_LOOKUP'){
        return sendJson(res,200,{ok:true,handled:true,coreVersion:CORE_VERSION,route:'FIELDING_REPORT',action:'FULL_REPORT',reportKind:'FIELDING',understoodRequest:semantic.understoodRequest,players:semantic.players,domains:semantic.domains,timeScope:semantic.timeScope,specificSeason:semantic.specificSeason,opponent:semantic.opponent,breakdowns:semantic.breakdowns,semantic,fastPath:false});
      }
      if(shouldUseVerifiedOldDetailAnswer(question)){
        const result=await buildVerifiedDetailAnswer({question});
        return sendJson(res,200,{...result,ok:true,handled:true,coreVersion:CORE_VERSION,integratedRoute:'VERIFIED_OLD_DETAIL',semantic,fastPath:false});
      }
      const result=(routed.route==='PITCHING_LOOKUP'&&semantic.timeScope!=='CAREER')?await buildStrictPitchingAnswer({question,routed}):await buildLiveAnswer({question,routed});
      return sendJson(res,200,{...result,ok:true,handled:true,coreVersion:CORE_VERSION,semantic,fastPath:false});
    }

    const answer='質問の意味は理解できましたが、対応する処理を安全に確定できませんでした。もう少し具体的に教えてください。';
    return sendJson(res,200,{ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',answer,clarificationQuestion:answer,needsClarification:true,semantic,fastPath:false});
  }catch(error){
    console.error('[MAGI CORE]',error?.message||error);
    return sendJson(res,502,{ok:false,error:error?.message||'MAGI core failed',coreVersion:CORE_VERSION});
  }
}

