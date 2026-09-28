import { readFileSync } from "node:fs";
const supplied = [2024, 2025, 2026].map((year) =>
  JSON.parse(
    readFileSync(
      new URL(`./data/calendar-${year}.json`, import.meta.url),
      "utf8",
    ),
  ),
);
const dayMs = 86400000;
const millis = (s) => Date.parse(`${s}T00:00:00Z`);
const median = (values) =>
  values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
// All three supplied calendars start term 1 on February's second Monday.
// Median offsets retain the typical academic-week structure, not historical facts.
function estimate(year) {
  const feb1 = Date.UTC(year, 1, 1);
  const anchor = feb1 + (((8 - new Date(feb1).getUTCDay()) % 7) + 7) * dayMs;
  return {
    year,
    estimated: true,
    source: {
      type: "inferred",
      basedOn: [2024, 2025, 2026],
      method:
        "Second Monday in February; median start/end offsets from first-term start in the three supplied calendars.",
    },
    periods: supplied[0].periods.map((template) => {
      const boundary = (key) =>
        new Date(
          anchor +
            median(
              supplied.map(
                (c) =>
                  millis(c.periods.find((p) => p.id === template.id)[key]) -
                  millis(c.periods.find((p) => p.id === "term-1").start),
              ),
            ),
        )
          .toISOString()
          .slice(0, 10);
      return { ...template, start: boundary("start"), end: boundary("end") };
    }),
    events: [],
  };
}
export const calendars = [...[2021, 2022, 2023].map(estimate), ...supplied];
export const calendar = {
  years: calendars.map((c) => c.year),
  periods: calendars.flatMap((c) =>
    c.periods.map((p) => ({
      ...p,
      id: `${c.year}-${p.id}`,
      year: c.year,
      estimated: !!c.estimated,
      eligibleForAnomalyBaseline: !c.estimated,
      label: `${c.year} · ${p.label}${c.estimated ? " (estimated)" : ""}`,
    })),
  ),
  events: calendars.flatMap((c) =>
    c.events.map((e) => ({
      ...e,
      id: `${c.year}-${e.id}`,
      year: c.year,
      label: `${c.year} · ${e.label}`,
    })),
  ),
};
