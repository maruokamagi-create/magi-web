(()=>{
  'use strict';

  const ROOT_ID='1rPtDYz8BgmP-YVGNfsHcKBNsxxTjxY9I';
  const STORAGE_KEY='magiDriveRootV7';
  const LEGACY_IDS=new Set(['1lMvyDzhk0qM5VqS5eTf4Eka_GUZWfgqP','1IMvyDzhk0qM5VqS5eTf4Eka_GUZWfgqP']);
  let autoReloaded=false;

  function fixRoot(){
    const input=document.getElementById('driveRootId');
    if(!input)return false;

    const current=String(input.value||'').trim();
    const saved=String(localStorage.getItem(STORAGE_KEY)||'').trim();
    if(current!==ROOT_ID||saved!==ROOT_ID){
      input.value=ROOT_ID;
      localStorage.setItem(STORAGE_KEY,ROOT_ID);
    }

    input.readOnly=true;
    input.setAttribute('aria-label','MAGI_SYSTEM ROOT FOLDER ID');
    input.title='MAGI_SYSTEM のルートフォルダ。MAGI-WEBが自動管理します。';
    window.MAGI_TEAM_ROOT_FOLDER_ID=ROOT_ID;

    if(!autoReloaded&&typeof window.scanDrive==='function'){
      try{
        if(typeof driveToken!=='undefined'&&driveToken){
          autoReloaded=true;
          setTimeout(()=>{
            try{window.scanDrive()}catch(_){ }
          },120);
        }
      }catch(_){ }
    }
    return true;
  }

  const observer=new MutationObserver(()=>{
    if(fixRoot())observer.disconnect();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(fixRoot()||attempts>80){
      clearInterval(timer);
      if(attempts>80)observer.disconnect();
    }
  },100);

  fixRoot();
})();
