import { getSummary, validateRange } from "./analytics.mjs";
import { presentation, calendarContext, calendar } from "./presentation.mjs";
export const privacyMinimum = 5;
const day = 86400000,
  iso = (n) => new Date(n).toISOString().slice(0, 10);
const priceBandLabels = {
  under50: "Under R50",
  "50to150": "R50–150",
  "150to300": "R150–300",
  "300plus": "R300+",
};
export function protect(row) {
  const hidden = row.recordCount != null && row.recordCount < privacyMinimum;
  if (!hidden) return { ...row, hidden: false };
  return {
    ...row,
    hidden: true,
    recordCount: null,
    totalRecordedValueMinor: null,
    averageRecordedValueMinor: null,
    totalDiscountMinor: null,
    averageDiscountMinor: null,
    value: null,
  };
}
// Suppress a second bucket when a partition total would reveal its only hidden bucket.
export function partition(rows) {
  const safe = rows.map(protect);
  if (safe.filter((r) => r.hidden).length === 1 && safe.length > 1) {
    const index = safe.findIndex((r) => !r.hidden && r.recordCount != null);
    if (index >= 0)
      safe[index] = {
        ...safe[index],
        hidden: true,
        recordCount: null,
        totalRecordedValueMinor: null,
        averageRecordedValueMinor: null,
        totalDiscountMinor: null,
        averageDiscountMinor: null,
        value: null,
      };
  }
  return safe;
}
const total = (records) => {
  const value = records.reduce((s, r) => s + r.valueMinor, 0);
  return {
    recordCount: records.length,
    totalRecordedValueMinor: value,
    averageRecordedValueMinor: records.length
      ? Math.round(value / records.length)
      : null,
  };
};
function context(date) {
  if (date < "2024-01-01" || date > "2026-12-31") return null;
  const periods = calendar.periods.filter(
    (p) => p.start <= date && p.end >= date && !p.estimated,
  );
  if (!periods.length) return null;
  return (
    periods
      .map((p) => p.id.replace(/^\d{4}-/, "").replace(/-\d+$/, ""))
      .sort()
      .join("|") +
    "|" +
    calendar.events
      .filter((e) => e.start <= date && e.end >= date)
      .map((e) => e.id.replace(/^\d{4}-/, ""))
      .sort()
      .join("|")
  );
}
export function assessCounts(records, range, locations, coverage) {
  const counts = new Map(),
    amounts = new Map();
  for (const r of records) {
    const key = `${r.locationId}:${r.date}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    amounts.set(key, (amounts.get(key) || 0) + r.valueMinor);
  }
  const alerts = [];
  let assessed = 0,
    notAssessed = 0;
  for (const location of locations)
    for (
      let ms = Date.parse(range.from);
      ms <= Date.parse(range.to);
      ms += day
    ) {
      const date = iso(ms),
        current = counts.get(`${location.id}:${date}`) || 0,
        key = context(date);
      if (
        current < privacyMinimum ||
        !key ||
        date < coverage.from ||
        date > coverage.to
      ) {
        notAssessed++;
        continue;
      }
      const history = [];
      for (let week = 8; week >= 1; week--) {
        const prior = iso(ms - week * 7 * day);
        if (prior >= coverage.from && context(prior) === key) {
          const count = counts.get(`${location.id}:${prior}`) || 0;
          if (count >= privacyMinimum)
            history.push({ date: prior, value: count });
        }
      }
      if (history.length < 4) {
        notAssessed++;
        continue;
      }
      assessed++;
      const mean = history.reduce((s, r) => s + r.value, 0) / history.length;
      const variation = Math.sqrt(
        history.reduce((s, r) => s + (r.value - mean) ** 2, 0) / history.length,
      );
      const shared = {
        date,
        locationId: location.id,
        location: location.name,
        context: calendarContext({ from: date, to: date })
          .periods.map((p) => p.label)
          .join(", "),
      };
      if (Math.abs(current - mean) > Math.max(mean * 0.5, variation * 2))
        alerts.push({
          ...shared,
          id: `${location.id}-${date}`,
          metric: "recordCount",
          title: `Card transactions much ${current > mean ? "higher" : "lower"} than usual`,
          value: current,
          mean,
          variation,
          ratio: current / mean,
          history,
        });
      const value = Math.round(amounts.get(`${location.id}:${date}`) / current);
      const averageHistory = history.map((h) => ({
        date: h.date,
        value: Math.round(amounts.get(`${location.id}:${h.date}`) / h.value),
      }));
      const averageMean =
        averageHistory.reduce((sum, h) => sum + h.value, 0) /
        averageHistory.length;
      const averageVariation = Math.sqrt(
        averageHistory.reduce(
          (sum, h) => sum + (h.value - averageMean) ** 2,
          0,
        ) / averageHistory.length,
      );
      if (
        averageMean > 0 &&
        Math.abs(value - averageMean) >
          Math.max(averageMean * 0.5, averageVariation * 2)
      )
        alerts.push({
          ...shared,
          id: `${location.id}-${date}-average`,
          metric: "averageRecordedValue",
          title: `Average transaction unusually ${value > averageMean ? "high" : "low"}`,
          value,
          mean: averageMean,
          variation: averageVariation,
          ratio: value / averageMean,
          history: averageHistory,
        });
    }
  return {
    items: alerts.sort(
      (a, b) => b.date.localeCompare(a.date) || a.locationId - b.locationId,
    ),
    assessed,
    notAssessed,
    rule: "Counts or daily average values differ by more than 50% and two standard deviations from at least 4 eligible matching weekdays in the prior 8 weeks. Same location and calendar context; the day under review is excluded. Estimated calendars are not eligible. Small baseline counts are excluded.",
    thresholdStatus:
      "Provisional recommendation — client approval is required before production use.",
    note: "Not assessed — insufficient history applies where fewer than 4 eligible observations are available. Flags are not proof of fraud or causation. Flagged records remain in aggregates.",
  };
}
export function buildInsights(store, user, q) {
  validateRange(q);
  const locations = store.locations(user),
    coverage = store.coverage(user),
    dataStatus = store.dataStatus(user);
  if (q.location && !locations.some((l) => String(l.id) === q.location)) {
    const e = Error("Location not found.");
    e.status = 404;
    throw e;
  }
  if (q.band && !["under50", "50to150", "150to300", "300plus"].includes(q.band))
    throw Error("Choose a valid price band.");
  if (q.chart && !["line", "column"].includes(q.chart))
    throw Error("Choose a line or column chart.");
  const matchesBand = (r) =>
    !q.band ||
    (q.band === "under50"
      ? r.valueMinor < 5000
      : q.band === "50to150"
        ? r.valueMinor >= 5000 && r.valueMinor < 15000
        : q.band === "150to300"
          ? r.valueMinor >= 15000 && r.valueMinor < 30000
          : r.valueMinor >= 30000);
  const all = store
    .scopedRecords(user)
    .filter(
      (r) =>
        (!q.location || String(r.locationId) === q.location) && matchesBand(r),
    );
  const summary = getSummary(q, all, coverage),
    view = presentation(
      summary,
      q.grouping || "daily",
      q.metric || "totalRecordedValue",
    );
  const selected = all.filter((r) => r.date >= q.from && r.date <= q.to);
  view.totals =
    summary.coverage.status === "none"
      ? {
          recordCount: null,
          totalRecordedValueMinor: null,
          averageRecordedValueMinor: null,
          hidden: false,
        }
      : protect(view.totals);
  view.daily = partition(view.daily);
  view.series = partition(view.series);
  const discountAvailable =
    dataStatus.discountSemantics === "amountMinor" &&
    selected.every((record) => record.discountMinor != null);
  if (discountAvailable) {
    const totalDiscountMinor = selected.reduce(
      (sum, record) => sum + record.discountMinor,
      0,
    );
    view.discounts = {
      totalDiscountMinor: view.totals.hidden ? null : totalDiscountMinor,
      averageDiscountMinor:
        view.totals.hidden || !selected.length
          ? null
          : Math.round(totalDiscountMinor / selected.length),
    };
    view.series = view.series.map((row) => {
      if (row.hidden)
        return {
          ...row,
          totalDiscountMinor: null,
          averageDiscountMinor: null,
        };
      const records = selected.filter(
          (record) => record.date >= row.from && record.date <= row.to,
        ),
        totalDiscountMinor = records.reduce(
          (sum, record) => sum + record.discountMinor,
          0,
        );
      return {
        ...row,
        totalDiscountMinor,
        averageDiscountMinor: records.length
          ? Math.round(totalDiscountMinor / records.length)
          : null,
      };
    });
  }
  if (view.comparison.totals) {
    view.comparison.totals = protect(view.comparison.totals);
    if (view.totals.hidden || view.comparison.totals.hidden) {
      view.comparison.changes = null;
      view.comparison.available = false;
    }
  }
  view.locations = partition(
    locations
      .filter((l) => !q.location || String(l.id) === q.location)
      .map((l) => ({
        ...l,
        ...total(selected.filter((r) => r.locationId === l.id)),
      })),
  );
  view.priceBands = partition(
    [
      ["Under R50", 0, 5000],
      ["R50–150", 5000, 15000],
      ["R150–300", 15000, 30000],
      ["R300+", 30000, Infinity],
    ].map(([label, min, max]) => ({
      label,
      ...total(
        selected.filter((r) => r.valueMinor >= min && r.valueMinor < max),
      ),
    })),
  );
  view.weekdays = partition(
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => ({
      label,
      ...total(
        selected.filter((r) => (new Date(r.date).getUTCDay() + 6) % 7 === i),
      ),
    })),
  );
  view.privacyMinimum = privacyMinimum;
  view.business = user.businessName;
  view.location = q.location
    ? locations.find((l) => String(l.id) === q.location).name
    : "All locations";
  view.priceBand = q.band ? priceBandLabels[q.band] : null;
  view.discountAvailable = discountAvailable;
  view.hourlyAvailable =
    dataStatus.hourlyTimestamps && q.from === q.to && selected.length > 0;
  if (view.hourlyAvailable) {
    const hours = Array.from({ length: 24 }, (_, hour) => {
      const records = selected.filter(
          (record) => Number(record.datetime.slice(11, 13)) === hour,
        ),
        values = total(records),
        totalDiscountMinor = discountAvailable
          ? records.reduce((sum, record) => sum + record.discountMinor, 0)
          : null,
        label = `${String(hour).padStart(2, "0")}:00`;
      return {
        label,
        from: q.from,
        to: q.to,
        ...values,
        totalDiscountMinor,
        averageDiscountMinor:
          discountAvailable && records.length
            ? Math.round(totalDiscountMinor / records.length)
            : null,
        value:
          view.metric === "recordCount"
            ? values.recordCount
            : values[`${view.metric}Minor`],
      };
    });
    view.hourly = partition(hours);
  }
  view.sourceCapabilities = {
    hourlyTimestamps: dataStatus.hourlyTimestamps,
    discountSemantics: dataStatus.discountSemantics,
  };
  view.dataNote = dataStatus.updatedAt
    ? `Imported business data. Source time zone: ${dataStatus.timezone}. ${dataStatus.hourlyTimestamps ? "Reliable hourly timestamps were declared." : "Reliable hourly timestamps were not declared."} ${discountAvailable ? "Discounts are interpreted as amounts in ZAR cents." : "Discount semantics were not supplied."}`
    : "Invented demonstration transactions. Discount values and reliable hourly timestamps were not supplied; those measures are unavailable. Newly registered businesses have no connected locations or data.";
  // The alerts list and reasons are owner-only; aggregate chart markers are shared.
  const alerts = assessCounts(
    all,
    view.range,
    locations.filter((l) => !q.location || String(l.id) === q.location),
    coverage,
  );
  alerts.items = alerts.items.filter(
    (a) =>
      !view.daily.find((d) => d.date === a.date)?.hidden &&
      !view.locations.find((l) => l.id === a.locationId)?.hidden,
  );
  view.series = view.series.map((row) => ({
    ...row,
    unusual:
      !row.hidden &&
      alerts.items.some((a) => a.date >= row.from && a.date <= row.to),
  }));
  if (user.canViewAlerts) view.alerts = alerts;
  return view;
}
