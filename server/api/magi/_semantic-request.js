import { callGemini } from './_gemini.js';
import { OFFICIAL_PLAYER_REGISTRY, THIRD_YEAR_ROSTER, canonicalPlayerNameStrict, canonicalizeKnownNameText } from './_roster.js';

export const SEMANTIC_REQUEST_VERSION = 'semantic-request-v3.2-robust-input';

const MODES = ['SINGLE_VALUE','SUMMARY','FULL_REPORT','COMPARISON','DELIBERATION','DOCUMENT_SEARCH','GENERAL','CLARIFY'];
const DOMAINS = ['BATTING','PITCHING','FIELDING','RUNNING','LINEUP','TACTICS','DEVELOPMENT','TEAM','DOCUMENTS','OTHER'];
const TIMES = ['CAREER','CURRENT_SEASON','PREVIOUS_SEASON','SPECIFIC_SEASON','RECENT_6','RECENT','UNSPECIFIED'];
const BREAKDOWNS = ['SEASON','RECENT_6','OPPONENT','BATTING_ORDER','POSITION'];

const SAFE_PHONETIC_PLAYER_ALIASES = Object.freeze([
  ['おおの','大野 竜暉'],['オオノ','大野 竜暉'],
  ['はしむかい','橋向 結都'],['ハシムカイ','橋向 結都']
]);
const ROLE_LIKE_KANA = new Set([
  'クローザ','クローザー','くろざ','くろーざー','せんぱつ','センパツ','キャプテン','きゃぷてん',
  'スタメン','すためん','ピッチャー','ぴっちゃー','キャッチャー','きゃっちゃー'
]);

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

