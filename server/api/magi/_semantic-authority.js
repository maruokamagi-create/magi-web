import { callGemini } from './_gemini.js';
import {
  OFFICIAL_PLAYER_REGISTRY,
  CURRENT_ROSTER,
  THIRD_YEAR_ROSTER,
  canonicalPlayerNameStrict,
  canonicalizeKnownNameText
} from './_roster.js';

export const SEMANTIC_AUTHORITY_VERSION='semantic-authority-v1-gemini-first';

const MODES=['SINGLE_VALUE','SUMMARY','FULL_REPORT','COMPARISON','DELIBERATION','DOCUMENT_SEARCH','GENERAL','CLARIFY'];
const DOMAINS=['BATTING','PITCHING','FIELDING','RUNNING','LINEUP','TACTICS','DEVELOPMENT','TEAM','DOCUMENTS','OTHER'];
const TIMES=['CAREER','CURRENT_SEASON','PREVIOUS_SEASON','SPECIFIC_SEASON','RECENT_6','RECENT','UNSPECIFIED'];
const BREAKDOWNS=['SEASON','RECENT_6','OPPONENT','BATTING_ORDER','POSITION'];
const SELECTION_KINDS=['NONE','FULL_LINEUP','PITCHING_PLAN','GENERIC_SELECTION'];

const responseSchema={
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
    selectionKind:{type:'STRING',enum:SELECTION_KINDS},
    clarificationQuestion:{type:'STRING'},
    needsData:{type:'BOOLEAN'}
  },
  required:['mode','confidence','understoodRequest','routeReason','players','domains','timeScope','specificSeason','metric','opponent','breakdowns','selectionKind','clarificationQuestion','needsData']
};

const SYSTEM=`
あなたは《MAGI》の最上流にある唯一の質問理解・処理選択エンジンです。
回答そのものは作りません。ユーザーの文全体と直前文脈を理解し、「何を求めているか」「次にどの処理へ進むべきか」だけを構造化してください。

最重要原則:
- SEMANTIC FIRST。単語や正規表現の一致だけで意図を決めない。
- ACCURACY FIRST。曖昧なら推測せず CLARIFY。
- 質問者の言い回しが多少崩れていても、文全体の意味と直前文脈から理解する。
- 選手名は officialPlayers だけを正本とし、存在しない名前を作らない。
- currentRoster は現チーム、thirdYearRoster は引退済み旧チーム。現在の起用相談へ旧チーム選手を自動混入しない。
- あなたの出力は後段コードでロスター・データ・安全ルールの検証を受ける。後段コードが意味を決め直す前提ではない。

mode:
- SINGLE_VALUE: 1つの数値・事実を聞く。
- SUMMARY: 主要成績や状態を簡潔に知りたい。
- FULL_REPORT: 打撃・投手・守備などの一覧・詳細を求める。
- COMPARISON: 複数選手・複数案を比較したいが、最終起用判断そのものではない。
- DELIBERATION: 打順、起用、先発、クローザー、主将、守備配置など、判断・選定・評価を3賢人に審議させる。
- DOCUMENT_SEARCH: 特定資料を探す・読む・確認する。
- GENERAL: 上記に当てはまらない一般的な確認。
- CLARIFY: 対象・意味・条件が一意でない。

selectionKind:
- FULL_LINEUP: 現チーム全体から1番〜9番のベストオーダー・打順を組む審議。
- PITCHING_PLAN: 先発〜継投〜終盤〜抑え等、複数投手の運用を組む審議。
- GENERIC_SELECTION: その他の起用・候補選定。
- NONE: 選択審議ではない。

具体例:
- 「現時点のベストオーダーを審議して」→ DELIBERATION / FULL_LINEUP。
- 「今の14人で公式戦の1〜9番を組んで」→ DELIBERATION / FULL_LINEUP。
- 「7回制の投手運用を考えて」→ DELIBERATION / PITCHING_PLAN。
- 「大野 竜暉の出塁率は？」→ SINGLE_VALUE / BATTING。
- 「大野 竜暉の打撃成績一覧」→ FULL_REPORT / BATTING。
- 「大野と坂田を比較して」→ COMPARISON。比較軸が不明なら CLARIFY。
- 「誰を4番にするべき？」→ DELIBERATION / GENERIC_SELECTION。
- 「今日のベストオーダー」のように当日条件が結果を大きく左右し、対戦相手や欠場者など必要条件が不明なら CLARIFY。

重要:
- 「ベストオーダー」という語があるからではなく、文全体として1〜9番を組む要求なら FULL_LINEUP と判断する。
- 相手投手の左右が事前に不明な通常の標準ベストオーダーは、それだけを理由に CLARIFY にしない。
- 「打順別成績」「1番を打った時の成績」は打順審議ではなく成績照会。
- 「成績」だけで打撃・投手・守備が特定できないなら CLARIFY。
- 直前文脈の確定事項と、ユーザーの最新の訂正を優先する。
- confidence が HIGH でない場合は原則 CLARIFY。
- understoodRequest は、意図を膨らませず日本語1文で具体化する。
`;

