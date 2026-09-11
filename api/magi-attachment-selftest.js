import { understandAttachmentRequest } from '../server/api/magi/_attachment-request.js';

const CASES=[
  {id:81,question:'これどう？＋スコア画像',attachments:[{id:'score-81',name:'score.jpg',mimeType:'image/jpeg',contentAvailable:true}],expect:r=>r?.route==='SCORE_IMAGE_ANALYSIS'&&r?.scope==='ATTACHMENT_ONLY'&&r?.readyForContentAnalysis===true},
  {id:82,question:'この動画の守備どう？',attachments:[{id:'video-82',name:'defense.mp4',mimeType:'video/mp4',contentAvailable:true}],expect:r=>r?.route==='VIDEO_FIELDING_ANALYSIS'&&r?.attachmentKind==='VIDEO'&&r?.scope==='ATTACHMENT_ONLY'},
  {id:83,question:'このPDFの試合だけ見て',attachments:[{id:'pdf-83',name:'game.pdf',mimeType:'application/pdf',contentAvailable:true}],expect:r=>r?.route==='PDF_SCOPED_ANALYSIS'&&r?.scope==='ATTACHMENT_ONLY'&&/PDFだけ/.test(r?.understoodRequest||'')},
  {id:84,question:'この写真の選手誰？',attachments:[{id:'photo-84',name:'player.jpg',mimeType:'image/jpeg',contentAvailable:true}],expect:r=>r?.route==='PHOTO_IDENTITY_SAFETY'&&r?.safetyStatus==='IDENTITY_FROM_APPEARANCE_BLOCKED'&&/特定することはしません/.test(r?.answer||'')},
  {id:85,question:'さっき送った画像の続き',attachments:[],context:[{role:'user',text:'この画像を見て',attachments:[{id:'prior-85',name:'prior-score.jpg',mimeType:'image/jpeg',contentAvailable:true}]}],expect:r=>r?.route==='IMAGE_FOLLOWUP'&&r?.scope==='PRIOR_ATTACHMENT'&&r?.attachments?.[0]?.id==='prior-85'}
];

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  const results=CASES.map(c=>{
    try{
      const out=understandAttachmentRequest({question:c.question,attachments:c.attachments||[],context:c.context||[]});
      return {id:c.id,question:c.question,pass:!!c.expect(out),route:out?.route||'',mode:out?.mode||'',attachmentKind:out?.attachmentKind||'',scope:out?.scope||'',readyForContentAnalysis:out?.readyForContentAnalysis===true,safetyStatus:out?.safetyStatus||'',understoodRequest:out?.understoodRequest||'',answer:out?.answer||''};
    }catch(error){return{id:c.id,question:c.question,pass:false,error:error?.message||String(error)}}
  });
  const failed=results.filter(x=>!x.pass);
  res.status(200).json({ok:failed.length===0,version:'attachment-request-v1',passed:results.length-failed.length,total:results.length,results});
}
