(()=>{
'use strict';
if(window.MAGI_FIELDING_DIRECT_REPORT_V327)return;
window.MAGI_FIELDING_DIRECT_REPORT_V327=true;

const FIELD_RE=/守備|守備成績|守備率|守備機会|補殺|刺殺|失策|併殺|三重殺|捕逸|許盗塁|盗塁企図|盗塁阻止|牽制刺|捕妨害/i;
const DECISION_RE=/審議|べき|どう思う|評価して|比較して|候補|起用|固定|スタメン|適性|戦術|采配|任せる|推薦|提案|守らせ|コンバート/i;
const REQUEST_RE=/成績|一覧|通算|今期|今季|今年|年度|シーズン|直近|最近|レポート|出して|教えて|見せて|表示|知りたい|何|は[？?]?$/i;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
function isFieldingQuery(q){q=String(q||'').trim();return q&&FIELD_RE.test(q)&&REQUEST_RE.test(q)&&!DECISION_RE.test(q)}
function mainButton(node){const b=node?.closest?.('button');if(!b)return null;const oc=String(b.getAttribute?.('onclick')||'');return /runMagi/.test(oc)||/MAGI実行/.test(String(b.textContent||''))?b:null}
function fmt(v,type='int'){
 if(v===''||v===null||v===undefined)return'—';const x=Number(v);if(!Number.isFinite(x))return String(v);
 if(type==='rate3')return x.toFixed(3).replace(/^0(?=\.)/,'');
 if(type==='pct1')return `${(x*100).toFixed(1)}%`;
 return String(Math.round(x));
}
function ensureStyle(){if($('fieldingReportStyleV327'))return;const s=document.createElement('style');s.id='fieldingReportStyleV327';s.textContent=`
.fieldingPanel{display:none;margin:18px 0}.fieldingPanel.show{display:block}.fieldingPaper{background:#f8fbff;color:#102033;border-radius:18px;overflow:hidden;box-shadow:0 14px 34px rgba(0,0,0,.28)}
.fieldingHead{padding:18px 18px 15px;background:#0b2239;color:#fff}.fieldingBrand{font-size:11px;letter-spacing:.18em;color:#8fc7e7}.fieldingHead h2{font-size:27px;line-height:1.2;margin:8px 0 3px}.fieldingHead p{margin:0;color:#c7d9e8;font-size:13px}.fieldingSection{padding:17px 16px;border-top:1px solid #dbe5ee}.fieldingSection:first-of-type{border-top:0}.fieldingSectionTop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.fieldingSectionTop b{font-size:18px}.fieldingBadge{font-size:11px;font-weight:800;border:1px solid #8db3ce;border-radius:999px;padding:5px 9px;color:#315a78}.fieldingFeatured{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}.fieldingFeature,.fieldingMetric{background:#edf5fb;border:1px solid #d2e2ee;border-radius:12px;padding:10px 8px;text-align:center}.fieldingFeature span,.fieldingMetric span{display:block;font-size:10px;color:#61778b;margin-bottom:4px}.fieldingFeature b{font-size:22px}.fieldingMetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.fieldingMetric b{font-size:16px}.fieldingSource{font-size:10px;color:#647b90;line-height:1.55;margin-top:10px}.fieldingBreakHead{display:flex;justify-content:space-between;align-items:end;gap:10px;margin:17px 0 7px}.fieldingBreakHead b{font-size:15px}.fieldingBreakHead span{font-size:10px;color:#71869a}.fieldingTableWrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #d5e1ea;border-radius:12px}.fieldingTable{border-collapse:collapse;min-width:740px;width:100%;font-size:11px}.fieldingTable th,.fieldingTable td{padding:8px 7px;border-bottom:1px solid #e1e8ee;text-align:right;white-space:nowrap}.fieldingTable th:first-child,.fieldingTable td:first-child{text-align:left;position:sticky;left:0;background:#f8fbff}.fieldingTable thead th{background:#e9f2f8;font-weight:800}.fieldingHold{margin-top:12px;padding:10px;border-radius:10px;background:#fff5df;color:#72531a;font-size:11px;line-height:1.5}.fieldingActions{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px 18px;background:#eaf2f8}.fieldingActions button{border:0;border-radius:11px;padding:11px 14px;font-weight:800;background:#102c47;color:#fff}.fieldingActions button.secondary{background:#dce8f1;color:#17354e}.fieldingFooter{padding:12px 16px 18px;background:#f1f6fa;color:#60778c;font-size:10px;line-height:1.55}
@media(max-width:520px){.fieldingFeatured{grid-template-columns:repeat(3,1fr)}.fieldingMetrics{grid-template-columns:repeat(3,1fr)}.fieldingHead h2{font-size:25px}.fieldingFeature b{font-size:20px}}
@media print{.fieldingActions{display:none!important}.fieldingPaper{box-shadow:none;border-radius:0}}
`;document.head.appendChild(s)}
function panel(){let p=$('fieldingLookupPanelV327');if(p)return p;p=document.createElement('div');p.id='fieldingLookupPanelV327';p.className='fieldingPanel';const response=$('response'),judge=$('judge');if(response?.parentNode)response.parentNode.insertBefore(p,response);else judge?.appendChild(p);return p}
const METRICS=[['CHANCES','守備機会'],['PUTOUTS','刺殺'],['ASSISTS','補殺'],['ERRORS','失策'],['DP','併殺'],['TP','三重殺'],['C_INN','捕手回数','text'],['PB','捕逸'],['SB_ALLOWED','許盗塁'],['SB_ATT','盗塁企図'],['CS','盗塁阻止'],['PK','牽制刺'],['CI','捕妨害']];
const BREAK=[['CHANCES','守備機会'],['PUTOUTS','刺殺'],['ASSISTS','補殺'],['ERRORS','失策'],['FIELD_PCT','守備率','rate3'],['C_INN','捕手回数','text'],['PB','捕逸'],['SB_ALLOWED','許盗塁'],['CS','盗塁阻止'],['CS_PCT','阻止率','pct1']];
function val(v,k,t){if(t==='text')return v?.[k]||'—';return fmt(v?.[k],t||'int')}
function opponentMarkup(rec){
 if(!rec.breakdownAllowed)return`<div class="fieldingHold">相手校別は、正本と守備詳細CSVの照合が完了していないため表示を保留しています。総合成績はXLSM正本値です。</div>`;
 const list=rec.opponentRows||[];if(!list.length)return`<div class="fieldingHold">相手校別に集計できる守備記録がありません。</div>`;
 const head=BREAK.map(([,l])=>`<th>${esc(l)}</th>`).join('');
 const body=list.map(r=>`<tr><td>${esc(r.label)}</td>${BREAK.map(([k,,t])=>`<td>${esc(val(r.values,k,t))}</td>`).join('')}</tr>`).join('');
 return`<div class="fieldingBreakHead"><b>相手校別守備成績</b><span>照合済み守備詳細から再集計</span></div><div class="fieldingTableWrap"><table class="fieldingTable"><thead><tr><th>相手校</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function reportMarkup(result){
 const d=new Date(),date=`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
 const sections=(result.records||[]).map(rec=>{
  const v=rec.values||{},type=rec.isCareer?'CAREER':'SEASON',badge=rec.isCareer?'全年度再集計':'年度別';
  const featured=`<div class="fieldingFeatured"><div class="fieldingFeature"><span>守備率</span><b>${esc(val(v,'FIELD_PCT','rate3'))}</b></div><div class="fieldingFeature"><span>守備機会</span><b>${esc(val(v,'CHANCES'))}</b></div><div class="fieldingFeature"><span>失策</span><b>${esc(val(v,'ERRORS'))}</b></div></div>`;
  const cells=METRICS.map(([k,l,t])=>`<div class="fieldingMetric"><span>${esc(l)}</span><b>${esc(val(v,k,t))}</b></div>`).join('');
  const catcher=n(v.SB_ATT)>0?`<div class="fieldingMetric"><span>盗塁阻止率</span><b>${esc(val(v,'CS_PCT','pct1'))}</b></div>`:'';
  const master=rec.source?.master?.name||'',detail=rec.source?.detail?.name||'';
  return`<section class="fieldingSection"><div class="fieldingSectionTop"><b>${esc(rec.label)}</b><span class="fieldingBadge">${type} / ${badge}</span></div>${featured}<div class="fieldingMetrics">${cells}${catcher}</div><div class="fieldingSource"><b>正本：</b>${esc(master)}<br><b>相手校別：</b>${esc(detail||'—')}</div>${opponentMarkup(rec)}</section>`;
 }).join('');
 return`<article id="statsPdfSource" class="fieldingPaper"><header class="fieldingHead"><div class="fieldingBrand">MAGI DATA REPORT</div><h2>${esc(result.target)}　守備成績</h2><p>PLAYER FIELDING RECORD / ${esc(result.wanted||'守備成績')}　・　発行 ${date}</p></header>${sections}<footer class="fieldingFooter">総合値は各年度XLSM正本内の「守備詳細」を再集計した値を採用しています。相手校別は、対象選手についてXLSM正本値と一致した守備詳細CSVのみ使用します。守備率＝（刺殺＋補殺）÷（刺殺＋補殺＋失策）。盗塁阻止率＝盗塁阻止÷盗塁企図。</footer></article>`;
}
function router(){if($('routeValue'))$('routeValue').textContent='守備成績照会＋相手校別';if($('routeBadge'))$('routeBadge').textContent='FIELD';if($('routeHelp'))$('routeHelp').textContent='XLSM正本の守備成績を基準に、照合済み守備詳細から相手校別成績を再集計します。'}
function render(result){ensureStyle();const p=panel();p.innerHTML=reportMarkup(result)+`<div class="fieldingActions"><button id="fieldingPreviewV327" type="button">A4プレビュー</button><button id="fieldingPdfV327" class="secondary" type="button">PDF保存プレビュー</button></div>`;p.classList.add('show');$('response')?.classList.remove('show');const live=$('magiLiveAnswerV326');if(live)live.style.display='none';$('fieldingPreviewV327')?.addEventListener('click',()=>window.MAGI_PREVIEW_STATS_REPORT?.());$('fieldingPdfV327')?.addEventListener('click',()=>window.MAGI_PRINT_STATS_REPORT?.());if($('status'))$('status').textContent=`${result.target}の守備成績・相手校別成績を表示しました。`;p.scrollIntoView({behavior:'smooth',block:'start'})}
function renderError(message){ensureStyle();const p=panel();p.innerHTML=`<div class="fieldingHold"><b>守備成績照会を完了できませんでした</b><br>${esc(message)}</div>`;p.classList.add('show');p.scrollIntoView({behavior:'smooth',block:'center'})}
async function request(question){const c=new AbortController(),t=setTimeout(()=>c.abort(),40000);try{const r=await fetch('/api/magi/fielding-report',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({question}),signal:c.signal});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d?.error||`守備成績 API ${r.status}`),{status:r.status});return d}finally{clearTimeout(t)}}
let busy=false;
async function run(e,btn){const q=String($('q')?.value||'').trim();if(!isFieldingQuery(q)||busy)return false;e?.preventDefault?.();e?.stopPropagation?.();e?.stopImmediatePropagation?.();busy=true;const old=btn?.textContent;router();if(btn){btn.disabled=true;btn.textContent='守備成績を集計中…'}if($('status'))$('status').textContent='守備成績照会：正本を確認し、相手校別を再集計しています…';try{const result=await request(q);render(result)}catch(err){console.warn('[MAGI fielding report v327]',err?.message||err);if(err?.status===401)renderError('LINEログインを確認してください。');else if(err?.status===403)renderError('利用承認を確認してください。');else renderError(err?.message||'守備成績を取得できませんでした。')}finally{if(btn){btn.disabled=false;btn.textContent=old||'MAGI実行'}busy=false}return true}

window.addEventListener('click',e=>{const b=mainButton(e.target);if(b&&isFieldingQuery($('q')?.value))run(e,b)},true);
window.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.isComposing||e.target!==$('q')||!isFieldingQuery($('q')?.value))return;const b=[...document.querySelectorAll('button')].find(x=>/MAGI実行/.test(String(x.textContent||'')))||null;run(e,b)},true);
})();
