// Canonical MAGI Evidence sources. Keep Drive IDs stable and explicit so providers
// never discover same-title files heuristically.
export const EVIDENCE_SOURCE_MAP_VERSION='evidence-source-map-v1';

export const EVIDENCE_SOURCES=Object.freeze({
  CURRENT_MASTER:Object.freeze({id:'11ABgSFKN-9Bhde1hJ_n-Qytz0cuImM0E',type:'LIVE_DATA',authority:'NUMERIC_MASTER'}),
  CURRENT_BATTING_DETAIL:Object.freeze({id:'1cSj1aKLmlzpOELcFMaJgFD5Irbh7hLvB',type:'LIVE_DATA',authority:'BATTING_DETAIL'}),
  CURRENT_PITCHING_DETAIL:Object.freeze({id:'12Lw2EfQFktx57z_AEVcteFdO4ayD197C',type:'LIVE_DATA',authority:'PITCHING_DETAIL'}),
  CURRENT_FIELDING_DETAIL:Object.freeze({id:'1gYLconGQoYjFf4JMFL6o5J8P8hcPjQ2Z',type:'LIVE_DATA',authority:'FIELDING_DETAIL'}),
  CURRENT_APPEARANCE_DETAIL:Object.freeze({id:'1qjCyNhl49x7DYwa6FajUsvQJ1DkSLx5V',type:'LIVE_DATA',authority:'APPEARANCE_DETAIL'}),
  CURRENT_SCORE_SHEETS:Object.freeze({
    type:'PRIMARY_SOURCE_SET',authority:'SCORE_SHEET_ORIGINAL',
    folderId:'197eEgXoBnJWof82LWV6NtJxwEkfjK7Qr',
    officialFolderId:'1RWk4Y1kpN-zVCT_QC0TKMSWwhIt-oEfy',
    practiceFolderId:'1Q0bxMJQSQaH5ZxF2XwdRFA1kReFUGEUX',
    season:'2026-2027',independentVote:false,
    role:'VERIFY_OR_RECOVER_APPEARANCE_WHEN_CANONICAL_INVALID',
    files:Object.freeze([
      Object.freeze({id:'1MoPY8DYfVqdv6kPydUeamcaExckWSNzH',category:'PRACTICE',date:'2026-08-02',opponent:'勝山クラブ',gameNo:1,label:'第1試合'}),
      Object.freeze({id:'1tWKlEyexn7KZwGz2KhzBIRkubvc05BM4',category:'PRACTICE',date:'2026-08-02',opponent:'勝山クラブ',gameNo:2,label:'第2試合'}),
      Object.freeze({id:'1PpsGiOddyOnRAvPkzQ2v8gkJBH590qUu',category:'PRACTICE',date:'2026-08-09',opponent:'丸岡南中',gameNo:1,label:'第1試合'}),
      Object.freeze({id:'1uItgrOoPbJqRzKF8NIS-oscPp9t1UeDn',category:'PRACTICE',date:'2026-08-09',opponent:'丸岡南中',gameNo:2,label:'第2試合'}),
      Object.freeze({id:'1Iir8hFFGY5PTw3lwVHp1xnS8fy5uQ1nI',category:'PRACTICE',date:'2026-08-11',opponent:'坂井中',gameNo:1,label:'第1試合'}),
      Object.freeze({id:'1ultP0jfzYyyYIHsJxNeVE-ydIBhTjIrZ',category:'PRACTICE',date:'2026-08-11',opponent:'坂井中',gameNo:2,label:'第2試合'}),
      Object.freeze({id:'1yhk_29PoPWEeb6anChJkYAO1zWJ-37Bj',category:'PRACTICE',date:'2026-09-12',opponent:'藤島中',gameNo:1,label:'第1試合'}),
      Object.freeze({id:'1DcDL5cut_YqvslzGvoSgqYM146zVvZdS',category:'PRACTICE',date:'2026-09-12',opponent:'藤島中',gameNo:2,label:'第2試合'}),
      Object.freeze({id:'1dMSy3mUZtXJrUDgOsERONydU3vFgGAXo',category:'OFFICIAL',date:'2026-09-20',opponent:'丸岡南',appearanceOpponent:'丸岡南クラブ',stage:'1回戦',label:'1回戦'}),
      Object.freeze({id:'1dkDMubqWaKOTwe1maheNcxNOIvPReb-D',category:'OFFICIAL',date:'2026-09-21',opponent:'三国',appearanceOpponent:'三国クラブ',stage:'準決勝',label:'準決勝'}),
      Object.freeze({id:'1pLXiQiN_VRsygjCU_0hjWdszAbJQoyF6',category:'OFFICIAL',date:'2026-09-26',opponent:'三国',appearanceOpponent:'三国中',stage:'準決勝',label:'準決勝'}),
      Object.freeze({id:'1C-MzeD7v5c1cC_t6oymJkIBBqyFs0GtV',category:'PRACTICE',date:'2026-10-03',opponent:'金津クラブ',gameNo:1,label:'第1試合'}),
      Object.freeze({id:'1g9BsjOb2PgKdMyb6zB8sDkpK85INvmNm',category:'PRACTICE',date:'2026-10-03',opponent:'金津クラブ',gameNo:2,label:'第2試合'})
    ])
  }),
  COACH_OBSERVATIONS:Object.freeze({id:'15_dUUu6V2okcjHo-0Wnrgqrb9LbGvTBSs_0B66v3NWM',type:'OBSERVATION',authority:'COACH_OBSERVATION'}),
  PARENT_OBSERVATIONS:Object.freeze({id:'1HlLRLrq17nav68Ko-WcULHJ1pxu98imtJLbhwrz723g',type:'OBSERVATION',authority:'PARENT_OBSERVATION'}),
  NORMALIZED_OBSERVATIONS:Object.freeze({id:'1Cs5cQUJYEC1Ta7OQXi5hUWnKkQHVOHByRiWtwKsC0uE',type:'OBSERVATION',authority:'NORMALIZED_OBSERVATION',independentVote:false}),
  COACH_STRATEGY_SNAPSHOT_20260802:Object.freeze({id:'17eV-wwO-JlqQF7s4FPpL3URz6uwZt20S',type:'STRATEGY_SNAPSHOT',authority:'COACH_STRATEGY_SNAPSHOT',effectiveAt:'2026-08-02',currentPolicy:false,independentVote:false}),
  OLD_MASTER:Object.freeze({id:'1n8o28UPsNuyi8_9OlZvE5D7JBwjgZKdg',type:'HISTORICAL_REFERENCE',authority:'NUMERIC_MASTER'}),
  OLD_BATTING_DETAIL:Object.freeze({id:'1mNRMN8ChOnDolOoIQ9kHCh2mGionaxai',type:'HISTORICAL_REFERENCE',authority:'BATTING_DETAIL'}),
  OLD_PITCHING_DETAIL:Object.freeze({id:'1thxQXAdswckPVdmXdvRXPeuVAfDtskUB',type:'HISTORICAL_REFERENCE',authority:'PITCHING_DETAIL'}),
  OLD_FIELDING_DETAIL:Object.freeze({id:'1ENcfISRtE3E84K0DyxBDMrZzLs2rfFaJ',type:'HISTORICAL_REFERENCE',authority:'FIELDING_DETAIL'})
});

export const EXCLUDED_EVIDENCE_SOURCES=Object.freeze({
  PARENT_DUPLICATE_CANDIDATE:Object.freeze({
    id:'1XAGElS1AOYBFzLXVEXyv9m7gJ-dhnZqoSrvh-kUQO30',
    reason:'same-title parent response duplicate candidate; never read as independent Evidence'
  })
});

export function evidenceSource(key){return EVIDENCE_SOURCES[key]||null;}
export function isExcludedEvidenceSourceId(id){
  return Object.values(EXCLUDED_EVIDENCE_SOURCES).some(x=>x.id===String(id||''));
}
