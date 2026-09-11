import { callGemini } from './_gemini.js';
import { OFFICIAL_PLAYER_REGISTRY, canonicalPlayerNameStrict, canonicalizeKnownNameText } from './_roster.js';

export const SEMANTIC_REQUEST_VERSION = 'semantic-request-v2-accuracy-first';

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

入力には originalQuestion（ユーザーが実際に入力した原文）と normalizedQuestion（既知の正式表記候補へ機械的に正規化した文）の両方がある。normalizedQuestion は照合補助にだけ使い、originalQuestion に存在しない意味を勝手に追加してはいけない。

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

名前処理:
- 選手名は officialPlayers を唯一の正式表記基準にする。
- typedGroundedPlayers が1人なら、その人物は文字列から機械的に候補化できている。ただし originalQuestion でフルネームの漢字・読み・表記が正式名と異なる場合は、勝手に確定せず CLARIFY で「○○のことですか？」と短く確認する。
- 姓だけの入力は、その姓が officialPlayers 内で一意なら人物候補として扱ってよい。複数候補なら必ず CLARIFY。
- 名だけ・読みだけ・ニックネーム的入力は、現旧年度をまたいで複数候補になり得る。文脈で一意にできなければ CLARIFY。
- 音の似た別人や存在しない選手を作らない。

文脈と時系列:
- 前後文脈がある場合は直近の確定事項を保持するが、矛盾する最新の明示指示を優先する。
- currentDateJst は「今日」「昨日」などを解釈する基準日。相対日時を「最近」「直近の試合」「直近の敗戦」へ勝手に置換してはいけない。
- 「昨日の試合」のように日付だけで対象試合が一意か確認できない場合、suppliedContext に一意な試合情報がなければ CLARIFY。対戦相手などが明示されて対象が十分具体的なら、その意味を保ったまま構造化する。
- 「絶対勝てる」などの断定要求でも、対象試合が不明なら CLARIFY。対象が明確でも「絶対」という前提を事実扱いしない。

安全な聞き返し:
- confidence が HIGH でない、または実質的に複数解釈が残るなら CLARIFY。
- 対象人物、対象試合、役割、評価軸など結論の前提が欠ける場合、推測で補完せず CLARIFY。
- 聞き返しは必要最小限。すでに suppliedContext で一意に確定していることを再質問しない。
- understoodRequest はユーザーの意図を膨らませず、日本語1文で具体的に言い換える。
- breakdowns はユーザーが明示したものに加え、FULL_REPORTで標準表示として有用なものを含めてもよい。ただし領域に不適切な内訳は入れない。
`;

function clean(v,max=1000){return String(v??'').trim().slice(0,max)}
function uniq(a){return [...new Set((Array.isArray(a)?a:[]).map(x=>clean(x,200)).filter(Boolean))]}
function normalizeContext(value){
  if(!Array.isArray(value))return[];
  return value.slice(-10).map(item=>typeof item==='string'?{role:'user',text:clean(item,2500)}:{role:clean(item?.role||'user',20),text:clean(item?.text??item?.content,2500)}).filter(x=>x.text);
}
function compact(v){return canonicalizeKnownNameText(clean(v,4000)).replace(/[\s　]/g,'')}
function typedPlayers(question){
  const q=canonicalizeKnownNameText(clean(question,4000));
  const c=compact(q),found=[];
  for(const name of OFFICIAL_PLAYER_REGISTRY){
    const nc=name.replace(/[\s　]/g,'');
    if(q.includes(name)||c.includes(nc)){found.push(name);continue}
    const parts=name.split(' ').filter(Boolean);
    for(const part of parts){
      if(part.length<2||!q.includes(part))continue;
      const owners=OFFICIAL_PLAYER_REGISTRY.filter(x=>x.split(' ').includes(part));
      if(owners.length===1){found.push(name);break}
    }
  }
  return [...new Set(found)];
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
    groundedPlayers:grounded
  };
}

export async function understandRequest(questionValue,contextValue=[],options={}){
  const question=clean(questionValue,4000);if(!question)throw new Error('question is required');
  const suppliedContext=normalizeContext(contextValue),grounded=typedPlayers(question);
  const normalizedQuestion=canonicalizeKnownNameText(question);
  const currentDateJst=clean(options?.currentDateJst,20)||new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
  const raw=await callGemini({
    systemInstruction:SYSTEM,
    userPayload:{
      originalQuestion:question,
      normalizedQuestion,
      question:normalizedQuestion,
      suppliedContext,
      currentDateJst,
      officialPlayers:OFFICIAL_PLAYER_REGISTRY,
      typedGroundedPlayers:grounded,
      mode:'ACCURACY_FIRST',
      instruction:'質問に答えず、意味だけを構造化してください。速度より正確性を優先してください。'
    },
    responseSchema
  });
  return normalize(raw,question,grounded);
}
