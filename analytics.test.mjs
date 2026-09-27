import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateRecords, getDetails, getMeta, getSummary, validateRange } from './analytics.mjs';

const fixture = [
  { date: '2026-06-01', valueMinor: 100 },
  { date: '2026-06-01', valueMinor: 301 },
  { date: '2026-06-03', valueMinor: 0 },
  { date: '2026-06-04', valueMinor: 999 },
];

test('hand-calculated fixture includes both boundary dates and covered empty days', () => {
  const result = aggregateRecords(fixture, { from: '2026-06-01', to: '2026-06-03' });
  assert.deepEqual(result.totals, {
    recordCount: 3, totalRecordedValueMinor: 401, averageRecordedValueMinor: 134,
  });
  assert.deepEqual(result.daily, [
    { date: '2026-06-01', recordCount: 2, totalRecordedValueMinor: 401, averageRecordedValueMinor: 201, covered: true },
    { date: '2026-06-02', recordCount: 0, totalRecordedValueMinor: 0, averageRecordedValueMinor: null, covered: true },
    { date: '2026-06-03', recordCount: 1, totalRecordedValueMinor: 0, averageRecordedValueMinor: 0, covered: true },
  ]);
});

test('single-day range is inclusive and pure aggregation leaves inputs unchanged', () => {
  const records = structuredClone(fixture);
  const before = structuredClone(records);
  const result = aggregateRecords(records, { from: '2026-06-01', to: '2026-06-01' });
  assert.equal(result.range.days, 1);
  assert.equal(result.totals.recordCount, 2);
  assert.deepEqual(records, before);
});

test('empty covered source has zero observations and no average', () => {
  const result = aggregateRecords([], { from: '2026-06-01', to: '2026-06-01' });
  assert.deepEqual(result.totals, { recordCount: 0, totalRecordedValueMinor: 0, averageRecordedValueMinor: null });
  assert.equal(result.coverage.status, 'full');
});

test('partial source coverage preserves unknown days and excludes uncovered records', () => {
  const result = aggregateRecords(fixture, {
    from: '2026-05-31', to: '2026-06-04',
    coverage: { from: '2026-06-01', to: '2026-06-03' },
  });
  assert.deepEqual(result.coverage, { status: 'partial', from: '2026-06-01', to: '2026-06-03' });
  assert.equal(result.totals.totalRecordedValueMinor, 401);
  for (const index of [0, 4]) {
    assert.equal(result.daily[index].covered, false);
    assert.equal(result.daily[index].recordCount, null);
    assert.equal(result.daily[index].totalRecordedValueMinor, null);
  }
});

test('date validation rejects malformed, impossible, reversed and oversized ranges', () => {
  for (const from of ['2026-2-01', '2026-02-29', '2026-06-31', '2026-06-01T00:00:00Z', null]) {
    assert.throws(() => validateRange({ from, to: '2026-08-31' }));
  }
  assert.throws(() => validateRange({ from: '2026-06-02', to: '2026-06-01' }), /on or before/);
  assert.throws(() => validateRange({ from: '2020-01-01', to: '2026-01-01' }), /at most/);
  assert.equal(validateRange({ from: '2024-02-28', to: '2024-03-01' }).days, 3);
  assert.equal(validateRange({ from: '2026-03-28', to: '2026-03-30' }).days, 3);
  assert.equal(validateRange({ from: '2026-01-01', to: '2030-12-31' }).days, 1826);
});

test('invalid monetary source records fail rather than silently changing totals', () => {
  for (const valueMinor of [-1, 1.5, '100', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => aggregateRecords([{ date: '2026-06-01', valueMinor }], { from: '2026-06-01', to: '2026-06-01' }), /safe integers/);
  }
  assert.throws(() => aggregateRecords([{ date: '2026-02-30', valueMinor: 100 }], { from: '2026-06-01', to: '2026-06-01' }), /calendar date/);
  assert.throws(() => aggregateRecords([
    { date: '2026-06-01', valueMinor: Number.MAX_SAFE_INTEGER },
    { date: '2026-06-01', valueMinor: 1 },
  ], { from: '2026-06-01', to: '2026-06-01' }), /numeric range/);
});

test('August comparison uses the immediately preceding 31 days, not a calendar-month shortcut', () => {
  const result = getSummary({ from: '2026-08-01', to: '2026-08-31' });
  assert.equal(result.comparison.available, true);
  assert.deepEqual(result.comparison.range, { from: '2026-07-01', to: '2026-07-31', days: 31 });
  const previous = getSummary({ from: '2026-07-01', to: '2026-07-31' });
  assert.deepEqual(result.comparison.totals, previous.totals);
  const uneven = getSummary({ from: '2026-07-01', to: '2026-07-15' });
  assert.deepEqual(uneven.comparison.range, { from: '2026-06-16', to: '2026-06-30', days: 15 });
});

test('baseline is unavailable when even one comparison day is missing', () => {
  for (const range of [
    { from: '2026-06-01', to: '2026-06-30' },
    { from: '2026-07-01', to: '2026-07-31' },
    { from: '2026-05-31', to: '2026-06-01' },
  ]) {
    const result = getSummary(range);
    assert.equal(result.comparison.available, false);
    assert.equal(result.comparison.totals, null);
    assert.equal(result.comparison.changes, null);
  }
});

test('future valid range returns uncovered empty series and no comparison', () => {
  const result = getSummary({ from: '2027-01-01', to: '2027-01-03' });
  assert.deepEqual(result.coverage, { status: 'none', from: null, to: null });
  assert.equal(result.daily.length, 3);
  assert.equal(result.totals.recordCount, 0);
  assert.equal(result.comparison.available, false);
  assert.ok(result.daily.every(day => day.covered === false && day.recordCount === null));
});

test('synthetic source is deterministic and summary totals reconcile with daily details', () => {
  const range = { from: '2026-06-01', to: '2026-08-31' };
  const result = getSummary(range);
  assert.deepEqual(getSummary(range), result);
  assert.equal(result.daily.length, 92);
  assert.equal(result.totals.recordCount, result.daily.reduce((sum, day) => sum + day.recordCount, 0));
  assert.equal(result.totals.totalRecordedValueMinor, result.daily.reduce((sum, day) => sum + day.totalRecordedValueMinor, 0));
  assert.equal(result.totals.averageRecordedValueMinor, Math.round(result.totals.totalRecordedValueMinor / result.totals.recordCount));
  for (const metric of getMeta().metrics) {
    const details = getDetails({ ...range, metric: metric.id });
    assert.deepEqual(details.totals, result.totals);
    assert.equal(details.series.length, 92);
    const key = metric.id === 'recordCount' ? 'recordCount' : `${metric.id}Minor`;
    assert.deepEqual(details.series.map(point => point.value), result.daily.map(day => day[key]));
  }
  assert.throws(() => getDetails({ ...range, metric: 'footTraffic' }), /supported metric/);
});

test('metadata callers cannot mutate the source coverage or metric contract', () => {
  const meta = getMeta();
  meta.coverage.from = '2020-01-01';
  meta.metrics[0].id = 'footTraffic';
  assert.equal(getMeta().coverage.from, '2026-06-01');
  assert.equal(getMeta().metrics[0].id, 'recordCount');
  assert.equal(getMeta().synthetic, true);
});
