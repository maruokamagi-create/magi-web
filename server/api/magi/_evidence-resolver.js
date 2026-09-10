import * as XLSX from 'xlsx';
import { fetchDriveFileContent, listMagiDriveTree } from '../drive/_service.js';

const VERSION = 'evidence-resolver-v1-purpose-first';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet';
const GOOGLE_DOC = 'application/vnd.google-apps.document';
const MAX_TEXT = 24000;
const MAX_ROWS = 180;
const MAX_COLS = 24;

function text(v){ return String(v ?? '').trim(); }
function norm(v){
  return text(v).normalize('NFKC').toLowerCase()
    .replace(/\.(xlsx|xlsm|xls|csv|tsv|txt|md|json|pdf)$/i,'')
    .replace(/[\s　・･_\-\/()（）\[\]【】「」『』“”"'。、，,：:;；!?！？]/g,'');
}
function baseName(name){ return text(name).replace(/\.[^.]+$/,''); }
function clamp(s,n=MAX_TEXT){ const v=text(s); return v.length>n ? `${v.slice(0,n)}\n…（以下省略）` : v; }

function extractDocumentHint(question){
  const q=text(question);
  const explicit=q.match(/([^\s「」『』]{2,80}\.(?:xlsx|xlsm|xls|csv|tsv|txt|md|json|pdf))/i);
  if(explicit) return explicit[1].trim();
  const quoted=[...q.matchAll(/[「『“"]([^」』”"]{2,80})[」』”"]/g)].map(m=>m[1].trim());
  if(quoted.length) return quoted[0];
  const beforeInspect=q.match(/(.{2,80}?)(?:の内容|の中身|の記載|を見て|を確認して|を読んで|を参照して)/);
  if(beforeInspect){
    const candidate=beforeInspect[1]
      .replace(/^(?:この|その|あの|Driveの|ドライブの)/,'')
      .replace(/^(?:まず|次に|あと|それから)/,'')
      .trim();
    if(candidate.length>=2) return candidate;
  }
  const named=q.match(/([一-龯々ぁ-んァ-ヶA-Za-z0-9（）()年月_.\-]{2,60}(?:一覧|レポート|資料|ファイル|文書|ドキュメント|シート|表))/);
  return named ? named[1].trim() : '';
}

function grams(s,n=2){
  const x=norm(s), out=new Set();
  if(x.length<n){ if(x) out.add(x); return out; }
  for(let i=0;i<=x.length-n;i++) out.add(x.slice(i,i+n));
  return out;
}
function similarity(a,b){
  const A=grams(a),B=grams(b); if(!A.size||!B.size) return 0;
  let hit=0; for(const x of A) if(B.has(x)) hit++;
  return hit / Math.max(A.size,B.size);
}
function questionTerms(question){
  const stop=new Set(['内容','中身','記載','見て','確認して','読んで','参照して','審議して','審議','気になる点','問題点','懸念','課題','チーム','どう思う']);
  const raw=text(question).match(/[一-龯々ぁ-んァ-ヶA-Za-z0-9]{2,24}/g)||[];
  return [...new Set(raw.map(x=>x.trim()).filter(x=>x&&!stop.has(x)))].slice(0,20);
}
function fileScore(file,hint,question){
  const name=baseName(file?.name||''), nn=norm(name), hn=norm(hint), qn=norm(question);
  let score=0;
  if(hn){
    if(nn===hn) score+=180;
    else if(nn.includes(hn)) score+=140;
    else if(hn.includes(nn)&&nn.length>=4) score+=105;
    score+=Math.round(similarity(name,hint)*80);
  }
  if(qn.includes(nn)&&nn.length>=4) score+=45;
  for(const term of questionTerms(question)){
    const tn=norm(term); if(tn.length>=2&&nn.includes(tn)) score+=12;
  }
  if(/一覧|レポート|資料|シート|表/.test(name)) score+=4;
  return score;
}

function sanitizeCell(v){ return text(v).replace(/[\t\r\n]+/g,' ').slice(0,500); }
function workbookText(buffer,fileName){
  const wb=XLSX.read(buffer,{type:'buffer',cellFormula:true,cellText:true,cellDates:false});
  const lines=[`【資料】${fileName}`];
  let rowCount=0;
  for(const sheetName of wb.SheetNames){
    if(rowCount>=MAX_ROWS||lines.join('\n').length>=MAX_TEXT) break;
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,raw:false,defval:''});
    lines.push(`【シート】${sheetName}`);
    for(const row of rows){
      if(rowCount>=MAX_ROWS||lines.join('\n').length>=MAX_TEXT) break;
      const values=(Array.isArray(row)?row:[]).slice(0,MAX_COLS).map(sanitizeCell);
      if(!values.some(Boolean)) continue;
      lines.push(values.join('\t'));
      rowCount++;
    }
  }
  return {content:clamp(lines.join('\n')),rowCount,sheets:wb.SheetNames.slice()};
}
function textFileContent(buffer,fileName){
  let s='';
  try{s=new TextDecoder('utf-8',{fatal:false}).decode(buffer)}catch(_){s=buffer.toString('utf8')}
  return {content:clamp(`【資料】${fileName}\n${s}`),rowCount:s.split(/\r?\n/).length,sheets:[]};
}
function readable(file){
  const name=text(file?.name), mime=text(file?.mimeType);
  return mime===GOOGLE_SHEET||mime===GOOGLE_DOC||/\.(xlsx|xlsm|xls|csv|tsv|txt|md|json)$/i.test(name)||/^text\//i.test(mime);
}
async function readFile(file){
  const fetched=await fetchDriveFileContent(file);
  const name=text(file.name), mime=text(file.mimeType);
  if(mime===GOOGLE_SHEET||/\.(xlsx|xlsm|xls)$/i.test(name)) return workbookText(fetched.buffer,name);
  return textFileContent(fetched.buffer,name);
}

export async function resolveQuestionEvidence({question,routed}={}){
  const q=text(question);
  const domains=Array.isArray(routed?.domains)?routed.domains:[];
  const hint=extractDocumentHint(q);
  const requestsDocument=Boolean(hint)||domains.includes('DOCUMENT')||domains.includes('DOCUMENTS');
  if(!requestsDocument) return {version:VERSION,status:'NONE',requestedDocument:false,hint:'',evidence:null};

  const tree=await listMagiDriveTree({fresh:false,maxItems:2500,maxDepth:14});
  const files=tree.filter(f=>f?.mimeType!==FOLDER_MIME);
  const ranked=files.map(file=>({file,score:fileScore(file,hint,q)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||String(a.file.path||'').localeCompare(String(b.file.path||''),'ja'));
  const top=ranked[0]||null, second=ranked[1]||null;
  if(!top||top.score<55){
    return {version:VERSION,status:'NOT_FOUND',requestedDocument:true,hint,candidates:ranked.slice(0,5).map(x=>({name:x.file.name,path:x.file.path,score:x.score})),evidence:null};
  }
  if(second&&top.score-second.score<8&&second.score>=70&&norm(baseName(top.file.name))!==norm(baseName(second.file.name))){
    return {version:VERSION,status:'AMBIGUOUS',requestedDocument:true,hint,candidates:ranked.slice(0,5).map(x=>({name:x.file.name,path:x.file.path,score:x.score})),evidence:null};
  }
  if(!readable(top.file)){
    return {version:VERSION,status:'NOT_READABLE',requestedDocument:true,hint,candidates:[{name:top.file.name,path:top.file.path,score:top.score}],evidence:null};
  }

  const parsed=await readFile(top.file);
  const evidence={
    count:parsed.rowCount||1,
    files:[top.file.name],
    summary:`質問から「${hint||top.file.name}」を必要資料と判断し、Driveの「${top.file.name}」を読み取りました。`,
    text:parsed.content,
    sources:[{id:top.file.id,name:top.file.name,path:top.file.path,mimeType:top.file.mimeType,modifiedTime:top.file.modifiedTime||null}],
    resolverVersion:VERSION,
    retrieval:{hint,score:top.score,sheets:parsed.sheets||[]}
  };
  return {version:VERSION,status:'RESOLVED',requestedDocument:true,hint,candidates:ranked.slice(0,3).map(x=>({name:x.file.name,path:x.file.path,score:x.score})),evidence};
}
