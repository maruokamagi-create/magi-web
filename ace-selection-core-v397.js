(()=>{
'use strict';
if(window.MAGI_ACE_SELECTION_CORE_V397)return;
window.MAGI_ACE_SELECTION_CORE_V397=true;

const text=v=>String(v??'').trim();
const list=v=>Array.isArray(v)?v.filter(Boolean):[];
const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const EXCLUDED='大野 竜暉';
const norm=v=>text(v).normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const excluded=v=>norm(v)===norm(EXCLUDED);
const clone=v=>{try{return JSON.parse(JSON.stringify(v));}catch(_){return v;}};
const nameCols=['選手名','投手名','氏名','名前','選手'];
const statAliases={innings:['投球回','投球回数'],win:['勝利','勝'],loss:['敗北','敗'],save:['セーブ'],batters:['対打者'],pitches:['投球数'],hits:['被安打'],runs:['失点'],earned:['自責点'],walks:['与四球'],hbp:['与死球'],strikeouts:['奪三振'],wildPitches:['暴投']};
const idx=(r,a)=>{const c=r.columns||[],w=a.map(norm);for(let i=0;i<c.length;i++)if(w.includes(norm(c[i])))return i;for(let i=0;i<c.length;i++)if(w.some(x=>x&&norm(c[i]).includes(x)))return i;return-1};
const player=r=>{const i=idx(r,nameCols);return i<0?'':text((r.values||[])[i])};
const season=r=>{const s=`${r.fileName||''} ${r.sheetName||''} ${r.searchable||''}`;if(/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/.test(s))return'2026-2027';if(/2025\s*[-–—_. /]?\s*2026|旧チーム/.test(s))return'2025-2026';return'年度不明'};
const pitching=r=>/^投手詳細(?:2025-2026|2026-2027)\.csv$/i.test(text(r.fileName));
const value=(r,names)=>{const i=idx(r,names);return i<0?'':text((r.values||[])[i])};
const whole=v=>{const s=text(v).replace(/,/g,'');if(!s||s==='-'||s==='—')return null;const x=Number(s);return Number.isFinite(x)?Math.trunc(x):null};
const inningsToOuts=v=>{const m=text(v).replace(/回$/,'').match(/^(\d+)(?:\.(\d))?$/);if(!m)return null;const rem=Number(m[2]||0);return rem<=2?Number(m[1])*3+rem:null};
const formatInnings=o=>`${Math.floor(o/3)}.${o%3}`;
function aggregate(rows){const t={games:rows.length,outs:0,win:0,loss:0,save:0,batters:0,pitches:0,hits:0,runs:0,earned:0,walks:0,hbp:0,strikeouts:0,wildPitches:0};for(const r of rows){const o=inningsToOuts(value(r,statAliases.innings));if(o!==null)t.outs+=o;for(const k of ['win','loss','save','batters','pitches','hits','runs','earned','walks','hbp','strikeouts','wildPitches']){const x=whole(value(r,statAliases[k]));if(x!==null)t[k]+=x}}t.innings=formatInnings(t.outs);t.era=t.outs>0?(t.earned*21/t.outs).toFixed(2):'取得不能';t.walksHbp=t.walks+t.hbp;return t;}
function buildAceEvidence(rows){
 const current=rows.filter(r=>season(r)==='2026-2027');
 const names=[],seen=new Set();
 for(const r of current){const p=player(r),k=norm(p);if(!p||!k||excluded(p)||seen.has(k))continue;seen.add(k);names.push(p)}
 if(!names.length)return null;
 const keys=new Set(names.map(norm));
 const picked=rows.filter(r=>keys.has(norm(player(r))));
 const lines=['【エース候補比較専用 EVIDENCE｜7回制】','2026-2027投手詳細CSVに登板記録がある現チーム投手を自動抽出し、同一基準で比較する。',`【候補除外】${EXCLUDED}は正捕手として運用するためエース候補から除外。`,`【比較対象】${names.join('・')}`,'各賢人は比較対象からエース第一候補を1名だけ選ぶ。現チーム2026-2027を主評価、2025-2026は参考資料とする。'];
 const totals={};
 for(const p of names){totals[p]={};for(const y of ['2026-2027','2025-2026']){const rr=picked.filter(r=>norm(player(r))===norm(p)&&season(r)===y);if(!rr.length)continue;const t=aggregate(rr);totals[p][y]=t;lines.push(`【${p}｜${y}】登板=${t.games}｜投球回=${t.innings}｜防御率=${t.era}｜${t.win}勝${t.loss}敗｜奪三振=${t.strikeouts}｜与四球=${t.walks}｜与死球=${t.hbp}｜自責点=${t.earned}｜被安打=${t.hits}｜投球数=${t.pitches}`)}}
 lines.push('母数不足は不確実性として扱い、数値を推測で補完しない。');
 return{count:picked.length,files:[...new Set(picked.map(r=>r.fileName).filter(Boolean))],seasons:[...new Set(picked.map(season))],players:names,evidenceLayers:['PITCHING ONLY','ACE CANDIDATE COMPARISON','2026-2027 CURRENT','2025-2026 REFERENCE'],missingEvidence:[],canonicalPitchingTotals:totals,summary:`エース候補比較として現チーム投手${names.length}名・投手詳細CSV ${picked.length}行を取得。`,text:lines.join('\n')};
}
function installEvidence(){
 if(typeof window.searchDataEvidence!=='function')return false;
 if(window.searchDataEvidence.__magiAceCompare==='v398')return true;
 const prev=window.searchDataEvidence;
 window.searchDataEvidence=function(q){const s=text(q).normalize('NFKC');if(!ACE_RE.test(s))return prev(q);const rows=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive'&&pitching(r));return buildAceEvidence(rows)||prev(q)};
 window.searchDataEvidence.__magiAceCompare='v398';return true;
}
let evidenceTries=0;const evidenceTimer=setInterval(()=>{evidenceTries++;if(installEvidence()||evidenceTries>=120)clearInterval(evidenceTimer)},100);installEvidence();

const previousFetch=window.fetch.bind(window);
const urlOf=input=>typeof input==='string'?input:text(input?.url);
const parseBody=init=>{if(typeof init?.body!=='string')return null;try{return JSON.parse(init.body);}catch(_){return null;}};
const caseOf=body=>body?.case&&typeof body.case==='object'?body.case:body||{};
const questionOf=body=>text(caseOf(body)?.question||body?.question).normalize('NFKC');
const isAce=body=>!!body&&ACE_RE.test(questionOf(body));
const filtered=values=>list(values).map(text).filter(v=>v&&!excluded(v));
function injectPolicy(body,strong=false){const out=clone(body)||{},c=out.case&&typeof out.case==='object'?out.case:null;if(!c)return out;c.evidence=c.evidence&&typeof c.evidence==='object'?c.evidence:{};c.evidence.aceSelectionPolicy={excludedPlayers:[EXCLUDED],reason:'正捕手として運用するためエース候補から除外',candidateCount:1};const rule='【エース選定条件】大野 竜暉は正捕手として運用するため候補外。投手成績は比較資料として参照してよいが候補には含めない。他の現チーム投手から第一候補を1名だけ選ぶ。';if(!text(c.question).includes('【エース選定条件】'))c.question=`${text(c.question)}\n${rule}`;if(strong)c.question+='\n【再選定】大野 竜暉以外から第一候補を1名だけ返す。';return out;}
function jsonResponse(original,data){const headers=new Headers(original.headers||{});headers.set('content-type','application/json; charset=utf-8');headers.delete('content-length');headers.delete('content-encoding');return new Response(JSON.stringify(data),{status:original.status,statusText:original.statusText,headers});}
function sanitizePersona(data){if(!data||typeof data!=='object')return data;data.candidatePlayers=filtered(data.candidatePlayers).slice(0,1);if(!data.candidatePlayers.length){data.reviewRequested=true;data.reviewReason='正捕手を除外した条件で別の投手から第一候補を再選定する必要がある。';data.publicStatement='正捕手は候補外。別の投手から第一候補を再選定します。';}return data;}
function firstChoice(group,persona){return filtered(group?.[persona]?.candidatePlayers)[0]||'';}
function sanitizeCross(data,body){if(!data||typeof data!=='object')return data;const p=body?.primary||{},m=firstChoice(p,'melchior'),b=firstChoice(p,'balthasar'),c=firstChoice(p,'casper'),label=n=>n||'第一候補';data.challenges={melchior:[`${label(m)}を第一候補とする根拠を、投球回・四死球・奪三振・失点内容を同じ基準で再確認してください。`],balthasar:[`${label(b)}を第一候補とした場合、7回制で先発として試合を作る役割と継投の組みやすさを確認してください。`],casper:[`${label(c)}について、現在の守備役割との両立と継続起用まで含めて確認してください。`]};const choices=[m,b,c].filter(Boolean),unique=[...new Map(choices.map(n=>[norm(n),n])).values()];data.agreement=unique.length===1?[`3賢人とも${unique[0]}を第一候補に選定。`]:['現チームの投手成績と起用実績を同一基準で比較。'];data.disagreement=unique.length===1?['第一候補に相違なし。']:[`第一候補が分かれている：${choices.join('・')}。`];data.warnings=list(data.warnings).filter(x=>!/ルールに抵触|規約|ポリシー/.test(text(x))).slice(0,2);data.informationGaps=list(data.informationGaps).slice(0,2);return data;}
function sanitizeFinal(data,body){if(!data||typeof data!=='object')return data;const target=data?.final&&typeof data.final==='object'?data.final:data;if(text(target?.mode).toUpperCase()!=='SELECTION')return data;target.centerCandidates=filtered(target.centerCandidates).slice(0,1);target.recommendedCandidates=filtered(target.recommendedCandidates);target.alternateCandidates=filtered(target.alternateCandidates);if(Array.isArray(target.candidateSupport))target.candidateSupport=target.candidateSupport.filter(x=>!excluded(x?.name));const second=body?.second||{},choices=['melchior','balthasar','casper'].map(p=>firstChoice(second,p)).filter(Boolean),counts=new Map();for(const name of choices){const k=norm(name),r=counts.get(k)||{name,n:0};r.n++;counts.set(k,r)}const ranked=[...counts.values()].sort((a,b)=>b.n-a.n||a.name.localeCompare(b.name,'ja')),winner=ranked[0]?.name||target.centerCandidates[0]||'',votes=winner?choices.filter(n=>norm(n)===norm(winner)).length:0;if(winner&&votes>=2){target.status='SELECTION_RESULT';target.centerCandidates=[winner];target.recommendation=`エース第一候補：${winner}。${votes===3?'3賢人の二次判断が一致。':`3賢人中${votes}名が第一候補に選定。`}`;}target.reDeliberationConditions=list(target.reDeliberationConditions).filter(x=>!/^(?:[①-⑳\d\s、,./／・･()（）]+)$/.test(text(x))).slice(0,3);target.warnings=list(target.warnings).slice(0,3);return data;}
window.fetch=async function(input,init){const raw=parseBody(init);if(!isAce(raw))return previousFetch(input,init);const url=urlOf(input),prepared=injectPolicy(raw,false);let response=await previousFetch(input,{...(init||{}),body:JSON.stringify(prepared)});if(!response.ok||!/\/api\/magi\/(?:persona|orchestrate)(?:\?|$)/.test(url))return response;let data;try{data=await response.clone().json();}catch(_){return response}if(/\/api\/magi\/persona(?:\?|$)/.test(url)){if(list(data?.candidatePlayers).some(excluded)){const retry=await previousFetch(input,{...(init||{}),body:JSON.stringify(injectPolicy(raw,true))});if(retry.ok){try{data=await retry.clone().json();response=retry;}catch(_){}}}sanitizePersona(data);}else{const phase=text(raw?.phase).toUpperCase();if(phase==='CROSS_EXAMINATION')sanitizeCross(data,prepared);if(phase==='FINAL')sanitizeFinal(data,prepared);}return jsonResponse(response,data);};
window.MAGI_ACE_SELECTION_CORE_META=Object.freeze({version:'v398',observer:false,genericAceEvidence:true,excludedCatcher:EXCLUDED,bestOrderUntouched:true});
})();
