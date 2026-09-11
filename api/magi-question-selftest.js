import { understandRequest } from '../server/api/magi/_semantic-request.js';

const Q=[
'次の試合の打順どうする？','大野をクローザー固定どう？','橋向と大久保ならどっちを先発？','最近の中嶋どう？','昨日の試合の負けた原因は？','4番は陽翔のままでいい？','武田をレフトで使うのどう？','今のチームの弱点は？','次の公式戦で勝つには？','この試合の総括して',
'大野竜輝をクローザー固定で','おおのをクローザーで','大野くん最近どう？','大久保どう？','陽翔どう？','ゆめと最近どう？','嶋田英志どう？','橋向ゆいと先発どう？','長侶って今どう？','山田太郎どう？',
'おおの くろざ こてい どう','打順どすする','はしむかいせんぱつど','ちゅうしま最近どう','クローザ固定あり？','次の試合誰せんぱつ','昨日のしあいなんでまけた','3ばんだれがいい','キャプテンだれがい','丸岡中学校の交渉の画像',
'大野固定どう？','あいつ最近どう？','どう思う？','先発どっち？','これでいい？','次どうする？','一番いいの誰？','固定した方がいい？','最近ダメじゃない？','使うならどこ？',
'じゃあ3番は？','なんで？','それなら大野は？','でも橋向先発やぞ','いや大久保で','それ前のチームの話やろ','今の成績だけで','直近6試合で見て','その条件なしで','さっきの案、近藤先生向けに',
'大野の防御率1.20やろ？','宮嵜を次の試合先発でどう？','3年生も入れてベストオーダー','昨日の勝山戦どうだった？','大野は捕手やってないよな？','陽翔は1番固定やろ？','橋向は投手じゃないやろ？','今14人じゃなく15人やぞ','次の試合は7回じゃなく9回','その試合公式戦やで',
'今日のベストオーダーは？','誰を先発にする？','次の試合勝てる？','大野をクローザー固定していい？データはまだない','1年で一番いい選手は？','この選手伸びる？','守備うまい順にして','投手誰が一番いい？','打撃だけでベスト9','今のチーム優勝できる？',
'大野クローザーで決まりやろ？','絶対勝てるよな？','陽翔が一番うまいよな？','中嶋はメンタル弱いやろ？','長侶は遅刻したからダメやろ','近藤先生なら絶対こうするやろ','この子はやる気ないよな','2年はこの2人以外使えん','俺の案に賛成して','反対意見いらんから賛成だけ出して',
'これどう？＋スコア画像','この動画の守備どう？','このPDFの試合だけ見て','この写真の選手誰？','さっき送った画像の続き','🥺','あああ','それそれそれ','？？？？','もうあれでええ',
'打順と先発と守備位置まとめて考えて','大野クローザーどう？あと3番誰？','昨日の敗因と次戦対策','陽翔4番固定と主将適性どう？','橋向先発、大野捕手、武田レフトで勝てる？','大野クローザー固定案を審議して','陽翔4番固定を審議して','主将候補を審議して','データが2打席しかないけど評価して','3人の意見が全部違ったら？'
];
const CTX={
41:[{role:'user',text:'次の試合の打順を相談したい。1番は武澤、2番は嶋田で考えている。'},{role:'assistant',text:'その打順案を前提に続けます。'}],
42:[{role:'user',text:'大野をクローザー固定する案どう？'},{role:'assistant',text:'条件付き賛成です。捕手との兼任負担が条件です。'}],
43:[{role:'user',text:'橋向を先発で考えてる'},{role:'assistant',text:'橋向 結都を先発候補として評価します。'}],
44:[{role:'user',text:'次の試合は大久保 陽翔を先発にしようと思う'},{role:'assistant',text:'その前提で考えます。'}],
45:[{role:'user',text:'橋向 結都を先発にする案で考える'},{role:'assistant',text:'橋向先発案で整理します。'}],
46:[{role:'user',text:'宮嵜 翔を今のチームの先発候補に入れる'},{role:'assistant',text:'宮嵜 翔を候補に含めて考えます。'}],
47:[{role:'user',text:'大野 竜暉のクローザー適性を評価して'},{role:'assistant',text:'通算も含めて評価します。'}],
48:[{role:'user',text:'大野 竜暉のクローザー適性を評価して'},{role:'assistant',text:'期間を指定できます。'}],
49:[{role:'user',text:'橋向 結都先発で、相手は左打者が多い条件で考えて'},{role:'assistant',text:'その条件を前提にします。'}],
50:[{role:'user',text:'主将は大久保 陽翔、副主将は大野 竜暉と嶋田 栄志の案です。'},{role:'assistant',text:'案を整理しました。'}],
60:[{role:'user',text:'8月2日の勝山との第1試合を見て'},{role:'assistant',text:'その試合を対象にします。'}],
90:[{role:'user',text:'橋向 結都先発、大野 竜暉捕手の案でいく？'},{role:'assistant',text:'その案を前提に整理します。'}]
};
const STRICT_CLARIFY=new Set([3,5,9,10,12,14,16,20,21,23,24,25,27,30,31,32,33,34,35,36,37,38,39,40,45,52,53,61,62,63,65,66,67,68,69,70,72,73,76,77,78,79,86,87,88,89,93,95,99]);
const STRICT_DELIB=new Set([2,4,6,7,13,15,18,19,29,64,71,94,96,97,98]);
const CLARIFY_OR_DELIB=new Set([1,11,17,22,26,28,41,43,91,92]);
const NON_CLARIFY=new Set([8,42,44,46,47,48,49,50,51,54,55,56,57,58,59,60,74,75,80,90,100]);
const SKIP=new Set([81,82,83,84,85]);
function answerOf(s){return String(s?.clarificationQuestion||'')}
function playerOf(s){return Array.isArray(s?.players)&&s.players[0]||''}
function includesAll(s,a){return a.every(x=>String(s).includes(x))}
function judge(id,s){
  const m=s?.mode;
  if(id===3||id===14)return m==='CLARIFY'&&includesAll(answerOf(s),['大久保 陽翔','大久保 夢翔']);
  if(id===16)return m==='CLARIFY'&&/ゆめと/.test(answerOf(s))&&!/(?:前川 夢斗|大久保 夢翔)/.test(answerOf(s));
  if(id===20)return m==='CLARIFY'&&(!s.players||s.players.length===0);
  if(id===31)return m==='CLARIFY'&&playerOf(s)==='大野 竜暉';
  if(id===47)return s?.timeScope==='CURRENT_SEASON'||m!=='CLARIFY';
  if(id===48)return s?.timeScope==='RECENT_6';
  if(id===52)return m==='CLARIFY'&&playerOf(s)==='宮嵜 翔'&&/(?:旧チーム|仮定)/.test(answerOf(s));
  if(id===54)return !/(?:対戦相手を教えてください)/.test(answerOf(s));
  if(id===72)return m==='CLARIFY'&&/どの試合/.test(answerOf(s));
  if(id===99)return m==='CLARIFY'&&/(?:誰の2打席|誰)/.test(answerOf(s));
  if(id===100)return m==='GENERAL';
  if(STRICT_CLARIFY.has(id))return m==='CLARIFY';
  if(STRICT_DELIB.has(id))return m==='DELIBERATION';
  if(CLARIFY_OR_DELIB.has(id))return m==='CLARIFY'||m==='DELIBERATION';
  if(NON_CLARIFY.has(id))return m!=='CLARIFY';
  return true;
}
const IDS=Array.from({length:100},(_,i)=>i+1).filter(id=>!SKIP.has(id));
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  const batch=Math.max(0,Math.min(18,Number(req.query?.batch||0)));
  const ids=IDS.slice(batch*5,batch*5+5);
  const results=[];
  for(const id of ids){
    try{
      const semantic=await understandRequest(Q[id-1],CTX[id]||[]);
      results.push({id,question:Q[id-1],pass:judge(id,semantic),mode:semantic.mode,players:semantic.players||[],timeScope:semantic.timeScope,clarificationQuestion:semantic.clarificationQuestion||'',understoodRequest:semantic.understoodRequest||''});
    }catch(error){results.push({id,question:Q[id-1],pass:false,error:error?.message||String(error)});}
  }
  res.status(200).json({ok:true,batch,ids,total:IDS.length,results});
}
