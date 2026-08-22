(()=>{
  const css=`
  .finalDetails{margin-top:12px;padding-top:11px;border-top:1px solid #294864}
  .finalDetail{display:grid;grid-template-columns:96px 1fr;gap:10px;padding:8px 0;border-top:1px solid rgba(100,140,175,.16)}
  .finalDetail:first-child{border-top:0;padding-top:2px}
  .finalDetail b{font-size:10px;letter-spacing:.08em;color:#9fc0dc}
  .finalDetail span{font-size:12px;line-height:1.7;color:#e2ebf3}
  .finalConfidence{margin-top:8px;font-size:11px;color:#91aac0}
  @media(max-width:430px){.finalDetail{grid-template-columns:1fr;gap:3px;padding:8px 0}.finalDetail span{font-size:12px}.finalDetails{margin-top:11px}}
  `;
  const st=document.createElement('style');st.id='magi-final-detail-v103-style';st.textContent=css;document.head.appendChild(st);

  const oldRun=runMagi;
  const text=id=>($(id)?.textContent||'').trim();
  const esc=s=>escapeHtml(String(s||''));
  const first=s=>String(s||'').split(/。|\n/).map(x=>x.trim()).filter(Boolean)[0]||'';
  const voteLabel=t=>/◎/.test(t)?'賛成':/○/.test(t)?'条件付き賛成':/△/.test(t)?'判断保留':/×|✕/.test(t)?'反対':'未判定';
  function metric(src,label){const m=src.match(new RegExp(label+'\\s*([.0-9]+%?)'));return m?m[1]:''}
  function buildFinalDetails(){
    const reasonEl=$('reason'),nextEl=$('next');
    if(!reasonEl||!nextEl||!$('response')?.classList.contains('show'))return;
    const oldReason=reasonEl.textContent||'';
    const oldNext=nextEl.textContent||'';
    const conf=(oldReason.match(/総合確度\s*(\d+)%/)||[])[1]||'';
    const verdict=text('verdict');
    const q=text('q');
    const mv=voteLabel(text('v1')),bv=voteLabel(text('v2')),cv=voteLabel(text('v3'));
    const mText=text('mText'),mConcern=text('mConcern'),bConcern=text('bConcern'),cConcern=text('cConcern');
    let why='',condition='',recheck='';

    if(/1番|一番|リードオフ|先頭打者/.test(q)){
      const obp=metric(mText,'出塁率'),bb=metric(mText,'四球率'),kr=metric(mText,'三振率'),sb=metric(mText,'盗塁');
      const plus=[obp&&`出塁率${obp}`,bb&&`四球率${bb}`].filter(Boolean).join('・');
      const risk=[kr&&`三振率${kr}`,sb&&`盗塁${sb}`].filter(Boolean).join('・');
      why=`${plus||'打撃実績'}を評価し、データ面と戦術面が1番起用を支持。一方、${risk||'走塁・継続性'}と人の面の未確認事項が残るため「${verdict}」とします。`;
      condition='1番起用は継続しつつ固定はしない。本人の役割理解・負担感も確認します。';
      recheck='出塁率の低下／三振増加／他の1番候補の上昇／本人の負担増';
    }else{
      const votes=`データ面：${mv}、戦術面：${bv}、人の面：${cv}`;
      if(/条件付き/.test(verdict)) why=`${votes}。賛成側が多数ですが、保留・反対側の懸念が残るため条件付きで可決します。`;
      else if(/否決/.test(verdict)) why=`${votes}。反対意見が優勢で、現状案を支持する材料が不足しています。`;
      else if(/保留/.test(verdict)) why=`${votes}。意見が割れているか材料不足のため、結論を固定せず再検証します。`;
      else why=`${votes}。3視点の支持が揃っているため可決します。`;
      const concerns=[mv!=='賛成'&&first(mConcern),bv!=='賛成'&&first(bConcern),cv!=='賛成'&&first(cConcern)].filter(Boolean);
      condition=concerns.length?concerns.slice(0,2).join('／'):'運用後に3視点で再確認し、状況変化があれば固定しません。';
      recheck=oldNext.replace(/^NEXT\s*[:：]\s*/,'')||'新しいデータ・状況変化・他候補の変化が出た時点で再審議します。';
    }

    reasonEl.innerHTML=`<div class="finalDetails"><div class="finalDetail"><b>判定理由</b><span>${esc(why)}</span></div><div class="finalDetail"><b>条件</b><span>${esc(condition)}</span></div><div class="finalDetail"><b>再判定ポイント</b><span>${esc(recheck)}</span></div>${conf?`<div class="finalConfidence">総合確度 ${esc(conf)}%</div>`:''}</div>`;
    nextEl.style.display='none';
  }
  runMagi=function(){oldRun();setTimeout(buildFinalDetails,0)};
  window.MAGI_FINAL_DETAIL=true;
})();