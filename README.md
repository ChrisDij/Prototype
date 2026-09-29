# Shop-A-Lytics

Local Group 7 application, updated 29 September 2026 to follow the supplied MVP wireframes and user flow. Uses invented transactions, not actual student or retailer activity. See [implementation status and remaining work](REMAINING-WORK.md) for explicit data-dependent limitations.

Quality documentation: [test plan](TEST-PLAN.md) and [issue register](ISSUES.md).

## Run

Requires Node.js 22.13+ (tested with 24.2.0), React, Vite, Express, built-in SQLite and PDFKit.

```sh
npm ci
npm start
```

`npm start` builds the React interface with Vite and opens the production application at http://127.0.0.1:4317. `SHOPLYTICS_PORT` overrides the port. The server is intentionally local-only. An experimental SQLite warning is normal on some Node versions.

For frontend development, run `npm run dev:api` and `npm run dev` in separate terminals, then open http://127.0.0.1:5173. Vite proxies API requests to the local Express server.

First startup provisions manager and reporting accounts with random passwords in `.local/accounts.txt`. The database, credentials, sessions and feedback are private in `.local/` and must not be committed. Existing users automatically become owner/member users of Demo retailer without changing their credentials or transaction records. The migration supports populated legacy databases and repeated startups.

`npm run setup` initialises without starting the server. `npm test` runs isolated analytical, migration, permission, privacy, calendar and PDF tests. Integration tests need permission to bind a temporary localhost port.

## User flows

- Log in using an existing demo username or an account email. Create a business account to become its owner; the new business has no connected locations or data.
- Owners can add members on Team, generate temporary passwords, reset or reactivate member access, and remove access. Share temporary credentials privately; email is not sent. A member must change the temporary password before accessing data. Password minimum is 12 characters, retaining the existing stronger policy rather than the wireframe's placeholder 8.
- Owners receive a one-time local recovery code at registration and can replace it while signed in. Recovery replaces the password and revokes existing sessions without relying on email delivery.
- Owners can import a validated JSON dataset from Data setup. External student keys are pseudonymised before storage, locations and transactions are scoped to the business, and transaction ids are upserted idempotently.
- Both roles can view the dashboard, search their own locations, drill down month/week/day, switch line/bar charts, compare the preceding equal-length period visually, export a PDF and submit feedback. View state is retained in the URL and local browser storage.
- Owners see the alerts list and explanations and can manage their own team. Members cannot access these endpoints. Neither role can edit source transactions or view student identities.
- Export offers the current view or a dashboard summary for the selected dates. Filters, privacy suppression, estimated-calendar qualifications and synthetic-data disclosures apply to both.
- Feedback is stored with one of two categories (Insights or Usability) and the current screen. `/api/feedback` returns only the caller's submissions. No notification email is sent.

## Five-year history and calendars

The fixed demonstration window is 28 September 2021 through 28 September 2026, inclusive. **All 5 years** opens a monthly overview. Custom date fields and the year-qualified calendar-period menu support narrower selections. This is not a live feed.

The team-supplied 2024–2026 calendars are retained in `src/data/calendar-YYYY.json`, including source provenance. 2024 came from `IMG_8845.jpg` (Registrar, 20 June 2023), 2025 from `IMG_8844.jpg` (Registrar, 3 June 2024), and 2026 from the previously supplied calendar.

2021–2023 periods are explicitly estimated. The method anchors first term to February's second Monday, then uses median start/end offsets from the three supplied calendars. This approximates weekday patterns and durations, not verified historical schedules; pandemic disruptions are not reconstructed. No graduation, reopening or semester-end events are invented. Estimates remain labelled in filters, context and reports, and are excluded from anomaly baselines. Unlisted dates remain unclassified.

## Calculations, alerts and privacy

Date endpoints are inclusive. All money calculations use integer ZAR cents. Group averages are total value divided by transaction count, not averages of averages. Weeks start Monday; partial groups are labelled. Dates outside source coverage are unknown, not zero. Preceding-period comparisons require full coverage of both periods and privacy eligibility.

