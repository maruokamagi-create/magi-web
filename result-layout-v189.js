(()=>{
  'use strict';
  const PORTRAITS={
    'MELCHIOR-1':'/portraits/melchior.png?v=190',
    'BALTHASAR-2':'/portraits/balthasar.png?v=190',
    'CASPER-3':'/portraits/casper.png?v=190',
    'MAGI CONTROL':'/magi-official-symbol-v125.svg?v=190'
  };
  function injectCss(){if(document.getElementById('magi-result-layout-v189-style'))return;const st=document.createElement('style');st.id='magi-result-layout-v189-style';st.textContent=`
    .magiResultOrderTitle{font-size:11px;letter-spacing:.14em;font-weight:900;color:#8db0d1;margin:13px 14px 8px}
    .response.magiResultReordered .final{margin:0 10px 12px;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.16)}
    .response.magiResultReordered .answerWrap{padding-top:2px;border-radius:16px;margin:0 0 8px}
    .response.magiResultReordered #engineProtocol{padding-top:4px}
    .response.magiResultReordered #magiLiveTranscript{margin-top:10px}
    .magiExchange{position:relative;padding-left:48px!important;min-height:43px}
    .magiSpeakerAvatar{position:absolute;left:0;top:9px;width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:center top;background:#0b2135;border:1px solid #315574;box-shadow:0 3px 10px rgba(0,0,0,.25)}
    .magiSpeakerAvatar.control{object-fit:contain;padding:6px;background:#06121f}
    .magiTranscriptToggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #315574;background:#0b2444;color:#eaf4ff;border-radius:11px;padding:11px 12px;margin:0 0 8px;font-size:12px;font-weight:900;cursor:pointer}
    .magiTranscriptToggle small{font-size:9px;font-weight:700;color:#8fa9c0}
    #magiLiveTranscript.magiCollapsed #magiLiveBody,#magiLiveTranscript.magiCollapsed .magiLiveNote{display:none}
    #magiLiveTranscript.magiCollapsed{padding-bottom:5px}
    .magiLiveTitle{display:none!important}
    @media(max-width:430px){.response.magiResultReordered .final{margin-left:6px;margin-right:6px}.magiExchange{padding-left:44px!important}.magiSpeakerAvatar{width:34px;height:34px}}
  `;document.head.appendChild(st)}
  function avatarFor(text){const t=String(text||'');if(t.includes('MELCHIOR'))return['MELCHIOR-1',PORTRAITS['MELCHIOR-1']];if(t.includes('BALTHASAR'))return['BALTHASAR-2',PORTRAITS['BALTHASAR-2']];if(t.includes('CASPER'))return['CASPER-3',PORTRAITS['CASPER-3']];if(t.includes('MAGI CONTROL'))return['MAGI CONTROL',PORTRAITS['MAGI CONTROL']];return null}
  function decorateTranscript(){const live=document.getElementById('magiLiveTranscript');if(!live)return;injectCss();if(!live.querySelector('.magiTranscriptToggle')){const btn=document.createElement('button');btn.type='button';btn.className='magiTranscriptToggle';btn.innerHTML='<span>審議のやり取りを見る</span><small>PUBLIC DELIBERATION ▾</small>';btn.addEventListener('click',()=>{const collapsed=live.classList.toggle('magiCollapsed');btn.querySelector('span').textContent=collapsed?'審議のやり取りを見る':'審議のやり取りを閉じる';btn.querySelector('small').textContent=collapsed?'PUBLIC DELIBERATION ▾':'PUBLIC DELIBERATION ▴'});live.insertBefore(btn,live.firstChild)}
    live.querySelectorAll('.magiExchange').forEach(ex=>{if(ex.querySelector('.magiSpeakerAvatar'))return;const speaker=ex.querySelector('.magiSpeaker');const hit=avatarFor(speaker?.textContent);if(!hit)return;const img=document.createElement('img');img.className='magiSpeakerAvatar'+(hit[0]==='MAGI CONTROL'?' control':'');img.src=hit[1];img.alt=hit[0];ex.insertBefore(img,ex.firstChild)});
  }
  function addSectionTitle(before,text,id){if(!before||document.getElementById(id))return;const d=document.createElement('div');d.id=id;d.className='magiResultOrderTitle';d.textContent=text;before.parentNode.insertBefore(d,before)}
  function reorder(){
    const response=document.getElementById('response');if(!response||response.dataset.magiResultOrderDone==='1')return;
    const header=response.querySelector('.reportHeader');const final=response.querySelector('.final');const answers=response.querySelector('.answerWrap');const protocol=document.getElementById('engineProtocol');
    if(!header||!final||!answers)return;
    /* Guard BEFORE DOM moves. MutationObserver sees these moves synchronously later. */
    response.dataset.magiResultOrderDone='1';response.classList.add('magiResultReordered');
    header.insertAdjacentElement('afterend',final);final.insertAdjacentElement('afterend',answers);if(protocol)answers.insertAdjacentElement('afterend',protocol);
    addSectionTitle(answers,'3賢人の判定','magiThreeWiseTitle');if(protocol)addSectionTitle(protocol,'なぜこの結論になったか','magiReasonTitle');
    if(protocol){const live=document.getElementById('magiLiveTranscript');if(live&&live.parentNode!==protocol)protocol.appendChild(live);if(live)live.classList.add('magiCollapsed')}
    decorateTranscript();
  }
  function watch(){
    injectCss();const root=document.body;let scheduled=false;
    const sync=()=>{scheduled=false;decorateTranscript();const status=document.getElementById('status');if(status&&/正式審議完了|審議完了/.test(status.textContent))reorder()};
    const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(sync)});
    observer.observe(root,{childList:true,subtree:true,characterData:true});sync();return true;
  }
  let n=0;const boot=setInterval(()=>{n++;if((document.body&&watch())||n>80)clearInterval(boot)},250);
})();
