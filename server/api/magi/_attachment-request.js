export const ATTACHMENT_REQUEST_VERSION='attachment-request-v1';

function clean(v,max=1200){return String(v??'').trim().slice(0,max)}
function kindFromMime(mime,name=''){
  const m=clean(mime,120).toLowerCase(),n=clean(name,240).toLowerCase();
  if(m.startsWith('image/')||/\.(png|jpe?g|webp|heic)$/i.test(n))return'IMAGE';
  if(m.startsWith('video/')||/\.(mp4|mov|m4v|webm)$/i.test(n))return'VIDEO';
  if(m==='application/pdf'||/\.pdf$/i.test(n))return'PDF';
  return'OTHER';
}
function normalizeOne(a,index=0){
  if(!a||typeof a!=='object')return null;
  const name=clean(a.name||a.fileName,240),mimeType=clean(a.mimeType||a.type,120),kind=clean(a.kind,30).toUpperCase()||kindFromMime(mimeType,name);
  if(!['IMAGE','VIDEO','PDF','OTHER'].includes(kind))return null;
  return {
    id:clean(a.id||a.attachmentId||`attachment-${index+1}`,120),name,mimeType,kind,
    size:Number.isFinite(Number(a.size))?Math.max(0,Number(a.size)):null,
    contentAvailable:a.contentAvailable===true||!!a.contentRef||!!a.dataUrl,
    contentRef:clean(a.contentRef,300),
    source:clean(a.source||'current',40)
  };
}
export function normalizeAttachments(value){
  return (Array.isArray(value)?value:[]).slice(0,6).map(normalizeOne).filter(Boolean);
}
function latestContextAttachments(context){
  const items=Array.isArray(context)?[...context].reverse():[];
  for(const item of items){
    const a=normalizeAttachments(item?.attachments);
    if(a.length)return a.map(x=>({...x,source:'context'}));
  }
  return[];
}
function mediaReference(q){return/(?:この|添付|送った|さっき送った|前の).{0,6}(?:画像|写真|動画|PDF|ＰＤＦ|ファイル)|(?:画像|写真|動画|PDF|ＰＤＦ).{0,5}(?:見て|どう|だけ|続き|解析|総括)/i.test(q)}
function result(base){return{attachmentRequestVersion:ATTACHMENT_REQUEST_VERSION,...base}}

export function understandAttachmentRequest({question:questionValue,attachments:attachmentValue=[],context=[]}={}){
  const question=clean(questionValue,4000);
  const current=normalizeAttachments(attachmentValue);
  const prior=latestContextAttachments(context);
  const effective=current.length?current:prior;
  const refers=mediaReference(question)||/(?:スコア画像|動画の守備|PDFの試合|写真の選手|画像の続き)/i.test(question);
  if(!refers&&!current.length)return null;

  if(!effective.length){
    return result({mode:'CLARIFY',route:'ATTACHMENT_CLARIFY',action:'CLARIFY',attachmentKind:'NONE',attachments:[],scope:'NONE',readyForContentAnalysis:false,needsClarification:true,clarificationQuestion:'参照する画像・動画・PDFが見つかりません。対象ファイルを添付してください。',understoodRequest:question,safetyStatus:'READY'});
  }

  const first=effective[0];
  const hasPrior=!current.length&&prior.length>0;

  if(first.kind==='IMAGE'&&/(?:誰|だれ|選手誰|人物|名前).{0,5}(?:\?|？|$)|(?:この写真|写真).{0,8}(?:誰|だれ)/.test(question)){
    return result({mode:'SAFE_MEDIA_REPLY',route:'PHOTO_IDENTITY_SAFETY',action:'SAFE_MEDIA_REPLY',attachmentKind:'IMAGE',attachments:effective,scope:'ATTACHMENT_ONLY',readyForContentAnalysis:false,needsClarification:false,clarificationQuestion:'',understoodRequest:'添付写真に写る人物が誰かを尋ねている',safetyStatus:'IDENTITY_FROM_APPEARANCE_BLOCKED',answer:'写真の見た目だけから人物を特定することはしません。背番号・登録名・試合記録など、画像以外の確認情報があれば照合できます。'});
  }

  if(first.kind==='PDF'){
    return result({mode:'ATTACHMENT_ANALYSIS',route:'PDF_SCOPED_ANALYSIS',action:'ATTACHMENT_ANALYSIS',attachmentKind:'PDF',attachments:effective,scope:'ATTACHMENT_ONLY',readyForContentAnalysis:first.contentAvailable,needsClarification:false,clarificationQuestion:'',understoodRequest:'添付PDFだけを参照範囲にして、該当する試合内容を確認する',safetyStatus:'READY'});
  }

  if(first.kind==='VIDEO'){
    return result({mode:'ATTACHMENT_ANALYSIS',route:'VIDEO_FIELDING_ANALYSIS',action:'ATTACHMENT_ANALYSIS',attachmentKind:'VIDEO',attachments:effective,scope:'ATTACHMENT_ONLY',readyForContentAnalysis:first.contentAvailable,needsClarification:false,clarificationQuestion:'',understoodRequest:'添付動画を根拠に守備内容を評価する',safetyStatus:'READY'});
  }

  if(first.kind==='IMAGE'){
    const score=/(?:スコア|試合|打席|投球|総括)/.test(question)||/(?:score|scoresheet)/i.test(first.name);
    return result({mode:'ATTACHMENT_ANALYSIS',route:hasPrior?'IMAGE_FOLLOWUP':(score?'SCORE_IMAGE_ANALYSIS':'IMAGE_ANALYSIS'),action:'ATTACHMENT_ANALYSIS',attachmentKind:'IMAGE',attachments:effective,scope:hasPrior?'PRIOR_ATTACHMENT':'ATTACHMENT_ONLY',readyForContentAnalysis:first.contentAvailable,needsClarification:false,clarificationQuestion:'',understoodRequest:hasPrior?'直前に送った画像を引き継いで続きの依頼を処理する':(score?'添付されたスコア画像を根拠に内容を確認・評価する':'添付画像の内容を確認・評価する'),safetyStatus:'READY'});
  }

  return result({mode:'CLARIFY',route:'ATTACHMENT_UNSUPPORTED',action:'CLARIFY',attachmentKind:first.kind,attachments:effective,scope:'ATTACHMENT_ONLY',readyForContentAnalysis:false,needsClarification:true,clarificationQuestion:'このファイル形式はまだ解析対象として扱えません。画像・動画・PDFのいずれかを添付してください。',understoodRequest:question,safetyStatus:'READY'});
}
