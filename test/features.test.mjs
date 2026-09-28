import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aggregateRecords } from '../src/analytics.mjs';
import { groupDaily,calendarContext,presentation } from '../src/presentation.mjs';
import { openDatabase } from '../src/database.mjs';
import { makeReport } from '../src/report.mjs';

test('grouped averages are weighted by transactions and partial weeks are explicit',()=>{
  const records=[{date:'2026-06-01',valueMinor:100},{date:'2026-06-02',valueMinor:400},{date:'2026-06-02',valueMinor:400},{date:'2026-06-02',valueMinor:400}];
  const result=aggregateRecords(records,{from:'2026-06-01',to:'2026-06-02'});
  const week=groupDaily(result.daily,'weekly')[0];
  assert.equal(week.averageRecordedValueMinor,325);assert.equal(week.recordCount,4);assert.equal(week.partial,true);assert.equal(week.periodEnd,'2026-06-07');
  assert.equal(groupDaily(result.daily,'monthly')[0].averageRecordedValueMinor,325);
  assert.throws(()=>groupDaily(result.daily,'yearly'));
});
test('calendar retains overlaps, inclusive recess boundaries and unclassified dates',()=>{
  assert.equal(calendarContext({from:'2026-06-27',to:'2026-06-28'}).periods.length,2);
  const grad=calendarContext({from:'2026-03-23',to:'2026-03-27'});assert.equal(grad.periods[0].id,'2026-term-1');assert.equal(grad.events[0].id,'2026-graduation');
  assert.equal(calendarContext({from:'2026-05-16',to:'2026-05-17'}).unclassifiedDays,2);
  assert.equal(calendarContext({from:'2027-06-01',to:'2027-06-10'}).unclassifiedDays,10);
});
test('unknown days stay unknown after grouping',()=>{
  const d=aggregateRecords([],{from:'2026-05-30',to:'2026-06-02',coverage:{from:'2026-06-01',to:'2026-06-02'}});
  const weeks=groupDaily(d.daily,'weekly');assert.equal(weeks[0].recordCount,null);assert.equal(weeks[1].recordCount,0);assert.equal(weeks[1].averageRecordedValueMinor,null);
});
test('ERD relationships, users, sessions and feedback persist across reopen',()=>{
  const dir=mkdtempSync(join(tmpdir(),'shoplytics-test-')),path=join(dir,'test.sqlite');
  let s=openDatabase(path);
  try{
    assert.equal(s.db.prepare('PRAGMA foreign_key_check').all().length,0);
    const before=s.records().length;
    s.addUser({username:'test-user',name:'Test',role:'manager',password:'test-password-for-local-tests'});
    const user=s.authenticate('test-user','test-password-for-local-tests');assert.equal(user.canDrillDown,true);
    const row=s.db.prepare('SELECT * FROM AppUser').get();assert.notEqual(row.password_hash,'test-password-for-local-tests');
    const token=s.startSession(user),id=s.feedback(user,'Usability','Remember this feedback.');
    s.close();s=openDatabase(path);
    assert.equal(s.records().length,before);assert.equal(s.getSession(token).username,'test-user');assert.equal(s.ownFeedback(user)[0].id,id);
    s.endSession(token,user);assert.equal(s.getSession(token),null);
    for(let i=0;i<5;i++)assert.equal(s.authenticate('test-user','wrong-password'),null);
    assert.throws(()=>s.authenticate('test-user','test-password-for-local-tests'),/Too many/);
  }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
test('PDF generation handles empty periods and both chart types',async()=>{
  const summary=aggregateRecords([],{from:'2027-06-01',to:'2027-06-03',coverage:{from:'2026-06-01',to:'2026-08-31'}});
  for(const type of ['line','column']){
    const pdf=await makeReport(presentation(summary,'monthly'),type);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>1000);
  }
});
