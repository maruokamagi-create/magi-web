export default async function handler(req,res){
  const base='https://magi-web.vercel.app';
  try{
    const response=await fetch(base+'/api/magi/persona',{
      method:'POST',
      headers:{'content-type':'application/json','origin':base},
      body:JSON.stringify({persona:'melchior',phase:'PRIMARY',case:{id:'PERSONA-HEALTH-2',question:'大野 竜暉について、確認できるEvidenceだけで評価して',mode:'proposal',evidence:{text:'大野 竜暉：確認用Evidence。',selectionKind:'',authoritativeCurrentRoster:[]}}})
    });
    const text=await response.text();
    res.status(200).json({ok:response.ok,status:response.status,body:text});
  }catch(error){
    res.status(500).json({ok:false,message:error?.message||String(error)});
  }
}
