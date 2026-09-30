import assert from 'node:assert/strict';
import { buildFallbackDialogue } from '../server/api/magi/dialogue-resilient.js';

const a=['大野 竜暉','坂田 暉馬','嶋田 栄志','中嶋 玲月','大久保 陽翔','鰐渕 将太','井坂 悠聖','橋向 結都','武田 晴琉翔'];
const b=['大野 竜暉','坂田 暉馬','中嶋 玲月','大久保 陽翔','嶋田 栄志','鰐渕 将太','橋向 結都','井坂 悠聖','武田 晴琉翔'];
const c=['大野 竜暉','坂田 暉馬','中嶋 玲月','大久保 陽翔','嶋田 栄志','鰐渕 将太','橋向 結都','井坂 悠聖','武田 晴琉翔'];
const body={
  case:{question:'ベストオーダーは？'},
  primary:{
    melchior:{persona:'MELCHIOR-1',candidatePlayers:a,publicStatement:'私は現在の記録を重視してこの打順にします。'},
    balthasar:{persona:'BALTHASAR-2',candidatePlayers:b,publicStatement:'俺は打線のつながりを重視してこの打順にする。'},
    casper:{persona:'CASPER-3',candidatePlayers:c,publicStatement:'僕は現在の役割と打線のつながりを見てこの打順にします。'}
  }
};
const result=buildFallbackDialogue(body);
assert.ok(result);
assert.equal(result.dialogueFallbackUsed,true);
assert.equal(result.dialogue.length,3);
assert.deepEqual(result.dialogue.map(x=>x.speaker),['MELCHIOR-1','BALTHASAR-2','CASPER-3']);
assert.deepEqual(result.dialogue.map(x=>x.target),['BALTHASAR-2','CASPER-3','MELCHIOR-1']);
assert.ok(result.dialogue.every(x=>!x.statement.includes('MAGI CONTROL')));
assert.ok(result.dialogue.every(x=>x.sourceClaim.length>=4));
assert.ok(result.challenges.melchior.length>=1);
assert.ok(result.challenges.balthasar.length>=1);
assert.ok(result.challenges.casper.length>=1);
assert.ok(result.warnings.some(x=>x.includes('直接対話を取得できなかった')));
assert.match(result.dialogue[0].statement,/バルタザール/);
assert.match(result.dialogue[1].statement,/カスパー/);
assert.match(result.dialogue[2].statement,/メルキオール/);


const slotBody={
  case:{question:'3番は誰がいい？',selectionKind:'BATTING_ORDER'},
  primary:{
    melchior:{persona:'MELCHIOR-1',candidatePlayers:['大野 竜暉','中嶋 玲月','長侶 穹'],publicStatement:'3番は大野 竜暉を第一候補にします。'},
    balthasar:{persona:'BALTHASAR-2',candidatePlayers:['中嶋 玲月','大野 竜暉','長侶 穹'],publicStatement:'3番は中嶋 玲月を第一候補にする。'},
    casper:{persona:'CASPER-3',candidatePlayers:['大野 竜暉','中嶋 玲月','長侶 穹'],publicStatement:'僕は3番を大野 竜暉にします。'}
  }
};
const slotResult=buildFallbackDialogue(slotBody);
assert.ok(slotResult);
assert.equal(slotResult.dialogueFallbackUsed,true);
assert.equal(slotResult.dialogue.length,3);
assert.ok(slotResult.challenges.melchior.length>=1);
assert.ok(slotResult.challenges.balthasar.length>=1);
assert.ok(slotResult.challenges.casper.length>=1);
assert.match(slotResult.disagreement.join(' '),/3番候補/);

const closerBody={
  case:{question:'クローザーは誰がいい？',selectionKind:'PITCHING_ROLE'},
  primary:{
    melchior:{persona:'MELCHIOR-1',candidatePlayers:['大野 竜暉','大久保 陽翔'],publicStatement:'クローザーは大野 竜暉を第一候補にします。'},
    balthasar:{persona:'BALTHASAR-2',candidatePlayers:['大久保 陽翔','大野 竜暉'],publicStatement:'俺は大久保 陽翔を第一候補にする。'},
    casper:{persona:'CASPER-3',candidatePlayers:['大野 竜暉','大久保 陽翔'],publicStatement:'僕は大野 竜暉を第一候補にします。'}
  }
};
const closerResult=buildFallbackDialogue(closerBody);
assert.ok(closerResult);
assert.match(closerResult.disagreement.join(' '),/クローザー候補/);

const planBody={
  case:{question:'7回制の投手運用は？',selectionKind:'PITCHING_PLAN'},
  primary:{
    melchior:{persona:'MELCHIOR-1',candidatePlayers:['橋向 結都','大久保 陽翔','大野 竜暉','坂田 暉馬'],publicStatement:'この4役で組みます。'},
    balthasar:{persona:'BALTHASAR-2',candidatePlayers:['橋向 結都','大野 竜暉','大久保 陽翔','坂田 暉馬'],publicStatement:'俺はこの4役で組む。'},
    casper:{persona:'CASPER-3',candidatePlayers:['大久保 陽翔','橋向 結都','大野 竜暉','坂田 暉馬'],publicStatement:'僕はこの4役で組みます。'}
  }
};
const planResult=buildFallbackDialogue(planBody);
assert.ok(planResult);
assert.ok(planResult.disagreement.some(x=>/先発|第2投手|終盤|クローザー/.test(x)));

console.log('DIALOGUE RESILIENT FALLBACK: PASS');