Server-side aggregates with fewer than **5 transactions** return null measures with `hidden: true`. An additional bucket is hidden when a partition has only one hidden bucket, limiting simple subtraction within that partition. Hidden values never enter chart values or PDF rows. This does not guarantee protection against arbitrary cross-query differencing and is not suitable for real student data without an agreed privacy model and review.

Count and average-value flags compare a location/day against up to eight prior matching weekdays with the same calendar-period and event context. At least four eligible baseline days, each with at least five transactions, are required. A flag must exceed both 50% deviation and two baseline standard deviations. The day under review is never in its own baseline. Missing/estimated context and insufficient eligible history result in no assessment, not a claim of normality. Flags remain in all aggregates and do not establish fraud or cause.

## Data-dependent limitations

The bundled demonstration data has null discounts, absent addresses/GPS and noon placeholder timestamps. Those views remain unavailable for the demonstration dataset. A validated import may explicitly declare reliable offset-bearing timestamps and discount amounts in ZAR cents; hourly detail and recorded discount measures then become available. Maps, discount alerts and hourly-concentration alerts remain unavailable. Email delivery and payment are not connected; account recovery uses a one-time local code instead. The tagline uses neutral BoschCard wording rather than asserting an unverified premium-service relationship.

## Import contract

Data setup accepts a version 1 JSON document of at most 10 MB and 50,000 transactions. Download the example from the application or use `src/importer.mjs` as the executable contract. Required declarations include an IANA time zone, inclusive coverage dates, locations, offset-bearing transaction timestamps, nonnegative integer `valueMinor` amounts and explicit source capabilities. `discountMinor` is accepted only when discount semantics are declared as `amountMinor`.

Imports are local and owner-only. They upsert locations and transactions by external id; they do not delete omitted records. The contract is a technical boundary, not confirmation that the client has approved field definitions, refresh frequency, retention or privacy policy.

## Folder structure

```text
src/             Application modules
  client/        React components and Vite HTML entry point
  public/        Shared interface styles
  data/          Bundled calendar files
test/            Automated tests
.local/          Private runtime data (unchanged, Git-ignored)
package.json     Commands and dependencies
vite.config.js   Vite build and development proxy
```

## Main files

| File | Responsibility |
| --- | --- |
| `src/database.mjs`, `src/setup.mjs` | ERD storage, synthetic seed, credentials and sessions |
| `src/accounts.mjs` | Business isolation, imports, team membership, reactivation and password setup |
| `src/importer.mjs` | Versioned transaction import validation and example contract |
| `src/permissions.mjs` | Owner/member capabilities |
| `src/analytics.mjs` | Deterministic fixture and analytical calculations |
| `src/calendar.mjs`, `src/presentation.mjs` | Calendar estimates/context and weighted grouping |
| `src/insights.mjs` | Tenant-scoped views, privacy suppression and explainable flags |
| `src/wireframe-report.mjs` | Current-view/dashboard PDFs |
| `src/report.mjs` | Retained legacy report generator and regression coverage |
| `src/server.mjs` | Express routes, Vite build serving, validation, authorisation and feedback |
| `src/client/src/main.jsx` | React pages, navigation, charts, forms, status states and dialogs |
| `src/public/styles.css`, `src/public/enhancements.css` | Shared interface styling bundled by Vite |
| `vite.config.js` | React build, output and local API proxy configuration |
| `test/*.test.mjs` | Calculation, migration, permission, privacy and export checks |

## Browser checks

1. Sign in as manager. Open a spend detail, then a week and day; inspect unavailable hourly timing and the table.
2. Choose a single location/day with fewer than five records to inspect the hidden state and return-to-week flow.
3. Open Search and filter location names, prices and dates. Open Team to inspect member access/status.
4. Inspect Alerts over historical supplied-calendar dates. Follow a flag into its daily detail.
5. Export both report scopes and verify privacy labels, filters and calendar notes.
6. Sign in as reporting: details and exports work; Team and Alerts are absent and server access is forbidden.
7. In an isolated test business, add a member and verify mandatory password setup. Never use real student information for testing.

Production deployment, an automated BoschCard connection, optional verified email recovery, final privacy policy and client acceptance are separate outstanding work. Anomaly thresholds remain explicitly provisional until approved by the client.