function clean(v,max=1000){return String(v??'').trim().slice(0,max)}
function uniq(values){return [...new Set((Array.isArray(values)?values:[]).map(v=>clean(v,200)).filter(Boolean))]}
function normalizeContext(value){
  if(!Array.isArray(value))return[];
  return value.slice(-10).map(item=>typeof item==='string'
    ? {role:'user',text:clean(item,2500)}
    : {role:clean(item?.role||'user',20),text:clean(item?.text??item?.content,2500)}
  ).filter(x=>x.text);
}
function currentDateJst(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const map=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function namesInText(value){
  const text=canonicalizeKnownNameText(clean(value,5000));
  return OFFICIAL_PLAYER_REGISTRY.filter(name=>text.includes(name));
}
function contextNames(context){
  const items=Array.isArray(context)?[...context].reverse():[];
  for(const item of items){
    const names=namesInText(item?.text);
    if(names.length)return names;
  }
  return[];
}
function usesContextReference(question){
  return /(?:それ|その|この|あれ|さっき|じゃあ|なら|今の|直近|最近|前の|同じ|その選手|この選手)/.test(String(question||''));
}
function ambiguousSurname(question){
  const raw=clean(question,5000);
  const groups=new Map();
  for(const name of OFFICIAL_PLAYER_REGISTRY){
    const surname=name.split(' ')[0];
    if(!groups.has(surname))groups.set(surname,[]);
    groups.get(surname).push(name);
  }
  for(const [surname,owners] of groups){
    if(owners.length<2||!raw.includes(surname))continue;
    const canon=canonicalizeKnownNameText(raw);
    if(!owners.some(name=>canon.includes(name)))return {surname,owners};
  }
  return null;
}
function explicitGameInnings(question){
  const q=String(question||'').normalize('NFKC');
  if(/(?:9回制|9イニング|九回制|九イニング)/.test(q))return 9;
  if(/(?:7回制|7イニング|七回制|七イニング)/.test(q))return 7;
  return null;
}
function clarification(message,reason,base={}){
  return {
    ...base,
    semanticVersion:SEMANTIC_AUTHORITY_VERSION,
    mode:'CLARIFY',confidence:'LOW',selectionKind:'NONE',
    clarificationQuestion:message,routeReason:reason,needsData:false,
    validated:true,semanticAuthority:'GEMINI_FIRST'
  };
}
function normalizeModel(raw,question,context){
  const mode=MODES.includes(String(raw?.mode||'').toUpperCase())?String(raw.mode).toUpperCase():'CLARIFY';
  const confidence=['HIGH','MEDIUM','LOW'].includes(String(raw?.confidence||'').toUpperCase())?String(raw.confidence).toUpperCase():'LOW';
  const domains=uniq(raw?.domains).map(x=>x.toUpperCase()).filter(x=>DOMAINS.includes(x));
  const timeScope=TIMES.includes(String(raw?.timeScope||'').toUpperCase())?String(raw.timeScope).toUpperCase():'UNSPECIFIED';
  const breakdowns=uniq(raw?.breakdowns).map(x=>x.toUpperCase()).filter(x=>BREAKDOWNS.includes(x));
  const selectionKind=SELECTION_KINDS.includes(String(raw?.selectionKind||'').toUpperCase())?String(raw.selectionKind).toUpperCase():'NONE';
  const direct=namesInText(question);
  const carried=direct.length?[]:(usesContextReference(question)?contextNames(context):[]);
  const grounded=[...new Set([...direct,...carried])];
  const rawPlayers=uniq(raw?.players);
  const canonicalPlayers=[];
  const invalidPlayers=[];
  for(const name of rawPlayers){
    const canonical=canonicalPlayerNameStrict(name);
    if(!canonical)invalidPlayers.push(name);
    else if(!canonicalPlayers.includes(canonical))canonicalPlayers.push(canonical);
  }
  const base={
    semanticVersion:SEMANTIC_AUTHORITY_VERSION,
    mode,confidence,
    understoodRequest:clean(raw?.understoodRequest,700)||clean(question,700),
    routeReason:clean(raw?.routeReason,700),
    players:canonicalPlayers,domains,timeScope,
    specificSeason:clean(raw?.specificSeason,50),metric:clean(raw?.metric,100),opponent:clean(raw?.opponent,120),
    breakdowns,selectionKind,
    clarificationQuestion:clean(raw?.clarificationQuestion,500),
    needsData:raw?.needsData!==false,
    gameInnings:explicitGameInnings(question),
    groundedPlayers:grounded,
    validated:true,semanticAuthority:'GEMINI_FIRST'
  };

  const ambiguous=ambiguousSurname(question);
  if(ambiguous){
    return clarification(`「${ambiguous.surname}」は複数の選手がいます。フルネームで指定してください。`,'同姓選手が複数いるため、コード検証で対象人物を一意に確定できない。',base);
  }
  if(invalidPlayers.length){
    return clarification('対象の選手名を公式ロスターと照合できませんでした。選手名を確認してください。','Geminiが返した選手名を公式ロスターで検証できない。',base);
  }
  if(canonicalPlayers.length&&grounded.length&&canonicalPlayers.some(name=>!grounded.includes(name))){
    return clarification('対象の選手名を入力内容または直前文脈から安全に確認できませんでした。選手名を確認してください。','Geminiの人物解釈が入力・文脈で接地されていない。',base);
  }
  if(confidence!=='HIGH'&&mode!=='CLARIFY'){
    return clarification(base.clarificationQuestion||'質問の意味を正確に確認したいので、知りたいことをもう少し具体的に教えてください。','Geminiの質問理解確信度がHIGHではない。',base);
  }
  if(mode==='CLARIFY'){
    return clarification(base.clarificationQuestion||'質問の意味を正確に確認したいので、もう少し具体的に教えてください。',base.routeReason||'Geminiが複数解釈を検出した。',base);
  }
  if(['SINGLE_VALUE','SUMMARY','FULL_REPORT'].includes(mode)){
    const statDomains=domains.filter(d=>['BATTING','PITCHING','FIELDING'].includes(d));
    if(statDomains.length!==1)return clarification('打撃・投手・守備のどの成績を確認しますか？','成績照会の領域が一意でない。',base);
    if(canonicalPlayers.length!==1)return clarification('誰の成績を確認しますか？','個人成績照会の対象選手が一意でない。',base);
  }
  if(selectionKind==='FULL_LINEUP'){
    if(mode!=='DELIBERATION'||!domains.includes('LINEUP'))return clarification('ベストオーダーを審議する依頼として処理してよいですか？','Gemini出力のmodeとFULL_LINEUPが整合しない。',base);
  }
  if(selectionKind==='PITCHING_PLAN'){
    if(mode!=='DELIBERATION'||!domains.includes('PITCHING'))return clarification('投手運用を審議する依頼として処理してよいですか？','Gemini出力のmodeとPITCHING_PLANが整合しない。',base);
  }
  if(mode==='DELIBERATION'&&['CURRENT_SEASON','UNSPECIFIED'].includes(timeScope)){
    const retired=canonicalPlayers.filter(name=>THIRD_YEAR_ROSTER.includes(name));
    if(retired.length&&!/仮定|もし|旧チーム|前のチーム|3年生|三年生/.test(question)){
      return clarification(`「${retired.join('・')}」は旧チームの選手です。仮想条件として現チームの審議に含める話ですか？`,'引退済み旧チーム選手を現チーム起用へ自動混入しない。',base);
    }
  }
  if(selectionKind==='FULL_LINEUP'&&canonicalPlayers.some(name=>!CURRENT_ROSTER.includes(name))){
    return clarification('現チームのベストオーダーに旧チーム選手が含まれる解釈になっています。対象年度を確認してください。','FULL_LINEUPは現チーム14名を対象とする。',base);
  }
  return base;
}

export async function understandRequestGeminiFirst(questionValue,contextValue=[]){
  const question=clean(questionValue,4000);
  if(!question)throw new Error('question is required');
  const context=normalizeContext(contextValue);
  try{
    const raw=await callGemini({
      systemInstruction:SYSTEM,
      userPayload:{
        question:canonicalizeKnownNameText(question),
        suppliedContext:context,
        officialPlayers:OFFICIAL_PLAYER_REGISTRY,
        currentRoster:CURRENT_ROSTER,
        thirdYearRoster:THIRD_YEAR_ROSTER,
        currentDateJst:currentDateJst(),
        instruction:'最初に質問全体の意味を理解し、次に進む処理を構造化してください。回答そのものは作らないでください。'
      },
      responseSchema
    });
    return normalizeModel(raw,question,context);
  }catch(error){
    return clarification('質問理解エンジンを安全に実行できませんでした。もう一度実行してください。',`Gemini質問理解失敗: ${clean(error?.message,180)}`,{
      understoodRequest:question,players:[],domains:['OTHER'],timeScope:'UNSPECIFIED',specificSeason:'',metric:'',opponent:'',breakdowns:[]
    });
  }
}
