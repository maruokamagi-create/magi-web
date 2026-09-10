(()=>{
'use strict';
if(window.MAGI_PRINT_PREVIEW_WEBAPP_V331)return;
window.MAGI_PRINT_PREVIEW_WEBAPP_V331=true;

const MODAL_ID='magiPrintPreviewWebappV331';
const STYLE_ID='magiPrintPreviewWebappStyleV331';
const PRINT_CLASS='magi-printing-v331';
const FIELDING_ACTIONS_ID='fieldingPrintActionsV331';
let restoreScrollY=0;
let savedHtmlOverflow='';
let savedBodyOverflow='';

const $=id=>document.getElementById(id);

function ensureStyle(){
  if($(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${MODAL_ID}{
  position:fixed;inset:0;z-index:2147483640;
  background:#06111f;color:#07172d;overflow:auto;-webkit-overflow-scrolling:touch;
  padding-top:calc(66px + env(safe-area-inset-top,0px));
  padding-right:max(10px,env(safe-area-inset-right,0px));
  padding-bottom:max(24px,env(safe-area-inset-bottom,0px));
  padding-left:max(10px,env(safe-area-inset-left,0px));box-sizing:border-box;
}
#${MODAL_ID} .magiPrintWebappBar{
  position:fixed;top:0;left:0;right:0;z-index:5;box-sizing:border-box;
  min-height:58px;padding:calc(8px + env(safe-area-inset-top,0px)) max(10px,env(safe-area-inset-right,0px)) 8px max(10px,env(safe-area-inset-left,0px));
  display:flex;align-items:center;gap:8px;background:#071b36;border-bottom:3px solid #8d1420;
  box-shadow:0 5px 16px rgba(0,0,0,.28);
}
#${MODAL_ID} .magiPrintWebappBar button{
  min-height:42px;border-radius:10px;border:1px solid #66819c;padding:8px 11px;
  font:900 13px/1.15 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;
  white-space:nowrap;touch-action:manipulation;
}
#${MODAL_ID} .magiPrintBack{background:#f3f7fb;color:#07111f}
#${MODAL_ID} .magiPrintClose{background:#17324e;color:#fff}
#${MODAL_ID} .magiPrintGo{margin-left:auto;background:#8d1420;color:#fff;border-color:#b94a55}
#${MODAL_ID} .magiPrintWebappStage{width:min(100%,794px);margin:0 auto;background:#fff;box-shadow:0 12px 36px rgba(0,0,0,.42)}
#${MODAL_ID} .magiPrintWebappStage>.statsPaper,
#${MODAL_ID} .magiPrintWebappStage>.fieldingPaper,
#${MODAL_ID} .magiPrintWebappStage>.fieldingPaper329{margin:0!important;border-radius:0!important;box-shadow:none!important}
#${FIELDING_ACTIONS_ID}{margin-top:10px;padding:13px;border:1px solid #294868;border-radius:13px;background:#0a1b2e;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
#${FIELDING_ACTIONS_ID} button{flex:1 1 145px;min-height:44px;border:1px solid #58738d;border-radius:11px;padding:11px 14px;font-size:13px;font-weight:900}
#fieldingPreviewV331{background:#f3f7fb;color:#07111f}
#fieldingPdfV331{background:#173a5d;color:#fff}
@media(max-width:390px){
  #${MODAL_ID} .magiPrintWebappBar{gap:5px;padding-left:max(7px,env(safe-area-inset-left,0px));padding-right:max(7px,env(safe-area-inset-right,0px))}
  #${MODAL_ID} .magiPrintWebappBar button{font-size:12px;padding-left:8px;padding-right:8px}
}
@media print{
  @page{size:A4;margin:0}
  html,body{background:#fff!important}
  body.${PRINT_CLASS}>*:not(#${MODAL_ID}){display:none!important}
  body.${PRINT_CLASS}{margin:0!important;padding:0!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}
  body.${PRINT_CLASS} #${MODAL_ID}{display:block!important;position:static!important;inset:auto!important;overflow:visible!important;background:#fff!important;padding:0!important}
  body.${PRINT_CLASS} #${MODAL_ID} .magiPrintWebappBar{display:none!important}
  body.${PRINT_CLASS} #${MODAL_ID} .magiPrintWebappStage{width:100%!important;max-width:none!important;margin:0!important;box-shadow:none!important}
  body.${PRINT_CLASS} #${MODAL_ID} .statsPaper,
  body.${PRINT_CLASS} #${MODAL_ID} .fieldingPaper,
  body.${PRINT_CLASS} #${MODAL_ID} .fieldingPaper329{box-shadow:none!important;border-radius:0!important}
}
`;
  document.head.appendChild(style);
}

function currentSource(trigger){
  if(trigger?.closest?.('#fieldingLookupPanelV329'))return trigger.closest('#fieldingLookupPanelV329')?.querySelector('.fieldingPaper329');
  if(trigger?.closest?.('#fieldingLookupPanelV327'))return trigger.closest('#fieldingLookupPanelV327')?.querySelector('#statsPdfSource,.fieldingPaper');
  if(trigger?.id==='fieldingPreviewV331'||trigger?.id==='fieldingPdfV331')return $('#fieldingLookupPanelV329')?.querySelector('.fieldingPaper329');
  const stats=trigger?.closest?.('#statsLookupPanel')?.querySelector('#statsPdfSource')||$('#statsLookupPanel')?.querySelector('#statsPdfSource');
  if(stats)return stats;
  const visibleFielding=$('fieldingLookupPanelV329')?.querySelector('.fieldingPaper329');
  if(visibleFielding)return visibleFielding;
  return $('#statsPdfSource');
}

function sanitizeClone(source){
  const copy=source.cloneNode(true);
  copy.removeAttribute('id');
  copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
  copy.querySelectorAll('.statsPdfActions,.fieldingActions,#fieldingPrintActionsV331').forEach(node=>node.remove());
  return copy;
}

function unlockPage(){
  document.documentElement.style.overflow=savedHtmlOverflow;
  document.body.style.overflow=savedBodyOverflow;
}

function closePreview(mode='close'){
  const modal=$(MODAL_ID);
  if(!modal)return;
  modal.remove();
  document.body.classList.remove(PRINT_CLASS);
  unlockPage();
  requestAnimationFrame(()=>{
    if(mode==='magi'){
      const target=$('q')||$('judge')||document.body;
      try{target.scrollIntoView({behavior:'auto',block:'center'});}catch(_){window.scrollTo(0,0)}
    }else{
      window.scrollTo(0,restoreScrollY);
    }
  });
}

function openPreview(sourceOrTrigger){
  const source=sourceOrTrigger?.nodeType===1 && sourceOrTrigger.matches?.('#statsPdfSource,.statsPaper,.fieldingPaper,.fieldingPaper329')
    ? sourceOrTrigger
    : currentSource(sourceOrTrigger?.nodeType===1?sourceOrTrigger:null);
  if(!source)return false;
  ensureStyle();
  if($(MODAL_ID))closePreview('close');
  restoreScrollY=window.scrollY||window.pageYOffset||0;
  savedHtmlOverflow=document.documentElement.style.overflow;
  savedBodyOverflow=document.body.style.overflow;

  const modal=document.createElement('div');
  modal.id=MODAL_ID;
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','MAGI 印刷プレビュー');

  const bar=document.createElement('div');
  bar.className='magiPrintWebappBar';
  const back=document.createElement('button');
  back.type='button';back.className='magiPrintBack';back.textContent='← MAGIへ戻る';
  const close=document.createElement('button');
  close.type='button';close.className='magiPrintClose';close.textContent='閉じる';
  const print=document.createElement('button');
  print.type='button';print.className='magiPrintGo';print.textContent='印刷・PDF保存';
  bar.append(back,close,print);

  const stage=document.createElement('div');
  stage.className='magiPrintWebappStage';
  stage.appendChild(sanitizeClone(source));
  modal.append(bar,stage);
  document.body.appendChild(modal);

  document.documentElement.style.overflow='hidden';
  document.body.style.overflow='hidden';
  modal.scrollTop=0;

  back.addEventListener('click',()=>closePreview('magi'));
  close.addEventListener('click',()=>closePreview('close'));
  print.addEventListener('click',()=>{
    document.body.classList.add(PRINT_CLASS);
    requestAnimationFrame(()=>setTimeout(()=>window.print(),40));
  });
  return true;
}

function normalizeActionButtons(){
  const labels={
    statsPreviewButton:'A4プレビュー',statsSaveButton:'印刷・PDF保存',
    pitchPreview:'A4プレビュー',pitchPdf:'印刷・PDF保存',
    fieldingPreviewV327:'A4プレビュー',fieldingPdfV327:'印刷・PDF保存'
  };
  Object.entries(labels).forEach(([id,label])=>{const b=$(id);if(b&&b.textContent!==label)b.textContent=label});

  const panel=$('fieldingLookupPanelV329');
  const paper=panel?.querySelector('.fieldingPaper329');
  if(panel&&paper&&!$(FIELDING_ACTIONS_ID)){
    const actions=document.createElement('div');
    actions.id=FIELDING_ACTIONS_ID;
    actions.innerHTML='<button id="fieldingPreviewV331" type="button">A4プレビュー</button><button id="fieldingPdfV331" type="button">印刷・PDF保存</button>';
    paper.insertAdjacentElement('afterend',actions);
  }
}

const ACTION_SELECTOR=[
  '#statsPreviewButton','#statsSaveButton','#pitchPreview','#pitchPdf',
  '#fieldingPreviewV327','#fieldingPdfV327','#fieldingPreviewV331','#fieldingPdfV331'
].join(',');

document.addEventListener('click',event=>{
  const button=event.target?.closest?.(ACTION_SELECTOR);
  if(!button)return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openPreview(button);
},true);

window.addEventListener('afterprint',()=>document.body.classList.remove(PRINT_CLASS));
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&$(MODAL_ID))closePreview('close')});
window.MAGI_PRINT_STATS_REPORT=()=>openPreview(null);
window.MAGI_PREVIEW_STATS_REPORT=()=>openPreview(null);
window.MAGI_CLOSE_PRINT_PREVIEW=closePreview;
window.MAGI_OPEN_PRINT_PREVIEW=openPreview;

ensureStyle();
normalizeActionButtons();
const observer=new MutationObserver(normalizeActionButtons);
observer.observe(document.documentElement,{childList:true,subtree:true});
})();
