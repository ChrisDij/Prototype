import { readFileSync } from 'node:fs';
export const calendars = [2024,2025,2026].map(year=>JSON.parse(readFileSync(new URL(`./data/calendar-${year}.json`,import.meta.url),'utf8')));
export const calendar = {
  years: calendars.map(c=>c.year),
  periods: calendars.flatMap(c=>c.periods.map(p=>({...p,id:`${c.year}-${p.id}`,year:c.year,label:`${c.year} · ${p.label}`}))),
  events: calendars.flatMap(c=>c.events.map(e=>({...e,id:`${c.year}-${e.id}`,year:c.year,label:`${c.year} · ${e.label}`}))),
};
