(()=>{
const oldSearch=searchDataEvidence;
const oldMel=melchior;
const oldBal=balthasar;
const oldCas=casper;
let roleCtx=null;
const sv=(r,i)=>String((r.values||[])[i]??'').trim();
const nv=v=>{const n=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(n)?n:0};
const fm=(x,d=3)=>Number(x).toFixed(d).replace(/^0(?=\.)/,'');
const pc=x=>`${(x*100).toFixed(1)}%`;
function makeLeadoff(q,e){
  const b=e&&e.batAnalysis;if(!b||!/1番|一番|リードオフ|先頭打者/.test(q))return null;
  const rows=b.rows||[];if(!rows.length)return null;
  const S=i=>rows.reduce((a,r)=>a+nv(sv(r,i)),0);
  const PA=S(7),AB=S(8),RBI=S(10),R=S(11),H=S(12),B1=S(13),B2=S(14),B3=S(15),HR=S(16),SO=S(17),BB=S(18),HBP=S(19),SB=S(24),CS=S(26),SF=S(28);
  const den=AB+BB+HBP+SF,avg=AB?H/AB:0,obp=den?(H+BB+HBP)/den:0,slg=AB?(B1+2*B2+3*B3+4*HR)/AB:0,ops=obp+slg;
  const bbRate=PA?BB/PA:0,kRate=PA?SO/PA:0,sbAtt=SB+CS,sbRate=sbAtt?SB/sbAtt:null;
  const positives=[];const concerns=[];
  if(obp>=.400)positives.push(`出塁率${fm(obp)}は1番候補として強い`);else if(obp>=.350)positives.push(`出塁率${fm(obp)}は起用検討圏`);else concerns.push(`出塁率${fm(obp)}は1番として物足りない`);
  if(bbRate>=.12)positives.push(`四球率${pc(bbRate)}で自力出塁を作れている`);else if(bbRate<.08)concerns.push(`四球率${pc(bbRate)}は高くない`);
  if(kRate<=.20)positives.push(`三振率${pc(kRate)}に抑えている`);else if(kRate>=.28)concerns.push(`三振率${pc(kRate)}は高め`);
  if(SB>=2)positives.push(`盗塁${SB}で走塁圧も確認できる`);else concerns.push(`盗塁${SB}で走塁面の材料はまだ少ない`);
  if(PA<25)concerns.push(`${PA}打席で母数はまだ小さい`);
  const score=Math.max(0,Math.min(100,Math.round(50+(obp-.330)*110+(bbRate-.08)*60-(Math.max(0,kRate-.22))*65+Math.min(SB,3)*3)));
  return{player:b.player||'',PA,AB,H,RBI,R,SO,BB,HBP,SB,CS,avg,obp,slg,ops,bbRate,kRate,sbRate,score,positives,concerns,source:b.files&&b.files[0]||'打撃詳細2026-2027.csv'};
}
searchDataEvidence=function(q){const e=oldSearch(q);roleCtx=makeLeadoff(q,e);if(e&&roleCtx){e.roleAnalysis=roleCtx;e.summary=`${e.summary}。1番適性確認：出塁率${fm(roleCtx.obp)}・四球率${pc(roleCtx.bbRate)}・三振率${pc(roleCtx.kRate)}・盗塁${roleCtx.SB}`;}return e};
melchior=function(x,e){const p=oldMel(x,e),r=e&&e.roleAnalysis;if(!r)return p;p.vote=(r.obp>=.350&&r.PA>=12)?'cond':'hold';p.conf=Math.max(p.conf,94);p.text=`1番起用を打撃指標で分解します。出塁率${fm(r.obp)}、四球率${pc(r.bbRate)}、三振率${pc(r.kRate)}、OPS${fm(r.ops)}、盗塁${r.SB}。${r.obp>=.400?'出塁面は明確にプラスです。':'出塁面は継続確認が必要です。'} 現時点では「起用継続は賛成、固定は保留」と判断します。`;p.basis=`プラス：${r.positives.join('／')||'明確なプラス材料なし'}。`;p.concern=`懸念：${r.concerns.join('／')||'大きな懸念なし'}。1番適性は打率より出塁の再現性を重視します。`;return p};
balthasar=function(x){const p=oldBal(x),r=roleCtx;if(!r||!/1番|一番|リードオフ|先頭打者/.test(x.q||''))return p;const strong=r.obp>=.380&&r.bbRate>=.10;p.vote=strong?'yes':'cond';p.conf=Math.max(p.conf,strong?90:84);p.text=strong?`戦術面では1番起用に賛成です。出塁率${fm(r.obp)}と四球率${pc(r.bbRate)}は、初回に走者を作る役割と噛み合います。長打率${fm(r.slg)}もあり、単に待つだけの1番ではありません。`:`1番起用は条件付きで試す価値があります。出塁率${fm(r.obp)}を基準に、初回出塁と得点へのつながりを継続確認します。`;p.basis=`1番の優先項目を「出塁→進塁圧→得点機会」と置くと、出塁率${fm(r.obp)}・${r.R}得点・四球${r.BB}が判断材料です。`;p.concern=`三振率${pc(r.kRate)}、盗塁${r.SB}。固定するなら「出塁率低下」「三振増加」「他候補の上昇」を解除条件にします。`;return p};
casper=function(x){const p=oldCas(x),r=roleCtx;if(!r||!/1番|一番|リードオフ|先頭打者/.test(x.q||''))return p;p.vote='hold';p.conf=Math.max(p.conf,68);p.text=`成績から1番の打撃適性は見えますが、本人が先頭打者の役割をどう受け止めているか、試合への入り方や負担感まではこのCSVでは分かりません。人の面は判断保留とします。`;p.basis=`打撃実績は確認済み。ただし心理面・役割理解・声掛け・疲労はDATA HUBの打撃CSVには含まれていません。`;p.concern=`好成績だけを理由に役割を固定せず、本人の納得と試合後の反応も確認します。`;return p};
const oldRender=renderEvidence;
renderEvidence=function(e){oldRender(e);const r=e&&e.roleAnalysis;if(!r)return;const box=$('dataEvidence');box.innerHTML+=`\n\n<b>【1番適性チェック】</b>\n出塁率 ${fm(r.obp)} ／ 四球率 ${pc(r.bbRate)} ／ 三振率 ${pc(r.kRate)} ／ OPS ${fm(r.ops)} ／ 盗塁 ${r.SB}\nプラス：${escapeHtml(r.positives.join('／')||'なし')}\n懸念：${escapeHtml(r.concerns.join('／')||'なし')}`};
window.MAGI_ROLE_ENGINE=true;
})();