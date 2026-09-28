# Shop-A-Lytics implementation status

Updated 28 September 2026 against `Shop-A-Lytics MVP wireframes (3).pdf` and `user flow.pdf`.

## Implemented

- Purple horizontal navigation, owner/member dashboard variants, four metric cards, price-band and weekday charts, own-location summary, responsive layouts.
- Owner registration with isolated businesses; email or legacy username login; salted password hashes and expiring sessions. Existing local credentials and data survive migration.
- Owner-only team list/add/remove. Generated temporary passwords must be shared privately; first login requires a different personal password before any data access. Removal revokes sessions and retains audit history.
- Members can view, drill down, customise charts and export. Team and alert-list access are rejected by the server, not only hidden in the interface.
- Date and calendar filters; full five-year history; month/week/day navigation, breadcrumbs and weighted aggregates; line/bar selection and previous-period comparison.
- Own-location search with price-band/date filtering. No cross-business source records or locations are returned.
- Hidden-data screen, return to week, server-side threshold suppression in all aggregate responses and PDF downloads. A second bucket is suppressed when a partition would otherwise contain exactly one hidden bucket.
- Count and average-value alerts using prior matching weekdays, location and calendar context, with at least four eligible days in the prior eight weeks. Threshold: both 50% and two standard deviations. Estimated 2021–2023 calendars are excluded. Flags do not remove records.
- Alert list/detail, reasons, historical observations and link into the flagged day. Members see only aggregate unusual-activity markers.
- Current-view/dashboard PDF choice, private feedback with two categories and screen context.

## Not fabricated from missing source fields

- Hourly charts and concentration alerts: the existing fixture places every record at noon. Actual transaction times and the source time zone are needed. Day/hour entry points show an explicit unavailable state; whole-week fallback is functional.
- Discount amounts, discount rates and high-discount alerts: all discounts are null and the interpretation of the field is unconfirmed. These are shown as unavailable, not zero.
- Location maps and addresses: the synthetic locations have no addresses or coordinates. Search uses their existing names; no real locations are invented.
- Registration does not connect a BoschCard feed or seed another business with the demo retailer's records. Newly registered businesses correctly start empty.
- Password-reset email, email verification and invitations are not connected. The recovery link explains the limitation; it does not claim that an email was sent.
- Payment remains a later release, as specified by the wireframes.

## Before real deployment

1. Agree official import format, data field meanings, coverage, time zone and refresh policy; implement a validated importer.
2. Client approval of k=5, alert thresholds and visibility. Threshold/complementary suppression is not a formal privacy guarantee across arbitrary overlapping queries; stronger query restrictions or privacy-budget controls and a security review are required for real student data.
3. Verify estimated 2021–2023 calendar dates against historical calendars; estimates cannot reconstruct pandemic disruptions.
4. Define feedback ownership and review workflow, audit retention and recovery/backup procedures.
5. Add verified email/recovery, HTTPS/secure cookies, deployment configuration, abuse protection for registration, accessibility and performance testing, and client acceptance testing. The server remains loopback-only.

Source records remain wholly synthetic. The software is not confirmed fraud detection, a causal recommendation engine, or a live production service.
