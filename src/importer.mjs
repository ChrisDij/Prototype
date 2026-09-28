const fail = (message) => {
  throw Error(message);
};
const text = (value, label, maximum = 160) => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maximum
  )
    fail(`${label} must contain 1–${maximum} characters.`);
  return value.trim();
};
const date = (value, label) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    fail(`${label} must be a real date in YYYY-MM-DD format.`);
  return value;
};
export function validateImport(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    fail("Import must be a JSON object.");
  if (payload.version !== 1) fail("Import version must be 1.");
  const timezone = text(payload.timezone, "Time zone", 80);
  if (!/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(timezone))
    fail("Use an IANA time zone such as Africa/Johannesburg.");
  const coverage = {
    from: date(payload.coverage?.from, "Coverage start"),
    to: date(payload.coverage?.to, "Coverage end"),
  };
  if (coverage.from > coverage.to)
    fail("Coverage start must be on or before coverage end.");
  if (!Array.isArray(payload.locations) || !payload.locations.length)
    fail("Include at least one location.");
  if (payload.locations.length > 500)
    fail("At most 500 locations are allowed.");
  const ids = new Set(),
    locations = payload.locations.map((location, index) => {
      const id = text(location?.id, `Location ${index + 1} id`, 120);
      if (ids.has(id)) fail(`Location id ${id} is duplicated.`);
      ids.add(id);
      return {
        id,
        name: text(location.name, `Location ${index + 1} name`, 160),
        address:
          location.address == null || location.address === ""
            ? null
            : text(location.address, `Location ${index + 1} address`, 300),
      };
    });
  if (!Array.isArray(payload.transactions))
    fail("Transactions must be an array.");
  if (payload.transactions.length > 50_000)
    fail("A single import may contain at most 50,000 transactions.");
  const transactionIds = new Set(),
    transactions = payload.transactions.map((row, index) => {
      const item = index + 1,
        externalId = text(row?.id, `Transaction ${item} id`, 160),
        studentKey = text(
          row?.studentKey,
          `Transaction ${item} student key`,
          200,
        ),
        locationId = text(
          row?.locationId,
          `Transaction ${item} location id`,
          120,
        );
      if (transactionIds.has(externalId))
        fail(`Transaction id ${externalId} is duplicated.`);
      transactionIds.add(externalId);
      if (!ids.has(locationId))
        fail(`Transaction ${item} refers to an unknown location.`);
      if (
        typeof row.datetime !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
          row.datetime,
        ) ||
        !Number.isFinite(Date.parse(row.datetime))
      )
        fail(`Transaction ${item} datetime must include a UTC offset.`);
      const localDate = row.datetime.slice(0, 10);
      if (localDate < coverage.from || localDate > coverage.to)
        fail(`Transaction ${item} falls outside the declared coverage.`);
      if (!Number.isSafeInteger(row.valueMinor) || row.valueMinor < 0)
        fail(`Transaction ${item} valueMinor must be nonnegative ZAR cents.`);
      if (
        row.discountMinor != null &&
        (!Number.isSafeInteger(row.discountMinor) ||
          row.discountMinor < 0 ||
          row.discountMinor > row.valueMinor)
      )
        fail(
          `Transaction ${item} discountMinor must be null or nonnegative ZAR cents no greater than valueMinor.`,
        );
      return {
        id: externalId,
        studentKey,
        locationId,
        datetime: row.datetime,
        valueMinor: row.valueMinor,
        discountMinor: row.discountMinor ?? null,
      };
    });
  const hourlyTimestamps = payload.capabilities?.hourlyTimestamps === true,
    discountSemantics =
      payload.capabilities?.discountSemantics === "amountMinor"
        ? "amountMinor"
        : "unavailable";
  if (
    discountSemantics === "amountMinor" &&
    transactions.some((row) => row.discountMinor == null)
  )
    fail(
      "Every transaction needs discountMinor when discount semantics are amountMinor.",
    );
  return {
    version: 1,
    timezone,
    coverage,
    capabilities: { hourlyTimestamps, discountSemantics },
    locations,
    transactions,
  };
}

export const importExample = {
  version: 1,
  timezone: "Africa/Johannesburg",
  coverage: { from: "2026-09-01", to: "2026-09-30" },
  capabilities: {
    hourlyTimestamps: true,
    discountSemantics: "amountMinor",
  },
  locations: [
    { id: "shop-1", name: "Example shop", address: "Example address" },
  ],
  transactions: [
    {
      id: "txn-1",
      studentKey: "pseudonymous-student-key",
      locationId: "shop-1",
      datetime: "2026-09-01T12:30:00+02:00",
      valueMinor: 12500,
      discountMinor: 500,
    },
  ],
};
