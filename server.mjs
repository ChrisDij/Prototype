import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getMeta } from './analytics.mjs';
import { openDatabase } from './database.mjs';
import { calendar } from './presentation.mjs';
import { buildInsights } from './insights.mjs';
import { makeWireframeReport } from './wireframe-report.mjs';

const assets = new Map([['/', ['index.html','text/html; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']],['/styles.css',['styles.css','text/css; charset=utf-8']]]);
export function createApp({databasePath=fileURLToPath(new URL('./.local/shoplytics.sqlite',import.meta.url))}={}) {
  const store=openDatabase(databasePath);
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json=(status,body,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(body));};
    const host=req.headers.host;
    if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host||''))return json(403,{error:'Local prototype only.'});
    const url=new URL(req.url,`http://${host}`);
    const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('shoplytics_session='));
    const token=cookie?.slice('shoplytics_session='.length);
    const user=store.getSession(token);
    async function body(){
      if(!req.headers['content-type']?.startsWith('application/json')){const e=Error('Expected JSON.');e.status=415;throw e;}
      let raw='';for await(const part of req){raw+=part;if(raw.length>8192){const e=Error('Request too large.');e.status=413;throw e;}}
      let parsed;try{parsed=JSON.parse(raw);}catch{throw Error('Invalid request.');}
      if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid request.');return parsed;
    }
    try {
      if(req.method==='POST'){
        if(req.headers.origin!==`http://${host}`)return json(403,{error:'Use the application page to perform this action.'});
        if(url.pathname==='/api/login'){
          const b=await body();const username=typeof b.username==='string'?b.username.trim().toLowerCase():'';
          if(!/^[a-z0-9.@_+-]{3,120}$/.test(username)||typeof b.password!=='string'||b.password.length>256)return json(401,{error:'Incorrect username or password.'});
          const found=store.authenticate(username,b.password);
          if(!found)return json(401,{error:'Incorrect username or password.'});
          store.endSession(token,null);const session=store.startSession(found);
          return json(200,{user:found},{'Set-Cookie':`shoplytics_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`});
        }
        if(url.pathname==='/api/register'){
          const b=await body();const username=store.register(b),found=store.authenticate(username,b.password);
          store.endSession(token,null);const session=store.startSession(found);
          return json(201,{user:found},{'Set-Cookie':`shoplytics_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`});
        }
        if(url.pathname==='/api/logout'){store.endSession(token,user);return json(200,{ok:true},{'Set-Cookie':'shoplytics_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
        if(!user)return json(401,{error:'Please sign in to continue.'});
        if(url.pathname==='/api/password'){
          const found=store.changePassword(user,await body()),session=store.startSession(found);
          return json(200,{user:found},{'Set-Cookie':`shoplytics_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`});
        }
        if(user.mustChangePassword)return json(403,{error:'Set your own password before continuing.'});
        if(url.pathname==='/api/team'){store.addMember(user,await body());return json(201,{ok:true});}
        if(url.pathname==='/api/team/remove'){store.removeMember(user,(await body()).id);return json(200,{ok:true});}
        if(url.pathname==='/api/feedback'){
          if(!user.canFeedback)return json(403,{error:'Feedback is not available for this account.'});
          const b=await body();
          if(!['Usability','Insights','Other'].includes(b.category)||typeof b.message!=='string'||b.message.trim().length<5||b.message.trim().length>2000)throw Error('Choose a category and enter between 5 and 2,000 characters.');
          const id=store.feedback(user,b.category,b.message.trim());return json(201,{id,message:'Feedback saved in the project database. No email notification was sent.'});
        }
        return json(404,{error:'Not found.'});
      }
      if(req.method!=='GET')return json(405,{error:'Method not allowed.'});
      if(url.pathname==='/api/session')return json(200,{user});
      if(url.pathname.startsWith('/api/')){
        if(!user)return json(401,{error:'Your session has ended. Please sign in again.'});
        if(user.mustChangePassword)return json(403,{error:'Set your own password before continuing.'});
        if(url.pathname==='/api/team')return json(200,{items:store.team(user)});
        if(url.pathname==='/api/locations')return json(200,{items:store.locations(user)});
        if(url.pathname==='/api/alerts'){
          if(!user.canViewAlerts)return json(403,{error:'Only owners can access alerts.'});
          return json(200,buildInsights(store,user,Object.fromEntries(url.searchParams)).alerts);
        }
        if(url.pathname==='/api/meta')return json(200,{...getMeta(),coverage:store.coverage(),calendar:{periods:calendar.periods,events:calendar.events}});
        if(url.pathname==='/api/feedback')return json(200,{items:store.ownFeedback(user)});
        if(['/api/summary','/api/details','/api/report'].includes(url.pathname)){
          const q=Object.fromEntries(url.searchParams);const metric=q.metric||'recordCount';const grouping=q.grouping||'daily';const chart=q.chart||'line';
          if(!['line','column'].includes(chart))throw Error('Choose a line or column chart.');
          if(q.scope&&!['current','dashboard'].includes(q.scope))throw Error('Choose current view or dashboard summary.');
          if(!user.canDrillDown&&(url.pathname==='/api/details'||metric!=='recordCount'))return json(403,{error:'This account can view transaction activity and summary figures only.'});
          if(url.pathname==='/api/report'&&!user.canExport)return json(403,{error:'Report export is not available for this account.'});
          const view=buildInsights(store,user,{...q,grouping,metric});
          if(url.pathname==='/api/report'){
            const pdf=await makeWireframeReport(view,chart,q.scope||'current');store.audit(user.id,'report_exported');
            res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="shoplytics-${q.from}-${q.to}.pdf"`});return res.end(pdf);
          }
          if(!user.canDrillDown){
            view.daily=view.daily.map(({date,recordCount,covered})=>({date,recordCount,covered}));
            view.series=view.series.map(({date,periodEnd,from,to,selectedDays,coveredDays,covered,partial,recordCount,value})=>({date,periodEnd,from,to,selectedDays,coveredDays,covered,partial,recordCount,value}));
          }
          return json(200,view);
        }
        return json(404,{error:'Not found.'});
      }
      const asset=assets.get(url.pathname);if(!asset)return json(404,{error:'Not found.'});
      const data=await readFile(new URL(`./public/${asset[0]}`,import.meta.url));res.writeHead(200,{'Content-Type':asset[1]});res.end(data);
    }catch(e){
      if(url.pathname.startsWith('/api/'))return json(e.status||400,{error:e.message});
      console.error(e);json(500,{error:'Could not load the application.'});
    }
  });
  server.on('close',()=>store.close());return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const port=Number(process.env.SHOPLYTICS_PORT||4317);
  createApp().listen(port,'127.0.0.1',()=>console.log(`Shoplytics: http://127.0.0.1:${port}`));
}
