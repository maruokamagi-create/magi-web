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
  const STATUS_KEY='magiPersistenceGuardStatusV2';

  // Non-invasive guard: never monkey-patch Storage and never prevent an
  // intentional account reset. Its job is to inventory and diagnose the
  // persistent keys that must survive ordinary code deployments.
  const present={};
  for(const k of KEYS){
    try{
      const v=localStorage.getItem(k);
      present[k]=v!==null;
    }catch(e){
      present[k]=false;
    }
  }

  const status={
    active:true,
    mode:'non-invasive',
    canonical:location.host===CANONICAL_HOST,
    host:location.host,
    present,
    checkedAt:new Date().toISOString()
  };

  try{localStorage.setItem(STATUS_KEY,JSON.stringify(status));}catch(e){}
  window.MAGI_PERSISTENCE_GUARD=status;

  if(location.hostname.endsWith('.vercel.app') && location.host!==CANONICAL_HOST){
    console.info('[MAGI] Preview/deployment URL detected. localStorage is origin-specific; production settings remain isolated on '+CANONICAL_HOST+'.');
  }
})();
