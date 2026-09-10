(()=>{
'use strict';
if(window.MAGI_PRINT_PREVIEW_RETURN_V333)return;
window.MAGI_PRINT_PREVIEW_RETURN_V333=true;

const MODAL_ID='magiPrintSafeModalV333';
const BODY_CLASS='magi-print-safe-v333';
const FIELD_ACTION_ID='fieldingPrintActionV333';

function ensureStyle(){
  if(document.getElementById('magiPrintSafeStyleV333'))return;
  const s=document.createElement('style');
  s.id='magiPrintSafeStyleV333';
  s.textContent=`
  .statsPreviewBar{top:env(safe-area-inset-top,0px)!important;padding-left:max(14px,env(safe-area-inset-left,0px))!important;padding-right:max(14px,env(safe-area-inset-right,0px))!important;box-sizing:border-box!important}
  .statsPreviewModal{padding-top:calc(66px + env(safe-area-inset-top,0px))!important;padding-left:max(10px,env(safe-area-inset-left,0px))!important;padding-right:max(10px,env(safe-area-inset-right,0px))!important;padding-bottom:max(24px,env(safe-area-inset-bottom,0px))!important}
  #${MODAL_ID}{position:fixed;inset:0;z-index:2147483640;background:#06111f;overflow:auto;-webkit-overflow-scrolling:touch;padding-top:max(68px,calc(env(safe-area-inset-top,0px) + 60px));padding-right:max(10px,env(safe-area-inset-right,0px));padding-bottom:max(24px,env(safe-area-inset-bottom,0px));padding-left:max(10px,env(safe-area-inset-left,0px));box-sizing:border-box}
  #${MODAL_ID} .magiPrintSafeBar{position:fixed;top:0;left:0;right:0;z-index:3;min-height:58px;padding:max(8px,env(safe-area-inset-top,0px)) max(10px,env(safe-area-inset-right,0px)) 8px max(10px,env(safe-area-inset-left,0px));display:flex;align-items:center;gap:8px;background:#071b36;border-bottom:3px solid #8d1420;box-sizing:border-box}
  #${MODAL_ID} .magiPrintSafeBar button{min-height:42px;border-radius:10px;border:1px solid #67809a;padding:8px 12px;font-weight:900;font-size:13px;white-space:nowrap}
  #${MODAL_ID} .magiPrintBack{background:#f3f7fb;color:#07111f}
  #${MODAL_ID} .magiPrintClose{background:#17324e;color:#fff}
  #${MODAL_ID} .magiPrintGo{margin-left:auto;background:#8d1420;border-color:#b94a55;color:#fff}
  #${MODAL_ID} .magiPrintSafeStage{width:min(100%,794px);margin:0 auto;background:#fff}
  #${MODAL_ID} .magiPrintSafeStage>.statsPaper,#${MODAL_ID} .magiPrintSafeStage>.fieldingPaper,#${MODAL_ID} .magiPrintSafeStage>.fieldingPaper329{border-radius:0!important;box-shadow:none!important;margin:0!important}
  #${FIELD_ACTION_ID}{margin-top:10px;display:flex;justify-content:flex-end}
  #${FIELD_ACTION_ID} button{min-height:44px;border:1px solid #67809a;border-radius:11px;padding:11px 15px;background:#173a5d;color:#fff;font-weight:900;font-size:13px}
  @media(max-width:420px){#${MODAL_ID} .magiPrintSafeBar{gap:5px}#${MODAL_ID} .magiPrintSafeBar button{font-size:12px;padding-left:8px;padding-right:8px}}
  @media print{
    @page{size:A4;margin:0}
    body.${BODY_CLASS}>*:not(#${MODAL_ID}){display:none!important}
    body.${BODY_CLASS}{background:#fff!important;margin:0!important;padding:0!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    body.${BODY_CLASS} #${MODAL_ID}{display:block!important;position:static!important;inset:auto!important;overflow:visible!important;background:#fff!important;padding:0!important}
    body.${BODY_CLASS} #${MODAL_ID} .magiPrintSafeBar{display:none!important}
    body.${BODY_CLASS} #${MODAL_ID} .magiPrintSafeStage{width:100%!important;max-width:none!important;margin:0!important}
    body.${BODY_CLASS} #${MODAL_ID} .statsPaper,body.${BODY_CLASS} #${MODAL_ID} .fieldingPaper,body.${BODY_CLASS} #${MODAL_ID} .fieldingPaper329{box-shadow:none!important;border-radius:0!important}
  }
  `;
  document.head.appendChild(s);
}

function sourceFor(trigger){
  const panel=trigger?.closest?.('#statsLookupPanel,#fieldingLookupPanelV327,#fieldingLookupPanelV329');
  if(panel){
    const local=panel.querySelector('#statsPdfSource,.fieldingPaper329,.fieldingPaper');
    if(local)return local;
  }
  const visible=[...document.querySelectorAll('#statsPdfSource,.fieldingPaper329,.fieldingPaper')].find(el=>{
    const r=el.getBoundingClientRect();
    return r.width>0&&r.height>0;
  });
  return visible||document.querySelector('#statsPdfSource,.fieldingPaper329,.fieldingPaper');
}

function closeModal(){
  const modal=document.getElementById(MODAL_ID);
  if(modal)modal.remove();
  document.body.classList.remove(BODY_CLASS);
  document.documentElement.style.overflow='';
  document.body.style.overflow='';
}

function openSafePrintPreview(trigger){
  const source=sourceFor(trigger);
  if(!source)return false;
  ensureStyle();
  closeModal();

  const modal=document.createElement('div');
  modal.id=MODAL_ID;
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','MAGI 印刷プレビュー');

  const bar=document.createElement('div');
  bar.className='magiPrintSafeBar';
  const back=document.createElement('button');
  back.type='button';
  back.className='magiPrintBack';
  back.textContent='← MAGIへ戻る';
  const close=document.createElement('button');
  close.type='button';
  close.className='magiPrintClose';
  close.textContent='閉じる';
  const go=document.createElement('button');
  go.type='button';
  go.className='magiPrintGo';
  go.textContent='印刷・PDF保存';
  bar.append(back,close,go);

  const stage=document.createElement('div');
  stage.className='magiPrintSafeStage';
  const copy=source.cloneNode(true);
  copy.removeAttribute('id');
  copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
  stage.appendChild(copy);
  modal.append(bar,stage);
  document.body.appendChild(modal);

  document.documentElement.style.overflow='hidden';
  document.body.style.overflow='hidden';
  modal.scrollTop=0;

  back.addEventListener('click',closeModal);
  close.addEventListener('click',closeModal);
  go.addEventListener('click',()=>{
    document.body.classList.add(BODY_CLASS);
    setTimeout(()=>window.print(),80);
  });
  return true;
}

function ensureFieldingPrintAction(){
  const panel=document.getElementById('fieldingLookupPanelV329');
  const paper=panel?.querySelector('.fieldingPaper329');
  if(!panel||!paper||document.getElementById(FIELD_ACTION_ID))return;
  const action=document.createElement('div');
  action.id=FIELD_ACTION_ID;
  action.innerHTML='<button id="fieldingPdfV333" type="button">印刷・PDF保存</button>';
  paper.insertAdjacentElement('afterend',action);
}

function normalizeLabels(){
  ['statsSaveButton','pitchPdf','fieldingPdfV327','fieldingPdfV329','fieldingPdfV333'].forEach(id=>{
    const btn=document.getElementById(id);
    if(btn)btn.textContent='印刷・PDF保存';
  });
  ensureFieldingPrintAction();
}

document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('#statsSaveButton,#fieldingPdfV333');
  if(!btn)return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  openSafePrintPreview(btn);
},true);

window.addEventListener('afterprint',()=>document.body.classList.remove(BODY_CLASS));
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById(MODAL_ID))closeModal()});
window.MAGI_CLOSE_PRINT_PREVIEW_V333=closeModal;
window.MAGI_PRINT_STATS_REPORT=()=>openSafePrintPreview(null);

ensureStyle();
normalizeLabels();
const observer=new MutationObserver(normalizeLabels);
observer.observe(document.documentElement,{childList:true,subtree:true});
})();
