const b64 = require('fs').readFileSync(require('path').join(process.cwd(),'icons','magi-192.png.b64'),'utf8').trim();
module.exports = (req,res)=>{res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store, max-age=0');res.status(200).send(Buffer.from(b64,'base64'));};
