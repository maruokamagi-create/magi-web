(()=>{
  'use strict';
  const CANONICAL_HOST='magi-web.vercel.app';
  const KEYS=[
    'magiGoogleClientIdV7',
    'magiDriveRootV7',
    'magiDriveAccountHintV92',
    'magiHistoryV7',
    'magiCaseCounterV7'
  ];
  const SNAPSHOT_KEY='magiPersistenceSnapshotV1';
  const STATUS_KEY='magiPersistenceGuardStatusV1';

  const read=()=>{
    const out={};
    for(const k of KEYS){
      const v=localStorage.getItem(k);
      if(v!==null) out[k]=v;
    }
    return out;
  };

  const writeSnapshot=(data)=>{
    try{localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({savedAt:Date.now(),host:location.host,data}));}catch(e){}
  };

  const restore=()=>{
    try{
      const raw=localStorage.getItem(SNAPSHOT_KEY);
      if(!raw) return 0;
      const snap=JSON.parse(raw);
      const data=snap&&snap.data&&typeof snap.data==='object'?snap.data:{};
      let restored=0;
      for(const k of KEYS){
        if(localStorage.getItem(k)===null && typeof data[k]==='string'){
          localStorage.setItem(k,data[k]);
          restored++;
        }
      }
      return restored;
    }catch(e){return 0;}
  };

  const restored=restore();
  writeSnapshot(read());

  const originalSet=Storage.prototype.setItem;
  const originalRemove=Storage.prototype.removeItem;
  const originalClear=Storage.prototype.clear;

  Storage.prototype.setItem=function(k,v){
    originalSet.call(this,k,v);
    if(this===localStorage && KEYS.includes(String(k))) writeSnapshot(read());
  };

  Storage.prototype.removeItem=function(k){
    if(this===localStorage && KEYS.includes(String(k))){
      const before=read();
      originalRemove.call(this,k);
      writeSnapshot(before);
      return;
    }
    originalRemove.call(this,k);
  };

  Storage.prototype.clear=function(){
    if(this!==localStorage){ originalClear.call(this); return; }
    const keep=read();
    originalClear.call(this);
    for(const [k,v] of Object.entries(keep)) originalSet.call(this,k,v);
    writeSnapshot(keep);
    console.warn('[MAGI] localStorage.clear() was intercepted; persistent MAGI settings were preserved.');
  };

  const status={
    active:true,
    restored,
    canonical:location.host===CANONICAL_HOST,
    host:location.host,
    keys:KEYS.filter(k=>localStorage.getItem(k)!==null),
    checkedAt:new Date().toISOString()
  };
  try{originalSet.call(localStorage,STATUS_KEY,JSON.stringify(status));}catch(e){}
  window.MAGI_PERSISTENCE_GUARD=status;

  if(location.hostname.endsWith('.vercel.app') && location.host!==CANONICAL_HOST){
    console.info('[MAGI] Preview/deployment URL detected. Browser-saved account settings are origin-specific; production data remains on '+CANONICAL_HOST+'.');
  }
})();