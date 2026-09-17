(()=>{
'use strict';
if(window.MAGI_ACE_SELECTION_CORE_V401)return;
window.MAGI_ACE_SELECTION_CORE_V401=true;

const text=v=>String(v??'').trim();
const list=v=>Array.isArray(v)?v.filter(Boolean):[];
const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const EXCLUDED='大野 竜暉';
const PITCHERS=['橋向 結都','大久保 陽翔','大久保 夢翔','中嶋 玲月','坂田 暉馬','大野 竜暉'];
const norm=v=>text(v).normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const canonical=new Map(PITCHERS.map(n=>[norm(n),n]));
const cname=v=>canonical.get(norm(v))||'';
const excluded=v=>norm(v)===norm(EXCLUDED);
const clone=v=>{try{return JSON.parse(JSON.stringify(v));}catch(_){return v;}};
const num=v=>{const s=text(v).replace(/,/g,'').replace(/%$/,'');if(!s||s==='-'||s==='—')return null;const n=Number(s);return Number.isFinite(n)?n:null};
const integer=v=>{const n=num(v);return n===null?null:Math.trunc(n)};
const records=()=>((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');
const isWorkbook=r=>{const z=norm(r?.fileName||'');return z.includes('通算成績一覧20262027')&&/\.(?:xlsm|xlsx|xls)$/i.test(text(r?.fileName));};
const isOldWorkbook=r=>{const z=norm(r?.fileName||'');return z.includes('通算成績一覧20252026')&&/\.(?:xlsm|xlsx|xls)$/i.test(text(r?.fileName));};
const colIndex=(r,aliases)=>{const cs=r?.columns||[],want=aliases.map(norm);for(let i=0;i<cs.length;i++)if(want.includes(norm(cs[i])))return i;for(let i=0;i<cs.length;i++)if(want.some(w=>w&&norm(cs[i]).includes(w)))return i;return-1;};
const at=(r,i)=>i>=0?text((r?.values||[])[i]):'';
const value=(r,aliases,fallback=-1)=>{const i=colIndex(r,aliases);return at(r,i>=0?i:fallback);};
const totalRow=r=>(r?.values||[]).some(v=>/^(?:総計|合計|計)$/u.test(text(v)));
const sectionLabel=r=>(r?.values||[]).map(text).join(' ');

function rowPitcher(r){
 const pi=colIndex(r,['投手名']);
 if(pi>=0)return cname(at(r,pi));
 return cname(at(r,0));
}
function rowCatcher(r){
 const ci=colIndex(r,['捕手名']);
 if(ci>=0)return text(at(r,ci));
 return text(at(r,1));
}
function metricAt(r,aliases,fallback){return value(r,aliases,fallback);}
function looksLikePitcherAggregate(r){
 const p=rowPitcher(r);if(!p)return false;
 const c=rowCatcher(r);
 if(cname(c)||c)return false;
 const era=num(metricAt(r,['防御率'],2));
 const games=integer(metricAt(r,['登板数','登板'],3));
 const innings=text(metricAt(r,['投球回'],4));
 return era!==null&&games!==null&&games>=1&&/^\d+(?:\.\d)?$/.test(innings);
}
function parseStatRow(r){
 return {
  games:integer(metricAt(r,['登板数','登板'],3))??0,
  innings:metricAt(r,['投球回'],4),
  era:metricAt(r,['防御率'],2),
  win:integer(metricAt(r,['勝利','勝'],5))??0,
  loss:integer(metricAt(r,['敗北','敗'],6))??0,
  save:integer(metricAt(r,['セーブ'],7))??0,
  batters:integer(metricAt(r,['対打者'],8))??0,
  pitches:integer(metricAt(r,['投球数'],9))??0,
  strikes:integer(metricAt(r,['ストライク'],10))??0,
  balls:integer(metricAt(r,['ボール'],11))??0,
  strikeRate:metricAt(r,['ストライク率'],12),
  hits:integer(metricAt(r,['被安打'],13))??0,
  runs:integer(metricAt(r,['失点'],14))??0,
  earned:integer(metricAt(r,['自責点'],15))??0,
  wildPitches:integer(metricAt(r,['暴投'],16))??0,
  walks:integer(metricAt(r,['与四球'],17))??0,
  hbp:integer(metricAt(r,['与死球'],18))??0,
  strikeouts:integer(metricAt(r,['奪三振'],19))??0,
  kRate:metricAt(r,['奪三振率'],20)
 };
}
function groupSheets(rows){
 const m=new Map();
 for(const r of rows){const k=`${r.fileName||''}\u001f${r.sheetName||''}`;if(!m.has(k))m.set(k,[]);m.get(k).push(r);}
 return [...m.values()].map(a=>a.sort((x,y)=>(Number(x.rowNumber)||0)-(Number(y.rowNumber)||0)));
}
function pitcherRowsFromWorkbook(rows){
 const found=[];
 for(const sheet of groupSheets(rows)){
  if(!sheet.length)continue;
  const sheetName=text(sheet[0]?.sheetName);
  if(/捕手/.test(sheetName)&&!/投手/.test(sheetName))continue;
  let started=false;
  for(const r of sheet){
   const label=sectionLabel(r);
   if(/捕手部門/.test(label)&&started)break;
   if(totalRow(r)&&started)break;
   if(looksLikePitcherAggregate(r)){started=true;found.push(r);}
  }
 }
 const unique=[];const seen=new Set();
 for(const r of found){const p=rowPitcher(r),k=norm(p);if(!p||seen.has(k))continue;seen.add(k);unique.push(r);}
 return unique;
}
function parseSeason(rows,label){
 const parsedRows=pitcherRowsFromWorkbook(rows),out={};
 for(const r of parsedRows){const p=rowPitcher(r);if(p)out[p]=parseStatRow(r);}
 return {label,rows:parsedRows,stats:out};
}
function buildWorkbookAceEvidence(){
 const all=records();
 const currentRows=all.filter(isWorkbook);
 if(!currentRows.length)return null;
 const current=parseSeason(currentRows,'2026-2027');
 const names=PITCHERS.filter(p=>!excluded(p)&&current.stats[p]);
 if(names.length<3)return null;
 const oldRows=all.filter(isOldWorkbook),old=oldRows.length?parseSeason(oldRows,'2025-2026'):{stats:{},rows:[]};
 const totals={};
 for(const p of [...names,EXCLUDED]){
  if(!current.stats[p]&&!old.stats[p])continue;
  totals[p]={};
  if(current.stats[p])totals[p]['2026-2027']=current.stats[p];
  if(old.stats[p])totals[p]['2025-2026']=old.stats[p];
 }
 const files=[...new Set(currentRows.map(r=>r.fileName).filter(Boolean))];
 const lines=[
  '【エース候補比較専用 EVIDENCE｜通算成績一覧・投手部門】',
  '正本は2026-2027通算成績一覧の「投手部門」。投手名が入った総合行だけを本人の投手成績として採用する。',
  '投手行の直下にある「投手名空欄／捕手名あり」の行は捕手別内訳なので、投手本人の成績として重複加算しない。',
  '「捕手部門」は捕手成績の表なので、エース比較の投手成績には混ぜない。',
  `【候補除外】${EXCLUDED}は投手実績を参考表示してもよいが、正捕手として運用するためエース候補から除外。`,
  `【比較対象】${names.join('・')}`
 ];
 for(const p of names){
  const s=current.stats[p];
  lines.push(`【${p}｜2026-2027】防御率=${s.era}｜登板=${s.games}｜投球回=${s.innings}｜${s.win}勝${s.loss}敗｜セーブ=${s.save}｜奪三振=${s.strikeouts}｜与四球=${s.walks}｜与死球=${s.hbp}｜被安打=${s.hits}｜失点=${s.runs}｜自責点=${s.earned}｜投球数=${s.pitches}`);
 }
 if(current.stats[EXCLUDED]){
  const s=current.stats[EXCLUDED];
  lines.push(`【参考・候補外 ${EXCLUDED}】防御率=${s.era}｜登板=${s.games}｜投球回=${s.innings}｜奪三振=${s.strikeouts}`);
 }
 lines.push('評価では投球回・登板数という母数、先発として試合を作る再現性、四死球、奪三振、失点内容を同じ基準で比較する。数値は正本行からのみ使用し、内訳行を足し直さない。');
 return {
  count:names.length,
  files,
  seasons:['2026-2027'],
  players:names,
  evidenceLayers:['CANONICAL WORKBOOK','PITCHER SUMMARY ROWS ONLY','ACE CANDIDATE COMPARISON','2026-2027 CURRENT'],
  missingEvidence:[],
  canonicalPitchingTotals:totals,
  pitcherTableRule:{aggregate:'投手名あり・捕手名なしの投手総合行',excludedDetail:'投手名空欄・捕手名ありの捕手別内訳',excludedSection:'捕手部門'},
  summary:`通算成績一覧2026-2027の投手部門から、候補外の正捕手を除く投手${names.length}名の総合行を取得。`,
  text:lines.join('\n')
 };
}
window.MAGI_BUILD_ACE_WORKBOOK_EVIDENCE_V401=buildWorkbookAceEvidence;

function installEvidence(){
 if(typeof window.searchDataEvidence!=='function')return false;
 if(window.searchDataEvidence.__magiAceWorkbook==='v401')return true;
 const prev=window.searchDataEvidence;
 window.searchDataEvidence=function(q){const s=text(q).normalize('NFKC');if(!ACE_RE.test(s))return prev(q);return buildWorkbookAceEvidence()||prev(q)};
 window.searchDataEvidence.__magiAceWorkbook='v401';return true;
}
let evidenceTries=0;const evidenceTimer=setInterval(()=>{evidenceTries++;if(installEvidence()||evidenceTries>=120)clearInterval(evidenceTimer)},100);installEvidence();

const previousFetch=window.fetch.bind(window);
const urlOf=input=>typeof input==='string'?input:text(input?.url);
const parseBody=init=>{if(typeof init?.body!=='string')return null;try{return JSON.parse(init.body);}catch(_){return null;}};
const caseOf=body=>body?.case&&typeof body.case==='object'?body.case:body||{};
const questionOf=body=>text(caseOf(body)?.question||body?.question).normalize('NFKC');
const isAce=body=>!!body&&ACE_RE.test(questionOf(body));
const filtered=values=>list(values).map(text).filter(v=>v&&!excluded(v));
function injectPolicy(body,strong=false){const out=clone(body)||{},c=out.case&&typeof out.case==='object'?out.case:null;if(!c)return out;c.evidence=c.evidence&&typeof c.evidence==='object'?c.evidence:{};c.evidence.aceSelectionPolicy={excludedPlayers:[EXCLUDED],reason:'正捕手として運用するためエース候補から除外',candidateCount:1};const rule='【エース選定条件】大野 竜暉は正捕手として運用するため候補外。投手実績は参考資料として参照してよいが候補には含めない。通算成績一覧2026-2027の投手部門・投手総合行を正本として、他の現チーム投手から第一候補を1名だけ選ぶ。捕手別内訳行や捕手部門を投手本人の成績として重複使用しない。';if(!text(c.question).includes('【エース選定条件】'))c.question=`${text(c.question)}\n${rule}`;if(strong)c.question+='\n【再選定】大野 竜暉以外から第一候補を1名だけ返す。';return out;}
function jsonResponse(original,data){const headers=new Headers(original.headers||{});headers.set('content-type','application/json; charset=utf-8');headers.delete('content-length');headers.delete('content-encoding');return new Response(JSON.stringify(data),{status:original.status,statusText:original.statusText,headers});}
function sanitizePersona(data){if(!data||typeof data!=='object')return data;data.candidatePlayers=filtered(data.candidatePlayers).slice(0,1);if(!data.candidatePlayers.length){data.reviewRequested=true;data.reviewReason='正捕手を除外した条件で別の投手から第一候補を再選定する必要がある。';data.publicStatement='正捕手は候補外。正本の投手部門から別の投手を第一候補として再選定します。';}return data;}
function firstChoice(group,persona){return filtered(group?.[persona]?.candidatePlayers)[0]||'';}
function sanitizeCross(data,body){if(!data||typeof data!=='object')return data;const p=body?.primary||{},m=firstChoice(p,'melchior'),b=firstChoice(p,'balthasar'),c=firstChoice(p,'casper'),label=n=>n||'第一候補';data.challenges={melchior:[`${label(m)}を第一候補とする根拠を、正本の投球回・登板数・防御率・四死球・奪三振・失点内容で同じ基準から再確認してください。`],balthasar:[`${label(b)}を第一候補とした場合、7回制で先発として試合を作る役割と継投の組みやすさを確認してください。`],casper:[`${label(c)}について、現在の守備役割との両立と継続起用まで含めて確認してください。`]};const choices=[m,b,c].filter(Boolean),unique=[...new Map(choices.map(n=>[norm(n),n])).values()];data.agreement=unique.length===1?[`3賢人とも${unique[0]}を第一候補に選定。`]:['通算成績一覧の投手総合行を同一基準で比較。'];data.disagreement=unique.length===1?['第一候補に相違なし。']:[`第一候補が分かれている：${choices.join('・')}。`];data.warnings=list(data.warnings).filter(x=>!/ルールに抵触|規約|ポリシー/.test(text(x))).slice(0,2);data.informationGaps=list(data.informationGaps).slice(0,2);return data;}
function sanitizeFinal(data,body){if(!data||typeof data!=='object')return data;const target=data?.final&&typeof data.final==='object'?data.final:data;if(text(target?.mode).toUpperCase()!=='SELECTION')return data;target.centerCandidates=filtered(target.centerCandidates).slice(0,1);target.recommendedCandidates=filtered(target.recommendedCandidates);target.alternateCandidates=filtered(target.alternateCandidates);if(Array.isArray(target.candidateSupport))target.candidateSupport=target.candidateSupport.filter(x=>!excluded(x?.name));const second=body?.second||{},choices=['melchior','balthasar','casper'].map(p=>firstChoice(second,p)).filter(Boolean),counts=new Map();for(const name of choices){const k=norm(name),r=counts.get(k)||{name,n:0};r.n++;counts.set(k,r)}const ranked=[...counts.values()].sort((a,b)=>b.n-a.n||a.name.localeCompare(b.name,'ja')),winner=ranked[0]?.name||target.centerCandidates[0]||'',votes=winner?choices.filter(n=>norm(n)===norm(winner)).length:0;if(winner&&votes>=2){target.status='SELECTION_RESULT';target.centerCandidates=[winner];target.recommendation=`エース第一候補：${winner}。${votes===3?'3賢人の二次判断が一致。':`3賢人中${votes}名が第一候補に選定。`}`;}target.reDeliberationConditions=list(target.reDeliberationConditions).filter(x=>!/^(?:[①-⑳\d\s、,./／・･()（）]+)$/.test(text(x))).slice(0,3);target.warnings=list(target.warnings).slice(0,3);return data;}

window.fetch=async function(input,init){
 const raw=parseBody(init);
 if(!isAce(raw))return previousFetch(input,init);
 const url=urlOf(input);
 if(/\/api\/magi\/core(?:\?|$)/.test(url)){
  try{if(typeof window.MAGI_PREPARE_QUERY_FILES==='function')await window.MAGI_PREPARE_QUERY_FILES('通算成績一覧2026-2027');}catch(e){console.warn('[ACE v401] workbook preload failed',e?.message||e)}
  const canonicalEvidence=buildWorkbookAceEvidence();
  const response=await previousFetch(input,init);
  if(!response.ok||!canonicalEvidence)return response;
  let data;try{data=await response.clone().json();}catch(_){return response}
  if(data&&typeof data==='object'&&(data.action==='DELIBERATE'||data.route==='DELIBERATION')){
   data.evidencePacket=canonicalEvidence;
   data.selectionKind=data.selectionKind||'GENERIC';
   data.understoodRequest=data.understoodRequest||'現チームの投手総合成績を正本に、エース第一候補を比較審議する';
   if(data.semantic&&typeof data.semantic==='object')data.semantic.evidenceSource='CANONICAL_CURRENT_WORKBOOK_PITCHER_SECTION';
   return jsonResponse(response,data);
  }
  return response;
 }
 const prepared=injectPolicy(raw,false);
 let response=await previousFetch(input,{...(init||{}),body:JSON.stringify(prepared)});
 if(!response.ok||!/\/api\/magi\/(?:persona|orchestrate)(?:\?|$)/.test(url))return response;
 let data;try{data=await response.clone().json();}catch(_){return response}
 if(/\/api\/magi\/persona(?:\?|$)/.test(url)){
  if(list(data?.candidatePlayers).some(excluded)){
   const retry=await previousFetch(input,{...(init||{}),body:JSON.stringify(injectPolicy(raw,true))});
   if(retry.ok){try{data=await retry.clone().json();response=retry;}catch(_){}}
  }
  sanitizePersona(data);
 }else{
  const phase=text(raw?.phase).toUpperCase();
  if(phase==='CROSS_EXAMINATION')sanitizeCross(data,prepared);
  if(phase==='FINAL')sanitizeFinal(data,prepared);
 }
 return jsonResponse(response,data);
};

window.MAGI_ACE_SELECTION_CORE_META=Object.freeze({version:'v401',observer:false,canonicalWorkbookPitcherSection:true,catcherBreakdownExcluded:true,catcherSectionExcluded:true,excludedCatcher:EXCLUDED,bestOrderUntouched:true});
})();
