(()=>{
'use strict';
if(window.MAGI_PRINT_PREVIEW_RETURN_V330)return;
window.MAGI_PRINT_PREVIEW_RETURN_V330=true;

const MODAL_ID='magiPrintSafeModalV330';
const BODY_CLASS='magi-print-safe-v330';

function ensureStyle(){
  if(document.getElementById('magiPrintSafeStyleV330'))return;
  const s=document.createElement('style');
  s.id='magiPrintSafeStyleV330';
  s.textContent=`
  #${MODAL_ID}{position:fixed;inset:0;z-index:2147483640;background:#06111f;overflow:auto;-webkit-overflow-scrolling:touch;padding-top:max(64px,calc(env(safe-area-inset-top,0px) + 54px));padding-right:max(10px,env(safe-area-inset-right,0px));padding-bottom:max(24px,env(safe-area-inset-bottom,0px));padding-left:max(10px,env(safe-area-inset-left,0px));box-sizing:border-box}
  #${MODAL_ID} .magiPrintSafeBar{position:fixed;top:0;left:0;right:0;z-index:3;min-height:54px;padding:max(8px,env(safe-area-inset-top,0px)) 12px 8px;display:flex;align-items:center;gap:10px;background:#071b36;border-bottom:3px solid #8d1420;box-sizing:border-box}
  #${MODAL_ID} .magiPrintSafeBar button{min-height:42px;border-radius:10px;border:1px solid #67809a;padding:8px 14px;font-weight:900;font-size:14px}
  #${MODAL_ID} .magiPrintBack{background:#f3f7fb;color:#07111f}
  #${MODAL_ID} .magiPrintGo{margin-left:auto;background:#173a5d;color:#fff}
  #${MODAL_ID} .magiPrintSafeStage{width:min(100%,794px);margin:0 auto;background:#fff}
  #${MODAL_ID} .magiPrintSafeStage>.statsPaper,#${MODAL_ID} .magiPrintSafeStage>.fieldingPaper{border-radius:0!important;box-shadow:none!important;margin:0!important}
  @media print{
    body.${BODY_CLASS}>*:not(#${MODAL_ID}){display:none!important}
    body.${BODY_CLASS}{background:#fff!important;margin:0!important;padding:0!important}
    body.${BODY_CLASS} #${MODAL_ID}{display:block!important;position:static!important;inset:auto!important;overflow:visible!important;background:#fff!important;padding:0!important}
    body.${BODY_CLASS} #${MODAL_ID} .magiPrintSafeBar{display:none!important}
    body.${BODY_CLASS} #${MODAL_ID} .magiPrintSafeStage{width:100%!important;max-width:none!important;margin:0!important}
    body.${BODY_CLASS} #${MODAL_ID} .statsPaper,body.${BODY_CLASS} #${MODAL_ID} .fieldingPaper{box-shadow:none!important;border-radius:0!important}
  }
  `;
  document.head.appendChild(s);
}

function closeModal(){
  const modal=document.getElementById(MODAL_ID);
  if(modal)modal.remove();
  document.body.classList.remove(BODY_CLASS);
  document.documentElement.style.overflow='';
  document.body.style.overflow='';
}

function openSafePrintPreview(){
  const source=document.getElementById('statsPdfSource');
  if(!source)return;
  ensureStyle();
  closeModal();

  const modal=document.createElement('div');
  modal.id=MODAL_ID;
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');

  const bar=document.createElement('div');
  bar.className='magiPrintSafeBar';
  const back=document.createElement('button');
  back.type='button';
  back.className='magiPrintBack';
  back.textContent='← MAGIに戻る';
  const go=document.createElement('button');
  go.type='button';
  go.className='magiPrintGo';
  go.textContent='印刷・PDF保存';
  bar.append(back,go);

  const stage=document.createElement('div');
  stage.className='magiPrintSafeStage';
  const copy=source.cloneNode(true);
  copy.removeAttribute('id');
  stage.appendChild(copy);
  modal.append(bar,stage);
  document.body.appendChild(modal);

  document.documentElement.style.overflow='hidden';
  document.body.style.overflow='hidden';
  modal.scrollTop=0;

  back.addEventListener('click',closeModal);
  go.addEventListener('click',()=>{
    document.body.classList.add(BODY_CLASS);
    setTimeout(()=>window.print(),80);
  });
}

window.addEventListener('afterprint',()=>document.body.classList.remove(BODY_CLASS));
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById(MODAL_ID))closeModal()});
window.MAGI_CLOSE_PRINT_PREVIEW_V330=closeModal;
window.MAGI_PRINT_STATS_REPORT=openSafePrintPreview;

const observer=new MutationObserver(()=>{
  document.querySelectorAll('#statsSaveButton,#pitchPdf,#fieldingPdfV327,#fieldingPdfV329').forEach(btn=>{
    if(!btn.dataset.magiPrintLabelV330){btn.dataset.magiPrintLabelV330='1';btn.textContent='印刷・PDF保存';}
  });
});
observer.observe(document.documentElement,{childList:true,subtree:true});
})();
