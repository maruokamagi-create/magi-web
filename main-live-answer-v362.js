(()=>{
'use strict';
if(window.MAGI_MAIN_SEMANTIC_V362)return;
window.MAGI_MAIN_SEMANTIC_V362=true;
const $=id=>document.getElementById(id),txt=v=>String(v??'').trim();
const CLIENT_VERSION='362';
const RUNTIME_VERSION='362';
const CONTEXT_KEY='magi-semantic-context-v362';
const TEAM_POLICY=Object.freeze({
  id:'MARUOKA_PRACTICAL_LINEUP_POLICY_20260916',
  authority:'AUTHORITATIVE_TEAM_POLICY',
  opponentPitcherHandedness:{
    relevance:'LOW_FOR_THIS_TEAM',
    rule:'相手投手の右投げ・左投げによる打順評価や再検討条件は、ユーザーがその分析を明示的に求めた場合を除き使用しない。左右別打撃成績を通常の相互検証・最終総括・再検討条件に持ち込まない。'
  },
  sampleSize:{
    practicalBattingAtBatsSufficient:15,
    rule:'現チームの打撃評価では15打数以上を実用上十分な母数として扱う。15打数以上の選手について、母数不足だけを理由に評価保留・警告・再検討条件にしない。15打数未満は必要に応じて慎重に扱う。'
  },
  practicalDeliberationPriorities:[
    '出塁する打者、進める打者、返す打者のつながりと得点の作りやすさ',
    '1〜3番、4〜6番、7〜9番の役割と上下打線のつながり',
    '今季通算成績を軸に、Evidenceがある場合は直近6試合の変化も別枠で確認する',
    '四球、長打、得点圏、盗塁・走塁などEvidenceにある実戦的な得点要素',
    '守備位置、捕手・投手などの兼任、起用方針との整合',
    '固定する打順と動かす打順を分け、変更するなら具体的な実戦条件を示す',
    '少数意見を残しつつ、今のチームで実際に使える代替案を示す'
  ],
  instruction:'このチーム方針を相互検証、二次判定、最終総括、再検討条件まで一貫して適用する。Evidenceにない事実は作らない。'
});
let busy=false;

function mainButton(node){return node?.closest?.('#magiRunButton,[data-magi-run="formal"]')||null}
function formalRunner(){return typeof window.MAGI_FORMAL_UI_RUNNER_V2==='function'?window.MAGI_FORMAL_UI_RUNNER_V2:null}
function contextLoad(){try{const a=JSON.parse(sessionStorage.getItem(CONTEXT_KEY)||'[]');return Array.isArray(a)?a.slice(-10):[]}catch(_){return[]}}
function contextPush(role,text){text=txt(text);if(!text)return;try{const a=contextLoad();a.push({role,text:text.slice(0,1200)});sessionStorage.setItem(CONTEXT_KEY,JSON.stringify(a.slice(-10)))}catch(_){}}
function setRouter(title,badge,help){if($('routeValue'))$('routeValue').textContent=title;if($('routeBadge'))$('routeBadge').textContent=badge;if($('routeHelp'))$('routeHelp').textContent=help}
function ensurePanel(){let p=$('magiLiveAnswerV362');if(p)return p;const judge=$('judge'),card=judge?.querySelector?.('.card');if(!judge||!card)return null;p=document.createElement('div');p.id='magiLiveAnswerV362';p.style.cssText='display:none;margin-top:12px;padding:16px;border:1px solid #2f5578;border-left:5px solid #37b579;border-radius:16px;background:rgba(10,27,46,.98);color:#f7f9fc;box-shadow:0 12px 30px rgba(0,0,0,.18)';p.innerHTML='<div style="font-size:11px;letter-spacing:.14em;color:#8db0d1;margin-bottom:8px">MAGI ANSWER</div><div id="magiUnderstoodV362" style="font-size:11px;line-height:1.55;color:#8db0d1;margin-bottom:8px"></div><div id="magiLiveAnswerTextV362" style="font-size:17px;font-weight:850;line-height:1.65"></div><div id="magiLiveAnswerMetaV362" style="margin-top:10px;font-size:11px;line-height:1.65;color:#a9bdd0"></div>';card.insertAdjacentElement('afterend',p);return p}
function hidePanel(){const p=$('magiLiveAnswerV362');if(p)p.style.display='none'}
function showAnswer(result,totalMs){const p=ensurePanel();if(!p)return;const answer=txt(result?.answer||result?.clarificationQuestion)||'回答を取得できませんでした。',semantic=result?.semantic||{},understood=txt(semantic?.understoodRequest||result?.understoodRequest);$('magiUnderstoodV362').textContent=understood?`質問理解：${understood}`:'';$('magiLiveAnswerTextV362').textContent=answer;const bits=[];if(semantic?.mode)bits.push(`意図：${semantic.mode}`);if(result?.source?.name)bits.push(`参照：${result.source.name}`);if(result?.answerEngineVersion)bits.push(`回答：${result.answerEngineVersion}`);if(Number.isFinite(totalMs))bits.push(`処理：${(totalMs/1000).toFixed(1)}秒`);$('magiLiveAnswerMetaV362').textContent=bits.join(' ｜ ');$('response')?.classList.remove('show');p.style.display='block';if($('status'))$('status').textContent='MAGI 回答完了';setRouter('質問理解 → 検証回答','ACCURACY','質問の意味を先に確認し、その意図に合うデータ処理を実行しました。');p.scrollIntoView({behavior:'smooth',block:'center'});contextPush('assistant',`${understood?understood+'。':''}${answer}`)}
async function requestCore(question){const c=new AbortController(),t=setTimeout(()=>c.abort(),70000);try{const r=await fetch('/api/magi/core',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-MAGI-Client-Version':CLIENT_VERSION,'X-MAGI-Runtime-Version':RUNTIME_VERSION},body:JSON.stringify({question,context:contextLoad()}),signal:c.signal});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(txt(d?.error)||`CORE ${r.status}`),{status:r.status,requiredClientVersion:d?.requiredClientVersion||null});return d}finally{clearTimeout(t)}}
function packetPlayers(packet){return Array.isArray(packet?.allCurrentTeamCheck?.players)?packet.allCurrentTeamCheck.players:[]}
function fullLineupPacketReady(packet){return Number(packet?.count)===14&&packetPlayers(packet).length===14&&Array.isArray(packet?.files)&&packet.files.some(name=>/2026-2027.*\.xlsm$/i.test(String(name)))}
function applyTeamPolicy(packet){return packet&&typeof packet==='object'?{...packet,teamPolicy:TEAM_POLICY}:packet}
function renderAuthoritativeEvidence(packet){
  if(!packet)return;
  const box=$('dataEvidence');
  if(box){
    const body=txt(packet.text);
    box.classList.add('show');
    box.textContent=`DATA HUB 正本データ（サーバー取得）\n参照：${(packet.files||[]).join('、')}\n\n${body}`;
  }
  const meta=$('caseMeta');
  if(meta){
    const files=(packet.files||[]).join('、');
    let html=String(meta.innerHTML||'');
    if(/DATA HUB\s*：/.test(html))html=html.replace(/DATA HUB\s*：[^<]*/,'DATA HUB：'+Number(packet.count||0)+'件参照');
    else html+='<br>DATA HUB：'+Number(packet.count||0)+'件参照';
    if(/参照ファイル\s*：/.test(html))html=html.replace(/参照ファイル\s*：[^<]*/,'参照ファイル：'+files);
    else html+='<br>参照ファイル：'+files;
    meta.innerHTML=html;
  }
}
function assertVisibleEvidence(packet,kind){
  if(String(kind||'').toUpperCase()!=='FULL_LINEUP')return;
  if(!fullLineupPacketReady(packet))throw new Error('現チーム14名の正本Evidenceが揃っていないため結果を公開しません');
  const meta=txt($('caseMeta')?.textContent);
  if(!meta.includes('DATA HUB：14件参照'))throw new Error('画面のDATA HUB表示が正本Evidenceと一致しないため結果を公開しません');
  const shown=txt($('dataEvidence')?.textContent);
  const players=packetPlayers(packet);
  if(!players.every(p=>shown.includes(txt(p.name))))throw new Error('現チーム14名の成績が画面に表示されていないため結果を公開しません');
  if(!/(?:打率|AVG)\s*[.:：]?\s*(?:\.\d+|0\.\d+)/.test(shown)||!/(?:OPS)\s*[.:：]?\s*(?:\.\d+|0\.\d+)/.test(shown))throw new Error('正本の打撃数値が画面に表示されていないため結果を公開しません');
}
function reportQuery(result,original){const s=result?.semantic||result||{},p=txt((s.players||result.players||[])[0]);let period='';switch(s.timeScope||result.timeScope){case'CAREER':period='通算';break;case'CURRENT_SEASON':period='現チーム';break;case'PREVIOUS_SEASON':period='旧チーム';break;case'SPECIFIC_SEASON':period=txt(s.specificSeason||result.specificSeason);break;case'RECENT_6':case'RECENT':period='直近';break;default:period='通算';}const kind=result.reportKind;if(kind==='PITCHING')return`${p}の${period}投手成績一覧を見せて`;if(kind==='FIELDING')return`${p}の${period}守備成績一覧を見せて`;if(kind==='BATTING')return`${p}の${period}打撃成績一覧を見せて`;return original}
async function waitFor(fnName,ms=6000){const start=Date.now();while(Date.now()-start<ms){if(typeof window[fnName]==='function')return window[fnName];await new Promise(r=>setTimeout(r,80))}return null}
async function runFullReport(result,original,btn){hidePanel();const kind=result.reportKind,q=$('q'),old=q?.value,synthetic=reportQuery(result,original);if(q)q.value=synthetic;setRouter(`質問理解 → ${kind==='BATTING'?'打撃':kind==='PITCHING'?'投手':'守備'}フルレポート`,'REPORT',`理解結果：${txt(result?.understoodRequest||result?.semantic?.understoodRequest)}`);if($('status'))$('status').textContent='質問の意図に合わせて正本データを集計しています…';try{if(kind==='BATTING'){const hydrate=await waitFor('MAGI_STATS_SERVER_HYDRATE');if(!hydrate)throw new Error('打撃正本データ取得処理を準備できませんでした');const hydrated=await hydrate(synthetic);if(!hydrated)throw new Error('打撃正本データを取得できませんでした');const fn=await waitFor('MAGI_STATS_REPORT_FN');if(!fn)throw new Error('打撃レポート処理を準備できませんでした');await fn.call(window)}else if(kind==='PITCHING'){const fn=await waitFor('MAGI_PITCH_DIRECT_FN');if(!fn)throw new Error('投手レポート処理を準備できませんでした');await fn.call(window)}else if(kind==='FIELDING'){const fn=await waitFor('MAGI_RUN_FIELDING_REPORT');if(!fn)throw new Error('守備レポート処理を準備できませんでした');await fn(synthetic)}else throw new Error('対応するレポート種類がありません');contextPush('assistant',`${txt(result?.understoodRequest||result?.semantic?.understoodRequest)}。フルレポートを表示した。`)}finally{if(q&&old!==undefined)q.value=old;if(btn){btn.disabled=false;btn.textContent='MAGI実行'}}}
async function deliberate(result){
  const runner=formalRunner();if(!runner)throw new Error('正式MAGI審議ランナーを呼び出せません');
  const packet=result?.evidencePacket||null,kind=result?.selectionKind||packet?.selectionKind||'',question=txt($('q')?.value);
  if(String(kind).toUpperCase()==='FULL_LINEUP'&&!fullLineupPacketReady(packet))throw new Error('ベストオーダー用の正本14名データを取得できなかったため審議を開始しません');
  const governedPacket=applyTeamPolicy(packet);
  renderAuthoritativeEvidence(governedPacket);
  setRouter('質問理解 → 正本Evidence → 3賢人審議','MAGI',txt(result?.understoodRequest)||'質問の意味を確定し、正本Evidenceを直接3賢人へ渡します。');
  if($('status'))$('status').textContent='正本成績を確認。3賢人審議を開始します…';
  const out=await runner({question,evidence:governedPacket,selectionKind:kind,semantic:result?.semantic||null});
  renderAuthoritativeEvidence(governedPacket);
  assertVisibleEvidence(governedPacket,kind);
  contextPush('assistant',`${txt(result?.understoodRequest)||question}について正本成績を使って3賢人審議を実行した。`);
  return out;
}
function clearPreviousResult(){hidePanel();$('response')?.classList.remove('show');const judge=$('judge');if(judge){judge.querySelectorAll('.engineError').forEach(n=>n.remove());}const chat=$('magiChatView');if(chat)chat.innerHTML='';window.MAGI_LAST_DELIBERATION_RESULT=null;document.dispatchEvent(new CustomEvent('magi:new-question'));}
async function execute(btn){const q=txt($('q')?.value);if(!q){if($('status'))$('status').textContent='相談内容を入力してください。';return}if(busy)return;clearPreviousResult();busy=true;const started=performance.now(),oldText=btn?.textContent;contextPush('user',q);try{hidePanel();if(btn){btn.disabled=true;btn.textContent='質問を理解中…'}setRouter('質問を理解しています','THINK','単語一致ではなく、質問全体の意味・対象・期間・目的を確認しています。');if($('status'))$('status').textContent='質問内容を理解しています…';const r=await requestCore(q);if(r?.action==='FULL_REPORT')return await runFullReport(r,q,btn);if(r?.action==='DELIBERATE'||r?.route==='DELIBERATION')return await deliberate(r);if(r?.action==='CLARIFY'||r?.route==='CLARIFY'){showAnswer(r,performance.now()-started);return}if(r?.handled!==false){showAnswer(r,performance.now()-started);return}throw new Error('安全に処理経路を確定できませんでした')}catch(e){console.warn('[MAGI semantic v362]',e?.message||e);$('response')?.classList.remove('show');if(e?.status===401){if($('status'))$('status').textContent='LINEログインを確認してください。'}else if(e?.status===403){if($('status'))$('status').textContent='利用承認を確認してください。'}else if(e?.status===426){if($('status'))$('status').textContent='MAGIが更新されました。ページを再読み込みしてください。';setRouter('更新が必要','UPDATE','古い画面では審議結果を出しません。')}else{if($('status'))$('status').textContent=`処理を停止しました：${txt(e?.message)||'正本データ処理を完了できませんでした'}`;setRouter('処理停止','RETRY','正本Evidenceが揃わない、または画面と一致しない場合は結果を出しません。')}}finally{if(btn){btn.disabled=false;if(/質問を理解中|審議中/.test(btn.textContent||''))btn.textContent=oldText||'MAGI実行'}busy=false}}

window.MAGI_SEMANTIC_RUN_V2=execute;
window.MAGI_SEMANTIC_RUN_V1=execute;
window.MAGI_CLIENT_VERSION=CLIENT_VERSION;
window.MAGI_RUNTIME_CLIENT_VERSION=RUNTIME_VERSION;
// Click ownership belongs to magi-app-bootstrap-v363.js. This module only exposes the canonical semantic executor.
const observer=new MutationObserver(()=>{if($('judge'))ensurePanel()});observer.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensurePanel,{once:true});else ensurePanel();
})();

