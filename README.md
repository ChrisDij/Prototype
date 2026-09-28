# Shop-A-Lytics

Local Group 7 application, updated 28 September 2026 to follow the supplied MVP wireframes and user flow. Uses invented transactions, not actual student or retailer activity. See [implementation status and remaining work](REMAINING-WORK.md) for explicit data-dependent limitations.

## Run

Requires Node.js 22.13+ (tested with 24.2.0), built-in SQLite and PDFKit.

```sh
npm ci
npm start
```

Open http://127.0.0.1:4317. `SHOPLYTICS_PORT` overrides the port. The server is intentionally local-only. An experimental SQLite warning is normal on some Node versions.

First startup provisions manager and reporting accounts with random passwords in `.local/accounts.txt`. The database, credentials, sessions and feedback are private in `.local/` and must not be committed. Existing users automatically become owner/member users of Demo retailer without changing their credentials or transaction records. The migration supports populated legacy databases and repeated startups.

`npm run setup` initialises without starting the server. `npm test` runs isolated analytical, migration, permission, privacy, calendar and PDF tests. Integration tests need permission to bind a temporary localhost port.

## User flows

- Log in using an existing demo username or an account email. Create a business account to become its owner; the new business has no connected locations or data.
- Owners can add members on Team, generate temporary passwords, and remove member access. Share temporary credentials privately; email is not sent. A member must change the temporary password before accessing data. Password minimum is 12 characters, retaining the existing stronger policy rather than the wireframe's placeholder 8.
- Both roles can view the dashboard, search their own locations, drill down month/week/day, switch line/bar charts, compare the preceding equal-length period, export a PDF and submit feedback.
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

Discounts are null, addresses/GPS are absent, and seeded timestamps are noon placeholders. Discount measures, maps, hourly charts and discount/hourly-concentration alerts explicitly say unavailable. They are not fabricated. Account recovery email and payment are not connected. The tagline uses neutral BoschCard wording rather than asserting an unverified premium-service relationship.

## Folder structure

```text
src/             Application modules
  public/        Browser JavaScript, styles and HTML
  data/          Bundled calendar files
test/            Automated tests
.local/          Private runtime data (unchanged, Git-ignored)
package.json     Commands and dependencies
```

## Main files

| File | Responsibility |
| --- | --- |
| `src/database.mjs`, `src/setup.mjs` | ERD storage, synthetic seed, credentials and sessions |
| `src/accounts.mjs` | Business isolation, legacy migration, team membership and first-login password setup |
| `src/permissions.mjs` | Owner/member capabilities |
| `src/analytics.mjs` | Deterministic fixture and analytical calculations |
| `src/calendar.mjs`, `src/presentation.mjs` | Calendar estimates/context and weighted grouping |
| `src/insights.mjs` | Tenant-scoped views, privacy suppression and explainable flags |
| `src/wireframe-report.mjs` | Current-view/dashboard PDFs |
| `src/report.mjs` | Retained legacy report generator and regression coverage |
| `src/server.mjs` | Local routes, validation, authorisation and feedback |
| `src/public/app.js`, `src/public/styles.css` | Wireframe interface, navigation, charts and dialogs |
| `test/*.test.mjs` | Calculation, migration, permission, privacy and export checks |

## Browser checks

1. Sign in as manager. Open a spend detail, then a week and day; inspect unavailable hourly timing and the table.
2. Choose a single location/day with fewer than five records to inspect the hidden state and return-to-week flow.
3. Open Search and filter location names, prices and dates. Open Team to inspect member access/status.
4. Inspect Alerts over historical supplied-calendar dates. Follow a flag into its daily detail.
5. Export both report scopes and verify privacy labels, filters and calendar notes.
6. Sign in as reporting: details and exports work; Team and Alerts are absent and server access is forbidden.
7. In an isolated test business, add a member and verify mandatory password setup. Never use real student information for testing.

Production deployment, verified email/recovery, real data ingestion, final privacy policy and client acceptance are separate outstanding work.
