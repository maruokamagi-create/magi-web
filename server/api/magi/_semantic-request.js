import { callGemini } from './_gemini.js';
import { OFFICIAL_PLAYER_REGISTRY, THIRD_YEAR_ROSTER, canonicalPlayerNameStrict, canonicalizeKnownNameText } from './_roster.js';

export const SEMANTIC_REQUEST_VERSION = 'semantic-request-v2-input-safety';

const MODES = ['SINGLE_VALUE','SUMMARY','FULL_REPORT','COMPARISON','DELIBERATION','DOCUMENT_SEARCH','GENERAL','CLARIFY'];
const DOMAINS = ['BATTING','PITCHING','FIELDING','RUNNING','LINEUP','TACTICS','DEVELOPMENT','TEAM','DOCUMENTS','OTHER'];
const TIMES = ['CAREER','CURRENT_SEASON','PREVIOUS_SEASON','SPECIFIC_SEASON','RECENT_6','RECENT','UNSPECIFIED'];
const BREAKDOWNS = ['SEASON','RECENT_6','OPPONENT','BATTING_ORDER','POSITION'];

const responseSchema = {
  type:'OBJECT',
  properties:{
    mode:{type:'STRING',enum:MODES},
    confidence:{type:'STRING',enum:['HIGH','MEDIUM','LOW']},
    understoodRequest:{type:'STRING'},
    routeReason:{type:'STRING'},
    players:{type:'ARRAY',items:{type:'STRING'}},
    domains:{type:'ARRAY',items:{type:'STRING',enum:DOMAINS}},
    timeScope:{type:'STRING',enum:TIMES},
    specificSeason:{type:'STRING'},
    metric:{type:'STRING'},
    opponent:{type:'STRING'},
    breakdowns:{type:'ARRAY',items:{type:'STRING',enum:BREAKDOWNS}},
    clarificationQuestion:{type:'STRING'},
    needsData:{type:'BOOLEAN'}
  },
  required:['mode','confidence','understoodRequest','routeReason','players','domains','timeScope','specificSeason','metric','opponent','breakdowns','clarificationQuestion','needsData']
};

const SYSTEM = `
あなたは《MAGI》の最上流にある質問理解エンジン。回答は作らない。ユーザーが本当に何を求めているかを、文全体の意味から構造化する。

最優先方針は ACCURACY FIRST。処理時間より意味理解と正確性を優先する。単語1個の一致だけで処理を決めてはいけない。

判断するもの:
- mode: SINGLE_VALUE / SUMMARY / FULL_REPORT / COMPARISON / DELIBERATION / DOCUMENT_SEARCH / GENERAL / CLARIFY
- players: 対象選手
- domains: BATTING / PITCHING / FIELDING など
- timeScope: 通算、今季、前年、特定年度、直近など
- metric: 単一指標を尋ねている場合の指標名
- opponent: 特定の相手校が指定されている場合
- breakdowns: 年度別、直近6試合、相手校別、打順別、ポジション別など、ユーザーが求める内訳

重要:
- 「投手成績一覧」「打撃成績一覧」「守備成績一覧」「全部見せて」「詳しい成績」「通算成績を一覧で」は FULL_REPORT。
- 「防御率は？」「打率は？」「OPSは？」のように1指標だけなら SINGLE_VALUE。
- 「投手成績は？」「打撃成績は？」のように主要値を簡潔に知りたいだけなら SUMMARY。ただし「一覧」「全部」「詳しく」等があれば FULL_REPORT。
- 「打順別成績」「1番を打った時の成績」は打順を決める相談ではない。BATTING の事実照会で、FULL_REPORT + BATTING_ORDER。
- 「相手校別成績」「坂井中戦の成績」は事実照会。該当する領域の FULL_REPORT + OPPONENT。起用判断ではない。
- 「ポジション別守備成績」は FIELDING の事実照会で FULL_REPORT + POSITION。データ不足かどうかは後段で判断するので、ここでは意味だけ理解する。
- 「4番にするべき」「先発させるべき」「クローザー固定はどうか」「評価して」「どちらを起用」は DELIBERATION。
- 「成績」だけで打撃・投手・守備を一意に決められないなら CLARIFY。勝手に打撃へ寄せない。
- 選手名は officialPlayers を基準にする。typedGroundedPlayers は現在の入力文字列から機械的に確認済み、contextGroundedPlayers は直前文脈から安全に引き継げる候補である。
- 読み・音が似ているだけの別人や存在しない選手を作らない。ひらがな・カタカナだけから漢字名を確定するのは、登録済み別名などの根拠がある場合だけ。
- 前後文脈がある場合は直近の確定事項を保持するが、矛盾する最新の明示指示を優先する。
- 旧チーム選手を「次の試合」「今のチーム」の起用候補として扱う場合、仮定の話だと文脈で明確でない限り確認する。
- 「今日」「昨日」などの相対日時は currentDateJst を基準に解釈する。別の日の「直近の試合」「直近の敗戦」へ勝手に読み替えない。
- breakdowns はユーザーが明示したものに加え、FULL_REPORTで標準表示として有用なものを含めてもよい。ただし領域に不適切な内訳は入れない。
- confidence が HIGH でない、または実質的に複数解釈が残るなら CLARIFY。
- understoodRequest はユーザーの意図を膨らませず、日本語1文で具体的に言い換える。
`;

