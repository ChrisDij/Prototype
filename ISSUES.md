# Shop-A-Lytics issue register

Last updated: 29 September 2026

## Status definitions

- **Open:** Work or a decision is still required.
- **Blocked:** A named external input is required before implementation can continue.
- **In validation:** Implemented but awaiting automated, manual or client confirmation.
- **Closed:** Acceptance condition has been met and evidence is recorded.

## Active issues and decisions

| ID | Priority | Status | Area | Issue or decision | Acceptance condition |
| --- | --- | --- | --- | --- | --- |
| DATA-001 | P1 | Blocked | Source data | Confirm the final ERD fields, transfer format, update frequency, deletion policy and ownership rules. | Client/lecturer supplies and approves the final data contract; import tests pass with representative data. |
| PRIV-001 | P1 | Blocked | Privacy | The current minimum group size of five and complementary suppression are provisional. | Client approval plus privacy/security review for the intended dataset and query model. |
| ANOM-001 | P1 | Blocked | Anomaly detection | Detection thresholds and manager visibility remain provisional. | Client approves the baseline, 50%/two-standard-deviation rule, review workflow and wording. |
| CAL-001 | P2 | Blocked | Calendar | The 2021–2023 university periods are estimates. | Replace estimates with verified historical calendars and rerun calendar/anomaly tests. |
| AUTH-001 | P2 | Open | Authentication | Email verification, invitation delivery and hosted password recovery are not connected. | A chosen delivery provider is integrated and verified in a non-local environment. |
| DEPLOY-001 | P2 | Open | Deployment | The server is deliberately localhost-only and cookies are not configured for HTTPS hosting. | Hosting environment, HTTPS, secure cookies, secrets and backup/recovery are implemented and tested. |
| DATA-002 | P2 | Open | Source semantics | Reliable hourly timestamps and discount semantics are absent from the demonstration fixture. | Approved source data declares these capabilities; related views are validated before activation. |
| QA-001 | P2 | In validation | Accessibility | Automated landmarks exist, but a complete keyboard and assistive-technology review is outstanding. | Manual keyboard pass and screen-reader review completed with no P1/P2 accessibility defects. |
| QA-002 | P2 | Open | Performance | Production-size import and dashboard performance have not been measured. | Test with the expected maximum dataset and record agreed response-time targets. |
| FEEDBACK-001 | P3 | Blocked | Feedback | Ownership, review frequency and retention period for submitted feedback are not agreed. | Client assigns an owner and approves retention/responding procedure. |

## Recently completed implementation items

| ID | Status | Evidence |
| --- | --- | --- |
| DASH-001 | Closed | Manager dashboard includes metrics, drill-down, location summaries, recent alerts and an operational owner overview. |
| ACL-001 | Closed | Express middleware and database methods enforce authentication, role permissions and business isolation; integration tests cover direct endpoint access. |
| CHART-001 | Closed | Dashboard and detail views expose controlled metric and line/bar selections; unsupported chart values are rejected by the API. |
| PDF-001 | In validation | Branded PDF includes summary cards, selected chart, detailed rows, dashboard breakdowns, anomaly evidence, qualifications and page numbers. Automated generation tests pass; final visual client review remains. |
| ANOM-002 | In validation | Alerts expose method version, baseline size, direction, deviation percentage, z-score where available and review priority. Records remain in aggregates. |
| QA-003 | Closed | Automated unit/integration suite and this test plan are stored in the repository and run through `npm test`. |

## Issue update template

When adding an issue, include:

- **ID and concise title**
- **Date found**
- **Reporter/owner**
- **Priority:** P0 critical, P1 high, P2 medium or P3 low
- **Environment and account role**
- **Steps to reproduce or decision required**
- **Expected and actual result**
- **Evidence:** screenshot, log, failing test or meeting decision
- **Status and acceptance condition**
