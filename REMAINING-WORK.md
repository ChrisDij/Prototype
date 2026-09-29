# Shop-A-Lytics implementation status

Updated 29 September 2026 against `Shop-A-Lytics MVP wireframes (3).pdf`, `user flow.pdf` and the recorded client decisions.

## Implemented

- Purple horizontal navigation, owner/member dashboard variants, four metric cards, price-band and weekday charts, own-location summary, responsive layouts.
- Owner registration with isolated businesses; email or legacy username login; salted password hashes and expiring sessions. Existing local credentials and data survive migration.
- Express 5 backend routing and middleware while retaining the existing local API contract, security headers and role checks.
- React 19 component interface built by Vite, with the existing page behaviour, charts, filters, dialogs and responsive styling retained.
- Owner dashboard operational overview with source coverage, anomaly-assessment coverage, current flags and shortcuts to team, data and alert management.
- Owner-only team list/add/remove/reset/reactivate. Generated temporary passwords must be shared privately; first login requires a different personal password before any data access. Removal and reset revoke sessions and retain audit history.
- Members can view, drill down, customise charts and export. Team and alert-list access are rejected by the server, not only hidden in the interface.
- Date and calendar filters; full five-year history; month/week/day navigation, breadcrumbs and weighted aggregates; line/bar selection and visual previous-period comparison.
- Controlled metric and line/bar customisation is available directly on the dashboard as well as detailed analysis; unsupported chart values are rejected by the API.
- URL and local-browser restoration of the current analytical view, explicit loading/error recovery, proportional location bars and empty-business onboarding.
- Owner-only validated JSON import with pseudonymised student keys, business-scoped locations, idempotent transaction updates, coverage/time-zone metadata and explicit source capabilities.
- Owner-assisted member password reset and reactivation with session revocation and mandatory first-login password replacement.
- Own-location search with price-band/date filtering. No cross-business source records or locations are returned.
- Hidden-data screen, return to week, server-side threshold suppression in all aggregate responses and PDF downloads. A second bucket is suppressed when a partition would otherwise contain exactly one hidden bucket.
- Count and average-value alerts using prior matching weekdays, location and calendar context, with at least four eligible days in the prior eight weeks. Threshold: both 50% and two standard deviations. Estimated 2021–2023 calendars are excluded. Flags do not remove records.
- Alert evidence includes method version, baseline size, direction, percentage deviation, standard-deviation score where meaningful and review priority. Thresholds remain explicitly provisional.
- Alert list/detail, reasons, historical observations and link into the flagged day. Members see only aggregate unusual-activity markers.
- Current-view/dashboard PDF choice, private feedback with two categories and screen context.
- Branded PDF layout with summary cards, selected chart, period rows, dashboard breakdowns, anomaly evidence, qualifications and page numbering.
- Formal automated/manual test matrix and prioritised issue register in `TEST-PLAN.md` and `ISSUES.md`.

## Not fabricated from missing source fields

- Hourly concentration alerts: the existing fixture places every record at noon. Hourly detail is enabled only for imports explicitly declaring reliable offset-bearing timestamps; anomaly rules for hourly concentration are not defined.
- Discount rates and high-discount alerts: imported discount amounts can be displayed only when explicitly declared as ZAR cents. Rate semantics and alert rules remain unconfirmed.
- Location maps and addresses: the synthetic locations have no addresses or coordinates. Search uses their existing names; no real locations are invented.
- Registration does not connect a BoschCard feed or seed another business with the demo retailer's records. Newly registered businesses correctly start empty.
- Email verification and invitations are not connected. Owner recovery uses a one-time locally stored code; members rely on owner-assisted access reset.
- Payment remains a later release, as specified by the wireframes.

## Before real deployment

1. Agree the implemented version 1 import contract, source ownership, field meanings, refresh/deletion policy and automated BoschCard transfer mechanism with the client.
2. Client approval of k=5, alert thresholds and visibility. The interface labels current thresholds provisional. Threshold/complementary suppression is not a formal privacy guarantee across arbitrary overlapping queries; stronger query restrictions or privacy-budget controls and a security review are required for real student data.
3. Verify estimated 2021–2023 calendar dates against historical calendars; estimates cannot reconstruct pandemic disruptions.
4. Define feedback ownership and review workflow, audit retention and recovery/backup procedures.
5. Add verified email/recovery, HTTPS/secure cookies, deployment configuration, abuse protection for registration, accessibility and performance testing, and client acceptance testing. The server remains loopback-only.

Source records remain wholly synthetic. The software is not confirmed fraud detection, a causal recommendation engine, or a live production service.
