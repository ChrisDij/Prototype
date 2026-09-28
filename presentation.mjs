import { calendar } from './calendar.mjs';
export { calendar } from './calendar.mjs';
const dayMs=86400000;
const ms=s=>Date.parse(`${s}T00:00:00Z`);
const iso=d=>new Date(d).toISOString().slice(0,10);
export function groupDaily(daily,grouping='daily') {
  if(!['daily','weekly','monthly'].includes(grouping))throw Error('Choose daily, weekly or monthly grouping.');
  const groups=new Map();
  for(const d of daily){
    const dt=new Date(ms(d.date));let start=d.date,end=d.date;
    if(grouping==='weekly'){start=iso(ms(d.date)-((dt.getUTCDay()+6)%7)*dayMs);end=iso(ms(start)+6*dayMs);}
    if(grouping==='monthly'){start=d.date.slice(0,7)+'-01';end=iso(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,0));}
    if(!groups.has(start))groups.set(start,{date:start,periodEnd:end,from:d.date,to:d.date,selectedDays:0,coveredDays:0,recordCount:0,totalRecordedValueMinor:0});
    const g=groups.get(start);g.to=d.date;g.selectedDays++;
    if(d.covered){g.coveredDays++;g.recordCount+=d.recordCount;g.totalRecordedValueMinor+=d.totalRecordedValueMinor;}
  }
  return [...groups.values()].map(g=>({...g,covered:g.coveredDays>0,partial:g.coveredDays<g.selectedDays||g.from!==g.date||g.to!==g.periodEnd,
    recordCount:g.coveredDays?g.recordCount:null,totalRecordedValueMinor:g.coveredDays?g.totalRecordedValueMinor:null,
    averageRecordedValueMinor:g.recordCount?Math.round(g.totalRecordedValueMinor/g.recordCount):null,
  }));
}
export function calendarContext(range) {
  const overlap=p=>p.start<=range.to&&p.end>=range.from;
  const periods=calendar.periods.filter(overlap).map(p=>({...p,from:p.start<range.from?range.from:p.start,to:p.end>range.to?range.to:p.end}));
  let classifiedDays=0,estimatedDays=0;
  for(let d=ms(range.from);d<=ms(range.to);d+=dayMs){
    const matches=periods.filter(p=>p.from<=iso(d)&&p.to>=iso(d));
    if(matches.length)classifiedDays++;
    if(matches.some(p=>p.estimated))estimatedDays++;
  }
  const hasEstimatedCalendar=range.from<='2023-12-31'&&range.to>='2021-01-01';
  return {years:calendar.years,periods,events:calendar.events.filter(overlap),estimatedDays,hasEstimatedCalendar,unclassifiedDays:Math.round((ms(range.to)-ms(range.from))/dayMs)+1-classifiedDays,
    note:hasEstimatedCalendar?'Estimated calendar — inferred from 2024–2026 for 2021–2023. Illustrative dates only, not verified history or a reliable anomaly baseline. 2024–2026 dates are team-supplied. Unlisted dates remain unclassified.':'2024–2026 calendars supplied by the team; unlisted dates remain unclassified. Calendar context does not establish cause.'};
}
export function seriesFor(grouped,metric='recordCount') {
  if(!['recordCount','totalRecordedValue','averageRecordedValue'].includes(metric))throw Error('Choose a supported metric.');
  const key=metric==='recordCount'?metric:metric+'Minor';
  return grouped.map(p=>({...p,value:p[key]}));
}
export function presentation(summary,grouping='daily',metric='recordCount') {
  return {...summary,grouping,metric,series:seriesFor(groupDaily(summary.daily,grouping),metric),calendar:calendarContext(summary.range)};
}
