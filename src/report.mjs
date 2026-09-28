import PDFDocument from 'pdfkit';
const labels={recordCount:'Recorded transactions',totalRecordedValue:'Total recorded value',averageRecordedValue:'Average transaction value'};
const fmt=(v,metric)=>v==null?'Unavailable':metric==='recordCount'?v.toLocaleString('en-ZA'):`R ${(v/100).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const short=s=>s;
export function makeReport(view,chart='line') {
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:42,info:{Title:'Shoplytics market report',Author:'Shoplytics prototype'}}),chunks=[];
    doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
    const width=511;
    const txt=(text,x,y,size=10,bold=false,options={})=>doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).fillColor('#192b35').text(text,x,y,{width,...options});
    txt('SHOPLYTICS',42,38,11,true);txt('SYNTHETIC DATA',419,39,9,true,{width:134,align:'right'});
    txt('Student market report',42,68,23,true);
    txt(`${view.range.from} to ${view.range.to}  |  ${view.grouping}  |  ${chart} chart`,42,103,10);
    txt('All vendors combined. Invented sample data, not real student or retailer activity.',42,122,9);
    doc.moveTo(42,145).lineTo(553,145).strokeColor('#cbd8dd').stroke();
    const totals=view.coverage.status==='none'?{recordCount:null,totalRecordedValueMinor:null,averageRecordedValueMinor:null}:view.totals;
    const cards=[['Transactions',totals.recordCount,'recordCount'],['Average recorded value',totals.averageRecordedValueMinor,'averageRecordedValue'],['Total recorded value',totals.totalRecordedValueMinor,'totalRecordedValue']];
    cards.forEach(([label,value,metric],i)=>{txt(label,42+i*174,163,9,false,{width:167});txt(fmt(value,metric),42+i*174,183,16,true,{width:167});});
    txt(labels[view.metric],42,231,13,true);
    const series=view.series,left=93,right=550,top=272,bottom=466;
    const values=series.filter(p=>p.value!=null);
    if(values.length&&view.totals.recordCount){
      const max=Math.max(...values.map(p=>p.value),1)*1.12;
      const x=i=>left+(right-left)*(chart==='column'?(i+.5)/series.length:series.length===1?.5:i/(series.length-1));const y=v=>bottom-v/max*(bottom-top);
      for(let i=0;i<5;i++){
        const v=max*i/4,yy=y(v);doc.moveTo(left,yy).lineTo(right,yy).strokeColor('#e0e7eb').lineWidth(.5).stroke();
        txt(view.metric==='recordCount'?Math.round(v).toString():`R ${Math.round(v/100).toLocaleString('en-ZA')}`,39,yy-4,8,false,{width:46,align:'right'});
      }
      if(chart==='column'){
        const w=Math.min(28,(right-left)/(series.length+1)*.65);
        series.forEach((p,i)=>{if(p.value!=null)doc.rect(x(i)-w/2,y(p.value),w,bottom-y(p.value)).fill('#0d645c');});
      }else{
        let previous=false;
        series.forEach((p,i)=>{if(p.value==null){if(previous)doc.strokeColor('#0d645c').lineWidth(1.8).stroke();previous=false;return;}if(previous)doc.lineTo(x(i),y(p.value));else doc.moveTo(x(i),y(p.value));previous=true;});
        if(previous)doc.strokeColor('#0d645c').lineWidth(1.8).stroke();
        if(values.length===1){const i=series.findIndex(p=>p.value!=null);doc.circle(x(i),y(series[i].value),3).fill('#0d645c');}
      }
      [...new Set([0,Math.floor((series.length-1)/2),series.length-1])].forEach(i=>txt(short(series[i].from),x(i)-32,479,8,false,{width:64,align:'center'}));
    }else txt('No covered transaction data for this selection.',93,352,12);
    txt('Calendar context',42,518,12,true);
    const context=[...(view.calendar.hasEstimatedCalendar?['2021–2023: ESTIMATED calendar, inferred from 2024–2026. Illustrative only.']:[]),...view.calendar.periods.map(p=>`${p.label}: ${p.from} to ${p.to}`),...view.calendar.events.map(e=>`${e.label}: ${e.start}${e.end!==e.start?' to '+e.end:''}`)];
    if(view.calendar.unclassifiedDays)context.push(`${view.calendar.unclassifiedDays} selected days are not classified by the available calendars.`);
    // A longer calendar selection receives its own second page, never clipped.
    if(context.length>5){txt('See the calendar details on page 2.',42,541,10);}else context.forEach((line,i)=>txt(line,42,540+i*15,9));
    txt('Interpretation and coverage',42,640,12,true);
    txt(`Coverage: ${view.coverage.status}. ${view.coverage.from?`Available selected data: ${view.coverage.from} to ${view.coverage.to}.`:'No source coverage for the selected dates.'} Partial groups include only covered, selected days. Weekly groups start Monday. Averages use total value divided by transaction count.`,42,661,9,false,{lineGap:3});
    txt('These are recorded transactions, not foot traffic or all retailer sales. Calendar context does not establish cause. Discount analysis is not included. Calendar: supplied 2024–2026; ESTIMATED 2021–2023, inferred from those calendars. Estimates are illustrative, not verified history or a reliable anomaly baseline.',42,718,9,false,{lineGap:3});
    txt('Shoplytics | Prototype report',42,783,8);txt('1',530,783,8,false,{width:23,align:'right'});
    if(context.length>5){
      doc.addPage();txt('Calendar details',42,45,21,true);txt(`${view.range.from} to ${view.range.to}`,42,79,10);
      let y=120,page=2;
      const footer=()=>{txt('Shoplytics | Synthetic data | 2024–2026 supplied; 2021–2023 estimated',42,783,8);txt(String(page),530,783,8,false,{width:23,align:'right'});};
      for(const line of [...context,'Events can overlap teaching periods. Unlisted dates remain unclassified.']){
        if(y>730){footer();doc.addPage();page++;txt('Calendar details (continued)',42,45,21,true);y=95;}
        txt(line,42,y,9);y+=24;
      }
      footer();
    }
    doc.end();
  });
}
