/**
 * Deterministic, entirely invented demonstration records. These values describe
 * recorded transactions only; they say nothing about customer traffic, discounts,
 * product mix, profit, or any real retailer's performance.
 *
 * All ranges are inclusive UTC calendar dates. Money uses integer ZAR cents;
 * averageRecordedValueMinor is rounded to the nearest cent (null for no records).
 * A covered date with no records has count/total 0. An uncovered date has null
 * measures, so a gap in source coverage cannot become a claimed zero.
 */

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 1_830;
const SOURCE_RANGE = Object.freeze({ from: "2021-09-28", to: "2026-09-28" });
const DEFAULT_RANGE = Object.freeze({ from: "2026-08-30", to: "2026-09-28" });
const METRICS = Object.freeze([
  Object.freeze({
    id: "recordCount",
    label: "Recorded transactions",
    unit: "count",
  }),
  Object.freeze({
    id: "totalRecordedValue",
    label: "Total recorded value",
    unit: "minor",
  }),
  Object.freeze({
    id: "averageRecordedValue",
    label: "Average recorded value",
    unit: "minor",
  }),
]);

function dateMillis(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be a date in YYYY-MM-DD format.`);
  }
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(ms) ||
    new Date(ms).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${label} must be a real calendar date.`);
  }
  return ms;
}

function isoDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Validate a bounded selection; valid dates outside source coverage are allowed. */
export function validateRange(options = {}) {
  if (!options || typeof options !== "object")
    throw new Error("Choose a date range.");
  const { from, to } = options;
  const fromMs = dateMillis(from, "Start date");
  const toMs = dateMillis(to, "End date");
  if (fromMs > toMs)
    throw new Error("Start date must be on or before end date.");
  const days = (toMs - fromMs) / DAY_MS + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new Error(
      `Choose a range of at most ${MAX_RANGE_DAYS.toLocaleString("en-ZA")} days.`,
    );
  }
  return { from, to, days };
}

function coverageFor(range, coverage) {
  const from = range.from > coverage.from ? range.from : coverage.from;
  const to = range.to < coverage.to ? range.to : coverage.to;
  if (from > to) return { status: "none", from: null, to: null };
  return {
    status: from === range.from && to === range.to ? "full" : "partial",
    from,
    to,
  };
}

function totalsFor(recordCount, totalRecordedValueMinor) {
  return {
    recordCount,
    totalRecordedValueMinor,
    averageRecordedValueMinor: recordCount
      ? Math.round(totalRecordedValueMinor / recordCount)
      : null,
  };
}

/**
 * Aggregate records shaped {date:'YYYY-MM-DD', valueMinor:nonnegative integer}.
 * coverage explicitly states the period supplied by the source; by default the
 * selected range is assumed covered. Records outside coverage are excluded.
 * Returns {range:{from,to,days}, coverage:{status,from,to}, totals, daily}.
 * Totals describe only covered dates. No observations gives count/total 0 and
 * average null; use coverage.status to distinguish no coverage from zero records.
 */
export function aggregateRecords(records, options = {}) {
  if (!Array.isArray(records)) throw new Error("Records must be an array.");
  const range = validateRange(options);
  const sourceCoverage = options.coverage
    ? validateRange(options.coverage)
    : range;
  const coverage = coverageFor(range, sourceCoverage);
  const days = new Map();
  const fromMs = dateMillis(range.from, "Start date");
  for (let offset = 0; offset < range.days; offset += 1) {
    const date = isoDate(fromMs + offset * DAY_MS);
    const covered = date >= sourceCoverage.from && date <= sourceCoverage.to;
    days.set(date, {
      date,
      recordCount: covered ? 0 : null,
      totalRecordedValueMinor: covered ? 0 : null,
      averageRecordedValueMinor: null,
      covered,
    });
  }
  let recordCount = 0;
  let totalRecordedValueMinor = 0;
  for (const record of records) {
    if (!record || typeof record !== "object")
      throw new Error("Each record must contain a date and value.");
    dateMillis(record.date, "Record date");
    if (!Number.isSafeInteger(record.valueMinor) || record.valueMinor < 0) {
      throw new Error(
        "Record values must be nonnegative safe integers in ZAR cents.",
      );
    }
    const day = days.get(record.date);
    if (!day?.covered) continue;
    recordCount += 1;
    totalRecordedValueMinor += record.valueMinor;
    if (!Number.isSafeInteger(totalRecordedValueMinor)) {
      throw new Error(
        "The total recorded value exceeds the supported numeric range.",
      );
    }
    day.recordCount += 1;
    day.totalRecordedValueMinor += record.valueMinor;
  }
  for (const day of days.values()) {
    if (day.covered)
      Object.assign(
        day,
        totalsFor(day.recordCount, day.totalRecordedValueMinor),
      );
  }
  return {
    range,
    coverage,
    totals: totalsFor(recordCount, totalRecordedValueMinor),
    daily: [...days.values()],
  };
}

