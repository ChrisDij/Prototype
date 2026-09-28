import PDFDocument from 'pdfkit';
const money=n=>n==null?'Unavailable':`R ${(n/100).toFixed(2)}`;
const clean=s=>String(s).replace(/[–—]/g,'-').replace(/[^\x20-\x7e\n]/g,'');
export function makeWireframeReport(view,chart,scope){
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true}),chunks=[];
    doc.on('data',c=>chunks.push(c));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
    const line=(s,size=10)=>{if(doc.y>735)doc.addPage();doc.font('Helvetica').fontSize(size).fillColor('#241b3a').text(clean(s),{lineGap:4});doc.moveDown(.5);};
    line('SHOP-A-LYTICS',22);line(scope==='dashboard'?'Dashboard summary':'Current view report',16);
    line(`${view.business} | ${view.location}`);line(`${view.range.from} to ${view.range.to} | ${view.grouping} | ${chart}`);
    line(`Privacy: views with fewer than ${view.privacyMinimum} transactions are hidden. Additional buckets may be hidden to prevent subtraction. Flags are retained in aggregates.`);
    line(view.dataNote);line(view.calendar.note);
    const t=view.totals;
    line(t.hidden?'All selected metrics: Hidden':`Card transactions: ${t.recordCount??'Unavailable'}\nTotal student spend: ${money(t.totalRecordedValueMinor)}\nAverage transaction: ${money(t.averageRecordedValueMinor)}\nDiscounts: Not available`,12);
    line({recordCount:'Card transactions',totalRecordedValue:'Total student spend',averageRecordedValue:'Average transaction'}[view.metric],14);
    if(doc.y>540)doc.addPage();
    const top=doc.y,left=52,w=490,h=120,max=Math.max(1,...view.series.map(p=>p.value||0));
    const x=i=>left+(i+.5)*w/view.series.length,y=v=>top+h-v/max*h;
    doc.moveTo(left,top+h).lineTo(left+w,top+h).strokeColor('#ddd5ef').stroke();
    if(chart==='column')view.series.forEach((p,i)=>{if(p.value!=null)doc.rect(x(i)-w/view.series.length*.3,y(p.value),Math.max(.2,w/view.series.length*.6),top+h-y(p.value)).fill('#672ce4');});
    else {let previous=null;view.series.forEach((p,i)=>{if(p.value!=null){if(previous)doc.moveTo(previous.x,previous.y).lineTo(x(i),y(p.value)).strokeColor('#672ce4').stroke();else doc.circle(x(i),y(p.value),2).fill('#672ce4');previous={x:x(i),y:y(p.value)};}else previous=null;});}
    doc.fontSize(8).text(view.range.from,left,top+h+8,{lineBreak:false});doc.text(view.range.to,left+w-70,top+h+8,{lineBreak:false});
    doc.y=top+h+28;doc.x=42;line(`Scale: 0 to ${view.metric==='recordCount'?max:money(max)}. Gaps are hidden or unavailable values.`,9);
    line('Period / transactions / spend / average',12);
    for(const row of view.series)line(`${row.from} to ${row.to}: ${row.hidden?'Hidden':`${row.recordCount??'Unavailable'} / ${money(row.totalRecordedValueMinor)} / ${money(row.averageRecordedValueMinor)}`}${row.unusual?' - Unusual activity':''}`,9);
    if(scope==='dashboard')for(const [title,rows] of [['Spend by location',view.locations],['Spend by price band',view.priceBands],['Busiest days',view.weekdays]]){if(doc.y+35+rows.length*25>740)doc.addPage();line(title,13);for(const r of rows)line(`${r.name||r.label}: ${r.hidden?'Hidden':`${r.recordCount??'Unavailable'} transactions / ${money(r.totalRecordedValueMinor)}`}`);}
    line('Calendar context',14);for(const p of view.calendar.periods)line(`${p.label}: ${p.from} to ${p.to}`,9);
    for(const e of view.calendar.events)line(`${e.label}: ${e.start} to ${e.end}`,9);
    line('Calendar events and changes in transactions can coincide without establishing cause. No individual student records are included.');
    const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.fontSize(8).fillColor('#766a87').text(`Shop-A-Lytics | Synthetic data | ${i+1} / ${pages.count}`,42,785,{lineBreak:false});}
    doc.end();
  });
}
