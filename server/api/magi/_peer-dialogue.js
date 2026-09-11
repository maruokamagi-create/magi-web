const PERSONAS=['melchior','balthasar','casper'];
const VALID=new Set(PERSONAS);

function text(v){return String(v??'').trim();}
function objectEntries(value){return value&&typeof value==='object'&&!Array.isArray(value)?Object.entries(value):[];}
function personaMap(value){
  const out={};
  for(const [key,item] of objectEntries(value)){
    const p=text(item?.persona||key).toLowerCase().replace(/-\d+$/,'');
    if(VALID.has(p))out[p]=item;
  }
  if(Array.isArray(value)){
    for(const item of value){
      const p=text(item?.persona).toLowerCase().replace(/-\d+$/,'');
      if(VALID.has(p))out[p]=item;
    }
  }
  return out;
}

export function normalizePeerExchanges(cross){
  const raw=Array.isArray(cross?.peerExchanges)?cross.peerExchanges:[];
  return raw.map(x=>({
    from:text(x?.from).toLowerCase().replace(/-\d+$/,''),
    to:text(x?.to).toLowerCase().replace(/-\d+$/,''),
    point:text(x?.point),
    challenge:text(x?.challenge),
    evidenceBasis:text(x?.evidenceBasis)
  })).filter(x=>VALID.has(x.from)&&VALID.has(x.to)&&x.from!==x.to&&x.challenge);
}

export function validatePeerExchangeStructure(cross){
  const exchanges=normalizePeerExchanges(cross);
  const issues=[];
  if(exchanges.length<3)issues.push('3賢人同士の直接的な論点交換が3件未満です');
  const speakers=new Set(exchanges.map(x=>x.from));
  for(const p of PERSONAS)if(!speakers.has(p))issues.push(`${p}から他賢人への問いかけがありません`);
  const pairs=new Set(exchanges.map(x=>`${x.from}>${x.to}`));
  if(pairs.size<3)issues.push('賢人間のやり取りが一方向または重複に偏っています');
  return issues;
}

export function buildPeerDialogue(primary,cross,second){
  const pmap=personaMap(primary),smap=personaMap(second);
  return normalizePeerExchanges(cross).map((exchange,index)=>({
    order:index+1,
    from:exchange.from,
    to:exchange.to,
    point:exchange.point,
    challenge:exchange.challenge,
    evidenceBasis:exchange.evidenceBasis,
    fromPrimary:text(pmap[exchange.from]?.publicStatement||pmap[exchange.from]?.primaryReason),
    toSecond:text(smap[exchange.to]?.publicStatement||smap[exchange.to]?.primaryReason),
    targetChangedFromPrimary:Boolean(smap[exchange.to]?.changedFromPrimary),
    targetChangeReason:text(smap[exchange.to]?.changeReason)
  }));
}

export const PEER_DIALOGUE_PERSONAS=Object.freeze(PERSONAS.slice());
