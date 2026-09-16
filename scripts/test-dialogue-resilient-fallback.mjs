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
assert.deepEqual(result.dialogue.map(x=>x.target),['BALTHASAR-2','MELCHIOR-1','BALTHASAR-2']);
assert.ok(result.dialogue.every(x=>!x.statement.includes('MAGI CONTROL')));
assert.ok(result.dialogue.every(x=>x.sourceClaim.length>=4));
assert.match(result.dialogue[0].statement,/バルタザール/);
assert.match(result.dialogue[1].statement,/メルキオール/);
assert.match(result.dialogue[2].statement,/バルタザール/);
console.log('DIALOGUE RESILIENT FALLBACK: PASS');
