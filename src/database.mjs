import { DatabaseSync } from 'node:sqlite';
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { getSyntheticRecords, getMeta } from './analytics.mjs';
import { permissions } from './permissions.mjs';
import { extendAccounts } from './accounts.mjs';
const digest = token => createHash('sha256').update(token).digest('hex');
const hashPassword = (password,salt) => scryptSync(password,salt,64);
export function openDatabase(path=':memory:') {
  if(path!==':memory:') mkdirSync(dirname(path),{recursive:true,mode:0o700});
  const db = new DatabaseSync(path);
  if(path!==':memory:') chmodSync(path,0o600);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS Student(id_number TEXT PRIMARY KEY,last_name TEXT,first_name TEXT,dob TEXT,gender TEXT,email TEXT,phone TEXT,address TEXT);
    CREATE TABLE IF NOT EXISTS Vendor_Type(type_id INTEGER PRIMARY KEY,name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS Vendor(vendor_id INTEGER PRIMARY KEY,name TEXT NOT NULL,address TEXT,gps TEXT,type_id INTEGER NOT NULL REFERENCES Vendor_Type(type_id));
    CREATE TABLE IF NOT EXISTS "Transaction"(transaction_id INTEGER PRIMARY KEY,student_id TEXT NOT NULL REFERENCES Student(id_number),vendor_id INTEGER NOT NULL REFERENCES Vendor(vendor_id),datetime TEXT NOT NULL,value NUMERIC NOT NULL,discount NUMERIC);
    CREATE INDEX IF NOT EXISTS transactions_datetime ON "Transaction"(datetime);
    CREATE TABLE IF NOT EXISTS Dataset(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS AppUser(id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('manager','reporting')),salt TEXT NOT NULL,password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS Session(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES AppUser(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS Feedback(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES AppUser(id),category TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS AuditEvent(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES AppUser(id),action TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS LoginAttempt(username TEXT PRIMARY KEY,count INTEGER NOT NULL,window_start INTEGER NOT NULL);
  `);
  if(!db.prepare("SELECT value FROM Dataset WHERE key='seed_version'").get()) {
    db.exec('BEGIN');
    try {
      const s=db.prepare('INSERT INTO Student(id_number) VALUES(?)');
      for(let i=1;i<=50;i++)s.run(`synthetic-student-${i}`);
      db.prepare('INSERT INTO Vendor_Type VALUES(?,?)').run(1,'Unclassified synthetic vendor');
      const v=db.prepare('INSERT INTO Vendor VALUES(?,?,?,?,?)');
      for(let i=1;i<=4;i++)v.run(i,`Synthetic vendor ${i}`,null,null,1);
      const t=db.prepare('INSERT INTO "Transaction" VALUES(?,?,?,?,?,?)');
      getSyntheticRecords().forEach((r,i)=>t.run(i+1,`synthetic-student-${i%50+1}`,i%4+1,`${r.date}T12:00:00Z`,r.valueMinor/100,null));
      const meta=db.prepare('INSERT INTO Dataset VALUES(?,?)');
      meta.run('seed_version','2');meta.run('coverage_from',getMeta().coverage.from);meta.run('coverage_to',getMeta().coverage.to);
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  // Extend only the known v1 synthetic fixture, without replacing existing records.
  if(db.prepare("SELECT value FROM Dataset WHERE key='seed_version'").get()?.value==='1') {
    db.exec('BEGIN');
    try {
      const insert=db.prepare('INSERT INTO "Transaction"(student_id,vendor_id,datetime,value,discount) VALUES(?,?,?,?,?)');
      const existing=new Set(db.prepare('SELECT DISTINCT substr(datetime,1,10) date FROM "Transaction"').all().map(r=>r.date));
      getSyntheticRecords().forEach((r,i)=>{
        if((r.date<'2026-06-01'||r.date>'2026-08-31')&&!existing.has(r.date))
          insert.run(`synthetic-student-${i%50+1}`,i%4+1,`${r.date}T12:00:00Z`,r.valueMinor/100,null);
      });
      const update=db.prepare('UPDATE Dataset SET value=? WHERE key=?');
      update.run(getMeta().coverage.from,'coverage_from');update.run(getMeta().coverage.to,'coverage_to');update.run('2','seed_version');
      db.exec('COMMIT');
    } catch(e) {db.exec('ROLLBACK');throw e;}
  }
  const audit=(userId,action)=>db.prepare('INSERT INTO AuditEvent(user_id,action,created_at) VALUES(?,?,?)').run(userId,action,new Date().toISOString());
  const publicUser=u=>({id:u.id,username:u.username,name:u.name,role:u.role,businessId:u.business_id,businessName:db.prepare('SELECT name FROM Business WHERE id=?').get(u.business_id)?.name,mustChangePassword:!!u.must_change,...permissions[u.role]});
  const store = {
    db, close:()=>db.close(),
    addUser({username,name,role,password}) {
      if(!/^[a-z0-9.@_+-]{3,120}$/.test(username)||!Object.hasOwn(permissions,role)||typeof password!=='string'||password.length<12||password.length>256)throw Error('Use a valid email or username, role and password of 12–256 characters.');
      const salt=randomBytes(16).toString('hex');
      db.prepare('INSERT INTO AppUser(username,name,role,salt,password_hash) VALUES(?,?,?,?,?)').run(username,name,role,salt,hashPassword(password,salt).toString('hex'));
    },
    userCount:()=>db.prepare('SELECT count(*) n FROM AppUser').get().n,
    authenticate(username,password) {
      const now=Date.now(),prior=db.prepare('SELECT * FROM LoginAttempt WHERE username=?').get(username);
      if(prior&&now-prior.window_start<900000&&prior.count>=5){const e=Error('Too many attempts. Try again in 15 minutes.');e.status=429;throw e;}
      const u=db.prepare('SELECT * FROM AppUser WHERE username=? AND active=1').get(username);
      const candidate=hashPassword(password,u?.salt||'dummy-salt-for-nonexistent-account');
      const expected=u?Buffer.from(u.password_hash,'hex'):Buffer.alloc(64);
      if(!timingSafeEqual(candidate,expected)||!u){
        const current=prior&&now-prior.window_start<900000;
        db.prepare('INSERT INTO LoginAttempt VALUES(?,?,?) ON CONFLICT(username) DO UPDATE SET count=excluded.count,window_start=excluded.window_start').run(username,current?prior.count+1:1,current?prior.window_start:now);
        return null;
      }
      db.prepare('DELETE FROM LoginAttempt WHERE username=?').run(username);
      return publicUser(u);
    },
    startSession(user) {
      const token=randomBytes(32).toString('hex');
      db.prepare('DELETE FROM Session WHERE expires<=?').run(Date.now());
      db.prepare('INSERT INTO Session VALUES(?,?,?)').run(digest(token),user.id,Date.now()+3600000);audit(user.id,'login');return token;
    },
    getSession(token) {
      if(!token)return null;
      const u=db.prepare('SELECT u.* FROM AppUser u JOIN Session s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>? AND u.active=1').get(digest(token),Date.now());
      return u?publicUser(u):null;
    },
    endSession(token,user) {if(token)db.prepare('DELETE FROM Session WHERE token_hash=?').run(digest(token));if(user)audit(user.id,'logout');},
    records:()=>db.prepare('SELECT substr(datetime,1,10) date, CAST(round(value*100) AS INTEGER) valueMinor FROM "Transaction" ORDER BY datetime,transaction_id').all(),
    coverage:()=>({from:db.prepare("SELECT value FROM Dataset WHERE key='coverage_from'").get().value,to:db.prepare("SELECT value FROM Dataset WHERE key='coverage_to'").get().value}),
    feedback(user,category,message) {
      const result=db.prepare('INSERT INTO Feedback(user_id,category,message,created_at) VALUES(?,?,?,?)').run(user.id,category,message,new Date().toISOString());
      audit(user.id,'feedback_submitted');return Number(result.lastInsertRowid);
    },
    ownFeedback:user=>db.prepare('SELECT id,category,message,created_at FROM Feedback WHERE user_id=? ORDER BY id DESC LIMIT 30').all(user.id),
    audit,
  };
  return extendAccounts(store);
}