function makeSyntheticRecords() {
  let state = 7_202_606;
  const next = () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state;
  };
  const records = [];
  const start = dateMillis(SOURCE_RANGE.from, "Source start");
  const end = dateMillis(SOURCE_RANGE.to, "Source end");
  for (let ms = start; ms <= end; ms += DAY_MS) {
    const date = isoDate(ms);
    // Preserve the original June-August 2026 fixture when expanding history.
    if (date === "2026-06-01") state = 7_202_606;
    const count = 12 + (next() % 23);
    for (let item = 0; item < count; item += 1) {
      records.push(
        Object.freeze({
          id: `demo-${date}-${String(item + 1).padStart(3, "0")}`,
          date,
          valueMinor: 4_500 + (next() % 355_501),
        }),
      );
    }
  }
  return Object.freeze(records);
}

const SYNTHETIC_RECORDS = makeSyntheticRecords();

export function getSyntheticRecords() {
  return SYNTHETIC_RECORDS.map((record) => ({ ...record }));
}

export function getMeta() {
  return {
    currency: "ZAR",
    amountUnit: "minor",
    coverage: { ...SOURCE_RANGE },
    defaultRange: { ...DEFAULT_RANGE },
    maxRangeDays: MAX_RANGE_DAYS,
    metrics: METRICS.map((metric) => ({ ...metric })),
    synthetic: true,
    disclaimer:
      "Invented demonstration data for 28 September 2021–28 September 2026. Calendars: supplied 2024–2026; estimated 2021–2023 inferred from those calendars. Values and transactions do not represent a real retailer or client dataset.",
    semantics: {
      recordCount:
        "Number of supplied transaction records; not unique customers or store visits.",
      totalRecordedValue:
        "Sum of the recorded transaction values; treatment of tax, refunds and cancellations remains to be agreed.",
      averageRecordedValue:
        "Total recorded value divided by recorded transaction count, rounded to the nearest ZAR cent.",
      comparison:
        "The immediately preceding period with the same number of calendar days. Available only when both periods are fully covered.",
      missingCoverage:
        "Uncovered days are unknown, not zero. Partial totals include covered dates only.",
    },
  };
}

function percentChange(current, previous) {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10_000) / 100;
}

/** Summary adds a like-for-like preceding-period comparison to the aggregation. */
export function getSummary(
  options = {},
  records = SYNTHETIC_RECORDS,
  sourceCoverage = SOURCE_RANGE,
) {
  const current = aggregateRecords(records, {
    ...options,
    coverage: sourceCoverage,
  });
  const start = dateMillis(current.range.from, "Start date");
  const comparisonRange = {
    from: isoDate(start - current.range.days * DAY_MS),
    to: isoDate(start - DAY_MS),
    days: current.range.days,
  };
  const available =
    current.coverage.status === "full" &&
    comparisonRange.from >= sourceCoverage.from &&
    comparisonRange.to <= sourceCoverage.to;
  const previous = available
    ? aggregateRecords(records, {
        ...comparisonRange,
        coverage: sourceCoverage,
      }).totals
    : null;
  return {
    ...current,
    comparison: {
      range: comparisonRange,
      available,
      totals: previous,
      changes: previous
        ? {
            recordCountPercent: percentChange(
              current.totals.recordCount,
              previous.recordCount,
            ),
            totalRecordedValuePercent: percentChange(
              current.totals.totalRecordedValueMinor,
              previous.totalRecordedValueMinor,
            ),
            averageRecordedValuePercent: percentChange(
              current.totals.averageRecordedValueMinor,
              previous.averageRecordedValueMinor,
            ),
          }
        : null,
    },
  };
}

/** Detail series uses count or ZAR minor units, matching the selected metric. */
export function getDetails(
  options = {},
  records = SYNTHETIC_RECORDS,
  sourceCoverage = SOURCE_RANGE,
) {
  const metric = METRICS.find((candidate) => candidate.id === options.metric);
  if (!metric) throw new Error("Choose a supported metric.");
  const aggregate = aggregateRecords(records, {
    ...options,
    coverage: sourceCoverage,
  });
  const key = metric.id === "recordCount" ? metric.id : `${metric.id}Minor`;
  return {
    ...aggregate,
    metric: metric.id,
    label: metric.label,
    unit: metric.unit,
    series: aggregate.daily.map((day) => ({
      date: day.date,
      value: day[key],
      covered: day.covered,
    })),
  };
}