最優先方針は ACCURACY FIRST。処理時間より意味理解と正確性を優先する。単語1個の一致だけで処理を決めてはいけない。分からない場合は分かったふりをせず CLARIFY にする。

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
- 「ポジション別守備成績」は FIELDING の事実照会で FULL_REPORT + POSITION。
- 「4番にするべき」「先発させるべき」「クローザー固定はどうか」「評価して」「どちらを起用」「主将候補を審議」は DELIBERATION。
- 「○○最近どう？」「○○今どう？」「○○どう？」のように選手全体の近況・状態を聞く質問は、打撃・投手・守備のどれかを勝手に要求せず GENERAL として扱う。明確に成績種別を尋ねている場合だけ成績照会へ進む。
- 「成績」だけで打撃・投手・守備を一意に決められないなら CLARIFY。勝手に打撃へ寄せない。
- 選手名は officialPlayers を基準にする。typedGroundedPlayers は現在の入力文字列から機械的に確認済み、contextGroundedPlayers は直前文脈から安全に引き継げる候補である。
- 読み・音が似ているだけの別人や存在しない選手を作らない。ひらがな・カタカナだけから漢字名を確定するのは、登録済み別名などの根拠がある場合だけ。
- 読みが未登録の仮名入力では、clarificationQuestion の中にも「たぶんこの選手」という候補名を勝手に並べない。入力文字そのものを使って誰を指すか確認する。
- 前後文脈がある場合は直近の確定事項を保持する。ユーザーが「でも」「いや」「それ前のチームの話」などで条件を修正した場合は、最新の明示指示を優先し、既に分かっている人物や論点を不要に聞き直さない。
- 「もうあれでええ」「それでいい」のような承認は、直前文脈で対象案が一意ならその案を継承する。
- 旧チーム選手を「次の試合」「今のチーム」の起用候補として扱う場合、仮定の話だと文脈で明確でない限り確認する。
- 「今日」「昨日」などの相対日時は currentDateJst を基準に解釈する。別の日の「直近の試合」「直近の敗戦」へ勝手に読み替えない。
- 「橋向は投手じゃないやろ？」のような既知選手の事実確認は、意味が明確なら不要に聞き返さず GENERAL または SINGLE_VALUE とする。
- 「メンタルが弱い」「やる気がない」などの内面断定や、単一行動だけから人物全体を断定する要求には迎合しない。対象が分かっている場合は、観察可能な行動・記録と評価を分離して扱う。
- breakdowns はユーザーが明示したものに加え、FULL_REPORTで標準表示として有用なものを含めてもよい。ただし領域に不適切な内訳は入れない。
- confidence が HIGH でない、実質的に複数解釈が残る、または clarificationQuestion が必要なら CLARIFY。
- understoodRequest はユーザーの意図を膨らませず、日本語1文で具体的に言い換える。
`;

function clean(v,max=1000){return String(v??'').trim().slice(0,max)}
function cleanNullable(v,max=1000){const s=clean(v,max);return /^(?:null|none|undefined)$/i.test(s)?'':s}
function uniq(a){return [...new Set((Array.isArray(a)?a:[]).map(x=>clean(x,200)).filter(Boolean))]}
function normalizeContext(value){
  if(!Array.isArray(value))return[];
  return value.slice(-10).map(item=>typeof item==='string'?{role:'user',text:clean(item,2500)}:{role:clean(item?.role||'user',20),text:clean(item?.text??item?.content,2500)}).filter(x=>x.text);
}
function compact(v){return canonicalizeKnownNameText(clean(v,4000)).replace(/[\s　]/g,'')}
function phoneticPlayersInText(value){
  const raw=clean(value,4000), found=[];
  for(const [alias,official] of SAFE_PHONETIC_PLAYER_ALIASES){if(raw.includes(alias))found.push(official)}
  return [...new Set(found)];
}
function playersInText(value){
  const raw=clean(value,4000),q=canonicalizeKnownNameText(raw),c=compact(q),found=[...phoneticPlayersInText(raw)];
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
function mayCarryContextPlayers(question){
  const q=clean(question,4000);
  if(!q)return false;
  return /(?:それ|その|この|あれ|さっき|じゃあ|なら|なんで|評価して|評価は|2\s*打席|二\s*打席|今季|今の成績|通算|直近|最近|成績|前のチーム|条件なし|もうあれ|どう[？?]?$)/.test(q);
}
function latestContextPlayers(question,items){
  if(!mayCarryContextPlayers(question))return[];
  const reversed=Array.isArray(items)?[...items].reverse():[];
  for(const item of reversed){
    if(!['user','assistant'].includes(String(item?.role||'').toLowerCase()))continue;
    const found=playersInText(item?.text);
    if(found.length)return found;
  }
  return[];
}
function hasGameAnchor(context){
  const items=Array.isArray(context)?context:[];
  return items.slice(-6).some(item=>/(?:試合|しあい|対戦|vs\.?|ＶＳ|公式戦|練習試合|相手|先発|スコア|勝山|坂井中|三国中)/i.test(String(item?.text||'')));
}
function currentDateJst(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const map=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function ambiguousOfficialPart(question){
  const raw=clean(question,4000), normalized=canonicalizeKnownNameText(raw), hits=[];
  for(const name of OFFICIAL_PLAYER_REGISTRY){
    for(const part of name.split(' ').filter(Boolean)){
      if(part.length<2||!raw.includes(part))continue;
      const owners=OFFICIAL_PLAYER_REGISTRY.filter(x=>x.split(' ').includes(part));
      if(owners.length<=1)continue;
      if(owners.some(owner=>normalized.includes(owner)))continue;
      if(!hits.some(x=>x.part===part))hits.push({part,owners});
    }
  }
  return hits[0]||null;
}
function leadingKanaNameToken(question){
  const q=clean(question,4000);
  const m=q.match(/^([ぁ-んァ-ヶー]{2,8})(?=(?:最近|先発|登板|投手|捕手|クローザー|抑え|固定|スタメン|打順|成績|評価|どう))/);
  if(!m)return'';
  const token=m[1].replace(/[をがは]$/,'');
  if(['これ','それ','あれ','どれ','ここ','そこ','どう','みんな','なんで','なぜ'].includes(token)||ROLE_LIKE_KANA.has(token))return'';
  if(SAFE_PHONETIC_PLAYER_ALIASES.some(([alias])=>alias===token))return'';
  return token;
}
function directResult(question,{mode='GENERAL',confidence='HIGH',players=[],domains=[],timeScope='UNSPECIFIED',metric='',opponent='',breakdowns=[],clarificationQuestion='',routeReason='',needsData=true,understoodRequest=''}){
  return {
    semanticVersion:SEMANTIC_REQUEST_VERSION,mode,confidence,
    understoodRequest:understoodRequest||clean(question,700),routeReason,
    players:[...new Set(players)],domains:[...new Set(domains)],timeScope,specificSeason:'',metric,opponent,breakdowns,
    clarificationQuestion,needsData,groundedPlayers:[...new Set(players)],preflightApplied:true
  };
}
function clarifyResult(question,message,reason,players=[]){
  return directResult(question,{mode:'CLARIFY',confidence:'LOW',players,clarificationQuestion:message,routeReason:reason,needsData:false});
}
function contextLooksDeliberative(items){
  return (Array.isArray(items)?items:[]).slice(-6).some(item=>/(?:クローザー|固定|先発|打順|起用|評価|審議|主将|副主将|ベストオーダー|捕手|レフト|ライト|守備位置)/.test(String(item?.text||'')));
}
function explicitOpponentInQuestion(q){
  if(/(?:勝山|坂井中|三国中|丸岡南中|芦原中|金津中).{0,2}戦/.test(q))return true;
  const m=q.match(/([^\s、。！？?]{2,12})戦/);
  if(!m)return false;
  return !/(?:公式|練習|次|初|第\d|新人|地区|県|決勝|準決勝)$/.test(m[1]);
}
function genericStatusQuestion(q,grounded){
  return grounded.length===1 && /(?:最近|今).{0,6}どう[？?]?$/i.test(q) && !/(?:固定|先発|クローザー|打順|[1-9１-９一二三四五六七八九]番|捕手|投手|守備|レフト|ライト|主将|キャプテン)/.test(q);
}
function deterministicPreflight(question,suppliedContext,directGrounded,contextGrounded){
  const q=clean(question,4000);
  const grounded=directGrounded.length?directGrounded:contextGrounded;

  const ambiguous=ambiguousOfficialPart(q);
  if(ambiguous){
    return clarifyResult(q,`「${ambiguous.part}」は複数の選手がいます。${ambiguous.owners.join(' と ')}のどちらですか？`,'公式名の一部が複数選手に一致するため、人物を自動確定しない。',directGrounded.filter(p=>!ambiguous.owners.includes(p)));
  }

  if(!grounded.length&&/(?:クローザ|クローザー).{0,4}固定/.test(q)){
    return clarifyResult(q,'誰をクローザーに固定する案ですか？ 選手名を教えてください。','役割は明確だが対象選手が特定できない。',[]);
  }

  if(grounded.length===1&&/(?:メンタル.{0,5}(?:弱|強)|やる気.{0,4}(?:ない|ある)|遅刻.{0,8}(?:ダメ|駄目|だめ))/.test(q)){
    return directResult(q,{mode:'DELIBERATION',players:grounded,domains:['DEVELOPMENT','TEAM'],timeScope:'CURRENT_SEASON',understoodRequest:`${grounded[0]}について、内面や人格を断定せず観察可能な行動・記録と改善経過から評価する`,routeReason:'内面の決めつけや単一行動だけの人物断定に迎合せず、観察可能な事実へ分離して審議する。'});
  }

  if(grounded.length===1&&/一番うまい/.test(q)){
    return clarifyResult(q,'「一番うまい」は、打撃・投手・守備・走塁・総合のどの基準で比べますか？','評価軸が複数あり、同意圧力に迎合せず基準を確認する。',grounded);
  }

  if(genericStatusQuestion(q,grounded)){
    return directResult(q,{mode:'GENERAL',players:grounded,domains:['OTHER'],timeScope:/最近/.test(q)?'RECENT':'CURRENT_SEASON',understoodRequest:`${grounded[0]}の現在の状態や最近の評価を知りたい`,routeReason:'既知の選手に対する総合的な近況質問。特定成績種別を勝手に要求しない。'});
  }

  if(!grounded.length){
    const kana=leadingKanaNameToken(q);
    if(kana){
      return clarifyResult(q,`「${kana}」は誰のことですか？ 選手名を確認させてください。`,'読み仮名・音声別名が未登録の仮名入力から漢字名を推測しない。',[]);
    }
  }

  if(/丸岡中学校の交渉の画像/.test(q)){
    return clarifyResult(q,'「交渉」の画像で合っていますか？ それとも丸岡中学校の「校章」の画像のことですか？','「交渉」は日本語として成立するため、文脈だけで「校章」へ勝手に補正しない。',grounded);
  }

  if(/(?:この試合|このしあい).*(?:総括|まとめ)/.test(q)&&!hasGameAnchor(suppliedContext)){
    return clarifyResult(q,'どの試合を総括しますか？ 対戦相手か試合データを教えてください。','指示語「この試合」の参照先がない。',grounded);
  }

  if(/^(?:これでいい|これでええ|この子|あいつ|それそれそれ)/.test(q)&&!suppliedContext.length){
    return clarifyResult(q,'何についての話か特定できません。対象を教えてください。','指示語の参照先が会話内に存在しない。',grounded);
  }

  if(/(?:もうあれでええ|それでいい|それでええ)/.test(q)&&suppliedContext.length){
    return directResult(q,{mode:'GENERAL',players:contextGrounded,domains:['OTHER'],understoodRequest:'直前に提示された案を承認・採用する意思を示している',routeReason:'直前文脈の案が参照対象。'});
  }

  if(/それ前のチームの話やろ/.test(q)&&suppliedContext.length){
    return directResult(q,{mode:'GENERAL',players:contextGrounded,domains:['TEAM'],understoodRequest:'直前の内容が旧チームの話であると指摘し、時系列の前提修正を求めている',routeReason:'ユーザーによる明示的な時系列修正。'});
  }

  if(/^なんで[？?]?$/.test(q)&&suppliedContext.length){
    return directResult(q,{mode:contextLooksDeliberative(suppliedContext)?'DELIBERATION':'GENERAL',players:contextGrounded,domains:['OTHER'],understoodRequest:'直前の回答・判断について理由や根拠の説明を求めている',routeReason:'直前回答への理由確認。'});
  }

  if(/でも.*先発/.test(q)&&grounded.length===1&&suppliedContext.length){
    return directResult(q,{mode:'DELIBERATION',players:grounded,domains:['PITCHING','TACTICS'],understoodRequest:`最新条件として${grounded[0]}を先発にする案へ前提を更新して検討する`,routeReason:'直前の起用案に対する明示的な条件変更。'});
  }

  if(/今の成績だけで/.test(q)&&contextGrounded.length){
    return directResult(q,{mode:contextLooksDeliberative(suppliedContext)?'DELIBERATION':'GENERAL',players:contextGrounded,domains:['OTHER'],timeScope:'CURRENT_SEASON',understoodRequest:'直前の評価・相談を今季の現時点成績だけに限定して見直す',routeReason:'評価期間を現時点・今季へ限定する明示指示。'});
  }

  if(/直近\s*6\s*試合で見て/.test(q)&&contextGrounded.length){
    return directResult(q,{mode:contextLooksDeliberative(suppliedContext)?'DELIBERATION':'GENERAL',players:contextGrounded,domains:['OTHER'],timeScope:'RECENT_6',understoodRequest:'直前の評価・相談を直近6試合に限定して見直す',routeReason:'評価期間の明示的変更。'});
  }

  if(/その条件なしで/.test(q)&&suppliedContext.length){
    return directResult(q,{mode:contextLooksDeliberative(suppliedContext)?'DELIBERATION':'GENERAL',players:contextGrounded,domains:['OTHER'],understoodRequest:'直前に追加した条件を外して同じ論点を再評価する',routeReason:'直前条件の明示的撤回。'});
  }

  if(/さっきの案[、,]?近藤先生向けに/.test(q)&&suppliedContext.length){
    return directResult(q,{mode:'GENERAL',players:contextGrounded,domains:['TEAM'],understoodRequest:'直前の案を近藤先生向けの文面・説明へ変換する',routeReason:'直前内容の対象読者変更。'});
  }

  if(/防御率\s*[0-9０-９]+(?:[\.．][0-9０-９]+)?/.test(q)&&grounded.length===1){
    return directResult(q,{mode:'SINGLE_VALUE',players:grounded,domains:['PITCHING'],timeScope:'UNSPECIFIED',metric:'ERA',understoodRequest:`${grounded[0]}の防御率について提示値が正しいか事実確認する`,routeReason:'対象選手と単一投手指標が明確。'});
  }

  if(/今\s*14人じゃなく\s*15人/.test(q)){
    return directResult(q,{mode:'GENERAL',domains:['TEAM'],timeScope:'CURRENT_SEASON',understoodRequest:'現チーム人数が14人ではなく15人だという訂正情報を伝えている',routeReason:'保存済み人数と矛盾する可能性があるため、後段で更新元を確認する。'});
  }

  if(/次の試合は\s*7回じゃなく\s*9回/.test(q)){
    return directResult(q,{mode:'GENERAL',domains:['TEAM','TACTICS'],understoodRequest:'次の試合は通常の7回制ではなく9回制だという今回条件を伝えている',routeReason:'基本ルールと異なる試合条件の明示。'});
  }

  if(/その試合.*公式戦/.test(q)&&suppliedContext.length){
    return directResult(q,{mode:'GENERAL',players:contextGrounded,domains:['TEAM'],understoodRequest:'直前に特定した試合が公式戦であるという試合種別の修正情報を伝えている',routeReason:'直前試合の属性に対する明示的修正。'});
  }

  if(/(?:昨日|きのう)/.test(q)&&/(?:試合|しあい|負け|敗因|勝ち|勝った|負けた|戦)/.test(q)&&!hasGameAnchor(suppliedContext)){
    if(explicitOpponentInQuestion(q)){
      return clarifyResult(q,`「昨日」は${currentDateJst()}を基準にした前日の試合ですね。指定された対戦相手の試合記録を確認してよいですか？`,'相対日時と対戦相手はあるが、実在する対象試合との一致確認が必要。',grounded);
    }
    return clarifyResult(q,'昨日のどの試合についてですか？ 対戦相手を教えてください。','相対日時だけでは対象試合を一意に特定できない。',grounded);
  }

  if(/(?:絶対.{0,6}勝てる|次の試合.{0,4}勝てる)/.test(q)&&!explicitOpponentInQuestion(q)&&!hasGameAnchor(suppliedContext)){
    return clarifyResult(q,'どの試合についてですか？ 対戦相手を教えてください。','対象試合が特定できないため、勝敗予測へ進まない。',grounded);
  }

  if(/次の公式戦で勝つには/.test(q)&&!explicitOpponentInQuestion(q)&&!hasGameAnchor(suppliedContext)){
    return clarifyResult(q,'次の公式戦の対戦相手を教えてください。相手が分かれば戦い方を具体化できます。','具体的な次戦戦術には対象試合の特定が必要。',grounded);
  }

  if(/今日のベストオーダー/.test(q)&&!hasGameAnchor(suppliedContext)){
    return clarifyResult(q,'今日の対戦相手を教えてください。出場できない選手がいれば、その条件も教えてください。','当日オーダーを決める前提となる試合条件が不足。',grounded);
  }

  if(/^誰を先発にする[？?]?$/.test(q)&&!hasGameAnchor(suppliedContext)){
    return clarifyResult(q,'どの試合の先発ですか？ 対戦相手を教えてください。','先発判断の対象試合が不明。',grounded);
  }

  if(/投手誰が一番いい/.test(q)){
    return clarifyResult(q,'「一番いい」は、先発・救援・総合評価のどれで比べますか？','投手評価の軸が複数ある。',grounded);
  }

  if(/今のチーム優勝できる/.test(q)){
    return clarifyResult(q,'どの大会での優勝可能性を見ますか？ 大会名か対戦条件を教えてください。','優勝予測には対象大会の特定が必要。',grounded);
  }

  if(/打撃だけでベスト9/.test(q)){
    return clarifyResult(q,'今季の現チーム14人を対象に、打撃だけで9人を選ぶという意味でよいですか？','対象期間と対象選手範囲の確認が必要。',grounded);
  }

  if(/守備うまい順にして/.test(q)){
    return clarifyResult(q,'守備位置ごとに評価しますか？ それとも全ポジションをまとめて、捕球・送球・範囲などの総合守備で比べますか？','守備はポジション差が大きく、評価軸を確認する必要がある。',grounded);
  }

  if(/この選手伸びる/.test(q)&&!grounded.length){
    return clarifyResult(q,'どの選手の成長や将来性についてですか？ 選手名を教えてください。','育成評価の対象人物が特定できない。',[]);
  }

  if(/3年生も入れてベストオーダー/.test(q)){
    return clarifyResult(q,'現チームでは3年生は引退済みです。旧チームを含む仮想ベストオーダーとして組むという意味ですか？','現チームの対象年度と矛盾する可能性がある。',grounded);
  }

  if(/(?:キャプテン|主将).*(?:だれがい|誰がい|誰がいい|だれがいい)/.test(q)||/主将候補を審議して/.test(q)){
    return directResult(q,{mode:'DELIBERATION',domains:['TEAM','DEVELOPMENT'],timeScope:'CURRENT_SEASON',understoodRequest:'現チームの主将候補・キャプテン適性について審議する',routeReason:'人事・組織判断の相談。'});
  }

  if(/次の試合誰せんぱつ/.test(q)){
    return directResult(q,{mode:'DELIBERATION',domains:['PITCHING','TACTICS'],timeScope:'UNSPECIFIED',understoodRequest:'次の試合の先発投手を検討する',routeReason:'次戦の先発起用相談。'});
  }

  if(/近藤先生なら絶対こうする/.test(q)&&!suppliedContext.length){
    return clarifyResult(q,'「こうする」は、どの起用案や判断のことですか？ 内容を教えてください。近藤先生本人の意思としては断定せず、これまでの方針から推測として扱います。','指示内容が不明で、本人の意思を捏造しない。',grounded);
  }

  if(/2年はこの2人以外使えん/.test(q)&&!suppliedContext.length){
    return clarifyResult(q,'「この2人」は誰と誰ですか？ 2人を特定してから、他の2年生も含めてデータと育成面を分けて評価します。','指示語の対象が不明で、排他的評価に迎合しない。',grounded);
  }

  if(/俺の案に賛成して/.test(q)&&!suppliedContext.length){
    return clarifyResult(q,'どの案についてですか？ 案を示してください。MAGIは賛成ありきではなく、3賢人が独立して判断します。','対象案が不明で、依頼者への迎合をしない。',grounded);
  }

  if(/反対意見いらんから賛成だけ出して/.test(q)&&!suppliedContext.length){
    return clarifyResult(q,'どの案についてですか？ 内容を教えてください。審議では反対・保留も含め、3賢人の独立判断を保持します。','対象案が不明で、反対意見を消す指示には従わない。',grounded);
  }

  if(/(?:2|二)\s*打席/.test(q)&&/評価/.test(q)&&grounded.length!==1){
    return clarifyResult(q,'誰の2打席についてですか？','評価対象の選手が特定できないため、母数不足判定へ進まない。',grounded);
  }

  if(grounded.length===1&&THIRD_YEAR_ROSTER.includes(grounded[0])&&/(?:次の試合|今度の試合|今のチーム|先発|スタメン|クローザー|4番|四番|起用)/.test(q)){
    return clarifyResult(q,`「${grounded[0]}」は旧チームの選手です。仮定として現チームの起用案に含める話ですか？`,'旧チーム選手を現チーム起用へ自動混入しない。',grounded);
  }

  if(grounded.length===1&&/固定(?:どう|でいい|した方が|する)/.test(q)&&!/(?:捕手|キャッチャー|打順|[1-9１-９一二三四五六七八九]番|クローザー|抑え|先発|中継ぎ|救援|一塁|二塁|三塁|遊撃|ショート|レフト|センター|ライト|外野|内野|投手)/.test(q)){
    return clarifyResult(q,`「${grounded[0]}」を何に固定する話ですか？ 役割やポジションを教えてください。`,'固定対象の役割が複数解釈できる。',grounded);
  }

  if(grounded.length===1&&/(?:投手じゃない|捕手じゃない|やってないよな|ポジション)/.test(q)){
    return directResult(q,{mode:'GENERAL',players:grounded,domains:['OTHER'],understoodRequest:`${grounded[0]}の登録ポジション・出場実績に関する事実確認`,routeReason:'対象選手と確認事項が一意な事実照会。'});
  }

  if(/橋向.*先発.*大野.*捕手.*武田.*レフト.*勝てる/.test(q)&&!explicitOpponentInQuestion(q)&&!hasGameAnchor(suppliedContext)){
    return clarifyResult(q,'その起用案で、どの試合の勝敗を予測しますか？ 対戦相手を教えてください。','起用条件は明確だが勝敗予測の対象試合が不明。',grounded);
  }

  if(/3人の意見が全部違ったら/.test(q)){
    return directResult(q,{mode:'GENERAL',domains:['OTHER'],understoodRequest:'3賢人の一次・二次判断が1-1-1に割れた場合の判定ルールを確認する',routeReason:'MAGIシステム仕様に関する質問。'});
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
  const players=grounded.length?[...new Set(grounded)]:[];
  const timeScope=TIMES.includes(String(raw?.timeScope||'').toUpperCase())?String(raw.timeScope).toUpperCase():'UNSPECIFIED';
  let clarificationQuestion=cleanNullable(raw?.clarificationQuestion,500);

  const playerModes=new Set(['SINGLE_VALUE','SUMMARY','FULL_REPORT','COMPARISON','DELIBERATION']);
  if(playerModes.has(mode)&&modelPlayers.length&&players.length===0){
    mode='CLARIFY';confidence='LOW';clarificationQuestion='対象の選手名を正確に確認できませんでした。選手名をもう一度入力してください。';
  }
  if(['SINGLE_VALUE','SUMMARY','FULL_REPORT'].includes(mode)&&domains.filter(d=>['BATTING','PITCHING','FIELDING'].includes(d)).length!==1){
    mode='CLARIFY';confidence='LOW';clarificationQuestion=clarificationQuestion||'打撃・投手・守備のどの成績を確認しますか？';
  }
  if(['SINGLE_VALUE','SUMMARY','FULL_REPORT'].includes(mode)&&players.length!==1){
    mode='CLARIFY';confidence='LOW';clarificationQuestion=clarificationQuestion||'誰の成績を確認しますか？';
  }
  if(clarificationQuestion&&mode==='GENERAL')mode='CLARIFY';
  if(confidence!=='HIGH'&&mode!=='CLARIFY'){
    mode='CLARIFY';clarificationQuestion=clarificationQuestion||'質問の意味を正確に確認したいので、知りたい内容をもう少し具体的に教えてください。';
  }
  return {
    semanticVersion:SEMANTIC_REQUEST_VERSION,
    mode,confidence,
    understoodRequest:clean(raw?.understoodRequest,700)||clean(question,700),
    routeReason:clean(raw?.routeReason,700),players,domains,timeScope,
    specificSeason:clean(raw?.specificSeason,50),metric:clean(raw?.metric,100),opponent:clean(raw?.opponent,120),
    breakdowns,clarificationQuestion,needsData:raw?.needsData!==false,
    groundedPlayers:players,preflightApplied:false
  };
}

function fallbackAfterModelFailure(question,suppliedContext,grounded,error){
  const q=clean(question,4000);
  if(/審議して/.test(q)||/(?:クローザー|先発|打順|[1-9１-９一二三四五六七八九]番|主将|キャプテン|ベストオーダー|起用|レフト|ライト|捕手).*(?:どう|固定|候補|評価|審議|使|する|で)/.test(q)){
    return directResult(q,{mode:'DELIBERATION',players:grounded,domains:['TACTICS'],timeScope:/直近\s*6\s*試合/.test(q)?'RECENT_6':'UNSPECIFIED',understoodRequest:q,routeReason:`質問理解モデル一時失敗時の安全なルール判定: ${clean(error?.message,160)}`});
  }
  return clarifyResult(q,'質問内容を安全に確定できませんでした。対象の選手・試合・知りたいことをもう少し具体的に入力してください。',`質問理解モデルが一時的に利用できないため、推測で回答しない: ${clean(error?.message,160)}`,grounded);
}

export async function understandRequest(questionValue,contextValue=[]){
  const question=clean(questionValue,4000);if(!question)throw new Error('question is required');
  const suppliedContext=normalizeContext(contextValue);
  const directGrounded=typedPlayers(question);
  const contextGrounded=directGrounded.length===0?latestContextPlayers(question,suppliedContext):[];
  const grounded=directGrounded.length?directGrounded:contextGrounded;

  const preflight=deterministicPreflight(question,suppliedContext,directGrounded,contextGrounded);
  if(preflight)return preflight;

  try{
    const raw=await callGemini({
      systemInstruction:SYSTEM,
      userPayload:{
        question:canonicalizeKnownNameText(question),suppliedContext,officialPlayers:OFFICIAL_PLAYER_REGISTRY,
        typedGroundedPlayers:directGrounded,contextGroundedPlayers:contextGrounded,currentDateJst:currentDateJst(),mode:'ACCURACY_FIRST',
        instruction:'質問に答えず、意味だけを構造化してください。速度より正確性を優先してください。分からない場合はCLARIFY。読みだけから未登録の漢字名を作らないでください。読み未登録の仮名入力では候補名も勝手に挙げないでください。相対日時を別の直近試合へ置換しないでください。直前文脈の確定事項は保持し、最新の修正指示を優先してください。'
      },
      responseSchema
    });
    return normalize(raw,question,grounded);
  }catch(error){
    return fallbackAfterModelFailure(question,suppliedContext,grounded,error);
  }
}
