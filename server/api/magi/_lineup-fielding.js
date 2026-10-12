import { CURRENT_ROSTER } from './_roster.js';
const STANDARD_POSITIONS=Object.freeze(['投','捕','一','二','三','遊','左','中','右']);
const POSITION_LABELS=Object.freeze({投:'投手',捕:'捕手',一:'一塁',二:'二塁',三:'三塁',遊:'遊撃',左:'左翼',中:'中堅',右:'右翼'});

function text(v){return String(v??'').trim();}
function count(map,key){const n=Number(map?.[key]);return Number.isFinite(n)&&n>0?n:0;}
function addScore(a,b){return a.map((v,i)=>v+(b[i]||0));}
function compareScore(a,b){
  for(let i=0;i<Math.max(a.length,b.length);i++){
    const av=a[i]||0,bv=b[i]||0;
    if(av!==bv)return av-bv;
  }
  return 0;
}
function playerRows(appearanceFielding){
  return Array.isArray(appearanceFielding?.players)?appearanceFielding.players:[];
}
function evidenceVector(player,position){
  const a=player?.appearance||{},f=player?.fielding||{};
  return [
    count(a.officialStartingPositions,position),
    count(a.practiceFirstStartingPositions,position),
    count(a.startingPositions,position),
    count(a.recentStartingPositions,position),
    count(f.positions,position)
  ];
}
function positionSupported(player,position){
  const vector=evidenceVector(player,position);
  return vector[0]>0||vector[1]>0;
}
function assignmentSignature(byPosition){
  return STANDARD_POSITIONS.map(pos=>`${pos}:${text(byPosition?.[pos]?.name)}`).join('|');
}
function assignmentDetails(byPosition){
  return STANDARD_POSITIONS.map(position=>{
    const player=byPosition[position];
    const vector=evidenceVector(player,position);
    return {
      name:player.name,
      position,
      positionLabel:POSITION_LABELS[position],
      evidence:{
        officialStarts:vector[0],
        practiceFirstStarts:vector[1],
        totalStarts:vector[2],
        recentStarts:vector[3],
        fieldingAppearances:vector[4]
      }
    };
  });
}

// A legal defense is a one-to-one matching, not nine unrelated position checks.
function hasFullDefenseMatching(rows,excluded=''){
  const pools=STANDARD_POSITIONS.map(pos=>rows.filter(r=>r.name!==excluded&&r.positions.includes(pos)).map(r=>r.name))
    .sort((a,b)=>a.length-b.length);
  if(pools.some(p=>!p.length))return false;
  const used=new Set();
  const visit=i=>{
    if(i===pools.length)return true;
    for(const n of pools[i]){
      if(used.has(n))continue;
      used.add(n);
      if(visit(i+1))return true;
      used.delete(n);
    }
    return false;
  };
  return visit(0);
}
export const LINEUP_STANDARD_POSITIONS=STANDARD_POSITIONS;
export const LINEUP_POSITION_LABELS=POSITION_LABELS;

export function buildStandardDefenseEligibility(appearanceFielding){
  if(String(appearanceFielding?.status||'')!=='COMPLETE')return null;
  const rows=playerRows(appearanceFielding);
  const byPlayer=rows.map(player=>({
    name:text(player?.name),
    positions:STANDARD_POSITIONS.filter(position=>positionSupported(player,position))
  })).filter(row=>row.name);
  const byPosition=Object.fromEntries(STANDARD_POSITIONS.map(position=>[
    position,
    byPlayer.filter(row=>row.positions.includes(position)).map(row=>row.name)
  ]));
  // Strictly evidence-derived constrained choices, not a preferred lineup.
  // A player eligible at two positions can fill only ONE starting assignment.
  const constrainedPositions=Object.fromEntries(Object.entries(byPosition)
    .filter(([,eligible])=>eligible.length<=2));
  const globallyFeasible=hasFullDefenseMatching(byPlayer);
  const mandatoryPlayers=globallyFeasible
    ?byPlayer.filter(row=>!hasFullDefenseMatching(byPlayer,row.name)).map(row=>row.name)
    :[];
  return {
    rule:'STANDARD_DEFENSE_ONE_TO_ONE_MATCHING',
    globallyFeasible,
    mandatoryPlayers,
    positions:[...STANDARD_POSITIONS],
    byPlayer,
    byPosition,
    constrainedPositions
  };
}

