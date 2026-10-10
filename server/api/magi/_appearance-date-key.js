const text=value=>String(value??'').trim();

export function dateKey(value){
  const normalized=text(value).normalize('NFKC');
  // The read-only CSV may contain Excel's integer day serial, as verified
  // against 2026-08-02 (46236) and 2026-10-03 (46298) score originals.
  // Convert the date format, NOT the source's calendar day: an original
  // 2026-09-13 record must still disagree with a 2026-09-12 score sheet.
  if(/^\d{5}$/.test(normalized)){
    const serial=Number(normalized);
    if(serial>=36526&&serial<=73050)
      return new Date(Date.UTC(1899,11,30)+serial*86400000).toISOString().slice(0,10);
    return '';
  }
  const m=normalized.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  return m?`${m[1]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`:'';
}
