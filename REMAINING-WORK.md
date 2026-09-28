# Shoplytics remaining work

Updated 24 September 2026 after the prototype expansion. This is the current implementation backlog; earlier meeting notes and recommendations remain historical records. Working permissions and PDF layouts are proposals, not client sign-off.

## Added to the prototype

- [x] Password login with two provisioned accounts, password hashing, persistent expiring sessions, logout and failed-attempt limiting.
- [x] SQLite storage using the supplied four-entity ERD, populated with synthetic records.
- [x] Separate application users, session storage, feedback and basic audit events.
- [x] Server-enforced primary/reporting permissions, including report access.
- [x] 2024–2026 calendar annotations and calendar-period selection, including overlapping events and unclassified dates.
- [x] Five-year synthetic history (28 September 2021–28 September 2026), year selection, and automatic preservation of existing accounts/data during the history upgrade.
- [x] Daily, weekly and monthly grouping with transaction-weighted averages and partial-group labelling.
- [x] Line/column chart switching and chart-value tables.
- [x] PDF download of the selected metric, dates, grouping and chart, with summary figures and calendar/coverage qualifications.
- [x] Feedback submission and per-account feedback history saved across restarts.
- [x] Automated checks for calculations, grouping, calendar dates, storage, login, permissions, feedback isolation and PDF responses.

## Needs data or a policy decision before completion

| Work still to add | Input needed | Next step |
| --- | --- | --- |
| Import the official dataset | File format, sample rows, field definitions, delivery timing and refresh policy | Build a validated import path with an explicit coverage record and an import-error report |
| Discount comparisons and useful insights | Meaning of value and discount, refunds/reversals, missing-value rules | Implement verified formulas and comparisons; keep observations non-causal |
| Vendor-category and location filters/comparisons | Actual type names/granularity and address/GPS format | Map available fields and implement relevant filters; placeholder types are not an official taxonomy |
| Named-retailer comparisons | Permission to disclose individual retailer figures | Apply visibility rules consistently to API responses, charts and exports |
| Final secondary permissions | Approval of proposed detail, filter and export capabilities | Update `permissions.mjs` and corresponding API checks |
| Privacy and aggregation thresholds | Minimum group sizes and confidentiality requirements | Suppress or aggregate small groups, including in PDFs; avoid indirect disclosure |
| Calendar context for 2021–2023 | Additional annual calendars and maintenance owner | 2024–2026 are implemented; earlier years remain unclassified |
| Fair calendar-period comparison view | Which periods clients want to compare and chosen normalisation | Add explicit per-covered-day comparisons and coverage disclosure; current context is annotation and date selection only |

## Further implementation after the team agrees the workflow

- [ ] Account creation, invitation, password reset/change, disabling accounts and role administration. Current setup provisions two local accounts only.
- [ ] A designated internal feedback reviewer, team-wide feedback inbox and optional response/status workflow. Users currently see only their own submissions.
- [ ] Final client-approved PDF layout, chosen observations and any preceding-period percentage comparisons. Basic graphical export is already working.
- [ ] Plain-language analytical observations and decision-support suggestions derived from validated rules. Current interpretation text explains metrics; it is not a recommendation engine.
- [ ] Approved audit scope, audit-review access and retention. Basic audit events are stored, but no audit-review interface exists.
- [ ] Production deployment configuration, HTTPS, secure production cookies, backup/restore procedures and security/accessibility review. Current server is deliberately local-only.
- [ ] Import and performance testing against the official dataset and expected data volume, followed by client acceptance testing.
- [ ] Shared repository setup and regular team contributions, plus final technology justification and handover checks.

## Optional features needing prioritisation

- [ ] Explainable anomaly flags: choose comparable-history rules, validate false alarms, agree visibility and investigation responsibility. No automatic statistical exclusions are implemented.
- [ ] Discount scatter plots once meaningful paired measures exist.
- [ ] Additional category-comparison charts, depending on the supplied classifications.
- [ ] Saved filters, saved chart preferences and personalisation.
- [ ] An internal anomaly-review workflow with reversible, justified exclusions, only if approved.

## Outside the current MVP

Payment processing, banking-detail collection, product/brand/basket analysis, campaign management, confirmed fraud detection and promises of live data. The current records remain synthetic and the supplied source-field meanings are still unconfirmed.

## Next client decisions

1. Confirm reporting users may export the proposed summary PDF and use date/calendar/grouping controls.
2. Confirm vendor categories, geography and named-retailer disclosure rules.
3. Review the PDF layout and decide which observations it must contain.
4. Identify feedback ownership and whether anomaly detection should remain optional.
