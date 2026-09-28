# Shoplytics working prototype

Updated 28 September 2026. A local web application for Group 7, with five years of synthetic transaction data, stored accounts, 2021–2026 calendar context (2021–2023 estimated), charts, PDF reports and saved feedback. See [remaining work](REMAINING-WORK.md) for what is unfinished or requires approval.

## Five-year history and calendars

Sample records cover **28 September 2021 through 28 September 2026**, inclusive. This is a fixed, reproducible demonstration window, not a live feed. Choose **Last 5 years** for a monthly overview, **Sample year** for an individual year, or enter custom dates. The 2021 and 2026 year selections cover only the available portions of those years. Chart figures and PDF exports use the selected range.

The University period menu includes the supplied 2024, 2025 and 2026 calendars, with year-qualified names. Calendar dates add context; they do not supply actual transaction records or prove causes of spending changes. 2021–2023 periods are explicitly estimated from the three supplied calendars. The method anchors first term to February's second Monday (common to all three sources), then uses the median start/end offsets from that anchor for each term, recess and assessment period. This preserves typical weekdays and approximate durations, not actual historical schedules. Pandemic disruptions and year-specific changes are not reconstructed. No graduation, reopening or semester-end events are invented. Estimates are labelled in filters, dashboard context and PDF reports; gaps remain unclassified. Estimated periods carry `estimated: true` and `eligibleForAnomalyBaseline: false` so future anomaly detection can exclude them as reliable calendar baselines.

On the next startup, the original version-1 synthetic database is extended automatically. Existing June–August 2026 transactions, passwords, sessions and feedback are retained. New installations receive the complete five-year fixture. The migration is transactional and runs once.

Calendar sources: 2024 was transcribed from team-supplied `IMG_8845.jpg` (Registrar, 20 June 2023); 2025 from `IMG_8844.jpg` (Registrar, 3 June 2024). The previously supplied 2026 calendar is retained. Structured dates and provenance are bundled in `data/calendar-2024.json`, `data/calendar-2025.json` and `data/calendar-2026.json`.

## Start the application

Requires Node.js 22.13 or newer; tested with Node 24.2.0. Uses built-in SQLite and PDFKit. Node may display an experimental SQLite warning.

From this folder:

```sh
npm ci
npm start
```

Open http://127.0.0.1:4317. The server binds only to the local computer. `SHOPLYTICS_PORT` can select a different port.

First startup creates `.local/shoplytics.sqlite`, loads synthetic data and provisions two accounts with randomly generated passwords. Open `.local/accounts.txt` to get the manager and reporting credentials. Subsequent starts preserve accounts, data, sessions and feedback. Do not commit or share `.local`; it is ignored by Git. Application routes do not serve that directory.

`npm run setup` performs the same initialisation without starting the server. `npm test` runs analytical, persistence, account, permission, calendar and export checks. Test databases are isolated temporary files.

## What is implemented

- Username/password login using provisioned accounts, salted scrypt password hashes, one-hour sessions, logout and a five-failed-attempts-per-15-minutes account limit.
- Persistent SQLite storage for source data, application users, hashed session tokens, feedback and basic audit events.
- Primary and reporting access rules in `permissions.mjs`, enforced by the server.
- Summary counts, total recorded values, weighted average values and preceding-period comparisons.
- Date filtering; daily, Monday-based weekly and calendar-month grouping; line and column charts; accessible value tables; metric drill-down for primary users.
- The supplied 2024–2026 university calendars, with selectable periods, overlapping event annotations and explicit unclassified dates.
- Downloadable graphical PDF reports reflecting the applied dates, grouping, chart and permitted metric. Reports include summary values, coverage and calendar context.
- Feedback submission and the signed-in user's own feedback history, saved across restarts. Feedback is not emailed; a team-wide review workflow remains pending.
- Missing-coverage and empty-data states, synthetic-data labels and responsive layouts.

## Proposed role boundaries

| Capability | Primary account | Reporting account |
| --- | --- | --- |
| Summary figures and transaction-activity chart/table | Yes | Yes |
| Date/calendar selection and chart/grouping options | Yes | Yes |
| Daily/grouped spending and average-value detail | Yes | No |
| PDF export | Any permitted metric | Summary figures plus transaction activity |
| Submit feedback and see own submissions | Yes | Yes |
| View another user's feedback or edit shared source data | No | No |

These are implementation proposals awaiting client/lecturer confirmation. Client access to all dashboard features does not grant internal administration or unrestricted source data. Reporting responses omit detailed daily/grouped monetary values rather than merely hiding their controls.

## Data model and assumptions

SQLite implements the prescribed `Student`, `Vendor_Type`, `Vendor` and `Transaction` entities with their named fields, primary keys and foreign keys. Dates/timestamps use ISO text. The ERD's GPS point is represented as a nullable text field pending confirmation of the supplied point encoding. `value` and `discount` are numeric fields; calculations convert the seeded currency values to integer cents.

The seed creates invented student identifiers with personal fields left null, four visibly synthetic vendors, one placeholder vendor type and transactions across the five-year sample window. No real student information is present. Discount and vendor location fields remain null; no official category list or discount interpretation is invented. The seed's `value` means recorded monetary amount only, not a confirmed before/after-discount amount.

Application users are separate from source students and vendors. Additional tables hold dataset coverage, accounts, sessions, feedback, login attempts and audit events. The schema is in `database.mjs`.

Current ingestion is a synthetic seed, not an importer for arbitrary official files. Dataset coverage is stored explicitly; it is not inferred from a lack of transactions. Timestamp handling in the fixture is UTC. Agree the actual source time zone before import. Calendar data is bundled in `data/calendar-YYYY.json` for reproducible setup. 2021–2023 use labelled estimates; other unsupported years remain unclassified.

## Calculation and report behaviour

Date selections include both endpoints. Presets end at the latest sample date. Missing coverage is unknown, not zero. A weekly/monthly value includes only selected and covered days; partial buckets are labelled in the chart table and explained in reports. A grouped average is total value divided by transaction count, not an unweighted average of daily averages.

The preceding comparison uses the same number of days and is available only if both periods are fully covered. Reports reflect selected values and charts; preceding-period percentage changes are not currently included in the PDF layout. Calendar annotations do not establish that university events caused changes in spending.

## Useful checks in the browser

1. Sign in with the manager account, choose Last 5 years and switch Chart to Columns. Select an individual sample year or university period to explore further.
2. Choose Mid-year recess and inspect the dates, calendar context and grouped figures.
3. Open an average-value detail and download its PDF.
4. Choose dates outside sample coverage and check that missing data is not shown as a genuine zero.
5. Submit a clearly marked test feedback message; sign out and back in to see it preserved.
6. Sign in as reporting and verify that only permitted summary/transaction views and reports are available.

## Application files

| File | Responsibility |
| --- | --- |
| `database.mjs` / `setup.mjs` | ERD storage, initial seed and provisioned accounts |
| `permissions.mjs` | Configurable proposed role capabilities |
| `analytics.mjs` | Fixture generator and analytical calculations |
| `presentation.mjs` | Weighted grouping and calendar context |
| `report.mjs` | Server-side PDF generation |
| `server.mjs` | Routes, sessions, authorisation and feedback |
| `public/app.js` / `public/styles.css` | Interface and chart rendering |
| `*.test.mjs` | Automated verification |

This remains a local prototype. Password reset, account administration, deployment with HTTPS, backup/recovery, production security review and final confidentiality rules remain outstanding. Basic audit events record login, logout, report export and feedback submission; they are not a complete audit-management system.
