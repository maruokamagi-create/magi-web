export default async function handler(req,res){
  try{
    const mod=await import('../server/api/magi/persona.js');
    res.status(200).json({ok:true,handlerType:typeof mod.default});
  }catch(error){
    res.status(500).json({ok:false,name:error?.name||'',message:error?.message||String(error),stack:String(error?.stack||'').split('\n').slice(0,8)});
  }
}