// Read-only alternatives for an illegal PRIMARY candidate set; no candidate is changed.
// Only one-player swaps that yield a uniquely confirmed legal fielding assignment
// are shown. The Wise Man must still pick and justify their own batting order.
export function buildEvidenceGroundedDefenseReconsideration(names,appearanceFielding){
  const selected=Array.isArray(names)?names:[];
  if(String(appearanceFielding?.status||'')!=='COMPLETE'||selected.length!==9
    ||new Set(selected).size!==9||!selected.every(n=>CURRENT_ROSTER.includes(n)))return null;
  const records=playerRows(appearanceFielding),registered=new Set(records.map(r=>text(r?.name)));
  if(records.length!==CURRENT_ROSTER.length||registered.size!==CURRENT_ROSTER.length
    ||CURRENT_ROSTER.some(n=>!registered.has(n)))return null;
  const rejected=assignEvidenceGroundedFielding(selected.map((name,i)=>({name,slot:i+1})),appearanceFielding);
  if(rejected.status!=='UNRESOLVED')return null;
  const eligible=buildStandardDefenseEligibility(appearanceFielding);
  if(!eligible?.globallyFeasible)return null;
  const options=[];
  for(const add of CURRENT_ROSTER.filter(n=>!selected.includes(n))){
    for(const remove of selected){
      const candidates=selected.map(n=>n===remove?add:n);
      const match=assignEvidenceGroundedFielding(candidates.map((name,i)=>({name,slot:i+1})),appearanceFielding);
      if(match.status==='COMPLETE')options.push({remove,add});
    }
  }
  return {
    status:'DEFENSE_RECONSIDERATION_REQUIRED',
    rejectedReason:rejected.reason,
    ...(rejected.uncoveredPositions?.length?{uncoveredPositions:rejected.uncoveredPositions}:{}),
    missingMandatory:eligible.mandatoryPlayers.filter(n=>!selected.includes(n)),
    onePlayerSwapExamples:options.slice(0,8),
    instruction:'These possible switches are verified position-coverage alternatives only. They are NOT tactical rankings, batting-order decisions or an automatic repair. Independently reconsider all 14 players, compare batting and dated coaching Evidence, and verify a one-to-one standard defense before finalizing nine. If a valid lineup cannot be grounded, request review rather than invent position experience.'
  };
}

export function assignEvidenceGroundedFielding(lineup,appearanceFielding){
  const batting=Array.isArray(lineup)?lineup:[];
  if(batting.length!==9)return {status:'UNRESOLVED',reason:'LINEUP_NOT_NINE',lineup:batting};
  if(String(appearanceFielding?.status||'')!=='COMPLETE')return {status:'UNAVAILABLE',reason:'APPEARANCE_FIELDING_EVIDENCE_UNAVAILABLE',lineup:batting};

  const byName=new Map(playerRows(appearanceFielding).map(row=>[text(row?.name),row]));
  const selected=batting.map(row=>({lineupRow:row,evidence:byName.get(text(row?.name))}));  
  if(selected.some(x=>!x.evidence))return {status:'UNRESOLVED',reason:'SELECTED_PLAYER_EVIDENCE_MISSING',lineup:batting};

  const candidates=Object.fromEntries(STANDARD_POSITIONS.map(position=>[
    position,
    selected
      .filter(x=>positionSupported(x.evidence,position))
      .map(x=>x.evidence)
      .sort((a,b)=>{
        const cmp=compareScore(evidenceVector(b,position),evidenceVector(a,position));
        if(cmp!==0)return cmp;
        return text(a.name).localeCompare(text(b.name),'ja');
      })
  ]));
  const uncovered=STANDARD_POSITIONS.filter(position=>candidates[position].length===0);
  if(uncovered.length)return {status:'UNRESOLVED',reason:'POSITION_WITHOUT_STANDARD_START_EVIDENCE',uncoveredPositions:uncovered,lineup:batting};

  const positionOrder=[...STANDARD_POSITIONS].sort((a,b)=>candidates[a].length-candidates[b].length||STANDARD_POSITIONS.indexOf(a)-STANDARD_POSITIONS.indexOf(b));
  let bestScore=null;
  let bestAssignments=[];
  const used=new Set();
  const byPosition={};

  function visit(index,score){
    if(index===positionOrder.length){
      const snapshot=Object.fromEntries(STANDARD_POSITIONS.map(position=>[position,byPosition[position]]));
      if(bestScore===null||compareScore(score,bestScore)>0){
        bestScore=score.slice();
        bestAssignments=[snapshot];
      }else if(compareScore(score,bestScore)===0){
        const sig=assignmentSignature(snapshot);
        if(!bestAssignments.some(existing=>assignmentSignature(existing)===sig)&&bestAssignments.length<2)bestAssignments.push(snapshot);
      }
      return;
    }
    const position=positionOrder[index];
    for(const player of candidates[position]){
      const name=text(player.name);
      if(used.has(name))continue;
      used.add(name);byPosition[position]=player;
      visit(index+1,addScore(score,evidenceVector(player,position)));
      delete byPosition[position];used.delete(name);
    }
  }
  visit(0,[0,0,0,0,0]);

  if(!bestAssignments.length)return {status:'UNRESOLVED',reason:'NO_COMPLETE_STANDARD_STARTING_MATCHING',lineup:batting};
  if(bestAssignments.length>1){
    return {
      status:'AMBIGUOUS',
      reason:'MULTIPLE_EQUAL_EVIDENCE_ASSIGNMENTS',
      score:bestScore,
      competingAssignments:bestAssignments.map(assignmentDetails),
      lineup:batting
    };
  }

  const assignment=bestAssignments[0];
  const byPlayer=new Map(assignmentDetails(assignment).map(row=>[row.name,row]));
  return {
    status:'COMPLETE',
    rule:'公式戦想定の標準守備は、各選手がその位置で公式戦または練習第1試合に実際に先発したEvidenceがある場合だけ割り当てる。練習第2試合のテスト先発や途中守備だけでは標準先発守備資格にしない。その上で優先順位は、公式戦スタメン回数→練習第1試合スタメン回数→全スタメン回数→直近スタメン回数→実守備回数。割合ウェイトや選手別の固定ポジション表は使わず、9位置を成立できない場合は推測せずUNRESOLVED、同一根拠で複数配置が並ぶ場合はAMBIGUOUSとする。',
    score:bestScore,
    lineup:batting.map(row=>{
      const assigned=byPlayer.get(text(row?.name));
      return {...row,position:assigned?.position||'',positionLabel:assigned?.positionLabel||'',positionEvidence:assigned?.evidence||null};
    })
  };
}
