(()=>{
  'use strict';

  const STYLE_ID='magi-line-profile-v290-style';
  const roleLabel=(role)=>({admin:'管理者',coach:'顧問・指導者',player:'選手',member:'保護者・その他'}[role]||'保護者・その他');
  const statusLabel=(status)=>({pending:'承認待ち',active:'利用可',disabled:'利用停止'}[status]||status||'');
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  let profileState=null;

  function styles(){
    if(document.getElementById(STYLE_ID)) return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      .magiProfileLineIdentity{display:flex;align-items:center;gap:11px;margin:12px 0 18px;padding:10px 12px;border:1px solid #294868;border-radius:12px;background:#071827;color:#abc0d3;font-size:12px}
      .magiProfileLineIdentity img{width:42px;height:42px;border-radius:50%;object-fit:cover;background:#173149}
      .magiProfileLineIdentity b{display:block;color:#fff;font-size:14px;margin-bottom:2px}
      .magiProfileForm label{display:block;margin:13px 0 6px;color:#d7e6f3;font-size:13px;font-weight:800}
      .magiProfileForm input{width:100%;min-height:50px;box-sizing:border-box;border:1px solid #315574;border-radius:11px;background:#071827;color:#fff;padding:0 13px;font-size:16px}
      .magiProfileSubmit{width:100%;min-height:52px;margin-top:18px;border:0;border-radius:11px;background:#06c755;color:#fff;font-size:16px;font-weight:900}
      .magiProfileSubmit:disabled{opacity:.55}
      .magiProfileError{min-height:20px;margin-top:9px;color:#ff9ca6;font-size:12px;line-height:1.5}
      .magiProfileHint{margin-top:13px;color:#809bb2;font-size:11px;line-height:1.65}
      .magiMemberProfileMain{display:flex;gap:10px;min-width:0}
      .magiMemberAvatar{width:48px;height:48px;flex:0 0 48px;border-radius:50%;object-fit:cover;background:#173149;border:1px solid #315574}
      .magiMemberProfileText{min-width:0}
      .magiMemberLineName{margin-top:5px;color:#9db2c5;font-size:11px;overflow-wrap:anywhere}
      .magiMemberRequest{margin-top:4px;color:#c8daea;font-size:11px}
      @media(max-width:520px){.magiMemberAvatar{width:44px;height:44px;flex-basis:44px}}
    `;
    document.head.appendChild(s);
  }

  async function session(){
    const r=await fetch('/api/auth/line/session',{cache:'no-store',credentials:'same-origin'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d?.ok) throw new Error(d?.error||'session_check_failed');
    return d;
  }

  function renderProfile(state){
    const root=document.getElementById('magiAuthGate');
    if(!root||root.dataset.profileForm==='1') return false;
    root.dataset.profileForm='1';
    const lineName=state.member?.lineDisplayName||state.user?.name||'LINEアカウント';
    const pic=state.member?.pictureUrl||state.user?.picture||'';
    root.innerHTML=`<div class="magiAuthCard">
      <div class="magiAuthBrand"><img src="/magi-official-symbol-v125.svg?v=271" alt=""><div><strong>MAGI</strong><span>MARUOKA ADVANCED GAME INTELLIGENCE</span></div></div>
      <h1>初回利用の申請</h1>
      <p class="magiAuthLead">LINEの表示名だけでは本人を確認できない場合があるため、最初に氏名だけ入力してください。</p>
      <div class="magiProfileLineIdentity">${pic?`<img src="${esc(pic)}" alt="">`:''}<div><span>LINE表示名</span><b>${esc(lineName)}</b></div></div>
      <form class="magiProfileForm">
        <label for="magiFormalName">氏名</label>
        <input id="magiFormalName" name="formalName" type="text" maxlength="60" autocomplete="name" placeholder="例：宮村 一勇" required>
        <button class="magiProfileSubmit" type="submit">申請する</button>
        <div class="magiProfileError"></div>
      </form>
      <div class="magiProfileHint">立場・役割は申請後に管理者が設定します。LINEは同じ人かどうかを識別するために使い、管理者は申請氏名・LINE表示名・LINEアイコンを確認して承認します。</div>
      <button class="magiAuthSecondary" type="button" data-profile-logout>ログアウト</button>
    </div>`;

    const form=root.querySelector('.magiProfileForm');
    const errorEl=root.querySelector('.magiProfileError');
    form.addEventListener('submit',async(e)=>{
      e.preventDefault();
      const button=form.querySelector('.magiProfileSubmit');
      const formalName=form.formalName.value.trim();
      if(formalName.length<2){errorEl.textContent='氏名を入力してください。';return;}
      button.disabled=true;
      errorEl.textContent='';
      try{
        const r=await fetch('/api/auth/line/profile',{
          method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
          body:JSON.stringify({formalName})
        });
        const d=await r.json().catch(()=>({}));
        if(!r.ok||!d?.ok) throw new Error(d?.error||'申請情報を保存できませんでした');
        location.reload();
      }catch(err){
        errorEl.textContent=err?.message||'申請情報を保存できませんでした。';
        button.disabled=false;
      }
    });
    root.querySelector('[data-profile-logout]').addEventListener('click',()=>location.assign('/api/auth/line/logout'));
    return true;
  }

  async function memberRequest(body=null){
    const r=await fetch('/api/admin/line-members',{
      method:body?'POST':'GET',
      headers:body?{'Content-Type':'application/json'}:undefined,
      body:body?JSON.stringify(body):undefined,
      cache:'no-store',credentials:'same-origin'
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d?.ok) throw new Error(d?.error||'利用者情報を取得できませんでした');
    return d;
  }

  async function enhanceMemberPanel(panel){
    const list=panel?.querySelector('.magiMemberList');
    if(!list||list.querySelector('.magiMemberProfileMain')) return;
    try{
      const data=await memberRequest();
      const members=[...(data.members||[])].sort((a,b)=>({pending:0,active:1,disabled:2}[a.status]??9)-({pending:0,active:1,disabled:2}[b.status]??9));
      if(!members.length){list.innerHTML='<div class="magiMemberEmpty">利用者はまだいません。</div>';return;}
      list.innerHTML=members.map(member=>{
        const formal=member.formal_name||member.display_name||'氏名未申請';
        const line=member.line_display_name||'取得できません';
        const role=member.role||'member';
        const options=member.status==='pending'
          ? `<option value="" selected>役割を選択</option>${['admin','coach','player','member'].map(r=>`<option value="${r}">${roleLabel(r)}</option>`).join('')}`
          : ['admin','coach','player','member'].map(r=>`<option value="${r}"${r===role?' selected':''}>${roleLabel(r)}</option>`).join('');
        const action=member.status==='pending'?'<button class="approve" type="button" data-action="approve">承認</button>':member.status==='disabled'?'<button class="approve" type="button" data-action="approve">再許可</button>':'<button type="button" data-action="update">役割更新</button>';
        const disable=member.status==='active'&&!member.isSelf?'<button class="disable" type="button" data-action="disable">利用停止</button>':'';
        return `<div class="magiMemberRow" data-id="${esc(member.id)}">
          <div class="magiMemberProfileMain">${member.picture_url?`<img class="magiMemberAvatar" src="${esc(member.picture_url)}" alt="">`:''}<div class="magiMemberProfileText">
            <div class="magiMemberName">${esc(formal)}${member.isSelf?'<span class="magiMemberBadge">自分</span>':''}</div>
            <div class="magiMemberLineName">LINE表示名：${esc(line)}</div>
            <div class="magiMemberRequest">${member.status==='pending'?'役割：管理者が設定':'現在の役割：'+esc(roleLabel(role))} ・ ${esc(statusLabel(member.status))}</div>
          </div></div>
          <div class="magiMemberControls"><select data-role ${member.isSelf?'disabled':''}>${options}</select>${member.isSelf?'':action}${disable}</div>
        </div>`;
      }).join('');

      list.querySelectorAll('[data-action]').forEach(button=>{
        button.addEventListener('click',async()=>{
          const row=button.closest('.magiMemberRow');
          const id=row?.dataset.id;
          const role=row?.querySelector('[data-role]')?.value||'';
          const status=button.dataset.action==='disable'?'disabled':'active';
          if(button.dataset.action==='approve'&&!role){alert('役割を選択してから承認してください。');return;}
          button.disabled=true;
          try{await memberRequest({id,role:role||undefined,status}); await enhanceMemberPanelRefresh(panel);}
          catch(err){alert(err?.message||'更新できませんでした');button.disabled=false;}
        });
      });
    }catch(err){
      list.innerHTML=`<div class="magiMemberError">${esc(err?.message||'利用者情報を取得できませんでした')}</div>`;
    }
  }

  async function enhanceMemberPanelRefresh(panel){
    const list=panel?.querySelector('.magiMemberList');
    if(list) list.innerHTML='<div class="magiMemberEmpty">更新中…</div>';
    await enhanceMemberPanel(panel);
  }

  let panelTimer=0;
  const observer=new MutationObserver(()=>{
    if(profileState?.authenticated&&profileState?.member?.needsProfile) renderProfile(profileState);
    const panel=document.querySelector('.magiMemberPanel');
    if(panel&&panel.querySelector('.magiMemberList')&&!panel.querySelector('.magiMemberProfileMain')){
      clearTimeout(panelTimer);
      panelTimer=setTimeout(()=>enhanceMemberPanel(panel),250);
    }
  });

  async function init(){
    styles();
    observer.observe(document.documentElement,{childList:true,subtree:true});
    try{
      profileState=await session();
      if(profileState?.authenticated&&profileState?.member?.needsProfile) renderProfile(profileState);
    }catch(_){ }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
