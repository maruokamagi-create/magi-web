(()=>{
'use strict';
if(window.MAGI_ACE_DOUBLE_CHECK_V403)return;
window.MAGI_ACE_DOUBLE_CHECK_V403=true;

const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const EXCLUDED='大野 竜暉';
const PITCHERS=['橋向 結都','大久保 陽翔','大久保 夢翔','中嶋 玲月','坂田 暉馬','大野 竜暉'];
const txt=v=>String(v??'').trim();
const norm=v=>txt(v).normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const canonical=new Map(PITCHERS.map(n=>[norm(n),n]));
const cname=v=>canonical.get(norm(v))||'';
const num=v=>{const s=txt(v).replace(/,/g,'').replace(/%$/,'');if(!s||s==='-'||s==='—')return null;const n=Number(s);return Number.isFinite(n)?n:null};
const int=v=>{const n=num(v);return n===null?null:Math.trunc(n)};
const inningsToOuts=v=>{const m=txt(v).replace(/回$/,'').match(/^(\d+)(?:\.(\d))?$/);if(!m)return null;const rem=Number(m[2]||0);return rem<=2?Number(m[1])*3+rem:null};
const fmtInnings=o=>`${Math.floor(o/3)}.${o%3}`;
const sameSeason=f=>norm(`${f?.name||''} ${f?.path||''}`).includes('20262027');
const isWorkbookFile=f=>sameSeason(f)&&/通算成績一覧/i.test(txt(f?.name))&&/\.(?:xlsm|xlsx|xls)$/i.test(txt(f?.name));
const isPitchCsv=f=>sameSeason(f)&&/投手(?:成績|詳細)/i.test(`${f?.name||''} ${f?.path||''}`)&&/\.csv$/i.test(txt(f?.name));
const jsonResponse=(base,data)=>{const h=new Headers(base?.headers||{});h.set('content-type','application/json; charset=utf-8');h.delete('content-length');h.delete('content-encoding');return new Response(JSON.stringify(data),{status:base?.status||200,statusText:base?.statusText||'OK',headers:h});};
const plainJson=data=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

const HEADER_ALIASES={
 pitcher:['投手名','選手名','選手'],catcher:['捕手名'],era:['防御率'],games:['登板数','登板'],innings:['投球回','投球回数'],
 win:['勝利','勝'],loss:['敗北','敗'],save:['セーブ'],batters:['対打者'],pitches:['投球数'],strikes:['ストライク'],balls:['ボール'],
 strikeRate:['ストライク率'],hits:['被安打'],runs:['失点'],earned:['自責点'],wildPitches:['暴投'],walks:['与四球'],hbp:['与死球'],walksHbp:['与四死球','四死球'],strikeouts:['奪三振'],kRate:['奪三振率'],
 date:['開催日','日付','試合日'],opponent:['相手校','対戦相手','相手'],gameNo:['試合番号','ゲーム番号','試合No','試合NO','第何試合']
};
function findHeaderIndex(row,aliases){const cells=(row||[]).map(norm);for(let i=0;i<cells.length;i++){if(aliases.some(a=>cells[i]===norm(a)))return i;}for(let i=0;i<cells.length;i++){if(aliases.some(a=>norm(a)&&cells[i].includes(norm(a))))return i;}return-1;}
function headerMap(row){const out={};for(const [k,a] of Object.entries(HEADER_ALIASES))out[k]=findHeaderIndex(row,a);return out;}
function headerScore(m){return ['pitcher','era','games','innings','earned','strikeouts'].filter(k=>m[k]>=0).length;}
function cell(row,i){return i>=0?txt((row||[])[i]):'';}
function statFromRow(row,m){
 const innings=cell(row,m.innings),outs=inningsToOuts(innings);
 const eraN=num(cell(row,m.era));
 return {
  games:int(cell(row,m.games))??0,outs:outs??0,innings:outs===null?innings:fmtInnings(outs),era:eraN===null?'取得不能':eraN.toFixed(2),
  win:int(cell(row,m.win))??0,loss:int(cell(row,m.loss))??0,save:int(cell(row,m.save))??0,
  batters:int(cell(row,m.batters))??0,pitches:int(cell(row,m.pitches))??0,strikes:int(cell(row,m.strikes))??0,balls:int(cell(row,m.balls))??0,
  strikeRate:cell(row,m.strikeRate),hits:int(cell(row,m.hits))??0,runs:int(cell(row,m.runs))??0,earned:int(cell(row,m.earned))??0,
  wildPitches:int(cell(row,m.wildPitches))??0,walks:int(cell(row,m.walks))??0,hbp:int(cell(row,m.hbp))??0,
  walksHbp:m.walksHbp>=0?(int(cell(row,m.walksHbp))??0):((int(cell(row,m.walks))??0)+(int(cell(row,m.hbp))??0)),
  strikeouts:int(cell(row,m.strikeouts))??0,kRate:cell(row,m.kRate)
 };
}
function workbookPitcherStats(buffer){
 if(!window.XLSX)throw new Error('Excel読込ライブラリを利用できません');
 const wb=XLSX.read(buffer,{type:'array'}),found={};
 for(const sheetName of wb.SheetNames){
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:''});
  let hi=-1,map=null;
  for(let i=0;i<rows.length;i++){
   const m=headerMap(rows[i]);
   if(m.pitcher>=0&&m.era>=0&&m.innings>=0&&headerScore(m)>=4){hi=i;map=m;break;}
  }
  if(hi<0||!map)continue;
  let started=false;
  for(let i=hi+1;i<rows.length;i++){
   const row=rows[i],joined=(row||[]).map(txt).join(' ');
   if(/捕手部門/.test(joined)&&started)break;
   const firstText=(row||[]).map(txt).filter(Boolean)[0]||'';
   if(/^(?:総計|合計|計)$/.test(firstText)&&started)break;
   const p=cname(cell(row,map.pitcher));
   if(!p)continue;
   const catcher=map.catcher>=0?cell(row,map.catcher):'';
   if(catcher)continue;
   const s=statFromRow(row,map);
   if(!s.outs)continue;
   started=true;
   if(found[p]){
    const a=JSON.stringify(found[p]),b=JSON.stringify(s);
    if(a!==b)throw new Error(`通算成績一覧内で${p}の投手総合行が複数あり数値が一致しません`);
   }else found[p]=s;
  }
 }
 return found;
}
function parseCsv(text){
 const rows=[];let row=[],cellv='',q=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(q){if(c==='"'&&text[i+1]==='"'){cellv+='"';i++;continue}if(c==='"'){q=false;continue}cellv+=c;continue}
  if(c==='"'){q=true;continue}
  if(c===','){row.push(cellv);cellv='';continue}
  if(c==='\n'){row.push(cellv.replace(/\r$/,''));if(row.some(v=>txt(v)))rows.push(row);row=[];cellv='';continue}
  cellv+=c;
 }
 row.push(cellv.replace(/\r$/,''));if(row.some(v=>txt(v)))rows.push(row);return rows;
}
function flagValue(v,type){const n=int(v);if(n!==null)return n;const s=txt(v);if(!s)return 0;if(type==='win'&&/(?:勝|○|W)/i.test(s))return 1;if(type==='loss'&&/(?:敗|●|L)/i.test(s))return 1;if(type==='save'&&/(?:S|セーブ)/i.test(s))return 1;return 0;}
function csvPitcherStats(text){
 const rows=parseCsv(text);let hi=-1,map=null;
 for(let i=0;i<Math.min(rows.length,30);i++){const m=headerMap(rows[i]);if(m.pitcher>=0&&m.innings>=0&&headerScore(m)>=3){hi=i;map=m;break;}}
 if(hi<0||!map)throw new Error('投手成績CSVのヘッダーを特定できません');
 const out={},gameKeys={};
 const ensure=p=>out[p]||(out[p]={games:0,outs:0,win:0,loss:0,save:0,batters:0,pitches:0,strikes:0,balls:0,hits:0,runs:0,earned:0,wildPitches:0,walks:0,hbp:0,walksHbp:0,strikeouts:0,_rows:0,_gameField:map.games>=0,_combinedBB:map.walksHbp>=0});
 for(let i=hi+1;i<rows.length;i++){
  const row=rows[i],p=cname(cell(row,map.pitcher));if(!p)continue;
  const o=inningsToOuts(cell(row,map.innings));if(o===null)continue;
  const s=ensure(p);s._rows++;s.outs+=o;
  if(map.games>=0)s.games+=int(cell(row,map.games))??0;
  else{
   const parts=[cell(row,map.date),cell(row,map.opponent),cell(row,map.gameNo)].filter(Boolean);
   const key=parts.length?parts.join('|'):`row:${i}`;
   gameKeys[p]??=new Set();gameKeys[p].add(key);
  }
  s.win+=flagValue(cell(row,map.win),'win');s.loss+=flagValue(cell(row,map.loss),'loss');s.save+=flagValue(cell(row,map.save),'save');
  for(const k of ['batters','pitches','strikes','balls','hits','runs','earned','wildPitches','walks','hbp','strikeouts']){if(map[k]>=0)s[k]+=int(cell(row,map[k]))??0;}
  if(map.walksHbp>=0)s.walksHbp+=int(cell(row,map.walksHbp))??0;
 }
 for(const [p,s] of Object.entries(out)){
  if(!s._gameField)s.games=gameKeys[p]?.size||s._rows;
  if(!s._combinedBB)s.walksHbp=s.walks+s.hbp;
  s.innings=fmtInnings(s.outs);s.era=s.outs>0?(s.earned*21/s.outs).toFixed(2):'取得不能';
  delete s._rows;delete s._gameField;delete s._combinedBB;
 }
 return {stats:out,map};
}
function decodeBuffer(buffer){if(typeof window.MAGI_DECODE_TEXT_SMART==='function')return window.MAGI_DECODE_TEXT_SMART(buffer);try{return new TextDecoder('utf-8',{fatal:false}).decode(buffer)}catch(_){return''}}
function findSources(files){
 const workbook=files.find(isWorkbookFile)||null;
 let csv=files.filter(isPitchCsv).sort((a,b)=>{const aa=/投手成績/i.test(txt(a?.name))?0:1,bb=/投手成績/i.test(txt(b?.name))?0:1;return aa-bb;})[0]||null;
 if(!csv)csv=files.find(f=>/\.csv$/i.test(txt(f?.name))&&/投手/i.test(`${f?.name||''} ${f?.path||''}`))||null;
 return {workbook,csv};
}
async function getIndex(baseFetch){const r=await baseFetch('/api/drive/index',{cache:'no-store',credentials:'same-origin'});const d=await r.json().catch(()=>({}));if(!r.ok||!d?.configured)throw new Error('Google Driveの目次を取得できません');return Array.isArray(d.files)?d.files:[];}
async function fetchBinary(baseFetch,file){const r=await baseFetch(`/api/drive/file?id=${encodeURIComponent(file.id)}`,{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error(`${file.name} を取得できません (${r.status})`);return await r.arrayBuffer();}
function eq(a,b){return String(a)===String(b);}
function compareStats(work,csv,names){
 const errors=[];
 const metrics=[['games','登板数'],['outs','投球回'],['win','勝利'],['loss','敗北'],['save','セーブ'],['hits','被安打'],['runs','失点'],['earned','自責点'],['walksHbp','四死球'],['strikeouts','奪三振']];
 for(const p of names){
  const w=work[p],c=csv[p];if(!w){errors.push(`${p}: 通算成績一覧の投手総合行なし`);continue}if(!c){errors.push(`${p}: 投手成績CSVの登板記録なし`);continue}
  if(!eq(w.era,c.era))errors.push(`${p} 防御率: 通算${w.era} / CSV再集計${c.era}`);
  for(const [k,label] of metrics){if(!eq(w[k],c[k]))errors.push(`${p} ${label}: 通算${k==='outs'?w.innings:w[k]} / CSV再集計${k==='outs'?c.innings:c[k]}`);}
 }
 return errors;
}
function buildPacket(work,csv,workbook,csvFile){
 const names=PITCHERS.filter(p=>p!==EXCLUDED&&work[p]&&csv[p]);
 const totals={};for(const p of names){totals[p]={'2026-2027':{...csv[p]}};}
 if(work[EXCLUDED]&&csv[EXCLUDED])totals[EXCLUDED]={'2026-2027':{...csv[EXCLUDED]}};
 const lines=[
  '【エース候補比較専用 EVIDENCE｜二重照合済】',
  `【照合元A】${workbook.name} の投手部門・投手総合行`,
  `【照合元B】${csvFile.name} を試合単位から再集計`,
  '【照合結果】投球回・登板数・勝敗・セーブ・被安打・失点・自責点・四死球・奪三振・防御率を突き合わせ、一致を確認。',
  `【候補除外】${EXCLUDED}は正捕手として運用するためエース候補から除外。`,
  `【比較対象】${names.join('・')}`
 ];
 for(const p of names){const s=csv[p];lines.push(`【${p}】防御率=${s.era}｜登板=${s.games}｜投球回=${s.innings}｜${s.win}勝${s.loss}敗｜セーブ=${s.save}｜奪三振=${s.strikeouts}｜四死球=${s.walksHbp}｜被安打=${s.hits}｜失点=${s.runs}｜自責点=${s.earned}`);}
 lines.push('数値は2系統が一致した項目のみ審議根拠として使用する。不一致が出た場合は審議を停止し、推測で補完しない。');
 return {count:names.length,files:[workbook.name,csvFile.name],seasons:['2026-2027'],players:names,evidenceLayers:['DOUBLE CHECK VERIFIED','CANONICAL WORKBOOK PITCHER SECTION','PITCHING CSV REAGGREGATION','2026-2027 CURRENT'],missingEvidence:[],canonicalPitchingTotals:totals,verification:{status:'VERIFIED',workbook:workbook.name,csv:csvFile.name,checkedMetrics:['登板数','投球回','勝敗','セーブ','被安打','失点','自責点','四死球','奪三振','防御率']},summary:`${workbook.name} と ${csvFile.name} を二重照合し、候補${names.length}名の投手成績一致を確認。`,text:lines.join('\n')};
}
async function buildVerified(baseFetch){
 const files=await getIndex(baseFetch),{workbook,csv}=findSources(files);
 if(!workbook)return{ok:false,message:'エース審議を停止しました。通算成績一覧2026-2027のExcel原本を取得できません。'};
 if(!csv)return{ok:false,message:'エース審議を停止しました。2026-2027の投手成績CSV／投手詳細CSVを取得できません。通算成績一覧だけでは判定しません。'};
 const [wbBuf,csvBuf]=await Promise.all([fetchBinary(baseFetch,workbook),fetchBinary(baseFetch,csv)]);
 const work=workbookPitcherStats(wbBuf),csvParsed=csvPitcherStats(decodeBuffer(csvBuf)),csvStats=csvParsed.stats;
 const names=PITCHERS.filter(p=>p!==EXCLUDED&&(work[p]||csvStats[p]));
 if(names.length<3)return{ok:false,message:'エース審議を停止しました。二重照合できる現チーム投手が不足しています。'};
 const errors=compareStats(work,csvStats,names);
 if(errors.length)return{ok:false,message:`エース審議を停止しました。通算成績一覧と投手成績CSVの数値不一致を検出しました。\n${errors.slice(0,8).join('\n')}${errors.length>8?`\nほか${errors.length-8}件`:''}`,details:errors,files:[workbook.name,csv.name]};
 return{ok:true,packet:buildPacket(work,csvStats,workbook,csv),workbook,csv};
}

const baseFetch=window.fetch.bind(window);
const urlOf=input=>typeof input==='string'?input:txt(input?.url);
const bodyOf=init=>{if(typeof init?.body!=='string')return null;try{return JSON.parse(init.body)}catch(_){return null}};
window.fetch=async function(input,init){
 const url=urlOf(input),body=bodyOf(init),question=txt(body?.question||body?.case?.question).normalize('NFKC');
 if(!/\/api\/magi\/core(?:\?|$)/.test(url)||!ACE_RE.test(question))return baseFetch(input,init);
 let verified;
 try{verified=await buildVerified(baseFetch);}catch(error){verified={ok:false,message:`エース審議を停止しました。投手成績の二重照合に失敗しました：${error?.message||error}`};}
 if(!verified.ok){return plainJson({handled:true,action:'CLARIFY',route:'CLARIFY',understoodRequest:'エース候補の投手成績を二重照合する',clarificationQuestion:verified.message,answer:verified.message,source:{name:'DATA HUB DOUBLE CHECK'}});}
 const response=await baseFetch(input,init);if(!response.ok)return response;
 let data;try{data=await response.clone().json();}catch(_){return response}
 if(data&&typeof data==='object'&&(data.action==='DELIBERATE'||data.route==='DELIBERATION')){
  data.evidencePacket=verified.packet;
  data.selectionKind=data.selectionKind||'GENERIC';
  data.understoodRequest='通算成績一覧と投手成績CSVを二重照合し、現チームのエース第一候補を審議する';
  data.semantic=data.semantic&&typeof data.semantic==='object'?data.semantic:{};
  data.semantic.evidenceSource='DOUBLE_CHECKED_WORKBOOK_AND_PITCHING_CSV';
  return jsonResponse(response,data);
 }
 return response;
};
window.MAGI_ACE_DOUBLE_CHECK_META=Object.freeze({version:'v403',failClosed:true,sources:['通算成績一覧2026-2027 Excel 投手部門','2026-2027 投手成績/投手詳細 CSV 再集計'],excludedCatcher:EXCLUDED,bestOrderUntouched:true});
})();