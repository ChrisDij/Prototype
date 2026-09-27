const app = document.querySelector('#app');
const state = {user:null, meta:null, summary:null, detail:null, view:'overview', metric:'recordCount', from:'', to:'', preset:'month', grouping:'daily', chart:'line', request:0};
const money = new Intl.NumberFormat('en-ZA', {style:'currency',currency:'ZAR',maximumFractionDigits:2});
const integer = new Intl.NumberFormat('en-ZA');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = iso => new Date(`${iso}T00:00:00Z`);
const dayLabel = iso => date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const longDate = iso => date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const offset = (iso,n) => new Date(date(iso).getTime()+n*86400000).toISOString().slice(0,10);
const rangeText = () => `${longDate(state.from)} – ${longDate(state.to)}`;
const logo = '<div class="logo"><span class="logo-mark" aria-hidden="true"><i></i><i></i><i></i></span>shoplytics</div>';
const labels = {recordCount:'Recorded transactions',averageRecordedValue:'Average transaction value',totalRecordedValue:'Total recorded value'};
function valueText(value, metric) {return value == null ? '—' : metric === 'recordCount' ? integer.format(value) : money.format(value/100);}
async function api(path,options={}) {
  const res = await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});
  const result = await res.json();
  if (!res.ok) {const e = new Error(result.error || 'Something went wrong. Please try again.'); e.status=res.status; throw e;}
  return result;
}
function error(message) {const el=document.querySelector('#error'); if(el){el.textContent=message;el.focus();}}
function login() {
  app.innerHTML=`<main id="main" class="login"><section class="login-side">${logo}<div><p class="eyebrow">Student market insights</p><h1>A clearer view of spending patterns.</h1><p>Explore recorded activity, compare periods and take a closer look at the numbers.</p><div class="mini-chart" aria-hidden="true">${Array.from({length:8},(_,i)=>`<span class="bar-${i+1}"></span>`).join('')}</div></div><p class="eyebrow">Group 7 · Working prototype</p></section><section class="login-form"><p class="eyebrow muted">Workspace access</p><h1>Sign in to Shoplytics</h1><p class="muted">Use your provisioned account to open the sample workspace.</p><form id="login-form"><div class="date-field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required maxlength="60"></div><div class="date-field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"></div><div id="error" class="error" role="alert" tabindex="-1"></div><button class="primary" type="submit">Sign in →</button></form><p class="muted login-note">Accounts are provisioned by the project team. This local workspace contains synthetic data only.</p></section></main>`;
}
function filters() {
  return `<form id="filter-form" class="filters"><div class="presets" aria-label="Date range presets">${[['week','Last 7 days'],['month','Last 30 days'],['all','All sample data']].map(([key,label])=>`<button type="button" data-preset="${key}" class="${state.preset===key?'active':''}" aria-pressed="${state.preset===key}">${label}</button>`).join('')}</div><div class="date-field"><label for="from">From</label><input required type="date" id="from" name="from" value="${esc(state.from)}"></div><div class="date-field"><label for="to">To</label><input required type="date" id="to" name="to" value="${esc(state.to)}"></div><button class="primary" type="submit">Apply dates</button><div class="date-field calendar-filter"><label for="calendar-period">University period</label><select id="calendar-period"><option value="">Choose a 2026 period</option>${state.meta.calendar.periods.map(p=>`<option value="${esc(p.id)}" ${p.start===state.from&&p.end===state.to?'selected':''}>${esc(p.label)}</option>`).join('')}</select></div></form>`;
}
function shell() {
  const detail=state.view==='detail';
  app.innerHTML=`<div class="shell"><aside class="sidebar">${logo}<nav aria-label="Main navigation"><div class="nav-label">WORKSPACE</div><button class="nav-item" data-action="overview"><span class="nav-icon" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Market overview</button><button class="nav-item feedback-nav" data-action="feedback">Feedback</button></nav><div class="side-footer"><div class="user-row"><span class="avatar" aria-hidden="true">${state.user.role==='manager'?'M':'R'}</span><span><strong>${esc(state.user.name)}</strong><small>Sample workspace</small></span></div><button class="signout" data-action="logout">Sign out</button></div></aside><div class="workspace"><header class="topbar"><span class="breadcrumb">Workspace <span aria-hidden="true">/</span> <b>${state.view==='feedback'?'Feedback':detail?'Detailed exploration':'Market overview'}</b></span><span class="pill">Synthetic data</span></header><main id="main" class="content">${detail?'<button class="text-button back" data-action="overview">← Back to overview</button>':''}<div class="title-row"><div><h1>${detail?esc(labels[state.metric]):'Student spending overview'}</h1><p class="muted">${detail?'Daily figures behind the selected metric.':'Explore transaction activity across the sample student market.'}</p></div><button id="export-report" class="secondary" data-action="export" disabled>Download PDF</button></div><div class="demo-note">This is generated sample data for design review. It does not describe real students, retailers or BoschCard activity.</div>${filters()}<div id="error" class="error" role="alert" tabindex="-1"></div><div id="results" aria-live="polite" aria-busy="true"><div class="loading">Loading the selected period…</div></div><footer class="footer"><span>Shoplytics · Group 7 prototype</span><span>Sample coverage: ${dayLabel(state.meta.coverage.from)} – ${longDate(state.meta.coverage.to)}</span></footer></main></div></div>`;
}
function comparison(metric) {
  const c=state.summary.comparison;
  if(!c.available) return 'No complete earlier period in sample';
  const key={recordCount:'recordCountPercent',averageRecordedValue:'averageRecordedValuePercent',totalRecordedValue:'totalRecordedValuePercent'}[metric];
  const change=c.changes?.[key];
  return change==null ? 'Comparison unavailable' : `<span class="kpi-change">${change>0?'+':''}${change.toFixed(1)}%</span> vs previous ${Math.round((date(state.to)-date(state.from))/86400000)+1} days`;
}
function cards() {
  const t=state.summary.totals;
  const values=state.summary.coverage.status==='none'
    ? {recordCount:null,averageRecordedValue:null,totalRecordedValue:null}
    : {recordCount:t.recordCount,averageRecordedValue:t.averageRecordedValueMinor,totalRecordedValue:t.totalRecordedValueMinor};
  return `<div class="kpis">${['recordCount','averageRecordedValue','totalRecordedValue'].map(metric=>{const clickable=state.user.canDrillDown; const tag=clickable?'button':'div';return `<${tag} class="kpi ${state.metric===metric&&state.view==='detail'?'selected':''}" ${clickable?`data-metric="${metric}" aria-label="Explore ${labels[metric]}"`:''}><span class="kpi-label">${labels[metric]}</span><span class="kpi-value">${valueText(values[metric],metric)}</span><span class="kpi-note">${comparison(metric)}</span>${clickable?'<span class="kpi-link">Explore metric ↗</span>':''}</${tag}>`;}).join('')}</div>`;
}
function chart(series,metric) {
  const valid=series.filter(x=>x.value!=null&&x.covered!==false);
  if(!valid.length||state.summary.totals.recordCount===0) return '<div class="empty"><h2>No transactions in this period</h2><p>Choose a period within the sample coverage to explore the draft.</p></div>';
  const width=1000,height=290,left=80,right=25,top=20,bottom=44;
  const max=Math.max(...valid.map(x=>x.value),1)*1.12;
  const x=i=>left+(width-left-right)*(state.chart==='column'?(i+.5)/series.length:series.length===1?.5:i/(series.length-1));
  const y=v=>height-bottom-v/max*(height-top-bottom);
  let segments=[],segment=[];
  series.forEach((point,i)=>{if(point.value==null||point.covered===false){if(segment.length)segments.push(segment);segment=[];}else segment.push([x(i),y(point.value),point]);});
  if(segment.length)segments.push(segment);
  const paths=segments.map(s=>{const line=s.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');return `<path class="chart-area" d="${line} L${s.at(-1)[0]},${height-bottom} L${s[0][0]},${height-bottom} Z"/><path class="chart-line" d="${line}"/>${s.length===1?`<circle class="chart-dot" cx="${s[0][0]}" cy="${s[0][1]}" r="5"/>`:''}`;}).join('');
  const grid=Array.from({length:5},(_,i)=>{const v=max*i/4, yy=y(v);const label=metric==='recordCount'?Math.round(v):`R ${Math.round(v/100).toLocaleString('en-ZA')}`;return `<line class="chart-grid" x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}"/><text text-anchor="end" x="${left-14}" y="${yy+4}">${label}</text>`;}).join('');
  const ticks=[...new Set([0,Math.floor((series.length-1)*.25),Math.floor((series.length-1)*.5),Math.floor((series.length-1)*.75),series.length-1])].map(i=>`<text text-anchor="middle" x="${x(i)}" y="${height-10}">${dayLabel(series[i].from||series[i].date)}</text>`).join('');
  const columnWidth=Math.min(38,(width-left-right)/(series.length+1)*.65);
  const bars=series.map((p,i)=>p.value==null?'':`<rect fill="#0d645c" x="${x(i)-columnWidth/2}" y="${y(p.value)}" width="${columnWidth}" height="${height-bottom-y(p.value)}"><title>${p.from} to ${p.to}: ${valueText(p.value,metric)}</title></rect>`).join('');
  return `<div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(labels[metric])} ${state.grouping} from ${esc(rangeText())}. Values available in the table below."><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#15937f" stop-opacity="0.15"/><stop offset="100%" stop-color="#15937f" stop-opacity="0.01"/></linearGradient></defs>${grid}${state.chart==='column'?bars:paths}${ticks}</svg></div>`;
}
function table(series,metric) {
  return `<div class="table-panel"><details><summary>View chart figures</summary><div class="table-scroll"><table><caption>Selected ${state.grouping} figures. Partial groups contain only selected, covered days. Weekly groups start Monday.</caption><thead><tr><th scope="col">Selected dates</th><th scope="col">${esc(labels[metric])}</th><th scope="col">Coverage</th></tr></thead><tbody>${series.map(p=>`<tr><th scope="row">${longDate(p.from)}${p.to!==p.from?' – '+longDate(p.to):''}</th><td>${valueText(p.value,metric)}</td><td>${!p.covered?'Outside sample':p.partial?'Partial group': 'Covered'} (${p.coveredDays}/${p.selectedDays} days)</td></tr>`).join('')}</tbody></table></div></details></div>`;
}
function calendarPanel() {
  const c=state.summary.calendar;
  return `<section class="calendar-panel"><h2>University context</h2><div class="calendar-list">${c.periods.map(p=>`<span class="calendar-tag ${p.type}">${esc(p.label)}<small>${dayLabel(p.from)} – ${dayLabel(p.to)}</small></span>`).join('')}</div>${c.events.length?`<p>${c.events.map(e=>`${esc(e.label)} (${dayLabel(e.start)}${e.end!==e.start?' – '+dayLabel(e.end):''})`).join(' · ')}</p>`:''}<p>${c.unclassifiedDays?`${c.unclassifiedDays} selected days are unclassified. `:''}Team-supplied 2026 calendar. Timing provides context, not proof of a cause.</p></section>`;
}
function chartControls() {
  return `<div class="chart-controls"><div class="date-field"><label for="grouping">Group by</label><select id="grouping">${['daily','weekly','monthly'].map(g=>`<option value="${g}" ${g===state.grouping?'selected':''}>${g[0].toUpperCase()+g.slice(1)}</option>`).join('')}</select></div><div class="date-field"><label for="chart-type">Chart</label><select id="chart-type"><option value="line" ${state.chart==='line'?'selected':''}>Line</option><option value="column" ${state.chart==='column'?'selected':''}>Columns</option></select></div></div>`;
}
function results() {
  const detail=state.view==='detail';
  const metric=detail?state.metric:'recordCount';
  const series=detail?state.detail.series:state.summary.series;
  const coverage=state.summary.coverage.status;
  const warning=coverage==='full'?'':`<div class="coverage-warning">${coverage==='none'?'This period is outside the sample coverage. No figures are available.':'This selection extends beyond the sample coverage. Totals include available days only; uncovered days are shown as gaps.'} Period comparisons are unavailable.</div>`;
  const summaryOnly=!state.user.canDrillDown;
  document.querySelector('#results').innerHTML=`<p class="range-caption">${rangeText()} · ${coverage==='full'?'Complete sample coverage':'Limited sample coverage'}</p>${warning}${cards()}${calendarPanel()}${chartControls()}<section class="chart-panel"><div class="panel-head"><div><h2>${detail?labels[metric]+' over time':'Transaction activity'}</h2><p>${detail?'A closer look at the selected period.':'Recorded transactions grouped by the selected interval.'}</p></div>${!detail&&!summaryOnly?'<button class="text-button" data-metric="recordCount">Explore ↗</button>':''}</div>${chart(series,metric)}<div class="chart-foot"><span class="legend">${labels[metric]}</span><span>${state.grouping[0].toUpperCase()+state.grouping.slice(1)} · ${metric==='recordCount'?'Transactions':'South African rand'}</span></div></section>${table(series,metric)}<div class="below"><div><h2>${detail?'How this metric is calculated':'Read the figures in context'}</h2><p>${detail?(metric==='recordCount'?'Count of synthetic transaction records dated within the selected period. One record is one transaction, not one unique shopper.':metric==='averageRecordedValue'?'Sum of recorded values divided by the number of transactions. Values are stored in cents and displayed in rand. No transactions means no average.':'Sum of recorded transaction values in the selected period. These sample amounts do not establish a retailer’s revenue or profit.'):'Recorded transactions are not measured foot traffic or all retailer sales. This draft demonstrates the flow; it does not recommend promotions.'}</p></div><div><h2>${summaryOnly?'Reporting access':'Comparison period'}</h2><p>${summaryOnly?'This proposed role can view and export summary figures and transaction activity, and submit feedback. Other detailed metrics remain restricted. Final permissions need approval.':state.summary.comparison.available?`The same number of days immediately before your selection: ${longDate(state.summary.comparison.range.from)} – ${longDate(state.summary.comparison.range.to)}. Changes describe sample data only.`:'Comparisons need a complete, equally long preceding period inside the sample. Missing history is never treated as zero.'}</p></div></div>`;
  document.querySelector('#results').setAttribute('aria-busy','false');
  const exportButton=document.querySelector('#export-report'); if(exportButton)exportButton.disabled=!state.user.canExport;
}
async function refresh({rerender=true}={}) {
  const id=++state.request;
  if(rerender) shell();
  try {
    const query=new URLSearchParams({from:state.from,to:state.to,grouping:state.grouping});
    const [summary,detail]=await Promise.all([api(`/api/summary?${query}`),state.view==='detail'?api(`/api/details?${query}&metric=${state.metric}`):null]);
    if(id!==state.request)return;
    state.summary=summary;state.detail=detail;results();
  } catch(e) {
    if(id!==state.request)return;
    if(e.status===401){state.user=null;login();error(e.message);return;}
    const target=document.querySelector('#results');if(target){target.innerHTML='';target.setAttribute('aria-busy','false');}error(e.message);
  }
}
async function enter() {
  state.meta=await api('/api/meta');
  state.to=state.meta.coverage.to;state.from=offset(state.to,-29);state.preset='month';state.view='overview';state.metric='recordCount';
  await refresh();
}
app.addEventListener('submit',async event=>{
  event.preventDefault();
  if(event.target.id==='login-form') {
    const btn=event.target.querySelector('button');btn.disabled=true;btn.textContent='Opening dashboard…';
    try {const res=await api('/api/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});state.user=res.user;await enter();}
    catch(e){login();error(e.message);}
  }
  if(event.target.id==='feedback-form') {
    const button=event.target.querySelector('button');button.disabled=true;
    try {await api('/api/feedback',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});await feedbackView('Feedback saved in the project database. No email notification was sent.');}catch(e){button.disabled=false;error(e.message);}
  }
  if(event.target.id==='filter-form') {
    const data=new FormData(event.target),from=data.get('from'),to=data.get('to');
    if(from>to){error('The start date must be on or before the end date.');return;}
    state.from=from;state.to=to;state.preset='';await refresh();
  }
});
app.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.preset) {
    state.preset=button.dataset.preset;state.to=state.meta.coverage.to;
    state.from=state.preset==='all'?state.meta.coverage.from:offset(state.to,state.preset==='week'?-6:-29);await refresh();
  }
  if(button.dataset.metric&&state.user.canDrillDown){state.metric=button.dataset.metric;state.view='detail';await refresh();document.querySelector('h1')?.scrollIntoView({block:'start'});}
  if(button.dataset.action==='feedback'){await feedbackView();}
  if(button.dataset.action==='export'){
    button.disabled=true;
    try{const query=new URLSearchParams({from:state.from,to:state.to,grouping:state.grouping,chart:state.chart,metric:state.view==='detail'?state.metric:'recordCount'});const session=await api('/api/session');if(!session.user)throw Error('Your session has ended. Please sign in again.');const a=document.createElement('a');a.href=`/api/report?${query}`;a.download=`shoplytics-${state.from}-${state.to}.pdf`;document.body.append(a);a.click();a.remove();}catch(e){error(e.message);}finally{button.disabled=false;}
  }
  if(button.dataset.action==='overview'){state.view='overview';await refresh();}
  if(button.dataset.action==='logout'){
    try{await api('/api/logout',{method:'POST',body:'{}'});++state.request;state.user=null;login();}catch(e){error(e.message);}
  }
});
async function feedbackView(message='') {
  ++state.request;state.view='feedback';shell();
  document.querySelector('#main').innerHTML=`<button class="text-button back" data-action="overview">← Back to overview</button><h1>Feedback</h1><p class="muted">Tell the project team what works and what could be clearer.</p><div id="error" class="error" role="alert" tabindex="-1"></div>${message?`<p class="success" role="status">${esc(message)}</p>`:''}<form id="feedback-form" class="feedback-form"><div class="date-field"><label for="category">Category</label><select id="category" name="category"><option>Usability</option><option>Insights</option><option>Other</option></select></div><div class="date-field"><label for="message">Your feedback</label><textarea id="message" name="message" minlength="5" maxlength="2000" rows="5" required></textarea></div><p class="muted">Saved in the project database. Please do not include student details or other sensitive information.</p><button class="primary" type="submit">Save feedback</button></form><section class="feedback-history"><h2>Your saved feedback</h2><div id="feedback-items">Loading…</div></section>`;
  try{const data=await api('/api/feedback');if(state.view!=='feedback')return;document.querySelector('#feedback-items').innerHTML=data.items.length?data.items.map(item=>`<article><strong>${esc(item.category)}</strong><small>${esc(item.created_at.slice(0,10))} · #${item.id}</small><p>${esc(item.message)}</p></article>`).join(''):'<p class="muted">No feedback submitted yet.</p>';}catch(e){if(e.status===401){login();}error(e.message);}
}
app.addEventListener('change',async event=>{
  if(event.target.id==='grouping'){state.grouping=event.target.value;await refresh();}
  if(event.target.id==='chart-type'){state.chart=event.target.value;results();}
  if(event.target.id==='calendar-period'&&event.target.value){const p=state.meta.calendar.periods.find(p=>p.id===event.target.value);state.from=p.start;state.to=p.end;state.preset='';await refresh();}
});
try {const {user}=await api('/api/session');state.user=user;if(user)await enter();else login();}
catch(e){login();error('Could not connect to the local demo. Check that the server is running and try reloading.');}