function clean(v,max=1000){return String(v??'').trim().slice(0,max)}
function uniq(a){return [...new Set((Array.isArray(a)?a:[]).map(x=>clean(x,200)).filter(Boolean))]}
function normalizeContext(value){
  if(!Array.isArray(value))return[];
  return value.slice(-10).map(item=>typeof item==='string'?{role:'user',text:clean(item,2500)}:{role:clean(item?.role||'user',20),text:clean(item?.text??item?.content,2500)}).filter(x=>x.text);
}
function compact(v){return canonicalizeKnownNameText(clean(v,4000)).replace(/[\s　]/g,'')}
function playersInText(value){
  const raw=clean(value,4000),q=canonicalizeKnownNameText(raw),c=compact(q),found=[];
  for(const name of OFFICIAL_PLAYER_REGISTRY){
    const nc=name.replace(/[\s　]/g,'');
    if(q.includes(name)||c.includes(nc)){found.push(name);continue}
    const parts=name.split(' ').filter(Boolean);
    for(const part of parts){
      if(part.length<2||!raw.includes(part))continue;
      const owners=OFFICIAL_PLAYER_REGISTRY.filter(x=>x.split(' ').includes(part));
      if(owners.length===1){found.push(name);break}
    }
  }
  return [...new Set(found)];
}
function typedPlayers(question){return playersInText(question)}
function mayCarryContextPlayer(question){
  const q=clean(question,4000);
  if(!q)return false;
  return /(?:それ|その|この|あれ|さっき|じゃあ|なら|なんで|評価して|評価は|2\s*打席|二\s*打席|今季|通算|直近|最近|成績|どう[？?]?$)/.test(q);
}
function latestContextPlayer(context){
  if(!mayCarryContextPlayer(context?.question||''))return'';
  const items=Array.isArray(context?.items)?[...context.items].reverse():[];
  for(const item of items){
    if(!['user','assistant'].includes(String(item?.role||'').toLowerCase()))continue;
    const found=playersInText(item?.text);
    if(found.length===1)return found[0];
    if(found.length>1)return'';
  }
  return'';
}
function hasGameAnchor(context){
  const items=Array.isArray(context)?context:[];
  return items.slice(-6).some(item=>/(?:試合|対戦|vs\.?|ＶＳ|公式戦|練習試合|相手|先発|スコア|勝山|坂井中|三国中)/i.test(String(item?.text||'')));
}
function currentDateJst(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const map=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function clarifyResult(question,message,reason,players=[]){
  return {
    semanticVersion:SEMANTIC_REQUEST_VERSION,
    mode:'CLARIFY',confidence:'LOW',understoodRequest:clean(question,700),routeReason:reason,
    players,domains:[],timeScope:'UNSPECIFIED',specificSeason:'',metric:'',opponent:'',breakdowns:[],
    clarificationQuestion:message,needsData:false,groundedPlayers:players,preflightApplied:true
  };
}
function deterministicPreflight(question,suppliedContext,directGrounded,contextGrounded){
  const q=clean(question,4000);
  const grounded=directGrounded.length?directGrounded:contextGrounded;

  if(/絶対.{0,6}勝てる/.test(q)&&!/(?:対|vs\.?|ＶＳ|戦|試合|相手)/i.test(q)&&!hasGameAnchor(suppliedContext)){
    return clarifyResult(q,'どの試合についてですか？','対象試合が特定できないため、勝敗予測へ進まない。',grounded);
  }
  if(/(?:2|二)\s*打席/.test(q)&&/評価/.test(q)&&grounded.length!==1){
    return clarifyResult(q,'誰の2打席についてですか？','評価対象の選手が特定できないため、母数不足判定へ進まない。',grounded);
  }
  if(/昨日/.test(q)&&/(?:試合|負け|敗因|勝ち|勝った|負けた|戦)/.test(q)&&!hasGameAnchor(suppliedContext)){
    return clarifyResult(q,'昨日のどの試合についてですか？ 対戦相手を教えてください。','相対日時は解決できるが、対象試合を一意に特定できる試合文脈がない。',grounded);
  }
  if(grounded.length===1&&THIRD_YEAR_ROSTER.includes(grounded[0])&&/(?:次の試合|今度の試合|今のチーム|先発|スタメン|クローザー|4番|四番|起用)/.test(q)){
    return clarifyResult(q,`「${grounded[0]}」は旧チームの選手です。仮定として現チームの起用案に含める話ですか？`,'旧チーム選手を現チーム起用へ自動混入しない。',grounded);
  }
  if(grounded.length===1&&/固定(?:どう|でいい|した方が|する)/.test(q)&&!/(?:捕手|キャッチャー|打順|[1-9１-９一二三四五六七八九]番|クローザー|抑え|先発|中継ぎ|救援|一塁|二塁|三塁|遊撃|ショート|レフト|センター|ライト|外野|内野|投手)/.test(q)){
    return clarifyResult(q,`「${grounded[0]}」を何に固定する話ですか？ 役割やポジションを教えてください。`,'固定対象の役割が複数解釈できる。',grounded);
  }
  return null;
}
function normalize(raw,question,grounded){
  let mode=MODES.includes(String(raw?.mode||'').toUpperCase())?String(raw.mode).toUpperCase():'CLARIFY';
  let confidence=['HIGH','MEDIUM','LOW'].includes(String(raw?.confidence||'').toUpperCase())?String(raw.confidence).toUpperCase():'LOW';
  const domains=uniq(raw?.domains).map(x=>x.toUpperCase()).filter(x=>DOMAINS.includes(x));
  const breakdowns=uniq(raw?.breakdowns).map(x=>x.toUpperCase()).filter(x=>BREAKDOWNS.includes(x));
  const modelPlayers=[];
  for(const p of Array.isArray(raw?.players)?raw.players:[]){const c=canonicalPlayerNameStrict(clean(p,100));if(c&&!modelPlayers.includes(c))modelPlayers.push(c)}
  const players=grounded.length===1?grounded:modelPlayers.filter(p=>grounded.includes(p));
  const timeScope=TIMES.includes(String(raw?.timeScope||'').toUpperCase())?String(raw.timeScope).toUpperCase():'UNSPECIFIED';
  let clarificationQuestion=clean(raw?.clarificationQuestion,500);

  const playerModes=new Set(['SINGLE_VALUE','SUMMARY','FULL_REPORT','COMPARISON','DELIBERATION']);
  if(playerModes.has(mode)&&modelPlayers.length&&players.length!==modelPlayers.length){mode='CLARIFY';confidence='LOW';clarificationQuestion='対象の選手名を正確に確認できませんでした。選手名をもう一度入力してください。'}
  if(['SINGLE_VALUE','SUMMARY','FULL_REPORT'].includes(mode)&&domains.filter(d=>['BATTING','PITCHING','FIELDING'].includes(d)).length!==1){mode='CLARIFY';confidence='LOW';clarificationQuestion=clarificationQuestion||'打撃・投手・守備のどの成績を確認しますか？'}
  if(['SINGLE_VALUE','SUMMARY','FULL_REPORT'].includes(mode)&&players.length!==1){mode='CLARIFY';confidence='LOW';clarificationQuestion=clarificationQuestion||'誰の成績を確認しますか？'}
  if(confidence!=='HIGH'&&mode!=='GENERAL'){mode='CLARIFY';clarificationQuestion=clarificationQuestion||'質問の意味を正確に確認したいので、知りたい内容をもう少し具体的に教えてください。'}
  return {
    semanticVersion:SEMANTIC_REQUEST_VERSION,
    mode,confidence,
    understoodRequest:clean(raw?.understoodRequest,700)||clean(question,700),
    routeReason:clean(raw?.routeReason,700),players,domains,timeScope,
    specificSeason:clean(raw?.specificSeason,50),metric:clean(raw?.metric,100),opponent:clean(raw?.opponent,120),
    breakdowns,clarificationQuestion,needsData:raw?.needsData!==false,
    groundedPlayers:grounded,preflightApplied:false
  };
}

export async function understandRequest(questionValue,contextValue=[]){
  const question=clean(questionValue,4000);if(!question)throw new Error('question is required');
  const suppliedContext=normalizeContext(contextValue);
  const directGrounded=typedPlayers(question);
  const carriedPlayer=directGrounded.length===0&&mayCarryContextPlayer(question)
    ? latestContextPlayer({question,items:suppliedContext}) : '';
  const contextGrounded=carriedPlayer?[carriedPlayer]:[];
  const grounded=directGrounded.length?directGrounded:contextGrounded;

  const preflight=deterministicPreflight(question,suppliedContext,directGrounded,contextGrounded);
  if(preflight)return preflight;

  const raw=await callGemini({
    systemInstruction:SYSTEM,
    userPayload:{
      question:canonicalizeKnownNameText(question),suppliedContext,officialPlayers:OFFICIAL_PLAYER_REGISTRY,
      typedGroundedPlayers:directGrounded,contextGroundedPlayers:contextGrounded,currentDateJst:currentDateJst(),mode:'ACCURACY_FIRST',
      instruction:'質問に答えず、意味だけを構造化してください。速度より正確性を優先してください。読みだけから未登録の漢字名を作らないでください。相対日時を別の直近試合へ置換しないでください。'
    },
    responseSchema
  });
  return normalize(raw,question,grounded);
}
