import test from 'node:test';
import assert from 'node:assert/strict';
import { getMeta, getSummary } from './analytics.mjs';
import { calendar, calendarContext, presentation } from './presentation.mjs';
import { openDatabase } from './database.mjs';
import { makeReport } from './report.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('all supplied years have distinct periods, graduation events and exact boundaries',()=>{
  assert.equal(new Set(calendar.periods.map(p=>p.id)).size,33);
  assert.equal(calendarContext({from:'2024-02-12',to:'2024-02-12'}).periods[0].id,'2024-term-1');
  assert.equal(calendarContext({from:'2025-02-10',to:'2025-02-10'}).periods[0].id,'2025-term-1');
  assert.equal(calendarContext({from:'2024-06-09',to:'2024-06-09'}).unclassifiedDays,1);
  assert.equal(calendarContext({from:'2024-03-28',to:'2024-03-29'}).periods.length,2);
  assert.equal(calendarContext({from:'2025-06-10',to:'2025-06-11'}).periods.length,2);
  assert.equal(calendarContext({from:'2024-12-09',to:'2024-12-13'}).events.length,2);
  assert.equal(calendarContext({from:'2025-12-08',to:'2025-12-12'}).events.length,2);
  assert.equal(calendarContext({from:'2022-01-01',to:'2022-12-31'}).unclassifiedDays,365);
});

test('five-year selection contains records throughout, including leap day, and exports',async()=>{
  const summary=getSummary(getMeta().coverage);
  assert.equal(summary.coverage.status,'full');
  assert.equal(summary.daily[0].date,'2021-09-28');
  assert.equal(summary.daily.at(-1).date,'2026-09-28');
  assert.ok(summary.daily.every(d=>d.recordCount>0));
  assert.ok(summary.daily.some(d=>d.date==='2024-02-29'));
  assert.equal(summary.comparison.available,false);
  const pdf=await makeReport(presentation(summary,'monthly'),'column');
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
});

test('v1 migration preserves records, credentials and feedback and runs only once',()=>{
  const dir=mkdtempSync(join(tmpdir(),'shoplytics-migration-')),path=join(dir,'test.sqlite');
  let s=openDatabase(path);
  try {
    s.db.exec(`DELETE FROM "Transaction" WHERE datetime<'2026-06-01' OR datetime>='2026-09-01';
      UPDATE Dataset SET value='1' WHERE key='seed_version';
      UPDATE Dataset SET value='2026-06-01' WHERE key='coverage_from';
      UPDATE Dataset SET value='2026-08-31' WHERE key='coverage_to';`);
    const old=s.db.prepare('SELECT * FROM "Transaction" ORDER BY transaction_id').all();
    s.addUser({username:'migration-user',name:'Test',role:'manager',password:'migration-test-password'});
    const user=s.authenticate('migration-user','migration-test-password');
    s.feedback(user,'Usability','Preserve this');
    s.close();s=openDatabase(path);
    assert.ok(s.authenticate('migration-user','migration-test-password'));
    assert.equal(s.ownFeedback(user)[0].message,'Preserve this');
    assert.deepEqual(s.db.prepare('SELECT * FROM "Transaction" WHERE datetime>=? AND datetime<? ORDER BY transaction_id').all('2026-06-01','2026-09-01'),old);
    assert.deepEqual(s.coverage(),getMeta().coverage);
    const count=s.records().length;s.close();s=openDatabase(path);
    assert.equal(s.records().length,count);
    assert.equal(s.db.prepare('PRAGMA foreign_key_check').all().length,0);
  }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
