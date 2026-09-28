import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/database.mjs";
import { importExample, validateImport } from "../src/importer.mjs";
import { buildInsights } from "../src/insights.mjs";

const password = "test-private-password-123";
const clone = (value) => JSON.parse(JSON.stringify(value));

test("import contract validates explicit capabilities and rejects unsafe rows", () => {
  const valid = validateImport(clone(importExample));
  assert.equal(valid.transactions[0].valueMinor, 12500);
  assert.equal(valid.capabilities.hourlyTimestamps, true);
  const duplicate = clone(importExample);
  duplicate.transactions.push(clone(duplicate.transactions[0]));
  assert.throws(() => validateImport(duplicate), /duplicated/);
  const missingOffset = clone(importExample);
  missingOffset.transactions[0].datetime = "2026-09-01T12:30:00";
  assert.throws(() => validateImport(missingOffset), /UTC offset/);
  const badDiscount = clone(importExample);
  badDiscount.transactions[0].discountMinor = 20000;
  assert.throws(() => validateImport(badDiscount), /discountMinor/);
});

test("owner imports are scoped, pseudonymised and idempotently updated", () => {
  const store = openDatabase();
  try {
    const username = store.register({
      business: "Imported business",
      name: "Owner",
      email: "import-owner@example.test",
      password,
    });
    const owner = store.authenticate(username, password),
      dataset = clone(importExample);
    dataset.transactions = Array.from({ length: 5 }, (_, index) => ({
      ...dataset.transactions[0],
      id: `txn-${index + 1}`,
      studentKey: `student-${index + 1}`,
    }));
    const first = store.importDataset(owner, dataset);
    assert.deepEqual(first, { locations: 1, transactions: 5 });
    assert.equal(store.locations(owner)[0].name, "Example shop");
    assert.equal(store.scopedRecords(owner)[0].discountMinor, 500);
    assert.equal(store.dataStatus(owner).hourlyTimestamps, true);
    assert.deepEqual(store.coverage(owner), importExample.coverage);
    const storedStudent = store.db
      .prepare(
        'SELECT student_id FROM "Transaction" t JOIN BusinessVendor b ON b.vendor_id=t.vendor_id WHERE b.business_id=?',
      )
      .get(owner.businessId).student_id;
    assert.notEqual(storedStudent, "pseudonymous-student-key");
    const view = buildInsights(store, owner, {
      from: "2026-09-01",
      to: "2026-09-01",
      metric: "totalRecordedValue",
      grouping: "daily",
    });
    assert.equal(view.hourlyAvailable, true);
    assert.equal(view.discountAvailable, true);
    assert.equal(view.discounts.totalDiscountMinor, 2500);
    assert.equal(
      view.hourly.find((hour) => hour.label === "12:00").recordCount,
      5,
    );
    const changed = clone(dataset);
    changed.transactions[0].valueMinor = 13000;
    store.importDataset(owner, changed);
    assert.equal(store.scopedRecords(owner).length, 5);
    assert.equal(store.scopedRecords(owner)[0].valueMinor, 13000);
  } finally {
    store.close();
  }
});
