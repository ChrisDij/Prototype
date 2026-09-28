import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from './database.mjs';
import {buildInsights,protect,partition,assessCounts} from './insights.mjs';
import {makeWireframeReport} from './wireframe-report.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync} from 'node:crypto';
const password='test-private-password-123';
function setup(){const store=openDatabase();store.addUser({username:'owner',name:'Owner',role:'manager',password});return {store,user:store.authenticate('owner',password)};}
test('wireframe migration supports a populated legacy accounts table and is idempotent',()=>{
  const dir=mkdtempSync(join(tmpdir(),'shoplytics-legacy-')),path=join(dir,'db.sqlite');
  const legacy=new DatabaseSync(path);legacy.exec('CREATE TABLE AppUser(id INTEGER PRIMARY KEY,username TEXT UNIQUE,name TEXT,role TEXT,salt TEXT,password_hash TEXT)');
  legacy.prepare('INSERT INTO AppUser VALUES(1,?,?,?,?,?)').run('legacy','Legacy user','manager','legacy-salt',scryptSync(password,'legacy-salt',64).toString('hex'));legacy.close();
  let store;
  try{store=openDatabase(path);assert.equal(store.authenticate('legacy',password).businessId,1);assert.equal(store.locations(store.authenticate('legacy',password)).length,4);store.close();store=openDatabase(path);assert.equal(store.userCount(),1);assert.equal(store.authenticate('legacy',password).mustChangePassword,false);}finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});
test('registration creates an isolated business and failed registration rolls back',()=>{
  const {store,user}=setup();try{
    const username=store.register({business:'New business',name:'New owner',email:'new@example.test',password});
    const other=store.authenticate(username,password);assert.notEqual(other.businessId,user.businessId);assert.equal(store.locations(other).length,0);assert.equal(store.scopedRecords(other).length,0);
    assert.throws(()=>buildInsights(store,other,{from:'2026-09-01',to:'2026-09-28',location:'1'}),/Location not found/);
    assert.throws(()=>store.register({business:'No partial business',name:'New owner',email:'new@example.test',password}));
    assert.equal(store.db.prepare('SELECT count(*) n FROM Business').get().n,2);
  }finally{store.close();}
});
test('team membership, password replacement, session revocation and owner boundaries',()=>{
  const {store,user}=setup();try{
    store.addMember(user,{name:'Team member',email:'member@example.test',password});
    const member=store.authenticate('member@example.test',password),token=store.startSession(member);
    assert.equal(member.mustChangePassword,true);assert.equal(member.canDrillDown,true);
    assert.throws(()=>store.team(member),/Only owners/);assert.throws(()=>store.addMember(member,{}),/Only owners/);
    assert.throws(()=>store.changePassword(member,{password,confirm:password}),/different/);
    const changed=store.changePassword(member,{password:password+'new',confirm:password+'new'});assert.equal(changed.mustChangePassword,false);assert.equal(store.getSession(token),null);
    const active=store.startSession(changed);assert.throws(()=>store.removeMember(user,user.id),/not found/);
    store.register({business:'Other business',name:'Other owner',email:'other@example.test',password});const other=store.authenticate('other@example.test',password);
    assert.throws(()=>store.removeMember(other,member.id),/not found/);
    store.removeMember(user,member.id);assert.equal(store.getSession(active),null);assert.equal(store.authenticate('member@example.test',password+'new'),null);
  }finally{store.close();}
});
test('privacy threshold is inclusive and suppresses complementary values',()=>{
  assert.equal(protect({recordCount:4,totalRecordedValueMinor:123,value:123}).value,null);
  assert.equal(protect({recordCount:5,totalRecordedValueMinor:123}).hidden,false);
  const safe=partition([{recordCount:4,totalRecordedValueMinor:400},{recordCount:20,totalRecordedValueMinor:2000}]);assert.ok(safe.every(r=>r.hidden&&r.recordCount===null&&r.totalRecordedValueMinor===null));
});
test('all API-facing detail measures and comparisons obey privacy, exports still render',async()=>{
  const {store,user}=setup();try{
    store.db.exec('DELETE FROM "Transaction"');
    for(let i=0;i<3;i++)store.db.prepare('INSERT INTO "Transaction" VALUES(?,?,?,?,?,?)').run(i+1,'synthetic-student-1',1,'2026-09-01T12:00:00Z',19.99,null);
    const v=buildInsights(store,user,{from:'2026-09-01',to:'2026-09-01',metric:'totalRecordedValue'});
    for(const row of [v.totals,...v.daily,...v.series,...v.locations,...v.priceBands,...v.weekdays]){assert.equal(row.recordCount,null);assert.equal(row.totalRecordedValueMinor,null);assert.equal(row.averageRecordedValueMinor,null);}
    assert.equal(v.comparison.changes,null);assert.equal(v.alerts.items.length,0);
    const pdf=await makeWireframeReport(v,'column','dashboard');assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  }finally{store.close();}
});
test('count alerts use prior observations, calendar matching and explicit insufficient history',()=>{
  const records=[];
  for(const date of ['2026-07-27','2026-08-03','2026-08-10','2026-08-17','2026-08-24','2026-08-31'])for(let i=0;i<(date==='2026-08-31'?30:10);i++)records.push({date,locationId:1,valueMinor:100});
  const a=assessCounts(records,{from:'2026-08-31',to:'2026-08-31'},[{id:1,name:'Test'}],{from:'2021-09-28',to:'2026-09-28'});
  assert.equal(a.items.length,1);assert.equal(a.items[0].mean,10);assert.ok(a.items[0].history.every(r=>r.date<'2026-08-31'));
  const estimated=assessCounts(records,{from:'2023-08-31',to:'2023-08-31'},[{id:1,name:'Test'}],{from:'2021-09-28',to:'2026-09-28'});assert.equal(estimated.assessed,0);assert.equal(estimated.notAssessed,1);
});
test('average-value alerts use historical per-day averages without changing totals',()=>{
  const records=[];
  for(const date of ['2026-07-27','2026-08-03','2026-08-10','2026-08-17','2026-08-24','2026-08-31'])for(let i=0;i<10;i++)records.push({date,locationId:1,valueMinor:date==='2026-08-31'?25:100});
  const a=assessCounts(records,{from:'2026-08-31',to:'2026-08-31'},[{id:1,name:'Test'}],{from:'2021-09-28',to:'2026-09-28'});
  assert.equal(a.items.length,1);assert.equal(a.items[0].metric,'averageRecordedValue');assert.equal(a.items[0].mean,100);assert.equal(a.items[0].value,25);assert.equal(records.length,60);
});
test('uncovered dates remain unavailable, and invalid chart/band filters are rejected',()=>{
  const {store,user}=setup();try{
    const v=buildInsights(store,user,{from:'2027-01-01',to:'2027-01-03'});assert.equal(v.coverage.status,'none');assert.equal(v.totals.recordCount,null);assert.equal(v.totals.hidden,false);
    assert.throws(()=>buildInsights(store,user,{from:'2026-09-01',to:'2026-09-02',band:'bogus'}),/price band/);
    assert.throws(()=>buildInsights(store,user,{from:'2026-09-01',to:'2026-09-02',chart:'bogus'}),/chart/);
  }finally{store.close();}
});
