(()=>{
'use strict';
if(window.MAGI_UI_SAFE_DRIVE_V301)return;
window.MAGI_UI_SAFE_DRIVE_V301=true;

const STYLE_ID='magi-ui-safe-drive-v301-style';
const SHIELD_ID='magiSafeTopShield';
let driveObserver=null;

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    #${SHIELD_ID}{position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);background:#183552;z-index:99990;pointer-events:none}
    @supports(padding:env(safe-area-inset-top)){
      #${SHIELD_ID}{height:max(0px,env(safe-area-inset-top,0px))}
    }
    @media(display-mode:browser){#${SHIELD_ID}{display:none}}
  `;
  document.head.appendChild(style);
}

function ensureShield(){
  if(document.getElementById(SHIELD_ID))return;
  const shield=document.createElement('div');
  shield.id=SHIELD_ID;
  shield.setAttribute('aria-hidden','true');
  document.body.appendChild(shield);
}

function syncDriveState(){
  const progress=document.getElementById('driveProgress');
  const state=document.getElementById('driveState');
  if(!progress||!state)return false;
  const progressVisible=!progress.classList.contains('hidden');
  state.style.display=progressVisible?'none':'';
  if(!driveObserver){
    driveObserver=new MutationObserver(()=>{
      const visible=!progress.classList.contains('hidden');
      state.style.display=visible?'none':'';
    });
    driveObserver.observe(progress,{attributes:true,attributeFilter:['class']});
  }
  return true;
}

function init(){
  ensureStyle();
  ensureShield();
  if(syncDriveState())return;
  const observer=new MutationObserver(()=>{
    ensureShield();
    if(syncDriveState())observer.disconnect();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
