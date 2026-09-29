# Shop-A-Lytics test plan

Last updated: 29 September 2026

## Purpose

Verify that the owner dashboard, authentication, access control, chart customisation, PDF export, privacy controls and provisional anomaly detection behave consistently with the agreed scope.

## Test levels

| Level | Coverage | Execution |
| --- | --- | --- |
| Unit | Date calculations, aggregation, privacy suppression, calendar matching, import validation and anomaly thresholds | `npm test` |
| Integration | SQLite persistence, migrations, authentication, sessions, role checks, feedback and PDF endpoints | `npm test` |
| Build | React/Vite production bundle and static assets | Automatically runs before `npm test` and `npm start` |
| Browser | Complete owner and member journeys, responsive layout, keyboard use and downloaded PDF review | Manual before client demonstrations |
| Acceptance | Client confirmation of terminology, access boundaries, report content and anomaly thresholds | Client session; record outcome in `ISSUES.md` |

## Environments and test data

- Use Node.js 22.13 or newer.
- Automated tests use isolated temporary SQLite databases.
- Browser checks use only the supplied synthetic demonstration data or explicitly prepared test imports.
- Never use real student records in development demonstrations.
- Test both manager and member roles.

## Automated test cases

| ID | Requirement | Expected result |
| --- | --- | --- |
| AUTH-01 | Valid manager/member login | A private session cookie is issued and the correct capabilities are returned. |
| AUTH-02 | Invalid credentials | Login fails without disclosing whether the username exists. |
| AUTH-03 | Temporary member password | All data endpoints remain blocked until a different personal password is set. |
| AUTH-04 | Logout/reset/removal | Existing sessions are revoked. |
| ACL-01 | Manager-only team functions | Members receive HTTP 403 from team endpoints. |
| ACL-02 | Manager-only alerts | Members receive HTTP 403 and do not receive alert explanations in aggregate responses. |
| ACL-03 | Business isolation | Users cannot request another business's locations or records. |
| ACL-04 | Export permission | Both agreed client roles can export; unauthenticated requests fail. |
| DASH-01 | Owner dashboard totals | Totals reconcile with daily and grouped data. |
| DASH-02 | Empty business onboarding | A new business sees setup guidance, not another business's demonstration data. |
| CHART-01 | Chart choices | Only line and bar charts are accepted by both UI and API. |
| CHART-02 | Metric choices | Transaction count, total value and average value are calculated and labelled correctly. |
| CHART-03 | Drill-down | Monthly/weekly/daily ranges remain inclusive and preserve filters. |
| PDF-01 | PDF format | Export starts with a valid PDF signature and contains the selected scope. |
| PDF-02 | Privacy | Hidden values remain hidden in exports. |
| PDF-03 | Report variants | Current-view and dashboard-summary reports render with line and bar charts. |
| ANOM-01 | Historical baseline | The reviewed day is excluded and at least four eligible matching weekdays are required. |
| ANOM-02 | Context matching | Location, weekday and verified calendar context must match. |
| ANOM-03 | Threshold boundary | A flag requires more than both 50% deviation and two standard deviations. |
| ANOM-04 | Retention | Flagged records remain in totals and reports. |
| PRIV-01 | Minimum group | Groups below five transactions are hidden. |
| PRIV-02 | Complementary suppression | A second bucket is hidden where one hidden bucket could otherwise be derived. |
| DATA-01 | Import contract | Unsafe, oversized or unsupported records are rejected. |
| DATA-02 | Idempotency | Reimporting an external transaction updates it without duplication. |

## Manual browser cases

1. Log in as a manager and confirm the dashboard shows owner overview, metrics, chart controls, locations and recent alerts.
2. Switch the dashboard metric between transaction count, total spend and average transaction; switch between line and bar charts.
3. Apply date, location, calendar-period and price-band filters, then drill from a month into a week and day.
4. Export current-view and dashboard PDFs; inspect branding, totals, chart, detail rows, privacy notes, calendar context and page numbering.
5. Open an anomaly and verify baseline dates, deviation percentage, standard-deviation evidence, method version and link to the selected day.
6. Add a member, verify first-login password replacement, reset access and remove access.
7. Log in as a member and confirm Team, Data and Alerts are absent; direct API requests must still return 403.
8. Test keyboard-only navigation, visible focus, form labels, error messages and a narrow mobile viewport.
9. Create a new business and confirm it begins empty with data-onboarding guidance.
10. Stop and restart the application and verify accounts, feedback and data persist.

## Entry and exit criteria

Work is ready for a client demonstration when:

- `npm test` passes with no failures.
- The production build completes.
- No open P0 or P1 software defect remains.
- Manager and member browser journeys pass.
- Both PDF scopes have been visually inspected.
- Provisional anomaly language and known limitations remain visible.

## Defect process

Record defects in `ISSUES.md` with an ID, severity, status, evidence and acceptance condition. Fix P0/P1 software defects before demonstrations. Product decisions that need client approval remain open and must not be silently converted into technical assumptions.
