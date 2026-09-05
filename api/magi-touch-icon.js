const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const base = path.join(process.cwd(), 'assets', 'app-icons');
    const b64 =
      fs.readFileSync(path.join(base, 'magi-touch-180.part1.b64'), 'utf8').trim() +
      fs.readFileSync(path.join(base, 'magi-touch-180.part2.b64'), 'utf8').trim();
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 10000 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
      throw new Error('Invalid MAGI icon PNG');
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).send(buf);
  } catch (err) {
    res.status(500).send('MAGI icon unavailable');
  }
};
